import assert from "node:assert/strict";
import { prepareTravelV2RiskBidReviewQueueRecord } from "./travel-v2-risk-bid-review-queue.js";
import { prepareTravelV2RiskBidReviewApplyIntent, TRAVEL_V2_RISK_BID_REVIEW_APPLY_INTENT_VERSION } from "./travel-v2-risk-bid-review-apply-intent.js";

const FORBIDDEN = ["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."];
const RECORD_KEYS = ["intentVersion", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "previewOnly", "intentOnly", "confirmed", "applied"];

function assertNoForbidden(value, label) {
  const json = JSON.stringify(value);
  for (const term of FORBIDDEN) assert.equal(json.includes(term), false, `${label} leaks ${term}`);
}
function record(payloadType, options = {}) {
  return prepareTravelV2RiskBidReviewQueueRecord({
    selected: options.selected ?? true,
    status: options.status ?? "pending",
    payloadType,
    candidateType: options.candidateType ?? payloadType.replace("Review", ""),
    severity: options.severity ?? "strong",
    tier: options.tier ?? 8,
    resultBand: options.resultBand ?? "failure",
    dangerLevel: options.dangerLevel ?? "high",
    stationKey: "navigator",
    stationName: "Navigator",
    actionId: "plot-course",
    actionName: "Plot Course",
    roundIndex: 0,
    roundNumber: 1,
    label: options.label ?? `${payloadType} label`,
    text: options.text ?? `${payloadType} text`
  }, { queueKey: options.queueKey ?? `risk-bid:1:navigator:plot-course:${payloadType}:0`, status: options.status ?? "pending" });
}
function intentFor(records, options = {}) {
  return prepareTravelV2RiskBidReviewApplyIntent({ travelV2RiskBidReviewQueue: { records } }, { canReview: true, ...options });
}

export function runTravelV2RiskBidReviewApplyIntentSmokeChecks() {
  assert.equal(typeof prepareTravelV2RiskBidReviewApplyIntent, "function", "helper export exists");
  assert.equal(TRAVEL_V2_RISK_BID_REVIEW_APPLY_INTENT_VERSION, 1);
  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, world: globalThis.world };
  globalThis.Actor = { update: () => sideEffects.push("actor.update") };
  globalThis.Item = { update: () => sideEffects.push("item.update") };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket") } };
  globalThis.world = { update: () => sideEffects.push("world") };
  try {
    const sourceSession = { marker: "preserve", travelV2RiskBidReviewQueue: { records: [record("pressureReview")] } };
    const sourceJson = JSON.stringify(sourceSession);
    const nonGm = prepareTravelV2RiskBidReviewApplyIntent(sourceSession, { canReview: false });
    assert.equal(nonGm.blockedReasons.includes("travel-v2-review-permission-required"), true, "non-GM blocks");
    assert.equal(prepareTravelV2RiskBidReviewApplyIntent({}, { canReview: true }).blockedReasons.includes("risk-bid-review-queue-not-found"), true, "missing queue blocks");
    assert.equal(intentFor([record("pressureReview", { selected: false })]).blockedReasons.includes("missing-selected-risk-bid-review-preview-records"), true, "no selected preview records blocks");
    assert.equal(intentFor([record("pressureReview")], { intentMode: "bogus" }).blockedReasons.includes("invalid-risk-bid-review-apply-intent-mode"), true, "invalid intent mode blocks");
    const invalidSecretMode = intentFor([record("pressureReview")], { intentMode: "secret" });
    const invalidApplyPayloadMode = intentFor([record("pressureReview")], { intentMode: "applyPayload" });
    assert.equal(invalidSecretMode.blockedReasons.includes("invalid-risk-bid-review-apply-intent-mode"), true, "forbidden secret intent mode blocks as invalid");
    assert.equal(invalidApplyPayloadMode.blockedReasons.includes("invalid-risk-bid-review-apply-intent-mode"), true, "forbidden applyPayload intent mode blocks as invalid");
    assert.equal(JSON.stringify(invalidSecretMode).includes("secret"), false, "invalid secret mode does not echo forbidden input");
    assert.equal(JSON.stringify(invalidApplyPayloadMode).includes("applyPayload"), false, "invalid applyPayload mode does not echo forbidden input");
    const none = intentFor([record("pressureReview")], { intentMode: "none" });
    assert.equal(none.intentRecords.length, 0, "none mode returns no records");
    assert.equal(none.blockedReasons.includes("risk-bid-review-apply-intent-mode-none"), true, "none mode blocks with mode-none reason");

    const prepare = prepareTravelV2RiskBidReviewApplyIntent(sourceSession, { canReview: true, intentMode: "prepare" });
    assert.equal(prepare.ok, true, "prepare mode creates ok package");
    assert.equal(prepare.intentRecords.length, 1, "prepare mode creates intent records");
    assert.equal(prepare.confirmed, false, "prepare mode is not confirmed");
    assert.equal(prepare.applyReady, false, "prepare mode is not apply ready");
    assert.equal(prepare.intentRecords[0].intentKey, "risk-bid-review-apply-intent:risk-bid:1:navigator:plot-course:pressureReview:0", "intentKey is deterministic");
    assert.equal(prepare.intentRecords[0].intentOnly, true, "intent record is intent-only");
    assert.equal(prepare.intentRecords[0].previewOnly, true, "intent record preserves preview-only");
    assert.equal(prepare.intentRecords[0].applied, false, "intent record is not applied");
    assert.deepEqual(Object.keys(prepare.intentRecords[0]).sort(), RECORD_KEYS.sort(), "intent record has exact safe shape");
    assert.deepEqual(prepare.byResolutionFamily, { pressure: 1 }, "family counts correct");
    assert.deepEqual(prepare.byResolutionType, { pressure: 1 }, "type counts correct");
    assert.deepEqual(prepare.byPayloadType, { pressureReview: 1 }, "payload counts correct");
    assert.deepEqual(prepare.byDangerLevel, { high: 1 }, "danger counts correct");
    assert.deepEqual(prepare.bySeverity, { strong: 1 }, "severity counts correct");

    const confirm = prepareTravelV2RiskBidReviewApplyIntent(sourceSession, { canReview: true, intentMode: "confirm" });
    assert.equal(confirm.intentRecords.length, 1, "confirm mode creates intent records");
    assert.equal(confirm.confirmed, true, "confirm mode is confirmed");
    assert.equal(confirm.applyReady, true, "confirm mode is apply ready");
    assert.equal(confirm.intentRecords[0].confirmed, true, "record confirmed follows top-level confirmed");

    const applied = intentFor([record("rewardReview", { status: "applied" })], { intentMode: "confirm" });
    assert.equal(applied.intentRecords.length, 0, "applied records from preview are never present");
    const dismissedDefault = intentFor([record("benefitReview", { status: "dismissed" })]);
    assert.equal(dismissedDefault.intentRecords.length, 0, "dismissed selected records follow default preview behavior");
    const dismissedIncluded = intentFor([record("benefitReview", { status: "dismissed" })], { includeDismissed: true });
    assert.equal(dismissedIncluded.intentRecords.length, 1, "dismissed selected records follow includeDismissed behavior");

    assert.equal(Object.hasOwn(prepare, "session"), false, "output has no session");
    assert.equal(Object.hasOwn(prepare, "sessionPatch"), false, "output has no sessionPatch");
    assert.equal(Object.hasOwn(prepare, "applyPayload"), false, "output has no applyPayload");
    assert.equal(Object.isFrozen(prepare), true, "output is frozen");
    assert.equal(Object.isFrozen(prepare.intentRecords), true, "records are frozen");
    assert.equal(Object.isFrozen(prepare.intentRecords[0]), true, "record is frozen");
    assert.equal(JSON.stringify(sourceSession), sourceJson, "original session is not mutated");
    assertNoForbidden(prepare, "prepare intent");
    assertNoForbidden(confirm, "confirm intent");
    assert.equal(sideEffects.length, 0, "no Actor/Item/ChatMessage/JournalEntry/socket/world mutation side effects occur");
  } finally {
    Object.assign(globalThis, prior);
  }
  return { checked: ["travel-v2-risk-bid-review-apply-intent"] };
}

export default runTravelV2RiskBidReviewApplyIntentSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = runTravelV2RiskBidReviewApplyIntentSmokeChecks();
    console.log(`Travel v2 risk bid review apply intent smoke checks passed. Checked ${result.checked.length} groups.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
