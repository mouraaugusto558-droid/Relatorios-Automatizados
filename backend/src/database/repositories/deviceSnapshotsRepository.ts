import type { DatabaseSync } from "node:sqlite";

export interface DeviceSnapshot {
  deviceId: number;
  status: string;
  lastFill: string | null;
  lastLevel: number | null;
  batteryAlarm: boolean;
}

interface DeviceSnapshotRow {
  device_id: number;
  status: string;
  last_fill: string | null;
  last_level: number | null;
  battery_alarm: number;
}

function toSnapshot(row: DeviceSnapshotRow): DeviceSnapshot {
  return {
    deviceId: row.device_id,
    status: row.status,
    lastFill: row.last_fill,
    lastLevel: row.last_level,
    batteryAlarm: row.battery_alarm === 1
  };
}

export interface DeviceSnapshotsRepository {
  getAll(): Map<number, DeviceSnapshot>;
  upsertMany(snapshots: DeviceSnapshot[]): void;
}

export function createDeviceSnapshotsRepository(database: DatabaseSync): DeviceSnapshotsRepository {
  const listStmt = database.prepare(
    `SELECT device_id, status, last_fill, last_level, battery_alarm FROM device_snapshots`
  );
  const upsertStmt = database.prepare(
    `INSERT INTO device_snapshots (device_id, status, last_fill, last_level, battery_alarm, updated_at)
     VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(device_id) DO UPDATE SET
       status = excluded.status,
       last_fill = excluded.last_fill,
       last_level = excluded.last_level,
       battery_alarm = excluded.battery_alarm,
       updated_at = excluded.updated_at`
  );

  return {
    getAll(): Map<number, DeviceSnapshot> {
      const rows = listStmt.all() as unknown as DeviceSnapshotRow[];
      return new Map(rows.map((row) => [row.device_id, toSnapshot(row)]));
    },
    upsertMany(snapshots: DeviceSnapshot[]): void {
      for (const snapshot of snapshots) {
        upsertStmt.run(
          snapshot.deviceId,
          snapshot.status,
          snapshot.lastFill,
          snapshot.lastLevel,
          snapshot.batteryAlarm ? 1 : 0
        );
      }
    }
  };
}
