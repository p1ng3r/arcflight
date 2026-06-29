import { ARCFLIGHT } from "./config/constants.js";
import { TRAVEL_V2_DEV_TOOLS_SETTING } from "./helpers/travel-v2-dev-tools.js";
import { createArcflightDevTools } from "./dev/dev-tools.js";
import { ArcflightTravelEventBuilder, openTravelEventBuilder, prepareTravelEventBuilderShellState } from "./apps/travel-event-builder.js";
import { ArcflightTravelEventRunner, getActiveTravelEventRunner, openTravelEventRunner, prepareSelectedTravelEventLibraryDetails, prepareTravelEventLibraryOptions, prepareTravelEventNarrativeLog, updateActiveTravelEventRunnerSession } from "./apps/travel-event-runner.js";
import { ArcflightTravelSceneOverlay, getActiveTravelSceneOverlay, openTravelSceneOverlay, updateActiveTravelSceneOverlayContext } from "./apps/travel-scene-overlay.js";
import {
  ArcflightTravelPlayerMissionBoard,
  ArcflightTravelPlayerReactionPrompt,
  ArcflightTravelPlayerStationCard,
  broadcastTravelPlayerStationCardToAllPlayers,
  handleTravelPlayerStationCardSocketPayload,
  openTravelPlayerMissionBoard,
  openTravelPlayerReactionPrompt,
  openTravelPlayerStationCard,
  registerTravelPlayerStationApproachSubmitHandler,
  registerTravelPlayerReactionResponseHandler,
  registerTravelPlayerStationRollHandler,
  resolveActivePlayerOwnersForStation,
  sendAllTravelPlayerStationCardsToPlayers,
  prepareTravelPlayerMissionBoardStateForPlayers,
  queueTravelPlayerMissionBoardRefreshToPlayers,
  sendTravelPlayerMissionBoardStationUpdateToPlayers,
  sendTravelPlayerMissionBoardToPlayers,
  sendTravelPlayerReactionPromptToPlayers,
  sendTravelPlayerStationCardSocketDiagnostic,
  sendTravelPlayerStationCardToPlayers
} from "./apps/travel-player-station-card.js";
import { runFrameworkSmokeTest } from "./dev/framework-smoke-test.js";
import { registerArcflightFoundryCheckRunner, runFoundryChecks, runPlayerSafetyCheck } from "./dev/foundry-check-runner.js";
import {
  createArcflightItem,
  createArkengine,
  createArkengineMod,
  createCoreArkengine,
  createCoreArkengineMod,
  createCoreCrewAsset,
  createCoreHull,
  createCoreRoom,
  createCoreShipUpgrade,
  createCoreWeapon,
  createCrewAsset,
  createHull,
  createRoom,
  createWeapon,
  createShipUpgrade,
  getArcflightItemDocumentType
} from "./documents/creation.js";
import { CORE_HULL_PLATFORM_KEYS, CORE_HULLS, getCoreHull, getCoreHullPlatformKeys } from "../data/hulls/core-hulls.js";
import { HULL_PATTERN_KEYS, HULL_PATTERNS, getHullPattern, getHullPatternKeys } from "../data/hulls/hull-patterns.js";
import { CORE_ARKENGINE_KEYS, CORE_ARKENGINES, getCoreArkengine, getCoreArkengineKeys } from "../data/arkengines/core-arkengines.js";
import { ARKENGINE_PATTERN_KEYS, ARKENGINE_PATTERNS, getArkenginePattern, getArkenginePatternKeys } from "../data/arkengines/arkengine-patterns.js";
import { CORE_ROOM_KEYS, CORE_ROOMS, getCoreRoom, getCoreRoomKeys } from "../data/rooms/core-rooms.js";
import { CORE_WEAPON_KEYS, CORE_WEAPONS, getCoreWeapon, getCoreWeaponKeys } from "../data/weapons/core-weapons.js";
import { CORE_SHIP_UPGRADE_KEYS, CORE_SHIP_UPGRADES, getCoreShipUpgrade, getCoreShipUpgradeKeys } from "../data/ship-upgrades/core-ship-upgrades.js";
import { CORE_ARKENGINE_MOD_KEYS, CORE_ARKENGINE_MODS, getCoreArkengineMod, getCoreArkengineModKeys } from "../data/arkengine-mods/core-arkengine-mods.js";
import { CORE_STATIONS, STATION_KEYS, getStation, getStationKeys, getStations } from "../data/stations/core-stations.js";
import { CORE_TRAVEL_EVENTS, CORE_TRAVEL_EVENT_KEYS, getCoreTravelEvent, getCoreTravelEventKeys, getCoreTravelEvents, getCoreTravelEventsByCategory } from "../data/travel-events/core-travel-events.js";
import {
  CORE_STATION_ACTION_KEYS,
  CORE_STATION_ACTIONS,
  getCoreStationAction,
  getCoreStationActionKeys,
  getCoreStationActions,
  getCoreStationActionsForStation,
  getStationActionOutcome,
  previewStationActionOutcome
} from "../data/station-actions/core-station-actions.js";
import { CORE_CREW_ASSET_KEYS, CORE_CREW_ASSETS, getCoreCrewAsset, getCoreCrewAssetKeys } from "../data/crew/core-crew-assets.js";
import {
  ARKENGINE_VARIANT_KEYS,
  ARKENGINE_VARIANTS,
  getArkengineVariant,
  getArkengineVariantKeys,
  getArkengineVariants
} from "../data/arkengines/arkengine-variants.js";
import {
  arcflightComponentDefaults,
  getDefaultArcflightComponentData,
  getComponentData,
  getComponentRefitPressure,
  getComponentTierMetadata,
  getComponentType,
  isArcflightItem
} from "./documents/components.js";
import {
  ARCFLIGHT_SHIP_ACTOR_TYPE,
  arcflightShipDefaults,
  calculateDerivedShipStats,
  calculateRefitPressure,
  canSpendShipActionPoints,
  getArcflightShipData,
  getShipActionEconomy,
  getShipTravelResources,
  getTravelStationKeys,
  getShipRefitPressure,
  getShipRefitStatus,
  getShipTierState,
  isTravelStationKey,
  previewShipTravelResourceChange,
  updateShipTravelResources,
  addCrewAsset,
  assignStation,
  clearComponentPatterns,
  clearCrewRoster,
  clearInstalledArkengineMods,
  clearInstalledRooms,
  clearInstalledShipUpgrades,
  clearShipBuild,
  clearStationAssignment,
  clearStationAssignments,
  getDefaultArcflightShipData,
  installArkengine,
  installArkengineMod,
  installArkengineModOnShip,
  installArkengineOnShip,
  installHull,
  installHullOnShip,
  installRoom,
  installRoomOnShip,
  installShipUpgrade,
  installShipUpgradeOnShip,
  installWeapon,
  installWeaponOnShip,
  removeInstalledWeapon,
  recalculateShipStats,
  removeCrewAsset,
  removeInstalledArkengineMod,
  removeInstalledCrewAsset,
  removeInstalledRoom,
  removeInstalledShipUpgrade,
  resetShipActionEconomy,
  spendShipActionPoints,
  updateShipTierState,
  setArkenginePattern,
  setHullPattern
} from "./documents/ships.js";
import { registerArcflightSheets } from "./sheets/registration.js";
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
  prepareTravelEventEffectApplicationState,
  applyTravelEventRunnerSelectedEffects,
  applyTravelEventRunnerResourceEffect,
  getTravelEventAppliedEffectRecords,
  isTravelEventEffectApplied,
  markTravelEventEffectApplied,
  buildTravelEventAppliedEffectRecord,
  undoTravelEventAppliedEffect,
  prepareTravelEventAppliedEffectHistoryState,
  isTravelEventAppliedEffectUndoable,
  markTravelEventAppliedEffectUndone,
  buildTravelEventEffectUndoRecord,
  TRAVEL_APPROACH_STATISTIC_DEBUG_SETTING,
  TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING,
  TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION,
  cloneTravelEventRunnerSession,
  acceptTravelReactionPrompt,
  deleteTravelEventRunnerSessionFromLibrary,
  dismissTravelReactionPrompt,
  duplicateTravelEventRunnerSession,
  getTravelEventRunnerSessionLibrary,
  loadTravelEventRunnerSessionFromLibrary,
  normalizeTravelEventRunnerSession,
  prepareTravelEventRunnerSessionLibraryState,
  preparePublishedTravelEventRunnerLaunchState,
  getArcflightTravelEventRunnerShipOptions,
  getTravelEventRunnerStationActorOptions,
  normalizeTravelEventRunnerStationAssignments,
  prepareTravelEventRunnerStationAssignmentState,
  updateTravelEventRunnerStationAssignment,
  clearTravelEventRunnerStationAssignment,
  resetTravelEventRunnerStationAssignmentToShip,
  getTravelEventRunnerShipStationAssignments,
  startTravelEventRunnerFromPublishedEvent,
  prepareTravelEventRunnerState,
  prepareTravelSceneOverlayState,
  prepareTravelPlayerStationCardState,
  prepareTravelPlayerReactionPromptState,
  commitTravelEventRunnerStationOrder,
  retreatTravelEventRunnerRound,
  saveTravelEventRunnerSessionToLibrary,
  setTravelEventRunnerStationResult,
  setTravelEventRunnerStationSkillApproach,
  summarizeTravelEventRunnerSession
} from "./helpers/travel-event-runner.js";
import {
  TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION,
  prepareTravelV2PendingConsequenceQueue,
  selectTravelV2PendingConsequenceCatalogCard,
  updateTravelV2PendingConsequenceQueueItem
} from "./helpers/travel-v2-pending-consequence-queue.js";
import {
  TRAVEL_V2_CONSEQUENCE_CATALOG_VERSION,
  getTravelV2ConsequenceById,
  getTravelV2ConsequenceCatalog,
  getTravelV2ConsequencesByAffectedTrack,
  getTravelV2ConsequencesBySeverity,
  getTravelV2ConsequencesBySource
} from "../data/travel-events/travel-v2-consequence-catalog.js";
import {
  EXAMPLE_SHIP_BUILD_KEYS,
  applyCleanExampleShipBuild,
  applyExampleShipBuild,
  getExampleShipBuild,
  getExampleShipBuildKeys
} from "./helpers/example-ship-builds.js";
import {
  ARCFLIGHT_ITEM_FOLDER_ROOT,
  arcflightComponentFolderNames,
  arcflightItemFolderNames,
  cleanupDuplicateArcflightItems,
  createArcflightItemFolders,
  findDuplicateArcflightItems,
  organizeArcflightItems
} from "./helpers/item-organization.js";
import { findMissingCoreArcflightItems, syncCoreArcflightItems } from "./helpers/core-item-sync.js";
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
} from "./helpers/travel-events.js";
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
} from "./helpers/travel-event-template.js";
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
} from "./helpers/travel-event-builder.js";
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
} from "./helpers/ship-travel-event-state.js";
import { getInstallValidationWarnings, previewComponentInstall, previewInstallValidation, shouldBlockInstall } from "./helpers/install-validation-preview.js";
import { clearStationActionHistory, executeStationAction, getStationActionRollOptions, getStationActionState, previewStationAction, previewStationActionRoll, resolveAssignedActorStatistic, rollStationAction } from "./helpers/station-action-execution.js";
import { getPf2eRollTotal, getPf2eStatisticCandidateKeys, isRollablePf2eStatistic, normalizePf2eStatisticKey, resolvePf2eActorStatistic, rollPf2eStatistic } from "./helpers/pf2e-statistics.js";
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
} from "./helpers/install-state.js";
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
} from "./helpers/travel-event-builder-io.js";

const TRAVEL_REACTION_DEBUG_SETTING = "debugTravelReactions";

function debugTravelReaction(message, data = {}) {
  try {
    if (globalThis.game?.settings?.get?.(ARCFLIGHT.MODULE_ID, TRAVEL_REACTION_DEBUG_SETTING) !== true) return;
    console.debug(`Arcflight | Travel Reaction | ${message}`, data);
  } catch (_error) {
    // Debug logging must never break travel flows.
  }
}

function isArcflightVehicle(actor) {
  return actor?.type === "vehicle"
    && actor.getFlag?.(ARCFLIGHT.MODULE_ID, "enabled") === true
    && actor.getFlag?.(ARCFLIGHT.MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

async function setArcflightVehicleEnabled(actor, enabled = true) {
  if (actor?.type !== "vehicle" || typeof actor.setFlag !== "function") {
    throw new Error("Arcflight ships must be PF2E vehicle actors.");
  }

  if (!enabled) {
    return actor.setFlag(ARCFLIGHT.MODULE_ID, "enabled", false);
  }

  return actor.update({
    [`flags.${ARCFLIGHT.MODULE_ID}.enabled`]: true,
    [`flags.${ARCFLIGHT.MODULE_ID}.actorType`]: ARCFLIGHT_SHIP_ACTOR_TYPE,
    [`flags.${ARCFLIGHT.MODULE_ID}.system`]: getArcflightShipData(actor)
  });
}


const ARCFLIGHT_API_MARKER = "__arcflightApi";

function isArcflightApi(value) {
  return Boolean(value && value[ARCFLIGHT_API_MARKER] === true);
}

function buildArcflightApi() {
  if (isArcflightApi(globalThis.CONFIG?.arcflight)) return globalThis.CONFIG.arcflight;
  return Object.freeze({
    constants: ARCFLIGHT,
    createItem: createArcflightItem,
    createCoreHull,
    createHull,
    createCoreArkengine,
    createCoreArkengineMod,
    createCoreCrewAsset,
    createArkengine,
    createArkengineMod,
    createCrewAsset,
    createCoreRoom,
    createRoom,
    createCoreWeapon,
    createWeapon,
    createCoreShipUpgrade,
    createShipUpgrade,
    getCoreHull,
    getCoreArkengine,
    getCoreArkengineMod,
    getCoreCrewAsset,
    getCoreRoom,
    getCoreShipUpgrade,
    getCoreWeapon,
    getCoreHullPlatformKeys,
    getCoreArkengineKeys,
    getHullPatternKeys,
    getHullPattern,
    getArkenginePatternKeys,
    getArkenginePattern,
    getCoreArkengineModKeys,
    getCoreCrewAssetKeys,
    getCoreRoomKeys,
    getCoreShipUpgradeKeys,
    getCoreWeaponKeys,
    getArkengineVariantKeys,
    getArkengineVariant,
    getArkengineVariants,
    getStationKeys,
    getStation,
    getStations,
    getCoreStationAction,
    getCoreStationActionKeys,
    getCoreStationActions,
    getCoreStationActionsForStation,
    getStationActionOutcome,
    previewStationActionOutcome,
    getStationActionState,
    previewStationAction,
    getStationActionRollOptions,
    previewStationActionRoll,
    normalizePf2eStatisticKey,
    getPf2eStatisticCandidateKeys,
    resolvePf2eActorStatistic,
    isRollablePf2eStatistic,
    getPf2eRollTotal,
    rollPf2eStatistic,
    resolveAssignedActorStatistic,
    rollStationAction,
    executeStationAction,
    clearStationActionHistory,
    CORE_HULL_PLATFORM_KEYS,
    CORE_ARKENGINE_KEYS,
    HULL_PATTERN_KEYS,
    ARKENGINE_PATTERN_KEYS,
    CORE_ARKENGINE_MOD_KEYS,
    ARCFLIGHT_ITEM_FOLDER_ROOT,
    arcflightComponentFolderNames,
    arcflightItemFolderNames,
    createArcflightItemFolders,
    findMissingCoreArcflightItems,
    syncCoreArcflightItems,
    findDuplicateArcflightItems,
    cleanupDuplicateArcflightItems,
    organizeArcflightItems,
    CORE_CREW_ASSET_KEYS,
    CORE_ROOM_KEYS,
    CORE_WEAPON_KEYS,
    CORE_SHIP_UPGRADE_KEYS,
    ARKENGINE_VARIANT_KEYS,
    STATION_KEYS,
    CORE_STATION_ACTION_KEYS,
    TRAVEL_V2_CONSEQUENCE_CATALOG_VERSION,
    TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION,
    getTravelV2ConsequenceCatalog,
    getTravelV2ConsequenceById,
    getTravelV2ConsequencesBySource,
    getTravelV2ConsequencesByAffectedTrack,
    getTravelV2ConsequencesBySeverity,
    prepareTravelV2PendingConsequenceQueue,
    selectTravelV2PendingConsequenceCatalogCard,
    updateTravelV2PendingConsequenceQueueItem,
    CORE_TRAVEL_EVENTS,
    CORE_TRAVEL_EVENT_KEYS,
    getCoreTravelEvent,
    getCoreTravelEventKeys,
    getCoreTravelEvents,
    getCoreTravelEventsByCategory,
    EXAMPLE_SHIP_BUILD_KEYS,
    exampleShipBuildKeys: EXAMPLE_SHIP_BUILD_KEYS,
    coreHulls: CORE_HULLS,
    coreArkengines: CORE_ARKENGINES,
    hullPatterns: HULL_PATTERNS,
    arkenginePatterns: ARKENGINE_PATTERNS,
    coreArkengineMods: CORE_ARKENGINE_MODS,
    coreCrewAssets: CORE_CREW_ASSETS,
    coreRooms: CORE_ROOMS,
    coreShipUpgrades: CORE_SHIP_UPGRADES,
    coreWeapons: CORE_WEAPONS,
    arkengineVariants: ARKENGINE_VARIANTS,
    coreStations: CORE_STATIONS,
    coreStationActions: CORE_STATION_ACTIONS,
    coreHullPlatformKeys: CORE_HULL_PLATFORM_KEYS,
    coreArkengineKeys: CORE_ARKENGINE_KEYS,
    hullPatternKeys: HULL_PATTERN_KEYS,
    arkenginePatternKeys: ARKENGINE_PATTERN_KEYS,
    coreArkengineModKeys: CORE_ARKENGINE_MOD_KEYS,
    coreCrewAssetKeys: CORE_CREW_ASSET_KEYS,
    coreRoomKeys: CORE_ROOM_KEYS,
    coreShipUpgradeKeys: CORE_SHIP_UPGRADE_KEYS,
    coreWeaponKeys: CORE_WEAPON_KEYS,
    arkengineVariantKeys: ARKENGINE_VARIANT_KEYS,
    stationKeys: STATION_KEYS,
    coreStationActionKeys: CORE_STATION_ACTION_KEYS,
    coreTravelEvents: CORE_TRAVEL_EVENTS,
    coreTravelEventKeys: CORE_TRAVEL_EVENT_KEYS,
    getItemDocumentType: getArcflightItemDocumentType,
    getDefaultComponentData: getDefaultArcflightComponentData,
    getDefaultShipData: getDefaultArcflightShipData,
    isArcflightItem,
    getComponentType,
    getComponentData,
    getComponentRefitPressure,
    getComponentTierMetadata,
    previewInstallValidation,
    previewComponentInstall,
    getInstallValidationWarnings,
    shouldBlockInstall,
    createInstallId,
    deactivateInstallRecord,
    deactivateInstallRecordsByComponent,
    getActiveInstallRecords,
    getInactiveInstallRecords,
    getInstalledComponents,
    getInstallState,
    recordInstallState,
    removeInstallState,
    findInstallRecord,
    prepareInstallStateSummary,
    findShipsMissingInstallState,
    backfillInstallStateForShip,
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
    isArcflightVehicle,
    setArcflightVehicleEnabled,
    setHullPattern,
    setArkenginePattern,
    addCrewAsset,
    removeCrewAsset,
    removeInstalledArkengineMod,
    removeInstalledCrewAsset,
    removeInstalledRoom,
    removeInstalledShipUpgrade,
    removeInstalledWeapon,
    installHull,
    installHullOnShip,
    installArkengine,
    installArkengineMod,
    installArkengineModOnShip,
    installArkengineOnShip,
    installRoom,
    installRoomOnShip,
    installShipUpgrade,
    installShipUpgradeOnShip,
    installWeapon,
    installWeaponOnShip,
    recalculateShipStats,
    calculateDerivedShipStats,
    calculateRefitPressure,
    updateShipTierState,
    getShipTierState,
    getShipRefitPressure,
    getShipRefitStatus,
    getShipActionEconomy,
    getShipTravelResources,
    previewShipTravelResourceChange,
    updateShipTravelResources,
    getTravelStationKeys,
    isTravelStationKey,
    getTravelFiveStationKeys,
    normalizeTravelDegree,
    getTravelDegreeContribution,
    getTravelRoundOutcome,
    getTravelEventOutcome,
    validateTravelEventDefinition,
    TRAVEL_EVENT_TEMPLATE_VERSION,
    createBlankTravelEventTemplate,
    createBlankTravelRoundTemplate,
    createBlankStationPromptTemplate,
    createBlankRollFeedbackTemplate,
    createBlankOutcomeBranchesTemplate,
    createBlankFinalOutcomesTemplate,
    getTravelEventAuthoringGuidelines,
    validateTravelEventAuthoringTemplate,
    TRAVEL_EVENT_BUILDER_VERSION,
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
    prepareTravelEventSummary,
    prepareTravelRoundSummary,
    getTravelEventStationPrompt,
    getShipTravelEventState,
    getActiveShipTravelEvent,
    startShipTravelEvent,
    recordShipTravelStationResult,
    getCurrentShipTravelRound,
    advanceShipTravelEventRound,
    previewTravelStagedEffectApplication,
    applyTravelStagedEffect,
    applyTravelStagedEffects,
    completeShipTravelEvent,
    clearShipTravelEvent,
    ArcflightTravelEventBuilder,
    openTravelEventBuilder,
    prepareTravelEventBuilderShellState,
    ArcflightTravelEventRunner,
    openTravelEventRunner,
    ArcflightTravelSceneOverlay,
    openTravelSceneOverlay,
    ArcflightTravelPlayerMissionBoard,
    openTravelPlayerMissionBoard,
    ArcflightTravelPlayerReactionPrompt,
    openTravelPlayerReactionPrompt,
    ArcflightTravelPlayerStationCard,
    openTravelPlayerStationCard,
    sendTravelPlayerMissionBoardToPlayers,
    sendTravelPlayerReactionPromptToPlayers,
    sendTravelPlayerStationCardSocketDiagnostic,
    broadcastTravelPlayerStationCardToAllPlayers,
    sendTravelPlayerStationCardToPlayers,
    sendAllTravelPlayerStationCardsToPlayers,
    resolveActivePlayerOwnersForStation,
    createTravelEventRunnerSession,
    normalizeTravelEventRunnerSession,
    prepareTravelEventRunnerState,
    prepareTravelSceneOverlayState,
    prepareTravelPlayerStationCardState,
    prepareTravelPlayerReactionPromptState,
    setTravelEventRunnerStationResult,
  setTravelEventRunnerStationSkillApproach,
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
    prepareTravelEventEffectApplicationState,
    applyTravelEventRunnerSelectedEffects,
    applyTravelEventRunnerResourceEffect,
    getTravelEventAppliedEffectRecords,
    isTravelEventEffectApplied,
    markTravelEventEffectApplied,
    buildTravelEventAppliedEffectRecord,
    undoTravelEventAppliedEffect,
    prepareTravelEventAppliedEffectHistoryState,
    isTravelEventAppliedEffectUndoable,
    markTravelEventAppliedEffectUndone,
    buildTravelEventEffectUndoRecord,
    TRAVEL_APPROACH_STATISTIC_DEBUG_SETTING,
    TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING,
    TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION,
    getTravelEventRunnerSessionLibrary,
    saveTravelEventRunnerSessionToLibrary,
    loadTravelEventRunnerSessionFromLibrary,
    deleteTravelEventRunnerSessionFromLibrary,
    duplicateTravelEventRunnerSession,
    prepareTravelEventRunnerSessionLibraryState,
    preparePublishedTravelEventRunnerLaunchState,
    getArcflightTravelEventRunnerShipOptions,
    getTravelEventRunnerStationActorOptions,
    normalizeTravelEventRunnerStationAssignments,
    prepareTravelEventRunnerStationAssignmentState,
    updateTravelEventRunnerStationAssignment,
    clearTravelEventRunnerStationAssignment,
  resetTravelEventRunnerStationAssignmentToShip,
  getTravelEventRunnerShipStationAssignments,
    startTravelEventRunnerFromPublishedEvent,
    cloneTravelEventRunnerSession,
    prepareTravelEventLibraryOptions,
    prepareSelectedTravelEventLibraryDetails,
    prepareTravelEventNarrativeLog,
    resetShipActionEconomy,
    spendShipActionPoints,
    canSpendShipActionPoints,
    assignStation,
    clearStationAssignment,
    clearStationAssignments,
    clearShipBuild,
    clearInstalledRooms,
    clearInstalledShipUpgrades,
    clearInstalledArkengineMods,
    clearCrewRoster,
    clearComponentPatterns,
    assignShipStation: assignStation,
    clearShipStation: clearStationAssignment,
    getExampleShipBuildKeys,
    getExampleShipBuild,
    applyExampleShipBuild,
    applyCleanExampleShipBuild,
    runFrameworkSmokeTest,
    getShipData: getArcflightShipData,
    componentDefaults: arcflightComponentDefaults,
    shipDefaults: arcflightShipDefaults,
    itemFolderRoot: ARCFLIGHT_ITEM_FOLDER_ROOT,
    itemFolderNames: arcflightItemFolderNames,
    componentFolderNames: arcflightComponentFolderNames,
    createItemFolders: createArcflightItemFolders,
    organizeArcflightItems,
    findMissingCoreArcflightItems,
    syncCoreArcflightItems,
    findDuplicateItems: findDuplicateArcflightItems,
    cleanupDuplicateItems: cleanupDuplicateArcflightItems,
    findDuplicateArcflightItems,
    cleanupDuplicateArcflightItems,
    devTools: createArcflightDevTools(),
    dev: { runFoundryChecks, runPlayerSafetyCheck },
    get ArcflightItemSheet() { return globalThis.CONFIG?.arcflightSheets?.ArcflightItemSheet ?? null; },
    get ArcflightShipSheet() { return globalThis.CONFIG?.arcflightSheets?.ArcflightShipSheet ?? null; },
    [ARCFLIGHT_API_MARKER]: true
  });
}

function registerArcflightApi() {
  const config = globalThis.CONFIG;
  if (!config) return null;
  const foundryGame = globalThis.game;
  const existingApi = isArcflightApi(config.arcflight)
    ? config.arcflight
    : (isArcflightApi(foundryGame?.arcflight) ? foundryGame.arcflight : null);
  const api = existingApi ?? buildArcflightApi();
  config.arcflight = api;

  if (foundryGame) {
    if (foundryGame.arcflight == null || foundryGame.arcflight === api || isArcflightApi(foundryGame.arcflight)) foundryGame.arcflight = api;
    else console.warn("Arcflight | game.arcflight already exists and is not Arcflight's API; leaving it unchanged.");
  }

  return api;
}

async function handleTravelPlayerStationApproachSubmit(payload = {}) {
  const activeOverlay = getActiveTravelSceneOverlay();
  const activeRunner = getActiveTravelEventRunner();
  const session = activeOverlay?.session ?? activeRunner?.session ?? null;
  const roundIndex = Number(payload.roundIndex);
  const stationKey = typeof payload.stationKey === "string" ? payload.stationKey : "";
  const legacySkill = typeof payload.skill === "string" ? payload.skill : "";
  const optionKey = typeof payload.optionKey === "string" && payload.optionKey
    ? payload.optionKey
    : (legacySkill ? `eventApproach:${legacySkill}` : "");
  console.debug("Arcflight | Player Station Order commit received by GM.", { payload });
  if (!session || !Number.isInteger(roundIndex) || !stationKey || !optionKey) {
    console.warn("Arcflight | Player station approach submission could not be applied.", { payload, hasSession: Boolean(session) });
    ui.notifications?.warn?.("Player approach submission could not be applied to the active travel session.");
    return false;
  }

  const updated = commitTravelEventRunnerStationOrder(session, roundIndex, stationKey, optionKey, {
    source: "player",
    selectedFocusAbility: typeof payload.selectedFocusAbility === "string" ? payload.selectedFocusAbility : ""
  });
  if (!updated?.ok || !updated.session) {
    console.warn("Arcflight | Player station approach update failed.", { payload, updated });
    ui.notifications?.warn?.(updated?.errors?.[0] ?? "Player approach submission failed.");
    return false;
  }

  if (activeOverlay) activeOverlay.session = updated.session;
  await updateActiveTravelSceneOverlayContext({ session: updated.session }, { render: true });
  await updateActiveTravelEventRunnerSession(updated.session, { statusMessage: "Player committed a Station Order." });
  const userName = globalThis.game?.users?.get?.(payload.userId)?.name ?? "Player";
  ui.notifications?.info?.(`${userName} committed an option for ${stationKey}.`);
  const stationUpdateResult = sendTravelPlayerMissionBoardStationUpdateToPlayers(updated.session, stationKey, { actor: activeOverlay?.actor });
  sendTravelPlayerStationCardToPlayers(updated.session, stationKey, { actor: activeOverlay?.actor });
  console.debug("Arcflight | Board station update broadcast result.", stationUpdateResult);
  return true;
}

async function handleTravelPlayerStationRoll(payload = {}) {
  const activeOverlay = getActiveTravelSceneOverlay();
  const activeRunner = getActiveTravelEventRunner();
  const session = activeOverlay?.session ?? activeRunner?.session ?? null;
  const roundIndex = Number(payload.roundIndex);
  const stationKey = typeof payload.stationKey === "string" ? payload.stationKey : "";
  console.debug("Arcflight | Player roll request received by GM.", { payload });
  debugTravelReaction("GM received player station roll request.", {
    hasSession: Boolean(session),
    sessionKey: session?.key ?? "",
    roundIndex,
    stationKey,
    userId: payload.userId ?? "",
    skill: payload.skill ?? "",
    payload
  });
  if (!session || !Number.isInteger(roundIndex) || !stationKey) return false;
  const permissionState = prepareTravelPlayerMissionBoardStateForPlayers(session, { actor: activeOverlay?.actor });
  const permissionStation = (permissionState.stations ?? []).find((candidate) => candidate.stationKey === stationKey);
  const permitted = Boolean(permissionStation?.permittedUserIds?.includes(payload.userId));
  console.debug("Arcflight | GM validation of roll permission.", { stationKey, userId: payload.userId, permitted, permittedUserIds: permissionStation?.permittedUserIds ?? [] });
  debugTravelReaction("GM validated player station roll permission.", {
    stationKey,
    userId: payload.userId,
    permitted,
    permittedUserIds: permissionStation?.permittedUserIds ?? []
  });
  if (!permitted) {
    ui.notifications?.warn?.("Player is not authorized to roll that travel station.");
    return false;
  }
  let workingSession = session;
  const requestedOptionKey = typeof payload.optionKey === "string" ? payload.optionKey : "";
  if (requestedOptionKey) {
    const committed = commitTravelEventRunnerStationOrder(workingSession, roundIndex, stationKey, requestedOptionKey, {
      source: "player",
      selectedFocusAbility: typeof payload.selectedFocusAbility === "string" ? payload.selectedFocusAbility : ""
    });
    if (!committed?.ok || !committed.session) {
      ui.notifications?.warn?.(committed?.errors?.[0] ?? "Selected travel action is not available.");
      sendTravelPlayerMissionBoardStationUpdateToPlayers(workingSession, stationKey, { actor: activeOverlay?.actor });
      return false;
    }
    workingSession = committed.session;
  }
  const requestedSkill = typeof payload.skill === "string" ? payload.skill : "";
  if (requestedSkill && !requestedOptionKey) {
    const approachUpdate = setTravelEventRunnerStationSkillApproach(workingSession, roundIndex, stationKey, requestedSkill);
    if (!approachUpdate?.ok || !approachUpdate.session) {
      ui.notifications?.warn?.(approachUpdate?.errors?.[0] ?? "Selected travel approach is not available.");
      sendTravelPlayerMissionBoardStationUpdateToPlayers(workingSession, stationKey, { actor: activeOverlay?.actor });
      return false;
    }
    workingSession = approachUpdate.session;
  }
  const boardState = prepareTravelSceneOverlayState(workingSession, { actor: activeOverlay?.actor });
  const station = (boardState.stations ?? []).find((candidate) => candidate.stationKey === stationKey);
  if (!station?.hasSelectedApproach || station.hasResult) {
    sendTravelPlayerMissionBoardStationUpdateToPlayers(workingSession, stationKey, { actor: activeOverlay?.actor });
    return false;
  }
  let d20 = 0;
  if (globalThis.Roll) {
    const roll = await new Roll("1d20").evaluate();
    d20 = Number(roll.total);
    if (typeof roll.toMessage === "function") await roll.toMessage({ flavor: `Arcflight Player Travel Station Check: ${stationKey}` });
  } else {
    d20 = Math.floor(Math.random() * 20) + 1;
  }
  const modifier = Number(station.selectedApproachModifier);
  const dc = Number(station.dc);
  if (!Number.isFinite(modifier) || !Number.isFinite(dc)) {
    ui.notifications?.warn?.(station.rollUnavailableReason || "Selected station approach is missing a modifier or DC.");
    if (activeOverlay) activeOverlay.session = workingSession;
    await updateActiveTravelSceneOverlayContext({ session: workingSession }, { render: true });
    await updateActiveTravelEventRunnerSession(workingSession, { statusMessage: station.rollUnavailableReason || "Player roll could not resolve modifier or DC." });
    sendTravelPlayerMissionBoardStationUpdateToPlayers(workingSession, stationKey, { actor: activeOverlay?.actor });
    return false;
  }
  const total = d20 + modifier;
  const degreeOrder = ["criticalFailure", "failure", "success", "criticalSuccess"];
  let degreeIndex = total >= dc + 10 ? 3 : (total >= dc ? 2 : (total <= dc - 10 ? 0 : 1));
  if (d20 === 20) degreeIndex = Math.min(3, degreeIndex + 1);
  if (d20 === 1) degreeIndex = Math.max(0, degreeIndex - 1);
  const result = degreeOrder[degreeIndex];
  debugTravelReaction("GM resolved player station roll result.", {
    sessionKey: workingSession?.key ?? "",
    roundIndex,
    stationKey,
    d20,
    modifier,
    total,
    dc,
    result
  });
  const beforeReactionPrompts = workingSession?.reactionPrompts?.records?.map((record) => ({ ...record })) ?? [];
  debugTravelReaction("Reaction prompt records before station result sync.", {
    sessionKey: workingSession?.key ?? "",
    roundIndex,
    stationKey,
    records: beforeReactionPrompts
  });
  const updated = setTravelEventRunnerStationResult(workingSession, roundIndex, stationKey, result);
  debugTravelReaction("Reaction prompt records after station result sync.", {
    ok: updated?.ok === true,
    errors: updated?.errors ?? [],
    sessionKey: updated?.session?.key ?? "",
    roundIndex,
    stationKey,
    records: updated?.session?.reactionPrompts?.records ?? []
  });
  if (!updated?.ok || !updated.session) return false;
  const resultLabel = result === "criticalSuccess" ? "Critical Success" : (result === "criticalFailure" ? "Critical Failure" : (result === "success" ? "Success" : "Failure"));
  const skillLabel = station.selectedApproachSkillLabel || station.approachLabel || "Approach";
  const modifierLabel = `${modifier >= 0 ? "" : "-"}${Math.abs(modifier)}`;
  const detail = `d20 ${d20} + ${skillLabel} ${modifierLabel} = ${total} vs DC ${dc}: ${resultLabel}`;
  updated.session.playerMissionBoardRollDetails = { ...(workingSession.playerMissionBoardRollDetails ?? {}), [stationKey]: detail };
  if (activeOverlay) activeOverlay.session = updated.session;
  await updateActiveTravelSceneOverlayContext({ session: updated.session }, { render: true });
  await updateActiveTravelEventRunnerSession(updated.session, { statusMessage: "Player rolled a travel station." });
  const stationUpdateResult = sendTravelPlayerMissionBoardStationUpdateToPlayers(updated.session, stationKey, { actor: activeOverlay?.actor });
  sendTravelPlayerStationCardToPlayers(updated.session, stationKey, { actor: activeOverlay?.actor });
  console.debug("Arcflight | Board station update broadcast result.", stationUpdateResult);
  const pendingReaction = updated.session.reactionPrompts?.records?.find((record) =>
    record.roundIndex === roundIndex
    && record.stationKey === stationKey
    && record.status === "pending"
  );
  debugTravelReaction("GM checked for pending player reaction prompt.", {
    sessionKey: updated.session?.key ?? "",
    roundIndex,
    stationKey,
    pendingReaction: pendingReaction ? { ...pendingReaction } : null
  });
  if (pendingReaction) {
    debugTravelReaction("GM sending pending player reaction prompt.", {
      sessionKey: updated.session?.key ?? "",
      reactionPromptId: pendingReaction.reactionPromptId,
      stationKey: pendingReaction.stationKey,
      abilityKey: pendingReaction.abilityKey
    });
    const promptResult = sendTravelPlayerReactionPromptToPlayers(updated.session, pendingReaction.reactionPromptId, { actor: activeOverlay?.actor });
    console.debug("Arcflight | Player reaction prompt delivery result.", promptResult);
    debugTravelReaction("Player reaction prompt delivery result.", promptResult);
  }
  ui.notifications?.info?.(`Player rolled ${stationKey}: ${result}.`);
  return true;
}

async function handleTravelPlayerReactionResponse(payload = {}) {
  const activeOverlay = getActiveTravelSceneOverlay();
  const activeRunner = getActiveTravelEventRunner();
  const session = activeOverlay?.session ?? activeRunner?.session ?? null;
  const reactionPromptId = typeof payload.reactionPromptId === "string" ? payload.reactionPromptId : "";
  const response = typeof payload.response === "string" ? payload.response : "";
  const record = session?.reactionPrompts?.records?.find((entry) => entry.reactionPromptId === reactionPromptId) ?? null;
  debugTravelReaction("GM received player reaction response.", {
    hasSession: Boolean(session),
    sessionKey: session?.key ?? "",
    reactionPromptId,
    response,
    userId: payload.userId ?? "",
    hasRecord: Boolean(record),
    record: record ? { ...record } : null,
    payload
  });
  if (!session || !record) return false;
  if (payload.sessionKey && payload.sessionKey !== session.key) return false;
  if (!["accept", "dismiss", "reopen"].includes(response)) return false;
  const permissionState = prepareTravelPlayerMissionBoardStateForPlayers(session, { actor: activeOverlay?.actor });
  const permissionStation = permissionState.stations?.find((station) => station.stationKey === record.stationKey);
  debugTravelReaction("GM validated player reaction response permission.", {
    stationKey: record.stationKey,
    userId: payload.userId,
    permittedUserIds: permissionStation?.permittedUserIds ?? [],
    permitted: Boolean(permissionStation?.permittedUserIds?.includes(payload.userId))
  });
  if (!permissionStation?.permittedUserIds?.includes(payload.userId)) {
    ui.notifications?.warn?.("Player is not authorized to resolve that reaction.");
    return false;
  }
  if (response === "reopen") {
    sendTravelPlayerReactionPromptToPlayers(session, reactionPromptId, { actor: activeOverlay?.actor });
    return true;
  }
  const updated = response === "accept"
    ? acceptTravelReactionPrompt(session, reactionPromptId, { userId: payload.userId, userName: globalThis.game?.users?.get?.(payload.userId)?.name ?? "" })
    : dismissTravelReactionPrompt(session, reactionPromptId, { userId: payload.userId, userName: globalThis.game?.users?.get?.(payload.userId)?.name ?? "" });
  debugTravelReaction("GM applied player reaction response.", {
    ok: updated?.ok === true,
    errors: updated?.errors ?? [],
    response,
    reactionPromptId,
    records: updated?.session?.reactionPrompts?.records ?? []
  });
  if (!updated?.ok || !updated.session) {
    ui.notifications?.warn?.(updated?.errors?.[0] ?? "Reaction could not be resolved.");
    return false;
  }
  if (activeOverlay) activeOverlay.session = updated.session;
  await updateActiveTravelSceneOverlayContext({ session: updated.session }, { render: true });
  await updateActiveTravelEventRunnerSession(updated.session, {
    statusMessage: response === "accept"
      ? `${record.stationName || "Navigator"} spent Focus on ${record.abilityLabel}; reroll requested.`
      : `${record.abilityLabel} was ignored.`
  });
  sendTravelPlayerMissionBoardStationUpdateToPlayers(updated.session, record.stationKey, { actor: activeOverlay?.actor });
  ui.notifications?.info?.(response === "accept"
    ? `${record.stationName || "Navigator"} spent Focus on ${record.abilityLabel} and needs a reroll.`
    : `${record.abilityLabel} was ignored.`);
  return true;
}

Hooks.once("init", () => {
  console.log("Arcflight | Initializing module");

  game.settings.register(ARCFLIGHT.MODULE_ID, TRAVEL_V2_DEV_TOOLS_SETTING, {
    name: "Travel v2 Dev Tools",
    hint: "Show GM-only Travel v2 test controls and debug report actions in the Travel Event Runner. Disable during normal play.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(ARCFLIGHT.MODULE_ID, TRAVEL_REACTION_DEBUG_SETTING, {
    name: "Debug Travel Reactions",
    hint: "Log the live Travel Reaction prompt pipeline to the browser console. Disable during normal play.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(ARCFLIGHT.MODULE_ID, TRAVEL_APPROACH_STATISTIC_DEBUG_SETTING, {
    name: "Debug Travel Approach Statistics",
    hint: "Log Travel approach statistic resolution details to the browser console. Disable during normal play and smoke tests.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(ARCFLIGHT.MODULE_ID, TRAVEL_EVENT_BUILDER_LIBRARY_SETTING, {
    name: "Travel Event Builder Library",
    hint: "World-local saved drafts for the Arcflight Travel Event Builder authoring shell.",
    scope: "world",
    config: false,
    type: Object,
    default: { version: TRAVEL_EVENT_BUILDER_LIBRARY_VERSION, drafts: {} }
  });

  game.settings.register(ARCFLIGHT.MODULE_ID, PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING, {
    name: "Published Travel Event Library",
    hint: "World-local finalized travel event records published from the Arcflight Travel Event Builder.",
    scope: "world",
    config: false,
    type: Object,
    default: { version: PUBLISHED_TRAVEL_EVENT_LIBRARY_VERSION, events: {} }
  });

  game.settings.register(ARCFLIGHT.MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING, {
    name: "Travel Event Runner Session Library",
    hint: "World-local manual save/resume snapshots for the Travel Event Runner. Separate from drafts, published events, actors, resources, chat, and combat.",
    scope: "world",
    config: false,
    type: Object,
    default: { version: TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION, sessions: {} }
  });

  registerArcflightApi();
  registerArcflightFoundryCheckRunner();

  registerArcflightSheets()
    .then((registeredSheets) => {
      CONFIG.arcflightSheets = Object.freeze({ ...(registeredSheets ?? {}) });
    })
    .catch((error) => {
      console.warn("Arcflight | Sheet registration failed; continuing startup.", error);
    });
});

Hooks.once("ready", () => {
  registerArcflightApi();
  registerArcflightFoundryCheckRunner();
  registerTravelPlayerStationApproachSubmitHandler(handleTravelPlayerStationApproachSubmit);
  registerTravelPlayerStationRollHandler(handleTravelPlayerStationRoll);
  registerTravelPlayerReactionResponseHandler(handleTravelPlayerReactionResponse);
  if (globalThis.game?.socket && typeof game.socket.on === "function") {
    game.socket.on("module.arcflight", handleTravelPlayerStationCardSocketPayload);
    console.debug("Arcflight | Registered player station card socket listener.");
  } else {
    console.warn("Arcflight | Foundry socket unavailable; player station card handoff disabled.");
  }
});

if (globalThis.CONFIG) registerArcflightApi();

export {
  ARCFLIGHT,
  buildArcflightApi,
  registerArcflightApi,
  createArcflightItem,
  createCoreHull,
  createHull,
  createCoreArkengine,
  createCoreArkengineMod,
  createCoreCrewAsset,
  createArkengine,
  createArkengineMod,
  createCrewAsset,
  createCoreRoom,
  createRoom,
  createCoreWeapon,
  createWeapon,
  createCoreShipUpgrade,
  createShipUpgrade,
  getCoreHull,
  getCoreArkengine,
  getCoreArkengineMod,
  getCoreCrewAsset,
  getCoreRoom,
  getCoreShipUpgrade,
  getCoreWeapon,
  getCoreHullPlatformKeys,
  getCoreArkengineKeys,
  getHullPatternKeys,
  getHullPattern,
  getArkenginePatternKeys,
  getArkenginePattern,
  getCoreArkengineModKeys,
  getCoreCrewAssetKeys,
  getCoreRoomKeys,
  getCoreShipUpgradeKeys,
  getCoreWeaponKeys,
  getArkengineVariantKeys,
  getArkengineVariant,
  getArkengineVariants,
  getStationKeys,
  getStation,
  getStations,
  getCoreStationAction,
  getCoreStationActionKeys,
  getCoreStationActions,
  getCoreStationActionsForStation,
  getStationActionOutcome,
  previewStationActionOutcome,
  getStationActionState,
  previewStationAction,
  getStationActionRollOptions,
  previewStationActionRoll,
  normalizePf2eStatisticKey,
  getPf2eStatisticCandidateKeys,
  resolvePf2eActorStatistic,
  isRollablePf2eStatistic,
  getPf2eRollTotal,
  rollPf2eStatistic,
  resolveAssignedActorStatistic,
  rollStationAction,
  executeStationAction,
  clearStationActionHistory,
  CORE_HULLS,
  CORE_ARKENGINES,
  HULL_PATTERNS,
  ARKENGINE_PATTERNS,
  CORE_ARKENGINE_MODS,
  CORE_CREW_ASSETS,
  CORE_ROOMS,
  CORE_SHIP_UPGRADES,
  CORE_WEAPONS,
  ARKENGINE_VARIANTS,
  CORE_HULL_PLATFORM_KEYS,
  CORE_ARKENGINE_KEYS,
  HULL_PATTERN_KEYS,
  ARKENGINE_PATTERN_KEYS,
  CORE_ARKENGINE_MOD_KEYS,
  ARCFLIGHT_ITEM_FOLDER_ROOT,
  arcflightComponentFolderNames,
  arcflightItemFolderNames,
  createArcflightItemFolders,
  findMissingCoreArcflightItems,
  syncCoreArcflightItems,
  findDuplicateArcflightItems,
  cleanupDuplicateArcflightItems,
  organizeArcflightItems,
  CORE_CREW_ASSET_KEYS,
  CORE_ROOM_KEYS,
  CORE_SHIP_UPGRADE_KEYS,
  CORE_WEAPON_KEYS,
  ARKENGINE_VARIANT_KEYS,
  CORE_STATIONS,
  STATION_KEYS,
  CORE_STATION_ACTIONS,
  CORE_STATION_ACTION_KEYS,
  CORE_TRAVEL_EVENTS,
  CORE_TRAVEL_EVENT_KEYS,
  getCoreTravelEvent,
  getCoreTravelEventKeys,
  getCoreTravelEvents,
  getCoreTravelEventsByCategory,
  EXAMPLE_SHIP_BUILD_KEYS,
  getExampleShipBuildKeys,
  getExampleShipBuild,
  applyExampleShipBuild,
  applyCleanExampleShipBuild,
  addCrewAsset,
  removeCrewAsset,
  removeInstalledArkengineMod,
  removeInstalledCrewAsset,
  removeInstalledRoom,
  removeInstalledShipUpgrade,
  removeInstalledWeapon,
  isArcflightVehicle,
  setArcflightVehicleEnabled,
  setHullPattern,
  setArkenginePattern,
  installArkengine,
  installArkengineMod,
  installArkengineModOnShip,
  installArkengineOnShip,
  installHull,
  installHullOnShip,
  installRoom,
  installRoomOnShip,
  installShipUpgrade,
  installShipUpgradeOnShip,
  installWeapon,
  installWeaponOnShip,
  recalculateShipStats,
  calculateDerivedShipStats,
  calculateRefitPressure,
  updateShipTierState,
  getShipTierState,
  getShipActionEconomy,
  getShipTravelResources,
  previewShipTravelResourceChange,
  updateShipTravelResources,
  getTravelStationKeys,
  isTravelStationKey,
  getTravelFiveStationKeys,
  normalizeTravelDegree,
  getTravelDegreeContribution,
  getTravelRoundOutcome,
  getTravelEventOutcome,
  validateTravelEventDefinition,
  TRAVEL_EVENT_TEMPLATE_VERSION,
  createBlankTravelEventTemplate,
  createBlankTravelRoundTemplate,
  createBlankStationPromptTemplate,
  createBlankRollFeedbackTemplate,
  createBlankOutcomeBranchesTemplate,
  createBlankFinalOutcomesTemplate,
  getTravelEventAuthoringGuidelines,
  validateTravelEventAuthoringTemplate,
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
  prepareTravelEventBuilderLibraryState,
  prepareTravelEventSummary,
  prepareTravelRoundSummary,
  getTravelEventStationPrompt,
  getShipTravelEventState,
  getActiveShipTravelEvent,
  startShipTravelEvent,
  recordShipTravelStationResult,
  getCurrentShipTravelRound,
  advanceShipTravelEventRound,
  previewTravelStagedEffectApplication,
  applyTravelStagedEffect,
  applyTravelStagedEffects,
  completeShipTravelEvent,
  clearShipTravelEvent,
  ArcflightTravelEventBuilder,
  openTravelEventBuilder,
  prepareTravelEventBuilderShellState,
  ArcflightTravelEventRunner,
  openTravelEventRunner,
  ArcflightTravelSceneOverlay,
  openTravelSceneOverlay,
  ArcflightTravelPlayerMissionBoard,
  openTravelPlayerMissionBoard,
  ArcflightTravelPlayerStationCard,
  openTravelPlayerStationCard,
  sendTravelPlayerMissionBoardToPlayers,
  sendTravelPlayerStationCardSocketDiagnostic,
  broadcastTravelPlayerStationCardToAllPlayers,
  sendTravelPlayerStationCardToPlayers,
  sendAllTravelPlayerStationCardsToPlayers,
  resolveActivePlayerOwnersForStation,
  createTravelEventRunnerSession,
  normalizeTravelEventRunnerSession,
  prepareTravelEventRunnerState,
  prepareTravelSceneOverlayState,
  prepareTravelPlayerStationCardState,
  setTravelEventRunnerStationResult,
  setTravelEventRunnerStationSkillApproach,
  advanceTravelEventRunnerRound,
  retreatTravelEventRunnerRound,
  completeTravelEventRunnerSession,
  summarizeTravelEventRunnerSession,
  exportTravelEventRunnerSessionToJson,
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
  prepareTravelEventEffectApplicationState,
  applyTravelEventRunnerSelectedEffects,
  applyTravelEventRunnerResourceEffect,
  getTravelEventAppliedEffectRecords,
  isTravelEventEffectApplied,
  markTravelEventEffectApplied,
  buildTravelEventAppliedEffectRecord,
  undoTravelEventAppliedEffect,
  prepareTravelEventAppliedEffectHistoryState,
  isTravelEventAppliedEffectUndoable,
  markTravelEventAppliedEffectUndone,
  buildTravelEventEffectUndoRecord,
  TRAVEL_APPROACH_STATISTIC_DEBUG_SETTING,
  TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING,
  TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_VERSION,
  getTravelEventRunnerSessionLibrary,
  saveTravelEventRunnerSessionToLibrary,
  loadTravelEventRunnerSessionFromLibrary,
  deleteTravelEventRunnerSessionFromLibrary,
  duplicateTravelEventRunnerSession,
  prepareTravelEventRunnerSessionLibraryState,
  preparePublishedTravelEventRunnerLaunchState,
  getArcflightTravelEventRunnerShipOptions,
  getTravelEventRunnerStationActorOptions,
  normalizeTravelEventRunnerStationAssignments,
  prepareTravelEventRunnerStationAssignmentState,
  updateTravelEventRunnerStationAssignment,
  clearTravelEventRunnerStationAssignment,
  resetTravelEventRunnerStationAssignmentToShip,
  getTravelEventRunnerShipStationAssignments,
  startTravelEventRunnerFromPublishedEvent,
  cloneTravelEventRunnerSession,
  prepareTravelEventLibraryOptions,
  prepareSelectedTravelEventLibraryDetails,
  prepareTravelEventNarrativeLog,
  resetShipActionEconomy,
  spendShipActionPoints,
  canSpendShipActionPoints,
  getShipRefitPressure,
  getShipRefitStatus,
  assignStation,
  clearStationAssignment,
  clearStationAssignments,
  clearShipBuild,
  clearInstalledRooms,
  clearInstalledShipUpgrades,
  clearInstalledArkengineMods,
  clearCrewRoster,
  clearComponentPatterns,
  runFrameworkSmokeTest,
  getArcflightItemDocumentType,
  isArcflightItem,
  getComponentType,
  getComponentData,
  getComponentRefitPressure,
  getComponentTierMetadata,
  previewInstallValidation,
  previewComponentInstall,
  getInstallValidationWarnings,
  shouldBlockInstall,
  backfillInstallStateForAllShips,
  backfillInstallStateForShip,
  createInstallId,
  deactivateInstallRecord,
  deactivateInstallRecordsByComponent,
  getActiveInstallRecords,
  getInactiveInstallRecords,
  getInstalledComponents,
  getInstallState,
  recordInstallState,
  removeInstallState,
  findInstallRecord,
  prepareInstallStateSummary,
  findShipsMissingInstallState,
  TRAVEL_EVENT_BUILDER_IO_VERSION,
  exportTravelEventDraftToJson,
  importTravelEventDraftFromJson,
  importTravelEventDraftFromData,
  exportFinalTravelEventToJson,
  parseTravelEventBuilderJson,
  prepareTravelEventBuilderExportPreview,
  getDefaultArcflightComponentData,
  arcflightComponentDefaults,
  ARCFLIGHT_SHIP_ACTOR_TYPE,
  arcflightShipDefaults,
  getArcflightShipData,
  getDefaultArcflightShipData
};
