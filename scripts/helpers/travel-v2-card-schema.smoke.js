import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TRAVEL_V2_CARD_SCHEMA_VERSION,
  normalizeTravelV2CardDefinition,
  validateTravelV2CardDefinition,
  validateTravelV2CardPack
} from "./travel-v2-card-schema.js";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "../..");
const FIXTURE_PATH = path.join(REPO_ROOT, "scripts/dev/fixtures/travel-v2-card-schema-v0-pack.json");
const SOURCE_PATHS = ["scripts/helpers/travel-v2-card-schema.js", "scripts/dev/fixtures/travel-v2-card-schema-v0-pack.json"];
const MUTATION_PATTERNS = Object.freeze([
  /\bActor\.update\b/,
  /\bItem\.update\b/,
  /\bChatMessage\.create\b/,
  /\bJournalEntry\.create\b/,
  /\bgame\.settings\.set\b/,
  /\bsocket\.emit\b/,
  /\bcanvas\.scene\.update\b/,
  /\bTokenDocument\.update\b/
]);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 card schema smoke failed: ${message}`);
}

function readFixturePack() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
}

export default async function runTravelV2CardSchemaSmokeChecks() {
  const checked = [];
  const pack = readFixturePack();

  assertSmoke(pack.schemaVersion === TRAVEL_V2_CARD_SCHEMA_VERSION, "fixture pack should use the helper schema version");
  assertSmoke(Array.isArray(pack.cards) && pack.cards.length === 6, "fixture pack should include six card/template examples");
  for (const card of pack.cards) {
    const result = validateTravelV2CardDefinition(card);
    assertSmoke(result.ok, `${card.id} should validate: ${result.errors.join("; ")}`);
  }
  checked.push("Fixture cards validate individually");

  const packResult = validateTravelV2CardPack(pack);
  assertSmoke(packResult.ok, `fixture pack should validate: ${packResult.errors.join("; ")}`);
  checked.push("Fixture pack validates as a whole");

  const hazard = pack.cards.find((card) => card.type === "hazard");
  assertSmoke(!validateTravelV2CardDefinition({ ...hazard, schemaVersion: "future-version" }).ok, "unknown schema version should fail safely");
  assertSmoke(!validateTravelV2CardDefinition({ ...hazard, type: "mystery" }).ok, "unknown type should fail safely");
  checked.push("Unknown schema version and type fail safely");

  const riskBid = pack.cards.find((card) => card.type === "riskBid");
  assertSmoke(!validateTravelV2CardDefinition({ ...riskBid, dcIncrease: 3 }).ok, "invalid risk bid dcIncrease should fail");
  assertSmoke(!validateTravelV2CardDefinition({ ...riskBid, declareBeforeRoll: false }).ok, "risk bid declareBeforeRoll false should fail");
  checked.push("Risk bid fixed-DC and declaration guardrails fail invalid input");

  const weakHazard = { ...hazard };
  delete weakHazard.immediateEffects;
  delete weakHazard.stationImpacts;
  delete weakHazard.responseActions;
  delete weakHazard.clearCondition;
  delete weakHazard.suppressionCondition;
  const weakHazardResult = validateTravelV2CardDefinition(weakHazard);
  assertSmoke(!weakHazardResult.ok || weakHazardResult.warnings.length > 0, "hazard without real gameplay impact should warn or fail");
  checked.push("Hazards without gameplay impact are reported");

  const original = { ...hazard, id: "  copied-hazard  ", playerSafeSummary: undefined };
  const originalJson = JSON.stringify(original);
  const normalized = normalizeTravelV2CardDefinition(original);
  assertSmoke(JSON.stringify(original) === originalJson, "normalization should not mutate input");
  assertSmoke(normalized.playerSafeSummary !== original.gmText, "normalization should not copy gmText into playerSafeSummary");
  checked.push("Normalization is pure and does not leak gmText into player summaries");

  for (const relativePath of SOURCE_PATHS) {
    const text = fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
    for (const pattern of MUTATION_PATTERNS) assertSmoke(!pattern.test(text), `${relativePath} should not contain ${pattern}`);
  }
  checked.push("Schema helper and fixture avoid obvious persistent mutation calls");

  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2CardSchemaSmokeChecks();
    console.log("Travel v2 card schema smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
