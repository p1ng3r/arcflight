import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function importCleanupModule() {
  const source = await readFile(new URL("../scripts/helpers/legacy-document-cleanup.js", import.meta.url), "utf8");
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
}

function makeCollection(sources, database = null) {
  const map = new Map(sources.map((source) => [source._id, source]));
  return {
    _source: map,
    invalidDocumentIds: new Set(sources.map((source) => source._id)),
    database,
    getInvalid(id) {
      return map.get(id);
    },
    get(id) {
      return map.get(id);
    },
    values() {
      return [];
    }
  };
}

const calls = [];
const database = {
  async delete(target, operation) {
    calls.push({ target, operation });
    if (!Array.isArray(operation) || operation.some((id) => typeof id !== "string")) {
      throw new Error("DatabaseBackend#delete operation must be an array of strings");
    }
    return operation;
  }
};

class MockActor {}
class MockItem {}

globalThis.CONFIG = {
  Actor: { documentClass: MockActor },
  Item: { documentClass: MockItem }
};
globalThis.game = {
  user: { id: "user-id" },
  actors: makeCollection([
    { _id: "legacy-actor", name: "Legacy Ship", type: "arcflight.ship" },
    { _id: "valid-actor", name: "Valid Ship", type: "vehicle" }
  ], database),
  items: makeCollection([
    { _id: "legacy-item", name: "Legacy Hull", type: "arcflight.hull" },
    { _id: "valid-item", name: "Valid Hull", type: "equipment" }
  ], database),
  collections: new Map()
};

const { cleanupInvalidLegacyArcflightDocuments, findInvalidLegacyArcflightDocuments } = await importCleanupModule();

assert.equal(typeof findInvalidLegacyArcflightDocuments, "function");
assert.equal(typeof cleanupInvalidLegacyArcflightDocuments, "function");

const found = findInvalidLegacyArcflightDocuments();
assert.deepEqual(found.actors.map((document) => document.id), ["legacy-actor"]);
assert.deepEqual(found.items.map((document) => document.id), ["legacy-item"]);

const dryRun = await cleanupInvalidLegacyArcflightDocuments({ dryRun: true });
assert.equal(dryRun.dryRun, true);
assert.equal(dryRun.deleted.length, 0);
assert.equal(dryRun.deletionAttempts.length, 0);
assert.equal(calls.length, 0);

const cleanup = await cleanupInvalidLegacyArcflightDocuments({ dryRun: false });
assert.equal(cleanup.dryRun, false);
assert.equal(cleanup.deleted.length, 2);
assert.equal(cleanup.skipped.length, 0);
assert.equal(cleanup.deletionAttempts.every((attempt) => attempt.operationShape === "array<string>"), true);
assert.deepEqual(calls.map((call) => call.operation), [["legacy-actor"], ["legacy-item"]]);
assert.equal(calls.every((call) => Array.isArray(call.operation) && call.operation.every((id) => typeof id === "string")), true);

console.log("legacy-document-cleanup tests passed");
