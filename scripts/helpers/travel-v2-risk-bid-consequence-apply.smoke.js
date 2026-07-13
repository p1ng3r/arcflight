import { prepareTravelV2RiskBidConsequenceApply, TRAVEL_V2_RISK_BID_CONSEQUENCE_APPLY_VERSION } from "./travel-v2-risk-bid-consequence-apply.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 risk bid consequence apply smoke check failed: ${message}`);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 risk bid consequence apply smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
}
function reviewedRecord(overrides = {}) {
  return {
    queueKey: overrides.queueKey ?? "queue:consequence:1",
    source: "riskBidResult",
    status: "reviewed",
    selected: true,
    payloadType: overrides.payloadType ?? "consequenceReview",
    candidateType: overrides.candidateType ?? "consequenceCandidate",
    severity: overrides.severity ?? "strong",
    tier: overrides.tier ?? 8,
    resultBand: overrides.resultBand ?? "failure",
    dangerLevel: overrides.dangerLevel ?? "high",
    stationKey: overrides.stationKey ?? "navigator",
    stationName: overrides.stationName ?? "Navigator",
    actionId: overrides.actionId ?? "plot-course",
    actionName: overrides.actionName ?? "Plot Course",
    roundIndex: 0,
    roundNumber: 1,
    label: overrides.label ?? "High risk",
    text: overrides.text ?? "Hold for later resolution."
  };
}
function sessionWith(records) {
  return { event: { name: "Risk" }, travelV2RiskBidReviewQueue: { records } };
}
function assertNoForbidden(value, message) {
  const json = JSON.stringify(value);
  for (const forbidden of ["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]) {
    assertSmoke(!json.includes(forbidden), `${message} excludes ${forbidden}`);
  }
}

export default async function runTravelV2RiskBidConsequenceApplySmokeChecks() {
  assertEqual(TRAVEL_V2_RISK_BID_CONSEQUENCE_APPLY_VERSION, 1, "helper export exists");
  assertEqual(typeof prepareTravelV2RiskBidConsequenceApply, "function", "prepare helper export exists");

  const nonGm = prepareTravelV2RiskBidConsequenceApply(sessionWith([reviewedRecord()]), { canReview: false });
  assertSmoke(nonGm.blockedReasons.includes("travel-v2-review-permission-required"), "non-GM blocks");
  const missingQueue = prepareTravelV2RiskBidConsequenceApply({}, { canReview: true });
  assertSmoke(missingQueue.blockedReasons.includes("risk-bid-review-queue-not-found"), "missing queue blocks");
  const noArmed = prepareTravelV2RiskBidConsequenceApply(sessionWith([]), { canReview: true });
  assertSmoke(noArmed.blockedReasons.includes("missing-armed-risk-bid-review-apply-gate-records"), "no armed gate records blocks");
  const noConsequence = prepareTravelV2RiskBidConsequenceApply(sessionWith([reviewedRecord({ payloadType: "pressureReview", candidateType: "pressureCandidate" })]), { canReview: true });
  assertSmoke(noConsequence.blockedReasons.includes("missing-risk-bid-consequence-gate-records"), "no consequence gate records blocks");
  for (const applyMode of ["freeform", "secret", "applyPayload"]) {
    const invalid = prepareTravelV2RiskBidConsequenceApply(sessionWith([reviewedRecord()]), { canReview: true, applyMode });
    assertSmoke(invalid.blockedReasons.includes("invalid-risk-bid-consequence-apply-mode"), "invalid apply mode blocks");
    assertNoForbidden(invalid, "invalid apply mode output");
  }

  const baseSession = sessionWith([reviewedRecord()]);
  const snapshot = JSON.stringify(baseSession);
  const preview = prepareTravelV2RiskBidConsequenceApply(baseSession, { canReview: true, applyMode: "preview" });
  assertEqual(preview.consequenceRecords.length, 1, "preview mode creates consequence records");
  assertEqual(preview.sessionPatch, null, "preview mode creates no sessionPatch");
  assertEqual(preview.staged, false, "preview staged false");
  assertEqual(preview.committed, false, "preview committed false");
  assertEqual(preview.applied, false, "preview applied false");
  assertEqual(preview.consequenceRecords[0].consequenceDelta, 1, "consequence maps to delta 1");
  assertEqual(preview.consequenceRecords[0].consequenceKind, "standard", "consequence maps kind standard");
  assertEqual(preview.consequenceRecords[0].consequenceKey, `risk-bid-consequence-apply:${preview.consequenceRecords[0].gateKey}`, "consequence key is deterministic");
  assertEqual(preview.consequenceRecords[0].consequenceOnly, true, "consequenceOnly true");
  assertEqual(preview.consequenceRecords[0].previewOnly, true, "previewOnly preserved");
  assertEqual(preview.consequenceRecords[0].intentOnly, true, "intentOnly preserved");
  assertEqual(preview.consequenceRecords[0].gateOnly, true, "gateOnly preserved");
  assertEqual(preview.consequenceRecords[0].armed, true, "armed preserved");
  const expectedKeys = ["consequenceVersion", "consequenceKey", "gateKey", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "consequenceDelta", "consequenceKind", "consequenceSeverity", "previewOnly", "intentOnly", "gateOnly", "consequenceOnly", "armed", "applied"];
  assertEqual(Object.keys(preview.consequenceRecords[0]).sort().join(","), expectedKeys.slice().sort().join(","), "consequence record has exact safe shape");
  assertEqual(JSON.stringify(baseSession), snapshot, "input session is not mutated");

  const stage = prepareTravelV2RiskBidConsequenceApply(baseSession, { canReview: true, applyMode: "stage", now: "2026-07-13T00:00:00.000Z" });
  assertEqual(stage.consequenceRecords.length, 1, "stage mode creates consequence records");
  assertSmoke(stage.sessionPatch?.travelV2RiskBidConsequenceApply, "stage mode creates safe sessionPatch");
  assertEqual(stage.staged, true, "stage staged true");
  assertEqual(stage.committed, false, "stage committed false");
  assertEqual(stage.applied, false, "stage applied false");

  const severeSession = sessionWith([reviewedRecord({ queueKey: "queue:consequence:2", payloadType: "stationComplicationReview", candidateType: "stationComplication", severity: "severe", dangerLevel: "severe" })]);
  const severe = prepareTravelV2RiskBidConsequenceApply(severeSession, { canReview: true });
  assertEqual(severe.consequenceRecords[0].consequenceDelta, 1, "stationComplication maps delta 1");
  assertEqual(severe.consequenceRecords[0].consequenceKind, "stationComplication", "stationComplication maps kind stationComplication");

  const mixedSession = sessionWith([reviewedRecord({ queueKey: "queue:consequence:1" }), reviewedRecord({ queueKey: "queue:consequence:2", payloadType: "stationComplicationReview", candidateType: "stationComplication", severity: "severe", dangerLevel: "severe" }), reviewedRecord({ queueKey: "queue:consequence:3", payloadType: "nextRoundDifficultyReview", candidateType: "nextRoundDifficulty", severity: "serious", dangerLevel: "extreme" }), reviewedRecord({ queueKey: "queue:other:1", payloadType: "pressureReview", candidateType: "pressureCandidate" })]);
  const mixed = prepareTravelV2RiskBidConsequenceApply(mixedSession, { canReview: true, applyMode: "commit", now: "2026-07-13T00:00:00.000Z" });
  assertEqual(mixed.consequenceRecords.length, 3, "non-consequence gate records are ignored");
  assertEqual(mixed.consequenceDeltaTotal, 3, "mixed consequence records total correctly");
  assertEqual(mixed.byResolutionType.consequence, 1, "counts consequence progress by resolution type");
  assertEqual(mixed.byResolutionType.stationComplication, 1, "counts consequence escalation by resolution type");
  assertEqual(mixed.byResolutionType.nextRoundDifficulty, 1, "counts additional consequence by resolution type");
  assertEqual(mixed.byConsequenceKind.standard, 1, "counts standard consequence kind");
  assertEqual(mixed.byConsequenceKind.stationComplication, 1, "counts stationComplication consequence kind");
  assertEqual(mixed.byConsequenceKind.nextRoundDifficulty, 1, "counts nextRoundDifficulty consequence kind");
  assertEqual(mixed.byDangerLevel.high, 1, "counts by danger level");
  assertEqual(mixed.byDangerLevel.severe, 1, "counts severe danger level");
  assertEqual(mixed.byDangerLevel.extreme, 1, "counts extreme danger level");
  assertEqual(mixed.bySeverity.strong, 1, "counts by severity");
  assertEqual(mixed.bySeverity.severe, 1, "counts severe severity");
  assertEqual(mixed.bySeverity.serious, 1, "counts serious severity");
  assertEqual(mixed.consequenceRecords.find((record) => record.resolutionType === "nextRoundDifficulty").consequenceDelta, 1, "nextRoundDifficulty maps delta 1");
  assertEqual(mixed.consequenceRecords.find((record) => record.resolutionType === "nextRoundDifficulty").consequenceKind, "nextRoundDifficulty", "nextRoundDifficulty maps kind nextRoundDifficulty");
  assertSmoke(mixed.sessionPatch?.travelV2RiskBidConsequenceApply, "commit mode creates safe sessionPatch");
  assertSmoke(mixed.session?.travelV2RiskBidConsequenceApply, "commit mode creates cloned session");
  assertSmoke(mixed.session !== mixedSession, "commit output session is a clone");
  assertEqual(mixed.staged, true, "commit staged true");
  assertEqual(mixed.committed, true, "commit committed true");
  assertEqual(mixed.applied, true, "commit applied true");
  assertSmoke(mixed.consequenceRecords.every((record) => record.applied === true), "commit consequence records are marked applied session-locally");
  assertEqual(JSON.stringify(mixedSession), JSON.stringify(sessionWith(mixedSession.travelV2RiskBidReviewQueue.records)), "commit does not mutate input session");
  assertNoForbidden(preview, "preview output");
  assertNoForbidden(stage, "stage output");
  assertNoForbidden(mixed, "commit output");
  assertSmoke(!JSON.stringify(mixed).includes("world"), "no world mutation side effects occur");
  return { checked: ["risk-bid-consequence-apply"] };
}
