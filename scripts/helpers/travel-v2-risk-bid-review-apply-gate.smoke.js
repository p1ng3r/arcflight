import assert from "node:assert/strict";
import { prepareTravelV2RiskBidReviewQueueRecord } from "./travel-v2-risk-bid-review-queue.js";
import { prepareTravelV2RiskBidReviewApplyGate, TRAVEL_V2_RISK_BID_REVIEW_APPLY_GATE_VERSION } from "./travel-v2-risk-bid-review-apply-gate.js";

const FORBIDDEN = ["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."];
const RECORD_KEYS = ["gateVersion", "gateKey", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "previewOnly", "intentOnly", "gateOnly", "confirmed", "armed", "applied"];

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
function gateFor(records, options = {}) {
  return prepareTravelV2RiskBidReviewApplyGate({ travelV2RiskBidReviewQueue: { records } }, { canReview: true, ...options });
}

export function runTravelV2RiskBidReviewApplyGateSmokeChecks() {
  assert.equal(typeof prepareTravelV2RiskBidReviewApplyGate, "function", "helper export exists");
  assert.equal(TRAVEL_V2_RISK_BID_REVIEW_APPLY_GATE_VERSION, 1);
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
    assert.equal(prepareTravelV2RiskBidReviewApplyGate(sourceSession, { canReview: false }).blockedReasons.includes("travel-v2-review-permission-required"), true, "non-GM blocks");
    assert.equal(prepareTravelV2RiskBidReviewApplyGate({}, { canReview: true }).blockedReasons.includes("risk-bid-review-queue-not-found"), true, "missing queue blocks");
    assert.equal(gateFor([record("pressureReview", { selected: false })]).blockedReasons.includes("missing-confirmed-risk-bid-review-apply-intent-records"), true, "no confirmed intent records blocks");
    assert.equal(gateFor([record("pressureReview")], { gateMode: "bogus" }).blockedReasons.includes("invalid-risk-bid-review-apply-gate-mode"), true, "invalid gate mode blocks");
    for (const mode of ["secret", "applyPayload"]) {
      const invalid = gateFor([record("pressureReview")], { gateMode: mode });
      assert.equal(invalid.blockedReasons.includes("invalid-risk-bid-review-apply-gate-mode"), true, `${mode} gate mode blocks as invalid`);
      assert.equal(JSON.stringify(invalid).includes(mode), false, `${mode} gate mode does not leak`);
    }
    const closed = gateFor([record("pressureReview")], { gateMode: "closed" });
    assert.equal(closed.gateRecords.length, 0, "closed mode returns no records");
    assert.equal(closed.blockedReasons.includes("risk-bid-review-apply-gate-mode-closed"), true, "closed mode blocks with mode-closed reason");
    const preview = prepareTravelV2RiskBidReviewApplyGate(sourceSession, { canReview: true, gateMode: "preview" });
    assert.equal(preview.ok, true, "preview mode ok with gate records");
    assert.equal(preview.gateRecords.length, 1, "preview mode creates gate records");
    assert.equal(preview.armed, false, "preview mode is not armed");
    assert.equal(preview.gateReady, false, "preview mode is not gate ready");
    const armed = prepareTravelV2RiskBidReviewApplyGate(sourceSession, { canReview: true, gateMode: "armed" });
    assert.equal(armed.gateRecords.length, 1, "armed mode creates gate records");
    assert.equal(armed.armed, true, "armed mode is armed");
    assert.equal(armed.gateReady, true, "armed mode is gate ready");
    const gateRecord = armed.gateRecords[0];
    assert.deepEqual(Object.keys(gateRecord).sort(), RECORD_KEYS.sort(), "gate record has exact safe shape");
    assert.equal(gateRecord.gateKey, `risk-bid-review-apply-gate:${gateRecord.intentKey}`, "gateKey is deterministic");
    assert.equal(gateRecord.gateOnly, true, "gate record is gate-only");
    assert.equal(gateRecord.intentOnly, true, "gate record is intent-only");
    assert.equal(gateRecord.previewOnly, true, "gate record is preview-only");
    assert.equal(gateRecord.confirmed, true, "gate record is confirmed");
    assert.equal(gateRecord.applied, false, "gate record is not applied");
    assert.deepEqual(preview.byResolutionFamily, { pressure: 1 }, "family counts correct");
    assert.deepEqual(preview.byResolutionType, { pressure: 1 }, "type counts correct");
    assert.deepEqual(preview.byPayloadType, { pressureReview: 1 }, "payload counts correct");
    assert.deepEqual(preview.byDangerLevel, { high: 1 }, "danger counts correct");
    assert.deepEqual(preview.bySeverity, { strong: 1 }, "severity counts correct");
    assert.equal(gateFor([record("rewardReview", { status: "applied" })]).gateRecords.length, 0, "applied records are never present");
    assert.equal(gateFor([record("benefitReview", { status: "dismissed" })]).gateRecords.length, 0, "dismissed records excluded by default");
    assert.equal(gateFor([record("benefitReview", { status: "dismissed" })], { includeDismissed: true }).gateRecords.length, 1, "dismissed records follow includeDismissed behavior");
    assert.equal(Object.hasOwn(preview, "session"), false, "output has no session");
    assert.equal(Object.hasOwn(preview, "sessionPatch"), false, "output has no sessionPatch");
    assert.equal(Object.hasOwn(preview, "applyPayload"), false, "output has no applyPayload");
    assert.equal(Object.isFrozen(preview), true, "output is frozen");
    assert.equal(Object.isFrozen(preview.gateRecords), true, "records are frozen");
    assert.equal(Object.isFrozen(preview.gateRecords[0]), true, "record is frozen");
    assert.equal(JSON.stringify(sourceSession), sourceJson, "original session is not mutated");
    assertNoForbidden(preview, "preview gate");
    assertNoForbidden(armed, "armed gate");
    assert.equal(sideEffects.length, 0, "no Actor/Item/ChatMessage/JournalEntry/socket/world mutation side effects occur");
  } finally {
    Object.assign(globalThis, prior);
  }
  return { checked: ["travel-v2-risk-bid-review-apply-gate"] };
}

export default runTravelV2RiskBidReviewApplyGateSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = runTravelV2RiskBidReviewApplyGateSmokeChecks();
    console.log(`Travel v2 risk bid review apply gate smoke checks passed. Checked ${result.checked.length} groups.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
