import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";
import { getWhatsAppManager, type WhatsAppStatus } from "../services/whatsapp";
import { env } from "../config/env";

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

  app.get("/api/whatsapp/groups", async () => {
    if (manager.getStatus().status !== "connected") {
      return { connected: false, groups: [] };
    }
    try {
      return { connected: true, groups: await manager.listGroups() };
    } catch {
      return { connected: true, groups: [] };
    }
  });

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
    // reply.raw.writeHead() ignora qualquer header já setado no `reply` do Fastify —
    // inclusive o Access-Control-Allow-Origin que o @fastify/cors normalmente injeta.
    // Como este endpoint não passa pelo pipeline normal de resposta (hijack), o CORS
    // precisa ser reaplicado manualmente aqui, senão o EventSource cross-origin falha.
    const corsHeaders: Record<string, string> = {};
    if (env.corsAllowedOrigin) {
      corsHeaders["Access-Control-Allow-Origin"] = env.corsAllowedOrigin;
      corsHeaders["Access-Control-Allow-Credentials"] = "true";
    }
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders
    });

    const send = async (status: WhatsAppStatus): Promise<void> => {
      const payload = await toPayload(status);
      if (reply.raw.writableEnded) return;
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const safeSend = (status: WhatsAppStatus): void => {
      send(status).catch((error) => app.log.error(error, "falha ao enviar evento SSE do WhatsApp"));
    };

    await send(manager.getStatus()).catch((error) => app.log.error(error, "falha ao enviar status inicial via SSE"));
    const unsubscribe = manager.onChange(safeSend);

    request.raw.on("close", () => {
      unsubscribe();
      reply.raw.end();
    });
  });
}
