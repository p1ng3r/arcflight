import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterPendingCheckPreparation, validateVoyageEncounterPendingChecks } from "../../../scripts/voyage/domain/pending-checks.js";
function state() { const value = createVoyageEncounterState({ encounterId: "event", definitionId: "definition", primaryShip: { id: "ship" } }); value.lifecycleState = "active"; value.currentStage = { stageId: "stage" }; value.roundNumber = 1; value.phase = "resolution"; value.availableStations = [{ stationId: "captain", actions: [{ actionId: "check", check: { source: { kind: "character" }, statisticOptions: ["diplomacy"], dcSource: { kind: "fixed", value: 20 }, secrecy: "public" } }] }]; value.selections = { captain: { stationId: "captain", actionId: "check" } }; return value; }
function withCustomArrayPrototype(array, prototype, callback) { const previous = Object.getPrototypeOf(array); Object.setPrototypeOf(array, prototype); try { return callback(); } finally { Object.setPrototypeOf(array, previous); } }
function requestShape(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const children = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (Object.hasOwn(descriptors[key], "value") && descriptors[key].value && typeof descriptors[key].value === "object") children[key] = requestShape(descriptors[key].value, seen);
  }
  return { descriptors, children };
}

function assertFailedPreparation(value, request, result, before, requestBefore) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.deepEqual(value, before);
  assert.deepEqual(requestShape(request), requestBefore);
  assert.equal(value.revision, before.revision);
  assert.deepEqual(value.pendingChecks, before.pendingChecks);
  assert.deepEqual(value.snapshots, before.snapshots);
}

test("atomically prepares matching pending checks", () => { const value = state(), before = structuredClone(value); assert.equal(validateVoyageEncounterPendingChecks(value).valid, true); const result = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds: [{ sequence: 0, pendingCheckId: "pending-1" }] }); assert.equal(result.ok, true); assert.equal(result.nextState.revision, 1); assert.equal(result.nextState.pendingChecks[0].pendingCheckId, "pending-1"); assert.equal(validateVoyageEncounterPendingChecks(result.nextState).valid, true); assert.equal(result.events[0].type, "voyage.pending-checks-prepared"); assert.deepEqual(value, before); });
test("rejects unsafe and incomplete mappings without mutation", () => { const value = state(), before = structuredClone(value), request = { pendingCheckIds: [{ sequence: 0, pendingCheckId: "__proto__" }] }, requestBefore = requestShape(request); const result = applyVoyageEncounterPendingCheckPreparation(value, request); assertFailedPreparation(value, request, result, before, requestBefore); });

test("accepts valid empty pre-preparation state and rejects blank mapping IDs atomically", () => {
  for (const pendingCheckId of ["", " ", "\t", "\n"]) {
    const value = state(), before = structuredClone(value), request = { pendingCheckIds: [{ sequence: 0, pendingCheckId }] };
    const requestBefore = requestShape(request);
    assert.equal(validateVoyageEncounterPendingChecks(value).valid, true);
    const result = applyVoyageEncounterPendingCheckPreparation(value, request);
    assertFailedPreparation(value, request, result, before, requestBefore);
  }
});

test("pending validation rejects unexpected own persisted fields", () => {
  const value = state(); const prepared = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds: [{ sequence: 0, pendingCheckId: "check-1" }] }).nextState;
  prepared.pendingChecks[0].extra = true;
  assert.ok(validateVoyageEncounterPendingChecks(prepared).errors.some((entry) => entry.code === "unexpected-pending-check-field"));
});

test("preparation stores mappings in execution order and exact pending keys", () => {
  const value = state(); value.availableStations.push({ stationId: "navigator", actions: [{ actionId: "second", resolutionPriority: -1, check: { source: { kind: "ship" }, statisticOptions: ["perception"], dcSource: { kind: "fixed", value: 0 }, secrecy: "secret" } }] }); value.selections.navigator = { stationId: "navigator", actionId: "second" };
  const result = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds: [{ sequence: 1, pendingCheckId: "first" }, { sequence: 0, pendingCheckId: "second" }] });
  assert.equal(result.ok, true); assert.deepEqual(result.nextState.pendingChecks.map((entry) => entry.sequence), [0, 1]);
  assert.deepEqual(Object.keys(result.nextState.pendingChecks[0]).sort(), ["actionId", "dcSource", "metadata", "mode", "pendingCheckId", "preparedRevision", "resolutionPriority", "result", "riskBidId", "roundNumber", "secrecy", "sequence", "source", "stageId", "stationId", "statisticOptions", "status", "target"].sort());
});

test("pending validator rejects persisted contract mismatches", () => {
  for (const mutate of [(r) => { r.status = "resolved"; }, (r) => { r.result = {}; }, (r) => { r.sequence = 4; }, (r) => { r.preparedRevision = 999; }]) {
    const prepared = applyVoyageEncounterPendingCheckPreparation(state(), { pendingCheckIds: [{ sequence: 0, pendingCheckId: "check-1" }] }).nextState;
    mutate(prepared.pendingChecks[0]); assert.equal(validateVoyageEncounterPendingChecks(prepared).valid, false);
  }
});

test("resolved pending checks require the exact six-field persisted result", () => {
  const valid = () => ({ total: 24, degreeOfSuccess: 2, degreeOfSuccessSlug: "success", statisticSlug: "diplomacy", dc: 20, rollMode: "public" });
  for (const mutate of [result => delete result.rollMode, result => result.extra = true, result => result.dc = Infinity]) {
    const prepared = applyVoyageEncounterPendingCheckPreparation(state(), { pendingCheckIds: [{ sequence: 0, pendingCheckId: "check-1" }] }).nextState;
    prepared.pendingChecks[0].status = "resolved";
    prepared.pendingChecks[0].result = valid();
    mutate(prepared.pendingChecks[0].result);
    assert.equal(validateVoyageEncounterPendingChecks(prepared).valid, false);
  }
});

function preparedState() {
  const value = state();
  const result = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds: [{ sequence: 0, pendingCheckId: "check-1" }] });
  assert.equal(result.ok, true);
  return result.nextState;
}

function withInheritedGetter(key, getter, callback) {
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, key);
  Object.defineProperty(Object.prototype, key, { configurable: true, get: getter });
  try {
    return callback();
  } finally {
    if (previous) Object.defineProperty(Object.prototype, key, previous);
    else delete Object.prototype[key];
  }
}

test("throwing pendingCheckId getter returns validation errors", () => {
  const value = preparedState();
  Object.defineProperty(value.pendingChecks[0], "pendingCheckId", { configurable: true, enumerable: true, get() { throw new Error("pending id"); } });
  const report = validateVoyageEncounterPendingChecks(value);
  assert.ok(report.errors.some((entry) => entry.code === "pending-check-data-read-failed" && entry.path === "pendingChecks[0].pendingCheckId"));
});

test("throwing sequence getter returns validation errors", () => {
  const value = preparedState();
  Object.defineProperty(value.pendingChecks[0], "sequence", { configurable: true, enumerable: true, get() { throw new Error("sequence"); } });
  const report = validateVoyageEncounterPendingChecks(value);
  assert.ok(report.errors.some((entry) => entry.code === "pending-check-data-read-failed" && entry.path === "pendingChecks[0].sequence"));
});

test("inherited required fields are reported missing", () => {
  const value = preparedState();
  delete value.pendingChecks[0].pendingCheckId;
  const report = withInheritedGetter("pendingCheckId", () => "inherited", () => validateVoyageEncounterPendingChecks(value));
  assert.ok(report.errors.some((entry) => entry.code === "missing-pending-check-field" && entry.path === "pendingChecks[0].pendingCheckId"));
});

test("inherited required-field getters are never evaluated", () => {
  const value = preparedState();
  delete value.pendingChecks[0].pendingCheckId;
  let readCount = 0;
  const report = withInheritedGetter("pendingCheckId", () => { readCount += 1; throw new Error("inherited field"); }, () => validateVoyageEncounterPendingChecks(value));
  assert.equal(readCount, 0);
  assert.ok(report.errors.some((entry) => entry.code === "missing-pending-check-field" && entry.path === "pendingChecks[0].pendingCheckId"));
});

test("valid persisted field getters are each read once", () => {
  const value = preparedState();
  const record = value.pendingChecks[0];
  const snapshot = structuredClone(record);
  const fields = ["pendingCheckId", "preparedRevision", "stageId", "roundNumber", "sequence", "stationId", "actionId", "resolutionPriority", "riskBidId", "target", "mode", "source", "statisticOptions", "dcSource", "secrecy", "metadata", "status", "result"];
  const reads = new Map(fields.map((field) => [field, 0]));
  for (const field of fields) Object.defineProperty(record, field, { configurable: true, enumerable: true, get() { reads.set(field, reads.get(field) + 1); return snapshot[field]; } });
  const report = validateVoyageEncounterPendingChecks(value);
  assert.equal(report.valid, true);
  for (const field of fields) assert.equal(reads.get(field), 1, field);
});

test("accepts persisted pending-check statisticOptions with a custom prototype", () => {
  const value = state();
  value.availableStations[0].actions[0].check.statisticOptions.length = 2;
  const result = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds: [{ sequence: 0, pendingCheckId: "check-1" }] });
  assert.equal(result.ok, true);
  const options = result.nextState.pendingChecks[0].statisticOptions;
  withCustomArrayPrototype(options, Object.create(Array.prototype), () => {
    assert.equal(validateVoyageEncounterPendingChecks(result.nextState).valid, true);
  });
});

test("ignores inherited persisted statistic options without evaluating them", () => {
  const value = state();
  value.availableStations[0].actions[0].check.statisticOptions.length = 2;
  const result = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds: [{ sequence: 0, pendingCheckId: "check-1" }] });
  assert.equal(result.ok, true);
  const options = result.nextState.pendingChecks[0].statisticOptions;
  let readCount = 0;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, { configurable: true, get() { readCount += 1; throw new Error("inherited persisted statistic option"); } });
  withCustomArrayPrototype(options, prototype, () => {
    const report = validateVoyageEncounterPendingChecks(result.nextState);
    assert.equal(report.valid, true);
    assert.equal(readCount, 0);
  });
});

test("throwing pendingCheckIds getter returns a mutation failure", () => {
  const value = state();
  const before = structuredClone(value);
  const request = {};
  Object.defineProperty(request, "pendingCheckIds", { configurable: true, enumerable: true, get() { throw new Error("ids"); } });
  const requestBefore = requestShape(request);
  const result = applyVoyageEncounterPendingCheckPreparation(value, request);
  assertFailedPreparation(value, request, result, before, requestBefore);
});

test("inherited pendingCheckIds is rejected without evaluation", () => {
  const value = state();
  const before = structuredClone(value);
  const request = {};
  let readCount = 0;
  const result = withInheritedGetter("pendingCheckIds", () => { readCount += 1; throw new Error("inherited ids"); }, () => applyVoyageEncounterPendingCheckPreparation(value, request));
  assertFailedPreparation(value, request, result, before, requestShape(request));
  assert.equal(readCount, 0);
});

test("throwing mapping entry getter returns a mutation failure", () => {
  const value = state();
  const before = structuredClone(value);
  const entry = {};
  Object.defineProperty(entry, "sequence", { configurable: true, enumerable: true, value: 0 });
  Object.defineProperty(entry, "pendingCheckId", { configurable: true, enumerable: true, value: "pending-1" });
  const request = { pendingCheckIds: [] };
  Object.defineProperty(request.pendingCheckIds, 0, { configurable: true, enumerable: true, get() { throw new Error("entry"); } });
  request.pendingCheckIds.length = 1;
  const requestBefore = requestShape(request);
  const result = applyVoyageEncounterPendingCheckPreparation(value, request);
  assertFailedPreparation(value, request, result, before, requestBefore);
});

test("throwing mapping sequence getter returns a mutation failure", () => {
  const value = state();
  const before = structuredClone(value);
  const entry = { pendingCheckId: "pending-1" };
  Object.defineProperty(entry, "sequence", { configurable: true, enumerable: true, get() { throw new Error("mapping sequence"); } });
  const request = { pendingCheckIds: [entry] };
  const requestBefore = requestShape(request);
  const result = applyVoyageEncounterPendingCheckPreparation(value, request);
  assertFailedPreparation(value, request, result, before, requestBefore);
});

test("throwing mapping pendingCheckId getter returns a mutation failure", () => {
  const value = state();
  const before = structuredClone(value);
  const entry = { sequence: 0 };
  Object.defineProperty(entry, "pendingCheckId", { configurable: true, enumerable: true, get() { throw new Error("mapping id"); } });
  const request = { pendingCheckIds: [entry] };
  const requestBefore = requestShape(request);
  const result = applyVoyageEncounterPendingCheckPreparation(value, request);
  assertFailedPreparation(value, request, result, before, requestBefore);
});

test("inherited mapping fields are rejected without evaluation", () => {
  const value = state();
  const before = structuredClone(value);
  const request = { pendingCheckIds: [{}] };
  let sequenceReads = 0;
  let idReads = 0;
  const requestBefore = requestShape(request);
  const result = withInheritedGetter("sequence", () => { sequenceReads += 1; throw new Error("inherited sequence"); }, () => withInheritedGetter("pendingCheckId", () => { idReads += 1; throw new Error("inherited id"); }, () => applyVoyageEncounterPendingCheckPreparation(value, request)));
  assertFailedPreparation(value, request, result, before, requestBefore);
  assert.equal(sequenceReads, 0);
  assert.equal(idReads, 0);
});

test("valid mapping getters are each read once", () => {
  const value = state();
  const before = structuredClone(value);
  const entry = {};
  let sequenceReads = 0;
  let idReads = 0;
  Object.defineProperty(entry, "sequence", { configurable: true, enumerable: true, get() { sequenceReads += 1; return 0; } });
  Object.defineProperty(entry, "pendingCheckId", { configurable: true, enumerable: true, get() { idReads += 1; return "pending-1"; } });
  const request = { pendingCheckIds: [entry] };
  const requestBefore = requestShape(request);
  const result = applyVoyageEncounterPendingCheckPreparation(value, request);
  assert.equal(result.ok, true);
  assert.equal(sequenceReads, 1);
  assert.equal(idReads, 1);
  assert.deepEqual(value, before);
  assert.deepEqual(requestShape(request), requestBefore);
});

test("preparation mappings ignore inherited numeric entries", () => {
  const value = state();
  const pendingCheckIds = [{ sequence: 0, pendingCheckId: "pending-1" }];
  pendingCheckIds.length = 2;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, { configurable: true, value: { sequence: 99, pendingCheckId: "inherited" }, enumerable: true });
  withCustomArrayPrototype(pendingCheckIds, prototype, () => {
    const result = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds });
    assert.equal(result.ok, true);
    assert.equal(result.nextState.pendingChecks[0].pendingCheckId, "pending-1");
  });
});

test("throwing inherited mapping getters are never executed", () => {
  const value = state();
  const pendingCheckIds = [{ sequence: 0, pendingCheckId: "pending-1" }];
  pendingCheckIds.length = 2;
  let readCount = 0;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, { configurable: true, get() { readCount += 1; throw new Error("inherited mapping"); } });
  withCustomArrayPrototype(pendingCheckIds, prototype, () => {
    const result = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds });
    assert.equal(result.ok, true);
    assert.equal(readCount, 0);
  });
});
