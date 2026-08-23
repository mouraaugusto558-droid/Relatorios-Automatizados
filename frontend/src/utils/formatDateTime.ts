export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium"
    }).format(date);
  } catch {
    return "—";
  }
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const target = new Date(iso).getTime();
    if (isNaN(target)) return "—";
    const now = Date.now();
    const diffSec = Math.round((target - now) / 1000);
    const absSec = Math.abs(diffSec);

    const isFuture = diffSec > 0;
    const prefix = isFuture ? "em " : "há ";

    if (absSec < 45) {
      return isFuture ? "em instantes" : "agora mesmo";
    }
    if (absSec < 90) {
      return prefix + "1 minuto";
    }
    const diffMin = Math.round(absSec / 60);
    if (diffMin < 60) {
      return `${prefix}${diffMin} minutos`;
    }
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) {
      return `${prefix}${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
    }
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) {
      return `${prefix}${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
    }
    return formatDateTime(iso);
  } catch {
    return "—";
  }
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  if (Number(sec) < 60) return `${sec}s`;
  const min = Math.floor(ms / 60000);
  const remSec = Math.round((ms % 60000) / 1000);
  return `${min}m ${remSec}s`;
}

export function formatUptime(seconds: number | undefined): string {
  if (seconds === undefined || isNaN(seconds)) return "—";
  const s = Math.floor(seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${s % 60}s`;
}

export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function humanizeCron(cron: string): string {
  if (!cron) return "Não agendado";
  const trimmed = cron.trim();
  if (trimmed === "* * * * *") return "A cada minuto";
  if (trimmed === "*/5 * * * *") return "A cada 5 minutos";
  if (trimmed === "*/15 * * * *") return "A cada 15 minutos";
  if (trimmed === "*/30 * * * *") return "A cada 30 minutos";
  if (trimmed === "0 * * * *") return "A cada hora";
  if (trimmed === "0 0 * * *") return "Diariamente à meia-noite (00:00)";
  if (trimmed === "0 6 * * *") return "Diariamente às 06:00";
  if (trimmed === "0 8 * * *") return "Diariamente às 08:00";
  if (trimmed === "0 12 * * *") return "Diariamente às 12:00";
  if (trimmed === "0 18 * * *") return "Diariamente às 18:00";
  if (trimmed === "0 8 * * 1-5") return "Seg a Sex às 08:00";
  if (trimmed === "0 0 * * 0") return "Semanalmente aos domingos";

  const parts = trimmed.split(/\s+/);
  if (parts.length === 5) {
    const [min, hour, dom, mon, dow] = parts;
    if (dom === "*" && mon === "*" && dow === "*" && !isNaN(Number(hour)) && !isNaN(Number(min))) {
      const h = hour.padStart(2, "0");
      const m = min.padStart(2, "0");
      return `Diariamente às ${h}:${m}`;
    }
  }

  return cron;
}
