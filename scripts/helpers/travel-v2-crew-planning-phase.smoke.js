import assert from "node:assert/strict";
import { ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER, ARCFLIGHT_TRAVEL_ROUND_SEGMENTS, normalizeTravelRoundSegmentKey } from "./travel-round-segments.js";
import { normalizeTravelEventRunnerSession, advanceTravelEventRunnerRoundPhase, retreatTravelEventRunnerRoundPhase, advanceTravelEventRunnerRound, prepareTravelEventRunnerState, prepareTravelV2CrewPlanningPhaseGate } from "./travel-event-runner.js";
import { commitTravelV2RoundActionOrderRoundState, unlockTravelV2RoundActionOrderRoundState } from "./travel-v2-round-action-order-state.js";

const NOW = "2026-07-18T00:00:00.000Z";
const stations = ["captain", "navigator", "engineer"];
const event = { key: "crew-planning", name: "Crew Planning", category: "travel", rounds: [1, 2].map((round) => ({ round, roundNumber: round, title: `Round ${round}`, activeStations: stations, stationPrompts: Object.fromEntries(stations.map((key) => [key, { stationName: key }])), stationActionOrder: stations })) };
function rawSession(overrides = {}) { return { version: 1, key: "crew-planning-session", status: "active", event, currentRoundIndex: 0, pressure: {}, roundPhase: "crewPlanning", roundResults: event.rounds.map((round, index) => ({ roundIndex: index, roundNumber: round.roundNumber, title: round.title, stationResults: Object.fromEntries(stations.map((key) => [key, null])), stationActions: {}, stationOrderCommitments: {} })), startedAt: NOW, updatedAt: NOW, completedAt: "", summary: null, ...overrides }; }
function session(overrides = {}) { const normalized = normalizeTravelEventRunnerSession(rawSession(overrides), { now: NOW }); assert.equal(normalized.ok, true); return normalized.session; }
function committed(s = session(), order = stations) { const result = commitTravelV2RoundActionOrderRoundState(s, s.currentRoundIndex ?? 0, { proposedOrder: order, timestamp: NOW }); assert.equal(result.ok, true); return result.session; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function assertFrozenClone(result) { assert.throws(() => { result.proposedStationKeys.push("x"); }, TypeError); }

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

group("player-safe state and zero mutation surface", () => {
  const unsafe = clone(committed());
  unsafe.roundResults[0].actionOrder.committedByUserId = "u1"; unsafe.roundResults[0].actionOrder.committedByUserName = "GM"; unsafe.travelV2RoundActionOrder = { auditRecord: { userId: "u1" }, commitRecords: [{ userName: "GM" }], unlockRecords: [{ userId: "u2" }] };
  const state = prepareTravelEventRunnerState(unsafe, { isGM: false });
  assert.equal(state.roundSegmentState.phase, "crewPlanning"); assert.equal(state.roundSegmentState.phaseLabel, "Crew Planning"); assert.match(state.roundSegmentState.phaseGuidance, /Risk Bids/);
  assert.equal(state.crewPlanningPhaseGate.ready, true); assert.equal(state.crewPlanningPhaseGate.actionOrderStatus, "committed"); assert.deepEqual(state.crewPlanningPhaseGate.proposedStationKeys, stations); assert.deepEqual(state.crewPlanningPhaseGate.committedStationKeys, stations);
  const text = JSON.stringify(state); for (const forbidden of ["committedByUserId", "committedByUserName", "unlockedByUserId", "unlockedByUserName", "auditRecord", "commitRecords", "unlockRecords", "userId", "userName"]) assert(!text.includes(forbidden), forbidden);
  const beforeGlobals = { actors: globalThis.Actor, items: globalThis.Item, effects: globalThis.ActiveEffect, journals: globalThis.JournalEntry, chat: globalThis.ChatMessage, sockets: globalThis.game?.socket, scenes: globalThis.Scene, tokens: globalThis.TokenDocument, compendia: globalThis.CompendiumCollection, settings: globalThis.game?.settings };
  prepareTravelV2CrewPlanningPhaseGate(unsafe); prepareTravelEventRunnerState(unsafe, { isGM: false });
  assert.deepEqual({ actors: globalThis.Actor, items: globalThis.Item, effects: globalThis.ActiveEffect, journals: globalThis.JournalEntry, chat: globalThis.ChatMessage, sockets: globalThis.game?.socket, scenes: globalThis.Scene, tokens: globalThis.TokenDocument, compendia: globalThis.CompendiumCollection, settings: globalThis.game?.settings }, beforeGlobals);
});

return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runTravelV2CrewPlanningPhaseSmokeChecks();
  console.log(`travel-v2-crew-planning-phase smoke passed (${result.checked.length} assertion groups).`);
}
