import { useState } from "react";
import { useToast } from "../context/ToastContext";

interface ToastMessage {
  title: string;
  message?: string;
}

interface UseApiActionMessages<Args extends unknown[], T> {
  /** Toast "info" disparado imediatamente antes da ação começar (opcional). */
  pending?: (...args: Args) => ToastMessage;
  /** Toast "success" disparado quando a ação resolve com sucesso (opcional). */
  success?: (result: T, ...args: Args) => ToastMessage;
  /** Toast "error" disparado quando a ação lança um erro (opcional). */
  error?: (error: unknown, ...args: Args) => ToastMessage;
}

export interface UseApiActionResult<Args extends unknown[], T> {
  run: (...args: Args) => Promise<T | undefined>;
  isPending: boolean;
}

/**
 * Generaliza o padrão repetido em vários handlers de ação do frontend:
 * setPending(true) -> await ação -> toast de sucesso/erro -> setPending(false).
 * A ação em si (fetch/apiPost/apiGet + qualquer refresh subsequente) é
 * passada pelo chamador; este hook só cuida do estado de pending e dos toasts.
 */
export function useApiAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<T>,
  messages: UseApiActionMessages<Args, T> = {}
): UseApiActionResult<Args, T> {
  const { success, error: showError, info } = useToast();
  const [isPending, setIsPending] = useState(false);

  const run = async (...args: Args): Promise<T | undefined> => {
    setIsPending(true);
    if (messages.pending) {
      const toast = messages.pending(...args);
      info(toast.title, toast.message);
    }

    try {
      const result = await action(...args);
      if (messages.success) {
        const toast = messages.success(result, ...args);
        success(toast.title, toast.message);
      }
      return result;
    } catch (err) {
      if (messages.error) {
        const toast = messages.error(err, ...args);
        showError(toast.title, toast.message);
      }
      return undefined;
    } finally {
      setIsPending(false);
    }
  };

  return { run, isPending };
}
