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
  assertIncludes(template, "state.travelV2VisibleStakes.hasStakes", "template should gate visible stakes on prepared runner state");
  assertIncludes(template, "Travel v2 visible stakes", "template should identify the visible stakes panel for accessibility");
  assertIncludes(template, "Visible Stakes", "template should render the visible stakes panel heading");
  assertIncludes(template, "state.travelV2VisibleStakes.crisisSummary", "template should render visible stakes crisis summary");
  assertIncludes(template, "state.travelV2VisibleStakes.threatenedResources", "template should render visible stakes threatened resources");
  assertIncludes(template, "state.travelV2VisibleStakes.knownDangers", "template should render visible stakes known dangers");
  assertIncludes(template, "state.travelV2VisibleStakes.knownTells", "template should render visible stakes known tells");
  assertIncludes(template, "state.travelV2VisibleStakes.availableStations", "template should render visible stakes available stations");
  assertIncludes(template, "state.travelV2VisibleStakes.safetyNote", "template should render visible stakes player-safe note");
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
  assertIncludes(template, "Final Outcome Package Review", "template should include final outcome package review panel");
  assertIncludes(template, "state.finalOutcomePackageReview", "template should render final outcome package review state");
  for (const control of ["data-arcflight-runner-copy-markdown", "data-arcflight-runner-copy-html", "data-arcflight-runner-post-chat", "data-arcflight-runner-create-journal"]) assertIncludes(template, control, `template should keep completed summary output control ${control}`);
  assertIncludes(template, "Event Outcome Package", "template should render outcome package label");
  assertIncludes(template, "data-arcflight-travel-v2-outcome-apply", "template should wire outcome application control");
  assertIncludes(template, "applyButtonLabel", "template should render outcome apply label from model");
  assertIncludes(template, "Outcome Applied", "template should include applied outcome label");
  assertIncludes(template, "GM-only", "template should visibly mark the panel as GM-only");
  assertIncludes(template, "{{#if state.canManageTravelV2Consequences}}", "template should explicitly gate the GM pending consequence queue by management permission");
  assertSmoke(template.indexOf("{{#if state.canManageTravelV2Consequences}}") < template.indexOf("Pending Consequences"), "GM permission gate should wrap Pending Consequences before its title renders");
  assertIncludes(template, "arcflight-travel-runner-mvp__v2-preview-row--{{tone}}", "template should use tone as a CSS class hook only");
  assertIncludes(template, "{{#if canApplySelectedConsequence}}", "template should gate Apply Selected Consequence on prepared item apply state");
  assertSmoke(!template.includes("{{#if selectedConsequenceApplyPreview.executable}}"), "template should not gate Apply Selected Consequence directly only on preview executable");
  assertIncludes(template, "data-arcflight-travel-v2-pending-consequence-apply-selected", "template should wire the manual selected consequence apply control");
  assertIncludes(template, "Apply Selected Consequence", "template should label the executable selected consequence apply button");
  assertIncludes(template, "Apply All Executable Selected", "template should label the GM-only batch selected consequence apply button");
  assertIncludes(template, "Clear All Selected", "template should label the GM-only batch clear selected consequence button");
  assertIncludes(template, "Clear Selection", "template should label the GM-only per-card clear selected consequence button");
  assertIncludes(template, "clearSelectionSummary", "template should reference clearSelectionSummary");
  assertIncludes(template, "clearSelectionSummary.clearableCount", "template should reference clearSelectionSummary.clearableCount");
  assertIncludes(template, `data-action="arcflight-travel-v2-clear-all-selected-consequences"`, "template should wire the GM-only clear all selected action");
  assertIncludes(template, "data-arcflight-travel-v2-pending-consequence-clear-selection", "template should wire the GM-only per-card clear selection action");
  assertIncludes(template, "canClearSelectedConsequence", "template should gate per-card clear selection on prepared clearability");
  assertIncludes(template, "Select All Single Suggestions", "template should label the GM-only single-suggestion selection button");
  assertIncludes(template, "singleSuggestionSelectionSummary", "template should reference singleSuggestionSelectionSummary");
  assertIncludes(template, "singleSuggestionSelectionSummary.eligibleCount", "template should reference singleSuggestionSelectionSummary.eligibleCount");
  assertIncludes(template, `data-action="arcflight-travel-v2-select-all-single-suggestion-consequences"`, "template should wire the GM-only single-suggestion selection action");
  for (const text of ["state.pendingConsequenceQueue.gmItemGroups","Ready to Apply","Needs Selection","Unsupported / Preview Only","Applied / Reviewed","Deferred","Dismissed","Other Pending","Use This Card","Mark Applied","Dismiss","Defer"]) assertIncludes(template, text, `template should include grouped pending consequence queue text ${text}`);
  assertSmoke(!template.includes("{{#each state.pendingConsequenceQueue.items}}"), "template should no longer render the old flat pending consequence queue loop");
  assertIncludes(template, `data-action="arcflight-travel-v2-apply-all-selected-consequences"`, "template should wire the GM-only batch selected consequence apply action");
  assertSmoke(template.indexOf("arcflight-gm-only") < template.indexOf("Apply All Executable Selected"), "batch selected consequence apply button should be inside/near GM-only markup");
  assertIncludes(template, "Applied Result", "template should render the GM-only applied result block");
  assertIncludes(template, "Follow-up Result", "template should render the follow-up applied result label");
  assertIncludes(template, "session-followup-note-only", "template should branch on session-local follow-up note results");
  assertIncludes(template, "appliedEffect.affectedTrack", "template should render applied result affected track");
  assertIncludes(template, "appliedEffect.kind", "template should render follow-up applied result kind");
  assertIncludes(template, "appliedEffect.consequenceId", "template should render follow-up applied result consequence id");
  for (const field of ["title","summary","source","createdAt","createdBy"]) assertIncludes(template, `appliedEffect.followupRecord.${field}`, `template should render follow-up applied result ${field}`);
  assertIncludes(template, "session-pressure-only", "template should branch on session-local pressure results");
  for (const field of ["pressureTrack","pressureDelta","beforeValue","afterValue","note"]) assertIncludes(template, `appliedEffect.${field}`, `template should keep pressure applied result ${field}`);
  assertSmoke(template.includes("Selected Consequence Applied Result") && template.includes("arcflight-gm-only") && template.includes("Follow-up Result"), "applied result follow-up branch should remain GM-only");
  assertIncludes(template, `data-status="applied"`, "template should keep the status-only Mark Applied button distinct");
  assertIncludes(template, "Apply Status", "template should render the GM-only apply status summary title");
  for (const field of ["totalItems","selectedCount","executableCount","alreadyAppliedCount","unsupportedCount","missingSelectionCount","missingCatalogCount","sessionPressureOnlyCount"]) assertIncludes(template, `pendingConsequenceQueue.applyStatusSummary.${field}`, `template should reference apply status summary ${field}`);
  assertIncludes(template, "Follow-up Notes", "template should render the GM-only follow-up notes title");
  assertIncludes(template, "state.consequenceFollowupReview", "template should read prepared follow-up review state");
  for (const text of ["Open","Reviewed","Deferred","Resolved","Mark Open","Mark Reviewed","Defer","Resolve","data-arcflight-travel-v2-followup-note-status","data-followup-key",`data-status="open"`,`data-status="reviewed"`,`data-status="deferred"`,`data-status="resolved"`]) assertIncludes(template, text, `template should include follow-up note status control text ${text}`);
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
    "Apply Unsupported",
    "Force Apply",
    "Apply Preview Only",
    "Apply Player",
    "Undo Follow-up",
    `data-action="apply-followup"`,
    `data-action="clear-followup"`,
    `data-action="delete-followup"`,
    "data-arcflight-followup",
    "data-arcflight-create-journal",
    "data-arcflight-create-combat",
    "data-arcflight-create-scene",
    `data-action="arcflight-travel-v2-force-apply"`,
    `data-action="arcflight-travel-v2-apply-unsupported"`,
    `data-action="arcflight-travel-v2-apply-preview-only"`,
    `data-action="arcflight-travel-v2-player-apply"`
  ]) assertSmoke(!template.includes(forbidden), `template should not include follow-up mutation/control text ${forbidden}`);
  for (const forbidden of ["Undo Apply","Batch Apply",`data-action="apply-all"`,`data-action="undo-apply"`,`data-action="batch-apply"`,`data-action="arcflight-travel-v2-force-apply"`,`data-action="arcflight-travel-v2-apply-unsupported"`,`data-action="arcflight-travel-v2-apply-preview-only"`,`data-action="arcflight-travel-v2-player-apply"`]) assertSmoke(!template.includes(forbidden), `template should not include ${forbidden}`);

  assertIncludes(css, ".arcflight-travel-runner-mvp__v2-preview", "css should style preview panel wrapper");
  assertIncludes(css, ".arcflight-travel-runner-mvp__visible-stakes", "css should style visible stakes panel wrapper");
  assertIncludes(css, ".arcflight-travel-runner-mvp__visible-stakes-grid", "css should style visible stakes reward/consequence grid");
  assertIncludes(css, ".arcflight-travel-runner-mvp__visible-stakes-stations", "css should style visible stakes station chips");
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
