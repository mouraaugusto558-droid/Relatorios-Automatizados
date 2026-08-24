import { useEffect, useState } from "react";

export interface WhatsAppStatusPayload {
  status: "disconnected" | "connecting" | "qr" | "connected";
  phoneNumber: string | null;
  qrDataUrl: string | null;
  lastEventAt: string | null;
}

export function useWhatsAppStatus(): WhatsAppStatusPayload | null {
  const [status, setStatus] = useState<WhatsAppStatusPayload | null>(null);

  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
    const source = new EventSource(`${apiBaseUrl}/api/whatsapp/events`, { withCredentials: true });

    source.onmessage = (event) => {
      setStatus(JSON.parse(event.data) as WhatsAppStatusPayload);
    };

    return () => source.close();
  }, []);

  return status;
}
