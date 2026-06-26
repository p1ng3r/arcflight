import {
  applyTravelV2SupportBacklashRecord,
  createTravelEventRunnerSession,
  createTravelV2SupportBacklashRecord,
  dismissTravelV2SupportBacklashRecord,
  sanitizeTravelV2SupportBacklashForPlayers,
  setTravelEventRunnerStationAction,
  setTravelEventRunnerStationResult
} from "./travel-event-runner.js";
import { prepareTravelV2RoundNarration, sanitizeTravelV2PublicNarration } from "./travel-v2-narration.js";
import { ARCFLIGHT_TRAVEL_STATION_ACTIONS } from "./travel-pressure.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 support backlash smoke check failed: ${message}`); }
function okSession(result) { assertSmoke(result.ok, result.errors?.join("; ") || "session update failed"); return result.session; }
function snap(value) { return JSON.stringify(value); }
function fixtureEvent() {
  const stations = ["navigator", "engineer", "captain", "watchmaster"];
  const feedback = { criticalSuccess: "Strong.", success: "Good.", failure: "Bad.", criticalFailure: "Worse." };
  return { key: "support-backlash", name: "Support Backlash", category: "navigation", baseDC: 20, roundCount: 1, tags: ["smoke"], activeResources: ["strain"], rounds: [{ roundNumber: 1, title: "Bad Stars", activeStations: stations, primaryPressure: "strain", outcomeBranches: { dominantSuccess: "Win.", mixed: "Mixed.", dominantFailure: "Fail.", catastrophicFailure: "Crash." }, stationPrompts: Object.fromEntries(stations.map((stationKey) => [stationKey, { stationKey, playerAction: "Act.", suggestedSkills: ["perception"], rollFeedback: feedback }])), stationCards: stations.map((stationKey) => ({ stationKey, rollFeedback: feedback, skillApproaches: [{ label: "Push", skill: "perception", helpText: "Help.", boardResultFeedback: feedback, gmNarrationFeedback: feedback }] })) }], finalOutcomes: { majorVictory: { text: "Great." }, victory: { text: "Safe." }, costlySuccess: { text: "Mixed." }, failure: { text: "Rough." }, catastrophicFailure: { text: "Lost." } } };
}
function setSupport(session, targetStationKey = "navigator") { return okSession(setTravelEventRunnerStationAction(session, 0, "engineer", ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT, { targetStationKey })); }

export async function runTravelV2SupportBacklashSmokeChecks() {
  const sideEffects = [];
  const prior = { ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, Actor: globalThis.Actor, Item: globalThis.Item, socket: globalThis.socket, canvas: globalThis.canvas };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { combat: { update: () => sideEffects.push("combat") }, socket: { emit: () => sideEffects.push("socket") }, user: { id: "gm", name: "GM" } };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  globalThis.socket = { emit: () => sideEffects.push("socket") };
  globalThis.canvas = { scene: { update: () => sideEffects.push("scene") }, tokens: { updateAll: () => sideEffects.push("tokens") } };
  try {
    let success = okSession(createTravelEventRunnerSession(fixtureEvent()));
    success = setSupport(success);
    success = okSession(setTravelEventRunnerStationResult(success, 0, "engineer", "success"));
    assertSmoke(success.travelV2SupportRecords.records[0]?.assistValue === 1, "Support success still creates +1 assist");
    assertSmoke(success.travelV2SupportBacklashRecords.records.length === 0, "Support success creates no backlash");

    let criticalSuccess = okSession(createTravelEventRunnerSession(fixtureEvent()));
    criticalSuccess = setSupport(criticalSuccess);
    criticalSuccess = okSession(setTravelEventRunnerStationResult(criticalSuccess, 0, "engineer", "criticalSuccess"));
    assertSmoke(criticalSuccess.travelV2SupportRecords.records[0]?.assistValue === 2, "Support critical success still creates +2 assist");
    assertSmoke(criticalSuccess.travelV2SupportBacklashRecords.records.length === 0, "Support critical success creates no backlash");

    let failure = okSession(createTravelEventRunnerSession(fixtureEvent(), { now: "2026-06-25T00:00:00.000Z" }));
    failure = setSupport(failure);
    failure = okSession(setTravelEventRunnerStationResult(failure, 0, "engineer", "failure", { now: "2026-06-25T00:01:00.000Z" }));
    const minor = failure.travelV2SupportBacklashRecords.records[0];
    assertSmoke(failure.travelV2SupportRecords.records.length === 0, "failed Support creates no success assist");
    assertSmoke(minor?.status === "pending" && minor.severity === "minor" && minor.sourceResult === "failure", "Support failure creates one pending minor consequence candidate");
    assertSmoke(minor.publicRiskText === "Engineer’s Support for Navigator falters, creating a minor complication candidate.", "minor public text is table-ready");
    const duplicate = createTravelV2SupportBacklashRecord(failure, 0, "engineer");
    assertSmoke(duplicate.duplicate === true && duplicate.session.travelV2SupportBacklashRecords.records.length === 1, "duplicate pending Support backlash records are prevented");

    let criticalFailure = okSession(createTravelEventRunnerSession(fixtureEvent()));
    criticalFailure = setSupport(criticalFailure);
    criticalFailure = okSession(setTravelEventRunnerStationResult(criticalFailure, 0, "engineer", "criticalFailure"));
    const major = criticalFailure.travelV2SupportBacklashRecords.records[0];
    assertSmoke(major?.status === "pending" && major.severity === "major" && major.sourceResult === "criticalFailure", "Support critical failure creates one pending major backlash candidate");
    assertSmoke(major.publicRiskText === "Engineer’s Support for Navigator backfires, creating a major backlash candidate.", "major public text is table-ready");

    let nonSupport = okSession(createTravelEventRunnerSession(fixtureEvent()));
    nonSupport = okSession(setTravelEventRunnerStationResult(nonSupport, 0, "engineer", "failure"));
    assertSmoke(nonSupport.travelV2SupportBacklashRecords.records.length === 0, "non-Support failure does not create Support backlash");
    const invalidTarget = okSession(createTravelEventRunnerSession(fixtureEvent()));
    const rejectedInvalidTarget = setTravelEventRunnerStationAction(invalidTarget, 0, "engineer", ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT, { targetStationKey: "engineer" });
    assertSmoke(rejectedInvalidTarget.ok === false, "invalid Support target selection is rejected");
    const invalidAfterResult = okSession(setTravelEventRunnerStationResult(invalidTarget, 0, "engineer", "failure"));
    assertSmoke(invalidAfterResult.travelV2SupportBacklashRecords.records.length === 0, "invalid Support target does not create Support backlash");

    let applied = okSession(applyTravelV2SupportBacklashRecord(failure, minor.id, { note: "Manual consequence framed", now: "2026-06-25T00:02:00.000Z" }));
    assertSmoke(applied.travelV2SupportBacklashRecords.records[0].status === "applied", "applying a pending record marks it applied");
    const appliedResolvedAt = applied.travelV2SupportBacklashRecords.records[0].resolvedAt;
    applied = okSession(setTravelEventRunnerStationResult(applied, 0, "engineer", "success", { now: "2026-06-25T00:03:00.000Z" }));
    assertSmoke(applied.travelV2SupportBacklashRecords.records[0].status === "applied" && applied.travelV2SupportBacklashRecords.records[0].resolvedAt === appliedResolvedAt, "applied records are not rewritten by later result changes");

    let dismissed = okSession(dismissTravelV2SupportBacklashRecord(criticalFailure, major.id, { note: "No consequence", now: "2026-06-25T00:04:00.000Z" }));
    assertSmoke(dismissed.travelV2SupportBacklashRecords.records[0].status === "dismissed", "dismissing a pending record marks it dismissed");
    const dismissedResolvedAt = dismissed.travelV2SupportBacklashRecords.records[0].resolvedAt;
    dismissed = okSession(setTravelEventRunnerStationResult(dismissed, 0, "engineer", "success", { now: "2026-06-25T00:05:00.000Z" }));
    assertSmoke(dismissed.travelV2SupportBacklashRecords.records[0].status === "dismissed" && dismissed.travelV2SupportBacklashRecords.records[0].resolvedAt === dismissedResolvedAt, "dismissed records are not rewritten by later result changes");

    let actionChange = okSession(createTravelEventRunnerSession(fixtureEvent()));
    actionChange = setSupport(actionChange);
    actionChange = okSession(setTravelEventRunnerStationResult(actionChange, 0, "engineer", "failure"));
    actionChange = okSession(setTravelEventRunnerStationAction(actionChange, 0, "engineer", ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH));
    assertSmoke(actionChange.travelV2SupportBacklashRecords.records.length === 0, "pending stale records are cleaned up if action changes away from Support");

    let targetChange = okSession(createTravelEventRunnerSession(fixtureEvent()));
    targetChange = setSupport(targetChange, "navigator");
    targetChange = okSession(setTravelEventRunnerStationResult(targetChange, 0, "engineer", "failure"));
    const oldId = targetChange.travelV2SupportBacklashRecords.records[0].id;
    targetChange = okSession(setTravelEventRunnerStationAction(targetChange, 0, "engineer", ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT, { targetStationKey: "captain" }));
    assertSmoke(targetChange.travelV2SupportBacklashRecords.records.length === 1 && targetChange.travelV2SupportBacklashRecords.records[0].targetStationKey === "captain" && targetChange.travelV2SupportBacklashRecords.records[0].id !== oldId, "pending stale records are replaced if Support target changes");

    const secretState = { records: [{ ...minor, gmNote: "GM ONLY SECRET", actorId: "PRIVATE", hiddenHazardData: "SECRET", target: { raw: true }, resolvedByUserId: "gm-user", mutationInstructions: "mutate" }] };
    const player = sanitizeTravelV2SupportBacklashForPlayers(secretState);
    const playerRecord = player.records[0];
    assertSmoke(playerRecord.id && playerRecord.roundIndex === 0 && playerRecord.supportingStationKey === "engineer" && playerRecord.targetStationKey === "navigator" && playerRecord.severity === "minor" && playerRecord.sourceResult === "failure" && playerRecord.statusLabel === "Pending" && playerRecord.publicRiskText, "player sanitizer includes public fields");
    assertSmoke(!snap(player).includes("GM ONLY SECRET") && !snap(player).includes("PRIVATE") && !snap(player).includes("SECRET") && !snap(player).includes("gm-user") && !snap(player).includes("raw") && !snap(player).includes("mutate"), "player sanitizer omits GM-only/private/internal fields");

    const narrationSession = JSON.parse(JSON.stringify(failure));
    narrationSession.travelV2SupportBacklashRecords.records[0].gmNote = "GM ONLY SECRET";
    const narration = prepareTravelV2RoundNarration(narrationSession, 0);
    assertSmoke(narration.supportBacklash.narrationLines.some((line) => line.includes("falters") && line.includes("minor complication candidate")), "narration mentions failed Support consequence candidates");
    assertSmoke(!snap(narration.supportBacklash).includes("GM ONLY SECRET"), "narration does not leak GM notes");
    assertSmoke(!/pressure .*applied|damage .*applied|condition .*applied/i.test(snap(narration.supportBacklash)), "narration does not imply automatic pressure/damage/condition application");
    const publicNarration = sanitizeTravelV2PublicNarration(narration);
    assertSmoke(!snap(publicNarration).includes("GM ONLY SECRET"), "public narration sanitizer omits GM-only Support backlash notes");
    assertSmoke(sideEffects.length === 0, "Support backlash flow has no actor/item/chat/journal/combat/socket/scene/token side effects");
    return { checked: ["success unchanged", "failure creation", "critical failure creation", "non-support/invalid target", "duplicate prevention", "apply/dismiss", "history unchanged", "stale cleanup", "target replacement", "sanitization", "narration", "no side effects"] };
  } finally {
    Object.assign(globalThis, prior);
  }
}

export default runTravelV2SupportBacklashSmokeChecks;
