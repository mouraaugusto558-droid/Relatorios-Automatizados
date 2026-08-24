import { useCallback, useEffect, useState } from "react";
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

export interface SpreadsheetData {
  generatedAt: string;
  alarms: SpreadsheetTable[];
  fills: SpreadsheetTable[];
}

export function useSpreadsheet(): {
  data: SpreadsheetData | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<SpreadsheetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await apiGet<SpreadsheetData>("/api/reports/spreadsheet"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, isLoading, refresh };
}
