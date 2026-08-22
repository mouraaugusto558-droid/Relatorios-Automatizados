import { useReports } from "../hooks/useReports";
import { formatDateTime } from "../utils/formatDateTime";

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
              <td>{report.status}</td>
              <td>{report.filePath}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
