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
import { useReports } from "../hooks/useReports";
import type { Job } from "../hooks/useJobs";
import { useToast } from "../context/ToastContext";
import { useAppData } from "../context/AppDataContext";
import { useApiAction } from "../hooks/useApiAction";
import { apiPost, ApiError } from "../api/client";
import { StatsCard } from "./StatsCard";
import { StatusPill } from "./StatusPill";
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
  const { whatsapp, jobs, refreshJobs, health, isOnline } = useAppData();
  const { reports } = useReports();
  const { success } = useToast();

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

  const quickRunAction = useApiAction(
    async (job: Job) => {
      const result = await apiPost<{ ok: boolean }>(`/api/jobs/${job.id}/run`);
      await refreshJobs();
      return result;
    },
    {
      success: (_result, job) => ({
        title: "Job disparado!",
        message: `O job "${job.name}" foi iniciado.`
      }),
      error: (err) =>
        err instanceof ApiError
          ? { title: "Erro ao rodar job", message: `Código de retorno: ${err.status}` }
          : { title: "Falha na requisição", message: "Não foi possível disparar o job." }
    }
  );

  const handleQuickRunNextJob = async () => {
    if (!nextJob) return;
    setRunningJobId(nextJob.id);
    await quickRunAction.run(nextJob);
    setRunningJobId(null);
  };

  const copyErrorMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    success("Copiado!", "Mensagem de erro copiada para a área de transferência.");
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div className="section-stack">
      {/* Top Banner / Welcome */}
      <div className="card dashboard-banner">
        <div className="flex-between">
          <div>
            <h1 className="dashboard-title">
              Visão Geral do Sistema
            </h1>
            <p className="dashboard-subtitle">
              Acompanhe em tempo real o status dos disparos, automações agendadas e integridade do servidor.
            </p>
          </div>

          <div className="flex-row gap-060">
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
              <StatusPill tone="success" dot pulse>
                Ativo
              </StatusPill>
            ) : whatsapp?.status === "qr" ? (
              <StatusPill tone="warning" dot pulse>
                Ler QR
              </StatusPill>
            ) : (
              <StatusPill tone="error" dot>
                Off
              </StatusPill>
            )
          }
          footer={
            <div className="stats-footer-row">
              <span>Último evento: {formatRelativeTime(whatsapp?.lastEventAt)}</span>
              <span className="stat-link stat-link-brand">
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
              <StatusPill tone="warning" icon={<Zap size={13} />}>
                {runningJobs.length} rodando
              </StatusPill>
            ) : (
              <StatusPill tone="neutral">{jobs.length} configurados</StatusPill>
            )
          }
          footer={
            <div className="stats-footer-row">
              <span>
                {nextJob ? `Próximo: ${formatRelativeTime(nextJob.nextRun)}` : "Nenhum agendamento"}
              </span>
              <span className="stat-link stat-link-blue">
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
              <StatusPill tone="success">{sentReports.length} enviados</StatusPill>
            ) : undefined
          }
          footer={
            <div className="stats-footer-row">
              <span>
                {lastReport ? `Último: ${formatRelativeTime(lastReport.createdAt)}` : "Sem relatórios"}
              </span>
              <span className="stat-link stat-link-purple">
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
              <StatusPill tone="success">SQLite OK</StatusPill>
            ) : (
              <StatusPill tone="error">Instável</StatusPill>
            )
          }
          footer={
            <span>Fastify API + SQLite Sync</span>
          }
        />
      </div>

      {/* Operations Overview & Recent Activity */}
      <div className="grid-2col-320">
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

          <div className="flex-col gap-100">
            <div className="status-row-box">
              <div>
                <div className="label-caption">
                  Último Job Executado
                </div>
                <div className="status-row-value">
                  {lastJob ? lastJob.name : "Nenhum job executado"}
                </div>
                {lastJob?.lastRun && (
                  <div className="status-row-time">
                    {formatDateTime(lastJob.lastRun.startedAt)} ({formatRelativeTime(lastJob.lastRun.startedAt)})
                  </div>
                )}
              </div>

              {lastJob?.lastRun && (
                <StatusPill tone={lastJob.lastRun.status === "success" ? "success" : "error"}>
                  {lastJob.lastRun.status === "success" ? "Sucesso" : "Falha"}
                </StatusPill>
              )}
            </div>

            <div className="status-row-box">
              <div>
                <div className="label-caption">
                  Próximo Agendamento
                </div>
                <div className="status-row-value">
                  {nextJob ? nextJob.name : "Nenhum job agendado ativo"}
                </div>
                {nextJob?.nextRun && (
                  <div className="status-row-time">
                    {formatDateTime(nextJob.nextRun)} ({formatRelativeTime(nextJob.nextRun)})
                  </div>
                )}
              </div>

              {nextJob && <StatusPill tone="info">Agendado</StatusPill>}
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
              <StatusPill tone="error">{recentErrors.length} erro(s)</StatusPill>
            )}
          </div>

          {recentErrors.length === 0 ? (
            <div className="errors-empty-box">
              <CheckCircle2 size={32} color="var(--brand-primary)" className="mb-050" />
              <div className="errors-empty-title">
                Tudo funcionando perfeitamente!
              </div>
              <div className="errors-empty-description">
                Nenhum erro de execução de jobs ou relatórios nos últimos ciclos.
              </div>
            </div>
          ) : (
            <div className="errors-list">
              {recentErrors.map((err, idx) => (
                <div key={idx} className="error-row">
                  <div className="flex-1-min0">
                    <div className="error-source">
                      {err.source}
                    </div>
                    <div className="error-message">
                      {err.message}
                    </div>
                    {err.time && (
                      <div className="error-time">
                        {formatDateTime(err.time)} ({formatRelativeTime(err.time)})
                      </div>
                    )}
                  </div>

                  <button
                    className="btn-icon btn-icon-xs"
                    onClick={() => copyErrorMessage(err.message, idx)}
                    title="Copiar mensagem de erro"
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
