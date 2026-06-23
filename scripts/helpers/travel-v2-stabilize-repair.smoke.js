import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  applyTravelStabilizePressureDeltaToSession,
  createTravelEventRunnerSession,
  prepareTravelEventRunnerRoundSummaryCard,
  prepareTravelStabilizeResolution,
  sanitizeTravelStabilizeResolutionForPlayers,
  setTravelEventRunnerStationAction,
  setTravelEventRunnerStationResult
} from "./travel-event-runner.js";
import { resolveTravelStabilizePressureDelta } from "./travel-pressure.js";
import { prepareTravelV2RoundNarration, sanitizeTravelV2PublicNarration } from "./travel-v2-narration.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 stabilize repair smoke check failed: ${message}`); }
function snap(value) { return JSON.stringify(value); }
function fixtureEvent() {
  return {
    key: "stabilize-repair-pass",
    name: "Stabilize Repair Pass",
    category: "navigation",
    baseDC: 20,
    roundCount: 1,
    tags: ["smoke"],
    activeResources: [ARCFLIGHT_TRAVEL_RESOURCES.STRAIN, ARCFLIGHT_TRAVEL_RESOURCES.MORALE],
    finalOutcomes: { majorVictory: "Safe arrival.", victory: "Arrival secured.", costlySuccess: "Arrival with cost.", catastrophicFailure: "The crisis wins.", failure: "The route remains dangerous." },
    rounds: [{
      roundNumber: 1,
      title: "Repair Under Shear",
      activeStations: ["navigator", "engineer", "watchmaster", "captain", "veilwarden"],
      primaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
      secondaryPressure: ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
      outcomeBranches: {
        dominantSuccess: "The crew takes control.",
        mixed: "The crew holds together.",
        dominantFailure: "The route punishes the ship.",
        catastrophicFailure: "The crisis deepens."
      },
      stationPrompts: {
        navigator: { stationKey: "navigator", stationName: "Navigator", playerAction: "Plot the escape vector.", suggestedSkills: ["piloting-lore"], rollFeedback: { criticalSuccess: "Strong help.", success: "Useful help.", failure: "Falls short.", criticalFailure: "Complication." } },
        engineer: { stationKey: "engineer", stationName: "Engineer", playerAction: "Hold the engine together.", suggestedSkills: ["crafting"], rollFeedback: { criticalSuccess: "Strong help.", success: "Useful help.", failure: "Falls short.", criticalFailure: "Complication." } },
        watchmaster: { stationKey: "watchmaster", stationName: "Watchmaster", playerAction: "Track the shear line.", suggestedSkills: ["perception"], rollFeedback: { criticalSuccess: "Strong help.", success: "Useful help.", failure: "Falls short.", criticalFailure: "Complication." } },
        captain: { stationKey: "captain", stationName: "Captain", playerAction: "Keep the crew moving.", suggestedSkills: ["diplomacy"], rollFeedback: { criticalSuccess: "Strong help.", success: "Useful help.", failure: "Falls short.", criticalFailure: "Complication." } },
        veilwarden: { stationKey: "veilwarden", stationName: "Veilwarden", playerAction: "Anchor the lifeveil.", suggestedSkills: ["occultism"], rollFeedback: { criticalSuccess: "Strong help.", success: "Useful help.", failure: "Falls short.", criticalFailure: "Complication." } }
      },
      stationCards: ["navigator", "engineer", "watchmaster", "captain", "veilwarden"].map((stationKey) => ({
        stationKey,
        label: stationKey,
        skillApproaches: [{
          key: `${stationKey}-main`,
          label: "Push Forward",
          skill: stationKey === "engineer" ? "crafting" : (stationKey === "captain" ? "diplomacy" : (stationKey === "veilwarden" ? "occultism" : "perception")),
          helpText: "Contributes to the round objective.",
          boardResultFeedback: { criticalSuccess: "Strong help.", success: "Useful help.", failure: "Falls short.", criticalFailure: "Complication." },
          gmNarrationFeedback: { criticalSuccess: "Strong help.", success: "Useful help.", failure: "Falls short.", criticalFailure: "Complication." }
        }],
        rollFeedback: { criticalSuccess: "Strong help.", success: "Useful help.", failure: "Falls short.", criticalFailure: "Complication." }
      }))
    }]
  };
}
function okSession(result) { assertSmoke(result.ok, result.errors?.join("; ") || "session update failed"); return result.session; }

export async function runTravelV2StabilizeRepairSmokeChecks() {
  const sideEffects = [];
  const prior = { ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, Actor: globalThis.Actor, Item: globalThis.Item };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { combat: { update: () => sideEffects.push("combat") } };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  try {
    assertSmoke(resolveTravelStabilizePressureDelta("criticalSuccess", "strain").pressureDelta === -2, "critical success delta is -2");
    assertSmoke(resolveTravelStabilizePressureDelta("success", "strain").pressureDelta === -1, "success delta is -1");
    assertSmoke(resolveTravelStabilizePressureDelta("failure", "strain").pressureDelta === 0, "failure delta is 0");
    assertSmoke(resolveTravelStabilizePressureDelta("criticalFailure", "strain").pressureDelta === 1, "critical failure delta is +1");

    let session = okSession(createTravelEventRunnerSession(fixtureEvent(), { now: "2026-06-23T00:00:00.000Z" }));
    session.pressure.strain = 3;
    session = okSession(setTravelEventRunnerStationAction(session, 0, "engineer", "stabilize"));
    session = okSession(setTravelEventRunnerStationAction(session, 0, "watchmaster", "hazardResponse"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "navigator", "success"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "engineer", "criticalSuccess"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "watchmaster", "success"));
    session = okSession(setTravelEventRunnerStationResult(session, 0, "captain", "failure"));

    const summary = prepareTravelEventRunnerRoundSummaryCard(session, session.event.rounds[0], session.roundResults[0]);
    assertSmoke(summary.objectiveContributorCount === 2, "only event approach actions count toward objective contributors");
    assertSmoke(summary.objectiveContributors.includes("navigator") && summary.objectiveContributors.includes("captain"), "event approach contributors are listed");
    assertSmoke(summary.stabilizerCount === 1 && summary.stabilizers[0] === "engineer", "stabilizers are distinguished from objective contributors");
    assertSmoke(summary.hazardResponderCount === 1 && summary.hazardResponders[0] === "watchmaster", "hazard responders are distinguished from objective contributors");
    assertSmoke(summary.unresolvedStations.includes("veilwarden"), "unresolved stations are tracked separately");

    const pending = session.stabilizeResolutionRecords.records.find((record) => record.stationKey === "engineer");
    assertSmoke(pending && pending.pressureDelta === -2 && pending.status === "pending", "stabilize record is pending with -2 pressure delta");
    assertSmoke(session.pressure.strain === 3, "pending stabilize record does not mutate pressure automatically");
    assertSmoke(prepareTravelStabilizeResolution(session, 0, "engineer").gmNote.includes("Session-local"), "formal stabilize resolution includes GM note");
    const playerRecord = sanitizeTravelStabilizeResolutionForPlayers({ ...pending, gmNote: "GM ONLY SECRET", resolutionNote: "GM ONLY NOTE" });
    assertSmoke(!snap(playerRecord).includes("GM ONLY"), "player stabilize payload omits GM-only notes");

    const beforeApply = snap({ actors: globalThis.Actor, items: globalThis.Item, chat: globalThis.ChatMessage, journal: globalThis.JournalEntry, combat: globalThis.game.combat });
    session = okSession(applyTravelStabilizePressureDeltaToSession(session, pending.stabilizeResolutionId, { now: "2026-06-23T00:01:00.000Z" }));
    assertSmoke(session.pressure.strain === 1, "explicit GM apply updates only session-local pressure");
    assertSmoke(sideEffects.length === 0 && beforeApply === snap({ actors: globalThis.Actor, items: globalThis.Item, chat: globalThis.ChatMessage, journal: globalThis.JournalEntry, combat: globalThis.game.combat }), "stabilize flow does not call actor, item, chat, journal, or combat APIs");

    const narration = prepareTravelV2RoundNarration(session, 0);
    assertSmoke(narration.stationVignettes.some((v) => v.stationKey === "engineer" && v.mechanicalSummary.includes("reduced Strain pressure by 2")), "narration reflects stabilize pressure outcome");
    const publicNarration = sanitizeTravelV2PublicNarration({ ...narration, stationVignettes: narration.stationVignettes.map((v) => ({ ...v, gmNote: "GM ONLY SECRET" })) });
    assertSmoke(!snap(publicNarration).includes("GM ONLY SECRET"), "public narration does not leak GM-only stabilize notes");
  } finally {
    globalThis.ChatMessage = prior.ChatMessage; globalThis.JournalEntry = prior.JournalEntry; globalThis.game = prior.game; globalThis.Actor = prior.Actor; globalThis.Item = prior.Item;
  }
  return { ok: true, checked: ["stabilize-pressure-deltas", "objective-contributor-counts", "stabilize-record-pending", "player-sanitization", "explicit-session-apply", "no-side-effects", "safe-narration"] };
}

export default runTravelV2StabilizeRepairSmokeChecks;
