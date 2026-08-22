import type { FastifyInstance } from "fastify";
import { checkDatabaseHealth } from "../database";
import { getWhatsAppManager } from "../services/whatsapp";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => {
    const databaseOk = checkDatabaseHealth();
    const whatsapp = getWhatsAppManager().getStatus();

    return {
      status: databaseOk ? "ok" : "degraded",
      uptime: process.uptime(),
      database: databaseOk ? "ok" : "error",
      whatsapp: whatsapp.status,
      whatsappNumber: whatsapp.phoneNumber
    };
  });
}
