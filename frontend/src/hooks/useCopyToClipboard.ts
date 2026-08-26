import { useCallback, useRef, useState } from "react";
import { useToast } from "../context/ToastContext";

/**
 * Extraído do padrão de copiar já usado em `DashboardPanel.tsx`
 * (`navigator.clipboard.writeText` + ícone que vira `Check` por ~2.5s + toast).
 * `copiedId` identifica qual item copiado deve mostrar o feedback visual —
 * útil quando o mesmo botão de copiar aparece várias vezes numa lista.
 */
export function useCopyToClipboard(): {
  copiedId: string | null;
  copy: (id: string, text: string) => void;
} {
  const { success } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    (id: string, text: string) => {
      void navigator.clipboard.writeText(text);
      setCopiedId(id);
      success("Copiado!", "Valor copiado para a área de transferência.");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopiedId(null), 2500);
    },
    [success]
  );

  return { copiedId, copy };
}
