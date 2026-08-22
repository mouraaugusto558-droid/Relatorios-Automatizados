import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "./index";

export function createInMemoryDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  runMigrations(database);
  return database;
}
