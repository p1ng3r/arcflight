import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";
import { prepareTravelV2PendingStationBenefitPlayerState } from "./travel-v2-pending-station-benefit-queue.js";
import { prepareTravelV2StationBenefitUseReviewPlayerState } from "./travel-v2-station-benefit-use-review.js";
import { queueTravelV2InterStationHelpPendingRecord, TRAVEL_V2_INTER_STATION_HELP_PENDING_QUEUE_VERSION } from "./travel-v2-inter-station-help-pending-queue.js";

const FORBIDDEN = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "gmNote", "gmSummary", "applyPayload", "actorId", "actorUuid", "targetActorId", "targetActorUuid", "mutationScope", "internalMutation", "hiddenData", "hiddenHazardData", "resolverUserId", "rawTarget", "secret", "pendingConsequenceQueue", "unrevealedHazard", "catalogSuggestions", "SPOOF", "secret-tag"];
const ADVERSARIAL_DUPLICATE_FORBIDDEN = ["gmText", "gmNote", "gmSummary", "actorId", "actorUuid", "targetActorId", "targetActorUuid", "hiddenData", "hiddenHazardData", "resolverUserId", "applyPayload", "internalMutation", "rawTarget", "GM SECRET", "PRIVATE NOTE", "HIDDEN SUMMARY", "PRIVATE ACTOR ID", "Actor.private", "Actor.target", "HIDDEN VALUE", "HAZARD SECRET", "PRIVATE USER", "NESTED SECRET", "Actor.raw"];
const MUTATION_CALLS = [".update(", "setFlag", "unsetFlag", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "createEmbeddedDocuments", "updateEmbeddedDocuments", "deleteEmbeddedDocuments", "new Roll("];
function snap(value) { return JSON.stringify(value); }
function assertSafe(value, label) { const serialized = snap(value); for (const term of FORBIDDEN) assert.equal(serialized.includes(term), false, `${label} leaked ${term}`); }
function assertNoTerms(value, terms, label) { const serialized = snap(value); for (const term of terms) assert.equal(serialized.includes(term), false, `${label} leaked ${term}`); }
function assertNotEnqueued(result, originalLength) {
  assert.equal(result.ok, false);
  assert.equal(result.queued, false);
  assert.equal(result.duplicate, false);
  assert.equal(result.blockedReasons.includes("inter-station-help-queue-insert-not-requested"), true);
  assert.equal(result.queueRecord, null);
  assert.equal(result.session.travelV2PendingStationBenefits.length, originalLength);
}
function fixtureSession(overrides = {}) {
  return {
    currentRoundIndex: 0,
    event: { key: "slice-03", rounds: [{ roundNumber: 1, activeStations: ["navigator", "engineer", "captain"], stationOrder: ["navigator", "engineer", "captain"], stationPrompts: { navigator: { stationName: "Navigator" }, engineer: { stationName: "Engineer" }, captain: { stationName: "Captain" } }, stationCards: [{ stationKey: "navigator", interStationHelp: [{ id: "nav-to-engineer", targetStationKey: "engineer", title: "Chart an Engine Line", publicText: "Show the Engineer a stable current.", tags: ["route"], criticalSuccessMetadata: { strengthening: "stronger-opening", publicText: "Engineer gets a cleaner opening.", tags: ["critical"], gmText: "SECRET", applyPayload: { bad: true }, magnitude: 99 } }] }, { stationKey: "captain", interStationHelp: [{ id: "captain-to-nav", targetStationKey: "navigator", title: "Too Late", publicText: "Earlier target." }] }] }] },
    roundResults: [{ stationResults: { navigator: null, engineer: null, captain: null }, stationOrderCommitments: { navigator: { committed: true }, engineer: { committed: true }, captain: { committed: true } } }],
    ...overrides
  };
}
function selectedAction(session, actionId = "nav-to-engineer") { return prepareTravelV2InterStationHelpActions(session, { includeUnavailable: true, roundIndex: 0 }).helpActions.find((row) => row.actionId === actionId); }
function validContext(extra = {}) { return { result: "success", roundIndex: 0, sourceStationKey: "navigator", targetStationKey: "engineer", actionId: "nav-to-engineer", ...extra }; }

export default async function runTravelV2InterStationHelpPendingQueueSmokeChecks() {
  const checked = [];
  assert.equal(TRAVEL_V2_INTER_STATION_HELP_PENDING_QUEUE_VERSION, 1);
  assert.equal(typeof queueTravelV2InterStationHelpPendingRecord, "function");
  checked.push("helper exports/version");

  const session = fixtureSession({ travelV2PendingStationBenefits: [{ queueKey: "existing-a", title: "Existing A", publicText: "A", sourceStation: "navigator", targetStation: "engineer", benefitKind: "dcReduction", status: "pending" }, { queueKey: "existing-b", title: "Existing B", publicText: "B", sourceStation: "engineer", targetStation: "captain", benefitKind: "supportOpening", status: "pending" }] });
  const action = selectedAction(session);
  const beforeSession = snap(session);
  const beforeAction = snap(action);
  const context = validContext({ title: "SPOOF TITLE", publicText: "SPOOF TEXT", tags: ["secret-tag"] });
  const beforeContext = snap(context);

  const notRequested = queueTravelV2InterStationHelpPendingRecord(session, action, validContext());
  assertNotEnqueued(notRequested, 2);
  const genericCreateRequested = queueTravelV2InterStationHelpPendingRecord(session, action, validContext(), { createRequested: true });
  assertNotEnqueued(genericCreateRequested, 2);
  const contextEnqueueRequested = queueTravelV2InterStationHelpPendingRecord(session, action, { ...validContext(), enqueueRequested: true });
  assertNotEnqueued(contextEnqueueRequested, 2);
  checked.push("only options.enqueueRequested authorizes insertion; success alone, generic create, and result-context enqueue flags do not enqueue");

  const queued = queueTravelV2InterStationHelpPendingRecord(session, { ...action, title: "SPOOF TITLE", publicText: "SPOOF TEXT", sourceStationName: "SPOOF SOURCE", targetStationName: "SPOOF TARGET", tags: ["secret-tag"] }, context, { enqueueRequested: true });
  assert.equal(queued.ok, true);
  assert.equal(queued.queued, true);
  assert.equal(queued.queueField, "travelV2PendingStationBenefits");
  assert.equal(queued.session.travelV2PendingStationBenefits.length, 3);
  assert.equal(queued.session.travelV2PendingStationBenefits[0].queueKey, "existing-a");
  assert.equal(queued.session.travelV2PendingStationBenefits[1].queueKey, "existing-b");
  const row = queued.session.travelV2PendingStationBenefits[2];
  assert.equal(row.queueKey, "inter-station-help:0:nav-to-engineer:navigator:engineer");
  assert.equal(row.queueKey, queued.pendingRecord.pendingHelpKey);
  assert.equal(row.pendingHelpKey, queued.pendingRecord.pendingHelpKey);
  assert.equal(row.dedupeKey, queued.pendingRecord.dedupeKey);
  assert.equal(row.benefitKind, "stationOrderOpening");
  assert.equal(row.status, "pending");
  assert.equal(row.applied, false);
  assert.equal(row.consumed, false);
  assert.equal(row.used, false);
  assert.equal(row.publicText, "Show the Engineer a stable current.");
  assert.equal(row.playerSafeSummary, row.publicText);
  assert.equal(row.sourceStation, "navigator");
  assert.equal(row.sourceStationLabel, "Navigator");
  assert.equal(row.targetStation, "engineer");
  assert.equal(row.targetStationLabel, "Engineer");
  assert.deepEqual(row.tags, ["route"]);
  assert.equal(Object.hasOwn(row, "criticalSuccessMetadata"), false);
  assertSafe(queued.queueRecord, "queued row");
  assertSafe(queued.pendingRecord, "queued pending record");
  checked.push("successful canonical help enqueues one pending player-safe stationOrderOpening row with stable identity and preserved order");

  const duplicate = queueTravelV2InterStationHelpPendingRecord(queued.session, action, validContext(), { enqueueRequested: true });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.queued, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.blockedReasons.includes("duplicate-pending-inter-station-help-queue-record"), true);
  assert.equal(duplicate.session.travelV2PendingStationBenefits.length, 3);
  assert.equal(duplicate.session.travelV2PendingStationBenefits[2].queueKey, row.queueKey);
  checked.push("duplicate enqueue does not append another raw row and returns deterministic blocked state");

  const adversarialDuplicateRow = {
    queueKey: row.queueKey,
    pendingHelpKey: row.queueKey,
    dedupeKey: row.queueKey,
    title: "Canonical safe title",
    publicText: "Canonical safe public text",
    playerSafeSummary: "Canonical safe public text",
    sourceStation: "navigator",
    sourceStationKey: "navigator",
    sourceStationName: "Navigator",
    sourceStationLabel: "Navigator",
    targetStation: "engineer",
    targetStationKey: "engineer",
    targetStationName: "Engineer",
    targetStationLabel: "Engineer",
    roundIndex: 0,
    roundNumber: 1,
    resultBand: "success",
    benefitKind: "stationOrderOpening",
    expires: "endOfRound",
    status: "pending",
    tags: ["route"],
    criticalSuccess: false,
    playerSafe: true,
    playerVisible: true,
    reviewOnly: true,
    applyAvailable: false,
    useAvailable: false,
    applied: false,
    consumed: false,
    used: false,
    gmText: "GM SECRET",
    gmNote: "PRIVATE NOTE",
    gmSummary: "HIDDEN SUMMARY",
    actorId: "PRIVATE ACTOR ID",
    actorUuid: "Actor.private",
    targetActorId: "PRIVATE TARGET ID",
    targetActorUuid: "Actor.target",
    hiddenData: { secret: "HIDDEN VALUE" },
    hiddenHazardData: { secret: "HAZARD SECRET" },
    resolverUserId: "PRIVATE USER",
    applyPayload: { mutation: true },
    internalMutation: { target: "PRIVATE" },
    nested: { rawTarget: { actorUuid: "Actor.raw", secret: "NESTED SECRET" } }
  };
  const adversarialSession = fixtureSession({ customSessionMarker: { preserved: true }, travelV2PendingStationBenefits: [adversarialDuplicateRow] });
  delete adversarialSession.event.rounds[0].stationCards[0].interStationHelp[0].criticalSuccessMetadata.gmText;
  delete adversarialSession.event.rounds[0].stationCards[0].interStationHelp[0].criticalSuccessMetadata.applyPayload;
  const adversarialDuplicate = queueTravelV2InterStationHelpPendingRecord(adversarialSession, action, validContext(), { enqueueRequested: true });
  assert.equal(adversarialDuplicate.ok, false);
  assert.equal(adversarialDuplicate.queued, false);
  assert.equal(adversarialDuplicate.duplicate, true);
  assert.equal(adversarialDuplicate.blockedReasons.includes("duplicate-pending-inter-station-help-queue-record"), true);
  assert.equal(adversarialDuplicate.session.travelV2PendingStationBenefits.length, 1);
  assert.equal(adversarialSession.travelV2PendingStationBenefits.length, 1);
  assert.equal(adversarialDuplicate.session.currentRoundIndex, adversarialSession.currentRoundIndex);
  assert.deepEqual(adversarialDuplicate.session.event, adversarialSession.event);
  assert.deepEqual(adversarialDuplicate.session.roundResults, adversarialSession.roundResults);
  assert.deepEqual(adversarialDuplicate.session.customSessionMarker, { preserved: true });
  assert.equal(adversarialDuplicate.existingQueueRecord.queueKey, row.queueKey);
  assert.deepEqual(Object.keys(adversarialDuplicate.existingQueueRecord).sort(), ["applied", "applyAvailable", "benefitKind", "consumed", "criticalSuccess", "dedupeKey", "expires", "pendingHelpKey", "playerSafe", "playerSafeSummary", "playerVisible", "publicText", "queueKey", "resultBand", "reviewOnly", "roundIndex", "roundNumber", "sourceStation", "sourceStationKey", "sourceStationLabel", "sourceStationName", "status", "tags", "targetStation", "targetStationKey", "targetStationLabel", "targetStationName", "title", "useAvailable", "used"].sort());
  assert.deepEqual(Object.keys(adversarialDuplicate.session.travelV2PendingStationBenefits[0]).sort(), Object.keys(adversarialDuplicate.existingQueueRecord).sort());
  assertNoTerms(adversarialDuplicate, ADVERSARIAL_DUPLICATE_FORBIDDEN, "adversarial duplicate result");
  checked.push("adversarial duplicate preserves session fields while summarizing queue rows without echoing private fields anywhere in the helper result");

  const critical = queueTravelV2InterStationHelpPendingRecord(fixtureSession(), action, validContext({ result: "criticalSuccess" }), { enqueueRequested: true });
  assert.equal(critical.ok, true);
  assert.equal(critical.queueRecord.criticalSuccess, true);
  assert.equal(critical.queueRecord.criticalSuccessMetadata.strengthening, "stronger-opening");
  assert.equal(critical.queueRecord.criticalSuccessMetadata.publicText, "Engineer gets a cleaner opening.");
  assert.equal(critical.queueRecord.applied, false);
  assert.equal(critical.queueRecord.consumed, false);
  assert.equal(critical.queueRecord.useAvailable, false);
  assert.equal(critical.queueRecord.applyAvailable, false);
  assert.equal(Object.hasOwn(critical.queueRecord, "magnitude"), false);
  assertSafe(critical.queueRecord, "critical queued row");
  checked.push("critical-success metadata is preserved but remains inert");

  const blockedCases = [
    ["unsuccessful", validContext({ result: "failure" }), action, "inter-station-help-result-not-successful"],
    ["source mismatch", validContext({ sourceStationKey: "captain" }), action, "inter-station-help-source-context-mismatch"],
    ["target mismatch", validContext({ targetStationKey: "captain" }), action, "inter-station-help-target-context-mismatch"],
    ["action mismatch", validContext({ actionId: "other" }), action, "inter-station-help-action-context-mismatch"],
    ["stale round", validContext({ roundIndex: 1 }), action, "round-context-mismatch"],
    ["missing round", validContext(), { ...action, roundIndex: " " }, "missing-action-round-context"],
    ["earlier target", { result: "success", roundIndex: 0 }, selectedAction(session, "captain-to-nav"), "target-station-not-later-in-order"],
    ["inactive target", validContext(), { ...action, targetStationKey: "watchmaster" }, "inter-station-help-action-not-prepared-for-round"]
  ];
  const unlockedSession = fixtureSession({ roundResults: [{ stationResults: { navigator: null, engineer: null, captain: null }, stationOrderCommitments: {} }] });
  blockedCases.push(["unlocked", validContext(), selectedAction(unlockedSession), "station-order-not-locked", unlockedSession]);
  for (const [, resultContext, blockedAction, reason, customSession] of blockedCases) {
    const result = queueTravelV2InterStationHelpPendingRecord(customSession ?? session, blockedAction, resultContext, { enqueueRequested: true });
    assert.equal(result.ok, false);
    assert.equal(result.session.travelV2PendingStationBenefits?.length ?? 0, (customSession ?? session).travelV2PendingStationBenefits?.length ?? 0);
    assert.equal(result.blockedReasons.includes(reason), true, reason);
  }
  checked.push("Slice 02 blocked conditions and malformed action round context produce no insertion");

  const playerState = prepareTravelV2PendingStationBenefitPlayerState({ session: queued.session });
  const playerRow = playerState.rows.find((entry) => entry.queueKey === row.queueKey);
  assert.ok(playerRow);
  assert.equal(playerRow.title, "Chart an Engine Line");
  assert.equal(playerRow.sourceStationLabel, "Navigator");
  assert.equal(playerRow.targetStationLabel, "Engineer");
  assert.equal(playerRow.benefitKind, "stationOrderOpening");
  assert.equal(playerRow.status, "pending");
  assert.equal(playerRow.publicText, "Show the Engineer a stable current.");
  assert.equal(playerRow.reviewOnly, true);
  assert.equal(playerRow.useAvailable, false);
  assert.equal(playerRow.applyAvailable, false);
  assertSafe(playerState, "player projection");
  checked.push("player pending-benefit projection recognizes the new row safely");

  const review = prepareTravelV2StationBenefitUseReviewPlayerState({ session: queued.session, selectedQueueKey: row.queueKey, stationBenefitUseReviewRequested: true });
  assert.equal(review.selectedCandidate.status, "ready");
  assert.equal(review.selectedCandidate.candidate.queueKey, row.queueKey);
  assert.equal(review.selectedCandidate.candidate.reviewOnly, true);
  assert.equal(review.selectedCandidate.candidate.useAvailable, false);
  assert.equal(review.selectedCandidate.candidate.applyAvailable, false);
  assert.equal(review.selectedCandidate.candidate.applied, false);
  assert.equal(review.selectedCandidate.candidate.used, false);
  checked.push("station benefit use-review can select the row but remains review-only with no use/apply");

  assert.equal(snap(session), beforeSession);
  assert.equal(snap(action), beforeAction);
  assert.equal(snap(context), beforeContext);
  assert.notEqual(queued.session, session);
  assert.throws(() => { queued.session.travelV2PendingStationBenefits[2].title = "mutated clone"; }, TypeError);
  assert.equal(session.travelV2PendingStationBenefits.length, 2);
  checked.push("input session/action/context are unchanged and returned session is clone-safe");

  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game, socket: globalThis.socket, Roll: globalThis.Roll };
  globalThis.Actor = { updateDocuments: () => sideEffects.push("actors") };
  globalThis.Item = { updateDocuments: () => sideEffects.push("items") };
  globalThis.ChatMessage = { create: () => sideEffects.push("chat") };
  globalThis.JournalEntry = { create: () => sideEffects.push("journal") };
  globalThis.game = { settings: { set: () => sideEffects.push("settings") }, socket: { emit: () => sideEffects.push("socket") } };
  globalThis.socket = { emit: () => sideEffects.push("socket") };
  globalThis.Roll = function Roll() { sideEffects.push("roll"); };
  queueTravelV2InterStationHelpPendingRecord(session, action, validContext(), { enqueueRequested: true });
  Object.assign(globalThis, prior);
  assert.deepEqual(sideEffects, []);
  const source = readFileSync(new URL("./travel-v2-inter-station-help-pending-queue.js", import.meta.url), "utf8");
  for (const token of MUTATION_CALLS) assert.equal(source.includes(token), false, `source must not include ${token}`);
  checked.push("no actor, item, effect, scene, token, chat, journal, socket, compendium, combat, world mutation, or dice rolls");

  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2InterStationHelpPendingQueueSmokeChecks().then((result) => { console.log("Travel v2 inter-station help pending queue smoke checks passed."); for (const check of result.checked) console.log(`- ${check}`); }).catch((error) => { console.error(error); process.exitCode = 1; });
}
