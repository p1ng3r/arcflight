import assert from "node:assert/strict";
import test from "node:test";

import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../../../scripts/voyage/domain/constants.js";
import { applyVoyageAddressHazard } from "../../../scripts/voyage/domain/hazard-application.js";
import { captureVoyageHazardRecord } from "../../../scripts/voyage/domain/hazard-schema.js";
import {
  VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS,
  getVoyagePressureBreachHazardDefinition
} from "../../../scripts/voyage/domain/pressure-breach-hazard-definitions.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";

const REQUEST_KEYS = ["kind", "encounterId", "expectedRevision", "hazardId", "existingHazardIndex", "previousHazard", "outcome"];
const RESOLVED_EVENT_KEYS = ["type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase", "hazardId", "pressureSystemId", "outcome", "previousRevision", "revision", "previousHazard", "hazard", "benefit"];

function hazard(pressureSystemId, hazardId = `hazard-${pressureSystemId}`, overrides = {}) {
  return {
    hazardId,
    encounterId: "address-encounter",
    category: "system",
    status: "active",
    name: `Hazard ${pressureSystemId}`,
    currentEffect: { effectId: `effect-${pressureSystemId}`, nested: { values: [pressureSystemId] } },
    activationTiming: { kind: "start-of-next-round", stationId: null, resultId: null },
    removalMethod: {
      methodId: "address-hazard",
      name: "Address Hazard",
      criticalSuccessBenefit: { benefitId: `benefit-${pressureSystemId}`, name: `Benefit ${pressureSystemId}`, nested: { values: [pressureSystemId] } }
    },
    ignoredConsequence: { consequenceId: `ignored-${pressureSystemId}`, name: "Ignored" },
    visibility: "public",
    sourceKind: "pressure-breach",
    createdStageId: "address-stage",
    createdRoundNumber: 1,
    createdSequence: 0,
    escalation: { mode: "none", currentStageId: null, stages: [], countdown: null, maximumEscalationReached: false, escalationConsequence: null },
    collisionPolicy: "trigger-existing-consequence",
    duration: { mode: "none", remaining: null, initial: null, decrementTiming: null },
    failurePressureSystemId: pressureSystemId,
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { consequence: { consequenceId: `repeat-${pressureSystemId}`, name: "Repeat" } } },
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

function state(pressureSystemId = VOYAGE_PRESSURE_SYSTEM_IDS[0], activeHazards = null) {
  const value = createVoyageEncounterState({ encounterId: "address-encounter", definitionId: "address-definition", primaryShip: { id: "ship-1" } });
  value.lifecycleState = "active";
  value.currentStage = { stageId: "address-stage" };
  value.roundNumber = 2;
  value.phase = "consequences";
  value.activeHazards = activeHazards ?? [hazard(pressureSystemId)];
  return value;
}

function request(encounterState, outcome = "success", index = 0) {
  const live = encounterState.activeHazards[index];
  return {
    kind: "address-hazard",
    encounterId: encounterState.encounterId,
    expectedRevision: encounterState.revision,
    hazardId: live?.hazardId ?? "missing-hazard",
    existingHazardIndex: index,
    previousHazard: structuredClone(live),
    outcome
  };
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  if (code) assert.ok(result.errors.some((entry) => entry.code === code), JSON.stringify(result.errors));
}

test("success and critical-success resolve every canonical system Hazard with one exact event", () => {
  for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
    for (const outcome of ["success", "critical-success"]) {
      const encounterState = state(pressureSystemId);
      encounterState.activeHazards[0].removalMethod = getVoyagePressureBreachHazardDefinition(pressureSystemId).definition.removalMethod;
      const before = structuredClone(encounterState);
      const addressRequest = request(encounterState, outcome);
      const requestBefore = structuredClone(addressRequest);
      const result = applyVoyageAddressHazard(encounterState, addressRequest);
      assert.equal(result.ok, true, `${pressureSystemId}:${outcome}`);
      assert.equal(result.nextState.revision, before.revision + 1);
      assert.deepEqual(result.nextState.activeHazards, []);
      assert.deepEqual(result.nextState.pressureSystems, before.pressureSystems);
      assert.equal(Array.isArray(result.events), true);
      assert.equal(result.events.length, 1);
      assert.deepEqual(Object.keys(result.events[0]), RESOLVED_EVENT_KEYS);
      assert.equal(result.events[0].type, "voyage.hazard-resolved");
      assert.equal(result.events[1], undefined);
      assert.equal(result.events[0].hazard.status, "resolved");
      assert.equal(result.events[0].hazard.terminalReason, "addressed");
      assert.equal(result.events[0].hazard.resolvedStageId, "address-stage");
      assert.equal(result.events[0].hazard.resolvedRoundNumber, 2);
      const expectedTerminal = structuredClone(before.activeHazards[0]);
      expectedTerminal.status = "resolved";
      expectedTerminal.resolvedStageId = before.currentStage.stageId;
      expectedTerminal.resolvedRoundNumber = before.roundNumber;
      expectedTerminal.terminalReason = "addressed";
      expectedTerminal.replacedByHazardId = null;
      assert.deepEqual(result.events[0].hazard, expectedTerminal);
      assert.equal(captureVoyageHazardRecord(result.events[0].hazard, { mode: "snapshot", expectedEncounterId: encounterState.encounterId }).ok, true);
      assert.equal(result.events[0].benefit === null, outcome === "success");
      if (outcome === "critical-success") assert.deepEqual(result.events[0].benefit, before.activeHazards[0].removalMethod.criticalSuccessBenefit);
      const nextStateBeforeEventMutation = structuredClone(result.nextState);
      const registryBenefitBefore = structuredClone(VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS[pressureSystemId].removalMethod.criticalSuccessBenefit);
      result.events[0].previousHazard.currentEffect.nested.values[0] = "changed-event-previous";
      result.events[0].hazard.currentEffect.nested.values[0] = "changed-event-terminal";
      if (result.events[0].benefit !== null) result.events[0].benefit.description = "changed-event-benefit";
      assert.deepEqual(result.nextState, nextStateBeforeEventMutation);
      assert.deepEqual(encounterState, before);
      assert.deepEqual(addressRequest, requestBefore);
      assert.notStrictEqual(result.events[0].previousHazard, result.events[0].hazard);
      assert.deepEqual(
        VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS[pressureSystemId].removalMethod.criticalSuccessBenefit,
        registryBenefitBefore
      );
    }
  }
});

function freshCriticalSuccessResult() {
  const encounterState = state("crew-morale");
  encounterState.activeHazards[0].removalMethod = getVoyagePressureBreachHazardDefinition("crew-morale").definition.removalMethod;
  const addressRequest = request(encounterState, "critical-success");
  const result = applyVoyageAddressHazard(encounterState, addressRequest);
  assert.equal(result.ok, true);
  return { encounterState, addressRequest, result };
}

test("successful resolution removes only the exact indexed Hazard and isolates terminal audit data", () => {
  const other = hazard("arkengine", "other-hazard");
  const target = hazard("crew-morale", "target-hazard");
  const encounterState = state("crew-morale", [other, target]);
  const before = structuredClone(encounterState);
  const result = applyVoyageAddressHazard(encounterState, request(encounterState, "critical-success", 1));
  assert.equal(result.ok, true);
  assert.deepEqual(result.nextState.activeHazards.map(({ hazardId }) => hazardId), ["other-hazard"]);
  assert.deepEqual(result.nextState.activeHazards[0], before.activeHazards[0]);
  assert.notStrictEqual(result.events[0].previousHazard, result.events[0].hazard);
  assert.notStrictEqual(result.events[0].benefit, before.activeHazards[1].removalMethod.criticalSuccessBenefit);
  const nextStateBeforeEventMutation = structuredClone(result.nextState);
  result.events[0].previousHazard.metadata.collision.consequence.name = "changed-event-previous";
  result.events[0].hazard.metadata.collision.consequence.name = "changed-event-terminal";
  result.events[0].benefit.nested.values[0] = "changed";
  assert.deepEqual(result.nextState, nextStateBeforeEventMutation);
  assert.equal(before.activeHazards[1].removalMethod.criticalSuccessBenefit.nested.values[0], "crew-morale");
});

test("critical-success event members remain deeply isolated across independent mutations", () => {
  const previousMutation = freshCriticalSuccessResult();
  const previousEvent = previousMutation.result.events[0];
  const previousHazardBefore = structuredClone(previousEvent.hazard);
  const previousBenefitBefore = structuredClone(previousEvent.benefit);
  const previousNextStateBefore = structuredClone(previousMutation.result.nextState);
  const previousStateBefore = structuredClone(previousMutation.encounterState);
  const previousRequestBefore = structuredClone(previousMutation.addressRequest);
  const previousRequestHazardBefore = structuredClone(previousMutation.addressRequest.previousHazard);
  assert.notStrictEqual(previousEvent.previousHazard, previousEvent.hazard);
  assert.notStrictEqual(previousEvent.benefit, previousEvent.previousHazard.removalMethod.criticalSuccessBenefit);
  assert.notStrictEqual(previousEvent.benefit, previousEvent.hazard.removalMethod.criticalSuccessBenefit);
  previousEvent.previousHazard.currentEffect.nested.values[0] = "changed-previous-effect";
  previousEvent.previousHazard.metadata.collision.consequence.name = "changed-previous-metadata";
  assert.deepEqual(previousEvent.hazard, previousHazardBefore);
  assert.deepEqual(previousEvent.benefit, previousBenefitBefore);
  assert.deepEqual(previousMutation.result.nextState, previousNextStateBefore);
  assert.deepEqual(previousMutation.encounterState, previousStateBefore);
  assert.deepEqual(previousMutation.addressRequest, previousRequestBefore);
  assert.deepEqual(previousMutation.addressRequest.previousHazard, previousRequestHazardBefore);

  const terminalMutation = freshCriticalSuccessResult();
  const terminalEvent = terminalMutation.result.events[0];
  const terminalPreviousHazardBefore = structuredClone(terminalEvent.previousHazard);
  const terminalBenefitBefore = structuredClone(terminalEvent.benefit);
  const terminalNextStateBefore = structuredClone(terminalMutation.result.nextState);
  const terminalStateBefore = structuredClone(terminalMutation.encounterState);
  const terminalRequestBefore = structuredClone(terminalMutation.addressRequest);
  const terminalRequestHazardBefore = structuredClone(terminalMutation.addressRequest.previousHazard);
  assert.notStrictEqual(terminalEvent.previousHazard, terminalEvent.hazard);
  assert.notStrictEqual(terminalEvent.benefit, terminalEvent.previousHazard.removalMethod.criticalSuccessBenefit);
  assert.notStrictEqual(terminalEvent.benefit, terminalEvent.hazard.removalMethod.criticalSuccessBenefit);
  terminalEvent.hazard.currentEffect.nested.values[0] = "changed-terminal-effect";
  terminalEvent.hazard.metadata.collision.consequence.name = "changed-terminal-metadata";
  assert.deepEqual(terminalEvent.previousHazard, terminalPreviousHazardBefore);
  assert.deepEqual(terminalEvent.benefit, terminalBenefitBefore);
  assert.deepEqual(terminalMutation.result.nextState, terminalNextStateBefore);
  assert.deepEqual(terminalMutation.encounterState, terminalStateBefore);
  assert.deepEqual(terminalMutation.addressRequest, terminalRequestBefore);
  assert.deepEqual(terminalMutation.addressRequest.previousHazard, terminalRequestHazardBefore);

  const benefitMutation = freshCriticalSuccessResult();
  const benefitEvent = benefitMutation.result.events[0];
  const benefitPreviousHazardBefore = structuredClone(benefitEvent.previousHazard);
  const benefitHazardBefore = structuredClone(benefitEvent.hazard);
  const benefitPreviousDescriptorBefore = structuredClone(benefitEvent.previousHazard.removalMethod.criticalSuccessBenefit);
  const benefitTerminalDescriptorBefore = structuredClone(benefitEvent.hazard.removalMethod.criticalSuccessBenefit);
  const benefitNextStateBefore = structuredClone(benefitMutation.result.nextState);
  const benefitStateBefore = structuredClone(benefitMutation.encounterState);
  const benefitRequestBefore = structuredClone(benefitMutation.addressRequest);
  const benefitRequestHazardBefore = structuredClone(benefitMutation.addressRequest.previousHazard);
  assert.notStrictEqual(benefitEvent.previousHazard, benefitEvent.hazard);
  assert.notStrictEqual(benefitEvent.benefit, benefitEvent.previousHazard.removalMethod.criticalSuccessBenefit);
  assert.notStrictEqual(benefitEvent.benefit, benefitEvent.hazard.removalMethod.criticalSuccessBenefit);
  benefitEvent.benefit.benefitId = "changed-benefit-id";
  benefitEvent.benefit.name = "changed-benefit-name";
  benefitEvent.benefit.description = "changed-benefit-description";
  assert.deepEqual(benefitEvent.previousHazard, benefitPreviousHazardBefore);
  assert.deepEqual(benefitEvent.hazard, benefitHazardBefore);
  assert.deepEqual(benefitEvent.previousHazard.removalMethod.criticalSuccessBenefit, benefitPreviousDescriptorBefore);
  assert.deepEqual(benefitEvent.hazard.removalMethod.criticalSuccessBenefit, benefitTerminalDescriptorBefore);
  assert.deepEqual(benefitMutation.result.nextState, benefitNextStateBefore);
  assert.deepEqual(benefitMutation.encounterState, benefitStateBefore);
  assert.deepEqual(benefitMutation.addressRequest, benefitRequestBefore);
  assert.deepEqual(benefitMutation.addressRequest.previousHazard, benefitRequestHazardBefore);
});

function equivalentAddressCall(outcome) {
  const other = hazard("arkengine", "other-hazard");
  const target = hazard("crew-morale", "target-hazard");
  target.removalMethod = getVoyagePressureBreachHazardDefinition("crew-morale").definition.removalMethod;
  const encounterState = state("crew-morale", [other, target]);
  const addressRequest = request(encounterState, outcome, 1);
  const stateBefore = structuredClone(encounterState);
  const requestBefore = structuredClone(addressRequest);
  const result = applyVoyageAddressHazard(encounterState, addressRequest);
  return { encounterState, addressRequest, result, stateBefore, requestBefore };
}

test("equivalent successful Address Hazard calls are deterministic and isolated", () => {
  for (const outcome of ["success", "critical-success"]) {
    const first = equivalentAddressCall(outcome);
    const second = equivalentAddressCall(outcome);
    assert.deepEqual(first.result, second.result, outcome);
    assert.deepEqual(first.result.nextState, second.result.nextState, `${outcome}:nextState`);
    assert.deepEqual(first.result.events[0], second.result.events[0], `${outcome}:event`);
    assert.deepEqual(first.result.events[0].hazard, second.result.events[0].hazard, `${outcome}:terminal`);
    assert.deepEqual(first.result.events[0].benefit, second.result.events[0].benefit, `${outcome}:benefit`);
    assert.deepEqual(first.encounterState, first.stateBefore, `${outcome}:first state`);
    assert.deepEqual(second.encounterState, second.stateBefore, `${outcome}:second state`);
    assert.deepEqual(first.addressRequest, first.requestBefore, `${outcome}:first request`);
    assert.deepEqual(second.addressRequest, second.requestBefore, `${outcome}:second request`);

    const secondResultBeforeMutation = structuredClone(second.result);
    first.result.events[0].previousHazard.currentEffect.nested.values[0] = "changed-first-previous";
    first.result.events[0].hazard.currentEffect.nested.values[0] = "changed-first-terminal";
    if (first.result.events[0].benefit !== null) first.result.events[0].benefit.name = "changed-first-benefit";
    first.result.nextState.activeHazards[0].currentEffect.nested.values[0] = "changed-first-remaining";
    assert.deepEqual(second.result, secondResultBeforeMutation, `${outcome}:cross-call isolation`);
    assert.deepEqual(first.encounterState, first.stateBefore, `${outcome}:caller state isolation`);
    assert.deepEqual(first.addressRequest, first.requestBefore, `${outcome}:caller request isolation`);
    assert.deepEqual(second.encounterState, second.stateBefore, `${outcome}:other caller state isolation`);
    assert.deepEqual(second.addressRequest, second.requestBefore, `${outcome}:other caller request isolation`);

    const firstResultBeforeSecondMutation = structuredClone(first.result);
    second.result.events[0].previousHazard.currentEffect.nested.values[0] = "changed-second-previous";
    second.result.events[0].hazard.currentEffect.nested.values[0] = "changed-second-terminal";
    if (second.result.events[0].benefit !== null) second.result.events[0].benefit.name = "changed-second-benefit";
    second.result.nextState.activeHazards[0].currentEffect.nested.values[0] = "changed-second-remaining";
    assert.deepEqual(first.result, firstResultBeforeSecondMutation, `${outcome}:reverse cross-call isolation`);
    assert.deepEqual(first.encounterState, first.stateBefore, `${outcome}:reverse caller state isolation`);
    assert.deepEqual(first.addressRequest, first.requestBefore, `${outcome}:reverse caller request isolation`);
    assert.deepEqual(second.encounterState, second.stateBefore, `${outcome}:reverse other caller state isolation`);
    assert.deepEqual(second.addressRequest, second.requestBefore, `${outcome}:reverse other caller request isolation`);
  }
});

test("failure and critical-failure preserve each Hazard and delegate exact Pressure effects for all systems", () => {
  for (const pressureSystemId of VOYAGE_PRESSURE_SYSTEM_IDS) {
    for (const [outcome, delta] of [["failure", 1], ["critical-failure", 2]]) {
      const encounterState = state(pressureSystemId);
      const before = structuredClone(encounterState);
      const result = applyVoyageAddressHazard(encounterState, request(encounterState, outcome));
      assert.equal(result.ok, true, `${pressureSystemId}:${outcome}`);
      assert.equal(result.events.length, 1);
      assert.equal(result.events[0].type, "voyage.pressure-applied");
      assert.equal(result.events[0].effects[0].sourceKind, "hazard-address-failure");
      assert.equal(result.events[0].effects[0].sourceIntentId, before.activeHazards[0].hazardId);
      assert.equal(result.nextState.pressureSystems[pressureSystemId].value, delta);
      assert.deepEqual(result.nextState.activeHazards, before.activeHazards);
      assert.deepEqual(encounterState, before);
    }
  }
});

test("Address Hazard validates exact requests, optimistic concurrency, live index, snapshots, removal method, and outcomes", () => {
  const cases = [
    ["extra key", (value) => { value.extra = true; }, "address-hazard-request-invalid"],
    ["wrong encounter", (value) => { value.encounterId = "other"; }, "address-hazard-encounter-mismatch"],
    ["wrong revision", (value) => { value.expectedRevision = 1; }, "address-hazard-revision-mismatch"],
    ["out of range", (value) => { value.existingHazardIndex = 2; }, "address-hazard-index-invalid"],
    ["wrong id", (value) => { value.hazardId = "other"; }, "address-hazard-live-hazard-mismatch"],
    ["changed snapshot", (value) => { value.previousHazard.currentEffect.effectId = "changed"; }, "address-hazard-snapshot-mismatch"],
    ["wrong removal", (value, encounterState) => { encounterState.activeHazards[0].removalMethod.methodId = "other"; value.previousHazard = structuredClone(encounterState.activeHazards[0]); }, "address-hazard-removal-method-invalid"],
    ["invalid outcome", (value) => { value.outcome = "no-roll"; }, "address-hazard-outcome-invalid"]
  ];
  for (const [label, change, code] of cases) {
    const encounterState = state();
    const value = request(encounterState);
    change(value, encounterState);
    const before = structuredClone(encounterState);
    const result = applyVoyageAddressHazard(encounterState, value);
    assertFailure(result, code);
    assert.deepEqual(encounterState, before, label);
  }
});

test("moved Hazards are stale, critical success requires an authored benefit, and breach handling stays deferred", () => {
  const moved = state("crew-morale", [hazard("arkengine", "other"), hazard("crew-morale", "target")]);
  const stale = request(moved, "success", 1);
  stale.existingHazardIndex = 0;
  assertFailure(applyVoyageAddressHazard(moved, stale), "address-hazard-live-hazard-mismatch");

  const missingBenefit = state();
  delete missingBenefit.activeHazards[0].removalMethod.criticalSuccessBenefit;
  const benefitRequest = request(missingBenefit, "critical-success");
  assertFailure(applyVoyageAddressHazard(missingBenefit, benefitRequest), "address-hazard-critical-benefit-invalid");

  const atCapacity = state();
  atCapacity.pressureSystems["crew-morale"].value = 2;
  const overflow = applyVoyageAddressHazard(atCapacity, request(atCapacity, "failure"));
  assertFailure(overflow, "pressure-breach-required");
  assert.equal(atCapacity.pressureSystems["crew-morale"].value, 2);
});

test("Address Hazard contains hostile data and revision overflow atomically", () => {
  let reads = 0;
  const hostile = {};
  Object.defineProperty(hostile, "kind", { enumerable: true, get() { reads += 1; throw new Error("must not run"); } });
  assertFailure(applyVoyageAddressHazard(state(), hostile), "address-hazard-data-read-failed");
  assert.equal(reads, 0);

  const overflowState = state();
  overflowState.revision = Number.MAX_SAFE_INTEGER;
  assertFailure(applyVoyageAddressHazard(overflowState, request(overflowState, "success")), "address-hazard-revision-overflow");
});

test("Address Hazard request keys are exact and stable", () => {
  const value = request(state());
  assert.deepEqual(Object.keys(value), REQUEST_KEYS);
});
