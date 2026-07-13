import { prepareTravelV2RiskBidFinalApply, TRAVEL_V2_RISK_BID_FINAL_APPLY_VERSION } from "./travel-v2-risk-bid-final-apply.js";

function assertSmoke(condition, message) { if (!condition) throw new Error(`Travel v2 risk bid final apply smoke check failed: ${message}`); }
function assertEqual(actual, expected, message) { if (actual !== expected) throw new Error(`Travel v2 risk bid final apply smoke check failed: ${message}. Expected ${expected}, got ${actual}.`); }
const FORBIDDEN = ["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."];
function assertNoForbidden(value, message) { const json = JSON.stringify(value); for (const forbidden of FORBIDDEN) assertSmoke(!json.includes(forbidden), `${message} excludes ${forbidden}`); }
function reviewedRecord(overrides = {}) { return { queueKey: overrides.queueKey, source: "riskBidResult", status: "reviewed", selected: true, payloadType: overrides.payloadType, candidateType: overrides.candidateType, severity: overrides.severity ?? "strong", tier: 8, resultBand: "failure", dangerLevel: overrides.dangerLevel ?? "high", stationKey: "navigator", stationName: "Navigator", actionId: "plot-course", actionName: "Plot Course", roundIndex: 0, roundNumber: 1, label: overrides.label ?? "High risk", text: overrides.text ?? "Hold for later resolution.", resolutionType: overrides.resolutionType, resolutionFamily: overrides.resolutionFamily }; }
function pressure() { return reviewedRecord({ queueKey: "queue:pressure:1", payloadType: "pressureReview", candidateType: "pressureCandidate", resolutionType: "pressure", resolutionFamily: "pressure" }); }
function hazard() { return reviewedRecord({ queueKey: "queue:hazard:1", payloadType: "hazardEscalationReview", candidateType: "hazardCandidate", resolutionType: "hazardEscalation", resolutionFamily: "hazard", dangerLevel: "extreme" }); }
function consequence() { return reviewedRecord({ queueKey: "queue:consequence:1", payloadType: "consequenceReview", candidateType: "consequenceCandidate", resolutionType: "consequence", resolutionFamily: "consequence" }); }
function positive() { return reviewedRecord({ queueKey: "queue:positive:1", payloadType: "momentumReview", candidateType: "benefitCandidate", resolutionType: "momentum", resolutionFamily: "momentum", dangerLevel: "low" }); }
function scar() { return reviewedRecord({ queueKey: "queue:scar:1", payloadType: "shipScarReview", candidateType: "scarCandidate", resolutionType: "shipScar", resolutionFamily: "scar", severity: "severe" }); }
function sessionWith(records) { return { event: { name: "Risk" }, travelV2RiskBidReviewQueue: { records } }; }

export default async function runTravelV2RiskBidFinalApplySmokeChecks() {
  assertEqual(TRAVEL_V2_RISK_BID_FINAL_APPLY_VERSION, 1, "helper version export exists");
  assertEqual(typeof prepareTravelV2RiskBidFinalApply, "function", "helper export exists");
  assertSmoke(prepareTravelV2RiskBidFinalApply(sessionWith([pressure()]), { canReview: false }).blockedReasons.includes("travel-v2-review-permission-required"), "non-GM blocks");
  assertSmoke(prepareTravelV2RiskBidFinalApply({}, { canReview: true }).blockedReasons.includes("risk-bid-review-queue-not-found"), "missing queue blocks");
  for (const applyMode of ["freeform", "secret", "applyPayload"]) { const invalid = prepareTravelV2RiskBidFinalApply(sessionWith([pressure()]), { canReview: true, applyMode }); assertSmoke(invalid.blockedReasons.includes("invalid-risk-bid-final-apply-mode"), "invalid apply mode blocks"); assertNoForbidden(invalid, "invalid apply mode output"); }
  assertSmoke(prepareTravelV2RiskBidFinalApply(sessionWith([]), { canReview: true }).blockedReasons.includes("missing-risk-bid-final-apply-records"), "no records blocks");

  const mixedSession = sessionWith([pressure(), hazard(), consequence(), positive(), scar(), { ...pressure(), queueKey: "queue:other", selected: false }]);
  const snapshot = JSON.stringify(mixedSession);
  const preview = prepareTravelV2RiskBidFinalApply(mixedSession, { canReview: true, applyMode: "preview" });
  assertEqual(preview.finalRecordCount, 5, "preview mode creates final records");
  assertEqual(preview.sessionPatch, null, "preview has no sessionPatch");
  assertEqual(preview.staged, false, "preview staged false"); assertEqual(preview.committed, false, "preview committed false"); assertEqual(preview.applied, false, "preview applied false");
  assertEqual(preview.pressureRecordCount, 1, "pressure counted"); assertEqual(preview.hazardRecordCount, 1, "hazard counted"); assertEqual(preview.consequenceRecordCount, 1, "consequence counted"); assertEqual(preview.positiveRecordCount, 1, "positive counted"); assertEqual(preview.scarRecordCount, 1, "scar counted");
  assertEqual(preview.pressureDeltaTotal, 1, "pressure total"); assertEqual(preview.hazardDeltaTotal, 2, "hazard total"); assertEqual(preview.consequenceDeltaTotal, 1, "consequence total"); assertEqual(preview.positiveDeltaTotal, 1, "positive total"); assertEqual(preview.benefitDeltaTotal, 0, "benefit total"); assertEqual(preview.momentumDeltaTotal, 1, "momentum total"); assertEqual(preview.rewardDeltaTotal, 0, "reward total"); assertEqual(preview.scarDeltaTotal, 1, "scar total");
  const first = preview.finalRecords[0];
  const expectedKeys = ["finalVersion", "finalKey", "sourceKey", "gateKey", "intentKey", "queueKey", "status", "finalFamily", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "previewOnly", "intentOnly", "gateOnly", "finalOnly", "armed", "applied"];
  assertEqual(Object.keys(first).sort().join(","), expectedKeys.slice().sort().join(","), "final record has exact safe shape");
  assertEqual(first.finalKey, `risk-bid-final-apply:pressure:${first.sourceKey}`, "finalKey deterministic");
  assertEqual(first.finalOnly, true, "finalOnly true"); assertEqual(first.previewOnly, true, "previewOnly preserved"); assertEqual(first.intentOnly, true, "intentOnly preserved"); assertEqual(first.gateOnly, true, "gateOnly preserved"); assertEqual(first.armed, true, "armed preserved");
  assertEqual(preview.byFinalFamily.pressure, 1, "family counts correct"); assertEqual(preview.byResolutionType.hazardEscalation, 1, "resolution counts correct"); assertEqual(preview.byDangerLevel.high, 3, "danger counts correct"); assertEqual(preview.bySeverity.severe, 1, "severity counts correct");

  const stage = prepareTravelV2RiskBidFinalApply(mixedSession, { canReview: true, applyMode: "stage", now: "2026-07-13T00:00:00.000Z" });
  assertSmoke(stage.sessionPatch?.travelV2RiskBidFinalApply, "stage creates safe patch"); assertEqual(stage.staged, true, "stage staged true"); assertEqual(stage.committed, false, "stage committed false"); assertEqual(stage.applied, false, "stage applied false"); assertEqual(stage.session, null, "stage has no cloned session"); assertSmoke(!mixedSession.travelV2RiskBidReviewQueue.records.some((record) => record.applied), "stage does not mark queue applied");

  const commit = prepareTravelV2RiskBidFinalApply(mixedSession, { canReview: true, applyMode: "commit", now: "2026-07-13T00:00:00.000Z" });
  assertSmoke(commit.sessionPatch?.travelV2RiskBidFinalApply, "commit creates safe patch"); assertSmoke(commit.session?.travelV2RiskBidFinalApply, "commit creates cloned session"); assertSmoke(commit.session !== mixedSession, "commit output session is a clone"); assertEqual(commit.staged, true, "commit staged true"); assertEqual(commit.committed, true, "commit committed true"); assertEqual(commit.applied, true, "commit applied true");
  assertSmoke(commit.session.travelV2RiskBidPressureApply, "commit includes pressure category patch"); assertSmoke(commit.session.travelV2RiskBidHazardApply, "commit includes hazard category patch"); assertSmoke(commit.session.travelV2RiskBidConsequenceApply, "commit includes consequence category patch"); assertSmoke(commit.session.travelV2RiskBidBenefitRewardApply, "commit includes positive category patch"); assertSmoke(commit.session.travelV2RiskBidScarApply, "commit includes scar category patch");
  assertEqual(commit.session.travelV2RiskBidReviewQueue.records.filter((record) => record.applied === true).length, 5, "commit marks matching queue records applied only in clone"); assertSmoke(!mixedSession.travelV2RiskBidReviewQueue.records.some((record) => record.applied), "input queue not marked applied"); assertEqual(JSON.stringify(mixedSession), snapshot, "input session is not mutated");
  assertNoForbidden(preview, "preview output"); assertNoForbidden(stage, "stage output"); assertNoForbidden(commit, "commit output");
  return { checked: ["risk-bid-final-apply"] };
}

if (import.meta.url === `file://${process.argv[1]}`) runTravelV2RiskBidFinalApplySmokeChecks().then(() => console.log("Travel v2 risk bid final apply smoke checks passed."));
