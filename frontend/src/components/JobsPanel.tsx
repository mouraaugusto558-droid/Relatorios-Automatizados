import { useJobs } from "../hooks/useJobs";
import { formatDateTime } from "../utils/formatDateTime";

async function runJob(id: string): Promise<void> {
  await fetch(`/api/jobs/${id}/run`, { method: "POST" });
}

async function toggleJob(id: string, enabled: boolean): Promise<void> {
  await fetch(`/api/jobs/${id}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled })
  });
}

export function JobsPanel() {
  const { jobs, refresh } = useJobs();

  async function handleRun(id: string) {
    await runJob(id);
    await refresh();
  }

  async function handleToggle(id: string, enabled: boolean) {
    await toggleJob(id, enabled);
    await refresh();
  }

  return (
    <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem" }}>
      <h2>Jobs</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Nome</th>
            <th style={{ textAlign: "left" }}>Status</th>
            <th style={{ textAlign: "left" }}>Próxima execução</th>
            <th style={{ textAlign: "left" }}>Última execução</th>
            <th style={{ textAlign: "left" }}>Último erro</th>
            <th style={{ textAlign: "left" }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>{job.name}</td>
              <td>
                {job.isRunning ? "Executando" : job.enabled ? "Ativo" : "Desativado"}
              </td>
              <td>{job.enabled ? formatDateTime(job.nextRun) : "—"}</td>
              <td>
                {job.lastRun
                  ? `${formatDateTime(job.lastRun.startedAt)} — ${job.lastRun.status}`
                  : "Nunca executado"}
              </td>
              <td>{job.lastRun?.error ?? "—"}</td>
              <td style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => handleRun(job.id)} disabled={job.isRunning}>
                  Rodar agora
                </button>
                <button onClick={() => handleToggle(job.id, !job.enabled)}>
                  {job.enabled ? "Desativar" : "Ativar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
