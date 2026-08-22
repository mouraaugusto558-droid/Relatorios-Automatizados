import type { DatabaseSync } from "node:sqlite";
import { createKeyValueRepository, type KeyValueRepository } from "../keyValueRepository";

export function createApplicationStateRepository(database: DatabaseSync): KeyValueRepository {
  return createKeyValueRepository(database, "application_state");
}
