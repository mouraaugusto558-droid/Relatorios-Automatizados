import type { DatabaseSync } from "node:sqlite";

export type ReportStatus = "pending" | "generated" | "sent" | "error";

export interface Report {
  id: number;
  name: string;
  filePath: string;
  status: ReportStatus;
  createdAt: string;
}

interface ReportRow {
  id: number;
  name: string;
  file_path: string;
  status: ReportStatus;
  created_at: string;
}

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    name: row.name,
    filePath: row.file_path,
    status: row.status,
    createdAt: row.created_at
  };
}

export interface ReportsRepository {
  create(name: string, filePath: string, status: ReportStatus): number;
  updateStatus(id: number, status: ReportStatus): void;
  getById(id: number): Report | undefined;
  list(limit?: number): Report[];
}

export function createReportsRepository(database: DatabaseSync): ReportsRepository {
  const createStmt = database.prepare(
    `INSERT INTO reports (name, file_path, status) VALUES (?, ?, ?)`
  );
  const updateStatusStmt = database.prepare(`UPDATE reports SET status = ? WHERE id = ?`);
  const getByIdStmt = database.prepare(`SELECT * FROM reports WHERE id = ?`);
  const listStmt = database.prepare(`SELECT * FROM reports ORDER BY id DESC LIMIT ?`);

  return {
    create(name: string, filePath: string, status: ReportStatus): number {
      const result = createStmt.run(name, filePath, status);
      return Number(result.lastInsertRowid);
    },
    updateStatus(id: number, status: ReportStatus): void {
      updateStatusStmt.run(status, id);
    },
    getById(id: number): Report | undefined {
      const row = getByIdStmt.get(id) as ReportRow | undefined;
      return row ? toReport(row) : undefined;
    },
    list(limit = 20): Report[] {
      return (listStmt.all(limit) as unknown as ReportRow[]).map(toReport);
    }
  };
}
