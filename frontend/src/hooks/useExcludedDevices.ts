import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "../api/client";

export interface ExcludedDevice {
  deviceId: number;
  name: string | null;
  city: string | null;
  excludedAt: string;
}

interface ExcludeResponse {
  excluded: number[];
  notFound: number[];
}

export function useExcludedDevices(): {
  excludedList: ExcludedDevice[];
  excludedIds: Set<number>;
  isLoading: boolean;
  refresh: () => Promise<void>;
  exclude: (deviceIds: number[]) => Promise<ExcludeResponse>;
  restore: (deviceId: number) => Promise<void>;
} {
  const [excludedList, setExcludedList] = useState<ExcludedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setExcludedList(await apiGet<ExcludedDevice[]>("/api/devices/excluded"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exclude = useCallback(
    async (deviceIds: number[]) => {
      const result = await apiPost<ExcludeResponse>("/api/devices/excluded", { deviceIds });
      await refresh();
      return result;
    },
    [refresh]
  );

  const restore = useCallback(
    async (deviceId: number) => {
      await apiDelete(`/api/devices/excluded/${deviceId}`);
      await refresh();
    },
    [refresh]
  );

  return {
    excludedList,
    excludedIds: new Set(excludedList.map((item) => item.deviceId)),
    isLoading,
    refresh,
    exclude,
    restore
  };
}
