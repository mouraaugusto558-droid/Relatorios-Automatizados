import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client";

export type Recipient = { type: "individual"; number: string } | { type: "group"; groupId: string };

interface RecipientPayload {
  recipient: Recipient | null;
  isFallback?: boolean;
}

/** `report-recipient` e `alert-recipient` têm o mesmo formato de payload —
 * um hook genérico evita duplicar fetch/save pros dois destinatários. */
export function useRecipient(endpoint: "report-recipient" | "alert-recipient"): {
  recipient: Recipient | null;
  isFallback: boolean;
  refresh: () => Promise<void>;
  save: (recipient: Recipient) => Promise<Recipient>;
} {
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const refresh = useCallback(async () => {
    const data = await apiGet<RecipientPayload>(`/api/settings/${endpoint}`);
    setRecipient(data.recipient);
    setIsFallback(data.isFallback ?? false);
  }, [endpoint]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (next: Recipient) => {
      const data = await apiPut<RecipientPayload>(`/api/settings/${endpoint}`, next);
      setRecipient(data.recipient);
      setIsFallback(data.isFallback ?? false);
      return data.recipient as Recipient;
    },
    [endpoint]
  );

  return { recipient, isFallback, refresh, save };
}
