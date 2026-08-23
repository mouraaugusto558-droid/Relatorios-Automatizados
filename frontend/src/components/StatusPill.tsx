import type { ReactNode } from "react";

export type StatusPillTone = "success" | "warning" | "error" | "info" | "neutral";

interface StatusPillProps {
  /** Tom visual do pill, mapeia direto para as classes .pill-* já existentes em index.css. */
  tone: StatusPillTone;
  /** Ícone (ex. um ícone lucide-react) exibido antes do texto. Ignorado se `dot` for true. */
  icon?: ReactNode;
  /** Usa a bolinha `.status-dot` (em vez de um ícone) como indicador, padrão já usado em vários pills de status "ao vivo". */
  dot?: boolean;
  /** Aplica a animação de pulso (`.status-dot-pulse`) na bolinha. Só tem efeito com `dot`. */
  pulse?: boolean;
  title?: string;
  children: ReactNode;
}

/**
 * Componente único para os badges de status ("pills") do painel.
 * Consolida as 3 formas que existiam antes (componente dedicado em
 * ReportsPanel, função local em Navbar, ternários inline em JobsPanel e
 * DashboardPanel) numa única API, reaproveitando as classes `.pill`,
 * `.pill-*` e `.status-dot` já existentes em `index.css`.
 */
export function StatusPill({ tone, icon, dot, pulse, title, children }: StatusPillProps) {
  return (
    <span className={`pill pill-${tone}`} title={title}>
      {dot ? <span className={`status-dot${pulse ? " status-dot-pulse" : ""}`} /> : icon}
      {children}
    </span>
  );
}
