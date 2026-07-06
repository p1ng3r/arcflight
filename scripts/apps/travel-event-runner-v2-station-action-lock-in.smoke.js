import assert from "node:assert/strict";
import { prepareTravelEventRunnerState } from "../helpers/travel-event-runner.js";
import { createTravelEventRunnerSession } from "../helpers/travel-event-runner.js";
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
  const playerState = prepareTravelEventRunnerState(session, { user: { isGM: false } });
  const playerJson = JSON.stringify(playerState.stationActionLockIn);
  for (const term of forbidden) assert(!playerJson.includes(term), `player-safe render state does not include ${term}`);
  const incomplete = structuredClone(session);
  incomplete.roundResults[0].stationActions.captain = null;
  incomplete.roundResults[0].stationOrderCommitments.navigator = { committed: false };
  const incompleteState = prepareTravelEventRunnerState(incomplete, { user: { isGM: false } }).stationActionLockIn;
  assert.equal(incompleteState.ready, false, "incomplete runner lock-in state reports not ready");
  const missingActionState = checkTravelV2StationActionLockInReady({ activeStations: required, stationActions: {}, stationOrderCommitments: {} }, { requiredStationKeys: required });
  assert(missingActionState.validationMessages.some((message) => message.includes("missing station action")), "runner smoke covers missing action message through the Pass 1 helper");
  assert(incompleteState.validationMessages.some((message) => message.includes("must be locked")), "runner state includes unlocked message");
  const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  assert(template.includes("Station Action Lock-In"), "template includes Station Action Lock-In section");
  assert(template.includes("readinessText"), "template shows readiness text");
  assert(template.includes("lockStateLabel"), "template shows locked/unlocked state");
  return { checked: ["runner state", "ready and not ready", "safe validation messages", "player-safe scan", "GM state", "template section"] };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(runTravelEventRunnerV2StationActionLockInSmoke());
export default runTravelEventRunnerV2StationActionLockInSmoke;
