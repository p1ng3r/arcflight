import { prepareTravelV2RiskBidResultCandidates } from "./travel-v2-risk-bid-results.js";
import {
  normalizeTravelV2RiskBidReviewedCandidateType,
  prepareTravelV2RiskBidReviewedCandidateBridge
} from "./travel-v2-risk-bid-result-bridge.js";

const STABLE_TYPES = Object.freeze([
  "benefit", "progress", "momentumCandidate", "rewardImprovement", "consequenceCandidate", "pressureCandidate", "hazardProgressCandidate", "stationComplication", "nextRoundDifficulty", "hazardEscalation", "shipScarCandidate", "severePressureCandidate", "additionalHazardCandidate"
]);
const INVALID_TYPES = Object.freeze(["", "bad", "hazard", "consequence", "pressure", "applyPayload", null, undefined]);
const REVIEWED_KEYS = Object.freeze(["bridgeVersion", "source", "type", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "actionId", "roundIndex", "roundNumber", "label", "text", "requiresReview"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze([
  "gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."
]);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 risk bid result bridge smoke check failed: ${message}`);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 risk bid result bridge smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
}
function assertOnlyKeys(object, allowedKeys, message) {
  assertEqual(Object.keys(object).sort().join(","), [...allowedKeys].sort().join(","), message);
}
function assertNoForbiddenOutput(value, message) {
  const serialized = JSON.stringify(value);
  for (const term of FORBIDDEN_OUTPUT_TERMS) assertSmoke(!serialized.includes(term), `${message}: leaked ${term}`);
}
function inputFor(resultBand, tier) {
  return {
    selectionRecord: { version: 1, selected: true, roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", tier, dcModifier: tier, gmOnly: "bait", actorUuid: "Actor.bad" },
    resultBand,
    stationKey: "navigator",
    stationName: "Navigator",
    actionId: "plot-course",
    actionName: "Plot Course",
    roundIndex: 0,
    roundNumber: 1
  };
}
function candidateStateFor(resultBand, tier) {
  return prepareTravelV2RiskBidResultCandidates(inputFor(resultBand, tier));
}

export function runTravelV2RiskBidResultBridgeSmokeChecks() {
  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game };
  globalThis.Actor = { update: () => sideEffects.push("actor.update") };
  globalThis.Item = { create: () => sideEffects.push("Item.create") };
  globalThis.ChatMessage = { create: () => sideEffects.push("ChatMessage.create") };
  globalThis.JournalEntry = { create: () => sideEffects.push("JournalEntry.create") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket.emit") } };

  try {
    for (const type of STABLE_TYPES) assertEqual(normalizeTravelV2RiskBidReviewedCandidateType(type), type, `${type} normalizes`);
    for (const type of INVALID_TYPES) assertEqual(normalizeTravelV2RiskBidReviewedCandidateType(type), null, `invalid type ${type} rejected`);

    const failureEight = prepareTravelV2RiskBidReviewedCandidateBridge(candidateStateFor("failure", 8));
    assertSmoke(failureEight.ok && failureEight.hasReviewedCandidates, "failure +8 bridges successfully");
    assertEqual(failureEight.dangerLevel, "high", "failure +8 danger remains high");
    assertSmoke(failureEight.reviewedCandidates.length > 0, "failure +8 reviewed candidates exist");
    assertSmoke(failureEight.reviewedCandidates.every((candidate) => candidate.source === "riskBidResult"), "failure +8 candidates have bridge source");

    const criticalFailureEight = prepareTravelV2RiskBidReviewedCandidateBridge({ preview: candidateStateFor("criticalFailure", 8) });
    assertSmoke(criticalFailureEight.ok && criticalFailureEight.hasReviewedCandidates, "critical failure +8 bridges successfully through preview wrapper");
    assertEqual(criticalFailureEight.dangerLevel, "severe", "critical failure +8 danger remains severe");
    assertSmoke(criticalFailureEight.reviewedCandidates.some((candidate) => ["shipScarCandidate", "severePressureCandidate"].includes(candidate.type)), "critical failure +8 includes scar or severe pressure candidate");
    assertSmoke(criticalFailureEight.reviewedCandidates.some((candidate) => ["additionalHazardCandidate", "hazardEscalation", "consequenceCandidate"].includes(candidate.type)), "critical failure +8 includes additional serious candidate");

    const mixed = { ...candidateStateFor("failure", 5), candidates: [{ type: "bad", label: "bad" }, { type: "pressure", label: "bad" }, { type: "pressureCandidate", severity: 7, label: "ok", text: "safe", applyPayload: "bait" }] };
    const mixedBridge = prepareTravelV2RiskBidReviewedCandidateBridge(mixed);
    assertSmoke(mixedBridge.ok && mixedBridge.reviewedCandidates.length === 1, "invalid/freeform candidate types are dropped");
    assertEqual(mixedBridge.reviewedCandidates[0].type, "pressureCandidate", "valid candidate is preserved");
    assertEqual(mixedBridge.reviewedCandidates[0].severity, "standard", "non-string severity falls back to standard");

    const allInvalid = prepareTravelV2RiskBidReviewedCandidateBridge({ ...candidateStateFor("failure", 5), candidates: [{ type: "bad" }, { type: "hazard" }] });
    assertSmoke(!allInvalid.ok && !allInvalid.hasReviewedCandidates && allInvalid.blockedReasons.includes("no-valid-reviewed-candidates"), "all invalid candidates block safely");

    const unsafeStrings = prepareTravelV2RiskBidReviewedCandidateBridge({
      ok: true,
      hasRiskBidResult: true,
      resultBand: "failure secret",
      tier: 8,
      dcModifier: 8,
      dangerLevel: "high hiddenHazards",
      stationKey: "navigator actorUuid",
      stationName: "Navigator gmOnly",
      actionId: "plot-course applyPayload",
      actionName: "Plot Course socket",
      roundIndex: 0,
      roundNumber: 1,
      candidates: [{
        type: "pressureCandidate",
        severity: "strong secret",
        label: "secret applyPayload",
        text: "actorUuid hiddenHazards",
        requiresReview: true
      }],
      gmReviewRequired: true
    });
    assertSmoke(unsafeStrings.ok && unsafeStrings.hasReviewedCandidates, "valid candidate with unsafe strings still bridges");
    assertEqual(unsafeStrings.reviewedCandidates.length, 1, "unsafe string case keeps the valid candidate");
    assertOnlyKeys(unsafeStrings.reviewedCandidates[0], REVIEWED_KEYS, "unsafe string reviewed candidate exposes only safe keys");
    assertEqual(unsafeStrings.reviewedCandidates[0].type, "pressureCandidate", "unsafe string case preserves valid type");
    assertEqual(unsafeStrings.reviewedCandidates[0].severity, "standard", "unsafe severity falls back to standard");
    assertEqual(unsafeStrings.reviewedCandidates[0].label, "Risk bid reviewed candidate", "unsafe label uses safe fallback");
    assertEqual(unsafeStrings.reviewedCandidates[0].text, "Reviewed risk bid candidate requires GM review.", "unsafe text uses safe fallback");
    assertNoForbiddenOutput(unsafeStrings, "unsafe string bridge output");

    for (const blocked of [
      prepareTravelV2RiskBidReviewedCandidateBridge(),
      prepareTravelV2RiskBidReviewedCandidateBridge({ ok: false, hasRiskBidResult: true, candidates: [{ type: "benefit" }] }),
      prepareTravelV2RiskBidReviewedCandidateBridge({ ok: true, hasRiskBidResult: false, candidates: [{ type: "benefit" }] }),
      prepareTravelV2RiskBidReviewedCandidateBridge({ ok: true, hasRiskBidResult: true, candidates: [] })
    ]) {
      assertSmoke(!blocked.ok && !blocked.hasReviewedCandidates && blocked.reviewedCandidates.length === 0, "blocked inputs return safe blocked output");
      assertSmoke(Object.isFrozen(blocked) && Object.isFrozen(blocked.reviewedCandidates), "blocked output is frozen");
      assertNoForbiddenOutput(blocked, "blocked output");
    }

    for (const candidate of criticalFailureEight.reviewedCandidates) {
      assertOnlyKeys(candidate, REVIEWED_KEYS, "reviewed candidate exposes only safe keys");
    }
    assertSmoke(Object.isFrozen(criticalFailureEight) && Object.isFrozen(criticalFailureEight.reviewedCandidates) && Object.isFrozen(criticalFailureEight.reviewedCandidates[0]), "output is frozen");
    assertNoForbiddenOutput(mixedBridge, "mixed bridge output");
    assertNoForbiddenOutput(criticalFailureEight, "critical failure bridge output");
    assertEqual(sideEffects.length, 0, "no mutation APIs are called");
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
  }

  return { checked: ["risk-bid-result-bridge-type-normalization", "risk-bid-result-bridge-dangerous-failure-eight", "risk-bid-result-bridge-severe-critical-failure-eight", "risk-bid-result-bridge-invalid-candidate-filtering", "risk-bid-result-bridge-blocked-inputs", "risk-bid-result-bridge-safe-frozen-output", "risk-bid-result-bridge-no-side-effects"] };
}

export default runTravelV2RiskBidResultBridgeSmokeChecks;
