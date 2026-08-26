import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { getDatabase } from "../database";
import { createRepositories } from "../database/repositories";
import {
  REPORT_RECIPIENT_KEY,
  REPORT_FILTER_CRITERIA_KEY,
  ALERT_RECIPIENT_KEY
} from "../database/repositories/settingsRepository";
import { sanitizeCriteria, type DeviceFilterCriteria } from "../services/reports/deviceFilters";
import { parseRecipient, sanitizeRecipientInput } from "../services/whatsapp/recipient";

const envFallbackRecipient = env.reportRecipientNumber
  ? { type: "individual" as const, number: env.reportRecipientNumber }
  : null;

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  const { settings: settingsRepository } = createRepositories(getDatabase());

  app.get("/api/settings/report-recipient", async () => ({
    recipient: parseRecipient(settingsRepository.get(REPORT_RECIPIENT_KEY)) ?? envFallbackRecipient
  }));

  app.put<{ Body: unknown }>("/api/settings/report-recipient", async (request, reply) => {
    const recipient = sanitizeRecipientInput(request.body);
    if (!recipient) {
      return reply.code(400).send({ error: "invalid_recipient" });
    }

    settingsRepository.set(REPORT_RECIPIENT_KEY, JSON.stringify(recipient));
    return { recipient };
  });

  app.get("/api/settings/alert-recipient", async () => {
    const stored = settingsRepository.get(ALERT_RECIPIENT_KEY);
    const recipient =
      parseRecipient(stored) ?? parseRecipient(settingsRepository.get(REPORT_RECIPIENT_KEY)) ?? envFallbackRecipient;
    // `isFallback`: o destinatário de alertas nunca foi salvo — o que voltou aqui é só uma
    // sugestão (o mesmo do relatório diário), útil pra não começar de um campo vazio, mas
    // que só passa a valer de fato quando o usuário confirmar salvando.
    return { recipient, isFallback: !stored };
  });

  app.put<{ Body: unknown }>("/api/settings/alert-recipient", async (request, reply) => {
    const recipient = sanitizeRecipientInput(request.body);
    if (!recipient) {
      return reply.code(400).send({ error: "invalid_recipient" });
    }

    settingsRepository.set(ALERT_RECIPIENT_KEY, JSON.stringify(recipient));
    return { recipient, isFallback: false };
  });

  app.get("/api/settings/report-filter", async () => {
    const raw = settingsRepository.get(REPORT_FILTER_CRITERIA_KEY);
    return { criteria: raw ? (JSON.parse(raw) as DeviceFilterCriteria) : {} };
  });

  app.put<{ Body: DeviceFilterCriteria }>("/api/settings/report-filter", async (request) => {
    const criteria = sanitizeCriteria(request.body);
    settingsRepository.set(REPORT_FILTER_CRITERIA_KEY, JSON.stringify(criteria));
    return { criteria };
  });
}
