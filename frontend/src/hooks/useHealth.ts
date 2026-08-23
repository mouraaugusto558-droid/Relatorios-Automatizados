import { useCallback, useEffect, useState } from "react";

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
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = (await res.json()) as HealthStatus;
        setHealth(data);
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
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
