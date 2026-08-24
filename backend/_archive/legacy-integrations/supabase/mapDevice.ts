import type { OtodataDevice } from "../otodata/client";

export interface TankCurrentReadingRow {
  otodata_device_id: number;
  name: string | null;
  city: string | null;
  region: string | null;
  product: string | null;
  status: string;
  last_level: number | null;
  inventory: number | null;
  capacity: number | null;
  hours_to_empty: number | null;
  last_fill: string | null;
  last_read: string | null;
  battery_alarm: boolean;
  signal_strength: number | null;
  tank_name: string | null;
  tank_number: string | null;
  synced_at: string;
}

export function mapDeviceToRow(device: OtodataDevice, syncedAt: string): TankCurrentReadingRow {
  return {
    otodata_device_id: device.Id,
    name: device.Name,
    city: device.City,
    region: device.Region,
    product: device.Product,
    status: device.Status,
    last_level: device.LastLevel,
    inventory: device.Inventory,
    capacity: device.Capacity,
    hours_to_empty: device.HoursToEmpty,
    last_fill: device.LastFill,
    last_read: device.LastRead,
    battery_alarm: device.BatteryAlarm,
    signal_strength: device.SignalStrength,
    tank_name: device.TankName,
    tank_number: device.TankNumber,
    synced_at: syncedAt
  };
}
