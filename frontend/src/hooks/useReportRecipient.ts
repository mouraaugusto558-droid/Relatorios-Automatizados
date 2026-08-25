import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client";

interface ReportRecipientPayload {
  phoneNumber: string | null;
}

export function useReportRecipient(): {
  phoneNumber: string | null;
  refresh: () => Promise<void>;
  update: (phoneNumber: string) => Promise<string>;
} {
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await apiGet<ReportRecipientPayload>("/api/settings/report-recipient");
    setPhoneNumber(data.phoneNumber);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(async (newPhoneNumber: string) => {
    const data = await apiPut<ReportRecipientPayload>("/api/settings/report-recipient", {
      phoneNumber: newPhoneNumber
    });
    setPhoneNumber(data.phoneNumber);
    return data.phoneNumber as string;
  }, []);

  return { phoneNumber, refresh, update };
}
