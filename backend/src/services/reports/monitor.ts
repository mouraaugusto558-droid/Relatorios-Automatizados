import { getDatabase } from "../../database";
import {
  createSettingsRepository,
  REPORT_RECIPIENT_KEY,
  ALERT_RECIPIENT_KEY,
  ALERT_TRIGGER_CRITERIA_KEY
} from "../../database/repositories/settingsRepository";
import {
  createDeviceSnapshotsRepository,
  type DeviceSnapshot
} from "../../database/repositories/deviceSnapshotsRepository";
import { createAlertHistoryRepository } from "../../database/repositories/alertHistoryRepository";
import { createAlertCooldownsRepository } from "../../database/repositories/alertCooldownsRepository";
import { getOtodataClient, type OtodataDevice, type OtodataTankLevelLog } from "../otodata";
import { getWhatsAppManager } from "../whatsapp";
import { parseRecipient, buildRecipientJid } from "../whatsapp/recipient";
import { sanitizeAlertConfig, DEFAULT_ALERT_CONFIG } from "./alertConfig";
import { classifyTransitions, findHistoricalLevelMatches } from "./deviceTransitions";
import { buildAlertMessage, summarizeTransitions } from "./alertMessage";
import { getMonitoredDevices } from "./monitoredScope";

const ALERT_COOLDOWN_MS = 48 * 60 * 60 * 1000;

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
 * Checagem periódica (a cada 5 min, ver `jobs/definitions.ts`) que compara o
 * estado atual dos tanques monitorados contra o último snapshot conhecido e,
 * só se houver transição relevante pro critério de alerta configurado, manda
 * uma mensagem de texto (sem imagem) resumindo o que mudou. Mesmo escopo
 * (exclusão + filtro salvo) do relatório diário — ver `runDailyReport` em
 * `./index.ts`.
 */
export async function checkForCriticalUpdates(): Promise<void> {
  const database = getDatabase();
  const settingsRepository = createSettingsRepository(database);
  const snapshotsRepository = createDeviceSnapshotsRepository(database);
  const alertHistoryRepository = createAlertHistoryRepository(database);
  const alertCooldownsRepository = createAlertCooldownsRepository(database);

  const monitoredDevices = await getMonitoredDevices();

  const savedAlertConfigRaw = settingsRepository.get(ALERT_TRIGGER_CRITERIA_KEY);
  const alertConfig = savedAlertConfigRaw
    ? sanitizeAlertConfig(JSON.parse(savedAlertConfigRaw))
    : DEFAULT_ALERT_CONFIG;

  const previousSnapshots = snapshotsRepository.getAll();
  const historyStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const historyEnd = new Date().toISOString();
  const historicalLevels = new Map<number, OtodataTankLevelLog[]>();

  if (alertConfig.criteria.levelMin !== undefined || alertConfig.criteria.levelMax !== undefined) {
    const otodataClient = getOtodataClient();
    for (let pageIndex = 0; ; pageIndex += 1) {
      const page = await otodataClient.getTankLevels(historyStart, historyEnd, pageIndex);
      let readingCount = 0;
      for (const tank of page) {
        readingCount += tank.Logs.length;
        if (tank.Id !== undefined) {
          historicalLevels.set(tank.Id, tank.Logs);
          continue;
        }

        for (const log of tank.Logs) {
          const logs = historicalLevels.get(log.Id) ?? [];
          logs.push(log);
          historicalLevels.set(log.Id, logs);
        }
      }
      if (readingCount < 10_000) break;
    }
  }

  const currentDevices = monitoredDevices.map((device) => {
    const logs = historicalLevels.get(device.Id);
    const latest = logs?.filter((log) => log.Level !== null).sort((a, b) =>
      a.LogDateUtc.localeCompare(b.LogDateUtc)
    ).at(-1);
    return latest
      ? { ...device, LastLevel: latest.Level, LastRead: latest.LogDateUtc }
      : device;
  });
  const result = classifyTransitions(currentDevices, previousSnapshots, alertConfig);
  const historicalMatches =
    previousSnapshots.size === 0
      ? []
      : findHistoricalLevelMatches(currentDevices, historicalLevels, alertConfig);
  const enteredById = new Map(result.entered.map((device) => [device.Id, device]));
  for (const match of historicalMatches) {
    enteredById.set(match.device.Id, match.device);
  }

  const now = Date.now();
  const eligibleEntered = [...enteredById.values()].filter((device) => {
    const lastAlertAt = alertCooldownsRepository.getLastAlertAt(device.Id);
    if (!lastAlertAt) return true;
    const lastAlertTime = new Date(lastAlertAt).getTime();
    return !Number.isFinite(lastAlertTime) || now - lastAlertTime >= ALERT_COOLDOWN_MS;
  });
  const filteredResult = { ...result, entered: eligibleEntered };
  const hasUpdates =
    filteredResult.entered.length > 0 ||
    filteredResult.resolved.length > 0 ||
    filteredResult.filled.length > 0;
  if (!hasUpdates) {
    snapshotsRepository.upsertMany(currentDevices.map(toSnapshot));
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

  const message = buildAlertMessage(filteredResult);
  const jid = buildRecipientJid(recipient);
  await getWhatsAppManager().sendMessage(jid, message);

  alertHistoryRepository.create({
    summary: summarizeTransitions(filteredResult),
    enteredCount: filteredResult.entered.length,
    resolvedCount: filteredResult.resolved.length,
    filledCount: filteredResult.filled.length,
    message
  });
  alertCooldownsRepository.markAlertSent(eligibleEntered.map((device) => device.Id));

  // Só avança o snapshot depois do envio ter sucesso — se `sendMessage` lançar, o próximo
  // ciclo detecta a mesma transição de novo e tenta reenviar, em vez de perder o alerta.
  snapshotsRepository.upsertMany(currentDevices.map(toSnapshot));
}
