import type { OtodataDevice } from "../otodata";
import type { OtodataTankLevelLog } from "../otodata";
import type { DeviceSnapshot } from "../../database/repositories/deviceSnapshotsRepository";
import type { AlertTriggerConfig } from "./alertConfig";
import { filterDevices } from "./deviceFilters";

export interface TransitionResult {
  /** Tanques que passaram a bater o critério de alerta agora e não batiam antes — "caso novo". */
  entered: OtodataDevice[];
  /** Tanques que batiam o critério antes e deixaram de bater (só populado se `notifyOnResolve`). */
  resolved: OtodataDevice[];
  /** Tanques com um novo abastecimento detectado (`LastFill` mudou) — só populado se `notifyOnFill`. */
  filled: OtodataDevice[];
}

export interface HistoricalLevelMatch {
  device: OtodataDevice;
  log: OtodataTankLevelLog;
}

function matchesCriteria(device: OtodataDevice, config: AlertTriggerConfig): boolean {
  return filterDevices([device], config.criteria).length > 0;
}

/**
 * City/Region/Product/Name/TankName/TankNumber são estáticos por tanque — não faz sentido
 * guardá-los no snapshot, então reaproveitamos do device atual. Só Status/LastLevel/
 * BatteryAlarm mudam de um poll pro outro e são o que o snapshot guarda de fato.
 */
function asPreviousDevice(device: OtodataDevice, snapshot: DeviceSnapshot): OtodataDevice {
  return {
    ...device,
    Status: snapshot.status,
    LastLevel: snapshot.lastLevel,
    BatteryAlarm: snapshot.batteryAlarm
  };
}

/**
 * Compara o estado atual dos tanques (já filtrado pelo escopo monitorado —
 * exclusão + filtro salvo, aplicados por quem chama) contra o último
 * snapshot conhecido, e classifica só as transições relevantes pro critério
 * de alerta configurado. Função pura: sem I/O, fácil de testar isolada.
 */
export function classifyTransitions(
  devices: OtodataDevice[],
  previousSnapshots: Map<number, DeviceSnapshot>,
  config: AlertTriggerConfig
): TransitionResult {
  // Bootstrap: primeira checagem depois do recurso existir (tabela de snapshot vazia) — não
  // gera um alerta gigante com tudo que já estava crítico antes do monitoramento começar.
  if (previousSnapshots.size === 0) {
    return { entered: [], resolved: [], filled: [] };
  }

  const entered: OtodataDevice[] = [];
  const resolved: OtodataDevice[] = [];
  const filled: OtodataDevice[] = [];

  for (const device of devices) {
    const snapshot = previousSnapshots.get(device.Id);
    const matchesNow = matchesCriteria(device, config);
    const matchedBefore = snapshot
      ? matchesCriteria(asPreviousDevice(device, snapshot), config)
      : false;

    if (matchesNow && !matchedBefore) {
      entered.push(device);
    } else if (!matchesNow && matchedBefore && config.notifyOnResolve) {
      resolved.push(device);
    }

    if (
      config.notifyOnFill &&
      device.LastFill !== null &&
      device.LastFill !== (snapshot?.lastFill ?? null)
    ) {
      filled.push(device);
    }
  }

  return { entered, resolved, filled };
}

/**
 * Procura leituras históricas que atenderam a um limite de nível desde a
 * última checagem. Isso cobre o caso em que o tanque cruzou o limite e voltou
 * antes da próxima consulta de `devices`.
 */
export function findHistoricalLevelMatches(
  devices: OtodataDevice[],
  histories: Map<number, OtodataTankLevelLog[]>,
  config: AlertTriggerConfig
): HistoricalLevelMatch[] {
  if (config.criteria.levelMin === undefined && config.criteria.levelMax === undefined) return [];

  const matches: HistoricalLevelMatch[] = [];
  for (const device of devices) {
    const logs = histories.get(device.Id) ?? [];
    const matchingLog = logs
      .filter((log) => {
        if (log.Level === null) return false;
        return filterDevices([{ ...device, LastLevel: log.Level }], config.criteria).length > 0;
      })
      .sort((a, b) => new Date(b.LogDateUtc).getTime() - new Date(a.LogDateUtc).getTime())[0];

    if (matchingLog)
      matches.push({
        device: { ...device, LastLevel: matchingLog.Level, LastRead: matchingLog.LogDateUtc },
        log: matchingLog
      });
  }
  return matches;
}
