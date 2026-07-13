import { prepareTravelV2RiskBidResultCandidates } from "./travel-v2-risk-bid-results.js";
import { prepareTravelV2RiskBidReviewedCandidateBridge } from "./travel-v2-risk-bid-result-bridge.js";
import { prepareTravelV2RiskBidQueueReviewPayloads } from "./travel-v2-risk-bid-result-review-adapter.js";
import { prepareTravelV2RiskBidQueueInsertionIntent } from "./travel-v2-risk-bid-queue-insertion-intent.js";
import {
  normalizeTravelV2RiskBidReviewQueueRecordStatus,
  isTravelV2RiskBidReviewQueueRecordStatus,
  prepareTravelV2RiskBidReviewQueueRecord,
  insertTravelV2RiskBidReviewQueueRecords,
  prepareTravelV2RiskBidReviewQueueState,
  updateTravelV2RiskBidReviewQueueRecordStatus,
  selectTravelV2RiskBidReviewQueueRecord,
  clearTravelV2RiskBidReviewQueueRecordSelection,
  clearAllTravelV2RiskBidReviewQueueRecordSelections,
  prepareTravelV2RiskBidReviewQueueDecisionState
} from "./travel-v2-risk-bid-review-queue.js";

const RECORD_KEYS = Object.freeze(["queueVersion", "queueKey", "source", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "requiresReview", "queueReady", "insertedAt", "insertionRequestKey", "selected", "selectedAt", "reviewedAt", "dismissedAt", "decisionNote"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze(["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 risk bid review queue smoke check failed: ${message}`);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 risk bid review queue smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
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
function intentFor(resultBand, tier) {
  const bridge = prepareTravelV2RiskBidReviewedCandidateBridge(prepareTravelV2RiskBidResultCandidates(inputFor(resultBand, tier)));
  const review = prepareTravelV2RiskBidQueueReviewPayloads(bridge);
  return prepareTravelV2RiskBidQueueInsertionIntent({ ...review, available: review.ok, queueReady: review.ok && review.hasReviewPayloads, inserted: false }, { canReview: true, intentMode: "confirm" });
}

export function runTravelV2RiskBidReviewQueueSmokeChecks() {
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
    for (const status of ["pending", "reviewed", "dismissed", "applied"]) {
      assertEqual(normalizeTravelV2RiskBidReviewQueueRecordStatus(status), status, `${status} normalizes`);
      assertSmoke(isTravelV2RiskBidReviewQueueRecordStatus(status), `${status} is supported`);
    }
    for (const status of ["", "bad", "queued", "insert", "applyPayload", null, undefined]) {
      assertEqual(normalizeTravelV2RiskBidReviewQueueRecordStatus(status), "", `invalid status ${status} normalizes empty`);
      assertSmoke(!isTravelV2RiskBidReviewQueueRecordStatus(status), `invalid status ${status} rejects`);
    }

    const failureEight = intentFor("failure", 8);
    assertSmoke(!insertTravelV2RiskBidReviewQueueRecords({}, failureEight).ok, "missing GM permission blocks safely");
    assertSmoke(!insertTravelV2RiskBidReviewQueueRecords({}, {}, { canReview: true }).ok, "missing insertion intent blocks safely");
    assertSmoke(!insertTravelV2RiskBidReviewQueueRecords({}, { ...failureEight, ok: false }, { canReview: true }).ok, "not-ok intent blocks safely");
    assertSmoke(!insertTravelV2RiskBidReviewQueueRecords({}, { ...failureEight, confirmed: false }, { canReview: true }).ok, "prepare-only intent blocks safely");
    assertSmoke(!insertTravelV2RiskBidReviewQueueRecords({}, { ...failureEight, inserted: true }, { canReview: true }).ok, "already inserted intent blocks safely");
    assertSmoke(!insertTravelV2RiskBidReviewQueueRecords({}, { ...failureEight, insertionRequest: null }, { canReview: true }).ok, "missing insertion request blocks safely");
    assertSmoke(!insertTravelV2RiskBidReviewQueueRecords({}, { ...failureEight, insertionRequest: { ...failureEight.insertionRequest, queueInsertionReady: false } }, { canReview: true }).ok, "not-ready insertion request blocks safely");
    assertSmoke(!insertTravelV2RiskBidReviewQueueRecords({}, { ...failureEight, insertionRequest: { ...failureEight.insertionRequest, reviewPayloads: [] } }, { canReview: true }).ok, "empty review payloads block safely");

    const originalSession = { marker: "preserve" };
    const originalJson = JSON.stringify(originalSession);
    const insertedFailure = insertTravelV2RiskBidReviewQueueRecords(originalSession, failureEight, { canReview: true });
    assertSmoke(insertedFailure.ok && insertedFailure.inserted && insertedFailure.applied === false && insertedFailure.insertedCount > 0, "failure +8 confirmed intent inserts pending records without applying");
    assertSmoke(insertedFailure.queue.records.length > 0, "queue records exist");
    assertSmoke(insertedFailure.queue.records.every((record) => record.status === "pending" && record.source === "riskBidResult" && record.queueReady === true && record.dangerLevel === "high"), "failure +8 records are pending risk bid high danger reviews");
    assertEqual(JSON.stringify(originalSession), originalJson, "original input session is not mutated");
    assertOnlyKeys(insertedFailure.sessionPatch, ["travelV2RiskBidReviewQueue"], "sessionPatch only contains queue");

    const criticalFailureEight = intentFor("criticalFailure", 8);
    const insertedCritical = insertTravelV2RiskBidReviewQueueRecords({}, criticalFailureEight, { canReview: true });
    const criticalTypes = insertedCritical.queue.records.map((record) => record.payloadType);
    assertSmoke(insertedCritical.queue.records.every((record) => record.dangerLevel === "severe"), "critical failure +8 records preserve severe danger");
    assertSmoke(criticalTypes.includes("shipScarReview") || criticalTypes.includes("severePressureReview"), "critical failure includes scar or severe pressure review");
    assertSmoke(criticalTypes.some((type) => ["additionalHazardReview", "hazardEscalationReview", "consequenceReview"].includes(type)), "critical failure includes additional serious review");

    const duplicate = insertTravelV2RiskBidReviewQueueRecords(insertedFailure.session, failureEight, { canReview: true });
    assertSmoke(duplicate.duplicateCount > 0, "duplicate insertion skips duplicates");
    assertEqual(duplicate.queue.records.length, insertedFailure.queue.records.length, "duplicate insertion keeps record count stable");

    const firstQueueKey = insertedFailure.queue.records[0].queueKey;
    const reviewed = updateTravelV2RiskBidReviewQueueRecordStatus(insertedFailure.session, firstQueueKey, "reviewed", { canReview: true, decisionNote: "Reviewed at table" });
    assertSmoke(reviewed.ok && reviewed.updated && reviewed.applied === false, "GM can mark a pending record reviewed without applying");
    assertEqual(reviewed.queue.records[0].status, "reviewed", "reviewed status is stored");
    assertSmoke(Boolean(reviewed.queue.records[0].reviewedAt), "reviewed timestamp is deterministic safe text");
    const dismissed = updateTravelV2RiskBidReviewQueueRecordStatus(reviewed.session, firstQueueKey, "dismissed", { canReview: true });
    assertSmoke(dismissed.ok && dismissed.queue.records[0].status === "dismissed", "GM can dismiss a pending/reviewed record");
    const restored = updateTravelV2RiskBidReviewQueueRecordStatus(dismissed.session, firstQueueKey, "pending", { canReview: true });
    assertSmoke(restored.ok && restored.queue.records[0].status === "pending", "GM can restore a reviewed/dismissed record to pending");
    assertSmoke(!updateTravelV2RiskBidReviewQueueRecordStatus(restored.session, firstQueueKey, "applied", { canReview: true }).ok, "attempting to set applied blocks");
    assertSmoke(!updateTravelV2RiskBidReviewQueueRecordStatus(restored.session, firstQueueKey, "reviewed").ok, "missing GM permission blocks decision status updates");
    assertSmoke(!updateTravelV2RiskBidReviewQueueRecordStatus(restored.session, "", "reviewed", { canReview: true }).ok, "missing queue key blocks decisions");
    assertSmoke(!updateTravelV2RiskBidReviewQueueRecordStatus(restored.session, "missing", "reviewed", { canReview: true }).ok, "missing record blocks decisions");
    assertSmoke(!updateTravelV2RiskBidReviewQueueRecordStatus(restored.session, firstQueueKey, "freeform", { canReview: true }).ok, "invalid/freeform status blocks decisions");
    const selected = selectTravelV2RiskBidReviewQueueRecord(restored.session, firstQueueKey, { canReview: true, decisionNote: "secret note is unsafe" });
    assertSmoke(selected.ok && selected.selected && selected.queue.selectedCount === 1, "GM can select a record");
    assertEqual(selected.queue.records[0].decisionNote, "", "decision note is sanitized");
    const decisionState = prepareTravelV2RiskBidReviewQueueDecisionState(selected.session, { canReview: true });
    assertSmoke(decisionState.hasSelectedRecords && decisionState.selectedRecords.length === 1 && decisionState.applied === false, "decision state exposes selected safe records to GM only");
    const nonGmDecisionState = prepareTravelV2RiskBidReviewQueueDecisionState(selected.session, { canReview: false });
    assertSmoke(nonGmDecisionState.selectedRecords.length === 0 && nonGmDecisionState.hasSelectedRecords === false, "non-GM decision state does not expose selected records");
    const clearedOne = clearTravelV2RiskBidReviewQueueRecordSelection(selected.session, firstQueueKey, { canReview: true });
    assertSmoke(clearedOne.ok && clearedOne.cleared && clearedOne.queue.selectedCount === 0, "GM can clear one selection");
    const selectedAgain = selectTravelV2RiskBidReviewQueueRecord(restored.session, firstQueueKey, { canReview: true });
    const clearedAll = clearAllTravelV2RiskBidReviewQueueRecordSelections(selectedAgain.session, { canReview: true });
    assertSmoke(clearedAll.ok && clearedAll.cleared && clearedAll.queue.selectedCount === 0, "GM can clear all selections");
    assertOnlyKeys(reviewed.sessionPatch, ["travelV2RiskBidReviewQueue"], "decision sessionPatch only contains queue");
    assertSmoke(Object.isFrozen(reviewed) && Object.isFrozen(reviewed.queue.records[0]), "decision output is frozen");

    const unrelated = prepareTravelV2RiskBidReviewQueueRecord({ payloadType: "benefitReview", candidateType: "benefit", label: "Other", text: "Other review", tier: 2 }, { queueKey: "unrelated:key" });
    const preserved = insertTravelV2RiskBidReviewQueueRecords({ travelV2RiskBidReviewQueue: { records: [unrelated] } }, failureEight, { canReview: true });
    assertSmoke(preserved.queue.records.some((record) => record.queueKey === "unrelated:key"), "existing unrelated records are preserved");

    const unsafeExistingRecord = {
      ...unrelated,
      status: "queued",
      label: "gmOnly label",
      text: "hiddenHazards text",
      stationName: "Actor.bad",
      tier: "8 secret",
      gmOnly: true,
      actorUuid: "Actor.bad",
      debugReport: "secret debug",
      selected: "yes",
      selectedAt: "secret selected",
      decisionNote: "applyPayload note"
    };
    const sanitizedExisting = prepareTravelV2RiskBidReviewQueueState({}, { queue: { records: [unsafeExistingRecord] } });
    assertEqual(sanitizedExisting.records[0].status, "pending", "invalid existing record status becomes pending");
    assertEqual(sanitizedExisting.records[0].label, "Risk bid review", "unsafe existing label falls back");
    assertEqual(sanitizedExisting.records[0].text, "Risk bid review requires GM decision.", "unsafe existing text falls back");
    assertEqual(sanitizedExisting.records[0].tier, null, "unsafe existing tier becomes null");
    assertOnlyKeys(sanitizedExisting.records[0], RECORD_KEYS, "unsafe existing record exposes only safe keys after sanitization");
    assertNoForbiddenOutput(sanitizedExisting, "sanitized existing queue state");

    const duplicateExisting = { ...unsafeExistingRecord, queueKey: insertedFailure.queue.records[0].queueKey, status: "reviewed", label: "Existing safe label", text: "Existing safe text" };
    const duplicateAfterSanitization = insertTravelV2RiskBidReviewQueueRecords({ travelV2RiskBidReviewQueue: { records: [duplicateExisting] } }, failureEight, { canReview: true });
    assertSmoke(duplicateAfterSanitization.duplicateCount > 0, "duplicate detection uses sanitized existing queue keys");
    assertNoForbiddenOutput(duplicateAfterSanitization.queue, "insert queue with unsafe existing records");
    assertNoForbiddenOutput(duplicateAfterSanitization.sessionPatch, "insert patch with unsafe existing records");
    assertNoForbiddenOutput(duplicateAfterSanitization.session.travelV2RiskBidReviewQueue, "insert session queue with unsafe existing records");
    for (const record of duplicateAfterSanitization.queue.records) assertOnlyKeys(record, RECORD_KEYS, "inserted queue with unsafe existing records exposes only safe record keys");

    const counts = prepareTravelV2RiskBidReviewQueueState({}, { queue: { records: [{ ...unrelated, status: "pending" }, { ...unrelated, queueKey: "reviewed", status: "reviewed" }, { ...unrelated, queueKey: "dismissed", status: "dismissed" }, { ...unrelated, queueKey: "applied", status: "applied" }, { ...unrelated, queueKey: "invalid", status: "queued" }] } });
    assertEqual(counts.pendingCount, 2, "pending count is correct after sanitization");
    assertEqual(counts.reviewedCount, 1, "reviewed count is correct");
    assertEqual(counts.dismissedCount, 1, "dismissed count is correct");
    assertEqual(counts.appliedCount, 1, "applied count is correct");
    assertEqual(counts.insertedCount, 5, "inserted count is correct after sanitization");

    for (const record of insertedFailure.queue.records) assertOnlyKeys(record, RECORD_KEYS, "queue records expose only safe keys");
    const unsafe = prepareTravelV2RiskBidReviewQueueRecord({ payloadType: "applyPayload", candidateType: "actorUuid", severity: "secret", tier: "5 secret", label: "gmOnly label", text: "hiddenHazards text", stationName: "Actor.bad" });
    assertNoForbiddenOutput(unsafe, "unsafe record output");
    assertEqual(unsafe.label, "Risk bid review", "unsafe label falls back");
    assertEqual(unsafe.text, "Risk bid review requires GM decision.", "unsafe text falls back");
    assertEqual(unsafe.tier, null, "unsafe/freeform tier becomes null");
    for (const value of [2, "5", 8]) assertEqual(prepareTravelV2RiskBidReviewQueueRecord({ tier: value }).tier, Number(value), `valid tier ${value} is preserved as number`);

    assertSmoke(Object.isFrozen(insertedFailure) && Object.isFrozen(insertedFailure.queue) && Object.isFrozen(insertedFailure.queue.records) && Object.isFrozen(insertedFailure.queue.records[0]) && Object.isFrozen(insertedFailure.session), "output is frozen");
    assertNoForbiddenOutput(insertedFailure, "inserted queue output");
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

  return { checked: ["risk-bid-review-queue-status-normalization", "risk-bid-review-queue-safe-blocking", "risk-bid-review-queue-confirmed-insertion", "risk-bid-review-queue-critical-failure-severe", "risk-bid-review-queue-duplicates-preserve-existing", "risk-bid-review-queue-existing-record-sanitization", "risk-bid-review-queue-counts", "risk-bid-review-queue-safe-shape-sanitization", "risk-bid-review-queue-frozen-no-mutation"] };
}

export default runTravelV2RiskBidReviewQueueSmokeChecks;

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = runTravelV2RiskBidReviewQueueSmokeChecks();
    console.log(`Travel v2 risk bid review queue smoke checks passed. Checked ${result.checked.length} groups.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
