import assert from "node:assert/strict";
import {
  commitTravelEventRunnerStationOrder,
  normalizeTravelEventRunnerSession,
  prepareTravelV2StationActionLockRunnerUpdate,
  prepareTravelV2StationActionSubmissionRunnerUpdate,
  prepareTravelV2StationActionUnlockRunnerUpdate,
  setTravelEventRunnerStationAction,
  setTravelEventRunnerStationSkillApproach
} from "./travel-event-runner.js";
import { ARCFLIGHT_TRAVEL_STATION_ACTIONS } from "./travel-pressure.js";
import { commitTravelV2RoundActionOrderRoundState } from "./travel-v2-round-action-order-state.js";
import { lockTravelV2StationAction, selectTravelV2StationAction, unlockTravelV2StationAction } from "./travel-v2-station-action-lock-in.js";

const NOW = "2026-07-18T00:00:00.000Z";
const STATIONS = ["captain", "navigator", "engineer"];
const FORBIDDEN = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "PRIVATE-GM-NOTE", "private-user-id"];
const GM = { isGM: true, id: "gm", name: "GM" };

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function snap(value) { return JSON.stringify(value); }
function assertSafe(value) { const text = snap(value); for (const key of FORBIDDEN) assert.equal(text.includes(key), false, `blocked result leaked ${key}`); }

function session() {
  const raw = {
    version: 1,
    key: "station-action-mutation-gates",
    status: "active",
    currentRoundIndex: 0,
    roundPhase: "stationOrders",
    pressure: {},
    event: {
      key: "station-action-mutation-gates-event",
      name: "Station Action Mutation Gates",
      baseDC: 20,
      rounds: [{
        roundNumber: 1,
        title: "Round 1",
        activeStations: [...STATIONS],
        stationPrompts: Object.fromEntries(STATIONS.map((stationKey) => [stationKey, { stationName: stationKey }])),
        stationCards: STATIONS.map((stationKey) => ({ stationKey, skillApproaches: [{ skill: "perception", label: "Read the Line", helpText: "Observe." }] })),
        stationActionOrder: [...STATIONS]
      }]
    },
    roundResults: [{ roundIndex: 0, roundNumber: 1, stationResults: Object.fromEntries(STATIONS.map((key) => [key, null])), stationActions: {}, stationOrderCommitments: {} }],
    updatedAt: NOW,
    startedAt: NOW,
    completedAt: "",
    summary: null
  };
  const normalized = normalizeTravelEventRunnerSession(raw, { now: NOW });
  assert.equal(normalized.ok, true);
  return normalized.session;
}
function committed() { const result = commitTravelV2RoundActionOrderRoundState(session(), 0, { proposedOrder: STATIONS, timestamp: NOW }); assert.equal(result.ok, true); return result.session; }
function stale() { const s = clone(committed()); s.roundResults[0].actionOrder.roundIndex = 1; s.roundResults[0].actionOrder.roundNumber = 2; return s; }
function invalidOrder() { const s = clone(committed()); s.roundResults[0].actionOrder.committedStationKeys = ["captain", "captain", "engineer"]; return s; }
function noContainers() { const s = clone(session()); delete s.roundResults[0].stationActions; delete s.roundResults[0].stationOrderCommitments; delete s.roundResults[0].selectedStationSkills; return s; }

const operations = Object.freeze({
  actionSelection: (s) => setTravelEventRunnerStationAction(s, 0, "captain", ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH, { now: NOW }),
  skillSelection: (s) => setTravelEventRunnerStationSkillApproach(s, 0, "captain", "perception", { now: NOW }),
  submitCommit: (s) => commitTravelEventRunnerStationOrder(s, 0, "captain", "eventApproach:perception", { now: NOW, user: GM }),
  lockWrapper: (s) => prepareTravelV2StationActionLockRunnerUpdate(s, { stationKey: "captain", user: GM, now: NOW }),
  unlockWrapper: (s) => prepareTravelV2StationActionUnlockRunnerUpdate(s, { stationKey: "captain", user: GM, allowUnlock: true, now: NOW }),
  publicWrapper: (s) => prepareTravelV2StationActionSubmissionRunnerUpdate(s, { stationKey: "captain", optionKey: "eventApproach:perception", user: GM, now: NOW }),
  directSelect: (s) => selectTravelV2StationAction({}, "captain", { actionKey: "eventApproach" }, { session: s }),
  directLock: (s) => lockTravelV2StationAction({ stations: { captain: { actionKey: "eventApproach" } }, stationOrder: ["captain"] }, "captain", { session: s }),
  directUnlock: (s) => unlockTravelV2StationAction({ stations: { captain: { actionKey: "eventApproach", locked: true } }, stationOrder: ["captain"] }, "captain", { allowUnlock: true, session: s })
});
function blocked(result) { return result?.blocked === true || result?.result?.blocked === true || result?.blockedByPlanningGate === true || result?.result?.blockedByPlanningGate === true; }
function reason(result) { return result?.reasonCode || result?.result?.reasonCode; }
function resultSession(result) { return Object.hasOwn(result ?? {}, "session") ? result.session : result?.nextSession; }

export default function runTravelV2StationActionMutationPlanningGatesSmokeChecks() {
  const checked = [];
  for (const [name, op] of Object.entries(operations)) {
    for (const [fixtureName, fixture, expected] of [["uncommitted", session, "planning-not-committed"], ["stale", stale, "stale-planning-round"], ["invalid-order", invalidOrder, "invalid-committed-order"]]) {
      const source = clone(fixture()); source.roundResults[0].actionOrder = source.roundResults[0].actionOrder ?? { gmOnly: "PRIVATE-GM-NOTE", auditRecord: { userId: "private-user-id" } };
      const before = snap(source); const result = op(source);
      assert.equal(snap(source), before, `${name} mutated ${fixtureName}`);
      assert.equal(blocked(result), true, `${name} did not block ${fixtureName}`);
      assert.equal(reason(result), expected, `${name} reason for ${fixtureName}`);
      assertSafe(result?.result ?? result);
    }
  }
  checked.push("stale, uncommitted, and invalid committed planning block every Station Action mutation path without mutating inputs");

  for (const [label, op] of Object.entries({ action: operations.actionSelection, skill: operations.skillSelection, submit: operations.submitCommit, lock: operations.lockWrapper, unlock: operations.unlockWrapper })) {
    const source = session(); const result = op(source); assert.equal(blocked(result), true, label); assert.equal(reason(result), "planning-not-committed"); }
  checked.push("action selection, skill selection, submit/commit, lock, and unlock are blocked before Crew Planning is committed");

  const inactive = clone(committed());
  for (const op of [
    (s) => setTravelEventRunnerStationAction(s, 0, "watchmaster", ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH),
    (s) => setTravelEventRunnerStationSkillApproach(s, 0, "watchmaster", "perception"),
    (s) => commitTravelEventRunnerStationOrder(s, 0, "watchmaster", "eventApproach:perception"),
    (s) => prepareTravelV2StationActionLockRunnerUpdate(s, { stationKey: "watchmaster", user: GM }),
    (s) => prepareTravelV2StationActionUnlockRunnerUpdate(s, { stationKey: "watchmaster", user: GM, allowUnlock: true })
  ]) assert.equal(reason(op(inactive)), "station-not-active");
  checked.push("inactive stations are blocked by the authoritative planning gate");

  const missing = clone(noContainers()); const before = snap(missing); const r = setTravelEventRunnerStationAction(missing, 0, "captain", ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH);
  assert.equal(blocked(r), true); assert.equal(snap(missing), before); assert.equal(resultSession(r), null); assert.equal(Object.hasOwn(missing.roundResults[0], "stationActions"), false); assert.equal(Object.hasOwn(missing.roundResults[0], "stationOrderCommitments"), false);
  checked.push("blocked calls do not create missing Station Action containers or return replacement sessions");

  const wrapperSource = clone(session()); const wrapperBefore = snap(wrapperSource); const wrapper = operations.publicWrapper(wrapperSource);
  assert.equal(wrapper.shouldUpdateSession, false); assert.equal(wrapper.nextSession, wrapperSource); assert.equal(snap(wrapperSource), wrapperBefore);
  checked.push("public/application wrappers do not adopt blocked returned state");

  const valid = clone(committed());
  const action = setTravelEventRunnerStationAction(valid, 0, "captain", ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH, { now: NOW }); assert.equal(action.ok, true); assert.equal(action.session.roundResults[0].stationActions.captain.type, ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH);
  const skill = setTravelEventRunnerStationSkillApproach(valid, 0, "captain", "perception", { now: NOW }); assert.equal(skill.ok, true); assert.equal(skill.session.roundResults[0].selectedStationSkills.captain, "perception");
  checked.push("valid committed planning permits existing Station Action mutations");

  assertSafe(operations.actionSelection(session())?.result ?? operations.actionSelection(session()));
  checked.push("blocked results remain player-safe");
  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) runTravelV2StationActionMutationPlanningGatesSmokeChecks();
