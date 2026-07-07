import assert from "node:assert/strict";
import { prepareTravelEventRunnerState, createTravelEventRunnerSession, prepareTravelV2StationActionLockRunnerUpdate, prepareTravelV2StationActionUnlockRunnerUpdate } from "../helpers/travel-event-runner.js";
import { checkTravelV2StationActionLockInReady } from "../helpers/travel-v2-station-action-lock-in.js";
import { LANTERN_IN_THE_STATIC_SAMPLE_EVENT } from "../../data/travel-events/sample-travel-v2-events.js";
import fs from "node:fs";

const forbidden = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"];
const required = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];

export function runTravelEventRunnerV2StationActionLockInSmoke() {
  const created = createTravelEventRunnerSession(LANTERN_IN_THE_STATIC_SAMPLE_EVENT, { key: "station-lock-smoke" });
  assert.equal(created.ok, true, "fixture session creates");
  const session = created.session;
  session.event.rounds[0].activeStations = required;
  session.roundResults[0].stationActions = Object.fromEntries(required.map((key) => [key, { type: "eventApproach", label: `${key} action` }]));
  session.roundResults[0].stationOrderCommitments = Object.fromEntries(required.map((key) => [key, { committed: true }]));
  const gmState = prepareTravelEventRunnerState(session, { user: { isGM: true } });
  assert.equal(gmState.stationActionLockIn.ready, true, "runner app state includes ready lock-in render state");
  assert.equal(gmState.stationActionLockIn.rows.length, 5, "GM render state includes five lock-in rows");
  assert(gmState.stationActionLockIn.rows.every((row) => row.canUnlock === true && row.unlockActionLabel === "Unlock Action"), "GM render state exposes unlock controls for locked rows");
  const playerState = prepareTravelEventRunnerState(session, { user: { isGM: false } });
  const playerJson = JSON.stringify(playerState.stationActionLockIn);
  for (const term of forbidden) assert(!playerJson.includes(term), `player-safe render state does not include ${term}`);
  const incomplete = structuredClone(session);
  incomplete.roundResults[0].stationActions.captain = null;
  incomplete.roundResults[0].stationOrderCommitments.navigator = { committed: false };
  const incompleteState = prepareTravelEventRunnerState(incomplete, { user: { isGM: false } }).stationActionLockIn;
  assert.equal(incompleteState.ready, false, "incomplete runner lock-in state reports not ready");
  const missingActionState = checkTravelV2StationActionLockInReady({ activeStations: required, stationActions: {}, stationOrderCommitments: {} }, { requiredStationKeys: required });
  assert(
  missingActionState.validationErrors.some((entry) => entry.code === "missingStationAction" || entry.message?.includes("no selected action")),
  "runner smoke covers missing action message through the Pass 1 helper"
);
  assert(
  incompleteState.rows.some((row) => row.hasAction && row.locked === false && row.canLock === false),
  "player runner state includes an unlocked station action row without lock authority"
);
  const unlockedSession = structuredClone(session);
  unlockedSession.roundResults[0].stationOrderCommitments.captain = { committed: false };
  const unlockedBefore = JSON.stringify(unlockedSession);
  const gmLock = prepareTravelV2StationActionLockRunnerUpdate(unlockedSession, { stationKey: "captain", user: { isGM: true } });
  assert.equal(gmLock.result.ok, true, "GM can lock an unlocked selected station action");
  assert.equal(gmLock.nextSession.roundResults[0].stationOrderCommitments.captain.committed, true, "lock update marks station committed in cloned session");
  assert.equal(JSON.stringify(unlockedSession), unlockedBefore, "lock update does not mutate original session");
  const lockedBefore = JSON.stringify(gmLock.nextSession);
  const unlockWithoutAuthorization = prepareTravelV2StationActionUnlockRunnerUpdate(gmLock.nextSession, { stationKey: "captain", user: { isGM: true } });
  assert.equal(unlockWithoutAuthorization.result.ok, false, "GM unlock without explicit allowUnlock is blocked");
  const gmUnlock = prepareTravelV2StationActionUnlockRunnerUpdate(gmLock.nextSession, { stationKey: "captain", allowUnlock: true, user: { isGM: true } });
  assert.equal(gmUnlock.result.ok, true, "GM can unlock with explicit allowUnlock");
  assert.equal(gmUnlock.nextSession.roundResults[0].stationOrderCommitments.captain.committed, false, "unlock update clears station committed in cloned session");
  assert.equal(JSON.stringify(gmLock.nextSession), lockedBefore, "unlock update does not mutate original render source");
  const playerUnlock = prepareTravelV2StationActionUnlockRunnerUpdate(session, { stationKey: "captain", allowUnlock: true, user: { isGM: false } });
  assert.equal(playerUnlock.result.ok, false, "non-GM unlock is blocked");
  assert(!JSON.stringify(playerUnlock.result).includes("auditRecord"), "non-GM unlock result remains redacted");
  const missingStationLock = prepareTravelV2StationActionLockRunnerUpdate(session, { stationKey: "", user: { isGM: true } });
  assert.equal(missingStationLock.result.ok, false, "missing station key blocks safely");
  const invalidStationLock = prepareTravelV2StationActionLockRunnerUpdate(session, { stationKey: "secret-station", user: { isGM: true } });
  assert.equal(invalidStationLock.result.ok, false, "invalid station key blocks safely");
  const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  assert(template.includes("Station Action Lock-In"), "template includes Station Action Lock-In section");
  assert(template.includes("readinessText"), "template shows readiness text");
  assert(template.includes("lockStateLabel"), "template shows locked/unlocked state");
  assert.equal((template.match(/data-arcflight-travel-v2-station-action-lock/g) ?? []).length, 1, "template exposes one lock control path");
  assert.equal((template.match(/data-arcflight-travel-v2-station-action-unlock/g) ?? []).length, 1, "template exposes one unlock control path");
  const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assert.equal((aggregate.match(/Travel event runner v2 station action lock-in/g) ?? []).length, 1, "aggregate Travel v2 smoke includes this suite exactly once");
  return { checked: ["runner state", "ready and not ready", "safe validation messages", "player-safe scan", "GM lock", "GM unlock", "non-GM unlock", "invalid station key", "clone safety", "template controls", "aggregate suite"] };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(runTravelEventRunnerV2StationActionLockInSmoke());
export default runTravelEventRunnerV2StationActionLockInSmoke;
