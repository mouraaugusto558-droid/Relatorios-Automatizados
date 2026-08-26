import { getDatabase } from "../../database";
import { createSettingsRepository, REPORT_FILTER_CRITERIA_KEY } from "../../database/repositories/settingsRepository";
import { createExcludedDevicesRepository } from "../../database/repositories/excludedDevicesRepository";
import { getOtodataClient } from "../otodata";
import type { OtodataDevice } from "../otodata";
import { filterDevices, sanitizeCriteria } from "./deviceFilters";

/**
 * Escopo geral compartilhado por tudo que lê tanques (relatório diário,
 * alertas de 10 em 10 min, resumo diário de nível alto/baixo): tira quem
 * foi excluído e aplica o filtro salvo do relatório das 08:00. Extraído
 * porque as três features tinham exatamente esse mesmo bloco duplicado.
 */
export async function getMonitoredDevices(): Promise<OtodataDevice[]> {
  const database = getDatabase();

  const allDevices = await getOtodataClient().getDevices();
  if (!Array.isArray(allDevices)) {
    throw new Error("Resposta inesperada da API Otodata (esperava uma lista de dispositivos)");
  }

  const excludedIds = createExcludedDevicesRepository(database).getExcludedIds();
  const activeDevices = allDevices.filter((device) => !excludedIds.has(device.Id));

  const settingsRepository = createSettingsRepository(database);
  const savedFilterRaw = settingsRepository.get(REPORT_FILTER_CRITERIA_KEY);
  const scopeCriteria = sanitizeCriteria(savedFilterRaw ? JSON.parse(savedFilterRaw) : {});
  return filterDevices(activeDevices, scopeCriteria);
}
