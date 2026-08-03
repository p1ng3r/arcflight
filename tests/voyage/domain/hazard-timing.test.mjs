import assert from "node:assert/strict";
import test from "node:test";

import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../../../scripts/voyage/domain/constants.js";
import { analyzeVoyageHazardOperationalTiming } from "../../../scripts/voyage/domain/hazard-timing.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";

const RESULT_KEYS = [
  "structurallyValid",
  "readyForHazardOperationalTiming",
  "encounterId",
  "hazardId",
  "roundNumber",
  "createdRoundNumber",
  "operationalRoundNumber",
  "operational",
  "errors",
  "warnings"
];

function hazard(pressureSystemId, overrides = {}) {
  return {
    hazardId: `hazard-${pressureSystemId}`,
    encounterId: "timing-encounter",
    category: "system",
    status: "active",
    name: `Hazard ${pressureSystemId}`,
    currentEffect: { effectId: `effect-${pressureSystemId}` },
    activationTiming: { kind: "start-of-next-round", stationId: null, resultId: null },
    removalMethod: { methodId: "address-hazard", criticalSuccessBenefit: { benefitId: `benefit-${pressureSystemId}` } },
    ignoredConsequence: { consequenceId: `ignored-${pressureSystemId}` },
    visibility: "public",
    sourceKind: "pressure-breach",
    createdStageId: "timing-stage",
    createdRoundNumber: 4,
    createdSequence: 0,
    escalation: { mode: "none", currentStageId: null, stages: [], countdown: null, maximumEscalationReached: false, escalationConsequence: null },
    collisionPolicy: "trigger-existing-consequence",
    duration: { mode: "none", remaining: null, initial: null, decrementTiming: null },
    failurePressureSystemId: pressureSystemId,
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { consequence: { consequenceId: `repeat-${pressureSystemId}` } } },
    pressureSystemId,
    eventAreaId: null,
    pressureBreachId: `breach-${pressureSystemId}`,
    stationId: "engineer",
    actionId: "action-1",
    pressureEffectId: "pressure-effect-1",
    sourceIntentId: "intent-1",
    activationSource: "pressure-breach",
    branch: "failure",
    sourceTiming: "consequences",
    sourceVisibility: "public",
    ...overrides
  };
}

function state(roundNumber, pressureSystemId = VOYAGE_PRESSURE_SYSTEM_IDS[0]) {
  const value = createVoyageEncounterState({ encounterId: "timing-encounter", definitionId: "timing-definition", primaryShip: { id: "ship-1" } });
  value.lifecycleState = "active";
  value.currentStage = { stageId: "timing-stage" };
  value.roundNumber = roundNumber;
  value.phase = "crew-planning";
  value.activeHazards = [hazard(pressureSystemId)];
  return value;
}

test("start-of-next-round Hazards are operational only from creation round plus one for every system", () => {
  for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
    for (const [roundNumber, operational] of [[4, false], [5, true], [7, true]]) {
      const encounterState = state(roundNumber, pressureSystemId);
      const result = analyzeVoyageHazardOperationalTiming(encounterState, encounterState.activeHazards[0]);
      assert.deepEqual(Object.keys(result), RESULT_KEYS);
      assert.equal(result.readyForHazardOperationalTiming, true, `${pressureSystemId}:${roundNumber}`);
      assert.equal(result.operationalRoundNumber, 5);
      assert.equal(result.operational, operational, `${pressureSystemId}:${roundNumber}`);
    }
  }
});

test("operational timing analysis is pure, deterministic, and isolated", () => {
  const encounterState = state(5);
  const sourceState = structuredClone(encounterState);
  const sourceHazard = structuredClone(encounterState.activeHazards[0]);
  const first = analyzeVoyageHazardOperationalTiming(encounterState, encounterState.activeHazards[0]);
  const second = analyzeVoyageHazardOperationalTiming(encounterState, encounterState.activeHazards[0]);

  assert.deepEqual(first, second);
  assert.deepEqual(encounterState, sourceState);
  assert.deepEqual(encounterState.activeHazards[0], sourceHazard);
  first.errors.push({ code: "changed" });
  assert.deepEqual(second.errors, []);
  assert.equal(encounterState.revision, 0);
});

test("operational timing rejects wrong encounters and returns not-applicable analysis for other valid timing", () => {
  const encounterState = state(5);
  const wrongEncounter = structuredClone(encounterState.activeHazards[0]);
  wrongEncounter.encounterId = "other-encounter";
  const rejected = analyzeVoyageHazardOperationalTiming(encounterState, wrongEncounter);
  assert.equal(rejected.readyForHazardOperationalTiming, false);
  assert.ok(rejected.errors.some(({ code }) => code === "hazard-operational-timing-hazard-invalid"));

  const immediate = structuredClone(encounterState.activeHazards[0]);
  immediate.activationTiming.kind = "immediate";
  const notApplicable = analyzeVoyageHazardOperationalTiming(encounterState, immediate);
  assert.equal(notApplicable.structurallyValid, true);
  assert.equal(notApplicable.readyForHazardOperationalTiming, false);
  assert.equal(notApplicable.operational, false);
  assert.ok(notApplicable.errors.some(({ code }) => code === "hazard-operational-timing-not-applicable"));
});

test("operational timing contains hostile and malformed caller data", () => {
  let reads = 0;
  const hostile = {};
  Object.defineProperty(hostile, "encounterId", { enumerable: true, get() { reads += 1; throw new Error("must not run"); } });
  const result = analyzeVoyageHazardOperationalTiming(hostile, hazard(VOYAGE_PRESSURE_SYSTEM_IDS[0]));
  assert.equal(result.readyForHazardOperationalTiming, false);
  assert.equal(reads, 0);
  assert.ok(result.errors.every(({ message }) => !message.includes("must not run")));
});
