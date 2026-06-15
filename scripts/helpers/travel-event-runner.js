import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_STATIONS } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, getShipTravelResources, previewShipTravelResourceChange, updateShipTravelResources } from "../documents/ships.js";
import { getPublishedTravelEventLibrary, loadPublishedTravelEventFromLibrary, preparePublishedTravelEventLibraryState } from "./travel-event-builder.js";
import { validateTravelEventDefinition } from "./travel-events.js";

export const TRAVEL_EVENT_RUNNER_SESSION_VERSION = 1;
export const TRAVEL_EVENT_RUNNER_SESSION_EXPORT_VERSION = 1;
export const TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING = "travelEventRunnerSessionLibrary";
export const TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION = 1;
export const TRAVEL_EVENT_RUNNER_RESULT_VALUES = Object.freeze(["criticalFailure", "failure", "success", "criticalSuccess", "skipped"]);
export const TRAVEL_EVENT_RUNNER_FINAL_OUTCOMES = Object.freeze(["criticalSuccess", "success", "mixed", "failure", "criticalFailure"]);

const TRAVEL_FIVE_STATION_KEYS = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));
const RESULT_SCORES = Object.freeze({ criticalSuccess: 2, success: 1, skipped: 0, failure: -1, criticalFailure: -2 });
const FINAL_OUTCOME_LABELS = Object.freeze({
  criticalSuccess: "Critical Success",
  success: "Success",
  mixed: "Mixed",
  failure: "Failure",
  criticalFailure: "Critical Failure"
});

const REVIEW_RESOURCE_KEYS = Object.freeze([
  ARCFLIGHT_TRAVEL_RESOURCES.HULL,
  ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
  ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
  ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
  ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES
]);
const REVIEW_RESOURCE_MODES = Object.freeze(["add", "set"]);
const REVIEW_NOT_APPLIED_WARNING = "Review only. Effects have not been applied.";

function getResourceMaxKey(resource) {
  if (resource === ARCFLIGHT_TRAVEL_RESOURCES.HULL) return "maxHull";
  if (resource === ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL) return "maxLifeveil";
  if (resource === ARCFLIGHT_TRAVEL_RESOURCES.STRAIN) return "maxStrain";
  return "";
}

function resolveReviewResources(shipOrResources = null) {
  if (!shipOrResources || typeof shipOrResources !== "object") return null;
  if (typeof shipOrResources.getFlag === "function" || shipOrResources.type) {
    try {
      return getShipTravelResources(shipOrResources);
    } catch (_error) {
      return null;
    }
  }
  return cloneData(shipOrResources);
}

function valueDisplay(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function cloneData(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nowIso(options = {}) {
  if (typeof options.now === "string" && options.now.length > 0) return options.now;
  if (options.now instanceof Date) return options.now.toISOString();
  return new Date().toISOString();
}

function slugifySessionKey(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "travel-event-runner-session";
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStationKey(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && !Array.isArray(entry)) return entry.stationKey ?? entry.key ?? "";
  return "";
}

function getPromptFromRound(round, stationKey) {
  const promptFromMap = round?.stationPrompts?.[stationKey];
  if (promptFromMap && typeof promptFromMap === "object" && !Array.isArray(promptFromMap)) return { ...promptFromMap, stationKey: promptFromMap.stationKey ?? stationKey };
  const promptFromActiveStation = (round?.activeStations ?? []).find((entry) => normalizeStationKey(entry) === stationKey);
  if (promptFromActiveStation && typeof promptFromActiveStation === "object" && !Array.isArray(promptFromActiveStation)) return { ...promptFromActiveStation, stationKey };
  return { stationKey };
}

function getStationCardFromRound(round, stationKey) {
  const cardFromArray = (Array.isArray(round?.stationCards) ? round.stationCards : []).find((entry) => normalizeStationKey(entry) === stationKey);
  if (cardFromArray && typeof cardFromArray === "object" && !Array.isArray(cardFromArray)) return { ...cardFromArray, stationKey };
  const cardFromMap = round?.stationCards?.[stationKey];
  if (cardFromMap && typeof cardFromMap === "object" && !Array.isArray(cardFromMap)) return { ...cardFromMap, stationKey: cardFromMap.stationKey ?? stationKey };
  return null;
}

function createBlankRollFeedback() {
  return {
    criticalSuccess: "",
    success: "",
    failure: "",
    criticalFailure: ""
  };
}

function createEmptyStationCardHooks() {
  return {
    rooms: [],
    shipUpgrades: [],
    arkengineMods: [],
    crewAssets: [],
    factions: []
  };
}

function normalizeStationCardHooks(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    rooms: Array.isArray(source.rooms) ? cloneData(source.rooms) : [],
    shipUpgrades: Array.isArray(source.shipUpgrades) ? cloneData(source.shipUpgrades) : [],
    arkengineMods: Array.isArray(source.arkengineMods) ? cloneData(source.arkengineMods) : [],
    crewAssets: Array.isArray(source.crewAssets) ? cloneData(source.crewAssets) : [],
    factions: Array.isArray(source.factions) ? cloneData(source.factions) : []
  };
}


const FALLBACK_SKILL_APPROACH_COPY = Object.freeze({
  arcana: { label: "Read the arcane pattern", helpText: "Use magical theory to interpret the strange forces affecting the station problem." },
  survival: { label: "Read the environment", helpText: "Use instinct, pressure, motion, and hazard signs to find a practical way through." },
  society: { label: "Recall known routes", helpText: "Use records, customs, stories, and prior voyages to identify a known solution." },
  "sailing-lore": { label: "Apply voidsailor craft", helpText: "Use shiphandling tradition and starlane knowledge to choose a safe course." }
});

function fallbackSkillApproachCopy(skill) {
  const key = String(skill ?? "").trim().toLowerCase();
  if (FALLBACK_SKILL_APPROACH_COPY[key]) return { skill, ...FALLBACK_SKILL_APPROACH_COPY[key] };
  return {
    skill,
    label: `Apply ${humanizeIdentifier(key || skill)} method`,
    helpText: "Use this training as a practical plan to solve or bypass the station problem."
  };
}

function normalizeStationCardSkillApproaches(card = {}, prompt = {}) {
  const explicit = Array.isArray(card.skillApproaches) ? card.skillApproaches : (Array.isArray(prompt.skillApproaches) ? prompt.skillApproaches : []);
  const approaches = explicit
    .filter(isPlainObject)
    .map((entry) => ({
      skill: typeof entry.skill === "string" ? entry.skill : "",
      label: typeof entry.label === "string" ? entry.label : (typeof entry.skill === "string" ? humanizeIdentifier(entry.skill) : ""),
      helpText: typeof entry.helpText === "string" ? entry.helpText : ""
    }))
    .filter((entry) => entry.skill || entry.label || entry.helpText);
  if (approaches.length > 0) return approaches;
  const suggestedSkills = Array.isArray(prompt.suggestedSkills) ? prompt.suggestedSkills : [];
  const fallback = suggestedSkills.slice(0, 3).map((skill) => fallbackSkillApproachCopy(skill));
  if (fallback.length > 0) return fallback;
  return [{ skill: "", label: "Approach", helpText: "" }];
}

function normalizeStationCardForRunner(stationKey, card = null, prompt = {}) {
  const sourceCard = isPlainObject(card) ? card : {};
  const sourcePrompt = isPlainObject(prompt) ? prompt : {};
  const station = getStation(stationKey) ?? {};
  return {
    ...cloneData(sourceCard),
    stationKey,
    stationName: typeof sourceCard.stationName === "string"
      ? sourceCard.stationName
      : (typeof sourcePrompt.stationName === "string" ? sourcePrompt.stationName : (station.displayName ?? station.name ?? humanizeIdentifier(stationKey))),
    problem: typeof sourceCard.problem === "string"
      ? sourceCard.problem
      : (typeof sourcePrompt.problem === "string"
        ? sourcePrompt.problem
        : (typeof sourcePrompt.vignette === "string"
          ? sourcePrompt.vignette
          : (typeof sourcePrompt.playerAction === "string" ? sourcePrompt.playerAction : `[${stationKey} station problem]`))),
    skillApproaches: normalizeStationCardSkillApproaches(sourceCard, sourcePrompt),
    rollFeedback: {
      ...createBlankRollFeedback(),
      ...(isPlainObject(sourcePrompt.rollFeedback) ? cloneData(sourcePrompt.rollFeedback) : {}),
      ...(isPlainObject(sourceCard.rollFeedback) ? cloneData(sourceCard.rollFeedback) : {})
    },
    hooks: sourceCard.hooks == null ? createEmptyStationCardHooks() : normalizeStationCardHooks(sourceCard.hooks)
  };
}

function normalizeRoundDefinition(round, index) {
  const activeStationKeys = Array.isArray(round?.activeStations)
    ? round.activeStations.map(normalizeStationKey).filter((stationKey) => TRAVEL_FIVE_STATION_KEYS.includes(stationKey))
    : [];
  return {
    round: Number.isInteger(Number(round?.round)) ? Number(round.round) : index + 1,
    title: typeof round?.title === "string" ? round.title : `Round ${index + 1}`,
    openingVignette: typeof round?.openingVignette === "string" ? round.openingVignette : "",
    activeStations: Array.from(new Set(activeStationKeys)),
    stationPrompts: Object.fromEntries(Array.from(new Set(activeStationKeys)).map((stationKey) => [stationKey, cloneData(getPromptFromRound(round, stationKey))])),
    stationCards: Array.from(new Set(activeStationKeys)).map((stationKey) => {
      const prompt = getPromptFromRound(round, stationKey);
      const card = getStationCardFromRound(round, stationKey);
      return normalizeStationCardForRunner(stationKey, card, prompt);
    })
  };
}

function normalizeFinalOutcomes(finalOutcomes = {}) {
  const source = finalOutcomes && typeof finalOutcomes === "object" && !Array.isArray(finalOutcomes) ? finalOutcomes : {};
  return Object.fromEntries(TRAVEL_EVENT_RUNNER_FINAL_OUTCOMES.map((key) => {
    const outcome = source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) ? source[key] : {};
    return [key, {
      key,
      label: typeof outcome.label === "string" && outcome.label.length > 0 ? outcome.label : FINAL_OUTCOME_LABELS[key],
      text: typeof outcome.text === "string" ? outcome.text : (typeof outcome.narrative === "string" ? outcome.narrative : ""),
      proposedEffects: Array.isArray(outcome.proposedEffects) ? cloneData(outcome.proposedEffects) : []
    }];
  }));
}

function getActorCollection(options = {}) {
  if (options.actors) return options.actors;
  return globalThis.game?.actors ?? [];
}

function actorCollectionValues(actors) {
  if (!actors) return [];
  if (Array.isArray(actors)) return actors;
  if (typeof actors.values === "function") return Array.from(actors.values());
  if (typeof actors.contents !== "undefined") return Array.from(actors.contents ?? []);
  if (typeof actors === "object") return Object.values(actors);
  return [];
}

function actorUuid(actor) {
  return typeof actor?.uuid === "string" ? actor.uuid : (typeof actor?.documentName === "string" && actor?.id ? `${actor.documentName}.${actor.id}` : "");
}

function isArcflightRunnerShipActor(actor) {
  return actor?.type === "vehicle"
    && (actor.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE || actor.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true);
}

export function getArcflightTravelEventRunnerShipOptions(options = {}) {
  const selectedId = String(options.selectedActorId ?? options.actorId ?? options.shipId ?? "");
  const selectedUuid = String(options.selectedActorUuid ?? options.actorUuid ?? options.shipUuid ?? "");
  const actors = actorCollectionValues(getActorCollection(options))
    .filter((actor) => actor?.type === "vehicle")
    .map((actor) => {
      const uuid = actorUuid(actor);
      const arcflight = isArcflightRunnerShipActor(actor);
      return {
        id: actor.id ?? "",
        uuid,
        name: actor.name ?? actor.id ?? "Unnamed Vehicle",
        type: actor.type ?? "",
        arcflight,
        label: `${actor.name ?? actor.id ?? "Unnamed Vehicle"}${arcflight ? " (Arcflight ship)" : " (PF2E vehicle)"}`,
        selected: Boolean((selectedUuid && uuid === selectedUuid) || (selectedId && actor.id === selectedId))
      };
    })
    .sort((a, b) => Number(b.arcflight) - Number(a.arcflight) || a.name.localeCompare(b.name));
  if (!actors.some((actor) => actor.selected) && actors[0]) actors[0].selected = true;
  return actors;
}


function emptyStationAssignment(source = "empty", overridden = false) {
  return { actorId: "", actorUuid: "", actorName: "", actorType: "", source, overridden: Boolean(overridden) };
}

function normalizeAssignmentSource(value, hasActor = false) {
  if (["ship", "override", "manual", "empty"].includes(value)) return value;
  return hasActor ? "manual" : "empty";
}

function normalizeStationAssignment(value = null) {
  if (!isPlainObject(value)) return emptyStationAssignment();
  const actorId = typeof value.actorId === "string" ? value.actorId : (typeof value.id === "string" ? value.id : "");
  const actorUuid = typeof value.actorUuid === "string" ? value.actorUuid : (typeof value.uuid === "string" ? value.uuid : "");
  const actorName = typeof value.actorName === "string" ? value.actorName : (typeof value.name === "string" ? value.name : "");
  const actorType = typeof value.actorType === "string" ? value.actorType : (typeof value.type === "string" ? value.type : "");
  const hasActor = Boolean(actorId || actorUuid || actorName || actorType);
  const source = normalizeAssignmentSource(value.source, hasActor);
  return { actorId, actorUuid, actorName, actorType, source, overridden: value.overridden === true || source === "override" };
}

function actorTypeFromAssigneeType(assigneeType = "") {
  if (assigneeType === "npc") return "npc";
  if (assigneeType === "crewAsset") return "crewAsset";
  return assigneeType || "actor";
}

function normalizeShipStationAssignment(assignment = null) {
  if (!isPlainObject(assignment)) return emptyStationAssignment();
  const actorId = typeof assignment.actorId === "string" ? assignment.actorId : "";
  const actorUuid = typeof assignment.actorUuid === "string" ? assignment.actorUuid : "";
  const actorName = typeof assignment.name === "string" ? assignment.name : (typeof assignment.actorName === "string" ? assignment.actorName : "");
  const actorType = typeof assignment.actorType === "string" ? assignment.actorType : actorTypeFromAssigneeType(assignment.assigneeType);
  if (!actorId && !actorUuid && !actorName) return emptyStationAssignment();
  return { actorId, actorUuid, actorName, actorType, source: "ship", overridden: false };
}

function getShipStationAssignmentData(ship = null) {
  if (!ship || typeof ship !== "object") return {};
  const flagSystem = ship.getFlag?.(ARCFLIGHT_MODULE_ID, "system") ?? {};
  const directAssignments = ship.stationAssignments ?? ship.stations?.assignments ?? ship.system?.stations?.assignments ?? flagSystem?.stations?.assignments ?? {};
  return isPlainObject(directAssignments) ? directAssignments : {};
}

export function getTravelEventRunnerShipStationAssignments(ship = null, options = {}) {
  const assignments = getShipStationAssignmentData(ship ?? options.ship ?? options.actor);
  return Object.fromEntries(TRAVEL_FIVE_STATION_KEYS.map((stationKey) => [stationKey, normalizeShipStationAssignment(assignments[stationKey])]));
}

export function normalizeTravelEventRunnerStationAssignments(value = {}, options = {}) {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(TRAVEL_FIVE_STATION_KEYS.map((stationKey) => [stationKey, normalizeStationAssignment(source[stationKey])]));
}

function isAssignedStationActor(actor, selectedShip = {}) {
  if (!actor || typeof actor !== "object") return false;
  const uuid = actorUuid(actor);
  if (actor.type === "vehicle") return false;
  if (selectedShip.actorId && actor.id === selectedShip.actorId) return false;
  if (selectedShip.actorUuid && uuid === selectedShip.actorUuid) return false;
  return true;
}

function actorOptionSortRank(actor) {
  if (["character", "npc", "familiar"].includes(actor?.type)) return 0;
  return 1;
}

export function getTravelEventRunnerStationActorOptions(options = {}) {
  const selectedShip = normalizeTravelEventRunnerShipSelection(options.ship ?? options.shipSelection ?? options.actor ?? options);
  const selectedId = String(options.selectedActorId ?? options.actorId ?? "");
  const selectedUuid = String(options.selectedActorUuid ?? options.actorUuid ?? "");
  return actorCollectionValues(getActorCollection(options))
    .filter((actor) => isAssignedStationActor(actor, selectedShip))
    .map((actor) => {
      const uuid = actorUuid(actor);
      const name = actor.name ?? actor.id ?? "Unnamed Actor";
      const type = actor.type ?? "";
      return {
        actorId: actor.id ?? "",
        actorUuid: uuid,
        actorName: name,
        actorType: type,
        id: actor.id ?? "",
        uuid,
        name,
        type,
        label: `${name}${type ? ` (${humanizeIdentifier(type)})` : ""}`,
        selected: Boolean((selectedUuid && uuid === selectedUuid) || (selectedId && actor.id === selectedId))
      };
    })
    .sort((a, b) => actorOptionSortRank(a) - actorOptionSortRank(b) || a.actorName.localeCompare(b.actorName));
}

function findStationActorOption(actorIdOrUuid, options = {}) {
  const key = String(actorIdOrUuid ?? "");
  if (!key) return null;
  return getTravelEventRunnerStationActorOptions(options).find((actor) => actor.actorId === key || actor.actorUuid === key) ?? null;
}

export function updateTravelEventRunnerStationAssignment(session, stationKey, actorIdOrUuid, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  if (!TRAVEL_FIVE_STATION_KEYS.includes(stationKey)) return { ok: false, errors: [`Invalid travel runner station key "${stationKey}".`], warnings: [], session: cloneData(normalized.session) };
  const actor = findStationActorOption(actorIdOrUuid, { ...options, ship: normalized.session.ship });
  if (!actor) return { ok: false, errors: [`No eligible station actor found for "${String(actorIdOrUuid ?? "")}".`], warnings: [], session: cloneData(normalized.session) };
  const nextSession = cloneData(normalized.session);
  nextSession.stationAssignments = normalizeTravelEventRunnerStationAssignments(nextSession.stationAssignments);
  nextSession.stationAssignments[stationKey] = { actorId: actor.actorId, actorUuid: actor.actorUuid, actorName: actor.actorName, actorType: actor.actorType, source: "override", overridden: true };
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, assignment: cloneData(nextSession.stationAssignments[stationKey]) };
}

export function clearTravelEventRunnerStationAssignment(session, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  if (!TRAVEL_FIVE_STATION_KEYS.includes(stationKey)) return { ok: false, errors: [`Invalid travel runner station key "${stationKey}".`], warnings: [], session: cloneData(normalized.session) };
  const nextSession = cloneData(normalized.session);
  nextSession.stationAssignments = normalizeTravelEventRunnerStationAssignments(nextSession.stationAssignments);
  nextSession.stationAssignments[stationKey] = emptyStationAssignment("override", true);
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, assignment: cloneData(nextSession.stationAssignments[stationKey]) };
}

export function resetTravelEventRunnerStationAssignmentToShip(session, stationKey, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  if (!TRAVEL_FIVE_STATION_KEYS.includes(stationKey)) return { ok: false, errors: [`Invalid travel runner station key "${stationKey}".`], warnings: [], session: cloneData(normalized.session) };
  const shipAssignment = getTravelEventRunnerShipStationAssignments(options.ship ?? options.actor)[stationKey] ?? emptyStationAssignment();
  const nextSession = cloneData(normalized.session);
  nextSession.stationAssignments = normalizeTravelEventRunnerStationAssignments(nextSession.stationAssignments);
  nextSession.stationAssignments[stationKey] = shipAssignment.actorId || shipAssignment.actorUuid || shipAssignment.actorName ? shipAssignment : emptyStationAssignment();
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: shipAssignment.source === "empty" ? [`No ship assignment exists for ${humanizeIdentifier(stationKey)}.`] : [], session: nextSession, assignment: cloneData(nextSession.stationAssignments[stationKey]) };
}

function getActorByAssignment(assignment, options = {}) {
  if (!assignment?.actorId && !assignment?.actorUuid) return null;
  return actorCollectionValues(getActorCollection(options)).find((actor) => actor?.id === assignment.actorId || actorUuid(actor) === assignment.actorUuid) ?? null;
}


function normalizeSelectedStationSkills(roundResult = {}, round = null) {
  const source = isPlainObject(roundResult?.selectedStationSkills) ? roundResult.selectedStationSkills : {};
  const activeKeys = Array.isArray(round?.activeStations) ? round.activeStations : Object.keys(roundResult?.stationResults ?? {});
  return Object.fromEntries(activeKeys.map((stationKey) => [stationKey, typeof source[stationKey] === "string" ? source[stationKey] : ""]));
}

function resolveStationApproachSelection(roundResult, stationKey, card, suggestedSkills = []) {
  const approaches = Array.isArray(card?.skillApproaches) ? card.skillApproaches.filter((entry) => isPlainObject(entry) && typeof entry.skill === "string" && entry.skill.length > 0) : [];
  const storedSkill = typeof roundResult?.selectedStationSkills?.[stationKey] === "string" ? roundResult.selectedStationSkills[stationKey] : "";
  const selectedApproach = approaches.find((entry) => entry.skill === storedSkill) ?? approaches[0] ?? null;
  const fallbackSkill = Array.isArray(suggestedSkills) ? suggestedSkills.find(Boolean) : "";
  const skill = selectedApproach?.skill || fallbackSkill || "";
  const label = selectedApproach?.label || (skill ? humanizeIdentifier(skill) : "Approach");
  return {
    skill,
    label,
    helpText: selectedApproach?.helpText ?? "",
    source: selectedApproach ? "stationCard" : (fallbackSkill ? "suggestedSkills" : "default"),
    options: approaches.map((entry) => ({
      skill: entry.skill,
      label: entry.label || humanizeIdentifier(entry.skill),
      helpText: entry.helpText || "",
      selected: entry.skill === skill
    }))
  };
}

function resolveSafeStatisticLabel(actor, suggestedSkills = []) {
  const key = Array.isArray(suggestedSkills) ? suggestedSkills.find(Boolean) : "";
  if (!key) return "No rollable statistic found";
  const label = humanizeIdentifier(key);
  if (!actor) return `${label} (unavailable)`;
  const statistic = key === "perception"
    ? (actor?.system?.perception ?? actor?.system?.attributes?.perception ?? actor?.perception ?? actor?.system?.proficiencies?.perception ?? actor?.system?.skills?.perception ?? actor?.system?.statistics?.perception ?? actor?.skills?.perception ?? actor?.statistics?.perception ?? null)
    : (actor?.system?.skills?.[key] ?? actor?.system?.statistics?.[key] ?? actor?.skills?.[key] ?? actor?.statistics?.[key] ?? null);
  const mod = Number(statistic?.mod ?? statistic?.check?.mod ?? statistic?.totalModifier);
  if (Number.isFinite(mod)) return `${label} (${mod >= 0 ? "+" : ""}${mod})`;
  return `${label} (unavailable)`;
}

export function prepareTravelEventRunnerStationAssignmentState(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const assignments = normalizeTravelEventRunnerStationAssignments(normalized.session?.stationAssignments);
  const actorOptions = getTravelEventRunnerStationActorOptions({ ...options, ship: normalized.session?.ship });
  const rows = TRAVEL_FIVE_STATION_KEYS.map((stationKey) => {
    const assignment = assignments[stationKey];
    const assigned = Boolean(assignment.actorId || assignment.actorUuid || assignment.actorName);
    return {
      stationKey,
      stationName: humanizeIdentifier(stationKey),
      assignment,
      assigned,
      assignedActorName: assigned ? (assignment.actorName || "Unknown Actor") : "Unassigned",
      sourceLabel: assignment.source === "ship" ? "Ship" : (assignment.source === "override" ? "Temporary Override" : (assignment.source === "manual" ? "Manual" : "Empty")),
      hasShipSource: assignment.source === "ship",
      hasOverride: assignment.overridden === true,
      options: actorOptions.map((actor) => ({ ...actor, selected: Boolean((assignment.actorUuid && actor.actorUuid === assignment.actorUuid) || (assignment.actorId && actor.actorId === assignment.actorId)) })),
      canClear: assigned
    };
  });
  return { ok: normalized.ok, errors: normalized.errors ?? [], warnings: normalized.warnings ?? [], session: normalized.session, rows, actorOptions };
}

function normalizeTravelEventRunnerShipSelection(selection = null) {
  const actor = selection?.actor ?? (selection?.type === "vehicle" ? selection : null);
  const source = actor ?? selection ?? {};
  const id = typeof source.id === "string" ? source.id : (typeof source.actorId === "string" ? source.actorId : "");
  const uuid = typeof source.uuid === "string" ? source.uuid : (typeof source.actorUuid === "string" ? source.actorUuid : actorUuid(actor));
  const name = typeof source.name === "string" ? source.name : (typeof source.actorName === "string" ? source.actorName : "");
  return {
    actorId: id,
    actorUuid: uuid,
    actorName: name,
    actorType: typeof source.type === "string" ? source.type : (typeof source.actorType === "string" ? source.actorType : ""),
    arcflight: source.arcflight === true || isArcflightRunnerShipActor(actor)
  };
}


function resolveTravelEventRunnerShipActor(selection = null, options = {}) {
  if (selection && typeof selection === "object" && typeof selection.getFlag === "function") return selection;
  const normalized = normalizeTravelEventRunnerShipSelection(selection ?? options.ship ?? options.actor ?? options);
  return actorCollectionValues(getActorCollection(options)).find((candidate) => (normalized.actorUuid && actorUuid(candidate) === normalized.actorUuid) || (normalized.actorId && candidate?.id === normalized.actorId)) ?? null;
}

function normalizeEventForRunner(event) {
  const rounds = Array.isArray(event?.rounds) ? event.rounds.map(normalizeRoundDefinition) : [];
  return {
    key: typeof event?.key === "string" ? event.key : "",
    name: typeof event?.name === "string" ? event.name : (typeof event?.key === "string" ? humanizeIdentifier(event.key) : "Untitled Travel Event"),
    category: typeof event?.category === "string" ? event.category : "",
    categoryLabel: humanizeIdentifier(event?.category),
    baseDC: Number.isFinite(Number(event?.baseDC)) ? Number(event.baseDC) : 0,
    roundCount: Number.isInteger(Number(event?.roundCount)) && Number(event.roundCount) > 0 ? Number(event.roundCount) : rounds.length,
    rounds,
    finalOutcomes: normalizeFinalOutcomes(event?.finalOutcomes)
  };
}

function validateRunnerEvent(event, options = {}) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) errors.push("Travel Event Runner requires a finalized published event object.");
  if (event?.builder !== undefined) errors.push("Travel Event Runner cannot start from a draft containing builder metadata.");
  if (!Array.isArray(event?.rounds) || event.rounds.length === 0) errors.push("Travel Event Runner requires at least one round.");
  const validation = event && typeof event === "object" && !Array.isArray(event) ? validateTravelEventDefinition(event, { ...options, strictAuthoring: true }) : { ok: false, errors: [], warnings: [] };
  errors.push(...(validation.errors ?? []));
  return { ok: errors.length === 0, errors, warnings: validation.warnings ?? [], validation };
}

function createRoundResults(event) {
  return event.rounds.map((round, index) => ({
    roundIndex: index,
    roundNumber: round.round,
    title: round.title,
    stationResults: Object.fromEntries(round.activeStations.map((stationKey) => [stationKey, null])),
    selectedStationSkills: Object.fromEntries(round.activeStations.map((stationKey) => [stationKey, ""]))
  }));
}

export function prepareTravelEventRunnerLibraryState(options = {}) {
  const state = preparePublishedTravelEventLibraryState(options);
  const selectedId = typeof options.selectedEventId === "string" ? options.selectedEventId : "";
  const entries = (state.entries ?? []).map((entry, index) => ({
    ...entry,
    categoryLabel: humanizeIdentifier(entry.category),
    publishedAtLabel: entry.publishedAt ? new Date(entry.publishedAt).toLocaleString() : "",
    selected: selectedId ? entry.id === selectedId || entry.key === selectedId : index === 0
  }));
  return { ...state, entries, selectedEventId: entries.find((entry) => entry.selected)?.id ?? "", hasLoadableEvents: entries.some((entry) => entry.canLoad) };
}

export function createTravelEventRunnerSession(event, options = {}) {
  const runnerValidation = validateRunnerEvent(event, options);
  if (!runnerValidation.ok) return { ok: false, errors: runnerValidation.errors, warnings: runnerValidation.warnings, session: null };

  const normalizedEvent = normalizeEventForRunner(event);
  const shipActor = resolveTravelEventRunnerShipActor(options.ship ?? options.actor ?? options, options);
  const shipSelection = normalizeTravelEventRunnerShipSelection(shipActor ?? options.ship ?? options.actor ?? options);
  const timestamp = nowIso(options);
  const session = {
    version: TRAVEL_EVENT_RUNNER_SESSION_VERSION,
    status: "active",
    event: normalizedEvent,
    currentRoundIndex: 0,
    roundResults: createRoundResults(normalizedEvent),
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: "",
    summary: null,
    ship: shipSelection,
    notes: typeof options.notes === "string" ? options.notes.trim() : "",
    stationAssignments: normalizeTravelEventRunnerStationAssignments(Object.hasOwn(options, "stationAssignments") ? options.stationAssignments : getTravelEventRunnerShipStationAssignments(shipActor ?? options.ship ?? options.actor))
  };

  return { ok: true, errors: [], warnings: runnerValidation.warnings, session };
}

export function normalizeTravelEventRunnerSession(session, options = {}) {
  const errors = [];
  if (!session || typeof session !== "object" || Array.isArray(session)) return { ok: false, errors: ["Travel Event Runner session is malformed."], warnings: [], session: null };
  const event = normalizeEventForRunner(session.event ?? {});
  if (event.rounds.length === 0) errors.push("Travel Event Runner session has no rounds.");
  const currentRoundIndex = Math.min(Math.max(Number.isInteger(Number(session.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0, 0), Math.max(event.rounds.length - 1, 0));
  const roundResults = createRoundResults(event).map((roundResult, index) => {
    const source = Array.isArray(session.roundResults) ? session.roundResults[index] : null;
    const sourceResults = source?.stationResults && typeof source.stationResults === "object" && !Array.isArray(source.stationResults) ? source.stationResults : {};
    return {
      ...roundResult,
      stationResults: Object.fromEntries(Object.keys(roundResult.stationResults).map((stationKey) => [stationKey, TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(sourceResults[stationKey]) ? sourceResults[stationKey] : null])),
      selectedStationSkills: normalizeSelectedStationSkills(source, event.rounds[index])
    };
  });
  const normalized = {
    key: typeof session.key === "string" ? session.key : "",
    name: typeof session.name === "string" ? session.name : "",
    version: TRAVEL_EVENT_RUNNER_SESSION_VERSION,
    status: ["active", "completed"].includes(session.status) ? session.status : "active",
    event,
    currentRoundIndex,
    roundResults,
    startedAt: typeof session.startedAt === "string" ? session.startedAt : nowIso(options),
    updatedAt: typeof session.updatedAt === "string" ? session.updatedAt : nowIso(options),
    completedAt: typeof session.completedAt === "string" ? session.completedAt : "",
    summary: session.summary && typeof session.summary === "object" ? cloneData(session.summary) : null,
    appliedEffects: normalizeTravelEventAppliedEffects(session.appliedEffects),
    ship: normalizeTravelEventRunnerShipSelection(session.ship ?? session.shipSelection ?? session.actor ?? null),
    notes: typeof session.notes === "string" ? session.notes : "",
    stationAssignments: normalizeTravelEventRunnerStationAssignments(session.stationAssignments)
  };
  return { ok: errors.length === 0, errors, warnings: [], session: normalized };
}

function normalizeTravelEventAppliedEffects(appliedEffects = {}) {
  const source = isPlainObject(appliedEffects) ? appliedEffects : {};
  const records = Array.isArray(source.records) ? source.records.filter(isPlainObject).map((record) => ({
    applicationId: typeof record.applicationId === "string" ? record.applicationId : "",
    effectId: typeof record.effectId === "string" ? record.effectId : (typeof record.effectKey === "string" ? record.effectKey : ""),
    effectKey: typeof record.effectKey === "string" ? record.effectKey : (typeof record.effectId === "string" ? record.effectId : ""),
    effectIndex: Number.isInteger(Number(record.effectIndex)) ? Number(record.effectIndex) : null,
    effectLabel: typeof record.effectLabel === "string" ? record.effectLabel : (typeof record.label === "string" ? record.label : ""),
    label: typeof record.label === "string" ? record.label : (typeof record.effectLabel === "string" ? record.effectLabel : ""),
    effectType: typeof record.effectType === "string" ? record.effectType : "",
    resource: typeof record.resource === "string" ? record.resource : "",
    mode: typeof record.mode === "string" ? record.mode : "",
    value: Number.isFinite(Number(record.value)) ? Number(record.value) : null,
    actorId: typeof record.actorId === "string" ? record.actorId : "",
    actorName: typeof record.actorName === "string" ? record.actorName : "",
    beforeValue: Number.isFinite(Number(record.beforeValue)) ? Number(record.beforeValue) : null,
    afterValue: Number.isFinite(Number(record.afterValue)) ? Number(record.afterValue) : null,
    appliedAt: typeof record.appliedAt === "string" ? record.appliedAt : "",
    appliedByUserId: typeof record.appliedByUserId === "string" ? record.appliedByUserId : "",
    appliedByUserName: typeof record.appliedByUserName === "string" ? record.appliedByUserName : "",
    source: record.source === "travel-event-runner" ? "travel-event-runner" : "travel-event-runner",
    undone: record.undone === true,
    undoneAt: typeof record.undoneAt === "string" ? record.undoneAt : "",
    undoneByUserId: typeof record.undoneByUserId === "string" ? record.undoneByUserId : "",
    undoneByUserName: typeof record.undoneByUserName === "string" ? record.undoneByUserName : "",
    undoBeforeValue: Number.isFinite(Number(record.undoBeforeValue)) ? Number(record.undoBeforeValue) : null,
    undoAfterValue: Number.isFinite(Number(record.undoAfterValue)) ? Number(record.undoAfterValue) : null,
    undoReason: typeof record.undoReason === "string" ? record.undoReason : ""
  })) : [];
  return { records };
}

function prepareStationRows(session, round, roundResult, options = {}) {
  const assignments = normalizeTravelEventRunnerStationAssignments(session?.stationAssignments);
  return round.activeStations.map((stationKey) => {
    const station = getStation(stationKey) ?? {};
    const prompt = round.stationPrompts[stationKey] ?? { stationKey };
    const card = (Array.isArray(round.stationCards) ? round.stationCards : []).find((entry) => entry?.stationKey === stationKey) ?? normalizeStationCardForRunner(stationKey, null, prompt);
    const suggestedSkills = Array.isArray(prompt.suggestedSkills) && prompt.suggestedSkills.length > 0
      ? prompt.suggestedSkills
      : (Array.isArray(station.primarySkills) ? station.primarySkills : []);
    const result = roundResult?.stationResults?.[stationKey] ?? null;
    const assignment = assignments[stationKey] ?? emptyStationAssignment();
    const assignedActor = getActorByAssignment(assignment, options);
    const assigned = Boolean(assignment.actorId || assignment.actorUuid || assignment.actorName);
    const selectedApproach = resolveStationApproachSelection(roundResult, stationKey, card, suggestedSkills);
    return {
      stationKey,
      stationName: card.stationName || prompt.stationName || station.displayName || station.name || humanizeIdentifier(stationKey),
      prompt: prompt.playerAction || prompt.vignette || "No station prompt provided.",
      vignette: prompt.vignette || "",
      stationCard: card,
      problem: card.problem || prompt.playerAction || prompt.vignette || "No station card problem provided.",
      skillApproaches: selectedApproach.options,
      rollFeedback: card.rollFeedback ?? {},
      suggestedSkills,
      suggestedSkillsLabel: suggestedSkills.map(humanizeIdentifier).join(", "),
      assignment,
      assigned,
      assignedActorName: assigned ? (assignment.actorName || "Unknown Actor") : "Unassigned",
      assignmentSourceLabel: assignment.source === "ship" ? "Ship" : (assignment.source === "override" ? "Temporary Override" : (assignment.source === "manual" ? "Manual" : "Empty")),
      selectedApproach,
      selectedSkill: selectedApproach.skill,
      selectedSkillLabel: selectedApproach.skill ? humanizeIdentifier(selectedApproach.skill) : "No rollable statistic found",
      statisticLabel: resolveSafeStatisticLabel(assignedActor, [selectedApproach.skill]),
      result,
      resultLabel: result ? humanizeIdentifier(result) : "Unrecorded",
      resultFeedback: result ? (card.rollFeedback?.[result] ?? "") : "",
      hasResultFeedback: Boolean(result && card.rollFeedback?.[result]),
      resultOptions: TRAVEL_EVENT_RUNNER_RESULT_VALUES.map((value) => ({ value, label: humanizeIdentifier(value), selected: value === result }))
    };
  });
}

function resultTone(row) {
  if (["success", "criticalSuccess"].includes(row?.result)) return "success";
  if (["failure", "criticalFailure"].includes(row?.result)) return "failure";
  return "neutral";
}

function buildTravelEventRunnerRoundSummaryText(resolvedRows, successCount, failureCount) {
  if (!Array.isArray(resolvedRows) || resolvedRows.length === 0) return "";
  const hasMixedResults = successCount > 0 && failureCount > 0;
  const allSuccesses = successCount > 0 && failureCount === 0;
  const allFailures = failureCount > 0 && successCount === 0;
  const connectors = ["Meanwhile", "At the same time", "Before the problem can worsen", "Then"];
  return resolvedRows.map((row, index) => {
    const actorName = row.assignedActorName && row.assignedActorName !== "Unassigned" ? row.assignedActorName : "Unassigned crew";
    const approachLabel = row.selectedApproach?.label || row.selectedSkillLabel || "an approach";
    const stationName = row.stationName || humanizeIdentifier(row.stationKey);
    const resultLabel = row.resultLabel ? row.resultLabel.toLowerCase() : "unrecorded result";
    const feedback = row.resultFeedback || `${actorName}'s work at ${stationName} changes the round's momentum.`;
    const tone = resultTone(row);
    if (index === 0) {
      if (allSuccesses) return `The round steadies as ${actorName}'s ${approachLabel} at ${stationName} turns into a ${resultLabel}: ${feedback}`;
      if (allFailures) return `The round darkens as ${actorName}'s ${approachLabel} at ${stationName} collapses into a ${resultLabel}: ${feedback}`;
      if (tone === "failure") return `${actorName}'s ${approachLabel} at ${stationName} falters into a ${resultLabel}: ${feedback}`;
      return `${actorName}'s ${approachLabel} at ${stationName} creates an opening with a ${resultLabel}: ${feedback}`;
    }
    if (hasMixedResults && tone === "success" && failureCount > 0) return `Before the problem can worsen, ${actorName}'s ${approachLabel} at ${stationName} answers with a ${resultLabel}: ${feedback}`;
    if (hasMixedResults && tone === "failure" && successCount > 0) return `Then the pressure shifts to ${stationName}, where ${actorName}'s ${approachLabel} slips into a ${resultLabel}: ${feedback}`;
    const connector = connectors[(index - 1) % connectors.length];
    if (tone === "success") return `${connector}, ${actorName}'s ${approachLabel} at ${stationName} keeps control with a ${resultLabel}: ${feedback}`;
    if (tone === "failure") return `${connector}, ${actorName}'s ${approachLabel} at ${stationName} lets the danger spread with a ${resultLabel}: ${feedback}`;
    return `${connector}, ${actorName}'s ${approachLabel} at ${stationName} resolves as ${resultLabel}: ${feedback}`;
  }).join(" ");
}

export function prepareTravelEventRunnerRoundSummaryCard(session, round, roundResult, options = {}) {
  if (!session || !round || !roundResult) {
    return {
      hasResolvedStations: false,
      resolvedStationCount: 0,
      unresolvedStationCount: 0,
      successCount: 0,
      failureCount: 0,
      summaryLines: [],
      summaryText: ""
    };
  }
  const stationRows = prepareStationRows(session, round, roundResult, options);
  const resolvedRows = stationRows.filter((row) => Boolean(row.result));
  const successCount = resolvedRows.filter((row) => ["success", "criticalSuccess"].includes(row.result)).length;
  const failureCount = resolvedRows.filter((row) => ["failure", "criticalFailure"].includes(row.result)).length;
  const unresolvedStationCount = stationRows.length - resolvedRows.length;
  const summaryLines = resolvedRows.map((row) => {
    const actorName = row.assignedActorName && row.assignedActorName !== "Unassigned" ? row.assignedActorName : "Unassigned crew";
    const approachLabel = row.selectedApproach?.label || row.selectedSkillLabel || "an approach";
    const feedback = row.resultFeedback ? ` ${row.resultFeedback}` : "";
    return `${actorName} at ${row.stationName} used ${approachLabel} and scored ${row.resultLabel}.${feedback}`;
  });
  const summaryText = buildTravelEventRunnerRoundSummaryText(resolvedRows, successCount, failureCount);
  if (resolvedRows.length > 0) summaryLines.push(`Round state: ${successCount} success-side results, ${failureCount} failure-side results, ${unresolvedStationCount} unresolved stations.`);
  return {
    hasResolvedStations: resolvedRows.length > 0,
    resolvedStationCount: resolvedRows.length,
    unresolvedStationCount,
    successCount,
    failureCount,
    summaryLines,
    summaryText
  };
}

function getGameSettingRunnerSessionLibrary() {
  const settings = globalThis.game?.settings;
  if (!settings || typeof settings.get !== "function") return null;
  try {
    return settings.get(ARCFLIGHT_MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING);
  } catch (_error) {
    return null;
  }
}

async function setGameSettingRunnerSessionLibrary(library) {
  const settings = globalThis.game?.settings;
  if (!settings || typeof settings.set !== "function") throw new Error("Foundry game.settings is not available for the Travel Event Runner Session library.");
  return settings.set(ARCFLIGHT_MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING, cloneData(library));
}

function buildRunnerLibraryResult(ok, data = {}) {
  return {
    ok: Boolean(ok),
    errors: Array.isArray(data.errors) ? data.errors : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    ...data
  };
}

function createUniqueRunnerSessionKey(library, seed, options = {}) {
  const sessions = library?.sessions ?? {};
  const base = slugifySessionKey(seed || "travel-event-runner-session");
  if (!Object.hasOwn(sessions, base)) return base;

  const timestamp = nowIso(options).replace(/[^0-9]/g, "").slice(0, 14);
  const timestamped = `${base}-${timestamp}`;
  if (!Object.hasOwn(sessions, timestamped)) return timestamped;

  let index = 2;
  while (Object.hasOwn(sessions, `${timestamped}-${index}`)) index += 1;
  return `${timestamped}-${index}`;
}

function normalizeRunnerSessionLibraryEntry(key, entry = {}, options = {}) {
  const fallbackTimestamp = nowIso(options);
  const source = isPlainObject(entry) ? entry : {};
  const normalizedSession = normalizeTravelEventRunnerSession(isPlainObject(source.session) ? source.session : source, options);
  const session = normalizedSession.session;
  const event = session?.event ?? {};
  const status = ["active", "completed"].includes(source.status) ? source.status : (session?.status ?? "active");
  const entryKey = typeof source.key === "string" && source.key.length > 0 ? source.key : key;
  if (session && !session.key) session.key = entryKey;

  return {
    key: entryKey,
    name: typeof source.name === "string" && source.name.length > 0 ? source.name : (event.name ? `${event.name} Session` : entryKey),
    eventKey: typeof source.eventKey === "string" ? source.eventKey : (event.key ?? ""),
    eventName: typeof source.eventName === "string" && source.eventName.length > 0 ? source.eventName : (event.name ?? ""),
    eventCategory: typeof source.eventCategory === "string" ? source.eventCategory : (event.category ?? ""),
    status,
    currentRoundIndex: Number.isInteger(Number(source.currentRoundIndex)) ? Number(source.currentRoundIndex) : (session?.currentRoundIndex ?? 0),
    startedAt: typeof source.startedAt === "string" && source.startedAt.length > 0 ? source.startedAt : (session?.startedAt ?? fallbackTimestamp),
    completedAt: typeof source.completedAt === "string" ? source.completedAt : (session?.completedAt ?? ""),
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.length > 0 ? source.updatedAt : (session?.updatedAt ?? fallbackTimestamp),
    session: session ? cloneData(session) : null,
    isMalformed: normalizedSession.ok !== true,
    validationErrors: normalizedSession.errors ?? [],
    validationWarnings: normalizedSession.warnings ?? []
  };
}

function normalizeTravelEventRunnerSessionLibraryData(rawLibrary, options = {}) {
  const source = isPlainObject(rawLibrary) ? rawLibrary : {};
  const sourceSessions = isPlainObject(source.sessions) ? source.sessions : {};
  const sessions = {};
  for (const [key, entry] of Object.entries(sourceSessions)) {
    if (typeof key !== "string" || key.length === 0) continue;
    sessions[key] = normalizeRunnerSessionLibraryEntry(key, entry, options);
  }
  return {
    version: Number.isInteger(source.version) ? source.version : TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION,
    sessions
  };
}

function getRunnerSessionLibraryEntries(library) {
  return Object.values(library.sessions ?? {}).sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function findRunnerSessionLibraryEntry(library, sessionKey) {
  const key = String(sessionKey ?? "");
  return library.sessions?.[key] ?? getRunnerSessionLibraryEntries(library).find((candidate) => candidate.key === key) ?? null;
}

function publishedEventExistsForSession(entry, options = {}) {
  const eventKey = entry?.eventKey ?? entry?.session?.event?.key ?? "";
  if (!eventKey) return false;
  const library = getPublishedTravelEventLibrary(Object.hasOwn(options, "publishedLibrary") ? { ...options, library: options.publishedLibrary } : options);
  return Object.values(library.events ?? {}).some((candidate) => candidate.id === eventKey || candidate.key === eventKey);
}

export function cloneTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  return { ok: true, errors: [], warnings: normalized.warnings, session: cloneData(normalized.session) };
}

export function getTravelEventRunnerSessionLibrary(options = {}) {
  const rawLibrary = Object.hasOwn(options, "runnerSessionLibrary") ? options.runnerSessionLibrary : (Object.hasOwn(options, "library") ? options.library : getGameSettingRunnerSessionLibrary());
  return normalizeTravelEventRunnerSessionLibraryData(rawLibrary, options);
}

export async function saveTravelEventRunnerSessionToLibrary(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const library = getTravelEventRunnerSessionLibrary(options);
  if (!normalized.ok || !normalized.session) return buildRunnerLibraryResult(false, { errors: normalized.errors, warnings: normalized.warnings, library, entry: null, session: null });

  const overwrite = options.overwrite === true;
  const explicitKey = typeof options.key === "string" && options.key.length > 0 ? options.key : (typeof normalized.session.key === "string" && normalized.session.key.length > 0 ? normalized.session.key : "");
  const key = explicitKey || createUniqueRunnerSessionKey(library, `${normalized.session.event.key || normalized.session.event.name}-${nowIso(options)}`, options);
  if (Object.hasOwn(library.sessions, key) && !overwrite) {
    return buildRunnerLibraryResult(false, { errors: [`Runner session "${key}" already exists; pass overwrite: true or use Save Current Session As.`], warnings: [], library, entry: cloneData(library.sessions[key]), session: cloneData(normalized.session) });
  }

  const timestamp = nowIso(options);
  const existing = library.sessions[key] ?? null;
  const nextSession = cloneData(normalized.session);
  nextSession.key = key;
  nextSession.name = typeof options.name === "string" && options.name.length > 0 ? options.name : (existing?.name ?? nextSession.name ?? `${nextSession.event.name} Session`);
  nextSession.updatedAt = timestamp;
  if (nextSession.status === "completed" && !nextSession.summary) nextSession.summary = summarizeTravelEventRunnerSession(nextSession, options).summary;

  const entry = {
    key,
    name: nextSession.name,
    eventKey: nextSession.event.key,
    eventName: nextSession.event.name,
    eventCategory: nextSession.event.category,
    status: nextSession.status,
    currentRoundIndex: nextSession.currentRoundIndex,
    startedAt: nextSession.startedAt,
    completedAt: nextSession.completedAt,
    updatedAt: timestamp,
    session: nextSession
  };

  const nextLibrary = { ...library, version: TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION, sessions: { ...library.sessions, [key]: entry } };
  if (!options.dryRun) await setGameSettingRunnerSessionLibrary(nextLibrary);
  return buildRunnerLibraryResult(true, { warnings: [], library: nextLibrary, entry: cloneData(entry), session: cloneData(nextSession) });
}

export function loadTravelEventRunnerSessionFromLibrary(sessionKey, options = {}) {
  const library = getTravelEventRunnerSessionLibrary(options);
  const entry = findRunnerSessionLibraryEntry(library, sessionKey);
  if (!entry) return buildRunnerLibraryResult(false, { errors: [`No Travel Event Runner session found for "${String(sessionKey ?? "")}".`], warnings: [], library, entry: null, session: null });
  if (!entry.session || entry.isMalformed) return buildRunnerLibraryResult(false, { errors: entry.validationErrors?.length ? entry.validationErrors : [`Travel Event Runner session "${entry.key}" is malformed and cannot be loaded.`], warnings: entry.validationWarnings ?? [], library, entry: cloneData(entry), session: null });
  const normalized = normalizeTravelEventRunnerSession(entry.session, options);
  if (!normalized.ok) return buildRunnerLibraryResult(false, { errors: normalized.errors, warnings: normalized.warnings, library, entry: cloneData(entry), session: null });
  const session = cloneData(normalized.session);
  session.key = entry.key;
  const warnings = [...(normalized.warnings ?? [])];
  if (!publishedEventExistsForSession(entry, options)) warnings.push(`Saved runner session "${entry.name}" references published event "${entry.eventKey || entry.eventName || "<missing>"}", which is not currently in the Published Travel Event Library. Loading the saved session snapshot only.`);
  return buildRunnerLibraryResult(true, { warnings, library, entry: cloneData(entry), session });
}

export async function deleteTravelEventRunnerSessionFromLibrary(sessionKey, options = {}) {
  const library = getTravelEventRunnerSessionLibrary(options);
  const entry = findRunnerSessionLibraryEntry(library, sessionKey);
  if (!entry) return buildRunnerLibraryResult(false, { errors: [`No Travel Event Runner session found for "${String(sessionKey ?? "")}".`], warnings: [], library, deleted: null });
  const { [entry.key]: _deleted, ...remainingSessions } = library.sessions;
  const nextLibrary = { ...library, sessions: remainingSessions };
  if (!options.dryRun) await setGameSettingRunnerSessionLibrary(nextLibrary);
  return buildRunnerLibraryResult(true, { warnings: [], library: nextLibrary, deleted: cloneData(entry) });
}

export async function duplicateTravelEventRunnerSession(sessionKey, options = {}) {
  const loaded = loadTravelEventRunnerSessionFromLibrary(sessionKey, options);
  if (!loaded.ok || !loaded.session) return buildRunnerLibraryResult(false, { errors: loaded.errors, warnings: loaded.warnings, library: loaded.library, entry: null, session: null });
  const key = createUniqueRunnerSessionKey(loaded.library, `${loaded.entry?.key ?? sessionKey}-copy`, options);
  const session = cloneData(loaded.session);
  session.key = key;
  const name = typeof options.name === "string" && options.name.length > 0 ? options.name : `${loaded.entry?.name ?? session.event.name ?? key} Copy`;
  return saveTravelEventRunnerSessionToLibrary(session, { ...options, library: loaded.library, key, name, overwrite: false });
}

export function prepareTravelEventRunnerSessionLibraryState(options = {}) {
  const library = getTravelEventRunnerSessionLibrary(options);
  const selectedSessionKey = typeof options.selectedSessionKey === "string" ? options.selectedSessionKey : "";
  const entries = getRunnerSessionLibraryEntries(library).map((entry) => ({
    ...cloneData(entry),
    session: undefined,
    eventCategoryLabel: humanizeIdentifier(entry.eventCategory),
    statusLabel: humanizeIdentifier(entry.status),
    currentRoundNumber: Number(entry.currentRoundIndex ?? 0) + 1,
    updatedAtLabel: entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : "",
    startedAtLabel: entry.startedAt ? new Date(entry.startedAt).toLocaleString() : "",
    completedAtLabel: entry.completedAt ? new Date(entry.completedAt).toLocaleString() : "",
    canLoad: entry.isMalformed !== true && Boolean(entry.session),
    canDuplicate: entry.isMalformed !== true && Boolean(entry.session),
    canDelete: true,
    selected: selectedSessionKey ? entry.key === selectedSessionKey : false,
    missingPublishedEvent: !publishedEventExistsForSession(entry, options)
  }));
  return Object.freeze({
    settingKey: `${ARCFLIGHT_MODULE_ID}.${TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING}`,
    version: library.version,
    entries,
    count: entries.length,
    hasSessions: entries.length > 0,
    selectedSessionKey
  });
}

export function prepareTravelEventRunnerState(session = null, options = {}) {
  const libraryState = prepareTravelEventRunnerLibraryState(options);
  const sessionLibraryOptions = Object.hasOwn(options, "runnerSessionLibrary") ? { ...options, library: options.runnerSessionLibrary } : options;
  const sessionLibraryState = prepareTravelEventRunnerSessionLibraryState(sessionLibraryOptions);
  const normalized = session ? normalizeTravelEventRunnerSession(session, options) : { ok: true, errors: [], warnings: [], session: null };
  const activeSession = normalized.session;
  const currentRound = activeSession?.event.rounds[activeSession.currentRoundIndex] ?? null;
  const currentRoundResult = activeSession?.roundResults[activeSession.currentRoundIndex] ?? null;
  const summary = activeSession?.status === "completed" ? summarizeTravelEventRunnerSession(activeSession, options).summary : null;
  const stations = activeSession && currentRound ? prepareStationRows(activeSession, currentRound, currentRoundResult, options) : [];
  const roundSummaryCard = activeSession && currentRound ? prepareTravelEventRunnerRoundSummaryCard(activeSession, currentRound, currentRoundResult, options) : prepareTravelEventRunnerRoundSummaryCard(null, null, null, options);

  return {
    ok: normalized.ok,
    errors: normalized.errors,
    warnings: normalized.warnings,
    library: libraryState,
    sessionLibrary: sessionLibraryState,
    hasSavedSessions: sessionLibraryState.hasSessions === true,
    canSaveSession: Boolean(activeSession),
    canSaveSessionAs: Boolean(activeSession),
    hasPublishedEvents: libraryState.hasEvents === true,
    hasLoadableEvents: libraryState.hasLoadableEvents === true,
    canImportSession: true,
    canExportSession: Boolean(activeSession),
    currentSessionName: activeSession?.name || (activeSession?.event?.name ? `${activeSession.event.name} Session` : "No active session"),
    currentSessionStatusLabel: activeSession ? humanizeIdentifier(activeSession.status) : "No Active Session",
    session: activeSession,
    hasSession: Boolean(activeSession),
    isCompleted: activeSession?.status === "completed",
    event: activeSession?.event ?? null,
    currentRound,
    currentRoundNumber: currentRound ? activeSession.currentRoundIndex + 1 : 0,
    currentRoundTitle: currentRound?.title ?? "",
    currentRoundOpeningVignette: currentRound?.openingVignette ?? "",
    stationAssignments: activeSession ? prepareTravelEventRunnerStationAssignmentState(activeSession, options) : { rows: [], actorOptions: [] },
    stations,
    roundSummaryCard,
    hasStations: Boolean(activeSession && currentRound && currentRound.activeStations.length > 0),
    canRetreat: Boolean(activeSession && activeSession.currentRoundIndex > 0 && activeSession.status !== "completed"),
    canAdvance: Boolean(activeSession && activeSession.currentRoundIndex < activeSession.event.rounds.length - 1 && activeSession.status !== "completed"),
    canComplete: Boolean(activeSession && activeSession.status !== "completed"),
    summary,
    summaryOutput: prepareTravelEventRunnerSummaryOutputState(activeSession, options),
    stagedEffectReview: prepareTravelEventStagedEffectReviewState(activeSession, options),
    summaryJson: summary ? exportTravelEventRunnerSessionToJson(activeSession, options).json : ""
  };
}

export function setTravelEventRunnerStationResult(session, roundIndex, stationKey, result, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  if (!TRAVEL_EVENT_RUNNER_RESULT_VALUES.includes(result)) return { ok: false, errors: [`Invalid travel runner station result "${result}".`], warnings: [], session: normalized.session };
  const index = Number(roundIndex);
  if (!Number.isInteger(index) || !normalized.session.roundResults[index]) return { ok: false, errors: [`Travel runner round ${roundIndex} does not exist.`], warnings: [], session: normalized.session };
  if (!Object.hasOwn(normalized.session.roundResults[index].stationResults, stationKey)) return { ok: false, errors: [`Station "${stationKey}" is not active in round ${index + 1}.`], warnings: [], session: normalized.session };
  const nextSession = cloneData(normalized.session);
  nextSession.roundResults[index].stationResults[stationKey] = result;
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function setTravelEventRunnerStationSkillApproach(session, roundIndex, stationKey, skill, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const index = Number(roundIndex);
  if (!Number.isInteger(index) || !normalized.session.roundResults[index]) return { ok: false, errors: [`Travel runner round ${roundIndex} does not exist.`], warnings: [], session: normalized.session };
  const round = normalized.session.event.rounds[index];
  if (!round?.activeStations?.includes(stationKey)) return { ok: false, errors: [`Station "${stationKey}" is not active in round ${index + 1}.`], warnings: [], session: normalized.session };
  const prompt = round.stationPrompts[stationKey] ?? { stationKey };
  const card = (Array.isArray(round.stationCards) ? round.stationCards : []).find((entry) => entry?.stationKey === stationKey) ?? normalizeStationCardForRunner(stationKey, null, prompt);
  const approaches = Array.isArray(card.skillApproaches) ? card.skillApproaches.filter((entry) => isPlainObject(entry) && entry.skill) : [];
  if (approaches.length > 0 && !approaches.some((entry) => entry.skill === skill)) return { ok: false, errors: [`Skill approach "${skill}" is not available for ${stationKey}.`], warnings: [], session: normalized.session };
  const nextSession = cloneData(normalized.session);
  nextSession.roundResults[index].selectedStationSkills = normalizeSelectedStationSkills(nextSession.roundResults[index], round);
  nextSession.roundResults[index].selectedStationSkills[stationKey] = typeof skill === "string" ? skill : "";
  nextSession.updatedAt = nowIso(options);
  nextSession.summary = null;
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function advanceTravelEventRunnerRound(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.currentRoundIndex = Math.min(nextSession.currentRoundIndex + 1, nextSession.event.rounds.length - 1);
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

export function retreatTravelEventRunnerRound(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.currentRoundIndex = Math.max(nextSession.currentRoundIndex - 1, 0);
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession };
}

function scoreSession(session) {
  return session.roundResults.reduce((total, round) => total + Object.values(round.stationResults).reduce((subtotal, result) => subtotal + (RESULT_SCORES[result] ?? 0), 0), 0);
}

function mapScoreToFinalOutcome(score) {
  // MVP mapping is intentionally simple and transparent: each station result is
  // worth -2..+2, then the final total chooses a canonical final outcome.
  if (score >= 4) return "criticalSuccess";
  if (score > 0) return "success";
  if (score === 0) return "mixed";
  if (score <= -4) return "criticalFailure";
  return "failure";
}

export function summarizeTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, summary: null, json: "" };
  const activeSession = normalized.session;
  const totalScore = scoreSession(activeSession);
  const suggestedFinalOutcome = mapScoreToFinalOutcome(totalScore);
  const finalOutcome = activeSession.event.finalOutcomes[suggestedFinalOutcome] ?? { key: suggestedFinalOutcome, label: FINAL_OUTCOME_LABELS[suggestedFinalOutcome], text: "", proposedEffects: [] };
  const summary = {
    version: TRAVEL_EVENT_RUNNER_SESSION_VERSION,
    event: {
      key: activeSession.event.key,
      name: activeSession.event.name,
      category: activeSession.event.category,
      baseDC: activeSession.event.baseDC
    },
    startedAt: activeSession.startedAt,
    completedAt: activeSession.completedAt || nowIso(options),
    totalScore,
    suggestedFinalOutcome,
    suggestedFinalOutcomeLabel: finalOutcome.label || FINAL_OUTCOME_LABELS[suggestedFinalOutcome],
    finalOutcomeText: finalOutcome.text || "",
    stagedProposedEffects: cloneData(finalOutcome.proposedEffects ?? []),
    stagedProposedEffectRows: (finalOutcome.proposedEffects ?? []).map((effect, index) => ({ index, json: JSON.stringify(effect, null, 2) })),
    rounds: activeSession.roundResults.map((roundResult, index) => ({
      roundIndex: index,
      roundNumber: roundResult.roundNumber,
      title: roundResult.title,
      stationResults: cloneData(roundResult.stationResults)
    }))
  };
  return { ok: true, errors: [], warnings: [], session: activeSession, summary };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEffectForReport(effect, index) {
  const label = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : `Proposed Effect ${index + 1}`;
  return { index, label, json: JSON.stringify(effect ?? {}, null, 2) };
}

export function prepareTravelEventResourceEffectPreview(effect, shipOrResources = null, options = {}) {
  const resources = resolveReviewResources(shipOrResources ?? options.ship ?? options.resources ?? null);
  const resource = effect?.resource;
  const mode = effect?.mode;
  const value = Number(effect?.value);
  const currentValue = resources && Object.hasOwn(resources, resource) && Number.isFinite(Number(resources[resource])) ? Number(resources[resource]) : null;
  let previewValue = currentValue == null || !Number.isFinite(value) ? null : (mode === "set" ? value : currentValue + value);
  const warnings = [];
  const actor = options.ship ?? null;
  if (actor && currentValue != null && Number.isFinite(value)) {
    try {
      const changes = { [resource]: (mode === "set" ? value : currentValue + value) - currentValue };
      const helperPreview = previewShipTravelResourceChange(actor, changes);
      previewValue = helperPreview.after?.[resource] ?? previewValue;
      warnings.push(...(helperPreview.warnings ?? []));
    } catch (_error) {
      // Review previews can also run against plain resource snapshots.
    }
  }
  const maxKey = getResourceMaxKey(resource);
  const maxValue = maxKey && resources && Number.isFinite(Number(resources[maxKey])) ? Number(resources[maxKey]) : null;
  if (previewValue != null && previewValue < 0) warnings.push(`${resource} preview value ${previewValue} is below minimum 0.`);
  if (previewValue != null && maxValue != null && maxValue > 0 && previewValue > maxValue) warnings.push(`${resource} preview value ${previewValue} exceeds known maximum ${maxValue}.`);
  return { resources, currentValue, previewValue, hasCurrentValue: currentValue != null, hasPreviewValue: previewValue != null, maxValue, warnings };
}

export function normalizeTravelEventProposedEffectForReview(effect, index, options = {}) {
  const rawJson = JSON.stringify(effect ?? null, null, 2);
  const label = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : `Staged Effect ${index + 1}`;
  const base = { index, displayIndex: index + 1, label, type: typeof effect?.type === "string" ? effect.type : "unsupported", resource: "", mode: "", value: null, currentValue: null, previewValue: null, hasCurrentValue: false, hasPreviewValue: false, status: "unsupported", supported: false, warnings: [], raw: cloneData(effect), rawJson };
  if (!isPlainObject(effect)) return { ...base, status: "unsupported", warnings: ["Effect is not a data object."] };
  if (effect.type === "note") return { ...base, type: "note", text: typeof effect.text === "string" ? effect.text : "", status: "note", supported: true };
  if (effect.type !== "resource") return base;

  const value = Number(effect.value);
  const warnings = [];
  if (!REVIEW_RESOURCE_KEYS.includes(effect.resource)) warnings.push(`Unsupported resource "${effect.resource ?? "<missing>"}".`);
  if (!REVIEW_RESOURCE_MODES.includes(effect.mode)) warnings.push(`Unsupported resource mode "${effect.mode ?? "<missing>"}".`);
  if (!Number.isFinite(value)) warnings.push(`Resource effect value "${effect.value ?? "<missing>"}" is not numeric.`);
  if (warnings.length) return { ...base, type: "resource", resource: effect.resource ?? "", mode: effect.mode ?? "", value: effect.value ?? null, status: "invalid", warnings };

  const preview = prepareTravelEventResourceEffectPreview(effect, options.ship ?? options.resources ?? null, options);
  return { ...base, type: "resource", resource: effect.resource, mode: effect.mode, value, currentValue: preview.currentValue, previewValue: preview.previewValue, hasCurrentValue: preview.hasCurrentValue, hasPreviewValue: preview.hasPreviewValue, status: "ready", supported: true, warnings: preview.warnings };
}

export function prepareTravelEventStagedEffectReview(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, reason: normalized.errors?.[0] ?? "Travel Event Runner session is malformed.", review: null };
  if (normalized.session.status !== "completed") return { ok: true, errors: [], warnings: [], session: normalized.session, available: false, reason: "Staged consequence review is unavailable until the runner session is completed.", review: null };
  const summarized = summarizeTravelEventRunnerSession(normalized.session, options);
  const summary = summarized.summary;
  const effects = Array.isArray(summary?.stagedProposedEffects) ? summary.stagedProposedEffects : [];
  const rows = effects.map((effect, index) => normalizeTravelEventProposedEffectForReview(effect, index, options));
  const supportedEffectCount = rows.filter((row) => row.supported).length;
  const unsupportedEffectCount = rows.length - supportedEffectCount;
  const review = {
    available: true,
    eventName: summary.event.name,
    finalOutcomeKey: summary.suggestedFinalOutcome,
    finalOutcomeLabel: summary.suggestedFinalOutcomeLabel,
    effectCount: rows.length,
    supportedEffectCount,
    unsupportedEffectCount,
    notAppliedWarning: REVIEW_NOT_APPLIED_WARNING,
    rows
  };
  return { ok: true, errors: [], warnings: [], session: normalized.session, available: true, review };
}

export function renderTravelEventStagedEffectReviewMarkdown(session, options = {}) {
  const prepared = prepareTravelEventStagedEffectReview(session, options);
  if (!prepared.available || !prepared.review) return { ...prepared, markdown: "" };
  const r = prepared.review;
  const lines = [`# Staged Consequence Review — ${r.eventName}`, "", `**${r.notAppliedWarning}**`, "", `- **Final Outcome:** ${r.finalOutcomeLabel}`, `- **Effect Count:** ${r.effectCount}`, `- **Supported Effects:** ${r.supportedEffectCount}`, `- **Unsupported Effects:** ${r.unsupportedEffectCount}`];
  if (!r.rows.length) lines.push("", "No proposed effects are attached to the final outcome.");
  for (const row of r.rows) {
    lines.push("", `## ${row.displayIndex}. ${row.label}`, `- **Type:** ${row.type}`, `- **Status:** ${row.status}`, `- **Resource:** ${valueDisplay(row.resource)}`, `- **Mode:** ${valueDisplay(row.mode)}`, `- **Value:** ${valueDisplay(row.value)}`, `- **Current Value:** ${valueDisplay(row.currentValue)}`, `- **Preview Value:** ${valueDisplay(row.previewValue)}`);
    if (row.warnings.length) lines.push(`- **Warnings:** ${row.warnings.join("; ")}`);
    lines.push("", "```json", row.rawJson, "```");
  }
  return { ...prepared, markdown: lines.join("\n") };
}

export function renderTravelEventStagedEffectReviewHtml(session, options = {}) {
  const prepared = prepareTravelEventStagedEffectReview(session, options);
  if (!prepared.available || !prepared.review) return { ...prepared, html: "" };
  const r = prepared.review;
  const rows = r.rows.length ? r.rows.map((row) => `<article class="arcflight-travel-runner-review__effect"><h3>${escapeHtml(row.displayIndex)}. ${escapeHtml(row.label)}</h3><dl><dt>Type</dt><dd>${escapeHtml(row.type)}</dd><dt>Status</dt><dd>${escapeHtml(row.status)}</dd><dt>Resource</dt><dd>${escapeHtml(valueDisplay(row.resource))}</dd><dt>Mode</dt><dd>${escapeHtml(valueDisplay(row.mode))}</dd><dt>Value</dt><dd>${escapeHtml(valueDisplay(row.value))}</dd><dt>Current Value</dt><dd>${escapeHtml(valueDisplay(row.currentValue))}</dd><dt>Preview Value</dt><dd>${escapeHtml(valueDisplay(row.previewValue))}</dd></dl>${row.warnings.length ? `<p><strong>Warnings:</strong> ${escapeHtml(row.warnings.join("; "))}</p>` : ""}<pre>${escapeHtml(row.rawJson)}</pre></article>`).join("") : "<p>No proposed effects are attached to the final outcome.</p>";
  const html = `<section class="arcflight-travel-runner-review"><h1>Staged Consequence Review — ${escapeHtml(r.eventName)}</h1><p><strong>${escapeHtml(r.notAppliedWarning)}</strong></p><ul><li><strong>Final Outcome:</strong> ${escapeHtml(r.finalOutcomeLabel)}</li><li><strong>Effect Count:</strong> ${escapeHtml(r.effectCount)}</li><li><strong>Supported Effects:</strong> ${escapeHtml(r.supportedEffectCount)}</li><li><strong>Unsupported Effects:</strong> ${escapeHtml(r.unsupportedEffectCount)}</li></ul>${rows}</section>`;
  return { ...prepared, html };
}

export function prepareTravelEventStagedEffectReviewState(session, options = {}) {
  const review = prepareTravelEventStagedEffectReview(session, options);
  const markdown = review.available ? renderTravelEventStagedEffectReviewMarkdown(session, options).markdown : "";
  const html = review.available ? renderTravelEventStagedEffectReviewHtml(session, options).html : "";
  return { ...review, markdown, html, canCopyMarkdown: review.available, canCopyHtml: review.available };
}

function resolveApplicationActor(actorOrId) {
  if (!actorOrId) return null;
  if (typeof actorOrId === "object") return actorOrId;
  return globalThis.game?.actors?.get?.(String(actorOrId)) ?? null;
}

function getEffectApplicationKey(effectRowOrIndex) {
  if (Number.isInteger(Number(effectRowOrIndex))) return { effectIndex: Number(effectRowOrIndex), effectId: "" };
  const row = effectRowOrIndex ?? {};
  const effectId = typeof row.effectId === "string" && row.effectId.length > 0 ? row.effectId : (typeof row.id === "string" ? row.id : "");
  const effectIndex = Number.isInteger(Number(row.index)) ? Number(row.index) : null;
  return { effectIndex, effectId };
}

function findStagedEffect(session, effectRowOrIndex, options = {}) {
  const summarized = summarizeTravelEventRunnerSession(session, options);
  const effects = Array.isArray(summarized.summary?.stagedProposedEffects) ? summarized.summary.stagedProposedEffects : [];
  const key = getEffectApplicationKey(effectRowOrIndex);
  if (key.effectIndex != null && effects[key.effectIndex] !== undefined) return { effect: effects[key.effectIndex], index: key.effectIndex, effectId: key.effectId };
  if (key.effectId) {
    const index = effects.findIndex((effect) => effect?.id === key.effectId || effect?.effectId === key.effectId);
    if (index >= 0) return { effect: effects[index], index, effectId: key.effectId };
  }
  return { effect: null, index: key.effectIndex, effectId: key.effectId };
}

export function getTravelEventAppliedEffectRecords(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return [];
  return cloneData(normalized.session.appliedEffects?.records ?? []);
}

export function isTravelEventEffectApplied(session, effectIdOrIndex, options = {}) {
  const key = getEffectApplicationKey(effectIdOrIndex);
  return getTravelEventAppliedEffectRecords(session, options).some((record) => {
    if (record.undone === true) return false;
    if (key.effectId) return record.effectId === key.effectId;
    return key.effectIndex != null && record.effectIndex === key.effectIndex;
  });
}

export function markTravelEventEffectApplied(session, appliedRecord, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  const nextSession = cloneData(normalized.session);
  const records = Array.isArray(nextSession.appliedEffects?.records) ? nextSession.appliedEffects.records : [];
  nextSession.appliedEffects = { records: [...records, cloneData(appliedRecord)] };
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, record: cloneData(appliedRecord) };
}

function buildResourceEffectChanges(actor, effect) {
  const resources = getShipTravelResources(actor);
  const value = Number(effect.value);
  const target = effect.mode === "set" ? value : resources[effect.resource] + value;
  return { [effect.resource]: target - resources[effect.resource] };
}

export function buildTravelEventAppliedEffectRecord(session, actor, effectRow, beforeAfter, options = {}) {
  const effect = effectRow?.raw ?? effectRow?.effect ?? effectRow;
  const index = Number.isInteger(Number(effectRow?.index)) ? Number(effectRow.index) : null;
  const effectId = typeof effect?.id === "string" ? effect.id : (typeof effect?.effectId === "string" ? effect.effectId : "");
  const effectLabel = typeof effect?.label === "string" && effect.label.trim() ? effect.label.trim() : (index == null ? "Staged Effect" : `Staged Effect ${index + 1}`);
  return {
    applicationId: `${session?.key || session?.event?.key || "runner"}-${effectId || (index ?? "effect")}-${nowIso(options).replace(/[^0-9]/g, "")}`,
    effectId,
    effectIndex: index,
    effectLabel,
    effectType: effect?.type ?? "",
    resource: effect?.resource ?? "",
    mode: effect?.mode ?? "",
    value: Number.isFinite(Number(effect?.value)) ? Number(effect.value) : null,
    actorId: actor?.id ?? "",
    actorName: actor?.name ?? "",
    beforeValue: beforeAfter?.before?.[effect?.resource] ?? null,
    afterValue: beforeAfter?.after?.[effect?.resource] ?? null,
    appliedAt: nowIso(options),
    source: "travel-event-runner",
    undone: false
  };
}

export function prepareTravelEventEffectApplicationState(session, actorOrId = null, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, reason: normalized.errors?.[0] ?? "Travel Event Runner session is malformed.", rows: [], records: [] };
  if (normalized.session.status !== "completed") return { ok: true, errors: [], warnings: [], session: normalized.session, available: false, reason: "Manual effect application is unavailable until the runner session is completed.", rows: [], records: getTravelEventAppliedEffectRecords(normalized.session, options) };
  const actor = resolveApplicationActor(actorOrId ?? options.actor ?? options.actorId);
  let actorResources = null;
  let actorValid = false;
  const actorWarning = actor ? "" : "Select an Arcflight ship token or actor to apply effects.";
  if (actor) {
    try {
      actorResources = getShipTravelResources(actor);
      actorValid = true;
    } catch (_error) {
      actorValid = false;
    }
  }
  const review = prepareTravelEventStagedEffectReview(normalized.session, { ...options, resources: actorResources });
  const rows = (review.review?.rows ?? []).map((row) => {
    const applied = isTravelEventEffectApplied(normalized.session, row, options);
    const selectable = actorValid && row.type === "resource" && row.status === "ready" && row.supported === true && !applied;
    const status = applied ? "already applied" : (!actorValid && row.type === "resource" && row.status === "ready" ? "no target" : row.status);
    return { ...row, applied, selectable, status, selected: selectable };
  });
  return {
    ok: true,
    errors: [],
    warnings: actorWarning ? [actorWarning] : [],
    session: normalized.session,
    available: true,
    actor,
    targetActorId: actor?.id ?? "",
    targetActorName: actorValid ? actor.name : "",
    hasTarget: actorValid,
    noTargetReason: actorValid ? "" : (actor ? "Selected actor is not an Arcflight ship." : actorWarning),
    rows,
    records: prepareTravelEventAppliedEffectHistoryState(normalized.session, actor, options).records,
    canApply: rows.some((row) => row.selectable)
  };
}

export async function applyTravelEventRunnerResourceEffect(session, actorOrId, effectRowOrIndex, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { ...normalized, applied: false };
  if (normalized.session.status !== "completed") return { ok: false, errors: ["Manual effect application is unavailable until the runner session is completed."], warnings: [], session: normalized.session, applied: false };
  const actor = resolveApplicationActor(actorOrId);
  if (!actor) return { ok: false, errors: ["Select an Arcflight ship token or actor to apply effects."], warnings: [], session: normalized.session, applied: false };
  try {
    getShipTravelResources(actor);
  } catch (_error) {
    return { ok: false, errors: ["Selected actor is not an Arcflight ship."], warnings: [], session: normalized.session, applied: false };
  }
  const found = findStagedEffect(normalized.session, effectRowOrIndex, options);
  if (!found.effect) return { ok: false, errors: ["Unknown staged effect id/index."], warnings: [], session: normalized.session, applied: false };
  const row = normalizeTravelEventProposedEffectForReview(found.effect, found.index, { ...options, ship: actor });
  if (!(row.type === "resource" && row.status === "ready" && row.supported === true)) return { ok: false, errors: ["Staged effect is not a supported resource effect."], warnings: row.warnings ?? [], session: normalized.session, applied: false };
  if (isTravelEventEffectApplied(normalized.session, row, options)) return { ok: false, errors: [], warnings: [`${row.label} has already been applied for this runner session.`], session: normalized.session, applied: false, blocked: true, reason: "already-applied" };
  const preview = previewShipTravelResourceChange(actor, buildResourceEffectChanges(actor, found.effect));
  const resources = options.dryRun ? preview.after : await updateShipTravelResources(actor, preview.changes, options.resourceOptions ?? {});
  const record = buildTravelEventAppliedEffectRecord(normalized.session, actor, row, { before: preview.before, after: resources }, options);
  const marked = markTravelEventEffectApplied(normalized.session, record, options);
  return { ok: true, errors: [], warnings: preview.warnings ?? [], session: marked.session, applied: true, record, preview, resources };
}

export function isTravelEventAppliedEffectUndoable(session, actorOrId, appliedRecord, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { undoable: false, status: "not undoable", warning: normalized.errors?.[0] ?? "Runner session is malformed." };
  const record = appliedRecord ?? {};
  if (record.undone === true) return { undoable: false, status: "undone", warning: record.undoneAt ? `Undone at ${record.undoneAt}.` : "Already undone." };
  if (!record.applicationId) return { undoable: false, status: "not undoable", warning: "Applied record is missing an application id." };
  if (!(record.effectType === "resource" && REVIEW_RESOURCE_KEYS.includes(record.resource) && REVIEW_RESOURCE_MODES.includes(record.mode))) return { undoable: false, status: "not undoable", warning: "Applied record is not a reversible resource effect." };
  const actor = resolveApplicationActor(actorOrId ?? record.actorId);
  if (!actor) return { undoable: false, status: "not undoable", warning: "Target ship actor is missing." };
  let resources;
  try {
    resources = getShipTravelResources(actor);
  } catch (_error) {
    return { undoable: false, status: "not undoable", warning: "Target actor is not an Arcflight ship." };
  }
  const currentValue = resources?.[record.resource];
  if (currentValue !== record.afterValue) return { undoable: false, status: "blocked", warning: "Cannot undo because the ship resource has changed since this effect was applied.", actor, currentValue };
  return { undoable: true, status: "applied", warning: "", actor, currentValue, undoAfterValue: record.beforeValue };
}

export function buildTravelEventEffectUndoRecord(session, actor, appliedRecord, beforeAfter, options = {}) {
  return {
    undone: true,
    undoneAt: nowIso(options),
    undoneByUserId: options.userId ?? globalThis.game?.user?.id ?? "",
    undoneByUserName: options.userName ?? globalThis.game?.user?.name ?? "",
    undoBeforeValue: beforeAfter?.before?.[appliedRecord.resource] ?? null,
    undoAfterValue: beforeAfter?.after?.[appliedRecord.resource] ?? null,
    undoReason: typeof options.reason === "string" ? options.reason : ""
  };
}

export function markTravelEventAppliedEffectUndone(session, applicationId, undoRecord, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return normalized;
  const nextSession = cloneData(normalized.session);
  const records = Array.isArray(nextSession.appliedEffects?.records) ? nextSession.appliedEffects.records : [];
  const index = records.findIndex((record) => record.applicationId === applicationId);
  if (index < 0) return { ok: false, errors: ["Applied effect record was not found."], warnings: [], session: normalized.session };
  if (records[index].undone === true) return { ok: false, errors: ["Applied effect record has already been undone."], warnings: [], session: normalized.session };
  records[index] = { ...records[index], ...cloneData(undoRecord) };
  nextSession.appliedEffects = { records };
  nextSession.updatedAt = nowIso(options);
  return { ok: true, errors: [], warnings: [], session: nextSession, record: cloneData(records[index]) };
}

export function prepareTravelEventAppliedEffectHistoryState(session, actorOrId = null, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, records: [] };
  const records = getTravelEventAppliedEffectRecords(normalized.session, options).map((record) => {
    const undo = isTravelEventAppliedEffectUndoable(normalized.session, actorOrId ?? record.actorId, record, options);
    return { ...record, status: undo.status, undoable: undo.undoable, undoWarning: undo.warning, currentValue: undo.currentValue ?? null, undoTargetValue: record.beforeValue };
  });
  return { ok: true, errors: [], warnings: [], session: normalized.session, available: true, records };
}

export async function undoTravelEventAppliedEffect(session, actorOrId, applicationIdOrEffectIndex, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { ...normalized, undone: false };
  const records = getTravelEventAppliedEffectRecords(normalized.session, options);
  const applicationId = String(applicationIdOrEffectIndex ?? "");
  const record = records.find((entry) => entry.applicationId === applicationId || (applicationId && String(entry.effectIndex) === applicationId));
  if (!record) return { ok: false, errors: ["Applied effect record was not found."], warnings: [], session: normalized.session, undone: false };
  const undoable = isTravelEventAppliedEffectUndoable(normalized.session, actorOrId ?? record.actorId, record, options);
  if (!undoable.undoable) return { ok: false, errors: undoable.status === "blocked" ? [] : [undoable.warning], warnings: undoable.status === "blocked" ? [undoable.warning] : [], session: normalized.session, undone: false, blocked: true, reason: undoable.warning };
  const actor = undoable.actor;
  const before = getShipTravelResources(actor);
  const changes = { [record.resource]: record.beforeValue - before[record.resource] };
  const after = options.dryRun ? previewShipTravelResourceChange(actor, changes).after : await updateShipTravelResources(actor, changes, options.resourceOptions ?? {});
  const undoRecord = buildTravelEventEffectUndoRecord(normalized.session, actor, record, { before, after }, options);
  const marked = markTravelEventAppliedEffectUndone(normalized.session, record.applicationId, undoRecord, options);
  return { ok: marked.ok, errors: marked.errors ?? [], warnings: marked.warnings ?? [], session: marked.session, undone: marked.ok, record: marked.record, undoRecord, resources: after };
}

export async function applyTravelEventRunnerSelectedEffects(session, actorOrId, selectedEffectIds = [], options = {}) {
  const selected = Array.isArray(selectedEffectIds) ? selectedEffectIds : [];
  let currentSession = normalizeTravelEventRunnerSession(session, options).session;
  const applied = [];
  const skipped = [];
  const errors = [];
  const warnings = [];
  for (const selection of selected) {
    const result = await applyTravelEventRunnerResourceEffect(currentSession, actorOrId, selection, options);
    if (result.applied) {
      applied.push(result.record);
      currentSession = result.session;
    } else {
      skipped.push(selection);
    }
    errors.push(...(result.errors ?? []));
    warnings.push(...(result.warnings ?? []));
  }
  return { ok: errors.length === 0, errors, warnings, session: currentSession, applied, skipped };
}

export function prepareTravelEventRunnerSummaryReport(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return { ...normalized, available: false, report: null, reason: normalized.errors?.[0] ?? "Travel Event Runner session is malformed." };
  if (normalized.session.status !== "completed") return { ok: true, errors: [], warnings: [], session: normalized.session, available: false, report: null, reason: "Completed summary output is unavailable until the runner session is completed." };
  const summarized = summarizeTravelEventRunnerSession(normalized.session, options);
  if (!summarized.ok || !summarized.summary) return { ...summarized, available: false, report: null, reason: summarized.errors?.[0] ?? "Unable to prepare completed runner summary." };
  const summary = summarized.summary;
  const report = {
    ...cloneData(summary),
    available: true,
    eventName: summary.event.name,
    eventCategory: summary.event.category,
    baseDC: summary.event.baseDC,
    finalOutcomeLabel: summary.suggestedFinalOutcomeLabel,
    finalOutcomeNarrativeText: summary.finalOutcomeText,
    proposedEffectsNotice: "Proposed effects have not been applied.",
    proposedEffectRows: (summary.stagedProposedEffects ?? []).map(formatEffectForReport),
    rounds: summary.rounds.map((round) => ({
      ...round,
      stationRows: Object.entries(round.stationResults ?? {}).map(([stationKey, result]) => ({ stationKey, stationName: humanizeIdentifier(stationKey), result: result ?? "unrecorded", resultLabel: result ? humanizeIdentifier(result) : "Unrecorded" }))
    }))
  };
  return { ok: true, errors: [], warnings: [], session: normalized.session, available: true, report };
}

export function renderTravelEventRunnerSummaryMarkdown(session, options = {}) {
  const prepared = prepareTravelEventRunnerSummaryReport(session, options);
  if (!prepared.available || !prepared.report) return { ...prepared, markdown: "" };
  const r = prepared.report;
  const lines = [
    `# Travel Event Summary — ${r.eventName}`,
    "",
    `- **Event Category:** ${r.eventCategory || "Uncategorized"}`,
    `- **Base DC:** ${r.baseDC}`,
    `- **Started At:** ${r.startedAt || ""}`,
    `- **Completed At:** ${r.completedAt || ""}`,
    `- **Total Score:** ${r.totalScore}`,
    `- **Suggested Final Outcome:** ${humanizeIdentifier(r.suggestedFinalOutcome)}`,
    `- **Final Outcome Label:** ${r.finalOutcomeLabel}`,
    "",
    "## Final Outcome Narrative",
    r.finalOutcomeNarrativeText || "No final outcome narrative text provided.",
    "",
    "## Round-by-Round Station Results"
  ];
  for (const round of r.rounds) {
    lines.push("", `### Round ${round.roundNumber}: ${round.title}`);
    for (const row of round.stationRows) lines.push(`- **${row.stationName}** (${row.stationKey}): ${row.resultLabel}`);
  }
  lines.push("", "## Pending Consequences / Rewards (Read-only Proposed Effects)", `**${r.proposedEffectsNotice}**`);
  if (r.proposedEffectRows.length) for (const effect of r.proposedEffectRows) lines.push("", `### ${effect.label}`, "```json", effect.json, "```");
  else lines.push("", "No proposed effects are attached to the suggested final outcome.");
  return { ...prepared, markdown: lines.join("\n") };
}

export function renderTravelEventRunnerSummaryHtml(session, options = {}) {
  const prepared = prepareTravelEventRunnerSummaryReport(session, options);
  if (!prepared.available || !prepared.report) return { ...prepared, html: "" };
  const r = prepared.report;
  const roundHtml = r.rounds.map((round) => `<h3>Round ${escapeHtml(round.roundNumber)}: ${escapeHtml(round.title)}</h3><ul>${round.stationRows.map((row) => `<li><strong>${escapeHtml(row.stationName)}</strong> (${escapeHtml(row.stationKey)}): ${escapeHtml(row.resultLabel)}</li>`).join("")}</ul>`).join("");
  const effectsHtml = r.proposedEffectRows.length
    ? r.proposedEffectRows.map((effect) => `<h3>${escapeHtml(effect.label)}</h3><pre>${escapeHtml(effect.json)}</pre>`).join("")
    : "<p>No proposed effects are attached to the suggested final outcome.</p>";
  const html = `<section class="arcflight-travel-runner-summary"><h1>Travel Event Summary — ${escapeHtml(r.eventName)}</h1><ul><li><strong>Event Category:</strong> ${escapeHtml(r.eventCategory || "Uncategorized")}</li><li><strong>Base DC:</strong> ${escapeHtml(r.baseDC)}</li><li><strong>Started At:</strong> ${escapeHtml(r.startedAt)}</li><li><strong>Completed At:</strong> ${escapeHtml(r.completedAt)}</li><li><strong>Total Score:</strong> ${escapeHtml(r.totalScore)}</li><li><strong>Suggested Final Outcome:</strong> ${escapeHtml(humanizeIdentifier(r.suggestedFinalOutcome))}</li><li><strong>Final Outcome Label:</strong> ${escapeHtml(r.finalOutcomeLabel)}</li></ul><h2>Final Outcome Narrative</h2><p>${escapeHtml(r.finalOutcomeNarrativeText || "No final outcome narrative text provided.")}</p><h2>Round-by-Round Station Results</h2>${roundHtml}<h2>Pending Consequences / Rewards (Read-only Proposed Effects)</h2><p><strong>${escapeHtml(r.proposedEffectsNotice)}</strong></p>${effectsHtml}</section>`;
  return { ...prepared, html };
}

export function prepareTravelEventRunnerSummaryOutputState(session, options = {}) {
  const report = prepareTravelEventRunnerSummaryReport(session, options);
  const markdown = report.available ? renderTravelEventRunnerSummaryMarkdown(session, options).markdown : "";
  const html = report.available ? renderTravelEventRunnerSummaryHtml(session, options).html : "";
  return { ...report, markdown, html, canCopyMarkdown: report.available, canCopyHtml: report.available, canPostChat: report.available, canCreateJournal: report.available };
}

export async function postTravelEventRunnerSummaryToChat(session, options = {}) {
  const rendered = renderTravelEventRunnerSummaryHtml(session, options);
  if (!rendered.available || !rendered.html) return { ...rendered, created: false, message: null };
  const data = { content: rendered.html };
  if (options.whisper === "gm" || options.gmOnly === true) data.whisper = globalThis.ChatMessage?.getWhisperRecipients?.("GM")?.map((u) => u.id) ?? [];
  if (options.dryRun === true) return { ...rendered, created: false, messageData: data, message: null };
  if (!globalThis.ChatMessage?.create) return { ...rendered, ok: false, errors: ["ChatMessage.create is not available."], created: false, message: null };
  const message = await ChatMessage.create(data);
  return { ...rendered, created: true, message };
}

export async function createTravelEventRunnerSummaryJournalEntry(session, options = {}) {
  const rendered = renderTravelEventRunnerSummaryHtml(session, options);
  if (!rendered.available || !rendered.html) return { ...rendered, created: false, journalEntry: null };
  const title = typeof options.title === "string" && options.title.trim() ? options.title.trim() : `Travel Event Summary — ${rendered.report.eventName}`;
  const data = { name: title, pages: [{ name: "Summary", type: "text", text: { format: 1, content: rendered.html } }] };
  if (options.dryRun === true) return { ...rendered, created: false, journalData: data, journalEntry: null };
  if (!globalThis.JournalEntry?.create) return { ...rendered, ok: false, errors: ["JournalEntry.create is not available."], created: false, journalEntry: null };
  const journalEntry = await JournalEntry.create(data);
  return { ...rendered, created: true, journalEntry };
}

export function completeTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok) return normalized;
  const nextSession = cloneData(normalized.session);
  nextSession.status = "completed";
  nextSession.currentRoundIndex = Math.max(nextSession.event.rounds.length - 1, 0);
  nextSession.completedAt = nowIso(options);
  nextSession.updatedAt = nextSession.completedAt;
  const summary = summarizeTravelEventRunnerSession(nextSession, options).summary;
  nextSession.summary = summary;
  return { ok: true, errors: [], warnings: [], session: nextSession, summary };
}

export function exportTravelEventRunnerSessionToJson(session, options = {}) {
  const built = buildTravelEventRunnerSessionExportData(session, options);
  if (!built.ok) return { ...built, json: "" };
  return { ...built, json: JSON.stringify(built.data, null, 2) };
}

export function buildTravelEventRunnerSessionExportData(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  if (!normalized.ok || !normalized.session) return { ...normalized, data: null, json: "" };
  const metadata = {
    exportVersion: TRAVEL_EVENT_RUNNER_SESSION_EXPORT_VERSION,
    exportedAt: nowIso(options),
    exportedByUserId: options.userId ?? globalThis.game?.user?.id ?? "",
    exportedByUserName: options.userName ?? globalThis.game?.user?.name ?? "",
    arcflightVersion: options.arcflightVersion ?? globalThis.game?.modules?.get?.(ARCFLIGHT_MODULE_ID)?.version ?? "",
    sourceWorldId: options.sourceWorldId ?? globalThis.game?.world?.id ?? "",
    sourceWorldTitle: options.sourceWorldTitle ?? globalThis.game?.world?.title ?? ""
  };
  return { ok: true, errors: [], warnings: normalized.warnings ?? [], session: cloneData(normalized.session), metadata, data: { ...metadata, session: cloneData(normalized.session) } };
}

export function parseTravelEventRunnerSessionJson(jsonText, options = {}) {
  const errors = [];
  let data;
  try {
    data = JSON.parse(String(jsonText ?? ""));
  } catch (_error) {
    return { ok: false, errors: ["Travel Event Runner session JSON is malformed."], warnings: [], data: null, session: null, preview: null };
  }
  if (!isPlainObject(data)) return { ok: false, errors: ["Travel Event Runner session import root must be a JSON object."], warnings: [], data, session: null, preview: null };
  const sessionData = isPlainObject(data.session) ? data.session : data;
  const normalized = normalizeTravelEventRunnerSession(sessionData, options);
  errors.push(...(normalized.errors ?? []));
  return { ok: errors.length === 0, errors, warnings: normalized.warnings ?? [], data, session: normalized.session, preview: null };
}

export function validateImportedTravelEventRunnerSession(session, options = {}) {
  const normalized = normalizeTravelEventRunnerSession(session, options);
  const errors = [...(normalized.errors ?? [])];
  const warnings = [...(normalized.warnings ?? [])];
  if (normalized.session?.event?.key) {
    const entry = { eventKey: normalized.session.event.key, session: normalized.session };
    if (!publishedEventExistsForSession(entry, options)) warnings.push("Imported session references a published event that is not available in this world.");
  }
  if (!normalized.session?.key) warnings.push("Imported session has no saved library key; a new key will be generated when saved.");
  return { ok: errors.length === 0, errors, warnings, session: normalized.session };
}

export function prepareTravelEventRunnerSessionImportPreview(dataOrSession, options = {}) {
  const parsed = typeof dataOrSession === "string" ? parseTravelEventRunnerSessionJson(dataOrSession, options) : { ok: isPlainObject(dataOrSession), errors: isPlainObject(dataOrSession) ? [] : ["Travel Event Runner session import root must be a JSON object."], warnings: [], data: dataOrSession, session: isPlainObject(dataOrSession?.session) ? dataOrSession.session : dataOrSession };
  if (!parsed.ok) return { ...parsed, importResult: parsed, preview: { errors: parsed.errors, warnings: parsed.warnings } };
  const validated = validateImportedTravelEventRunnerSession(parsed.session, options);
  const session = validated.session;
  const library = getTravelEventRunnerSessionLibrary(options);
  const key = session?.key ?? "";
  const duplicateKey = Boolean(key && Object.hasOwn(library.sessions, key));
  const records = session?.appliedEffects?.records ?? [];
  const staged = session?.summary?.stagedProposedEffects ?? summarizeTravelEventRunnerSession(session, options).summary?.stagedProposedEffects ?? [];
  const preview = {
    sessionName: session?.name || (session?.event?.name ? `${session.event.name} Session` : key),
    sessionKey: key,
    eventName: session?.event?.name ?? "",
    eventKey: session?.event?.key ?? "",
    status: session?.status ?? "",
    currentRound: Number(session?.currentRoundIndex ?? 0) + 1,
    completed: session?.status === "completed",
    stagedEffectCount: Array.isArray(staged) ? staged.length : 0,
    appliedEffectCount: records.length,
    undoneEffectCount: records.filter((record) => record.undone === true).length,
    duplicateKey,
    warnings: validated.warnings,
    errors: validated.errors
  };
  const importResult = { ok: validated.ok, errors: validated.errors, warnings: validated.warnings, data: parsed.data, session, preview, library, duplicateKey };
  return { ...importResult, importResult };
}

export function importTravelEventRunnerSessionFromJson(jsonText, options = {}) {
  return prepareTravelEventRunnerSessionImportPreview(jsonText, options);
}

export async function saveImportedTravelEventRunnerSessionToLibrary(importResult, options = {}) {
  const source = importResult?.session ? importResult : prepareTravelEventRunnerSessionImportPreview(importResult, options);
  if (!source.ok || !source.session) return buildRunnerLibraryResult(false, { errors: source.errors ?? ["Imported runner session is not valid."], warnings: source.warnings ?? [], session: null, entry: null });
  const mode = options.mode === "overwrite" ? "overwrite" : "copy";
  const libraryOptions = source.library ? { ...options, library: source.library } : options;
  if (source.duplicateKey && mode !== "overwrite" && options.allowDuplicateKey !== true) {
    const key = createUniqueRunnerSessionKey(source.library ?? getTravelEventRunnerSessionLibrary(options), `${source.session.key || source.session.event?.key || "runner-session"}-import`, options);
    const copy = cloneData(source.session);
    copy.key = key;
    const savedCopy = await saveTravelEventRunnerSessionToLibrary(copy, { ...libraryOptions, key, name: `${source.preview?.sessionName || source.session.event?.name || key} Imported Copy`, overwrite: false });
    return { ...savedCopy, importMode: "copy", overwritten: false };
  }
  if (source.duplicateKey && mode === "overwrite" && options.confirmOverwrite !== true) {
    return buildRunnerLibraryResult(false, { errors: ["Overwrite requires explicit confirmation."], warnings: source.warnings ?? [], session: cloneData(source.session), entry: null, importMode: "overwrite", overwritten: false });
  }
  const saved = await saveTravelEventRunnerSessionToLibrary(source.session, { ...libraryOptions, key: source.session.key, overwrite: mode === "overwrite" });
  return { ...saved, importMode: mode, overwritten: mode === "overwrite" && saved.ok === true };
}

export function loadPublishedTravelEventForRunner(idOrKey, options = {}) {
  const loaded = loadPublishedTravelEventFromLibrary(idOrKey, options);
  if (!loaded.ok || !loaded.event) return { ok: false, errors: loaded.errors ?? ["Published travel event could not be loaded."], warnings: loaded.warnings ?? [], entry: loaded.entry ?? null, event: null };
  return { ok: true, errors: [], warnings: loaded.warnings ?? [], entry: loaded.entry, event: loaded.event };
}

export function preparePublishedTravelEventRunnerLaunchState(options = {}) {
  const idOrKey = options.idOrKey ?? options.eventId ?? options.selectedEventId ?? "";
  const loaded = idOrKey ? loadPublishedTravelEventForRunner(idOrKey, options) : { ok: false, errors: ["Choose a published travel event before starting the runner."], warnings: [], entry: null, event: null };
  const shipOptions = getArcflightTravelEventRunnerShipOptions(options);
  const selectedShip = shipOptions.find((actor) => actor.selected) ?? null;
  const defaultSessionName = loaded.event?.name ? `${loaded.event.name} Run` : "Travel Event Run";
  const errors = [...(loaded.errors ?? [])];
  if (loaded.ok === true && shipOptions.length === 0) errors.push("No Arcflight ship or PF2E vehicle actors are available. Create or enable a vehicle actor before starting a travel event run.");
  return {
    ok: loaded.ok === true && shipOptions.length > 0,
    errors,
    warnings: loaded.warnings ?? [],
    entry: loaded.entry ?? null,
    event: loaded.event ? cloneData(loaded.event) : null,
    shipOptions,
    hasShipOptions: shipOptions.length > 0,
    selectedShip,
    defaultSessionName,
    notes: typeof options.notes === "string" ? options.notes : ""
  };
}

export async function startTravelEventRunnerFromPublishedEvent(idOrKey, options = {}) {
  const launchState = preparePublishedTravelEventRunnerLaunchState({ ...options, idOrKey });
  if (!launchState.ok || !launchState.event) return buildRunnerLibraryResult(false, { errors: launchState.errors, warnings: launchState.warnings, launchState, session: null, entry: launchState.entry ?? null });
  const actorId = String(options.actorId ?? options.shipId ?? launchState.selectedShip?.id ?? "");
  const selectedActorUuid = String(options.actorUuid ?? options.shipUuid ?? launchState.selectedShip?.uuid ?? "");
  const actor = actorCollectionValues(getActorCollection(options)).find((candidate) => (selectedActorUuid && actorUuid(candidate) === selectedActorUuid) || (actorId && candidate?.id === actorId)) ?? null;
  if (!actor && !launchState.selectedShip) {
    return buildRunnerLibraryResult(false, { errors: ["No Arcflight ship or PF2E vehicle actor could be resolved for this travel event run."], warnings: launchState.warnings, launchState, session: null, entry: launchState.entry });
  }
  const ship = normalizeTravelEventRunnerShipSelection(actor ?? launchState.selectedShip);
  if (!ship.actorId && !ship.actorUuid) {
    return buildRunnerLibraryResult(false, { errors: ["No Arcflight ship or PF2E vehicle actor could be resolved for this travel event run."], warnings: launchState.warnings, launchState, session: null, entry: launchState.entry });
  }
  const sessionName = typeof options.sessionName === "string" && options.sessionName.trim() ? options.sessionName.trim() : launchState.defaultSessionName;
  const seedShipActor = actor ?? resolveTravelEventRunnerShipActor(ship, options);
  const created = createTravelEventRunnerSession(cloneData(launchState.event), { ...options, ship: seedShipActor ?? ship, notes: options.notes ?? "" });
  if (!created.ok || !created.session) return buildRunnerLibraryResult(false, { errors: created.errors, warnings: created.warnings, launchState, session: null, entry: launchState.entry });
  created.session.name = sessionName;
  created.session.ship = ship;
  created.session.notes = typeof options.notes === "string" ? options.notes.trim() : "";
  return buildRunnerLibraryResult(true, { warnings: [...launchState.warnings, ...created.warnings], launchState, session: cloneData(created.session), entry: launchState.entry });
}

export function getPublishedTravelEventRunnerEntries(options = {}) {
  const library = getPublishedTravelEventLibrary(options);
  return prepareTravelEventRunnerLibraryState({ ...options, library }).entries;
}
