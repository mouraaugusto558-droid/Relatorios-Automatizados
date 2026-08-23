import { useEffect, useState, useCallback } from "react";
import { X, RotateCw, CheckCircle2, AlertCircle, Clock, Terminal } from "lucide-react";
import type { Job, JobRun } from "../hooks/useJobs";
import { formatDateTime, formatDuration, formatRelativeTime } from "../utils/formatDateTime";

interface JobHistoryModalProps {
  job: Job | null;
  onClose: () => void;
}

export function JobHistoryModal({ job, onClose }: JobHistoryModalProps) {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!job) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/runs`);
      if (!res.ok) throw new Error(`Falha ao obter histórico (${res.status})`);
      const data = (await res.json()) as JobRun[];
      setRuns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }, [job]);

  useEffect(() => {
    if (job) {
      void fetchRuns();
    }
  }, [job, fetchRuns]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!job) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex-row gap-065">
            <div className="history-header-icon">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="history-title">Histórico de Execuções</h3>
              <p className="fs-080 text-muted">
                Job: <strong>{job.name}</strong> <span className="opacity-70">({job.id})</span>
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Fechar modal">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {isLoading ? (
            <div className="history-loading">
              <RotateCw size={24} className="spinner" />
              <span>Carregando execuções passadas...</span>
            </div>
          ) : error ? (
            <div className="card history-error-card">
              <div className="flex-row gap-050 font-semibold">
                <AlertCircle size={18} />
                <span>Erro ao carregar histórico</span>
              </div>
              <p className="history-error-message">{error}</p>
            </div>
          ) : runs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <Terminal size={24} />
              </div>
              <div className="empty-title">Nenhuma execução registrada</div>
              <div className="empty-description">
                Este job ainda não foi executado ou o histórico foi limpo recentemente.
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Início</th>
                    <th>Duração</th>
                    <th>Detalhes / Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td>
                        {run.status === "success" && (
                          <span className="pill pill-success">
                            <CheckCircle2 size={13} />
                            Sucesso
                          </span>
                        )}
                        {run.status === "error" && (
                          <span className="pill pill-error">
                            <AlertCircle size={13} />
                            Falha
                          </span>
                        )}
                        {run.status === "running" && (
                          <span className="pill pill-warning">
                            <RotateCw size={13} className="spinner" />
                            Executando
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="font-semibold">{formatDateTime(run.startedAt)}</div>
                        <div className="cell-subtext">
                          {formatRelativeTime(run.startedAt)}
                        </div>
                      </td>
                      <td>
                        <span className="history-duration">
                          {formatDuration(run.durationMs)}
                        </span>
                      </td>
                      <td>
                        {run.error ? (
                          <div className="history-error-cell">
                            {run.error}
                          </div>
                        ) : (
                          <span className="text-muted fs-082">
                            Concluído sem erros
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchRuns}
            disabled={isLoading}
          >
            <RotateCw size={14} className={isLoading ? "spinner" : ""} />
            Atualizar
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
