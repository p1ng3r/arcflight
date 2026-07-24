import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";
import { prepareVoyageEncounterResolutionCompletion } from "../../../scripts/voyage/domain/resolution-completion.js";

const REPORT_KEYS = [
  "structurallyValid",
  "active",
  "resolution",
  "readyForConsequences",
  "actionCount",
  "checkCount",
  "noRollActionCount",
  "pendingCheckCount",
  "resolvedCheckCount",
  "unresolvedCheckCount",
  "unresolvedChecks",
  "errors",
  "warnings"
];

function state({ checks = 0, prepare = false } = {}) {
  const encounter = createVoyageEncounterState({
    encounterId: "completion",
    definitionId: "definition",
    primaryShip: { id: "ship" }
  });
  const availableStations = [];
  const selections = {};

  if (checks === 0) {
    availableStations.push({
      stationId: "captain",
      actions: [{ actionId: "observe" }]
    });
    selections.captain = { stationId: "captain", actionId: "observe" };
  } else {
    for (let index = 0; index < checks; index += 1) {
      const stationId = `station-${index}`;
      const actionId = `action-${index}`;
      availableStations.push({
        stationId,
        actions: [{
          actionId,
          check: {
            source: { kind: "character", uuid: `Actor.${index}` },
            statisticOptions: ["diplomacy"],
            dcSource: { kind: "fixed", value: 20 },
            secrecy: "public"
          }
        }]
      });
      selections[stationId] = { stationId, actionId };
    }
  }

  Object.assign(encounter, {
    lifecycleState: "active",
    currentStage: { stageId: "stage" },
    roundNumber: 1,
    phase: "resolution",
    availableStations,
    selections
  });

  if (!prepare || checks === 0) return encounter;

  const prepared = applyVoyageEncounterPendingCheckPreparation(
    encounter,
    {
      pendingCheckIds: Array.from({ length: checks }, (_, sequence) => ({
        sequence,
        pendingCheckId: `pending-${sequence}`
      }))
    }
  );
  assert.equal(prepared.ok, true);
  return prepared.nextState;
}

function execution(sequence) {
  return {
    ok: true,
    status: "rolled",
    pendingCheckId: `pending-${sequence}`,
    sequence,
    sourceKind: "character",
    sourceUuid: `Actor.${sequence}`,
    statisticSlug: "diplomacy",
    dc: 20,
    rollMode: "public",
    result: { total: 20, degreeOfSuccess: 2, degreeOfSuccessSlug: "success" },
    errors: [],
    warnings: []
  };
}

function resolve(stateValue, sequence) {
  const result = applyVoyageEncounterPendingCheckResult(stateValue, execution(sequence));
  assert.equal(result.ok, true);
  return result.nextState;
}

test("returns the exact completion report contract for a ready no-roll-only plan", () => {
  const report = prepareVoyageEncounterResolutionCompletion(state());

  assert.deepEqual(Object.keys(report), REPORT_KEYS);
  assert.equal(report.structurallyValid, true);
  assert.equal(report.active, true);
  assert.equal(report.resolution, true);
  assert.equal(report.readyForConsequences, true);
  assert.equal(report.actionCount, 1);
  assert.equal(report.checkCount, 0);
  assert.equal(report.noRollActionCount, 1);
  assert.equal(report.pendingCheckCount, 0);
  assert.equal(report.resolvedCheckCount, 0);
  assert.deepEqual(report.unresolvedChecks, []);
  assert.equal(Object.hasOwn(report, "rollResults"), false);
  assert.equal(JSON.stringify(report).includes("total"), false);
});

test("rejects a check-producing plan without prepared checks", () => {
  const report = prepareVoyageEncounterResolutionCompletion(state({ checks: 1 }));

  assert.equal(report.readyForConsequences, false);
  assert.equal(report.checkCount, 1);
  assert.equal(report.pendingCheckCount, 0);
  assert.ok(report.errors.length > 0);
});

test("reports pending checks and unresolved identities in sequence order", () => {
  const prepared = state({ checks: 2, prepare: true });
  const report = prepareVoyageEncounterResolutionCompletion(prepared);

  assert.equal(report.readyForConsequences, false);
  assert.equal(report.pendingCheckCount, 2);
  assert.equal(report.resolvedCheckCount, 0);
  assert.equal(report.unresolvedCheckCount, 2);
  assert.deepEqual(report.unresolvedChecks, [
    { pendingCheckId: "pending-0", sequence: 0, stationId: "station-0", actionId: "action-0" },
    { pendingCheckId: "pending-1", sequence: 1, stationId: "station-1", actionId: "action-1" }
  ]);
  for (const entry of report.unresolvedChecks) {
    assert.deepEqual(Object.keys(entry), ["pendingCheckId", "sequence", "stationId", "actionId"]);
  }
});

test("becomes ready only after every prepared check is resolved", () => {
  let prepared = state({ checks: 2, prepare: true });
  prepared = resolve(prepared, 0);
  let report = prepareVoyageEncounterResolutionCompletion(prepared);
  assert.equal(report.readyForConsequences, false);
  assert.equal(report.resolvedCheckCount, 1);
  assert.equal(report.unresolvedCheckCount, 1);

  prepared = resolve(prepared, 1);
  report = prepareVoyageEncounterResolutionCompletion(prepared);
  assert.equal(report.readyForConsequences, true);
  assert.equal(report.pendingCheckCount, 2);
  assert.equal(report.resolvedCheckCount, 2);
  assert.equal(report.unresolvedCheckCount, 0);
});

test("rejects malformed and mismatched resolved checks", () => {
  const malformed = state({ checks: 1, prepare: true });
  malformed.pendingChecks[0].status = "resolved";
  malformed.pendingChecks[0].result = {
    total: 20,
    degreeOfSuccess: 2,
    degreeOfSuccessSlug: "success",
    statisticSlug: "wrong",
    dc: 20,
    rollMode: "public"
  };
  const malformedReport = prepareVoyageEncounterResolutionCompletion(malformed);
  assert.equal(malformedReport.readyForConsequences, false);
  assert.ok(malformedReport.errors.length > 0);

  const mismatched = state({ checks: 1, prepare: true });
  mismatched.pendingChecks[0].actionId = "different-action";
  const mismatchedReport = prepareVoyageEncounterResolutionCompletion(mismatched);
  assert.equal(mismatchedReport.structurallyValid, false);
  assert.equal(mismatchedReport.readyForConsequences, false);
});

test("does not mutate state while preparing completion", () => {
  const encounter = state({ checks: 2, prepare: true });
  const before = structuredClone(encounter);
  const report = prepareVoyageEncounterResolutionCompletion(encounter);

  assert.equal(report.readyForConsequences, false);
  assert.deepEqual(encounter, before);
});

test("preserves the active and phase indicators without exposing result data", () => {
  const encounter = resolve(state({ checks: 1, prepare: true }), 0);
  const report = prepareVoyageEncounterResolutionCompletion(encounter);

  assert.equal(report.active, true);
  assert.equal(report.resolution, true);
  assert.deepEqual(report.unresolvedChecks, []);
  assert.equal(Object.hasOwn(report, "result"), false);
});
