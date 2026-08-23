import { useState } from "react";
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
import { useApiAction } from "../hooks/useApiAction";
import { useSearchAndFilter } from "../hooks/useSearchAndFilter";
import { StatusPill } from "./StatusPill";
import { formatDateTime, formatRelativeTime } from "../utils/formatDateTime";

type FilterStatus = "all" | "sent" | "generated" | "pending" | "error";

const REPORT_SEARCH_FIELDS: readonly (keyof Report)[] = ["name", "filePath"];

function matchesReportFilter(report: Report, filterStatus: FilterStatus): boolean {
  return filterStatus === "all" || report.status === filterStatus;
}

function ReportStatusBadge({ status }: { status: Report["status"] }) {
  switch (status) {
    case "sent":
      return (
        <StatusPill tone="success" icon={<CheckCircle2 size={13} />}>
          Enviado
        </StatusPill>
      );
    case "generated":
      return (
        <StatusPill tone="info" icon={<FileText size={13} />}>
          Gerado
        </StatusPill>
      );
    case "pending":
      return (
        <StatusPill tone="warning" icon={<Clock size={13} />}>
          Pendente
        </StatusPill>
      );
    case "error":
      return (
        <StatusPill tone="error" icon={<AlertCircle size={13} />}>
          Erro
        </StatusPill>
      );
    default:
      return <StatusPill tone="neutral">{status}</StatusPill>;
  }
}

export function ReportsPanel() {
  const { reports, refresh } = useReports();
  const { success } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const refreshAction = useApiAction(refresh, {
    success: () => ({
      title: "Lista atualizada",
      message: "Os relatórios foram recarregados com sucesso."
    }),
    error: () => ({
      title: "Falha ao atualizar",
      message: "Não foi possível recarregar a lista de relatórios."
    })
  });

  const handleRefresh = () => {
    void refreshAction.run();
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

  const filteredReports = useSearchAndFilter(reports, {
    searchTerm,
    searchFields: REPORT_SEARCH_FIELDS,
    filterStatus,
    matchesFilter: matchesReportFilter
  });

  return (
    <div className="section-stack">
      {/* Header card with summary & actions */}
      <div className="card">
        <div className="flex-between mb-125">
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
            disabled={refreshAction.isPending}
          >
            <RotateCw size={14} className={refreshAction.isPending ? "spinner" : ""} />
            Atualizar
          </button>
        </div>

        {/* Quick status summary chips */}
        <div className="flex-row-wrap gap-065 mb-125">
          <div className="chip">
            Total: <strong>{reports.length}</strong>
          </div>
          <div className="chip chip-success">
            Enviados: <strong>{sentCount}</strong>
          </div>
          {generatedCount > 0 && (
            <div className="chip chip-info">
              Gerados: <strong>{generatedCount}</strong>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="chip chip-warning">
              Pendentes: <strong>{pendingCount}</strong>
            </div>
          )}
          {errorCount > 0 && (
            <div className="chip chip-error">
              Erros: <strong>{errorCount}</strong>
            </div>
          )}
        </div>

        {/* Search & Status Filter */}
        <div className="filter-row">
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

          <div className="flex-row gap-050">
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
                <th className="col-26">Relatório</th>
                <th className="col-18">Data de Criação</th>
                <th className="col-16">Status</th>
                <th className="col-40">Caminho do Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  {/* Name */}
                  <td>
                    <div className="flex-row gap-060">
                      <div className="icon-chip icon-chip-purple">
                        <FileSpreadsheet size={16} />
                      </div>
                      <div>
                        <div className="cell-title">{report.name}</div>
                        <div className="cell-subtext">
                          ID: #{report.id}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Creation Date */}
                  <td>
                    <div className="font-semibold">{formatDateTime(report.createdAt)}</div>
                    <div className="cell-subtext">
                      {formatRelativeTime(report.createdAt)}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td>
                    <ReportStatusBadge status={report.status} />
                  </td>

                  {/* File Path + Copy Action */}
                  <td>
                    <div className="filepath-row">
                      <span
                        className="font-mono fs-078 text-secondary text-ellipsis"
                        title={report.filePath}
                      >
                        {report.filePath}
                      </span>

                      <button
                        className="btn-icon btn-icon-xxs"
                        onClick={() => handleCopyPath(report.filePath, report.id)}
                        title="Copiar caminho completo do arquivo"
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
