import { sanitizeCriteria, type DeviceFilterCriteria } from "./deviceFilters";

export interface AlertTriggerConfig {
  /** O que dentro do escopo monitorado é grave o suficiente pra virar alerta
   * (ex.: status "Nível alto" + nível ≥ 90) — mesmo formato do filtro do
   * relatório, mas guardado separado: "o que está no relatório" e "o que é
   * crítico o bastante pra interromper" são perguntas diferentes. */
  criteria: DeviceFilterCriteria;
  /** Avisar quando um tanque recebe um novo abastecimento (LastFill mudou). */
  notifyOnFill: boolean;
  /** Avisar quando um tanque que estava no critério de alerta deixa de estar. */
  notifyOnResolve: boolean;
}

/**
 * Sem configuração salva, já sai valendo o exemplo original do cliente
 * ("crítico alto + nível 90") — mesmo raciocínio de `DEFAULT_HIGH_CRITERIA`
 * em `dailySummary.ts`: como existe um valor claro e específico pedido por
 * ele, não faz sentido começar vazio e obrigar alguém a configurar antes de
 * funcionar. Continua editável a qualquer momento pela aba Alertas.
 */
export const DEFAULT_ALERT_CONFIG: AlertTriggerConfig = {
  criteria: { statuses: ["HIGH ALARM"], levelMin: 90 },
  notifyOnFill: false,
  notifyOnResolve: false
};

/** Usado só quando `sanitizeAlertConfig` recebe algo que não é um objeto —
 * um corpo de requisição realmente inválido não deve virar o preset do
 * cliente "por acidente", só um estado em branco (mesma lógica de
 * `sanitizeCriteria`, que devolve `{}` em vez de qualquer valor de negócio). */
const BLANK_ALERT_CONFIG: AlertTriggerConfig = { criteria: {}, notifyOnFill: false, notifyOnResolve: false };

export function sanitizeAlertConfig(input: unknown): AlertTriggerConfig {
  if (!input || typeof input !== "object") return BLANK_ALERT_CONFIG;
  const obj = input as Record<string, unknown>;

  return {
    criteria: sanitizeCriteria(obj.criteria),
    notifyOnFill: obj.notifyOnFill === true,
    notifyOnResolve: obj.notifyOnResolve === true
  };
}
