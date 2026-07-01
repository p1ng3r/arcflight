import { getTravelV2ConsequenceById } from "../../data/travel-events/travel-v2-consequence-catalog.js";
import { validateTravelV2CardDefinition, validateTravelV2CardPack } from "./travel-v2-card-schema.js";

const REQUIRED_CARD_COUNT = 12;
const REQUIRED_CATEGORY_COUNT = 7;
const IMPACT_FIELDS = Object.freeze(["stationImpacts", "immediateEffects", "responseActions", "clearCondition", "suppressionCondition"]);
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);

function clonePlain(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function hasText(card, field) {
  return typeof card[field] === "string" && card[field].trim().length > 0;
}

function includesGmTextLeak(card, field) {
  return hasText(card, "gmText") && hasText(card, field) && card[field].trim() === card.gmText.trim();
}

function redactForbiddenPlayerSafeFields(value) {
  if (!value || typeof value !== "object") return;
  for (const field of FORBIDDEN_PLAYER_SAFE_FIELDS) delete value[field];
  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) nested.forEach(redactForbiddenPlayerSafeFields);
    else if (nested && typeof nested === "object") redactForbiddenPlayerSafeFields(nested);
  }
}

function validateCardSpecifics(card, index, errors) {
  if (card.type !== "hazard") errors.push(`cards[${index}]: type must be hazard`);
  for (const field of ["publicText", "playerSafeSummary", "gmText"]) if (!hasText(card, field)) errors.push(`cards[${index}]: ${field} is required`);
  if (!IMPACT_FIELDS.some((field) => card[field] !== undefined)) errors.push(`cards[${index}]: at least one gameplay impact field is required`);
  if (card.responseActions === undefined && card.clearCondition === undefined) errors.push(`cards[${index}]: responseActions or clearCondition is required`);
  if (includesGmTextLeak(card, "publicText")) errors.push(`cards[${index}]: publicText must not copy gmText`);
  if (includesGmTextLeak(card, "playerSafeSummary")) errors.push(`cards[${index}]: playerSafeSummary must not copy gmText`);
  for (const ref of card.unresolvedConsequenceRefs ?? []) {
    if (!getTravelV2ConsequenceById(ref)) errors.push(`cards[${index}]: unresolvedConsequenceRefs includes unknown consequence: ${ref}`);
  }
  for (const ref of card.escalationRefs ?? []) {
    if (!getTravelV2ConsequenceById(ref)) errors.push(`cards[${index}]: escalationRefs includes unknown consequence: ${ref}`);
  }
}

export function validateTravelV2GoldStandardHazardCard(card, options = {}) {
  const schema = validateTravelV2CardDefinition(card, options);
  const errors = [...schema.errors];
  const warnings = [...schema.warnings];
  if (schema.normalized) validateCardSpecifics(schema.normalized, 0, errors);
  return { ok: errors.length === 0, errors, warnings, normalized: schema.normalized };
}

export function validateTravelV2GoldStandardHazardCards(cards, options = {}) {
  const pack = validateTravelV2CardPack(cards, options);
  const errors = [...pack.errors];
  const warnings = [...pack.warnings];
  const normalizedCards = Array.isArray(pack.normalized) ? pack.normalized : pack.normalized?.cards;
  if (!Array.isArray(normalizedCards)) errors.push("cards must be an array");
  if (Array.isArray(normalizedCards)) {
    if (normalizedCards.length !== REQUIRED_CARD_COUNT) errors.push(`gold-standard hazard pack must contain exactly ${REQUIRED_CARD_COUNT} cards`);
    const categories = new Set(normalizedCards.map((card) => card.category));
    if (categories.size < REQUIRED_CATEGORY_COUNT) errors.push(`gold-standard hazard pack must cover at least ${REQUIRED_CATEGORY_COUNT} categories`);
    normalizedCards.forEach((card, index) => validateCardSpecifics(card, index, errors));
  }
  return { ok: errors.length === 0, errors, warnings, cards: clonePlain(normalizedCards ?? []) };
}

export function prepareTravelV2GoldStandardHazardPlayerSafeCards(cards, options = {}) {
  const validation = validateTravelV2GoldStandardHazardCards(cards, options);
  const entries = validation.cards.map((card) => {
    const copy = clonePlain(card);
    redactForbiddenPlayerSafeFields(copy);
    return copy;
  });
  return { ok: validation.ok, errors: validation.errors, warnings: validation.warnings, cards: entries };
}

export function prepareTravelV2GoldStandardHazardGmReviewCards(cards, options = {}) {
  const validation = validateTravelV2GoldStandardHazardCards(cards, options);
  return { ok: validation.ok, errors: validation.errors, warnings: validation.warnings, cards: validation.cards };
}
