import { prepareTravelV2RiskBidResultCandidates } from "./travel-v2-risk-bid-results.js";
import { prepareTravelV2RiskBidReviewedCandidateBridge } from "./travel-v2-risk-bid-result-bridge.js";
import {
  normalizeTravelV2RiskBidReviewPayloadType,
  prepareTravelV2RiskBidQueueReviewPayloads
} from "./travel-v2-risk-bid-result-review-adapter.js";

const PAYLOAD_TYPES = Object.freeze([
  "benefitReview", "progressReview", "momentumReview", "rewardReview", "consequenceReview", "pressureReview", "hazardProgressReview", "stationComplicationReview", "nextRoundDifficultyReview", "hazardEscalationReview", "shipScarReview", "severePressureReview", "additionalHazardReview"
]);
const TYPE_MAPPING = Object.freeze({
  benefit: "benefitReview",
  progress: "progressReview",
  momentumCandidate: "momentumReview",
  rewardImprovement: "rewardReview",
  consequenceCandidate: "consequenceReview",
  pressureCandidate: "pressureReview",
  hazardProgressCandidate: "hazardProgressReview",
  stationComplication: "stationComplicationReview",
  nextRoundDifficulty: "nextRoundDifficultyReview",
  hazardEscalation: "hazardEscalationReview",
  shipScarCandidate: "shipScarReview",
  severePressureCandidate: "severePressureReview",
  additionalHazardCandidate: "additionalHazardReview"
});
const INVALID_TYPES = Object.freeze(["", "bad", "hazard", "consequence", "pressure", "applyPayload", null, undefined]);
const PAYLOAD_KEYS = Object.freeze(["adapterVersion", "source", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "requiresReview", "queueReady"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze([
  "gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."
]);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 risk bid result review adapter smoke check failed: ${message}`);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 risk bid result review adapter smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
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
function bridgeFor(resultBand, tier) {
  return prepareTravelV2RiskBidReviewedCandidateBridge(prepareTravelV2RiskBidResultCandidates(inputFor(resultBand, tier)));
}

export function runTravelV2RiskBidResultReviewAdapterSmokeChecks() {
  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game };
  globalThis.Actor = { update: () => sideEffects.push("actor.update") };
  globalThis.Item = { create: () => sideEffects.push("Item.create") };
  globalThis.ChatMessage = { create: () => sideEffects.push("ChatMessage.create") };
  globalThis.JournalEntry = { create: () => sideEffects.push("JournalEntry.create") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket.emit") } };

  try {
    for (const type of PAYLOAD_TYPES) assertEqual(normalizeTravelV2RiskBidReviewPayloadType(type), type, `${type} normalizes`);
    for (const type of INVALID_TYPES) assertEqual(normalizeTravelV2RiskBidReviewPayloadType(type), null, `invalid payload type ${type} rejected`);

    const mappedBridge = { ...bridgeFor("failure", 8), reviewedCandidates: Object.keys(TYPE_MAPPING).map((type) => ({ type, severity: "standard", label: type, text: `Review ${type}`, requiresReview: true })) };
    const mapped = prepareTravelV2RiskBidQueueReviewPayloads({ bridge: mappedBridge });
    assertSmoke(mapped.ok && mapped.hasReviewPayloads, "all stable candidate mappings adapt");
    for (const [candidateType, payloadType] of Object.entries(TYPE_MAPPING)) {
      assertSmoke(mapped.reviewPayloads.some((payload) => payload.candidateType === candidateType && payload.payloadType === payloadType), `${candidateType} maps to ${payloadType}`);
    }

    const failureEight = prepareTravelV2RiskBidQueueReviewPayloads(bridgeFor("failure", 8));
    assertSmoke(failureEight.ok && failureEight.hasReviewPayloads, "failure +8 adapts successfully");
    assertEqual(failureEight.dangerLevel, "high", "failure +8 danger remains high");
    assertSmoke(failureEight.reviewPayloads.length > 0, "failure +8 review payloads exist");
    assertSmoke(failureEight.reviewPayloads.every((payload) => payload.source === "riskBidResult" && payload.queueReady === true), "failure +8 payloads are source-stamped and queue-ready");

    const criticalFailureEight = prepareTravelV2RiskBidQueueReviewPayloads({ bridge: bridgeFor("criticalFailure", 8) });
    assertSmoke(criticalFailureEight.ok && criticalFailureEight.hasReviewPayloads, "critical failure +8 adapts successfully");
    assertEqual(criticalFailureEight.dangerLevel, "severe", "critical failure +8 danger remains severe");
    assertSmoke(criticalFailureEight.reviewPayloads.some((payload) => ["shipScarReview", "severePressureReview"].includes(payload.payloadType)), "critical failure +8 includes scar or severe pressure review");
    assertSmoke(criticalFailureEight.reviewPayloads.some((payload) => ["additionalHazardReview", "hazardEscalationReview", "consequenceReview"].includes(payload.payloadType)), "critical failure +8 includes additional serious review");

    const mixed = prepareTravelV2RiskBidQueueReviewPayloads({ ...bridgeFor("failure", 5), reviewedCandidates: [{ type: "bad" }, { type: "pressure" }, { type: "pressureCandidate", severity: "strong", label: "Pressure", text: "Review pressure." }] });
    assertSmoke(mixed.ok && mixed.reviewPayloads.length === 1, "invalid/freeform candidate types are dropped");
    assertEqual(mixed.reviewPayloads[0].payloadType, "pressureReview", "valid mixed candidate maps correctly");

    const allInvalid = prepareTravelV2RiskBidQueueReviewPayloads({ ...bridgeFor("failure", 5), reviewedCandidates: [{ type: "bad" }, { type: "hazard" }] });
    assertSmoke(!allInvalid.ok && !allInvalid.hasReviewPayloads && allInvalid.blockedReasons.includes("no-valid-review-payloads"), "all invalid candidate types block safely");

    for (const blocked of [
      prepareTravelV2RiskBidQueueReviewPayloads(),
      prepareTravelV2RiskBidQueueReviewPayloads({ ok: false, hasReviewedCandidates: true, reviewedCandidates: [{ type: "benefit" }] }),
      prepareTravelV2RiskBidQueueReviewPayloads({ ok: true, hasReviewedCandidates: false, reviewedCandidates: [{ type: "benefit" }] }),
      prepareTravelV2RiskBidQueueReviewPayloads({ ok: true, hasReviewedCandidates: true, reviewedCandidates: [] })
    ]) {
      assertSmoke(!blocked.ok && !blocked.hasReviewPayloads && blocked.reviewPayloads.length === 0, "blocked inputs return safe blocked output");
      assertSmoke(Object.isFrozen(blocked) && Object.isFrozen(blocked.reviewPayloads), "blocked output is frozen");
      assertNoForbiddenOutput(blocked, "blocked output");
    }

    const unsafeStrings = prepareTravelV2RiskBidQueueReviewPayloads({
      ok: true,
      hasReviewedCandidates: true,
      resultBand: "failure secret",
      tier: "8 secret",
      dcModifier: "applyPayload",
      dangerLevel: "high hiddenHazards",
      stationKey: "navigator actorUuid",
      stationName: "Navigator gmOnly",
      actionId: "plot-course applyPayload",
      actionName: "Plot Course socket",
      roundIndex: 0,
      roundNumber: 1,
      reviewedCandidates: [{ type: "pressureCandidate", severity: "strong secret", label: "secret applyPayload", text: "actorUuid hiddenHazards", requiresReview: true, userId: "bad" }],
      gmReviewRequired: true
    });
    assertSmoke(unsafeStrings.ok && unsafeStrings.hasReviewPayloads, "unsafe strings still adapt valid candidate type");
    assertEqual(unsafeStrings.tier, null, "unsafe tier falls back to null");
    assertEqual(unsafeStrings.dcModifier, null, "unsafe dcModifier falls back to null");
    assertEqual(unsafeStrings.reviewPayloads[0].severity, "standard", "unsafe severity falls back to standard");
    assertEqual(unsafeStrings.reviewPayloads[0].label, "Risk bid review payload", "unsafe label uses fallback");
    assertEqual(unsafeStrings.reviewPayloads[0].text, "Reviewed risk bid payload requires GM review.", "unsafe text uses fallback");
    assertEqual(unsafeStrings.reviewPayloads[0].stationKey, "", "unsafe context string uses empty fallback");
    assertNoForbiddenOutput(unsafeStrings, "unsafe string adapter output");

    for (const tier of [2, "5", 8]) {
      const adapted = prepareTravelV2RiskBidQueueReviewPayloads({ ...bridgeFor("success", Number(tier)), tier, dcModifier: tier });
      assertSmoke(adapted.ok && adapted.hasReviewPayloads, `valid tier ${tier} adapts`);
      assertEqual(adapted.tier, Number(tier), `valid tier ${tier} is preserved`);
      assertEqual(adapted.dcModifier, Number(tier), `valid dcModifier ${tier} is preserved`);
      assertSmoke(adapted.reviewPayloads.every((payload) => payload.tier === Number(tier)), `valid payload tier ${tier} is preserved`);
    }

    for (const payload of criticalFailureEight.reviewPayloads) assertOnlyKeys(payload, PAYLOAD_KEYS, "review payload exposes only safe keys");
    assertSmoke(Object.isFrozen(criticalFailureEight) && Object.isFrozen(criticalFailureEight.reviewPayloads) && Object.isFrozen(criticalFailureEight.reviewPayloads[0]), "output is frozen");
    assertNoForbiddenOutput(mixed, "mixed adapter output");
    assertNoForbiddenOutput(criticalFailureEight, "critical failure adapter output");
    assertEqual(sideEffects.length, 0, "no mutation APIs are called");
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
  }

  return { checked: ["risk-bid-result-review-payload-type-normalization", "risk-bid-result-review-candidate-mapping", "risk-bid-result-review-dangerous-failure-eight", "risk-bid-result-review-severe-critical-failure-eight", "risk-bid-result-review-invalid-candidate-filtering", "risk-bid-result-review-blocked-inputs", "risk-bid-result-review-sanitized-frozen-output", "risk-bid-result-review-no-side-effects"] };
}

export default runTravelV2RiskBidResultReviewAdapterSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = runTravelV2RiskBidResultReviewAdapterSmokeChecks();
    console.log(`Travel v2 risk bid result review adapter smoke checks passed. Checked ${result.checked.length} groups.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
