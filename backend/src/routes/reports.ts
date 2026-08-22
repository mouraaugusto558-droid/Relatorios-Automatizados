import type { FastifyInstance } from "fastify";
import { getDatabase } from "../database";
import { createReportsRepository } from "../database/repositories/reportsRepository";

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  const reportsRepository = createReportsRepository(getDatabase());

  app.get("/api/reports", async () => reportsRepository.list());
}
