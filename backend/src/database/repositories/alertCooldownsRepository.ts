import type { DatabaseSync } from "node:sqlite";

export interface AlertCooldownsRepository {
  getLastAlertAt(deviceId: number): string | null;
  markAlertSent(deviceIds: number[], sentAt?: string): void;
}

interface AlertCooldownRow {
  last_alert_at: string;
}

export function createAlertCooldownsRepository(database: DatabaseSync): AlertCooldownsRepository {
  const getStmt = database.prepare(`SELECT last_alert_at FROM alert_cooldowns WHERE device_id = ?`);
  const markStmt = database.prepare(
    `INSERT INTO alert_cooldowns (device_id, last_alert_at) VALUES (?, ?)
     ON CONFLICT(device_id) DO UPDATE SET last_alert_at = excluded.last_alert_at`
  );

  return {
    getLastAlertAt(deviceId: number): string | null {
      const row = getStmt.get(deviceId) as unknown as AlertCooldownRow | undefined;
      return row?.last_alert_at ?? null;
    },
    markAlertSent(deviceIds: number[], sentAt = new Date().toISOString()): void {
      for (const deviceId of deviceIds) {
        markStmt.run(deviceId, sentAt);
      }
    }
  };
}
