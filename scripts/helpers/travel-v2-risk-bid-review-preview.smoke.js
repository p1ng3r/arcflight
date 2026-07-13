import assert from "node:assert/strict";
import { prepareTravelV2RiskBidReviewQueueRecord } from "./travel-v2-risk-bid-review-queue.js";
import { prepareTravelV2RiskBidReviewPreviewPackage, applyTravelV2RiskBidReviewPreviewToRenderState, TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION } from "./travel-v2-risk-bid-review-preview.js";

const FORBIDDEN = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions", "ChatMessage", "JournalEntry", "socket", "Actor.", "Item."];

function assertNoForbidden(value, label) {
  const json = JSON.stringify(value);
  for (const term of FORBIDDEN) assert.equal(json.includes(term), false, `${label} leaks ${term}`);
}

export function runTravelV2RiskBidReviewPreviewSmokeChecks() {
  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, world: globalThis.world };
  globalThis.Actor = { update: () => sideEffects.push("actor.update") };
  globalThis.Item = { update: () => sideEffects.push("item.update") };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket") } };
  globalThis.world = { update: () => sideEffects.push("world") };
  try {
    assert.equal(TRAVEL_V2_RISK_BID_REVIEW_PREVIEW_VERSION, 1);
    const selected = prepareTravelV2RiskBidReviewQueueRecord({ selected: true, selectedAt: "2026-07-13T00:00:00.000Z", status: "reviewed", payloadType: "pressureReview", candidateType: "pressure", severity: "strong", tier: 8, resultBand: "failure", dangerLevel: "high", stationKey: "navigator", stationName: "Navigator", actionId: "plot-course", actionName: "Plot Course", roundIndex: 0, roundNumber: 1, label: "High risk review", text: "Hold for later GM resolution." }, { queueKey: "risk-bid:1:navigator:plot-course:pressureReview:0", status: "reviewed" });
    const pending = prepareTravelV2RiskBidReviewQueueRecord({ selected: false, payloadType: "consequenceReview", label: "Unselected" }, { queueKey: "risk-bid:1:navigator:plot-course:consequenceReview:1" });
    const session = { marker: "preserve", travelV2RiskBidReviewQueue: { records: [selected, pending] } };
    const originalJson = JSON.stringify(session);
    const preview = prepareTravelV2RiskBidReviewPreviewPackage(session, { canReview: true });
    assert.equal(preview.ok, true, "selected record creates ready preview");
    assert.equal(preview.available, true);
    assert.equal(preview.selectedCount, 1);
    assert.equal(preview.readyCount, 1);
    assert.equal(preview.applied, false);
    assert.equal(preview.previews[0].readyForResolution, true);
    assert.equal(preview.previews[0].applied, false);
    assert.equal(preview.previews[0].resolutionMode, "later-gm-review");
    assert.equal(preview.previews[0].tier, 8);
    assert.deepEqual(Object.keys(preview.previews[0]).sort(), ["actionId", "actionName", "applied", "candidateType", "dangerLevel", "label", "payloadType", "previewVersion", "queueKey", "readyForResolution", "requiresReview", "resolutionMode", "resultBand", "roundIndex", "roundNumber", "selected", "selectedAt", "severity", "source", "stationKey", "stationName", "status", "text", "tier"].sort());
    assert.equal(JSON.stringify(session), originalJson, "input session is not mutated");
    assert.equal(Object.isFrozen(preview), true);
    assert.equal(Object.isFrozen(preview.previews[0]), true);

    const player = prepareTravelV2RiskBidReviewPreviewPackage(session, { canReview: false });
    assert.equal(player.ok, false, "non-GM preview blocks");
    assert.equal(player.previews.length, 0, "non-GM preview exposes no records");
    assert.equal(player.blockedReasons.includes("travel-v2-review-permission-required"), true);

    const noSelection = prepareTravelV2RiskBidReviewPreviewPackage({ travelV2RiskBidReviewQueue: { records: [pending] } }, { canReview: true });
    assert.equal(noSelection.ok, false, "missing selection blocks safely");
    assert.equal(noSelection.blockedReasons.includes("missing-selected-risk-bid-review-records"), true);

    const dismissed = prepareTravelV2RiskBidReviewQueueRecord({ ...selected, selected: true, label: "Dismissed" }, { queueKey: "dismissed", status: "dismissed" });
    const notReady = prepareTravelV2RiskBidReviewPreviewPackage({ travelV2RiskBidReviewQueue: { records: [dismissed] } }, { canReview: true });
    assert.equal(notReady.ok, false, "dismissed selected records are not ready");
    assert.equal(notReady.blockedReasons.includes("selected-risk-bid-review-records-not-ready"), true);

    const unsafe = prepareTravelV2RiskBidReviewQueueRecord({ selected: true, label: "gmOnly label", text: "secret text", stationName: "Actor.bad", tier: "8 secret" }, { queueKey: "unsafe" });
    const unsafePreview = prepareTravelV2RiskBidReviewPreviewPackage({ travelV2RiskBidReviewQueue: { records: [unsafe] } }, { canReview: true });
    assertNoForbidden(unsafePreview, "unsafe selected preview");

    const rendered = applyTravelV2RiskBidReviewPreviewToRenderState({ session }, {}, { user: { isGM: true } });
    assert.equal(rendered.travelV2RiskBidReviewPreview.ok, true, "render state exposes GM preview alias");
    assert.deepEqual(rendered.travelV2RiskBidReviewPreview, rendered.riskBidReviewPreview, "render aliases match");
    const playerRendered = applyTravelV2RiskBidReviewPreviewToRenderState({ session }, {}, { user: { isGM: false } });
    assert.equal(playerRendered.riskBidReviewPreview.previews.length, 0, "player render alias has no preview records");

    assertNoForbidden(preview, "selected preview");
    assert.equal(sideEffects.length, 0, "preview helper has no mutation side effects");
  } finally {
    globalThis.Actor = prior.Actor;
    globalThis.Item = prior.Item;
    globalThis.ChatMessage = prior.ChatMessage;
    globalThis.JournalEntry = prior.JournalEntry;
    globalThis.game = prior.game;
    globalThis.world = prior.world;
  }
  return { checked: ["risk-bid-review-preview-gm-selected", "risk-bid-review-preview-blocking", "risk-bid-review-preview-safe-shape", "risk-bid-review-preview-render-alias", "risk-bid-review-preview-no-side-effects"] };
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
