import { prepareTravelV2RiskBidReviewApplyGate } from "./travel-v2-risk-bid-review-apply-gate.js";

export const TRAVEL_V2_RISK_BID_CONSEQUENCE_APPLY_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const PATCH_SESSION_KEY = "travelV2RiskBidConsequenceApply";
const VALID_APPLY_MODES = Object.freeze(["preview", "stage", "commit"]);
const CONSEQUENCE_RECORD_KEYS = Object.freeze(["consequenceVersion", "consequenceKey", "gateKey", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "consequenceDelta", "consequenceKind", "consequenceSeverity", "previewOnly", "intentOnly", "gateOnly", "consequenceOnly", "armed", "applied"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze(["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]);

function unsafeOutputString(value) {
  if (typeof value !== "string") return false;
  return FORBIDDEN_OUTPUT_TERMS.some((term) => value.includes(term));
}
function safeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || unsafeOutputString(trimmed)) return fallback;
  return trimmed;
}
function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
function freezeOutput(value) {
  if (Array.isArray(value)) for (const entry of value) freezeOutput(entry);
  else if (value && typeof value === "object") for (const entry of Object.values(value)) freezeOutput(entry);
  return Object.freeze(value);
}
function incrementCount(counts, key) {
  const safeKey = safeString(key) || "unknown";
  counts[safeKey] = (Number(counts[safeKey]) || 0) + 1;
}
function normalizeApplyMode(value) {
  const safeMode = safeString(value);
  return VALID_APPLY_MODES.includes(safeMode) ? safeMode : "";
}
function consequenceMappingForResolutionType(resolutionType) {
  if (resolutionType === "consequence") return { consequenceDelta: 1, consequenceSeverity: "standard", consequenceKind: "standard" };
  if (resolutionType === "stationComplication") return { consequenceDelta: 1, consequenceSeverity: "standard", consequenceKind: "stationComplication" };
  if (resolutionType === "nextRoundDifficulty") return { consequenceDelta: 1, consequenceSeverity: "standard", consequenceKind: "nextRoundDifficulty" };
  return { consequenceDelta: 0, consequenceSeverity: "", consequenceKind: "" };
}
function countConsequenceRecords(consequenceRecords = []) {
  const byResolutionType = {};
  const byConsequenceKind = {};
  const byDangerLevel = {};
  const bySeverity = {};
  for (const record of consequenceRecords) {
    incrementCount(byResolutionType, record.resolutionType);
    incrementCount(byConsequenceKind, record.consequenceKind);
    incrementCount(byDangerLevel, record.dangerLevel);
    incrementCount(bySeverity, record.severity);
  }
  return freezeOutput({ byResolutionType, byConsequenceKind, byDangerLevel, bySeverity });
}
function makeConsequenceRecord(gateRecord, applied) {
  const resolutionType = safeString(gateRecord.resolutionType);
  const mapping = consequenceMappingForResolutionType(resolutionType);
  const consequence = {
    consequenceVersion: TRAVEL_V2_RISK_BID_CONSEQUENCE_APPLY_VERSION,
    consequenceKey: `risk-bid-consequence-apply:${safeString(gateRecord.gateKey)}`,
    gateKey: safeString(gateRecord.gateKey),
    intentKey: safeString(gateRecord.intentKey),
    queueKey: safeString(gateRecord.queueKey),
    status: safeString(gateRecord.status) || "pending",
    payloadType: safeString(gateRecord.payloadType),
    candidateType: safeString(gateRecord.candidateType),
    severity: safeString(gateRecord.severity) || "standard",
    tier: gateRecord.tier ?? null,
    resultBand: safeString(gateRecord.resultBand) || null,
    dangerLevel: safeString(gateRecord.dangerLevel) || "none",
    stationKey: safeString(gateRecord.stationKey),
    stationName: safeString(gateRecord.stationName),
    actionId: safeString(gateRecord.actionId),
    actionName: safeString(gateRecord.actionName),
    roundIndex: gateRecord.roundIndex ?? null,
    roundNumber: gateRecord.roundNumber ?? null,
    label: safeString(gateRecord.label, "Risk bid consequence") || "Risk bid consequence",
    text: safeString(gateRecord.text, "Consequence plumbing only — no actor or world mutation") || "Consequence plumbing only — no actor or world mutation",
    resolutionType,
    resolutionFamily: "consequence",
    consequenceDelta: mapping.consequenceDelta,
    consequenceKind: mapping.consequenceKind,
    consequenceSeverity: mapping.consequenceSeverity,
    previewOnly: true,
    intentOnly: true,
    gateOnly: true,
    consequenceOnly: true,
    armed: true,
    applied
  };
  for (const key of Object.keys(consequence)) if (!CONSEQUENCE_RECORD_KEYS.includes(key)) delete consequence[key];
  return freezeOutput(consequence);
}
function makeSessionPatch({ applied, committed, consequenceDeltaTotal, consequenceRecords, updatedAt }) {
  return freezeOutput({
    [PATCH_SESSION_KEY]: {
      version: TRAVEL_V2_RISK_BID_CONSEQUENCE_APPLY_VERSION,
      applied,
      committed,
      consequenceDeltaTotal,
      records: consequenceRecords,
      updatedAt: safeString(updatedAt) || "1970-01-01T00:00:00.000Z"
    }
  });
}
function shell({ canReview = false, applyMode = "preview", consequenceRecords = [], selectedCount = 0, gateRecordCount = 0, sessionPatch = null, session = null, blockedReasons = [], warnings = [], ok = false, available = false, staged = false, committed = false, applied = false } = {}) {
  const counted = countConsequenceRecords(consequenceRecords);
  const consequenceDeltaTotal = consequenceRecords.reduce((total, record) => total + (Number(record.consequenceDelta) || 0), 0);
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_CONSEQUENCE_APPLY_VERSION,
    ok,
    available,
    canReview,
    applyMode,
    staged,
    committed,
    consequenceReady: consequenceRecords.length > 0,
    selectedCount,
    gateRecordCount,
    consequenceRecordCount: consequenceRecords.length,
    consequenceDeltaTotal,
    consequenceRecords: freezeOutput(consequenceRecords),
    byResolutionType: counted.byResolutionType,
    byConsequenceKind: counted.byConsequenceKind,
    byDangerLevel: counted.byDangerLevel,
    bySeverity: counted.bySeverity,
    sessionPatch,
    session,
    blockedReasons: Array.from(new Set(blockedReasons)),
    warnings: Array.from(new Set(warnings)),
    applied
  });
}

export function prepareTravelV2RiskBidConsequenceApply(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  const hasRequestedMode = Object.hasOwn(options ?? {}, "applyMode");
  const normalizedMode = normalizeApplyMode(options?.applyMode ?? "preview");
  const applyMode = normalizedMode || "preview";
  if (!canReview) return shell({ canReview: false, applyMode, blockedReasons: ["travel-v2-review-permission-required"] });
  if (hasRequestedMode && !normalizedMode) return shell({ canReview: true, applyMode: "preview", blockedReasons: ["invalid-risk-bid-consequence-apply-mode"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return shell({ canReview: true, applyMode, blockedReasons: ["risk-bid-review-queue-not-found"] });

  const gate = prepareTravelV2RiskBidReviewApplyGate(session, { canReview: true, gateMode: "armed", includeDismissed: options?.includeDismissed === true });
  const gateRecords = Array.isArray(gate?.gateRecords) ? gate.gateRecords : [];
  if (!gateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: 0, blockedReasons: ["missing-armed-risk-bid-review-apply-gate-records"], warnings: gate?.warnings ?? [] });
  const consequenceGateRecords = gateRecords.filter((record) => record?.armed === true && record?.resolutionFamily === "consequence" && consequenceMappingForResolutionType(record?.resolutionType).consequenceDelta > 0);
  if (!consequenceGateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, blockedReasons: ["missing-risk-bid-consequence-gate-records"], warnings: gate?.warnings ?? [] });

  const applied = applyMode === "commit";
  const consequenceRecords = consequenceGateRecords.map((record) => makeConsequenceRecord(record, applied));
  const staged = applyMode === "stage" || applyMode === "commit";
  const committed = applyMode === "commit";
  const consequenceDeltaTotal = consequenceRecords.reduce((total, record) => total + (Number(record.consequenceDelta) || 0), 0);
  const sessionPatch = staged ? makeSessionPatch({ applied, committed, consequenceDeltaTotal, consequenceRecords, updatedAt: options?.now }) : null;
  const patchedSession = committed ? freezeOutput({ ...clone(session), ...clone(sessionPatch) }) : null;
  return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, consequenceRecords, sessionPatch, session: patchedSession, warnings: gate?.warnings ?? [], ok: true, available: true, staged, committed, applied });
}
