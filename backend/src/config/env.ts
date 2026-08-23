import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function hasAppMarkers(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".env")) || fs.existsSync(path.join(dir, "storage"));
}

// Em produção o serviço Windows já inicia com cwd na raiz do app (AppDirectory
// configurado pelo NSSM em scripts/install-service.ps1), então process.cwd()
// aponta certo. Em dev local, "npm run dev --workspace backend" (e variantes
// como "cd backend && npm run dev") rodam com cwd dentro de backend/, onde não
// existem .env nem storage/ — nesse caso subimos um nível até a raiz do
// monorepo, que é onde esses arquivos realmente vivem.
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
  openaiApiKey: process.env.OPENAI_API_KEY,
  reportRecipientNumber: process.env.REPORT_RECIPIENT_NUMBER,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  googleSheetsSpreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  // No .env a chave privada vem com quebras de linha escapadas ("\n" literal),
  // já que um valor multilinha de verdade quebraria o parsing do dotenv.
  googleServiceAccountPrivateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n")
};
