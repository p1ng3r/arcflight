import { applyTravelV2HazardToRound, revealTravelV2Hazard } from "./travel-v2-hazards.js";
import { normalizeTravelEventRunnerSession, prepareTravelEventRunnerState, prepareTravelPlayerStationCardState, sanitizeTravelStationFocusOption } from "./travel-event-runner.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 focus risk suppression smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel v2 focus risk suppression smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
function snap(value) { return JSON.stringify(value); }

function session() {
  return {
    status: "active",
    currentRoundIndex: 0,
    event: { baseDC: 15, rounds: [{ round: 1, title: "Focus Risk", activeStations: ["captain", "navigator"], stationPrompts: {}, stationCards: [] }] },
    travelV2Hazards: { records: [{
      id: "edge-1",
      hazardId: "hazard-crew-on-edge",
      name: "Crew on Edge",
      status: "active",
      revealed: true,
      playerText: "The crew grows quiet, tense, and too quick to look toward the dark between stars.",
      gmText: "GM secret morale note must not leak.",
      privateNote: "Hidden private hazard detail.",
      publicModifierText: "Focus cannot be spent while Crew on Edge is active.",
      effects: [{ type: "suppressFocus", gmNote: "do not leak" }],
      runtime: { appliedRoundKeys: ["round-0"], unresolvedRoundKeys: [] }
    }] }
  };
}

export async function runTravelV2FocusRiskSuppressionSmokeChecks() {
  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game };
  globalThis.Actor = { update: () => sideEffects.push("actor") };
  globalThis.Item = { update: () => sideEffects.push("item") };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket") }, combat: { update: () => sideEffects.push("combat") } };
  try {
    const safe = sanitizeTravelStationFocusOption({ key: "test", label: "Test Focus", timing: "Before a roll.", effectText: "Help the station.", gmNote: "secret", gmText: "secret", gmOnly: true, privateNote: "secret", unresolvedConsequence: { secret: true } }, { stationKey: "captain", roundIndex: 0 });
    assertSmoke(safe.key === "test" && safe.whatItHelps.includes("Help the station"), "sanitizer exposes normalized public Focus help text");
    assertSmoke(safe.publicRiskText.includes("Risk:"), "sanitizer exposes public Focus risk text");
    assertSmoke(!snap(safe).includes("secret") && !Object.hasOwn(safe, "gmNote") && !Object.hasOwn(safe, "unresolvedConsequence"), "sanitizer strips GM-only Focus fields");

    const normalized = normalizeTravelEventRunnerSession({ status: "active", currentRoundIndex: 0, event: session().event });
    assertSmoke(normalized.ok, "created Travel v2 session normalizes");
    const card = prepareTravelPlayerStationCardState(normalized.session, "captain");
    assertSmoke(card.hasFocusOptions && card.focusOptions.every((option) => option.key && option.label && option.stationKey === "captain" && option.roundIndex === 0), "player station card exposes normalized Focus display state");
    assertSmoke(card.focusOptions.some((option) => option.whatItHelps && option.publicRiskText && option.publicBacklashPreviewText), "player station card includes public Focus help and risk text");
    assertSmoke(!snap(card.focusOptions).includes("gmNote") && !snap(card.focusOptions).includes("privateNote"), "player station Focus payload has no GM-only note fields");

    const hazardSession = session();
    const before = snap(hazardSession);
    const revealed = revealTravelV2Hazard(hazardSession, "edge-1");
    const applied = applyTravelV2HazardToRound(revealed.session, "edge-1", { roundIndex: 0 });
    assertEqual(snap(hazardSession), before, "hazard reveal/apply does not mutate input session");
    const blockedCard = prepareTravelPlayerStationCardState(applied.session, "captain");
    assertEqual(blockedCard.canSpendFocus, false, "active Focus-suppression hazard blocks player Focus spend state");
    assertEqual(blockedCard.focusBlocked, true, "blocked card marks Focus as blocked");
    assertSmoke(blockedCard.focusBlockedReason.includes("Focus cannot be spent"), "blocked Focus includes public reason text");
    assertSmoke(blockedCard.focusBlockedHazardName === "Crew on Edge", "blocked Focus includes revealed public hazard name");
    assertSmoke(blockedCard.focusOptions.every((option) => option.blocked === true && option.available === false && option.blockedReason), "blocked Focus options include public blocked state");
    const blockedSnap = snap(blockedCard.focusOptions) + snap(blockedCard.publicHazards);
    assertSmoke(!blockedSnap.includes("GM secret") && !blockedSnap.includes("Hidden private") && !blockedSnap.includes("do not leak"), "hidden or GM-only hazard fields do not leak to player Focus payload");

    const runner = prepareTravelEventRunnerState(applied.session);
    assertSmoke(runner.focusRiskSummary.hasRows, "GM runner exposes Focus risk summary");
    assertSmoke(runner.focusRiskSummary.hasBlockedRows && runner.focusRiskSummary.blockedRows.some((row) => row.blockedHazardName === "Crew on Edge"), "GM runner lists blocked Focus stations");
    assertSmoke(runner.focusRiskSummary.mutationNote.includes("does not automatically mutate"), "GM runner states session-local no-automatic-mutation messaging");
    assertEqual(sideEffects.length, 0, "focus risk helpers do not call actor, item, chat, journal, combat, or socket APIs");
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
  }
  return { ok: true, checked: ["focus-normalization", "player-help-risk-text", "gm-only-focus-sanitization", "hazard-focus-blocked", "blocked-public-reason", "hazard-leak-prevention", "gm-runner-focus-summary", "no-side-effects"] };
}

export default runTravelV2FocusRiskSuppressionSmokeChecks;
