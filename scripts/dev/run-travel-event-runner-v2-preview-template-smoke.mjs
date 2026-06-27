import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODULE_ROOT = path.resolve(__dirname, "../..");
const TEMPLATE_PATH = path.join(MODULE_ROOT, "templates/apps/travel-event-runner.hbs");
const STYLE_PATH = path.join(MODULE_ROOT, "styles/arcflight.css");

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 preview template smoke check failed: ${message}`);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assertIncludes(source, needle, message) {
  assertSmoke(source.includes(needle), message);
}

export function runTravelEventRunnerV2PreviewTemplateSmokeChecks() {
  const template = readUtf8(TEMPLATE_PATH);
  const css = readUtf8(STYLE_PATH);

  assertIncludes(template, "state.travelV2PreviewPanel", "template should reference preview panel state");
  assertIncludes(template, "state.travelV2PreviewPanel.available", "template should gate preview rows on availability");
  assertIncludes(template, "state.travelV2PreviewPanel.rows", "template should iterate preview rows");
  assertIncludes(template, "pressureChips", "template should render pressure chips");
  assertIncludes(template, "{{displayAmount}}", "template should render chip display amount");
  assertIncludes(template, "{{label}}", "template should render chip label");
  assertIncludes(template, "state.travelV2PreviewPanel.footerText", "template should render read-only footer text");
  assertIncludes(template, "Read-only", "template should visibly mark the panel as read-only");
  assertIncludes(template, "arcflight-travel-runner-mvp__v2-preview-row--{{tone}}", "template should use tone as a CSS class hook only");

  assertIncludes(template, "Apply Preview", "template should render selected consequence apply preview block");
  assertIncludes(template, "selectedConsequenceApplyPreview.applyEffectSummary", "template should render GM apply preview summary");
  assertIncludes(template, "selectedConsequenceApplyPreview.warningText", "template should render preview-only warning text");
  assertIncludes(template, "{{#if selectedConsequenceApplyPreview.executable}}", "template should gate Apply Selected Consequence on executable previews only");
  assertIncludes(template, "data-arcflight-travel-v2-pending-consequence-apply-selected", "template should add the narrow selected consequence Apply button");
  assertIncludes(template, "Apply Selected Consequence", "template should label the narrow selected consequence Apply button");
  assertIncludes(template, `data-status="applied"`, "template should keep Mark Applied as a distinct status-only button");

  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview", "css should style preview panel wrapper");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row", "css should style preview rows");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--safe", "css should include safe tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--warning", "css should include warning tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--danger", "css should include danger tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--severe", "css should include severe tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-chip", "css should style preview chips");

  return {
    ok: true,
    checked: [
      "template-panel-state",
      "template-availability-gate",
      "template-row-rendering",
      "template-chip-rendering",
      "template-read-only-footer",
      "template-tone-hook",
      "selected-consequence-apply-preview",
      "selected-consequence-manual-apply-button",
      "css-panel-wrapper",
      "css-row-and-chip-hooks"
    ]
  };
}

function printSmokeResult(result) {
  console.log("Travel v2 preview template smoke checks passed.");
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
}

try {
  const result = runTravelEventRunnerV2PreviewTemplateSmokeChecks();
  printSmokeResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

export default runTravelEventRunnerV2PreviewTemplateSmokeChecks;
