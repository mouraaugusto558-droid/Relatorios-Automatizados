import type { DatabaseSync } from "node:sqlite";

export interface AlertHistoryEntry {
  id: number;
  sentAt: string;
  summary: string;
  enteredCount: number;
  resolvedCount: number;
  filledCount: number;
  message: string;
}

export interface AlertHistoryInput {
  summary: string;
  enteredCount: number;
  resolvedCount: number;
  filledCount: number;
  message: string;
}

interface AlertHistoryRow {
  id: number;
  sent_at: string;
  summary: string;
  entered_count: number;
  resolved_count: number;
  filled_count: number;
  message: string;
}

function toEntry(row: AlertHistoryRow): AlertHistoryEntry {
  return {
    id: row.id,
    sentAt: row.sent_at,
    summary: row.summary,
    enteredCount: row.entered_count,
    resolvedCount: row.resolved_count,
    filledCount: row.filled_count,
    message: row.message
  };
}

export interface AlertHistoryRepository {
  create(input: AlertHistoryInput): number;
  list(limit?: number): AlertHistoryEntry[];
}

export function createAlertHistoryRepository(database: DatabaseSync): AlertHistoryRepository {
  const createStmt = database.prepare(
    `INSERT INTO alert_history (summary, entered_count, resolved_count, filled_count, message) VALUES (?, ?, ?, ?, ?)`
  );
  const listStmt = database.prepare(`SELECT * FROM alert_history ORDER BY id DESC LIMIT ?`);

  return {
    create(input: AlertHistoryInput): number {
      const result = createStmt.run(
        input.summary,
        input.enteredCount,
        input.resolvedCount,
        input.filledCount,
        input.message
      );
      return Number(result.lastInsertRowid);
    },
    list(limit = 50): AlertHistoryEntry[] {
      return (listStmt.all(limit) as unknown as AlertHistoryRow[]).map(toEntry);
    }
  };
}
