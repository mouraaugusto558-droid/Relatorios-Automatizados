import { getDatabase } from "../../database";
import { createSettingsRepository, REPORT_FILTER_CRITERIA_KEY } from "../../database/repositories/settingsRepository";
import { createExcludedDevicesRepository } from "../../database/repositories/excludedDevicesRepository";
import { createDeviceCatalogRepository } from "../../database/repositories/deviceCatalogRepository";
import { getOtodataClient } from "../otodata";
import type { OtodataDevice } from "../otodata";
import { filterDevices, sanitizeCriteria } from "./deviceFilters";

/**
 * Escopo geral compartilhado por tudo que lê tanques (relatório diário,
 * alertas de 5 em 5 min, resumo diário de nível alto/baixo): tira quem
 * foi excluído e aplica o filtro salvo do relatório das 08:00. Extraído
 * porque as três features tinham exatamente esse mesmo bloco duplicado.
 */
export async function getAllDevices(): Promise<OtodataDevice[]> {
  const database = getDatabase();

  let allDevices: OtodataDevice[];
  try {
    allDevices = await getOtodataClient().getDevices();
    if (!Array.isArray(allDevices)) {
      throw new Error("Resposta inesperada da API Otodata (esperava uma lista de dispositivos)");
    }
    createDeviceCatalogRepository(database).replace(allDevices);
  } catch (error) {
    const cached = createDeviceCatalogRepository(database).get();
    if (!cached) {
      throw new Error(
        `Não foi possível obter o cadastro de dispositivos Otodata e não há cache local disponível: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const cacheAgeMs = Date.now() - new Date(cached.savedAt).getTime();
    const maxCacheAgeMs = 48 * 60 * 60 * 1000;
    if (!Number.isFinite(cacheAgeMs) || cacheAgeMs > maxCacheAgeMs) {
      throw new Error(
        `O cadastro de dispositivos Otodata está indisponível e o cache local expirou (${cached.savedAt})`
      );
    }

    console.warn(
      `Otodata /devices indisponível; usando cadastro local de ${cached.savedAt}. Erro: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    allDevices = cached.devices;
  }

  return allDevices;
}

export async function getMonitoredDevices(): Promise<OtodataDevice[]> {
  const database = getDatabase();
  const allDevices = await getAllDevices();
  const excludedIds = createExcludedDevicesRepository(database).getExcludedIds();
  const activeDevices = allDevices.filter((device) => !excludedIds.has(device.Id));

  const settingsRepository = createSettingsRepository(database);
  const savedFilterRaw = settingsRepository.get(REPORT_FILTER_CRITERIA_KEY);
  const scopeCriteria = sanitizeCriteria(savedFilterRaw ? JSON.parse(savedFilterRaw) : {});
  return filterDevices(activeDevices, scopeCriteria);
}
