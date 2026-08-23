import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  uptime: number;
  database: "ok" | "error";
  whatsapp: "disconnected" | "connecting" | "qr" | "connected";
  whatsappNumber: string | null;
}

const HEALTH_POLL_INTERVAL_MS = 10000;

export function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const data = await apiGet<HealthStatus>("/api/health");
      setHealth(data);
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    const interval = setInterval(() => {
      void checkHealth();
    }, HEALTH_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [checkHealth]);

  return { health, isOnline, isChecking, refreshHealth: checkHealth };
}
