import type { FastifyInstance } from "fastify";
import { getDatabase } from "../database";
import { createRepositories } from "../database/repositories";

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  const { reports: reportsRepository } = createRepositories(getDatabase());

  app.get("/api/reports", async () => reportsRepository.list());
}
