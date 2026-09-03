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

  function currentStatus(): WhatsAppStatus {
    return { status, phoneNumber, qrCode, lastEventAt };
  }

  function notify(): void {
    lastEventAt = new Date().toISOString();
    emitter.emit("change", currentStatus());
  }

  /**
   * Único caminho de envio: despacha a mensagem e retorna assim que o servidor do
   * WhatsApp aceita a escrita. Quem chama pode tratar a exceção como "não saiu" —
   * ver o comentário no topo do arquivo sobre o que conta como "enviado".
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

    const sent = await activeSocket.sendMessage(jid, content);
    if (!sent?.key?.id) {
      throw new Error("O WhatsApp não devolveu identificador da mensagem — envio não confirmado");
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
