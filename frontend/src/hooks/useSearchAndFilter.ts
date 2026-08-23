import { useMemo } from "react";

interface UseSearchAndFilterOptions<T, F> {
  /** Termo de busca livre; a checagem é case-insensitive por "includes". */
  searchTerm: string;
  /** Campos de T (valores string) verificados pela busca livre. */
  searchFields: readonly (keyof T)[];
  /** Valor do filtro por status atualmente selecionado. */
  filterStatus: F;
  /**
   * Regra de negócio que decide se um item passa no filtro de status
   * selecionado. Fica explícita no caller (não escondida dentro do hook)
   * porque a regra de "o que cada status de filtro significa" é diferente
   * em cada tela (ex.: jobs "ativos" vs. relatórios "enviados").
   */
  matchesFilter: (item: T, filterStatus: F) => boolean;
}

/**
 * Extrai a duplicação de busca-por-texto + filtro-por-status que existia,
 * quase idêntica, em `JobsPanel` e `ReportsPanel`. Só a mecânica (percorrer
 * os campos de busca, aplicar o filtro) é compartilhada — a regra de negócio
 * de cada filtro continua explícita e visível no componente que a usa,
 * via `matchesFilter`.
 */
export function useSearchAndFilter<T, F>(
  items: T[],
  { searchTerm, searchFields, filterStatus, matchesFilter }: UseSearchAndFilterOptions<T, F>
): T[] {
  return useMemo(() => {
    const term = searchTerm.toLowerCase();

    return items.filter((item) => {
      const matchesSearch = searchFields.some((field) => {
        const value = item[field];
        return typeof value === "string" && value.toLowerCase().includes(term);
      });

      if (!matchesSearch) return false;

      return matchesFilter(item, filterStatus);
    });
  }, [items, searchTerm, searchFields, filterStatus, matchesFilter]);
}
