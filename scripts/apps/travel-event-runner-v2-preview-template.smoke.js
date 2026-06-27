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
  assertIncludes(template, "data-arcflight-start-travel-event-runner", "template should include local runner session start button");
  assertIncludes(template, "How to start a local runner session", "template should explain the startup path");
  assertIncludes(template, "Local runner session startup diagnostics", "template should render startup diagnostics");
  assertIncludes(template, "No published finalized travel event exists", "template should explain missing published finalized event state");
  assertIncludes(template, "PF2E vehicle / Arcflight ship actor", "template should explain ship/PF2E vehicle requirement");
  assertIncludes(template, "Start Local Runner Session is blocked", "template should explain blocked start state");
  assertIncludes(template, "state.travelV2PreviewPanel.available", "template should gate preview rows on availability");
  assertIncludes(template, "state.travelV2PreviewPanel.rows", "template should iterate preview rows");
  assertIncludes(template, "pressureChips", "template should render pressure chips");
  assertIncludes(template, "{{displayAmount}}", "template should render chip display amount");
  assertIncludes(template, "{{label}}", "template should render chip label");
  assertIncludes(template, "state.travelV2PreviewPanel.footerText", "template should render footer text");
  assertIncludes(template, "data-arcflight-travel-v2-pressure-apply", "template should wire apply controls to Phase 4D handler");
  assertIncludes(template, "data-arcflight-travel-v2-pressure-correct", "template should wire correction controls to Phase 4G handler");
  assertIncludes(template, "canCorrectPressure", "template should show correction controls from model state");
  assertIncludes(template, "arcflight-travel-runner-mvp__v2-preview-apply", "template should render apply controls inside preview rows");
  assertIncludes(template, "{{#if pressureApplyDisabled}}disabled{{/if}}", "template should render disabled state from model");
  assertIncludes(template, "state.travelV2PreviewPanel.pressureApplication.alreadyApplied", "template should render already-applied state");
  assertIncludes(template, "state.travelV2PreviewPanel.pressureApplication.feedbackText", "template should render application feedback");
  assertIncludes(template, "state.travelV2PreviewPanel.travelV2RoundFinalizationState", "template should render finalization state");
  assertIncludes(template, "data-arcflight-travel-v2-round-finalize", "template should wire finalize control to Phase 5D handler");
  assertIncludes(template, "finalizeDisabled", "template should render disabled finalization state from model");
  assertIncludes(template, "buttonLabel", "template should render finalization button label from model");
  assertIncludes(template, "readinessText", "template should render event-complete-ready readiness text");
  assertIncludes(template, "state.travelV2PreviewPanel.travelV2EventCompletionReadiness", "template should render event completion readiness state");
  assertIncludes(template, "Event Completion Readiness", "template should render readiness label");
  assertIncludes(template, "countText", "template should render readiness counts");
  assertIncludes(template, "nextStepText", "template should render readiness next-step text");
  assertIncludes(template, "data-arcflight-travel-v2-event-complete", "template should wire event completion control to Phase 5G handler");
  assertIncludes(template, "completeDisabled", "template should render disabled completion state from model");
  assertIncludes(template, "completeButtonLabel", "template should render completion button label from model");
  assertIncludes(template, "Event Completed", "template should include completed state label");
  assertIncludes(template, "state.travelV2PreviewPanel.travelV2EventOutcomePackage", "template should render outcome package state");
  assertIncludes(template, "Event Outcome Package", "template should render outcome package label");
  assertIncludes(template, "data-arcflight-travel-v2-outcome-apply", "template should wire outcome application control");
  assertIncludes(template, "applyButtonLabel", "template should render outcome apply label from model");
  assertIncludes(template, "Outcome Applied", "template should include applied outcome label");
  assertIncludes(template, "GM-only", "template should visibly mark the panel as GM-only");
  assertIncludes(template, "arcflight-travel-runner-mvp__v2-preview-row--{{tone}}", "template should use tone as a CSS class hook only");
  assertIncludes(template, "{{#if canApplySelectedConsequence}}", "template should gate Apply Selected Consequence on prepared item apply state");
  assertSmoke(!template.includes("{{#if selectedConsequenceApplyPreview.executable}}"), "template should not gate Apply Selected Consequence directly only on preview executable");
  assertIncludes(template, "data-arcflight-travel-v2-pending-consequence-apply-selected", "template should wire the manual selected consequence apply control");
  assertIncludes(template, "Apply Selected Consequence", "template should label the executable selected consequence apply button");
  assertIncludes(template, "Applied Result", "template should render the GM-only applied result block");
  assertIncludes(template, "appliedEffect.affectedTrack", "template should render applied result affected track");
  assertIncludes(template, "appliedEffect.pressureTrack", "template should render applied result pressure track");
  assertIncludes(template, `data-status="applied"`, "template should keep the status-only Mark Applied button distinct");
  assertIncludes(template, "Apply Status", "template should render the GM-only apply status summary title");
  for (const field of ["totalItems","selectedCount","executableCount","alreadyAppliedCount","unsupportedCount","missingSelectionCount","missingCatalogCount","sessionPressureOnlyCount"]) assertIncludes(template, `pendingConsequenceQueue.applyStatusSummary.${field}`, `template should reference apply status summary ${field}`);
  assertIncludes(template, "Follow-up Notes", "template should render the GM-only follow-up notes title");
  assertIncludes(template, "state.session.travelV2ConsequenceFollowups.records", "template should read session-local follow-up records directly");
  for (const field of ["title","affectedTrack","kind","mutation","summary","source","createdAt","createdBy"]) assertIncludes(template, `{{${field}}}`, `template should render follow-up ${field}`);
  assertIncludes(template, "aria-label=\"Follow-up Notes\"", "template should include a follow-up notes panel");
  assertSmoke(template.includes("aria-label=\"Follow-up Notes\"") && template.includes("arcflight-gm-only"), "follow-up panel should include arcflight-gm-only");
  for (const forbidden of [
    "Apply Follow-up",
    "Clear Follow-up",
    "Dismiss Follow-up",
    "Delete Follow-up",
    "Send to Chat",
    "Create Journal",
    "Create Encounter",
    "Create Scene",
    "Create Combat",
    "Apply All",
    "Undo Follow-up",
    `data-action="apply-followup"`,
    `data-action="clear-followup"`,
    `data-action="delete-followup"`,
    "data-arcflight-followup",
    "data-arcflight-create-journal",
    "data-arcflight-create-combat",
    "data-arcflight-create-scene"
  ]) assertSmoke(!template.includes(forbidden), `template should not include follow-up mutation/control text ${forbidden}`);
  for (const forbidden of ["Apply All","Undo Apply","Batch Apply",`data-action="apply-all"`,`data-action="undo-apply"`,`data-action="batch-apply"`]) assertSmoke(!template.includes(forbidden), `template should not include ${forbidden}`);

  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview", "css should style preview panel wrapper");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row", "css should style preview rows");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--safe", "css should include safe tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--warning", "css should include warning tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--danger", "css should include danger tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-row--severe", "css should include severe tone hook");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-chip", "css should style preview chips");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-apply", "css should style apply controls");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-correct", "css should style correction controls");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview-feedback", "css should style application feedback");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-finalize", "css should style round finalization controls");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-finalize-button", "css should style round finalization button");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-event-readiness", "css should style event completion readiness summary");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-event-complete-button", "css should style event completion button");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-outcome-package", "css should style outcome package summary");
  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-outcome-apply-button", "css should style outcome apply button");

  return {
    ok: true,
    checked: [
      "template-panel-state",
      "template-startup-session-copy",
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
