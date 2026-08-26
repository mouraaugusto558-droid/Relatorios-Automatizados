import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client";
import type { DeviceFilterCriteria } from "./useSpreadsheet";

interface DailySummaryPayload {
  high: DeviceFilterCriteria;
  low: DeviceFilterCriteria;
}

const EMPTY: DailySummaryPayload = { high: {}, low: {} };

/** Critério das duas tabelas do resumo diário (08:00) — nível alto e
 * crítico baixo. Sem nunca ter sido salvo, a API já devolve os valores do
 * cliente (HIGH ALARM ≥90% / CRITICAL LOW ALARM ≤15%) como padrão. */
export function useDailySummaryCriteria(): {
  high: DeviceFilterCriteria;
  low: DeviceFilterCriteria;
  refresh: () => Promise<void>;
  save: (high: DeviceFilterCriteria, low: DeviceFilterCriteria) => Promise<DailySummaryPayload>;
} {
  const [state, setState] = useState<DailySummaryPayload>(EMPTY);

  const refresh = useCallback(async () => {
    setState(await apiGet<DailySummaryPayload>("/api/settings/daily-summary-criteria"));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (high: DeviceFilterCriteria, low: DeviceFilterCriteria) => {
    const data = await apiPut<DailySummaryPayload>("/api/settings/daily-summary-criteria", { high, low });
    setState(data);
    return data;
  }, []);

  return { high: state.high, low: state.low, refresh, save };
}
