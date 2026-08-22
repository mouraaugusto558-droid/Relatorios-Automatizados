import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";
import { getWhatsAppManager, type WhatsAppStatus } from "../services/whatsapp";

interface WhatsAppStatusPayload {
  status: WhatsAppStatus["status"];
  phoneNumber: string | null;
  qrDataUrl: string | null;
  lastEventAt: string | null;
}

async function toPayload(status: WhatsAppStatus): Promise<WhatsAppStatusPayload> {
  return {
    status: status.status,
    phoneNumber: status.phoneNumber,
    qrDataUrl: status.qrCode ? await QRCode.toDataURL(status.qrCode) : null,
    lastEventAt: status.lastEventAt
  };
}

export async function whatsappRoutes(app: FastifyInstance): Promise<void> {
  const manager = getWhatsAppManager();

  app.get("/api/whatsapp/status", async () => toPayload(manager.getStatus()));

  app.post("/api/whatsapp/connect", async () => {
    await manager.connect();
    return toPayload(manager.getStatus());
  });

  app.post("/api/whatsapp/disconnect", async () => {
    await manager.disconnect();
    return toPayload(manager.getStatus());
  });

  app.get("/api/whatsapp/events", async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    const send = async (status: WhatsAppStatus): Promise<void> => {
      const payload = await toPayload(status);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    await send(manager.getStatus());
    const unsubscribe = manager.onChange((status) => {
      void send(status);
    });

    request.raw.on("close", () => {
      unsubscribe();
      reply.raw.end();
    });
  });
}
