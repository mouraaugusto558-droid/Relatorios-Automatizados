import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "../config/env";

let db: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (db) return db;

  fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });

  db = new DatabaseSync(env.databasePath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  runMigrations(db);

  return db;
}

export function runMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS job_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      error TEXT,
      duration_ms INTEGER,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS excluded_devices (
      device_id INTEGER PRIMARY KEY,
      name TEXT,
      city TEXT,
      excluded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS device_snapshots (
      device_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      last_fill TEXT,
      last_level REAL,
      battery_alarm INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      summary TEXT NOT NULL,
      entered_count INTEGER NOT NULL,
      resolved_count INTEGER NOT NULL,
      filled_count INTEGER NOT NULL,
      message TEXT NOT NULL
    );
  `);

  // `datetime('now')` grava UTC sem sufixo de timezone (ex. "2026-08-24 19:48:41"),
  // que o `new Date()` do navegador interpreta como hora local — deslocando a
  // exibição em horas. Linhas gravadas antes dessa correção ficaram com esse
  // formato ambíguo; aqui só reformatamos pra ISO 8601 com "Z" (mesmo instante,
  // string diferente). Idempotente: roda em todo boot, mas só afeta linhas que
  // ainda não terminam em "Z".
  database.exec(`
    UPDATE reports SET created_at = REPLACE(created_at, ' ', 'T') || 'Z' WHERE created_at NOT LIKE '%Z';
    UPDATE job_runs SET started_at = REPLACE(started_at, ' ', 'T') || 'Z' WHERE started_at NOT LIKE '%Z';
    UPDATE job_runs SET finished_at = REPLACE(finished_at, ' ', 'T') || 'Z' WHERE finished_at IS NOT NULL AND finished_at NOT LIKE '%Z';
  `);

  // `CREATE TABLE IF NOT EXISTS` não altera uma tabela `device_snapshots` que já existia
  // antes desta coluna ser adicionada — checa e adiciona à parte pra cobrir esse caso.
  const snapshotColumns = database.prepare(`PRAGMA table_info(device_snapshots)`).all() as { name: string }[];
  if (!snapshotColumns.some((column) => column.name === "battery_alarm")) {
    database.exec(`ALTER TABLE device_snapshots ADD COLUMN battery_alarm INTEGER NOT NULL DEFAULT 0`);
  }
}

export function checkDatabaseHealth(): boolean {
  try {
    getDatabase().prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}
