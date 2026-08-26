import type { FastifyInstance } from "fastify";
import { getDatabase } from "../database";
import { createRepositories } from "../database/repositories";
import {
  ALERT_TRIGGER_CRITERIA_KEY,
  DAILY_SUMMARY_HIGH_CRITERIA_KEY,
  DAILY_SUMMARY_LOW_CRITERIA_KEY
} from "../database/repositories/settingsRepository";
import { sanitizeAlertConfig, DEFAULT_ALERT_CONFIG } from "../services/reports/alertConfig";
import { sanitizeCriteria } from "../services/reports/deviceFilters";
import { DEFAULT_HIGH_CRITERIA, DEFAULT_LOW_CRITERIA } from "../services/reports/dailySummary";

interface DailySummaryCriteriaBody {
  high: unknown;
  low: unknown;
}

export async function alertsRoutes(app: FastifyInstance): Promise<void> {
  const { settings: settingsRepository, alertHistory: alertHistoryRepository } = createRepositories(getDatabase());

  app.get("/api/alerts", async () => alertHistoryRepository.list());

  app.get("/api/settings/alert-criteria", async () => {
    const raw = settingsRepository.get(ALERT_TRIGGER_CRITERIA_KEY);
    return { config: raw ? sanitizeAlertConfig(JSON.parse(raw)) : DEFAULT_ALERT_CONFIG };
  });

  app.put<{ Body: unknown }>("/api/settings/alert-criteria", async (request) => {
    const config = sanitizeAlertConfig(request.body);
    settingsRepository.set(ALERT_TRIGGER_CRITERIA_KEY, JSON.stringify(config));
    return { config };
  });

  app.get("/api/settings/daily-summary-criteria", async () => {
    const highRaw = settingsRepository.get(DAILY_SUMMARY_HIGH_CRITERIA_KEY);
    const lowRaw = settingsRepository.get(DAILY_SUMMARY_LOW_CRITERIA_KEY);
    return {
      high: highRaw ? sanitizeCriteria(JSON.parse(highRaw)) : DEFAULT_HIGH_CRITERIA,
      low: lowRaw ? sanitizeCriteria(JSON.parse(lowRaw)) : DEFAULT_LOW_CRITERIA
    };
  });

  app.put<{ Body: DailySummaryCriteriaBody }>("/api/settings/daily-summary-criteria", async (request) => {
    const high = sanitizeCriteria(request.body.high);
    const low = sanitizeCriteria(request.body.low);
    settingsRepository.set(DAILY_SUMMARY_HIGH_CRITERIA_KEY, JSON.stringify(high));
    settingsRepository.set(DAILY_SUMMARY_LOW_CRITERIA_KEY, JSON.stringify(low));
    return { high, low };
  });
}
