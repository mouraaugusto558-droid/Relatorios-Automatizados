import fs from "node:fs";
import type { AnyMessageContent, WASocket } from "@whiskeysockets/baileys";
import pino from "pino";

interface BoomLikeError {
  output?: { statusCode?: number };
}

export type WhatsAppConnectionStatus = "disconnected" | "connecting" | "qr" | "connected";

export interface WhatsAppStatus {
  status: WhatsAppConnectionStatus;
  phoneNumber: string | null;
}

export interface WhatsAppManager {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): WhatsAppStatus;
  getQRCode(): string | null;
  sendMessage(jid: string, text: string): Promise<void>;
  sendImage(jid: string, image: Buffer, caption?: string): Promise<void>;
  sendDocument(jid: string, document: Buffer, fileName: string, mimetype: string): Promise<void>;
}

export function createWhatsAppManager(authPath: string): WhatsAppManager {
  const logger = pino({ level: "warn" });

  let socket: WASocket | null = null;
  let status: WhatsAppConnectionStatus = "disconnected";
  let qrCode: string | null = null;
  let phoneNumber: string | null = null;
  let manualDisconnect = false;

  async function connectInternal(): Promise<void> {
    status = "connecting";
    manualDisconnect = false;

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
      }

      if (connection === "open") {
        status = "connected";
        qrCode = null;
        phoneNumber = socket?.user?.id?.split(":")[0] ?? null;
      }

      if (connection === "close") {
        phoneNumber = null;
        const statusCode = (lastDisconnect?.error as BoomLikeError | undefined)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (!manualDisconnect && !loggedOut) {
          status = "connecting";
          void connectInternal();
        } else {
          status = "disconnected";
          qrCode = null;
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
      if (socket) {
        await socket.logout().catch(() => undefined);
        socket = null;
      }
      status = "disconnected";
      qrCode = null;
      phoneNumber = null;
    },

    getStatus(): WhatsAppStatus {
      return { status, phoneNumber };
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
