import { ARCFLIGHT } from "./config/constants.js";
import { TRAVEL_V2_DEV_TOOLS_SETTING, forceTravelV2RoundResolved, isTravelV2DevToolsEnabled } from "./helpers/travel-v2-dev-tools.js";
import { applyTravelV2PressureToRunnerSession } from "./helpers/travel-v2-session-pressure-application.js";
import { finalizeTravelV2RoundOnRunnerSession } from "./helpers/travel-v2-session-round-finalization.js";
import { buildTravelV2EventCompletionSummary, completeTravelV2EventOnRunnerSession } from "./helpers/travel-v2-session-event-completion.js";
import { prepareTravelV2RoundFinalizationState } from "./helpers/travel-v2-round-finalization-state.js";
import { createArcflightDevTools } from "./dev/dev-tools.js";
import { ArcflightTravelEventBuilder, openTravelEventBuilder, prepareTravelEventBuilderShellState } from "./apps/travel-event-builder.js";
import { ArcflightTravelEventRunner, getActiveTravelEventRunner, openTravelEventRunner, prepareSelectedTravelEventLibraryDetails, prepareTravelEventLibraryOptions, prepareTravelEventNarrativeLog, updateActiveTravelEventRunnerSession } from "./apps/travel-event-runner.js";
import { ArcflightTravelSceneOverlay, getActiveTravelSceneOverlay, openTravelSceneOverlay, updateActiveTravelSceneOverlayContext } from "./apps/travel-scene-overlay.js";
import { prepareTravelEventRunnerAppStateWithTravelV2Preview } from "./apps/travel-event-runner-v2-preview-consumer.js";
import { TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION, normalizeTravelV2PendingStationBenefitQueueInput, prepareTravelV2PendingStationBenefitQueueItems, prepareTravelV2PendingStationBenefitPlayerState, prepareTravelV2PendingStationBenefitGmState, applyTravelV2PendingStationBenefitQueueToRenderState } from "./helpers/travel-v2-pending-station-benefit-queue.js";
import { TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION, normalizeTravelV2StationBenefitUseReviewInput, prepareTravelV2StationBenefitDisplayRows, prepareTravelV2StationBenefitUseReviewPlayerState, prepareTravelV2StationBenefitUseReviewGmState, applyTravelV2StationBenefitUseReviewToRenderState } from "./helpers/travel-v2-station-benefit-use-review.js";
import {
  ArcflightTravelPlayerMissionBoard,
  TRAVEL_MISSION_BOARD_BROADCAST_DEBUG_SETTING,
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
import { prepareTravelV2CardSchemaImportPreview, validateTravelV2CardSchemaImportPayload } from "./helpers/travel-v2-card-schema-import-adapter.js";
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
  inspectTravelV2RoundResolutionReadiness,
  prepareTravelSceneOverlayState,
  prepareTravelPlayerStationCardState,
  prepareTravelPlayerReactionPromptState,
  commitTravelEventRunnerStationOrder,
  retreatTravelEventRunnerRound,
  saveTravelEventRunnerSessionToLibrary,
  persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary,
  setTravelEventRunnerStationResult,
  setTravelEventRunnerStationSkillApproach,
  summarizeTravelEventRunnerSession
} from "./helpers/travel-event-runner.js";
import {
  TRAVEL_V2_PENDING_CONSEQUENCE_QUEUE_VERSION,
  applyTravelV2SelectedConsequenceToSession,
  inspectTravelV2ConsequenceApplicationFlow,
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

function getActiveLocalTravelRunnerContext() {
  const activeOverlay = getActiveTravelSceneOverlay();
  const activeRunner = getActiveTravelEventRunner();
  const sourceSession = activeOverlay?.session ?? activeRunner?.session ?? null;
  if (!sourceSession) return { activeOverlay, activeRunner, session: null, errors: ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."] };
  const normalized = normalizeTravelEventRunnerSession(sourceSession);
  return { activeOverlay, activeRunner, session: normalized.session ?? null, errors: normalized.errors ?? [] };
}

function normalizeForcedTravelStationResultArgs(input, maybeResult) {
  if (typeof input === "string") return { stationKey: input, result: typeof maybeResult === "string" ? maybeResult : "" };
  const options = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return {
    stationKey: typeof options.stationKey === "string" ? options.stationKey : "",
    result: typeof options.result === "string" ? options.result : ""
  };
}

async function forceTravelStationResult(input = {}, maybeResult = "") {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["forceTravelStationResult is GM-only."], sessionKey: "", stationKey: "", result: "", reactionPromptId: "", promptSent: false };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], sessionKey: "", stationKey: "", result: "", reactionPromptId: "", promptSent: false };
  const { activeOverlay, activeRunner, session, errors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: errors?.length ? errors : ["No active local Travel v2 runner session."], sessionKey: "", stationKey: "", result: "", reactionPromptId: "", promptSent: false };
  const args = normalizeForcedTravelStationResultArgs(input, maybeResult);
  const result = ["criticalFailure", "failure", "success", "criticalSuccess"].includes(args.result) ? args.result : "";
  if (!result) return { ok: false, errors: ["Forced station result must be criticalFailure, failure, success, or criticalSuccess."], sessionKey: session.key ?? "", stationKey: args.stationKey, result: args.result, reactionPromptId: "", promptSent: false };
  const state = prepareTravelSceneOverlayState(session, { actor: activeOverlay?.actor });
  const stationKey = args.stationKey || (state.stations ?? []).find((station) => station.isActive !== false)?.stationKey || "";
  if (!stationKey) return { ok: false, errors: ["No active player station is available to force."], sessionKey: session.key ?? "", stationKey: "", result, reactionPromptId: "", promptSent: false };
  const roundIndex = Number(session.currentRoundIndex ?? 0);
  const beforePromptIds = new Set((session.reactionPrompts?.records ?? []).map((record) => record.reactionPromptId).filter(Boolean));
  const updated = setTravelEventRunnerStationResult(session, roundIndex, stationKey, result);
  if (!updated?.ok || !updated.session) return { ok: false, errors: updated?.errors ?? ["Station result could not be forced."], sessionKey: session.key ?? "", stationKey, result, reactionPromptId: "", promptSent: false };
  const prompt = (updated.session.reactionPrompts?.records ?? []).find((record) =>
    record.roundIndex === roundIndex
    && record.stationKey === stationKey
    && record.status === "pending"
    && (!beforePromptIds.has(record.reactionPromptId) || record.result === result)
  ) ?? null;
  if (activeOverlay) activeOverlay.session = updated.session;
  await updateActiveTravelSceneOverlayContext({ session: updated.session }, { render: true });
  await updateActiveTravelEventRunnerSession(updated.session, { statusMessage: `Dev forced ${stationKey} to ${result}.` });
  if (activeRunner && activeRunner.session !== updated.session) activeRunner.session = updated.session;
  const missionBoardUpdate = sendTravelPlayerMissionBoardStationUpdateToPlayers(updated.session, stationKey, { actor: activeOverlay?.actor });
  const stationCardUpdate = sendTravelPlayerStationCardToPlayers(updated.session, stationKey, { actor: activeOverlay?.actor });
  let promptDelivery = null;
  if (prompt?.reactionPromptId) promptDelivery = sendTravelPlayerReactionPromptToPlayers(updated.session, prompt.reactionPromptId, { actor: activeOverlay?.actor });
  return {
    ok: true,
    errors: [],
    sessionKey: updated.session.key ?? "",
    stationKey,
    result,
    reactionPromptId: prompt?.reactionPromptId ?? "",
    promptSent: promptDelivery?.ok === true,
    missionBoardUpdate,
    stationCardUpdate,
    promptDelivery
  };
}

function inspectTravelV2ConsequenceFlowForSession(session, options = {}) {
  const playerSafeState = options.playerSafeState ?? prepareTravelPlayerMissionBoardStateForPlayers(session, { actor: options.actor });
  const readiness = inspectTravelV2RoundResolutionReadiness(session, { actor: options.actor, playerSafeState });
  const finalization = prepareTravelV2RoundFinalizationState(session, options);
  const queue = prepareTravelV2PendingConsequenceQueue(session, options);
  const queueItems = Array.isArray(queue.items) ? queue.items : [];
  const followups = session?.travelV2ConsequenceFollowups?.records ?? [];
  const errors = [...(readiness.errors ?? [])];
  const warnings = [...(readiness.warnings ?? [])];
  const notes = [];
  const roundFinalized = finalization.isFinalized === true || finalization.isEventCompleteReady === true;
  const pressureApplied = finalization.isPressureApplied === true || Boolean(finalization.pressureApplicationRecord);
  const pendingConsequenceCount = queue.pendingCount ?? queueItems.filter((item) => item.status === "pending").length;
  const unappliedConsequenceCount = queueItems.filter((item) => item.status === "pending" || item.status === "deferred").length + followups.filter((record) => !["reviewed", "resolved", "dismissed"].includes(record?.status)).length;
  const reviewedConsequenceCount = followups.filter((record) => record?.status === "reviewed").length;
  const resolvedConsequenceCount = (queue.appliedCount ?? queueItems.filter((item) => item.status === "applied").length) + followups.filter((record) => record?.status === "resolved").length;
  const dismissedConsequenceCount = queue.dismissedCount ?? queueItems.filter((item) => item.status === "dismissed").length;
  const playerJson = JSON.stringify(playerSafeState ?? {});
  const forbiddenTerms = ["pendingConsequenceQueue", "queueGroup", "consequenceCatalog", "gmOnly", "internalSeverity", "unrevealedHazard", "shipScarControls", "managementAction", "gmItemGroups", "catalogSuggestions", "selectedConsequenceApplyPreview", "GM-only queue label"];
  const leakedTerms = forbiddenTerms.filter((term) => playerJson.includes(term));
  if (leakedTerms.length) errors.push(`Player-safe Travel v2 state exposes GM-only consequence term(s): ${leakedTerms.join(", ")}.`);
  if (pendingConsequenceCount > 0 && !roundFinalized) errors.push("Pending consequence queue exists before this round is finalized.");
  if (roundFinalized && pendingConsequenceCount > 0) notes.push("Round finalized. Review pending consequences before advancing.");
  if (roundFinalized && pendingConsequenceCount === 0) notes.push("No pending consequences. Ready to advance.");
  const canFinalizeRound = readiness.ok === true && finalization.canFinalize === true;
  const canApplyConsequences = roundFinalized && pendingConsequenceCount > 0;
  const canAdvanceRound = readiness.ok === true && roundFinalized && unappliedConsequenceCount === 0 && Number(session?.currentRoundIndex ?? 0) < (session?.event?.rounds?.length ?? 0) - 1;
  if (!roundFinalized && readiness.canAdvanceRound === true) errors.push("Round advancement appears available before round finalization is complete.");
  if (roundFinalized && unappliedConsequenceCount > 0 && readiness.canAdvanceRound === true) errors.push("Round advancement appears available before required consequence review is clean.");
  return { ok: errors.length === 0, errors, warnings, sessionKey: session?.key ?? "", currentRoundIndex: Number(session?.currentRoundIndex ?? -1), roundResolved: readiness.ok === true, roundFinalized, roundOutcomeKey: finalization.effectiveOutcomeKey ?? readiness.roundOutcomeKey ?? "", roundOutcomeLabel: readiness.roundOutcomeLabel || (finalization.effectiveOutcomeKey ? String(finalization.effectiveOutcomeKey) : ""), pressureApplied, pendingConsequenceCount, unappliedConsequenceCount, reviewedConsequenceCount, resolvedConsequenceCount, dismissedConsequenceCount, canFinalizeRound, canApplyConsequences, canAdvanceRound, playerStateSafe: leakedTerms.length === 0 && readiness.playerSummarySafe !== false, notes };
}


function inspectTravelAdvanceRoundFlowForSession(session, options = {}) {
  const playerSafeState = prepareTravelPlayerMissionBoardStateForPlayers(session, { actor: options.actor });
  const consequenceFlow = inspectTravelV2ConsequenceFlowForSession(session, { actor: options.actor, playerSafeState });
  const currentRoundIndex = Number(session?.currentRoundIndex ?? -1);
  const totalRounds = session?.event?.rounds?.length ?? 0;
  const currentRoundNumber = currentRoundIndex >= 0 ? currentRoundIndex + 1 : 0;
  const nextRound = session?.event?.rounds?.[currentRoundIndex + 1] ?? null;
  const nextRoundActiveStations = Array.isArray(nextRound?.activeStations) ? [...nextRound.activeStations] : [];
  const playerStations = Array.isArray(playerSafeState?.stations) ? playerSafeState.stations : [];
  const playerStationCards = playerStations.map((station) => prepareTravelPlayerStationCardState(session, station.stationKey, { actor: options.actor }));
  const playerJson = JSON.stringify(playerSafeState ?? {});
  const forbiddenTerms = ["pendingConsequenceQueue", "gmItemGroups", "catalogSuggestions", "selectedConsequenceApplyPreview", "unrevealedHazard", "GM-only queue label"];
  const staleConsequenceLeakCount = forbiddenTerms.filter((term) => playerJson.includes(term)).length;
  const staleCurrentRoundResultCount = playerStations.filter((station) => station.hasResult === true || station.resultLabel && station.resultLabel !== "Unrecorded").length;
  const staleCurrentRoundReactionPromptCount = playerStations.filter((station) => station.focusReactionAvailable === true || station.hasPendingReactionPrompt === true).length
    + playerStationCards.filter((card) => card.focusReactionAvailable === true || card.hasPendingReactionPrompt === true).length;
  const staleCurrentRoundRerollNeededCount = playerStations.filter((station) => station.focusRerollNeeded === true).length
    + playerStationCards.filter((card) => card.focusRerollNeeded === true).length;
  const errors = [...(consequenceFlow.errors ?? [])];
  const warnings = [...(consequenceFlow.warnings ?? [])];
  const notes = [...(consequenceFlow.notes ?? [])];
  const hasNextRound = Boolean(nextRound);
  const playerCurrentRoundIndex = Number(playerSafeState?.currentRoundIndex ?? -1);
  const playerCurrentRoundNumber = playerCurrentRoundIndex >= 0 ? playerCurrentRoundIndex + 1 : 0;
  const playerActiveStationCount = playerStations.length;
  const playerMissionBoardSafe = playerSafeState?.hasSession === true && playerCurrentRoundIndex === currentRoundIndex && staleConsequenceLeakCount === 0;
  if (consequenceFlow.roundFinalized !== true) errors.push("Finalize this round before advancing.");
  if (consequenceFlow.pressureApplied !== true) errors.push("Apply pressure/finalization before advancing.");
  if ((consequenceFlow.pendingConsequenceCount ?? 0) > 0 || (consequenceFlow.unappliedConsequenceCount ?? 0) > 0) errors.push("Review pending consequences before advancing.");
  if (!hasNextRound) errors.push("No next round is available.");
  if (!playerMissionBoardSafe) errors.push("Player mission board current round or safety scan does not match the active runner round.");
  if (staleConsequenceLeakCount > 0) errors.push("Player-safe state exposes stale GM-only consequence data.");
  if (staleCurrentRoundReactionPromptCount > 0) errors.push("Player-safe station state still has a pending previous-round reaction prompt.");
  if (staleCurrentRoundRerollNeededCount > 0) errors.push("Player-safe station state still has a previous-round Focus reroll needed.");
  if (errors.length === 0) notes.push(`Ready to advance to Round ${currentRoundIndex + 2}.`);
  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    warnings,
    sessionKey: session?.key ?? "",
    currentRoundIndex,
    currentRoundNumber,
    totalRounds,
    canAdvanceRound: errors.length === 0,
    hasNextRound,
    currentRoundFinalized: consequenceFlow.roundFinalized === true,
    currentRoundPressureApplied: consequenceFlow.pressureApplied === true,
    consequenceFlowClean: (consequenceFlow.pendingConsequenceCount ?? 0) === 0 && (consequenceFlow.unappliedConsequenceCount ?? 0) === 0 && consequenceFlow.playerStateSafe !== false,
    pendingConsequenceCount: consequenceFlow.pendingConsequenceCount ?? 0,
    unappliedConsequenceCount: consequenceFlow.unappliedConsequenceCount ?? 0,
    nextRoundActiveStationCount: nextRoundActiveStations.length,
    nextRoundActiveStations,
    playerMissionBoardSafe,
    playerCurrentRoundIndex,
    playerCurrentRoundNumber,
    playerActiveStationCount,
    staleCurrentRoundResultCount,
    staleCurrentRoundReactionPromptCount,
    staleCurrentRoundRerollNeededCount,
    staleConsequenceLeakCount,
    notes
  };
}

async function inspectTravelGmUiFlow() {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["inspectTravelGmUiFlow is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], sessionKey: "", currentRoundIndex: -1, currentRoundNumber: 0, statusStrip: null, nextActionLabel: "No active Travel v2 runner.", blockers: [], disabledActions: {}, playerStateSafe: false, gmStateHasManagementControls: false, notes: [] };
  const appState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, actor: activeOverlay?.actor, user: globalThis.game?.user, travelV2DevToolsEnabled: true });
  const statusStrip = appState.travelV2GmFlowStatus ?? null;
  const playerSafeState = prepareTravelPlayerMissionBoardStateForPlayers(session, { actor: activeOverlay?.actor });
  const playerJson = JSON.stringify(playerSafeState ?? {});
  const forbiddenTerms = ["pendingConsequenceQueue", "gmItemGroups", "catalogSuggestions", "selectedConsequenceApplyPreview", "applicationRecord", "application id", "internalSeverity", "managementAction", "applyEffectSummary", "GM-only labels"];
  const leakedTerms = forbiddenTerms.filter((term) => playerJson.includes(term));
  const gmJson = JSON.stringify(appState ?? {});
  const gmStateHasManagementControls = gmJson.includes("pendingConsequenceQueue") && gmJson.includes("gmItemGroups");
  const warnings = [];
  if (!statusStrip) warnings.push("GM flow status strip was not prepared.");
  if (!gmStateHasManagementControls) warnings.push("GM management controls were not present in GM app state.");
  const errors = leakedTerms.length > 0 ? [`Player-safe state exposes GM-only UI term(s): ${leakedTerms.join(", ")}.`] : [];
  return {
    ok: errors.length === 0 && Boolean(statusStrip),
    errors,
    warnings,
    sessionKey: session.key ?? "",
    currentRoundIndex: Number(session.currentRoundIndex ?? 0),
    currentRoundNumber: Number(session.currentRoundIndex ?? 0) + 1,
    statusStrip,
    nextActionLabel: statusStrip?.nextActionLabel ?? "",
    blockers: statusStrip?.blockers ?? [],
    disabledActions: statusStrip?.disabledActions ?? {},
    playerStateSafe: leakedTerms.length === 0,
    gmStateHasManagementControls,
    notes: [statusStrip?.nextActionHelpText ?? ""].filter(Boolean)
  };
}

async function inspectTravelEventCompletionFlow() {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["inspectTravelEventCompletionFlow is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], sessionKey: "", eventTitle: "", actorName: "", currentRoundIndex: -1, currentRoundNumber: 0, totalRounds: 0, completionReady: false, canCompleteEvent: false, playerStateSafe: false, gmStateHasManagementControls: false, blockers: ["Open or start a Travel Event Runner first."], nextActionLabel: "No active Travel v2 runner.", notes: [] };
  const appState = prepareTravelEventRunnerAppStateWithTravelV2Preview({ session, actor: activeOverlay?.actor, user: globalThis.game?.user, travelV2DevToolsEnabled: true });
  const totalRounds = session.event?.rounds?.length ?? 0;
  const currentRoundIndex = Number(session.currentRoundIndex ?? 0);
  const currentRoundNumber = currentRoundIndex + 1;
  const hasNextRound = currentRoundIndex < totalRounds - 1;
  const playerSafeState = prepareTravelPlayerMissionBoardStateForPlayers(session, { actor: activeOverlay?.actor });
  const playerJson = JSON.stringify(playerSafeState ?? {});
  const forbiddenTerms = ["pendingConsequenceQueue", "gmItemGroups", "catalogSuggestions", "selectedConsequenceApplyPreview", "applicationRecord", "internalSeverity", "managementAction", "GM-only queue label"];
  const leakedTerms = forbiddenTerms.filter((term) => playerJson.includes(term));
  const isCompleted = session.status === "completed" || session.completed === true;
  const storedSummary = session.travelV2CompletionSummary ?? session.travelV2EventCompletion?.summary ?? null;
  if (isCompleted) {
    const summaryPreview = storedSummary ?? buildTravelV2EventCompletionSummary(session, { actor: activeOverlay?.actor });
    return {
      ok: leakedTerms.length === 0,
      alreadyCompleted: true,
      errors: leakedTerms.length ? ["Player-safe state exposes GM-only completion data."] : [],
      warnings: [],
      sessionKey: session.key ?? "",
      eventTitle: summaryPreview.eventTitle,
      actorName: summaryPreview.actorName,
      currentRoundIndex,
      currentRoundNumber,
      totalRounds,
      isFinalRound: totalRounds > 0 && currentRoundIndex >= totalRounds - 1,
      hasNextRound,
      roundFinalized: true,
      pressureApplied: true,
      stationsResolved: true,
      focusClear: true,
      consequencesClear: true,
      completionReady: false,
      canCompleteEvent: false,
      playerStateSafe: leakedTerms.length === 0,
      gmStateHasManagementControls: JSON.stringify(appState ?? {}).includes("pendingConsequenceQueue"),
      summaryPreview,
      blockers: [],
      nextActionLabel: "Travel event completed.",
      notes: ["The Travel v2 event is completed."]
    };
  }
  const consequenceFlow = inspectTravelV2ConsequenceFlowForSession(session, { actor: activeOverlay?.actor });
  const applicationFlow = inspectTravelV2ConsequenceApplicationFlow(session, { actor: activeOverlay?.actor });
  const stations = Array.isArray(appState.stations) ? appState.stations : [];
  const stationsResolved = stations.length === 0 || stations.every((station) => Boolean(station.result));
  const focusClear = stations.every((station) => station.focusRerollNeeded !== true && station.needsFocusReroll !== true) && (appState.reactionPromptReview?.records ?? []).every((record) => record?.status !== "pending" && record?.isPending !== true);
  const consequencesClear = (consequenceFlow.pendingConsequenceCount ?? 0) === 0 && (consequenceFlow.unappliedConsequenceCount ?? 0) === 0 && (applicationFlow.invalidResourceMutationCount ?? 0) === 0 && (applicationFlow.duplicateApplicationRecordCount ?? 0) === 0;
  const roundFinalized = consequenceFlow.roundFinalized === true;
  const pressureApplied = consequenceFlow.pressureApplied === true;
  const isFinalRound = totalRounds > 0 && currentRoundIndex >= totalRounds - 1;
  const blockers = [];
  if (!isFinalRound && hasNextRound) blockers.push("Advance through all Travel v2 rounds first.");
  if (!stationsResolved) blockers.push("Resolve all active stations first.");
  if (!focusClear) blockers.push("Resolve pending Focus reactions or accepted rerolls first.");
  if (!roundFinalized) blockers.push("Finalize the final Travel v2 round first.");
  if (!pressureApplied) blockers.push("Apply pressure/finalization before completing.");
  if (!consequencesClear) blockers.push("Apply, dismiss, or repair pending consequence records first.");
  if (leakedTerms.length) blockers.push("Player-safe state exposes GM-only completion data.");
  const completionReady = blockers.length === 0;
  const summaryPreview = buildTravelV2EventCompletionSummary(session, { actor: activeOverlay?.actor });
  return {
    ok: completionReady,
    errors: completionReady ? [] : blockers,
    warnings: [...(consequenceFlow.warnings ?? []), ...(applicationFlow.warnings ?? [])],
    sessionKey: session.key ?? "",
    eventTitle: summaryPreview.eventTitle,
    actorName: summaryPreview.actorName,
    currentRoundIndex,
    currentRoundNumber,
    totalRounds,
    isFinalRound,
    hasNextRound,
    roundFinalized,
    pressureApplied,
    stationsResolved,
    focusClear,
    consequencesClear,
    completionReady,
    canCompleteEvent: completionReady,
    playerStateSafe: leakedTerms.length === 0 && consequenceFlow.playerStateSafe !== false,
    gmStateHasManagementControls: JSON.stringify(appState ?? {}).includes("pendingConsequenceQueue"),
    summaryPreview,
    blockers,
    nextActionLabel: completionReady ? "Complete Travel Event." : (blockers[0] ?? "Complete Travel Event."),
    notes: [appState.travelV2GmFlowStatus?.nextActionHelpText ?? ""].filter(Boolean)
  };
}

async function forceTravelEventCompleted(input = {}) {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["forceTravelEventCompleted is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, activeRunner, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], completed: false, sessionKey: "" };
  const inspection = await inspectTravelEventCompletionFlow();
  if (input.previewOnly === true) return { ...inspection, completed: false, summary: inspection.summaryPreview, notes: [...(inspection.notes ?? []), "Preview only; session was not mutated."] };
  if (session.status === "completed" || session.completed === true) return { ok: false, alreadyCompleted: true, completed: false, errors: ["Travel v2 event is already completed."], warnings: [], sessionKey: session.key ?? "", completionReady: false, summary: session.travelV2CompletionSummary ?? session.travelV2EventCompletion?.summary ?? null, playerStateSafe: inspection.playerStateSafe === true, notes: ["Duplicate completion blocked; existing summary was left unchanged."] };
  if (inspection.completionReady !== true && input.force !== true) return { ok: false, completed: false, errors: inspection.blockers ?? ["Travel v2 event completion is blocked."], warnings: inspection.warnings ?? [], sessionKey: session.key ?? "", completionReady: false, summary: inspection.summaryPreview, playerStateSafe: inspection.playerStateSafe === true, notes: inspection.notes ?? [] };
  const completed = completeTravelV2EventOnRunnerSession(session, { ...input, actor: activeOverlay?.actor, completedByUserId: globalThis.game?.user?.id ?? "", completedByUserName: globalThis.game?.user?.name ?? "" });
  if (!completed.ok || !completed.session) return { ok: false, completed: false, errors: completed.blockedReasons ?? ["Travel v2 event completion was blocked."], warnings: [], sessionKey: session.key ?? "", completionReady: inspection.completionReady === true, summary: completed.summary ?? inspection.summaryPreview, playerStateSafe: inspection.playerStateSafe === true, notes: [] };
  if (activeOverlay) activeOverlay.session = completed.session;
  if (activeRunner) activeRunner.session = completed.session;
  await updateActiveTravelSceneOverlayContext({ session: completed.session }, { render: true });
  await updateActiveTravelEventRunnerSession(completed.session, { statusMessage: "Travel v2 event completed. Summary is stored on the runner session." });
  await queueTravelPlayerMissionBoardRefreshToPlayers(completed.session, { actor: activeOverlay?.actor });
  return { ok: true, errors: [], warnings: input.postChat === true || input.createJournal === true ? ["Chat and Journal export are not implemented by this helper; no document was created."] : [], sessionKey: completed.session.key ?? "", completed: true, completedAt: completed.completedAt, completedByUserId: completed.completionRecord?.completedByUserId ?? "", completedByUserName: completed.completionRecord?.completedByUserName ?? "", completionReady: true, summary: completed.summary, playerStateSafe: inspection.playerStateSafe === true, notes: ["No actors, items, chat messages, journals, or combats were mutated by default."] };
}

async function inspectTravelAdvanceRoundFlow() {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["inspectTravelAdvanceRoundFlow is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], sessionKey: "", currentRoundIndex: -1, notes: [] };
  return inspectTravelAdvanceRoundFlowForSession(session, { actor: activeOverlay?.actor });
}

async function forceTravelRoundAdvanced(input = {}) {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["forceTravelRoundAdvanced is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, activeRunner, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], sessionKey: "", currentRoundIndex: -1 };
  let nextSession = session;
  const warnings = [];
  if (input.finalizeCurrentRound === true) {
    const finalized = await forceTravelRoundFinalized({ ...input, resolveStations: input.resolveStations !== false });
    if (!finalized.ok) return { ok: false, errors: finalized.errors ?? ["Could not finalize current round before advancing."], warnings: finalized.warnings ?? [], sessionKey: session.key ?? "", currentRoundIndex: Number(session.currentRoundIndex ?? 0), advanceFlow: finalized };
    warnings.push(...(finalized.warnings ?? []));
    nextSession = getActiveLocalTravelRunnerContext().session ?? nextSession;
  }
  const previousRoundIndex = Number(nextSession.currentRoundIndex ?? 0);
  const advanced = advanceTravelEventRunnerRound(nextSession, { force: input.force === true });
  if (!advanced.ok) return { ok: false, errors: advanced.errors ?? ["Could not advance Travel round."], warnings, sessionKey: nextSession.key ?? "", previousRoundIndex, currentRoundIndex: previousRoundIndex, advanceFlow: inspectTravelAdvanceRoundFlowForSession(nextSession, { actor: activeOverlay?.actor }) };
  nextSession = advanced.session;
  if (activeOverlay) activeOverlay.session = nextSession;
  await updateActiveTravelSceneOverlayContext({ session: nextSession }, { render: true });
  await updateActiveTravelEventRunnerSession(nextSession, { statusMessage: `Advanced to Round ${Number(nextSession.currentRoundIndex ?? 0) + 1}. Players may choose station approaches.` });
  if (activeRunner && activeRunner.session !== nextSession) activeRunner.session = nextSession;
  await queueTravelPlayerMissionBoardRefreshToPlayers(nextSession, { actor: activeOverlay?.actor });
  const stationCards = sendAllTravelPlayerStationCardsToPlayers(nextSession, { actor: activeOverlay?.actor });
  const advanceFlow = inspectTravelAdvanceRoundFlowForSession(nextSession, { actor: activeOverlay?.actor });
  const activeStations = nextSession.event?.rounds?.[nextSession.currentRoundIndex]?.activeStations ?? [];
  return { ok: true, errors: [], warnings, sessionKey: nextSession.key ?? "", previousRoundIndex, currentRoundIndex: Number(nextSession.currentRoundIndex ?? 0), previousRoundNumber: previousRoundIndex + 1, currentRoundNumber: Number(nextSession.currentRoundIndex ?? 0) + 1, activeStationCount: activeStations.length, activeStations, playerMissionBoardSafe: advanceFlow.playerMissionBoardSafe === true, advanceFlow, stationCards };
}

async function inspectTravelConsequenceFlow() {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["inspectTravelConsequenceFlow is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], sessionKey: "", currentRoundIndex: -1, notes: [] };
  return inspectTravelV2ConsequenceFlowForSession(session, { actor: activeOverlay?.actor });
}

async function inspectTravelConsequenceApplicationFlow() {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["inspectTravelConsequenceApplicationFlow is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], sessionKey: "", currentRoundIndex: -1, notes: [] };
  const finalization = prepareTravelV2RoundFinalizationState(session, { actor: activeOverlay?.actor });
  const playerSafeState = prepareTravelPlayerMissionBoardStateForPlayers(session, { actor: activeOverlay?.actor });
  const playerJson = JSON.stringify(playerSafeState ?? {});
  const forbiddenTerms = ["pendingConsequenceQueue", "gmItemGroups", "catalogSuggestions", "selectedConsequenceApplyPreview", "unrevealedHazard", "internalSeverity", "managementAction", "applyEffectSummary", "GM-only queue label"];
  const playerConsequenceLeakCount = forbiddenTerms.filter((term) => playerJson.includes(term)).length;
  const applicationFlow = inspectTravelV2ConsequenceApplicationFlow(session, { actor: activeOverlay?.actor });
  const advanceFlow = inspectTravelAdvanceRoundFlowForSession(session, { actor: activeOverlay?.actor });
  const errors = [...(applicationFlow.errors ?? [])];
  if (playerConsequenceLeakCount > 0) errors.push("Player-safe Travel v2 state exposes GM-only consequence application details.");
  const roundFinalized = finalization.isFinalized === true || finalization.isEventCompleteReady === true;
  const pressureApplied = finalization.isPressureApplied === true || Boolean(finalization.pressureApplicationRecord);
  if (!roundFinalized) errors.push("Current round is not finalized yet.");
  if (!pressureApplied) errors.push("Current round pressure/finalization has not been applied yet.");
  return { ...applicationFlow, ok: errors.length === 0, errors: [...new Set(errors)], roundFinalized, pressureApplied, canAdvanceRound: advanceFlow.ok === true, playerStateSafe: playerConsequenceLeakCount === 0, playerConsequenceLeakCount };
}

async function forceTravelConsequenceApplied(input = {}) {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["forceTravelConsequenceApplied is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, activeRunner, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], sessionKey: "", currentRoundIndex: -1 };
  const queue = prepareTravelV2PendingConsequenceQueue(session, { actor: activeOverlay?.actor });
  if (!queue.items.length || queue.pendingCount < 1) return { ok: false, errors: ["No pending Travel v2 consequence queue item is available to apply."], warnings: [], sessionKey: session.key ?? "", currentRoundIndex: Number(session.currentRoundIndex ?? 0), pendingConsequenceCount: queue.pendingCount ?? 0 };
  const itemId = typeof input.itemId === "string" ? input.itemId : "";
  const itemIndex = Number.isInteger(Number(input.itemIndex)) ? Number(input.itemIndex) : 0;
  const item = itemId ? queue.items.find((candidate) => candidate.queueKey === itemId || candidate.sourceId === itemId || candidate.selectedConsequence?.id === itemId) : queue.items.filter((candidate) => candidate.status === "pending")[itemIndex];
  if (!item) return { ok: false, errors: ["Selected pending consequence queue item was not found."], warnings: [], sessionKey: session.key ?? "", currentRoundIndex: Number(session.currentRoundIndex ?? 0), pendingConsequenceCount: queue.pendingCount ?? 0 };
  if (item.status !== "pending" && input.force !== true) return { ok: false, errors: [`Selected consequence is already ${item.status}.`], warnings: [], sessionKey: session.key ?? "", currentRoundIndex: Number(session.currentRoundIndex ?? 0), appliedItemId: item.queueKey };
  let nextSession = session;
  if (!item.selectedConsequence?.id) {
    if (item.catalogSuggestions?.length !== 1) return { ok: false, errors: ["Selected pending consequence needs a GM catalog-card selection before it can be applied."], warnings: [], sessionKey: session.key ?? "", currentRoundIndex: Number(session.currentRoundIndex ?? 0), appliedItemId: item.queueKey };
    const selected = selectTravelV2PendingConsequenceCatalogCard(nextSession, item.queueKey, item.catalogSuggestions[0].id, { actor: activeOverlay?.actor });
    if (!selected.ok) return { ok: false, errors: [selected.error ?? "Could not select the single suggested consequence catalog card."], warnings: [], sessionKey: session.key ?? "", currentRoundIndex: Number(session.currentRoundIndex ?? 0), appliedItemId: item.queueKey };
    nextSession = selected.session;
  }
  const applied = applyTravelV2SelectedConsequenceToSession(nextSession, item.queueKey, { actor: activeOverlay?.actor, force: input.force === true, appliedByUserId: globalThis.game?.user?.id, appliedByUserName: globalThis.game?.user?.name });
  if (!applied.ok) return { ok: false, errors: [applied.error ?? "Selected consequence was not applied."], warnings: [], sessionKey: session.key ?? "", currentRoundIndex: Number(session.currentRoundIndex ?? 0), appliedItemId: item.queueKey, applicationFlow: inspectTravelV2ConsequenceApplicationFlow(nextSession, { actor: activeOverlay?.actor }) };
  nextSession = applied.session;
  if (activeOverlay) activeOverlay.session = nextSession;
  await updateActiveTravelSceneOverlayContext({ session: nextSession }, { render: true });
  await updateActiveTravelEventRunnerSession(nextSession, { statusMessage: "Dev applied one Travel v2 consequence." });
  if (activeRunner && activeRunner.session !== nextSession) activeRunner.session = nextSession;
  await queueTravelPlayerMissionBoardRefreshToPlayers(nextSession, { actor: activeOverlay?.actor });
  sendAllTravelPlayerStationCardsToPlayers(nextSession, { actor: activeOverlay?.actor });
  const applicationFlow = await inspectTravelConsequenceApplicationFlow();
  const mutation = applied.appliedRecord?.mutation === "session-pressure-only" ? [{ resource: applied.appliedRecord.resource ?? applied.appliedRecord.pressureTrack, beforeValue: applied.appliedRecord.beforeValue, afterValue: applied.appliedRecord.afterValue, delta: applied.appliedRecord.delta ?? applied.appliedRecord.pressureDelta, mode: applied.appliedRecord.mode ?? "add" }] : [];
  return { ok: true, errors: [], warnings: input.force === true ? ["Forced consequence application was explicitly requested."] : [], sessionKey: nextSession.key ?? "", currentRoundIndex: Number(nextSession.currentRoundIndex ?? 0), appliedItemId: item.queueKey, appliedItemLabel: item.title ?? "", applicationId: applied.appliedRecord?.applicationId ?? "", resourceMutations: mutation, pendingConsequenceCount: applicationFlow.pendingConsequenceCount, unappliedConsequenceCount: applicationFlow.unappliedConsequenceCount, canAdvanceRound: applicationFlow.canAdvanceRound === true, playerStateSafe: applicationFlow.playerStateSafe === true, applicationFlow };
}

async function forceTravelRoundFinalized(input = {}) {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["forceTravelRoundFinalized is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, activeRunner, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], sessionKey: "", currentRoundIndex: -1 };
  let nextSession = session;
  const warnings = [];
  if (input.resolveStations !== false) {
    const resolved = forceTravelV2RoundResolved(nextSession, input, { actor: activeOverlay?.actor });
    if (!resolved.ok) return { ok: false, errors: resolved.errors ?? ["Could not resolve round stations."], warnings: resolved.warnings ?? [], sessionKey: session.key ?? "", currentRoundIndex: Number(session.currentRoundIndex ?? 0), readiness: resolved.readiness ?? null };
    warnings.push(...(resolved.warnings ?? []));
    nextSession = resolved.session;
  }
  let readiness = inspectTravelV2RoundResolutionReadiness(nextSession, { actor: activeOverlay?.actor, playerSafeState: prepareTravelPlayerMissionBoardStateForPlayers(nextSession, { actor: activeOverlay?.actor }) });
  if (!readiness.ok) return { ok: false, errors: readiness.errors ?? ["Round is not ready to finalize."], warnings, sessionKey: nextSession.key ?? "", currentRoundIndex: Number(nextSession.currentRoundIndex ?? 0), readiness };
  if (!prepareTravelV2RoundFinalizationState(nextSession).isPressureApplied) {
    const pressure = applyTravelV2PressureToRunnerSession(nextSession, { actor: activeOverlay?.actor });
    if (!pressure.ok) return { ok: false, errors: pressure.errors ?? pressure.blockedReasons ?? [pressure.error ?? "Could not apply Travel v2 pressure."], warnings, sessionKey: nextSession.key ?? "", currentRoundIndex: Number(nextSession.currentRoundIndex ?? 0), readiness, pressureResult: pressure };
    nextSession = pressure.session;
  }
  const finalized = finalizeTravelV2RoundOnRunnerSession(nextSession, { actor: activeOverlay?.actor });
  if (!finalized.ok) return { ok: false, errors: finalized.blockedReasons ?? [finalized.error ?? "Travel v2 round finalization failed."], warnings, sessionKey: nextSession.key ?? "", currentRoundIndex: Number(nextSession.currentRoundIndex ?? 0), readiness };
  nextSession = finalized.session;
  if (activeOverlay) activeOverlay.session = nextSession;
  await updateActiveTravelSceneOverlayContext({ session: nextSession }, { render: true });
  await updateActiveTravelEventRunnerSession(nextSession, { statusMessage: "Dev finalized current Travel v2 round." });
  if (activeRunner && activeRunner.session !== nextSession) activeRunner.session = nextSession;
  await queueTravelPlayerMissionBoardRefreshToPlayers(nextSession, { actor: activeOverlay?.actor });
  const consequenceFlow = inspectTravelV2ConsequenceFlowForSession(nextSession, { actor: activeOverlay?.actor });
  readiness = inspectTravelV2RoundResolutionReadiness(nextSession, { actor: activeOverlay?.actor, playerSafeState: prepareTravelPlayerMissionBoardStateForPlayers(nextSession, { actor: activeOverlay?.actor }) });
  return { ok: true, errors: [], warnings, sessionKey: nextSession.key ?? "", currentRoundIndex: Number(nextSession.currentRoundIndex ?? 0), roundOutcomeKey: consequenceFlow.roundOutcomeKey, roundOutcomeLabel: consequenceFlow.roundOutcomeLabel, pendingConsequenceCount: consequenceFlow.pendingConsequenceCount, readiness, consequenceFlow };
}

async function forceTravelRoundResolved(input = {}) {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["forceTravelRoundResolved is GM-only."], warnings: [], sessionKey: "", currentRoundIndex: -1, resolvedStationCount: 0, activeStationCount: 0, results: {}, readiness: null };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [], sessionKey: "", currentRoundIndex: -1, resolvedStationCount: 0, activeStationCount: 0, results: {}, readiness: null };
  const { activeOverlay, activeRunner, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session. Open or start a Travel Event Runner first."], warnings: [], sessionKey: "", currentRoundIndex: -1, resolvedStationCount: 0, activeStationCount: 0, results: {}, readiness: null };
  const result = forceTravelV2RoundResolved(session, input, { actor: activeOverlay?.actor });
  if (result.session) {
    if (activeOverlay) activeOverlay.session = result.session;
    await updateActiveTravelSceneOverlayContext({ session: result.session }, { render: true });
    await updateActiveTravelEventRunnerSession(result.session, { statusMessage: result.ok ? "Dev forced Travel round stations resolved." : "Dev force Travel round reported blockers." });
    if (activeRunner && activeRunner.session !== result.session) activeRunner.session = result.session;
    for (const stationKey of Object.keys(result.results ?? {})) {
      sendTravelPlayerMissionBoardStationUpdateToPlayers(result.session, stationKey, { actor: activeOverlay?.actor });
      sendTravelPlayerStationCardToPlayers(result.session, stationKey, { actor: activeOverlay?.actor });
    }
  }
  const { session: _session, ...compact } = result;
  return compact;
}

function getTravelPlayerFlowStationReport(session, activeOverlay = null) {
  const currentRoundIndex = Number(session?.currentRoundIndex ?? 0);
  const state = prepareTravelSceneOverlayState(session, { actor: activeOverlay?.actor });
  const permissionState = prepareTravelPlayerMissionBoardStateForPlayers(session, { actor: activeOverlay?.actor });
  const permissionStations = new Map((permissionState?.stations ?? []).map((station) => [station.stationKey, station]));
  const userNamesById = new Map((globalThis.game?.users ?? []).map((user) => [user.id, user.name ?? user.id]));
  const prompts = session?.reactionPrompts?.records ?? [];
  return (state.stations ?? []).filter((station) => station.isActive !== false).map((station) => {
    const records = prompts.filter((record) => record.stationKey === station.stationKey && Number(record.roundIndex) === currentRoundIndex);
    const pendingRecord = records.find((record) => record.status === "pending") ?? null;
    const acceptedRecord = records.find((record) => record.status === "accepted") ?? null;
    const rerollRecord = records.find((record) => Boolean(record.rerollResult) || record.status === "resolved") ?? null;
    const permissionStation = permissionStations.get(station.stationKey) ?? {};
    const permittedUserIds = Array.isArray(permissionStation.permittedUserIds) ? permissionStation.permittedUserIds : [];
    return {
      stationKey: station.stationKey,
      stationName: station.stationName ?? station.label ?? station.stationKey,
      hasAssignment: station.hasAssignment === true,
      hasSelectedApproach: station.hasSelectedApproach === true,
      hasResult: station.hasResult === true,
      result: station.result || "",
      resultLabel: station.hasResult === true ? (station.resultLabel || "") : "",
      canRoll: station.canRollStationCheck === true && station.hasResult !== true,
      rollUnavailableReason: station.hasResult === true ? "This station already has a result." : (station.rollUnavailableReason || ""),
      reactionPromptPending: Boolean(pendingRecord),
      reactionPromptId: pendingRecord?.reactionPromptId ?? acceptedRecord?.reactionPromptId ?? rerollRecord?.reactionPromptId ?? "",
      focusAccepted: Boolean(acceptedRecord || station.focusReactionAccepted === true),
      rerollNeeded: station.focusRerollNeeded === true || Boolean(acceptedRecord && !acceptedRecord.rerollResult),
      rerollResolved: station.focusRerollResolved === true || Boolean(rerollRecord),
      rerollResult: rerollRecord?.rerollResult || "",
      permittedUserIds,
      permittedUserNames: permittedUserIds.map((id) => userNamesById.get(id) ?? id)
    };
  });
}

async function inspectTravelPlayerFlow() {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["inspectTravelPlayerFlow is GM-only."] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."] };
  const { activeOverlay, session, errors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: errors?.length ? errors : ["No active local Travel v2 runner session."] };
  return { ok: true, errors: [], sessionKey: session.key ?? "", currentRoundIndex: Number(session.currentRoundIndex ?? 0), activeStations: getTravelPlayerFlowStationReport(session, activeOverlay) };
}

async function validateTravelPlayerFlow() {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["validateTravelPlayerFlow is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session."], warnings: [], sessionKey: "", currentRoundIndex: -1, stationCount: 0, activeStationCount: 0, pendingReactionCount: 0, acceptedFocusCount: 0, rerollNeededCount: 0, rerollResolvedCount: 0, duplicateRollGuardPresent: true, playerSafetyNotes: [] };
  const currentRoundIndex = Number(session.currentRoundIndex ?? 0);
  const stationReports = getTravelPlayerFlowStationReport(session, activeOverlay);
  const prompts = session.reactionPrompts?.records ?? [];
  const errors = [];
  const warnings = [];
  for (const record of prompts) {
    if (!record.stationKey) errors.push(`Reaction prompt ${record.reactionPromptId || "(missing id)"} is missing a station key.`);
    if (Number(record.roundIndex) !== currentRoundIndex) warnings.push(`Reaction prompt ${record.reactionPromptId || "(missing id)"} belongs to round ${record.roundIndex}, not active round ${currentRoundIndex}.`);
  }
  for (const station of stationReports) {
    if (station.focusAccepted && !station.rerollNeeded && !station.rerollResolved) errors.push(`${station.stationKey} has accepted Focus without reroll-needed or reroll-resolved state.`);
    if (station.rerollResolved && station.reactionPromptPending) errors.push(`${station.stationKey} has a resolved reroll while a reaction prompt is still pending.`);
    if (station.hasResult && station.canRoll && !station.rerollNeeded) errors.push(`${station.stationKey} has a result but is still rollable outside an accepted reroll path.`);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sessionKey: session.key ?? "",
    currentRoundIndex,
    stationCount: stationReports.length,
    activeStationCount: stationReports.length,
    pendingReactionCount: stationReports.filter((station) => station.reactionPromptPending).length,
    acceptedFocusCount: stationReports.filter((station) => station.focusAccepted).length,
    rerollNeededCount: stationReports.filter((station) => station.rerollNeeded).length,
    rerollResolvedCount: stationReports.filter((station) => station.rerollResolved).length,
    duplicateRollGuardPresent: true,
    playerSafetyNotes: ["Uses player mission-board permission state only for permitted users.", "Does not include consequence queues, unrevealed hazard internals, or ship scar internals."]
  };
}

async function inspectTravelRoundResolution() {
  if (globalThis.game?.user?.isGM !== true) return { ok: false, errors: ["inspectTravelRoundResolution is GM-only."], warnings: [] };
  if (isTravelV2DevToolsEnabled() !== true) return { ok: false, errors: ["Travel v2 dev tools must be enabled."], warnings: [] };
  const { activeOverlay, session, errors: contextErrors } = getActiveLocalTravelRunnerContext();
  if (!session) return { ok: false, errors: contextErrors?.length ? contextErrors : ["No active local Travel v2 runner session."], warnings: [] };
  const playerSafeState = prepareTravelPlayerMissionBoardStateForPlayers(session, { actor: activeOverlay?.actor });
  return inspectTravelV2RoundResolutionReadiness(session, { actor: activeOverlay?.actor, playerSafeState });
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
    TRAVEL_MISSION_BOARD_BROADCAST_DEBUG_SETTING,
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
    inspectTravelV2RoundResolutionReadiness,
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
    persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary,
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
    TRAVEL_V2_PENDING_STATION_BENEFIT_QUEUE_VERSION,
    normalizeTravelV2PendingStationBenefitQueueInput,
    prepareTravelV2PendingStationBenefitQueueItems,
    prepareTravelV2PendingStationBenefitPlayerState,
    prepareTravelV2PendingStationBenefitGmState,
    applyTravelV2PendingStationBenefitQueueToRenderState,
    TRAVEL_V2_STATION_BENEFIT_USE_REVIEW_VERSION,
    normalizeTravelV2StationBenefitUseReviewInput,
    prepareTravelV2StationBenefitDisplayRows,
    prepareTravelV2StationBenefitUseReviewPlayerState,
    prepareTravelV2StationBenefitUseReviewGmState,
    applyTravelV2StationBenefitUseReviewToRenderState,
    devTools: createArcflightDevTools(),
    dev: {
      runFoundryChecks,
      runPlayerSafetyCheck,
      validateTravelV2CardSchemaPack: validateTravelV2CardSchemaImportPayload,
      prepareTravelV2CardSchemaImportPreview,
      forceTravelStationResult,
      inspectTravelPlayerFlow,
      validateTravelPlayerFlow,
      inspectTravelRoundResolution,
      inspectTravelConsequenceFlow,
      inspectTravelConsequenceApplicationFlow,
      inspectTravelGmUiFlow,
      inspectTravelAdvanceRoundFlow,
      inspectTravelEventCompletionFlow,
      forceTravelRoundResolved,
      forceTravelRoundFinalized,
      forceTravelConsequenceApplied,
      forceTravelRoundAdvanced,
      forceTravelEventCompleted
    },
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
  const { activeOverlay, session, requestedSessionKey, matched } = getActiveTravelRunnerSessionForPayload(payload);
  const roundIndex = Number(payload.roundIndex);
  const stationKey = typeof payload.stationKey === "string" ? payload.stationKey : "";
  const legacySkill = typeof payload.skill === "string" ? payload.skill : "";
  const optionKey = typeof payload.optionKey === "string" && payload.optionKey
    ? payload.optionKey
    : (legacySkill ? `eventApproach:${legacySkill}` : "");
  console.debug("Arcflight | Player Station Order commit received by GM.", { payload });
  if (!session || !Number.isInteger(roundIndex) || !stationKey || !optionKey || !matched) {
    if (requestedSessionKey && !matched) console.warn("Arcflight | Player station approach submission did not match an active Travel v2 runner session.", { requestedSessionKey, activeSessionKey: session?.key ?? "" });
    else console.warn("Arcflight | Player station approach submission could not be applied.", { payload, hasSession: Boolean(session) });
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

function getActiveTravelRunnerSessionForPayload(payload = {}) {
  const activeOverlay = getActiveTravelSceneOverlay();
  const activeRunner = getActiveTravelEventRunner();
  const requestedSessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey.trim() : "";
  const candidates = [activeOverlay?.session, activeRunner?.session].filter(Boolean);
  if (requestedSessionKey) {
    const matched = candidates.find((candidate) => normalizeTravelEventRunnerSession(candidate).session?.key === requestedSessionKey) ?? null;
    if (matched) return { activeOverlay, activeRunner, session: normalizeTravelEventRunnerSession(matched).session, requestedSessionKey, matched: true };
  }
  const session = candidates[0] ? normalizeTravelEventRunnerSession(candidates[0]).session : null;
  return { activeOverlay, activeRunner, session, requestedSessionKey, matched: !requestedSessionKey || session?.key === requestedSessionKey };
}

async function handleTravelPlayerStationRoll(payload = {}) {
  const { activeOverlay, session, requestedSessionKey, matched } = getActiveTravelRunnerSessionForPayload(payload);
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
  if (!session || !Number.isInteger(roundIndex) || !stationKey || !matched) {
    if (requestedSessionKey && !matched) console.warn("Arcflight | Player roll request did not match an active Travel v2 runner session.", { requestedSessionKey, activeSessionKey: session?.key ?? "" });
    return false;
  }
  const preflightState = prepareTravelSceneOverlayState(session, { actor: activeOverlay?.actor });
  const preflightStation = (preflightState.stations ?? []).find((candidate) => candidate.stationKey === stationKey);
  if (preflightStation?.hasResult === true) {
    const reason = "This station already has a result. A new roll is only available after an accepted Focus reroll clears the result.";
    console.warn("Arcflight | Duplicate player station roll request rejected.", { sessionKey: session?.key ?? "", roundIndex, stationKey, userId: payload.userId ?? "", reason });
    ui.notifications?.warn?.(reason);
    sendTravelPlayerMissionBoardStationUpdateToPlayers(session, stationKey, { actor: activeOverlay?.actor });
    sendTravelPlayerStationCardToPlayers(session, stationKey, { actor: activeOverlay?.actor });
    return false;
  }
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
  const { activeOverlay, session, requestedSessionKey, matched } = getActiveTravelRunnerSessionForPayload(payload);
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
  if (!session || !record || !matched) {
    if (requestedSessionKey && !matched) console.warn("Arcflight | Player reaction response did not match an active Travel v2 runner session.", { requestedSessionKey, activeSessionKey: session?.key ?? "" });
    return false;
  }
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

  game.settings.register(ARCFLIGHT.MODULE_ID, TRAVEL_MISSION_BOARD_BROADCAST_DEBUG_SETTING, {
    name: "Debug Travel Mission Board Broadcasts",
    hint: "Log debounced Travel mission board refresh broadcast results to the browser console. Disable during normal play and smoke tests.",
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
  TRAVEL_MISSION_BOARD_BROADCAST_DEBUG_SETTING,
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
  inspectTravelV2RoundResolutionReadiness,
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
  persistCommittedTravelV2RoundActionOrderToRunnerSessionLibrary,
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
