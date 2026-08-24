import type { OtodataDevice } from "../otodata/client";
import { getSupabaseClient } from "./client";
import { mapDeviceToRow } from "./mapDevice";

const BATCH_SIZE = 500;

export interface SupabaseSyncResult {
  rowsSynced: number;
  eventsInserted: number;
}

interface PreviousStatusRow {
  otodata_device_id: number;
  status: string;
}

// Limite alto o suficiente para trazer a tabela inteira (hoje ~1000 tanques) numa
// única consulta — evita paginar ou usar "in (...)" com centenas de ids na URL.
const PREVIOUS_STATUS_FETCH_LIMIT = 5000;

async function fetchPreviousStatuses(): Promise<Map<number, string>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tank_current_readings")
    .select("otodata_device_id, status")
    .limit(PREVIOUS_STATUS_FETCH_LIMIT);

  if (error) {
    throw new Error(`Falha ao ler estado anterior no Supabase: ${error.message}`);
  }

  const map = new Map<number, string>();
  for (const row of (data ?? []) as PreviousStatusRow[]) {
    map.set(row.otodata_device_id, row.status);
  }
  return map;
}

/** Detecta tanques cujo Status mudou desde a última sincronização, para alimentar
 * o histórico de eventos sem gravar um snapshot completo redundante a cada ciclo. */
function buildStatusChangeEvents(
  devices: OtodataDevice[],
  previousStatuses: Map<number, string>,
  changedAt: string
) {
  return devices
    .filter((device) => {
      const previous = previousStatuses.get(device.Id);
      return previous !== undefined && previous !== device.Status;
    })
    .map((device) => ({
      otodata_device_id: device.Id,
      previous_status: previousStatuses.get(device.Id) ?? null,
      new_status: device.Status,
      last_level: device.LastLevel,
      changed_at: changedAt
    }));
}

export async function syncDevicesToSupabase(devices: OtodataDevice[]): Promise<SupabaseSyncResult> {
  const supabase = getSupabaseClient();
  const syncedAt = new Date().toISOString();

  const previousStatuses = await fetchPreviousStatuses();

  const rows = devices.map((device) => mapDeviceToRow(device, syncedAt));
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("tank_current_readings").upsert(batch, { onConflict: "otodata_device_id" });
    if (error) {
      throw new Error(`Falha ao sincronizar tank_current_readings no Supabase: ${error.message}`);
    }
  }

  const events = buildStatusChangeEvents(devices, previousStatuses, syncedAt);
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("tank_reading_events").insert(batch);
    if (error) {
      throw new Error(`Falha ao gravar tank_reading_events no Supabase: ${error.message}`);
    }
  }

  return { rowsSynced: rows.length, eventsInserted: events.length };
}
