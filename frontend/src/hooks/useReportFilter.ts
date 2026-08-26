import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client";
import type { DeviceFilterCriteria } from "./useSpreadsheet";

interface ReportFilterPayload {
  criteria: DeviceFilterCriteria;
}

/** Filtro persistido no banco que o job `relatorio-diario` (08:00) e o
 * "Rodar agora" realmente consultam — separado do filtro ad-hoc da tela da
 * Planilha, que só afeta o que é exibido na hora. */
export function useReportFilter(): {
  criteria: DeviceFilterCriteria;
  refresh: () => Promise<void>;
  save: (criteria: DeviceFilterCriteria) => Promise<DeviceFilterCriteria>;
} {
  const [criteria, setCriteria] = useState<DeviceFilterCriteria>({});

  const refresh = useCallback(async () => {
    const data = await apiGet<ReportFilterPayload>("/api/settings/report-filter");
    setCriteria(data.criteria);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (newCriteria: DeviceFilterCriteria) => {
    const data = await apiPut<ReportFilterPayload>("/api/settings/report-filter", newCriteria);
    setCriteria(data.criteria);
    return data.criteria;
  }, []);

  return { criteria, refresh, save };
}
