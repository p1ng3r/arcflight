import assert from "node:assert/strict";
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

const required = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
function lockedState() {
  return {
    activeStations: required,
    stationActions: Object.fromEntries(required.map((key) => [key, { type: "eventApproach", label: `${key} action` }])),
    stationOrderCommitments: Object.fromEntries(required.map((key) => [key, { committed: true }]))
  };
}

export function runTravelV2StationActionLockInSmoke() {
  const normalized = normalizeTravelV2StationActionChoices(lockedState(), { requiredStationKeys: required });
  assert.equal(Object.keys(normalized.choicesByStation).length, 5, "normalizes five selected choices");
  const selected = selectTravelV2StationAction({ activeStations: required }, "captain", { actionKey: "eventApproach", actionLabel: "Event Approach" }, { requiredStationKeys: required });
  assert.equal(selected.ok, true, "select helper records a station action");
  const locked = lockTravelV2StationAction(selected.state, "captain", { requiredStationKeys: required });
  assert.equal(locked.ok, true, "lock helper locks a station action");
  const unlocked = unlockTravelV2StationAction(locked.state, "captain", { requiredStationKeys: required });
  assert.equal(unlocked.state.locksByStation.captain.locked, false, "unlock helper unlocks a station action");
  const ready = checkTravelV2StationActionLockInReady(lockedState(), { requiredStationKeys: required });
  assert.equal(ready.ready, true, "complete locked five-station state reports ready");
  const missing = checkTravelV2StationActionLockInReady({ activeStations: required, stationActions: {}, stationOrderCommitments: {} }, { requiredStationKeys: required });
  assert.equal(missing.ready, false, "incomplete state reports not ready");
  assert(missing.validationMessages.some((message) => message.includes("missing station action")), "missing action produces safe validation message");
  const unlockedState = checkTravelV2StationActionLockInReady({ activeStations: required, stationActions: { captain: { type: "eventApproach" } }, stationOrderCommitments: { captain: { committed: false } } }, { requiredStationKeys: required });
  assert(unlockedState.validationMessages.some((message) => message.includes("must be locked")), "unlocked action produces safe validation message");
  const invalid = checkTravelV2StationActionLockInReady({ activeStations: required, stationActions: { pilot: { type: "eventApproach" } }, stationOrderCommitments: {} }, { requiredStationKeys: required });
  assert(invalid.validationMessages.some((message) => message.includes("invalid station key")), "invalid station key produces safe validation message");
  const playerSafe = preparePlayerSafeTravelV2StationActionLockState(lockedState(), { requiredStationKeys: required });
  assert.equal(playerSafeTravelV2StationActionLockStateHasForbiddenKeys(playerSafe), false, "player-safe projection avoids forbidden keys");
  const gmState = prepareGmTravelV2StationActionLockState(lockedState(), { requiredStationKeys: required, canOverrideLocks: true });
  assert.equal(gmState.canOverrideLocks, true, "GM projection may include GM-facing lock affordance state");
  return { checked: ["normalize", "select", "lock", "unlock", "ready state", "incomplete state", "missing action", "unlocked action", "invalid station key", "player-safe projection", "GM projection"] };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(runTravelV2StationActionLockInSmoke());
export default runTravelV2StationActionLockInSmoke;
