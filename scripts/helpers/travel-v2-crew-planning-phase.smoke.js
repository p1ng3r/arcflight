import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER, ARCFLIGHT_TRAVEL_ROUND_SEGMENTS, normalizeTravelRoundSegmentKey } from "./travel-round-segments.js";
import { normalizeTravelEventRunnerSession, advanceTravelEventRunnerRoundPhase, retreatTravelEventRunnerRoundPhase, advanceTravelEventRunnerRound, prepareTravelEventRunnerState, prepareTravelV2CrewPlanningPhaseGate, setTravelEventRunnerRoundPhase } from "./travel-event-runner.js";
import { commitTravelV2RoundActionOrderRoundState, unlockTravelV2RoundActionOrderRoundState } from "./travel-v2-round-action-order-state.js";

const NOW = "2026-07-18T00:00:00.000Z";
const stations = ["captain", "navigator", "engineer"];
const event = { key: "crew-planning", name: "Crew Planning", category: "travel", rounds: [1, 2].map((round) => ({ round, roundNumber: round, title: `Round ${round}`, activeStations: stations, stationPrompts: Object.fromEntries(stations.map((key) => [key, { stationName: key }])), stationActionOrder: stations })) };
function rawSession(overrides = {}) { return { version: 1, key: "crew-planning-session", status: "active", event, currentRoundIndex: 0, pressure: {}, roundPhase: "crewPlanning", roundResults: event.rounds.map((round, index) => ({ roundIndex: index, roundNumber: round.roundNumber, title: round.title, stationResults: Object.fromEntries(stations.map((key) => [key, null])), stationActions: {}, stationOrderCommitments: {} })), startedAt: NOW, updatedAt: NOW, completedAt: "", summary: null, ...overrides }; }
function session(overrides = {}) { const normalized = normalizeTravelEventRunnerSession(rawSession(overrides), { now: NOW }); assert.equal(normalized.ok, true); return normalized.session; }
function committed(s = session(), order = stations) { const result = commitTravelV2RoundActionOrderRoundState(s, s.currentRoundIndex ?? 0, { proposedOrder: order, timestamp: NOW }); assert.equal(result.ok, true); return result.session; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function assertFrozenClone(result) { assert.throws(() => { result.proposedStationKeys.push("x"); }, TypeError); }
function withRoundResultPatch(s, patch) {
  const next = clone(s);
  next.roundResults[next.currentRoundIndex ?? 0] = { ...next.roundResults[next.currentRoundIndex ?? 0], ...patch };
  return next;
}
function withEventRoundPatch(s, patch, offset = 0) {
  const next = clone(s);
  const index = (next.currentRoundIndex ?? 0) + offset;
  next.event.rounds[index] = { ...next.event.rounds[index], ...patch };
  return next;
}
function installMutationSentinels() {
  const previous = { game: globalThis.game, Actor: globalThis.Actor, Item: globalThis.Item, ActiveEffect: globalThis.ActiveEffect, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, Scene: globalThis.Scene, TokenDocument: globalThis.TokenDocument, CompendiumCollection: globalThis.CompendiumCollection };
  const counters = { socket: 0, worldSetting: 0, actor: 0, item: 0, activeEffect: 0, chat: 0, journal: 0, scene: 0, token: 0, compendium: 0 };
  const count = (key) => () => { counters[key] += 1; return Promise.resolve(null); };
  const documentStub = (key) => class { update() { counters[key] += 1; return Promise.resolve(this); } delete() { counters[key] += 1; return Promise.resolve(null); } static create() { counters[key] += 1; return Promise.resolve(null); } static updateDocuments() { counters[key] += 1; return Promise.resolve([]); } static deleteDocuments() { counters[key] += 1; return Promise.resolve([]); } };
  globalThis.game = { ...(previous.game && typeof previous.game === "object" ? previous.game : {}), socket: { emit: count("socket") }, settings: { set: count("worldSetting") }, packs: new Map([["arcflight.test", { set: count("compendium"), update: count("compendium"), delete: count("compendium"), createDocument: count("compendium"), importDocument: count("compendium") }]]) };
  globalThis.Actor = documentStub("actor"); globalThis.Item = documentStub("item"); globalThis.ActiveEffect = documentStub("activeEffect"); globalThis.Scene = documentStub("scene"); globalThis.TokenDocument = documentStub("token");
  globalThis.ChatMessage = { create: count("chat") }; globalThis.JournalEntry = { create: count("journal") };
  globalThis.CompendiumCollection = class { set() { counters.compendium += 1; } delete() { counters.compendium += 1; } };
  return { counters, restore() { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } } };
}
function assertZeroCounters(counters) { for (const [key, value] of Object.entries(counters)) assert.equal(value, 0, `${key} mutation counter`); }


function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, keys);
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) { keys.push(key); collectKeys(entry, keys); }
  }
  return keys;
}

function sessionWithPrivateResolutionRecords() {
  const privateRecord = { roundIndex: 0, roundNumber: 1, gmNote: "PRIVATE-ROUND-RESOLUTION-MARKER", userId: "private-user", internalScore: 999, auditPayload: { secretValue: true } };
  const next = clone(committed());
  next.event.rounds[0].travelV2RoundResolution = clone(privateRecord);
  next.event.rounds[0].travelV2RoundResolutionRecord = clone(privateRecord);
  next.event.rounds[0].roundResolution = clone(privateRecord);
  next.event.rounds[0].roundResolutionRecord = clone(privateRecord);
  next.roundResults[0].travelV2RoundResolution = clone(privateRecord);
  next.roundResults[0].travelV2RoundResolutionRecord = clone(privateRecord);
  next.roundResults[0].roundResolution = clone(privateRecord);
  next.roundResults[0].roundResolutionRecord = clone(privateRecord);
  next.travelV2RoundResolutions = { records: [clone(privateRecord)] };
  next.travelV2RoundResolutionRecords = [clone(privateRecord)];
  next.roundResolutionRecords = { records: [clone(privateRecord)] };
  next.roundResolutions = [clone(privateRecord)];
  return next;
}



export default function runTravelV2CrewPlanningPhaseSmokeChecks() {
let groups = 0;
const checked = [];
function group(name, fn) { fn(); groups += 1; checked.push(name); }

group("canonical segment order and normalization", () => {
  assert.equal(ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER[0], "crewPlanning");
  assert.deepEqual(ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER, ["crewPlanning", "stationOrders", "stationRolls", "reactionWindow", "outcomePressure"]);
  assert.equal(normalizeTravelRoundSegmentKey(), "crewPlanning");
  assert.equal(normalizeTravelRoundSegmentKey("invalid"), "crewPlanning");
  for (const legacy of ["roundReveal", "crewStrategy", "tableStrategy", "stationCommitment"]) assert.equal(normalizeTravelRoundSegmentKey(legacy), "crewPlanning");
  assert.equal(normalizeTravelRoundSegmentKey("stationOrders"), "stationOrders");
  for (const later of ["stationRolls", "reactionWindow", "outcomePressure"]) assert.equal(normalizeTravelRoundSegmentKey(later), later);
});

group("session defaults and reload", () => {
  assert.equal(session().roundPhase, "crewPlanning");
  assert.equal(normalizeTravelEventRunnerSession({ ...session(), roundPhase: undefined }).session.roundPhase, "crewPlanning");
  assert.equal(normalizeTravelEventRunnerSession({ ...session(), roundPhase: "crewStrategy" }).session.roundPhase, "crewPlanning");
  const later = normalizeTravelEventRunnerSession({ ...session(), roundPhase: "stationRolls" }).session;
  assert.equal(later.roundPhase, "stationRolls");
  assert.deepEqual(normalizeTravelEventRunnerSession(normalizeTravelEventRunnerSession(later).session).session, normalizeTravelEventRunnerSession(later).session);
  const imported = normalizeTravelEventRunnerSession(JSON.parse(JSON.stringify({ ...committed(session()), roundPhase: "stationOrders" }))).session;
  assert.equal(imported.roundPhase, "stationOrders");
  assert.deepEqual(imported.roundResults[0].actionOrder.committedStationKeys, stations);
});

group("gate blocked cases", () => {
  assert(prepareTravelV2CrewPlanningPhaseGate(null).blockedReasons.includes("no session"));
  assert(prepareTravelV2CrewPlanningPhaseGate({ event: { rounds: [] }, roundResults: [] }).blockedReasons.includes("no current round"));
  assert(prepareTravelV2CrewPlanningPhaseGate(session({ event: { ...event, rounds: [{ round: 1, activeStations: [] }] } })).blockedReasons.includes("no active stations"));
  assert(prepareTravelV2CrewPlanningPhaseGate(session()).blockedReasons.includes("order still selecting"));
  assert(prepareTravelV2CrewPlanningPhaseGate(unlockTravelV2RoundActionOrderRoundState(committed(), 0, { timestamp: NOW }).session).blockedReasons.includes("order unlocked"));
  for (const bad of [["captain"], ["captain", "captain", "engineer"], ["captain", "navigator", "watchmaster"]]) assert(prepareTravelV2CrewPlanningPhaseGate({ ...session(), roundResults: [{ ...session().roundResults[0], actionOrder: { status: "committed", proposedStationKeys: bad, committedStationKeys: bad } }] }).blockedReasons.includes("invalid committed order"));
  assert(prepareTravelV2CrewPlanningPhaseGate({ ...committed(), roundResults: [{ ...committed().roundResults[0], stationResults: { captain: "success", navigator: null, engineer: null } }] }).blockedReasons.includes("station results already recorded"));
  assert(prepareTravelV2CrewPlanningPhaseGate({ ...committed(), status: "completed" }).blockedReasons.includes("round already completed"));
  assert(prepareTravelV2CrewPlanningPhaseGate({ ...committed(), roundPhase: "stationOrders" }).blockedReasons.includes("current phase is not crewPlanning"));
});

group("direct set phase gate", () => {
  const selecting = session({ updatedAt: "2026-07-18T01:00:00.000Z", summary: { keep: true } });
  const selectingBlocked = setTravelEventRunnerRoundPhase(selecting, "stationOrders", { now: "2026-07-18T02:00:00.000Z" });
  assert.equal(selectingBlocked.ok, false); assert(selectingBlocked.errors.includes("order still selecting")); assert.equal(selectingBlocked.session.roundPhase, "crewPlanning"); assert.equal(selectingBlocked.session.updatedAt, selecting.updatedAt); assert.deepEqual(selectingBlocked.session.summary, selecting.summary);
  const unlocked = unlockTravelV2RoundActionOrderRoundState(committed(), 0, { timestamp: NOW }).session;
  const unlockedBlocked = setTravelEventRunnerRoundPhase(unlocked, "stationOrders", { now: NOW });
  assert.equal(unlockedBlocked.ok, false); assert(unlockedBlocked.errors.includes("order unlocked")); assert.equal(unlockedBlocked.session.roundResults[0].actionOrder.status, "unlocked");
  const ready = committed();
  const orders = setTravelEventRunnerRoundPhase(ready, "stationOrders", { now: NOW });
  assert.equal(orders.ok, true); assert.equal(orders.session.roundPhase, "stationOrders"); assert.equal(orders.session.roundResults[0].actionOrder.status, "committed");
  for (const later of ["stationRolls", "reactionWindow", "outcomePressure"]) {
    const jump = setTravelEventRunnerRoundPhase(ready, later, { now: NOW });
    assert.equal(jump.ok, false); assert(jump.errors.includes("crewPlanning may only advance to stationOrders")); assert.equal(jump.session.roundPhase, "crewPlanning");
  }
  const runnerControl = setTravelEventRunnerRoundPhase(selecting, ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, { now: "2026-07-18T03:00:00.000Z" });
  assert.equal(runnerControl.ok, false); assert.equal(runnerControl.session.updatedAt, selecting.updatedAt); assert.deepEqual(runnerControl.session.summary, selecting.summary);
});

group("completed round representations", () => {
  const eventRoundReps = [
    (s) => withEventRoundPatch(s, { travelV2RoundResolution: { roundIndex: 0 } }),
    (s) => withEventRoundPatch(s, { travelV2RoundResolutionRecord: { roundNumber: 1 } }),
    (s) => withEventRoundPatch(s, { roundResolution: {} }),
    (s) => withEventRoundPatch(s, { roundResolutionRecord: { round: 1 } })
  ];
  for (const apply of eventRoundReps) {
    const gate = prepareTravelV2CrewPlanningPhaseGate(apply(committed()));
    assert(gate.blockedReasons.includes("round already completed"));
    assert.equal(setTravelEventRunnerRoundPhase(apply(committed()), "stationOrders", { now: NOW }).ok, false);
  }
  const differentRound = withEventRoundPatch(committed(), { travelV2RoundResolution: { roundIndex: 1, roundNumber: 2 } }, 1);
  assert.equal(prepareTravelV2CrewPlanningPhaseGate(differentRound).ready, true);

  const reps = [
    (s) => withRoundResultPatch(s, { travelV2RoundResolution: { roundIndex: 0 } }),
    (s) => withRoundResultPatch(s, { travelV2RoundResolutionRecord: { roundNumber: 1 } }),
    (s) => withRoundResultPatch(s, { roundResolution: {} }),
    (s) => withRoundResultPatch(s, { roundResolutionRecord: { round: 1 } }),
    (s) => ({ ...s, travelV2RoundResolutions: { records: [{ roundIndex: 0 }] } }),
    (s) => ({ ...s, travelV2RoundResolutionRecords: [{ roundNumber: 1 }] }),
    (s) => ({ ...s, roundResolutionRecords: { records: [{ round: 1 }] } }),
    (s) => ({ ...s, roundResolutions: [{ roundIndex: 0 }] })
  ];
  for (const apply of reps) {
    const gate = prepareTravelV2CrewPlanningPhaseGate(apply(committed()));
    assert(gate.blockedReasons.includes("round already completed"));
    assert.equal(setTravelEventRunnerRoundPhase(apply(committed()), "stationOrders", { now: NOW }).ok, false);
  }
});

group("phase advancement", () => {
  const base = committed();
  const before = clone(base);
  const advanced = advanceTravelEventRunnerRoundPhase(base, { now: NOW });
  assert.equal(advanced.ok, true); assert.equal(advanced.session.roundPhase, "stationOrders");
  assert.equal(advanced.session.currentRoundIndex, before.currentRoundIndex);
  assert.deepEqual(advanced.session.roundResults, before.roundResults);
  const selecting = session(); const blocked = advanceTravelEventRunnerRoundPhase(selecting, { now: NOW });
  assert.equal(blocked.ok, false); assert.equal(blocked.session.roundPhase, selecting.roundPhase); assert.deepEqual(blocked.session.roundResults, selecting.roundResults);
  const retreated = retreatTravelEventRunnerRoundPhase(advanced.session, { now: NOW });
  assert.equal(retreated.session.roundPhase, "crewPlanning");
  assert.equal(retreated.session.roundResults[0].actionOrder.status, "committed");
});

group("round/session isolation and immutability", () => {
  const first = committed();
  const advanced = advanceTravelEventRunnerRound(first, { force: true, now: NOW });
  assert.equal(advanced.ok, true); assert.equal(advanced.session.roundPhase, "crewPlanning");
  assert.equal(advanced.session.roundResults[0].actionOrder.status, "committed");
  assert.equal(advanced.session.roundResults[1].actionOrder.status, "selecting");
  assert.deepEqual(advanced.session.roundResults[1].actionOrder.committedStationKeys, []);
  assert.notEqual(advanced.session.roundResults[0].actionOrder, advanced.session.roundResults[1].actionOrder);
  assert.deepEqual(session().roundResults[0].actionOrder.committedStationKeys, []);
  const source = session(); const sourceClone = clone(source); const gate = prepareTravelV2CrewPlanningPhaseGate(source); assert.deepEqual(source, sourceClone); assertFrozenClone(gate);
});

group("mutation sentinels and source scan", () => {
  const sentinels = installMutationSentinels();
  try {
    const ready = committed();
    prepareTravelV2CrewPlanningPhaseGate(ready);
    advanceTravelEventRunnerRoundPhase(ready, { now: NOW });
    setTravelEventRunnerRoundPhase(ready, "stationOrders", { now: NOW });
    retreatTravelEventRunnerRoundPhase({ ...ready, roundPhase: "stationOrders" }, { now: NOW });
    advanceTravelEventRunnerRound(ready, { force: true, now: NOW });
    assertZeroCounters(sentinels.counters);
  } finally { sentinels.restore(); }
  const helperSource = readFileSync(new URL("./travel-event-runner.js", import.meta.url), "utf8");
  const segmentSource = readFileSync(new URL("./travel-round-segments.js", import.meta.url), "utf8");
  for (const forbidden of ["game.socket.emit", "game.settings.set", "Actor.create", "Item.create", "ActiveEffect.create", "ChatMessage.create", "JournalEntry.create", "Scene.create", "TokenDocument.create"]) {
    assert(!helperSource.includes(forbidden), forbidden); assert(!segmentSource.includes(forbidden), forbidden);
  }
});

group("player-safe resolution record redaction", () => {
  const source = sessionWithPrivateResolutionRecords();
  const snapshot = clone(source);
  const gate = prepareTravelV2CrewPlanningPhaseGate(source);
  assert.equal(gate.blocked, true); assert(gate.blockedReasons.includes("round already completed"));
  const playerState = prepareTravelEventRunnerState(source, { user: { isGM: false }, isGM: false });
  assert(playerState.crewPlanningPhaseGate);
  const gateKeys = Object.keys(playerState.crewPlanningPhaseGate).sort();
  assert.deepEqual(gateKeys, ["actionOrderStatus", "activeStationKeys", "blocked", "blockedReasons", "committedStationKeys", "nextPhase", "phase", "playerSafe", "proposedStationKeys", "readOnly", "ready", "roundIndex", "roundNumber"].sort());
  const playerKeys = collectKeys(playerState);
  for (const forbiddenKey of ["travelV2RoundResolution", "travelV2RoundResolutionRecord", "roundResolution", "roundResolutionRecord", "travelV2RoundResolutions", "travelV2RoundResolutionRecords", "roundResolutionRecords", "roundResolutions"]) assert(!playerKeys.includes(forbiddenKey), forbiddenKey);
  const playerText = JSON.stringify(playerState);
  for (const forbidden of ["PRIVATE-ROUND-RESOLUTION-MARKER", "private-user", "internalScore", "auditPayload", "secretValue"]) assert(!playerText.includes(forbidden), forbidden);
  assert(playerState.crewPlanningPhaseGate.blockedReasons.includes("round already completed"));
  assert.deepEqual(source, snapshot);
  const gmState = prepareTravelEventRunnerState(source, { user: { isGM: true }, isGM: true });
  const gmText = JSON.stringify(gmState);
  assert(gmText.includes("PRIVATE-ROUND-RESOLUTION-MARKER")); assert(gmText.includes("travelV2RoundResolution"));
});

group("player-safe state and zero mutation surface", () => {
  const unsafe = clone(committed());
  unsafe.roundResults[0].actionOrder.committedByUserId = "u1"; unsafe.roundResults[0].actionOrder.committedByUserName = "GM"; unsafe.travelV2RoundActionOrder = { auditRecord: { userId: "u1" }, commitRecords: [{ userName: "GM" }], unlockRecords: [{ userId: "u2" }] };
  const state = prepareTravelEventRunnerState(unsafe, { isGM: false });
  assert.equal(state.roundSegmentState.phase, "crewPlanning"); assert.equal(state.roundSegmentState.phaseLabel, "Crew Planning"); assert.match(state.roundSegmentState.phaseGuidance, /Risk Bids/);
  assert.equal(state.crewPlanningPhaseGate.ready, true); assert.equal(state.crewPlanningPhaseGate.actionOrderStatus, "committed"); assert.deepEqual(state.crewPlanningPhaseGate.proposedStationKeys, stations); assert.deepEqual(state.crewPlanningPhaseGate.committedStationKeys, stations);
  const text = JSON.stringify(state); for (const forbidden of ["committedByUserId", "committedByUserName", "unlockedByUserId", "unlockedByUserName", "auditRecord", "commitRecords", "unlockRecords", "userId", "userName"]) assert(!text.includes(forbidden), forbidden);
});

return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runTravelV2CrewPlanningPhaseSmokeChecks();
  console.log(`travel-v2-crew-planning-phase smoke passed (${result.checked.length} assertion groups).`);
}
