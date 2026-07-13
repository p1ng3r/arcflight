import assert from "node:assert/strict";
import { prepareTravelV2RiskBidReviewQueueRecord } from "./travel-v2-risk-bid-review-queue.js";
import { prepareTravelV2RiskBidSelectedReviewPreview, prepareTravelV2RiskBidReviewPreviewPackage, applyTravelV2RiskBidReviewPreviewToRenderState, TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION } from "./travel-v2-risk-bid-review-preview.js";

const FORBIDDEN = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "ChatMessage", "JournalEntry", "socket", "Actor.", "Item."];
const RECORD_KEYS = ["queueKey", "status", "selected", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "previewOnly", "applied"];

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
    text: options.text ?? `${payloadType} text`,
    selectedAt: "2026-07-13T00:00:00.000Z"
  }, { queueKey: options.queueKey ?? `risk-bid:1:navigator:plot-course:${payloadType}:0`, status: options.status ?? "pending" });
}
function previewFor(records, options = {}) {
  return prepareTravelV2RiskBidSelectedReviewPreview({ travelV2RiskBidReviewQueue: { records } }, { canReview: true, ...options });
}
function assertFamily(payloadType, family, type, booleanKey) {
  const preview = previewFor([record(payloadType)]);
  assert.equal(preview.ok, true, `${payloadType} creates ok preview`);
  assert.equal(preview.previewRecords[0].resolutionFamily, family, `${payloadType} maps family`);
  assert.equal(preview.previewRecords[0].resolutionType, type, `${payloadType} maps resolution type`);
  if (booleanKey) assert.equal(preview[booleanKey], true, `${payloadType} sets ${booleanKey}`);
  return preview;
}

export function runTravelV2RiskBidReviewPreviewSmokeChecks() {
  assert.equal(typeof prepareTravelV2RiskBidSelectedReviewPreview, "function", "selected review preview helper exists");
  assert.equal(TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION, 1);
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
    const preview = prepareTravelV2RiskBidSelectedReviewPreview(sourceSession, { canReview: true });
    assert.equal(preview.ok, true, "selected pending pressure record appears");
    assert.equal(preview.available, true);
    assert.equal(preview.selectedCount, 1);
    assert.equal(preview.previewRecords.length, 1);
    assert.equal(preview.previewRecords[0].previewOnly, true, "preview record is preview-only");
    assert.equal(preview.previewRecords[0].applied, false, "preview record does not apply");
    assert.equal(preview.previewRecords[0].resolutionType, "pressure");
    assert.equal(preview.previewRecords[0].resolutionFamily, "pressure");
    assert.equal(preview.hasPressurePreview, true);
    assert.equal(preview.byPayloadType.pressureReview, 1);
    assert.equal(preview.byDangerLevel.high, 1);
    assert.equal(preview.bySeverity.strong, 1);
    assert.deepEqual(Object.keys(preview.previewRecords[0]).sort(), RECORD_KEYS.sort(), "preview record has exact safe shape");
    assert.equal(Object.hasOwn(preview, "session"), false, "output has no session");
    assert.equal(Object.hasOwn(preview, "sessionPatch"), false, "output has no sessionPatch");
    assert.equal(JSON.stringify(sourceSession), sourceJson, "original session is not mutated");
    assert.equal(Object.isFrozen(preview), true, "output is frozen");
    assert.equal(Object.isFrozen(preview.previewRecords), true, "records array is frozen");
    assert.equal(Object.isFrozen(preview.previewRecords[0]), true, "record is frozen");
    assertNoForbidden(preview, "pressure preview");

    const aliasPreview = prepareTravelV2RiskBidReviewPreviewPackage(sourceSession, { canReview: true });
    assert.deepEqual(aliasPreview, preview, "compatibility alias delegates to selected preview");
    const rendered = applyTravelV2RiskBidReviewPreviewToRenderState({ session: sourceSession }, {}, { user: { isGM: true } });
    assert.deepEqual(rendered.travelV2RiskBidSelectedReviewPreview, preview, "render state exposes canonical selected alias");
    assert.deepEqual(rendered.riskBidSelectedReviewPreview, preview, "render state exposes short selected alias");
    assert.deepEqual(rendered.travelV2RiskBidReviewPreview, preview, "render state preserves legacy travel alias");
    assert.deepEqual(rendered.riskBidReviewPreview, preview, "render state preserves legacy short alias");

    const nonGm = prepareTravelV2RiskBidSelectedReviewPreview(sourceSession, { canReview: false });
    assert.equal(nonGm.ok, false, "non-GM blocks");
    assert.equal(nonGm.previewRecords.length, 0, "non-GM gets safe empty preview");
    assert.equal(nonGm.blockedReasons.includes("travel-v2-review-permission-required"), true);
    const missingQueue = prepareTravelV2RiskBidSelectedReviewPreview({}, { canReview: true });
    assert.equal(missingQueue.blockedReasons.includes("risk-bid-review-queue-not-found"), true, "missing queue blocks distinctly");
    const noSelected = previewFor([record("pressureReview", { selected: false })]);
    assert.equal(noSelected.blockedReasons.includes("missing-selected-risk-bid-review-records"), true, "queue with no selected records blocks");

    assertFamily("severePressureReview", "pressure", "severePressure", "hasPressurePreview");
    assertFamily("hazardProgressReview", "hazard", "hazardProgress", "hasHazardPreview");
    assertFamily("hazardEscalationReview", "hazard", "hazardEscalation", "hasHazardPreview");
    assertFamily("additionalHazardReview", "hazard", "additionalHazard", "hasHazardPreview");
    assertFamily("consequenceReview", "consequence", "consequence", "hasConsequencePreview");
    assertFamily("stationComplicationReview", "consequence", "stationComplication", "hasConsequencePreview");
    assertFamily("nextRoundDifficultyReview", "consequence", "nextRoundDifficulty", "hasConsequencePreview");
    assertFamily("benefitReview", "benefit", "benefit", "hasBenefitPreview");
    assertFamily("progressReview", "benefit", "progress", "hasBenefitPreview");
    assertFamily("rewardReview", "reward", "reward", "hasRewardPreview");
    assertFamily("momentumReview", "momentum", "momentum", "hasMomentumPreview");
    assertFamily("shipScarReview", "scar", "shipScar", "hasScarPreview");
    const unknown = assertFamily("tableReview", "review", "review", null);
    assert.equal(unknown.warnings.includes("unknown-risk-bid-review-payload-mapped-to-review"), true, "unknown safe payload warns");

    const mixed = previewFor([
      record("pressureReview", { dangerLevel: "high", severity: "strong" }),
      record("hazardProgressReview", { dangerLevel: "severe", severity: "severe", queueKey: "hazard" }),
      record("momentumReview", { dangerLevel: "none", severity: "standard", queueKey: "momentum" }),
      record("rewardReview", { status: "applied", queueKey: "applied-reward" }),
      record("benefitReview", { status: "dismissed", queueKey: "dismissed-benefit" })
    ]);
    assert.equal(mixed.previewRecords.length, 3, "counts only included preview records");
    assert.deepEqual(mixed.byPayloadType, { pressureReview: 1, hazardProgressReview: 1, momentumReview: 1 });
    assert.deepEqual(mixed.byDangerLevel, { high: 1, severe: 1, none: 1 });
    assert.deepEqual(mixed.bySeverity, { strong: 1, severe: 1, standard: 1 });
    assert.equal(mixed.warnings.includes("applied-risk-bid-review-records-skipped"), true, "applied skipped warning appears");
    assert.equal(mixed.warnings.includes("dismissed-risk-bid-review-records-excluded"), true, "dismissed excluded warning appears");

    const appliedOnly = previewFor([record("rewardReview", { status: "applied" })]);
    assert.equal(appliedOnly.previewRecords.length, 0, "applied records are never included");
    assert.equal(appliedOnly.blockedReasons.includes("selected-risk-bid-review-records-all-applied"), true, "applied-only blocks with all-applied reason");
    const dismissedDefault = previewFor([record("benefitReview", { status: "dismissed" })]);
    assert.equal(dismissedDefault.previewRecords.length, 0, "dismissed records excluded by default");
    assert.equal(dismissedDefault.blockedReasons.includes("selected-risk-bid-review-records-not-ready"), true);
    const dismissedIncluded = previewFor([record("benefitReview", { status: "dismissed" })], { includeDismissed: true });
    assert.equal(dismissedIncluded.ok, true, "dismissed records included with includeDismissed");
    assert.equal(dismissedIncluded.previewRecords.length, 1);

    const unsafe = previewFor([record("pressureReview", { label: "gmOnly label", text: "secret text", queueKey: "unsafe" })]);
    assertNoForbidden(unsafe, "unsafe source preview");
    assert.equal(sideEffects.length, 0, "no mutation side effects occur");
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
    globalThis.world = prior.world;
  }
  return { checked: ["risk-bid-selected-review-preview-export", "risk-bid-selected-review-preview-safe-blocking", "risk-bid-selected-review-preview-record-shape", "risk-bid-selected-review-preview-family-mapping", "risk-bid-selected-review-preview-counts", "risk-bid-selected-review-preview-dismissed-applied", "risk-bid-selected-review-preview-aliases", "risk-bid-selected-review-preview-frozen-no-mutation"] };
}

export default runTravelV2RiskBidReviewPreviewSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = runTravelV2RiskBidReviewPreviewSmokeChecks();
    console.log(`Travel v2 risk bid review preview smoke checks passed. Checked ${result.checked.length} groups.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
