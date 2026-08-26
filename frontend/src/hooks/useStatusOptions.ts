import { useEffect, useState } from "react";
import { apiGet } from "../api/client";

export interface StatusOption {
  value: string;
  label: string;
  color: string;
}

/** Rótulos/cores de `STATUS_META` (backend), buscados uma vez — usados no
 * filtro por status e na coluna "Status" da aba de exclusão. */
export function useStatusOptions(): StatusOption[] {
  const [options, setOptions] = useState<StatusOption[]>([]);

  useEffect(() => {
    apiGet<StatusOption[]>("/api/devices/status-options")
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  return options;
}
