import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function hasAppMarkers(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".env")) || fs.existsSync(path.join(dir, "storage"));
}

// Em produção o container Docker já inicia com cwd na raiz do app (ver
// Dockerfile/WORKDIR), então process.cwd() aponta certo. Em dev local,
// "npm run dev --workspace backend" (e variantes como "cd backend && npm run
// dev") rodam com cwd dentro de backend/, onde não existem .env nem storage/
// — nesse caso subimos um nível até a raiz do monorepo, que é onde esses
// arquivos realmente vivem.
function detectAppRoot(): string {
  const cwd = process.cwd();
  if (hasAppMarkers(cwd)) return cwd;

  const parent = path.resolve(cwd, "..");
  if (hasAppMarkers(parent)) return parent;

  return cwd;
}

const appRoot = detectAppRoot();

dotenv.config({ path: path.join(appRoot, ".env") });

function resolveFromRoot(relativePath: string): string {
  return path.resolve(appRoot, relativePath);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  databasePath: resolveFromRoot(process.env.DATABASE_PATH ?? "./storage/database.sqlite"),
  whatsappAuthPath: resolveFromRoot(process.env.WHATSAPP_AUTH_PATH ?? "./storage/whatsapp/auth"),
  reportsPath: resolveFromRoot(process.env.REPORTS_PATH ?? "./storage/reports"),
  logLevel: process.env.LOG_LEVEL ?? "info",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  otodataApiKey: process.env.OTODATA_API_KEY,
  reportRecipientNumber: process.env.REPORT_RECIPIENT_NUMBER,
  authUsername: process.env.AUTH_USERNAME,
  authPasswordHash: process.env.AUTH_PASSWORD_HASH,
  authSessionSecret: process.env.AUTH_SESSION_SECRET,
  corsAllowedOrigin: process.env.CORS_ALLOWED_ORIGIN
};
