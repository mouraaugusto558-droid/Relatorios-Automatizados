import { useEffect } from "react";
import type { ReactNode } from "react";

interface ConfirmModalProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Ações destrutivas (padrão) usam `.btn-outline-danger`; caso contrário, `.btn-primary`. */
  danger?: boolean;
}

/**
 * Modal de confirmação genérico, reaproveitando o padrão visual de
 * `JobHistoryModal.tsx` (`.modal-overlay` / `.modal-content` / `.modal-header`
 * / `.modal-body` / `.modal-footer`, já existentes em index.css). Substitui
 * usos de `window.confirm` por algo consistente com o design system.
 */
export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  danger = true
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="modal-content modal-content-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
        </div>

        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn btn-sm ${danger ? "btn-outline-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
