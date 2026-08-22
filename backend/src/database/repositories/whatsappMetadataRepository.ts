import type { DatabaseSync } from "node:sqlite";
import { createKeyValueRepository, type KeyValueRepository } from "../keyValueRepository";

export function createWhatsappMetadataRepository(database: DatabaseSync): KeyValueRepository {
  return createKeyValueRepository(database, "whatsapp_metadata");
}
