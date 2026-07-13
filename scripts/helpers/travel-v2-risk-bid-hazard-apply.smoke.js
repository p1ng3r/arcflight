import { prepareTravelV2RiskBidHazardApply, TRAVEL_V2_RISK_BID_HAZARD_APPLY_VERSION } from "./travel-v2-risk-bid-hazard-apply.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 risk bid hazard apply smoke check failed: ${message}`);
}
function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`Travel v2 risk bid hazard apply smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
}
function reviewedRecord(overrides = {}) {
  return {
    queueKey: overrides.queueKey ?? "queue:hazard:1",
    source: "riskBidResult",
    status: "reviewed",
    selected: true,
    payloadType: overrides.payloadType ?? "hazardProgressReview",
    candidateType: overrides.candidateType ?? "hazardProgressCandidate",
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

export default async function runTravelV2RiskBidHazardApplySmokeChecks() {
  assertEqual(TRAVEL_V2_RISK_BID_HAZARD_APPLY_VERSION, 1, "helper export exists");
  assertEqual(typeof prepareTravelV2RiskBidHazardApply, "function", "prepare helper export exists");

  const nonGm = prepareTravelV2RiskBidHazardApply(sessionWith([reviewedRecord()]), { canReview: false });
  assertSmoke(nonGm.blockedReasons.includes("travel-v2-review-permission-required"), "non-GM blocks");
  const missingQueue = prepareTravelV2RiskBidHazardApply({}, { canReview: true });
  assertSmoke(missingQueue.blockedReasons.includes("risk-bid-review-queue-not-found"), "missing queue blocks");
  const noArmed = prepareTravelV2RiskBidHazardApply(sessionWith([]), { canReview: true });
  assertSmoke(noArmed.blockedReasons.includes("missing-armed-risk-bid-review-apply-gate-records"), "no armed gate records blocks");
  const noHazard = prepareTravelV2RiskBidHazardApply(sessionWith([reviewedRecord({ payloadType: "consequenceReview", candidateType: "consequenceCandidate" })]), { canReview: true });
  assertSmoke(noHazard.blockedReasons.includes("missing-risk-bid-hazard-gate-records"), "no hazard gate records blocks");
  for (const applyMode of ["freeform", "secret", "applyPayload"]) {
    const invalid = prepareTravelV2RiskBidHazardApply(sessionWith([reviewedRecord()]), { canReview: true, applyMode });
    assertSmoke(invalid.blockedReasons.includes("invalid-risk-bid-hazard-apply-mode"), "invalid apply mode blocks");
    assertNoForbidden(invalid, "invalid apply mode output");
  }

  const baseSession = sessionWith([reviewedRecord()]);
  const snapshot = JSON.stringify(baseSession);
  const preview = prepareTravelV2RiskBidHazardApply(baseSession, { canReview: true, applyMode: "preview" });
  assertEqual(preview.hazardRecords.length, 1, "preview mode creates hazard records");
  assertEqual(preview.sessionPatch, null, "preview mode creates no sessionPatch");
  assertEqual(preview.staged, false, "preview staged false");
  assertEqual(preview.committed, false, "preview committed false");
  assertEqual(preview.applied, false, "preview applied false");
  assertEqual(preview.hazardRecords[0].hazardDelta, 1, "hazardProgress maps to delta 1");
  assertEqual(preview.hazardRecords[0].hazardKind, "progress", "hazardProgress maps kind progress");
  assertEqual(preview.hazardRecords[0].hazardKey, `risk-bid-hazard-apply:${preview.hazardRecords[0].gateKey}`, "hazard key is deterministic");
  assertEqual(preview.hazardRecords[0].hazardOnly, true, "hazardOnly true");
  assertEqual(preview.hazardRecords[0].previewOnly, true, "previewOnly preserved");
  assertEqual(preview.hazardRecords[0].intentOnly, true, "intentOnly preserved");
  assertEqual(preview.hazardRecords[0].gateOnly, true, "gateOnly preserved");
  assertEqual(preview.hazardRecords[0].armed, true, "armed preserved");
  const expectedKeys = ["hazardVersion", "hazardKey", "gateKey", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "hazardDelta", "hazardKind", "hazardSeverity", "previewOnly", "intentOnly", "gateOnly", "hazardOnly", "armed", "applied"];
  assertEqual(Object.keys(preview.hazardRecords[0]).sort().join(","), expectedKeys.slice().sort().join(","), "hazard record has exact safe shape");
  assertEqual(JSON.stringify(baseSession), snapshot, "input session is not mutated");

  const stage = prepareTravelV2RiskBidHazardApply(baseSession, { canReview: true, applyMode: "stage", now: "2026-07-13T00:00:00.000Z" });
  assertEqual(stage.hazardRecords.length, 1, "stage mode creates hazard records");
  assertSmoke(stage.sessionPatch?.travelV2RiskBidHazardApply, "stage mode creates safe sessionPatch");
  assertEqual(stage.staged, true, "stage staged true");
  assertEqual(stage.committed, false, "stage committed false");
  assertEqual(stage.applied, false, "stage applied false");

  const severeSession = sessionWith([reviewedRecord({ queueKey: "queue:hazard:2", payloadType: "hazardEscalationReview", candidateType: "hazardEscalation", severity: "severe", dangerLevel: "severe" })]);
  const severe = prepareTravelV2RiskBidHazardApply(severeSession, { canReview: true });
  assertEqual(severe.hazardRecords[0].hazardDelta, 2, "hazardEscalation maps delta 2");
  assertEqual(severe.hazardRecords[0].hazardKind, "escalation", "hazardEscalation maps kind escalation");

  const mixedSession = sessionWith([reviewedRecord({ queueKey: "queue:hazard:1" }), reviewedRecord({ queueKey: "queue:hazard:2", payloadType: "hazardEscalationReview", candidateType: "hazardEscalation", severity: "severe", dangerLevel: "severe" }), reviewedRecord({ queueKey: "queue:hazard:3", payloadType: "additionalHazardReview", candidateType: "additionalHazardCandidate", severity: "serious", dangerLevel: "extreme" }), reviewedRecord({ queueKey: "queue:other:1", payloadType: "consequenceReview", candidateType: "consequenceCandidate" })]);
  const mixed = prepareTravelV2RiskBidHazardApply(mixedSession, { canReview: true, applyMode: "commit", now: "2026-07-13T00:00:00.000Z" });
  assertEqual(mixed.hazardRecords.length, 3, "non-hazard gate records are ignored");
  assertEqual(mixed.hazardDeltaTotal, 4, "mixed hazard records total correctly");
  assertEqual(mixed.byResolutionType.hazardProgress, 1, "counts hazard progress by resolution type");
  assertEqual(mixed.byResolutionType.hazardEscalation, 1, "counts hazard escalation by resolution type");
  assertEqual(mixed.byResolutionType.additionalHazard, 1, "counts additional hazard by resolution type");
  assertEqual(mixed.byHazardKind.progress, 1, "counts progress hazard kind");
  assertEqual(mixed.byHazardKind.escalation, 1, "counts escalation hazard kind");
  assertEqual(mixed.byHazardKind.additional, 1, "counts additional hazard kind");
  assertEqual(mixed.byDangerLevel.high, 1, "counts by danger level");
  assertEqual(mixed.byDangerLevel.severe, 1, "counts severe danger level");
  assertEqual(mixed.byDangerLevel.extreme, 1, "counts extreme danger level");
  assertEqual(mixed.bySeverity.strong, 1, "counts by severity");
  assertEqual(mixed.bySeverity.severe, 1, "counts severe severity");
  assertEqual(mixed.bySeverity.serious, 1, "counts serious severity");
  assertEqual(mixed.hazardRecords.find((record) => record.resolutionType === "additionalHazard").hazardDelta, 1, "additionalHazard maps delta 1");
  assertEqual(mixed.hazardRecords.find((record) => record.resolutionType === "additionalHazard").hazardKind, "additional", "additionalHazard maps kind additional");
  assertSmoke(mixed.sessionPatch?.travelV2RiskBidHazardApply, "commit mode creates safe sessionPatch");
  assertSmoke(mixed.session?.travelV2RiskBidHazardApply, "commit mode creates cloned session");
  assertSmoke(mixed.session !== mixedSession, "commit output session is a clone");
  assertEqual(mixed.staged, true, "commit staged true");
  assertEqual(mixed.committed, true, "commit committed true");
  assertEqual(mixed.applied, true, "commit applied true");
  assertSmoke(mixed.hazardRecords.every((record) => record.applied === true), "commit hazard records are marked applied session-locally");
  assertEqual(JSON.stringify(mixedSession), JSON.stringify(sessionWith(mixedSession.travelV2RiskBidReviewQueue.records)), "commit does not mutate input session");
  assertNoForbidden(preview, "preview output");
  assertNoForbidden(stage, "stage output");
  assertNoForbidden(mixed, "commit output");
  assertSmoke(!JSON.stringify(mixed).includes("world"), "no world mutation side effects occur");
  return { checked: ["risk-bid-hazard-apply"] };
}
