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
