import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterPendingCheckPreparation, validateVoyageEncounterPendingChecks } from "../../../scripts/voyage/domain/pending-checks.js";
function state() { const value = createVoyageEncounterState({ encounterId: "event", definitionId: "definition", primaryShip: { id: "ship" } }); value.lifecycleState = "active"; value.currentStage = { stageId: "stage" }; value.roundNumber = 1; value.phase = "resolution"; value.availableStations = [{ stationId: "captain", actions: [{ actionId: "check", check: { source: { kind: "character" }, statisticOptions: ["diplomacy"], dcSource: { kind: "fixed", value: 20 }, secrecy: "public" } }] }]; value.selections = { captain: { stationId: "captain", actionId: "check" } }; return value; }
test("atomically prepares matching pending checks", () => { const value = state(), before = structuredClone(value); assert.equal(validateVoyageEncounterPendingChecks(value).valid, true); const result = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds: [{ sequence: 0, pendingCheckId: "pending-1" }] }); assert.equal(result.ok, true); assert.equal(result.nextState.revision, 1); assert.equal(result.nextState.pendingChecks[0].pendingCheckId, "pending-1"); assert.equal(validateVoyageEncounterPendingChecks(result.nextState).valid, true); assert.equal(result.events[0].type, "voyage.pending-checks-prepared"); assert.deepEqual(value, before); });
test("rejects unsafe and incomplete mappings without mutation", () => { const value = state(), before = structuredClone(value); const result = applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds: [{ sequence: 0, pendingCheckId: "__proto__" }] }); assert.equal(result.ok, false); assert.deepEqual(value, before); });

test("accepts valid empty pre-preparation state and rejects blank mapping IDs atomically", () => {
  for (const pendingCheckId of ["", " ", "\t", "\n"]) {
    const value = state(), before = structuredClone(value), request = { pendingCheckIds: [{ sequence: 0, pendingCheckId }] };
    assert.equal(validateVoyageEncounterPendingChecks(value).valid, true);
    const result = applyVoyageEncounterPendingCheckPreparation(value, request);
    assert.equal(result.ok, false); assert.equal(result.nextState, null); assert.deepEqual(result.events, []); assert.deepEqual(value, before);
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
