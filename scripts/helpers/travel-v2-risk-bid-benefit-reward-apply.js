import { prepareTravelV2RiskBidReviewApplyGate } from "./travel-v2-risk-bid-review-apply-gate.js";

export const TRAVEL_V2_RISK_BID_BENEFIT_REWARD_APPLY_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const PATCH_SESSION_KEY = "travelV2RiskBidBenefitRewardApply";
const VALID_APPLY_MODES = Object.freeze(["preview", "stage", "commit"]);
const POSITIVE_FAMILIES = Object.freeze(["benefit", "momentum", "reward"]);
const POSITIVE_RECORD_KEYS = Object.freeze(["positiveVersion", "positiveKey", "gateKey", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "positiveKind", "positiveDelta", "benefitDelta", "momentumDelta", "rewardDelta", "positiveSeverity", "previewOnly", "intentOnly", "gateOnly", "positiveOnly", "armed", "applied"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze(["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]);

function unsafeOutputString(value) { return typeof value === "string" && FORBIDDEN_OUTPUT_TERMS.some((term) => value.includes(term)); }
function safeString(value, fallback = "") { if (typeof value !== "string") return fallback; const trimmed = value.trim(); return trimmed && !unsafeOutputString(trimmed) ? trimmed : fallback; }
function clone(value) { if (value === undefined) return undefined; return JSON.parse(JSON.stringify(value)); }
function freezeOutput(value) { if (Array.isArray(value)) for (const entry of value) freezeOutput(entry); else if (value && typeof value === "object") for (const entry of Object.values(value)) freezeOutput(entry); return Object.freeze(value); }
function incrementCount(counts, key) { const safeKey = safeString(key) || "unknown"; counts[safeKey] = (Number(counts[safeKey]) || 0) + 1; }
function normalizeApplyMode(value) { const safeMode = safeString(value); return VALID_APPLY_MODES.includes(safeMode) ? safeMode : ""; }
function positiveMappingForResolutionType(resolutionType) {
  if (resolutionType === "benefit") return { positiveKind: "benefit", positiveDelta: 1, benefitDelta: 1, momentumDelta: 0, rewardDelta: 0, positiveSeverity: "standard" };
  if (resolutionType === "progress") return { positiveKind: "progress", positiveDelta: 1, benefitDelta: 1, momentumDelta: 0, rewardDelta: 0, positiveSeverity: "standard" };
  if (resolutionType === "momentum") return { positiveKind: "momentum", positiveDelta: 1, benefitDelta: 0, momentumDelta: 1, rewardDelta: 0, positiveSeverity: "standard" };
  if (resolutionType === "reward") return { positiveKind: "reward", positiveDelta: 1, benefitDelta: 0, momentumDelta: 0, rewardDelta: 1, positiveSeverity: "standard" };
  return { positiveKind: "", positiveDelta: 0, benefitDelta: 0, momentumDelta: 0, rewardDelta: 0, positiveSeverity: "" };
}
function countPositiveRecords(positiveRecords = []) {
  const byResolutionFamily = {}; const byResolutionType = {}; const byPositiveKind = {}; const byDangerLevel = {}; const bySeverity = {};
  for (const record of positiveRecords) { incrementCount(byResolutionFamily, record.resolutionFamily); incrementCount(byResolutionType, record.resolutionType); incrementCount(byPositiveKind, record.positiveKind); incrementCount(byDangerLevel, record.dangerLevel); incrementCount(bySeverity, record.severity); }
  return freezeOutput({ byResolutionFamily, byResolutionType, byPositiveKind, byDangerLevel, bySeverity });
}
function makePositiveRecord(gateRecord, applied) {
  const resolutionType = safeString(gateRecord.resolutionType);
  const mapping = positiveMappingForResolutionType(resolutionType);
  const positive = {
    positiveVersion: TRAVEL_V2_RISK_BID_BENEFIT_REWARD_APPLY_VERSION,
    positiveKey: `risk-bid-benefit-reward-apply:${safeString(gateRecord.gateKey)}`,
    gateKey: safeString(gateRecord.gateKey), intentKey: safeString(gateRecord.intentKey), queueKey: safeString(gateRecord.queueKey),
    status: safeString(gateRecord.status) || "pending", payloadType: safeString(gateRecord.payloadType), candidateType: safeString(gateRecord.candidateType),
    severity: safeString(gateRecord.severity) || "standard", tier: gateRecord.tier ?? null, resultBand: safeString(gateRecord.resultBand) || null,
    dangerLevel: safeString(gateRecord.dangerLevel) || "none", stationKey: safeString(gateRecord.stationKey), stationName: safeString(gateRecord.stationName),
    actionId: safeString(gateRecord.actionId), actionName: safeString(gateRecord.actionName), roundIndex: gateRecord.roundIndex ?? null, roundNumber: gateRecord.roundNumber ?? null,
    label: safeString(gateRecord.label, "Risk bid positive outcome") || "Risk bid positive outcome", text: safeString(gateRecord.text, "Benefit, Momentum, and reward plumbing only — no actor or world mutation") || "Benefit, Momentum, and reward plumbing only — no actor or world mutation",
    resolutionType, resolutionFamily: safeString(gateRecord.resolutionFamily) || "benefit", positiveKind: mapping.positiveKind, positiveDelta: mapping.positiveDelta, benefitDelta: mapping.benefitDelta, momentumDelta: mapping.momentumDelta, rewardDelta: mapping.rewardDelta, positiveSeverity: mapping.positiveSeverity,
    previewOnly: true, intentOnly: true, gateOnly: true, positiveOnly: true, armed: true, applied
  };
  for (const key of Object.keys(positive)) if (!POSITIVE_RECORD_KEYS.includes(key)) delete positive[key];
  return freezeOutput(positive);
}
function totals(records) { return { positiveDeltaTotal: records.reduce((t, r) => t + (Number(r.positiveDelta) || 0), 0), benefitDeltaTotal: records.reduce((t, r) => t + (Number(r.benefitDelta) || 0), 0), momentumDeltaTotal: records.reduce((t, r) => t + (Number(r.momentumDelta) || 0), 0), rewardDeltaTotal: records.reduce((t, r) => t + (Number(r.rewardDelta) || 0), 0) }; }
function makeSessionPatch({ applied, committed, positiveRecords, updatedAt }) { const t = totals(positiveRecords); return freezeOutput({ [PATCH_SESSION_KEY]: { version: TRAVEL_V2_RISK_BID_BENEFIT_REWARD_APPLY_VERSION, applied, committed, ...t, records: positiveRecords, updatedAt: safeString(updatedAt) || "1970-01-01T00:00:00.000Z" } }); }
function shell({ canReview = false, applyMode = "preview", positiveRecords = [], selectedCount = 0, gateRecordCount = 0, sessionPatch = null, session = null, blockedReasons = [], warnings = [], ok = false, available = false, staged = false, committed = false, applied = false } = {}) {
  const counted = countPositiveRecords(positiveRecords); const t = totals(positiveRecords);
  return freezeOutput({ version: TRAVEL_V2_RISK_BID_BENEFIT_REWARD_APPLY_VERSION, ok, available, canReview, applyMode, staged, committed, positiveReady: positiveRecords.length > 0, selectedCount, gateRecordCount, positiveRecordCount: positiveRecords.length, ...t, positiveRecords: freezeOutput(positiveRecords), byResolutionFamily: counted.byResolutionFamily, byResolutionType: counted.byResolutionType, byPositiveKind: counted.byPositiveKind, byDangerLevel: counted.byDangerLevel, bySeverity: counted.bySeverity, sessionPatch, session, blockedReasons: Array.from(new Set(blockedReasons)), warnings: Array.from(new Set(warnings)), applied });
}

export function prepareTravelV2RiskBidBenefitRewardApply(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  const hasRequestedMode = Object.hasOwn(options ?? {}, "applyMode");
  const normalizedMode = normalizeApplyMode(options?.applyMode ?? "preview");
  const applyMode = normalizedMode || "preview";
  if (!canReview) return shell({ canReview: false, applyMode, blockedReasons: ["travel-v2-review-permission-required"] });
  if (hasRequestedMode && !normalizedMode) return shell({ canReview: true, applyMode: "preview", blockedReasons: ["invalid-risk-bid-benefit-reward-apply-mode"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return shell({ canReview: true, applyMode, blockedReasons: ["risk-bid-review-queue-not-found"] });

  const gate = prepareTravelV2RiskBidReviewApplyGate(session, { canReview: true, gateMode: "armed", includeDismissed: options?.includeDismissed === true });
  const gateRecords = Array.isArray(gate?.gateRecords) ? gate.gateRecords : [];
  if (!gateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: 0, blockedReasons: ["missing-armed-risk-bid-review-apply-gate-records"], warnings: gate?.warnings ?? [] });
  const positiveGateRecords = gateRecords.filter((record) => record?.armed === true && POSITIVE_FAMILIES.includes(record?.resolutionFamily) && positiveMappingForResolutionType(record?.resolutionType).positiveDelta > 0);
  if (!positiveGateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, blockedReasons: ["missing-risk-bid-benefit-reward-gate-records"], warnings: gate?.warnings ?? [] });

  const applied = applyMode === "commit";
  const positiveRecords = positiveGateRecords.map((record) => makePositiveRecord(record, applied));
  const staged = applyMode === "stage" || applyMode === "commit";
  const committed = applyMode === "commit";
  const sessionPatch = staged ? makeSessionPatch({ applied, committed, positiveRecords, updatedAt: options?.now }) : null;
  const patchedSession = committed ? freezeOutput({ ...clone(session), ...clone(sessionPatch) }) : null;
  return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, positiveRecords, sessionPatch, session: patchedSession, warnings: gate?.warnings ?? [], ok: true, available: true, staged, committed, applied });
}
