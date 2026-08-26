import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../api/client";

export interface SpreadsheetColumn {
  header: string;
  width: number;
}

export interface SpreadsheetRow {
  cells: string[];
  color: string;
}

export interface SpreadsheetTable {
  title: string;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[];
  page: number;
  totalPages: number;
}

export interface DeviceFilterCriteria {
  statuses?: string[];
  levelMin?: number;
  levelMax?: number;
  cities?: string[];
  regions?: string[];
  products?: string[];
  search?: string;
  batteryAlarm?: boolean;
}

export interface SpreadsheetData {
  generatedAt: string;
  totalDevices: number;
  filteredDevices: number;
  alarms: SpreadsheetTable[];
  fills: SpreadsheetTable[];
}

function buildQueryString(criteria: DeviceFilterCriteria): string {
  const params = new URLSearchParams();
  if (criteria.statuses?.length) params.set("status", criteria.statuses.join(","));
  if (criteria.levelMin !== undefined) params.set("levelMin", String(criteria.levelMin));
  if (criteria.levelMax !== undefined) params.set("levelMax", String(criteria.levelMax));
  if (criteria.cities?.length) params.set("city", criteria.cities.join(","));
  if (criteria.regions?.length) params.set("region", criteria.regions.join(","));
  if (criteria.products?.length) params.set("product", criteria.products.join(","));
  if (criteria.search) params.set("search", criteria.search);
  if (criteria.batteryAlarm !== undefined) params.set("batteryAlarm", String(criteria.batteryAlarm));

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * `refresh` sem argumento reaplica o último filtro usado (útil pro botão
 * "Atualizar" recarregar os dados sem perder o filtro ativo).
 */
export function useSpreadsheet(): {
  data: SpreadsheetData | null;
  isLoading: boolean;
  refresh: (criteria?: DeviceFilterCriteria) => Promise<void>;
} {
  const [data, setData] = useState<SpreadsheetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastCriteriaRef = useRef<DeviceFilterCriteria>({});

  const refresh = useCallback(async (criteria?: DeviceFilterCriteria) => {
    if (criteria) lastCriteriaRef.current = criteria;
    setIsLoading(true);
    try {
      setData(await apiGet<SpreadsheetData>(`/api/reports/spreadsheet${buildQueryString(lastCriteriaRef.current)}`));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, refresh };
}
