import { useState, useMemo } from "react";
import {
  CalendarClock,
  Play,
  History,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Clock,
  Power
} from "lucide-react";
import { useJobs, type Job } from "../hooks/useJobs";
import { useToast } from "../context/ToastContext";
import { JobHistoryModal } from "./JobHistoryModal";
import {
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  humanizeCron
} from "../utils/formatDateTime";

type FilterStatus = "all" | "active" | "disabled" | "running";

export function JobsPanel() {
  const { jobs, refresh } = useJobs();
  const { success, error: toastError, info } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [selectedJobForHistory, setSelectedJobForHistory] = useState<Job | null>(null);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Search match
      const matchesSearch =
        job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.id.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      if (filterStatus === "active") return job.enabled && !job.isRunning;
      if (filterStatus === "disabled") return !job.enabled;
      if (filterStatus === "running") return job.isRunning;
      return true;
    });
  }, [jobs, searchTerm, filterStatus]);

  const handleRunNow = async (job: Job) => {
    setRunningJobId(job.id);
    info("Disparando job...", `Iniciando a execução do job "${job.name}".`);
    try {
      const res = await fetch(`/api/jobs/${job.id}/run`, { method: "POST" });
      if (res.ok) {
        success("Job finalizado!", `A execução de "${job.name}" foi concluída.`);
        await refresh();
      } else {
        toastError("Erro ao rodar job", `O backend retornou status: ${res.status}`);
      }
    } catch {
      toastError("Falha na requisição", "Não foi possível conectar ao servidor.");
    } finally {
      setRunningJobId(null);
    }
  };

  const handleToggle = async (job: Job) => {
    const nextState = !job.enabled;
    try {
      const res = await fetch(`/api/jobs/${job.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState })
      });
      if (res.ok) {
        success(
          nextState ? "Job Ativado" : "Job Desativado",
          `O job "${job.name}" está agora ${nextState ? "ativo" : "desativado"}.`
        );
        await refresh();
      } else {
        toastError("Falha ao alterar status", `Status retornado: ${res.status}`);
      }
    } catch {
      toastError("Erro de comunicação", "Não foi possível atualizar o agendamento.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header card with filters */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <h2 className="card-title">
              <CalendarClock size={20} color="var(--accent-blue)" />
              Jobs &amp; Agendamentos
            </h2>
            <p className="card-subtitle">
              Configure, monitore e acione as tarefas periódicas automatizadas pelo sistema.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className="pill pill-neutral">
              {jobs.length} jobs configurados
            </span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
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

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
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
                <th style={{ width: "24%" }}>Nome do Job</th>
                <th style={{ width: "12%" }}>Status</th>
                <th style={{ width: "20%" }}>Frequência (Cron)</th>
                <th style={{ width: "18%" }}>Próxima Execução</th>
                <th style={{ width: "14%" }}>Última Execução</th>
                <th style={{ width: "12%", textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id}>
                  {/* Job Name */}
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{job.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      id: {job.id}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td>
                    {job.isRunning ? (
                      <span className="pill pill-warning">
                        <RotateCw size={12} className="spinner" />
                        Executando
                      </span>
                    ) : job.enabled ? (
                      <span className="pill pill-success">
                        <span className="status-dot" />
                        Ativo
                      </span>
                    ) : (
                      <span className="pill pill-neutral">
                        <Power size={12} />
                        Desativado
                      </span>
                    )}
                  </td>

                  {/* Cron Frequency */}
                  <td>
                    <div style={{ fontWeight: 500 }}>{humanizeCron(job.cronExpression)}</div>
                    <div
                      style={{
                        display: "inline-block",
                        fontSize: "0.72rem",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                        marginTop: "0.15rem"
                      }}
                    >
                      {job.cronExpression}
                    </div>
                  </td>

                  {/* Next Run */}
                  <td>
                    {job.enabled && job.nextRun ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>{formatDateTime(job.nextRun)}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--brand-primary)" }}>
                          {formatRelativeTime(job.nextRun)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>—</span>
                    )}
                  </td>

                  {/* Last Run */}
                  <td>
                    {job.lastRun ? (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          {job.lastRun.status === "success" ? (
                            <CheckCircle2 size={14} color="var(--brand-primary)" />
                          ) : (
                            <AlertCircle size={14} color="var(--accent-rose)" />
                          )}
                          <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                            {job.lastRun.status === "success" ? "Sucesso" : "Erro"}
                          </span>
                          {job.lastRun.durationMs !== null && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              ({formatDuration(job.lastRun.durationMs)})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                          {formatRelativeTime(job.lastRun.startedAt)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        Nunca executado
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.45rem" }}>
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
                        className="btn-icon"
                        onClick={() => setSelectedJobForHistory(job)}
                        title="Ver histórico de execuções"
                        style={{ width: "32px", height: "32px" }}
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
