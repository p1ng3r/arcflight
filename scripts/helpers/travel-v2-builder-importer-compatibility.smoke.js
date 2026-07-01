import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importTravelEventDraftFromData, validateImportedPublishedTravelEvent } from "./travel-event-builder-io.js";
import { normalizeTravelEventDraft, prepareTravelEventBuilderQualityReport } from "./travel-event-builder.js";
import { validateTravelEventDefinition } from "./travel-events.js";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "../..");
const AUDIT_DOC_PATH = path.join(REPO_ROOT, "docs/travel-v2-builder-importer-compatibility-audit.md");
const FIXTURE_PATH = path.join(REPO_ROOT, "scripts/dev/fixtures/travel-v2-builder-importer-compatibility-event.json");
const BUILDER_IMPORTER_PATHS = Object.freeze([
  "scripts/apps/travel-event-builder.js",
  "templates/apps/travel-event-builder.hbs",
  "scripts/helpers/travel-event-builder.js",
  "scripts/helpers/travel-event-builder-io.js",
  "scripts/helpers/travel-event-template.js",
  "scripts/helpers/travel-events.js"
]);
const REQUIRED_HEADINGS = Object.freeze([
  "## Existing Builder / Importer Inventory",
  "## Builder to Runner Compatibility Matrix",
  "## Compatibility Gaps",
  "## Recommended Next PRs"
]);
const REQUIRED_MATRIX_TERMS = Object.freeze([
  "hazard cards",
  "consequence cards",
  "station action cards",
  "risk bids",
  "station combo benefit cards",
  "visible stakes",
  "narration hooks",
  "schema version",
  "import validation"
]);
const MUTATION_PATTERNS = Object.freeze([
  /\bActor\.update\b/,
  /\bItem\.update\b/,
  /\bChatMessage\.create\b/,
  /\bJournalEntry\.create\b/,
  /\bgame\.settings\.set\b/,
  /\bsocket\.emit\b/,
  /\bcanvas\.scene\.update\b/,
  /\bTokenDocument\.update\b/,
  /\bCompendium(?:Collection)?\.create\b/,
  /\bWorld\.(?:create|update)\b/
]);

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 builder/importer compatibility smoke failed: ${message}`);
}

function readRepoText(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function includesCaseInsensitive(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export default async function runTravelV2BuilderImporterCompatibilitySmokeChecks() {
  const checked = [];

  assertSmoke(typeof normalizeTravelEventDraft === "function", "builder normalizer import should be available");
  assertSmoke(typeof prepareTravelEventBuilderQualityReport === "function", "builder quality report import should be available");
  assertSmoke(typeof importTravelEventDraftFromData === "function", "draft importer import should be available");
  assertSmoke(typeof validateImportedPublishedTravelEvent === "function", "published import validator import should be available");
  checked.push("Builder/importer helper modules import without throwing");

  for (const relativePath of BUILDER_IMPORTER_PATHS) {
    assertSmoke(fs.existsSync(path.join(REPO_ROOT, relativePath)), `${relativePath} should be discoverable`);
  }
  checked.push("Existing builder/importer paths are discoverable");

  assertSmoke(fs.existsSync(AUDIT_DOC_PATH), "compatibility audit doc should exist");
  const auditDoc = fs.readFileSync(AUDIT_DOC_PATH, "utf8");
  for (const heading of REQUIRED_HEADINGS) assertSmoke(auditDoc.includes(heading), `audit doc should include heading ${heading}`);
  for (const term of REQUIRED_MATRIX_TERMS) assertSmoke(includesCaseInsensitive(auditDoc, term), `audit doc should include roadmap term ${term}`);
  checked.push("Compatibility audit doc includes required headings and roadmap terms");

  assertSmoke(fs.existsSync(FIXTURE_PATH), "compatibility fixture should exist");
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  assertSmoke(typeof fixture.name === "string" && fixture.name.length > 0, "fixture should include an event title/name");
  assertSmoke(fixture.roundCount === 2 && Array.isArray(fixture.rounds) && fixture.rounds.length === 2, "fixture should include two rounds");
  assertSmoke(Array.isArray(fixture.travelStations) && fixture.travelStations.length === 5, "fixture should include Travel Five stations");
  assertSmoke(fixture.finalOutcomes && typeof fixture.finalOutcomes === "object", "fixture should include final outcomes");
  checked.push("Compatibility fixture loads as targeted JSON");

  const definitionValidation = validateTravelEventDefinition(fixture, { strictAuthoring: false });
  assertSmoke(definitionValidation.ok, `fixture should validate as a current event definition: ${definitionValidation.errors.join("; ")}`);
  const draftImport = importTravelEventDraftFromData(fixture);
  assertSmoke(draftImport.draft?.key === fixture.key, "draft importer should normalize the fixture key");
  const publishedValidation = validateImportedPublishedTravelEvent(fixture);
  assertSmoke(publishedValidation.ok || publishedValidation.errors.every((error) => typeof error === "string" && error.length > 0), "published import validator should accept or safely report fixture compatibility gaps");
  checked.push("Existing validation/import helpers accept or safely report fixture compatibility gaps");

  const sourceText = BUILDER_IMPORTER_PATHS.filter((relativePath) => relativePath.endsWith(".js")).map((relativePath) => readRepoText(relativePath)).join("\n");
  for (const pattern of MUTATION_PATTERNS) assertSmoke(!pattern.test(sourceText), `builder/importer validation source should not contain ${pattern}`);
  checked.push("Builder/importer validation source avoids automatic persistent mutation calls");

  return { checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await runTravelV2BuilderImporterCompatibilitySmokeChecks();
    console.log("Travel v2 builder/importer compatibility smoke checks passed.");
    console.log(`Checked ${result.checked.length} groups:`);
    for (const checkName of result.checked) console.log(`- ${checkName}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
