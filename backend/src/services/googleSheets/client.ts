import { google, type sheets_v4 } from "googleapis";
import { env } from "../../config/env";

let client: sheets_v4.Sheets | null = null;

export function getGoogleSheetsClient(): sheets_v4.Sheets {
  if (!client) {
    if (!env.googleServiceAccountEmail || !env.googleServiceAccountPrivateKey) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY não configurados");
    }
    const auth = new google.auth.JWT({
      email: env.googleServiceAccountEmail,
      key: env.googleServiceAccountPrivateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    client = google.sheets({ version: "v4", auth });
  }
  return client;
}
