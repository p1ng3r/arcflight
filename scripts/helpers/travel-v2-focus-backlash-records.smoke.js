import {
  applyTravelV2FocusBacklash,
  commitTravelEventRunnerStationFocus,
  createTravelEventRunnerSession,
  createTravelV2FocusBacklashRecord,
  dismissTravelV2FocusBacklash,
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

    session = okSession(commitTravelEventRunnerStationFocus(session, 0, "watchmaster", "read-the-enemy"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "watchmaster", "criticalFailure", { now: "2026-06-24T00:03:00.000Z" }));
    const critical = session.travelV2FocusBacklashRecords.records.find((record) => record.stationKey === "watchmaster");
    assertSmoke(critical?.pressureDelta === 2 && critical.consequenceCandidate, "critical failure creates a stronger pending backlash");

    const beforeSnap = snap({ actors: globalThis.Actor, items: globalThis.Item });
    session = okSession(applyTravelV2FocusBacklash(session, session.travelV2FocusBacklashRecords.records[0].id, { now: "2026-06-24T00:04:00.000Z" }));
    assertSmoke(session.travelV2FocusBacklashRecords.records[0].status === "applied" && session.pressure.strain === 1, "GM Apply marks applied and updates session-local pressure");
    session = okSession(dismissTravelV2FocusBacklash(session, critical.id, { note: "GM ONLY dismissal", now: "2026-06-24T00:05:00.000Z" }));
    assertSmoke(session.travelV2FocusBacklashRecords.records.find((record) => record.id === critical.id).status === "dismissed", "GM Dismiss marks dismissed");
    assertSmoke(beforeSnap === snap({ actors: globalThis.Actor, items: globalThis.Item }), "apply/dismiss does not replace actor/item globals");

    const player = sanitizeTravelV2FocusBacklashForPlayers({ records: [{ ...session.travelV2FocusBacklashRecords.records[0], gmNote: "GM ONLY SECRET", consequenceCandidate: "SECRET CONSEQUENCE", actorId: "PRIVATE" }] });
    assertSmoke(!snap(player).includes("GM ONLY SECRET") && !snap(player).includes("SECRET CONSEQUENCE") && !snap(player).includes("PRIVATE"), "player sanitizer omits GM/private fields");
    const narration = prepareTravelV2RoundNarration({ ...session, travelV2FocusBacklashRecords: { records: [{ ...session.travelV2FocusBacklashRecords.records[0], gmNote: "GM ONLY SECRET" }] } }, 0);
    const publicNarration = sanitizeTravelV2PublicNarration(narration);
    assertSmoke(!snap(publicNarration).includes("GM ONLY SECRET"), "public narration omits GM-only backlash notes");
    assertSmoke(sideEffects.length === 0, "focus backlash flow has no actor/item/chat/journal/combat/socket side effects");
    return { checked: ["creation timing", "duplicate prevention", "apply dismiss", "player sanitizer", "public narration", "no side effects"] };
  } finally {
    Object.assign(globalThis, prior);
  }
}

export default runTravelV2FocusBacklashRecordsSmokeChecks;
