import { prepareTravelV2RiskBidReviewApplyGate } from "./travel-v2-risk-bid-review-apply-gate.js";

export const TRAVEL_V2_RISK_BID_SCAR_APPLY_VERSION = 1;

const QUEUE_SESSION_KEY = "travelV2RiskBidReviewQueue";
const PATCH_SESSION_KEY = "travelV2RiskBidScarApply";
const VALID_APPLY_MODES = Object.freeze(["preview", "stage", "commit"]);
const SCAR_RECORD_KEYS = Object.freeze(["scarVersion", "scarKey", "gateKey", "intentKey", "queueKey", "status", "payloadType", "candidateType", "severity", "tier", "resultBand", "dangerLevel", "stationKey", "stationName", "actionId", "actionName", "roundIndex", "roundNumber", "label", "text", "resolutionType", "resolutionFamily", "scarDelta", "scarKind", "scarSeverity", "previewOnly", "intentOnly", "gateOnly", "scarOnly", "armed", "applied"]);
const FORBIDDEN_OUTPUT_TERMS = Object.freeze(["gmOnly", "secret", "hiddenHazards", "unrevealedHazard", "futureTriggers", "internalScoring", "debugReport", "auditRecord", "applyPayload", "actorUuid", "targetActorUuid", "userId", "userName", "updateData", "actor.update", "ChatMessage", "JournalEntry", "socket", "Compendium.", "Actor.", "Item."]);

function unsafeOutputString(value) { return typeof value === "string" && FORBIDDEN_OUTPUT_TERMS.some((term) => value.includes(term)); }
function safeString(value, fallback = "") { if (typeof value !== "string") return fallback; const trimmed = value.trim(); return trimmed && !unsafeOutputString(trimmed) ? trimmed : fallback; }
function clone(value) { if (value === undefined) return undefined; return JSON.parse(JSON.stringify(value)); }
function freezeOutput(value) { if (Array.isArray(value)) for (const entry of value) freezeOutput(entry); else if (value && typeof value === "object") for (const entry of Object.values(value)) freezeOutput(entry); return Object.freeze(value); }
function incrementCount(counts, key) { const safeKey = safeString(key) || "unknown"; counts[safeKey] = (Number(counts[safeKey]) || 0) + 1; }
function normalizeApplyMode(value) { const safeMode = safeString(value); return VALID_APPLY_MODES.includes(safeMode) ? safeMode : ""; }
function scarMappingForResolutionType(resolutionType) {
  if (resolutionType === "shipScar") return { scarDelta: 1, scarKind: "shipScar", scarSeverity: "standard" };
  return { scarDelta: 0, scarKind: "", scarSeverity: "" };
}
function countScarRecords(scarRecords = []) {
  const byResolutionType = {}; const byScarKind = {}; const byDangerLevel = {}; const bySeverity = {};
  for (const record of scarRecords) { incrementCount(byResolutionType, record.resolutionType); incrementCount(byScarKind, record.scarKind); incrementCount(byDangerLevel, record.dangerLevel); incrementCount(bySeverity, record.severity); }
  return freezeOutput({ byResolutionType, byScarKind, byDangerLevel, bySeverity });
}
function makeScarRecord(gateRecord, applied) {
  const resolutionType = safeString(gateRecord.resolutionType);
  const mapping = scarMappingForResolutionType(resolutionType);
  const scar = {
    scarVersion: TRAVEL_V2_RISK_BID_SCAR_APPLY_VERSION,
    scarKey: `risk-bid-scar-apply:${safeString(gateRecord.gateKey)}`,
    gateKey: safeString(gateRecord.gateKey), intentKey: safeString(gateRecord.intentKey), queueKey: safeString(gateRecord.queueKey),
    status: safeString(gateRecord.status) || "pending", payloadType: safeString(gateRecord.payloadType), candidateType: safeString(gateRecord.candidateType),
    severity: safeString(gateRecord.severity) || "standard", tier: gateRecord.tier ?? null, resultBand: safeString(gateRecord.resultBand) || null,
    dangerLevel: safeString(gateRecord.dangerLevel) || "none", stationKey: safeString(gateRecord.stationKey), stationName: safeString(gateRecord.stationName),
    actionId: safeString(gateRecord.actionId), actionName: safeString(gateRecord.actionName), roundIndex: gateRecord.roundIndex ?? null, roundNumber: gateRecord.roundNumber ?? null,
    label: safeString(gateRecord.label, "Risk bid ship scar") || "Risk bid ship scar", text: safeString(gateRecord.text, "Scar plumbing only — no actor or world mutation") || "Scar plumbing only — no actor or world mutation",
    resolutionType, resolutionFamily: safeString(gateRecord.resolutionFamily) || "scar", scarDelta: mapping.scarDelta, scarKind: mapping.scarKind, scarSeverity: mapping.scarSeverity,
    previewOnly: true, intentOnly: true, gateOnly: true, scarOnly: true, armed: true, applied
  };
  for (const key of Object.keys(scar)) if (!SCAR_RECORD_KEYS.includes(key)) delete scar[key];
  return freezeOutput(scar);
}
function scarDeltaTotal(records) { return records.reduce((total, record) => total + (Number(record.scarDelta) || 0), 0); }
function makeSessionPatch({ applied, committed, scarRecords, updatedAt }) { return freezeOutput({ [PATCH_SESSION_KEY]: { version: TRAVEL_V2_RISK_BID_SCAR_APPLY_VERSION, applied, committed, scarDeltaTotal: scarDeltaTotal(scarRecords), records: scarRecords, updatedAt: safeString(updatedAt) || "1970-01-01T00:00:00.000Z" } }); }
function shell({ canReview = false, applyMode = "preview", scarRecords = [], selectedCount = 0, gateRecordCount = 0, sessionPatch = null, session = null, blockedReasons = [], warnings = [], ok = false, available = false, staged = false, committed = false, applied = false } = {}) {
  const counted = countScarRecords(scarRecords);
  return freezeOutput({ version: TRAVEL_V2_RISK_BID_SCAR_APPLY_VERSION, ok, available, canReview, applyMode, staged, committed, scarReady: scarRecords.length > 0, selectedCount, gateRecordCount, scarRecordCount: scarRecords.length, scarDeltaTotal: scarDeltaTotal(scarRecords), scarRecords: freezeOutput(scarRecords), byResolutionType: counted.byResolutionType, byScarKind: counted.byScarKind, byDangerLevel: counted.byDangerLevel, bySeverity: counted.bySeverity, sessionPatch, session, blockedReasons: Array.from(new Set(blockedReasons)), warnings: Array.from(new Set(warnings)), applied });
}

export function prepareTravelV2RiskBidScarApply(session = {}, options = {}) {
  const canReview = options?.canReview === true;
  const hasRequestedMode = Object.hasOwn(options ?? {}, "applyMode");
  const normalizedMode = normalizeApplyMode(options?.applyMode ?? "preview");
  const applyMode = normalizedMode || "preview";
  if (!canReview) return shell({ canReview: false, applyMode, blockedReasons: ["travel-v2-review-permission-required"] });
  if (hasRequestedMode && !normalizedMode) return shell({ canReview: true, applyMode: "preview", blockedReasons: ["invalid-risk-bid-scar-apply-mode"] });
  if (!session?.[QUEUE_SESSION_KEY] || typeof session[QUEUE_SESSION_KEY] !== "object") return shell({ canReview: true, applyMode, blockedReasons: ["risk-bid-review-queue-not-found"] });
  const gate = prepareTravelV2RiskBidReviewApplyGate(session, { canReview: true, gateMode: "armed", includeDismissed: options?.includeDismissed === true });
  const gateRecords = Array.isArray(gate?.gateRecords) ? gate.gateRecords : [];
  if (!gateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: 0, blockedReasons: ["missing-armed-risk-bid-review-apply-gate-records"], warnings: gate?.warnings ?? [] });
  const scarGateRecords = gateRecords.filter((record) => record?.armed === true && record?.resolutionFamily === "scar" && scarMappingForResolutionType(record?.resolutionType).scarDelta > 0);
  if (!scarGateRecords.length) return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, blockedReasons: ["missing-risk-bid-scar-gate-records"], warnings: gate?.warnings ?? [] });
  const applied = applyMode === "commit";
  const scarRecords = scarGateRecords.map((record) => makeScarRecord(record, applied));
  const staged = applyMode === "stage" || applyMode === "commit";
  const committed = applyMode === "commit";
  const sessionPatch = staged ? makeSessionPatch({ applied, committed, scarRecords, updatedAt: options?.now }) : null;
  const patchedSession = committed ? freezeOutput({ ...clone(session), ...clone(sessionPatch) }) : null;
  return shell({ canReview: true, applyMode, selectedCount: Number(gate?.selectedCount) || 0, gateRecordCount: gateRecords.length, scarRecords, sessionPatch, session: patchedSession, warnings: gate?.warnings ?? [], ok: true, available: true, staged, committed, applied });
}
