import { useReports, type Report } from "../hooks/useReports";
import { formatDateTime } from "../utils/formatDateTime";

const REPORT_STATUS_META: Record<Report["status"], { label: string; color: string }> = {
  pending: { label: "Pendente", color: "#b58105" },
  generated: { label: "Gerado", color: "#1a73e8" },
  sent: { label: "Enviado", color: "#188038" },
  error: { label: "Erro", color: "#d93025" }
};

function StatusBadge({ status }: { status: Report["status"] }) {
  const meta = REPORT_STATUS_META[status] ?? { label: status, color: "#666" };
  return <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>;
}

export function ReportsPanel() {
  const { reports } = useReports();

  return (
    <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem" }}>
      <h2>Relatórios</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Relatório</th>
            <th style={{ textAlign: "left" }}>Data</th>
            <th style={{ textAlign: "left" }}>Status</th>
            <th style={{ textAlign: "left" }}>Arquivo</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 && (
            <tr>
              <td colSpan={4}>Nenhum relatório gerado ainda.</td>
            </tr>
          )}
          {reports.map((report) => (
            <tr key={report.id}>
              <td>{report.name}</td>
              <td>{formatDateTime(report.createdAt)}</td>
              <td>
                <StatusBadge status={report.status} />
              </td>
              <td>{report.filePath}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
