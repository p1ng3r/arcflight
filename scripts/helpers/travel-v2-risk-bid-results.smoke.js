import {
  TRAVEL_V2_RISK_BID_RESULT_BANDS,
  normalizeTravelV2RiskBidResultBand,
  prepareTravelV2RiskBidResultPreview,
  prepareTravelV2RiskBidResultCandidates
} from "./travel-v2-risk-bid-results.js";

const FORBIDDEN_OUTPUT_TERMS = Object.freeze([
  "gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."
]);
const CANDIDATE_KEYS = Object.freeze(["type", "severity", "tier", "resultBand", "label", "text", "requiresReview"]);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 risk bid result smoke check failed: ${message}`);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 risk bid result smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
}
function snap(value) { return JSON.stringify(value); }
function assertNoForbiddenOutput(value, message) {
  const serialized = snap(value);
  for (const term of FORBIDDEN_OUTPUT_TERMS) assertSmoke(!serialized.includes(term), `${message}: leaked ${term}`);
}
function assertOnlyKeys(object, allowedKeys, message) {
  assertEqual(Object.keys(object).sort().join(","), [...allowedKeys].sort().join(","), message);
}
function inputFor(resultBand = "success", tier = 2, overrides = {}) {
  return {
    selectionRecord: { version: 1, selected: true, roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", tier, dcModifier: tier, selectedAt: "2026-07-12T00:00:00.000Z", gmOnly: "bait", actorUuid: "Actor.bad" },
    resultBand,
    stationKey: "navigator",
    stationName: "Navigator",
    actionId: "plot-course",
    actionName: "Plot Course",
    roundIndex: 0,
    roundNumber: 1,
    ...overrides
  };
}

export function runTravelV2RiskBidResultSmokeChecks() {
  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game };
  globalThis.Actor = { update: () => sideEffects.push("actor.update") };
  globalThis.Item = { create: () => sideEffects.push("Item.create") };
  globalThis.ChatMessage = { create: () => sideEffects.push("ChatMessage.create") };
  globalThis.JournalEntry = { create: () => sideEffects.push("JournalEntry.create") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket.emit") } };

  try {
    for (const band of TRAVEL_V2_RISK_BID_RESULT_BANDS) assertEqual(normalizeTravelV2RiskBidResultBand(band), band, `${band} normalizes`);
    for (const band of ["", "crit", "critical", "partial", "bad", null, undefined]) assertEqual(normalizeTravelV2RiskBidResultBand(band), null, `invalid band ${band} rejected`);

    for (const tier of [2, 5, 8]) {
      for (const band of TRAVEL_V2_RISK_BID_RESULT_BANDS) {
        const preview = prepareTravelV2RiskBidResultPreview(inputFor(band, tier));
        const candidates = prepareTravelV2RiskBidResultCandidates(inputFor(band, tier));
        assertSmoke(preview.ok && preview.hasRiskBidResult, `${band} +${tier} preview succeeds`);
        assertSmoke(candidates.ok && candidates.candidates.length > 0, `${band} +${tier} candidates succeed`);
        assertSmoke(Object.isFrozen(preview) && Object.isFrozen(preview.blockedReasons), `${band} +${tier} preview is frozen`);
        assertSmoke(Object.isFrozen(candidates) && Object.isFrozen(candidates.candidates) && Object.isFrozen(candidates.candidates[0]), `${band} +${tier} candidates are frozen`);
        for (const candidate of candidates.candidates) assertOnlyKeys(candidate, CANDIDATE_KEYS, "candidate exposes only safe keys");
        assertNoForbiddenOutput(preview, `${band} +${tier} preview`);
        assertNoForbiddenOutput(candidates, `${band} +${tier} candidates`);
      }
    }

    const failureEight = prepareTravelV2RiskBidResultCandidates(inputFor("failure", 8));
    assertEqual(failureEight.dangerLevel, "high", "failure +8 danger level is high");
    assertSmoke(failureEight.candidates.some((candidate) => ["consequenceCandidate", "pressureCandidate", "hazardProgressCandidate", "nextRoundDifficulty"].includes(candidate.type) && candidate.severity === "strong"), "failure +8 includes serious negative candidate");

    const criticalFailureEight = prepareTravelV2RiskBidResultCandidates(inputFor("criticalFailure", 8));
    assertEqual(criticalFailureEight.dangerLevel, "severe", "critical failure +8 danger level is severe");
    assertSmoke(criticalFailureEight.candidates.some((candidate) => ["severePressureCandidate", "shipScarCandidate"].includes(candidate.type)), "critical failure +8 includes severe pressure or ship scar");
    assertSmoke(criticalFailureEight.candidates.some((candidate) => ["additionalHazardCandidate", "hazardEscalation", "consequenceCandidate"].includes(candidate.type)), "critical failure +8 includes additional serious candidate");

    for (const tier of [0, 1, 3, 4, 6, 7, 9, 10, "high", "", null, undefined]) {
      const base = inputFor("success", 2);
      const preview = prepareTravelV2RiskBidResultPreview({ ...base, selectionRecord: { ...base.selectionRecord, tier, dcModifier: tier } });
      assertSmoke(!preview.ok && preview.blockedReasons.includes("invalid-risk-bid-tier"), `invalid tier ${tier} blocks safely`);
    }

    for (const bad of [
      inputFor("success", 2, { stationKey: "" }),
      inputFor("success", 2, { actionId: "" }),
      inputFor("success", 2, { roundIndex: null, roundNumber: null }),
      inputFor("success", 2, { stationKey: "pilot" }),
      inputFor("success", 2, { actionId: "evade" }),
      inputFor("success", 2, { roundIndex: 9, roundNumber: 10 }),
      inputFor("success", 2, { selectionRecord: { ...inputFor("success", 2).selectionRecord, selected: false } })
    ]) {
      const preview = prepareTravelV2RiskBidResultPreview(bad);
      assertSmoke(!preview.ok && !preview.hasRiskBidResult, "bad context blocks safely");
      assertNoForbiddenOutput(preview, "blocked preview");
    }

    assertEqual(sideEffects.length, 0, "no mutation APIs are called");
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
  }

  return { checked: ["risk-bid-result-band-normalization", "risk-bid-result-fixed-tier-candidates", "risk-bid-result-dangerous-failure-eight", "risk-bid-result-severe-critical-failure-eight", "risk-bid-result-blocked-contexts", "risk-bid-result-safe-frozen-output", "risk-bid-result-no-side-effects"] };
}

export default runTravelV2RiskBidResultSmokeChecks;
