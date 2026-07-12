import { prepareTravelV2RiskBidResultCandidates } from "./travel-v2-risk-bid-results.js";
import { prepareTravelV2RiskBidReviewedCandidateBridge } from "./travel-v2-risk-bid-result-bridge.js";
import { prepareTravelV2RiskBidQueueReviewPayloads } from "./travel-v2-risk-bid-result-review-adapter.js";
import {
  normalizeTravelV2RiskBidQueueInsertionIntentMode,
  isTravelV2RiskBidQueueInsertionIntentMode,
  prepareTravelV2RiskBidQueueInsertionIntent
} from "./travel-v2-risk-bid-queue-insertion-intent.js";

const TOP_LEVEL_KEYS = Object.freeze(["version", "ok", "available", "prepared", "confirmed", "inserted", "blockedReasons", "intentMode", "resultBand", "tier", "dcModifier", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "insertionRequest", "gmReviewRequired"]);
const REQUEST_KEYS = Object.freeze(["requestVersion", "source", "requestType", "intentMode", "reviewPayloadCount", "payloadTypes", "candidateTypes", "resultBand", "tier", "dcModifier", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "reviewPayloads", "queueInsertionReady", "inserted"]);
const PAYLOAD_KEYS = Object.freeze(["adapterVersion", "source", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "requiresReview", "queueReady"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze(["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 risk bid queue insertion intent smoke check failed: ${message}`);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 risk bid queue insertion intent smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
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
    selectionRecord: { version: 1, selected: true, roundIndex: 0, roundNumber: 1, stationKey: "navigator", actionId: "plot-course", tier, dcModifier: tier },
    resultBand,
    stationKey: "navigator",
    stationName: "Navigator",
    actionId: "plot-course",
    actionName: "Plot Course",
    roundIndex: 0,
    roundNumber: 1
  };
}
function pendingReviewFor(resultBand, tier) {
  const bridge = prepareTravelV2RiskBidReviewedCandidateBridge(prepareTravelV2RiskBidResultCandidates(inputFor(resultBand, tier)));
  const review = prepareTravelV2RiskBidQueueReviewPayloads(bridge);
  return { ...review, available: review.ok, queueReady: review.ok && review.hasReviewPayloads, inserted: false };
}

export function runTravelV2RiskBidQueueInsertionIntentSmokeChecks() {
  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, world: globalThis.world, session: globalThis.session };
  globalThis.Actor = { update: () => sideEffects.push("actor.update") };
  globalThis.Item = { create: () => sideEffects.push("Item.create") };
  globalThis.ChatMessage = { create: () => sideEffects.push("ChatMessage.create") };
  globalThis.JournalEntry = { create: () => sideEffects.push("JournalEntry.create") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket.emit") } };
  globalThis.world = { update: () => sideEffects.push("world.update") };
  globalThis.session = { update: () => sideEffects.push("session.update") };

  try {
    for (const mode of ["none", "prepare", "confirm"]) {
      assertEqual(normalizeTravelV2RiskBidQueueInsertionIntentMode(mode), mode, `${mode} normalizes`);
      assertSmoke(isTravelV2RiskBidQueueInsertionIntentMode(mode), `${mode} is supported`);
    }
    for (const mode of ["", "bad", "insert", "apply", "queue", "applyPayload", null, undefined]) {
      assertEqual(normalizeTravelV2RiskBidQueueInsertionIntentMode(mode), "none", `invalid mode ${mode} normalizes to none`);
      assertSmoke(!isTravelV2RiskBidQueueInsertionIntentMode(mode), `invalid mode ${mode} is rejected`);
    }

    const failureEight = pendingReviewFor("failure", 8);
    const missingPermission = prepareTravelV2RiskBidQueueInsertionIntent(failureEight, { intentMode: "prepare" });
    assertSmoke(!missingPermission.ok && !missingPermission.available && missingPermission.blockedReasons.includes("travel-v2-review-permission-required"), "missing permission blocks safely");
    const noneMode = prepareTravelV2RiskBidQueueInsertionIntent(failureEight, { canReview: true, intentMode: "none" });
    assertSmoke(!noneMode.ok && noneMode.blockedReasons.includes("risk-bid-queue-insertion-intent-required"), "none mode blocks safely");
    assertSmoke(!prepareTravelV2RiskBidQueueInsertionIntent({}, { canReview: true, intentMode: "prepare" }).ok, "missing pending review blocks safely");
    assertSmoke(!prepareTravelV2RiskBidQueueInsertionIntent({ ...failureEight, ok: false }, { canReview: true, intentMode: "prepare" }).ok, "not-ok pending review blocks safely");
    assertSmoke(!prepareTravelV2RiskBidQueueInsertionIntent({ ...failureEight, hasReviewPayloads: false }, { canReview: true, intentMode: "prepare" }).ok, "missing hasReviewPayloads blocks safely");
    assertSmoke(!prepareTravelV2RiskBidQueueInsertionIntent({ ...failureEight, queueReady: false }, { canReview: true, intentMode: "prepare" }).ok, "missing queueReady blocks safely");
    assertSmoke(!prepareTravelV2RiskBidQueueInsertionIntent({ ...failureEight, inserted: true }, { canReview: true, intentMode: "prepare" }).ok, "already inserted blocks safely");
    assertSmoke(!prepareTravelV2RiskBidQueueInsertionIntent({ ...failureEight, reviewPayloads: [] }, { canReview: true, intentMode: "prepare" }).ok, "empty review payloads block safely");

    const beforeJson = JSON.stringify(failureEight);
    const prepared = prepareTravelV2RiskBidQueueInsertionIntent({ pendingReview: failureEight }, { canReview: true, intentMode: "prepare" });
    assertSmoke(prepared.ok && prepared.available && prepared.prepared && !prepared.confirmed && !prepared.inserted, "failure +8 prepare is available and prepared only");
    assertEqual(prepared.intentMode, "prepare", "prepare intent mode is preserved");
    assertEqual(prepared.dangerLevel, "high", "failure +8 danger is high");
    assertSmoke(prepared.insertionRequest && prepared.insertionRequest.queueInsertionReady === true && prepared.insertionRequest.inserted === false, "prepare insertion request is queue-ready but not inserted");
    assertEqual(prepared.insertionRequest.reviewPayloadCount, failureEight.reviewPayloads.length, "payload count matches pending review payload count");
    assertEqual(JSON.stringify(failureEight), beforeJson, "input is not mutated");

    const criticalFailureEight = pendingReviewFor("criticalFailure", 8);
    const confirmed = prepareTravelV2RiskBidQueueInsertionIntent(criticalFailureEight, { canReview: true, intentMode: "confirm" });
    assertSmoke(confirmed.ok && confirmed.prepared && confirmed.confirmed && !confirmed.inserted, "critical failure +8 confirm prepares without inserting");
    assertEqual(confirmed.dangerLevel, "severe", "critical failure +8 danger is severe");
    assertSmoke(confirmed.insertionRequest.payloadTypes.includes("shipScarReview") || confirmed.insertionRequest.payloadTypes.includes("severePressureReview"), "critical failure includes scar or severe pressure review");
    assertSmoke(confirmed.insertionRequest.payloadTypes.some((type) => ["additionalHazardReview", "hazardEscalationReview", "consequenceReview"].includes(type)), "critical failure includes additional serious review");

    assertOnlyKeys(prepared, TOP_LEVEL_KEYS, "output exposes only safe top-level keys");
    assertOnlyKeys(prepared.insertionRequest, REQUEST_KEYS, "insertion request exposes only safe keys");
    for (const payload of prepared.insertionRequest.reviewPayloads) assertOnlyKeys(payload, PAYLOAD_KEYS, "review payload exposes only existing safe payload keys");

    const unsafe = prepareTravelV2RiskBidQueueInsertionIntent({ ...failureEight, tier: "8 secret", dcModifier: "applyPayload", resultBand: "failure secret", stationName: "Navigator gmOnly", reviewPayloads: [{ ...failureEight.reviewPayloads[0], label: "secret label", text: "actorUuid hiddenHazards", tier: "bad", dcModifier: "applyPayload", actorUuid: "Actor.bad" }] }, { canReview: true, intentMode: "prepare" });
    assertNoForbiddenOutput(unsafe, "unsafe/freeform string output");
    assertEqual(unsafe.tier, null, "unsafe tier becomes null");
    assertEqual(unsafe.dcModifier, null, "unsafe dcModifier becomes null");
    assertEqual(unsafe.insertionRequest.reviewPayloads[0].tier, null, "unsafe payload tier becomes null");

    for (const value of [2, "5", 8]) {
      const valid = prepareTravelV2RiskBidQueueInsertionIntent({ ...failureEight, tier: value, dcModifier: value, reviewPayloads: failureEight.reviewPayloads.map((payload) => ({ ...payload, tier: value })) }, { canReview: true, intentMode: "prepare" });
      assertEqual(valid.tier, Number(value), `valid tier ${value} is preserved as number`);
      assertEqual(valid.dcModifier, Number(value), `valid DC ${value} is preserved as number`);
      assertEqual(valid.insertionRequest.reviewPayloads[0].tier, Number(value), `valid payload tier ${value} is preserved as number`);
    }

    assertSmoke(Object.isFrozen(prepared) && Object.isFrozen(prepared.blockedReasons) && Object.isFrozen(prepared.insertionRequest) && Object.isFrozen(prepared.insertionRequest.reviewPayloads) && Object.isFrozen(prepared.insertionRequest.reviewPayloads[0]), "output is frozen");
    assertNoForbiddenOutput(prepared, "prepared output");
    assertNoForbiddenOutput(confirmed, "confirmed output");
    assertEqual(sideEffects.length, 0, "no actor/item/chat/journal/socket/world/session mutation APIs are called");
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
    globalThis.world = prior.world;
    globalThis.session = prior.session;
  }

  return { checked: ["risk-bid-queue-insertion-intent-mode-normalization", "risk-bid-queue-insertion-intent-safe-blocking", "risk-bid-queue-insertion-intent-prepare-request", "risk-bid-queue-insertion-intent-confirm-request", "risk-bid-queue-insertion-intent-safe-shape", "risk-bid-queue-insertion-intent-sanitization", "risk-bid-queue-insertion-intent-frozen-no-mutation"] };
}

export default runTravelV2RiskBidQueueInsertionIntentSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = runTravelV2RiskBidQueueInsertionIntentSmokeChecks();
    console.log(`Travel v2 risk bid queue insertion intent smoke checks passed. Checked ${result.checked.length} groups.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
