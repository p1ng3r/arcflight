import {
  applyTravelV2FocusBacklash,
  commitTravelEventRunnerStationFocus,
  createTravelEventRunnerSession,
  createTravelV2FocusBacklashRecord,
  dismissTravelV2FocusBacklash,
  clearTravelEventRunnerStationResult,
  sanitizeTravelV2FocusBacklashForPlayers,
  setTravelEventRunnerStationResult
} from "./travel-event-runner.js";
import { prepareTravelV2RoundNarration, sanitizeTravelV2PublicNarration } from "./travel-v2-narration.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 focus backlash records smoke check failed: ${message}`); }
function okSession(result) { assertSmoke(result.ok, result.errors?.join("; ") || "session update failed"); return result.session; }
function snap(value) { return JSON.stringify(value); }
function fixtureEvent() {
  const stations = ["navigator", "engineer", "captain", "watchmaster"];
  const feedback = { criticalSuccess: "Strong.", success: "Good.", failure: "Bad.", criticalFailure: "Worse." };
  return { key: "focus-backlash", name: "Focus Backlash", category: "navigation", baseDC: 20, roundCount: 1, tags: ["smoke"], activeResources: ["strain"], rounds: [{ roundNumber: 1, title: "Bad Stars", activeStations: stations, primaryPressure: "strain", outcomeBranches: { dominantSuccess: "Win.", mixed: "Mixed.", dominantFailure: "Fail.", catastrophicFailure: "Crash." }, stationPrompts: Object.fromEntries(stations.map((stationKey) => [stationKey, { stationKey, playerAction: "Act.", suggestedSkills: ["perception"], rollFeedback: feedback }])), stationCards: stations.map((stationKey) => ({ stationKey, rollFeedback: feedback, skillApproaches: [{ label: "Push", skill: "perception", helpText: "Help.", boardResultFeedback: feedback, gmNarrationFeedback: feedback }] })) }], finalOutcomes: { majorVictory: { text: "Great." }, victory: { text: "Safe." }, costlySuccess: { text: "Mixed." }, failure: { text: "Rough." }, catastrophicFailure: { text: "Lost." } } };
}

export async function runTravelV2FocusBacklashRecordsSmokeChecks() {
  const sideEffects = [];
  const prior = { ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, Actor: globalThis.Actor, Item: globalThis.Item, socket: globalThis.socket };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { combat: { update: () => sideEffects.push("combat") }, socket: { emit: () => sideEffects.push("socket") }, user: { id: "gm", name: "GM" } };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  globalThis.socket = { emit: () => sideEffects.push("socket") };
  try {
    let session = okSession(createTravelEventRunnerSession(fixtureEvent(), { now: "2026-06-24T00:00:00.000Z" }));
    session = okSession(commitTravelEventRunnerStationFocus(session, 0, "navigator", "hard-correction", { now: "2026-06-24T00:01:00.000Z" }));
    assertSmoke(session.travelV2FocusBacklashRecords.records.length === 0, "no backlash before Focus-backed roll resolves");
    session = okSession(setTravelEventRunnerStationResult(session, 0, "navigator", "success"));
    assertSmoke(session.travelV2FocusBacklashRecords.records.length === 0, "Focus + success creates no backlash by default");

    session = okSession(commitTravelEventRunnerStationFocus(session, 0, "engineer", "blow-the-safety-valves"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "engineer", "criticalSuccess"));
    assertSmoke(session.travelV2FocusBacklashRecords.records.length === 0, "Focus + critical success creates no backlash by default");

    session = okSession(commitTravelEventRunnerStationFocus(session, 0, "captain", "hold-the-line"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "captain", "failure", { now: "2026-06-24T00:02:00.000Z" }));
    assertSmoke(session.travelV2FocusBacklashRecords.records.length === 1 && session.travelV2FocusBacklashRecords.records[0].status === "pending", "Focus + failure creates one pending backlash");
    assertSmoke(session.travelV2FocusBacklashRecords.records[0].pressureDelta === 1, "failure backlash has +1 pressure delta");
    const duplicate = createTravelV2FocusBacklashRecord(session, 0, "captain", "hold-the-line");
    assertSmoke(duplicate.duplicate === true && duplicate.session.travelV2FocusBacklashRecords.records.length === 1, "duplicate pending backlash is prevented");

    const originalCaptainBacklashId = session.travelV2FocusBacklashRecords.records[0].id;
    session = okSession(setTravelEventRunnerStationResult(session, 0, "captain", "success", { now: "2026-06-24T00:02:30.000Z" }));
    const staleDismissed = session.travelV2FocusBacklashRecords.records.find((record) => record.id === originalCaptainBacklashId);
    assertSmoke(staleDismissed?.status === "dismissed", "changing failure to success dismisses pending Focus backlash");
    assertSmoke(staleDismissed?.resolutionNote === "Original Focus backlash trigger result changed before the backlash was resolved.", "stale result dismissal records a clear resolution note");
    session = okSession(setTravelEventRunnerStationResult(session, 0, "captain", "failure", { now: "2026-06-24T00:02:45.000Z" }));
    const captainPending = session.travelV2FocusBacklashRecords.records.filter((record) => record.stationKey === "captain" && record.status === "pending");
    assertSmoke(captainPending.length === 1 && captainPending[0].id !== originalCaptainBacklashId, "failure after a dismissed stale record creates one fresh pending backlash without rewriting the dismissed record");

    session = okSession(commitTravelEventRunnerStationFocus(session, 0, "watchmaster", "read-the-enemy"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "watchmaster", "criticalFailure", { now: "2026-06-24T00:03:00.000Z" }));
    const critical = session.travelV2FocusBacklashRecords.records.find((record) => record.stationKey === "watchmaster");
    assertSmoke(critical?.pressureDelta === 2 && critical.consequenceCandidate, "critical failure creates a stronger pending backlash");

    const beforeSnap = snap({ actors: globalThis.Actor, items: globalThis.Item });
    const captainApplyId = captainPending[0].id;
    session = okSession(applyTravelV2FocusBacklash(session, captainApplyId, { now: "2026-06-24T00:04:00.000Z" }));
    assertSmoke(session.travelV2FocusBacklashRecords.records.find((record) => record.id === captainApplyId)?.status === "applied" && session.pressure.strain === 1, "GM Apply marks applied and updates session-local pressure");
    const appliedResolvedAt = session.travelV2FocusBacklashRecords.records.find((record) => record.id === captainApplyId)?.resolvedAt;
    session = okSession(setTravelEventRunnerStationResult(session, 0, "captain", "success", { now: "2026-06-24T00:04:30.000Z" }));
    const appliedAfterResultChange = session.travelV2FocusBacklashRecords.records.find((record) => record.id === captainApplyId);
    assertSmoke(appliedAfterResultChange?.status === "applied" && appliedAfterResultChange?.resolvedAt === appliedResolvedAt, "applied records are not rewritten if the station result later changes");
    session = okSession(dismissTravelV2FocusBacklash(session, critical.id, { note: "GM ONLY dismissal", now: "2026-06-24T00:05:00.000Z" }));
    assertSmoke(session.travelV2FocusBacklashRecords.records.find((record) => record.id === critical.id).status === "dismissed", "GM Dismiss marks dismissed");
    assertSmoke(beforeSnap === snap({ actors: globalThis.Actor, items: globalThis.Item }), "apply/dismiss does not replace actor/item globals");

    let clearSession = okSession(createTravelEventRunnerSession(fixtureEvent(), { now: "2026-06-24T01:00:00.000Z" }));
    clearSession = okSession(commitTravelEventRunnerStationFocus(clearSession, 0, "navigator", "hard-correction"));
    clearSession = okSession(setTravelEventRunnerStationResult(clearSession, 0, "navigator", "failure", { now: "2026-06-24T01:01:00.000Z" }));
    const clearPendingId = clearSession.travelV2FocusBacklashRecords.records[0].id;
    clearSession = okSession(clearTravelEventRunnerStationResult(clearSession, 0, "navigator", { now: "2026-06-24T01:02:00.000Z" }));
    const clearDismissed = clearSession.travelV2FocusBacklashRecords.records.find((record) => record.id === clearPendingId);
    assertSmoke(clearDismissed?.status === "dismissed" && clearDismissed?.resolutionNote === "Station result was cleared before the Focus backlash was resolved.", "clearing a result dismisses pending Focus backlash with a clear note");
    const dismissedResolvedAt = clearDismissed.resolvedAt;
    clearSession = okSession(clearTravelEventRunnerStationResult(clearSession, 0, "navigator", { now: "2026-06-24T01:03:00.000Z" }));
    assertSmoke(clearSession.travelV2FocusBacklashRecords.records.find((record) => record.id === clearPendingId)?.resolvedAt === dismissedResolvedAt, "clearing again does not rewrite already-dismissed records");

    const player = sanitizeTravelV2FocusBacklashForPlayers({ records: [{ ...session.travelV2FocusBacklashRecords.records[0], status: "pending", gmNote: "GM ONLY SECRET", consequenceCandidate: "SECRET CONSEQUENCE", actorId: "PRIVATE" }] });
    assertSmoke(player.records[0]?.statusLabel === "Pending risk", "player sanitizer exposes consistent pending Focus status label");
    assertSmoke(!snap(player).includes("GM ONLY SECRET") && !snap(player).includes("SECRET CONSEQUENCE") && !snap(player).includes("PRIVATE"), "player sanitizer omits GM/private fields");
    const narration = prepareTravelV2RoundNarration({ ...session, travelV2FocusBacklashRecords: { records: [{ ...session.travelV2FocusBacklashRecords.records[0], status: "pending", gmNote: "GM ONLY SECRET" }] } }, 0);
    const publicNarration = sanitizeTravelV2PublicNarration(narration);
    assertSmoke(!snap(publicNarration).includes("GM ONLY SECRET"), "public narration omits GM-only backlash notes");
    assertSmoke(sideEffects.length === 0, "focus backlash flow has no actor/item/chat/journal/combat/socket side effects");
    return { checked: ["creation timing", "duplicate prevention", "stale result cleanup", "clear result cleanup", "applied dismissed preservation", "apply dismiss", "player sanitizer", "public narration", "no side effects"] };
  } finally {
    Object.assign(globalThis, prior);
  }
}

export default runTravelV2FocusBacklashRecordsSmokeChecks;
