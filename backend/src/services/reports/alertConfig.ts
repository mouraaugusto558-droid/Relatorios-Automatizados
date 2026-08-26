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
 * Sem configuração salva, o monitoramento não manda nada — só popula o
 * snapshot. Evita alertar "tudo" antes do usuário decidir o que é crítico
 * pra ele.
 */
export const DEFAULT_ALERT_CONFIG: AlertTriggerConfig = {
  criteria: {},
  notifyOnFill: false,
  notifyOnResolve: false
};

export function sanitizeAlertConfig(input: unknown): AlertTriggerConfig {
  if (!input || typeof input !== "object") return DEFAULT_ALERT_CONFIG;
  const obj = input as Record<string, unknown>;

  return {
    criteria: sanitizeCriteria(obj.criteria),
    notifyOnFill: obj.notifyOnFill === true,
    notifyOnResolve: obj.notifyOnResolve === true
  };
}
