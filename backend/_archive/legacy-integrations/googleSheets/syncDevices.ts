import type { sheets_v4 } from "googleapis";
import { env } from "../../config/env";
import type { OtodataDevice } from "../otodata/client";
import { getGoogleSheetsClient } from "./client";
import { SNAPSHOT_HEADER, HISTORY_HEADER, buildSnapshotRows, buildHistorySummaryRow } from "./buildRows";

const SNAPSHOT_SHEET = "Snapshot Atual";
const HISTORY_SHEET = "Historico Diario";

export interface GoogleSheetsSyncResult {
  snapshotRows: number;
}

/** Cria as abas na planilha se ainda não existirem — evita exigir setup manual
 * além de compartilhar a planilha com a service account. */
async function ensureSheetsExist(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<void> {
  const { data } = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set((data.sheets ?? []).map((sheet) => sheet.properties?.title));

  const requests = [SNAPSHOT_SHEET, HISTORY_SHEET]
    .filter((title) => !existingTitles.has(title))
    .map((title) => ({ addSheet: { properties: { title } } }));

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}

async function ensureHistoryHeader(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<void> {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${HISTORY_SHEET}!A1:A1`
  });

  if (!data.values || data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${HISTORY_SHEET}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HISTORY_HEADER] }
    });
  }
}

export async function syncDevicesToGoogleSheets(devices: OtodataDevice[]): Promise<GoogleSheetsSyncResult> {
  if (!env.googleSheetsSpreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID não configurado");
  }

  const sheets = getGoogleSheetsClient();
  const spreadsheetId = env.googleSheetsSpreadsheetId;

  await ensureSheetsExist(sheets, spreadsheetId);
  await ensureHistoryHeader(sheets, spreadsheetId);

  const snapshotRows = [SNAPSHOT_HEADER, ...buildSnapshotRows(devices)];

  // Sobrescreve a aba de snapshot inteira a cada ciclo (não faz append) — ela
  // representa só o estado atual, então o tamanho fica fixo em vez de crescer
  // sem limite a cada sincronização.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SNAPSHOT_SHEET}!A:P` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SNAPSHOT_SHEET}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: snapshotRows }
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${HISTORY_SHEET}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [buildHistorySummaryRow(devices, new Date())] }
  });

  return { snapshotRows: snapshotRows.length - 1 };
}
