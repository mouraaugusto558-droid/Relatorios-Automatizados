import type { DatabaseSync } from "node:sqlite";

export interface KeyValueRepository {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  getAll(): Record<string, string>;
  delete(key: string): void;
}

const ALLOWED_TABLES = new Set(["settings", "whatsapp_metadata", "application_state"]);

export function createKeyValueRepository(database: DatabaseSync, table: string): KeyValueRepository {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`createKeyValueRepository: tabela "${table}" não é uma tabela key/value conhecida`);
  }

  const getStmt = database.prepare(`SELECT value FROM ${table} WHERE key = ?`);
  const setStmt = database.prepare(
    `INSERT INTO ${table} (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  const getAllStmt = database.prepare(`SELECT key, value FROM ${table}`);
  const deleteStmt = database.prepare(`DELETE FROM ${table} WHERE key = ?`);

  return {
    get(key: string): string | undefined {
      const row = getStmt.get(key) as { value: string } | undefined;
      return row?.value;
    },
    set(key: string, value: string): void {
      setStmt.run(key, value);
    },
    getAll(): Record<string, string> {
      const rows = getAllStmt.all() as unknown as Array<{ key: string; value: string }>;
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    },
    delete(key: string): void {
      deleteStmt.run(key);
    }
  };
}
