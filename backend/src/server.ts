import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import { env } from "./config/env";
import { loggerOptions } from "./utils/logger";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { whatsappRoutes } from "./routes/whatsapp";
import { jobsRoutes } from "./routes/jobs";
import { reportsRoutes } from "./routes/reports";
import { settingsRoutes } from "./routes/settings";
import { devicesRoutes } from "./routes/devices";
import { getWhatsAppManager } from "./services/whatsapp";
import { getScheduler } from "./jobs";
import { getAuthService, SESSION_COOKIE_NAME } from "./services/auth";

// Rotas de API que respondem sem cookie de sessão válido: healthcheck (usado
// por monitoramento externo) e o próprio fluxo de login/verificação de sessão
// (senão ninguém conseguiria logar).
const PUBLIC_API_PATHS = new Set(["/api/health", "/api/auth/login", "/api/auth/logout", "/api/auth/me"]);

async function main(): Promise<void> {
  const app = Fastify({ logger: loggerOptions });

  // Rede de segurança do processo: isto é um serviço de longa duração (scheduler +
  // WhatsApp) e não deve morrer por causa de uma rejeição/exceção que escapou de
  // algum ponto não previsto — preferimos logar e seguir vivo a perder a automação
  // do dia até alguém reiniciar manualmente.
  process.on("unhandledRejection", (reason) => {
    app.log.error(reason, "unhandledRejection não tratada");
  });
  process.on("uncaughtException", (error) => {
    app.log.error(error, "uncaughtException não tratada");
  });

  if (env.corsAllowedOrigin) {
    // Default do @fastify/cors é só "GET,HEAD,POST" — sem isso, qualquer rota
    // PUT/PATCH/DELETE cross-origin (Vercel -> EasyPanel) falha no preflight
    // com "Method X is not allowed by Access-Control-Allow-Methods".
    await app.register(fastifyCors, {
      origin: env.corsAllowedOrigin,
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]
    });
  }
  await app.register(fastifyCookie);

  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?")[0];
    if (!pathname.startsWith("/api") || PUBLIC_API_PATHS.has(pathname)) return;

    const token = request.cookies[SESSION_COOKIE_NAME];
    const valid = token ? getAuthService().verifySessionToken(token) : false;
    if (!valid) {
      await reply.code(401).send({ error: "unauthorized" });
    }
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(whatsappRoutes);
  await app.register(jobsRoutes);
  await app.register(reportsRoutes);
  await app.register(settingsRoutes);
  await app.register(devicesRoutes);

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

  getScheduler().start();
}

main();
