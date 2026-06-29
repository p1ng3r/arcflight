import { LANTERN_IN_THE_STATIC_SAMPLE_EVENT } from "../../data/travel-events/sample-travel-v2-events.js";
import {
  acceptTravelReactionPrompt,
  advanceTravelEventRunnerRound,
  createTravelEventRunnerSession,
  inspectTravelV2RoundResolutionReadiness,
  setTravelEventRunnerStationResult
} from "./travel-event-runner.js";
import { forceTravelV2RoundResolved } from "./travel-v2-dev-tools.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "../apps/travel-event-runner-v2-preview-consumer.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 round resolution readiness smoke check failed: ${message}`);
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
  const forcedRound = forceTravelV2RoundResolved(forcedCreated.session, {}, { playerSafeState: {} });
  assertSmoke(forcedRound.ok && forcedRound.resolvedStationCount === forcedRound.activeStationCount, "forceTravelV2RoundResolved resolves all active stations through station result logic");
  assertSmoke(forcedRound.readiness.ok === true && forcedRound.readiness.unresolvedStationCount === 0, "forced success round is readiness-clean by default");

  session = {
    ...session,
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
  const advanced = advanceTravelEventRunnerRound(session, { force: true });
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
      "gm-override-preserved"
    ]
  };
}

export default runTravelV2RoundResolutionReadinessSmokeChecks;
