import {
  createTravelEventRunnerSession,
  normalizeTravelEventRunnerSession,
  prepareTravelEventRunnerRoundSummaryCard,
  setTravelEventRunnerStationAction,
  setTravelEventRunnerStationResult
} from "./travel-event-runner.js";
import { commitTravelV2RoundActionOrderRoundState } from "./travel-v2-round-action-order-state.js";
import { ARCFLIGHT_TRAVEL_STATION_ACTIONS, normalizeTravelStationAction, support } from "./travel-pressure.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 support action targeting smoke check failed: ${message}`); }
function commitPlanning(source) { const order = source.event.rounds[source.currentRoundIndex ?? 0].activeStations; const result = commitTravelV2RoundActionOrderRoundState(source, source.currentRoundIndex ?? 0, { proposedOrder: order, timestamp: "2026-07-18T00:00:00.000Z" }); if (!result.ok) throw new Error(result.errors?.join("; ") || "fixture Crew Planning commit failed"); return JSON.parse(JSON.stringify(result.session)); }
function okSession(result) { assertSmoke(result.ok, result.errors?.join("; ") || "session update failed"); return result.session; }
function snap(value) { return JSON.stringify(value); }

function fixtureEvent() {
  const stations = ["navigator", "engineer", "captain"];
  return {
    key: "support-targeting", name: "Support Targeting", category: "navigation", baseDC: 20, roundCount: 1, tags: ["smoke"], activeResources: ["strain"],
    rounds: [{ roundNumber: 1, title: "Hold Course", activeStations: stations, primaryPressure: "strain", outcomeBranches: { dominantSuccess: "Win.", mixed: "Mixed.", dominantFailure: "Fail.", catastrophicFailure: "Crash." }, stationPrompts: Object.fromEntries(stations.map((stationKey) => [stationKey, { stationKey, stationName: stationKey, playerAction: "Act.", suggestedSkills: ["perception"], rollFeedback: { criticalSuccess: "Strong.", success: "Good.", failure: "Bad.", criticalFailure: "Worse." } }])), stationCards: stations.map((stationKey) => ({ stationKey, skillApproaches: [{ label: "Push", skill: "perception", helpText: "Help objective.", boardResultFeedback: { criticalSuccess: "Strong.", success: "Good.", failure: "Bad.", criticalFailure: "Worse." }, gmNarrationFeedback: { criticalSuccess: "Strong.", success: "Good.", failure: "Bad.", criticalFailure: "Worse." } }] })) }],
    finalOutcomes: { majorVictory: { text: "Great." }, victory: { text: "Safe." }, costlySuccess: { text: "Mixed." }, failure: { text: "Rough." }, catastrophicFailure: { text: "Lost." } }
  };
}

export async function runTravelV2SupportActionTargetingSmokeChecks() {
  const sideEffects = [];
  const prior = { ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, Actor: globalThis.Actor, Item: globalThis.Item, socket: globalThis.socket };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { combat: { update: () => sideEffects.push("combat") }, socket: { emit: () => sideEffects.push("socket") } };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  globalThis.socket = { emit: () => sideEffects.push("socket") };
  try {
    assertSmoke(ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT === "support", "Support is a valid station action constant");
    assertSmoke(normalizeTravelStationAction(support("navigator")).type === "support", "support action normalizes as support");
    let session = commitPlanning(okSession(createTravelEventRunnerSession(fixtureEvent(), { now: "2026-06-26T00:00:00.000Z" })));
    const before = snap(session);

    const missing = setTravelEventRunnerStationAction(session, 0, "engineer", "support");
    assertSmoke(missing.ok === false && missing.errors?.[0]?.includes("requires a target"), "Support requires a valid target station");
    assertSmoke(snap(session) === before, "missing target rejection keeps session unchanged");
    const self = setTravelEventRunnerStationAction(session, 0, "engineer", "support", { targetStationKey: "engineer" });
    assertSmoke(self.ok === false && self.errors?.[0]?.includes("cannot target"), "Support cannot target itself");
    const inactive = setTravelEventRunnerStationAction(session, 0, "engineer", "support", { targetStationKey: "watchmaster" });
    assertSmoke(inactive.ok === false && inactive.errors?.[0]?.includes("not active"), "Support cannot target an inactive station");

    session = okSession(setTravelEventRunnerStationAction(session, 0, "engineer", "support", { targetStationKey: "navigator", supportMode: "" }));
    assertSmoke(session.roundResults[0].stationActions.engineer.type === "support" && session.roundResults[0].stationActions.engineer.targetStationKey === "navigator", "valid Support target is stored");
    const normalized = normalizeTravelEventRunnerSession(session);
    assertSmoke(normalized.session.roundResults[0].stationActions.engineer.type === "support" && normalized.session.roundResults[0].stationActions.engineer.targetStationKey === "navigator", "Support action survives session normalization");

    session = okSession(setTravelEventRunnerStationResult(session, 0, "engineer", "criticalSuccess"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "navigator", "success"));
    const summary = prepareTravelEventRunnerRoundSummaryCard(session, session.event.rounds[0], session.roundResults[0]);
    assertSmoke(summary.objectiveContributorCount === 1 && summary.objectiveContributors.includes("navigator"), "Support does not count as a main-objective contributor");
    assertSmoke(summary.supporterCount === 1 && summary.supporters[0].stationKey === "engineer" && summary.supporters[0].targetStationKey === "navigator", "Support is counted separately as a supporter");
    assertSmoke(session.travelV2Momentum.value === 0 && session.travelV2Momentum.records.length === 0, "Support critical success does not trigger Momentum objective awards");
    assertSmoke(!session.supportBacklashRecords && session.travelV2SupportBacklashRecords.records.length === 0, "successful Support backlash records are not created");
    assertSmoke(sideEffects.length === 0, "Support targeting has no actor/item/chat/journal/combat/socket side effects");
  } finally {
    globalThis.ChatMessage = prior.ChatMessage; globalThis.JournalEntry = prior.JournalEntry; globalThis.game = prior.game; globalThis.Actor = prior.Actor; globalThis.Item = prior.Item; globalThis.socket = prior.socket;
  }
  return { ok: true, checked: ["action-constant", "normalization", "target-required", "self-target-rejection", "inactive-target-rejection", "valid-target-storage", "session-normalization", "objective-separation", "no-success-backlash-records", "no-momentum-award", "no-side-effects"] };
}

export default runTravelV2SupportActionTargetingSmokeChecks;
