import assert from "node:assert/strict";
import test from "node:test";
import { createVoyageEncounterState } from "../../../scripts/voyage/domain/state.js";
import { applyVoyageEncounterPendingCheckPreparation } from "../../../scripts/voyage/domain/pending-checks.js";
import { applyVoyageEncounterPendingCheckResult } from "../../../scripts/voyage/domain/resolution-results.js";

const RESULT_KEYS = [
  "total",
  "degreeOfSuccess",
  "degreeOfSuccessSlug",
  "statisticSlug",
  "dc",
  "rollMode"
];

const EVENT_KEYS = [
  "type",
  "encounterId",
  "lifecycleState",
  "roundNumber",
  "phase",
  "pendingCheckId",
  "sequence",
  "stationId",
  "actionId",
  "resolvedCheckCount",
  "remainingCheckCount",
  "allChecksResolved",
  "previousRevision",
  "revision"
];
const STATION_IDS = ["captain", "engineer", "navigator", "watchmaster", "veilwarden"];

function encounter({ checks = 1, phase = "resolution", secret = false } = {}) {
  const state = createVoyageEncounterState({
    encounterId: "result-application",
    definitionId: "definition",
    primaryShip: { id: "ship" }
  });
  const availableStations = [];
  const stationAssignments = [];
  const selections = {};

  for (let index = 0; index < checks; index += 1) {
    const stationId = STATION_IDS[index];
    const actionId = `action-${index}`;
    availableStations.push({
      stationId,
      actions: [{
        actionId,
        check: {
          source: { kind: "character", uuid: `Actor.${index}` },
          statisticOptions: ["diplomacy"],
          dcSource: { kind: "fixed", value: 20 + index },
          secrecy: secret ? "secret" : "public"
        }
      }]
    });
    stationAssignments.push({
      stationId,
      operator: { kind: "actor", uuid: `Actor.operator-${index}` }
    });
    selections[stationId] = { stationId, actionId };
  }

  Object.assign(state, {
    lifecycleState: "active",
    currentStage: { stageId: "stage" },
    roundNumber: 1,
    phase,
    availableStations,
    stationAssignments,
    selections
  });

  const prepared = applyVoyageEncounterPendingCheckPreparation(
    state,
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

function executionResult(sequence = 0, overrides = {}) {
  return {
    ok: true,
    status: "rolled",
    pendingCheckId: `pending-${sequence}`,
    sequence,
    sourceKind: "character",
    sourceUuid: `Actor.${sequence}`,
    statisticSlug: "diplomacy",
    dc: 20 + sequence,
    rollMode: "public",
    result: {
      total: 20 + sequence,
      degreeOfSuccess: 2,
      degreeOfSuccessSlug: "success"
    },
    errors: [],
    warnings: [],
    ...overrides
  };
}

function assertAtomicFailure(state, request) {
  const before = structuredClone(state);
  const requestKeysBefore = Reflect.ownKeys(request);
  const requestValuesBefore = requestKeysBefore.map((key) => [key, request[key]]);
  const result = applyVoyageEncounterPendingCheckResult(state, request);

  assert.equal(result.ok, false);
  assert.equal(result.nextState, null);
  assert.deepEqual(result.events, []);
  assert.deepEqual(state, before);
  assert.deepEqual(Reflect.ownKeys(request), requestKeysBefore);
  for (const [key, value] of requestValuesBefore) assert.equal(request[key], value);
  return result;
}

test("persists public and secret results with exactly six isolated fields", () => {
  const publicState = encounter();
  const publicInput = executionResult();
  const publicResult = applyVoyageEncounterPendingCheckResult(publicState, publicInput);
  assert.equal(publicResult.ok, true);
  assert.deepEqual(Object.keys(publicResult.nextState.pendingChecks[0].result), RESULT_KEYS);
  publicInput.result.total = 999;
  assert.equal(publicResult.nextState.pendingChecks[0].result.total, 20);

  const secretState = encounter({ secret: true });
  const secretInput = executionResult(0, { rollMode: "blind" });
  assert.equal(applyVoyageEncounterPendingCheckResult(secretState, secretInput).ok, true);
});

test("accepts every degree/slug pair and reports an exact success event", () => {
  const pairs = [
    [0, "critical-failure"],
    [1, "failure"],
    [2, "success"],
    [3, "critical-success"]
  ];

  for (const [degreeOfSuccess, degreeOfSuccessSlug] of pairs) {
    const result = applyVoyageEncounterPendingCheckResult(
      encounter(),
      executionResult(0, { result: { total: 20, degreeOfSuccess, degreeOfSuccessSlug } })
    );
    assert.equal(result.ok, true, degreeOfSuccessSlug);
    assert.deepEqual(Object.keys(result.events[0]), EVENT_KEYS);
  }
});

test("advances own pending-check counts across two applications", () => {
  const state = encounter({ checks: 2 });
  const first = applyVoyageEncounterPendingCheckResult(state, executionResult(0));
  assert.equal(first.ok, true);
  assert.equal(first.events[0].resolvedCheckCount, 1);
  assert.equal(first.events[0].remainingCheckCount, 1);
  assert.equal(first.events[0].allChecksResolved, false);

  const second = applyVoyageEncounterPendingCheckResult(first.nextState, executionResult(1));
  assert.equal(second.ok, true);
  assert.equal(second.events[0].resolvedCheckCount, 2);
  assert.equal(second.events[0].remainingCheckCount, 0);
  assert.equal(second.events[0].allChecksResolved, true);
});

test("rejects every identity mismatch atomically", () => {
  const mismatches = [
    ["pendingCheckId", "other"],
    ["sequence", 1],
    ["sourceKind", "ship"],
    ["sourceUuid", "Actor.other"],
    ["statisticSlug", "athletics"],
    ["dc", 21],
    ["rollMode", "blind"]
  ];

  for (const [field, value] of mismatches) {
    const request = executionResult();
    request[field] = value;
    assertAtomicFailure(encounter(), request);
  }
});

test("rejects malformed outer and nested execution results, including all extra-key kinds", () => {
  const mutations = [
    (request) => delete request.ok,
    (request) => { request.status = "complete"; },
    (request) => { request.result.total = Number.NaN; },
    (request) => { request.result.degreeOfSuccess = 4; },
    (request) => { request.result.degreeOfSuccessSlug = "failure"; },
    (request) => { request.result.extra = true; },
    (request) => Object.defineProperty(request.result, "extra", { configurable: true, value: true }),
    (request) => { request.result[Symbol("extra")] = true; },
    (request) => { request.rollMode = "publicroll"; },
    (request) => { request.errors = ["not empty"]; }
  ];

  for (const mutate of mutations) {
    const request = executionResult();
    mutate(request);
    assertAtomicFailure(encounter(), request);
  }
});

test("rejects duplicate application and already-resolved targets atomically", () => {
  const state = encounter();
  const first = applyVoyageEncounterPendingCheckResult(state, executionResult());
  assert.equal(first.ok, true);
  assertAtomicFailure(first.nextState, executionResult());
});

test("validates the authoritative collection before matching and ignores inherited entries", () => {
  const invalid = encounter();
  invalid.pendingChecks[0].unexpected = true;
  const failed = assertAtomicFailure(invalid, executionResult());
  assert.ok(failed.errors.length > 0);

  const sparse = encounter();
  sparse.pendingChecks.length = 2;
  const prototype = Object.create(Array.prototype);
  Object.defineProperty(prototype, 1, {
    configurable: true,
    get() {
      throw new Error("inherited pending check must not be read");
    }
  });
  const previous = Object.getPrototypeOf(sparse.pendingChecks);
  Object.setPrototypeOf(sparse.pendingChecks, prototype);
  try {
    assert.equal(applyVoyageEncounterPendingCheckResult(sparse, executionResult()).ok, true);
  } finally {
    Object.setPrototypeOf(sparse.pendingChecks, previous);
  }
});

test("requires Active Resolution and leaves inputs unchanged on every failure", () => {
  for (const mutate of [
    (state) => { state.lifecycleState = "paused"; },
    (state) => { state.phase = "consequences"; },
    (state) => { state.pendingChecks[0].status = "resolved"; }
  ]) {
    const state = encounter();
    mutate(state);
    assertAtomicFailure(state, executionResult());
  }
});

test("does not mutate state or execution input on success", () => {
  const state = encounter();
  const stateBefore = structuredClone(state);
  const request = executionResult();
  const requestBefore = structuredClone(request);
  const result = applyVoyageEncounterPendingCheckResult(state, request);

  assert.equal(result.ok, true);
  assert.deepEqual(state, stateBefore);
  assert.deepEqual(request, requestBefore);
  assert.equal(result.nextState.phase, "resolution");
  assert.equal(result.nextState.revision, state.revision + 1);
});
