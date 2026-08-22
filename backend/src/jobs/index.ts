import pino from "pino";
import { getDatabase } from "../database";
import { createJobsRepository } from "../database/repositories/jobsRepository";
import { createJobRunsRepository } from "../database/repositories/jobRunsRepository";
import { createJobDefinitions } from "./definitions";
import { createScheduler, type Scheduler } from "./scheduler";

let scheduler: Scheduler | null = null;

export function getScheduler(): Scheduler {
  if (!scheduler) {
    const logger = pino({ level: "warn" });
    const database = getDatabase();
    scheduler = createScheduler(
      createJobDefinitions(logger),
      createJobsRepository(database),
      createJobRunsRepository(database),
      logger
    );
  }
  return scheduler;
}

export type { Scheduler, JobDefinition } from "./scheduler";
