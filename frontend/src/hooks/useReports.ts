import { useCallback, useEffect, useState } from "react";

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
    const response = await fetch("/api/reports");
    setReports((await response.json()) as Report[]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { reports, refresh };
}
