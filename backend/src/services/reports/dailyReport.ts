import type { OtodataDevice } from "../otodata";

interface StatusMeta {
  label: string;
  emoji: string;
  /** Ordem de exibição: menor número = mais urgente / aparece primeiro. */
  severity: number;
}

// Ordenado por urgência real de campo (tanque vazio/transbordando é mais grave
// que um alarme de nível baixo, que por sua vez é mais grave que uma falha de
// comunicação, que não indica risco imediato ao produto).
const STATUS_META: Record<string, StatusMeta> = {
  "EMPTY ALARM": { label: "Tanque vazio", emoji: "🆘", severity: 0 },
  "OVERFILL ALARM": { label: "Risco de transbordamento", emoji: "🆘", severity: 1 },
  "CRITICAL LOW ALARM": { label: "Nível criticamente baixo", emoji: "🔴", severity: 2 },
  "LOW ALARM": { label: "Nível baixo", emoji: "🟠", severity: 3 },
  "RAPID DRAW": { label: "Consumo anormalmente rápido", emoji: "🟡", severity: 4 },
  "HIGH ALARM": { label: "Nível alto", emoji: "🟡", severity: 5 },
  "COMM TROUBLE": { label: "Falha de comunicação", emoji: "📡", severity: 6 },
  "FILL DETECTION": { label: "Abastecimento detectado", emoji: "⛽", severity: 7 },
  OK: { label: "Normal", emoji: "✅", severity: 8 }
};

const DEFAULT_STATUS_META: StatusMeta = { label: "", emoji: "⚠️", severity: 50 };

const ALARM_STATUSES = new Set([
  "LOW ALARM",
  "CRITICAL LOW ALARM",
  "OVERFILL ALARM",
  "EMPTY ALARM",
  "RAPID DRAW",
  "COMM TROUBLE",
  "HIGH ALARM"
]);

const DIVIDER = "──────────────────";

function statusMeta(status: string): StatusMeta {
  const meta = STATUS_META[status];
  return meta ?? { ...DEFAULT_STATUS_META, label: status };
}

/** Remove caracteres de formatação do WhatsApp (*_~`) para que nomes/cidades
 * vindos da API não quebrem a formatação do relatório. */
function sanitize(text: string): string {
  return text.replace(/[*_~`]/g, "").trim();
}

function formatLevel(level: number | null): string {
  return level === null ? "N/D" : `${Math.round(level * 100)}%`;
}

function deviceLabel(device: OtodataDevice): string {
  const name = sanitize(device.Name ?? `Tanque #${device.Id}`);
  const location = device.City ? ` (${sanitize(device.City)})` : "";
  return `${name}${location}`;
}

function formatDateTime(date: Date): string {
  const datePart = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} às ${timePart}`;
}

function sortBySeverity(devices: OtodataDevice[]): OtodataDevice[] {
  return [...devices].sort((a, b) => statusMeta(a.Status).severity - statusMeta(b.Status).severity);
}

function sectionHeader(title: string): string[] {
  return [DIVIDER, title, DIVIDER];
}

export function buildDailyReportText(devices: OtodataDevice[], referenceDate: Date = new Date()): string {
  const alarms = sortBySeverity(devices.filter((device) => ALARM_STATUSES.has(device.Status)));
  const fills = devices.filter((device) => device.Status === "FILL DETECTION");

  const statusCounts = new Map<string, number>();
  for (const device of devices) {
    statusCounts.set(device.Status, (statusCounts.get(device.Status) ?? 0) + 1);
  }

  const lines: string[] = [];
  lines.push("📊 *RELATÓRIO DIÁRIO — TANQUES*");
  lines.push(`📅 ${formatDateTime(referenceDate)}`);
  lines.push("");

  lines.push(...sectionHeader(`🚨 *ALARMES ATIVOS* (${alarms.length})`));
  if (alarms.length === 0) {
    lines.push("✅ Nenhum tanque em alarme.");
  } else {
    for (const device of alarms) {
      const meta = statusMeta(device.Status);
      const battery = device.BatteryAlarm ? " · 🔋 bateria fraca" : "";
      lines.push(`${meta.emoji} *${deviceLabel(device)}*`);
      lines.push(`   ${meta.label} · nível ${formatLevel(device.LastLevel)}${battery}`);
    }
  }
  lines.push("");

  lines.push(...sectionHeader(`⛽ *ABASTECIMENTOS DETECTADOS* (${fills.length})`));
  if (fills.length === 0) {
    lines.push("Nenhum abastecimento detectado.");
  } else {
    for (const device of fills) {
      lines.push(`⛽ *${deviceLabel(device)}* — nível ${formatLevel(device.LastLevel)}`);
    }
  }
  lines.push("");

  lines.push(...sectionHeader(`📈 *RESUMO GERAL* (${devices.length} tanques)`));
  const sortedStatuses = [...statusCounts.entries()].sort(
    (a, b) => statusMeta(a[0]).severity - statusMeta(b[0]).severity
  );
  for (const [status, count] of sortedStatuses) {
    const meta = statusMeta(status);
    lines.push(`${meta.emoji} ${meta.label || status}: ${count}`);
  }

  return lines.join("\n");
}
