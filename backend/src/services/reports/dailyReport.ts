import type { OtodataDevice } from "../otodata";
import { statusMeta, formatLevel, deviceLabel, getAlarms, getFills } from "./deviceSelectors";

const DIVIDER = "──────────────────";

export function formatDateTime(date: Date): string {
  const datePart = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  });
  const timePart = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
  return `${datePart} às ${timePart}`;
}

function sectionHeader(title: string): string[] {
  return [DIVIDER, title, DIVIDER];
}

export function buildDailyReportText(devices: OtodataDevice[], referenceDate: Date = new Date()): string {
  const alarms = getAlarms(devices);
  const fills = getFills(devices);

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
