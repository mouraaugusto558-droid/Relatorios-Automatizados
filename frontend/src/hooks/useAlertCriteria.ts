import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client";
import type { DeviceFilterCriteria } from "./useSpreadsheet";

export interface AlertTriggerConfig {
  criteria: DeviceFilterCriteria;
  notifyOnFill: boolean;
  notifyOnResolve: boolean;
}

const EMPTY_CONFIG: AlertTriggerConfig = { criteria: {}, notifyOnFill: false, notifyOnResolve: false };

interface AlertCriteriaPayload {
  config: AlertTriggerConfig;
}

/** O que dentro do escopo monitorado (mesma exclusão + filtro salvo do
 * relatório diário) é grave o suficiente pra virar um alerta a cada checagem
 * de 10 min — configuração separada do filtro do relatório. */
export function useAlertCriteria(): {
  config: AlertTriggerConfig;
  refresh: () => Promise<void>;
  save: (config: AlertTriggerConfig) => Promise<AlertTriggerConfig>;
} {
  const [config, setConfig] = useState<AlertTriggerConfig>(EMPTY_CONFIG);

  const refresh = useCallback(async () => {
    const data = await apiGet<AlertCriteriaPayload>("/api/settings/alert-criteria");
    setConfig(data.config);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (newConfig: AlertTriggerConfig) => {
    const data = await apiPut<AlertCriteriaPayload>("/api/settings/alert-criteria", newConfig);
    setConfig(data.config);
    return data.config;
  }, []);

  return { config, refresh, save };
}
