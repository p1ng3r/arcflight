import {
  TRAVEL_V2_CARD_SCHEMA_VERSION,
  validateTravelV2CardPack
} from "./travel-v2-card-schema.js";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function getPackCards(data) {
  if (isPlainObject(data) && data.schemaVersion === TRAVEL_V2_CARD_SCHEMA_VERSION && Array.isArray(data.cards)) return data.cards;
  if (Array.isArray(data) && data.every((card) => isPlainObject(card) && card.schemaVersion === TRAVEL_V2_CARD_SCHEMA_VERSION)) return data;
  return null;
}

function countTypes(cards) {
  const counts = {};
  for (const card of cards) {
    const type = typeof card?.type === "string" && card.type.length > 0 ? card.type : "<missing>";
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

function collectIds(cards) {
  return cards.map((card) => card?.id).filter((id) => typeof id === "string" && id.length > 0);
}

function collectDuplicateIds(ids) {
  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

function hasGmTextLeak(normalizedCards) {
  return normalizedCards.some((card) => typeof card?.gmText === "string" && card.gmText.length > 0 && card.playerSafeSummary === card.gmText);
}

function freezeSummary(summary) {
  return Object.freeze({
    ...summary,
    typeCounts: Object.freeze({ ...(summary.typeCounts ?? {}) }),
    errors: Object.freeze([...(summary.errors ?? [])]),
    warnings: Object.freeze([...(summary.warnings ?? [])]),
    ids: Object.freeze([...(summary.ids ?? [])]),
    duplicateIds: Object.freeze([...(summary.duplicateIds ?? [])])
  });
}

export function detectTravelV2CardSchemaPack(data) {
  return getPackCards(data) !== null;
}

export function validateTravelV2CardSchemaImportPayload(data, options = {}) {
  const cards = getPackCards(data);
  if (!cards) {
    return freezeSummary({
      detected: false,
      schemaVersion: isPlainObject(data) ? data.schemaVersion ?? null : null,
      cardCount: 0,
      typeCounts: {},
      ok: false,
      errors: ["Payload is not a Travel v2 Card Schema v0 pack."],
      warnings: [],
      ids: [],
      duplicateIds: []
    });
  }

  const source = cloneData(data);
  const validation = validateTravelV2CardPack(source, options);
  const normalizedCards = Array.isArray(validation.normalized) ? validation.normalized : validation.normalized?.cards ?? [];
  const ids = collectIds(normalizedCards);
  const duplicateIds = collectDuplicateIds(ids);
  const errors = [...(validation.errors ?? [])];
  const warnings = [...(validation.warnings ?? [])];
  if (hasGmTextLeak(normalizedCards)) errors.push("normalized cards must not copy gmText into playerSafeSummary");

  return freezeSummary({
    detected: true,
    schemaVersion: TRAVEL_V2_CARD_SCHEMA_VERSION,
    cardCount: normalizedCards.length,
    typeCounts: countTypes(normalizedCards),
    ok: validation.ok && errors.length === 0,
    errors,
    warnings,
    ids,
    duplicateIds,
    normalizedCards: options.includeNormalizedCards === true ? Object.freeze(cloneData(normalizedCards)) : undefined
  });
}

export function prepareTravelV2CardSchemaImportPreview(data, options = {}) {
  const summary = validateTravelV2CardSchemaImportPayload(data, options);
  let normalizedCards = [];
  if (summary.detected && options.includeNormalizedPreview !== false) {
    if (summary.normalizedCards) normalizedCards = summary.normalizedCards;
    else {
      const normalized = validateTravelV2CardPack(cloneData(data), options).normalized;
      normalizedCards = Array.isArray(normalized) ? normalized : normalized?.cards ?? [];
    }
  }
  const normalizedPreview = Object.freeze(normalizedCards.map((card) => Object.freeze({
    id: card.id ?? "",
    type: card.type ?? "",
    title: card.title ?? "",
    playerSafeSummary: card.playerSafeSummary ?? ""
  })));
  return Object.freeze({ ...summary, normalizedPreview });
}

export function summarizeTravelV2CardSchemaPackValidation(data, options = {}) {
  return prepareTravelV2CardSchemaImportPreview(data, { ...options, includeNormalizedCards: false });
}
