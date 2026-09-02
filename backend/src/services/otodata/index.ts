import { env } from "../../config/env";
import { createOtodataClient, type OtodataClient } from "./client";

let client: OtodataClient | null = null;

export function getOtodataClient(): OtodataClient {
  if (!client) {
    if (!env.otodataApiKey) {
      throw new Error("OTODATA_API_KEY não configurada");
    }
    client = createOtodataClient(env.otodataApiKey);
  }
  return client;
}

export type {
  OtodataClient,
  OtodataDevice,
  OtodataTankLevelLog,
  OtodataTankLevels
} from "./client";
