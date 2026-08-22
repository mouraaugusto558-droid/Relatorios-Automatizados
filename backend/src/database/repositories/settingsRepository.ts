import type { DatabaseSync } from "node:sqlite";
import { createKeyValueRepository, type KeyValueRepository } from "../keyValueRepository";

export function createSettingsRepository(database: DatabaseSync): KeyValueRepository {
  return createKeyValueRepository(database, "settings");
}
