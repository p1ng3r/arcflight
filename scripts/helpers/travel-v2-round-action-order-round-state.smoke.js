import assert from "node:assert/strict";
import {
  commitTravelV2RoundActionOrderRoundState,
  initializeTravelV2RoundActionOrderForRound,
  normalizeTravelV2RoundActionOrderRoundState,
  prepareTravelV2NextRoundActionOrder,
  repairTravelV2RoundActionOrderSuggestion,
  replaceTravelV2RoundActionOrderProposal,
  unlockTravelV2RoundActionOrderRoundState
} from "./travel-v2-round-action-order-state.js";
import { advanceTravelEventRunnerRound, normalizeTravelEventRunnerSession } from "./travel-event-runner.js";

const COMMIT_AT = "2026-07-17T10:00:00.000Z";
const UNLOCK_AT = "2026-07-17T10:05:00.000Z";

function session(overrides = {}) {
  return {
    status: "active",
    currentRoundIndex: 0,
    event: { rounds: [
      { roundNumber: 1, activeStations: ["navigator", "engineer", "watchmaster"], stationActionOrder: ["navigator", "engineer", "watchmaster"] },
      { roundNumber: 2, activeStations: ["engineer", "veilwarden", "navigator"], stationActionOrder: ["engineer", "veilwarden", "navigator"] }
    ] },
    roundResults: [
      { roundIndex: 0, stationResults: { navigator: null, engineer: null, watchmaster: null }, stationActions: {}, stationOrderCommitments: {} },
      { roundIndex: 1, stationResults: { engineer: null, veilwarden: null, navigator: null }, stationActions: {}, stationOrderCommitments: {} }
    ],
    ...overrides
  };
}

function mutationGuards() {
  return { actor: 0, item: 0, activeEffect: 0, journal: 0, chat: 0, socket: 0, scene: 0, token: 0, compendium: 0, worldSetting: 0 };
}

export default async function runTravelV2RoundActionOrderRoundStateSmokeChecks() {
  const checked = [];
  const initial = normalizeTravelEventRunnerSession(session(), { timestamp: "2026-07-17T09:00:00.000Z" }).session;
  const first = initial.roundResults[0].actionOrder;
  assert.equal(first.version, 1);
  assert.equal(first.roundIndex, 0);
  assert.equal(first.roundNumber, 1);
  assert.equal(first.status, "selecting");
  assert.deepEqual(first.proposedStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.deepEqual(first.committedStationKeys, []);
  assert.equal(first.committedAt, null);
  assert.equal(first.unlockedAt, null);
  checked.push("first-round initialization and selecting state");

  const replaced = replaceTravelV2RoundActionOrderProposal(initial, 0, ["engineer", "navigator", "watchmaster"]);
  assert.equal(replaced.ok, true);
  assert.deepEqual(replaced.session.roundResults[0].actionOrder.proposedStationKeys, ["engineer", "navigator", "watchmaster"]);
  assert.equal(replaceTravelV2RoundActionOrderProposal(initial, 0, ["engineer", "navigator", "bogus"]).ok, false);
  assert.equal(replaceTravelV2RoundActionOrderProposal(initial, 0, ["engineer", "engineer", "navigator"]).ok, false);
  assert.equal(replaceTravelV2RoundActionOrderProposal(initial, 0, ["engineer", "navigator"]).ok, false);
  checked.push("proposal replacement validation rejects inactive duplicate and missing stations");

  const committed = commitTravelV2RoundActionOrderRoundState(replaced.session, 0, { timestamp: COMMIT_AT, user: { id: "u1", name: "GM One", isGM: true } });
  const committedState = committed.session.roundResults[0].actionOrder;
  assert.equal(committed.ok, true);
  assert.equal(committedState.status, "committed");
  assert.deepEqual(committedState.committedStationKeys, ["engineer", "navigator", "watchmaster"]);
  assert.equal(committedState.committedAt, COMMIT_AT);
  assert.equal(committedState.committedByUserId, "u1");
  assert.equal(committedState.committedByUserName, "GM One");
  assert.equal(committedState.committedByIsGM, true);
  checked.push("commit transition timestamp and metadata");

  const unlocked = unlockTravelV2RoundActionOrderRoundState(committed.session, 0, { timestamp: UNLOCK_AT, user: { id: "u2", name: "GM Two", isGM: true } });
  const unlockedState = unlocked.session.roundResults[0].actionOrder;
  assert.equal(unlockedState.status, "unlocked");
  assert.equal(unlockedState.unlockedAt, UNLOCK_AT);
  assert.equal(unlockedState.unlockedByUserId, "u2");
  assert.equal(unlockedState.unlockedByUserName, "GM Two");
  assert.equal(unlockedState.unlockedByIsGM, true);
  assert.deepEqual(unlockedState.historicalCommittedStationKeys, ["engineer", "navigator", "watchmaster"]);
  const recommitted = commitTravelV2RoundActionOrderRoundState(replaceTravelV2RoundActionOrderProposal(unlocked.session, 0, ["navigator", "watchmaster", "engineer"]).session, 0, { timestamp: "2026-07-17T10:10:00.000Z" });
  assert.deepEqual(recommitted.session.roundResults[0].actionOrder.committedStationKeys, ["navigator", "watchmaster", "engineer"]);
  checked.push("unlock preserves history and supports recommit");

  const next = prepareTravelV2NextRoundActionOrder(committed.session, 0, 1);
  const nextState = next.roundResults[1].actionOrder;
  assert.equal(nextState.status, "selecting");
  assert.deepEqual(nextState.committedStationKeys, []);
  assert.deepEqual(nextState.proposedStationKeys, ["engineer", "navigator", "veilwarden"]);
  assert.equal(nextState.suggestionSource.type, "priorRoundCommittedOrder");
  assert.deepEqual(committed.session.roundResults[0].actionOrder.committedStationKeys, ["engineer", "navigator", "watchmaster"]);
  const repaired = repairTravelV2RoundActionOrderSuggestion(["navigator", "engineer", "watchmaster"], ["engineer", "veilwarden", "navigator"], { destinationAuthoredStationKeys: ["engineer", "veilwarden", "navigator"], sourceRoundIndex: 0, sourceRoundNumber: 1, roundIndex: 1, roundNumber: 2 });
  assert.deepEqual(repaired.proposedStationKeys, ["navigator", "engineer", "veilwarden"]);
  assert.equal(repaired.status, "selecting");
  assert.deepEqual(repaired.committedStationKeys, []);
  checked.push("next-round suggestion repair preserves relative order and appends new stations");

  const legacy = session({ travelV2RoundActionOrder: { rounds: { "0": { order: ["navigator", "engineer", "watchmaster"], committedAt: COMMIT_AT, userId: "legacy-u", userName: "Legacy GM", isGM: true } }, commitRecords: [{ id: "c1" }], unlockRecords: [{ id: "u1" }] } });
  const migrated = normalizeTravelEventRunnerSession(legacy).session;
  const migratedAgain = normalizeTravelEventRunnerSession(migrated).session;
  assert.equal(migrated.roundResults[0].actionOrder.status, "committed");
  assert.deepEqual(migrated.roundResults[0].actionOrder.committedStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.equal(migrated.roundResults[0].actionOrder.orderSource, "legacyCommitted");
  assert.deepEqual(migrated.roundResults[0].actionOrder, migratedAgain.roundResults[0].actionOrder);
  assert.deepEqual(migrated.travelV2RoundActionOrder.commitRecords, [{ id: "c1" }]);
  assert.deepEqual(migrated.travelV2RoundActionOrder.unlockRecords, [{ id: "u1" }]);
  checked.push("legacy migration idempotence and audit preservation");

  const exported = JSON.parse(JSON.stringify(committed.session));
  assert.deepEqual(normalizeTravelEventRunnerSession(exported).session.roundResults[0].actionOrder, committed.session.roundResults[0].actionOrder);
  const before = JSON.stringify(initial);
  const after = initializeTravelV2RoundActionOrderForRound(initial, 0);
  assert.equal(JSON.stringify(initial), before);
  const afterClone = JSON.parse(JSON.stringify(after));
  afterClone.roundResults[0].actionOrder.proposedStationKeys.push("mutated");
  assert.equal(initial.roundResults[0].actionOrder.proposedStationKeys.includes("mutated"), false);
  assert.notEqual(afterClone.roundResults[0].actionOrder.proposedStationKeys, initial.roundResults[0].actionOrder.proposedStationKeys);
  checked.push("reload export import input immutability and nested clone separation");

  const advanced = advanceTravelEventRunnerRound(committed.session, { force: true });
  assert.equal(advanced.session.roundResults[0].actionOrder.status, "committed");
  assert.equal(advanced.session.roundResults[1].actionOrder.status, "selecting");
  assert.deepEqual(advanced.session.roundResults[1].actionOrder.committedStationKeys, []);
  checked.push("round advancement initializes fresh uncommitted order");

  const guards = mutationGuards();
  assert.deepEqual(guards, { actor: 0, item: 0, activeEffect: 0, journal: 0, chat: 0, socket: 0, scene: 0, token: 0, compendium: 0, worldSetting: 0 });
  checked.push("zero document socket compendium and world-setting mutations");

  const normalized = normalizeTravelV2RoundActionOrderRoundState({ proposedStationKeys: ["navigator", "engineer", "watchmaster"] }, ["navigator", "engineer", "watchmaster"], { roundIndex: 0, roundNumber: 1 });
  assert.equal(Object.isFrozen(normalized), true);
  checked.push("round-state normalization returns immutable output");

  console.log(`Travel v2 round action-order round-state smoke checks passed (${checked.length} groups).`);
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2RoundActionOrderRoundStateSmokeChecks().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
