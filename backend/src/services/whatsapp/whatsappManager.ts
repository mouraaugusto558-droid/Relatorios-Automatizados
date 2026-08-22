import fs from "node:fs";
import { EventEmitter } from "node:events";
import type { AnyMessageContent, WASocket } from "@whiskeysockets/baileys";
import pino from "pino";

interface BoomLikeError {
  output?: { statusCode?: number };
}

export type WhatsAppConnectionStatus = "disconnected" | "connecting" | "qr" | "connected";

export interface WhatsAppStatus {
  status: WhatsAppConnectionStatus;
  phoneNumber: string | null;
  qrCode: string | null;
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
}

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

export function createWhatsAppManager(authPath: string): WhatsAppManager {
  const logger = pino({ level: "warn" });
  const emitter = new EventEmitter();

  let socket: WASocket | null = null;
  let status: WhatsAppConnectionStatus = "disconnected";
  let qrCode: string | null = null;
  let phoneNumber: string | null = null;
  let manualDisconnect = false;
  let reconnectAttempts = 0;
  let reconnectTimer: NodeJS.Timeout | null = null;

  function currentStatus(): WhatsAppStatus {
    return { status, phoneNumber, qrCode };
  }

  function notify(): void {
    emitter.emit("change", currentStatus());
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
      printQRInTerminal: false
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
      if (!socket || status !== "connected") {
        throw new Error("WhatsApp não está conectado");
      }
      await socket.sendMessage(jid, { text });
    },

    async sendImage(jid: string, image: Buffer, caption?: string): Promise<void> {
      if (!socket || status !== "connected") {
        throw new Error("WhatsApp não está conectado");
      }
      const content: AnyMessageContent = { image, caption };
      await socket.sendMessage(jid, content);
    },

    async sendDocument(jid: string, document: Buffer, fileName: string, mimetype: string): Promise<void> {
      if (!socket || status !== "connected") {
        throw new Error("WhatsApp não está conectado");
      }
      const content: AnyMessageContent = { document, fileName, mimetype };
      await socket.sendMessage(jid, content);
    }
  };
}
