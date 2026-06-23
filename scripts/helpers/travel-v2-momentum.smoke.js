import {
  awardTravelV2Momentum,
  createTravelEventRunnerSession,
  normalizeTravelV2MomentumState,
  prepareTravelV2MomentumPanelState,
  sanitizeTravelV2MomentumForPlayers,
  setTravelEventRunnerStationAction,
  setTravelEventRunnerStationResult,
  spendTravelV2Momentum,
  spendTravelV2MomentumToDowngradeStationFailure
} from "./travel-event-runner.js";
import { prepareTravelV2RoundNarration, sanitizeTravelV2PublicNarration } from "./travel-v2-narration.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 momentum smoke check failed: ${message}`); }
function okSession(result) { assertSmoke(result.ok, result.errors?.join("; ") || "session update failed"); return result.session; }
function snap(value) { return JSON.stringify(value); }

function fixtureEvent() {
  const stations = ["navigator", "engineer", "captain", "watchmaster"];
  return {
    key: "momentum-pass", name: "Momentum Pass", category: "navigation", baseDC: 20, roundCount: 1, tags: ["smoke"], activeResources: ["strain"],
    rounds: [{ roundNumber: 1, title: "Catch the Current", activeStations: stations, primaryPressure: "strain", outcomeBranches: { dominantSuccess: "Win.", mixed: "Mixed.", dominantFailure: "Fail.", catastrophicFailure: "Crash." }, stationPrompts: Object.fromEntries(stations.map((stationKey) => [stationKey, { stationKey, stationName: stationKey, playerAction: "Act decisively.", suggestedSkills: ["perception"], rollFeedback: { criticalSuccess: "Strong.", success: "Good.", failure: "Bad.", criticalFailure: "Worse." } }])), stationCards: stations.map((stationKey) => ({ stationKey, skillApproaches: [{ label: "Push", skill: "perception", helpText: "Help the objective.", boardResultFeedback: { criticalSuccess: "Strong.", success: "Good.", failure: "Bad.", criticalFailure: "Worse." }, gmNarrationFeedback: { criticalSuccess: "Strong.", success: "Good.", failure: "Bad.", criticalFailure: "Worse." } }] })) }],
    finalOutcomes: { majorVictory: { text: "Great." }, victory: { text: "Safe." }, costlySuccess: { text: "Mixed." }, failure: { text: "Rough." }, catastrophicFailure: { text: "Lost." } }
  };
}

export async function runTravelV2MomentumSmokeChecks() {
  const sideEffects = [];
  const prior = { ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, Actor: globalThis.Actor, Item: globalThis.Item, socket: globalThis.socket };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { combat: { update: () => sideEffects.push("combat") }, socket: { emit: () => sideEffects.push("socket") } };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  globalThis.socket = { emit: () => sideEffects.push("socket") };
  try {
    assertSmoke(normalizeTravelV2MomentumState().value === 0, "default momentum value is 0");
    let session = okSession(createTravelEventRunnerSession(fixtureEvent(), { now: "2026-06-23T00:00:00.000Z" }));
    assertSmoke(session.travelV2Momentum.value === 0, "created session includes normalized momentum");

    session = okSession(setTravelEventRunnerStationResult(session, 0, "navigator", "criticalSuccess", { now: "2026-06-23T00:01:00.000Z" }));
    assertSmoke(session.travelV2Momentum.value === 1 && session.travelV2Momentum.earnedTotal === 1, "critical main objective awards +1 momentum");
    const duplicate = awardTravelV2Momentum(session, { id: "momentum:station-critical:0:navigator", roundIndex: 0, stationKey: "navigator", source: "stationCritical", gmNote: "GM ONLY" });
    assertSmoke(duplicate.duplicate === true && duplicate.session.travelV2Momentum.value === 1, "duplicate award is prevented by stable id");

    session = okSession(setTravelEventRunnerStationAction(session, 0, "engineer", "stabilize"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "engineer", "criticalSuccess"));
    assertSmoke(session.travelV2Momentum.value === 1, "stabilize critical success does not award momentum by default");
    session = okSession(setTravelEventRunnerStationResult(session, 0, "captain", "success"));
    assertSmoke(session.travelV2Momentum.value === 1, "regular success does not award momentum");
    session = okSession(setTravelEventRunnerStationResult(session, 0, "captain", "failure"));
    assertSmoke(session.travelV2Momentum.value === 1, "regular failure does not award momentum");
    session = okSession(setTravelEventRunnerStationResult(session, 0, "engineer", "failure"));
    session = okSession(setTravelEventRunnerStationAction(session, 0, "watchmaster", "hazardResponse"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "watchmaster", "failure"));

    const panel = prepareTravelV2MomentumPanelState(session);
    assertSmoke(panel.spendOptions.some((option) => option.stationKey === "captain" && option.toResult === "success"), "eventApproach failure appears as eligible downgrade spend");
    assertSmoke(!panel.spendOptions.some((option) => option.stationKey === "engineer"), "stabilize failure does not appear as eligible downgrade spend");
    assertSmoke(!panel.spendOptions.some((option) => option.stationKey === "watchmaster"), "hazardResponse failure does not appear as eligible downgrade spend");
    const rejectedStabilizeSpend = spendTravelV2MomentumToDowngradeStationFailure(session, 0, "engineer");
    assertSmoke(rejectedStabilizeSpend.ok === false && rejectedStabilizeSpend.errors?.[0] === "Momentum failure downgrade currently only supports main objective station actions.", "direct stabilize downgrade is rejected");
    const rejectedHazardSpend = spendTravelV2MomentumToDowngradeStationFailure(session, 0, "watchmaster");
    assertSmoke(rejectedHazardSpend.ok === false && rejectedHazardSpend.errors?.[0] === "Momentum failure downgrade currently only supports main objective station actions.", "direct hazardResponse downgrade is rejected");
    session = okSession(spendTravelV2MomentumToDowngradeStationFailure(session, 0, "captain", { now: "2026-06-23T00:02:00.000Z" }));
    assertSmoke(session.travelV2Momentum.value === 0 && session.travelV2Momentum.spentTotal === 1, "explicit spend reduces momentum");
    assertSmoke(session.roundResults[0].stationResults.captain === "success", "failure downgrade spend changes station result");
    assertSmoke(session.travelV2Momentum.records.some((record) => record.source === "failureDowngrade" && record.gmNote.includes("Session-local audit")), "spend record is auditable and session-local");

    const failedSpend = spendTravelV2Momentum(session, { amount: 1, gmNote: "GM ONLY" });
    assertSmoke(failedSpend.ok === false, "overspend is blocked");
    const player = sanitizeTravelV2MomentumForPlayers({ ...session.travelV2Momentum, records: [...session.travelV2Momentum.records, { id: "secret", amount: 1, status: "earned", gmNote: "GM ONLY SECRET" }] });
    assertSmoke(!snap(player).includes("GM ONLY SECRET"), "player sanitizer omits GM-only notes");

    const narration = prepareTravelV2RoundNarration(session, 0);
    assertSmoke(narration.momentum.spentThisRound === 1 && narration.suggestedReadAloud.includes("Momentum this round"), "narration reflects momentum safely");
    const publicNarration = sanitizeTravelV2PublicNarration({ ...narration, momentum: { ...narration.momentum, records: [{ gmNote: "GM ONLY SECRET" }] } });
    assertSmoke(!snap(publicNarration).includes("GM ONLY SECRET"), "public narration omits GM-only momentum notes");
    assertSmoke(sideEffects.length === 0, "momentum flow has no actor/item/chat/journal/combat/socket side effects");
  } finally {
    globalThis.ChatMessage = prior.ChatMessage; globalThis.JournalEntry = prior.JournalEntry; globalThis.game = prior.game; globalThis.Actor = prior.Actor; globalThis.Item = prior.Item; globalThis.socket = prior.socket;
  }
  return { ok: true, checked: ["default-state", "critical-award", "duplicate-prevention", "no-default-stabilize-or-regular-awards", "event-approach-spend-eligibility", "stabilize-hazard-spend-exclusion", "direct-non-event-spend-rejection", "explicit-spend", "failure-downgrade", "auditable-session-record", "player-sanitization", "no-side-effects", "safe-narration"] };
}

export default runTravelV2MomentumSmokeChecks;
