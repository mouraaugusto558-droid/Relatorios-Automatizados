import type { OtodataDevice } from "../otodata";
import { statusMeta, formatLevel, getAlarms, getFills } from "./deviceSelectors";

export const MAX_ROWS_PER_PAGE = 50;

export interface SpreadsheetColumn {
  header: string;
  /** Largura relativa da coluna (soma não precisa fechar em 1 — é normalizada no render). */
  width: number;
}

export interface SpreadsheetRow {
  cells: string[];
  /** Cor de destaque da linha (normalmente a cor do status do tanque). */
  color: string;
}

export interface SpreadsheetTable {
  title: string;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[];
  /** Página atual / total de páginas (1/1 quando não há paginação). */
  page: number;
  totalPages: number;
}

function paginate<T>(items: T[], pageSize: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

function buildTables(
  titleBase: string,
  columns: SpreadsheetColumn[],
  rows: SpreadsheetRow[]
): SpreadsheetTable[] {
  const pages = paginate(rows, MAX_ROWS_PER_PAGE);
  const totalPages = pages.length;

  return pages.map((pageRows, index) => ({
    title: totalPages > 1 ? `${titleBase} (${index + 1}/${totalPages})` : titleBase,
    columns,
    rows: pageRows,
    page: index + 1,
    totalPages
  }));
}

const ALARM_COLUMNS: SpreadsheetColumn[] = [
  { header: "Tanque", width: 3 },
  { header: "Cidade", width: 2 },
  { header: "Status", width: 2.5 },
  { header: "Nível", width: 1 },
  { header: "Bateria", width: 1.2 }
];

const FILL_COLUMNS: SpreadsheetColumn[] = [
  { header: "Tanque", width: 3 },
  { header: "Cidade", width: 2 },
  { header: "Nível", width: 1 }
];

export function buildAlarmsSpreadsheet(devices: OtodataDevice[]): SpreadsheetTable[] {
  const alarms = getAlarms(devices);
  const rows: SpreadsheetRow[] = alarms.map((device) => {
    const meta = statusMeta(device.Status);
    return {
      cells: [
        device.Name ?? `Tanque #${device.Id}`,
        device.City ?? "—",
        meta.label || device.Status,
        formatLevel(device.LastLevel),
        device.BatteryAlarm ? "Fraca" : "OK"
      ],
      color: meta.color
    };
  });

  return buildTables(`🚨 Alarmes ativos (${alarms.length})`, ALARM_COLUMNS, rows);
}

export function buildFillsSpreadsheet(devices: OtodataDevice[]): SpreadsheetTable[] {
  const fills = getFills(devices);
  const rows: SpreadsheetRow[] = fills.map((device) => {
    const meta = statusMeta(device.Status);
    return {
      cells: [device.Name ?? `Tanque #${device.Id}`, device.City ?? "—", formatLevel(device.LastLevel)],
      color: meta.color
    };
  });

  return buildTables(`⛽ Abastecimentos detectados (${fills.length})`, FILL_COLUMNS, rows);
}
