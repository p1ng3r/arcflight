import { LANTERN_IN_THE_STATIC_SAMPLE_EVENT } from "../../data/travel-events/sample-travel-v2-events.js";
import {
  acceptTravelReactionPrompt,
  advanceTravelEventRunnerRound,
  createTravelEventRunnerSession,
  inspectTravelV2RoundResolutionReadiness,
  prepareTravelPlayerMissionBoardState,
  prepareTravelPlayerStationCardState,
  setTravelEventRunnerStationResult
} from "./travel-event-runner.js";
import { forceTravelV2RoundResolved } from "./travel-v2-dev-tools.js";
import { applyTravelV2PressureToRunnerSession } from "./travel-v2-session-pressure-application.js";
import { finalizeTravelV2RoundOnRunnerSession } from "./travel-v2-session-round-finalization.js";
import { applyTravelV2SelectedConsequenceToSession, inspectTravelV2ConsequenceApplicationFlow, prepareTravelV2PendingConsequenceQueue, selectTravelV2PendingConsequenceCatalogCard, updateTravelV2PendingConsequenceQueueItem } from "./travel-v2-pending-consequence-queue.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 round resolution readiness smoke check failed: ${message}`);
}

function withLockedTravelFiveActions(session) {
  const stations = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
  const roundIndex = Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0;
  const roundResults = Array.isArray(session.roundResults) ? session.roundResults.map((entry) => ({ ...entry })) : [];
  const current = { ...(roundResults[roundIndex] ?? {}) };
  current.stationActions = { ...(current.stationActions ?? {}) };
  current.stationOrderCommitments = { ...(current.stationOrderCommitments ?? {}) };
  for (const stationKey of stations) {
    current.stationActions[stationKey] = { ...(current.stationActions[stationKey] ?? {}), actionKey: current.stationActions[stationKey]?.actionKey ?? "eventApproach", label: current.stationActions[stationKey]?.label ?? "Event Approach" };
    current.stationOrderCommitments[stationKey] = { ...(current.stationOrderCommitments[stationKey] ?? {}), committed: true };
  }
  roundResults[roundIndex] = current;
  return { ...session, roundResults };
}

export function runTravelV2RoundResolutionReadinessSmokeChecks() {
  const created = createTravelEventRunnerSession(LANTERN_IN_THE_STATIC_SAMPLE_EVENT, { key: "round-resolution-readiness-session", now: "2026-06-29T00:00:00.000Z" });
  assertSmoke(created.ok, "runner session starts from fixture data");
  let session = created.session;

  let readiness = inspectTravelV2RoundResolutionReadiness(null, { playerSafeState: {} });
  assertSmoke(!readiness.ok && readiness.errors.length > 0, "no-session readiness reports a clear error instead of passing");

  readiness = inspectTravelV2RoundResolutionReadiness(session, { playerSafeState: {} });
  assertSmoke(!readiness.ok && readiness.unresolvedStationCount > 1, "fresh round reports unresolved active stations");
  assertSmoke(readiness.roundResolutionBlocked === true && readiness.finalizationReadinessLabel.includes("Resolve active stations"), "GM finalization readiness includes active-station blocker labels");
  const blockedAdvance = advanceTravelEventRunnerRound(session);
  assertSmoke(!blockedAdvance.ok && blockedAdvance.errors.some((error) => error.includes("Resolve active stations") || error.includes("unresolved active stations")), "round advance is blocked with unresolved active stations");

  let updated = setTravelEventRunnerStationResult(session, 0, "navigator", "failure", { now: "2026-06-29T00:01:00.000Z" });
  assertSmoke(updated.ok, "navigator failure result records through existing station result logic");
  session = updated.session;
  readiness = inspectTravelV2RoundResolutionReadiness(session, { playerSafeState: {} });
  assertSmoke(!readiness.ok && readiness.pendingReactionCount === 1, "navigator failure creates a pending Focus reaction and blocks readiness");

  const prompt = session.reactionPrompts.records.find((record) => record.stationKey === "navigator" && record.status === "pending");
  assertSmoke(prompt?.reactionPromptId, "pending Focus reaction prompt is available");
  updated = acceptTravelReactionPrompt(session, prompt.reactionPromptId, { userId: "player2", userName: "Player2", now: "2026-06-29T00:02:00.000Z" });
  assertSmoke(updated.ok, "Focus reaction accepts through existing reaction logic");
  session = updated.session;
  readiness = inspectTravelV2RoundResolutionReadiness(session, { playerSafeState: {} });
  assertSmoke(!readiness.ok && readiness.acceptedFocusCount === 1 && readiness.rerollNeededCount === 1, "accepted Focus without reroll result blocks readiness");

  updated = setTravelEventRunnerStationResult(session, 0, "navigator", "success", { now: "2026-06-29T00:03:00.000Z" });
  assertSmoke(updated.ok, "Focus reroll resolves through existing station result logic");
  session = updated.session;
  for (const stationKey of ["engineer", "veilwarden", "watchmaster", "captain"]) {
    updated = setTravelEventRunnerStationResult(session, 0, stationKey, "success", { now: "2026-06-29T00:04:00.000Z" });
    assertSmoke(updated.ok, `${stationKey} resolves through existing station result logic`);
    session = updated.session;
  }

  const forcedCreated = createTravelEventRunnerSession(LANTERN_IN_THE_STATIC_SAMPLE_EVENT, { key: "round-resolution-force-helper-session", now: "2026-06-29T00:00:00.000Z" });
  const forcedRound = forceTravelV2RoundResolved(withLockedTravelFiveActions(forcedCreated.session), {}, { playerSafeState: {} });
  assertSmoke(forcedRound.ok && forcedRound.resolvedStationCount === forcedRound.activeStationCount, "forceTravelV2RoundResolved resolves all active stations through station result logic");
  assertSmoke(forcedRound.readiness.ok === true && forcedRound.readiness.unresolvedStationCount === 0, "forced success round is readiness-clean when station actions are locked");

  session = {
    ...withLockedTravelFiveActions(session),
    travelV2PressureApplications: { records: [{ roundIndex: 0, roundNumber: 1, outcomeKey: "success", requestCount: 1, createdAt: "2026-06-29T00:05:00.000Z" }] },
    travelV2PendingConsequenceQueue: { records: [{ queueKey: "gm-only:1", status: "pending", label: "GM-only queue label", queueGroup: "readyToApply", internalSeverity: "major" }] }
  };
  const playerState = { roundSummary: { stations: [{ stationKey: "navigator", resultLabel: "Success", focusStatus: "Reroll resolved" }, { stationKey: "engineer", resultLabel: "Success" }, { stationKey: "veilwarden", resultLabel: "Success" }, { stationKey: "watchmaster", resultLabel: "Success" }, { stationKey: "captain", resultLabel: "Success" }] } };
  readiness = inspectTravelV2RoundResolutionReadiness(session, { playerSafeState: playerState });
  assertSmoke(readiness.ok && readiness.unresolvedStationCount === 0, "resolved round passes readiness inspection");
  assertSmoke(readiness.pendingReactionCount === 0 && readiness.rerollNeededCount === 0 && readiness.rerollResolvedCount === 1, "Focus reroll path is settled before round resolution");
  assertSmoke(readiness.canResolveRound === true, "round outcome can be prepared for GM finalization after pressure application exists");
  assertSmoke(readiness.roundResolutionReady === true && readiness.finalizationReadinessLabel.includes("Ready"), "GM finalization readiness reports ready when all blockers are clear");
  assertSmoke(readiness.pendingConsequenceCount >= 1, "GM pending consequence queue can be prepared/countable without mutating gameplay state");
  assertSmoke(readiness.playerSummarySafe === true, "player-facing round state scan remains sanitized");

  const playerJson = JSON.stringify(playerState);
  for (const forbidden of ["pendingConsequenceQueue","queueGroup","consequenceCatalog","gmOnly","internalSeverity","unrevealedHazard","shipScarControls","managementAction","gmItemGroups","catalogSuggestions","GM-only queue label"]) {
    assertSmoke(!playerJson.includes(forbidden), `player mission-board state does not expose ${forbidden}`);
  }
  const nonGmAppState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, user: { isGM: false } });
  const nonGmJson = JSON.stringify(nonGmAppState.pendingConsequenceQueue?.playerSafeItems ?? []);
  for (const forbidden of ["queueGroup","consequenceCatalog","gmOnly","internalSeverity","unrevealedHazard","shipScarControls","managementAction","gmItemGroups","catalogSuggestions","GM-only queue label"]) {
    assertSmoke(!nonGmJson.includes(forbidden), `non-GM player-safe queue items do not expose ${forbidden}`);
  }
  const gmAppState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, user: { isGM: true } });
  assertSmoke(gmAppState.canManageTravelV2Consequences === true && Array.isArray(gmAppState.pendingConsequenceQueue.items), "GM app state retains pending consequence queue readiness controls");
  const flowCreated = createTravelEventRunnerSession(LANTERN_IN_THE_STATIC_SAMPLE_EVENT, { key: "round-resolution-finalize-flow-session", now: "2026-06-29T00:00:00.000Z" });
  const flowResolved = forceTravelV2RoundResolved(withLockedTravelFiveActions(flowCreated.session), { defaultResult: "success" }, { playerSafeState: {} });
  assertSmoke(flowResolved.ok, "full finalize/consequence flow resolves stations through the force helper before finalization");
  const pressureApplied = applyTravelV2PressureToRunnerSession(flowResolved.session, { selectedOutcomeKey: "success", now: "2026-06-29T00:06:00.000Z" });
  assertSmoke(pressureApplied.ok && pressureApplied.applied, "full finalize/consequence flow applies pressure through the real session helper");
  const finalized = finalizeTravelV2RoundOnRunnerSession(pressureApplied.session, { now: "2026-06-29T00:07:00.000Z" });
  assertSmoke(finalized.ok && finalized.finalized && finalized.effectiveOutcomeKey, "full finalize/consequence flow finalizes through the real session helper and records an outcome");
  const finalizedQueue = prepareTravelV2PendingConsequenceQueue(finalized.session);
  assertSmoke(finalizedQueue.hasSession && Number.isInteger(finalizedQueue.pendingCount), "finalized session prepares a consequence queue or explicit no-consequence count");
  let applicationSession = {
    ...finalized.session,
    travelV2SupportBacklashRecords: { records: [{ id: "smoke-support-backlash", roundIndex: 0, status: "pending", severity: "minor", supportingStationName: "Captain", publicRiskText: "Crew panic may spread through the watch." }] }
  };
  let applicationQueue = prepareTravelV2PendingConsequenceQueue(applicationSession);
  const applicationItem = applicationQueue.items.find((item) => item.queueKey === "support-backlash:smoke-support-backlash");
  assertSmoke(applicationItem?.status === "pending", "controlled pending consequence fixture creates a pending queue item");
  const selectedApplication = selectTravelV2PendingConsequenceCatalogCard(applicationSession, applicationItem.queueKey, "consequence-crew-panic", { now: "2026-06-29T00:07:30.000Z" });
  assertSmoke(selectedApplication.ok, "controlled pending consequence selects an executable catalog card through existing queue selection logic");
  applicationSession = selectedApplication.session;
  const beforePressure = Number(applicationSession.pressure?.morale?.value ?? 0);
  let applicationFlow = inspectTravelV2ConsequenceApplicationFlow(applicationSession);
  assertSmoke(applicationFlow.pendingConsequenceCount >= 1 && applicationFlow.duplicateApplicationRecordCount === 0 && applicationFlow.invalidResourceMutationCount === 0, "consequence application inspection reports clean pending application state");
  const appliedConsequence = applyTravelV2SelectedConsequenceToSession(applicationSession, applicationItem.queueKey, { now: "2026-06-29T00:08:00.000Z", appliedByUserId: "gm1", appliedByUserName: "GM" });
  assertSmoke(appliedConsequence.ok && appliedConsequence.appliedRecord?.applicationId, "single consequence applies through the real selected-consequence apply path and records an application id");
  assertSmoke(appliedConsequence.appliedRecord.resource === "morale" && Number.isFinite(appliedConsequence.appliedRecord.beforeValue) && Number.isFinite(appliedConsequence.appliedRecord.afterValue), "application record uses an allowed finite travel resource mutation");
  assertSmoke(appliedConsequence.appliedRecord.beforeValue === beforePressure && appliedConsequence.appliedRecord.afterValue === beforePressure + 1, "resource mutation records finite before/after values exactly once");
  applicationSession = appliedConsequence.session;
  applicationFlow = inspectTravelV2ConsequenceApplicationFlow(applicationSession);
  assertSmoke(applicationFlow.applicationRecordCount >= 1 && applicationFlow.duplicateApplicationRecordCount === 0 && applicationFlow.invalidResourceMutationCount === 0, "application inspection sees one auditable record with no duplicates or invalid mutations");
  const secondApply = applyTravelV2SelectedConsequenceToSession(applicationSession, applicationItem.queueKey, { now: "2026-06-29T00:08:01.000Z", appliedByUserId: "gm1", appliedByUserName: "GM" });
  assertSmoke(!secondApply.ok && secondApply.alreadyApplied === true, "double-apply attempt is rejected as already applied");
  assertSmoke(Number(applicationSession.pressure?.morale?.value ?? 0) === beforePressure + 1, "double-apply rejection does not mutate the resource a second time");
  const secondFlow = inspectTravelV2ConsequenceApplicationFlow(applicationSession);
  assertSmoke(secondFlow.applicationRecordCount === applicationFlow.applicationRecordCount && secondFlow.duplicateApplicationRecordCount === 0, "double-apply rejection does not create duplicate application history");
  const finalizedGmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: finalized.session, user: { isGM: true } });
  assertSmoke(finalizedGmState.canManageTravelV2Consequences === true && Array.isArray(finalizedGmState.pendingConsequenceQueue.gmItemGroups), "GM state includes consequence management controls after finalization");
  const finalizedPlayerState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: finalized.session, user: { isGM: false } });
  const finalizedPlayerJson = JSON.stringify(finalizedPlayerState.pendingConsequenceQueue?.playerSafeItems ?? []);
  for (const forbidden of ["pendingConsequenceQueue","queueGroup","consequenceCatalog","gmOnly","internalSeverity","unrevealedHazard","shipScarControls","managementAction","gmItemGroups","catalogSuggestions","selectedConsequenceApplyPreview","unrevealed consequence","unrevealed hazard"]) {
    assertSmoke(!finalizedPlayerJson.includes(forbidden), `post-finalization player-safe state does not expose ${forbidden}`);
  }
  let cleanFinalizedSession = finalized.session;
  if (finalizedQueue.items.length > 0) {
    const first = finalizedQueue.items[0];
    const blockedByConsequence = advanceTravelEventRunnerRound(finalized.session);
    assertSmoke(!blockedByConsequence.ok && blockedByConsequence.errors.some((error) => error.includes("Review pending consequences")), "round advance remains blocked while finalized consequence queue has pending items");
    const dismissed = updateTravelV2PendingConsequenceQueueItem(finalized.session, first.queueKey, "dismissed", { now: "2026-06-29T00:08:00.000Z" });
    assertSmoke(dismissed.ok && dismissed.queue.dismissedCount >= 1, "consequence dismiss path updates queue state through existing logic");
    const dismissedGmState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: dismissed.session, user: { isGM: true } });
    assertSmoke(dismissedGmState.pendingConsequenceQueue.dismissedCount >= 1, "GM state updates after consequence item state change");
    const dismissedPlayerJson = JSON.stringify(prepareTravelEventRunnerAppStateWithTravelV2Preview({ session: dismissed.session, user: { isGM: false } }).pendingConsequenceQueue?.playerSafeItems ?? []);
    assertSmoke(!dismissedPlayerJson.includes("gmItemGroups") && !dismissedPlayerJson.includes("catalogSuggestions"), "player-safe state stays sanitized after consequence queue state change");
    cleanFinalizedSession = dismissed.session;
  }

  const cleanAdvance = advanceTravelEventRunnerRound(cleanFinalizedSession);
  assertSmoke(cleanAdvance.ok && cleanAdvance.session.currentRoundIndex === 1, "clean finalized round advances normally to round 1");
  const roundOne = cleanAdvance.session.event.rounds[1];
  assertSmoke(Array.isArray(roundOne?.activeStations) && roundOne.activeStations.length > 0, "round 1 exists and has active stations after advancement");
  assertSmoke(Object.keys(cleanAdvance.session.roundResults[0]?.stationResults ?? {}).length > 0, "round 0 results remain stored as history after advancement");
  const roundOneResults = cleanAdvance.session.roundResults[1]?.stationResults ?? {};
  assertSmoke(roundOne.activeStations.every((stationKey) => !roundOneResults[stationKey]), "round 1 active station results are fresh and not pre-filled from round 0");
  const advancedPlayerState = prepareTravelPlayerMissionBoardState(cleanAdvance.session);
  assertSmoke(advancedPlayerState.currentRoundIndex === 1 && advancedPlayerState.roundLabel === "Round 2", "player mission board reports the advanced current round");
  assertSmoke((advancedPlayerState.stations ?? []).length === roundOne.activeStations.length && (advancedPlayerState.stations ?? []).every((station) => roundOne.activeStations.includes(station.stationKey)), "player mission board exposes only round 1 actionable stations");
  const advancedPlayerJson = JSON.stringify(advancedPlayerState);
  for (const forbidden of ["pendingConsequenceQueue","gmItemGroups","catalogSuggestions","selectedConsequenceApplyPreview","unrevealedHazard","GM-only queue label"]) {
    assertSmoke(!advancedPlayerJson.includes(forbidden), `advanced player mission-board state does not expose ${forbidden}`);
  }
  const advancedStationCards = roundOne.activeStations.map((stationKey) => prepareTravelPlayerStationCardState(cleanAdvance.session, stationKey));
  assertSmoke(advancedStationCards.every((card) => card.currentRoundIndex === 1 && card.canRollStation === false && card.resultLabel === "" && card.focusReactionAvailable === false && card.focusRerollNeeded === false), "round 1 player station cards do not carry stale round 0 result, Focus, or reroll state");

  const advanced = advanceTravelEventRunnerRound(finalized.session, { force: true });
  assertSmoke(advanced.ok && advanced.session.currentRoundIndex === 1, "explicit force override remains available for intentional GM override behavior");

  return {
    ok: true,
    checked: [
      "full-round-fixture-start",
      "unresolved-station-guard",
      "pending-focus-detection",
      "accepted-focus-reroll-needed-detection",
      "settled-focus-reroll-readiness",
      "gm-pending-consequence-readiness",
      "force-round-resolved-helper",
      "gm-finalization-readiness-labels",
      "player-safe-round-summary-scan",
      "finalize-consequence-queue-flow",
      "consequence-state-change-player-safety",
      "finalized-round-advance-player-sync",
      "gm-override-preserved"
    ]
  };
}

export default runTravelV2RoundResolutionReadinessSmokeChecks;
