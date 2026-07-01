import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS, getTravelV2GoldStandardHazardCardById, getTravelV2GoldStandardHazardCards, getTravelV2GoldStandardHazardCardsByCategory, getTravelV2GoldStandardHazardCardsBySeverity } from "../../data/travel-events/travel-v2-gold-standard-hazard-cards.js";
import { getTravelV2ConsequenceById } from "../../data/travel-events/travel-v2-consequence-catalog.js";
import { validateTravelV2CardDefinition } from "./travel-v2-card-schema.js";
import { prepareTravelV2GoldStandardHazardGmReviewCards, prepareTravelV2GoldStandardHazardPlayerSafeCards, validateTravelV2GoldStandardHazardCard, validateTravelV2GoldStandardHazardCards } from "./travel-v2-gold-standard-hazard-cards.js";

const IMPACT_FIELDS = Object.freeze(["stationImpacts", "immediateEffects", "responseActions", "clearCondition", "suppressionCondition"]);
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "gmSummary", "gmMechanicalNotes", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "applyPayload", "before", "after", "queueInternals"]);
const FORBIDDEN_MUTATION_CALLS = Object.freeze(["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create", "World.create", "World.update"]);

function assertNoForbiddenFields(value) {
  if (!value || typeof value !== "object") return;
  for (const field of FORBIDDEN_PLAYER_SAFE_FIELDS) assert.equal(Object.hasOwn(value, field), false, `player-safe projection leaked ${field}`);
  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) nested.forEach(assertNoForbiddenFields);
    else if (nested && typeof nested === "object") assertNoForbiddenFields(nested);
  }
}

export default async function runTravelV2GoldStandardHazardCardsSmokeChecks() {
  assert.equal(TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS.length, 12, "exactly 12 hazard cards exist");
  const ids = TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS.map((card) => card.id);
  assert.equal(new Set(ids).size, ids.length, "all IDs are unique");
  for (const card of TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS) {
    assert.equal(card.type, "hazard", `${card.id} is a hazard`);
    assert.equal(validateTravelV2CardDefinition(card).ok, true, `${card.id} validates against schema v0`);
    assert.ok(card.publicText && card.playerSafeSummary && card.gmText, `${card.id} has required text`);
    assert.ok(IMPACT_FIELDS.some((field) => card[field] !== undefined), `${card.id} has a gameplay impact field`);
    assert.ok(card.responseActions || card.clearCondition, `${card.id} has response actions or clear condition`);
    for (const ref of [...(card.unresolvedConsequenceRefs ?? []), ...(card.escalationRefs ?? [])]) assert.ok(getTravelV2ConsequenceById(ref), `${card.id} references known consequence ${ref}`);
  }

  assert.ok(new Set(TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS.map((card) => card.category)).size >= 7, "at least 7 categories represented");
  assert.ok(getTravelV2GoldStandardHazardCardsBySeverity("minor").length > 0, "minor hazards represented");
  assert.ok(getTravelV2GoldStandardHazardCardsBySeverity("major").length > 0, "major hazards represented");
  assert.ok(getTravelV2GoldStandardHazardCardsBySeverity("severe").length > 0, "severe hazard represented");
  assert.equal(getTravelV2GoldStandardHazardCardById("hazard-void-shear")?.title, "Void Shear", "lookup by ID works");
  assert.ok(getTravelV2GoldStandardHazardCardsByCategory("engine").some((card) => card.id === "hazard-arkengine-cough"), "category filter works");

  const validation = validateTravelV2GoldStandardHazardCards(TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(validateTravelV2GoldStandardHazardCard(TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS[0]).ok, true, "single card validates");
  const leak = { ...TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS[0], publicText: TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS[0].gmText };
  assert.equal(validateTravelV2GoldStandardHazardCard(leak).ok, false, "gmText copied into public text fails");

  const before = JSON.stringify(TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS);
  const review = prepareTravelV2GoldStandardHazardGmReviewCards(TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS);
  assert.equal(review.ok, true, "GM review validates");
  const playerSafe = prepareTravelV2GoldStandardHazardPlayerSafeCards(TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS);
  assert.equal(playerSafe.ok, true, "player-safe projection validates");
  playerSafe.cards.forEach(assertNoForbiddenFields);
  assert.equal(JSON.stringify(TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS), before, "helpers do not mutate input");
  const copy = getTravelV2GoldStandardHazardCards();
  copy[0].tags.push("mutated-copy");
  assert.equal(TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS[0].tags.includes("mutated-copy"), false, "data getter returns clones");

  const sourceText = [
    readFileSync(new URL("../../data/travel-events/travel-v2-gold-standard-hazard-cards.js", import.meta.url), "utf8"),
    readFileSync(new URL("./travel-v2-gold-standard-hazard-cards.js", import.meta.url), "utf8")
  ].join("\n");
  for (const call of FORBIDDEN_MUTATION_CALLS) assert.equal(sourceText.includes(call), false, `forbidden persistent mutation call found: ${call}`);

  return { checked: ["card count and IDs", "schema validation", "coverage", "lookups", "player-safe redaction", "negative validation", "immutability", "mutation source scan"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2GoldStandardHazardCardsSmokeChecks().then((result) => {
    console.log("Travel v2 gold-standard hazard cards smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
