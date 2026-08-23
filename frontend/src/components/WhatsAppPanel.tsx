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
import { useAppData } from "../context/AppDataContext";
import { useApiAction } from "../hooks/useApiAction";
import { apiPost, ApiError } from "../api/client";
import { ConfirmModal } from "./ConfirmModal";
import {
  formatDateTime,
  formatPhoneNumber,
  formatRelativeTime
} from "../utils/formatDateTime";

export function WhatsAppPanel() {
  const { whatsapp: status } = useAppData();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const connectAction = useApiAction(() => apiPost("/api/whatsapp/connect"), {
    pending: () => ({
      title: "Iniciando conexão...",
      message: "Aguarde enquanto o Baileys inicia a sessão."
    }),
    success: () => ({
      title: "Conexão iniciada",
      message: "Verifique o QR Code ou status abaixo."
    }),
    error: (err) =>
      err instanceof ApiError
        ? { title: "Falha na conexão", message: `Status retornado: ${err.status}` }
        : { title: "Erro de comunicação", message: "Não foi possível conectar ao backend." }
  });

  const disconnectAction = useApiAction(() => apiPost("/api/whatsapp/disconnect"), {
    success: () => ({
      title: "Desconectado",
      message: "A sessão do WhatsApp foi encerrada com sucesso."
    }),
    error: (err) =>
      err instanceof ApiError
        ? { title: "Falha ao desconectar", message: `Status retornado: ${err.status}` }
        : { title: "Erro de comunicação", message: "Não foi possível desconectar." }
  });

  const reconnectAction = useApiAction(
    async () => {
      await apiPost("/api/whatsapp/disconnect");
      return apiPost("/api/whatsapp/connect");
    },
    {
      pending: () => ({
        title: "Reiniciando sessão...",
        message: "Encerrando e restabelecendo conexão..."
      }),
      success: () => ({
        title: "Sessão reiniciada",
        message: "Aguarde a atualização de status."
      }),
      error: (err) =>
        err instanceof ApiError
          ? { title: "Falha ao reconectar", message: `Status retornado: ${err.status}` }
          : { title: "Erro de comunicação", message: "Não foi possível reconectar." }
    }
  );

  const handleConnect = () => {
    void connectAction.run();
  };

  const handleDisconnect = () => {
    setShowDisconnectConfirm(true);
  };

  const handleConfirmDisconnect = () => {
    setShowDisconnectConfirm(false);
    void disconnectAction.run();
  };

  const handleReconnect = () => {
    void reconnectAction.run();
  };

  const isPending = connectAction.isPending || disconnectAction.isPending || reconnectAction.isPending;
  const pendingAction = connectAction.isPending
    ? "connect"
    : disconnectAction.isPending
    ? "disconnect"
    : reconnectAction.isPending
    ? "reconnect"
    : null;

  const currentStatus = status?.status ?? "disconnected";

  return (
    <div className="section-stack wa-panel">
      {/* Header Info */}
      <div className="card">
        <div className="flex-between">
          <div className="flex-row gap-085">
            <div
              className={`wa-header-icon ${currentStatus === "connected" ? "wa-header-icon-active" : "wa-header-icon-inactive"}`}
            >
              <MessageSquare size={24} />
            </div>
            <div>
              <h2 className="wa-title">Gerenciador de Conexão WhatsApp</h2>
              <p className="wa-subtitle">
                Controle a sessão do Baileys para envio automatizado de relatórios e mensagens.
              </p>
            </div>
          </div>

          <div className="flex-row gap-050">
            <span className="pill pill-info" title="Eventos recebidos em tempo real via Server-Sent Events (SSE)">
              <Radio size={12} className="status-dot-pulse" />
              SSE Ativo
            </span>
          </div>
        </div>
      </div>

      {/* Main Connection Status Card */}
      {currentStatus === "connected" && (
        <div className="card card-border-success">
          <div className="wa-connected-content">
            <div className="wa-status-icon-success">
              <ShieldCheck size={40} />
            </div>

            <div>
              <div className="wa-badge-wrap">
                <span className="pill pill-success pill-lg">
                  <CheckCircle2 size={15} />
                  Sessão Ativa e Pronta
                </span>
              </div>
              <h3 className="wa-phone-heading">
                {formatPhoneNumber(status?.phoneNumber)}
              </h3>
              <p className="wa-muted-note">
                Último evento recebido: {formatDateTime(status?.lastEventAt)} ({formatRelativeTime(status?.lastEventAt)})
              </p>
            </div>

            <div className="flex-row-wrap justify-center gap-075 mt-050">
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
        <div className="card qr-scanner-card card-border-warning">
          <div className="mb-100">
            <span className="pill pill-warning pill-xl">
              <QrCode size={16} />
              Aguardando Leitura do QR Code
            </span>
          </div>

          <h3 className="wa-qr-heading">
            Conecte seu WhatsApp
          </h3>
          <p className="wa-qr-description">
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
            <div className="wa-qr-placeholder">
              <RotateCw size={30} className="spinner" />
              <span className="fs-085">Gerando QR Code...</span>
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

          <div className="flex-row gap-075">
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
          <div className="wa-empty-content gap-100">
            <RotateCw size={44} className="spinner" color="var(--brand-primary)" />
            <h3 className="wa-connecting-heading">Estabelecendo Conexão...</h3>
            <p className="wa-connecting-description">
              Iniciando motor do WhatsApp e sincronizando chaves criptográficas. Isso pode levar alguns segundos.
            </p>
            <button
              className="btn btn-secondary btn-sm mt-050"
              onClick={handleDisconnect}
              disabled={isPending}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {currentStatus === "disconnected" && (
        <div className="card">
          <div className="wa-empty-content gap-120">
            <div className="wa-status-icon-neutral">
              <Smartphone size={32} />
            </div>

            <div>
              <h3 className="wa-title">WhatsApp Desconectado</h3>
              <p className="wa-disconnected-description">
                Inicie uma sessão para que o sistema possa realizar o envio de relatórios e mensagens automáticas aos destinatários.
              </p>
            </div>

            <button
              className="btn btn-primary wa-connect-btn"
              onClick={handleConnect}
              disabled={isPending}
            >
              <Power size={17} />
              {pendingAction === "connect" ? "Iniciando..." : "Conectar WhatsApp"}
            </button>
          </div>
        </div>
      )}

      {showDisconnectConfirm && (
        <ConfirmModal
          title="Desconectar WhatsApp"
          message="Deseja realmente desconectar a sessão do WhatsApp?"
          confirmLabel="Desconectar"
          onConfirm={handleConfirmDisconnect}
          onCancel={() => setShowDisconnectConfirm(false)}
        />
      )}
    </div>
  );
}
