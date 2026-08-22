import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { env } from "./config/env";
import { loggerOptions } from "./utils/logger";
import { healthRoutes } from "./routes/health";
import { whatsappRoutes } from "./routes/whatsapp";
import { getWhatsAppManager } from "./services/whatsapp";

async function main(): Promise<void> {
  const app = Fastify({ logger: loggerOptions });

  await app.register(healthRoutes);
  await app.register(whatsappRoutes);

  const frontendDist = path.resolve(__dirname, "..", "..", "frontend", "dist");
  if (fs.existsSync(frontendDist)) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      wildcard: false
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.raw.method === "GET" && !request.url.startsWith("/api")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "not_found" });
    });
  } else {
    app.log.warn(`frontend build not found at ${frontendDist} — run "npm run build --workspace frontend" first`);
  }

  try {
    await app.listen({ host: env.host, port: env.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  getWhatsAppManager()
    .connect()
    .catch((error) => app.log.error(error, "falha ao iniciar conexão com o WhatsApp"));
}

main();
