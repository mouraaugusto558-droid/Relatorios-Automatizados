import type { FastifyInstance } from "fastify";
import { getDatabase } from "../database";
import { createRepositories } from "../database/repositories";
import { getScheduler } from "../jobs";

interface ToggleBody {
  enabled: boolean;
}

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  const { jobs: jobsRepository, jobRuns: jobRunsRepository } = createRepositories(getDatabase());

  app.get("/api/jobs", async () => {
    const scheduler = getScheduler();
    return jobsRepository.list().map((job) => ({
      ...job,
      isRunning: jobRunsRepository.isRunning(job.id),
      lastRun: jobRunsRepository.getLast(job.id) ?? null,
      nextRun: scheduler.getNextRun(job.id)?.toISOString() ?? null
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

    try {
      await getScheduler().runNow(job.id);
      return { ok: true };
    } catch (error) {
      // O motivo real da falha vai no corpo da resposta: é o que o painel exibe.
      // Sem isto o usuário só via "Job finalizado!" mesmo quando o envio quebrava.
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(500).send({ error: "job_failed", message });
    }
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
