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
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div
              style={{
                padding: "0.4rem",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--accent-blue-bg)",
                color: "var(--accent-blue)"
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Histórico de Execuções</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Job: <strong>{job.name}</strong> <span style={{ opacity: 0.7 }}>({job.id})</span>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 0", gap: "0.75rem", color: "var(--text-muted)" }}>
              <RotateCw size={24} className="spinner" />
              <span>Carregando execuções passadas...</span>
            </div>
          ) : error ? (
            <div className="card" style={{ borderColor: "var(--accent-rose-border)", backgroundColor: "var(--accent-rose-bg)", color: "var(--accent-rose)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 }}>
                <AlertCircle size={18} />
                <span>Erro ao carregar histórico</span>
              </div>
              <p style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>{error}</p>
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
                        <div style={{ fontWeight: 600 }}>{formatDateTime(run.startedAt)}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {formatRelativeTime(run.startedAt)}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem" }}>
                          {formatDuration(run.durationMs)}
                        </span>
                      </td>
                      <td>
                        {run.error ? (
                          <div
                            style={{
                              color: "var(--accent-rose)",
                              fontSize: "0.8rem",
                              background: "var(--accent-rose-bg)",
                              padding: "0.35rem 0.6rem",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--accent-rose-border)",
                              fontFamily: "var(--font-mono)",
                              maxWidth: "280px",
                              wordBreak: "break-all"
                            }}
                          >
                            {run.error}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
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
