import { prepareTravelV2EventOutcomePackage } from "./travel-v2-event-outcome-package.js";

export const TRAVEL_V2_ACTOR_APPLICATION_BRIDGE_VERSION = 1;
const MODULE_ID = "arcflight";
const SUPPORTED_PRESSURE_PATHS = Object.freeze({
  hull: "current.hull",
  strain: "current.strain",
  lifeveil: "current.lifeveil",
  morale: "current.morale",
  supplies: "resources.supplies",
  cargo: "cargo.used"
});
const LABELS = Object.freeze({ hull: "Hull", strain: "Strain", lifeveil: "Lifeveil", morale: "Morale", supplies: "Supplies", cargo: "Cargo" });

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function getProperty(source, path) { return String(path ?? "").split(".").filter(Boolean).reduce((value, key) => value?.[key], source); }
function numeric(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function actorSystem(actor) { return actor?.getFlag?.(MODULE_ID, "system") ?? actor?.flags?.[MODULE_ID]?.system ?? {}; }
function actorApplications(actor) { return actorSystem(actor)?.travelV2?.actorApplications?.records ?? []; }
function actorId(actor) { return actor?.id ?? actor?._id ?? actor?.uuid ?? ""; }
function actorName(actor) { return actor?.name ?? "Unselected ship"; }
function userIsGm(options = {}) { return options.isGM ?? options.user?.isGM ?? globalThis.game?.user?.isGM ?? false; }
function userRecord(options = {}) { const user = options.user ?? globalThis.game?.user ?? {}; return { id: user.id ?? user._id ?? "", name: user.name ?? "" }; }
function packageKey(record = {}) { return [record.completedAt ?? "", record.eventOutcomeKey ?? "mixed", record.version ?? ""].join("|"); }
function isSupportedActor(actor) {
  if (!actor) return false;
  if (actor.type !== "vehicle") return false;
  const enabled = actor.getFlag?.(MODULE_ID, "enabled") ?? actor.flags?.[MODULE_ID]?.enabled;
  const arcType = actor.getFlag?.(MODULE_ID, "actorType") ?? actor.flags?.[MODULE_ID]?.actorType;
  return enabled === true || arcType === "ship" || arcType === "arcflightShip";
}
function manualEntries(label, values = []) { return Array.isArray(values) ? values.map((value) => ({ label, value: cloneData(value), text: `${label}: ${value?.name ?? value?.label ?? value?.id ?? "Review candidate"}` })) : []; }

export function prepareTravelV2ActorApplicationPreview(packageRecord, actor, options = {}) {
  const outcomePackage = isPlainObject(packageRecord?.packageRecord) ? packageRecord : null;
  const record = outcomePackage?.packageRecord ?? (isPlainObject(packageRecord) && packageRecord.canPreparePackage !== false ? packageRecord : null);
  const blockedReasons = [];
  if (!record) blockedReasons.push("Travel v2 event outcome package is required.");
  if (!actor) blockedReasons.push("A PF2E vehicle / Arcflight ship actor is required.");
  else if (!isSupportedActor(actor)) blockedReasons.push("A PF2E vehicle / Arcflight ship actor is required.");
  if (options.session && !(options.session.status === "completed" || options.session.completed === true)) blockedReasons.push("Travel v2 runner session must be completed before actor application.");
  if (record) {
    const duplicate = actorApplications(actor).find((entry) => entry?.packageKey === packageKey(record) || (entry?.eventCompletedAt === record.completedAt && entry?.eventOutcomeKey === record.eventOutcomeKey));
    if (duplicate) blockedReasons.push("This Travel v2 outcome package has already been applied to this ship.");
  }

  const system = actorSystem(actor);
  const totals = record?.pressureSummary?.totalsByPressureType ?? {};
  const proposedChanges = [];
  const manualFollowUps = [];
  for (const [key, deltaValue] of Object.entries(totals)) {
    const delta = numeric(deltaValue);
    if (!delta) continue;
    const path = SUPPORTED_PRESSURE_PATHS[key];
    const current = path ? numeric(getProperty(system, path)) : null;
    if (path && current !== null) proposedChanges.push({ key, label: LABELS[key] ?? key, path: `flags.${MODULE_ID}.system.${path}`, systemPath: path, current, delta, next: current + delta, displayDelta: `${delta > 0 ? "+" : ""}${delta}` });
    else manualFollowUps.push({ label: LABELS[key] ?? key, text: `${LABELS[key] ?? key}: ${delta > 0 ? "+" : ""}${delta} (manual follow-up; no supported actor state path found)` });
  }
  manualFollowUps.push(...manualEntries("Ship Scar Candidate", record?.shipScarCandidates));
  manualFollowUps.push(...manualEntries("Fortune Candidate", record?.fortuneCandidates));
  manualFollowUps.push(...manualEntries("Reward Candidate", record?.rewardCandidates));
  manualFollowUps.push(...manualEntries("Consequence Candidate", record?.consequenceCandidates));
  manualFollowUps.push(...manualEntries("Hazard Candidate", record?.hazardSummary));

  return Object.freeze({
    version: TRAVEL_V2_ACTOR_APPLICATION_BRIDGE_VERSION,
    canApply: blockedReasons.length === 0,
    applyDisabled: blockedReasons.length > 0,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    targetActor: actor ? { id: actorId(actor), uuid: actor.uuid ?? "", name: actorName(actor), type: actor.type ?? "" } : null,
    packageKey: record ? packageKey(record) : "",
    packageVersion: record?.version ?? outcomePackage?.version ?? null,
    eventOutcomeKey: record?.eventOutcomeKey ?? "",
    eventOutcomeLabel: record?.eventOutcomeLabel ?? "",
    eventKey: options.session?.event?.key ?? options.session?.eventKey ?? "",
    eventName: options.session?.event?.name ?? options.session?.eventName ?? "",
    sessionKey: options.session?.key ?? options.session?.id ?? "",
    proposedChanges,
    manualFollowUps,
    hasProposedChanges: proposedChanges.length > 0,
    hasManualFollowUps: manualFollowUps.length > 0
  });
}

export async function applyTravelV2ActorApplicationPreview(actor, preview, options = {}) {
  const blockedReasons = [];
  if (!userIsGm(options)) blockedReasons.push("Only a GM can apply Travel v2 outcome package changes to a ship.");
  if (!actor) blockedReasons.push("A PF2E vehicle / Arcflight ship actor is required.");
  if (!preview?.canApply) blockedReasons.push(...(preview?.blockedReasons?.length ? preview.blockedReasons : ["Travel v2 actor application preview is blocked."]));
  if (blockedReasons.length) return { ok: false, applied: false, actor, preview, blockedReasons, error: blockedReasons[0] };
  const appliedBy = userRecord(options);
  const applicationRecord = { version: TRAVEL_V2_ACTOR_APPLICATION_BRIDGE_VERSION, packageKey: preview.packageKey, packageVersion: preview.packageVersion, eventKey: preview.eventKey, eventName: preview.eventName, sessionKey: preview.sessionKey, eventOutcomeKey: preview.eventOutcomeKey, eventOutcomeLabel: preview.eventOutcomeLabel, appliedAt: options.now ?? new Date().toISOString(), appliedByUserId: appliedBy.id, appliedByUserName: appliedBy.name, targetActorId: actorId(actor), targetActorName: actorName(actor), deltasApplied: cloneData(preview.proposedChanges), manualFollowUps: cloneData(preview.manualFollowUps) };
  const records = [...actorApplications(actor), applicationRecord];
  const updateData = Object.fromEntries(preview.proposedChanges.map((change) => [change.path, change.next]));
  updateData[`flags.${MODULE_ID}.system.travelV2.actorApplications`] = { version: TRAVEL_V2_ACTOR_APPLICATION_BRIDGE_VERSION, records };
  const updateFn = options.updateActor ?? ((target, data) => target.update(data));
  await updateFn(actor, updateData);
  return { ok: true, applied: true, actor, preview, updateData, applicationRecord, blockedReasons: [] };
}

export function prepareTravelV2ActorApplicationPreviewFromSession(session, actor, options = {}) {
  return prepareTravelV2ActorApplicationPreview(prepareTravelV2EventOutcomePackage(session, options), actor, { ...options, session });
}
