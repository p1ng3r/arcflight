import { prepareTravelV2RiskBidResultPipelineCloseout, TRAVEL_V2_RISK_BID_RESULT_PIPELINE_CLOSEOUT_VERSION } from "./travel-v2-risk-bid-result-pipeline-closeout.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 risk bid result pipeline closeout smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel v2 risk bid result pipeline closeout smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
const FORBIDDEN = ["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."];
function assertNoForbidden(value, message) { const json = JSON.stringify(value); for (const forbidden of FORBIDDEN) assertSmoke(!json.includes(forbidden), `${message} excludes ${forbidden}`); }
function reviewedRecord(overrides = {}) { return { queueKey: overrides.queueKey, source: "riskBidResult", status: "reviewed", selected: true, payloadType: overrides.payloadType, candidateType: overrides.candidateType, severity: overrides.severity ?? "strong", tier: 8, resultBand: "failure", dangerLevel: overrides.dangerLevel ?? "high", stationKey: "navigator", stationName: "Navigator", actionId: "plot-course", actionName: "Plot Course", roundIndex: 0, roundNumber: 1, label: overrides.label ?? "High risk", text: overrides.text ?? "Hold for later resolution.", resolutionType: overrides.resolutionType, resolutionFamily: overrides.resolutionFamily }; }
function pressure() { return reviewedRecord({ queueKey: "queue:pressure:1", payloadType: "pressureReview", candidateType: "pressureCandidate", resolutionType: "pressure", resolutionFamily: "pressure" }); }
function hazard() { return reviewedRecord({ queueKey: "queue:hazard:1", payloadType: "hazardEscalationReview", candidateType: "hazardCandidate", resolutionType: "hazardEscalation", resolutionFamily: "hazard", dangerLevel: "extreme" }); }
function consequence() { return reviewedRecord({ queueKey: "queue:consequence:1", payloadType: "consequenceReview", candidateType: "consequenceCandidate", resolutionType: "consequence", resolutionFamily: "consequence" }); }
function positive() { return reviewedRecord({ queueKey: "queue:positive:1", payloadType: "momentumReview", candidateType: "benefitCandidate", resolutionType: "momentum", resolutionFamily: "momentum", dangerLevel: "low" }); }
function scar() { return reviewedRecord({ queueKey: "queue:scar:1", payloadType: "shipScarReview", candidateType: "scarCandidate", resolutionType: "shipScar", resolutionFamily: "scar", severity: "severe" }); }
function sessionWith(records) { return { event: { name: "Risk" }, travelV2RiskBidReviewQueue: { records } }; }

export default async function runTravelV2RiskBidResultPipelineCloseoutSmokeChecks() {
  assertEqual(TRAVEL_V2_RISK_BID_RESULT_PIPELINE_CLOSEOUT_VERSION, 1, "helper version export exists");
  assertEqual(typeof prepareTravelV2RiskBidResultPipelineCloseout, "function", "helper export exists");
  const nonGm = prepareTravelV2RiskBidResultPipelineCloseout(sessionWith([pressure()]), { canReview: false });
  assertSmoke(nonGm.blockedReasons.includes("travel-v2-review-permission-required"), "non-GM blocks");
  assertEqual(nonGm.selectedReviewPreview, null, "non-GM redacts selected review details");
  assertEqual(nonGm.finalApply, null, "non-GM redacts final details");
  assertNoForbidden(nonGm, "non-GM output");
  assertSmoke(prepareTravelV2RiskBidResultPipelineCloseout({}, { canReview: true }).blockedReasons.includes("risk-bid-review-queue-not-found"), "missing queue blocks");
  const empty = prepareTravelV2RiskBidResultPipelineCloseout(sessionWith([]), { canReview: true });
  assertSmoke(empty.blockedReasons.includes("missing-risk-bid-final-apply-records"), "no final records blocks");

  const mixedSession = sessionWith([pressure(), hazard(), consequence(), positive(), scar(), { ...pressure(), queueKey: "queue:other", selected: false }]);
  const snapshot = JSON.stringify(mixedSession);
  const sideEffects = [];
  const prior = { Actor: globalThis.Actor, Item: globalThis.Item, ChatMessage: globalThis.ChatMessage, JournalEntry: globalThis.JournalEntry, game: globalThis.game };
  globalThis.Actor = { update: () => sideEffects.push("actor.update"), create: () => sideEffects.push("Actor.create") };
  globalThis.Item = { update: () => sideEffects.push("Item.update"), create: () => sideEffects.push("Item.create") };
  globalThis.ChatMessage = { create: () => sideEffects.push("ChatMessage.create") };
  globalThis.JournalEntry = { create: () => sideEffects.push("JournalEntry.create") };
  globalThis.game = { socket: { emit: () => sideEffects.push("socket.emit") } };
  try {
    const closeout = prepareTravelV2RiskBidResultPipelineCloseout(mixedSession, { canReview: true, now: "2026-07-13T00:00:00.000Z" });
    assertSmoke(closeout.hasSelectedReview, "GM closeout summary exposes selected review preview readiness");
    assertSmoke(closeout.hasApplyIntent, "GM closeout summary exposes apply intent readiness");
    assertSmoke(closeout.hasApplyGate, "GM closeout summary exposes apply gate readiness");
    assertSmoke(closeout.hasPressure, "GM closeout summary exposes pressure readiness when pressure records exist");
    assertSmoke(closeout.hasHazard, "GM closeout summary exposes hazard readiness when hazard records exist");
    assertSmoke(closeout.hasConsequence, "GM closeout summary exposes consequence readiness when consequence records exist");
    assertSmoke(closeout.hasPositive, "GM closeout summary exposes positive readiness when benefit/Momentum/reward records exist");
    assertSmoke(closeout.hasScar, "GM closeout summary exposes scar readiness when scar records exist");
    assertSmoke(closeout.hasFinalApply && closeout.closeoutReady, "GM closeout summary exposes final apply readiness");
    assertEqual(closeout.selectedCount, 5, "selected records count correctly");
    assertEqual(closeout.gateRecordCount, 5, "gate records count correctly");
    assertEqual(closeout.finalRecordCount, 5, "final records count correctly");
    assertEqual(closeout.pressureRecordCount, 1, "pressure records count correctly");
    assertEqual(closeout.hazardRecordCount, 1, "hazard records count correctly");
    assertEqual(closeout.consequenceRecordCount, 1, "consequence records count correctly");
    assertEqual(closeout.positiveRecordCount, 1, "positive records count correctly");
    assertEqual(closeout.scarRecordCount, 1, "scar records count correctly");
    assertEqual(closeout.byFinalFamily.pressure, 1, "counts by final family are correct");
    assertEqual(closeout.byResolutionType.hazardEscalation, 1, "counts by resolution type are correct");
    assertEqual(closeout.byDangerLevel.high, 3, "counts by danger are correct");
    assertEqual(closeout.bySeverity.severe, 1, "counts by severity are correct");
    assertEqual(closeout.applied, false, "applied is false");
    assertSmoke(!Object.hasOwn(closeout, "sessionPatch"), "no sessionPatch");
    assertSmoke(!Object.hasOwn(closeout, "session"), "no cloned session");
    assertEqual(JSON.stringify(mixedSession), snapshot, "input session is not mutated");
    assertEqual(sideEffects.length, 0, "no Actor/Item/ChatMessage/JournalEntry/socket/world mutation side effects occur");
    assertNoForbidden(closeout, "GM closeout output");
  } finally {
    globalThis.Actor = prior.Actor; globalThis.Item = prior.Item; globalThis.ChatMessage = prior.ChatMessage; globalThis.JournalEntry = prior.JournalEntry; globalThis.game = prior.game;
  }
  return { checked: ["risk-bid-result-pipeline-closeout"] };
}

if (import.meta.url === `file://${process.argv[1]}`) runTravelV2RiskBidResultPipelineCloseoutSmokeChecks().then(() => console.log("Travel v2 risk bid result pipeline closeout smoke checks passed."));
