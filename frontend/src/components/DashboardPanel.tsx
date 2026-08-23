import { useState } from "react";
import {
  MessageSquare,
  CalendarClock,
  FileSpreadsheet,
  Server,
  AlertCircle,
  CheckCircle2,
  Play,
  ArrowRight,
  Copy,
  Check,
  Zap
} from "lucide-react";
import { useWhatsAppStatus } from "../hooks/useWhatsAppStatus";
import { useJobs } from "../hooks/useJobs";
import { useReports } from "../hooks/useReports";
import { useHealth } from "../hooks/useHealth";
import { useToast } from "../context/ToastContext";
import { StatsCard } from "./StatsCard";
import {
  formatDateTime,
  formatRelativeTime,
  formatPhoneNumber,
  formatUptime
} from "../utils/formatDateTime";
import type { TabId } from "./Navbar";

interface DashboardPanelProps {
  onNavigateTab: (tab: TabId) => void;
}

export function DashboardPanel({ onNavigateTab }: DashboardPanelProps) {
  const whatsapp = useWhatsAppStatus();
  const { jobs, refresh: refreshJobs } = useJobs();
  const { reports } = useReports();
  const { health, isOnline } = useHealth();
  const { success, error: toastError } = useToast();

  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Computed metrics
  const activeJobs = jobs.filter((j) => j.enabled);
  const runningJobs = jobs.filter((j) => j.isRunning);

  const jobsWithLastRun = jobs.filter((job) => job.lastRun);
  const lastJob = jobsWithLastRun.sort(
    (a, b) => new Date(b.lastRun!.startedAt).getTime() - new Date(a.lastRun!.startedAt).getTime()
  )[0];

  const nextJob = jobs
    .filter((job) => job.enabled && job.nextRun)
    .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime())[0];

  const sentReports = reports.filter((r) => r.status === "sent");
  const errorReports = reports.filter((r) => r.status === "error");
  const lastReport = reports[0];

  // Recent errors
  const jobErrors = jobs
    .filter((job) => job.lastRun?.status === "error")
    .map((job) => ({
      source: `Job: ${job.name}`,
      message: job.lastRun?.error || "Erro desconhecido na execução",
      time: job.lastRun?.startedAt
    }));

  const reportErrors = reports
    .filter((report) => report.status === "error")
    .map((report) => ({
      source: `Relatório: ${report.name}`,
      message: "Falha ao gerar ou enviar o relatório",
      time: report.createdAt
    }));

  const recentErrors = [...jobErrors, ...reportErrors];

  const handleQuickRunNextJob = async () => {
    if (!nextJob) return;
    setRunningJobId(nextJob.id);
    try {
      const res = await fetch(`/api/jobs/${nextJob.id}/run`, { method: "POST" });
      if (res.ok) {
        success("Job disparado!", `O job "${nextJob.name}" foi iniciado.`);
        await refreshJobs();
      } else {
        toastError("Erro ao rodar job", `Código de retorno: ${res.status}`);
      }
    } catch {
      toastError("Falha na requisição", "Não foi possível disparar o job.");
    } finally {
      setRunningJobId(null);
    }
  };

  const copyErrorMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    success("Copiado!", "Mensagem de erro copiada para a área de transferência.");
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Banner / Welcome */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)",
          borderColor: "var(--border-subtle)",
          padding: "1.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Visão Geral do Sistema
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginTop: "0.25rem" }}>
              Acompanhe em tempo real o status dos disparos, automações agendadas e integridade do servidor.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            {nextJob && (
              <button
                className="btn btn-primary"
                onClick={handleQuickRunNextJob}
                disabled={runningJobId === nextJob.id}
              >
                <Play size={15} />
                {runningJobId === nextJob.id ? "Executando..." : `Rodar ${nextJob.name}`}
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => onNavigateTab("whatsapp")}
            >
              <MessageSquare size={15} />
              WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        {/* WhatsApp Card */}
        <StatsCard
          label="Sessão WhatsApp"
          value={
            whatsapp?.status === "connected"
              ? formatPhoneNumber(whatsapp.phoneNumber)
              : whatsapp?.status === "qr"
              ? "Aguardando QR"
              : whatsapp?.status === "connecting"
              ? "Conectando..."
              : "Desconectado"
          }
          icon={<MessageSquare size={22} />}
          iconBgColor={
            whatsapp?.status === "connected"
              ? "var(--brand-primary-bg)"
              : whatsapp?.status === "qr"
              ? "var(--accent-amber-bg)"
              : "var(--accent-rose-bg)"
          }
          iconColor={
            whatsapp?.status === "connected"
              ? "var(--brand-primary)"
              : whatsapp?.status === "qr"
              ? "var(--accent-amber)"
              : "var(--accent-rose)"
          }
          badge={
            whatsapp?.status === "connected" ? (
              <span className="pill pill-success">
                <span className="status-dot status-dot-pulse" /> Ativo
              </span>
            ) : whatsapp?.status === "qr" ? (
              <span className="pill pill-warning">
                <span className="status-dot status-dot-pulse" /> Ler QR
              </span>
            ) : (
              <span className="pill pill-error">
                <span className="status-dot" /> Off
              </span>
            )
          }
          footer={
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Último evento: {formatRelativeTime(whatsapp?.lastEventAt)}</span>
              <span
                style={{ color: "var(--brand-primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
              >
                Gerenciar <ArrowRight size={13} />
              </span>
            </div>
          }
          onClick={() => onNavigateTab("whatsapp")}
        />

        {/* Jobs Card */}
        <StatsCard
          label="Jobs &amp; Automações"
          value={`${activeJobs.length} / ${jobs.length} ativos`}
          icon={<CalendarClock size={22} />}
          iconBgColor="var(--accent-blue-bg)"
          iconColor="var(--accent-blue)"
          badge={
            runningJobs.length > 0 ? (
              <span className="pill pill-warning">
                <Zap size={13} /> {runningJobs.length} rodando
              </span>
            ) : (
              <span className="pill pill-neutral">
                {jobs.length} configurados
              </span>
            )
          }
          footer={
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                {nextJob ? `Próximo: ${formatRelativeTime(nextJob.nextRun)}` : "Nenhum agendamento"}
              </span>
              <span
                style={{ color: "var(--accent-blue)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
              >
                Ver jobs <ArrowRight size={13} />
              </span>
            </div>
          }
          onClick={() => onNavigateTab("jobs")}
        />

        {/* Reports Card */}
        <StatsCard
          label="Relatórios Gerados"
          value={reports.length}
          icon={<FileSpreadsheet size={22} />}
          iconBgColor="var(--accent-purple-bg)"
          iconColor="var(--accent-purple)"
          badge={
            sentReports.length > 0 ? (
              <span className="pill pill-success">
                {sentReports.length} enviados
              </span>
            ) : undefined
          }
          footer={
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                {lastReport ? `Último: ${formatRelativeTime(lastReport.createdAt)}` : "Sem relatórios"}
              </span>
              <span
                style={{ color: "var(--accent-purple)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
              >
                Histórico <ArrowRight size={13} />
              </span>
            </div>
          }
          onClick={() => onNavigateTab("reports")}
        />

        {/* Server & Database Card */}
        <StatsCard
          label="Servidor &amp; Uptime"
          value={formatUptime(health?.uptime)}
          icon={<Server size={22} />}
          iconBgColor={isOnline && health?.status === "ok" ? "var(--brand-primary-bg)" : "var(--accent-rose-bg)"}
          iconColor={isOnline && health?.status === "ok" ? "var(--brand-primary)" : "var(--accent-rose)"}
          badge={
            isOnline && health?.status === "ok" ? (
              <span className="pill pill-success">SQLite OK</span>
            ) : (
              <span className="pill pill-error">Instável</span>
            )
          }
          footer={
            <span>Fastify API + SQLite Sync</span>
          }
        />
      </div>

      {/* Operations Overview & Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* Status of Last Job & Next Job */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <CalendarClock size={18} color="var(--accent-blue)" />
                Fluxo de Execução
              </h2>
              <p className="card-subtitle">Últimas atividades e próximos disparos</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "0.85rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-card-subtle)",
                border: "1px solid var(--border-subtle)"
              }}
            >
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Último Job Executado
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.2rem" }}>
                  {lastJob ? lastJob.name : "Nenhum job executado"}
                </div>
                {lastJob?.lastRun && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                    {formatDateTime(lastJob.lastRun.startedAt)} ({formatRelativeTime(lastJob.lastRun.startedAt)})
                  </div>
                )}
              </div>

              {lastJob?.lastRun && (
                <span className={`pill ${lastJob.lastRun.status === "success" ? "pill-success" : "pill-error"}`}>
                  {lastJob.lastRun.status === "success" ? "Sucesso" : "Falha"}
                </span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "0.85rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--bg-card-subtle)",
                border: "1px solid var(--border-subtle)"
              }}
            >
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Próximo Agendamento
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.2rem" }}>
                  {nextJob ? nextJob.name : "Nenhum job agendado ativo"}
                </div>
                {nextJob?.nextRun && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                    {formatDateTime(nextJob.nextRun)} ({formatRelativeTime(nextJob.nextRun)})
                  </div>
                )}
              </div>

              {nextJob && (
                <span className="pill pill-info">
                  Agendado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Recent Errors & Alerts */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <AlertCircle size={18} color="var(--accent-rose)" />
                Alertas &amp; Erros Recentes
              </h2>
              <p className="card-subtitle">
                {recentErrors.length === 0 ? "Nenhum erro registrado" : `${recentErrors.length} alerta(s) precisam de atenção`}
              </p>
            </div>
            {recentErrors.length > 0 && (
              <span className="pill pill-error">{recentErrors.length} erro(s)</span>
            )}
          </div>

          {recentErrors.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem 1rem",
                textAlign: "center",
                backgroundColor: "var(--brand-primary-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--brand-primary-border)"
              }}
            >
              <CheckCircle2 size={32} color="var(--brand-primary)" style={{ marginBottom: "0.5rem" }} />
              <div style={{ fontWeight: 700, color: "var(--brand-primary)", fontSize: "0.95rem" }}>
                Tudo funcionando perfeitamente!
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                Nenhum erro de execução de jobs ou relatórios nos últimos ciclos.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "260px", overflowY: "auto" }}>
              {recentErrors.map((err, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    padding: "0.75rem 0.95rem",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--accent-rose-bg)",
                    border: "1px solid var(--accent-rose-border)"
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--accent-rose)" }}>
                      {err.source}
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-primary)",
                        marginTop: "0.15rem",
                        fontFamily: "var(--font-mono)",
                        wordBreak: "break-all"
                      }}
                    >
                      {err.message}
                    </div>
                    {err.time && (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        {formatDateTime(err.time)} ({formatRelativeTime(err.time)})
                      </div>
                    )}
                  </div>

                  <button
                    className="btn-icon"
                    onClick={() => copyErrorMessage(err.message, idx)}
                    title="Copiar mensagem de erro"
                    style={{ width: "28px", height: "28px" }}
                  >
                    {copiedIndex === idx ? <Check size={14} color="var(--brand-primary)" /> : <Copy size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
