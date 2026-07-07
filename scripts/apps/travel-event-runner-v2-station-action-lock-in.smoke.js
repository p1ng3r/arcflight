import assert from "node:assert/strict";
import { prepareTravelEventRunnerState, createTravelEventRunnerSession, prepareTravelV2StationActionLockRunnerUpdate, prepareTravelV2StationActionUnlockRunnerUpdate, prepareTravelV2StationActionSubmissionRunnerUpdate, persistTravelV2StationActionLockInToRunnerSessionLibrary, loadTravelEventRunnerSessionFromLibrary } from "../helpers/travel-event-runner.js";
import { finalizeTravelV2RoundOnRunnerSession } from "../helpers/travel-v2-session-round-finalization.js";
import { checkTravelV2StationActionLockInReady } from "../helpers/travel-v2-station-action-lock-in.js";
import { LANTERN_IN_THE_STATIC_SAMPLE_EVENT } from "../../data/travel-events/sample-travel-v2-events.js";
import fs from "node:fs";

const forbidden = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"];
const required = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];

export async function runTravelEventRunnerV2StationActionLockInSmoke() {
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
  const submissionSession = structuredClone(session);
  submissionSession.roundResults[0].stationOrderCommitments.navigator = { committed: false };
  submissionSession.npcStationControllers = { navigator: { userId: "player-1", userName: "Player One" } };
  const sourceSessionJson = JSON.stringify(submissionSession);
  const navigatorOptions = prepareTravelEventRunnerState(submissionSession, { user: { isGM: true } }).stations.find((row) => row.stationKey === "navigator").stationOptions;
  const stabilizeOption = navigatorOptions.find((option) => option.actionType === "stabilize") ?? navigatorOptions.find((option) => option.optionKey !== "eventApproach:survival");
  const playerSubmit = prepareTravelV2StationActionSubmissionRunnerUpdate(submissionSession, { stationKey: "navigator", optionKey: stabilizeOption.optionKey, user: { id: "player-1", isGM: false }, now: () => "2026-07-07T00:04:00.000Z" });
  assert.equal(playerSubmit.result.ok, true, "player allowed station action submission succeeds");
  assert.equal(playerSubmit.nextSession.roundResults[0].stationOrderCommitments.navigator.committed, false, "player submission does not auto-lock");
  assert.equal(playerSubmit.result.persisted, false, "player submission does not auto-persist");
  assert.equal(JSON.stringify(submissionSession), sourceSessionJson, "player submission does not mutate source session");
  const playerSubmitJson = JSON.stringify(playerSubmit.result);
  for (const term of forbidden) assert(!playerSubmitJson.includes(term), `player-facing submission result does not include ${term}`);
  const submittedState = prepareTravelEventRunnerState(playerSubmit.nextSession, { user: { isGM: false } }).stationActionLockIn;
  assert(submittedState.rows.some((row) => row.stationKey === "navigator" && row.hasAction && row.locked === false), "submitted action appears unlocked in player-safe lock-in display");
  const blockedFinalization = finalizeTravelV2RoundOnRunnerSession(playerSubmit.nextSession, { user: { isGM: true }, now: () => "2026-07-07T00:05:00.000Z" });
  assert.equal(blockedFinalization.ok, false, "finalization guard blocks submitted-but-unlocked action");

  const disallowed = prepareTravelV2StationActionSubmissionRunnerUpdate(submissionSession, { stationKey: "engineer", optionKey: stabilizeOption.optionKey, user: { id: "player-1", isGM: false } });
  assert.equal(disallowed.result.ok, false, "player disallowed station action submission is blocked");
  assert(disallowed.result.errors[0].includes("not assigned to operate"), "disallowed submission returns a safe readable message");
  for (const term of forbidden) assert(!JSON.stringify(disallowed.result).includes(term), `disallowed submission result does not include ${term}`);

  const lockedPlayerChange = prepareTravelV2StationActionSubmissionRunnerUpdate(submissionSession, { stationKey: "captain", optionKey: stabilizeOption.optionKey, user: { id: "player-1", isGM: false } });
  assert.equal(lockedPlayerChange.result.ok, false, "non-GM cannot change a locked station action");
  assert(lockedPlayerChange.result.errors[0].includes("not assigned") || lockedPlayerChange.result.errors[0].includes("locked"), "locked non-GM change returns a safe message");

  const gmUnlockedChange = prepareTravelV2StationActionSubmissionRunnerUpdate(submissionSession, { stationKey: "navigator", optionKey: stabilizeOption.optionKey, user: { isGM: true }, now: () => "2026-07-07T00:06:00.000Z" });
  assert.equal(gmUnlockedChange.result.ok, true, "GM can change an unlocked station action");
  assert.equal(gmUnlockedChange.nextSession.roundResults[0].stationOrderCommitments.navigator.committed, false, "changing an action keeps stale station lock invalidated safely");
  const gmLockedChange = prepareTravelV2StationActionSubmissionRunnerUpdate(session, { stationKey: "captain", optionKey: stabilizeOption.optionKey, user: { isGM: true } });
  assert.equal(gmLockedChange.result.ok, false, "GM locked action change requires explicit unlock/change authority");

  const sourceLibrary = { version: 1, sessions: {} };
  const savedSeed = structuredClone(session);
  savedSeed.key = "station-lock-persist-smoke";
  savedSeed.roundResults[0].stationOrderCommitments.captain = { committed: false };
  sourceLibrary.sessions[savedSeed.key] = { key: savedSeed.key, name: savedSeed.name, eventKey: savedSeed.event.key, eventName: savedSeed.event.name, eventCategory: savedSeed.event.category, status: savedSeed.status, currentRoundIndex: 0, startedAt: savedSeed.startedAt, completedAt: "", updatedAt: savedSeed.updatedAt, session: structuredClone(savedSeed) };
  const originalLibraryJson = JSON.stringify(sourceLibrary);
  const localLock = prepareTravelV2StationActionLockRunnerUpdate(savedSeed, { stationKey: "captain", user: { isGM: true }, now: () => "2026-07-07T00:00:00.000Z" });
  const persistedLock = await persistTravelV2StationActionLockInToRunnerSessionLibrary(localLock.nextSession, { stationKey: "captain", user: { isGM: true }, persistRequested: true, library: sourceLibrary, dryRun: true, now: () => "2026-07-07T00:01:00.000Z" });
  assert.equal(persistedLock.ok, true, "GM explicit station action lock persistence succeeds");
  assert.equal(persistedLock.persisted, true, "GM lock persistence reports a saved change");
  const reloadedLock = loadTravelEventRunnerSessionFromLibrary(savedSeed.key, { library: persistedLock.library });
  assert.equal(reloadedLock.session.roundResults[0].stationOrderCommitments.captain.committed, true, "reload preserves persisted locked state");
  const localUnlock = prepareTravelV2StationActionUnlockRunnerUpdate(reloadedLock.session, { stationKey: "captain", allowUnlock: true, user: { isGM: true }, now: () => "2026-07-07T00:02:00.000Z" });
  const persistedUnlock = await persistTravelV2StationActionLockInToRunnerSessionLibrary(localUnlock.nextSession, { stationKey: "captain", user: { isGM: true }, persistRequested: true, library: persistedLock.library, dryRun: true, now: () => "2026-07-07T00:03:00.000Z" });
  const reloadedUnlock = loadTravelEventRunnerSessionFromLibrary(savedSeed.key, { library: persistedUnlock.library });
  assert.equal(reloadedUnlock.session.roundResults[0].stationOrderCommitments.captain.committed, false, "reload preserves persisted unlocked state");
  const playerPersist = await persistTravelV2StationActionLockInToRunnerSessionLibrary(localLock.nextSession, { stationKey: "captain", user: { isGM: false }, persistRequested: true, library: sourceLibrary, dryRun: true });
  assert.equal(playerPersist.ok, false, "non-GM persistence is blocked");
  for (const term of forbidden) assert(!JSON.stringify(playerPersist).includes(term), `non-GM persistence result does not include ${term}`);
  const missingPersist = await persistTravelV2StationActionLockInToRunnerSessionLibrary(localLock.nextSession, { stationKey: "", user: { isGM: true }, persistRequested: true, library: sourceLibrary, dryRun: true });
  assert.equal(missingPersist.ok, false, "missing station key blocks persistence safely");
  const invalidPersist = await persistTravelV2StationActionLockInToRunnerSessionLibrary(localLock.nextSession, { stationKey: "secret-station", user: { isGM: true }, persistRequested: true, library: sourceLibrary, dryRun: true });
  assert.equal(invalidPersist.ok, false, "invalid station key blocks persistence safely");
  assert.equal(JSON.stringify(sourceLibrary), originalLibraryJson, "persistence request does not mutate original session library source");
  prepareTravelEventRunnerState(localLock.nextSession, { user: { isGM: true }, library: sourceLibrary });
  assert.equal(JSON.stringify(sourceLibrary), originalLibraryJson, "render-state preparation does not persist or mutate library source");

  const missingStationLock = prepareTravelV2StationActionLockRunnerUpdate(session, { stationKey: "", user: { isGM: true } });
  assert.equal(missingStationLock.result.ok, false, "missing station key blocks safely");
  const invalidStationLock = prepareTravelV2StationActionLockRunnerUpdate(session, { stationKey: "secret-station", user: { isGM: true } });
  assert.equal(invalidStationLock.result.ok, false, "invalid station key blocks safely");
  const template = fs.readFileSync(new URL("../../templates/apps/travel-event-runner.hbs", import.meta.url), "utf8");
  assert(template.includes("Station Action Lock-In"), "template includes Station Action Lock-In section");
  assert(template.includes("readinessText"), "template shows readiness text");
  assert(template.includes("lockStateLabel"), "template shows locked/unlocked state");
  assert.equal((template.match(/data-arcflight-travel-v2-station-action-lock(?:\s|>)/g) ?? []).length, 1, "template exposes one lock control path");
  assert.equal((template.match(/data-arcflight-travel-v2-station-action-unlock(?:\s|>)/g) ?? []).length, 1, "template exposes one unlock control path");
  assert.equal((template.match(/data-arcflight-travel-v2-station-action-lock-persist/g) ?? []).length, 1, "template exposes one explicit station action lock persistence path");
  assert.equal((template.match(/data-arcflight-runner-approach-select/g) ?? []).length, 1, "template exposes one player station action submission path");
  const aggregate = fs.readFileSync(new URL("../dev/run-travel-v2-smoke.mjs", import.meta.url), "utf8");
  assert.equal((aggregate.match(/Travel event runner v2 station action lock-in/g) ?? []).length, 1, "aggregate Travel v2 smoke includes this suite exactly once");
  return { checked: ["runner state", "ready and not ready", "safe validation messages", "player-safe scan", "GM lock", "GM unlock", "non-GM unlock", "invalid station key", "clone safety", "explicit persistence", "reload", "render no persist", "player submission", "submission redaction", "finalization guard", "template controls", "aggregate suite"] };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(await runTravelEventRunnerV2StationActionLockInSmoke());
export default runTravelEventRunnerV2StationActionLockInSmoke;
