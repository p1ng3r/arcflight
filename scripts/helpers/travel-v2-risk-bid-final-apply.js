import { prepareTravelV2RiskBidPressureApply } from "./travel-v2-risk-bid-pressure-apply.js";
import { prepareTravelV2RiskBidHazardApply } from "./travel-v2-risk-bid-hazard-apply.js";
import { prepareTravelV2RiskBidConsequenceApply } from "./travel-v2-risk-bid-consequence-apply.js";
import { prepareTravelV2RiskBidBenefitRewardApply } from "./travel-v2-risk-bid-benefit-reward-apply.js";
import { prepareTravelV2RiskBidScarApply } from "./travel-v2-risk-bid-scar-apply.js";

export const TRAVEL_V2_RISK_BID_FINAL_APPLY_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const PATCH_SESSION_KEY = "travelV2RiskBidFinalApply";
const VALID_APPLY_MODES = Object.freeze(["preview", "stage", "commit"]);
const FINAL_RECORD_KEYS = Object.freeze(["finalVersion", "finalKey", "sourceKey", "gateKey", "intentKey", "queueKey", "status", "finalFamily", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "previewOnly", "intentOnly", "gateOnly", "finalOnly", "armed", "applied"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze(["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]);

function unsafeOutputString(value) { return typeof value === "string" && FORBIDDEN_OUTPUT_TERMS.some((term) => value.includes(term)); }
function safeString(value, fallback = "") { if (typeof value !== "string") return fallback; const trimmed = value.trim(); return trimmed && !unsafeOutputString(trimmed) ? trimmed : fallback; }
function clone(value) { if (value === undefined) return undefined; return JSON.parse(JSON.stringify(value)); }
function freezeOutput(value) { if (Array.isArray(value)) for (const entry of value) freezeOutput(entry); else if (value && typeof value === "object") for (const entry of Object.values(value)) freezeOutput(entry); return Object.freeze(value); }
function normalizeApplyMode(value) { const safeMode = safeString(value); return VALID_APPLY_MODES.includes(safeMode) ? safeMode : ""; }
function incrementCount(counts, key) { const safeKey = safeString(key) || "unknown"; counts[safeKey] = (Number(counts[safeKey]) || 0) + 1; }
function sum(records, key) { return records.reduce((total, record) => total + (Number(record?.[key]) || 0), 0); }

function normalizeFinalRecord(record, finalFamily, sourceKeyName, applied) {
  const sourceKey = safeString(record?.[sourceKeyName]);
  const final = {
    finalVersion: TRAVEL_V2_RISK_BID_FINAL_APPLY_VERSION,
    finalKey: `risk-bid-final-apply:${finalFamily}:${sourceKey}`,
    sourceKey,
    gateKey: safeString(record?.gateKey),
    intentKey: safeString(record?.intentKey),
    queueKey: safeString(record?.queueKey),
    status: safeString(record?.status) || "pending",
    finalFamily,
    payloadType: safeString(record?.payloadType),
    candidateType: safeString(record?.candidateType),
    severity: safeString(record?.severity) || "standard",
    tier: record?.tier ?? null,
    resultBand: safeString(record?.resultBand) || null,
    dangerLevel: safeString(record?.dangerLevel) || "none",
    stationKey: safeString(record?.stationKey),
    stationName: safeString(record?.stationName),
    actionId: safeString(record?.actionId),
    actionName: safeString(record?.actionName),
    roundIndex: record?.roundIndex ?? null,
    roundNumber: record?.roundNumber ?? null,
    label: safeString(record?.label, "Risk bid final apply") || "Risk bid final apply",
    text: safeString(record?.text, "Final apply preview only — no actor or world mutation") || "Final apply preview only — no actor or world mutation",
    resolutionType: safeString(record?.resolutionType),
    resolutionFamily: safeString(record?.resolutionFamily),
    previewOnly: true,
    intentOnly: true,
    gateOnly: true,
    finalOnly: true,
    armed: true,
    applied
  };
  for (const key of Object.keys(final)) if (!FINAL_RECORD_KEYS.includes(key)) delete final[key];
  return freezeOutput(final);
}

function countFinalRecords(finalRecords = []) {
  const byFinalFamily = {}; const byResolutionType = {}; const byDangerLevel = {}; const bySeverity = {};
  for (const record of finalRecords) { incrementCount(byFinalFamily, record.finalFamily); incrementCount(byResolutionType, record.resolutionType); incrementCount(byDangerLevel, record.dangerLevel); incrementCount(bySeverity, record.severity); }
  return freezeOutput({ byFinalFamily, byResolutionType, byDangerLevel, bySeverity });
}

function totals(input = {}) {
  const pressureApply = input.pressureApply ?? {};
  const hazardApply = input.hazardApply ?? {};
  const consequenceApply = input.consequenceApply ?? {};
  const benefitRewardApply = input.benefitRewardApply ?? {};
  const scarApply = input.scarApply ?? {};
  return {
    pressureDeltaTotal: Number(pressureApply.pressureDeltaTotal) || 0,
    hazardDeltaTotal: Number(hazardApply.hazardDeltaTotal) || 0,
    consequenceDeltaTotal: Number(consequenceApply.consequenceDeltaTotal) || 0,
    positiveDeltaTotal: Number(benefitRewardApply.positiveDeltaTotal) || 0,
    benefitDeltaTotal: Number(benefitRewardApply.benefitDeltaTotal) || 0,
    momentumDeltaTotal: Number(benefitRewardApply.momentumDeltaTotal) || 0,
    rewardDeltaTotal: Number(benefitRewardApply.rewardDeltaTotal) || 0,
    scarDeltaTotal: Number(scarApply.scarDeltaTotal) || 0
  };
}

function makeSessionPatch({ applied, committed, finalRecords, counts, deltaTotals, updatedAt }) {
  return freezeOutput({ [PATCH_SESSION_KEY]: { version: TRAVEL_V2_RISK_BID_FINAL_APPLY_VERSION, applied, committed, finalRecordCount: finalRecords.length, ...counts, ...deltaTotals, records: finalRecords, updatedAt: safeString(updatedAt) || "1970-01-01T00:00:00.000Z" } });
}

function shell({ canReview = false, applyMode = "preview", finalRecords = [], selectedCount = 0, gateRecordCount = 0, pressureApply = null, hazardApply = null, consequenceApply = null, benefitRewardApply = null, scarApply = null, sessionPatch = null, session = null, blockedReasons = [], warnings = [], ok = false, available = false, staged = false, committed = false, applied = false } = {}) {
  const pressureRecordCount = Number(pressureApply?.pressureRecordCount) || 0;
  const hazardRecordCount = Number(hazardApply?.hazardRecordCount) || 0;
  const consequenceRecordCount = Number(consequenceApply?.consequenceRecordCount) || 0;
  const positiveRecordCount = Number(benefitRewardApply?.positiveRecordCount) || 0;
  const scarRecordCount = Number(scarApply?.scarRecordCount) || 0;
  const counted = countFinalRecords(finalRecords);
  const deltaTotals = totals({ pressureApply, hazardApply, consequenceApply, benefitRewardApply, scarApply });
  return freezeOutput({ version: TRAVEL_V2_RISK_BID_FINAL_APPLY_VERSION, ok, available, canReview, applyMode, staged, committed, finalReady: finalRecords.length > 0, selectedCount, gateRecordCount, finalRecordCount: finalRecords.length, pressureRecordCount, hazardRecordCount, consequenceRecordCount, positiveRecordCount, scarRecordCount, ...deltaTotals, finalRecords: freezeOutput(finalRecords), pressureApply, hazardApply, consequenceApply, benefitRewardApply, scarApply, byFinalFamily: counted.byFinalFamily, byResolutionType: counted.byResolutionType, byDangerLevel: counted.byDangerLevel, bySeverity: counted.bySeverity, sessionPatch, session, blockedReasons: Array.from(new Set(blockedReasons)), warnings: Array.from(new Set(warnings)), applied });
}

export function prepareTravelV2RiskBidFinalApply(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  const hasRequestedMode = Object.hasOwn(options ?? {}, "applyMode");
  const normalizedMode = normalizeApplyMode(options?.applyMode ?? "preview");
  const applyMode = normalizedMode || "preview";
  if (!canReview) return shell({ canReview: false, applyMode, blockedReasons: ["travel-v2-review-permission-required"] });
  if (hasRequestedMode && !normalizedMode) return shell({ canReview: true, applyMode: "preview", blockedReasons: ["invalid-risk-bid-final-apply-mode"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return shell({ canReview: true, applyMode, blockedReasons: ["risk-bid-review-queue-not-found"] });

  const helperOptions = { canReview: true, applyMode, includeDismissed: options?.includeDismissed === true, now: options?.now };
  const pressureApply = prepareTravelV2RiskBidPressureApply(session, helperOptions);
  const hazardApply = prepareTravelV2RiskBidHazardApply(session, helperOptions);
  const consequenceApply = prepareTravelV2RiskBidConsequenceApply(session, helperOptions);
  const benefitRewardApply = prepareTravelV2RiskBidBenefitRewardApply(session, helperOptions);
  const scarApply = prepareTravelV2RiskBidScarApply(session, helperOptions);
  const applied = applyMode === "commit";
  const finalRecords = [
    ...(pressureApply.pressureRecords ?? []).map((record) => normalizeFinalRecord(record, "pressure", "pressureKey", applied)),
    ...(hazardApply.hazardRecords ?? []).map((record) => normalizeFinalRecord(record, "hazard", "hazardKey", applied)),
    ...(consequenceApply.consequenceRecords ?? []).map((record) => normalizeFinalRecord(record, "consequence", "consequenceKey", applied)),
    ...(benefitRewardApply.positiveRecords ?? []).map((record) => normalizeFinalRecord(record, "positive", "positiveKey", applied)),
    ...(scarApply.scarRecords ?? []).map((record) => normalizeFinalRecord(record, "scar", "scarKey", applied))
  ];
  const warnings = [...(pressureApply.warnings ?? []), ...(hazardApply.warnings ?? []), ...(consequenceApply.warnings ?? []), ...(benefitRewardApply.warnings ?? []), ...(scarApply.warnings ?? [])].filter((warning) => safeString(warning));
  const selectedCount = Math.max(Number(pressureApply.selectedCount) || 0, Number(hazardApply.selectedCount) || 0, Number(consequenceApply.selectedCount) || 0, Number(benefitRewardApply.selectedCount) || 0, Number(scarApply.selectedCount) || 0);
  const gateRecordCount = Math.max(Number(pressureApply.gateRecordCount) || 0, Number(hazardApply.gateRecordCount) || 0, Number(consequenceApply.gateRecordCount) || 0, Number(benefitRewardApply.gateRecordCount) || 0, Number(scarApply.gateRecordCount) || 0);
  if (!finalRecords.length) return shell({ canReview: true, applyMode, selectedCount, gateRecordCount, pressureApply, hazardApply, consequenceApply, benefitRewardApply, scarApply, blockedReasons: ["missing-risk-bid-final-apply-records"], warnings });

  const staged = applyMode === "stage" || applyMode === "commit";
  const committed = applyMode === "commit";
  const counts = { pressureRecordCount: Number(pressureApply.pressureRecordCount) || 0, hazardRecordCount: Number(hazardApply.hazardRecordCount) || 0, consequenceRecordCount: Number(consequenceApply.consequenceRecordCount) || 0, positiveRecordCount: Number(benefitRewardApply.positiveRecordCount) || 0, scarRecordCount: Number(scarApply.scarRecordCount) || 0 };
  const deltaTotals = totals({ pressureApply, hazardApply, consequenceApply, benefitRewardApply, scarApply });
  const sessionPatch = staged ? makeSessionPatch({ applied, committed, finalRecords, counts, deltaTotals, updatedAt: options?.now }) : null;
  let patchedSession = null;
  if (committed) {
    const queueKeys = new Set(finalRecords.map((record) => record.queueKey).filter(Boolean));
    patchedSession = { ...clone(session), ...(clone(pressureApply.sessionPatch) ?? {}), ...(clone(hazardApply.sessionPatch) ?? {}), ...(clone(consequenceApply.sessionPatch) ?? {}), ...(clone(benefitRewardApply.sessionPatch) ?? {}), ...(clone(scarApply.sessionPatch) ?? {}), ...clone(sessionPatch) };
    if (Array.isArray(patchedSession?.[QUEUE_SESSION_KEY]?.records)) {
      patchedSession[QUEUE_SESSION_KEY] = { ...patchedSession[QUEUE_SESSION_KEY], records: patchedSession[QUEUE_SESSION_KEY].records.map((record) => queueKeys.has(record?.queueKey) ? { ...record, status: "applied", applied: true, appliedAt: sessionPatch[PATCH_SESSION_KEY].updatedAt } : record) };
    }
    patchedSession = freezeOutput(patchedSession);
  }
  return shell({ canReview: true, applyMode, selectedCount, gateRecordCount, finalRecords, pressureApply, hazardApply, consequenceApply, benefitRewardApply, scarApply, sessionPatch, session: patchedSession, warnings, ok: true, available: true, staged, committed, applied });
}
