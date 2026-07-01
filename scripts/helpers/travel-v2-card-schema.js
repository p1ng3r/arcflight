export const TRAVEL_V2_CARD_SCHEMA_VERSION = "travel-v2-card-schema-v0";

export const TRAVEL_V2_CARD_TYPES = Object.freeze(["hazard", "consequence", "stationAction", "riskBid", "stationBenefit", "travelEncounter"]);
export const TRAVEL_V2_HAZARD_CATEGORIES = Object.freeze(["navigation", "engine", "hull", "lifeveil", "crew", "cargo", "supplies", "occult", "threat", "route"]);
export const TRAVEL_V2_SEVERITIES = Object.freeze(["minor", "major", "severe"]);
export const TRAVEL_V2_STATION_KEYS = Object.freeze(["captain", "navigator", "engineer", "veilwarden", "watchmaster"]);
export const TRAVEL_V2_ACTION_MODES = Object.freeze(["objective", "stabilize", "repair", "support", "focus", "hazardResponse", "combo", "momentum", "aftermath"]);
export const TRAVEL_V2_BENEFIT_KINDS = Object.freeze(["dcReduction", "hazardIgnore", "riskBidDiscount", "backlashShield", "unlockAction", "momentumOption", "clearProgress"]);
export const TRAVEL_V2_BENEFIT_EXPIRIES = Object.freeze(["afterUse", "endOfRound", "endOfEvent"]);
export const TRAVEL_V2_RISK_BID_DC_INCREASES = Object.freeze([2, 5, 10]);

export const TRAVEL_V2_PLAYER_SAFE_TEXT_FIELDS = Object.freeze(["title", "subtitle", "publicText", "playerSafeSummary"]);
export const TRAVEL_V2_GM_TEXT_FIELDS = Object.freeze(["gmText", "gmSummary"]);
export const TRAVEL_V2_NARRATION_HOOKS = Object.freeze([
  "onDeclare",
  "onSuccess",
  "onCriticalSuccess",
  "onFailure",
  "onCriticalFailure",
  "onBenefitCreated",
  "onBenefitUsed",
  "onConsequenceCreated",
  "onHazardCleared",
  "onHazardIgnored"
]);

const BASE_REQUIRED_FIELDS = Object.freeze(["id", "schemaVersion", "type", "title"]);
const REFERENCE_FIELDS_BY_TYPE = Object.freeze({
  hazard: ["triggerSources", "unresolvedConsequenceRefs", "escalationRefs"],
  stationAction: ["createsBenefitRefs", "createsConsequenceRefs", "riskBidRefs"],
  riskBid: ["eligibleStationActions", "failureConsequenceRefs", "criticalFailureConsequenceRefs"],
  travelEncounter: ["activeStations", "stationActionRefs", "startingHazardRefs", "rewardRefs", "followUpRefs"]
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clonePlain(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  return JSON.parse(JSON.stringify(value));
}

function makeResult(errors = [], warnings = [], normalized) {
  const result = { ok: errors.length === 0, errors, warnings };
  if (normalized !== undefined) result.normalized = normalized;
  return result;
}

function requireString(card, field, errors) {
  if (typeof card[field] !== "string" || card[field].trim().length === 0) errors.push(`${field} must be a non-empty string`);
}

function optionalString(card, field, errors) {
  if (card[field] !== undefined && typeof card[field] !== "string") errors.push(`${field} must be a string when present`);
}

function optionalStringArray(card, field, errors) {
  if (card[field] === undefined) return;
  if (!Array.isArray(card[field]) || card[field].some((entry) => typeof entry !== "string")) errors.push(`${field} must be an array of strings when present`);
}

function requireEnum(card, field, allowed, errors) {
  if (!allowed.includes(card[field])) errors.push(`${field} must be one of: ${allowed.join(", ")}`);
}

function validateCommon(card) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(card)) return { errors: ["card must be an object"], warnings };
  for (const field of BASE_REQUIRED_FIELDS) requireString(card, field, errors);
  if (typeof card.schemaVersion === "string" && card.schemaVersion !== TRAVEL_V2_CARD_SCHEMA_VERSION) errors.push(`schemaVersion must be ${TRAVEL_V2_CARD_SCHEMA_VERSION}`);
  if (typeof card.type === "string" && !TRAVEL_V2_CARD_TYPES.includes(card.type)) errors.push(`type must be one of: ${TRAVEL_V2_CARD_TYPES.join(", ")}`);
  for (const field of TRAVEL_V2_PLAYER_SAFE_TEXT_FIELDS) optionalString(card, field, errors);
  for (const field of TRAVEL_V2_GM_TEXT_FIELDS) optionalString(card, field, errors);
  if (card.narration !== undefined && !isPlainObject(card.narration)) errors.push("narration must be an object when present");
  if (isPlainObject(card.narration)) {
    for (const [key, value] of Object.entries(card.narration)) {
      if (!TRAVEL_V2_NARRATION_HOOKS.includes(key)) warnings.push(`narration.${key} is not a recognized v0 hook`);
      if (value !== undefined && typeof value !== "string") errors.push(`narration.${key} must be a string when present`);
    }
  }
  if (card.tags !== undefined) optionalStringArray(card, "tags", errors);
  for (const field of REFERENCE_FIELDS_BY_TYPE[card.type] ?? []) optionalStringArray(card, field, errors);
  return { errors, warnings };
}

export function normalizeTravelV2CardDefinition(card) {
  if (!isPlainObject(card)) return card;
  const normalized = clonePlain(card);
  if (typeof normalized.id === "string") normalized.id = normalized.id.trim();
  if (typeof normalized.schemaVersion === "string") normalized.schemaVersion = normalized.schemaVersion.trim();
  if (typeof normalized.type === "string") normalized.type = normalized.type.trim();
  if (typeof normalized.title === "string") normalized.title = normalized.title.trim();
  if (!Array.isArray(normalized.tags)) normalized.tags = [];
  return normalized;
}

function withCommon(card, type, specificValidator) {
  const normalized = normalizeTravelV2CardDefinition(card);
  const { errors, warnings } = validateCommon(normalized);
  if (isPlainObject(normalized) && normalized.type !== type) errors.push(`type must be ${type}`);
  if (isPlainObject(normalized)) specificValidator(normalized, errors, warnings);
  return makeResult(errors, warnings, normalized);
}

export function validateTravelV2HazardCard(card, options = {}) {
  return withCommon(card, "hazard", (normalized, errors, warnings) => {
    requireEnum(normalized, "category", TRAVEL_V2_HAZARD_CATEGORIES, errors);
    requireEnum(normalized, "severity", TRAVEL_V2_SEVERITIES, errors);
    const hasImpact = normalized.immediateEffects !== undefined || normalized.stationImpacts !== undefined || normalized.responseActions !== undefined || normalized.clearCondition !== undefined || normalized.suppressionCondition !== undefined;
    if (!hasImpact) warnings.push("hazard should include gameplay-changing effects, station impacts, response actions, or clear/suppression conditions");
    if (typeof normalized.publicText === "string" && /gm only|secret|hidden/i.test(normalized.publicText)) warnings.push("publicText appears to contain GM-only handling notes");
  });
}

export function validateTravelV2ConsequenceCard(card, options = {}) {
  return withCommon(card, "consequence", (normalized, errors) => {
    requireEnum(normalized, "severity", TRAVEL_V2_SEVERITIES, errors);
    optionalString(normalized, "source", errors);
    optionalString(normalized, "affectedTrack", errors);
    optionalString(normalized, "applyEffectSummary", errors);
  });
}

export function validateTravelV2StationActionCard(card, options = {}) {
  return withCommon(card, "stationAction", (normalized, errors, warnings) => {
    requireEnum(normalized, "stationKey", TRAVEL_V2_STATION_KEYS, errors);
    requireEnum(normalized, "actionMode", TRAVEL_V2_ACTION_MODES, errors);
    if (normalized.actionMode === "support") {
      if (normalized.awardsMomentum === true) warnings.push("support actions should not award Momentum");
      if (normalized.countsAsObjectiveProgress === true) warnings.push("support actions should not count as main objective progress");
      if (normalized.autoMutatesRoll === true) warnings.push("support assists should not automatically mutate rolls");
    }
  });
}

export function validateTravelV2RiskBidCard(card, options = {}) {
  return withCommon(card, "riskBid", (normalized, errors) => {
    if (!TRAVEL_V2_RISK_BID_DC_INCREASES.includes(normalized.dcIncrease)) errors.push("dcIncrease must be one of: 2, 5, 10");
    if (normalized.declareBeforeRoll !== true) errors.push("declareBeforeRoll must be true");
  });
}

export function validateTravelV2StationBenefitCard(card, options = {}) {
  return withCommon(card, "stationBenefit", (normalized, errors, warnings) => {
    if (normalized.sourceStation !== undefined) requireEnum(normalized, "sourceStation", TRAVEL_V2_STATION_KEYS, errors);
    if (normalized.targetStation !== undefined) requireEnum(normalized, "targetStation", TRAVEL_V2_STATION_KEYS, errors);
    requireEnum(normalized, "benefitKind", TRAVEL_V2_BENEFIT_KINDS, errors);
    requireEnum(normalized, "expires", TRAVEL_V2_BENEFIT_EXPIRIES, errors);
    if (normalized.benefitKind === "dcReduction" && typeof normalized.magnitude === "number" && normalized.magnitude < -3) warnings.push("dcReduction benefits should usually cap at -3");
  });
}

export function validateTravelV2EncounterTemplate(card, options = {}) {
  return withCommon(card, "travelEncounter", (normalized, errors) => {
    if (normalized.activeStations !== undefined) {
      optionalStringArray(normalized, "activeStations", errors);
      for (const station of normalized.activeStations ?? []) if (!TRAVEL_V2_STATION_KEYS.includes(station)) errors.push(`activeStations includes unknown station: ${station}`);
    }
    if (normalized.visibleStakes !== undefined && !isPlainObject(normalized.visibleStakes)) errors.push("visibleStakes must be an object when present");
  });
}

export function validateTravelV2CardDefinition(card, options = {}) {
  if (!isPlainObject(card)) return makeResult(["card must be an object"], []);
  switch (card.type) {
    case "hazard": return validateTravelV2HazardCard(card, options);
    case "consequence": return validateTravelV2ConsequenceCard(card, options);
    case "stationAction": return validateTravelV2StationActionCard(card, options);
    case "riskBid": return validateTravelV2RiskBidCard(card, options);
    case "stationBenefit": return validateTravelV2StationBenefitCard(card, options);
    case "travelEncounter": return validateTravelV2EncounterTemplate(card, options);
    default: {
      const normalized = normalizeTravelV2CardDefinition(card);
      const common = validateCommon(normalized);
      return makeResult(common.errors, common.warnings, normalized);
    }
  }
}

export function validateTravelV2CardPack(pack, options = {}) {
  const errors = [];
  const warnings = [];
  const cards = Array.isArray(pack) ? pack : pack?.cards;
  if (!Array.isArray(cards)) return makeResult(["pack must be an array or an object with a cards array"], []);
  const normalizedCards = [];
  const seenIds = new Set();
  cards.forEach((card, index) => {
    const result = validateTravelV2CardDefinition(card, options);
    for (const error of result.errors) errors.push(`cards[${index}]: ${error}`);
    for (const warning of result.warnings) warnings.push(`cards[${index}]: ${warning}`);
    if (result.normalized) {
      normalizedCards.push(result.normalized);
      if (typeof result.normalized.id === "string") {
        if (seenIds.has(result.normalized.id)) errors.push(`cards[${index}]: duplicate id ${result.normalized.id}`);
        seenIds.add(result.normalized.id);
      }
    }
  });
  return makeResult(errors, warnings, Array.isArray(pack) ? normalizedCards : { ...clonePlain(pack), cards: normalizedCards });
}
