import type { DatabaseSync } from "node:sqlite";

export interface ExcludedDevice {
  deviceId: number;
  name: string | null;
  city: string | null;
  excludedAt: string;
}

interface ExcludedDeviceRow {
  device_id: number;
  name: string | null;
  city: string | null;
  excluded_at: string;
}

function toExcludedDevice(row: ExcludedDeviceRow): ExcludedDevice {
  return {
    deviceId: row.device_id,
    name: row.name,
    city: row.city,
    excludedAt: row.excluded_at
  };
}

export interface ExcludedDeviceInput {
  deviceId: number;
  name: string | null;
  city: string | null;
}

export interface ExcludedDevicesRepository {
  list(): ExcludedDevice[];
  getExcludedIds(): Set<number>;
  exclude(input: ExcludedDeviceInput): void;
  excludeMany(inputs: ExcludedDeviceInput[]): void;
  restore(deviceId: number): void;
}

export function createExcludedDevicesRepository(database: DatabaseSync): ExcludedDevicesRepository {
  const listStmt = database.prepare(`SELECT * FROM excluded_devices ORDER BY excluded_at DESC`);
  const listIdsStmt = database.prepare(`SELECT device_id FROM excluded_devices`);
  const upsertStmt = database.prepare(
    `INSERT INTO excluded_devices (device_id, name, city, excluded_at)
     VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(device_id) DO UPDATE SET name = excluded.name, city = excluded.city`
  );
  const restoreStmt = database.prepare(`DELETE FROM excluded_devices WHERE device_id = ?`);

  function exclude(input: ExcludedDeviceInput): void {
    upsertStmt.run(input.deviceId, input.name, input.city);
  }

  return {
    list(): ExcludedDevice[] {
      return (listStmt.all() as unknown as ExcludedDeviceRow[]).map(toExcludedDevice);
    },
    getExcludedIds(): Set<number> {
      const rows = listIdsStmt.all() as unknown as { device_id: number }[];
      return new Set(rows.map((row) => row.device_id));
    },
    exclude,
    excludeMany(inputs: ExcludedDeviceInput[]): void {
      for (const input of inputs) exclude(input);
    },
    restore(deviceId: number): void {
      restoreStmt.run(deviceId);
    }
  };
}
