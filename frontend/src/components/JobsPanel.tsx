import { useState } from "react";
import {
  CalendarClock,
  Play,
  History,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Power
} from "lucide-react";
import type { Job } from "../hooks/useJobs";
import { useAppData } from "../context/AppDataContext";
import { useApiAction } from "../hooks/useApiAction";
import { useSearchAndFilter } from "../hooks/useSearchAndFilter";
import { apiPost, ApiError } from "../api/client";
import { JobHistoryModal } from "./JobHistoryModal";
import { StatusPill } from "./StatusPill";
import {
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  humanizeCron
} from "../utils/formatDateTime";

type FilterStatus = "all" | "active" | "disabled" | "running";

const JOB_SEARCH_FIELDS: readonly (keyof Job)[] = ["name", "id"];

function matchesJobFilter(job: Job, filterStatus: FilterStatus): boolean {
  if (filterStatus === "active") return job.enabled && !job.isRunning;
  if (filterStatus === "disabled") return !job.enabled;
  if (filterStatus === "running") return job.isRunning;
  return true;
}

export function JobsPanel() {
  const { jobs, refreshJobs } = useAppData();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [selectedJobForHistory, setSelectedJobForHistory] = useState<Job | null>(null);

  const filteredJobs = useSearchAndFilter(jobs, {
    searchTerm,
    searchFields: JOB_SEARCH_FIELDS,
    filterStatus,
    matchesFilter: matchesJobFilter
  });

  const runJobAction = useApiAction(
    async (job: Job) => {
      const result = await apiPost<{ ok: boolean }>(`/api/jobs/${job.id}/run`);
      await refreshJobs();
      return result;
    },
    {
      pending: (job) => ({
        title: "Disparando job...",
        message: `Iniciando a execução do job "${job.name}".`
      }),
      success: (_result, job) => ({
        title: "Job finalizado!",
        message: `A execução de "${job.name}" foi concluída.`
      }),
      error: (err) =>
        err instanceof ApiError
          ? { title: "Erro ao rodar job", message: `O backend retornou status: ${err.status}` }
          : { title: "Falha na requisição", message: "Não foi possível conectar ao servidor." }
    }
  );

  const handleRunNow = async (job: Job) => {
    setRunningJobId(job.id);
    await runJobAction.run(job);
    setRunningJobId(null);
  };

  const toggleJobAction = useApiAction(
    async (job: Job) => {
      const nextState = !job.enabled;
      await apiPost<Job>(`/api/jobs/${job.id}/toggle`, { enabled: nextState });
      await refreshJobs();
      return nextState;
    },
    {
      success: (nextState, job) => ({
        title: nextState ? "Job Ativado" : "Job Desativado",
        message: `O job "${job.name}" está agora ${nextState ? "ativo" : "desativado"}.`
      }),
      error: (err) =>
        err instanceof ApiError
          ? { title: "Falha ao alterar status", message: `Status retornado: ${err.status}` }
          : { title: "Erro de comunicação", message: "Não foi possível atualizar o agendamento." }
    }
  );

  const handleToggle = (job: Job) => {
    void toggleJobAction.run(job);
  };

  return (
    <div className="section-stack">
      {/* Header card with filters */}
      <div className="card">
        <div className="flex-between mb-125">
          <div>
            <h2 className="card-title">
              <CalendarClock size={20} color="var(--accent-blue)" />
              Jobs &amp; Agendamentos
            </h2>
            <p className="card-subtitle">
              Configure, monitore e acione as tarefas periódicas do sistema. Os horários
              seguem o fuso de Brasília.
            </p>
          </div>

          <div className="flex-row gap-050">
            <span className="pill pill-neutral">
              {jobs.length} jobs configurados
            </span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="filter-row">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nome ou ID..."
              className="input-text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-row gap-050">
            <select
              className="select-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              aria-label="Filtrar jobs por status"
            >
              <option value="all">Todos os status ({jobs.length})</option>
              <option value="active">Apenas Ativos ({jobs.filter((j) => j.enabled).length})</option>
              <option value="disabled">Apenas Desativados ({jobs.filter((j) => !j.enabled).length})</option>
              <option value="running">Em Execução ({jobs.filter((j) => j.isRunning).length})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      {filteredJobs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <CalendarClock size={26} />
            </div>
            <div className="empty-title">Nenhum job encontrado</div>
            <div className="empty-description">
              {searchTerm || filterStatus !== "all"
                ? "Nenhum job corresponde aos filtros selecionados. Tente ajustar sua busca."
                : "Não há tarefas agendadas cadastradas no momento."}
            </div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th className="col-24">Nome do Job</th>
                <th className="col-12">Status</th>
                <th className="col-20">Frequência (Cron)</th>
                <th className="col-18">Próxima Execução</th>
                <th className="col-14">Última Execução</th>
                <th className="col-12 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id}>
                  {/* Job Name */}
                  <td>
                    <div className="cell-title">{job.name}</div>
                    <div className="text-mono-muted">
                      id: {job.id}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td>
                    {job.isRunning ? (
                      <StatusPill tone="warning" icon={<RotateCw size={12} className="spinner" />}>
                        Executando
                      </StatusPill>
                    ) : job.enabled ? (
                      <StatusPill tone="success" dot>
                        Ativo
                      </StatusPill>
                    ) : (
                      <StatusPill tone="neutral" icon={<Power size={12} />}>
                        Desativado
                      </StatusPill>
                    )}
                  </td>

                  {/* Cron Frequency */}
                  <td>
                    <div className="font-medium">{humanizeCron(job.cronExpression)}</div>
                    <div className="cron-expression mt-015">
                      {job.cronExpression}
                    </div>
                  </td>

                  {/* Next Run */}
                  <td>
                    {job.enabled && job.nextRun ? (
                      <div>
                        <div className="font-semibold">{formatDateTime(job.nextRun)}</div>
                        <div className="fs-075 text-brand">
                          {formatRelativeTime(job.nextRun)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted fs-085">—</span>
                    )}
                  </td>

                  {/* Last Run */}
                  <td>
                    {job.lastRun ? (
                      <div>
                        <div className="flex-row gap-035">
                          {job.lastRun.status === "success" ? (
                            <CheckCircle2 size={14} color="var(--brand-primary)" />
                          ) : (
                            <AlertCircle size={14} color="var(--accent-rose)" />
                          )}
                          <span className="fs-082 font-semibold">
                            {job.lastRun.status === "success" ? "Sucesso" : "Erro"}
                          </span>
                          {job.lastRun.durationMs !== null && (
                            <span className="fs-075 text-muted font-mono">
                              ({formatDuration(job.lastRun.durationMs)})
                            </span>
                          )}
                        </div>
                        <div className="fs-075 text-muted mt-015">
                          {formatRelativeTime(job.lastRun.startedAt)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted fs-082">
                        Nunca executado
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="flex-row justify-end gap-045">
                      {/* Toggle switch */}
                      <label
                        className="toggle-switch"
                        title={job.enabled ? "Desativar Job" : "Ativar Job"}
                        aria-label={`Ativar ou desativar job ${job.name}`}
                      >
                        <input
                          type="checkbox"
                          checked={job.enabled}
                          onChange={() => handleToggle(job)}
                        />
                        <span className="toggle-slider" />
                      </label>

                      {/* Run Now Button */}
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRunNow(job)}
                        disabled={job.isRunning || runningJobId === job.id}
                        title="Executar imediatamente"
                      >
                        {runningJobId === job.id ? (
                          <RotateCw size={13} className="spinner" />
                        ) : (
                          <Play size={13} />
                        )}
                        <span>Rodar</span>
                      </button>

                      {/* History Button */}
                      <button
                        className="btn-icon btn-icon-sm"
                        onClick={() => setSelectedJobForHistory(job)}
                        title="Ver histórico de execuções"
                      >
                        <History size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* History Modal */}
      {selectedJobForHistory && (
        <JobHistoryModal
          job={selectedJobForHistory}
          onClose={() => setSelectedJobForHistory(null)}
        />
      )}
    </div>
  );
}
