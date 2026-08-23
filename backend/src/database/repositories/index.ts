import type { DatabaseSync } from "node:sqlite";
import { createJobsRepository, type JobsRepository } from "./jobsRepository";
import { createJobRunsRepository, type JobRunsRepository } from "./jobRunsRepository";
import { createReportsRepository, type ReportsRepository } from "./reportsRepository";

export interface Repositories {
  jobs: JobsRepository;
  jobRuns: JobRunsRepository;
  reports: ReportsRepository;
}

/**
 * Ponto único de composição dos repositórios, para evitar que cada rota
 * repita `getDatabase()` + `createXRepository(database)` na própria função
 * de registro (mesmo padrão de composição já usado por `getScheduler()` /
 * `getWhatsAppManager()`).
 */
export function createRepositories(database: DatabaseSync): Repositories {
  return {
    jobs: createJobsRepository(database),
    jobRuns: createJobRunsRepository(database),
    reports: createReportsRepository(database)
  };
}
