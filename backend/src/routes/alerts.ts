import type { FastifyInstance } from "fastify";
import { getDatabase } from "../database";
import { createRepositories } from "../database/repositories";
import { ALERT_TRIGGER_CRITERIA_KEY } from "../database/repositories/settingsRepository";
import { sanitizeAlertConfig, DEFAULT_ALERT_CONFIG } from "../services/reports/alertConfig";

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
}
