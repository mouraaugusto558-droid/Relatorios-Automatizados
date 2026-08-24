import { useState, useCallback } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { Navbar, type TabId } from "./components/Navbar";
import { LoginPage } from "./components/LoginPage";
import { DashboardPanel } from "./components/DashboardPanel";
import { WhatsAppPanel } from "./components/WhatsAppPanel";
import { JobsPanel } from "./components/JobsPanel";
import { ReportsPanel } from "./components/ReportsPanel";
import { SpreadsheetPanel } from "./components/SpreadsheetPanel";
import { ToastContainer } from "./components/ToastContainer";
import { useReports } from "./hooks/useReports";

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const { jobs, refreshJobs, refreshHealth } = useAppData();
  const { reports, refresh: refreshReports } = useReports();
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
        {activeTab === "spreadsheet" && <SpreadsheetPanel />}
      </main>

      <ToastContainer />
    </div>
  );
}

function AuthGate() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated === null) return null;
  if (!isAuthenticated) return <LoginPage />;

  return (
    <AppDataProvider>
      <MainApp />
    </AppDataProvider>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
