import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import {
  cleanupDuplicateArcflightItems,
  createArcflightItemFolders,
  findDuplicateArcflightItems,
  organizeArcflightItems
} from "../helpers/item-organization.js";
import { ArcflightTravelEventBuilder, openTravelEventBuilder, prepareTravelEventBuilderShellState } from "../apps/travel-event-builder.js";
import { ArcflightTravelEventRunner, openTravelEventRunner, prepareSelectedTravelEventLibraryDetails, prepareTravelEventLibraryOptions, prepareTravelEventNarrativeLog } from "../apps/travel-event-runner.js";
import { ArcflightTravelSceneOverlay, openTravelSceneOverlay } from "../apps/travel-scene-overlay.js";
import { findMissingCoreArcflightItems, syncCoreArcflightItems } from "../helpers/core-item-sync.js";
import {
  getTravelFiveStationKeys,
  normalizeTravelDegree,
  getTravelDegreeContribution,
  getTravelRoundOutcome,
  getTravelEventOutcome,
  validateTravelEventDefinition,
  prepareTravelEventSummary,
  prepareTravelRoundSummary,
  getTravelEventStationPrompt
} from "../helpers/travel-events.js";
import {
  TRAVEL_EVENT_TEMPLATE_VERSION,
  createBlankTravelEventTemplate,
  createBlankTravelRoundTemplate,
  createBlankStationPromptTemplate,
  createBlankRollFeedbackTemplate,
  createBlankOutcomeBranchesTemplate,
  createBlankFinalOutcomesTemplate,
  getTravelEventAuthoringGuidelines,
  validateTravelEventAuthoringTemplate
} from "../helpers/travel-event-template.js";
import {
  TRAVEL_EVENT_BUILDER_VERSION,
  TRAVEL_EVENT_BUILDER_LIBRARY_SETTING,
  TRAVEL_EVENT_BUILDER_LIBRARY_VERSION,
  PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING,
  PUBLISHED_TRAVEL_EVENT_LIBRARY_VERSION,
  createTravelEventDraft,
  normalizeTravelEventDraft,
  validateTravelEventDraft,
  finalizeTravelEventDraft,
  cloneTravelEventToDraft,
  createTravelBuilderResourceEffect,
  createTravelBuilderRound,
  createTravelBuilderStationPrompt,
  createTravelBuilderOutcomeBranch,
  createTravelBuilderFinalOutcome,
  prepareTravelEventBuilderFormOptions,
  applyTravelEventBuilderFormDataToDraft,
  prepareTravelEventBuilderRoundEditorState,
  applyTravelEventBuilderRoundFormDataToDraft,
  prepareTravelEventBuilderFinalOutcomeEditorState,
  prepareTravelEventBuilderFinalOutcomeEffectEditorState,
  applyTravelEventBuilderFinalOutcomeFormDataToDraft,
  applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft,
  prepareTravelEventBuilderPreview,
  analyzeTravelEventBuilderQuality,
  prepareTravelEventBuilderQualityReport,
  getTravelEventBuilderLibrary,
  getPublishedTravelEventLibrary,
  publishTravelEventDraftToLibrary,
  loadPublishedTravelEventFromLibrary,
  clonePublishedTravelEventToDraft,
  deletePublishedTravelEventFromLibrary,
  preparePublishedTravelEventLibraryState,
  filterPublishedTravelEvents,
  sortPublishedTravelEvents,
  preparePublishedTravelEventLibraryViewState,
  preparePublishedTravelEventCategoryViewState,
  togglePublishedTravelEventFavorite,
  updatePublishedTravelEventLibraryTags,
  normalizePublishedTravelEventLibraryTags,
  saveTravelEventBuilderDraftToLibrary,
  loadTravelEventBuilderDraftFromLibrary,
  deleteTravelEventBuilderDraftFromLibrary,
  duplicateTravelEventBuilderLibraryDraft,
  prepareTravelEventBuilderLibraryState
} from "../helpers/travel-event-builder.js";
import {
  advanceTravelEventRunnerRound,
  completeTravelEventRunnerSession,
  createTravelEventRunnerSession,
  buildTravelEventRunnerSessionExportData,
  exportTravelEventRunnerSessionToJson,
  importTravelEventRunnerSessionFromJson,
  parseTravelEventRunnerSessionJson,
  prepareTravelEventRunnerSessionImportPreview,
  saveImportedTravelEventRunnerSessionToLibrary,
  validateImportedTravelEventRunnerSession,
  prepareTravelEventRunnerSummaryReport,
  renderTravelEventRunnerSummaryMarkdown,
  renderTravelEventRunnerSummaryHtml,
  postTravelEventRunnerSummaryToChat,
  createTravelEventRunnerSummaryJournalEntry,
  prepareTravelEventRunnerSummaryOutputState,
  prepareTravelEventStagedEffectReview,
  normalizeTravelEventProposedEffectForReview,
  prepareTravelEventResourceEffectPreview,
  renderTravelEventStagedEffectReviewMarkdown,
  renderTravelEventStagedEffectReviewHtml,
  prepareTravelEventStagedEffectReviewState,
  TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING,
  TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION,
  cloneTravelEventRunnerSession,
  deleteTravelEventRunnerSessionFromLibrary,
  duplicateTravelEventRunnerSession,
  getTravelEventRunnerSessionLibrary,
  loadTravelEventRunnerSessionFromLibrary,
  normalizeTravelEventRunnerSession,
  prepareTravelEventRunnerSessionLibraryState,
  prepareTravelEventRunnerState,
  prepareTravelSceneOverlayState,
  retreatTravelEventRunnerRound,
  saveTravelEventRunnerSessionToLibrary,
  setTravelEventRunnerStationResult,
  getTravelEventRunnerStationActorOptions,
  normalizeTravelEventRunnerStationAssignments,
  prepareTravelEventRunnerStationAssignmentState,
  updateTravelEventRunnerStationAssignment,
  clearTravelEventRunnerStationAssignment,
  resetTravelEventRunnerStationAssignmentToShip,
  getTravelEventRunnerShipStationAssignments,
  summarizeTravelEventRunnerSession
} from "../helpers/travel-event-runner.js";
import {
  advanceShipTravelEventRound,
  applyTravelStagedEffect,
  applyTravelStagedEffects,
  clearShipTravelEvent,
  completeShipTravelEvent,
  getActiveShipTravelEvent,
  getCurrentShipTravelRound,
  getShipTravelEventState,
  previewTravelStagedEffectApplication,
  recordShipTravelStationResult,
  startShipTravelEvent
} from "../helpers/ship-travel-event-state.js";
import { CORE_HULL_PLATFORM_KEYS } from "../../data/hulls/core-hulls.js";
import { CORE_ARKENGINE_KEYS } from "../../data/arkengines/core-arkengines.js";
import { CORE_ROOM_KEYS } from "../../data/rooms/core-rooms.js";
import { CORE_SHIP_UPGRADE_KEYS } from "../../data/ship-upgrades/core-ship-upgrades.js";
import { CORE_WEAPON_KEYS, getCoreWeapon, getCoreWeaponKeys } from "../../data/weapons/core-weapons.js";
import { CORE_TRAVEL_EVENTS, CORE_TRAVEL_EVENT_KEYS, getCoreTravelEvent, getCoreTravelEventKeys, getCoreTravelEvents, getCoreTravelEventsByCategory } from "../../data/travel-events/core-travel-events.js";
import {
  CORE_STATION_ACTION_KEYS,
  CORE_STATION_ACTIONS,
  getCoreStationAction,
  getCoreStationActionKeys,
  getCoreStationActions,
  getCoreStationActionsForStation,
  getStationActionOutcome,
  previewStationActionOutcome
} from "../../data/station-actions/core-station-actions.js";
import { createCoreArkengine, createCoreHull, createCoreRoom, createCoreShipUpgrade, createCoreWeapon, createWeapon } from "../documents/creation.js";
import { assignStation, canSpendShipActionPoints, getArcflightShipData, getShipActionEconomy, getShipTravelResources, getTravelStationKeys, installArkengine, installHull, installWeapon, isTravelStationKey, previewShipTravelResourceChange, removeInstalledWeapon, resetShipActionEconomy, spendShipActionPoints, updateShipTravelResources } from "../documents/ships.js";
import { getInstallValidationWarnings, previewComponentInstall, previewInstallValidation, shouldBlockInstall } from "../helpers/install-validation-preview.js";
import { clearStationActionHistory, executeStationAction, getStationActionRollOptions, getStationActionState, previewStationAction, previewStationActionRoll, resolveAssignedActorStatistic, rollStationAction } from "../helpers/station-action-execution.js";
import { getPf2eRollTotal, getPf2eStatisticCandidateKeys, isRollablePf2eStatistic, normalizePf2eStatisticKey, resolvePf2eActorStatistic, rollPf2eStatistic } from "../helpers/pf2e-statistics.js";
import {
  backfillInstallStateForAllShips,
  backfillInstallStateForShip,
  createInstallId,
  deactivateInstallRecord,
  deactivateInstallRecordsByComponent,
  findInstallRecord,
  findShipsMissingInstallState,
  getActiveInstallRecords,
  getInactiveInstallRecords,
  getInstalledComponents,
  getInstallState,
  prepareInstallStateSummary,
  recordInstallState,
  removeInstallState
} from "../helpers/install-state.js";
import {
  TRAVEL_EVENT_BUILDER_IO_VERSION,
  exportTravelEventDraftToJson,
  importTravelEventDraftFromJson,
  importTravelEventDraftFromData,
  exportFinalTravelEventToJson,
  parseTravelEventBuilderJson,
  prepareTravelEventBuilderExportPreview,
  buildPublishedTravelEventExportData,
  exportPublishedTravelEventToJson,
  buildPublishedTravelEventPackExportData,
  exportPublishedTravelEventPackToJson,
  parsePublishedTravelEventJson,
  parsePublishedTravelEventPackJson,
  validateImportedPublishedTravelEvent,
  preparePublishedTravelEventImportPreview,
  preparePublishedTravelEventPackImportPreview,
  importPublishedTravelEventFromJson,
  importPublishedTravelEventPackFromJson,
  saveImportedPublishedTravelEventToLibrary,
  saveImportedPublishedTravelEventPackToLibrary
} from "../helpers/travel-event-builder-io.js";


function hasRegisteredSetting(settingKey) {
  const fullKey = `${ARCFLIGHT_MODULE_ID}.${settingKey}`;
  const settings = globalThis.game?.settings?.settings;
  if (typeof settings?.has === "function") return settings.has(fullKey);
  return Boolean(settings?.[fullKey]);
}

function checkReport(report, name, passed, details = {}) {
  const entry = { name, passed: Boolean(passed), details };
  report.checks.push(entry);
  return entry;
}

function summarizeCompatibilityReport(report) {
  report.passed = report.checks.every((entry) => entry.passed);
  const rows = report.checks.map((entry) => ({
    check: entry.name,
    passed: entry.passed,
    details: entry.details
  }));
  console.group(`Arcflight | Foundry V14 compatibility report ${report.passed ? "PASSED" : "NEEDS REVIEW"}`);
  console.table(rows);
  console.log("Arcflight | Foundry V14 compatibility report", report);
  console.groupEnd();
  return report;
}

/**
 * Run a non-mutating Foundry V14 compatibility report from the console.
 *
 * This verifies Arcflight's public API, settings, sheet class exports, core
 * registries, and Foundry V2 application API availability without creating or
 * updating world documents. Manual V14 smoke testing is still required.
 *
 * @returns {{passed: boolean, checks: Array}} Compatibility check summary.
 */
export function runV14CompatibilityReport() {
  const api = globalThis.game?.arcflight;
  const report = { passed: false, checks: [] };
  const applicationApi = globalThis.foundry?.applications?.api ?? {};
  const sheetApi = globalThis.foundry?.applications?.sheets ?? {};

  checkReport(report, "module API exists at game.arcflight", Boolean(api), { type: typeof api });
  checkReport(report, "world settings are registered", [
    TRAVEL_EVENT_BUILDER_LIBRARY_SETTING,
    PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING,
    TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING
  ].every(hasRegisteredSetting), {
    [TRAVEL_EVENT_BUILDER_LIBRARY_SETTING]: hasRegisteredSetting(TRAVEL_EVENT_BUILDER_LIBRARY_SETTING),
    [PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING]: hasRegisteredSetting(PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING),
    [TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING]: hasRegisteredSetting(TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING)
  });
  checkReport(report, "Foundry V2 application APIs exist", typeof applicationApi.ApplicationV2 === "function" && typeof applicationApi.HandlebarsApplicationMixin === "function" && typeof applicationApi.DialogV2 === "function" && typeof sheetApi.ActorSheetV2 === "function" && typeof sheetApi.ItemSheetV2 === "function", {
    ApplicationV2: typeof applicationApi.ApplicationV2,
    HandlebarsApplicationMixin: typeof applicationApi.HandlebarsApplicationMixin,
    DialogV2: typeof applicationApi.DialogV2,
    ActorSheetV2: typeof sheetApi.ActorSheetV2,
    ItemSheetV2: typeof sheetApi.ItemSheetV2
  });
  checkReport(report, "sheet classes load", typeof api?.ArcflightShipSheet === "function" && typeof api?.ArcflightItemSheet === "function", {
    ArcflightShipSheet: typeof api?.ArcflightShipSheet,
    ArcflightItemSheet: typeof api?.ArcflightItemSheet
  });
  checkReport(report, "core hull keys resolve", Array.isArray(CORE_HULL_PLATFORM_KEYS) && CORE_HULL_PLATFORM_KEYS.length > 0, { count: CORE_HULL_PLATFORM_KEYS.length });
  checkReport(report, "core arkengine keys resolve", Array.isArray(CORE_ARKENGINE_KEYS) && CORE_ARKENGINE_KEYS.length > 0, { count: CORE_ARKENGINE_KEYS.length });
  checkReport(report, "core room keys resolve", Array.isArray(CORE_ROOM_KEYS) && CORE_ROOM_KEYS.length > 0, { count: CORE_ROOM_KEYS.length });
  checkReport(report, "core ship upgrade keys resolve", Array.isArray(CORE_SHIP_UPGRADE_KEYS) && CORE_SHIP_UPGRADE_KEYS.length > 0, { count: CORE_SHIP_UPGRADE_KEYS.length });
  checkReport(report, "travel event keys resolve", Array.isArray(CORE_TRAVEL_EVENT_KEYS) && CORE_TRAVEL_EVENT_KEYS.length > 0, { count: CORE_TRAVEL_EVENT_KEYS.length });
  checkReport(report, "builder class exists", typeof ArcflightTravelEventBuilder === "function", { type: typeof ArcflightTravelEventBuilder });
  checkReport(report, "runner class exists", typeof ArcflightTravelEventRunner === "function", { type: typeof ArcflightTravelEventRunner });
  checkReport(report, "PF2E statistic helper functions exist", [normalizePf2eStatisticKey, getPf2eStatisticCandidateKeys, resolvePf2eActorStatistic, isRollablePf2eStatistic, getPf2eRollTotal, rollPf2eStatistic].every((helper) => typeof helper === "function"), {
    normalizePf2eStatisticKey: typeof normalizePf2eStatisticKey,
    getPf2eStatisticCandidateKeys: typeof getPf2eStatisticCandidateKeys,
    resolvePf2eActorStatistic: typeof resolvePf2eActorStatistic,
    isRollablePf2eStatistic: typeof isRollablePf2eStatistic,
    getPf2eRollTotal: typeof getPf2eRollTotal,
    rollPf2eStatistic: typeof rollPf2eStatistic
  });
  checkReport(report, "Arcflight item creation helper exists", typeof createCoreHull === "function" && typeof createCoreArkengine === "function" && typeof createCoreRoom === "function" && typeof createCoreShipUpgrade === "function", {
    createCoreHull: typeof createCoreHull,
    createCoreArkengine: typeof createCoreArkengine,
    createCoreRoom: typeof createCoreRoom,
    createCoreShipUpgrade: typeof createCoreShipUpgrade
  });
  checkReport(report, "Arcflight ship helper functions exist", typeof getArcflightShipData === "function" && typeof installHull === "function" && typeof installArkengine === "function" && typeof assignStation === "function", {
    getArcflightShipData: typeof getArcflightShipData,
    installHull: typeof installHull,
    installArkengine: typeof installArkengine,
    assignStation: typeof assignStation
  });

  return summarizeCompatibilityReport(report);
}

const ARCFLIGHT_TYPE_PREFIX = "arcflight.";
const TEMPORARY_CLEANUP_ITEM_NAMES = new Set(["test", "Arkengine", "arkengine"]);

function isTemporaryArcflightTestItem(item) {
  return (
    TEMPORARY_CLEANUP_ITEM_NAMES.has(item?.name) &&
    typeof item?.type === "string" &&
    item.type.startsWith(ARCFLIGHT_TYPE_PREFIX)
  );
}

/**
 * Build development-only helpers for Arcflight world maintenance.
 *
 * These helpers deliberately operate only on world Items from game.items and do
 * not touch compendium content or embedded actor items unless a future helper
 * explicitly documents that behavior.
 */
export function createArcflightDevTools() {
  return Object.freeze({
    /**
     * Run a non-mutating Foundry V14 compatibility report from the console.
     */
    runV14CompatibilityReport,

    /**
     * Create the suggested Arcflight folder tree in the world Items panel.
     */
    createItemFolders: createArcflightItemFolders,

    /**
     * Move only Arcflight equipment components into matching Arcflight folders.
     */
    organizeArcflightItems,

    /**
     * Return immutable core weapon source keys.
     */
    getCoreWeaponKeys,

    /**
     * Return immutable core weapon source data by key.
     */
    getCoreWeapon,

    /**
     * Data-only core travel event registry for console inspection.
     */
    CORE_TRAVEL_EVENTS,

    /**
     * Immutable core travel event source keys.
     */
    CORE_TRAVEL_EVENT_KEYS,

    /**
     * Return immutable core travel event source keys.
     */
    getCoreTravelEventKeys,

    /**
     * Return immutable core travel event source data by key.
     */
    getCoreTravelEvent,

    /**
     * Return all immutable core travel event source data.
     */
    getCoreTravelEvents,

    /**
     * Return immutable core travel events filtered by category.
     */
    getCoreTravelEventsByCategory,

    /**
     * Return the Travel Five station keys for MVP travel events.
     */
    getTravelFiveStationKeys,

    /**
     * Normalize travel degree labels for contribution tracking.
     */
    normalizeTravelDegree,

    /**
     * Convert a travel roll degree into success/failure counters.
     */
    getTravelDegreeContribution,

    /**
     * Interpret per-round travel success/failure totals.
     */
    getTravelRoundOutcome,

    /**
     * Interpret whole-event travel success/failure totals.
     */
    getTravelEventOutcome,

    /**
     * Validate a travel event definition without mutating game data.
     */
    validateTravelEventDefinition,

    /**
     * Current Travel Event Authoring Template schema version.
     */
    TRAVEL_EVENT_TEMPLATE_VERSION,

    /**
     * Create a blank canonical travel event authoring skeleton.
     */
    createBlankTravelEventTemplate,

    /**
     * Create a blank canonical travel round skeleton.
     */
    createBlankTravelRoundTemplate,

    /**
     * Create a blank canonical station prompt skeleton.
     */
    createBlankStationPromptTemplate,

    /**
     * Create blank degree-based station roll feedback.
     */
    createBlankRollFeedbackTemplate,

    /**
     * Create blank canonical round outcome branches.
     */
    createBlankOutcomeBranchesTemplate,

    /**
     * Create blank canonical final outcomes.
     */
    createBlankFinalOutcomesTemplate,

    /**
     * Return Arcflight travel event authoring prose and data guidelines.
     */
    getTravelEventAuthoringGuidelines,

    /**
     * Validate a travel event with strict authoring-template checks.
     */
    validateTravelEventAuthoringTemplate,

    /**
     * Current Travel Event Builder Foundation helper version.
     */
    TRAVEL_EVENT_BUILDER_VERSION,

    /**
     * Create a builder-owned draft travel event definition.
     */
    createTravelEventDraft,

    /**
     * Normalize a builder draft without mutating input data.
     */
    normalizeTravelEventDraft,

    /**
     * Strict-validate a normalized builder draft without throwing normal failures.
     */
    validateTravelEventDraft,

    /**
     * Produce a data-only event definition from a valid builder draft.
     */
    finalizeTravelEventDraft,

    /**
     * Clone an existing travel event into editable builder draft shape.
     */
    cloneTravelEventToDraft,

    /**
     * Build a staged resource effect object for proposedEffects arrays.
     */
    createTravelBuilderResourceEffect,

    /**
     * Create a builder-compatible travel round skeleton.
     */
    createTravelBuilderRound,

    /**
     * Create a builder-compatible station prompt skeleton.
     */
    createTravelBuilderStationPrompt,

    /**
     * Create a builder-compatible round outcome branch skeleton.
     */
    createTravelBuilderOutcomeBranch,

    /**
     * Create a builder-compatible final outcome skeleton.
     */
    createTravelBuilderFinalOutcome,

    /**
     * Prepare form control option state for the local Travel Event Builder.
     */
    prepareTravelEventBuilderFormOptions,

    /**
     * Apply top-level form data to a local Travel Event Builder draft.
     */
    applyTravelEventBuilderFormDataToDraft,

    /**
     * Prepare local round editor state for the Travel Event Builder.
     */
    prepareTravelEventBuilderRoundEditorState,

    /**
     * Apply round editor form data to a local Travel Event Builder draft.
     */
    applyTravelEventBuilderRoundFormDataToDraft,

    /**
     * Prepare final outcome text editor state for the local Travel Event Builder.
     */
    prepareTravelEventBuilderFinalOutcomeEditorState,

    /**
     * Prepare final outcome resource effect editor state for the local Travel Event Builder.
     */
    prepareTravelEventBuilderFinalOutcomeEffectEditorState,

    /**
     * Apply final outcome text form data to a local Travel Event Builder draft.
     */
    applyTravelEventBuilderFinalOutcomeFormDataToDraft,

    /**
     * Apply final outcome resource effect form data to a local Travel Event Builder draft.
     */
    applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft,

    /**
     * Prepare a read-only builder preview summary without running an event.
     */
    prepareTravelEventBuilderPreview,
    analyzeTravelEventBuilderQuality,
    prepareTravelEventBuilderQualityReport,
    TRAVEL_EVENT_BUILDER_LIBRARY_SETTING,
    TRAVEL_EVENT_BUILDER_LIBRARY_VERSION,
    PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING,
    PUBLISHED_TRAVEL_EVENT_LIBRARY_VERSION,
    getTravelEventBuilderLibrary,
    getPublishedTravelEventLibrary,
    publishTravelEventDraftToLibrary,
    loadPublishedTravelEventFromLibrary,
    clonePublishedTravelEventToDraft,
    deletePublishedTravelEventFromLibrary,
    preparePublishedTravelEventLibraryState,
  filterPublishedTravelEvents,
  sortPublishedTravelEvents,
  preparePublishedTravelEventLibraryViewState,
  preparePublishedTravelEventCategoryViewState,
  togglePublishedTravelEventFavorite,
  updatePublishedTravelEventLibraryTags,
  normalizePublishedTravelEventLibraryTags,
    saveTravelEventBuilderDraftToLibrary,
    loadTravelEventBuilderDraftFromLibrary,
    deleteTravelEventBuilderDraftFromLibrary,
    duplicateTravelEventBuilderLibraryDraft,
    prepareTravelEventBuilderLibraryState,

    /**
     * Prepare cloned travel event summary data for future UI.
     */
    prepareTravelEventSummary,

    /**
     * Prepare cloned travel round summary data for future UI.
     */
    prepareTravelRoundSummary,

    /**
     * Prepare a cloned Travel Five station prompt for future UI.
     */
    getTravelEventStationPrompt,

    /**
     * Travel Event Builder app class for local GM authoring shell checks.
     */
    ArcflightTravelEventBuilder,

    /**
     * Open the GM-facing Travel Event Builder shell.
     */
    openTravelEventBuilder,

    /**
     * Prepare local Travel Event Builder shell preview state.
     */
    prepareTravelEventBuilderShellState,

    /**
     * Travel Event Runner app class for manual GM UI checks.
     */
    ArcflightTravelEventRunner,

    /**
     * Open the GM-facing local Travel Event Runner.
     */
    openTravelEventRunner,

    /**
     * Travel Scene Overlay read-only app shell for active runner sessions.
     */
    ArcflightTravelSceneOverlay,

    /**
     * Open the read-only Travel Scene Overlay shell.
     */
    openTravelSceneOverlay,

    createTravelEventRunnerSession,
    normalizeTravelEventRunnerSession,
    prepareTravelEventRunnerState,
    prepareTravelSceneOverlayState,
    setTravelEventRunnerStationResult,
    getTravelEventRunnerStationActorOptions,
    normalizeTravelEventRunnerStationAssignments,
    prepareTravelEventRunnerStationAssignmentState,
    updateTravelEventRunnerStationAssignment,
    clearTravelEventRunnerStationAssignment,
  resetTravelEventRunnerStationAssignmentToShip,
  getTravelEventRunnerShipStationAssignments,
    advanceTravelEventRunnerRound,
    retreatTravelEventRunnerRound,
    completeTravelEventRunnerSession,
    summarizeTravelEventRunnerSession,
    buildTravelEventRunnerSessionExportData,
    exportTravelEventRunnerSessionToJson,
    importTravelEventRunnerSessionFromJson,
    parseTravelEventRunnerSessionJson,
    prepareTravelEventRunnerSessionImportPreview,
    saveImportedTravelEventRunnerSessionToLibrary,
    validateImportedTravelEventRunnerSession,
    prepareTravelEventRunnerSummaryReport,
    renderTravelEventRunnerSummaryMarkdown,
    renderTravelEventRunnerSummaryHtml,
    postTravelEventRunnerSummaryToChat,
    createTravelEventRunnerSummaryJournalEntry,
    prepareTravelEventRunnerSummaryOutputState,
    prepareTravelEventStagedEffectReview,
    normalizeTravelEventProposedEffectForReview,
    prepareTravelEventResourceEffectPreview,
    renderTravelEventStagedEffectReviewMarkdown,
    renderTravelEventStagedEffectReviewHtml,
    prepareTravelEventStagedEffectReviewState,
    TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING,
    TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION,
    getTravelEventRunnerSessionLibrary,
    saveTravelEventRunnerSessionToLibrary,
    loadTravelEventRunnerSessionFromLibrary,
    deleteTravelEventRunnerSessionFromLibrary,
    duplicateTravelEventRunnerSession,
    prepareTravelEventRunnerSessionLibraryState,
    cloneTravelEventRunnerSession,
    prepareTravelEventLibraryOptions,
    prepareSelectedTravelEventLibraryDetails,
    prepareTravelEventNarrativeLog,

    /**
     * Return normalized ship-attached travel event state.
     */
    getShipTravelEventState,

    /**
     * Return the active ship travel event, if any.
     */
    getActiveShipTravelEvent,

    /**
     * Start one active ship-attached travel event.
     */
    startShipTravelEvent,

    /**
     * Record a Travel Five station result into the current travel round.
     */
    recordShipTravelStationResult,

    /**
     * Return the current active travel round state.
     */
    getCurrentShipTravelRound,

    /**
     * Resolve the current round outcome and stage proposed effects only.
     */
    advanceShipTravelEventRound,

    /**
     * Complete the active travel event and move it to completed history.
     */
    completeShipTravelEvent,

    /**
     * Clear the active travel event without applying effects.
     */
    clearShipTravelEvent,

    /**
     * Core weapon key constants for console inspection.
     */
    CORE_WEAPON_KEYS,

    /**
     * Data-only station action registry for future station-action systems.
     */
    CORE_STATION_ACTIONS,

    /**
     * Immutable station action source keys.
     */
    CORE_STATION_ACTION_KEYS,

    /**
     * Return immutable station action source keys.
     */
    getCoreStationActionKeys,

    /**
     * Return all immutable station action source data.
     */
    getCoreStationActions,

    /**
     * Return immutable station action source data by key.
     */
    getCoreStationAction,

    /**
     * Interpret a station action degree of success into outcome copy.
     */
    getStationActionOutcome,

    /**
     * Interpret a PF2E roll result into station action outcome copy.
     */
    previewStationActionOutcome,

    /**
     * Return station action execution state for an Arcflight ship.
     */
    getStationActionState,

    /**
     * Preview whether a station action can be recorded.
     */
    previewStationAction,

    /**
     * Return roll options for a station action.
     */
    getStationActionRollOptions,

    /**
     * Preview the assigned PF2E actor/statistic for a station action roll.
     */
    previewStationActionRoll,

    /**
     * Normalize a PF2E statistic key for shared roll resolution.
     */
    normalizePf2eStatisticKey,

    /**
     * Return candidate PF2E statistic keys, including Lore fallbacks.
     */
    getPf2eStatisticCandidateKeys,

    /**
     * Resolve a rollable PF2E actor statistic without station-action coupling.
     */
    resolvePf2eActorStatistic,

    /**
     * Return whether a PF2E statistic exposes a roll method.
     */
    isRollablePf2eStatistic,

    /**
     * Extract a numeric total from a PF2E roll result.
     */
    getPf2eRollTotal,

    /**
     * Roll a PF2E statistic using shared Arcflight roll metadata.
     */
    rollPf2eStatistic,

    /**
     * Resolve a PF2E statistic object for an assigned station actor.
     */
    resolveAssignedActorStatistic,

    /**
     * Best-effort PF2E statistic roll for an assigned station actor.
     */
    rollStationAction,

    /**
     * Validate and append a station action history record without applying gameplay effects.
     */
    executeStationAction,

    /**
     * Clear ship-owned station action history.
     */
    clearStationActionHistory,

    /**
     * Return station action source data for a station key.
     */
    getCoreStationActionsForStation,

    /**
     * Create a core weapon as a PF2E equipment world Item.
     */
    createCoreWeapon,

    /**
     * Alias for createCoreWeapon.
     */
    createWeapon,

    /**
     * Dry-run core source registry coverage report for Arcflight component world Items.
     */
    findMissingCoreArcflightItems,

    /**
     * Dry-run by default. Pass { dryRun: false } to create missing core Arcflight component world Items.
     */
    syncCoreArcflightItems,

    /**
     * Dry-run duplicate detection for Arcflight component world Items inside Arcflight folders.
     */
    findDuplicateArcflightItems,

    /**
     * Dry-run by default. Pass { dryRun: false } to delete safe duplicate Arcflight world Items.
     */
    cleanupDuplicateArcflightItems,

    /**
     * Return normalized ship AP/RAP economy state.
     */
    getShipActionEconomy,

    /**
     * Return normalized live ship travel resources from current state.
     */
    getShipTravelResources,

    /**
     * Preview a ship travel resource delta without mutating the actor.
     */
    previewShipTravelResourceChange,

    /**
     * Apply ship travel resource deltas without spending AP/RAP.
     */
    updateShipTravelResources,

    /**
     * Preview a staged travel resource effect without mutating the actor.
     */
    previewTravelStagedEffectApplication,

    /**
     * Apply one staged travel resource effect by explicit GM choice.
     */
    applyTravelStagedEffect,

    /**
     * Apply multiple staged travel resource effects by explicit GM choice.
     */
    applyTravelStagedEffects,

    /**
     * Return the core Travel Five station keys.
     */
    getTravelStationKeys,

    /**
     * Return whether a station key is one of the Travel Five.
     */
    isTravelStationKey,

    /**
     * Reset current AP/RAP to max AP/RAP.
     */
    resetShipActionEconomy,

    /**
     * Spend AP/RAP from ship-owned economy state.
     */
    spendShipActionPoints,

    /**
     * Preview whether AP/RAP can be spent.
     */
    canSpendShipActionPoints,

    /**
     * Install a weapon component into a hull weapon mount.
     */
    installWeapon,

    /**
     * Remove an installed weapon by mountedWeaponId.
     */
    removeInstalledWeapon,

    /**
     * Preview-only install validation report. Never blocks or mutates installs.
     */
    previewInstallValidation,

    /**
     * Alias for previewInstallValidation.
     */
    previewComponentInstall,

    /**
     * Return preview warning strings for a proposed install.
     */
    getInstallValidationWarnings,

    /**
     * Return whether a validation preview blocks helper-driven installation.
     */
    shouldBlockInstall,

    /**
     * Generate a lightweight install record id.
     */
    createInstallId,

    /**
     * Return normalized install records currently active on an Arcflight ship.
     */
    getActiveInstallRecords,

    /**
     * Return normalized install records currently inactive on an Arcflight ship.
     */
    getInactiveInstallRecords,

    /**
     * Legacy alias for getActiveInstallRecords.
     */
    getInstalledComponents,

    /**
     * Return the normalized persistent install-state object for an Arcflight ship.
     */
    getInstallState,

    /**
     * Append one normalized persistent install record to an Arcflight ship.
     */
    recordInstallState,

    /**
     * Mark one persistent install record inactive while preserving record history.
     */
    deactivateInstallRecord,

    /**
     * Mark active persistent install records matching a component as inactive.
     */
    deactivateInstallRecordsByComponent,

    /**
     * Legacy alias for deactivateInstallRecord.
     */
    removeInstallState,

    /**
     * Find one persistent install record by installId.
     */
    findInstallRecord,

    /**
     * Prepare active/inactive counts, component counts, pressure totals, and categories.
     */
    prepareInstallStateSummary,

    /**
     * Dry-run report of Arcflight ships with installed data missing install-state records.
     */
    findShipsMissingInstallState,

    /**
     * Dry-run by default. Backfill one ship's install-state records from existing installed data.
     */
    backfillInstallStateForShip,

    /**
     * Dry-run by default. Backfill all Arcflight ships' install-state records from existing installed data.
     */
    backfillInstallStateForAllShips,
    TRAVEL_EVENT_BUILDER_IO_VERSION,
    exportTravelEventDraftToJson,
    importTravelEventDraftFromJson,
    importTravelEventDraftFromData,
    exportFinalTravelEventToJson,
    parseTravelEventBuilderJson,
    prepareTravelEventBuilderExportPreview,
    buildPublishedTravelEventExportData,
    exportPublishedTravelEventToJson,
    buildPublishedTravelEventPackExportData,
    exportPublishedTravelEventPackToJson,
    parsePublishedTravelEventJson,
    parsePublishedTravelEventPackJson,
    validateImportedPublishedTravelEvent,
    preparePublishedTravelEventImportPreview,
    preparePublishedTravelEventPackImportPreview,
    importPublishedTravelEventFromJson,
    importPublishedTravelEventPackFromJson,
    saveImportedPublishedTravelEventToLibrary,
    saveImportedPublishedTravelEventPackToLibrary,

    /**
     * TEMPORARY DEV CLEANUP TOOLING: delete known legacy Arcflight world test items.
     *
     * Deletes only world items whose name is "test", "Arkengine", or
     * "arkengine" and whose type starts with "arcflight.". Compendium items are
     * never scanned or deleted.
     *
     * @returns {Promise<Item[]>} Deleted world item documents.
     */
    async deleteTestItems() {
      const items = Array.from(globalThis.game?.items ?? []);
      const testItems = items.filter(isTemporaryArcflightTestItem);

      if (testItems.length === 0) {
        console.log("Arcflight | Temporary dev cleanup found no matching world test items to delete.");
        return [];
      }

      const deletedItems = [];
      for (const item of testItems) {
        await item.delete();
        deletedItems.push(item);
        console.log(`Arcflight | Temporary dev cleanup deleted world item "${item.name}" (${item.type}) [${item.id}].`);
      }

      console.log(`Arcflight | Temporary dev cleanup deleted ${deletedItems.length} world test item(s).`, deletedItems);
      return deletedItems;
    }
  });
}
