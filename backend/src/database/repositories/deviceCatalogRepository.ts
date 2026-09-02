import type { DatabaseSync } from "node:sqlite";
import type { OtodataDevice } from "../../services/otodata";

export interface DeviceCatalogRepository {
  get(): { devices: OtodataDevice[]; savedAt: string } | null;
  replace(devices: OtodataDevice[]): void;
}

interface DeviceCatalogRow {
  devices_json: string;
  saved_at: string;
}

export function createDeviceCatalogRepository(database: DatabaseSync): DeviceCatalogRepository {
  const getStmt = database.prepare(
    `SELECT devices_json, saved_at FROM device_catalog WHERE id = 1`
  );
  const replaceStmt = database.prepare(
    `INSERT INTO device_catalog (id, devices_json, saved_at)
     VALUES (1, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(id) DO UPDATE SET
       devices_json = excluded.devices_json,
       saved_at = excluded.saved_at`
  );

  return {
    get(): { devices: OtodataDevice[]; savedAt: string } | null {
      const row = getStmt.get() as unknown as DeviceCatalogRow | undefined;
      if (!row) return null;

      const devices = JSON.parse(row.devices_json) as unknown;
      if (!Array.isArray(devices)) {
        throw new Error("Cache local de dispositivos Otodata inválido");
      }
      return { devices: devices as OtodataDevice[], savedAt: row.saved_at };
    },
    replace(devices: OtodataDevice[]): void {
      replaceStmt.run(JSON.stringify(devices));
    }
  };
}
