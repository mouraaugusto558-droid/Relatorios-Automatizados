import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecipient, buildRecipientJid, sanitizeRecipientInput } from "./recipient";

test("parseRecipient: undefined returns null", () => {
  assert.equal(parseRecipient(undefined), null);
});

test("parseRecipient: legacy plain digit string becomes an individual recipient", () => {
  assert.deepEqual(parseRecipient("5591824465618"), { type: "individual", number: "5591824465618" });
});

test("parseRecipient: JSON individual recipient", () => {
  const raw = JSON.stringify({ type: "individual", number: "5591824465618" });
  assert.deepEqual(parseRecipient(raw), { type: "individual", number: "5591824465618" });
});

test("parseRecipient: JSON group recipient", () => {
  const raw = JSON.stringify({ type: "group", groupId: "123456789-987654321@g.us" });
  assert.deepEqual(parseRecipient(raw), { type: "group", groupId: "123456789-987654321@g.us" });
});

test("parseRecipient: malformed JSON-like object without a valid type falls back to individual with the raw string", () => {
  const raw = JSON.stringify({ type: "individual", number: 123 });
  assert.deepEqual(parseRecipient(raw), { type: "individual", number: raw });
});

test("buildRecipientJid: individual strips non-digits and appends the WhatsApp suffix", () => {
  assert.equal(buildRecipientJid({ type: "individual", number: "(55) 91824-465618" }), "5591824465618@s.whatsapp.net");
});

test("buildRecipientJid: group uses the stored JID as-is", () => {
  assert.equal(buildRecipientJid({ type: "group", groupId: "123456789-987654321@g.us" }), "123456789-987654321@g.us");
});

test("sanitizeRecipientInput: valid individual normalizes to digits only", () => {
  assert.deepEqual(sanitizeRecipientInput({ type: "individual", number: "(55) 91824-465618" }), {
    type: "individual",
    number: "5591824465618"
  });
});

test("sanitizeRecipientInput: individual with too few digits is rejected", () => {
  assert.equal(sanitizeRecipientInput({ type: "individual", number: "123" }), null);
});

test("sanitizeRecipientInput: valid group", () => {
  assert.deepEqual(sanitizeRecipientInput({ type: "group", groupId: "123456789-987654321@g.us" }), {
    type: "group",
    groupId: "123456789-987654321@g.us"
  });
});

test("sanitizeRecipientInput: group id without @g.us suffix is rejected", () => {
  assert.equal(sanitizeRecipientInput({ type: "group", groupId: "not-a-jid" }), null);
});

test("sanitizeRecipientInput: unknown type or non-object is rejected", () => {
  assert.equal(sanitizeRecipientInput({ type: "bogus" }), null);
  assert.equal(sanitizeRecipientInput(null), null);
  assert.equal(sanitizeRecipientInput("5591824465618"), null);
});
