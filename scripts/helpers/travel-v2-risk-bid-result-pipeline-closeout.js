import { prepareTravelV2RiskBidSelectedReviewPreview } from "./travel-v2-risk-bid-review-preview.js";
import { prepareTravelV2RiskBidReviewApplyIntent } from "./travel-v2-risk-bid-review-apply-intent.js";
import { prepareTravelV2RiskBidReviewApplyGate } from "./travel-v2-risk-bid-review-apply-gate.js";
import { prepareTravelV2RiskBidPressureApply } from "./travel-v2-risk-bid-pressure-apply.js";
import { prepareTravelV2RiskBidHazardApply } from "./travel-v2-risk-bid-hazard-apply.js";
import { prepareTravelV2RiskBidConsequenceApply } from "./travel-v2-risk-bid-consequence-apply.js";
import { prepareTravelV2RiskBidBenefitRewardApply } from "./travel-v2-risk-bid-benefit-reward-apply.js";
import { prepareTravelV2RiskBidScarApply } from "./travel-v2-risk-bid-scar-apply.js";
import { prepareTravelV2RiskBidFinalApply } from "./travel-v2-risk-bid-final-apply.js";

export const TRAVEL_V2_RISK_BID_RESULT_PIPELINE_CLOSEOUT_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const FORBIDDEN_OUTPUT_TERMS = Object.freeze(["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]);

function unsafeOutputString(value) { return typeof value === "string" && FORBIDDEN_OUTPUT_TERMS.some((term) => value.includes(term)); }
function safeString(value, fallback = "") { if (typeof value !== "string") return fallback; const trimmed = value.trim(); return trimmed && !unsafeOutputString(trimmed) ? trimmed : fallback; }
function freezeOutput(value) { if (Array.isArray(value)) for (const entry of value) freezeOutput(entry); else if (value && typeof value === "object") for (const entry of Object.values(value)) freezeOutput(entry); return Object.freeze(value); }
function cleanReasons(values = []) { return Array.from(new Set(values.map((value) => safeString(value)).filter(Boolean))); }
function emptyCounts() { return freezeOutput({}); }

function shell({ canReview = false, selectedReviewPreview = null, applyIntent = null, applyGate = null, finalApply = null, blockedReasons = [], warnings = [], ok = false, available = false } = {}) {
  const selectedCount = Number(finalApply?.selectedCount ?? applyGate?.selectedCount ?? applyIntent?.selectedCount ?? selectedReviewPreview?.selectedCount) || 0;
  const gateRecordCount = Number(finalApply?.gateRecordCount ?? applyGate?.gateRecordCount) || 0;
  const finalRecordCount = Number(finalApply?.finalRecordCount) || 0;
  const pressureRecordCount = Number(finalApply?.pressureRecordCount) || 0;
  const hazardRecordCount = Number(finalApply?.hazardRecordCount) || 0;
  const consequenceRecordCount = Number(finalApply?.consequenceRecordCount) || 0;
  const positiveRecordCount = Number(finalApply?.positiveRecordCount) || 0;
  const scarRecordCount = Number(finalApply?.scarRecordCount) || 0;
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_RESULT_PIPELINE_CLOSEOUT_VERSION,
    ok,
    available,
    canReview,
    closeoutReady: finalRecordCount > 0,
    selectedCount,
    gateRecordCount,
    finalRecordCount,
    pressureRecordCount,
    hazardRecordCount,
    consequenceRecordCount,
    positiveRecordCount,
    scarRecordCount,
    hasSelectedReview: Number(selectedReviewPreview?.previewRecords?.length) > 0,
    hasApplyIntent: Number(applyIntent?.intentRecords?.length) > 0,
    hasApplyGate: Number(applyGate?.gateRecords?.length) > 0,
    hasPressure: pressureRecordCount > 0,
    hasHazard: hazardRecordCount > 0,
    hasConsequence: consequenceRecordCount > 0,
    hasPositive: positiveRecordCount > 0,
    hasScar: scarRecordCount > 0,
    hasFinalApply: finalRecordCount > 0,
    selectedReviewPreview,
    applyIntent,
    applyGate,
    finalApply,
    byFinalFamily: finalApply?.byFinalFamily ?? emptyCounts(),
    byResolutionType: finalApply?.byResolutionType ?? emptyCounts(),
    byDangerLevel: finalApply?.byDangerLevel ?? emptyCounts(),
    bySeverity: finalApply?.bySeverity ?? emptyCounts(),
    blockedReasons: cleanReasons(blockedReasons),
    warnings: cleanReasons(warnings),
    applied: false
  });
}

export function prepareTravelV2RiskBidResultPipelineCloseout(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  if (!canReview) return shell({ canReview: false, blockedReasons: ["travel-v2-review-permission-required"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return shell({ canReview: true, blockedReasons: ["risk-bid-review-queue-not-found"] });

  const helperOptions = { canReview: true, includeDismissed: options?.includeDismissed === true, now: options?.now };
  const selectedReviewPreview = prepareTravelV2RiskBidSelectedReviewPreview(session, helperOptions);
  const applyIntent = prepareTravelV2RiskBidReviewApplyIntent(session, { ...helperOptions, intentMode: "prepare" });
  const applyGate = prepareTravelV2RiskBidReviewApplyGate(session, { ...helperOptions, gateMode: "preview" });
  prepareTravelV2RiskBidPressureApply(session, { ...helperOptions, applyMode: "preview" });
  prepareTravelV2RiskBidHazardApply(session, { ...helperOptions, applyMode: "preview" });
  prepareTravelV2RiskBidConsequenceApply(session, { ...helperOptions, applyMode: "preview" });
  prepareTravelV2RiskBidBenefitRewardApply(session, { ...helperOptions, applyMode: "preview" });
  prepareTravelV2RiskBidScarApply(session, { ...helperOptions, applyMode: "preview" });
  const finalApply = prepareTravelV2RiskBidFinalApply(session, { ...helperOptions, applyMode: "preview" });
  const blockedReasons = [...(selectedReviewPreview.blockedReasons ?? []), ...(applyIntent.blockedReasons ?? []), ...(applyGate.blockedReasons ?? []), ...(finalApply.blockedReasons ?? [])];
  const warnings = [...(selectedReviewPreview.warnings ?? []), ...(applyIntent.warnings ?? []), ...(applyGate.warnings ?? []), ...(finalApply.warnings ?? [])];
  if (!finalApply.finalRecordCount) blockedReasons.push("missing-risk-bid-final-apply-records");
  return shell({ canReview: true, selectedReviewPreview, applyIntent, applyGate, finalApply, blockedReasons, warnings, ok: finalApply.finalRecordCount > 0, available: true });
}
