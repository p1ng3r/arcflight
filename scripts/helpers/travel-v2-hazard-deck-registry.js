import { getTravelV2ConsequenceById } from "../../data/travel-events/travel-v2-consequence-catalog.js";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_CARD_PACK_VERSION, getTravelV2GoldStandardHazardCards } from "../../data/travel-events/travel-v2-gold-standard-hazard-cards.js";
import { prepareTravelV2GoldStandardHazardGmReviewCards, prepareTravelV2GoldStandardHazardPlayerSafeCards, validateTravelV2GoldStandardHazardCards } from "./travel-v2-gold-standard-hazard-cards.js";

export const TRAVEL_V2_BUILT_IN_HAZARD_DECK_REGISTRY_VERSION = 1;
export const TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID = "travel-v2-gold-standard-hazards";
export const TRAVEL_V2_BUILT_IN_HAZARD_DECK_IDS = Object.freeze([TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID]);

const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);

function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function uniqueSorted(values) { return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].sort(); }
function collectStationKeys(card) {
  const keys = [];
  if (card.stationImpacts && typeof card.stationImpacts === "object") keys.push(...Object.keys(card.stationImpacts));
  for (const action of card.responseActions ?? []) keys.push(...(action.stationKeys ?? []));
  return keys;
}
function collectConsequenceRefs(card) { return [...(card.unresolvedConsequenceRefs ?? []), ...(card.escalationRefs ?? [])]; }
function redactForbiddenFields(value) {
  if (!value || typeof value !== "object") return value;
  for (const field of FORBIDDEN_PLAYER_SAFE_FIELDS) delete value[field];
  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) nested.forEach(redactForbiddenFields);
    else if (nested && typeof nested === "object") redactForbiddenFields(nested);
  }
  return value;
}
function hasForbiddenField(value) {
  if (!value || typeof value !== "object") return false;
  for (const field of FORBIDDEN_PLAYER_SAFE_FIELDS) if (Object.hasOwn(value, field)) return true;
  return Object.values(value).some((nested) => Array.isArray(nested) ? nested.some(hasForbiddenField) : hasForbiddenField(nested));
}
function summarizeCard(card) {
  return redactForbiddenFields({ id: card.id, schemaVersion: card.schemaVersion, type: card.type, title: card.title, category: card.category, severity: card.severity, publicText: card.publicText, playerSafeSummary: card.playerSafeSummary, stationKeys: uniqueSorted(collectStationKeys(card)), consequenceRefs: uniqueSorted(collectConsequenceRefs(card)), tags: cloneData(card.tags ?? []) });
}
function deriveCoverage(cards) {
  return {
    cardCount: cards.length,
    categories: uniqueSorted(cards.map((card) => card.category)),
    severities: uniqueSorted(cards.map((card) => card.severity)),
    stationKeys: uniqueSorted(cards.flatMap(collectStationKeys)),
    consequenceRefs: uniqueSorted(cards.flatMap(collectConsequenceRefs)),
    tags: uniqueSorted(cards.flatMap((card) => card.tags ?? []))
  };
}
function makeGoldStandardDeck() {
  const cards = getTravelV2GoldStandardHazardCards();
  const coverage = deriveCoverage(cards);
  return {
    id: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID,
    version: TRAVEL_V2_GOLD_STANDARD_HAZARD_CARD_PACK_VERSION,
    title: "Travel v2 Gold-Standard Hazards",
    description: "Built-in registry entry for the first 12 schema-aligned Travel v2 gold-standard hazard cards.",
    source: "data/travel-events/travel-v2-gold-standard-hazard-cards.js",
    cardSchemaVersion: "travel-v2-card-schema-v0",
    cardType: "hazard",
    deckKind: "built-in",
    status: "available",
    cards,
    ...coverage,
    playerSafeSummary: { id: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, title: "Travel v2 Gold-Standard Hazards", description: "A built-in, validated hazard deck for safe review and later picker use.", cardCount: coverage.cardCount, categories: coverage.categories, severities: coverage.severities, stationKeys: coverage.stationKeys, consequenceRefs: coverage.consequenceRefs, cards: cards.map(summarizeCard) },
    gmReviewSummary: { id: TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID, title: "Travel v2 Gold-Standard Hazards", cardCount: coverage.cardCount, source: "data/travel-events/travel-v2-gold-standard-hazard-cards.js", cards: prepareTravelV2GoldStandardHazardGmReviewCards(cards).cards, categories: coverage.categories, severities: coverage.severities, stationKeys: coverage.stationKeys, consequenceRefs: coverage.consequenceRefs }
  };
}
function resolveDeck(deckOrId) {
  if (typeof deckOrId === "string") return deckOrId === TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID ? makeGoldStandardDeck() : null;
  if (deckOrId && typeof deckOrId === "object") return cloneData(deckOrId);
  return null;
}

export function listTravelV2BuiltInHazardDecks(options = {}) {
  const decks = [makeGoldStandardDeck()];
  return cloneData(options.includeCards === true ? decks : decks.map(({ cards, gmReviewSummary, ...deck }) => deck));
}
export function getTravelV2BuiltInHazardDeck(deckId, options = {}) {
  const deck = resolveDeck(deckId);
  if (!deck || deck.id !== TRAVEL_V2_GOLD_STANDARD_HAZARD_DECK_ID) return null;
  return cloneData(options.includeGmReview === true ? deck : { ...deck, gmReviewSummary: undefined });
}
export function validateTravelV2BuiltInHazardDeck(deckOrId, options = {}) {
  const errors = [];
  const warnings = [];
  const deck = resolveDeck(deckOrId);
  if (!deck) return { ok: false, errors: ["built-in hazard deck not found"], warnings, deck: null };
  if (!text(deck.id)) errors.push("deck id must be a non-empty string");
  if (!TRAVEL_V2_BUILT_IN_HAZARD_DECK_IDS.includes(deck.id)) errors.push(`unknown built-in hazard deck id: ${deck.id}`);
  if (deck.deckKind !== "built-in") errors.push("deckKind must be built-in");
  if (deck.cardType !== "hazard") errors.push("cardType must be hazard");
  if (!Array.isArray(deck.cards)) errors.push("cards must be an array");
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  const ids = cards.map((card) => card.id);
  if (new Set(ids).size !== ids.length) errors.push("card ids must be unique inside the deck");
  const cardValidation = validateTravelV2GoldStandardHazardCards(cards, options.cardOptions ?? {});
  errors.push(...cardValidation.errors.map((error) => `cards: ${error}`));
  warnings.push(...cardValidation.warnings.map((warning) => `cards: ${warning}`));
  const coverage = deriveCoverage(cards);
  if (deck.cardCount !== coverage.cardCount) errors.push("cardCount must match cards length");
  for (const ref of coverage.consequenceRefs) if (!getTravelV2ConsequenceById(ref)) errors.push(`unknown consequence ref: ${ref}`);
  const playerSafeSummary = prepareTravelV2BuiltInHazardDeckPlayerSafeSummary(deck);
  if (hasForbiddenField(playerSafeSummary.summary)) errors.push("player-safe summary includes a forbidden GM-only/internal field");
  return { ok: errors.length === 0, errors, warnings, deck: cloneData(deck), coverage };
}
export function validateTravelV2BuiltInHazardDeckRegistry(options = {}) {
  const results = TRAVEL_V2_BUILT_IN_HAZARD_DECK_IDS.map((id) => validateTravelV2BuiltInHazardDeck(id, options));
  return { ok: results.every((result) => result.ok), errors: results.flatMap((result) => result.errors), warnings: results.flatMap((result) => result.warnings), registryVersion: TRAVEL_V2_BUILT_IN_HAZARD_DECK_REGISTRY_VERSION, deckIds: cloneData(TRAVEL_V2_BUILT_IN_HAZARD_DECK_IDS), results };
}
export function prepareTravelV2BuiltInHazardDeckGmReview(deckOrId, options = {}) {
  const validation = validateTravelV2BuiltInHazardDeck(deckOrId, options);
  const deck = validation.deck;
  return { ok: validation.ok, errors: validation.errors, warnings: validation.warnings, review: deck ? cloneData(deck.gmReviewSummary) : null };
}
export function prepareTravelV2BuiltInHazardDeckPlayerSafeSummary(deckOrId, options = {}) {
  const deck = resolveDeck(deckOrId);
  if (!deck) return { ok: false, errors: ["built-in hazard deck not found"], warnings: [], summary: null };
  const summary = redactForbiddenFields(cloneData(deck.playerSafeSummary ?? { id: deck.id, title: deck.title, cardCount: deck.cardCount, cards: (deck.cards ?? []).map(summarizeCard) }));
  return { ok: !hasForbiddenField(summary), errors: hasForbiddenField(summary) ? ["player-safe summary includes a forbidden GM-only/internal field"] : [], warnings: [], summary };
}
export function prepareTravelV2BuiltInHazardDeckPickerState(options = {}) {
  const selectedDeckId = options.selectedDeckId ?? null;
  const registryValidation = validateTravelV2BuiltInHazardDeckRegistry(options.validationOptions ?? {});
  const decks = listTravelV2BuiltInHazardDecks().map((deck) => prepareTravelV2BuiltInHazardDeckPlayerSafeSummary(deck.id).summary);
  const selected = selectedDeckId ? prepareTravelV2BuiltInHazardDeckPlayerSafeSummary(selectedDeckId) : null;
  const validSelection = selectedDeckId === null || selected.ok;
  return cloneData({ registryVersion: TRAVEL_V2_BUILT_IN_HAZARD_DECK_REGISTRY_VERSION, decks, selectedDeckId: validSelection ? selectedDeckId : null, requestedDeckId: selectedDeckId, selectedDeckSummary: selected?.summary ?? null, validation: { ok: registryValidation.ok && validSelection, errors: registryValidation.errors, warnings: registryValidation.warnings }, disabledReason: validSelection ? null : `Unknown built-in hazard deck id: ${selectedDeckId}`, gmReview: options.includeGmReview === true && validSelection && selectedDeckId ? prepareTravelV2BuiltInHazardDeckGmReview(selectedDeckId).review : null });
}
