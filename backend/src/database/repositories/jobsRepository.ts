import type { DatabaseSync } from "node:sqlite";

export interface Job {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
}

interface JobRow {
  id: string;
  name: string;
  cron_expression: string;
  enabled: number;
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    name: row.name,
    cronExpression: row.cron_expression,
    enabled: row.enabled === 1
  };
}

export interface JobsRepository {
  upsert(job: Job): void;
  list(): Job[];
  findById(id: string): Job | undefined;
  setEnabled(id: string, enabled: boolean): void;
  deleteNotIn(ids: string[]): void;
}

export function createJobsRepository(database: DatabaseSync): JobsRepository {
  const upsertStmt = database.prepare(`
    INSERT INTO jobs (id, name, cron_expression, enabled) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      cron_expression = excluded.cron_expression,
      enabled = excluded.enabled
  `);
  const listStmt = database.prepare(`SELECT id, name, cron_expression, enabled FROM jobs ORDER BY name`);
  const findByIdStmt = database.prepare(`SELECT id, name, cron_expression, enabled FROM jobs WHERE id = ?`);
  const setEnabledStmt = database.prepare(`UPDATE jobs SET enabled = ? WHERE id = ?`);

  return {
    upsert(job: Job): void {
      upsertStmt.run(job.id, job.name, job.cronExpression, job.enabled ? 1 : 0);
    },
    list(): Job[] {
      return (listStmt.all() as unknown as JobRow[]).map(toJob);
    },
    findById(id: string): Job | undefined {
      const row = findByIdStmt.get(id) as JobRow | undefined;
      return row ? toJob(row) : undefined;
    },
    setEnabled(id: string, enabled: boolean): void {
      setEnabledStmt.run(enabled ? 1 : 0, id);
    },
    /** Remove jobs que não existem mais em `JobDefinition[]` (ex.: job removido
     * do código) — junto com o histórico de execuções em `job_runs`, que tem
     * FOREIGN KEY para `jobs.id` e bloquearia a exclusão direta. */
    deleteNotIn(ids: string[]): void {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => "?").join(", ");
      database.prepare(`DELETE FROM job_runs WHERE job_id NOT IN (${placeholders})`).run(...ids);
      database.prepare(`DELETE FROM jobs WHERE id NOT IN (${placeholders})`).run(...ids);
    }
  };
}
