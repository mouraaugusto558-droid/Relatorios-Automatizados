import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToast, type ToastType } from "../context/ToastContext";

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return <CheckCircle2 size={20} color="var(--brand-primary)" />;
    case "error":
      return <AlertCircle size={20} color="var(--accent-rose)" />;
    case "warning":
      return <AlertTriangle size={20} color="var(--accent-amber)" />;
    case "info":
    default:
      return <Info size={20} color="var(--accent-blue)" />;
  }
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
          <ToastIcon type={toast.type} />
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            {toast.message && <div className="toast-message">{toast.message}</div>}
          </div>
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
            title="Fechar notificação"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
