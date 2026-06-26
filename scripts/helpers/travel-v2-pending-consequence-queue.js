import { prepareTravelV2EventOutcomePackage } from "./travel-v2-event-outcome-package.js";
import { getTravelV2ConsequencesBySource } from "../../data/travel-events/travel-v2-consequence-catalog.js";

export const TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION = 1;
const QUEUE_STATUSES = Object.freeze(["pending", "applied", "dismissed", "deferred"]);

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { if (value === null || value === undefined) return value; return JSON.parse(JSON.stringify(value)); }
function recordsFrom(container) { if (Array.isArray(container)) return container; if (Array.isArray(container?.records)) return container.records; if (Array.isArray(container?.pending)) return container.pending; if (Array.isArray(container?.pendingDraws)) return container.pendingDraws; return []; }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function titleFrom(value, fallback = "Consequence") { return text(value) || fallback; }
function statusFrom(value) { return QUEUE_STATUSES.includes(value) ? value : "pending"; }
function queueOverrides(session = {}) {
  const records = recordsFrom(session.travelV2PendingConsequenceQueue);
  return new Map(records.filter(isPlainObject).map((record) => [record.queueKey, record]));
}
function catalogSummaries(source) {
  return getTravelV2ConsequencesBySource(source).map((entry) => ({ id: entry.id, title: entry.title, severity: entry.severity, playerSafeSummary: entry.playerSafeSummary, applyEffectSummary: entry.applyEffectSummary }));
}
function makeQueueItem(input = {}, overrides = new Map()) {
  const queueKey = input.queueKey;
  const override = overrides.get(queueKey) ?? {};
  const status = statusFrom(override.status ?? input.status);
  const item = {
    version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION,
    queueKey,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? "",
    roundIndex: Number.isInteger(Number(input.roundIndex)) ? Number(input.roundIndex) : null,
    roundNumber: Number.isInteger(Number(input.roundNumber)) ? Number(input.roundNumber) : null,
    title: titleFrom(input.title, "Pending Consequence"),
    severity: text(input.severity) || "minor",
    status,
    sourceStatus: text(input.sourceStatus) || "",
    publicSummary: text(input.publicSummary) || "A consequence candidate needs GM review.",
    gmSummary: text(input.gmSummary) || text(input.publicSummary) || "Review this candidate before applying, dismissing, or deferring it.",
    applyLabel: "Apply",
    dismissLabel: "Dismiss",
    deferLabel: "Defer",
    requiresGmApply: true,
    mutation: "none",
    catalogSuggestions: cloneData(input.catalogSuggestions ?? []),
    sourceRecord: cloneData(input.sourceRecord ?? null),
    decidedAt: override.decidedAt ?? null,
    decisionNote: text(override.decisionNote),
    playerSafe: { title: titleFrom(input.title, "Pending Consequence"), summary: text(input.publicSummary) || "A consequence candidate needs GM review.", status }
  };
  return item;
}
function unresolvedHazard(record = {}) { return ["active", "revealed", "held", "pending"].includes(record.status) && record.status !== "cleared" && record.status !== "dismissed"; }
function finalOutcomeConsequenceItems(session = {}, overrides) {
  const outcome = prepareTravelV2EventOutcomePackage(session, { now: session.completedAt ?? null });
  if (outcome.canPreparePackage !== true) return [];
  return (outcome.consequenceCandidates ?? []).map((candidate, index) => makeQueueItem({
    queueKey: `final-outcome:${outcome.eventOutcomeKey}:${index}`,
    sourceType: "finalOutcomeFallout",
    sourceId: candidate.id ?? candidate.key ?? String(index),
    title: candidate.name ?? candidate.title ?? candidate.text ?? "Final outcome fallout",
    severity: candidate.severity ?? (["failure", "critical-failure"].includes(outcome.eventOutcomeKey) ? "major" : "minor"),
    publicSummary: candidate.playerSafeSummary ?? candidate.publicText ?? candidate.text ?? candidate.name ?? "Final outcome consequence candidate.",
    gmSummary: candidate.gmSummary ?? candidate.gmText ?? candidate.text ?? candidate.name ?? "Review final outcome fallout.",
    sourceStatus: "candidate",
    catalogSuggestions: catalogSummaries("final-bad-outcome"),
    sourceRecord: candidate
  }, overrides));
}
export function prepareTravelV2PendingConsequenceQueue(session, options = {}) {
  if (!isPlainObject(session)) return { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, hasSession: false, items: [], pendingCount: 0, appliedCount: 0, dismissedCount: 0, deferredCount: 0, playerSafeItems: [], summaryText: "Travel v2 pending consequence queue requires a runner session." };
  const overrides = queueOverrides(session);
  const items = [];
  for (const record of recordsFrom(session.travelV2FocusBacklashRecords)) if (isPlainObject(record) && ["pending", "applied", "dismissed"].includes(record.status)) items.push(makeQueueItem({ queueKey: `focus-backlash:${record.id}`, sourceType: "focusBacklash", sourceId: record.id, roundIndex: record.roundIndex, roundNumber: Number(record.roundIndex) + 1, title: record.publicSummary || `${record.stationName ?? "Station"} Focus backlash`, severity: "minor", status: record.status, sourceStatus: record.status, publicSummary: record.publicRiskText || record.publicSummary, gmSummary: record.publicBacklashPreviewText || record.publicRiskText || record.publicSummary, catalogSuggestions: catalogSummaries("focus-backlash"), sourceRecord: record }, overrides));
  for (const record of recordsFrom(session.travelV2SupportBacklashRecords)) if (isPlainObject(record) && ["pending", "applied", "dismissed"].includes(record.status)) items.push(makeQueueItem({ queueKey: `support-backlash:${record.id}`, sourceType: "supportBacklash", sourceId: record.id, roundIndex: record.roundIndex, roundNumber: Number(record.roundIndex) + 1, title: `${record.supportingStationName ?? "Support"} backlash`, severity: record.severity ?? "minor", status: record.status, sourceStatus: record.status, publicSummary: record.publicRiskText || record.publicSummary, gmSummary: record.publicSummary || record.publicRiskText, catalogSuggestions: catalogSummaries("failed-support"), sourceRecord: record }, overrides));
  for (const record of recordsFrom(session.hazards).concat(recordsFrom(session.travelV2Hazards))) if (isPlainObject(record) && unresolvedHazard(record)) items.push(makeQueueItem({ queueKey: `hazard:${record.id}`, sourceType: "unresolvedHazard", sourceId: record.id, roundIndex: record.roundIndex, roundNumber: Number(record.roundIndex) + 1, title: `Unresolved hazard: ${record.name ?? record.title ?? record.id}`, severity: record.severity ?? "major", status: "pending", sourceStatus: record.status, publicSummary: record.playerText || record.publicText || "An unresolved hazard needs GM review.", gmSummary: record.gmText || record.name || "Resolve, clear, or escalate this hazard manually.", catalogSuggestions: catalogSummaries("unresolved-hazard"), sourceRecord: record }, overrides));
  for (const record of recordsFrom(session.shipScars).concat(recordsFrom(session.travelV2ShipScars))) if (isPlainObject(record) && (record.status ?? "pending") === "pending") items.push(makeQueueItem({ queueKey: `ship-scar:${record.id}`, sourceType: "shipScarCandidate", sourceId: record.id, roundIndex: record.roundIndex, roundNumber: Number(record.roundIndex) + 1, title: record.name ?? record.title ?? "Ship scar candidate", severity: record.severity ?? "severe", status: "pending", sourceStatus: record.status ?? "pending", publicSummary: record.playerSafeSummary ?? "A ship scar candidate needs explicit GM review.", gmSummary: record.gmSummary ?? record.gmText ?? "No actor mutation occurs from the queue.", catalogSuggestions: catalogSummaries("repeated-severe-pressure"), sourceRecord: record }, overrides));
  items.push(...finalOutcomeConsequenceItems(session, overrides));
  const ordered = items.sort((a, b) => (a.roundNumber ?? 999) - (b.roundNumber ?? 999) || a.sourceType.localeCompare(b.sourceType) || a.queueKey.localeCompare(b.queueKey));
  const count = (status) => ordered.filter((item) => item.status === status).length;
  return { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, hasSession: true, items: ordered, pendingCount: count("pending"), appliedCount: count("applied"), dismissedCount: count("dismissed"), deferredCount: count("deferred"), playerSafeItems: ordered.map((item) => item.playerSafe), summaryText: ordered.length ? `${ordered.length} consequence candidate${ordered.length === 1 ? "" : "s"} queued for GM review.` : "No pending consequence candidates." };
}
function timestamp(options = {}) { const value = options.decidedAt ?? options.now; if (value instanceof Date) return value.toISOString(); if (typeof value === "string" && value.trim()) return value.trim(); return new Date().toISOString(); }
export function updateTravelV2PendingConsequenceQueueItem(session, queueKey, status, options = {}) {
  if (!isPlainObject(session)) return { ok: false, session, error: "Travel v2 runner session is required." };
  if (!text(queueKey)) return { ok: false, session, error: "Pending consequence queue key is required." };
  if (!["applied", "dismissed", "deferred", "pending"].includes(status)) return { ok: false, session, error: "Pending consequence status must be applied, dismissed, deferred, or pending." };
  const queue = prepareTravelV2PendingConsequenceQueue(session, options);
  if (!queue.items.some((item) => item.queueKey === queueKey)) return { ok: false, session, queue, error: "Pending consequence queue item was not found." };
  const existing = recordsFrom(session.travelV2PendingConsequenceQueue).filter(isPlainObject).filter((record) => record.queueKey !== queueKey);
  const record = { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, queueKey, status, decidedAt: timestamp(options), decisionNote: text(options.note), mutation: "none" };
  const nextSession = { ...cloneData(session), travelV2PendingConsequenceQueue: { version: TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION, records: [...existing, record] } };
  return { ok: true, session: nextSession, queue: prepareTravelV2PendingConsequenceQueue(nextSession, options), record };
}
export default prepareTravelV2PendingConsequenceQueue;
