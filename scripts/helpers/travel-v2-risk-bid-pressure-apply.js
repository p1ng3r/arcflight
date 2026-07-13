import { prepareTravelV2RiskBidReviewApplyGate } from "./travel-v2-risk-bid-review-apply-gate.js";

export const TRAVEL_V2_RISK_BID_PRESSURE_APPLY_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const PATCH_SESSION_KEY = "travelV2RiskBidPressureApply";
const VALID_APPLY_MODES = Object.freeze(["preview", "stage", "commit"]);
const PRESSURE_RECORD_KEYS = Object.freeze(["pressureVersion", "pressureKey", "gateKey", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "pressureDelta", "pressureSeverity", "previewOnly", "intentOnly", "gateOnly", "pressureOnly", "armed", "applied"]);
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
function pressureDeltaForResolutionType(resolutionType) {
  if (resolutionType === "pressure") return 1;
  if (resolutionType === "severePressure") return 2;
  return 0;
}
function countPressureRecords(pressureRecords = []) {
  const byResolutionType = {};
  const byDangerLevel = {};
  const bySeverity = {};
  for (const record of pressureRecords) {
    incrementCount(byResolutionType, record.resolutionType);
    incrementCount(byDangerLevel, record.dangerLevel);
    incrementCount(bySeverity, record.severity);
  }
  return freezeOutput({ byResolutionType, byDangerLevel, bySeverity });
}
function makePressureRecord(gateRecord, applied) {
  const resolutionType = safeString(gateRecord.resolutionType);
  const pressureDelta = pressureDeltaForResolutionType(resolutionType);
  const pressure = {
    pressureVersion: TRAVEL_V2_RISK_BID_PRESSURE_APPLY_VERSION,
    pressureKey: `risk-bid-pressure-apply:${safeString(gateRecord.gateKey)}`,
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
    label: safeString(gateRecord.label, "Risk bid pressure") || "Risk bid pressure",
    text: safeString(gateRecord.text, "Pressure plumbing only — no actor or world mutation") || "Pressure plumbing only — no actor or world mutation",
    resolutionType,
    resolutionFamily: "pressure",
    pressureDelta,
    pressureSeverity: resolutionType === "severePressure" ? "severe" : "standard",
    previewOnly: true,
    intentOnly: true,
    gateOnly: true,
    pressureOnly: true,
    armed: true,
    applied
  };
  for (const key of Object.keys(pressure)) if (!PRESSURE_RECORD_KEYS.includes(key)) delete pressure[key];
  return freezeOutput(pressure);
}
function makeSessionPatch({ applied, committed, pressureDeltaTotal, pressureRecords, updatedAt }) {
  return freezeOutput({
    [PATCH_SESSION_KEY]: {
      version: TRAVEL_V2_RISK_BID_PRESSURE_APPLY_VERSION,
      applied,
      committed,
      pressureDeltaTotal,
      records: pressureRecords,
      updatedAt: safeString(updatedAt) || "1970-01-01T00:00:00.000Z"
    }
  });
}
function shell({ canReview = false, applyMode = "preview", pressureRecords = [], selectedCount = 0, gateRecordCount = 0, sessionPatch = null, session = null, blockedReasons = [], warnings = [], ok = false, available = false, staged = false, committed = false, applied = false } = {}) {
  const counted = countPressureRecords(pressureRecords);
  const pressureDeltaTotal = pressureRecords.reduce((total, record) => total + (Number(record.pressureDelta) || 0), 0);
  return freezeOutput({
    version: TRAVEL_V2_RISK_BID_PRESSURE_APPLY_VERSION,
    ok,
    available,
    canReview,
    applyMode,
    staged,
    committed,
    pressureReady: pressureRecords.length > 0,
    selectedCount,
    gateRecordCount,
    pressureRecordCount: pressureRecords.length,
    pressureDeltaTotal,
    pressureRecords: freezeOutput(pressureRecords),
    byResolutionType: counted.byResolutionType,
    byDangerLevel: counted.byDangerLevel,
    bySeverity: counted.bySeverity,
    sessionPatch,
    session,
    blockedReasons: Array.from(new Set(blockedReasons)),
    warnings: Array.from(new Set(warnings)),
    applied
  });
}

export function prepareTravelV2RiskBidPressureApply(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  const hasRequestedMode = Object.hasOwn(options ?? {}, "applyMode");
  const normalizedMode = normalizeApplyMode(options?.applyMode ?? "preview");
  const applyMode = normalizedMode || "preview";
  if (!canReview) return shell({ canReview: false, applyMode, blockedReasons: ["travel-v2-review-permission-required"] });
  if (hasRequestedMode && !normalizedMode) return shell({ canReview: true, applyMode: "preview", blockedReasons: ["invalid-risk-bid-pressure-apply-mode"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return shell({ canReview: true, applyMode, blockedReasons: ["risk-bid-review-queue-not-found"] });

  const gate = prepareTravelV2RiskBidReviewApplyGate(session, { canReview: true, gateMode: "armed", includeDismissed: options?.includeDismissed === true });
  const gateRecords = Array.isArray(gate?.gateRecords) ? gate.gateRecords : [];
  if (!gateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: 0, blockedReasons: ["missing-armed-risk-bid-review-apply-gate-records"], warnings: gate?.warnings ?? [] });
  const pressureGateRecords = gateRecords.filter((record) => record?.armed === true && record?.resolutionFamily === "pressure" && pressureDeltaForResolutionType(record?.resolutionType) > 0);
  if (!pressureGateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, blockedReasons: ["missing-risk-bid-pressure-gate-records"], warnings: gate?.warnings ?? [] });

  const applied = applyMode === "commit";
  const pressureRecords = pressureGateRecords.map((record) => makePressureRecord(record, applied));
  const staged = applyMode === "stage" || applyMode === "commit";
  const committed = applyMode === "commit";
  const pressureDeltaTotal = pressureRecords.reduce((total, record) => total + (Number(record.pressureDelta) || 0), 0);
  const sessionPatch = staged ? makeSessionPatch({ applied, committed, pressureDeltaTotal, pressureRecords, updatedAt: options?.now }) : null;
  const patchedSession = committed ? freezeOutput({ ...clone(session), ...clone(sessionPatch) }) : null;
  return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, pressureRecords, sessionPatch, session: patchedSession, warnings: gate?.warnings ?? [], ok: true, available: true, staged, committed, applied });
}
