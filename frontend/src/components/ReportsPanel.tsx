import { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Copy,
  Check,
  RotateCw,
  FolderOpen
} from "lucide-react";
import { useReports, type Report } from "../hooks/useReports";
import { useToast } from "../context/ToastContext";
import { formatDateTime, formatRelativeTime } from "../utils/formatDateTime";

type FilterStatus = "all" | "sent" | "generated" | "pending" | "error";

function ReportStatusBadge({ status }: { status: Report["status"] }) {
  switch (status) {
    case "sent":
      return (
        <span className="pill pill-success">
          <CheckCircle2 size={13} />
          Enviado
        </span>
      );
    case "generated":
      return (
        <span className="pill pill-info">
          <FileText size={13} />
          Gerado
        </span>
      );
    case "pending":
      return (
        <span className="pill pill-warning">
          <Clock size={13} />
          Pendente
        </span>
      );
    case "error":
      return (
        <span className="pill pill-error">
          <AlertCircle size={13} />
          Erro
        </span>
      );
    default:
      return <span className="pill pill-neutral">{status}</span>;
  }
}

export function ReportsPanel() {
  const { reports, refresh } = useReports();
  const { success } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      success("Lista atualizada", "Os relatórios foram recarregados com sucesso.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyPath = (filePath: string, id: number) => {
    navigator.clipboard.writeText(filePath);
    setCopiedId(id);
    success("Caminho copiado!", filePath);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Metrics
  const sentCount = reports.filter((r) => r.status === "sent").length;
  const generatedCount = reports.filter((r) => r.status === "generated").length;
  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const errorCount = reports.filter((r) => r.status === "error").length;

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesSearch =
        report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.filePath.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterStatus !== "all" && report.status !== filterStatus) return false;

      return true;
    });
  }, [reports, searchTerm, filterStatus]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header card with summary & actions */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <h2 className="card-title">
              <FileSpreadsheet size={20} color="var(--accent-purple)" />
              Central de Relatórios
            </h2>
            <p className="card-subtitle">
              Visualize os relatórios gerados automaticamente pela integração com a Otodata Nee-Vo.
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RotateCw size={14} className={isRefreshing ? "spinner" : ""} />
            Atualizar
          </button>
        </div>

        {/* Quick status summary chips */}
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <div
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--bg-card-subtle)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.82rem"
            }}
          >
            Total: <strong>{reports.length}</strong>
          </div>
          <div
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--brand-primary-bg)",
              border: "1px solid var(--brand-primary-border)",
              color: "var(--brand-primary)",
              fontSize: "0.82rem"
            }}
          >
            Enviados: <strong>{sentCount}</strong>
          </div>
          {generatedCount > 0 && (
            <div
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--accent-blue-bg)",
                border: "1px solid var(--accent-blue-border)",
                color: "var(--accent-blue)",
                fontSize: "0.82rem"
              }}
            >
              Gerados: <strong>{generatedCount}</strong>
            </div>
          )}
          {pendingCount > 0 && (
            <div
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--accent-amber-bg)",
                border: "1px solid var(--accent-amber-border)",
                color: "var(--accent-amber)",
                fontSize: "0.82rem"
              }}
            >
              Pendentes: <strong>{pendingCount}</strong>
            </div>
          )}
          {errorCount > 0 && (
            <div
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--accent-rose-bg)",
                border: "1px solid var(--accent-rose-border)",
                color: "var(--accent-rose)",
                fontSize: "0.82rem"
              }}
            >
              Erros: <strong>{errorCount}</strong>
            </div>
          )}
        </div>

        {/* Search & Status Filter */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nome ou arquivo..."
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
              aria-label="Filtrar relatórios por status"
            >
              <option value="all">Todos os status ({reports.length})</option>
              <option value="sent">Enviados ({sentCount})</option>
              <option value="generated">Gerados ({generatedCount})</option>
              <option value="pending">Pendentes ({pendingCount})</option>
              <option value="error">Com Erro ({errorCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      {filteredReports.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <FolderOpen size={26} />
            </div>
            <div className="empty-title">Nenhum relatório encontrado</div>
            <div className="empty-description">
              {searchTerm || filterStatus !== "all"
                ? "Nenhum relatório corresponde aos critérios de pesquisa informados."
                : "Ainda não foram gerados relatórios no sistema. Aguarde a execução do job agendado."}
            </div>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: "26%" }}>Relatório</th>
                <th style={{ width: "18%" }}>Data de Criação</th>
                <th style={{ width: "16%" }}>Status</th>
                <th style={{ width: "40%" }}>Caminho do Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  {/* Name */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div
                        style={{
                          padding: "0.35rem",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--accent-purple-bg)",
                          color: "var(--accent-purple)"
                        }}
                      >
                        <FileSpreadsheet size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{report.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          ID: #{report.id}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Creation Date */}
                  <td>
                    <div style={{ fontWeight: 600 }}>{formatDateTime(report.createdAt)}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {formatRelativeTime(report.createdAt)}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td>
                    <ReportStatusBadge status={report.status} />
                  </td>

                  {/* File Path + Copy Action */}
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        backgroundColor: "var(--bg-card-subtle)",
                        padding: "0.35rem 0.65rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)"
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.78rem",
                          color: "var(--text-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                        title={report.filePath}
                      >
                        {report.filePath}
                      </span>

                      <button
                        className="btn-icon"
                        onClick={() => handleCopyPath(report.filePath, report.id)}
                        title="Copiar caminho completo do arquivo"
                        style={{ width: "26px", height: "26px", flexShrink: 0 }}
                      >
                        {copiedId === report.id ? (
                          <Check size={13} color="var(--brand-primary)" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
