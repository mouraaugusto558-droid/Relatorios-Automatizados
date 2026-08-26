import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";

export interface AlertHistoryEntry {
  id: number;
  sentAt: string;
  summary: string;
  enteredCount: number;
  resolvedCount: number;
  filledCount: number;
  message: string;
}

export function useAlertHistory(): { history: AlertHistoryEntry[]; refresh: () => Promise<void> } {
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);

  const refresh = useCallback(async () => {
    setHistory(await apiGet<AlertHistoryEntry[]>("/api/alerts"));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { history, refresh };
}
