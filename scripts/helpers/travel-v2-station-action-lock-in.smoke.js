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

export default async function runTravelV2StationActionLockInSmokeChecks() {
  const checked = [];

  const complete = normalizeTravelV2StationActionChoices({ stations: completeChoices(true) });
  assertEqual(complete.stationOrder.join(","), "captain,navigator,engineer,veilwarden,watchmaster", "normalization should preserve alpha station order.");
  assertSmoke(complete.readyToResolve, "complete locked five-station action selection should be ready.");
  checked.push("normalizes complete five-station action selection");

  const source = { stations: completeChoices(false), hiddenHazards: ["do-not-leak"], gmNotes: "secret", applyPayload: { targetActorUuid: "Actor.x" }, debugData: { futureTriggers: ["later"] } };
  const before = JSON.stringify(source);
  let state = normalizeTravelV2StationActionChoices(source);
  state = selectTravelV2StationAction(state, "captain", { actionKey: "coordinate-orders" });
  assertEqual(state.stations.captain.action.actionKey, "coordinate-orders", "selecting should update an unlocked station action.");
  state = selectTravelV2StationAction(state, "captain", { actionKey: "rally-crew" });
  assertEqual(state.stations.captain.action.actionKey, "rally-crew", "selecting should replace an unlocked station action.");
  assertEqual(JSON.stringify(source), before, "source input should not be mutated.");
  checked.push("selects and replaces unlocked station actions without mutating source");

  state = lockTravelV2StationAction(state, "captain");
  assertSmoke(state.stations.captain.locked, "locking should lock a selected station action.");
  checked.push("locks one station action");

  for (const stationKey of ["navigator", "engineer", "veilwarden", "watchmaster"]) state = lockTravelV2StationAction(state, stationKey);
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

  const unlockBlocked = unlockTravelV2StationAction(state, "captain");
  assertSmoke(unlockBlocked.stations.captain.locked, "unlock should be blocked by default.");
  const unlockAllowed = unlockTravelV2StationAction(state, "captain", { allowUnlock: true });
  assertSmoke(!unlockAllowed.stations.captain.locked, "GM/manual unlock should work only when explicitly allowed.");
  checked.push("GM/manual unlock requires explicit allowUnlock");

  return { checked };
}
