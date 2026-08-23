import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";

export interface JobRun {
  id: number;
  jobId: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "error";
  error: string | null;
  durationMs: number | null;
}

export interface Job {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  isRunning: boolean;
  lastRun: JobRun | null;
  nextRun: string | null;
}

const POLL_INTERVAL_MS = 5000;

export function useJobs(): { jobs: Job[]; refresh: () => Promise<void> } {
  const [jobs, setJobs] = useState<Job[]>([]);

  const refresh = useCallback(async () => {
    setJobs(await apiGet<Job[]>("/api/jobs"));
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { jobs, refresh };
}
