import type { OtodataDevice } from "../otodata";

export interface StatusMeta {
  label: string;
  emoji: string;
  /** Ordem de exibição: menor número = mais urgente / aparece primeiro. */
  severity: number;
  /** Cor usada tanto na imagem da planilha (canvas) quanto no HTML do frontend. */
  color: string;
}

// Ordenado por urgência real de campo (tanque vazio/transbordando é mais grave
// que um alarme de nível baixo, que por sua vez é mais grave que uma falha de
// comunicação, que não indica risco imediato ao produto).
export const STATUS_META: Record<string, StatusMeta> = {
  "EMPTY ALARM": { label: "Tanque vazio", emoji: "🆘", severity: 0, color: "#dc2626" },
  "OVERFILL ALARM": { label: "Risco de transbordamento", emoji: "🆘", severity: 1, color: "#dc2626" },
  "CRITICAL LOW ALARM": { label: "Nível criticamente baixo", emoji: "🔴", severity: 2, color: "#ea580c" },
  "LOW ALARM": { label: "Nível baixo", emoji: "🟠", severity: 3, color: "#f59e0b" },
  "RAPID DRAW": { label: "Consumo anormalmente rápido", emoji: "🟡", severity: 4, color: "#eab308" },
  "HIGH ALARM": { label: "Nível alto", emoji: "🟡", severity: 5, color: "#eab308" },
  "COMM TROUBLE": { label: "Falha de comunicação", emoji: "📡", severity: 6, color: "#64748b" },
  "FILL DETECTION": { label: "Abastecimento detectado", emoji: "⛽", severity: 7, color: "#0ea5e9" },
  OK: { label: "Normal", emoji: "✅", severity: 8, color: "#16a34a" }
};

const DEFAULT_STATUS_META: StatusMeta = { label: "", emoji: "⚠️", severity: 50, color: "#94a3b8" };

export const ALARM_STATUSES = new Set([
  "LOW ALARM",
  "CRITICAL LOW ALARM",
  "OVERFILL ALARM",
  "EMPTY ALARM",
  "RAPID DRAW",
  "COMM TROUBLE",
  "HIGH ALARM"
]);

export function statusMeta(status: string): StatusMeta {
  const meta = STATUS_META[status];
  return meta ?? { ...DEFAULT_STATUS_META, label: status };
}

/** Remove caracteres de formatação do WhatsApp (*_~`) para que nomes/cidades
 * vindos da API não quebrem a formatação do relatório. */
export function sanitize(text: string): string {
  return text.replace(/[*_~`]/g, "").trim();
}

export function formatLevel(level: number | null): string {
  return level === null ? "N/D" : `${Math.round(level * 100)}%`;
}

export function deviceLabel(device: OtodataDevice): string {
  const name = sanitize(device.Name ?? `Tanque #${device.Id}`);
  const location = device.City ? ` (${sanitize(device.City)})` : "";
  return `${name}${location}`;
}

export function sortBySeverity(devices: OtodataDevice[]): OtodataDevice[] {
  return [...devices].sort((a, b) => statusMeta(a.Status).severity - statusMeta(b.Status).severity);
}

export function getAlarms(devices: OtodataDevice[]): OtodataDevice[] {
  return sortBySeverity(devices.filter((device) => ALARM_STATUSES.has(device.Status)));
}

export function getFills(devices: OtodataDevice[]): OtodataDevice[] {
  return devices.filter((device) => device.Status === "FILL DETECTION");
}
