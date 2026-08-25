import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { getDatabase } from "../database";
import { createRepositories } from "../database/repositories";
import { REPORT_RECIPIENT_KEY } from "../database/repositories/settingsRepository";

interface UpdateRecipientBody {
  phoneNumber: string;
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  const { settings: settingsRepository } = createRepositories(getDatabase());

  app.get("/api/settings/report-recipient", async () => ({
    phoneNumber: settingsRepository.get(REPORT_RECIPIENT_KEY) ?? env.reportRecipientNumber ?? null
  }));

  app.put<{ Body: UpdateRecipientBody }>("/api/settings/report-recipient", async (request, reply) => {
    const digits = (request.body.phoneNumber ?? "").replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      return reply.code(400).send({ error: "invalid_phone_number" });
    }

    settingsRepository.set(REPORT_RECIPIENT_KEY, digits);
    return { phoneNumber: digits };
  });
}
