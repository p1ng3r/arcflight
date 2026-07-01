import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectTravelV2CardSchemaPack,
  prepareTravelV2CardSchemaImportPreview,
  validateTravelV2CardSchemaImportPayload
} from "./travel-v2-card-schema-import-adapter.js";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "../..");
const FIXTURE_PATH = path.join(REPO_ROOT, "scripts/dev/fixtures/travel-v2-card-schema-v0-pack.json");
const ADAPTER_SOURCE_PATH = path.join(REPO_ROOT, "scripts/helpers/travel-v2-card-schema-import-adapter.js");
const MUTATION_PATTERNS = Object.freeze([
  /\bActor\.update\b/,
  /\bItem\.update\b/,
  /\bChatMessage\.create\b/,
  /\bJournalEntry\.create\b/,
  /\bgame\.settings\.set\b/,
  /\bsocket\.emit\b/,
  /\bcanvas\.scene\.update\b/,
  /\bTokenDocument\.update\b/,
  /\bCompendiumCollection\.create\b/,
  /\bWorld\.create\b/,
  /\bWorld\.update\b/
]);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 card schema import adapter smoke failed: ${message}`);
}

function readFixturePack() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
}

export default async function runTravelV2CardSchemaImportAdapterSmokeChecks() {
  const checked = [];
  const pack = readFixturePack();
  const packBefore = JSON.stringify(pack);

  assertSmoke(detectTravelV2CardSchemaPack(pack), "fixture pack should be detected");
  const preview = prepareTravelV2CardSchemaImportPreview(pack);
  assertSmoke(preview.detected === true, "preview should mark fixture as detected");
  assertSmoke(preview.ok === true, `fixture preview should validate: ${preview.errors.join("; ")}`);
  assertSmoke(preview.cardCount === 6, "fixture preview should count six cards");
  for (const [type, count] of Object.entries({ hazard: 1, consequence: 1, stationAction: 1, riskBid: 1, stationBenefit: 1, travelEncounter: 1 })) {
    assertSmoke(preview.typeCounts[type] === count, `fixture preview should count ${count} ${type}`);
  }
  checked.push("Fixture pack is detected and summarized");

  const unknown = validateTravelV2CardSchemaImportPayload({ hello: "world" });
  assertSmoke(unknown.detected === false && unknown.ok === false, "unknown payload should fail safely");
  const invalidVersion = validateTravelV2CardSchemaImportPayload({ ...pack, schemaVersion: "future-version" });
  assertSmoke(invalidVersion.detected === false && invalidVersion.ok === false, "invalid pack schema version should fail safely");
  checked.push("Unknown and invalid schema payloads fail safely");

  const arrayPreview = prepareTravelV2CardSchemaImportPreview(pack.cards);
  assertSmoke(detectTravelV2CardSchemaPack(pack.cards), "array of v0 cards should be detected");
  assertSmoke(arrayPreview.ok === true && arrayPreview.cardCount === 6, "array of v0 cards should validate");
  checked.push("Array payloads of v0 cards validate");

  assertSmoke(JSON.stringify(pack) === packBefore, "adapter should not mutate input data");
  const gmOnly = { ...pack.cards[0], id: "gm-leak-check", playerSafeSummary: undefined, gmText: "Secret GM handling" };
  const gmPreview = prepareTravelV2CardSchemaImportPreview([gmOnly]);
  assertSmoke(gmPreview.normalizedPreview[0].playerSafeSummary !== gmOnly.gmText, "preview should not copy gmText into playerSafeSummary");
  checked.push("Adapter is pure and does not leak gmText into player summaries");

  const duplicatePack = { ...pack, cards: [...pack.cards, { ...pack.cards[0] }] };
  const duplicatePreview = prepareTravelV2CardSchemaImportPreview(duplicatePack);
  assertSmoke(duplicatePreview.ok === false, "duplicate ids should fail validation");
  assertSmoke(duplicatePreview.duplicateIds.includes(pack.cards[0].id), "duplicate ids should be reported");
  assertSmoke(duplicatePreview.errors.some((error) => /duplicate id/.test(error)), "duplicate ids should be surfaced as validation errors");
  checked.push("Duplicate ids are reported through pack validation");

  const source = fs.readFileSync(ADAPTER_SOURCE_PATH, "utf8");
  for (const pattern of MUTATION_PATTERNS) assertSmoke(!pattern.test(source), `adapter should not contain ${pattern}`);
  checked.push("Adapter avoids obvious persistent mutation calls");

  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2CardSchemaImportAdapterSmokeChecks();
    console.log("Travel v2 card schema import adapter smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
