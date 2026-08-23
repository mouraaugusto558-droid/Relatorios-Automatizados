import React, { createContext, useContext } from "react";
import { useJobs, type Job } from "../hooks/useJobs";
import { useHealth, type HealthStatus } from "../hooks/useHealth";
import { useWhatsAppStatus, type WhatsAppStatusPayload } from "../hooks/useWhatsAppStatus";

interface AppDataContextType {
  jobs: Job[];
  refreshJobs: () => Promise<void>;
  health: HealthStatus | null;
  isOnline: boolean;
  isChecking: boolean;
  refreshHealth: () => Promise<void>;
  whatsapp: WhatsAppStatusPayload | null;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

/**
 * Fonte única para os hooks de dados que fazem polling/streaming contínuo
 * (jobs, health, whatsapp). Antes, `useJobs`/`useHealth`/`useWhatsAppStatus`
 * eram chamados de forma independente em vários componentes ao mesmo tempo
 * (App, Navbar, DashboardPanel), disparando pollings e EventSources
 * duplicados para os mesmos dados. Este provider chama cada hook uma única
 * vez e distribui o resultado via contexto.
 *
 * `useReports` fica de fora de propósito: hoje é só um fetch no mount, sem
 * polling contínuo, e continua sendo chamado localmente onde é usado
 * (App, DashboardPanel, ReportsPanel).
 */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { jobs, refresh: refreshJobs } = useJobs();
  const { health, isOnline, isChecking, refreshHealth } = useHealth();
  const whatsapp = useWhatsAppStatus();

  return (
    <AppDataContext.Provider
      value={{ jobs, refreshJobs, health, isOnline, isChecking, refreshHealth, whatsapp }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextType {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within an AppDataProvider");
  }
  return context;
}
