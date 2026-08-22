import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

function resolveFromRoot(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  databasePath: resolveFromRoot(process.env.DATABASE_PATH ?? "./storage/database.sqlite"),
  whatsappAuthPath: resolveFromRoot(process.env.WHATSAPP_AUTH_PATH ?? "./storage/whatsapp/auth"),
  logLevel: process.env.LOG_LEVEL ?? "info",
  isProduction: (process.env.NODE_ENV ?? "development") === "production"
};
