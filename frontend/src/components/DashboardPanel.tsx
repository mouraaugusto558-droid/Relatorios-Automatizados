import { useWhatsAppStatus } from "../hooks/useWhatsAppStatus";
import { useJobs } from "../hooks/useJobs";
import { useReports } from "../hooks/useReports";
import { formatDateTime } from "../utils/formatDateTime";

const STATUS_LABELS: Record<string, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando...",
  qr: "Aguardando leitura do QR Code",
  connected: "Conectado"
};

export function DashboardPanel() {
  const whatsapp = useWhatsAppStatus();
  const { jobs } = useJobs();
  const { reports } = useReports();

  const jobsWithLastRun = jobs.filter((job) => job.lastRun);
  const lastJob = jobsWithLastRun.sort(
    (a, b) => new Date(b.lastRun!.startedAt).getTime() - new Date(a.lastRun!.startedAt).getTime()
  )[0];

  const nextJob = jobs
    .filter((job) => job.enabled && job.nextRun)
    .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime())[0];

  const lastReport = reports[0];

  const jobErrors = jobs
    .filter((job) => job.lastRun?.status === "error")
    .map((job) => `Job "${job.name}": ${job.lastRun?.error}`);
  const reportErrors = reports
    .filter((report) => report.status === "error")
    .map((report) => `Relatório "${report.name}" falhou ao enviar`);
  const recentErrors = [...jobErrors, ...reportErrors];

  return (
    <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem" }}>
      <h2>Dashboard</h2>
      <ul>
        <li>
          Status do WhatsApp: <strong>{whatsapp ? STATUS_LABELS[whatsapp.status] ?? whatsapp.status : "..."}</strong>
        </li>
        <li>Número conectado: {whatsapp?.phoneNumber ?? "—"}</li>
        <li>
          Último job: {lastJob ? `${lastJob.name} — ${lastJob.lastRun?.status} (${formatDateTime(lastJob.lastRun?.startedAt)})` : "—"}
        </li>
        <li>Próximo job: {nextJob ? `${nextJob.name} — ${formatDateTime(nextJob.nextRun)}` : "—"}</li>
        <li>
          Último relatório: {lastReport ? `${lastReport.name} — ${lastReport.status} (${formatDateTime(lastReport.createdAt)})` : "—"}
        </li>
      </ul>

      <h3>Erros recentes</h3>
      {recentErrors.length === 0 ? (
        <p>Nenhum erro recente.</p>
      ) : (
        <ul>
          {recentErrors.map((message, index) => (
            <li key={index} style={{ color: "crimson" }}>
              {message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
