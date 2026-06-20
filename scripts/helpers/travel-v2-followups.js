export const TRAVEL_V2_FOLLOW_UPS_VERSION = 1;
const MODULE_ID = "arcflight";
const STATUSES = Object.freeze(["pending", "kept", "resolved", "dismissed"]);
const GROUPS = Object.freeze([
  ["ship-scar", "Ship Scars"], ["fortune", "Fortunes"], ["reward", "Rewards"], ["consequence", "Consequences"], ["hazard", "Hazards / Lingering Threats"], ["unsupported-resource", "Unsupported Resource Changes"], ["gm-note", "GM Notes"]
]);
function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function slug(value) { return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "follow-up"; }
function actorSystem(actor) { return actor?.getFlag?.(MODULE_ID, "system") ?? actor?.flags?.[MODULE_ID]?.system ?? {}; }
function existingRecords(actor) { return actorSystem(actor)?.travelV2?.followUps?.records ?? []; }
function userIsGm(options = {}) { return options.isGM ?? options.user?.isGM ?? globalThis.game?.user?.isGM ?? false; }
function userContextExists(options = {}) { return Boolean(options.user || globalThis.game?.user); }
function titleFrom(value, fallback) { return String(value?.title ?? value?.name ?? value?.label ?? value?.id ?? fallback).trim(); }
function textFrom(value, fallback) { return String(value?.text ?? value?.description ?? value?.summaryText ?? value?.summary ?? value?.note ?? fallback).trim(); }
function packageKey(record = {}) { return record.packageKey ?? [record.completedAt ?? "", record.eventOutcomeKey ?? "mixed", record.version ?? ""].join("|"); }
function stableId(record) { return slug([record.sourceSessionKey, record.sourcePackageKey, record.sourceEventKey, record.sourceOutcomeKey, record.type, record.title].filter(Boolean).join("|")); }
function sourceBase(source, options = {}) {
  return { sourceEventKey: source.eventKey ?? options.session?.event?.key ?? options.session?.eventKey ?? "", sourceEventName: source.eventName ?? options.session?.event?.name ?? options.session?.eventName ?? "", sourceSessionKey: source.sessionKey ?? options.session?.key ?? options.session?.id ?? "", sourceOutcomeKey: source.eventOutcomeKey ?? "", sourceOutcomeLabel: source.eventOutcomeLabel ?? "", sourcePackageKey: packageKey(source) };
}
function normalize(type, value, source, options) {
  const label = titleFrom(value, value?.label ?? type);
  const record = { version: TRAVEL_V2_FOLLOW_UPS_VERSION, id: "", type, title: label, text: textFrom(value, label), ...sourceBase(source, options), createdAt: options.now ?? null, updatedAt: options.now ?? null, status: "pending", note: "", originalValue: cloneData(value?.value ?? value) };
  record.id = stableId(record);
  return record;
}
function mapManual(entry, source, options) {
  const label = String(entry?.label ?? "GM Note");
  const lower = label.toLowerCase();
  const type = lower.includes("scar") ? "ship-scar" : lower.includes("fortune") ? "fortune" : lower.includes("reward") ? "reward" : lower.includes("consequence") ? "consequence" : lower.includes("hazard") ? "hazard" : lower.includes("cargo") || lower.includes("suppl") || lower.includes("pressure") || lower.includes("hull") ? "unsupported-resource" : "gm-note";
  return normalize(type, { ...entry, title: titleFrom(entry?.value, label), text: entry?.text }, source, options);
}
export function prepareTravelV2FollowUpRecordsFromActorApplication(previewOrApplicationRecord, options = {}) {
  const source = previewOrApplicationRecord?.applicationRecord ?? previewOrApplicationRecord ?? {};
  const records = [];
  for (const entry of Array.isArray(source.manualFollowUps) ? source.manualFollowUps : []) records.push(mapManual(entry, source, options));
  for (const entry of Array.isArray(source.shipScarCandidates) ? source.shipScarCandidates : []) records.push(normalize("ship-scar", entry, source, options));
  for (const entry of Array.isArray(source.fortuneCandidates) ? source.fortuneCandidates : []) records.push(normalize("fortune", entry, source, options));
  for (const entry of Array.isArray(source.rewardCandidates) ? source.rewardCandidates : []) records.push(normalize("reward", entry, source, options));
  for (const entry of Array.isArray(source.consequenceCandidates) ? source.consequenceCandidates : []) records.push(normalize("consequence", entry, source, options));
  for (const entry of Array.isArray(source.hazardSummary) ? source.hazardSummary : []) records.push(normalize("hazard", entry, source, options));
  const seen = new Set();
  return records.filter((record) => record.id && !seen.has(record.id) && seen.add(record.id));
}
export function mergeTravelV2FollowUpRecords(existing = [], candidates = [], options = {}) {
  const byKey = new Map();
  for (const record of existing.filter(isPlainObject)) byKey.set(record.id ?? stableId(record), cloneData(record));
  for (const record of candidates.filter(isPlainObject)) if (!byKey.has(record.id)) byKey.set(record.id, cloneData(record));
  return [...byKey.values()].map((record) => ({ ...record, version: TRAVEL_V2_FOLLOW_UPS_VERSION }));
}
export function prepareTravelV2FollowUpState(actor, packageRecordOrApplicationRecord, options = {}) {
  const candidates = prepareTravelV2FollowUpRecordsFromActorApplication(packageRecordOrApplicationRecord, options);
  const records = mergeTravelV2FollowUpRecords(actor ? existingRecords(actor) : [], candidates, options);
  const groups = GROUPS.map(([type, label]) => ({ type, label, records: records.filter((record) => record.type === type), hasRecords: records.some((record) => record.type === type) }));
  return { version: TRAVEL_V2_FOLLOW_UPS_VERSION, hasActor: Boolean(actor), records, groups, hasRecords: records.length > 0, pendingCount: records.filter((r) => r.status === "pending").length, emptyText: "No end-of-event follow-ups are pending for this outcome." };
}
export async function updateTravelV2FollowUpStatus(actor, followUpId, status, options = {}) {
  const blockedReasons = [];
  if (!actor) blockedReasons.push("A PF2E vehicle / Arcflight ship actor is required.");
  if (!followUpId) blockedReasons.push("A Travel v2 follow-up id is required.");
  if (!STATUSES.includes(status)) blockedReasons.push("Travel v2 follow-up status is not supported.");
  if (userContextExists(options) && !userIsGm(options)) blockedReasons.push("Only a GM can update Travel v2 follow-up status.");
  const records = actor ? existingRecords(actor).map(cloneData) : [];
  const index = records.findIndex((record) => record?.id === followUpId);
  if (actor && followUpId && index < 0) blockedReasons.push("Travel v2 follow-up record was not found.");
  if (blockedReasons.length) return { ok: false, updated: false, actor, followUpId, status, blockedReasons, error: blockedReasons[0] };
  records[index] = { ...records[index], status, note: options.note ?? records[index].note ?? "", updatedAt: options.now ?? new Date().toISOString() };
  const updateData = { [`flags.${MODULE_ID}.system.travelV2.followUps`]: { version: TRAVEL_V2_FOLLOW_UPS_VERSION, records } };
  const updateFn = options.updateActor ?? ((target, data) => target.update(data));
  await updateFn(actor, updateData);
  return { ok: true, updated: true, actor, followUpId, status, updateData, record: records[index], blockedReasons: [] };
}
export async function ensureTravelV2FollowUpsOnActor(actor, source, options = {}) {
  if (!actor) return { ok: false, blockedReasons: ["A PF2E vehicle / Arcflight ship actor is required."] };
  const records = mergeTravelV2FollowUpRecords(existingRecords(actor), prepareTravelV2FollowUpRecordsFromActorApplication(source, options), options);
  const updateData = { [`flags.${MODULE_ID}.system.travelV2.followUps`]: { version: TRAVEL_V2_FOLLOW_UPS_VERSION, records } };
  await (options.updateActor ?? ((target, data) => target.update(data)))(actor, updateData);
  return { ok: true, records, updateData };
}
