import {
  clearTravelEventRunnerStationResult,
  createTravelEventRunnerSession,
  createTravelV2SupportRecord,
  dismissTravelV2SupportRecord,
  sanitizeTravelV2SupportForPlayers,
  setTravelEventRunnerStationAction,
  setTravelEventRunnerStationResult,
  useTravelV2SupportRecord
} from "./travel-event-runner.js";
import { ARCFLIGHT_TRAVEL_STATION_ACTIONS } from "./travel-pressure.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 support assist records smoke check failed: ${message}`); }
function okSession(result) { assertSmoke(result.ok, result.errors?.join("; ") || "session update failed"); return result.session; }
function snap(value) { return JSON.stringify(value); }
function fixtureEvent() {
  const stations = ["navigator", "engineer", "captain", "watchmaster"];
  const feedback = { criticalSuccess: "Strong.", success: "Good.", failure: "Bad.", criticalFailure: "Worse." };
  return { key: "support-assists", name: "Support Assists", category: "navigation", baseDC: 20, roundCount: 1, tags: ["smoke"], activeResources: ["strain"], rounds: [{ roundNumber: 1, title: "Bad Stars", activeStations: stations, primaryPressure: "strain", outcomeBranches: { dominantSuccess: "Win.", mixed: "Mixed.", dominantFailure: "Fail.", catastrophicFailure: "Crash." }, stationPrompts: Object.fromEntries(stations.map((stationKey) => [stationKey, { stationKey, playerAction: "Act.", suggestedSkills: ["perception"], rollFeedback: feedback }])), stationCards: stations.map((stationKey) => ({ stationKey, rollFeedback: feedback, skillApproaches: [{ label: "Push", skill: "perception", helpText: "Help.", boardResultFeedback: feedback, gmNarrationFeedback: feedback }] })) }], finalOutcomes: { majorVictory: { text: "Great." }, victory: { text: "Safe." }, costlySuccess: { text: "Mixed." }, failure: { text: "Rough." }, catastrophicFailure: { text: "Lost." } } };
}
function setSupport(session, supportingStationKey = "engineer", targetStationKey = "navigator") {
  return okSession(setTravelEventRunnerStationAction(session, 0, supportingStationKey, ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT, { targetStationKey }));
}

export async function runTravelV2SupportAssistRecordsSmokeChecks() {
  const sideEffects = [];
  const prior = { ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, Actor: globalThis.Actor, Item: globalThis.Item, socket: globalThis.socket };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { combat: { update: () => sideEffects.push("combat") }, socket: { emit: () => sideEffects.push("socket") }, user: { id: "gm", name: "GM" } };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  globalThis.socket = { emit: () => sideEffects.push("socket") };
  try {
    let session = okSession(createTravelEventRunnerSession(fixtureEvent(), { now: "2026-06-25T00:00:00.000Z" }));
    session = setSupport(session);
    session = okSession(setTravelEventRunnerStationResult(session, 0, "engineer", "success", { now: "2026-06-25T00:01:00.000Z" }));
    assertSmoke(session.travelV2SupportRecords.records.length === 1 && session.travelV2SupportRecords.records[0].status === "pending", "Support + success creates one pending assist");
    assertSmoke(session.travelV2SupportRecords.records[0].assistValue === 1, "Support success assist has value 1");
    const duplicate = createTravelV2SupportRecord(session, 0, "engineer");
    assertSmoke(duplicate.duplicate === true && duplicate.session.travelV2SupportRecords.records.length === 1, "duplicate pending Support assist records are prevented");

    let criticalSession = okSession(createTravelEventRunnerSession(fixtureEvent()));
    criticalSession = setSupport(criticalSession);
    criticalSession = okSession(setTravelEventRunnerStationResult(criticalSession, 0, "engineer", "criticalSuccess"));
    assertSmoke(criticalSession.travelV2SupportRecords.records.length === 1 && criticalSession.travelV2SupportRecords.records[0].assistValue === 2, "Support + critical success creates one stronger pending assist");

    for (const result of ["failure", "criticalFailure"]) {
      let failedSession = okSession(createTravelEventRunnerSession(fixtureEvent()));
      failedSession = setSupport(failedSession);
      failedSession = okSession(setTravelEventRunnerStationResult(failedSession, 0, "engineer", result));
      assertSmoke(failedSession.travelV2SupportRecords.records.length === 0, `Support + ${result} creates no assist`);
      assertSmoke(failedSession.travelV2FocusBacklashRecords.records.length === 0, `Support + ${result} creates no Support backlash`);
    }

    let nonSupport = okSession(createTravelEventRunnerSession(fixtureEvent()));
    nonSupport = okSession(setTravelEventRunnerStationResult(nonSupport, 0, "engineer", "success"));
    assertSmoke(nonSupport.travelV2SupportRecords.records.length === 0, "non-Support success creates no assist");

    const invalidTarget = okSession(createTravelEventRunnerSession(fixtureEvent()));
    const rejectedInvalidTarget = setTravelEventRunnerStationAction(invalidTarget, 0, "engineer", ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT, { targetStationKey: "engineer" });
    assertSmoke(rejectedInvalidTarget.ok === false, "invalid Support target selection is rejected");
    const invalidTargetAfterResult = okSession(setTravelEventRunnerStationResult(invalidTarget, 0, "engineer", "success"));
    assertSmoke(invalidTargetAfterResult.travelV2SupportRecords.records.length === 0, "rejected invalid Support target creates no assist");

    const originalId = session.travelV2SupportRecords.records[0].id;
    session = okSession(setTravelEventRunnerStationResult(session, 0, "engineer", "failure", { now: "2026-06-25T00:02:00.000Z" }));
    const stale = session.travelV2SupportRecords.records.find((record) => record.id === originalId);
    assertSmoke(stale?.status === "dismissed" && stale?.resolutionNote === "Original Support assist trigger result changed before the assist was used.", "changing success to failure dismisses pending assist");
    session = okSession(setTravelEventRunnerStationResult(session, 0, "engineer", "success", { now: "2026-06-25T00:03:00.000Z" }));
    assertSmoke(session.travelV2SupportRecords.records.filter((record) => record.status === "pending").length === 1 && session.travelV2SupportRecords.records.some((record) => record.id !== originalId && record.status === "pending"), "later success after dismissed stale record creates fresh pending assist");

    let clearSession = okSession(createTravelEventRunnerSession(fixtureEvent()));
    clearSession = setSupport(clearSession);
    clearSession = okSession(setTravelEventRunnerStationResult(clearSession, 0, "engineer", "success", { now: "2026-06-25T01:00:00.000Z" }));
    const clearId = clearSession.travelV2SupportRecords.records[0].id;
    clearSession = okSession(clearTravelEventRunnerStationResult(clearSession, 0, "engineer", { now: "2026-06-25T01:01:00.000Z" }));
    const cleared = clearSession.travelV2SupportRecords.records.find((record) => record.id === clearId);
    assertSmoke(cleared?.status === "dismissed" && cleared?.resolutionNote === "Station result was cleared before the Support assist was used.", "clearing a result dismisses pending assist");

    let actionChangeSession = okSession(createTravelEventRunnerSession(fixtureEvent()));
    actionChangeSession = setSupport(actionChangeSession);
    actionChangeSession = okSession(setTravelEventRunnerStationResult(actionChangeSession, 0, "engineer", "success", { now: "2026-06-25T01:30:00.000Z" }));
    const actionChangeId = actionChangeSession.travelV2SupportRecords.records[0].id;
    actionChangeSession = okSession(setTravelEventRunnerStationAction(actionChangeSession, 0, "engineer", ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH, { now: "2026-06-25T01:31:00.000Z" }));
    const actionChanged = actionChangeSession.travelV2SupportRecords.records.find((record) => record.id === actionChangeId);
    assertSmoke(actionChanged?.status === "dismissed" && actionChanged?.resolutionNote === "Support station action changed before the assist was used.", "changing Support action away dismisses pending assist");

    let usedSession = okSession(createTravelEventRunnerSession(fixtureEvent()));
    usedSession = setSupport(usedSession);
    usedSession = okSession(setTravelEventRunnerStationResult(usedSession, 0, "engineer", "success", { now: "2026-06-25T02:00:00.000Z" }));
    const usedId = usedSession.travelV2SupportRecords.records[0].id;
    usedSession = okSession(useTravelV2SupportRecord(usedSession, usedId, { note: "Used manually", now: "2026-06-25T02:01:00.000Z" }));
    const usedResolvedAt = usedSession.travelV2SupportRecords.records.find((record) => record.id === usedId)?.resolvedAt;
    assertSmoke(usedSession.travelV2SupportRecords.records.find((record) => record.id === usedId)?.status === "used", "Use marks pending assist as used");
    usedSession = okSession(setTravelEventRunnerStationResult(usedSession, 0, "engineer", "failure", { now: "2026-06-25T02:02:00.000Z" }));
    assertSmoke(usedSession.travelV2SupportRecords.records.find((record) => record.id === usedId)?.status === "used" && usedSession.travelV2SupportRecords.records.find((record) => record.id === usedId)?.resolvedAt === usedResolvedAt, "used records are not rewritten when result later changes");

    let dismissedSession = okSession(createTravelEventRunnerSession(fixtureEvent()));
    dismissedSession = setSupport(dismissedSession);
    dismissedSession = okSession(setTravelEventRunnerStationResult(dismissedSession, 0, "engineer", "success"));
    const dismissedId = dismissedSession.travelV2SupportRecords.records[0].id;
    dismissedSession = okSession(dismissTravelV2SupportRecord(dismissedSession, dismissedId, { note: "No longer needed", now: "2026-06-25T03:00:00.000Z" }));
    const dismissedResolvedAt = dismissedSession.travelV2SupportRecords.records.find((record) => record.id === dismissedId)?.resolvedAt;
    assertSmoke(dismissedSession.travelV2SupportRecords.records.find((record) => record.id === dismissedId)?.status === "dismissed", "Dismiss marks pending assist as dismissed");
    dismissedSession = okSession(setTravelEventRunnerStationResult(dismissedSession, 0, "engineer", "failure", { now: "2026-06-25T03:01:00.000Z" }));
    assertSmoke(dismissedSession.travelV2SupportRecords.records.find((record) => record.id === dismissedId)?.resolvedAt === dismissedResolvedAt, "dismissed records are not rewritten when result later changes");

    const player = sanitizeTravelV2SupportForPlayers({ records: [{ ...usedSession.travelV2SupportRecords.records[0], gmNote: "GM ONLY SECRET", actorId: "PRIVATE", hiddenHazardData: "SECRET" }] });
    assertSmoke(!snap(player).includes("GM ONLY SECRET") && !snap(player).includes("PRIVATE") && !snap(player).includes("SECRET"), "player sanitizer omits GM-only/private fields");
    assertSmoke(sideEffects.length === 0, "Support assist flow has no actor/item/chat/journal/combat/socket side effects");
    return { checked: ["creation", "critical value", "no failed records/backlash", "non-support/invalid target", "duplicate prevention", "stale cleanup", "action-change cleanup", "use/dismiss", "sanitization", "no side effects"] };
  } finally {
    Object.assign(globalThis, prior);
  }
}

export default runTravelV2SupportAssistRecordsSmokeChecks;
