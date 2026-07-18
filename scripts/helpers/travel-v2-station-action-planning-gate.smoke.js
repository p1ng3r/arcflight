import assert from "node:assert/strict";
import { normalizeTravelEventRunnerSession } from "./travel-event-runner.js";
import { commitTravelV2RoundActionOrderRoundState } from "./travel-v2-round-action-order-state.js";
import { prepareTravelV2StationActionPlanningGate, TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS } from "./travel-v2-station-action-planning-gate.js";

const NOW = "2026-07-18T00:00:00.000Z";
const STATIONS = Object.freeze(["captain", "navigator", "engineer"]);
const FORBIDDEN_KEYS = Object.freeze([
  "auditRecord",
  "commitRecords",
  "userId",
  "userName",
  "gmText",
  "applyPayload",
  "targetActorUuid",
  "mutationScope",
  "internalMutation",
  "secret",
  "pendingConsequenceQueue",
  "gmOnly",
  "unrevealedHazard",
  "catalogSuggestions"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseSession(overrides = {}) {
  const event = {
    key: "planning-gate-event",
    name: "Planning Gate Event",
    category: "travel",
    rounds: [1, 2].map((round) => ({
      round,
      roundNumber: round,
      title: `Round ${round}`,
      activeStations: [...STATIONS],
      stationPrompts: Object.fromEntries(STATIONS.map((key) => [key, { stationName: key }])),
      stationActionOrder: [...STATIONS]
    }))
  };
  const raw = {
    version: 1,
    key: "planning-gate-session",
    status: "active",
    event,
    currentRoundIndex: 0,
    pressure: {},
    roundPhase: "stationOrders",
    roundResults: event.rounds.map((round, index) => ({
      roundIndex: index,
      roundNumber: round.roundNumber,
      title: round.title,
      stationResults: Object.fromEntries(STATIONS.map((key) => [key, null])),
      stationActions: {},
      stationOrderCommitments: {}
    })),
    startedAt: NOW,
    updatedAt: NOW,
    completedAt: "",
    summary: null,
    ...overrides
  };
  const normalized = normalizeTravelEventRunnerSession(raw, { now: NOW });
  assert.equal(normalized.ok, true);
  return normalized.session;
}

function committedSession(order = STATIONS) {
  const committed = commitTravelV2RoundActionOrderRoundState(baseSession(), 0, { proposedOrder: order, timestamp: NOW });
  assert.equal(committed.ok, true);
  return committed.session;
}

function withCurrentActionOrderPatch(session, patch) {
  const next = clone(session);
  const index = next.currentRoundIndex ?? 0;
  next.roundResults[index].actionOrder = { ...next.roundResults[index].actionOrder, ...patch };
  return next;
}

function assertUnchanged(source, fn) {
  const snapshot = clone(source);
  const result = fn(source);
  assert.deepEqual(source, snapshot);
  return result;
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      keys.push(key);
      collectKeys(entry, keys);
    }
  }
  return keys;
}

function assertPlayerSafe(result) {
  const keys = collectKeys(result);
  for (const forbidden of FORBIDDEN_KEYS) assert(!keys.includes(forbidden), forbidden);
  const text = JSON.stringify(result);
  for (const forbidden of ["PRIVATE-GM-NOTE", "private-user-id", "hidden-trigger", "secret-value"]) assert(!text.includes(forbidden), forbidden);
}

export default function runTravelV2StationActionPlanningGateSmokeChecks() {
  let groups = 0;
  function group(name, fn) { fn(); groups += 1; }

  group("valid committed planning permits an active committed station", () => {
    const source = committedSession();
    const gate = assertUnchanged(source, (session) => prepareTravelV2StationActionPlanningGate(session, "navigator"));
    assert.equal(gate.allowed, true);
    assert.equal(gate.blocked, false);
    assert.equal(gate.reasonCode, "");
    assert.deepEqual(gate.committedStationKeys, STATIONS);
    assertPlayerSafe(gate);
  });

  group("uncommitted planning is rejected", () => {
    const gate = prepareTravelV2StationActionPlanningGate(baseSession(), "navigator");
    assert.equal(gate.allowed, false);
    assert.equal(gate.reasonCode, TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS.PLANNING_NOT_COMMITTED);
  });

  group("stale-round planning is rejected", () => {
    const source = withCurrentActionOrderPatch(committedSession(), { roundIndex: 1, roundNumber: 2 });
    const gate = prepareTravelV2StationActionPlanningGate(source, "navigator");
    assert.equal(gate.allowed, false);
    assert.equal(gate.reasonCode, TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS.STALE_PLANNING_ROUND);
  });

  group("missing planning state is rejected", () => {
    const source = clone(committedSession());
    delete source.roundResults[0].actionOrder;
    const gate = prepareTravelV2StationActionPlanningGate(source, "navigator");
    assert.equal(gate.allowed, false);
    assert.equal(gate.reasonCode, TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS.MISSING_PLANNING_STATE);
  });

  group("duplicate committed keys are rejected", () => {
    const source = withCurrentActionOrderPatch(committedSession(), { committedStationKeys: ["captain", "captain", "engineer"] });
    const gate = prepareTravelV2StationActionPlanningGate(source, "captain");
    assert.equal(gate.allowed, false);
    assert.equal(gate.reasonCode, TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS.INVALID_COMMITTED_ORDER);
  });

  group("missing active keys are rejected", () => {
    const source = withCurrentActionOrderPatch(committedSession(), { committedStationKeys: ["captain", "navigator"] });
    const gate = prepareTravelV2StationActionPlanningGate(source, "captain");
    assert.equal(gate.allowed, false);
    assert.equal(gate.reasonCode, TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS.INVALID_COMMITTED_ORDER);
  });

  group("extra committed keys are rejected", () => {
    const source = withCurrentActionOrderPatch(committedSession(), { committedStationKeys: ["captain", "navigator", "engineer", "watchmaster"] });
    const gate = prepareTravelV2StationActionPlanningGate(source, "captain");
    assert.equal(gate.allowed, false);
    assert.equal(gate.reasonCode, TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS.INVALID_COMMITTED_ORDER);
  });

  group("inactive station requests are rejected", () => {
    const source = committedSession();
    const gate = prepareTravelV2StationActionPlanningGate(source, "watchmaster");
    assert.equal(gate.allowed, false);
    assert.equal(gate.reasonCode, TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS.STATION_NOT_ACTIVE);
  });

  group("blocked and allowed checks leave every input deeply unchanged", () => {
    const allowedSource = committedSession();
    assertUnchanged(allowedSource, (session) => prepareTravelV2StationActionPlanningGate(session, "engineer"));
    const blockedSource = withCurrentActionOrderPatch(committedSession(), {
      status: "selecting",
      gmOnly: { note: "PRIVATE-GM-NOTE" },
      auditRecord: { userId: "private-user-id" },
      secret: "secret-value",
      futureTrigger: "hidden-trigger"
    });
    const blocked = assertUnchanged(blockedSource, (session) => prepareTravelV2StationActionPlanningGate(session, "engineer"));
    assert.equal(blocked.reasonCode, TRAVEL_V2_STATION_ACTION_PLANNING_GATE_REASONS.PLANNING_NOT_COMMITTED);
    assert.throws(() => { blocked.activeStationKeys.push("watchmaster"); }, TypeError);
    assertPlayerSafe(blocked);
  });

  group("rejection results contain no hidden or GM-only fields", () => {
    const source = withCurrentActionOrderPatch(committedSession(), {
      status: "unlocked",
      committedByUserId: "private-user-id",
      committedByUserName: "Private GM",
      gmOnly: { note: "PRIVATE-GM-NOTE" },
      applyPayload: { secret: "secret-value" },
      pendingConsequenceQueue: [{ unrevealedHazard: "hidden-trigger" }]
    });
    const gate = prepareTravelV2StationActionPlanningGate(source, "navigator");
    assert.equal(gate.allowed, false);
    assertPlayerSafe(gate);
  });

  return { groups };
}
