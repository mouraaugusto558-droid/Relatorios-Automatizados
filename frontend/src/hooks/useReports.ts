import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";

export interface Report {
  id: number;
  name: string;
  filePath: string;
  status: "pending" | "generated" | "sent" | "error";
  createdAt: string;
}

export function useReports(): { reports: Report[]; refresh: () => Promise<void> } {
  const [reports, setReports] = useState<Report[]>([]);

  const refresh = useCallback(async () => {
    setReports(await apiGet<Report[]>("/api/reports"));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { reports, refresh };
}
