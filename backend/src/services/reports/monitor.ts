import { getDatabase } from "../../database";
import { createSettingsRepository, REPORT_FILTER_CRITERIA_KEY, REPORT_RECIPIENT_KEY, ALERT_RECIPIENT_KEY, ALERT_TRIGGER_CRITERIA_KEY } from "../../database/repositories/settingsRepository";
import { createExcludedDevicesRepository } from "../../database/repositories/excludedDevicesRepository";
import { createDeviceSnapshotsRepository, type DeviceSnapshot } from "../../database/repositories/deviceSnapshotsRepository";
import { createAlertHistoryRepository } from "../../database/repositories/alertHistoryRepository";
import { getOtodataClient } from "../otodata";
import type { OtodataDevice } from "../otodata";
import { getWhatsAppManager } from "../whatsapp";
import { parseRecipient, buildRecipientJid } from "../whatsapp/recipient";
import { filterDevices, sanitizeCriteria } from "./deviceFilters";
import { sanitizeAlertConfig, DEFAULT_ALERT_CONFIG } from "./alertConfig";
import { classifyTransitions } from "./deviceTransitions";
import { buildAlertMessage, summarizeTransitions } from "./alertMessage";

function toSnapshot(device: OtodataDevice): DeviceSnapshot {
  return {
    deviceId: device.Id,
    status: device.Status,
    lastFill: device.LastFill,
    lastLevel: device.LastLevel,
    batteryAlarm: device.BatteryAlarm
  };
}

/**
 * Checagem periódica (a cada 10 min, ver `jobs/definitions.ts`) que compara o
 * estado atual dos tanques monitorados contra o último snapshot conhecido e,
 * só se houver transição relevante pro critério de alerta configurado, manda
 * uma mensagem de texto (sem imagem) resumindo o que mudou. Mesmo escopo
 * (exclusão + filtro salvo) do relatório diário — ver `runDailyReport` em
 * `./index.ts`.
 */
export async function checkForCriticalUpdates(): Promise<void> {
  const database = getDatabase();
  const settingsRepository = createSettingsRepository(database);
  const excludedDevicesRepository = createExcludedDevicesRepository(database);
  const snapshotsRepository = createDeviceSnapshotsRepository(database);
  const alertHistoryRepository = createAlertHistoryRepository(database);

  const allDevices = await getOtodataClient().getDevices();
  if (!Array.isArray(allDevices)) {
    throw new Error("Resposta inesperada da API Otodata (esperava uma lista de dispositivos)");
  }

  const excludedIds = excludedDevicesRepository.getExcludedIds();
  const activeDevices = allDevices.filter((device) => !excludedIds.has(device.Id));

  const savedFilterRaw = settingsRepository.get(REPORT_FILTER_CRITERIA_KEY);
  const scopeCriteria = sanitizeCriteria(savedFilterRaw ? JSON.parse(savedFilterRaw) : {});
  const monitoredDevices = filterDevices(activeDevices, scopeCriteria);

  const savedAlertConfigRaw = settingsRepository.get(ALERT_TRIGGER_CRITERIA_KEY);
  const alertConfig = savedAlertConfigRaw ? sanitizeAlertConfig(JSON.parse(savedAlertConfigRaw)) : DEFAULT_ALERT_CONFIG;

  const previousSnapshots = snapshotsRepository.getAll();
  const result = classifyTransitions(monitoredDevices, previousSnapshots, alertConfig);

  const hasUpdates = result.entered.length > 0 || result.resolved.length > 0 || result.filled.length > 0;
  if (!hasUpdates) {
    snapshotsRepository.upsertMany(monitoredDevices.map(toSnapshot));
    return;
  }

  const recipient =
    parseRecipient(settingsRepository.get(ALERT_RECIPIENT_KEY)) ??
    parseRecipient(settingsRepository.get(REPORT_RECIPIENT_KEY));
  if (!recipient) {
    // Mesmo tratamento de `runDailyReport`: lança em vez de só logar, pra aparecer como
    // "erro" no histórico do job na aba Jobs — senão o usuário nunca ficaria sabendo que
    // há atualizações prontas sem destinatário configurado pra recebê-las.
    throw new Error("Há atualizações críticas, mas nenhum destinatário de alerta configurado");
  }

  const message = buildAlertMessage(result);
  const jid = buildRecipientJid(recipient);
  await getWhatsAppManager().sendMessage(jid, message);

  alertHistoryRepository.create({
    summary: summarizeTransitions(result),
    enteredCount: result.entered.length,
    resolvedCount: result.resolved.length,
    filledCount: result.filled.length,
    message
  });

  // Só avança o snapshot depois do envio ter sucesso — se `sendMessage` lançar, o próximo
  // ciclo detecta a mesma transição de novo e tenta reenviar, em vez de perder o alerta.
  snapshotsRepository.upsertMany(monitoredDevices.map(toSnapshot));
}
