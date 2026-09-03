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

// O que conta como "enviado": o `socket.sendMessage` do Baileys só resolve depois
// de cifrar a mensagem e escrevê-la no websocket, e a escrita:
//   - lança na hora se o websocket não está aberto (`ws.isOpen === false`);
//   - tem timeout próprio (`connectTimeoutMs`, ~20s) se o write travar.
// Ou seja, se `sendMessage` resolve com um id, a mensagem saiu de fato para o
// servidor do WhatsApp — que a entrega ao destinatário quando o aparelho dele
// reconectar, esteja ele online agora ou não.
//
// NÃO esperamos ✓✓/recibo de entrega: esse sinal depende do celular do
// destinatário responder (rede, Doze, app em segundo plano) e, para grupos, o
// Baileys nem emite o evento. Uma versão anterior esperava esse recibo por 30s e
// derrubava a conexão quando ele não vinha — o que fazia todo relatório para
// número "lento" ou para grupo falhar mesmo com a mensagem já entregue.
//
// A proteção contra "socket meio-morto" (2026-09-02, quatro relatórios "Enviado"
// e nenhum chegou) fica com o próprio Baileys: o keep-alive fecha a conexão e
// dispara `scheduleReconnect`, e o `ws.isOpen` abaixo barra o envio numa sessão
// zumbi antes de dar como enviado.

// Depois do `sendMessage` resolver, o servidor ainda pode RECUSAR a mensagem de
// forma assíncrona (ack com `error`, ex. 463 quando o número de destino não tem
// conta válida). Esse "NACK" chega como `messages.update` com status ERROR (0) em
// poucos segundos. Esperamos só por essa janela curta: se o NACK vem, o envio
// falhou de verdade; se não vem, seguimos em frente (não travamos esperando o
// ✓✓ do destinatário, nem derrubamos a conexão).
const SEND_REJECTED_STATUS = 0; // proto.WebMessageInfo.Status.ERROR
const SERVER_ACK_STATUS = 2; // proto.WebMessageInfo.Status.SERVER_ACK
const SEND_NACK_WINDOW_MS = 10_000;

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

  // Resultado assíncrono de cada envio, chaveado pelo id da mensagem:
  // `{ rejectedWith: "463" }` quando o servidor recusa, ou o evento de ACK.
  const sendOutcome = new EventEmitter();
  sendOutcome.setMaxListeners(0);

  // Cache de JID canônico por número consultado — o `onWhatsApp` resolve o
  // formato certo (ex.: 9º dígito do celular no Brasil) e diz se o número
  // existe. Sem isso, um número mal formatado só falha lá no servidor (463).
  const resolvedJidCache = new Map<string, string>();

  function currentStatus(): WhatsAppStatus {
    return { status, phoneNumber, qrCode, lastEventAt };
  }

  function notify(): void {
    lastEventAt = new Date().toISOString();
    emitter.emit("change", currentStatus());
  }

  /**
   * Converte `<digitos>@s.whatsapp.net` no JID que o WhatsApp realmente usa para
   * aquele número e confirma que a conta existe. Grupos e JIDs já resolvidos
   * passam direto. Se a consulta falhar (rede), devolve o JID original em vez de
   * bloquear o envio.
   */
  async function resolveIndividualJid(activeSocket: WASocket, jid: string): Promise<string> {
    if (!jid.endsWith("@s.whatsapp.net")) return jid;

    const number = jid.split("@")[0];
    const cached = resolvedJidCache.get(number);
    if (cached) return cached;

    let results: Awaited<ReturnType<WASocket["onWhatsApp"]>>;
    try {
      results = await activeSocket.onWhatsApp(number);
    } catch (error) {
      logger.warn({ err: error, number }, "onWhatsApp falhou — usando o número como veio");
      return jid;
    }

    const match = results?.find((entry) => entry.exists);
    if (!match) {
      throw new Error(`O número ${number} não tem uma conta de WhatsApp ativa`);
    }

    resolvedJidCache.set(number, match.jid);
    return match.jid;
  }

  /**
   * Espera uma janela curta pelo veredito assíncrono do servidor sobre a
   * mensagem recém-enviada. Rejeita se o servidor recusou (ack com erro);
   * resolve no ACK do servidor ou quando a janela expira sem recusa — nesse
   * caso a mensagem está na fila do WhatsApp e será entregue.
   */
  function waitForSendVerdict(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      function onOutcome(outcome: { rejectedWith?: string }): void {
        clearTimeout(timer);
        sendOutcome.off(messageId, onOutcome);
        if (outcome.rejectedWith) {
          reject(new Error(`O servidor do WhatsApp recusou a mensagem (erro ${outcome.rejectedWith})`));
        } else {
          resolve();
        }
      }

      const timer = setTimeout(() => {
        sendOutcome.off(messageId, onOutcome);
        resolve();
      }, SEND_NACK_WINDOW_MS);

      sendOutcome.on(messageId, onOutcome);
    });
  }

  /**
   * Único caminho de envio: resolve o destino, despacha a mensagem e só volta
   * depois de passar a janela em que o servidor poderia recusá-la. Quem chama
   * pode tratar a exceção como "não saiu" — ver o comentário no topo do arquivo.
   */
  async function dispatchMessage(jid: string, content: AnyMessageContent): Promise<void> {
    const activeSocket = socket;
    if (!activeSocket || status !== "connected") {
      throw new Error("WhatsApp não está conectado");
    }

    if (!activeSocket.ws.isOpen) {
      // status diz "connected", mas o websocket já caiu: sessão zumbi. Força a
      // reconexão e falha este envio com um erro claro em vez de escrever num
      // socket morto e a mensagem sumir sem aviso.
      scheduleReconnect();
      throw new Error("A conexão com o WhatsApp caiu — reconectando, tente novamente em instantes");
    }

    const targetJid = await resolveIndividualJid(activeSocket, jid);
    const sent = await activeSocket.sendMessage(targetJid, content);
    const messageId = sent?.key?.id;
    if (!messageId) {
      throw new Error("O WhatsApp não devolveu identificador da mensagem — envio não confirmado");
    }

    await waitForSendVerdict(messageId);
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

    // Veredito assíncrono do servidor sobre mensagens que enviamos: um ack com
    // erro vira status ERROR (0) + o código em messageStubParameters; o ACK do
    // servidor vira status >= 2. O `dispatchMessage` fica escutando isso.
    socket.ev.on("messages.update", (updates) => {
      for (const { key, update } of updates) {
        if (!key.fromMe || !key.id) continue;
        const msgStatus = Number(update.status ?? -1);
        if (msgStatus === SEND_REJECTED_STATUS) {
          const code = update.messageStubParameters?.[0] ?? "desconhecido";
          sendOutcome.emit(key.id, { rejectedWith: String(code) });
        } else if (msgStatus >= SERVER_ACK_STATUS) {
          sendOutcome.emit(key.id, {});
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
      await dispatchMessage(jid, { text });
    },

    async sendImage(jid: string, image: Buffer, caption?: string): Promise<void> {
      await dispatchMessage(jid, { image, caption });
    },

    async sendDocument(jid: string, document: Buffer, fileName: string, mimetype: string): Promise<void> {
      await dispatchMessage(jid, { document, fileName, mimetype });
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
