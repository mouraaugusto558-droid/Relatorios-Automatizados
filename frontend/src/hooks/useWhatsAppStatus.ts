import { useEffect, useState } from "react";

export interface WhatsAppStatusPayload {
  status: "disconnected" | "connecting" | "qr" | "connected";
  phoneNumber: string | null;
  qrDataUrl: string | null;
}

export function useWhatsAppStatus(): WhatsAppStatusPayload | null {
  const [status, setStatus] = useState<WhatsAppStatusPayload | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/whatsapp/events");

    source.onmessage = (event) => {
      setStatus(JSON.parse(event.data) as WhatsAppStatusPayload);
    };

    return () => source.close();
  }, []);

  return status;
}
