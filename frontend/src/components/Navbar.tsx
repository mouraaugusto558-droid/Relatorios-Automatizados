import {
  LayoutDashboard,
  MessageSquare,
  CalendarClock,
  FileSpreadsheet,
  Moon,
  Sun,
  RotateCw,
  Activity,
  Server
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useWhatsAppStatus } from "../hooks/useWhatsAppStatus";
import { useHealth } from "../hooks/useHealth";
import { formatPhoneNumber } from "../utils/formatDateTime";

export type TabId = "dashboard" | "whatsapp" | "jobs" | "reports";

interface NavbarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  jobsCount?: number;
  reportsCount?: number;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}

export function Navbar({
  activeTab,
  onSelectTab,
  jobsCount = 0,
  reportsCount = 0,
  onRefreshAll,
  isRefreshing = false
}: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const whatsapp = useWhatsAppStatus();
  const { health, isOnline } = useHealth();

  const getWhatsAppPill = () => {
    if (!whatsapp) {
      return (
        <span className="pill pill-neutral">
          <span className="status-dot" />
          Verificando WhatsApp...
        </span>
      );
    }

    switch (whatsapp.status) {
      case "connected":
        return (
          <span
            className="pill pill-success"
            title={`Conectado: ${formatPhoneNumber(whatsapp.phoneNumber)}`}
          >
            <span className="status-dot status-dot-pulse" />
            WhatsApp Conectado
          </span>
        );
      case "connecting":
        return (
          <span className="pill pill-warning">
            <span className="status-dot status-dot-pulse" />
            Conectando WhatsApp...
          </span>
        );
      case "qr":
        return (
          <span className="pill pill-warning">
            <span className="status-dot status-dot-pulse" />
            Aguardando QR Code
          </span>
        );
      case "disconnected":
      default:
        return (
          <span className="pill pill-error">
            <span className="status-dot" />
            WhatsApp Desconectado
          </span>
        );
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <Activity size={22} />
          </div>
          <div className="brand-info">
            <div className="brand-title">
              Painel de Operações
              <span className="pill pill-info" style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem" }}>
                v1.0
              </span>
            </div>
            <span className="brand-subtitle">Automação WhatsApp &amp; Relatórios</span>
          </div>
        </div>

        <div className="nav-actions">
          {/* WhatsApp Status Pill */}
          {getWhatsAppPill()}

          {/* Backend Health Pill */}
          <span
            className={`pill ${isOnline && health?.status === "ok" ? "pill-neutral" : "pill-error"}`}
            title={isOnline ? "Backend Fastify & Banco de Dados Ativos" : "Sem conexão com a API"}
          >
            <Server size={13} />
            {isOnline ? "Servidor Online" : "Servidor Offline"}
          </span>

          {/* Global Refresh Button */}
          {onRefreshAll && (
            <button
              className="btn-icon"
              onClick={onRefreshAll}
              disabled={isRefreshing}
              title="Atualizar todos os dados agora"
              aria-label="Atualizar dados"
            >
              <RotateCw size={17} className={isRefreshing ? "spinner" : ""} />
            </button>
          )}

          {/* Theme Toggle */}
          <button
            className="btn-icon"
            onClick={toggleTheme}
            title={theme === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="tabs-container" aria-label="Abas de navegação">
        <button
          className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => onSelectTab("dashboard")}
        >
          <LayoutDashboard size={17} />
          <span>Dashboard</span>
        </button>

        <button
          className={`tab-button ${activeTab === "whatsapp" ? "active" : ""}`}
          onClick={() => onSelectTab("whatsapp")}
        >
          <MessageSquare size={17} />
          <span>WhatsApp</span>
          {whatsapp?.status === "qr" && (
            <span className="tab-counter" style={{ color: "var(--accent-amber)" }}>
              QR
            </span>
          )}
        </button>

        <button
          className={`tab-button ${activeTab === "jobs" ? "active" : ""}`}
          onClick={() => onSelectTab("jobs")}
        >
          <CalendarClock size={17} />
          <span>Jobs &amp; Agendamentos</span>
          {jobsCount > 0 && <span className="tab-counter">{jobsCount}</span>}
        </button>

        <button
          className={`tab-button ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => onSelectTab("reports")}
        >
          <FileSpreadsheet size={17} />
          <span>Relatórios</span>
          {reportsCount > 0 && <span className="tab-counter">{reportsCount}</span>}
        </button>
      </nav>
    </header>
  );
}
