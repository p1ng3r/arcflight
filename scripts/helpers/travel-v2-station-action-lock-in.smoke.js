import { normalizeTravelEventRunnerSession } from "./travel-event-runner.js";
import { commitTravelV2RoundActionOrderRoundState } from "./travel-v2-round-action-order-state.js";
import {
  checkTravelV2StationActionLockInReady,
  lockTravelV2StationAction,
  normalizeTravelV2StationActionChoices,
  playerSafeTravelV2StationActionLockStateHasForbiddenKeys,
  prepareGmTravelV2StationActionLockState,
  preparePlayerSafeTravelV2StationActionLockState,
  selectTravelV2StationAction,
  unlockTravelV2StationAction
} from "./travel-v2-station-action-lock-in.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message} Expected ${expected}, received ${actual}.`);
}

function completeChoices(locked = false) {
  return {
    captain: { actionKey: "rally-crew", locked },
    navigator: { actionKey: "plot-course", label: "Plot Course", locked },
    engineer: { actionKey: "stabilize-strain", locked },
    veilwarden: { actionKey: "reinforce-lifeveil", locked },
    watchmaster: { actionKey: "scan-threats", locked }
  };
}

function canonicalSession() {
  const stationKeys = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
  const raw = {
    version: 1,
    key: "station-action-lock-in-smoke",
    status: "active",
    currentRoundIndex: 0,
    roundPhase: "stationOrders",
    pressure: {},
    event: {
      key: "station-action-lock-in-event",
      name: "Station Action Lock-In",
      baseDC: 20,
      rounds: [{
        roundNumber: 1,
        title: "Round 1",
        activeStations: stationKeys,
        stationPrompts: Object.fromEntries(stationKeys.map((stationKey) => [stationKey, { stationName: stationKey }])),
        stationCards: stationKeys.map((stationKey) => ({ stationKey, skillApproaches: [{ skill: "perception", label: "Read", helpText: "Observe." }] })),
        stationActionOrder: stationKeys
      }]
    },
    roundResults: [{ roundIndex: 0, roundNumber: 1, stationResults: Object.fromEntries(stationKeys.map((stationKey) => [stationKey, null])), stationActions: {}, stationOrderCommitments: {} }],
    updatedAt: "2026-07-18T00:00:00.000Z",
    startedAt: "2026-07-18T00:00:00.000Z",
    completedAt: "",
    summary: null
  };
  const normalized = normalizeTravelEventRunnerSession(raw, { now: raw.updatedAt });
  assertSmoke(normalized.ok, "canonical session should normalize for lock-in smoke.");
  const committed = commitTravelV2RoundActionOrderRoundState(normalized.session, 0, { proposedOrder: stationKeys, timestamp: raw.updatedAt });
  assertSmoke(committed.ok, "canonical session should commit planning for lock-in smoke.");
  return committed.session;
}

function assertBlockedMissingSession(result, message) {
  assertSmoke(result?.blocked, `${message} should block.`);
  assertSmoke(result?.blockedByPlanningGate, `${message} should be blocked by planning gate.`);
  assertEqual(result?.reasonCode, "missing-session", `${message} should use missing-session.`);
  assertEqual(result?.session, null, `${message} should not return a replacement session.`);
  assertSmoke(result?.playerSafe, `${message} should be player-safe.`);
  assertSmoke(result?.readOnly, `${message} should be read-only.`);
  assertSmoke(Object.isFrozen(result), `${message} result should be frozen.`);
  const text = JSON.stringify(result);
  for (const forbidden of ["hiddenHazards", "gmNotes", "applyPayload", "targetActorUuid", "debugData", "futureTriggers", "userId", "auditRecord"]) {
    assertSmoke(!text.includes(forbidden), `${message} should not leak ${forbidden}.`);
  }
}

export default async function runTravelV2StationActionLockInSmokeChecks() {
  const checked = [];
  const session = canonicalSession();

  const complete = normalizeTravelV2StationActionChoices({ stations: completeChoices(true) });
  assertEqual(complete.stationOrder.join(","), "captain,navigator,engineer,veilwarden,watchmaster", "normalization should preserve alpha station order.");
  assertSmoke(complete.readyToResolve, "complete locked five-station action selection should be ready.");
  checked.push("normalizes complete five-station action selection");

  for (const [label, result] of [
    ["select without session", selectTravelV2StationAction({}, "captain", { actionKey: "rally-crew" })],
    ["lock without session", lockTravelV2StationAction({ stations: { captain: { actionKey: "rally-crew" } }, stationOrder: ["captain"] }, "captain")],
    ["unlock without session", unlockTravelV2StationAction({ stations: { captain: { actionKey: "rally-crew", locked: true } }, stationOrder: ["captain"] }, "captain", { allowUnlock: true })],
    ["select with null session", selectTravelV2StationAction({}, "captain", { actionKey: "rally-crew" }, { session: null })],
    ["lock with malformed session", lockTravelV2StationAction({ stations: { captain: { actionKey: "rally-crew" } }, stationOrder: ["captain"] }, "captain", { session: { roundPhase: "stationOrders" } })],
    ["unlock with non-canonical session", unlockTravelV2StationAction({ stations: { captain: { actionKey: "rally-crew", locked: true } }, stationOrder: ["captain"] }, "captain", { allowUnlock: true, session: { currentRoundIndex: 0, event: { rounds: [{}] }, roundResults: [{}] } })]
  ]) assertBlockedMissingSession(result, label);
  checked.push("direct mutation helpers require a canonical session before planning gate authorization");

  for (const [label, state, mutate] of [
    ["blocked select", {}, (entry) => selectTravelV2StationAction(entry, "captain", { actionKey: "rally-crew" })],
    ["blocked lock", { hiddenHazards: ["do-not-leak"] }, (entry) => lockTravelV2StationAction(entry, "captain")],
    ["blocked unlock", { gmNotes: "secret" }, (entry) => unlockTravelV2StationAction(entry, "captain", { allowUnlock: true })]
  ]) {
    const before = JSON.stringify(state);
    const result = mutate(state);
    assertBlockedMissingSession(result, label);
    assertEqual(JSON.stringify(state), before, `${label} should leave source unchanged.`);
    assertSmoke(!Object.hasOwn(state, "stations"), `${label} should not create station containers.`);
    assertSmoke(!Object.hasOwn(state, "stationOrder"), `${label} should not create station order.`);
  }
  checked.push("blocked direct mutation calls do not normalize or create station containers");

  const source = { stations: completeChoices(false), hiddenHazards: ["do-not-leak"], gmNotes: "secret", applyPayload: { targetActorUuid: "Actor.x" }, debugData: { futureTriggers: ["later"] } };
  const before = JSON.stringify(source);
  let state = normalizeTravelV2StationActionChoices(source);
  state = selectTravelV2StationAction(state, "captain", { actionKey: "coordinate-orders" }, { session });
  assertEqual(state.stations.captain.action.actionKey, "coordinate-orders", "selecting should update an unlocked station action.");
  state = selectTravelV2StationAction(state, "captain", { actionKey: "rally-crew" }, { session });
  assertEqual(state.stations.captain.action.actionKey, "rally-crew", "selecting should replace an unlocked station action.");
  assertEqual(JSON.stringify(source), before, "source input should not be mutated.");
  checked.push("selects and replaces unlocked station actions without mutating source");

  state = lockTravelV2StationAction(state, "captain", { session });
  assertSmoke(state.stations.captain.locked, "locking should lock a selected station action.");
  checked.push("locks one station action");

  for (const stationKey of ["navigator", "engineer", "veilwarden", "watchmaster"]) state = lockTravelV2StationAction(state, stationKey, { session });
  assertSmoke(state.allRequiredLocked, "locking all five alpha station actions should set allRequiredLocked.");
  assertSmoke(checkTravelV2StationActionLockInReady(state).ready, "current round should be ready only after all five required actions are locked.");
  checked.push("locks all five actions and reports readiness");

  const missingAction = normalizeTravelV2StationActionChoices({ stations: { ...completeChoices(true), watchmaster: { locked: true } } });
  assertSmoke(!checkTravelV2StationActionLockInReady(missingAction).ready, "missing action should block readiness.");
  assertSmoke(missingAction.validationErrors.some((entry) => entry.code === "missingStationAction"), "missing action should report safe validation error.");
  checked.push("missing action blocks readiness");

  const missingStation = normalizeTravelV2StationActionChoices({ stations: { captain: { actionKey: "rally-crew", locked: true } }, stationOrder: ["captain"] }, { stationOrder: ["captain"], requiredStationKeys: ["captain", "navigator"] });
  assertSmoke(missingStation.validationErrors.some((entry) => entry.code === "missingRequiredStation"), "missing required station should report safe validation error.");
  checked.push("missing required station blocks readiness");

  const invalid = normalizeTravelV2StationActionChoices({ stations: { helmcat: { actionKey: "pounce", locked: true } } });
  assertSmoke(invalid.validationErrors.some((entry) => entry.code === "invalidStationKey"), "invalid station key should report safe validation error.");
  checked.push("invalid station key reports safe validation error");

  const playerSafe = preparePlayerSafeTravelV2StationActionLockState(source);
  assertSmoke(!playerSafeTravelV2StationActionLockStateHasForbiddenKeys(playerSafe), "player-safe output should exclude GM-only/internal data.");
  assertSmoke(!JSON.stringify(playerSafe).includes("hiddenHazards"), "player-safe state should exclude hidden hazards.");
  const gmState = prepareGmTravelV2StationActionLockState(state);
  assertEqual(gmState.stateKey, "travelV2StationActionLockIn", "GM state should expose helper namespace.");
  checked.push("prepares player-safe and GM-facing projections");

  const unlockBlocked = unlockTravelV2StationAction(state, "captain", { session });
  assertSmoke(unlockBlocked.stations.captain.locked, "unlock should be blocked by default.");
  const unlockAllowed = unlockTravelV2StationAction(state, "captain", { allowUnlock: true, session });
  assertSmoke(!unlockAllowed.stations.captain.locked, "GM/manual unlock should work only when explicitly allowed.");
  checked.push("GM/manual unlock requires explicit allowUnlock");

  return { checked };
}
