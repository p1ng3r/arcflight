import assert from "node:assert/strict";
import { prepareTravelV2StationActionLockInState, validateTravelV2StationActionLockInForResolution } from "./travel-v2-station-action-lock-in.js";

const required = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
function session(overrides = {}) {
  return {
    currentRoundIndex: 0,
    event: { rounds: [{ activeStations: required }] },
    roundResults: [{
      stationActions: Object.fromEntries(required.map((key) => [key, { type: "eventApproach", label: `${key} action` }])),
      stationOrderCommitments: Object.fromEntries(required.map((key) => [key, { committed: true }]))
    }],
    ...overrides
  };
}

export function runTravelV2StationActionLockInSmoke() {
  const locked = prepareTravelV2StationActionLockInState(session());
  assert.equal(locked.ready, true, "complete locked five-station state reports ready");
  assert.equal(locked.rows.length, 5, "all five alpha stations are shown");
  const missing = prepareTravelV2StationActionLockInState(session({ roundResults: [{ stationActions: {}, stationOrderCommitments: {} }] }));
  assert.equal(missing.ready, false, "incomplete state reports not ready");
  assert(missing.validationMessages.some((message) => message.includes("missing station action")), "missing action produces safe validation message");
  const unlocked = prepareTravelV2StationActionLockInState(session({ roundResults: [{ stationActions: { captain: { type: "eventApproach" } }, stationOrderCommitments: { captain: { committed: false } } }] }));
  assert(unlocked.validationMessages.some((message) => message.includes("must be locked")), "unlocked action produces safe validation message");
  const invalid = prepareTravelV2StationActionLockInState(session({ roundResults: [{ stationActions: { pilot: { type: "eventApproach" } }, stationOrderCommitments: {} }] }));
  assert(invalid.validationMessages.some((message) => message.includes("invalid station key")), "invalid station key produces safe validation message");
  const validation = validateTravelV2StationActionLockInForResolution(session({ roundResults: [{ stationActions: {}, stationOrderCommitments: {} }] }));
  assert.equal(validation.ok, false, "attempted resolution before lock-in is blocked in validation helper");
  return { checked: ["ready state", "incomplete state", "missing action", "unlocked action", "invalid station key", "resolution guard"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(runTravelV2StationActionLockInSmoke());
}
export default runTravelV2StationActionLockInSmoke;
