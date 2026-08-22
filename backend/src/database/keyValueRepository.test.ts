import { test } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryDatabase } from "./createInMemoryDatabase";
import { createKeyValueRepository } from "./keyValueRepository";

test("keyValueRepository: set/get roundtrip", () => {
  const db = createInMemoryDatabase();
  const repo = createKeyValueRepository(db, "settings");

  assert.equal(repo.get("theme"), undefined);

  repo.set("theme", "dark");
  assert.equal(repo.get("theme"), "dark");
});

test("keyValueRepository: set overwrites existing value", () => {
  const db = createInMemoryDatabase();
  const repo = createKeyValueRepository(db, "settings");

  repo.set("theme", "dark");
  repo.set("theme", "light");
  assert.equal(repo.get("theme"), "light");
});

test("keyValueRepository: getAll returns every key", () => {
  const db = createInMemoryDatabase();
  const repo = createKeyValueRepository(db, "application_state");

  repo.set("a", "1");
  repo.set("b", "2");

  assert.deepEqual(repo.getAll(), { a: "1", b: "2" });
});

test("keyValueRepository: delete removes the key", () => {
  const db = createInMemoryDatabase();
  const repo = createKeyValueRepository(db, "whatsapp_metadata");

  repo.set("connected_number", "5511999999999");
  repo.delete("connected_number");

  assert.equal(repo.get("connected_number"), undefined);
});

test("keyValueRepository: rejects unknown table names", () => {
  const db = createInMemoryDatabase();
  assert.throws(() => createKeyValueRepository(db, "drop table settings; --"));
});
