import { prepareTravelV2RiskBidReviewApplyGate } from "./travel-v2-risk-bid-review-apply-gate.js";

export const TRAVEL_V2_RISK_BID_HAZARD_APPLY_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const PATCH_SESSION_KEY = "travelV2RiskBidHazardApply";
const VALID_APPLY_MODES = Object.freeze(["preview", "stage", "commit"]);
const HAZARD_RECORD_KEYS = Object.freeze(["hazardVersion", "hazardKey", "gateKey", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "hazardDelta", "hazardKind", "hazardSeverity", "previewOnly", "intentOnly", "gateOnly", "hazardOnly", "armed", "applied"]);
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
function hazardMappingForResolutionType(resolutionType) {
  if (resolutionType === "hazardProgress") return { hazardDelta: 1, hazardSeverity: "standard", hazardKind: "progress" };
  if (resolutionType === "hazardEscalation") return { hazardDelta: 2, hazardSeverity: "severe", hazardKind: "escalation" };
  if (resolutionType === "additionalHazard") return { hazardDelta: 1, hazardSeverity: "additional", hazardKind: "additional" };
  return { hazardDelta: 0, hazardSeverity: "", hazardKind: "" };
}
function countHazardRecords(hazardRecords = []) {
  const byResolutionType = {};
  const byHazardKind = {};
  const byDangerLevel = {};
  const bySeverity = {};
  for (const record of hazardRecords) {
    incrementCount(byResolutionType, record.resolutionType);
    incrementCount(byHazardKind, record.hazardKind);
    incrementCount(byDangerLevel, record.dangerLevel);
    incrementCount(bySeverity, record.severity);
  }
  return freezeOutput({ byResolutionType, byHazardKind, byDangerLevel, bySeverity });
}
function makeHazardRecord(gateRecord, applied) {
  const resolutionType = safeString(gateRecord.resolutionType);
  const mapping = hazardMappingForResolutionType(resolutionType);
  const hazard = {
    hazardVersion: TRAVEL_V2_RISK_BID_HAZARD_APPLY_VERSION,
    hazardKey: `risk-bid-hazard-apply:${safeString(gateRecord.gateKey)}`,
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
    label: safeString(gateRecord.label, "Risk bid hazard") || "Risk bid hazard",
    text: safeString(gateRecord.text, "Hazard plumbing only — no actor or world mutation") || "Hazard plumbing only — no actor or world mutation",
    resolutionType,
    resolutionFamily: "hazard",
    hazardDelta: mapping.hazardDelta,
    hazardKind: mapping.hazardKind,
    hazardSeverity: mapping.hazardSeverity,
    previewOnly: true,
    intentOnly: true,
    gateOnly: true,
    hazardOnly: true,
    armed: true,
    applied
  };
  for (const key of Object.keys(hazard)) if (!HAZARD_RECORD_KEYS.includes(key)) delete hazard[key];
  return freezeOutput(hazard);
}
function makeSessionPatch({ applied, committed, hazardDeltaTotal, hazardRecords, updatedAt }) {
  return freezeOutput({
    [PATCH_SESSION_KEY]: {
      version: TRAVEL_V2_RISK_BID_HAZARD_APPLY_VERSION,
      applied,
      committed,
      hazardDeltaTotal,
      records: hazardRecords,
      updatedAt: safeString(updatedAt) || "1970-01-01T00:00:00.000Z"
    }
  });
}
function shell({ canReview = false, applyMode = "preview", hazardRecords = [], selectedCount = 0, gateRecordCount = 0, sessionPatch = null, session = null, blockedReasons = [], warnings = [], ok = false, available = false, staged = false, committed = false, applied = false } = {}) {
  const counted = countHazardRecords(hazardRecords);
  const hazardDeltaTotal = hazardRecords.reduce((total, record) => total + (Number(record.hazardDelta) || 0), 0);
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_HAZARD_APPLY_VERSION,
    ok,
    available,
    canReview,
    applyMode,
    staged,
    committed,
    hazardReady: hazardRecords.length > 0,
    selectedCount,
    gateRecordCount,
    hazardRecordCount: hazardRecords.length,
    hazardDeltaTotal,
    hazardRecords: freezeOutput(hazardRecords),
    byResolutionType: counted.byResolutionType,
    byHazardKind: counted.byHazardKind,
    byDangerLevel: counted.byDangerLevel,
    bySeverity: counted.bySeverity,
    sessionPatch,
    session,
    blockedReasons: Array.from(new Set(blockedReasons)),
    warnings: Array.from(new Set(warnings)),
    applied
  });
}

export function prepareTravelV2RiskBidHazardApply(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  const hasRequestedMode = Object.hasOwn(options ?? {}, "applyMode");
  const normalizedMode = normalizeApplyMode(options?.applyMode ?? "preview");
  const applyMode = normalizedMode || "preview";
  if (!canReview) return shell({ canReview: false, applyMode, blockedReasons: ["travel-v2-review-permission-required"] });
  if (hasRequestedMode && !normalizedMode) return shell({ canReview: true, applyMode: "preview", blockedReasons: ["invalid-risk-bid-hazard-apply-mode"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return shell({ canReview: true, applyMode, blockedReasons: ["risk-bid-review-queue-not-found"] });

  const gate = prepareTravelV2RiskBidReviewApplyGate(session, { canReview: true, gateMode: "armed", includeDismissed: options?.includeDismissed === true });
  const gateRecords = Array.isArray(gate?.gateRecords) ? gate.gateRecords : [];
  if (!gateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: 0, blockedReasons: ["missing-armed-risk-bid-review-apply-gate-records"], warnings: gate?.warnings ?? [] });
  const hazardGateRecords = gateRecords.filter((record) => record?.armed === true && record?.resolutionFamily === "hazard" && hazardMappingForResolutionType(record?.resolutionType).hazardDelta > 0);
  if (!hazardGateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, blockedReasons: ["missing-risk-bid-hazard-gate-records"], warnings: gate?.warnings ?? [] });

  const applied = applyMode === "commit";
  const hazardRecords = hazardGateRecords.map((record) => makeHazardRecord(record, applied));
  const staged = applyMode === "stage" || applyMode === "commit";
  const committed = applyMode === "commit";
  const hazardDeltaTotal = hazardRecords.reduce((total, record) => total + (Number(record.hazardDelta) || 0), 0);
  const sessionPatch = staged ? makeSessionPatch({ applied, committed, hazardDeltaTotal, hazardRecords, updatedAt: options?.now }) : null;
  const patchedSession = committed ? freezeOutput({ ...clone(session), ...clone(sessionPatch) }) : null;
  return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, hazardRecords, sessionPatch, session: patchedSession, warnings: gate?.warnings ?? [], ok: true, available: true, staged, committed, applied });
}
