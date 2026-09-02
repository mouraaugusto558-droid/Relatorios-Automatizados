import fs from "node:fs";
import { EventEmitter } from "node:events";
import type { AnyMessageContent, WASocket } from "@whiskeysockets/baileys";
import { createServiceLogger } from "../../utils/logger";

interface BoomLikeError {
  output?: { statusCode?: number };
}

export type WhatsAppConnectionStatus = "disconnected" | "connecting" | "qr" | "connected";

export interface WhatsAppStatus {
  status: WhatsAppConnectionStatus;
  phoneNumber: string | null;
  qrCode: string | null;
  lastEventAt: string | null;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
}

export interface WhatsAppManager {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): WhatsAppStatus;
  getQRCode(): string | null;
  onChange(listener: (status: WhatsAppStatus) => void): () => void;
  sendMessage(jid: string, text: string): Promise<void>;
  sendImage(jid: string, image: Buffer, caption?: string): Promise<void>;
  sendDocument(jid: string, document: Buffer, fileName: string, mimetype: string): Promise<void>;
  listGroups(): Promise<WhatsAppGroup[]>;
}

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

// `socket.sendMessage` do Baileys resolve assim que a mensagem é cifrada e escrita
// no websocket — isso NÃO significa que o servidor do WhatsApp a aceitou. Um socket
// "meio-morto" (TCP ainda aberto, sessão já inválida do outro lado) engole a escrita
// e a mensagem some, sem erro nenhum: foi o que aconteceu em 2026-09-02, quando
// quatro relatórios apareceram como "Enviado" no painel e nenhum chegou. Por isso
// todo envio espera o ACK do servidor (status >= SERVER_ACK) antes de ser dado
// como concluído.
const SERVER_ACK_STATUS = 2;
const ACK_TIMEOUT_MS = 30_000;
// Cobre a corrida entre o `sendMessage` resolver e o waiter conseguir se registrar:
// o ACK pode chegar nesse intervalo. Limitado para não crescer indefinidamente.
const ACK_HISTORY_LIMIT = 200;

export function createWhatsAppManager(authPath: string): WhatsAppManager {
  const logger = createServiceLogger();
  const emitter = new EventEmitter();

  let socket: WASocket | null = null;
  let status: WhatsAppConnectionStatus = "disconnected";
  let qrCode: string | null = null;
  let phoneNumber: string | null = null;
  let manualDisconnect = false;
  let reconnectAttempts = 0;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let lastEventAt: string | null = null;

  const ackEmitter = new EventEmitter();
  // Um listener por envio em andamento. O limite padrão de 10 dispararia um aviso
  // falso de vazamento quando as várias imagens da planilha saem em sequência.
  ackEmitter.setMaxListeners(0);
  const acknowledgedIds = new Set<string>();
  const acknowledgedOrder: string[] = [];

  function currentStatus(): WhatsAppStatus {
    return { status, phoneNumber, qrCode, lastEventAt };
  }

  function notify(): void {
    lastEventAt = new Date().toISOString();
    emitter.emit("change", currentStatus());
  }

  function recordAck(messageId: string): void {
    if (acknowledgedIds.has(messageId)) return;

    acknowledgedIds.add(messageId);
    acknowledgedOrder.push(messageId);
    if (acknowledgedOrder.length > ACK_HISTORY_LIMIT) {
      const oldest = acknowledgedOrder.shift();
      if (oldest) acknowledgedIds.delete(oldest);
    }

    ackEmitter.emit(messageId);
  }

  function waitForServerAck(messageId: string): Promise<void> {
    if (acknowledgedIds.has(messageId)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      // Declaração de função (hoisted) para poder referenciar o `timer` criado
      // logo abaixo — o listener só roda depois que ele existe.
      function onAck(): void {
        clearTimeout(timer);
        resolve();
      }

      const timer = setTimeout(() => {
        ackEmitter.off(messageId, onAck);
        reject(
          new Error(
            `O servidor do WhatsApp não confirmou o envio em ${ACK_TIMEOUT_MS / 1000}s — a conexão está inutilizável`
          )
        );
      }, ACK_TIMEOUT_MS);

      ackEmitter.once(messageId, onAck);
    });
  }

  /**
   * Derruba um socket que aceita escritas mas não recebe ACK do servidor. Sem isto a
   * sessão morta continuaria marcada como "connected" para sempre e todo envio
   * seguinte cairia no mesmo buraco silencioso — o `scheduleReconnect` sobe uma
   * sessão nova a partir das credenciais salvas.
   */
  function dropDeadSocket(): void {
    const deadSocket = socket;
    socket = null;
    phoneNumber = null;
    reconnectAttempts = 0;

    try {
      deadSocket?.end(new Error("ACK do servidor não recebido"));
    } catch {
      // O socket já pode estar inutilizável; o que importa é agendar a reconexão.
    }

    scheduleReconnect();
  }

  /**
   * Único caminho de envio: despacha a mensagem e só retorna depois que o servidor
   * do WhatsApp confirmar o recebimento. Quem chama pode tratar a exceção como
   * "não foi entregue" — ver comentário em SERVER_ACK_STATUS.
   */
  async function sendWithAck(jid: string, content: AnyMessageContent): Promise<void> {
    const activeSocket = socket;
    if (!activeSocket || status !== "connected") {
      throw new Error("WhatsApp não está conectado");
    }

    const sent = await activeSocket.sendMessage(jid, content);
    const messageId = sent?.key?.id;
    if (!messageId) {
      throw new Error("O WhatsApp não devolveu identificador da mensagem — envio não confirmado");
    }

    try {
      await waitForServerAck(messageId);
    } catch (error) {
      dropDeadSocket();
      throw error;
    }
  }

  function scheduleReconnect(): void {
    if (reconnectTimer) return;

    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY_MS);
    reconnectAttempts += 1;

    status = "connecting";
    notify();

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectInternal().catch((error) => {
        logger.error(error, "falha ao reconectar ao WhatsApp");
        scheduleReconnect();
      });
    }, delay);
  }

  async function connectInternal(): Promise<void> {
    status = "connecting";
    manualDisconnect = false;
    notify();

    const baileys = await import("@whiskeysockets/baileys");
    const { makeWASocket, useMultiFileAuthState, DisconnectReason } = baileys;

    fs.mkdirSync(authPath, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    socket = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ["Painel de Relatórios", "Chrome", "1.0.0"]
    });

    socket.ev.on("creds.update", saveCreds);

    // Confirmação de que o servidor aceitou a mensagem — é o sinal que o
    // `sendWithAck` fica esperando.
    socket.ev.on("messages.update", (updates) => {
      for (const { key, update } of updates) {
        // `update.status` é o enum proto.WebMessageInfo.Status; comparamos pelo valor
        // numérico para não precisar carregar o proto só por causa de uma constante.
        // Sem status (null/undefined) vira -1, que nunca passa no teste abaixo.
        const ackStatus = Number(update.status ?? -1);
        if (key.id && ackStatus >= SERVER_ACK_STATUS) {
          recordAck(key.id);
        }
      }
    });

    socket.ev.on("connection.update", (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        qrCode = qr;
        status = "qr";
        notify();
      }

      if (connection === "open") {
        status = "connected";
        qrCode = null;
        reconnectAttempts = 0;
        phoneNumber = socket?.user?.id?.split(":")[0] ?? null;
        notify();
      }

      if (connection === "close") {
        phoneNumber = null;
        const statusCode = (lastDisconnect?.error as BoomLikeError | undefined)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (!manualDisconnect && !loggedOut) {
          scheduleReconnect();
        } else {
          if (loggedOut) {
            // Sessão deslogada (ex.: desvinculada pelo celular, ou expirada): as
            // credenciais salvas nunca mais vão autenticar. Sem limpá-las, uma
            // futura chamada a connect() reusaria os mesmos creds inválidos e
            // cairia no mesmo loggedOut de novo, sem nunca gerar um QR novo.
            fs.rmSync(authPath, { recursive: true, force: true });
          }
          status = "disconnected";
          qrCode = null;
          notify();
        }
      }
    });
  }

  return {
    async connect(): Promise<void> {
      if (status === "connecting" || status === "connected" || status === "qr") return;
      await connectInternal();
    },

    async disconnect(): Promise<void> {
      manualDisconnect = true;
      reconnectAttempts = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        await socket.logout().catch(() => undefined);
        socket = null;
      }
      status = "disconnected";
      qrCode = null;
      phoneNumber = null;
      notify();
    },

    getStatus(): WhatsAppStatus {
      return currentStatus();
    },

    onChange(listener: (status: WhatsAppStatus) => void): () => void {
      emitter.on("change", listener);
      return () => emitter.off("change", listener);
    },

    getQRCode(): string | null {
      return qrCode;
    },

    async sendMessage(jid: string, text: string): Promise<void> {
      await sendWithAck(jid, { text });
    },

    async sendImage(jid: string, image: Buffer, caption?: string): Promise<void> {
      await sendWithAck(jid, { image, caption });
    },

    async sendDocument(jid: string, document: Buffer, fileName: string, mimetype: string): Promise<void> {
      await sendWithAck(jid, { document, fileName, mimetype });
    },

    async listGroups(): Promise<WhatsAppGroup[]> {
      if (!socket || status !== "connected") {
        throw new Error("WhatsApp não está conectado");
      }
      const groups = await socket.groupFetchAllParticipating();
      return Object.values(groups)
        .map((group) => ({ id: group.id, name: group.subject }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
  };
}
