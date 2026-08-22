import type { OtodataDevice } from "../otodata";

const ALARM_STATUSES = new Set([
  "LOW ALARM",
  "CRITICAL LOW ALARM",
  "OVERFILL ALARM",
  "EMPTY ALARM",
  "RAPID DRAW",
  "COMM TROUBLE",
  "HIGH ALARM"
]);

function formatLevel(level: number | null): string {
  return level === null ? "N/D" : `${Math.round(level * 100)}%`;
}

function deviceLabel(device: OtodataDevice): string {
  const location = device.City ? ` (${device.City})` : "";
  return `${device.Name ?? `Tanque #${device.Id}`}${location}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function buildDailyReportText(devices: OtodataDevice[], referenceDate: Date = new Date()): string {
  const alarms = devices.filter((device) => ALARM_STATUSES.has(device.Status));
  const fills = devices.filter((device) => device.Status === "FILL DETECTION");

  const statusCounts = new Map<string, number>();
  for (const device of devices) {
    statusCounts.set(device.Status, (statusCounts.get(device.Status) ?? 0) + 1);
  }

  const lines: string[] = [];
  lines.push(`*Relatório diário — ${formatDate(referenceDate)}*`);
  lines.push("");

  lines.push(`*Alarmes ativos (${alarms.length})*`);
  if (alarms.length === 0) {
    lines.push("Nenhum tanque em alarme.");
  } else {
    for (const device of alarms) {
      lines.push(`- ${deviceLabel(device)} — ${device.Status} — nível ${formatLevel(device.LastLevel)}`);
    }
  }
  lines.push("");

  lines.push(`*Abastecimentos detectados (${fills.length})*`);
  if (fills.length === 0) {
    lines.push("Nenhum abastecimento detectado.");
  } else {
    for (const device of fills) {
      lines.push(`- ${deviceLabel(device)} — nível ${formatLevel(device.LastLevel)}`);
    }
  }
  lines.push("");

  lines.push(`*Resumo geral (${devices.length} tanques)*`);
  for (const [status, count] of [...statusCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`${status}: ${count}`);
  }

  return lines.join("\n");
}
