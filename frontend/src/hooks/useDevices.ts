import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";

export interface Device {
  Id: number;
  Name: string | null;
  City: string | null;
  Region: string | null;
  Product: string | null;
  Status: string;
  LastLevel: number | null;
  BatteryAlarm: boolean;
}

/** Lista crua de todos os dispositivos da Otodata (sem filtro/exclusão aplicado) —
 * usada pela aba de exclusão e como fonte das opções do filtro (cidades/regiões/produtos). */
export function useDevices(): {
  devices: Device[];
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setDevices(await apiGet<Device[]>("/api/devices"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { devices, isLoading, refresh };
}
