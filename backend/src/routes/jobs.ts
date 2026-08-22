import type { FastifyInstance } from "fastify";
import { getDatabase } from "../database";
import { createJobsRepository } from "../database/repositories/jobsRepository";
import { createJobRunsRepository } from "../database/repositories/jobRunsRepository";
import { getScheduler } from "../jobs";

interface ToggleBody {
  enabled: boolean;
}

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  const database = getDatabase();
  const jobsRepository = createJobsRepository(database);
  const jobRunsRepository = createJobRunsRepository(database);

  app.get("/api/jobs", async () => {
    return jobsRepository.list().map((job) => ({
      ...job,
      isRunning: jobRunsRepository.isRunning(job.id),
      lastRun: jobRunsRepository.getLast(job.id) ?? null
    }));
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id/runs", async (request) => {
    return jobRunsRepository.listRecent(request.params.id);
  });

  app.post<{ Params: { id: string } }>("/api/jobs/:id/run", async (request, reply) => {
    const job = jobsRepository.findById(request.params.id);
    if (!job) {
      return reply.code(404).send({ error: "job_not_found" });
    }

    await getScheduler().runNow(job.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string }; Body: ToggleBody }>("/api/jobs/:id/toggle", async (request, reply) => {
    const job = jobsRepository.findById(request.params.id);
    if (!job) {
      return reply.code(404).send({ error: "job_not_found" });
    }

    getScheduler().setEnabled(job.id, request.body.enabled);
    return jobsRepository.findById(job.id);
  });
}
