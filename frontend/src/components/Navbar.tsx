import {
  LayoutDashboard,
  MessageSquare,
  CalendarClock,
  FileSpreadsheet,
  Table2,
  UserX,
  Moon,
  Sun,
  RotateCw,
  Activity,
  Server,
  LogOut
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { StatusPill } from "./StatusPill";
import { formatPhoneNumber } from "../utils/formatDateTime";

export type TabId = "dashboard" | "whatsapp" | "jobs" | "reports" | "spreadsheet" | "exclusion";

interface NavbarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  jobsCount?: number;
  reportsCount?: number;
  excludedCount?: number;
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}

export function Navbar({
  activeTab,
  onSelectTab,
  jobsCount = 0,
  reportsCount = 0,
  excludedCount = 0,
  onRefreshAll,
  isRefreshing = false
}: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { whatsapp, health, isOnline } = useAppData();
  const { logout } = useAuth();

  const getWhatsAppPill = () => {
    if (!whatsapp) {
      return (
        <StatusPill tone="neutral" dot>
          Verificando WhatsApp...
        </StatusPill>
      );
    }

    switch (whatsapp.status) {
      case "connected":
        return (
          <StatusPill
            tone="success"
            dot
            pulse
            title={`Conectado: ${formatPhoneNumber(whatsapp.phoneNumber)}`}
          >
            WhatsApp Conectado
          </StatusPill>
        );
      case "connecting":
        return (
          <StatusPill tone="warning" dot pulse>
            Conectando WhatsApp...
          </StatusPill>
        );
      case "qr":
        return (
          <StatusPill tone="warning" dot pulse>
            Aguardando QR Code
          </StatusPill>
        );
      case "disconnected":
      default:
        return (
          <StatusPill tone="error" dot>
            WhatsApp Desconectado
          </StatusPill>
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
              <span className="pill pill-info pill-sm">
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

          {/* Logout */}
          <button
            className="btn-icon"
            onClick={() => void logout()}
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={17} />
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
            <span className="tab-counter tab-counter-warning">
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

        <button
          className={`tab-button ${activeTab === "spreadsheet" ? "active" : ""}`}
          onClick={() => onSelectTab("spreadsheet")}
        >
          <Table2 size={17} />
          <span>Planilha</span>
        </button>

        <button
          className={`tab-button ${activeTab === "exclusion" ? "active" : ""}`}
          onClick={() => onSelectTab("exclusion")}
        >
          <UserX size={17} />
          <span>Excluir Clientes</span>
          {excludedCount > 0 && <span className="tab-counter">{excludedCount}</span>}
        </button>
      </nav>
    </header>
  );
}
