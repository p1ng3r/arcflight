import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";

function state() {
  const value = createVoyageEncounterState({ encounterId: "event", definitionId: "definition", primaryShip: { id: "ship" } });
  value.lifecycleState = "active";
  value.currentStage = { stageId: "stage" };
  value.roundNumber = 1;
  value.phase = "resolution";
  value.availableStations = [{ stationId: "captain", actions: [{ actionId: "check", resolutionPriority: 1, check: { source: { kind: "character", uuid: "Actor.a" }, statisticOptions: ["athletics"], dcSource: { kind: "fixed", value: 20 }, secrecy: "public" } }] }];
  value.selections = { captain: { stationId: "captain", actionId: "check" } };
  return applyVoyageEncounterPendingCheckPreparation(value, { pendingCheckIds: [{ sequence: 0, pendingCheckId: "check-1" }] }).nextState;
}

const rolled = (overrides = {}) => ({ ok: true, status: "rolled", pendingCheckId: "check-1", sequence: 0, sourceKind: "character", sourceUuid: "Actor.a", statisticSlug: "athletics", dc: 20, rollMode: "public", result: { total: 24, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" }, errors: [], warnings: [], ...overrides });

test("persists an isolated PF2e result without advancing Resolution", () => {
  const before = state();
  const result = applyVoyageEncounterPendingCheckResult(before, rolled());
  assert.equal(result.ok, true);
  assert.equal(before.pendingChecks[0].status, "pending");
  assert.equal(result.nextState.pendingChecks[0].status, "resolved");
  assert.deepEqual(result.nextState.pendingChecks[0].result, { ...rolled().result, statisticSlug: "athletics", dc: 20, rollMode: "public" });
  assert.equal(result.nextState.phase, "resolution");
  assert.equal(result.nextState.revision, before.revision + 1);
  assert.deepEqual(result.events.map((event) => event.type), ["voyage.pending-check-resolved"]);
});

test("rejects duplicate, blocked, mismatched, and malformed result persistence without mutation", () => {
  const before = state();
  for (const execution of [rolled({ ok: false, status: "blocked" }), rolled({ sequence: 1 }), rolled({ result: { total: 24, degreeOfSuccess: 2, degreeOfSuccessSlug: "failure" } })]) {
    const result = applyVoyageEncounterPendingCheckResult(before, execution);
    assert.equal(result.ok, false);
    assert.equal(result.nextState, null);
    assert.equal(before.pendingChecks[0].status, "pending");
  }
  const persisted = applyVoyageEncounterPendingCheckResult(before, rolled()).nextState;
  assert.equal(applyVoyageEncounterPendingCheckResult(persisted, rolled()).ok, false);
});
