import { useState, useCallback } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { Navbar, type TabId } from "./components/Navbar";
import { DashboardPanel } from "./components/DashboardPanel";
import { WhatsAppPanel } from "./components/WhatsAppPanel";
import { JobsPanel } from "./components/JobsPanel";
import { ReportsPanel } from "./components/ReportsPanel";
import { ToastContainer } from "./components/ToastContainer";
import { useJobs } from "./hooks/useJobs";
import { useReports } from "./hooks/useReports";
import { useHealth } from "./hooks/useHealth";

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const { jobs, refresh: refreshJobs } = useJobs();
  const { reports, refresh: refreshReports } = useReports();
  const { refreshHealth } = useHealth();
  const { success } = useToast();

  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshingAll(true);
    try {
      await Promise.allSettled([refreshJobs(), refreshReports(), refreshHealth()]);
      success("Painel atualizado", "Todos os dados foram sincronizados com o servidor.");
    } finally {
      setIsRefreshingAll(false);
    }
  }, [refreshJobs, refreshReports, refreshHealth, success]);

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        jobsCount={jobs.length}
        reportsCount={reports.length}
        onRefreshAll={handleRefreshAll}
        isRefreshing={isRefreshingAll}
      />

      <main className="main-content">
        {activeTab === "dashboard" && <DashboardPanel onNavigateTab={setActiveTab} />}
        {activeTab === "whatsapp" && <WhatsAppPanel />}
        {activeTab === "jobs" && <JobsPanel />}
        {activeTab === "reports" && <ReportsPanel />}
      </main>

      <ToastContainer />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </ThemeProvider>
  );
}
