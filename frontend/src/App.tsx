import { useState } from "react";
import { DashboardPanel } from "./components/DashboardPanel";
import { WhatsAppPanel } from "./components/WhatsAppPanel";
import { JobsPanel } from "./components/JobsPanel";
import { ReportsPanel } from "./components/ReportsPanel";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "jobs", label: "Jobs" },
  { id: "reports", label: "Relatórios" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1>Painel</h1>

      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ fontWeight: activeTab === tab.id ? "bold" : "normal" }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "dashboard" && <DashboardPanel />}
      {activeTab === "whatsapp" && <WhatsAppPanel />}
      {activeTab === "jobs" && <JobsPanel />}
      {activeTab === "reports" && <ReportsPanel />}
    </main>
  );
}
