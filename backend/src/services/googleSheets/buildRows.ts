import type { OtodataDevice } from "../otodata/client";

export type SheetValue = string | number;

export const SNAPSHOT_HEADER: SheetValue[] = [
  "ID",
  "Nome",
  "Cidade",
  "Região",
  "Produto",
  "Status",
  "Nível (%)",
  "Inventário",
  "Capacidade",
  "Horas até vazio",
  "Último abastecimento",
  "Última leitura",
  "Alarme de bateria",
  "Sinal",
  "Nome do tanque",
  "Número do tanque"
];

export function buildSnapshotRows(devices: OtodataDevice[]): SheetValue[][] {
  return devices.map((device) => [
    device.Id,
    device.Name ?? "",
    device.City ?? "",
    device.Region ?? "",
    device.Product ?? "",
    device.Status,
    device.LastLevel === null ? "" : Math.round(device.LastLevel * 100),
    device.Inventory ?? "",
    device.Capacity ?? "",
    device.HoursToEmpty ?? "",
    device.LastFill ?? "",
    device.LastRead ?? "",
    device.BatteryAlarm ? "Sim" : "Não",
    device.SignalStrength ?? "",
    device.TankName ?? "",
    device.TankNumber ?? ""
  ]);
}

export const HISTORY_HEADER: SheetValue[] = [
  "Data",
  "Total de tanques",
  "Tanque vazio",
  "Nível criticamente baixo",
  "Nível baixo",
  "Nível alto",
  "Risco de transbordamento",
  "Consumo anormal",
  "Falha de comunicação",
  "Abastecimento detectado",
  "Normal"
];

export function buildHistorySummaryRow(devices: OtodataDevice[], referenceDate: Date): SheetValue[] {
  const counts = new Map<string, number>();
  for (const device of devices) {
    counts.set(device.Status, (counts.get(device.Status) ?? 0) + 1);
  }

  return [
    referenceDate.toISOString(),
    devices.length,
    counts.get("EMPTY ALARM") ?? 0,
    counts.get("CRITICAL LOW ALARM") ?? 0,
    counts.get("LOW ALARM") ?? 0,
    counts.get("HIGH ALARM") ?? 0,
    counts.get("OVERFILL ALARM") ?? 0,
    counts.get("RAPID DRAW") ?? 0,
    counts.get("COMM TROUBLE") ?? 0,
    counts.get("FILL DETECTION") ?? 0,
    counts.get("OK") ?? 0
  ];
}
