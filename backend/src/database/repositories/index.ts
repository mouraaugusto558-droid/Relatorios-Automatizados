import type { DatabaseSync } from "node:sqlite";
import { createJobsRepository, type JobsRepository } from "./jobsRepository";
import { createJobRunsRepository, type JobRunsRepository } from "./jobRunsRepository";
import { createReportsRepository, type ReportsRepository } from "./reportsRepository";
import { createSettingsRepository, type SettingsRepository } from "./settingsRepository";
import {
  createExcludedDevicesRepository,
  type ExcludedDevicesRepository
} from "./excludedDevicesRepository";
import {
  createDeviceSnapshotsRepository,
  type DeviceSnapshotsRepository
} from "./deviceSnapshotsRepository";
import { createAlertHistoryRepository, type AlertHistoryRepository } from "./alertHistoryRepository";
import { createAlertCooldownsRepository, type AlertCooldownsRepository } from "./alertCooldownsRepository";
import { createDeviceCatalogRepository, type DeviceCatalogRepository } from "./deviceCatalogRepository";

export interface Repositories {
  jobs: JobsRepository;
  jobRuns: JobRunsRepository;
  reports: ReportsRepository;
  settings: SettingsRepository;
  excludedDevices: ExcludedDevicesRepository;
  deviceSnapshots: DeviceSnapshotsRepository;
  alertHistory: AlertHistoryRepository;
  alertCooldowns: AlertCooldownsRepository;
  deviceCatalog: DeviceCatalogRepository;
}

/**
 * Ponto único de composição dos repositórios, para evitar que cada rota
 * repita `getDatabase()` + `createXRepository(database)` na própria função
 * de registro (mesmo padrão de composição já usado por `getScheduler()` /
 * `getWhatsAppManager()`).
 */
export function createRepositories(database: DatabaseSync): Repositories {
  return {
    jobs: createJobsRepository(database),
    jobRuns: createJobRunsRepository(database),
    reports: createReportsRepository(database),
    settings: createSettingsRepository(database),
    excludedDevices: createExcludedDevicesRepository(database),
    deviceSnapshots: createDeviceSnapshotsRepository(database),
    alertHistory: createAlertHistoryRepository(database),
    alertCooldowns: createAlertCooldownsRepository(database),
    deviceCatalog: createDeviceCatalogRepository(database)
  };
}
