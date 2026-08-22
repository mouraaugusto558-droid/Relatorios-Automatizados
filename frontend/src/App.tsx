import { useEffect, useState } from "react";

interface HealthResponse {
  status: string;
  uptime: number;
  database: string;
  whatsapp: string;
}

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then(setHealth)
      .catch((err) => setError(String(err)));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Painel WhatsApp — Fase 0</h1>
      {error && <p style={{ color: "crimson" }}>Erro ao consultar /api/health: {error}</p>}
      {!error && !health && <p>Consultando /api/health...</p>}
      {health && (
        <ul>
          <li>status: {health.status}</li>
          <li>uptime: {health.uptime.toFixed(1)}s</li>
          <li>database: {health.database}</li>
          <li>whatsapp: {health.whatsapp}</li>
        </ul>
      )}
    </main>
  );
}
