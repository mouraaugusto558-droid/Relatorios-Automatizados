import { env } from "../../config/env";
import { getOtodataClient } from "../otodata";
import { syncDevicesToSupabase } from "../supabase/syncDevices";
import { syncDevicesToGoogleSheets } from "../googleSheets/syncDevices";

function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

function isGoogleSheetsConfigured(): boolean {
  return Boolean(env.googleSheetsSpreadsheetId && env.googleServiceAccountEmail && env.googleServiceAccountPrivateKey);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Busca os devices da Otodata uma única vez e grava nos dois destinos
 * configurados. Cada destino falha de forma independente (um Supabase fora do
 * ar não deve impedir a gravação na planilha, e vice-versa) — os erros são
 * agregados e só relançados no final, depois de tentar os dois. */
export async function runDataSync(): Promise<void> {
  if (!isSupabaseConfigured() && !isGoogleSheetsConfigured()) {
    throw new Error(
      "Nenhuma integração configurada: preencha SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY e/ou " +
        "GOOGLE_SHEETS_SPREADSHEET_ID/GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY no .env"
    );
  }

  const devices = await getOtodataClient().getDevices();
  if (!Array.isArray(devices)) {
    throw new Error("Resposta inesperada da API Otodata (esperava uma lista de dispositivos)");
  }

  const errors: string[] = [];

  if (isSupabaseConfigured()) {
    try {
      await syncDevicesToSupabase(devices);
    } catch (error) {
      errors.push(`Supabase: ${errorMessage(error)}`);
    }
  }

  if (isGoogleSheetsConfigured()) {
    try {
      await syncDevicesToGoogleSheets(devices);
    } catch (error) {
      errors.push(`Google Sheets: ${errorMessage(error)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" | "));
  }
}
