import type { FastifyInstance } from "fastify";
import { checkDatabaseHealth } from "../database";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => {
    const databaseOk = checkDatabaseHealth();

    return {
      status: databaseOk ? "ok" : "degraded",
      uptime: process.uptime(),
      database: databaseOk ? "ok" : "error",
      whatsapp: "not_implemented"
    };
  });
}
