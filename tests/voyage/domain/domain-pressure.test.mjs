import assert from "node:assert/strict";
import test from "node:test";

import { VOYAGE_PRESSURE_SYSTEM_IDS } from "../../../scripts/voyage/domain/constants.js";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import * as pressureModule from "../../../scripts/voyage/domain/pressure.js";
import {
  analyzeVoyageDomainPressureEffectPlan,
  applyVoyageDomainPressureEffect,
  applyVoyageEncounterPressurePlan
} from "../../../scripts/voyage/domain/pressure.js";

const PRESSURE_SYSTEM_IDS = [...VOYAGE_PRESSURE_SYSTEM_IDS];
const PLAN_KEYS = [
  "structurallyValid",
  "readyForDomainPressurePlanning",
  "kind",
  "encounterId",
  "expectedRevision",
  "pressureSystemId",
  "delta",
  "source",
  "pressureEffectCount",
  "standardPressureEffectCount",
  "authoredPressureEffectCount",
  "effects",
  "errors",
  "warnings"
];
const EFFECT_KEYS = [
  "pressureEffectId",
  "encounterId",
  "stageId",
  "roundNumber",
  "sequence",
  "stationId",
  "actionId",
  "pressureSystemId",
  "delta",
  "timing",
  "sourceKind",
  "sourceIntentId",
  "activationSource",
  "branch",
  "visibility"
];
const EVENT_KEYS = [
  "type",
  "encounterId",
  "lifecycleState",
  "stageId",
  "roundNumber",
  "phase",
  "pressureEffectCount",
  "standardPressureEffectCount",
  "authoredPressureEffectCount",
  "effects",
  "previousPressureSystems",
  "pressureSystems",
  "previousRevision",
  "revision"
];

function domainHazard(encounterId, pressureSystemId, overrides = {}) {
  return {
    hazardId: "hazard-address-1",
    encounterId,
    category: "system",
    status: "active",
    name: "Arc instability",
    currentEffect: { effectId: "current-effect" },
    activationTiming: { kind: "immediate", stationId: null, resultId: null },
    removalMethod: { methodId: "address-hazard", name: "Address Hazard" },
    ignoredConsequence: { consequenceId: "ignored-consequence" },
    visibility: "public",
    sourceKind: "pressure-breach",
    createdStageId: "domain-pressure-stage",
    createdRoundNumber: 1,
    createdSequence: 0,
    escalation: {
      mode: "none",
      currentStageId: null,
      stages: [],
      countdown: null,
      maximumEscalationReached: false,
      escalationConsequence: null
    },
    collisionPolicy: "replace-existing",
    duration: {
      mode: "none",
      remaining: null,
      initial: null,
      decrementTiming: null
    },
    failurePressureSystemId: pressureSystemId,
    resolvedStageId: null,
    resolvedRoundNumber: null,
    terminalReason: null,
    replacedByHazardId: null,
    metadata: { collision: { hazardId: "replacement-hazard" } },
    pressureSystemId,
    eventAreaId: null,
    pressureBreachId: "breach-1",
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

function domainState(encounterId = "domain-pressure-encounter", pressureSystemId = "crew-morale") {
  const state = createVoyageEncounterState({
    encounterId,
    definitionId: "domain-pressure-definition",
    primaryShip: { id: "domain-pressure-ship" }
  });
  state.lifecycleState = "active";
  state.currentStage = { stageId: "domain-pressure-stage" };
  state.roundNumber = 1;
  state.phase = "crew-planning";
  state.activeHazards = [domainHazard(encounterId, pressureSystemId)];
  return state;
}

function requestFor(state, pressureSystemId = "crew-morale", addressOutcome = "failure", existingHazardIndex = 0) {
  const liveHazard = state.activeHazards[existingHazardIndex];
  return {
    kind: "domain-pressure-effect",
    encounterId: state.encounterId,
    expectedRevision: state.revision,
    pressureSystemId,
    delta: addressOutcome === "failure" ? 1 : 2,
    source: {
      kind: "hazard-address-failure",
      hazardId: liveHazard?.hazardId ?? "hazard-address-1",
      existingHazardIndex,
      previousHazard: structuredClone(liveHazard),
      addressOutcome
    }
  };
}

function planFor(state, pressureSystemId = "crew-morale", addressOutcome = "failure") {
  return analyzeVoyageDomainPressureEffectPlan(state, requestFor(state, pressureSystemId, addressOutcome));
}

function assertFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  if (code) assert.ok(result.errors.some((entry) => entry.code === code), code);
}

test("domain Pressure planner accepts both authorized Address Hazard outcomes with exact shapes", () => {
  for (const [addressOutcome, delta] of [["failure", 1], ["critical-failure", 2]]) {
    const state = domainState();
    const request = requestFor(state, "crew-morale", addressOutcome);
    const plan = analyzeVoyageDomainPressureEffectPlan(state, request);

    assert.equal(plan.readyForDomainPressurePlanning, true);
    assert.deepEqual(Object.keys(plan), PLAN_KEYS);
    assert.deepEqual(Object.keys(plan.source), ["kind", "hazardId", "existingHazardIndex", "previousHazard", "addressOutcome"]);
    assert.equal(plan.source.existingHazardIndex, 0);
    assert.deepEqual(plan.source.previousHazard, state.activeHazards[0]);
    assert.equal(plan.delta, delta);
    assert.equal(plan.pressureEffectCount, 1);
    assert.equal(plan.standardPressureEffectCount, 0);
    assert.equal(plan.authoredPressureEffectCount, 1);
    assert.deepEqual(Object.keys(plan.effects[0]), EFFECT_KEYS);
    assert.equal(plan.effects[0].sourceKind, "hazard-address-failure");
    assert.equal(plan.effects[0].sourceIntentId, "hazard-address-1");
    assert.equal(plan.effects[0].activationSource, "hazard");
    assert.equal(plan.effects[0].branch, addressOutcome);
    assert.equal(plan.effects[0].delta, delta);
    assert.equal(plan.effects[0].stationId, null);
    assert.equal(plan.effects[0].actionId, null);
    assert.equal(plan.effects[0].timing, "consequences");
    assert.equal(plan.effects[0].visibility, "public");
  }
});

test("domain Pressure plans are deterministic and isolated from request and result mutation", () => {
  const state = domainState();
  const request = requestFor(state);
  const originalRequest = structuredClone(request);
  const first = planFor(state);
  const second = planFor(state);

  assert.deepEqual(first, second);
  assert.deepEqual(request, originalRequest);
  first.source.hazardId = "mutated";
  first.effects[0].delta = 99;
  assert.equal(second.source.hazardId, "hazard-address-1");
  assert.equal(second.effects[0].delta, 1);
});

test("domain Pressure planner covers every canonical Pressure system", () => {
  for (const pressureSystemId of PRESSURE_SYSTEM_IDS) {
    const state = domainState("domain-pressure-encounter", pressureSystemId);
    const plan = planFor(state, pressureSystemId);
    assert.equal(plan.readyForDomainPressurePlanning, true, pressureSystemId);
    assert.equal(plan.effects[0].pressureSystemId, pressureSystemId);
  }
});

test("domain Pressure request and source schemas reject unsupported or mismatched data", () => {
  const state = domainState("domain-pressure-encounter", "lifeveil");
  const cases = [
    ["unsupported source", { source: { kind: "branch", hazardId: "hazard-address-1", addressOutcome: "failure" } }],
    ["unsupported outcome", { source: { kind: "hazard-address-failure", hazardId: "hazard-address-1", addressOutcome: "success" } }],
    ["mismatched delta", { delta: 2 }],
    ["zero delta", { delta: 0 }],
    ["negative delta", { delta: -1 }],
    ["arbitrary delta", { delta: 3 }],
    ["extra request key", { effectId: "caller-id" }],
    ["extra source key", { source: { kind: "hazard-address-failure", hazardId: "hazard-address-1", addressOutcome: "failure", effectId: "caller-id" } }],
    ["missing source key", { source: { kind: "hazard-address-failure", hazardId: "hazard-address-1" } }],
    ["blank Hazard ID", { source: { kind: "hazard-address-failure", hazardId: " ", addressOutcome: "failure" } }]
  ];

  for (const [label, changes] of cases) {
    const request = requestFor(state, "lifeveil");
    for (const [key, value] of Object.entries(changes)) request[key] = value;
    const result = analyzeVoyageDomainPressureEffectPlan(state, request);
    assert.equal(result.readyForDomainPressurePlanning, false, label);
    assert.deepEqual(result.effects, [], label);
  }
});

test("domain Pressure planner fails closed for accessors, symbols, BigInt, and hostile Proxies", () => {
  const state = domainState();
  let getterCalls = 0;
  const accessorRequest = requestFor(state);
  Object.defineProperty(accessorRequest, "delta", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 1;
    }
  });
  const accessorResult = analyzeVoyageDomainPressureEffectPlan(state, accessorRequest);
  assert.equal(accessorResult.readyForDomainPressurePlanning, false);
  assert.equal(getterCalls, 0);

  const symbolRequest = requestFor(state);
  symbolRequest[Symbol("unexpected")] = true;
  assert.equal(analyzeVoyageDomainPressureEffectPlan(state, symbolRequest).readyForDomainPressurePlanning, false);

  const bigintRequest = requestFor(state);
  bigintRequest.delta = 1n;
  assert.equal(analyzeVoyageDomainPressureEffectPlan(state, bigintRequest).readyForDomainPressurePlanning, false);

  const hostileProxy = new Proxy(requestFor(state), {
    ownKeys() {
      throw new Error("reflection failure");
    }
  });
  assert.equal(analyzeVoyageDomainPressureEffectPlan(state, hostileProxy).readyForDomainPressurePlanning, false);
});

test("valid domain Pressure application changes one system, preserves state, and emits the exact event contract", () => {
  const state = domainState("domain-pressure-encounter", "lifeveil");
  state.unrelated = { keep: true };
  const source = structuredClone(state);
  const request = requestFor(state, "lifeveil", "critical-failure");
  const result = applyVoyageDomainPressureEffect(state, request);

  assert.equal(result.ok, true);
  assert.equal(result.nextState.revision, state.revision + 1);
  assert.equal(result.nextState.pressureSystems.lifeveil.value, 2);
  assert.deepEqual(result.nextState.pressureSystems["crew-morale"], source.pressureSystems["crew-morale"]);
  assert.deepEqual(result.nextState.unrelated, source.unrelated);
  assert.deepEqual(Object.keys(result.events[0]), EVENT_KEYS);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, "voyage.pressure-applied");
  assert.equal(result.events[0].effects[0].sourceKind, "hazard-address-failure");
  assert.equal(result.events[0].effects[0].sourceIntentId, "hazard-address-1");
  assert.equal(result.events.some((event) => event.type.includes("hazard") || event.type.includes("breach")), false);
  assert.equal(state.revision, source.revision);
  assert.deepEqual(state.pressureSystems, source.pressureSystems);
});

test("domain Pressure application preserves all other systems for every target", () => {
  for (const pressureSystemId of PRESSURE_SYSTEM_IDS) {
    const state = domainState("domain-pressure-encounter", pressureSystemId);
    const before = structuredClone(state.pressureSystems);
    const result = applyVoyageDomainPressureEffect(state, requestFor(state, pressureSystemId));
    assert.equal(result.ok, true, pressureSystemId);
    for (const candidate of PRESSURE_SYSTEM_IDS) {
      const expected = before[candidate].value + (candidate === pressureSystemId ? 1 : 0);
      assert.equal(result.nextState.pressureSystems[candidate].value, expected, `${pressureSystemId}:${candidate}`);
    }
  }
});

test("domain Pressure application leaves breach handling to the later transaction", () => {
  const state = domainState();
  state.pressureSystems["crew-morale"].value = 1;
  const result = applyVoyageDomainPressureEffect(state, requestFor(state));
  assert.equal(result.ok, true);
  assert.equal(result.nextState.pressureSystems["crew-morale"].value, 2);
  assert.equal(result.events.length, 1);

  const overflowingState = domainState();
  overflowingState.pressureSystems["crew-morale"].value = 2;
  const overflow = applyVoyageDomainPressureEffect(overflowingState, requestFor(overflowingState));
  assertFailure(overflow, "pressure-breach-required");
  assert.equal(overflowingState.pressureSystems["crew-morale"].value, 2);
});

test("domain Pressure requests bind to the exact live Hazard index and snapshot", () => {
  const movedState = domainState();
  const originalHazard = structuredClone(movedState.activeHazards[0]);
  movedState.activeHazards = [
    domainHazard(movedState.encounterId, "arkengine", { hazardId: "other-hazard" }),
    originalHazard
  ];
  const movedRequest = requestFor(movedState, "crew-morale");
  movedRequest.source.hazardId = originalHazard.hazardId;
  movedRequest.source.previousHazard = originalHazard;
  assert.equal(analyzeVoyageDomainPressureEffectPlan(movedState, movedRequest).readyForDomainPressurePlanning, false);

  const changedState = domainState();
  const changedRequest = requestFor(changedState);
  changedState.activeHazards[0].currentEffect.effectId = "changed-live-effect";
  assert.equal(analyzeVoyageDomainPressureEffectPlan(changedState, changedRequest).readyForDomainPressurePlanning, false);

  const wrongIndexRequest = requestFor(domainState());
  wrongIndexRequest.source.existingHazardIndex = 4;
  assert.equal(analyzeVoyageDomainPressureEffectPlan(domainState(), wrongIndexRequest).readyForDomainPressurePlanning, false);
});

test("domain Pressure requests reject stale Hazard identity, system, category, status, and removal method", () => {
  const identityState = domainState();
  const identityRequest = requestFor(identityState);
  identityRequest.source.hazardId = "wrong-hazard";
  assert.equal(analyzeVoyageDomainPressureEffectPlan(identityState, identityRequest).readyForDomainPressurePlanning, false);

  const systemState = domainState();
  const systemRequest = requestFor(systemState, "arkengine");
  assert.equal(analyzeVoyageDomainPressureEffectPlan(systemState, systemRequest).readyForDomainPressurePlanning, false);

  for (const field of ["category", "status"]) {
    const state = domainState();
    state.activeHazards[0][field] = field === "category" ? "event" : "expired";
    assert.equal(analyzeVoyageDomainPressureEffectPlan(state, requestFor(state)).readyForDomainPressurePlanning, false, field);
  }

  const removalState = domainState();
  removalState.activeHazards[0].removalMethod = { methodId: "other-removal" };
  assert.equal(analyzeVoyageDomainPressureEffectPlan(removalState, requestFor(removalState)).readyForDomainPressurePlanning, false);
});

test("domain Pressure effect identities distinguish all authorized identity inputs", () => {
  const base = planFor(domainState("identity-encounter", "crew-morale"), "crew-morale", "failure");
  const otherSystem = planFor(domainState("identity-encounter", "arkengine"), "arkengine", "failure");
  const critical = planFor(domainState("identity-encounter", "crew-morale"), "crew-morale", "critical-failure");

  const revisionState = domainState("identity-encounter", "crew-morale");
  revisionState.revision = 1;
  const otherRevision = planFor(revisionState, "crew-morale", "failure");

  const otherHazardState = domainState("identity-encounter", "crew-morale");
  otherHazardState.activeHazards[0].hazardId = "other-hazard";
  const otherHazard = planFor(otherHazardState, "crew-morale", "failure");

  const otherStageState = domainState("identity-encounter", "crew-morale");
  otherStageState.currentStage.stageId = "other-stage";
  const otherStage = planFor(otherStageState, "crew-morale", "failure");

  const otherRoundState = domainState("identity-encounter", "crew-morale");
  otherRoundState.roundNumber = 2;
  const otherRound = planFor(otherRoundState, "crew-morale", "failure");

  const ids = [
    base.effects[0].pressureEffectId,
    otherSystem.effects[0].pressureEffectId,
    critical.effects[0].pressureEffectId,
    otherRevision.effects[0].pressureEffectId,
    otherHazard.effects[0].pressureEffectId,
    otherStage.effects[0].pressureEffectId,
    otherRound.effects[0].pressureEffectId
  ];
  assert.equal(new Set(ids).size, ids.length);
  assert.notEqual(base.effects[0].pressureEffectId, "arcflight-pressure-effect:[\"identity-encounter\",\"domain-pressure-stage\",1,0,\"standard-result\"]");
});

test("domain Pressure application accepts the request directly and never accepts a planner result", () => {
  const state = domainState();
  const request = requestFor(state);
  const plan = planFor(state);
  const before = structuredClone(state);
  const result = applyVoyageDomainPressureEffect(state, request);
  assert.equal(result.ok, true);
  assert.equal(result.nextState.pressureSystems["crew-morale"].value, 1);
  assert.equal(Object.hasOwn(pressureModule, "applyVoyageDomainPressureEffectPlan"), false);

  assertFailure(applyVoyageDomainPressureEffect(state, plan), "domain-pressure-request-invalid");
  assert.deepEqual(state, before);
});

test("caller-supplied effect arrays, IDs, and generated effect fields are rejected as request data", () => {
  const state = domainState();
  const forbiddenFields = [
    ["effects", []],
    ["pressureEffectId", "caller-authored-id"],
    ["sequence", 9],
    ["stageId", "caller-stage"],
    ["roundNumber", 9],
    ["timing", "immediate"],
    ["visibility", "gm-secret"],
    ["sourceKind", "caller-source"],
    ["sourceIntentId", "caller-hazard"]
  ];
  for (const [key, value] of forbiddenFields) {
    const request = requestFor(state);
    request[key] = value;
    assertFailure(applyVoyageDomainPressureEffect(state, request), "domain-pressure-request-invalid");
  }
  assert.equal(state.revision, 0);
  assert.equal(state.pressureSystems["crew-morale"].value, 0);
});

test("domain Pressure application isolates plan, next state, event, and effect records", () => {
  const state = domainState();
  const plan = planFor(state);
  const result = applyVoyageDomainPressureEffect(state, requestFor(state));
  assert.equal(result.ok, true);
  assert.notStrictEqual(result.nextState, state);
  assert.notStrictEqual(result.events[0], plan);
  assert.notStrictEqual(result.events[0].effects, plan.effects);
  assert.notStrictEqual(result.events[0].effects[0], plan.effects[0]);
  result.nextState.pressureSystems["crew-morale"].value = 2;
  result.events[0].effects[0].sourceIntentId = "mutated";
  assert.equal(plan.effects[0].delta, 1);
  assert.equal(plan.effects[0].sourceIntentId, "hazard-address-1");
});

test("shared Pressure transition keeps the existing action application path operational", () => {
  const state = domainState();
  const result = applyVoyageEncounterPressurePlan(state);
  assertFailure(result, "pressure-application-plan-not-ready");
});

test("domain Pressure application rejects revision overflow atomically", () => {
  const state = domainState();
  state.revision = Number.MAX_SAFE_INTEGER;
  const result = applyVoyageDomainPressureEffect(state, requestFor(state));
  assertFailure(result);
  assert.equal(state.revision, Number.MAX_SAFE_INTEGER);
  assert.equal(state.pressureSystems["crew-morale"].value, 0);
});
