import { Copy, Check } from "lucide-react";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";

interface CopyButtonProps {
  id: string;
  value: string;
  label: string;
}

export function CopyButton({ id, value, label }: CopyButtonProps) {
  const { copiedId, copy } = useCopyToClipboard();
  const copied = copiedId === id;

  return (
    <button
      className="btn-icon btn-icon-sm"
      onClick={() => copy(id, value)}
      title={label}
      aria-label={label}
      type="button"
    >
      {copied ? <Check size={13} color="var(--brand-primary)" /> : <Copy size={13} />}
    </button>
  );
}
