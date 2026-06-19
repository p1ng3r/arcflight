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
  assertIncludes(template, "state.travelV2PreviewPanel.footerText", "template should render footer text");
  assertIncludes(template, "data-arcflight-travel-v2-pressure-apply", "template should wire apply controls to Phase 4D handler");
  assertIncludes(template, "arcflight-travel-runner-mvp__v2-preview-apply", "template should render apply controls inside preview rows");
  assertIncludes(template, "{{#if pressureApplyDisabled}}disabled{{/if}}", "template should render disabled state from model");
  assertIncludes(template, "state.travelV2PreviewPanel.pressureApplication.alreadyApplied", "template should render already-applied state");
  assertIncludes(template, "state.travelV2PreviewPanel.pressureApplication.feedbackText", "template should render application feedback");
  assertIncludes(template, "GM-only", "template should visibly mark the panel as GM-only");
  assertIncludes(template, "arcflight-travel-runner-mvp__v2-preview-row--{{tone}}", "template should use tone as a CSS class hook only");

  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview", "css should style preview panel wrapper");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row", "css should style preview rows");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--safe", "css should include safe tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--warning", "css should include warning tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--danger", "css should include danger tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--severe", "css should include severe tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-chip", "css should style preview chips");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-apply", "css should style apply controls");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-feedback", "css should style application feedback");

  return {
    ok: true,
    checked: [
      "template-panel-state",
      "template-availability-gate",
      "template-row-rendering",
      "template-chip-rendering",
      "template-read-only-footer",
      "template-tone-hook",
      "css-panel-wrapper",
      "css-row-and-chip-hooks"
    ]
  };
}

export default runTravelEventRunnerV2PreviewTemplateSmokeChecks;
