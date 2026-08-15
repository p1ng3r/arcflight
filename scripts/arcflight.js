import { ARCFLIGHT } from "./config/constants.js";
import { createArcflightDevTools } from "./dev/dev-tools.js";
import { runFrameworkSmokeTest } from "./dev/framework-smoke-test.js";
import { createVoyageEncounterState, normalizeVoyageEncounterState } from "./voyage/domain/state.js";
import { validateVoyageEncounterState } from "./voyage/domain/validation.js";
import { applyVoyageEncounterStationActionSelection, validateVoyageEncounterStationSelections } from "./voyage/domain/station-selection.js";
import { validateVoyageEncounterActivationReadiness } from "./voyage/domain/activation-readiness.js";
import { validateVoyageEncounterActivationStart } from "./voyage/domain/activation-start-readiness.js";
import { createVoyageEncounterBoundarySnapshot } from "./voyage/domain/boundary-snapshots.js";
import { applyVoyageEncounterActivation } from "./voyage/domain/activation-application.js";
import { applyVoyageEncounterCrewPlanningTransition } from "./voyage/domain/crew-planning-transition.js";
import { applyContextPreservingVoyageLifecycleTransition } from "./voyage/domain/lifecycle-application.js";
import { applyVoyageEncounterReadyTransition } from "./voyage/domain/readiness-application.js";
import {
  getAllowedVoyageLifecycleTransitions,
  getVoyageLifecycleTransitionPolicy,
  isLegalVoyageLifecycleTransition,
  validateVoyageLifecycleTransition
} from "./voyage/domain/lifecycle.js";
import {
  getAllowedVoyagePhaseTransitions,
  getVoyagePhaseTransitionPolicy,
  isLegalVoyagePhaseTransition,
  validateVoyagePhaseTransition
} from "./voyage/domain/phase.js";
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
import {
  CORE_STATION_ACTION_KEYS,
  CORE_STATION_ACTIONS,
  getCoreStationAction,
  getCoreStationActionKeys,
  getCoreStationActions,
  getCoreStationActionsForStation
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
  getArcflightShipData,
  getShipRefitPressure,
  getShipRefitStatus,
  getShipTierState,
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
  updateShipTierState,
  setArkenginePattern,
  setHullPattern
} from "./documents/ships.js";
import { registerArcflightSheets } from "./sheets/registration.js";
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
import { launchVoyageEventSession as launchVoyageEventSessionInternal, listVoyageEventLaunchShips, normalizeVoyageEventOperatorSelections, buildVoyageEventManagerDashboardModel } from "./voyage/foundry/event-launcher.js";
import { getM12EventDefinition, M12_EVENT_ID, M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_PRESENTATION, M12_FOCUS_ABILITIES } from "./voyage/m12/event-definition.js";
import { getFoundrySessionMutationCoordinator } from "./voyage/foundry/session-coordinator.js";
import { abortVoyageEventSession, applyVoyageEncounterAbortTransition, authorizeVoyageEventSessionOperator, beginVoyageEventSessionResolution, correctVoyageEventSession, dispatchVoyageEventSessionCommand, readVoyageEventSessionMultiplayerProjection, readVoyageEventSessionPlanning, readVoyageEventSessionProjection, readVoyageEventSessionResolution, resolveVoyageEventSessionStation } from "./voyage/foundry/event-session-runtime.js";
import { executeVoyagePf2ePendingCheckInFoundry } from "./voyage/pf2e/runtime-execution.js";
import { getInstallValidationWarnings, previewComponentInstall, previewInstallValidation, shouldBlockInstall } from "./helpers/install-validation-preview.js";

function trustedFoundryUsers() {
  try {
    const source = globalThis.game?.users;
    const users = Array.isArray(source) ? source : source?.contents;
    if (!Array.isArray(users)) return [];
    return users.map((user) => ({ id: user?.id, isGM: user?.isGM, active: user?.active }));
  } catch {
    return [];
  }
}

function trustedOwnedVoyageOperators(userId) {
  try {
    const users = globalThis.game?.users;
    const user = typeof users?.get === "function" ? users.get(userId) : (Array.isArray(users) ? users.find((entry) => entry?.id === userId) : null);
    if (!user) return null;
    const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    const documents = [];
    // M12 station operators are currently canonical Actor identities. Item
    // ownership is not an operator authority source in this slice.
    for (const collection of [globalThis.game?.actors]) {
      const values = Array.isArray(collection) ? collection : collection?.contents;
      if (Array.isArray(values)) documents.push(...values);
    }
    const result = [];
    for (const document of documents) {
      const permission = typeof document?.testUserPermission === "function"
        ? (document.testUserPermission(user, "OWNER") === true || document.testUserPermission(user, ownerLevel) === true)
        : (typeof document?.permission?.[userId] === "number" && document.permission[userId] >= ownerLevel);
      if (permission !== true) continue;
      const identity = { kind: "actor", id: document?.id ?? null, uuid: document?.uuid ?? null, name: document?.name ?? "" };
      if (typeof identity.id === "string" && identity.id.length > 0 && typeof identity.uuid === "string" && identity.uuid.length > 0) result.push(identity);
    }
    return result;
  } catch {
    return null;
  }
}

function trustedLaunchContext() {
  const connectionId = globalThis.game?.socket?.id ?? null;
  return {
    authenticatedUserId: globalThis.game?.user?.id ?? null,
    authenticatedConnectionId: connectionId,
    trustedTransportContext: typeof connectionId === "string" && connectionId.length > 0,
    activeGmUserId: globalThis.game?.users?.activeGM?.id ?? null,
    users: trustedFoundryUsers(),
    actors: globalThis.game?.actors,
    journalEntries: globalThis.game?.journal,
    JournalEntry: globalThis.JournalEntry,
    isJournalEntryDocument: (document) => document?.documentName === "JournalEntry" || document?.constructor?.name === "JournalEntry",
    createDocumentId: () => globalThis.foundry?.utils?.randomID?.(),
    resolveEventDefinitionSnapshot: (eventId, definitionSnapshotId) => getM12EventDefinition(eventId, definitionSnapshotId),
    resolveVoyageOperatorForPrincipal: (userId) => trustedOwnedVoyageOperators(userId),
    focusAbilities: M12_FOCUS_ABILITIES,
    runExclusiveSessionMutation: getFoundrySessionMutationCoordinator(globalThis.game),
    executeVoyagePf2ePendingCheck: (pendingCheck) => executeVoyagePf2ePendingCheckInFoundry(pendingCheck, globalThis),
    applyVoyageEncounterAbortTransition
  };
}

async function launchVoyageEventSessionFromPublicBoundary(request) {
  return launchVoyageEventSessionInternal(request, trustedLaunchContext());
}

function dispatchVoyageEventSessionCommandFromPublicBoundary(request) {
  return dispatchVoyageEventSessionCommand(request, trustedLaunchContext());
}

function readVoyageEventSessionPlanningFromPublicBoundary(sessionId) {
  return readVoyageEventSessionPlanning(sessionId, trustedLaunchContext());
}
function readVoyageEventSessionProjectionFromPublicBoundary(request) {
  return readVoyageEventSessionProjection(request, trustedLaunchContext());
}
function readVoyageEventSessionMultiplayerProjectionFromPublicBoundary(request) {
  return readVoyageEventSessionMultiplayerProjection(request, trustedLaunchContext());
}

function discoverVoyageEventSessionFromPublicBoundary() {
  try {
    const source = globalThis.game?.journal;
    const entries = typeof source?.values === "function" ? [...source.values()] : (Array.isArray(source) ? source : source?.contents ?? []);
    const candidates = [];
    for (const entry of entries) {
      const session = entry?.flags?.arcflight?.system?.voyageSession ?? entry?.toObject?.()?.flags?.arcflight?.system?.voyageSession;
      if (!session || typeof session.sessionId !== "string" || !Number.isSafeInteger(session.revision)) continue;
      const projection = readVoyageEventSessionMultiplayerProjection({
        kind: "voyage.m12-read-multiplayer-projection",
        requestId: `m12-discover-${session.sessionId}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
        sessionId: session.sessionId,
        expectedRevision: session.revision
      }, trustedLaunchContext());
      if (projection?.ok && !["completed", "aborted", "recovery-required"].includes(projection.projection?.sessionState)) {
        candidates.push({ sessionId: projection.projection.sessionId, revision: projection.projection.revision });
      }
    }
    return candidates.length === 1 ? candidates[0] : null;
  } catch {
    return null;
  }
}
function authorizeVoyageEventSessionOperatorFromPublicBoundary(request) {
  return authorizeVoyageEventSessionOperator(request, trustedLaunchContext());
}
function readVoyageEventSessionResolutionFromPublicBoundary(sessionId) {
  return readVoyageEventSessionResolution(sessionId, trustedLaunchContext());
}
function resolveVoyageEventSessionStationFromPublicBoundary(request) {
  return resolveVoyageEventSessionStation(request, trustedLaunchContext());
}
function beginVoyageEventSessionResolutionFromPublicBoundary(request) {
  return beginVoyageEventSessionResolution(request, trustedLaunchContext());
}
function abortVoyageEventSessionFromPublicBoundary(request) {
  return abortVoyageEventSession(request, trustedLaunchContext());
}
function correctVoyageEventSessionFromPublicBoundary(request) {
  return correctVoyageEventSession(request, trustedLaunchContext());
}
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

Hooks.once("init", () => {
  console.log("Arcflight | Initializing module");

  CONFIG.arcflight = Object.freeze({
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
    createVoyageEncounterState,
    normalizeVoyageEncounterState,
    validateVoyageEncounterState,
    launchVoyageEventSession: launchVoyageEventSessionFromPublicBoundary,
    dispatchVoyageEventSessionCommand: dispatchVoyageEventSessionCommandFromPublicBoundary,
    readVoyageEventSessionProjection: readVoyageEventSessionProjectionFromPublicBoundary,
    readVoyageEventSessionMultiplayerProjection: readVoyageEventSessionMultiplayerProjectionFromPublicBoundary,
    discoverVoyageEventSession: discoverVoyageEventSessionFromPublicBoundary,
    authorizeVoyageEventSessionOperator: authorizeVoyageEventSessionOperatorFromPublicBoundary,
    readVoyageEventSessionPlanning: readVoyageEventSessionPlanningFromPublicBoundary,
    readVoyageEventSessionResolution: readVoyageEventSessionResolutionFromPublicBoundary,
    beginVoyageEventSessionResolution: beginVoyageEventSessionResolutionFromPublicBoundary,
    resolveVoyageEventSessionStation: resolveVoyageEventSessionStationFromPublicBoundary,
    abortVoyageEventSession: abortVoyageEventSessionFromPublicBoundary,
    correctVoyageEventSession: correctVoyageEventSessionFromPublicBoundary,
    listVoyageEventLaunchShips,
    normalizeVoyageEventOperatorSelections,
    buildVoyageEventManagerDashboardModel,
    m12EventId: M12_EVENT_ID,
    m12DefinitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID,
    m12EventPresentation: M12_EVENT_PRESENTATION,
    getM12EventDefinition,
    openEventManager: async () => {
      const { openArcflightEventManager } = await import("./voyage/apps/event-manager.js");
      return openArcflightEventManager();
    },
    openPlayerEvent: async () => {
      const { openVoyagePlayerEvent } = await import("./voyage/apps/player-event.js");
      return openVoyagePlayerEvent();
    },
    validateVoyageEncounterStationSelections,
    applyVoyageEncounterStationActionSelection,
    validateVoyageEncounterActivationReadiness,
    validateVoyageEncounterActivationStart,
    createVoyageEncounterBoundarySnapshot,
    applyVoyageEncounterActivation,
    applyVoyageEncounterCrewPlanningTransition,
    applyContextPreservingVoyageLifecycleTransition,
    applyVoyageEncounterReadyTransition,
    getAllowedVoyageLifecycleTransitions,
    isLegalVoyageLifecycleTransition,
    validateVoyageLifecycleTransition,
    getVoyageLifecycleTransitionPolicy,
    getAllowedVoyagePhaseTransitions,
    isLegalVoyagePhaseTransition,
    validateVoyagePhaseTransition,
    getVoyagePhaseTransitionPolicy,
    devTools: createArcflightDevTools({
      createVoyageEncounterState,
      normalizeVoyageEncounterState,
      validateVoyageEncounterState,
      validateVoyageEncounterStationSelections,
      applyVoyageEncounterStationActionSelection,
      validateVoyageEncounterActivationReadiness,
      validateVoyageEncounterActivationStart,
      createVoyageEncounterBoundarySnapshot,
      applyVoyageEncounterActivation,
      applyVoyageEncounterCrewPlanningTransition,
      applyContextPreservingVoyageLifecycleTransition,
      applyVoyageEncounterReadyTransition,
      getAllowedVoyageLifecycleTransitions,
      isLegalVoyageLifecycleTransition,
      validateVoyageLifecycleTransition,
      getVoyageLifecycleTransitionPolicy,
      getAllowedVoyagePhaseTransitions,
      isLegalVoyagePhaseTransition,
      validateVoyagePhaseTransition,
      getVoyagePhaseTransitionPolicy
    })
  });

  game.arcflight = CONFIG.arcflight;

  registerArcflightSheets().catch((error) => {
    console.warn("Arcflight | Sheet registration failed; continuing startup.", error);
  });
});

export {
  ARCFLIGHT,
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
  createVoyageEncounterState,
  normalizeVoyageEncounterState,
  launchVoyageEventSessionFromPublicBoundary as launchVoyageEventSession,
  dispatchVoyageEventSessionCommandFromPublicBoundary as dispatchVoyageEventSessionCommand,
  readVoyageEventSessionProjectionFromPublicBoundary as readVoyageEventSessionProjection,
  readVoyageEventSessionMultiplayerProjectionFromPublicBoundary as readVoyageEventSessionMultiplayerProjection,
  discoverVoyageEventSessionFromPublicBoundary as discoverVoyageEventSession,
  authorizeVoyageEventSessionOperatorFromPublicBoundary as authorizeVoyageEventSessionOperator,
  readVoyageEventSessionPlanningFromPublicBoundary as readVoyageEventSessionPlanning,
  readVoyageEventSessionResolutionFromPublicBoundary as readVoyageEventSessionResolution,
  beginVoyageEventSessionResolutionFromPublicBoundary as beginVoyageEventSessionResolution,
  resolveVoyageEventSessionStationFromPublicBoundary as resolveVoyageEventSessionStation,
  abortVoyageEventSessionFromPublicBoundary as abortVoyageEventSession,
  correctVoyageEventSessionFromPublicBoundary as correctVoyageEventSession,
  listVoyageEventLaunchShips,
  normalizeVoyageEventOperatorSelections,
  buildVoyageEventManagerDashboardModel,
  getM12EventDefinition,
  M12_EVENT_ID,
  M12_DEFINITION_SNAPSHOT_ID,
  M12_EVENT_PRESENTATION,
  validateVoyageEncounterState,
  validateVoyageEncounterStationSelections,
  applyVoyageEncounterStationActionSelection,
  validateVoyageEncounterActivationReadiness,
  validateVoyageEncounterActivationStart,
  createVoyageEncounterBoundarySnapshot,
  applyVoyageEncounterActivation,
  applyVoyageEncounterCrewPlanningTransition,
  applyContextPreservingVoyageLifecycleTransition,
  applyVoyageEncounterReadyTransition,
  getAllowedVoyageLifecycleTransitions,
  isLegalVoyageLifecycleTransition,
  validateVoyageLifecycleTransition,
  getVoyageLifecycleTransitionPolicy,
  getAllowedVoyagePhaseTransitions,
  isLegalVoyagePhaseTransition,
  validateVoyagePhaseTransition,
  getVoyagePhaseTransitionPolicy,
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
  getDefaultArcflightComponentData,
  arcflightComponentDefaults,
  ARCFLIGHT_SHIP_ACTOR_TYPE,
  arcflightShipDefaults,
  getArcflightShipData,
  getDefaultArcflightShipData
};
