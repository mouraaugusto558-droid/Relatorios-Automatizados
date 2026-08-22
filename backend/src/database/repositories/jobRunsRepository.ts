import type { DatabaseSync } from "node:sqlite";

export type JobRunStatus = "running" | "success" | "error";

export interface JobRun {
  id: number;
  jobId: string;
  startedAt: string;
  finishedAt: string | null;
  status: JobRunStatus;
  error: string | null;
  durationMs: number | null;
}

interface JobRunRow {
  id: number;
  job_id: string;
  started_at: string;
  finished_at: string | null;
  status: JobRunStatus;
  error: string | null;
  duration_ms: number | null;
}

function toJobRun(row: JobRunRow): JobRun {
  return {
    id: row.id,
    jobId: row.job_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    error: row.error,
    durationMs: row.duration_ms
  };
}

export interface JobRunsRepository {
  start(jobId: string): number;
  finish(runId: number, status: "success" | "error", error?: string): void;
  isRunning(jobId: string): boolean;
  getLast(jobId: string): JobRun | undefined;
  listRecent(jobId: string, limit?: number): JobRun[];
}

export function createJobRunsRepository(database: DatabaseSync): JobRunsRepository {
  const startStmt = database.prepare(
    `INSERT INTO job_runs (job_id, started_at, status) VALUES (?, datetime('now'), 'running')`
  );
  const finishStmt = database.prepare(`
    UPDATE job_runs
    SET finished_at = datetime('now'),
        status = ?,
        error = ?,
        duration_ms = CAST((julianday('now') - julianday(started_at)) * 86400000 AS INTEGER)
    WHERE id = ?
  `);
  const isRunningStmt = database.prepare(
    `SELECT 1 FROM job_runs WHERE job_id = ? AND status = 'running' LIMIT 1`
  );
  const getLastStmt = database.prepare(
    `SELECT * FROM job_runs WHERE job_id = ? ORDER BY id DESC LIMIT 1`
  );
  const listRecentStmt = database.prepare(
    `SELECT * FROM job_runs WHERE job_id = ? ORDER BY id DESC LIMIT ?`
  );

  return {
    start(jobId: string): number {
      const result = startStmt.run(jobId);
      return Number(result.lastInsertRowid);
    },
    finish(runId: number, status: "success" | "error", error?: string): void {
      finishStmt.run(status, error ?? null, runId);
    },
    isRunning(jobId: string): boolean {
      return isRunningStmt.get(jobId) !== undefined;
    },
    getLast(jobId: string): JobRun | undefined {
      const row = getLastStmt.get(jobId) as JobRunRow | undefined;
      return row ? toJobRun(row) : undefined;
    },
    listRecent(jobId: string, limit = 10): JobRun[] {
      return (listRecentStmt.all(jobId, limit) as unknown as JobRunRow[]).map(toJobRun);
    }
  };
}
