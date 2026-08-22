import { useState } from "react";
import { useWhatsAppStatus } from "../hooks/useWhatsAppStatus";
import { formatDateTime } from "../utils/formatDateTime";

const STATUS_LABELS: Record<string, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando...",
  qr: "Aguardando leitura do QR Code",
  connected: "Conectado"
};

async function postAction(path: string): Promise<void> {
  await fetch(path, { method: "POST" });
}

export function WhatsAppPanel() {
  const status = useWhatsAppStatus();
  const [actionPending, setActionPending] = useState(false);

  async function handleConnect() {
    setActionPending(true);
    try {
      await postAction("/api/whatsapp/connect");
    } finally {
      setActionPending(false);
    }
  }

  async function handleDisconnect() {
    setActionPending(true);
    try {
      await postAction("/api/whatsapp/disconnect");
    } finally {
      setActionPending(false);
    }
  }

  async function handleReconnect() {
    setActionPending(true);
    try {
      await postAction("/api/whatsapp/disconnect");
      await postAction("/api/whatsapp/connect");
    } finally {
      setActionPending(false);
    }
  }

  const label = status ? STATUS_LABELS[status.status] ?? status.status : "Carregando...";

  return (
    <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", maxWidth: 360 }}>
      <h2>WhatsApp</h2>
      <p>
        Status: <strong>{label}</strong>
      </p>
      <p>Último evento: {formatDateTime(status?.lastEventAt)}</p>

      {status?.status === "connected" && status.phoneNumber && (
        <p>Número conectado: {status.phoneNumber}</p>
      )}

      {status?.status === "qr" && status.qrDataUrl && (
        <div>
          <img src={status.qrDataUrl} alt="QR Code do WhatsApp" width={256} height={256} />
          <p>Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button onClick={handleConnect} disabled={actionPending || status?.status === "connected"}>
          Conectar
        </button>
        <button onClick={handleReconnect} disabled={actionPending}>
          Reconectar
        </button>
        <button onClick={handleDisconnect} disabled={actionPending || status?.status === "disconnected"}>
          Desconectar
        </button>
      </div>
    </section>
  );
}
