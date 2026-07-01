import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TRAVEL_V2_CONSEQUENCE_CATALOG,
  getTravelV2ConsequenceById,
  getTravelV2ConsequencesByAffectedTrack,
  getTravelV2ConsequencesBySeverity,
  getTravelV2ConsequencesBySource
} from "../../data/travel-events/travel-v2-consequence-catalog.js";
import {
  normalizeTravelV2ConsequenceCatalogEntry,
  prepareTravelV2ConsequenceCatalogReview,
  prepareTravelV2ConsequencePlayerSafeCatalog,
  validateTravelV2ConsequenceCatalog,
  validateTravelV2ConsequenceCatalogEntry
} from "./travel-v2-consequence-catalog.js";

const REQUIRED_TITLES = Object.freeze(["Arkengine Surge", "Lifeveil Flicker", "Route Drift", "Hull Stress", "Crew Panic", "Cargo Shift", "Supplies Delay", "Threat Attracted", "Hazard Escalation", "Ship Scar Candidate"]);
const FORBIDDEN_PLAYER_SAFE_FIELDS = Object.freeze(["gmText", "explicitGmApplyEffect", "sessionLocalEffect", "internalMutation", "targetActorId", "targetActorUuid", "before", "after", "applyPayload", "queueInternals"]);
const FORBIDDEN_MUTATION_CALLS = Object.freeze(["Actor.update", "actor.update", "Item.update", "item.update", "ChatMessage.create", "JournalEntry.create", "game.settings.set", "socket.emit", "canvas.scene.update", "TokenDocument.update", "Combat.create", "ActiveEffect.create", "CompendiumCollection.create"]);

function assertNoForbiddenPlayerSafeFields(entry) {
  for (const field of FORBIDDEN_PLAYER_SAFE_FIELDS) assert.equal(Object.hasOwn(entry, field), false, `player-safe entry leaked ${field}`);
}

export default async function runTravelV2ConsequenceCatalogSmokeChecks() {
  assert.ok(Array.isArray(TRAVEL_V2_CONSEQUENCE_CATALOG), "catalog module imports");
  assert.ok(TRAVEL_V2_CONSEQUENCE_CATALOG.length >= 10, "catalog has foundation entries");
  for (const title of REQUIRED_TITLES) assert.ok(TRAVEL_V2_CONSEQUENCE_CATALOG.some((entry) => entry.title === title), `missing ${title}`);

  const ids = TRAVEL_V2_CONSEQUENCE_CATALOG.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, "all IDs are unique");

  const validation = validateTravelV2ConsequenceCatalog(TRAVEL_V2_CONSEQUENCE_CATALOG);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(validation.counts.entries, TRAVEL_V2_CONSEQUENCE_CATALOG.length);
  assert.ok(validation.entries.every((entry) => entry.schemaVersion === "travel-v2-card-schema-v0" && entry.type === "consequence"), "entries are schema-aligned consequence cards");

  assert.equal(getTravelV2ConsequenceById("consequence-arkengine-surge")?.title, "Arkengine Surge", "lookup by ID works");
  assert.ok(getTravelV2ConsequencesBySeverity("major").length > 0, "filtering by severity works");
  assert.ok(getTravelV2ConsequencesByAffectedTrack("Hull").some((entry) => entry.id === "consequence-hull-stress"), "filtering by affectedTrack works");
  assert.ok(getTravelV2ConsequencesBySource("failed-support").some((entry) => entry.id === "consequence-crew-panic"), "filtering by source works");

  const review = prepareTravelV2ConsequenceCatalogReview(TRAVEL_V2_CONSEQUENCE_CATALOG);
  assert.equal(review.ok, true, "GM review validates");
  assert.ok(review.entries.every((entry) => entry.gmText && entry.applyEffectSummary), "GM review includes gmText and applyEffectSummary");

  const playerSafe = prepareTravelV2ConsequencePlayerSafeCatalog(TRAVEL_V2_CONSEQUENCE_CATALOG);
  assert.equal(playerSafe.ok, true, "player-safe catalog validates");
  for (const entry of playerSafe.entries) {
    assertNoForbiddenPlayerSafeFields(entry);
    assert.ok(entry.publicText && entry.playerSafeSummary, "player-safe output includes public text and summary");
  }

  const original = { ...TRAVEL_V2_CONSEQUENCE_CATALOG[0], tags: [...TRAVEL_V2_CONSEQUENCE_CATALOG[0].tags] };
  const before = JSON.stringify(original);
  const normalized = normalizeTravelV2ConsequenceCatalogEntry(original);
  normalized.tags.push("mutated-copy");
  assert.equal(JSON.stringify(original), before, "normalization does not mutate input");

  assert.equal(validateTravelV2ConsequenceCatalog([TRAVEL_V2_CONSEQUENCE_CATALOG[0], TRAVEL_V2_CONSEQUENCE_CATALOG[0]]).ok, false, "duplicate IDs fail validation");
  assert.equal(validateTravelV2ConsequenceCatalogEntry({ id: "missing-fields" }).ok, false, "missing required fields fail validation");
  const leak = { ...TRAVEL_V2_CONSEQUENCE_CATALOG[0], playerSafeSummary: TRAVEL_V2_CONSEQUENCE_CATALOG[0].gmText };
  assert.equal(validateTravelV2ConsequenceCatalogEntry(leak).ok, false, "gmText copied into playerSafeSummary fails validation");
  const missingSummary = { ...TRAVEL_V2_CONSEQUENCE_CATALOG[0], applyEffectSummary: "" };
  assert.equal(validateTravelV2ConsequenceCatalogEntry(missingSummary).ok, false, "explicitGmApplyEffect without applyEffectSummary fails validation");

  const sourceText = [
    readFileSync(new URL("../../data/travel-events/travel-v2-consequence-catalog.js", import.meta.url), "utf8"),
    readFileSync(new URL("./travel-v2-consequence-catalog.js", import.meta.url), "utf8")
  ].join("\n");
  for (const call of FORBIDDEN_MUTATION_CALLS) assert.equal(sourceText.includes(call), false, `forbidden persistent mutation call found: ${call}`);

  return { checked: ["catalog imports", "foundation entries", "validation", "lookups and filters", "GM review", "player-safe redaction", "negative validation", "mutation source scan"] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTravelV2ConsequenceCatalogSmokeChecks().then((result) => {
    console.log("Travel v2 consequence catalog smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
