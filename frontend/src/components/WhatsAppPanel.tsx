import { useState } from "react";
import {
  MessageSquare,
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Power,
  Radio,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { useWhatsAppStatus } from "../hooks/useWhatsAppStatus";
import { useToast } from "../context/ToastContext";
import {
  formatDateTime,
  formatPhoneNumber,
  formatRelativeTime
} from "../utils/formatDateTime";

export function WhatsAppPanel() {
  const status = useWhatsAppStatus();
  const { success, error: toastError, info } = useToast();

  const [isPending, setIsPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsPending(true);
    setPendingAction("connect");
    info("Iniciando conexão...", "Aguarde enquanto o Baileys inicia a sessão.");
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      if (res.ok) {
        success("Conexão iniciada", "Verifique o QR Code ou status abaixo.");
      } else {
        toastError("Falha na conexão", `Status retornado: ${res.status}`);
      }
    } catch {
      toastError("Erro de comunicação", "Não foi possível conectar ao backend.");
    } finally {
      setIsPending(false);
      setPendingAction(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Deseja realmente desconectar a sessão do WhatsApp?")) {
      return;
    }

    setIsPending(true);
    setPendingAction("disconnect");
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      if (res.ok) {
        success("Desconectado", "A sessão do WhatsApp foi encerrada com sucesso.");
      } else {
        toastError("Falha ao desconectar", `Status retornado: ${res.status}`);
      }
    } catch {
      toastError("Erro de comunicação", "Não foi possível desconectar.");
    } finally {
      setIsPending(false);
      setPendingAction(null);
    }
  };

  const handleReconnect = async () => {
    setIsPending(true);
    setPendingAction("reconnect");
    info("Reiniciando sessão...", "Encerrando e restabelecendo conexão...");
    try {
      await fetch("/api/whatsapp/disconnect", { method: "POST" });
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      if (res.ok) {
        success("Sessão reiniciada", "Aguarde a atualização de status.");
      } else {
        toastError("Falha ao reconectar", `Status retornado: ${res.status}`);
      }
    } catch {
      toastError("Erro de comunicação", "Não foi possível reconectar.");
    } finally {
      setIsPending(false);
      setPendingAction(null);
    }
  };

  const currentStatus = status?.status ?? "disconnected";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "860px", margin: "0 auto" }}>
      {/* Header Info */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-md)",
                backgroundColor: currentStatus === "connected" ? "var(--brand-primary-bg)" : "var(--bg-card-subtle)",
                color: currentStatus === "connected" ? "var(--brand-primary)" : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--border-subtle)"
              }}
            >
              <MessageSquare size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Gerenciador de Conexão WhatsApp</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                Controle a sessão do Baileys para envio automatizado de relatórios e mensagens.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="pill pill-info" title="Eventos recebidos em tempo real via Server-Sent Events (SSE)">
              <Radio size={12} className="status-dot-pulse" />
              SSE Ativo
            </span>
          </div>
        </div>
      </div>

      {/* Main Connection Status Card */}
      {currentStatus === "connected" && (
        <div className="card" style={{ borderColor: "var(--brand-primary-border)" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              padding: "2rem 1rem",
              gap: "1.25rem"
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                backgroundColor: "var(--brand-primary-bg)",
                color: "var(--brand-primary)",
                border: "2px solid var(--brand-primary-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(16, 185, 129, 0.25)"
              }}
            >
              <ShieldCheck size={40} />
            </div>

            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.35rem" }}>
                <span className="pill pill-success" style={{ fontSize: "0.85rem", padding: "0.35rem 0.85rem" }}>
                  <CheckCircle2 size={15} />
                  Sessão Ativa e Pronta
                </span>
              </div>
              <h3 style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "0.5rem", letterSpacing: "-0.01em" }}>
                {formatPhoneNumber(status?.phoneNumber)}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                Último evento recebido: {formatDateTime(status?.lastEventAt)} ({formatRelativeTime(status?.lastEventAt)})
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "0.5rem",
                flexWrap: "wrap",
                justifyContent: "center"
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={handleReconnect}
                disabled={isPending}
              >
                <RotateCw size={15} className={pendingAction === "reconnect" ? "spinner" : ""} />
                {pendingAction === "reconnect" ? "Reconectando..." : "Reconectar Sessão"}
              </button>

              <button
                className="btn btn-outline-danger"
                onClick={handleDisconnect}
                disabled={isPending}
              >
                <Power size={15} />
                {pendingAction === "disconnect" ? "Desconectando..." : "Desconectar WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStatus === "qr" && (
        <div className="card qr-scanner-card" style={{ borderColor: "var(--accent-amber-border)" }}>
          <div style={{ marginBottom: "1rem" }}>
            <span className="pill pill-warning" style={{ fontSize: "0.85rem", padding: "0.4rem 0.9rem" }}>
              <QrCode size={16} />
              Aguardando Leitura do QR Code
            </span>
          </div>

          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            Conecte seu WhatsApp
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", maxWidth: "460px", marginBottom: "1.5rem" }}>
            Aponte a câmera do seu celular com o WhatsApp aberto para escanear o código abaixo.
          </p>

          {status?.qrDataUrl ? (
            <div className="qr-frame">
              <img
                src={status.qrDataUrl}
                alt="QR Code para pareamento do WhatsApp"
                className="qr-image"
              />
            </div>
          ) : (
            <div
              style={{
                width: "240px",
                height: "240px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--bg-card-subtle)",
                borderRadius: "var(--radius-lg)",
                border: "1px dashed var(--border-strong)",
                marginBottom: "1.5rem",
                gap: "0.5rem",
                color: "var(--text-muted)"
              }}
            >
              <RotateCw size={30} className="spinner" />
              <span style={{ fontSize: "0.85rem" }}>Gerando QR Code...</span>
            </div>
          )}

          {/* Step by step instructions */}
          <div className="qr-steps-list">
            <div className="qr-step-item">
              <div className="qr-step-number">1</div>
              <span>Abra o <strong>WhatsApp</strong> no seu smartphone.</span>
            </div>
            <div className="qr-step-item">
              <div className="qr-step-number">2</div>
              <span>Toque em <strong>Configurações</strong> (iOS) ou <strong>Mais opções ⋮</strong> (Android).</span>
            </div>
            <div className="qr-step-item">
              <div className="qr-step-number">3</div>
              <span>Selecione <strong>Aparelhos conectados</strong> e toque em <strong>Conectar um aparelho</strong>.</span>
            </div>
            <div className="qr-step-item">
              <div className="qr-step-number">4</div>
              <span>Aponte a câmera do celular para o quadro acima para sincronizar.</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              className="btn btn-secondary"
              onClick={handleReconnect}
              disabled={isPending}
            >
              <RotateCw size={15} className={pendingAction === "reconnect" ? "spinner" : ""} />
              Recarregar QR Code
            </button>
            <button
              className="btn btn-outline-danger"
              onClick={handleDisconnect}
              disabled={isPending}
            >
              <Power size={15} />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {currentStatus === "connecting" && (
        <div className="card">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "3.5rem 1.5rem",
              textAlign: "center",
              gap: "1rem"
            }}
          >
            <RotateCw size={44} className="spinner" color="var(--brand-primary)" />
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Estabelecendo Conexão...</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", maxWidth: "420px" }}>
              Iniciando motor do WhatsApp e sincronizando chaves criptográficas. Isso pode levar alguns segundos.
            </p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDisconnect}
              disabled={isPending}
              style={{ marginTop: "0.5rem" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {currentStatus === "disconnected" && (
        <div className="card">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "3.5rem 1.5rem",
              textAlign: "center",
              gap: "1.2rem"
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: "var(--bg-card-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)"
              }}
            >
              <Smartphone size={32} />
            </div>

            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>WhatsApp Desconectado</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", maxWidth: "440px", marginTop: "0.3rem" }}>
                Inicie uma sessão para que o sistema possa realizar o envio de relatórios e mensagens automáticas aos destinatários.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={isPending}
              style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem" }}
            >
              <Power size={17} />
              {pendingAction === "connect" ? "Iniciando..." : "Conectar WhatsApp"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
