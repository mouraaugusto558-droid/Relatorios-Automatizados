import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";

export interface WhatsAppGroup {
  id: string;
  name: string;
}

interface GroupsPayload {
  connected: boolean;
  groups: WhatsAppGroup[];
}

/** Grupos do WhatsApp que a sessão conectada participa — só disponível com
 * `status === "connected"` (ver `GET /api/whatsapp/groups`). Usado pelo
 * `RecipientPicker` pra deixar escolher um grupo em vez de colar um ID cru. */
export function useWhatsAppGroups(): {
  groups: WhatsAppGroup[];
  connected: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<GroupsPayload>("/api/whatsapp/groups");
      setGroups(data.groups);
      setConnected(data.connected);
    } catch {
      setGroups([]);
      setConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { groups, connected, isLoading, refresh };
}
