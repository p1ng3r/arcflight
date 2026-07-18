import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  commitTravelV2RoundActionOrderRoundState,
  commitTravelV2RoundActionOrderToSession,
  initializeTravelV2RoundActionOrderForRound,
  normalizeTravelV2RoundActionOrderRoundState,
  prepareTravelV2NextRoundActionOrder,
  repairTravelV2RoundActionOrderSuggestion,
  replaceTravelV2RoundActionOrderProposal,
  unlockTravelV2RoundActionOrderRoundState,
  unlockTravelV2RoundActionOrderInSession
} from "./travel-v2-round-action-order-state.js";
import { advanceTravelEventRunnerRound, normalizeTravelEventRunnerSession, prepareTravelEventRunnerState } from "./travel-event-runner.js";

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

function snapshot(value) {
  return JSON.stringify(value);
}

function installMutationSentinels() {
  const previous = {
    game: globalThis.game,
    Actor: globalThis.Actor,
    Item: globalThis.Item,
    ActiveEffect: globalThis.ActiveEffect,
    ChatMessage: globalThis.ChatMessage,
    JournalEntry: globalThis.JournalEntry,
    Scene: globalThis.Scene,
    TokenDocument: globalThis.TokenDocument
  };
  const counters = { socket: 0, worldSetting: 0, actor: 0, item: 0, activeEffect: 0, chat: 0, journal: 0, scene: 0, token: 0, compendium: 0 };
  const count = (key) => () => { counters[key] += 1; return Promise.resolve(null); };
  const documentStub = (key) => class {
    update() { counters[key] += 1; return Promise.resolve(this); }
    delete() { counters[key] += 1; return Promise.resolve(null); }
    static create() { counters[key] += 1; return Promise.resolve(null); }
    static updateDocuments() { counters[key] += 1; return Promise.resolve([]); }
    static deleteDocuments() { counters[key] += 1; return Promise.resolve([]); }
  };
  globalThis.game = {
    ...(previous.game && typeof previous.game === "object" ? previous.game : {}),
    socket: { emit: count("socket") },
    settings: { set: count("worldSetting") },
    packs: new Map([["arcflight.test", { set: count("compendium"), update: count("compendium"), delete: count("compendium"), createDocument: count("compendium"), importDocument: count("compendium") }]])
  };
  globalThis.Actor = documentStub("actor");
  globalThis.Item = documentStub("item");
  globalThis.ActiveEffect = documentStub("activeEffect");
  globalThis.ChatMessage = { create: count("chat") };
  globalThis.JournalEntry = { create: count("journal") };
  globalThis.Scene = documentStub("scene");
  globalThis.TokenDocument = documentStub("token");
  return {
    counters,
    restore() {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  };
}

function assertNoObviousProductionWrites() {
  const files = [
    "scripts/helpers/travel-v2-round-action-order-state.js",
    "scripts/helpers/travel-event-runner.js"
  ];
  const forbidden = [/\.socket\.emit\s*\(/, /\.settings\.set\s*\(/, /ChatMessage\.create\s*\(/, /JournalEntry\.create\s*\(/, /\.update\s*\(/, /\.delete\s*\(/, /\.create\s*\(/];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(text), false, `${file} contains prohibited write-like call ${pattern}`);
    }
  }
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

  const duplicateCommit = commitTravelV2RoundActionOrderRoundState(committed.session, 0, { proposedOrder: ["engineer", "navigator", "watchmaster"], timestamp: "2026-07-17T10:02:00.000Z" });
  assert.equal(duplicateCommit.ok, true);
  assert.equal(duplicateCommit.duplicate, true);
  assert.equal(duplicateCommit.session.roundResults[0].actionOrder.committedAt, COMMIT_AT);
  assert.deepEqual(duplicateCommit.session.roundResults[0].actionOrder.committedStationKeys, ["engineer", "navigator", "watchmaster"]);
  const blockedDifferentCommit = commitTravelV2RoundActionOrderRoundState(committed.session, 0, { proposedOrder: ["navigator", "engineer", "watchmaster"], timestamp: "2026-07-17T10:03:00.000Z" });
  assert.equal(blockedDifferentCommit.ok, false);
  assert.match(blockedDifferentCommit.reason, /explicitly unlocked/);
  assert.deepEqual(blockedDifferentCommit.session.roundResults[0].actionOrder.committedStationKeys, ["engineer", "navigator", "watchmaster"]);
  assert.equal(blockedDifferentCommit.session.roundResults[0].actionOrder.committedAt, COMMIT_AT);
  assert.equal(blockedDifferentCommit.session.roundResults[0].actionOrder.unlockedAt, null);
  assert.equal(blockedDifferentCommit.session.roundResults[0].actionOrder.unlockedByUserId, null);
  assert.equal(blockedDifferentCommit.session.roundResults[0].actionOrder.unlockedByUserName, null);
  const blockedReplacement = replaceTravelV2RoundActionOrderProposal(committed.session, 0, ["navigator", "engineer", "watchmaster"]);
  assert.equal(blockedReplacement.ok, false);
  assert.match(blockedReplacement.reason, /explicitly unlocked/);
  assert.deepEqual(blockedReplacement.session.roundResults[0].actionOrder.committedStationKeys, ["engineer", "navigator", "watchmaster"]);
  assert.equal(blockedReplacement.session.roundResults[0].actionOrder.unlockedAt, null);
  assert.equal(blockedReplacement.session.roundResults[0].actionOrder.unlockedByUserId, null);
  assert.equal(blockedReplacement.session.roundResults[0].actionOrder.unlockedByUserName, null);
  checked.push("commit and replacement while committed require explicit unlock unless duplicate");

  const unlocked = unlockTravelV2RoundActionOrderRoundState(committed.session, 0, { timestamp: UNLOCK_AT, user: { id: "u2", name: "GM Two", isGM: true } });
  const unlockedState = unlocked.session.roundResults[0].actionOrder;
  assert.equal(unlockedState.status, "unlocked");
  assert.equal(unlockedState.unlockedAt, UNLOCK_AT);
  assert.equal(unlockedState.unlockedByUserId, "u2");
  assert.equal(unlockedState.unlockedByUserName, "GM Two");
  assert.equal(unlockedState.unlockedByIsGM, true);
  assert.deepEqual(unlockedState.historicalCommittedStationKeys, ["engineer", "navigator", "watchmaster"]);
  const unlockedReplacement = replaceTravelV2RoundActionOrderProposal(unlocked.session, 0, ["navigator", "watchmaster", "engineer"]);
  assert.equal(unlockedReplacement.ok, true);
  const recommitted = commitTravelV2RoundActionOrderRoundState(unlockedReplacement.session, 0, { timestamp: "2026-07-17T10:10:00.000Z" });
  assert.deepEqual(recommitted.session.roundResults[0].actionOrder.committedStationKeys, ["navigator", "watchmaster", "engineer"]);
  const secondReplacement = replaceTravelV2RoundActionOrderProposal(unlocked.session, 0, ["engineer", "watchmaster", "navigator"]);
  const secondCommit = commitTravelV2RoundActionOrderRoundState(secondReplacement.session, 0, { timestamp: "2026-07-17T10:12:00.000Z" });
  const secondUnlock = unlockTravelV2RoundActionOrderRoundState(secondCommit.session, 0, { timestamp: "2026-07-17T10:13:00.000Z" });
  assert.deepEqual(secondUnlock.session.roundResults[0].actionOrder.historicalCommittedStationKeys, ["engineer", "watchmaster", "navigator"]);
  checked.push("unlock preserves exact historical order and supports explicit replacement after unlock");

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

  const legacyCommitRecord = { id: "c1", type: "roundActionOrderCommit", roundIndex: 0, roundNumber: 1, committedOrder: ["navigator", "engineer", "watchmaster"], timestamp: COMMIT_AT, userId: "legacy-u", userName: "Legacy GM", isGM: true };
  const legacy = session({ travelV2RoundActionOrder: { rounds: { "0": { order: ["navigator", "engineer", "watchmaster"], committedAt: COMMIT_AT, userId: "legacy-u", userName: "Legacy GM", isGM: true } }, commitRecords: [legacyCommitRecord], unlockRecords: [{ id: "u1" }] } });
  const migrated = normalizeTravelEventRunnerSession(legacy).session;
  const migratedAgain = normalizeTravelEventRunnerSession(migrated).session;
  assert.equal(migrated.roundResults[0].actionOrder.status, "committed");
  assert.deepEqual(migrated.roundResults[0].actionOrder.committedStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.equal(migrated.roundResults[0].actionOrder.orderSource, "legacyCommitted");
  assert.deepEqual(migrated.roundResults[0].actionOrder, migratedAgain.roundResults[0].actionOrder);
  assert.deepEqual(migrated.travelV2RoundActionOrder.commitRecords, [legacyCommitRecord]);
  assert.deepEqual(migrated.travelV2RoundActionOrder.unlockRecords, [{ id: "u1" }]);

  const legacyUnlockRecord = { id: "u2", type: "roundActionOrderUnlock", roundIndex: 0, roundNumber: 1, previousOrder: ["navigator", "engineer", "watchmaster"], timestamp: UNLOCK_AT, userId: "unlock-u", userName: "Unlock GM", isGM: true };
  const rawLegacyUnlocked = session({ travelV2RoundActionOrder: { rounds: {}, commitRecords: [legacyCommitRecord], unlockRecords: [legacyUnlockRecord] } });
  const migratedUnlocked = normalizeTravelEventRunnerSession(rawLegacyUnlocked).session;
  const migratedUnlockedState = migratedUnlocked.roundResults[0].actionOrder;
  assert.equal(migratedUnlockedState.status, "unlocked");
  assert.deepEqual(migratedUnlockedState.proposedStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.deepEqual(migratedUnlockedState.committedStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.deepEqual(migratedUnlockedState.historicalCommittedStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.equal(migratedUnlockedState.committedAt, COMMIT_AT);
  assert.equal(migratedUnlockedState.committedByUserId, "legacy-u");
  assert.equal(migratedUnlockedState.committedByUserName, "Legacy GM");
  assert.equal(migratedUnlockedState.unlockedAt, UNLOCK_AT);
  assert.equal(migratedUnlockedState.unlockedByUserId, "unlock-u");
  assert.equal(migratedUnlockedState.unlockedByUserName, "Unlock GM");
  assert.equal(migratedUnlockedState.unlockedByIsGM, true);
  assert.equal(migratedUnlockedState.orderSource, "legacyCommitted");

  const fabricatedUnlockOnly = normalizeTravelEventRunnerSession(session({ travelV2RoundActionOrder: { rounds: {}, commitRecords: [], unlockRecords: [legacyUnlockRecord] } })).session;
  assert.notEqual(fabricatedUnlockOnly.roundResults[0].actionOrder.status, "unlocked");
  assert.deepEqual(fabricatedUnlockOnly.roundResults[0].actionOrder.committedStationKeys, []);

  const laterCommit = { ...legacyCommitRecord, id: "c2", committedOrder: ["engineer", "watchmaster", "navigator"], timestamp: "2026-07-17T10:06:00.000Z", userId: "recommit-u", userName: "Recommit GM" };
  const migratedRecommitted = normalizeTravelEventRunnerSession(session({ travelV2RoundActionOrder: { rounds: {}, commitRecords: [legacyCommitRecord, laterCommit], unlockRecords: [legacyUnlockRecord] } })).session;
  assert.equal(migratedRecommitted.roundResults[0].actionOrder.status, "committed");
  assert.deepEqual(migratedRecommitted.roundResults[0].actionOrder.committedStationKeys, ["engineer", "watchmaster", "navigator"]);
  assert.equal(migratedRecommitted.roundResults[0].actionOrder.committedByUserId, "recommit-u");

  const duplicateLegacyCommit = commitTravelV2RoundActionOrderToSession(legacy, ["navigator", "engineer", "watchmaster"], { commitRequested: true, user: { isGM: true } });
  assert.equal(duplicateLegacyCommit.duplicate, true);
  assert.equal(duplicateLegacyCommit.session.roundResults[0].actionOrder.status, "committed");
  assert.deepEqual(duplicateLegacyCommit.session.travelV2RoundActionOrder.commitRecords, [legacyCommitRecord]);
  checked.push("legacy committed unlocked fabricated and recommitted migration is deterministic and idempotent");

  const canonicalOnlyCommitted = commitTravelV2RoundActionOrderRoundState(replaced.session, 0, { timestamp: "2026-07-17T11:00:00.000Z", user: { id: "canonical-u", name: "Canonical GM", isGM: true } }).session;
  assert.equal(canonicalOnlyCommitted.travelV2RoundActionOrder, undefined);
  const canonicalOnlyBefore = JSON.stringify(canonicalOnlyCommitted);
  const blockedWrapperCommit = commitTravelV2RoundActionOrderToSession(canonicalOnlyCommitted, ["navigator", "engineer", "watchmaster"], { commitRequested: true, timestamp: "2026-07-17T11:01:00.000Z", user: { isGM: true } });
  assert.equal(blockedWrapperCommit.ok, false);
  assert.equal(blockedWrapperCommit.committed, false);
  assert.equal(blockedWrapperCommit.blocked, true);
  assert.equal(blockedWrapperCommit.session.travelV2RoundActionOrder, undefined);
  assert.deepEqual(blockedWrapperCommit.session.roundResults[0].actionOrder.committedStationKeys, ["engineer", "navigator", "watchmaster"]);
  assert.equal(blockedWrapperCommit.session.roundResults[0].actionOrder.committedAt, "2026-07-17T11:00:00.000Z");
  assert.equal(JSON.stringify(canonicalOnlyCommitted), canonicalOnlyBefore);

  const duplicateWrapperCommit = commitTravelV2RoundActionOrderToSession(canonicalOnlyCommitted, ["engineer", "navigator", "watchmaster"], { commitRequested: true, timestamp: "2026-07-17T11:02:00.000Z", user: { isGM: true } });
  assert.equal(duplicateWrapperCommit.ok, true);
  assert.equal(duplicateWrapperCommit.duplicate, true);
  assert.equal(duplicateWrapperCommit.committed, false);
  assert.equal(duplicateWrapperCommit.session.travelV2RoundActionOrder, undefined);
  assert.equal(duplicateWrapperCommit.session.roundResults[0].actionOrder.committedAt, "2026-07-17T11:00:00.000Z");

  const canonicalOnlyUnlock = unlockTravelV2RoundActionOrderInSession(canonicalOnlyCommitted, { unlockRequested: true, timestamp: "2026-07-17T11:03:00.000Z", user: { id: "unlock-wrapper-u", name: "Unlock Wrapper GM", isGM: true } });
  assert.equal(canonicalOnlyUnlock.ok, true);
  assert.equal(canonicalOnlyUnlock.unlocked, true);
  assert.equal(canonicalOnlyUnlock.session.travelV2RoundActionOrder.unlockRecords.length, 1);
  assert.equal(canonicalOnlyUnlock.session.roundResults[0].actionOrder.status, "unlocked");
  assert.deepEqual(canonicalOnlyUnlock.session.roundResults[0].actionOrder.historicalCommittedStationKeys, ["engineer", "navigator", "watchmaster"]);
  assert.deepEqual(canonicalOnlyUnlock.session.roundResults[0].actionOrder.proposedStationKeys, ["engineer", "navigator", "watchmaster"]);
  assert.deepEqual(canonicalOnlyUnlock.session.roundResults[0].actionOrder.committedStationKeys, ["engineer", "navigator", "watchmaster"]);

  const duplicateWrapperUnlock = unlockTravelV2RoundActionOrderInSession(canonicalOnlyUnlock.session, { unlockRequested: true, timestamp: "2026-07-17T11:04:00.000Z", user: { id: "second-unlock-u", name: "Second Unlock GM", isGM: true } });
  assert.equal(duplicateWrapperUnlock.ok, true);
  assert.equal(duplicateWrapperUnlock.duplicate, true);
  assert.equal(duplicateWrapperUnlock.session.travelV2RoundActionOrder.unlockRecords.length, 1);
  assert.equal(duplicateWrapperUnlock.session.roundResults[0].actionOrder.unlockedAt, "2026-07-17T11:03:00.000Z");
  assert.equal(duplicateWrapperUnlock.session.roundResults[0].actionOrder.unlockedByUserId, "unlock-wrapper-u");

  const rawLegacyUnlockDuplicate = unlockTravelV2RoundActionOrderInSession(rawLegacyUnlocked, { unlockRequested: true, timestamp: "2026-07-17T11:05:00.000Z", user: { isGM: true } });
  assert.equal(rawLegacyUnlockDuplicate.ok, true);
  assert.equal(rawLegacyUnlockDuplicate.duplicate, true);
  assert.equal(rawLegacyUnlockDuplicate.session.roundResults[0].actionOrder.status, "unlocked");
  assert.equal(rawLegacyUnlockDuplicate.session.travelV2RoundActionOrder.unlockRecords.length, 1);

  const selectingUnlockBlocked = unlockTravelV2RoundActionOrderInSession(initial, { unlockRequested: true, timestamp: "2026-07-17T11:06:00.000Z", user: { isGM: true } });
  assert.equal(selectingUnlockBlocked.ok, false);
  assert.equal(selectingUnlockBlocked.unlocked, false);
  assert.equal(selectingUnlockBlocked.session.travelV2RoundActionOrder, undefined);
  checked.push("legacy wrappers honor canonical-only commit unlock duplicate and blocked states");

  const authoredSecretSession = commitTravelV2RoundActionOrderRoundState(normalizeTravelEventRunnerSession(session({ event: { rounds: [{ roundNumber: 1, activeStations: ["navigator", "engineer", "watchmaster"], stationActionOrder: ["navigator", "engineer", "watchmaster"], openingVignette: "The crew follows a secret star." }] } })).session, 0, { timestamp: COMMIT_AT, user: { id: "secret-user-id", name: "Secret Keeper", isGM: true } }).session;
  const nonGmState = prepareTravelEventRunnerState(authoredSecretSession, { user: { isGM: false } });
  const safeActionOrder = nonGmState.session.roundResults[0].actionOrder;
  assert.equal(safeActionOrder.status, "committed");
  assert.deepEqual(safeActionOrder.proposedStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.deepEqual(safeActionOrder.committedStationKeys, ["navigator", "engineer", "watchmaster"]);
  assert.equal(Object.hasOwn(safeActionOrder, "committedByUserId"), false);
  assert.equal(Object.hasOwn(safeActionOrder, "committedByUserName"), false);
  assert.equal(Object.hasOwn(safeActionOrder, "unlockedByUserId"), false);
  assert.equal(Object.hasOwn(safeActionOrder, "unlockedByUserName"), false);
  const safeText = snapshot(nonGmState);
  assert.equal(safeText.includes("auditRecord"), false);
  assert.equal(safeText.includes("commitRecords"), false);
  assert.equal(safeText.includes("userId"), false);
  assert.equal(safeText.includes("userName"), false);
  assert.equal(safeText.includes("The crew follows a secret star."), true);
  checked.push("non-GM actionOrder redacts identity metadata without rewriting authored text");

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

  const sentinels = installMutationSentinels();
  try {
    const sentinelBase = normalizeTravelEventRunnerSession(session()).session;
    const sentinelProposal = replaceTravelV2RoundActionOrderProposal(sentinelBase, 0, ["engineer", "navigator", "watchmaster"]);
    const sentinelCommit = commitTravelV2RoundActionOrderRoundState(sentinelProposal.session, 0, { timestamp: COMMIT_AT });
    const sentinelUnlock = unlockTravelV2RoundActionOrderRoundState(sentinelCommit.session, 0, { timestamp: UNLOCK_AT });
    prepareTravelV2NextRoundActionOrder(sentinelCommit.session, 0, 1);
    initializeTravelV2RoundActionOrderForRound(sentinelUnlock.session, 0);
    commitTravelV2RoundActionOrderToSession(sentinelCommit.session, ["engineer", "navigator", "watchmaster"], { commitRequested: true, user: { isGM: true }, timestamp: COMMIT_AT });
    unlockTravelV2RoundActionOrderInSession(sentinelCommit.session, { unlockRequested: true, user: { isGM: true }, timestamp: UNLOCK_AT });
    assert.deepEqual(sentinels.counters, { socket: 0, worldSetting: 0, actor: 0, item: 0, activeEffect: 0, chat: 0, journal: 0, scene: 0, token: 0, compendium: 0 });
  } finally {
    sentinels.restore();
  }
  assertNoObviousProductionWrites();
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
