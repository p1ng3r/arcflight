import {
  ArcflightTravelEventBuilder,
  openTravelEventBuilder,
  prepareTravelEventBuilderShellState
} from "../apps/travel-event-builder.js";
import {
  ArcflightTravelEventRunner,
  formatStatisticOptionLabel,
  getResolvedPf2eStatisticModifier,
  openTravelEventRunner,
  prepareSelectedTravelEventLibraryDetails,
  prepareTravelEventLibraryOptions,
  prepareTravelEventNarrativeLog,
  resolveTravelStationAssignedActor
} from "../apps/travel-event-runner.js";
import {
  advanceTravelEventRunnerRound,
  completeTravelEventRunnerSession,
  createTravelEventRunnerSession,
  exportTravelEventRunnerSessionToJson,
  prepareTravelEventRunnerSummaryReport,
  renderTravelEventRunnerSummaryMarkdown,
  renderTravelEventRunnerSummaryHtml,
  postTravelEventRunnerSummaryToChat,
  createTravelEventRunnerSummaryJournalEntry,
  prepareTravelEventRunnerSummaryOutputState,
  prepareTravelEventStagedEffectReview,
  prepareTravelEventEffectApplicationState,
  applyTravelEventRunnerSelectedEffects,
  applyTravelEventRunnerResourceEffect,
  getTravelEventAppliedEffectRecords,
  isTravelEventEffectApplied,
  normalizeTravelEventProposedEffectForReview,
  prepareTravelEventResourceEffectPreview,
  renderTravelEventStagedEffectReviewMarkdown,
  renderTravelEventStagedEffectReviewHtml,
  TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING,
  cloneTravelEventRunnerSession,
  deleteTravelEventRunnerSessionFromLibrary,
  duplicateTravelEventRunnerSession,
  getTravelEventRunnerSessionLibrary,
  loadTravelEventRunnerSessionFromLibrary,
  prepareTravelEventRunnerSessionLibraryState,
  prepareTravelEventRunnerState,
  retreatTravelEventRunnerRound,
  saveTravelEventRunnerSessionToLibrary,
  setTravelEventRunnerStationResult
} from "../helpers/travel-event-runner.js";
import { ARCFLIGHT, ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import {
  createCoreArkengine,
  createCoreArkengineMod,
  createCoreCrewAsset,
  createCoreHull,
  createCoreRoom,
  createCoreShipUpgrade,
  createCoreWeapon
} from "../documents/creation.js";
import {
  addCrewAsset,
  assignStation,
  clearCrewRoster,
  clearInstalledArkengineMods,
  clearInstalledRooms,
  clearInstalledShipUpgrades,
  clearShipBuild,
  clearStationAssignment,
  clearStationAssignments,
  getArcflightShipData,
  getDefaultArcflightShipFlags,
  installArkengine,
  installArkengineMod,
  installHull,
  installRoom,
  installShipUpgrade,
  installWeapon,
  recalculateShipStats,
  removeCrewAsset,
  removeInstalledArkengineMod,
  removeInstalledRoom,
  removeInstalledShipUpgrade,
  removeInstalledWeapon,
  updateShipTierState,
  calculateRefitPressure,
  getShipActionEconomy,
  getShipTravelResources,
  getTravelStationKeys,
  getShipRefitPressure,
  getShipRefitStatus,
  getShipTierState,
  isTravelStationKey,
  previewShipTravelResourceChange,
  canSpendShipActionPoints,
  resetShipActionEconomy,
  spendShipActionPoints,
  updateShipTravelResources
} from "../documents/ships.js";
import { CORE_HULL_PLATFORM_KEYS, CORE_HULLS } from "../../data/hulls/core-hulls.js";
import { CORE_ARKENGINE_KEYS } from "../../data/arkengines/core-arkengines.js";
import { CORE_ARKENGINE_MOD_KEYS } from "../../data/arkengine-mods/core-arkengine-mods.js";
import { CORE_ROOM_KEYS } from "../../data/rooms/core-rooms.js";
import { CORE_SHIP_UPGRADE_KEYS } from "../../data/ship-upgrades/core-ship-upgrades.js";
import { CORE_CREW_ASSET_KEYS } from "../../data/crew/core-crew-assets.js";
import { CORE_WEAPON_KEYS, CORE_WEAPONS } from "../../data/weapons/core-weapons.js";
import { CORE_STATIONS, STATION_KEYS } from "../../data/stations/core-stations.js";
import { CORE_TRAVEL_EVENT_KEYS, getCoreTravelEvent } from "../../data/travel-events/core-travel-events.js";
import {
  CORE_STATION_ACTION_KEYS,
  CORE_STATION_ACTIONS,
  getCoreStationAction,
  getCoreStationActionKeys,
  getCoreStationActions,
  getCoreStationActionsForStation,
  getStationActionOutcome,
  getStationActionRollOptions,
  previewStationActionOutcome
} from "../../data/station-actions/core-station-actions.js";
import { findMissingCoreArcflightItems, syncCoreArcflightItems } from "../helpers/core-item-sync.js";
import { getComponentRefitPressure, getComponentTierMetadata } from "../documents/components.js";
import { getInstallValidationWarnings, previewComponentInstall, previewInstallValidation, shouldBlockInstall } from "../helpers/install-validation-preview.js";
import {
  getTravelFiveStationKeys,
  getTravelDegreeContribution,
  getTravelRoundOutcome,
  getTravelEventOutcome,
  validateTravelEventDefinition
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
  PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING,
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
  saveTravelEventBuilderDraftToLibrary,
  loadTravelEventBuilderDraftFromLibrary,
  deleteTravelEventBuilderDraftFromLibrary,
  duplicateTravelEventBuilderLibraryDraft,
  prepareTravelEventBuilderLibraryState
} from "../helpers/travel-event-builder.js";
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
import { clearStationActionHistory, executeStationAction, getStationActionState, previewStationAction, previewStationActionRoll, rollStationAction } from "../helpers/station-action-execution.js";
import { getPf2eStatisticCandidateKeys, normalizePf2eStatisticKey, resolvePf2eActorStatistic } from "../helpers/pf2e-statistics.js";
import { prepareInstallUiState, prepareStationActionHistoryReadout, prepareStationActionUiState, prepareStationRows, prepareTravelRunnerReadout } from "../sheets/ship-sheet.js";
import {
  backfillInstallStateForAllShips,
  backfillInstallStateForShip,
  deactivateInstallRecord,
  deactivateInstallRecordsByComponent,
  findInstallRecord,
  findShipsMissingInstallState,
  getActiveInstallRecords,
  getInactiveInstallRecords,
  getInstalledComponents,
  getInstallState,
  normalizeInstallState,
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
  prepareTravelEventBuilderExportPreview
} from "../helpers/travel-event-builder-io.js";

const SMOKE_TEST_ACTOR_NAME = "Arcflight Smoke Test Ship";
const SMOKE_TEST_FLAG = "frameworkSmokeTestHelper";

const cloneSmokeData = (value) => globalThis.foundry?.utils?.deepClone?.(value) ?? JSON.parse(JSON.stringify(value));

const EXPECTED_CORE_TRAVEL_EVENT_KEYS = Object.freeze([
  "black-tide-crossing",
  "derelict-lantern-wreck",
  "crew-fever-in-the-lifeveil",
  "false-beacon-ambush",
  "portside-diplomatic-snare"
]);

const EXPECTED_CORE_TRAVEL_EVENT_ROUND_COUNTS = Object.freeze({
  "black-tide-crossing": 5,
  "derelict-lantern-wreck": 4,
  "crew-fever-in-the-lifeveil": 4,
  "false-beacon-ambush": 4,
  "portside-diplomatic-snare": 4
});

const EXPECTED_CORE_HULL_PLATFORM_KEYS = Object.freeze([
  "void-skiff",
  "sloop",
  "cutter",
  "brigantine",
  "frigate",
  "galleon",
  "hammerhead",
  "arkcruiser",
  "dread-caravel",
  "cathedral-ship",
  "leviathan-class-platform"
]);

function hasClassification(hull = {}) {
  return Number.isInteger(hull.classification?.baseTier)
    && typeof hull.classification?.tierLabel === "string"
    && typeof hull.classification?.canBeRefitAboveBaseTier === "boolean"
    && Number.isInteger(hull.classification?.maximumRefitTier);
}

function hasRefitTolerance(hull = {}) {
  return [
    "weaponPressure",
    "enginePressure",
    "infrastructurePressure",
    "lifeveilPressure",
    "crewCommandPressure",
    "occultPressure",
    "totalBeforeMajorRefitRequired"
  ].every((key) => Number.isFinite(hull.refitTolerance?.[key]));
}

function hasArkengineCompatibility(hull = {}) {
  return typeof hull.arkengineCompatibility?.preferred === "string"
    && Array.isArray(hull.arkengineCompatibility?.allowed)
    && hull.arkengineCompatibility.allowed.includes(hull.arkengineCompatibility.preferred);
}

function check(result, name, passed, expected, actual, message = "") {
  const entry = { name, passed: Boolean(passed), expected, actual, message };
  result.checks.push(entry);
  return entry.passed;
}

function checkEqual(result, name, expected, actual, message = "") {
  return check(result, name, actual === expected, expected, actual, message);
}

function summarize(result) {
  result.passed = result.checks.every((entry) => entry.passed);

  const rows = result.checks.map((entry) => ({
    check: entry.name,
    passed: entry.passed,
    expected: entry.expected,
    actual: entry.actual,
    message: entry.message
  }));

  console.group(`Arcflight | Framework smoke test ${result.passed ? "PASSED" : "FAILED"}`);
  console.table(rows);
  console.log("Arcflight | Framework smoke test result", result);
  console.groupEnd();
}

function isCoreKeyArray(value) {
  return Array.isArray(value) && value.length > 0;
}


function collectTravelEventProse(value, path = []) {
  if (typeof value === "string") return [{ path: path.join("."), text: value }];
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, child]) => collectTravelEventProse(child, [...path, key]));
}

function stringifySmokeData(value) {
  return JSON.stringify(value, (_key, entry) => (typeof entry === "function" ? "<function>" : entry));
}

function containsSmokeTerm(value, pattern) {
  if (typeof value === "string") return pattern.test(value);
  if (Array.isArray(value)) return value.some((entry) => containsSmokeTerm(entry, pattern));
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsSmokeTerm(entry, pattern));
  return false;
}

function findLiteralOceanLanguage(event = {}) {
  const blockedPatterns = [
    /sea with no honest current/i,
    /\bsubmerged\b/i,
    /\bbrin(?:e|y)\b/i,
    /\bunderwater\b/i
  ];

  return collectTravelEventProse(event)
    .filter(({ text }) => blockedPatterns.some((pattern) => pattern.test(text)))
    .map(({ path, text }) => ({ path, text }));
}

function hasCoreStationActionFoundationData(action = {}) {
  return typeof action.stationKey === "string"
    && action.stationKey.length > 0
    && typeof action.name === "string"
    && action.name.length > 0
    && ["combat", "travel", "both"].includes(action.phase)
    && action.actionType === "stationAction"
    && Number.isFinite(action.apCost)
    && typeof action.criticalSuccess === "string"
    && typeof action.success === "string"
    && typeof action.failure === "string"
    && typeof action.criticalFailure === "string"
    && Array.isArray(action.rollOptions)
    && action.rollOptions.length > 0
    && action.rollOptions.every((option) => typeof option.key === "string" && option.key.length > 0 && typeof option.statisticKey === "string" && option.statisticKey.length > 0);
}

function hasTravelPromptAuthoringFields(prompt = {}) {
  return typeof prompt.playerAction === "string"
    && prompt.playerAction.trim().length > 0
    && ["criticalSuccess", "success", "failure", "criticalFailure"].every((degree) => typeof prompt.rollFeedback?.[degree] === "string" && prompt.rollFeedback[degree].trim().length > 0);
}

function hasNoGenericTravelPromptDefaults(prompt = {}) {
  const feedbackText = Object.values(prompt.rollFeedback ?? {}).join(" ");
  return !prompt.playerAction?.startsWith?.("Describe how ")
    && !feedbackText.includes("turns the moment")
    && !feedbackText.includes("keeps the moment")
    && !feedbackText.includes("confronts this travel pressure")
    && !feedbackText.includes("into a clean advantage")
    && !feedbackText.includes("under control");
}

function hasCoreWeaponFoundationData(weapon = {}) {
  return typeof weapon.size === "string"
    && weapon.size.length > 0
    && typeof weapon.family === "string"
    && weapon.family.length > 0
    && weapon.reload
    && typeof weapon.reload === "object"
    && weapon.damageProfile
    && typeof weapon.damageProfile === "object";
}

function findSmokeTestActor() {
  return Array.from(globalThis.game?.actors ?? []).find((actor) => (
    actor?.type === "vehicle"
    && actor?.name === SMOKE_TEST_ACTOR_NAME
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, SMOKE_TEST_FLAG) === true
  ));
}

async function ensureSmokeTestActor() {
  const existing = findSmokeTestActor();
  if (existing) return { actor: existing, created: false };

  const actor = await Actor.create({
    name: SMOKE_TEST_ACTOR_NAME,
    type: "vehicle",
    flags: {
      [ARCFLIGHT_MODULE_ID]: {
        [SMOKE_TEST_FLAG]: true
      }
    }
  });

  return { actor, created: true };
}

async function createSmokeTestComponent(createdItems, key, creator) {
  const item = await creator();
  createdItems.push(item);
  return [key, item];
}

async function createSmokeTestComponents(createdItems) {
  const entries = [
    await createSmokeTestComponent(createdItems, "hull", () => createCoreHull("brigantine")),
    await createSmokeTestComponent(createdItems, "replacementHull", () => createCoreHull("frigate")),
    await createSmokeTestComponent(createdItems, "arkengine", () => createCoreArkengine("tidewake-arkengine")),
    await createSmokeTestComponent(createdItems, "replacementArkengine", () => createCoreArkengine("iron-choir-engine")),
    await createSmokeTestComponent(createdItems, "arkengineMod", () => createCoreArkengineMod("pressure-lattice-tuning")),
    await createSmokeTestComponent(createdItems, "overflowArkengineMod", () => createCoreArkengineMod("pressure-lattice-tuning")),
    await createSmokeTestComponent(createdItems, "room", () => createCoreRoom("workshop")),
    await createSmokeTestComponent(createdItems, "overflowRoom", () => createCoreRoom("workshop")),
    await createSmokeTestComponent(createdItems, "shipUpgrade", () => createCoreShipUpgrade("reinforced-structural-ribbing")),
    await createSmokeTestComponent(createdItems, "weapon", () => createCoreWeapon("deck-ballista")),
    await createSmokeTestComponent(createdItems, "incompatibleArcWeapon", () => createCoreWeapon("grapnel-harpoon")),
    await createSmokeTestComponent(createdItems, "oversizedWeapon", () => createCoreWeapon("stormglass-lance")),
    await createSmokeTestComponent(createdItems, "crewAsset", () => createCoreCrewAsset("veteran-chief-engineer"))
  ];

  return Object.fromEntries(entries);
}

async function deleteDocuments(documents) {
  for (const document of documents.filter(Boolean).reverse()) {
    try {
      await document.delete();
    } catch (error) {
      console.warn(`Arcflight | Framework smoke test cleanup could not delete ${document.name ?? document.id}.`, error);
    }
  }
}

async function attemptDuplicateInstall(result, name, operation) {
  try {
    await operation();
    check(result, name, true, "no double-apply", "completed", "Duplicate install completed without increasing installed counts.");
  } catch (error) {
    check(result, name, true, "duplicate rejected", "rejected", error.message);
  }
}

async function expectInstallBlocked(result, name, operation, expectedMessagePart = "") {
  try {
    await operation();
    check(result, name, false, "blocked install", "completed", "Install unexpectedly completed.");
  } catch (error) {
    const message = error.message ?? "";
    check(result, name, !expectedMessagePart || message.includes(expectedMessagePart), expectedMessagePart || "blocked", message);
  }
}

/**
 * Run a temporary developer-facing smoke test against the current Arcflight framework.
 *
 * The helper creates throwaway world Items and a marked test vehicle actor when
 * needed. Source definitions are read but never mutated. Pass { cleanup: true }
 * to delete only documents created or marked by this helper.
 *
 * @param {{ cleanup?: boolean }} [options]
 * @returns {Promise<{passed: boolean, checks: Array, actorId: string, createdItemIds: string[]}>}
 */
export async function runFrameworkSmokeTest(options = {}) {
  const { cleanup = false } = options ?? {};
  const result = {
    passed: false,
    checks: [],
    actorId: "",
    createdItemIds: []
  };
  const createdItems = [];
  let actor = null;
  let deleteActorOnCleanup = false;
  let originalPublishedTravelEventLibrary = null;
  let originalRunnerSessionLibrary = null;
  let shouldRestoreTravelLibraries = false;

  try {
    originalPublishedTravelEventLibrary = globalThis.game?.settings?.get?.(ARCFLIGHT_MODULE_ID, PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING) ?? null;
    originalRunnerSessionLibrary = globalThis.game?.settings?.get?.(ARCFLIGHT_MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING) ?? null;
    shouldRestoreTravelLibraries = typeof globalThis.game?.settings?.set === "function";

    check(result, "Core hull key array exists", isCoreKeyArray(CORE_HULL_PLATFORM_KEYS), "non-empty array", CORE_HULL_PLATFORM_KEYS?.length ?? 0);
    check(result, "Core arkengine key array exists", isCoreKeyArray(CORE_ARKENGINE_KEYS), "non-empty array", CORE_ARKENGINE_KEYS?.length ?? 0);
    check(result, "Core arkengine mod key array exists", isCoreKeyArray(CORE_ARKENGINE_MOD_KEYS), "non-empty array", CORE_ARKENGINE_MOD_KEYS?.length ?? 0);
    check(result, "Core room key array exists", isCoreKeyArray(CORE_ROOM_KEYS), "non-empty array", CORE_ROOM_KEYS?.length ?? 0);
    check(result, "Core ship upgrade key array exists", isCoreKeyArray(CORE_SHIP_UPGRADE_KEYS), "non-empty array", CORE_SHIP_UPGRADE_KEYS?.length ?? 0);
    check(result, "Core crew asset key array exists", isCoreKeyArray(CORE_CREW_ASSET_KEYS), "non-empty array", CORE_CREW_ASSET_KEYS?.length ?? 0);
    check(result, "Core weapon key array exists", isCoreKeyArray(CORE_WEAPON_KEYS), "non-empty array", CORE_WEAPON_KEYS?.length ?? 0);
    check(result, "Every core weapon has size/family/reload/damageProfile", CORE_WEAPON_KEYS.every((key) => hasCoreWeaponFoundationData(CORE_WEAPONS[key])), true, CORE_WEAPON_KEYS.filter((key) => !hasCoreWeaponFoundationData(CORE_WEAPONS[key])));
    check(result, "Core station key array exists", isCoreKeyArray(STATION_KEYS), "non-empty array", STATION_KEYS?.length ?? 0);
    const travelStationKeys = getTravelStationKeys();
    const expectedTravelStationKeys = ["navigator", "engineer", "veilwarden", "watchmaster", "captain"];
    check(result, "Travel Five station helper returns exact keys", JSON.stringify(travelStationKeys) === JSON.stringify(expectedTravelStationKeys), expectedTravelStationKeys, travelStationKeys);
    check(result, "Every Travel Five station exists in STATION_KEYS", travelStationKeys.every((stationKey) => STATION_KEYS.includes(stationKey)), true, travelStationKeys.filter((stationKey) => !STATION_KEYS.includes(stationKey)));
    check(result, "Non-travel stations remain core but outside Travel Five", ["pilot", "gunnery", "quartermaster"].every((stationKey) => STATION_KEYS.includes(stationKey) && !isTravelStationKey(stationKey)), "pilot/gunnery/quartermaster core only", { stationKeys: STATION_KEYS, travelStationKeys });
    check(result, "Travel Five station primary skills are string keys", travelStationKeys.every((stationKey) => CORE_STATIONS[stationKey]?.primarySkills?.every((skillKey) => typeof skillKey === "string" && skillKey.length > 0)), "non-empty string skill keys", Object.fromEntries(travelStationKeys.map((stationKey) => [stationKey, CORE_STATIONS[stationKey]?.primarySkills])));
    const camelCaseLoreSkillKeys = ["pilotingLore", "sailingLore", "warfareLore"];
    const stationsWithCamelCaseLoreSkills = Object.entries(CORE_STATIONS).filter(([, station]) => station.primarySkills?.some((skillKey) => camelCaseLoreSkillKeys.includes(skillKey))).map(([stationKey, station]) => ({ stationKey, primarySkills: station.primarySkills }));
    check(result, "Core station primary skills use slug-style Lore keys", stationsWithCamelCaseLoreSkills.length === 0, "no camelCase Lore keys", stationsWithCamelCaseLoreSkills);
    check(result, "Travel constants are exported", ARCFLIGHT.TRAVEL_RESOURCES?.SUPPLIES === "supplies" && ARCFLIGHT.TRAVEL_STATIONS?.NAVIGATOR === "navigator", "travel constants", { resources: ARCFLIGHT.TRAVEL_RESOURCES, stations: ARCFLIGHT.TRAVEL_STATIONS });
    const expectedTravelCategories = ["environmental", "navigation", "threat", "social", "shipboard", "discovery", "occult"];
    const travelCategoryValues = Object.values(ARCFLIGHT.TRAVEL_EVENT_CATEGORIES ?? {});
    check(result, "Travel category constants include locked categories", expectedTravelCategories.every((category) => travelCategoryValues.includes(category)) && travelCategoryValues.length === expectedTravelCategories.length, expectedTravelCategories, travelCategoryValues);
    check(result, "Travel Five foundation helper matches station helper", JSON.stringify(getTravelFiveStationKeys()) === JSON.stringify(expectedTravelStationKeys), expectedTravelStationKeys, getTravelFiveStationKeys());
    check(result, "Core travel event key array exists", isCoreKeyArray(CORE_TRAVEL_EVENT_KEYS), "non-empty array", CORE_TRAVEL_EVENT_KEYS?.length ?? 0);
    check(result, "Core travel event keys include template-upgraded Pack 01A and Pack 01B events", EXPECTED_CORE_TRAVEL_EVENT_KEYS.every((key) => CORE_TRAVEL_EVENT_KEYS.includes(key)), EXPECTED_CORE_TRAVEL_EVENT_KEYS, CORE_TRAVEL_EVENT_KEYS);
    const travelFiveStationKeys = getTravelFiveStationKeys();
    const travelResourceValues = Object.values(ARCFLIGHT.TRAVEL_RESOURCES ?? {});
    for (const eventKey of EXPECTED_CORE_TRAVEL_EVENT_KEYS) {
      const coreTravelEvent = getCoreTravelEvent(eventKey);
      const validation = validateTravelEventDefinition(coreTravelEvent);
      const strictValidation = validateTravelEventDefinition(coreTravelEvent, { strictAuthoring: true });
      const prompts = coreTravelEvent?.rounds?.flatMap((round) => round.activeStations ?? []) ?? [];
      const activeStations = prompts.map((station) => station.stationKey);
      check(result, `${coreTravelEvent?.name ?? eventKey} core travel event exists`, coreTravelEvent?.key === eventKey, eventKey, coreTravelEvent?.key ?? null);
      check(result, `${coreTravelEvent?.name ?? eventKey} validates`, validation.ok === true, true, validation);
      check(result, `${coreTravelEvent?.name ?? eventKey} strict authoring validates`, strictValidation.ok === true, true, strictValidation);
      checkEqual(result, `${coreTravelEvent?.name ?? eventKey} has expected round count`, EXPECTED_CORE_TRAVEL_EVENT_ROUND_COUNTS[eventKey], coreTravelEvent?.rounds?.length ?? 0);
      check(result, `${coreTravelEvent?.name ?? eventKey} roundCount matches rounds length`, coreTravelEvent?.roundCount === coreTravelEvent?.rounds?.length, coreTravelEvent?.roundCount, coreTravelEvent?.rounds?.length ?? 0);
      check(result, `${coreTravelEvent?.name ?? eventKey} station prompts have playerAction and rollFeedback`, prompts.every((prompt) => hasTravelPromptAuthoringFields(prompt)), true, prompts.filter((prompt) => !hasTravelPromptAuthoringFields(prompt)).map((prompt) => ({ stationKey: prompt.stationKey, playerAction: prompt.playerAction, rollFeedback: prompt.rollFeedback })));
      check(result, `${coreTravelEvent?.name ?? eventKey} station prompts avoid generic authoring defaults`, prompts.every((prompt) => hasNoGenericTravelPromptDefaults(prompt)), true, prompts.filter((prompt) => !hasNoGenericTravelPromptDefaults(prompt)).map((prompt) => ({ stationKey: prompt.stationKey, playerAction: prompt.playerAction, rollFeedback: prompt.rollFeedback })));
      check(result, `${coreTravelEvent?.name ?? eventKey} active stations are Travel Five only`, activeStations.every((stationKey) => travelFiveStationKeys.includes(stationKey)), true, [...new Set(activeStations.filter((stationKey) => !travelFiveStationKeys.includes(stationKey)))]);
      check(result, `${coreTravelEvent?.name ?? eventKey} activeResources use known travel resources`, (coreTravelEvent?.activeResources ?? []).every((resource) => travelResourceValues.includes(resource)), true, (coreTravelEvent?.activeResources ?? []).filter((resource) => !travelResourceValues.includes(resource)));
      const literalOceanLanguageMatches = findLiteralOceanLanguage(coreTravelEvent);
      check(result, `${coreTravelEvent?.name ?? eventKey} prose avoids literal-ocean wording`, literalOceanLanguageMatches.length === 0, "no sea-with-no-honest-current/submerged/brine/underwater prose", literalOceanLanguageMatches);
    }
    const blackTideCrossing = getCoreTravelEvent("black-tide-crossing");
    check(result, "Travel degree contribution mapping works", getTravelDegreeContribution("criticalSuccess").successes === 2 && getTravelDegreeContribution("success").successes === 1 && getTravelDegreeContribution("failure").failures === 1 && getTravelDegreeContribution("criticalFailure").failures === 2 && getTravelDegreeContribution("criticalFailure").criticalFailures === 1, "locked mapping", { criticalSuccess: getTravelDegreeContribution("criticalSuccess"), success: getTravelDegreeContribution("success"), failure: getTravelDegreeContribution("failure"), criticalFailure: getTravelDegreeContribution("criticalFailure") });
    check(result, "Travel round outcome helper works", getTravelRoundOutcome({ successes: 3, failures: 1 }) === "dominantSuccess" && getTravelRoundOutcome({ successes: 1, failures: 1 }) === "mixed" && getTravelRoundOutcome({ successes: 1, failures: 3 }) === "dominantFailure" && getTravelRoundOutcome({ successes: 4, failures: 0, criticalFailures: 2 }) === "catastrophicFailure", "round outcomes", { dominant: getTravelRoundOutcome({ successes: 3, failures: 1 }), mixed: getTravelRoundOutcome({ successes: 1, failures: 1 }), failure: getTravelRoundOutcome({ successes: 1, failures: 3 }), catastrophic: getTravelRoundOutcome({ successes: 4, failures: 0, criticalFailures: 2 }) });
    check(result, "Travel event outcome helper works", getTravelEventOutcome({ successes: 8, failures: 3 }) === "majorVictory" && getTravelEventOutcome({ successes: 4, failures: 3 }) === "victory" && getTravelEventOutcome({ successes: 3, failures: 3 }) === "costlySuccess" && getTravelEventOutcome({ successes: 2, failures: 3 }) === "failure" && getTravelEventOutcome({ successes: 8, failures: 3, catastrophicFailure: true }) === "catastrophicFailure", "event outcomes", { major: getTravelEventOutcome({ successes: 8, failures: 3 }), victory: getTravelEventOutcome({ successes: 4, failures: 3 }), costly: getTravelEventOutcome({ successes: 3, failures: 3 }), failure: getTravelEventOutcome({ successes: 2, failures: 3 }), catastrophic: getTravelEventOutcome({ successes: 8, failures: 3, catastrophicFailure: true }) });
    check(result, "Travel event helpers exposed", typeof globalThis.game?.arcflight?.getCoreTravelEventKeys === "function" && typeof globalThis.game?.arcflight?.getCoreTravelEvent === "function" && typeof globalThis.game?.arcflight?.validateTravelEventDefinition === "function" && typeof globalThis.game?.arcflight?.prepareTravelRoundSummary === "function" && typeof globalThis.game?.arcflight?.getTravelDegreeContribution === "function", true, { getCoreTravelEventKeys: typeof globalThis.game?.arcflight?.getCoreTravelEventKeys, getCoreTravelEvent: typeof globalThis.game?.arcflight?.getCoreTravelEvent, validateTravelEventDefinition: typeof globalThis.game?.arcflight?.validateTravelEventDefinition, prepareTravelRoundSummary: typeof globalThis.game?.arcflight?.prepareTravelRoundSummary, getTravelDegreeContribution: typeof globalThis.game?.arcflight?.getTravelDegreeContribution });
    check(result, "Travel event devTools exposed", typeof globalThis.game?.arcflight?.devTools?.getCoreTravelEventKeys === "function" && typeof globalThis.game?.arcflight?.devTools?.getCoreTravelEvent === "function" && typeof globalThis.game?.arcflight?.devTools?.validateTravelEventDefinition === "function" && typeof globalThis.game?.arcflight?.devTools?.prepareTravelRoundSummary === "function" && typeof globalThis.game?.arcflight?.devTools?.getTravelDegreeContribution === "function", true, { getCoreTravelEventKeys: typeof globalThis.game?.arcflight?.devTools?.getCoreTravelEventKeys, getCoreTravelEvent: typeof globalThis.game?.arcflight?.devTools?.getCoreTravelEvent, validateTravelEventDefinition: typeof globalThis.game?.arcflight?.devTools?.validateTravelEventDefinition, prepareTravelRoundSummary: typeof globalThis.game?.arcflight?.devTools?.prepareTravelRoundSummary, getTravelDegreeContribution: typeof globalThis.game?.arcflight?.devTools?.getTravelDegreeContribution });
    check(result, "Core station action key array exists", isCoreKeyArray(CORE_STATION_ACTION_KEYS), "non-empty array", CORE_STATION_ACTION_KEYS?.length ?? 0);
    check(result, "Every station action has required foundation fields", CORE_STATION_ACTION_KEYS.every((key) => hasCoreStationActionFoundationData(CORE_STATION_ACTIONS[key])), true, CORE_STATION_ACTION_KEYS.filter((key) => !hasCoreStationActionFoundationData(CORE_STATION_ACTIONS[key])));
    check(result, "Every station action points to a known station key", CORE_STATION_ACTION_KEYS.every((key) => STATION_KEYS.includes(CORE_STATION_ACTIONS[key]?.stationKey)), true, CORE_STATION_ACTION_KEYS.filter((key) => !STATION_KEYS.includes(CORE_STATION_ACTIONS[key]?.stationKey)));
    check(result, "Core station action helper lookups work", getCoreStationActionKeys() === CORE_STATION_ACTION_KEYS && getCoreStationActions() === CORE_STATION_ACTIONS && getCoreStationAction("rally-crew")?.stationKey === "captain" && getCoreStationActionsForStation("gunnery").length === 2, true, { keys: getCoreStationActionKeys()?.length ?? 0, rallyCrew: getCoreStationAction("rally-crew"), gunneryActions: getCoreStationActionsForStation("gunnery").map((action) => action.key) });
    check(result, "Station action roll option metadata exists", getStationActionRollOptions("rally-crew").some((option) => option.statisticKey === "diplomacy") && getStationActionRollOptions("adjust-facing").some((option) => option.statisticKey === "reflex"), "roll options for rally crew and adjust facing", { rallyCrew: getStationActionRollOptions("rally-crew"), adjustFacing: getStationActionRollOptions("adjust-facing") });
    check(result, "Station action outcome helpers interpret degree metadata", getStationActionOutcome("rally-crew", 3).label === "Critical Success" && getStationActionOutcome("rally-crew", "failure").text === CORE_STATION_ACTIONS["rally-crew"].failure && previewStationActionOutcome("rally-crew", { degreeOfSuccess: 2 }).label === "Success", "resolved outcome helpers", { critical: getStationActionOutcome("rally-crew", 3), failure: getStationActionOutcome("rally-crew", "failure"), preview: previewStationActionOutcome("rally-crew", { degreeOfSuccess: 2 }) });
    check(result, "Station action outcome helper stays unresolved without degree", previewStationActionOutcome("rally-crew", { total: 18 }).label === "Unresolved", "unresolved outcome", previewStationActionOutcome("rally-crew", { total: 18 }));
    check(result, "Core station action helpers exposed", typeof globalThis.game?.arcflight?.getCoreStationAction === "function" && typeof globalThis.game?.arcflight?.getCoreStationActionKeys === "function" && typeof globalThis.game?.arcflight?.getCoreStationActions === "function" && typeof globalThis.game?.arcflight?.getCoreStationActionsForStation === "function", true, { getCoreStationAction: typeof globalThis.game?.arcflight?.getCoreStationAction, getCoreStationActionKeys: typeof globalThis.game?.arcflight?.getCoreStationActionKeys, getCoreStationActions: typeof globalThis.game?.arcflight?.getCoreStationActions, getCoreStationActionsForStation: typeof globalThis.game?.arcflight?.getCoreStationActionsForStation });
    check(result, "Core station action devTools exposed", typeof globalThis.game?.arcflight?.devTools?.getCoreStationAction === "function" && typeof globalThis.game?.arcflight?.devTools?.getCoreStationActionKeys === "function" && typeof globalThis.game?.arcflight?.devTools?.getCoreStationActions === "function" && typeof globalThis.game?.arcflight?.devTools?.getCoreStationActionsForStation === "function", true, { getCoreStationAction: typeof globalThis.game?.arcflight?.devTools?.getCoreStationAction, getCoreStationActionKeys: typeof globalThis.game?.arcflight?.devTools?.getCoreStationActionKeys, getCoreStationActions: typeof globalThis.game?.arcflight?.devTools?.getCoreStationActions, getCoreStationActionsForStation: typeof globalThis.game?.arcflight?.devTools?.getCoreStationActionsForStation });
    check(result, "Station action execution helpers exposed", typeof globalThis.game?.arcflight?.getStationActionOutcome === "function" && typeof globalThis.game?.arcflight?.previewStationActionOutcome === "function" && typeof globalThis.game?.arcflight?.getStationActionState === "function" && typeof globalThis.game?.arcflight?.previewStationAction === "function" && typeof globalThis.game?.arcflight?.getStationActionRollOptions === "function" && typeof globalThis.game?.arcflight?.previewStationActionRoll === "function" && typeof globalThis.game?.arcflight?.rollStationAction === "function" && typeof globalThis.game?.arcflight?.executeStationAction === "function" && typeof globalThis.game?.arcflight?.clearStationActionHistory === "function", true, { getStationActionState: typeof globalThis.game?.arcflight?.getStationActionState, previewStationAction: typeof globalThis.game?.arcflight?.previewStationAction, getStationActionRollOptions: typeof globalThis.game?.arcflight?.getStationActionRollOptions, previewStationActionRoll: typeof globalThis.game?.arcflight?.previewStationActionRoll, rollStationAction: typeof globalThis.game?.arcflight?.rollStationAction, executeStationAction: typeof globalThis.game?.arcflight?.executeStationAction, clearStationActionHistory: typeof globalThis.game?.arcflight?.clearStationActionHistory });
    check(result, "Station action execution devTools exposed", typeof globalThis.game?.arcflight?.devTools?.getStationActionOutcome === "function" && typeof globalThis.game?.arcflight?.devTools?.previewStationActionOutcome === "function" && typeof globalThis.game?.arcflight?.devTools?.getStationActionState === "function" && typeof globalThis.game?.arcflight?.devTools?.previewStationAction === "function" && typeof globalThis.game?.arcflight?.devTools?.getStationActionRollOptions === "function" && typeof globalThis.game?.arcflight?.devTools?.previewStationActionRoll === "function" && typeof globalThis.game?.arcflight?.devTools?.rollStationAction === "function" && typeof globalThis.game?.arcflight?.devTools?.executeStationAction === "function" && typeof globalThis.game?.arcflight?.devTools?.clearStationActionHistory === "function", true, { getStationActionState: typeof globalThis.game?.arcflight?.devTools?.getStationActionState, previewStationAction: typeof globalThis.game?.arcflight?.devTools?.previewStationAction, getStationActionRollOptions: typeof globalThis.game?.arcflight?.devTools?.getStationActionRollOptions, previewStationActionRoll: typeof globalThis.game?.arcflight?.devTools?.previewStationActionRoll, rollStationAction: typeof globalThis.game?.arcflight?.devTools?.rollStationAction, executeStationAction: typeof globalThis.game?.arcflight?.devTools?.executeStationAction, clearStationActionHistory: typeof globalThis.game?.arcflight?.devTools?.clearStationActionHistory });
    const pf2eStatisticHelperNames = ["normalizePf2eStatisticKey", "getPf2eStatisticCandidateKeys", "resolvePf2eActorStatistic", "isRollablePf2eStatistic", "getPf2eRollTotal", "rollPf2eStatistic"];
    check(result, "Shared PF2E statistic helpers exposed", pf2eStatisticHelperNames.every((helperName) => typeof globalThis.game?.arcflight?.[helperName] === "function"), true, Object.fromEntries(pf2eStatisticHelperNames.map((helperName) => [helperName, typeof globalThis.game?.arcflight?.[helperName]])));
    check(result, "Shared PF2E statistic devTools exposed", pf2eStatisticHelperNames.every((helperName) => typeof globalThis.game?.arcflight?.devTools?.[helperName] === "function"), true, Object.fromEntries(pf2eStatisticHelperNames.map((helperName) => [helperName, typeof globalThis.game?.arcflight?.devTools?.[helperName]])));
    checkEqual(result, "Shared PF2E statistic key normalization trims and slugs", "warfare-lore", normalizePf2eStatisticKey(" Warfare-Lore "));
    const warfareLoreCandidates = getPf2eStatisticCandidateKeys(null, "warfare-lore");
    check(result, "Shared PF2E Lore candidates include base fallback", warfareLoreCandidates.includes("warfare-lore") && warfareLoreCandidates.includes("warfare"), "warfare-lore and warfare", warfareLoreCandidates);
    check(result, "Shared PF2E statistic resolution is null-safe", resolvePf2eActorStatistic(null, "diplomacy").ok === false, false, resolvePf2eActorStatistic(null, "diplomacy"));
    const nullTravelAssignment = await resolveTravelStationAssignedActor(null, "captain");
    check(result, "Travel runner assigned actor resolution is null-safe", nullTravelAssignment.actor === null && nullTravelAssignment.actorResolved === false, true, nullTravelAssignment);
    checkEqual(result, "Travel runner statistic label formats positive modifiers", "Diplomacy (+12)", formatStatisticOptionLabel("diplomacy", { ok: true, statistic: { mod: 12 } }));
    checkEqual(result, "Travel runner statistic label formats +0 modifiers", "Society (+0)", formatStatisticOptionLabel("society", { ok: true, statistic: { check: { mod: 0 } } }));
    checkEqual(result, "Travel runner statistic label formats negative modifiers", "Intimidation (-1)", formatStatisticOptionLabel("intimidation", { ok: true, statistic: { totalModifier: -1 } }));
    checkEqual(result, "Travel runner statistic label formats unavailable statistics", "Piloting Lore (unavailable)", formatStatisticOptionLabel("piloting-lore", { ok: false, statistic: null }));
    checkEqual(result, "Travel runner statistic label is null-safe without assigned actor", "Diplomacy", formatStatisticOptionLabel("diplomacy", null));
    checkEqual(result, "Travel runner statistic modifier helper ignores non-finite values", null, getResolvedPf2eStatisticModifier({ mod: Number.POSITIVE_INFINITY, check: { mod: "12" }, totalModifier: Number.NaN }));
    check(result, "Core hull library has 11 locked keys", EXPECTED_CORE_HULL_PLATFORM_KEYS.every((key) => CORE_HULL_PLATFORM_KEYS.includes(key)) && CORE_HULL_PLATFORM_KEYS.length === EXPECTED_CORE_HULL_PLATFORM_KEYS.length, EXPECTED_CORE_HULL_PLATFORM_KEYS, CORE_HULL_PLATFORM_KEYS);
    check(result, "Every core hull has classification", EXPECTED_CORE_HULL_PLATFORM_KEYS.every((key) => hasClassification(CORE_HULLS[key])), true, EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => !hasClassification(CORE_HULLS[key])));
    check(result, "Every core hull has refit tolerance", EXPECTED_CORE_HULL_PLATFORM_KEYS.every((key) => hasRefitTolerance(CORE_HULLS[key])), true, EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => !hasRefitTolerance(CORE_HULLS[key])));
    check(result, "Every core hull has arkengine compatibility", EXPECTED_CORE_HULL_PLATFORM_KEYS.every((key) => hasArkengineCompatibility(CORE_HULLS[key])), true, EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => !hasArkengineCompatibility(CORE_HULLS[key])));
    check(result, "Every standard core hull has expansion slots", EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => key !== "leviathan-class-platform").every((key) => Number.isInteger(CORE_HULLS[key]?.rooms?.expansionSlots)), true, EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => key !== "leviathan-class-platform" && !Number.isInteger(CORE_HULLS[key]?.rooms?.expansionSlots)));
    check(result, "Leviathan platform is district-scale", CORE_HULLS["leviathan-class-platform"]?.rooms?.districtScale === true, true, CORE_HULLS["leviathan-class-platform"]?.rooms ?? null);

    const expectedSyncCategories = ["hull", "arkengine", "arkengineMod", "weapon", "room", "shipUpgrade", "crewAsset"];
    const missingCoreReport = await findMissingCoreArcflightItems();
    check(result, "Core item missing report includes sync categories", expectedSyncCategories.every((category) => missingCoreReport.categories?.[category]), expectedSyncCategories, Object.keys(missingCoreReport.categories ?? {}));
    check(result, "Core item missing report skips stations", missingCoreReport.skippedCategories?.some((entry) => entry.category === "stations"), true, missingCoreReport.skippedCategories ?? []);
    const itemCountBeforeDryRun = globalThis.game?.items?.size ?? Array.from(globalThis.game?.items ?? []).length;
    const syncDryRunReport = await syncCoreArcflightItems({ dryRun: true });
    const itemCountAfterDryRun = globalThis.game?.items?.size ?? Array.from(globalThis.game?.items ?? []).length;
    check(result, "Core item sync defaults to report categories", expectedSyncCategories.every((category) => syncDryRunReport.categories?.[category]), expectedSyncCategories, Object.keys(syncDryRunReport.categories ?? {}));
    checkEqual(result, "Core item sync dry run creates nothing", itemCountBeforeDryRun, itemCountAfterDryRun);
    check(result, "Core item sync helpers exposed", typeof globalThis.game?.arcflight?.findMissingCoreArcflightItems === "function" && typeof globalThis.game?.arcflight?.syncCoreArcflightItems === "function", true, { findMissingCoreArcflightItems: typeof globalThis.game?.arcflight?.findMissingCoreArcflightItems, syncCoreArcflightItems: typeof globalThis.game?.arcflight?.syncCoreArcflightItems });
    check(result, "Core item sync devTools exposed", typeof globalThis.game?.arcflight?.devTools?.findMissingCoreArcflightItems === "function" && typeof globalThis.game?.arcflight?.devTools?.syncCoreArcflightItems === "function", true, { findMissingCoreArcflightItems: typeof globalThis.game?.arcflight?.devTools?.findMissingCoreArcflightItems, syncCoreArcflightItems: typeof globalThis.game?.arcflight?.devTools?.syncCoreArcflightItems });
    check(result, "Core weapon helpers exposed", typeof globalThis.game?.arcflight?.getCoreWeapon === "function" && typeof globalThis.game?.arcflight?.getCoreWeaponKeys === "function" && typeof globalThis.game?.arcflight?.createCoreWeapon === "function" && typeof globalThis.game?.arcflight?.createWeapon === "function", true, { getCoreWeapon: typeof globalThis.game?.arcflight?.getCoreWeapon, getCoreWeaponKeys: typeof globalThis.game?.arcflight?.getCoreWeaponKeys, createCoreWeapon: typeof globalThis.game?.arcflight?.createCoreWeapon, createWeapon: typeof globalThis.game?.arcflight?.createWeapon });
    check(result, "Core weapon devTools exposed", typeof globalThis.game?.arcflight?.devTools?.getCoreWeapon === "function" && typeof globalThis.game?.arcflight?.devTools?.getCoreWeaponKeys === "function" && typeof globalThis.game?.arcflight?.devTools?.createCoreWeapon === "function" && typeof globalThis.game?.arcflight?.devTools?.createWeapon === "function", true, { getCoreWeapon: typeof globalThis.game?.arcflight?.devTools?.getCoreWeapon, getCoreWeaponKeys: typeof globalThis.game?.arcflight?.devTools?.getCoreWeaponKeys, createCoreWeapon: typeof globalThis.game?.arcflight?.devTools?.createCoreWeapon, createWeapon: typeof globalThis.game?.arcflight?.devTools?.createWeapon });

    const weaponItem = await createCoreWeapon("deck-ballista");
    createdItems.push(weaponItem);
    check(result, "createCoreWeapon creates PF2E equipment", weaponItem?.type === "equipment", "equipment", weaponItem?.type ?? null);
    check(result, "Core weapon item flags are correct", weaponItem?.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true && weaponItem?.getFlag?.(ARCFLIGHT_MODULE_ID, "componentType") === ARCFLIGHT_ITEM_TYPES.WEAPON, "enabled weapon flags", { enabled: weaponItem?.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled"), componentType: weaponItem?.getFlag?.(ARCFLIGHT_MODULE_ID, "componentType") });

    const componentItems = await createSmokeTestComponents(createdItems);
    await componentItems.overflowArkengineMod.update({
      name: "Smoke Overflow Arkengine Mod",
      [`flags.${ARCFLIGHT_MODULE_ID}.system.identity.id`]: "smoke-overflow-arkengine-mod",
      [`flags.${ARCFLIGHT_MODULE_ID}.system.installation.modSlotsRequired`]: 99
    });
    await componentItems.overflowRoom.update({
      name: "Smoke Overflow Room",
      [`flags.${ARCFLIGHT_MODULE_ID}.system.identity.id`]: "smoke-overflow-room",
      [`flags.${ARCFLIGHT_MODULE_ID}.system.installation.expansionSlotsRequired`]: 99
    });
    await componentItems.crewAsset.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.system.restrictions.unique`]: true
    });
    result.createdItemIds = createdItems.map((item) => item?.id).filter(Boolean);
    check(result, "Created smoke test components", result.createdItemIds.length === 14, 14, result.createdItemIds.length);

    const actorResult = await ensureSmokeTestActor();
    actor = actorResult.actor;
    deleteActorOnCleanup = actorResult.created || actor.getFlag?.(ARCFLIGHT_MODULE_ID, SMOKE_TEST_FLAG) === true;
    result.actorId = actor?.id ?? "";
    check(result, "PF2E vehicle actor available", actor?.type === "vehicle", "vehicle", actor?.type ?? null, actorResult.created ? "Created test vehicle actor." : "Reused marked smoke test vehicle actor.");

    const arcflightFlags = getDefaultArcflightShipFlags();
    await actor.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.enabled`]: arcflightFlags.enabled,
      [`flags.${ARCFLIGHT_MODULE_ID}.actorType`]: arcflightFlags.actorType,
      [`flags.${ARCFLIGHT_MODULE_ID}.system`]: arcflightFlags.system,
      [`flags.${ARCFLIGHT_MODULE_ID}.${SMOKE_TEST_FLAG}`]: true
    });
    check(result, "Arcflight enabled on vehicle", actor.getFlag(ARCFLIGHT_MODULE_ID, "enabled") === true, true, actor.getFlag(ARCFLIGHT_MODULE_ID, "enabled"));
    checkEqual(result, "Current supplies initializes safely", 0, getArcflightShipData(actor).current.supplies);

    const initialStationActionState = getStationActionState(actor);
    check(result, "Station action history initializes empty", Array.isArray(initialStationActionState.history) && initialStationActionState.history.length === 0, "empty history", initialStationActionState);
    const invalidStationActionPreview = previewStationAction(actor, "missing-station-action");
    check(result, "Station action preview blocks invalid key safely", invalidStationActionPreview.blocked === true && invalidStationActionPreview.ok === false && invalidStationActionPreview.severity === "danger", "blocked danger preview", invalidStationActionPreview);
    const unassignedStationActionPreview = previewStationAction(actor, "rally-crew", { phase: "combat" });
    check(result, "Station action preview blocks unassigned required station", unassignedStationActionPreview.blocked === true && unassignedStationActionPreview.warnings.length > 0, "blocked with warning", unassignedStationActionPreview);
    const unassignedStationActionRollPreview = await previewStationActionRoll(actor, "rally-crew", { phase: "combat", rollOptionKey: "diplomacy" });
    check(result, "Station action roll preview blocks unassigned station", unassignedStationActionRollPreview.blocked === true && unassignedStationActionRollPreview.ok === false, "blocked roll preview", unassignedStationActionRollPreview);
    const emptyStationActionUiState = prepareStationActionUiState(actor, getArcflightShipData(actor).stations);
    check(result, "Ship sheet station action UI state builds", emptyStationActionUiState.hasGroups === true && emptyStationActionUiState.groups.length === 7, "seven station action groups", emptyStationActionUiState.groups.map((group) => group.key));
    check(result, "Ship sheet station action grouped action list exists", emptyStationActionUiState.groups.some((group) => group.key === "captain" && group.actions.some((action) => action.key === "rally-crew")), "captain rally-crew action", emptyStationActionUiState.groups);
    check(result, "Ship sheet station action empty history readout is safe", prepareStationActionHistoryReadout(actor).hasRecords === false, "empty history readout", prepareStationActionHistoryReadout(actor));
    await assignStation(actor, "captain", { id: "smoke-captain", uuid: "Actor.smoke-captain", name: "Smoke Captain" }, { assigneeType: "actor" });
    const missingActorRollPreview = await previewStationActionRoll(actor, "rally-crew", { phase: "combat", rollOptionKey: "diplomacy" });
    check(result, "Station action roll preview handles missing assigned actor safely", missingActorRollPreview.blocked === true && missingActorRollPreview.warnings.length > 0, "blocked missing actor", missingActorRollPreview);
    const assignedStationActionPreview = previewStationAction(actor, "rally-crew", { phase: "combat" });
    check(result, "Station action preview allows assigned required station", assignedStationActionPreview.ok === true && assignedStationActionPreview.blocked === false && assignedStationActionPreview.actionName === "Rally Crew", "ready preview", assignedStationActionPreview);
    const beforeStationActionData = getArcflightShipData(actor);
    const stationActionRecord = await executeStationAction(actor, "rally-crew", { phase: "combat", notes: "Smoke test record only." });
    const afterStationActionData = getArcflightShipData(actor);
    const stationActionStateAfterExecute = getStationActionState(actor);
    check(result, "Station action execute records history", stationActionStateAfterExecute.history.length === 1 && stationActionStateAfterExecute.history[0]?.id === stationActionRecord.id && stationActionRecord.actionKey === "rally-crew", "one history record", stationActionStateAfterExecute);
    const populatedStationActionHistoryReadout = prepareStationActionHistoryReadout(actor);
    check(result, "Ship sheet station action populated history readout is safe", populatedStationActionHistoryReadout.hasRecords === true && populatedStationActionHistoryReadout.records[0]?.actionName === "Rally Crew" && populatedStationActionHistoryReadout.records[0]?.assignedCrewName === "Smoke Captain", "populated history readout", populatedStationActionHistoryReadout);
    check(result, "Station action execute does not spend AP/RAP", beforeStationActionData.derived.baseAP === afterStationActionData.derived.baseAP && beforeStationActionData.derived.baseRAP === afterStationActionData.derived.baseRAP, "unchanged AP/RAP derived values", { before: { baseAP: beforeStationActionData.derived.baseAP, baseRAP: beforeStationActionData.derived.baseRAP }, after: { baseAP: afterStationActionData.derived.baseAP, baseRAP: afterStationActionData.derived.baseRAP } });
    await clearStationActionHistory(actor);
    checkEqual(result, "Station action history clears", 0, getStationActionState(actor).history.length);
    await clearStationAssignment(actor, "captain");

    const initialInstallState = getInstallState(actor);
    checkEqual(result, "Install state initializes at version 1", 1, initialInstallState.version);
    checkEqual(result, "Install state initializes with no records", 0, initialInstallState.installs.length);
    const { prepareArcflightShipViewData, prepareInstallStateReadout, prepareInstallUiState } = await import("../sheets/ship-sheet.js");
    const emptyInstallStateReadout = prepareInstallStateReadout(actor);
    check(result, "Install state sheet readout handles empty state", emptyInstallStateReadout.hasRecords === false && emptyInstallStateReadout.summary.totalInstalls === 0, "empty readout", emptyInstallStateReadout);
    const emptyShipViewData = prepareArcflightShipViewData({ system: actor.getFlag(ARCFLIGHT_MODULE_ID, "system") }, actor);
    check(result, "Ship view data includes installStateReadout", Boolean(emptyShipViewData.system.installStateReadout) && emptyShipViewData.system.installStateReadout.hasRecords === false, "installStateReadout", emptyShipViewData.system.installStateReadout);
    const emptyInstallUiState = prepareInstallUiState(actor, ARCFLIGHT_ITEM_TYPES.HULL, "missing-item-id");
    check(result, "Ship install UI state builds without selection", emptyInstallUiState.selectedComponentType === ARCFLIGHT_ITEM_TYPES.HULL && Array.isArray(emptyInstallUiState.itemOptions) && emptyInstallUiState.canInstall === false, "safe empty install UI", emptyInstallUiState);

    const smokeInstallRecord = {
      installId: "smoke-install-state-record",
      itemId: componentItems.room.id,
      itemUuid: componentItems.room.uuid,
      componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
      installedAt: 12345,
      installedBy: "framework-smoke-test",
      roomSlot: "expansion-1",
      installCategory: "native",
      nativeInstall: true,
      refitInstall: false,
      temporaryInstall: false,
      pressureContribution: {
        total: 3,
        weapon: 0,
        engine: 0,
        infrastructure: 3,
        lifeveil: 0,
        crewCommand: 0,
        occult: 0
      },
      tierAtInstall: 2,
      active: true
    };
    const addedInstallRecord = await recordInstallState(actor, smokeInstallRecord);
    checkEqual(result, "Install state record add stores installId", smokeInstallRecord.installId, addedInstallRecord.installId);
    checkEqual(result, "Install state find returns added record", smokeInstallRecord.installId, findInstallRecord(actor, smokeInstallRecord.installId)?.installId);
    checkEqual(result, "Installed components returns active records", 1, getInstalledComponents(actor).length);

    try {
      await recordInstallState(actor, smokeInstallRecord);
      check(result, "Install state duplicate installId is rejected", false, "duplicate rejection", "accepted");
    } catch (error) {
      check(result, "Install state duplicate installId is rejected", error.message.includes("already recorded"), "duplicate rejection", error.message);
    }

    const removedInstallRecord = await removeInstallState(actor, smokeInstallRecord.installId);
    const inactiveNoopRecord = await deactivateInstallRecord(actor, smokeInstallRecord.installId, { reason: "noop-after-remove" });
    const removedInstallSummary = prepareInstallStateSummary(actor);
    checkEqual(result, "Install state remove marks record inactive", false, removedInstallRecord?.active);
    check(result, "Install state remove records metadata", removedInstallRecord?.removedAt > 0 && removedInstallRecord?.removedBy && removedInstallRecord?.removalReason === "removed", "removal metadata", removedInstallRecord);
    checkEqual(result, "Install state deactivate no-ops inactive records", removedInstallRecord?.removedAt, inactiveNoopRecord?.removedAt);
    checkEqual(result, "Install state inactive summary increments", 1, removedInstallSummary.inactiveInstalls);
    checkEqual(result, "Inactive install helper returns inactive records", 1, getInactiveInstallRecords(actor).length);

    await recordInstallState(actor, { ...smokeInstallRecord, installId: "smoke-component-deactivate-record", active: true });
    const componentDeactivatedRecords = await deactivateInstallRecordsByComponent(actor, ARCFLIGHT_ITEM_TYPES.ROOM, { reason: "component-helper-test" });
    check(result, "Component deactivate helper marks active matching records inactive", componentDeactivatedRecords.length === 1 && componentDeactivatedRecords[0]?.removalReason === "component-helper-test", "one active room deactivated", componentDeactivatedRecords);

    await actor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: { version: "bad", installs: [{ installId: "dupe", itemId: 99, componentType: ARCFLIGHT_ITEM_TYPES.ROOM, active: true }, { installId: "dupe", componentType: ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD, pressureContribution: { enginePressure: 2 }, active: "bad" }, null, "bad"] } });
    const normalizedMalformedState = getInstallState(actor);
    const malformedInstallIds = normalizedMalformedState.installs.map((record) => record.installId);
    checkEqual(result, "Malformed install state normalizes record count", 2, normalizedMalformedState.installs.length);
    check(result, "Malformed install state prevents duplicate ids", new Set(malformedInstallIds).size === malformedInstallIds.length, "unique installIds", malformedInstallIds);
    checkEqual(result, "Malformed install state aliases pressure categories", 2, normalizedMalformedState.installs[1].pressureContribution.engine);

    const normalizedMalformedSummary = prepareInstallStateSummary(actor);
    const malformedInstallStateReadout = prepareInstallStateReadout(actor);
    check(result, "Install state sheet readout handles malformed state", malformedInstallStateReadout.hasRecords === true && malformedInstallStateReadout.activeRecords.length === 2, "normalized malformed readout", malformedInstallStateReadout);
    checkEqual(result, "Install state summary counts active installs", 2, normalizedMalformedSummary.activeInstalls);
    checkEqual(result, "Install state summary counts component types", 1, normalizedMalformedSummary.countsByComponentType[ARCFLIGHT_ITEM_TYPES.ROOM]);
    checkEqual(result, "Install state summary totals pressure", 2, normalizedMalformedSummary.pressureContribution.total);
    check(result, "Install state helpers exposed", typeof globalThis.game?.arcflight?.getActiveInstallRecords === "function" && typeof globalThis.game?.arcflight?.getInactiveInstallRecords === "function" && typeof globalThis.game?.arcflight?.getInstalledComponents === "function" && typeof globalThis.game?.arcflight?.getInstallState === "function" && typeof globalThis.game?.arcflight?.recordInstallState === "function" && typeof globalThis.game?.arcflight?.deactivateInstallRecord === "function" && typeof globalThis.game?.arcflight?.deactivateInstallRecordsByComponent === "function" && typeof globalThis.game?.arcflight?.removeInstallState === "function" && typeof globalThis.game?.arcflight?.findInstallRecord === "function" && typeof globalThis.game?.arcflight?.prepareInstallStateSummary === "function" && typeof globalThis.game?.arcflight?.findShipsMissingInstallState === "function" && typeof globalThis.game?.arcflight?.backfillInstallStateForShip === "function" && typeof globalThis.game?.arcflight?.backfillInstallStateForAllShips === "function", true, { getActiveInstallRecords: typeof globalThis.game?.arcflight?.getActiveInstallRecords, getInactiveInstallRecords: typeof globalThis.game?.arcflight?.getInactiveInstallRecords, getInstalledComponents: typeof globalThis.game?.arcflight?.getInstalledComponents, getInstallState: typeof globalThis.game?.arcflight?.getInstallState, recordInstallState: typeof globalThis.game?.arcflight?.recordInstallState, deactivateInstallRecord: typeof globalThis.game?.arcflight?.deactivateInstallRecord, deactivateInstallRecordsByComponent: typeof globalThis.game?.arcflight?.deactivateInstallRecordsByComponent, removeInstallState: typeof globalThis.game?.arcflight?.removeInstallState, findInstallRecord: typeof globalThis.game?.arcflight?.findInstallRecord, prepareInstallStateSummary: typeof globalThis.game?.arcflight?.prepareInstallStateSummary, findShipsMissingInstallState: typeof globalThis.game?.arcflight?.findShipsMissingInstallState, backfillInstallStateForShip: typeof globalThis.game?.arcflight?.backfillInstallStateForShip, backfillInstallStateForAllShips: typeof globalThis.game?.arcflight?.backfillInstallStateForAllShips });
    check(result, "Install state devTools exposed", typeof globalThis.game?.arcflight?.devTools?.getActiveInstallRecords === "function" && typeof globalThis.game?.arcflight?.devTools?.getInactiveInstallRecords === "function" && typeof globalThis.game?.arcflight?.devTools?.getInstalledComponents === "function" && typeof globalThis.game?.arcflight?.devTools?.getInstallState === "function" && typeof globalThis.game?.arcflight?.devTools?.recordInstallState === "function" && typeof globalThis.game?.arcflight?.devTools?.deactivateInstallRecord === "function" && typeof globalThis.game?.arcflight?.devTools?.deactivateInstallRecordsByComponent === "function" && typeof globalThis.game?.arcflight?.devTools?.removeInstallState === "function" && typeof globalThis.game?.arcflight?.devTools?.findInstallRecord === "function" && typeof globalThis.game?.arcflight?.devTools?.prepareInstallStateSummary === "function" && typeof globalThis.game?.arcflight?.devTools?.findShipsMissingInstallState === "function" && typeof globalThis.game?.arcflight?.devTools?.backfillInstallStateForShip === "function" && typeof globalThis.game?.arcflight?.devTools?.backfillInstallStateForAllShips === "function", true, { getActiveInstallRecords: typeof globalThis.game?.arcflight?.devTools?.getActiveInstallRecords, getInactiveInstallRecords: typeof globalThis.game?.arcflight?.devTools?.getInactiveInstallRecords, getInstalledComponents: typeof globalThis.game?.arcflight?.devTools?.getInstalledComponents, getInstallState: typeof globalThis.game?.arcflight?.devTools?.getInstallState, recordInstallState: typeof globalThis.game?.arcflight?.devTools?.recordInstallState, deactivateInstallRecord: typeof globalThis.game?.arcflight?.devTools?.deactivateInstallRecord, deactivateInstallRecordsByComponent: typeof globalThis.game?.arcflight?.devTools?.deactivateInstallRecordsByComponent, removeInstallState: typeof globalThis.game?.arcflight?.devTools?.removeInstallState, findInstallRecord: typeof globalThis.game?.arcflight?.devTools?.findInstallRecord, prepareInstallStateSummary: typeof globalThis.game?.arcflight?.devTools?.prepareInstallStateSummary, findShipsMissingInstallState: typeof globalThis.game?.arcflight?.devTools?.findShipsMissingInstallState, backfillInstallStateForShip: typeof globalThis.game?.arcflight?.devTools?.backfillInstallStateForShip, backfillInstallStateForAllShips: typeof globalThis.game?.arcflight?.devTools?.backfillInstallStateForAllShips });
    checkEqual(result, "Standalone malformed install normalization safe fallback", 0, normalizeInstallState("bad").installs.length);

    await actor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: initialInstallState });

    await installHull(actor, componentItems.hull);
    await installArkengine(actor, componentItems.arkengine);
    await installArkengineMod(actor, componentItems.arkengineMod);
    await installRoom(actor, componentItems.room);
    await installShipUpgrade(actor, componentItems.shipUpgrade);
    await addCrewAsset(actor, componentItems.crewAsset);

    const helperInstallState = getInstallState(actor);
    const helperInstallTypes = helperInstallState.installs.map((record) => record.componentType);
    const helperInstallCategories = Object.fromEntries(helperInstallState.installs.map((record) => [record.componentType, record.installCategory]));
    const helperInstallRecordsHaveCoreFields = helperInstallState.installs.every((record) => (
      record.active === true
      && record.itemId
      && record.itemUuid
      && record.componentType
      && record.installedAt > 0
      && record.installedBy
      && Number.isFinite(record.tierAtInstall)
      && Number.isFinite(record.pressureContribution?.total)
    ));
    const helperInstallRecordsByType = new Map(helperInstallState.installs.map((record) => [record.componentType, record]));
    const expectedRoomInstallCategory = getComponentRefitPressure(componentItems.room).total > 0 ? "refit" : "native";
    checkEqual(result, "Install helpers create one install state record each", 6, helperInstallState.installs.length);
    check(result, "Install helpers record all component types", [
      ARCFLIGHT_ITEM_TYPES.HULL,
      ARCFLIGHT_ITEM_TYPES.ARKENGINE,
      ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
      ARCFLIGHT_ITEM_TYPES.ROOM,
      ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
      ARCFLIGHT_ITEM_TYPES.CREW_ASSET
    ].every((componentType) => helperInstallTypes.includes(componentType)), "all helper component types", helperInstallTypes);
    check(result, "Install helper records include lifecycle fields", helperInstallRecordsHaveCoreFields, "core lifecycle fields", helperInstallState.installs);
    check(result, "Install helper records use stable categories", helperInstallCategories[ARCFLIGHT_ITEM_TYPES.HULL] === "native"
      && helperInstallCategories[ARCFLIGHT_ITEM_TYPES.ARKENGINE] === "native"
      && helperInstallCategories[ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD] === "refit"
      && helperInstallCategories[ARCFLIGHT_ITEM_TYPES.ROOM] === expectedRoomInstallCategory
      && helperInstallCategories[ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE] === "refit"
      && helperInstallCategories[ARCFLIGHT_ITEM_TYPES.CREW_ASSET] === "native", "stable install categories", helperInstallCategories);
    checkEqual(result, "Install helper room pressure is recorded", getComponentRefitPressure(componentItems.room).total, helperInstallRecordsByType.get(ARCFLIGHT_ITEM_TYPES.ROOM)?.pressureContribution?.total);

    await actor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: { version: 1, installs: [] } });
    const dryRunBackfillReport = await backfillInstallStateForShip(actor);
    const missingShipsReport = findShipsMissingInstallState();
    const allShipsDryRunReport = await backfillInstallStateForAllShips();
    check(result, "Install-state backfill dry-run finds legacy installed entries", dryRunBackfillReport.dryRun === true && dryRunBackfillReport.wouldCreate.length === 6 && dryRunBackfillReport.created.length === 0, "six dry-run records", dryRunBackfillReport);
    check(result, "Install-state backfill dry-run does not mutate ship", getInstallState(actor).installs.length === 0, "no installState mutation", getInstallState(actor));
    check(result, "Install-state missing ship finder includes smoke ship", missingShipsReport.some((entry) => entry.shipId === actor.id && entry.wouldCreate.length === 6), "smoke ship missing report", missingShipsReport);
    check(result, "Install-state all-ships backfill defaults to dry-run", allShipsDryRunReport.dryRun === true && allShipsDryRunReport.created === 0 && allShipsDryRunReport.wouldCreate >= 6, "dry-run aggregate", allShipsDryRunReport);
    check(result, "Install-state backfill records carry backfilled metadata", dryRunBackfillReport.wouldCreate.every((record) => record.installCategory === "backfilled" && record.nativeInstall === false && record.refitInstall === false && record.temporaryInstall === false && record.notes === "Backfilled from existing installed ship data." && record.active === true && record.installedAt > 0), "backfill metadata", dryRunBackfillReport.wouldCreate);
    await actor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: helperInstallState });

    const originalHullInstallId = helperInstallRecordsByType.get(ARCFLIGHT_ITEM_TYPES.HULL)?.installId;
    const originalArkengineInstallId = helperInstallRecordsByType.get(ARCFLIGHT_ITEM_TYPES.ARKENGINE)?.installId;
    await installHull(actor, componentItems.replacementHull);
    await installArkengine(actor, componentItems.replacementArkengine);
    const replacementInstallState = getInstallState(actor);
    const inactiveReplacementRecords = getInactiveInstallRecords(actor);
    const replacedHullRecord = replacementInstallState.installs.find((record) => record.installId === originalHullInstallId);
    const replacedArkengineRecord = replacementInstallState.installs.find((record) => record.installId === originalArkengineInstallId);
    const activeReplacementRecords = getActiveInstallRecords(actor);
    checkEqual(result, "Replacing hull and arkengine preserves install history", 8, replacementInstallState.installs.length);
    check(result, "Replacing hull deactivates previous hull install", replacedHullRecord?.active === false && replacedHullRecord?.removalReason === "replaced" && replacedHullRecord?.removedAt > 0 && replacedHullRecord?.removedBy && replacedHullRecord?.replacedByInstallId, "replaced hull metadata", replacedHullRecord);
    check(result, "Replacing arkengine deactivates previous arkengine install", replacedArkengineRecord?.active === false && replacedArkengineRecord?.removalReason === "replaced" && replacedArkengineRecord?.removedAt > 0 && replacedArkengineRecord?.removedBy && replacedArkengineRecord?.replacedByInstallId, "replaced arkengine metadata", replacedArkengineRecord);
    checkEqual(result, "Inactive replacement records are preserved", 2, inactiveReplacementRecords.filter((record) => [ARCFLIGHT_ITEM_TYPES.HULL, ARCFLIGHT_ITEM_TYPES.ARKENGINE].includes(record.componentType)).length);
    checkEqual(result, "Active install counts remain correct after replacement", 6, activeReplacementRecords.length);
    checkEqual(result, "Replacement hull remains active", componentItems.replacementHull.id, getArcflightShipData(actor).installed.hullItemId);
    checkEqual(result, "Replacement arkengine remains active", componentItems.replacementArkengine.id, getArcflightShipData(actor).installed.arkengineItemId);

    await expectInstallBlocked(result, "Room slot overflow install blocks", () => installRoom(actor, componentItems.overflowRoom), "expansion room slot capacity");
    await expectInstallBlocked(result, "Arkengine mod slot overflow install blocks", () => installArkengineMod(actor, componentItems.overflowArkengineMod), "mod slot capacity");
    await expectInstallBlocked(result, "Duplicate unique crew asset blocks", () => addCrewAsset(actor, componentItems.crewAsset), "unique crew roster entry");
    checkEqual(result, "Blocked install attempts preserve install state records", 8, getInstallState(actor).installs.length);

    await expectInstallBlocked(result, "Weapon invalid arc blocks", () => installWeapon(actor, componentItems.weapon, { mountId: "fore-1", arc: "dorsal" }), "valid weapon arc");
    await expectInstallBlocked(result, "Weapon missing mount blocks", () => installWeapon(actor, componentItems.weapon, { mountId: "fore-99", arc: "fore" }), "does not exist");
    await expectInstallBlocked(result, "Weapon incompatible size blocks", () => installWeapon(actor, componentItems.oversizedWeapon, { mountId: "fore-1", arc: "fore" }), "is not allowed");
    await expectInstallBlocked(result, "Weapon incompatible arc blocks", () => installWeapon(actor, componentItems.incompatibleArcWeapon, { mountId: "aft-1", arc: "aft" }), "not compatible");
    await installWeapon(actor, componentItems.weapon, { mountId: "fore-1", arc: "fore" });
    let weaponShipData = getArcflightShipData(actor);
    const installedWeapon = weaponShipData.installed.weapons[0];
    const weaponInstallRecord = getActiveInstallRecords(actor).find((record) => record.componentType === ARCFLIGHT_ITEM_TYPES.WEAPON && record.hullSlot === installedWeapon?.mountedWeaponId);
    check(result, "Install weapon into valid mount works", weaponShipData.installed.weapons.length === 1 && weaponShipData.base.hull.weaponMounts.fore[0].occupied === true && Boolean(weaponInstallRecord), "installed weapon and active installState", { weapon: installedWeapon, weaponInstallRecord });
    await expectInstallBlocked(result, "Weapon occupied mount blocks", () => installWeapon(actor, componentItems.incompatibleArcWeapon, { mountId: "fore-1", arc: "fore" }), "already occupied");
    await removeInstalledWeapon(actor, installedWeapon.mountedWeaponId);
    weaponShipData = getArcflightShipData(actor);
    const removedWeaponRecord = getInactiveInstallRecords(actor).find((record) => record.componentType === ARCFLIGHT_ITEM_TYPES.WEAPON && record.hullSlot === installedWeapon.mountedWeaponId);
    check(result, "Remove weapon frees mount", weaponShipData.installed.weapons.length === 0 && weaponShipData.base.hull.weaponMounts.fore[0].occupied === false, "weapon removed and mount free", weaponShipData.base.hull.weaponMounts.fore[0]);
    check(result, "Remove weapon deactivates installState", removedWeaponRecord?.active === false && removedWeaponRecord?.removalReason === "removed" && removedWeaponRecord?.removedAt > 0, "inactive weapon installState", removedWeaponRecord);

    const preservedCurrent = { hull: 120, lifeveil: 4, strain: 2, morale: 1, supplies: 3, storedSpellRanks: 7 };
    await actor.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: preservedCurrent
    });

    let shipData = getArcflightShipData(actor);
    const crewEntry = shipData.crew.namedCrew[0];
    await assignStation(actor, "engineer", crewEntry, { assigneeType: "crewAsset" });

    await attemptDuplicateInstall(result, "Duplicate hull install attempt", () => installHull(actor, componentItems.replacementHull));
    await attemptDuplicateInstall(result, "Duplicate arkengine install attempt", () => installArkengine(actor, componentItems.replacementArkengine));
    await attemptDuplicateInstall(result, "Duplicate arkengine mod install attempt", () => installArkengineMod(actor, componentItems.arkengineMod));
    await attemptDuplicateInstall(result, "Duplicate room install attempt", () => installRoom(actor, componentItems.room));
    await attemptDuplicateInstall(result, "Duplicate ship upgrade install attempt", () => installShipUpgrade(actor, componentItems.shipUpgrade));
    await attemptDuplicateInstall(result, "Duplicate crew asset install attempt", () => addCrewAsset(actor, componentItems.crewAsset));
    checkEqual(result, "Duplicate install attempts do not create duplicate install state records", 9, getInstallState(actor).installs.length);

    await recalculateShipStats(actor);
    shipData = getArcflightShipData(actor);

    let actionEconomy = getShipActionEconomy(actor);
    check(result, "Ship action economy initializes from derived hull AP/RAP", actionEconomy.maxAP === shipData.derived.baseAP && actionEconomy.maxRAP === shipData.derived.baseRAP && actionEconomy.ap === actionEconomy.maxAP && actionEconomy.rap === actionEconomy.maxRAP, "current/max from derived baseAP/baseRAP", { actionEconomy, derived: { baseAP: shipData.derived.baseAP, baseRAP: shipData.derived.baseRAP } });
    await actor.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.system.current.supplies`]: null,
      [`flags.${ARCFLIGHT_MODULE_ID}.system.resources.supplies`]: 4
    });
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Current supplies normalizes from legacy resources fallback", 4, shipData.current.supplies);
    await actor.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.system.current.supplies`]: 2,
      [`flags.${ARCFLIGHT_MODULE_ID}.system.current.lifeveil`]: 1,
      [`flags.${ARCFLIGHT_MODULE_ID}.system.current.hull`]: 1
    });
    shipData = getArcflightShipData(actor);
    actionEconomy = getShipActionEconomy(actor);
    const beforeTravelResources = getShipTravelResources(actor);
    const previewTravelResources = previewShipTravelResourceChange(actor, { strain: 1, lifeveil: -99, hull: -99, supplies: -99 });
    const afterPreviewData = getArcflightShipData(actor);
    check(result, "getShipTravelResources helper exists", typeof getShipTravelResources === "function" && beforeTravelResources.supplies === 2, "helper and normalized resources", beforeTravelResources);
    check(result, "previewShipTravelResourceChange does not mutate", afterPreviewData.current.strain === shipData.current.strain && afterPreviewData.current.supplies === shipData.current.supplies, "unchanged current state", { before: shipData.current, after: afterPreviewData.current });
    check(result, "Travel clamps prevent negative supplies/lifeveil/hull", previewTravelResources.after.supplies === 0 && previewTravelResources.after.lifeveil === 0 && previewTravelResources.after.hull === 0 && previewTravelResources.warnings.length >= 3, "clamped resources", previewTravelResources);
    const beforeTravelEconomy = getShipActionEconomy(actor);
    const updatedTravelResources = await updateShipTravelResources(actor, { strain: 1, supplies: -1 });
    const afterTravelEconomy = getShipActionEconomy(actor);
    shipData = getArcflightShipData(actor);
    check(result, "updateShipTravelResources changes current strain/current supplies safely", shipData.current.strain === beforeTravelResources.strain + 1 && shipData.current.supplies === 1 && updatedTravelResources.strain === shipData.current.strain && updatedTravelResources.supplies === shipData.current.supplies, "updated current resources", { current: shipData.current, updatedTravelResources });
    check(result, "Travel resource helpers do not change AP/RAP", beforeTravelEconomy.ap === afterTravelEconomy.ap && beforeTravelEconomy.rap === afterTravelEconomy.rap, "unchanged AP/RAP", { before: beforeTravelEconomy, after: afterTravelEconomy });
    check(result, "Travel resource helpers exposed", typeof globalThis.game?.arcflight?.getShipTravelResources === "function" && typeof globalThis.game?.arcflight?.previewShipTravelResourceChange === "function" && typeof globalThis.game?.arcflight?.updateShipTravelResources === "function" && typeof globalThis.game?.arcflight?.getTravelStationKeys === "function" && typeof globalThis.game?.arcflight?.isTravelStationKey === "function", true, { getShipTravelResources: typeof globalThis.game?.arcflight?.getShipTravelResources, previewShipTravelResourceChange: typeof globalThis.game?.arcflight?.previewShipTravelResourceChange, updateShipTravelResources: typeof globalThis.game?.arcflight?.updateShipTravelResources, getTravelStationKeys: typeof globalThis.game?.arcflight?.getTravelStationKeys, isTravelStationKey: typeof globalThis.game?.arcflight?.isTravelStationKey });
    check(result, "Travel resource devTools exposed", typeof globalThis.game?.arcflight?.devTools?.getShipTravelResources === "function" && typeof globalThis.game?.arcflight?.devTools?.previewShipTravelResourceChange === "function" && typeof globalThis.game?.arcflight?.devTools?.updateShipTravelResources === "function" && typeof globalThis.game?.arcflight?.devTools?.getTravelStationKeys === "function" && typeof globalThis.game?.arcflight?.devTools?.isTravelStationKey === "function", true, { getShipTravelResources: typeof globalThis.game?.arcflight?.devTools?.getShipTravelResources, previewShipTravelResourceChange: typeof globalThis.game?.arcflight?.devTools?.previewShipTravelResourceChange, updateShipTravelResources: typeof globalThis.game?.arcflight?.devTools?.updateShipTravelResources, getTravelStationKeys: typeof globalThis.game?.arcflight?.devTools?.getTravelStationKeys, isTravelStationKey: typeof globalThis.game?.arcflight?.devTools?.isTravelStationKey });
    const emptyTravelEventState = getShipTravelEventState(actor);
    check(result, "Travel event state initializes empty", emptyTravelEventState.activeEvent === null && Array.isArray(emptyTravelEventState.completedEvents) && emptyTravelEventState.completedEvents.length === 0, "empty travel event state", emptyTravelEventState);
    const travelEventEconomyBefore = getShipActionEconomy(actor);
    const travelEventResourcesBefore = getShipTravelResources(actor);
    const activeTravelEvent = await startShipTravelEvent(actor, "black-tide-crossing");
    check(result, "Start Black Tide Crossing creates active event", activeTravelEvent?.eventKey === "black-tide-crossing" && activeTravelEvent.currentRound === 1 && activeTravelEvent.rounds.length === 5, "active Black Tide event", activeTravelEvent);
    try {
      await startShipTravelEvent(actor, "black-tide-crossing");
      check(result, "Starting second travel event blocks", false, "active event rejection", "accepted");
    } catch (error) {
      check(result, "Starting second travel event blocks", error.message.includes("already has an active travel event"), "active event rejection", error.message);
    }
    checkEqual(result, "Current travel round is 1", 1, getCurrentShipTravelRound(actor)?.round);
    const manualPlayerAction = "Smoke navigator sounds the safest current.";
    const manualFeedbackText = "Smoke navigator keeps the ship aligned.";
    await recordShipTravelStationResult(actor, { stationKey: "navigator", degreeOfSuccess: "success", actorName: "Smoke Navigator", playerAction: manualPlayerAction, feedbackText: manualFeedbackText, narrativeText: manualFeedbackText });
    let currentTravelRound = getCurrentShipTravelRound(actor);
    const navigatorResult = currentTravelRound.stationResults.find((entry) => entry.stationKey === "navigator");
    check(result, "Manual station result stores playerAction and feedbackText", navigatorResult?.playerAction === manualPlayerAction && navigatorResult?.feedbackText === manualFeedbackText && navigatorResult?.narrativeText === manualFeedbackText, "stored narrative fields", navigatorResult);
    check(result, "Navigator success adds +1 success", currentTravelRound.successes === 1 && getActiveShipTravelEvent(actor).totals.successes === 1, "+1 success", { round: currentTravelRound, totals: getActiveShipTravelEvent(actor).totals });
    const pf2eFeedbackText = "Smoke engineer overcorrects the arkengine pitch.";
    await recordShipTravelStationResult(actor, { stationKey: "engineer", degreeOfSuccess: "criticalFailure", actorName: "Smoke Engineer", actorUuid: actor.uuid, actorId: actor.id, statisticKey: "crafting", rollTotal: 9, rollId: "smoke-roll", messageId: "smoke-message", source: "pf2e-roll", feedbackText: pf2eFeedbackText, narrativeText: pf2eFeedbackText });
    currentTravelRound = getCurrentShipTravelRound(actor);
    const engineerResult = currentTravelRound.stationResults.find((entry) => entry.stationKey === "engineer");
    check(result, "PF2E-style station result stores feedbackText and preserves roll metadata", engineerResult?.feedbackText === pf2eFeedbackText && engineerResult?.source === "pf2e-roll" && engineerResult?.actorUuid === actor.uuid && engineerResult?.actorId === actor.id && engineerResult?.statisticKey === "crafting" && engineerResult?.rollTotal === 9 && engineerResult?.rollId === "smoke-roll" && engineerResult?.messageId === "smoke-message", "stored PF2E-style result", engineerResult);
    const narrativeRows = prepareTravelEventNarrativeLog(getActiveShipTravelEvent(actor));
    check(result, "Travel event narrative log preparation returns round-ordered entries", narrativeRows.length === 2 && narrativeRows[0].roundNumber === 1 && narrativeRows[0].stationKey === "navigator" && narrativeRows[1].stationKey === "engineer" && narrativeRows[0].playerAction === manualPlayerAction && narrativeRows[1].resultText === pf2eFeedbackText, "narrative log rows", narrativeRows);
    currentTravelRound = getCurrentShipTravelRound(actor);
    check(result, "Engineer criticalFailure adds +2 failures and +1 criticalFailure", currentTravelRound.failures === 2 && currentTravelRound.criticalFailures === 1 && getActiveShipTravelEvent(actor).totals.failures === 2 && getActiveShipTravelEvent(actor).totals.criticalFailures === 1, "+2 failures/+1 criticalFailure", { round: currentTravelRound, totals: getActiveShipTravelEvent(actor).totals });
    try {
      await recordShipTravelStationResult(actor, { stationKey: "navigator", degreeOfSuccess: "success", actorName: "Duplicate Navigator" });
      check(result, "Duplicate same station travel result blocks by default", false, "duplicate rejection", "accepted");
    } catch (error) {
      check(result, "Duplicate same station travel result blocks by default", error.message.includes("already has a primary result"), "duplicate rejection", error.message);
    }
    const advancedTravelEvent = await advanceShipTravelEventRound(actor);
    const advancedRound = advancedTravelEvent.rounds.find((round) => round.round === 1);
    check(result, "Advance round stores outcome and stagedEffects", advancedRound.outcomeKey === "dominantFailure" && Array.isArray(advancedRound.stagedEffects) && advancedRound.stagedEffects.length > 0 && advancedTravelEvent.currentRound === 2, "round outcome with staged effects", advancedRound);
    const travelEventEconomyAfterAdvance = getShipActionEconomy(actor);
    const travelEventResourcesAfterAdvance = getShipTravelResources(actor);
    check(result, "Travel event state helpers leave AP/RAP unchanged", travelEventEconomyBefore.ap === travelEventEconomyAfterAdvance.ap && travelEventEconomyBefore.rap === travelEventEconomyAfterAdvance.rap, "unchanged AP/RAP", { before: travelEventEconomyBefore, after: travelEventEconomyAfterAdvance });
    check(result, "Travel event state helpers leave ship travel resources unchanged", JSON.stringify(travelEventResourcesBefore) === JSON.stringify(travelEventResourcesAfterAdvance), "unchanged travel resources", { before: travelEventResourcesBefore, after: travelEventResourcesAfterAdvance });
    const stagedResourceEffect = advancedRound.stagedEffects.find((effect) => effect.type === "resource");
    const stagedResourcesBeforePreview = getShipTravelResources(actor);
    const stagedPreview = previewTravelStagedEffectApplication(actor, stagedResourceEffect);
    const stagedResourcesAfterPreview = getShipTravelResources(actor);
    check(result, "Preview staged resource effect does not mutate", stagedPreview.supported === true && JSON.stringify(stagedResourcesBeforePreview) === JSON.stringify(stagedResourcesAfterPreview), "preview without mutation", { preview: stagedPreview, before: stagedResourcesBeforePreview, after: stagedResourcesAfterPreview });
    const stagedEconomyBeforeApply = getShipActionEconomy(actor);
    const stagedApplyResult = await applyTravelStagedEffect(actor, stagedResourceEffect, { source: "activeRound", round: 1, effectIndex: advancedRound.stagedEffects.indexOf(stagedResourceEffect) });
    const stagedEconomyAfterApply = getShipActionEconomy(actor);
    const stagedResourcesAfterApply = getShipTravelResources(actor);
    const otherTravelResourceKeysUnchanged = ["hull", "lifeveil", "strain", "morale", "supplies", "storedSpellRanks"].filter((key) => key !== stagedResourceEffect.resource).every((key) => stagedResourcesAfterApply[key] === stagedResourcesBeforePreview[key]);
    check(result, "Apply staged resource effect changes current resource only", stagedApplyResult.ok === true && stagedResourcesAfterApply[stagedResourceEffect.resource] === stagedPreview.after[stagedResourceEffect.resource] && otherTravelResourceKeysUnchanged, "only staged resource changed", { effect: stagedResourceEffect, preview: stagedPreview, before: stagedResourcesBeforePreview, after: stagedResourcesAfterApply });
    check(result, "Apply staged resource effect leaves AP/RAP unchanged", stagedEconomyBeforeApply.ap === stagedEconomyAfterApply.ap && stagedEconomyBeforeApply.rap === stagedEconomyAfterApply.rap, "unchanged AP/RAP", { before: stagedEconomyBeforeApply, after: stagedEconomyAfterApply });
    const doubleApplyResult = await applyTravelStagedEffect(actor, getActiveShipTravelEvent(actor).rounds.find((round) => round.round === 1).stagedEffects[advancedRound.stagedEffects.indexOf(stagedResourceEffect)], { source: "activeRound", round: 1, effectIndex: advancedRound.stagedEffects.indexOf(stagedResourceEffect) });
    check(result, "Double apply staged effect is blocked", doubleApplyResult.ok === false && doubleApplyResult.reason === "already-applied", "double apply blocked", doubleApplyResult);
    const unsupportedApplyResult = await applyTravelStagedEffect(actor, { type: "modifier", target: "nextRound.navigator.dc", mode: "add", value: 1, label: "Unsupported Smoke Modifier" }, { source: "activeRound", round: 1, effectIndex: 999 });
    check(result, "Unsupported staged effect does not crash", unsupportedApplyResult.unsupported === true && unsupportedApplyResult.skipped === true, "unsupported skipped", unsupportedApplyResult);
    const stagedBulkUnsupportedEconomyBefore = getShipActionEconomy(actor);
    const stagedBulkUnsupportedResourcesBefore = getShipTravelResources(actor);
    const stagedBulkUnsupportedResult = await applyTravelStagedEffects(actor, [{ type: "note", label: "Unsupported Smoke Note" }], { source: "activeRound", round: 1 });
    const stagedBulkUnsupportedEconomyAfter = getShipActionEconomy(actor);
    const stagedBulkUnsupportedResourcesAfter = getShipTravelResources(actor);
    check(result, "Bulk staged effects helper skips unsupported effects safely", stagedBulkUnsupportedResult.ok === true && stagedBulkUnsupportedResult.skippedCount === 1 && JSON.stringify(stagedBulkUnsupportedResourcesBefore) === JSON.stringify(stagedBulkUnsupportedResourcesAfter) && stagedBulkUnsupportedEconomyBefore.ap === stagedBulkUnsupportedEconomyAfter.ap && stagedBulkUnsupportedEconomyBefore.rap === stagedBulkUnsupportedEconomyAfter.rap, "bulk unsupported skipped without mutation", { result: stagedBulkUnsupportedResult, resourcesBefore: stagedBulkUnsupportedResourcesBefore, resourcesAfter: stagedBulkUnsupportedResourcesAfter, economyBefore: stagedBulkUnsupportedEconomyBefore, economyAfter: stagedBulkUnsupportedEconomyAfter });
    const completedTravelState = await completeShipTravelEvent(actor);
    const completedNarrativeRows = prepareTravelEventNarrativeLog(completedTravelState.completedEvents[0]);
    check(result, "Complete travel event moves to completedEvents and clears activeEvent", completedTravelState.activeEvent === null && completedTravelState.completedEvents.length === 1 && completedTravelState.completedEvents[0].eventKey === "black-tide-crossing" && completedTravelState.completedEvents[0].stagedFinalEffects.length > 0, "completed travel state", completedTravelState);
    check(result, "Completed travel event preserves narrative log station results", completedNarrativeRows.length >= 2 && completedNarrativeRows[0].stationKey === "navigator" && completedNarrativeRows[1].stationKey === "engineer", "completed narrative rows", completedNarrativeRows);
    await startShipTravelEvent(actor, "black-tide-crossing");
    const clearedTravelState = await clearShipTravelEvent(actor);
    check(result, "Clear travel event helper works", clearedTravelState.activeEvent === null, "cleared active event", clearedTravelState);
    check(result, "Ship travel event helpers exposed", typeof globalThis.game?.arcflight?.getShipTravelEventState === "function" && typeof globalThis.game?.arcflight?.getActiveShipTravelEvent === "function" && typeof globalThis.game?.arcflight?.startShipTravelEvent === "function" && typeof globalThis.game?.arcflight?.recordShipTravelStationResult === "function" && typeof globalThis.game?.arcflight?.getCurrentShipTravelRound === "function" && typeof globalThis.game?.arcflight?.advanceShipTravelEventRound === "function" && typeof globalThis.game?.arcflight?.completeShipTravelEvent === "function" && typeof globalThis.game?.arcflight?.clearShipTravelEvent === "function" && typeof globalThis.game?.arcflight?.previewTravelStagedEffectApplication === "function" && typeof globalThis.game?.arcflight?.applyTravelStagedEffect === "function" && typeof globalThis.game?.arcflight?.applyTravelStagedEffects === "function", true, { getShipTravelEventState: typeof globalThis.game?.arcflight?.getShipTravelEventState, startShipTravelEvent: typeof globalThis.game?.arcflight?.startShipTravelEvent });
    check(result, "Ship travel event devTools exposed", typeof globalThis.game?.arcflight?.devTools?.getShipTravelEventState === "function" && typeof globalThis.game?.arcflight?.devTools?.getActiveShipTravelEvent === "function" && typeof globalThis.game?.arcflight?.devTools?.startShipTravelEvent === "function" && typeof globalThis.game?.arcflight?.devTools?.recordShipTravelStationResult === "function" && typeof globalThis.game?.arcflight?.devTools?.getCurrentShipTravelRound === "function" && typeof globalThis.game?.arcflight?.devTools?.advanceShipTravelEventRound === "function" && typeof globalThis.game?.arcflight?.devTools?.completeShipTravelEvent === "function" && typeof globalThis.game?.arcflight?.devTools?.clearShipTravelEvent === "function" && typeof globalThis.game?.arcflight?.devTools?.previewTravelStagedEffectApplication === "function" && typeof globalThis.game?.arcflight?.devTools?.applyTravelStagedEffect === "function" && typeof globalThis.game?.arcflight?.devTools?.applyTravelStagedEffects === "function", true, { getShipTravelEventState: typeof globalThis.game?.arcflight?.devTools?.getShipTravelEventState, startShipTravelEvent: typeof globalThis.game?.arcflight?.devTools?.startShipTravelEvent });
    const travelRunnerReadout = prepareTravelRunnerReadout(actor);
    const travelEventLibraryOptions = prepareTravelEventLibraryOptions("black-tide-crossing");
    const selectedTravelEventDetails = prepareSelectedTravelEventLibraryDetails("black-tide-crossing");
    const blackTideLibraryOption = travelEventLibraryOptions.find((option) => option.key === "black-tide-crossing");
    check(result, "Travel event library options build from core registry", travelEventLibraryOptions.length === CORE_TRAVEL_EVENT_KEYS.length && travelEventLibraryOptions.every((option) => CORE_TRAVEL_EVENT_KEYS.includes(option.key)), "library options from core registry", travelEventLibraryOptions.map((option) => option.key));
    check(result, "Travel event library includes all core travel events", EXPECTED_CORE_TRAVEL_EVENT_KEYS.every((key) => travelEventLibraryOptions.some((option) => option.key === key)), EXPECTED_CORE_TRAVEL_EVENT_KEYS, travelEventLibraryOptions.map((option) => option.key));
    check(result, "Travel event library includes Black Tide Crossing", blackTideLibraryOption?.key === "black-tide-crossing" && blackTideLibraryOption.selected === true, "Black Tide Crossing library option", blackTideLibraryOption);
    check(result, "Travel event library selected details exist", selectedTravelEventDetails?.key === "black-tide-crossing" && selectedTravelEventDetails.roundCount === 5 && selectedTravelEventDetails.baseDC === 20 && selectedTravelEventDetails.category === "environmental", "selected Black Tide details", selectedTravelEventDetails);
    const derelictSelectedTravelEventDetails = prepareSelectedTravelEventLibraryDetails("derelict-lantern-wreck");
    const feverSelectedTravelEventDetails = prepareSelectedTravelEventLibraryDetails("crew-fever-in-the-lifeveil");
    const falseBeaconSelectedTravelEventDetails = prepareSelectedTravelEventLibraryDetails("false-beacon-ambush");
    const portsideSelectedTravelEventDetails = prepareSelectedTravelEventLibraryDetails("portside-diplomatic-snare");
    check(result, "Travel event library selected details work for Derelict Lantern Wreck", derelictSelectedTravelEventDetails?.key === "derelict-lantern-wreck" && derelictSelectedTravelEventDetails.roundCount === 4 && derelictSelectedTravelEventDetails.baseDC === 19 && derelictSelectedTravelEventDetails.category === "discovery", "selected Derelict Lantern Wreck details", derelictSelectedTravelEventDetails);
    check(result, "Travel event library selected details work for Crew Fever in the Lifeveil", feverSelectedTravelEventDetails?.key === "crew-fever-in-the-lifeveil" && feverSelectedTravelEventDetails.roundCount === 4 && feverSelectedTravelEventDetails.baseDC === 18 && feverSelectedTravelEventDetails.category === "shipboard", "selected Crew Fever in the Lifeveil details", feverSelectedTravelEventDetails);
    check(result, "Travel event library selected details work for False Beacon Ambush", falseBeaconSelectedTravelEventDetails?.key === "false-beacon-ambush" && falseBeaconSelectedTravelEventDetails.roundCount === 4 && falseBeaconSelectedTravelEventDetails.baseDC === 20 && falseBeaconSelectedTravelEventDetails.category === "threat", "selected False Beacon Ambush details", falseBeaconSelectedTravelEventDetails);
    check(result, "Travel event library selected details work for Portside Diplomatic Snare", portsideSelectedTravelEventDetails?.key === "portside-diplomatic-snare" && portsideSelectedTravelEventDetails.roundCount === 4 && portsideSelectedTravelEventDetails.baseDC === 18 && portsideSelectedTravelEventDetails.category === "social", "selected Portside Diplomatic Snare details", portsideSelectedTravelEventDetails);
    check(result, "Travel runner app imports and helpers are exposed", typeof ArcflightTravelEventRunner === "function" && typeof openTravelEventRunner === "function" && typeof prepareTravelEventLibraryOptions === "function" && typeof prepareSelectedTravelEventLibraryDetails === "function" && typeof prepareTravelEventNarrativeLog === "function" && typeof globalThis.game?.arcflight?.openTravelEventRunner === "function" && typeof globalThis.game?.arcflight?.devTools?.openTravelEventRunner === "function" && typeof globalThis.game?.arcflight?.ArcflightTravelEventRunner === "function" && typeof globalThis.game?.arcflight?.devTools?.ArcflightTravelEventRunner === "function" && typeof globalThis.game?.arcflight?.prepareTravelEventLibraryOptions === "function" && typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventLibraryOptions === "function" && typeof globalThis.game?.arcflight?.prepareTravelEventNarrativeLog === "function" && typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventNarrativeLog === "function", true, { importedClass: typeof ArcflightTravelEventRunner, importedHelper: typeof openTravelEventRunner, importedLibraryHelper: typeof prepareTravelEventLibraryOptions, importedNarrativeHelper: typeof prepareTravelEventNarrativeLog, apiHelper: typeof globalThis.game?.arcflight?.openTravelEventRunner, devToolsHelper: typeof globalThis.game?.arcflight?.devTools?.openTravelEventRunner, apiLibraryHelper: typeof globalThis.game?.arcflight?.prepareTravelEventLibraryOptions, apiNarrativeHelper: typeof globalThis.game?.arcflight?.prepareTravelEventNarrativeLog, devToolsNarrativeHelper: typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventNarrativeLog });
    const runnerSessionLibraryHelpersExist = [getTravelEventRunnerSessionLibrary, saveTravelEventRunnerSessionToLibrary, loadTravelEventRunnerSessionFromLibrary, deleteTravelEventRunnerSessionFromLibrary, duplicateTravelEventRunnerSession, prepareTravelEventRunnerSessionLibraryState, cloneTravelEventRunnerSession].every((helper) => typeof helper === "function")
      && typeof globalThis.game?.arcflight?.getTravelEventRunnerSessionLibrary === "function"
      && typeof globalThis.game?.arcflight?.devTools?.getTravelEventRunnerSessionLibrary === "function"
      && typeof globalThis.game?.arcflight?.saveTravelEventRunnerSessionToLibrary === "function"
      && typeof globalThis.game?.arcflight?.devTools?.saveTravelEventRunnerSessionToLibrary === "function";
    check(result, "Travel Event Runner Session Library helpers exist", runnerSessionLibraryHelpersExist, true, { getTravelEventRunnerSessionLibrary: typeof getTravelEventRunnerSessionLibrary, api: typeof globalThis.game?.arcflight?.getTravelEventRunnerSessionLibrary, devTools: typeof globalThis.game?.arcflight?.devTools?.getTravelEventRunnerSessionLibrary });

    const emptyRunnerSessionLibrary = getTravelEventRunnerSessionLibrary({ library: null });
    const emptyRunnerSessionLibraryState = prepareTravelEventRunnerSessionLibraryState({ library: null });
    const emptyRunnerUiState = prepareTravelEventRunnerState(null, { library: { version: 1, events: {} }, runnerSessionLibrary: emptyRunnerSessionLibrary });
    check(result, "Empty runner session library state is safe", emptyRunnerSessionLibrary.version === 1 && Object.keys(emptyRunnerSessionLibrary.sessions).length === 0 && emptyRunnerSessionLibraryState.count === 0 && emptyRunnerSessionLibraryState.hasSessions === false, "empty safe library", { emptyRunnerSessionLibrary, emptyRunnerSessionLibraryState });
    check(result, "Travel Event Runner state includes empty runner session library state", emptyRunnerUiState.sessionLibrary?.count === 0 && emptyRunnerUiState.hasSavedSessions === false && emptyRunnerUiState.canSaveSession === false && emptyRunnerUiState.canSaveSessionAs === false, "empty UI state", emptyRunnerUiState.sessionLibrary);

    const runnerFixtureKey = "phase-k-runner-session-smoke";
    const runnerFixtureEvent = JSON.parse(JSON.stringify(getCoreTravelEvent("black-tide-crossing")));
    runnerFixtureEvent.key = runnerFixtureKey;
    runnerFixtureEvent.name = "Phase K Runner Session Smoke";
    runnerFixtureEvent.finalOutcomes = {
      criticalSuccess: { label: "Critical Success", text: "The smoke fixture ends in a decisive success.", proposedEffects: [{ type: "resource", resource: "morale", mode: "add", value: 2, label: "Read-only morale boon" }] },
      success: { label: "Success", text: "The smoke fixture ends in success.", proposedEffects: [{ type: "resource", resource: "supplies", mode: "add", value: 1, label: "Read-only supplies boon" }] },
      mixed: { label: "Mixed", text: "The smoke fixture ends with a mixed result.", proposedEffects: [{ type: "resource", resource: "strain", mode: "add", value: 1, label: "Read-only strain cost" }] },
      failure: { label: "Failure", text: "The smoke fixture ends in failure.", proposedEffects: [{ type: "resource", resource: "hull", mode: "add", value: -1, label: "Read-only hull cost" }] },
      criticalFailure: { label: "Critical Failure", text: "The smoke fixture ends in critical failure.", proposedEffects: [{ type: "resource", resource: "hull", mode: "add", value: -2, label: "Read-only severe hull cost" }] }
    };
    const runnerFixturePublishedLibrary = {
      version: 1,
      events: {
        [runnerFixtureKey]: {
          id: runnerFixtureKey,
          key: runnerFixtureKey,
          name: runnerFixtureEvent.name,
          category: runnerFixtureEvent.category,
          publishedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          sourceDraftId: "framework-smoke",
          version: 1,
          event: runnerFixtureEvent
        }
      }
    };
    await globalThis.game.settings.set(ARCFLIGHT_MODULE_ID, PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING, runnerFixturePublishedLibrary);
    await globalThis.game.settings.set(ARCFLIGHT_MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING, { version: 1, sessions: {} });

    const loadedRunnerFixtureEvent = loadPublishedTravelEventFromLibrary(runnerFixtureKey);
    check(result, "Travel Event Runner Session Library smoke creates/uses a valid published fixture", loadedRunnerFixtureEvent.ok === true && loadedRunnerFixtureEvent.event?.key === runnerFixtureKey, "published runner fixture", loadedRunnerFixtureEvent.entry);

    let runnerSessionActorBefore = stringifySmokeData(actor.toObject?.() ?? actor);
    let runnerSessionResourcesBefore = getShipTravelResources(actor);
    let runnerSessionEconomyBefore = getShipActionEconomy(actor);
    let runnerSessionChatBefore = globalThis.game?.messages?.size ?? globalThis.game?.messages?.contents?.length ?? 0;
    let runnerSessionCombatsBefore = globalThis.game?.combats?.size ?? globalThis.game?.combats?.contents?.length ?? 0;
    let runnerSessionActiveCombatBefore = globalThis.game?.combat?.id ?? "";

    const activeRunnerSessionCreated = createTravelEventRunnerSession(loadedRunnerFixtureEvent.event);
    let activeRunnerSession = activeRunnerSessionCreated.session;
    activeRunnerSession = setTravelEventRunnerStationResult(activeRunnerSession, 0, "navigator", "success").session;
    activeRunnerSession = advanceTravelEventRunnerRound(activeRunnerSession).session;
    activeRunnerSession = setTravelEventRunnerStationResult(activeRunnerSession, 1, "engineer", "criticalSuccess").session;
    const expectedActiveStationResults = activeRunnerSession.roundResults.map((round) => ({ ...round.stationResults }));
    const savedActiveRunnerSession = await saveTravelEventRunnerSessionToLibrary(activeRunnerSession, { now: "2026-01-01T00:01:00.000Z" });
    const loadedActiveRunnerSession = loadTravelEventRunnerSessionFromLibrary(savedActiveRunnerSession.entry?.key);
    check(result, "Save active runner session writes to the runner session library setting", savedActiveRunnerSession.ok === true && getTravelEventRunnerSessionLibrary().sessions[savedActiveRunnerSession.entry?.key]?.status === "active", "saved active setting entry", savedActiveRunnerSession.entry);
    check(result, "Load active runner session restores currentRoundIndex", loadedActiveRunnerSession.ok === true && loadedActiveRunnerSession.session.currentRoundIndex === 1, 1, loadedActiveRunnerSession.session?.currentRoundIndex);
    check(result, "Load active runner session restores station results exactly", stringifySmokeData(loadedActiveRunnerSession.session.roundResults.map((round) => round.stationResults)) === stringifySmokeData(expectedActiveStationResults), "exact station results", { expected: expectedActiveStationResults, actual: loadedActiveRunnerSession.session.roundResults.map((round) => round.stationResults) });

    const populatedRunnerLibraryState = prepareTravelEventRunnerSessionLibraryState({ selectedSessionKey: savedActiveRunnerSession.entry.key });
    const activeRunnerUiState = prepareTravelEventRunnerState(loadedActiveRunnerSession.session, { selectedSessionKey: savedActiveRunnerSession.entry.key });
    check(result, "Travel Event Runner populated library state exposes load/duplicate/delete-ready rows", populatedRunnerLibraryState.count === 1 && populatedRunnerLibraryState.entries[0]?.canLoad === true && populatedRunnerLibraryState.entries[0]?.canDuplicate === true && populatedRunnerLibraryState.entries[0]?.canDelete === true, "populated session rows", populatedRunnerLibraryState.entries);
    check(result, "Travel Event Runner active session UI state exposes save controls", activeRunnerUiState.sessionLibrary?.hasSessions === true && activeRunnerUiState.canSaveSession === true && activeRunnerUiState.canSaveSessionAs === true && activeRunnerUiState.hasSession === true && activeRunnerUiState.isCompleted === false, "active save UI state", { canSaveSession: activeRunnerUiState.canSaveSession, canSaveSessionAs: activeRunnerUiState.canSaveSessionAs });

    const duplicateRunnerSession = await duplicateTravelEventRunnerSession(savedActiveRunnerSession.entry.key, { now: "2026-01-01T00:02:00.000Z" });
    const loadedDuplicateRunnerSession = loadTravelEventRunnerSessionFromLibrary(duplicateRunnerSession.entry?.key);
    check(result, "Duplicate runner session creates distinct key and preserves session data", duplicateRunnerSession.ok === true && duplicateRunnerSession.entry.key !== savedActiveRunnerSession.entry.key && loadedDuplicateRunnerSession.ok === true && loadedDuplicateRunnerSession.session.currentRoundIndex === loadedActiveRunnerSession.session.currentRoundIndex && stringifySmokeData(loadedDuplicateRunnerSession.session.roundResults.map((round) => round.stationResults)) === stringifySmokeData(loadedActiveRunnerSession.session.roundResults.map((round) => round.stationResults)), "duplicated session", { original: savedActiveRunnerSession.entry.key, duplicate: duplicateRunnerSession.entry?.key });
    const deletedDuplicateRunnerSession = await deleteTravelEventRunnerSessionFromLibrary(duplicateRunnerSession.entry.key);
    check(result, "Delete duplicate runner session removes only the duplicate", deletedDuplicateRunnerSession.ok === true && !Object.hasOwn(getTravelEventRunnerSessionLibrary().sessions, duplicateRunnerSession.entry.key) && Object.hasOwn(getTravelEventRunnerSessionLibrary().sessions, savedActiveRunnerSession.entry.key), "deleted duplicate", deletedDuplicateRunnerSession.deleted?.key);

    const completedRunnerSession = completeTravelEventRunnerSession(loadedActiveRunnerSession.session, { now: "2026-01-01T00:03:00.000Z" }).session;
    const expectedCompletedOutcome = completedRunnerSession.summary?.suggestedFinalOutcome;
    const expectedCompletedEffects = completedRunnerSession.summary?.stagedProposedEffects ?? [];
    const savedCompletedRunnerSession = await saveTravelEventRunnerSessionToLibrary(completedRunnerSession, { key: savedActiveRunnerSession.entry.key, overwrite: true, now: "2026-01-01T00:04:00.000Z" });
    const loadedCompletedRunnerSession = loadTravelEventRunnerSessionFromLibrary(savedActiveRunnerSession.entry.key);
    const completedRunnerUiState = prepareTravelEventRunnerState(loadedCompletedRunnerSession.session, { selectedSessionKey: savedActiveRunnerSession.entry.key });
    check(result, "Load completed runner session restores completed status", savedCompletedRunnerSession.ok === true && loadedCompletedRunnerSession.ok === true && loadedCompletedRunnerSession.session.status === "completed" && completedRunnerUiState.isCompleted === true, "loaded completed session", loadedCompletedRunnerSession.session?.status);
    check(result, "Load completed runner session restores suggestedFinalOutcome", loadedCompletedRunnerSession.session.summary?.suggestedFinalOutcome === expectedCompletedOutcome && completedRunnerUiState.summary?.suggestedFinalOutcome === expectedCompletedOutcome, expectedCompletedOutcome, { loaded: loadedCompletedRunnerSession.session.summary?.suggestedFinalOutcome, state: completedRunnerUiState.summary?.suggestedFinalOutcome });
    check(result, "Load completed runner session restores staged proposedEffects as read-only data", expectedCompletedEffects.length > 0 && stringifySmokeData(loadedCompletedRunnerSession.session.summary?.stagedProposedEffects ?? []) === stringifySmokeData(expectedCompletedEffects) && stringifySmokeData(completedRunnerUiState.summary?.stagedProposedEffects ?? []) === stringifySmokeData(expectedCompletedEffects), "read-only staged effects restored", completedRunnerUiState.summary?.stagedProposedEffects);
    check(result, "Travel Event Runner completed session UI state exposes summary and save controls", completedRunnerUiState.summary?.suggestedFinalOutcome === expectedCompletedOutcome && completedRunnerUiState.canSaveSession === true && completedRunnerUiState.canSaveSessionAs === true, "completed save UI state", { canSaveSession: completedRunnerUiState.canSaveSession, canSaveSessionAs: completedRunnerUiState.canSaveSessionAs, summary: completedRunnerUiState.summary });
    check(result, "Runner session library does not mutate actor data before manual apply", runnerSessionActorBefore === stringifySmokeData(actor.toObject?.() ?? actor), "actor unchanged before manual apply", { before: runnerSessionActorBefore, after: stringifySmokeData(actor.toObject?.() ?? actor) });
    check(result, "Runner session library does not mutate ship resources before manual apply", stringifySmokeData(runnerSessionResourcesBefore) === stringifySmokeData(getShipTravelResources(actor)), "resources unchanged before manual apply", { before: runnerSessionResourcesBefore, after: getShipTravelResources(actor) });


    const applicationHelpersExist = typeof prepareTravelEventEffectApplicationState === "function"
      && typeof applyTravelEventRunnerSelectedEffects === "function"
      && typeof applyTravelEventRunnerResourceEffect === "function"
      && typeof getTravelEventAppliedEffectRecords === "function"
      && typeof isTravelEventEffectApplied === "function"
      && typeof globalThis.game?.arcflight?.prepareTravelEventEffectApplicationState === "function";
    check(result, "Travel Event Runner manual apply helper exports exist", applicationHelpersExist, true, { prepareTravelEventEffectApplicationState: typeof prepareTravelEventEffectApplicationState, api: typeof globalThis.game?.arcflight?.prepareTravelEventEffectApplicationState });
    const incompleteApplyState = prepareTravelEventEffectApplicationState(activeRunnerSessionCreated.session, actor);
    check(result, "Incomplete runner session application state is unavailable", incompleteApplyState.available === false, "unavailable until completed", incompleteApplyState.reason);
    const completedNoTargetApplyState = prepareTravelEventEffectApplicationState(loadedCompletedRunnerSession.session, null);
    check(result, "Completed runner session without target actor shows no-target state", completedNoTargetApplyState.available === true && completedNoTargetApplyState.hasTarget === false && completedNoTargetApplyState.rows.every((row) => row.selectable === false), "no target", completedNoTargetApplyState.noTargetReason);
    const applyResourcesBefore = getShipTravelResources(actor);
    const applyEconomyBefore = getShipActionEconomy(actor);
    const applyChatBefore = globalThis.game?.messages?.size ?? globalThis.game?.messages?.contents?.length ?? 0;
    const applyJournalBefore = globalThis.game?.journal?.size ?? globalThis.game?.journal?.contents?.length ?? 0;
    const completedTargetApplyState = prepareTravelEventEffectApplicationState(loadedCompletedRunnerSession.session, actor);
    const readyApplyRow = completedTargetApplyState.rows.find((row) => row.type === "resource" && row.selectable);
    check(result, "Completed runner session with target actor previews supported resource effect", completedTargetApplyState.hasTarget === true && readyApplyRow && readyApplyRow.hasCurrentValue === true && readyApplyRow.hasPreviewValue === true, "ready resource preview", readyApplyRow);
    check(result, "Unsupported/note/malformed effects are not selectable", completedTargetApplyState.rows.filter((row) => row.status !== "ready").every((row) => row.selectable === false), "non-ready rows blocked", completedTargetApplyState.rows.filter((row) => row.status !== "ready"));
    const manualApplyResult = readyApplyRow ? await applyTravelEventRunnerSelectedEffects(loadedCompletedRunnerSession.session, actor, [readyApplyRow.index], { now: "2026-01-01T00:04:30.000Z" }) : { ok: false, session: loadedCompletedRunnerSession.session, applied: [] };
    const applyResourcesAfter = getShipTravelResources(actor);
    const applyEconomyAfter = getShipActionEconomy(actor);
    const appliedResourceChangedOnly = readyApplyRow ? applyResourcesAfter[readyApplyRow.resource] === readyApplyRow.previewValue && ["hull", "strain", "lifeveil", "morale", "supplies", "storedSpellRanks"].filter((key) => key !== readyApplyRow.resource).every((key) => applyResourcesAfter[key] === applyResourcesBefore[key]) : false;
    check(result, "Apply selected resource effect mutates only travel resources", manualApplyResult.applied?.length === 1 && appliedResourceChangedOnly, "resource applied", { row: readyApplyRow, before: applyResourcesBefore, after: applyResourcesAfter });
    check(result, "Apply selected resource effect does not mutate AP/RAP", stringifySmokeData(applyEconomyBefore) === stringifySmokeData(applyEconomyAfter), "AP/RAP unchanged", { before: applyEconomyBefore, after: applyEconomyAfter });
    check(result, "Apply selected resource effect does not post chat or create JournalEntry", applyChatBefore === (globalThis.game?.messages?.size ?? globalThis.game?.messages?.contents?.length ?? 0) && applyJournalBefore === (globalThis.game?.journal?.size ?? globalThis.game?.journal?.contents?.length ?? 0), "chat/journal unchanged", { chatBefore: applyChatBefore, journalBefore: applyJournalBefore });
    check(result, "Applied record is stored on session and staged proposedEffects remain visible", getTravelEventAppliedEffectRecords(manualApplyResult.session).length === 1 && (manualApplyResult.session.summary?.stagedProposedEffects ?? []).length === expectedCompletedEffects.length, "record stored with staged source", manualApplyResult.session.appliedEffects);
    const doubleApplyBefore = getShipTravelResources(actor);
    const runnerDoubleApplyResult = readyApplyRow ? await applyTravelEventRunnerSelectedEffects(manualApplyResult.session, actor, [readyApplyRow.index]) : { applied: [] };
    const doubleApplyAfter = getShipTravelResources(actor);
    check(result, "Double-apply same effect is blocked and does not mutate resources", runnerDoubleApplyResult.applied?.length === 0 && stringifySmokeData(doubleApplyBefore) === stringifySmokeData(doubleApplyAfter), "double apply blocked", runnerDoubleApplyResult.warnings);
    const unknownApplyResult = await applyTravelEventRunnerResourceEffect(manualApplyResult.session, actor, 9999);
    check(result, "Applying unknown effect id/index fails safely", unknownApplyResult.ok === false && unknownApplyResult.applied === false, "unknown blocked", unknownApplyResult.errors);
    const postApplyState = prepareTravelEventEffectApplicationState(manualApplyResult.session, actor);
    check(result, "Application state after apply shows already applied", postApplyState.rows.some((row) => row.index === readyApplyRow?.index && row.applied === true && row.selectable === false), "already applied", postApplyState.rows);

    // Manual apply intentionally mutates the smoke actor's travel resources above.
    // Refresh the library non-mutation baseline so the following checks isolate
    // save/load/overwrite/malformed-session behavior instead of that explicit apply.
    runnerSessionActorBefore = stringifySmokeData(actor.toObject?.() ?? actor);
    runnerSessionResourcesBefore = getShipTravelResources(actor);
    runnerSessionEconomyBefore = getShipActionEconomy(actor);
    runnerSessionChatBefore = globalThis.game?.messages?.size ?? globalThis.game?.messages?.contents?.length ?? 0;
    runnerSessionCombatsBefore = globalThis.game?.combats?.size ?? globalThis.game?.combats?.contents?.length ?? 0;
    runnerSessionActiveCombatBefore = globalThis.game?.combat?.id ?? "";

    const libraryBeforeBlockedOverwrite = stringifySmokeData(getTravelEventRunnerSessionLibrary().sessions[savedActiveRunnerSession.entry.key]);
    const blockedRunnerOverwrite = await saveTravelEventRunnerSessionToLibrary({ ...loadedCompletedRunnerSession.session, currentRoundIndex: 0 }, { key: savedActiveRunnerSession.entry.key, overwrite: false, now: "2026-01-01T00:05:00.000Z" });
    check(result, "Save without overwrite does not silently replace existing session", blockedRunnerOverwrite.ok === false && blockedRunnerOverwrite.errors.some((error) => error.includes("already exists")) && stringifySmokeData(getTravelEventRunnerSessionLibrary().sessions[savedActiveRunnerSession.entry.key]) === libraryBeforeBlockedOverwrite, "overwrite blocked without mutation", blockedRunnerOverwrite.errors);
    const allowedRunnerOverwrite = await saveTravelEventRunnerSessionToLibrary({ ...loadedCompletedRunnerSession.session, currentRoundIndex: 0 }, { key: savedActiveRunnerSession.entry.key, overwrite: true, now: "2026-01-01T00:06:00.000Z" });
    check(result, "Overwrite true updates existing runner session", allowedRunnerOverwrite.ok === true && loadTravelEventRunnerSessionFromLibrary(savedActiveRunnerSession.entry.key).session?.currentRoundIndex === 0, "overwrite allowed", allowedRunnerOverwrite.entry);

    const malformedRunnerSessionLibrary = getTravelEventRunnerSessionLibrary({ library: { version: 1, sessions: { malformed: { key: "malformed", session: { event: { key: "bad", rounds: [] } } } } } });
    const malformedRunnerSessionLoad = loadTravelEventRunnerSessionFromLibrary("malformed", { library: malformedRunnerSessionLibrary });
    check(result, "Malformed session library fails safely", malformedRunnerSessionLibrary.sessions.malformed.isMalformed === true && malformedRunnerSessionLoad.ok === false, "malformed safely rejected", malformedRunnerSessionLoad.errors);
    const missingPublishedEventLoad = loadTravelEventRunnerSessionFromLibrary(savedActiveRunnerSession.entry.key, { publishedLibrary: { version: 1, events: {} } });
    check(result, "Saved session referencing missing published event loads with warning", missingPublishedEventLoad.ok === true && missingPublishedEventLoad.warnings.some((warning) => warning.includes("not currently in the Published Travel Event Library")), "missing published warning", missingPublishedEventLoad.warnings);

    const runnerSessionChatAfter = globalThis.game?.messages?.size ?? globalThis.game?.messages?.contents?.length ?? 0;
    const runnerSessionCombatsAfter = globalThis.game?.combats?.size ?? globalThis.game?.combats?.contents?.length ?? 0;
    const runnerSessionActiveCombatAfter = globalThis.game?.combat?.id ?? "";
    check(result, "Runner session library does not mutate actor data", runnerSessionActorBefore === stringifySmokeData(actor.toObject?.() ?? actor), "actor unchanged", { before: runnerSessionActorBefore, after: stringifySmokeData(actor.toObject?.() ?? actor) });
    check(result, "Runner session library does not mutate ship resources", stringifySmokeData(runnerSessionResourcesBefore) === stringifySmokeData(getShipTravelResources(actor)), "resources unchanged", { before: runnerSessionResourcesBefore, after: getShipTravelResources(actor) });
    check(result, "Runner session library does not apply proposedEffects", stringifySmokeData(runnerSessionResourcesBefore) === stringifySmokeData(getShipTravelResources(actor)), "proposed effects staged only", expectedCompletedEffects);
    check(result, "Runner session library does not post chat", runnerSessionChatBefore === runnerSessionChatAfter, "chat count unchanged", { before: runnerSessionChatBefore, after: runnerSessionChatAfter });
    check(result, "Runner session library does not start combat or encounter automation", runnerSessionCombatsBefore === runnerSessionCombatsAfter && runnerSessionActiveCombatBefore === runnerSessionActiveCombatAfter, "combat/encounter state unchanged", { before: runnerSessionCombatsBefore, after: runnerSessionCombatsAfter, activeBefore: runnerSessionActiveCombatBefore, activeAfter: runnerSessionActiveCombatAfter });
    check(result, "Runner session library does not introduce AP/RAP mechanics", stringifySmokeData(runnerSessionEconomyBefore) === stringifySmokeData(getShipActionEconomy(actor)), "AP/RAP unchanged", { before: runnerSessionEconomyBefore, after: getShipActionEconomy(actor) });
    let noActorRunnerApp = null;
    try {
      noActorRunnerApp = globalThis.game?.arcflight?.openTravelEventRunner?.();
      check(result, "Travel Event Runner opens without requiring a ship actor", noActorRunnerApp instanceof ArcflightTravelEventRunner, "runner app opens without actor", { appClass: noActorRunnerApp?.constructor?.name ?? null });
    } catch (error) {
      check(result, "Travel Event Runner opens without requiring a ship actor", false, "runner app opens without actor", error.message ?? String(error));
    } finally {
      await noActorRunnerApp?.close?.({ force: true });
    }
    const blankTravelEventTemplate = createBlankTravelEventTemplate({ key: "smoke-template", name: "Smoke Template", category: "discovery", roundCount: 2, baseDC: 18 });
    const blankRoundTemplate = createBlankTravelRoundTemplate(1);
    const blankStationPromptTemplate = createBlankStationPromptTemplate("navigator");
    const blankRollFeedbackTemplate = createBlankRollFeedbackTemplate();
    const blankOutcomeBranchesTemplate = createBlankOutcomeBranchesTemplate();
    const blankFinalOutcomesTemplate = createBlankFinalOutcomesTemplate();
    const strictMissingPlayerActionEvent = createBlankTravelEventTemplate({ key: "strict-missing-player-action" });
    delete strictMissingPlayerActionEvent.rounds[0].activeStations[0].playerAction;
    const strictMissingRollFeedbackEvent = createBlankTravelEventTemplate({ key: "strict-missing-roll-feedback" });
    delete strictMissingRollFeedbackEvent.rounds[0].activeStations[0].rollFeedback;
    check(result, "Travel event template helper exports exist", typeof TRAVEL_EVENT_TEMPLATE_VERSION === "string" && typeof createBlankTravelEventTemplate === "function" && typeof createBlankTravelRoundTemplate === "function" && typeof createBlankStationPromptTemplate === "function" && typeof createBlankRollFeedbackTemplate === "function" && typeof createBlankOutcomeBranchesTemplate === "function" && typeof createBlankFinalOutcomesTemplate === "function" && typeof getTravelEventAuthoringGuidelines === "function" && typeof validateTravelEventAuthoringTemplate === "function" && typeof globalThis.game?.arcflight?.createBlankTravelEventTemplate === "function" && typeof globalThis.game?.arcflight?.devTools?.createBlankTravelEventTemplate === "function", true, { version: TRAVEL_EVENT_TEMPLATE_VERSION, apiCreate: typeof globalThis.game?.arcflight?.createBlankTravelEventTemplate, devCreate: typeof globalThis.game?.arcflight?.devTools?.createBlankTravelEventTemplate });
    check(result, "Blank travel event template has expected canonical fields", ["key", "name", "category", "tags", "roundCount", "baseDC", "activeResources", "travelStations", "description", "gmSummary", "rounds", "finalOutcomes", "rewards", "futureAutomationNotes"].every((key) => Object.hasOwn(blankTravelEventTemplate, key)), "canonical event keys", Object.keys(blankTravelEventTemplate));
    check(result, "Blank round template has openingVignette and activeStations array", typeof blankRoundTemplate.openingVignette === "string" && Array.isArray(blankRoundTemplate.activeStations), "openingVignette + activeStations", blankRoundTemplate);
    check(result, "Blank station prompt has playerAction", typeof blankStationPromptTemplate.playerAction === "string" && blankStationPromptTemplate.playerAction.length > 0, "playerAction string", blankStationPromptTemplate);
    check(result, "Blank station prompt has rollFeedback with four degree keys", ["criticalSuccess", "success", "failure", "criticalFailure"].every((degree) => typeof blankStationPromptTemplate.rollFeedback?.[degree] === "string" && typeof blankRollFeedbackTemplate[degree] === "string"), "four degree keys", blankStationPromptTemplate.rollFeedback);
    check(result, "Blank outcome branches include all round outcome keys", ["dominantSuccess", "mixed", "dominantFailure", "catastrophicFailure"].every((key) => blankOutcomeBranchesTemplate[key]), "round outcome branches", Object.keys(blankOutcomeBranchesTemplate));
    check(result, "Blank final outcomes include all final outcome keys", ["majorVictory", "victory", "costlySuccess", "failure", "catastrophicFailure"].every((key) => blankFinalOutcomesTemplate[key]), "final outcomes", Object.keys(blankFinalOutcomesTemplate));
    check(result, "Strict authoring validator rejects missing playerAction", validateTravelEventAuthoringTemplate(strictMissingPlayerActionEvent).ok === false && validateTravelEventDefinition(strictMissingPlayerActionEvent, { strictAuthoring: true }).errors.some((error) => error.includes("playerAction")), "playerAction rejection", validateTravelEventAuthoringTemplate(strictMissingPlayerActionEvent));
    check(result, "Strict authoring validator rejects missing rollFeedback", validateTravelEventAuthoringTemplate(strictMissingRollFeedbackEvent).ok === false && validateTravelEventDefinition(strictMissingRollFeedbackEvent, { strictAuthoring: true }).errors.some((error) => error.includes("rollFeedback")), "rollFeedback rejection", validateTravelEventAuthoringTemplate(strictMissingRollFeedbackEvent));
    check(result, "Normal and strict core travel event validation passes", EXPECTED_CORE_TRAVEL_EVENT_KEYS.every((key) => validateTravelEventDefinition(getCoreTravelEvent(key)).ok === true && validateTravelEventDefinition(getCoreTravelEvent(key), { strictAuthoring: true }).ok === true), "all current core events valid", EXPECTED_CORE_TRAVEL_EVENT_KEYS.map((key) => ({ key, validation: validateTravelEventDefinition(getCoreTravelEvent(key)), strictValidation: validateTravelEventDefinition(getCoreTravelEvent(key), { strictAuthoring: true }) })));

    const builderDraft = createTravelEventDraft({ key: "smoke-builder-event", name: "Smoke Builder Event", category: "discovery", roundCount: 4, baseDC: 19 });
    const normalizeInput = { key: "normalize-smoke", name: "Normalize Smoke", rounds: [{ round: 1 }] };
    const normalizeBefore = stringifySmokeData(normalizeInput);
    const normalizedBuilderDraft = normalizeTravelEventDraft(normalizeInput);
    const invalidBuilderValidation = validateTravelEventDraft({ name: "Incomplete Builder Draft" });
    const invalidBuilderFinalize = finalizeTravelEventDraft({ key: "incomplete-builder-draft" });
    const validBuilderFinalize = finalizeTravelEventDraft(builderDraft);
    const sourceTravelEvent = getCoreTravelEvent("black-tide-crossing");
    const sourceTravelEventBeforeClone = stringifySmokeData(sourceTravelEvent);
    const clonedBuilderDraft = cloneTravelEventToDraft(sourceTravelEvent);
    const validResourceEffect = createTravelBuilderResourceEffect({ resource: "morale", mode: "add", value: -1, label: "Morale -1" });
    const invalidResourceEffect = createTravelBuilderResourceEffect({ resource: "mystery", mode: "subtract", value: "bad", label: "Bad resource" });
    const builderPreview = prepareTravelEventBuilderPreview(builderDraft);
    const builderHelperExportsExist = typeof TRAVEL_EVENT_BUILDER_VERSION === "string"
      && [createTravelEventDraft, normalizeTravelEventDraft, validateTravelEventDraft, finalizeTravelEventDraft, cloneTravelEventToDraft, createTravelBuilderResourceEffect, createTravelBuilderRound, createTravelBuilderStationPrompt, createTravelBuilderOutcomeBranch, createTravelBuilderFinalOutcome, prepareTravelEventBuilderFormOptions, applyTravelEventBuilderFormDataToDraft, prepareTravelEventBuilderRoundEditorState, applyTravelEventBuilderRoundFormDataToDraft, prepareTravelEventBuilderPreview, analyzeTravelEventBuilderQuality, prepareTravelEventBuilderQualityReport].every((helper) => typeof helper === "function")
      && typeof globalThis.game?.arcflight?.createTravelEventDraft === "function"
      && typeof globalThis.game?.arcflight?.devTools?.createTravelEventDraft === "function"
      && typeof globalThis.game?.arcflight?.prepareTravelEventBuilderPreview === "function"
      && typeof globalThis.game?.arcflight?.prepareTravelEventBuilderFormOptions === "function"
      && typeof globalThis.game?.arcflight?.applyTravelEventBuilderFormDataToDraft === "function"
      && typeof globalThis.game?.arcflight?.prepareTravelEventBuilderRoundEditorState === "function"
      && typeof globalThis.game?.arcflight?.applyTravelEventBuilderRoundFormDataToDraft === "function"
      && typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventBuilderPreview === "function"
      && typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventBuilderFormOptions === "function"
      && typeof globalThis.game?.arcflight?.devTools?.applyTravelEventBuilderFormDataToDraft === "function"
      && typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventBuilderRoundEditorState === "function"
      && typeof globalThis.game?.arcflight?.devTools?.applyTravelEventBuilderRoundFormDataToDraft === "function"
      && typeof globalThis.game?.arcflight?.analyzeTravelEventBuilderQuality === "function"
      && typeof globalThis.game?.arcflight?.prepareTravelEventBuilderQualityReport === "function"
      && typeof globalThis.game?.arcflight?.devTools?.analyzeTravelEventBuilderQuality === "function"
      && typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventBuilderQualityReport === "function";
    check(result, "Travel Event Builder helper exports exist", builderHelperExportsExist, true, { version: TRAVEL_EVENT_BUILDER_VERSION, apiCreate: typeof globalThis.game?.arcflight?.createTravelEventDraft, devToolsCreate: typeof globalThis.game?.arcflight?.devTools?.createTravelEventDraft });
    const builderShellState = prepareTravelEventBuilderShellState(builderDraft);
    const builderFormOptions = prepareTravelEventBuilderFormOptions(builderDraft);
    const builderFormEconomyBefore = getShipActionEconomy(actor);
    const builderFormResourcesBefore = getShipTravelResources(actor);
    const formEditedBuilderDraft = applyTravelEventBuilderFormDataToDraft(builderDraft, {
      key: "form-edited-smoke",
      name: "Form Edited Smoke",
      category: "navigation",
      baseDC: "21",
      roundCount: "2",
      description: "Form-edited description stays local to the draft.",
      gmSummary: "Form-edited GM summary stays local to the draft.",
      tags: "navigation, smoke",
      activeResources: ["hull", "morale"],
      travelStations: ["navigator", "engineer"]
    });
    const formEditedValidation = validateTravelEventDraft(formEditedBuilderDraft);
    const formEditedDraftExport = exportTravelEventDraftToJson(formEditedBuilderDraft);
    const formEditedDraftImport = importTravelEventDraftFromJson(formEditedDraftExport.json ?? "");
    const formEditedFinalExport = exportFinalTravelEventToJson(formEditedDraftImport.draft);

    const builderRoundEditorState = prepareTravelEventBuilderRoundEditorState(builderDraft);
    const builderRoundEconomyBefore = getShipActionEconomy(actor);
    const builderRoundResourcesBefore = getShipTravelResources(actor);
    const roundEditedBuilderDraft = applyTravelEventBuilderRoundFormDataToDraft(builderDraft, {
      rounds: [{
        round: 1,
        openingVignette: "Smoke-edited opening vignette stays in the local draft.",
        activeStations: ["navigator", "captain", "pilot"],
        stationPrompts: {
          navigator: { playerAction: "Chart the safest path through the smoke-test anomaly." },
          captain: { playerAction: "Keep the crew focused while the anomaly howls." },
          pilot: { playerAction: "This non-Travel Five station must be ignored." }
        }
      }]
    });
    const roundEditedDraftExport = exportTravelEventDraftToJson(roundEditedBuilderDraft);
    const roundEditedDraftImport = importTravelEventDraftFromJson(roundEditedDraftExport.json ?? "");
    const finalOutcomeEditorState = prepareTravelEventBuilderFinalOutcomeEditorState(builderDraft);
    const finalOutcomeEconomyBefore = getShipActionEconomy(actor);
    const finalOutcomeResourcesBefore = getShipTravelResources(actor);
    const stagedFinalOutcomeDraft = normalizeTravelEventDraft({
      ...builderDraft,
      finalOutcomes: {
        ...builderDraft.finalOutcomes,
        criticalSuccess: {
          ...builderDraft.finalOutcomes.criticalSuccess,
          proposedEffects: [createTravelBuilderResourceEffect({ resource: "morale", value: 1, label: "Smoke read-only morale reward" })]
        }
      }
    });
    const stagedFinalOutcomeEditorState = prepareTravelEventBuilderFinalOutcomeEditorState(stagedFinalOutcomeDraft);
    const finalOutcomeEditedDraft = applyTravelEventBuilderFinalOutcomeFormDataToDraft(stagedFinalOutcomeDraft, {
      outcomes: [{
        key: "criticalSuccess",
        label: "Smoke Critical Success",
        narrative: "The crew turns the smoke-test route into a clean triumph.",
        rewardsText: "Gain a local-only smoke reward.",
        consequencesText: "No consequence beyond a clean log entry."
      }, {
        key: "mixed",
        narrative: "The smoke-test route is crossed, but a thread remains unresolved.",
        rewardsText: "Keep the route notes.",
        consequencesText: "Mark a narrative complication."
      }]
    });
    const finalOutcomeDraftExport = exportTravelEventDraftToJson(finalOutcomeEditedDraft);
    const finalOutcomeDraftImport = importTravelEventDraftFromJson(finalOutcomeDraftExport.json ?? "");
    const finalOutcomeFinalExport = exportFinalTravelEventToJson(finalOutcomeDraftImport.draft);
    const effectEditorDraft = normalizeTravelEventDraft({
      ...builderDraft,
      finalOutcomes: {
        ...builderDraft.finalOutcomes,
        criticalSuccess: {
          ...builderDraft.finalOutcomes.criticalSuccess,
          proposedEffects: [
            createTravelBuilderResourceEffect({ resource: "morale", mode: "add", value: 1, label: "Initial morale lift" }),
            { type: "clock", target: "void-whale", value: 1, label: "Unsupported clock" }
          ]
        }
      }
    });
    const effectEditorState = prepareTravelEventBuilderFinalOutcomeEffectEditorState(effectEditorDraft);
    const effectEditorEconomyBefore = getShipActionEconomy(actor);
    const effectEditorResourcesBefore = getShipTravelResources(actor);
    const effectAddedDraft = applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft(effectEditorDraft, {
      outcomes: [{
        key: "success",
        addEffect: { enabled: true, resource: "supplies", mode: "add", value: "2", label: "Recover supplies" }
      }]
    });
    const effectEditedDraft = applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft(effectAddedDraft, {
      outcomes: [{
        key: "success",
        effects: [{ index: 0, resource: "hull", mode: "set", value: "7", label: "Set hull smoke value" }]
      }]
    });
    const effectRemovedDraft = applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft(effectEditedDraft, {
      outcomes: [{
        key: "success",
        effects: [{ index: 0, remove: true }]
      }]
    });
    const invalidEffectEditDraft = applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft(effectEditorDraft, {
      outcomes: [{
        key: "criticalSuccess",
        effects: [{ index: 0, resource: "mystery", mode: "subtract", value: "many", label: "Invalid ignored edit" }]
      }]
    });
    const invalidEffectQualityReport = prepareTravelEventBuilderQualityReport({
      ...effectEditorDraft,
      finalOutcomes: {
        ...effectEditorDraft.finalOutcomes,
        success: {
          ...effectEditorDraft.finalOutcomes.success,
          proposedEffects: [{ type: "resource", resource: "mystery", mode: "subtract", value: "many", label: "Invalid staged data" }]
        }
      }
    });
    const effectEditedDraftExport = exportTravelEventDraftToJson(effectEditedDraft);
    const effectEditedDraftImport = importTravelEventDraftFromJson(effectEditedDraftExport.json ?? "");
    const malformedFinalOutcomeImport = importTravelEventDraftFromJson(JSON.stringify({
      ...builderDraft,
      finalOutcomes: {
        ...builderDraft.finalOutcomes,
        criticalSuccess: "not an object"
      }
    }));
    const completeQualityDraft = normalizeTravelEventDraft({
      ...builderDraft,
      key: "quality-polish-smoke",
      name: "Quality Polish Smoke",
      category: "discovery",
      baseDC: 19,
      activeResources: ["hull", "morale", "supplies"],
      travelStations: ["navigator", "engineer", "captain"],
      rounds: builderDraft.rounds.map((round, index) => ({
        ...round,
        openingVignette: `Round ${index + 1} opens with the crew reading a luminous void current while the arkengine hums in reply.`,
        activeStations: ["navigator", "engineer", "captain"].map((stationKey) => ({
          ...createTravelBuilderStationPrompt(stationKey),
          playerAction: `${stationKey} frames a distinct table action for round ${index + 1} with clear voidsailing stakes.`
        }))
      })),
      finalOutcomes: {
        criticalSuccess: createTravelBuilderFinalOutcome({ label: "Critical Success", vignette: "The crew turns the void current into a clean route and arrives with confidence to spare.", rewards: ["Gain a narrative route advantage."], losses: [] }),
        success: createTravelBuilderFinalOutcome({ label: "Success", vignette: "The ship clears the pressure and keeps enough momentum for the next leg of the voyage.", rewards: ["Keep the route notes for future reference."], losses: [] }),
        mixed: createTravelBuilderFinalOutcome({ label: "Mixed", vignette: "The route is crossed, but one unresolved echo trails the ship into the next watch.", rewards: ["Recover a useful clue."], losses: ["Mark a narrative complication."] }),
        failure: createTravelBuilderFinalOutcome({ label: "Failure", vignette: "The passage costs time and confidence, forcing the crew to regroup before pressing on.", rewards: [], losses: ["Lose position in the void current."] }),
        criticalFailure: createTravelBuilderFinalOutcome({ label: "Critical Failure", vignette: "The void current collapses into a dangerous wake that leaves the crew shaken and off-course.", rewards: [], losses: ["Suffer a major narrative setback."] })
      }
    });
    const qualityReport = prepareTravelEventBuilderQualityReport(completeQualityDraft);
    const badQualityDraft = {
      ...builderDraft,
      key: "",
      name: "",
      activeResources: [],
      travelStations: [],
      rounds: [{ round: 1, openingVignette: "", activeStations: [{ stationKey: "navigator", playerAction: "" }], outcomeBranches: null }],
      finalOutcomes: {}
    };
    const badQualityReport = prepareTravelEventBuilderQualityReport(badQualityDraft);
    const leakageQualityReport = analyzeTravelEventBuilderQuality({
      ...completeQualityDraft,
      gmSummary: "Spend 1 AP, automatically start combat, actor.update the ship, game.settings.set a world flag, then apply staged effects and sail across an ocean tide."
    });
    const missingVignetteQualityReport = analyzeTravelEventBuilderQuality({
      ...completeQualityDraft,
      rounds: [{ ...completeQualityDraft.rounds[0], openingVignette: "" }, ...completeQualityDraft.rounds.slice(1)]
    });
    const missingPlayerActionQualityReport = analyzeTravelEventBuilderQuality({
      ...completeQualityDraft,
      rounds: [{
        ...completeQualityDraft.rounds[0],
        stationPrompts: {
          ...completeQualityDraft.rounds[0].stationPrompts,
          navigator: { ...completeQualityDraft.rounds[0].stationPrompts.navigator, playerAction: "" }
        }
      }, ...completeQualityDraft.rounds.slice(1)]
    });
    const missingFinalOutcomeQualityReport = analyzeTravelEventBuilderQuality({ ...completeQualityDraft, finalOutcomes: { ...completeQualityDraft.finalOutcomes, success: undefined } });
    const badResourceEffectQualityReport = analyzeTravelEventBuilderQuality({
      ...completeQualityDraft,
      finalOutcomes: {
        ...completeQualityDraft.finalOutcomes,
        criticalSuccess: {
          ...completeQualityDraft.finalOutcomes.criticalSuccess,
          proposedEffects: [{ type: "resource", resource: "mystery", mode: "subtract", value: "many" }]
        }
      }
    });
    const qualityEconomyBefore = getShipActionEconomy(actor);
    const qualityResourcesBefore = getShipTravelResources(actor);
    const postQualityDraftExport = exportTravelEventDraftToJson(completeQualityDraft);
    const postQualityDraftImport = importTravelEventDraftFromJson(postQualityDraftExport.json ?? "");
    const emptyBuilderLibraryState = prepareTravelEventBuilderLibraryState({ library: { version: 1, drafts: {} } });
    const savedBuilderLibraryDraft = await saveTravelEventBuilderDraftToLibrary(completeQualityDraft, { library: { version: 1, drafts: {} }, dryRun: true, now: "2026-06-12T00:00:00.000Z" });
    const loadedBuilderLibraryDraft = loadTravelEventBuilderDraftFromLibrary(savedBuilderLibraryDraft.entry?.id, { library: savedBuilderLibraryDraft.library });
    const duplicatedBuilderLibraryDraft = await duplicateTravelEventBuilderLibraryDraft(savedBuilderLibraryDraft.entry?.id, { library: savedBuilderLibraryDraft.library, dryRun: true, now: "2026-06-12T00:00:01.000Z" });
    const deletedBuilderLibraryDraft = await deleteTravelEventBuilderDraftFromLibrary(duplicatedBuilderLibraryDraft.entry?.id, { library: duplicatedBuilderLibraryDraft.library, dryRun: true });
    const emptyPublishedLibraryState = preparePublishedTravelEventLibraryState({ library: { version: 1, events: {} } });
    const objectActiveStationsDraft = normalizeTravelEventDraft({
      ...completeQualityDraft,
      rounds: [{
        ...completeQualityDraft.rounds[0],
        activeStations: [{ stationKey: "captain", playerAction: "Captain object prompt stays in stationPrompts." }],
        stationPrompts: {}
      }, ...completeQualityDraft.rounds.slice(1)]
    });
    const publishableDraft = normalizeTravelEventDraft({
      ...completeQualityDraft,
      key: "published-smoke",
      name: "Published Smoke",
      rounds: completeQualityDraft.rounds.map((round, index) => index === 0 ? {
        ...round,
        activeStations: [],
        stationPrompts: {
          engineer: { playerAction: "Tune the engine through the smoke-safe route." },
          navigator: { playerAction: "Chart the smoke-safe route." }
        }
      } : round),
      finalOutcomes: {
        ...completeQualityDraft.finalOutcomes,
        success: {
          ...completeQualityDraft.finalOutcomes.success,
          proposedEffects: [createTravelBuilderResourceEffect({ resource: "supplies", mode: "add", value: 1, label: "Published supplies reward" })]
        }
      }
    });
    const publishedBuilderEvent = await publishTravelEventDraftToLibrary(publishableDraft, { library: { version: 1, events: {} }, dryRun: true, sourceDraftId: savedBuilderLibraryDraft.entry?.id, now: "2026-06-12T00:00:02.000Z" });
    const loadedPublishedEvent = loadPublishedTravelEventFromLibrary(publishedBuilderEvent.entry?.id, { library: publishedBuilderEvent.library });
    const emptyRunnerState = prepareTravelEventRunnerState(null, { library: { version: 1, events: {} } });
    const runnerSessionCreated = createTravelEventRunnerSession(loadedPublishedEvent.event, { now: "2026-06-12T00:01:00.000Z" });
    const runnerRoundState = prepareTravelEventRunnerState(runnerSessionCreated.session, { library: publishedBuilderEvent.library });
    const runnerSetNavigator = setTravelEventRunnerStationResult(runnerSessionCreated.session, 0, "navigator", "success", { now: "2026-06-12T00:01:01.000Z" });
    const runnerSetEngineer = setTravelEventRunnerStationResult(runnerSetNavigator.session, 0, "engineer", "criticalSuccess", { now: "2026-06-12T00:01:02.000Z" });
    const runnerInvalidResult = setTravelEventRunnerStationResult(runnerSetEngineer.session, 0, "navigator", "triumph", { now: "2026-06-12T00:01:03.000Z" });
    const runnerAdvanced = advanceTravelEventRunnerRound(runnerSetEngineer.session, { now: "2026-06-12T00:01:04.000Z" });
    const runnerRetreated = retreatTravelEventRunnerRound(runnerAdvanced.session, { now: "2026-06-12T00:01:05.000Z" });
    const runnerCompleted = completeTravelEventRunnerSession(runnerSetEngineer.session, { now: "2026-06-12T00:01:06.000Z" });
    const runnerExported = exportTravelEventRunnerSessionToJson(runnerCompleted.session, { now: "2026-06-12T00:01:07.000Z" });
    const runnerIncompleteSummaryOutput = prepareTravelEventRunnerSummaryOutputState(runnerSetEngineer.session);
    const runnerSummaryReport = prepareTravelEventRunnerSummaryReport(runnerCompleted.session);
    const runnerSummaryMarkdown = renderTravelEventRunnerSummaryMarkdown(runnerCompleted.session);
    const runnerSummaryHtml = renderTravelEventRunnerSummaryHtml(runnerCompleted.session);
    const runnerIncompleteReview = prepareTravelEventStagedEffectReview(runnerSetEngineer.session);
    const runnerReview = prepareTravelEventStagedEffectReview(runnerCompleted.session, { resources: { supplies: 3, hull: 4, strain: 1, lifeveil: 2, morale: 5, maxHull: 10, maxStrain: 3, maxLifeveil: 8 } });
    const runnerReviewMarkdown = renderTravelEventStagedEffectReviewMarkdown(runnerCompleted.session);
    const runnerReviewHtml = renderTravelEventStagedEffectReviewHtml({ ...runnerCompleted.session, event: { ...runnerCompleted.session.event, name: "<script>unsafe</script>" } });
    const runnerEmptyReviewSession = cloneSmokeData(runnerCompleted.session);
    runnerEmptyReviewSession.event.finalOutcomes.success.proposedEffects = [];
    runnerEmptyReviewSession.summary = null;
    const runnerEmptyReview = prepareTravelEventStagedEffectReview(runnerEmptyReviewSession);
    const runnerMixedReviewSession = cloneSmokeData(runnerCompleted.session);
    runnerMixedReviewSession.event.finalOutcomes.success.proposedEffects = [
      { type: "resource", resource: "hull", mode: "add", value: 2, label: "Hull patch" },
      { type: "note", label: "GM Note", text: "Read-only note" },
      { type: "clock", label: "Unsupported clock" },
      "malformed"
    ];
    runnerMixedReviewSession.summary = null;
    const runnerMixedReviewBefore = JSON.stringify(runnerMixedReviewSession);
    const runnerResourcesBeforeReview = JSON.stringify(getShipTravelResources(actor));
    const runnerMixedReview = prepareTravelEventStagedEffectReview(runnerMixedReviewSession, { resources: getShipTravelResources(actor) });
    const runnerResourcesAfterReview = JSON.stringify(getShipTravelResources(actor));
    const runnerReviewNoSessionMutation = runnerMixedReviewBefore === JSON.stringify(runnerMixedReviewSession);
    const runnerSessionBeforeSummary = JSON.stringify(runnerCompleted.session);
    prepareTravelEventRunnerSummaryReport(runnerCompleted.session);
    const runnerChatIncomplete = await postTravelEventRunnerSummaryToChat(runnerSetEngineer.session, { dryRun: true });
    const runnerChatDryRun = await postTravelEventRunnerSummaryToChat(runnerCompleted.session, { dryRun: true });
    const runnerJournalIncomplete = await createTravelEventRunnerSummaryJournalEntry(runnerSetEngineer.session, { dryRun: true });
    const runnerJournalDryRun = await createTravelEventRunnerSummaryJournalEntry(runnerCompleted.session, { dryRun: true });
    const runnerMalformedSession = createTravelEventRunnerSession("not an event");
    const clonedPublishedDraft = clonePublishedTravelEventToDraft(publishedBuilderEvent.entry?.id, { library: publishedBuilderEvent.library, now: "2026-06-12T00:00:03.000Z" });
    const clonedPublishedDraftExport = clonedPublishedDraft.draft ? exportTravelEventDraftToJson(clonedPublishedDraft.draft) : { ok: false, json: null };
    const clonedPublishedDraftExportData = JSON.parse(clonedPublishedDraftExport.json ?? "{}");
    const clonedPublishedFinalExport = clonedPublishedDraft.draft ? exportFinalTravelEventToJson(clonedPublishedDraft.draft) : { ok: false, json: null };
    const clonedPublishedFinalExportData = JSON.parse(clonedPublishedFinalExport.json ?? "{}");
    const duplicatedPublishedDraft = clonePublishedTravelEventToDraft(publishedBuilderEvent.entry?.id, { library: publishedBuilderEvent.library, duplicate: true, now: "2026-06-12T00:00:04.000Z" });
    const duplicateKeyPublishedEvent = await publishTravelEventDraftToLibrary(publishableDraft, { library: publishedBuilderEvent.library, dryRun: true, now: "2026-06-12T00:00:05.000Z" });
    const malformedPublishedEvent = loadPublishedTravelEventFromLibrary("malformed", { library: { version: 1, events: { malformed: { id: "malformed", key: "malformed", name: "Malformed", category: "discovery", event: "not an object" } } } });
    const blockedPublishedEvent = await publishTravelEventDraftToLibrary({ ...publishableDraft, finalOutcomes: { ...publishableDraft.finalOutcomes, success: undefined } }, { library: { version: 1, events: {} }, dryRun: true });
    const deletedPublishedEvent = await deletePublishedTravelEventFromLibrary(publishedBuilderEvent.entry?.id, { library: publishedBuilderEvent.library, dryRun: true });
    const malformedBuilderLibraryDraft = loadTravelEventBuilderDraftFromLibrary("malformed-smoke", {
      library: {
        version: 1,
        drafts: {
          "malformed-smoke": { id: "malformed-smoke", key: "malformed-smoke", name: "Malformed Smoke", category: "discovery", createdAt: "2026-06-12T00:00:00.000Z", updatedAt: "2026-06-12T00:00:00.000Z", draft: "not an object" }
        }
      }
    });
    const loadedBuilderQualityReport = loadedBuilderLibraryDraft.draft ? prepareTravelEventBuilderQualityReport(loadedBuilderLibraryDraft.draft) : null;
    const loadedBuilderFinalOutcomeTextState = loadedBuilderLibraryDraft.draft ? prepareTravelEventBuilderFinalOutcomeEditorState(loadedBuilderLibraryDraft.draft) : null;
    const loadedBuilderFinalOutcomeEffectState = loadedBuilderLibraryDraft.draft ? prepareTravelEventBuilderFinalOutcomeEffectEditorState(loadedBuilderLibraryDraft.draft) : null;
    const loadedBuilderDraftExport = loadedBuilderLibraryDraft.draft ? exportTravelEventDraftToJson(loadedBuilderLibraryDraft.draft) : { ok: false };
    const loadedBuilderFinalExport = loadedBuilderLibraryDraft.draft ? exportFinalTravelEventToJson(loadedBuilderLibraryDraft.draft) : { ok: false };
    const crystalDriftStationKeys = ["navigator", "engineer", "veilwarden", "watchmaster", "captain"];
    const crystalDriftStationPrompts = Object.fromEntries(crystalDriftStationKeys.map((stationKey) => [stationKey, {
      stationKey,
      stationName: stationKey,
      vignette: `${stationKey} reads the crystal drift from a distinct angle.`,
      playerAction: `${stationKey} chooses how to guide the ship through the crystal drift safely.`
    }]));
    const crystalDriftDraft = normalizeTravelEventDraft({
      ...completeQualityDraft,
      key: "crystal-drift-smoke",
      name: "Crystal Drift Smoke",
      travelStations: crystalDriftStationKeys,
      roundCount: 1,
      rounds: [{
        ...completeQualityDraft.rounds[0],
        round: 1,
        activeStations: crystalDriftStationKeys,
        stationPrompts: crystalDriftStationPrompts
      }]
    });
    const crystalDriftImported = importTravelEventDraftFromData(crystalDriftDraft);
    const crystalDriftSaved = await saveTravelEventBuilderDraftToLibrary(crystalDriftImported.draft, { library: { version: 1, drafts: {} }, dryRun: true, now: "2026-06-12T00:00:02.000Z" });
    const crystalDriftLoaded = loadTravelEventBuilderDraftFromLibrary(crystalDriftSaved.entry?.id, { library: crystalDriftSaved.library });
    const crystalDriftExport = crystalDriftLoaded.draft ? exportTravelEventDraftToJson(crystalDriftLoaded.draft) : { ok: false, json: "{}" };
    const crystalDriftExportData = JSON.parse(crystalDriftExport.json ?? "{}");
    const crystalDriftFinalExport = crystalDriftLoaded.draft ? exportFinalTravelEventToJson(crystalDriftLoaded.draft) : { ok: false, json: "{}" };
    const crystalDriftFinalExportData = JSON.parse(crystalDriftFinalExport.json ?? "{}");
    const crystalDriftDuplicate = await duplicateTravelEventBuilderLibraryDraft(crystalDriftSaved.entry?.id, { library: crystalDriftSaved.library, dryRun: true, now: "2026-06-12T00:00:03.000Z" });
    const crystalDriftFallbackDraft = normalizeTravelEventDraft({
      ...crystalDriftDraft,
      key: "crystal-drift-fallback-smoke",
      travelStations: [],
      rounds: [{
        ...crystalDriftDraft.rounds[0],
        activeStations: [],
        stationPrompts: crystalDriftStationPrompts
      }]
    });
    const crystalDriftFallbackExport = exportTravelEventDraftToJson(crystalDriftFallbackDraft);
    const crystalDriftFallbackExportData = JSON.parse(crystalDriftFallbackExport.json ?? "{}");
    const crystalDriftFallbackSaved = await saveTravelEventBuilderDraftToLibrary(crystalDriftFallbackDraft, { library: { version: 1, drafts: {} }, dryRun: true, now: "2026-06-12T00:00:04.000Z" });
    const crystalDriftFallbackLoaded = loadTravelEventBuilderDraftFromLibrary(crystalDriftFallbackSaved.entry?.id, { library: crystalDriftFallbackSaved.library });
    const crystalDriftFallbackDuplicate = await duplicateTravelEventBuilderLibraryDraft(crystalDriftFallbackSaved.entry?.id, { library: crystalDriftFallbackSaved.library, dryRun: true, now: "2026-06-12T00:00:05.000Z" });
    const crystalDriftFallbackFinalExport = exportFinalTravelEventToJson(crystalDriftFallbackDraft);
    const crystalDriftFallbackFinalExportData = JSON.parse(crystalDriftFallbackFinalExport.json ?? "{}");
    const crystalDriftLoadedQuality = crystalDriftLoaded.draft ? prepareTravelEventBuilderQualityReport(crystalDriftLoaded.draft) : null;
    const crystalDriftFallbackLoadedQuality = crystalDriftFallbackLoaded.draft ? prepareTravelEventBuilderQualityReport(crystalDriftFallbackLoaded.draft) : null;

    check(result, "Travel Event Builder quality helper exports exist", typeof analyzeTravelEventBuilderQuality === "function" && typeof prepareTravelEventBuilderQualityReport === "function" && typeof globalThis.game?.arcflight?.analyzeTravelEventBuilderQuality === "function" && typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventBuilderQualityReport === "function", true, { analyze: typeof analyzeTravelEventBuilderQuality, report: typeof prepareTravelEventBuilderQualityReport, api: typeof globalThis.game?.arcflight?.analyzeTravelEventBuilderQuality, devTools: typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventBuilderQualityReport });
    check(result, "Travel Event Builder quality report returns grouped errors warnings suggestions", Array.isArray(qualityReport.errors) && Array.isArray(qualityReport.warnings) && Array.isArray(qualityReport.suggestions) && qualityReport.grouped?.errors?.topLevel && qualityReport.areas?.length === 5, "grouped quality report", qualityReport);
    check(result, "Travel Event Builder complete stress event passes quality gate", qualityReport.ok === true && qualityReport.ready === true && qualityReport.readiness === "Ready to Export", "ready quality report", qualityReport);
    check(result, "Travel Event Builder intentionally bad draft returns clear quality errors warnings", badQualityReport.ok === false && badQualityReport.errors.some((entry) => /key|name|final outcome/i.test(entry.message)) && badQualityReport.warnings.some((entry) => /vignette|playerAction|station/i.test(entry.message)), "bad quality report", badQualityReport);
    check(result, "Travel Event Builder quality leakage detects AP/RAP combat actor persistence and staged application", leakageQualityReport.errors.some((entry) => entry.leakage === "apRap") && leakageQualityReport.errors.some((entry) => entry.leakage === "automaticCombatStart") && leakageQualityReport.errors.some((entry) => entry.leakage === "actorMutation") && leakageQualityReport.errors.some((entry) => entry.leakage === "persistence") && leakageQualityReport.errors.some((entry) => entry.leakage === "stagedEffectApplication") && leakageQualityReport.warnings.some((entry) => entry.leakage === "oceanOnly"), "boundary leakage report", leakageQualityReport);
    check(result, "Travel Event Builder quality detects missing round vignette", missingVignetteQualityReport.warnings.some((entry) => /opening vignette/i.test(entry.message)), "missing vignette warning", missingVignetteQualityReport.warnings);
    check(result, "Travel Event Builder quality detects missing station playerAction", missingPlayerActionQualityReport.warnings.some((entry) => /playerAction/i.test(entry.message)), "missing playerAction warning", missingPlayerActionQualityReport.warnings);
    check(result, "Travel Event Builder quality detects missing final outcome", missingFinalOutcomeQualityReport.errors.some((entry) => /Missing canonical final outcome success/i.test(entry.message)), "missing final outcome error", missingFinalOutcomeQualityReport.errors);
    check(result, "Travel Event Builder quality detects unknown resource mode and value", badResourceEffectQualityReport.warnings.some((entry) => /unknown resource/i.test(entry.message)) && badResourceEffectQualityReport.warnings.some((entry) => /unknown mode/i.test(entry.message)) && badResourceEffectQualityReport.warnings.some((entry) => /non-numeric value/i.test(entry.message)), "bad resource effect warnings", badResourceEffectQualityReport.warnings);
    check(result, "Travel Event Builder quality introduces no actor AP/RAP travel resource combat persistence mutation", JSON.stringify(qualityEconomyBefore) === JSON.stringify(getShipActionEconomy(actor)) && JSON.stringify(qualityResourcesBefore) === JSON.stringify(getShipTravelResources(actor)) && ![analyzeTravelEventBuilderQuality, prepareTravelEventBuilderQualityReport].some((helper) => /updateShipTravelResources|spendShipActionPoints|resetShipActionEconomy|game\.settings\.set|Actor\.update|actor\.update|startCombat|Combat\.create|applyTravelStagedEffect|applyTravelStagedEffects/.test(String(helper))), "no mutation by quality helpers", { economyBefore: qualityEconomyBefore, economyAfter: getShipActionEconomy(actor), resourcesBefore: qualityResourcesBefore, resourcesAfter: getShipTravelResources(actor) });
    check(result, "Travel Event Builder JSON import/export still works after quality analysis", postQualityDraftExport.ok === true && postQualityDraftImport.ok === true && postQualityDraftImport.draft?.key === completeQualityDraft.key, "post-quality JSON IO", { draftExport: postQualityDraftExport, draftImport: postQualityDraftImport });

    check(result, "Travel Event Builder app exports exist", typeof ArcflightTravelEventBuilder === "function" && typeof openTravelEventBuilder === "function" && typeof prepareTravelEventBuilderShellState === "function" && typeof globalThis.game?.arcflight?.ArcflightTravelEventBuilder === "function" && typeof globalThis.game?.arcflight?.openTravelEventBuilder === "function" && typeof globalThis.game?.arcflight?.prepareTravelEventBuilderShellState === "function" && typeof globalThis.game?.arcflight?.devTools?.ArcflightTravelEventBuilder === "function" && typeof globalThis.game?.arcflight?.devTools?.openTravelEventBuilder === "function" && typeof globalThis.game?.arcflight?.devTools?.prepareTravelEventBuilderShellState === "function", true, { importedClass: typeof ArcflightTravelEventBuilder, importedOpen: typeof openTravelEventBuilder, importedShellState: typeof prepareTravelEventBuilderShellState, apiOpen: typeof globalThis.game?.arcflight?.openTravelEventBuilder, devToolsOpen: typeof globalThis.game?.arcflight?.devTools?.openTravelEventBuilder });
    check(result, "Travel Event Builder library helper exports exist", typeof getTravelEventBuilderLibrary === "function" && typeof saveTravelEventBuilderDraftToLibrary === "function" && typeof loadTravelEventBuilderDraftFromLibrary === "function" && typeof deleteTravelEventBuilderDraftFromLibrary === "function" && typeof duplicateTravelEventBuilderLibraryDraft === "function" && typeof prepareTravelEventBuilderLibraryState === "function" && typeof globalThis.game?.arcflight?.getTravelEventBuilderLibrary === "function" && typeof globalThis.game?.arcflight?.devTools?.saveTravelEventBuilderDraftToLibrary === "function", true, { setting: TRAVEL_EVENT_BUILDER_LIBRARY_SETTING, api: typeof globalThis.game?.arcflight?.getTravelEventBuilderLibrary, devTools: typeof globalThis.game?.arcflight?.devTools?.saveTravelEventBuilderDraftToLibrary });
    check(result, "Travel Event Builder empty library returns safe state", emptyBuilderLibraryState.count === 0 && emptyBuilderLibraryState.hasDrafts === false && Array.isArray(emptyBuilderLibraryState.entries), "empty safe state", emptyBuilderLibraryState);
    check(result, "Travel Event Builder library save stores normalized draft", savedBuilderLibraryDraft.ok === true && savedBuilderLibraryDraft.entry?.draft?.key === completeQualityDraft.key && savedBuilderLibraryDraft.entry?.draft?.builder?.version === TRAVEL_EVENT_BUILDER_VERSION, "saved normalized draft", savedBuilderLibraryDraft);
    check(result, "Travel Event Builder library load returns normalized draft", loadedBuilderLibraryDraft.draft?.key === completeQualityDraft.key && loadedBuilderLibraryDraft.draft?.roundCount === completeQualityDraft.roundCount, "loaded normalized draft", loadedBuilderLibraryDraft);
    check(result, "Travel Event Builder library duplicate creates distinct saved entry", duplicatedBuilderLibraryDraft.ok === true && duplicatedBuilderLibraryDraft.entry?.id && duplicatedBuilderLibraryDraft.entry.id !== savedBuilderLibraryDraft.entry?.id && Object.keys(duplicatedBuilderLibraryDraft.library?.drafts ?? {}).length === 2, "distinct duplicate", duplicatedBuilderLibraryDraft);
    check(result, "Travel Event Builder library delete removes entry", deletedBuilderLibraryDraft.ok === true && deletedBuilderLibraryDraft.deleted?.id === duplicatedBuilderLibraryDraft.entry?.id && !Object.hasOwn(deletedBuilderLibraryDraft.library?.drafts ?? {}, duplicatedBuilderLibraryDraft.entry?.id), "deleted duplicate", deletedBuilderLibraryDraft);
    check(result, "Published Travel Event library helper exports exist", typeof getPublishedTravelEventLibrary === "function" && typeof publishTravelEventDraftToLibrary === "function" && typeof loadPublishedTravelEventFromLibrary === "function" && typeof clonePublishedTravelEventToDraft === "function" && typeof deletePublishedTravelEventFromLibrary === "function" && typeof preparePublishedTravelEventLibraryState === "function" && typeof globalThis.game?.arcflight?.getPublishedTravelEventLibrary === "function" && typeof globalThis.game?.arcflight?.devTools?.publishTravelEventDraftToLibrary === "function", true, { setting: PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING, api: typeof globalThis.game?.arcflight?.getPublishedTravelEventLibrary, devTools: typeof globalThis.game?.arcflight?.devTools?.publishTravelEventDraftToLibrary });
    check(result, "Published Travel Event empty library returns safe state", emptyPublishedLibraryState.count === 0 && emptyPublishedLibraryState.hasEvents === false && Array.isArray(emptyPublishedLibraryState.entries), "empty published safe state", emptyPublishedLibraryState);
    check(result, "Travel Event Builder normalize converts object activeStations into string keys", objectActiveStationsDraft.rounds?.[0]?.activeStations?.join(",") === "captain" && objectActiveStationsDraft.rounds?.[0]?.activeStations?.every((station) => typeof station === "string") && objectActiveStationsDraft.rounds?.[0]?.stationPrompts?.captain?.playerAction === "Captain object prompt stays in stationPrompts.", "object activeStations normalized", objectActiveStationsDraft.rounds?.[0]);
    check(result, "Publishing current draft stores finalized event with no builder metadata", publishedBuilderEvent.ok === true && publishedBuilderEvent.entry?.event?.builder === undefined && publishedBuilderEvent.entry?.sourceDraftId === savedBuilderLibraryDraft.entry?.id && publishedBuilderEvent.entry?.event?.key === publishableDraft.key, "published finalized entry", publishedBuilderEvent);
    check(result, "Published event preserves inferred round activeStations as string keys", publishedBuilderEvent.entry?.event?.rounds?.[0]?.activeStations?.join(",") === "navigator,engineer" && publishedBuilderEvent.entry?.event?.rounds?.[0]?.activeStations?.every((station) => typeof station === "string"), "published activeStations inferred in Travel Five order", publishedBuilderEvent.entry?.event?.rounds?.[0]);
    check(result, "Published event preserves final outcome proposedEffects", publishedBuilderEvent.entry?.event?.finalOutcomes?.success?.proposedEffects?.[0]?.label === "Published supplies reward", "published proposed effects", publishedBuilderEvent.entry?.event?.finalOutcomes?.success?.proposedEffects);
    check(result, "Travel Event Runner helper exports exist", typeof createTravelEventRunnerSession === "function" && typeof prepareTravelEventRunnerState === "function" && typeof setTravelEventRunnerStationResult === "function" && typeof advanceTravelEventRunnerRound === "function" && typeof retreatTravelEventRunnerRound === "function" && typeof completeTravelEventRunnerSession === "function" && typeof exportTravelEventRunnerSessionToJson === "function" && typeof globalThis.game?.arcflight?.createTravelEventRunnerSession === "function" && typeof globalThis.game?.arcflight?.devTools?.openTravelEventRunner === "function", true, { create: typeof createTravelEventRunnerSession, apiCreate: typeof globalThis.game?.arcflight?.createTravelEventRunnerSession });
    check(result, "Travel Event Runner empty published library state is safe", emptyRunnerState.hasPublishedEvents === false && emptyRunnerState.hasSession === false && emptyRunnerState.library?.count === 0, "empty runner state", emptyRunnerState);
    check(result, "Travel Event Runner creates local session from valid published event", runnerSessionCreated.ok === true && runnerSessionCreated.session?.event?.key === "published-smoke" && runnerSessionCreated.session?.status === "active", "created runner session", runnerSessionCreated);
    check(result, "Travel Event Runner current round reads activeStations as string keys", runnerRoundState.currentRound?.activeStations?.join(",") === "navigator,engineer" && runnerRoundState.currentRound.activeStations.every((station) => typeof station === "string"), "runner round active stations", runnerRoundState.currentRound);
    check(result, "Travel Event Runner station prompts display from stationPrompts", runnerRoundState.stations?.some((station) => station.stationKey === "navigator" && /Chart the smoke-safe route/.test(station.prompt)) && runnerRoundState.stations?.some((station) => station.stationKey === "engineer" && /Tune the engine/.test(station.prompt)), "runner station prompts", runnerRoundState.stations);
    check(result, "Travel Event Runner setting station results works", runnerSetEngineer.ok === true && runnerSetEngineer.session?.roundResults?.[0]?.stationResults?.navigator === "success" && runnerSetEngineer.session?.roundResults?.[0]?.stationResults?.engineer === "criticalSuccess", "runner station results", runnerSetEngineer.session?.roundResults?.[0]);
    check(result, "Travel Event Runner invalid station result is rejected safely", runnerInvalidResult.ok === false && runnerInvalidResult.errors?.some((error) => /Invalid/.test(error)), "invalid result rejected", runnerInvalidResult);
    check(result, "Travel Event Runner advancing and retreating rounds works", runnerAdvanced.ok === true && runnerAdvanced.session?.currentRoundIndex === 1 && runnerRetreated.ok === true && runnerRetreated.session?.currentRoundIndex === 0, "advance/retreat", { advanced: runnerAdvanced.session?.currentRoundIndex, retreated: runnerRetreated.session?.currentRoundIndex });
    check(result, "Travel Event Runner completing session produces final summary", runnerCompleted.ok === true && runnerCompleted.session?.status === "completed" && runnerCompleted.summary?.suggestedFinalOutcome === "success" && runnerCompleted.summary?.rounds?.[0]?.stationResults?.navigator === "success", "completed runner summary", runnerCompleted.summary);
    check(result, "Travel Event Runner final summary includes staged proposedEffects without applying them", runnerCompleted.summary?.stagedProposedEffects?.[0]?.label === "Published supplies reward" && JSON.stringify(qualityResourcesBefore) === JSON.stringify(getShipTravelResources(actor)), "read-only staged proposed effects", { effects: runnerCompleted.summary?.stagedProposedEffects, resources: getShipTravelResources(actor) });
    check(result, "Travel Event Runner export session JSON works", runnerExported.ok === true && /Published Smoke/.test(runnerExported.json ?? "") && /stagedProposedEffects/.test(runnerExported.json ?? ""), "runner export json", runnerExported.json);
    check(result, "Travel Event Runner staged consequence review helper exports exist", typeof prepareTravelEventStagedEffectReview === "function" && typeof normalizeTravelEventProposedEffectForReview === "function" && typeof prepareTravelEventResourceEffectPreview === "function" && typeof renderTravelEventStagedEffectReviewMarkdown === "function" && typeof renderTravelEventStagedEffectReviewHtml === "function" && typeof globalThis.game?.arcflight?.prepareTravelEventStagedEffectReview === "function" && typeof globalThis.game?.arcflight?.devTools?.renderTravelEventStagedEffectReviewMarkdown === "function", true, { api: typeof globalThis.game?.arcflight?.prepareTravelEventStagedEffectReview, devTools: typeof globalThis.game?.arcflight?.devTools?.renderTravelEventStagedEffectReviewMarkdown });
    check(result, "Travel Event Runner incomplete session staged review is unavailable", runnerIncompleteReview.available === false, "incomplete review", runnerIncompleteReview);
    check(result, "Travel Event Runner completed session with no proposedEffects returns empty staged review safely", runnerEmptyReview.available === true && runnerEmptyReview.review?.effectCount === 0 && runnerEmptyReview.review?.rows?.length === 0, "empty review", runnerEmptyReview.review);
    check(result, "Travel Event Runner resource proposedEffects return detailed staged review rows", runnerReview.available === true && runnerReview.review?.rows?.[0]?.label === "Published supplies reward" && runnerReview.review?.rows?.[0]?.type === "resource" && runnerReview.review?.rows?.[0]?.resource === "supplies" && runnerReview.review?.rows?.[0]?.mode === "add" && runnerReview.review?.rows?.[0]?.value === 1 && /supplies/.test(runnerReview.review?.rows?.[0]?.rawJson ?? ""), "resource review", runnerReview.review?.rows?.[0]);
    check(result, "Travel Event Runner staged review supported and unsupported counts are correct", runnerMixedReview.review?.supportedEffectCount === 2 && runnerMixedReview.review?.unsupportedEffectCount === 2, "mixed counts", runnerMixedReview.review);
    check(result, "Travel Event Runner note effect appears as read-only note", runnerMixedReview.review?.rows?.[1]?.status === "note" && runnerMixedReview.review?.rows?.[1]?.type === "note", "note review", runnerMixedReview.review?.rows?.[1]);
    check(result, "Travel Event Runner malformed and unknown effects appear unsupported read-only", runnerMixedReview.review?.rows?.[2]?.status === "unsupported" && runnerMixedReview.review?.rows?.[3]?.status === "unsupported" && /malformed/.test(runnerMixedReview.review?.rows?.[3]?.rawJson ?? ""), "unsupported review", runnerMixedReview.review?.rows);
    check(result, "Travel Event Runner staged review markdown includes not-applied warning", /Review only\. Effects have not been applied\./.test(runnerReviewMarkdown.markdown ?? ""), "review markdown", runnerReviewMarkdown.markdown);
    check(result, "Travel Event Runner staged review html escapes unsafe content", /&lt;script&gt;unsafe&lt;\/script&gt;/.test(runnerReviewHtml.html ?? "") && !/<script/i.test(runnerReviewHtml.html ?? ""), "review html", runnerReviewHtml.html);
    check(result, "Travel Event Runner staged review generation does not mutate session or actor resources", runnerReviewNoSessionMutation && runnerResourcesBeforeReview === runnerResourcesAfterReview, "review no mutation", { session: runnerReviewNoSessionMutation, resourcesBefore: runnerResourcesBeforeReview, resourcesAfter: runnerResourcesAfterReview });
    check(result, "Travel Event Runner summary report helper exports exist", typeof prepareTravelEventRunnerSummaryReport === "function" && typeof renderTravelEventRunnerSummaryMarkdown === "function" && typeof renderTravelEventRunnerSummaryHtml === "function" && typeof postTravelEventRunnerSummaryToChat === "function" && typeof createTravelEventRunnerSummaryJournalEntry === "function" && typeof prepareTravelEventRunnerSummaryOutputState === "function" && typeof globalThis.game?.arcflight?.prepareTravelEventRunnerSummaryReport === "function" && typeof globalThis.game?.arcflight?.devTools?.renderTravelEventRunnerSummaryMarkdown === "function", true, { api: typeof globalThis.game?.arcflight?.prepareTravelEventRunnerSummaryReport, devTools: typeof globalThis.game?.arcflight?.devTools?.renderTravelEventRunnerSummaryMarkdown });
    check(result, "Travel Event Runner incomplete session summary output is unavailable", runnerIncompleteSummaryOutput.available === false && runnerIncompleteSummaryOutput.canPostChat === false, "incomplete summary output", runnerIncompleteSummaryOutput);
    check(result, "Travel Event Runner completed session returns summary report", runnerSummaryReport.available === true && runnerSummaryReport.report?.eventName === "Published Smoke" && runnerSummaryReport.report?.finalOutcomeLabel, "summary report", runnerSummaryReport.report);
    check(result, "Travel Event Runner markdown summary includes required report content", /Published Smoke/.test(runnerSummaryMarkdown.markdown ?? "") && /Final Outcome/.test(runnerSummaryMarkdown.markdown ?? "") && /Navigator/.test(runnerSummaryMarkdown.markdown ?? "") && /Published supplies reward/.test(runnerSummaryMarkdown.markdown ?? "") && /Proposed effects have not been applied/.test(runnerSummaryMarkdown.markdown ?? ""), "markdown summary", runnerSummaryMarkdown.markdown);
    check(result, "Travel Event Runner html summary includes escaped required report content", /Published Smoke/.test(runnerSummaryHtml.html ?? "") && /Final Outcome/.test(runnerSummaryHtml.html ?? "") && /Navigator/.test(runnerSummaryHtml.html ?? "") && /Published supplies reward/.test(runnerSummaryHtml.html ?? "") && /Proposed effects have not been applied/.test(runnerSummaryHtml.html ?? "") && !/<script/i.test(runnerSummaryHtml.html ?? ""), "html summary", runnerSummaryHtml.html);
    check(result, "Travel Event Runner summary generation does not mutate session", runnerSessionBeforeSummary === JSON.stringify(runnerCompleted.session), "summary no session mutation", runnerCompleted.session);
    check(result, "Travel Event Runner chat helper blocks incomplete and dry-runs completed", runnerChatIncomplete.available === false && runnerChatIncomplete.created === false && runnerChatDryRun.available === true && runnerChatDryRun.created === false && /Proposed effects have not been applied/.test(runnerChatDryRun.messageData?.content ?? ""), "chat dry runs", { incomplete: runnerChatIncomplete, completed: runnerChatDryRun });
    check(result, "Travel Event Runner journal helper blocks incomplete and dry-runs completed", runnerJournalIncomplete.available === false && runnerJournalIncomplete.created === false && runnerJournalDryRun.available === true && runnerJournalDryRun.created === false && /Travel Event Summary/.test(runnerJournalDryRun.journalData?.name ?? ""), "journal dry runs", { incomplete: runnerJournalIncomplete, completed: runnerJournalDryRun });
    check(result, "Travel Event Runner malformed event fails safely", runnerMalformedSession.ok === false && runnerMalformedSession.session === null, "malformed runner event", runnerMalformedSession);
    check(result, "Travel Event Runner introduces no actor resource chat AP/RAP combat automation", ![createTravelEventRunnerSession, setTravelEventRunnerStationResult, advanceTravelEventRunnerRound, retreatTravelEventRunnerRound, completeTravelEventRunnerSession, exportTravelEventRunnerSessionToJson].some((helper) => /updateShipTravelResources|spendShipActionPoints|resetShipActionEconomy|Actor\.update|actor\.update|ChatMessage|startCombat|Combat\.create|applyTravelStagedEffect|applyTravelStagedEffects/.test(String(helper))), "runner helpers remain manual/local", "no prohibited helpers");
    check(result, "Load published event as draft restores builder metadata", clonedPublishedDraft.ok === true && clonedPublishedDraft.draft?.builder?.status === "draft" && clonedPublishedDraft.draft?.builder?.source === "builder" && clonedPublishedDraft.draft?.key === publishableDraft.key, "cloned published draft", clonedPublishedDraft);
    check(result, "clonePublishedTravelEventToDraft exports activeStations as string keys", clonedPublishedDraftExport.ok === true && clonedPublishedDraftExportData.rounds?.every((round) => round.activeStations?.every((station) => typeof station === "string")) && clonedPublishedDraftExportData.rounds?.[0]?.activeStations?.join(",") === "navigator,engineer", "cloned draft export activeStations", clonedPublishedDraftExportData.rounds?.[0]);
    check(result, "Published publish/load/clone/export draft keeps activeStations as strings only", loadedPublishedEvent.ok === true && loadedPublishedEvent.event?.rounds?.every((round) => round.activeStations?.every((station) => typeof station === "string")) && clonedPublishedDraft.draft?.rounds?.every((round) => round.activeStations?.every((station) => typeof station === "string")) && clonedPublishedDraftExportData.rounds?.every((round) => round.activeStations?.every((station) => typeof station === "string")), "published string activeStations pipeline", { loaded: loadedPublishedEvent.event?.rounds?.[0], cloned: clonedPublishedDraft.draft?.rounds?.[0], exported: clonedPublishedDraftExportData.rounds?.[0] });
    check(result, "Published clone export final keeps activeStations as string keys only", clonedPublishedFinalExport.ok === true && clonedPublishedFinalExportData.rounds?.every((round) => round.activeStations?.every((station) => typeof station === "string")) && clonedPublishedFinalExportData.rounds?.[0]?.activeStations?.join(",") === "navigator,engineer", "cloned final export activeStations", clonedPublishedFinalExportData.rounds?.[0]);
    check(result, "No object values appear inside published pipeline rounds activeStations", [publishedBuilderEvent.entry?.event, loadedPublishedEvent.event, clonedPublishedDraft.draft, clonedPublishedDraftExportData, clonedPublishedFinalExportData].every((eventData) => eventData?.rounds?.every((round) => round.activeStations?.every((station) => typeof station === "string"))), "no activeStations objects", { published: publishedBuilderEvent.entry?.event?.rounds?.[0], draftExport: clonedPublishedDraftExportData.rounds?.[0], finalExport: clonedPublishedFinalExportData.rounds?.[0] });
    check(result, "Duplicate published event as draft creates distinct editable draft", duplicatedPublishedDraft.ok === true && duplicatedPublishedDraft.draft?.builder?.status === "draft" && duplicatedPublishedDraft.draft?.key !== publishableDraft.key && /Copy/.test(duplicatedPublishedDraft.draft?.name ?? ""), "duplicated published draft", duplicatedPublishedDraft);
    check(result, "Published event duplicate key does not silently overwrite", duplicateKeyPublishedEvent.ok === true && duplicateKeyPublishedEvent.entry?.id !== publishedBuilderEvent.entry?.id && duplicateKeyPublishedEvent.entry?.key === publishedBuilderEvent.entry?.key && duplicateKeyPublishedEvent.warnings.some((warning) => /already exists|without overwriting/i.test(warning)), "duplicate key published safely", duplicateKeyPublishedEvent);
    check(result, "Delete published event removes it", deletedPublishedEvent.ok === true && deletedPublishedEvent.deleted?.id === publishedBuilderEvent.entry?.id && !Object.hasOwn(deletedPublishedEvent.library?.events ?? {}, publishedBuilderEvent.entry?.id), "deleted published event", deletedPublishedEvent);
    check(result, "Malformed published event fails safely", malformedPublishedEvent.ok === false && malformedPublishedEvent.event === null && malformedPublishedEvent.errors.some((error) => /malformed/i.test(error)), "malformed published safe failure", malformedPublishedEvent);
    check(result, "Publishing fails when quality report has errors", blockedPublishedEvent.ok === false && blockedPublishedEvent.event === null && blockedPublishedEvent.errors.some((error) => /Quality error|Missing canonical final outcome|Missing final outcome/i.test(error)), "blocked published event", blockedPublishedEvent);
    check(result, "Travel Event Builder malformed library draft fails safely", malformedBuilderLibraryDraft.ok === false && malformedBuilderLibraryDraft.draft === null && malformedBuilderLibraryDraft.errors.length > 0, "safe malformed saved draft", malformedBuilderLibraryDraft);
    check(result, "Travel Event Builder loaded library draft preserves quality and editors", loadedBuilderQualityReport?.ok === true && loadedBuilderFinalOutcomeTextState?.outcomes?.length === 5 && loadedBuilderFinalOutcomeEffectState?.outcomes?.length === 5, "post-load quality/editor state", { quality: loadedBuilderQualityReport, text: loadedBuilderFinalOutcomeTextState, effects: loadedBuilderFinalOutcomeEffectState });
    check(result, "Travel Event Builder import/export still works after loading library draft", loadedBuilderDraftExport.ok === true && loadedBuilderFinalExport.ok === true, "post-load exports", { draft: loadedBuilderDraftExport, final: loadedBuilderFinalExport });
    check(result, "Travel Event Builder normalize preserves imported active station key arrays", crystalDriftDraft.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(","), "normalized imported key array", crystalDriftDraft.rounds?.[0]);
    check(result, "Travel Event Builder normalize infers active stations from stationPrompts", crystalDriftFallbackDraft.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(","), "inferred active station keys", crystalDriftFallbackDraft.rounds?.[0]);
    check(result, "Travel Event Builder export draft preserves and infers active station keys", crystalDriftImported.ok === true && crystalDriftSaved.ok === true && crystalDriftLoaded.draft?.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(",") && crystalDriftExportData.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(",") && crystalDriftFallbackExportData.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(","), "Crystal Drift active station keys", { imported: crystalDriftImported, saved: crystalDriftSaved, loaded: crystalDriftLoaded, exportData: crystalDriftExportData.rounds?.[0], fallbackExportData: crystalDriftFallbackExportData.rounds?.[0] });
    check(result, "Travel Event Builder library save/load preserves and infers active station keys", crystalDriftFallbackSaved.ok === true && crystalDriftFallbackLoaded.draft?.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(","), "fallback library active station keys", { saved: crystalDriftFallbackSaved, loaded: crystalDriftFallbackLoaded });
    check(result, "Travel Event Builder duplicate preserves and infers active station keys", crystalDriftDuplicate.ok === true && crystalDriftDuplicate.draft?.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(",") && crystalDriftFallbackDuplicate.draft?.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(","), "duplicated active station keys", { duplicate: crystalDriftDuplicate, fallbackDuplicate: crystalDriftFallbackDuplicate });
    check(result, "Travel Event Builder export final preserves active stations as string keys", crystalDriftFinalExport.ok === true && crystalDriftFinalExportData.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(",") && crystalDriftFallbackFinalExport.ok === true && crystalDriftFallbackFinalExportData.rounds?.[0]?.activeStations?.join(",") === crystalDriftStationKeys.join(",") && crystalDriftFinalExportData.rounds?.[0]?.activeStations?.every((station) => typeof station === "string") && crystalDriftFallbackFinalExportData.rounds?.[0]?.activeStations?.every((station) => typeof station === "string"), "final export active station keys", { final: crystalDriftFinalExportData.rounds?.[0], fallbackFinal: crystalDriftFallbackFinalExportData.rounds?.[0] });
    check(result, "Travel Event Builder quality after library load sees inferred station prompts", crystalDriftLoadedQuality?.warnings?.every((entry) => !/no active stations/i.test(entry.message)) === true && crystalDriftFallbackLoadedQuality?.warnings?.every((entry) => !/no active stations/i.test(entry.message)) === true, "no no-active-stations warning", { loaded: crystalDriftLoadedQuality?.warnings, fallbackLoaded: crystalDriftFallbackLoadedQuality?.warnings });
    check(result, "Travel Event Builder library introduces no actor/AP/RAP/combat/staged-effect/travel-resource mutation", ![getTravelEventBuilderLibrary, saveTravelEventBuilderDraftToLibrary, loadTravelEventBuilderDraftFromLibrary, deleteTravelEventBuilderDraftFromLibrary, duplicateTravelEventBuilderLibraryDraft, prepareTravelEventBuilderLibraryState].some((helper) => /updateShipTravelResources|spendShipActionPoints|resetShipActionEconomy|Actor\.update|actor\.update|startCombat|Combat\.create|applyTravelStagedEffect|applyTravelStagedEffects/.test(String(helper))), "no prohibited runtime mutation helpers", "library only reads/writes its world setting");
    check(result, "Travel Event Builder shell state previews local draft only", builderShellState.preview?.validation?.ok === true && builderShellState.exportPreview?.exportDraftAvailable === true && builderShellState.draft?.key === builderDraft.key && typeof builderShellState.draftJson === "string", "builder shell preview", builderShellState);
    check(result, "Travel Event Builder form option data exists", builderShellState.formOptions?.categories?.length > 0 && builderShellState.formOptions?.activeResources?.length > 0 && builderShellState.formOptions?.travelStations?.length > 0 && builderFormOptions.categories.some((option) => option.value === "discovery" && option.selected === true), "category/resource/station form options", { shell: builderShellState.formOptions, helper: builderFormOptions });
    check(result, "Travel Event Builder form edits apply locally and normalize rounds", formEditedBuilderDraft.key === "form-edited-smoke" && formEditedBuilderDraft.name === "Form Edited Smoke" && formEditedBuilderDraft.category === "navigation" && formEditedBuilderDraft.baseDC === 21 && formEditedBuilderDraft.roundCount === 2 && formEditedBuilderDraft.rounds.length === 2 && formEditedBuilderDraft.activeResources.join(",") === "hull,morale" && formEditedBuilderDraft.travelStations.join(",") === "navigator,engineer" && builderDraft.key === "smoke-builder-event" && builderDraft.roundCount === 4, "local-only normalized form draft", { original: builderDraft, edited: formEditedBuilderDraft });
    check(result, "Travel Event Builder form-edited draft remains validatable", formEditedValidation.normalizedDraft?.key === "form-edited-smoke" && Array.isArray(formEditedValidation.errors) && Array.isArray(formEditedValidation.warnings), "validatable form draft", formEditedValidation);
    check(result, "Travel Event Builder JSON import/export still works after form edits", formEditedDraftExport.ok === true && formEditedDraftImport.ok === true && formEditedDraftImport.draft?.key === "form-edited-smoke" && [true, false].includes(formEditedFinalExport.ok), "post-form JSON IO", { draftExport: formEditedDraftExport, draftImport: formEditedDraftImport, finalExport: formEditedFinalExport });
    check(result, "Travel Event Builder round editor helper exports exist", typeof prepareTravelEventBuilderRoundEditorState === "function" && typeof applyTravelEventBuilderRoundFormDataToDraft === "function" && typeof globalThis.game?.arcflight?.prepareTravelEventBuilderRoundEditorState === "function" && typeof globalThis.game?.arcflight?.devTools?.applyTravelEventBuilderRoundFormDataToDraft === "function", true, { stateHelper: typeof prepareTravelEventBuilderRoundEditorState, applyHelper: typeof applyTravelEventBuilderRoundFormDataToDraft });
    check(result, "Travel Event Builder round editor state lists normalized rounds", builderRoundEditorState.rounds?.length === builderDraft.roundCount && builderRoundEditorState.rounds[0]?.stationOptions?.length === builderDraft.travelStations.length && builderRoundEditorState.rounds[0]?.stationPrompts?.length === builderDraft.travelStations.length, "normalized round editor state", builderRoundEditorState);
    check(result, "Travel Event Builder round form edits apply locally only", roundEditedBuilderDraft !== builderDraft && builderDraft.rounds[0].openingVignette !== "Smoke-edited opening vignette stays in the local draft." && roundEditedBuilderDraft.key === builderDraft.key, "local-only round edit", { original: builderDraft.rounds[0], edited: roundEditedBuilderDraft.rounds[0] });
    check(result, "Travel Event Builder openingVignette round edit persists", roundEditedBuilderDraft.rounds[0].openingVignette === "Smoke-edited opening vignette stays in the local draft.", "updated openingVignette", roundEditedBuilderDraft.rounds[0].openingVignette);
    check(result, "Travel Event Builder activeStations round edit persists with allowed string keys only", roundEditedBuilderDraft.rounds[0].activeStations.join(",") === "navigator,captain" && roundEditedBuilderDraft.rounds[0].activeStations.every((station) => typeof station === "string"), "navigator,captain only", roundEditedBuilderDraft.rounds[0].activeStations);
    check(result, "Travel Event Builder station prompt playerAction round edit persists in stationPrompts", roundEditedBuilderDraft.rounds[0].stationPrompts.navigator?.playerAction === "Chart the safest path through the smoke-test anomaly.", "updated navigator playerAction", roundEditedBuilderDraft.rounds[0].stationPrompts.navigator);
    check(result, "Travel Event Builder JSON import/export still works after round edits", roundEditedDraftExport.ok === true && roundEditedDraftImport.ok === true && roundEditedDraftImport.draft?.rounds?.[0]?.openingVignette === "Smoke-edited opening vignette stays in the local draft.", "post-round JSON IO", { draftExport: roundEditedDraftExport, draftImport: roundEditedDraftImport });
    check(result, "Travel Event Builder round edits introduce no actor state, AP/RAP, travel resource, combat, or persistence mutation", JSON.stringify(builderRoundEconomyBefore) === JSON.stringify(getShipActionEconomy(actor)) && JSON.stringify(builderRoundResourcesBefore) === JSON.stringify(getShipTravelResources(actor)) && ![applyTravelEventBuilderRoundFormDataToDraft, prepareTravelEventBuilderRoundEditorState].some((helper) => /updateShipTravelResources|spendShipActionPoints|resetShipActionEconomy|game\.settings\.set|Actor\.update|actor\.update|startCombat|Combat\.create/.test(String(helper))), "no actor/combat/persistence mutation by round helpers", { economyBefore: builderRoundEconomyBefore, economyAfter: getShipActionEconomy(actor), resourcesBefore: builderRoundResourcesBefore, resourcesAfter: getShipTravelResources(actor) });

    check(result, "Travel Event Builder final outcome editor helper exports exist", typeof prepareTravelEventBuilderFinalOutcomeEditorState === "function" && typeof applyTravelEventBuilderFinalOutcomeFormDataToDraft === "function" && typeof globalThis.game?.arcflight?.prepareTravelEventBuilderFinalOutcomeEditorState === "function" && typeof globalThis.game?.arcflight?.devTools?.applyTravelEventBuilderFinalOutcomeFormDataToDraft === "function", true, { stateHelper: typeof prepareTravelEventBuilderFinalOutcomeEditorState, applyHelper: typeof applyTravelEventBuilderFinalOutcomeFormDataToDraft });
    check(result, "Travel Event Builder final outcome editor state lists five canonical outcomes", finalOutcomeEditorState.outcomes?.map((outcome) => outcome.key).join(",") === "criticalSuccess,success,mixed,failure,criticalFailure", "five canonical outcomes", finalOutcomeEditorState);
    check(result, "Travel Event Builder final outcome form edits apply locally only", finalOutcomeEditedDraft !== stagedFinalOutcomeDraft && stagedFinalOutcomeDraft.finalOutcomes.criticalSuccess.label !== "Smoke Critical Success" && finalOutcomeEditedDraft.key === stagedFinalOutcomeDraft.key, "local-only final outcome edit", { original: stagedFinalOutcomeDraft.finalOutcomes.criticalSuccess, edited: finalOutcomeEditedDraft.finalOutcomes.criticalSuccess });
    check(result, "Travel Event Builder final outcome narrative/reward/consequence edits persist", finalOutcomeEditedDraft.finalOutcomes.criticalSuccess.vignette === "The crew turns the smoke-test route into a clean triumph." && finalOutcomeEditedDraft.finalOutcomes.criticalSuccess.rewards?.[0] === "Gain a local-only smoke reward." && finalOutcomeEditedDraft.finalOutcomes.criticalSuccess.losses?.[0] === "No consequence beyond a clean log entry." && finalOutcomeEditedDraft.finalOutcomes.mixed.losses?.[0] === "Mark a narrative complication.", "text persisted", finalOutcomeEditedDraft.finalOutcomes);
    check(result, "Travel Event Builder final outcome staged/resource effects remain data-only and unapplied", stagedFinalOutcomeEditorState.outcomes.find((outcome) => outcome.key === "criticalSuccess")?.hasProposedEffects === true && finalOutcomeEditedDraft.finalOutcomes.criticalSuccess.proposedEffects?.[0]?.type === "resource" && JSON.stringify(finalOutcomeEconomyBefore) === JSON.stringify(getShipActionEconomy(actor)) && JSON.stringify(finalOutcomeResourcesBefore) === JSON.stringify(getShipTravelResources(actor)), "read-only effect summaries without mutation", { editor: stagedFinalOutcomeEditorState.outcomes.find((outcome) => outcome.key === "criticalSuccess"), effects: finalOutcomeEditedDraft.finalOutcomes.criticalSuccess.proposedEffects });
    check(result, "Travel Event Builder final outcome edits introduce no actor state, AP/RAP, travel resource, combat, persistence, or staged-effect application", ![applyTravelEventBuilderFinalOutcomeFormDataToDraft, prepareTravelEventBuilderFinalOutcomeEditorState].some((helper) => /updateShipTravelResources|spendShipActionPoints|resetShipActionEconomy|game\.settings\.set|Actor\.update|actor\.update|startCombat|Combat\.create|applyTravelStagedEffect|applyTravelStagedEffects/.test(String(helper))) && JSON.stringify(finalOutcomeEconomyBefore) === JSON.stringify(getShipActionEconomy(actor)) && JSON.stringify(finalOutcomeResourcesBefore) === JSON.stringify(getShipTravelResources(actor)), "no actor/combat/persistence/staged application by final outcome helpers", { economyBefore: finalOutcomeEconomyBefore, economyAfter: getShipActionEconomy(actor), resourcesBefore: finalOutcomeResourcesBefore, resourcesAfter: getShipTravelResources(actor) });
    check(result, "Travel Event Builder JSON import/export still works after final outcome text edits", finalOutcomeDraftExport.ok === true && finalOutcomeDraftImport.ok === true && finalOutcomeDraftImport.draft?.finalOutcomes?.criticalSuccess?.vignette === "The crew turns the smoke-test route into a clean triumph." && [true, false].includes(finalOutcomeFinalExport.ok), "post-final-outcome JSON IO", { draftExport: finalOutcomeDraftExport, draftImport: finalOutcomeDraftImport, finalExport: finalOutcomeFinalExport });
    check(result, "Travel Event Builder malformed final outcome import warns without crashing", malformedFinalOutcomeImport.ok === false && malformedFinalOutcomeImport.errors.some((error) => error.includes("Final outcome criticalSuccess must be an object")) && malformedFinalOutcomeImport.draft?.finalOutcomes?.criticalSuccess, "malformed final outcome validation error", malformedFinalOutcomeImport);

    check(result, "Travel Event Builder final outcome effect editor helper exports exist", typeof prepareTravelEventBuilderFinalOutcomeEffectEditorState === "function" && typeof applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft === "function" && typeof globalThis.game?.arcflight?.prepareTravelEventBuilderFinalOutcomeEffectEditorState === "function" && typeof globalThis.game?.arcflight?.devTools?.applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft === "function", true, { stateHelper: typeof prepareTravelEventBuilderFinalOutcomeEffectEditorState, applyHelper: typeof applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft, api: typeof globalThis.game?.arcflight?.prepareTravelEventBuilderFinalOutcomeEffectEditorState, devTools: typeof globalThis.game?.arcflight?.devTools?.applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft });
    check(result, "Travel Event Builder final outcome effect editor state lists resource effects", effectEditorState.outcomes.find((outcome) => outcome.key === "criticalSuccess")?.resourceEffects?.[0]?.resource === "morale" && effectEditorState.outcomes.find((outcome) => outcome.key === "criticalSuccess")?.hasReadOnlyEffects === true, "resource and read-only effects listed", effectEditorState.outcomes.find((outcome) => outcome.key === "criticalSuccess"));
    check(result, "Travel Event Builder adding a final outcome resource effect updates only the draft", effectAddedDraft !== effectEditorDraft && !effectEditorDraft.finalOutcomes.success.proposedEffects?.some((effect) => effect.resource === "supplies") && effectAddedDraft.finalOutcomes.success.proposedEffects?.[0]?.resource === "supplies", "draft-only added effect", { before: effectEditorDraft.finalOutcomes.success.proposedEffects, after: effectAddedDraft.finalOutcomes.success.proposedEffects });
    check(result, "Travel Event Builder final outcome resource effect edits persist", effectEditedDraft.finalOutcomes.success.proposedEffects?.[0]?.resource === "hull" && effectEditedDraft.finalOutcomes.success.proposedEffects?.[0]?.mode === "set" && effectEditedDraft.finalOutcomes.success.proposedEffects?.[0]?.value === 7 && effectEditedDraft.finalOutcomes.success.proposedEffects?.[0]?.label === "Set hull smoke value", "edited effect", effectEditedDraft.finalOutcomes.success.proposedEffects?.[0]);
    check(result, "Travel Event Builder final outcome resource effect removal persists", Array.isArray(effectRemovedDraft.finalOutcomes.success.proposedEffects) && effectRemovedDraft.finalOutcomes.success.proposedEffects.length === 0, "removed effect", effectRemovedDraft.finalOutcomes.success.proposedEffects);
    check(result, "Travel Event Builder unsupported final outcome effects remain read-only and preserved", effectEditedDraft.finalOutcomes.criticalSuccess.proposedEffects?.some((effect) => effect.type === "clock") && effectEditorState.outcomes.find((outcome) => outcome.key === "criticalSuccess")?.readOnlyEffectSummaries?.some((effect) => effect.type === "clock"), "unsupported effect preserved", { effects: effectEditedDraft.finalOutcomes.criticalSuccess.proposedEffects, state: effectEditorState.outcomes.find((outcome) => outcome.key === "criticalSuccess") });
    check(result, "Travel Event Builder invalid final outcome resource effect edits fail safely or warn", invalidEffectEditDraft.finalOutcomes.criticalSuccess.proposedEffects?.[0]?.resource === "morale" && invalidEffectQualityReport.warnings.some((entry) => /unknown resource|unknown mode|non-numeric/i.test(entry.message)), "invalid edit ignored and invalid staged data warned", { invalidEffectEditDraft, invalidEffectQualityReport });
    check(result, "Travel Event Builder final outcome effect edits introduce no actor state, AP/RAP, ship travel resource, combat, persistence, or staged-effect application", ![applyTravelEventBuilderFinalOutcomeEffectFormDataToDraft, prepareTravelEventBuilderFinalOutcomeEffectEditorState].some((helper) => /updateShipTravelResources|spendShipActionPoints|resetShipActionEconomy|game\.settings\.set|Actor\.update|actor\.update|startCombat|Combat\.create|applyTravelStagedEffect|applyTravelStagedEffects/.test(String(helper))) && JSON.stringify(effectEditorEconomyBefore) === JSON.stringify(getShipActionEconomy(actor)) && JSON.stringify(effectEditorResourcesBefore) === JSON.stringify(getShipTravelResources(actor)), "no actor/combat/persistence/staged application by effect editor helpers", { economyBefore: effectEditorEconomyBefore, economyAfter: getShipActionEconomy(actor), resourcesBefore: effectEditorResourcesBefore, resourcesAfter: getShipTravelResources(actor) });
    check(result, "Travel Event Builder JSON import/export still works after final outcome effect edits", effectEditedDraftExport.ok === true && effectEditedDraftImport.ok === true && effectEditedDraftImport.draft?.finalOutcomes?.success?.proposedEffects?.[0]?.label === "Set hull smoke value", "post-effect JSON IO", { draftExport: effectEditedDraftExport, draftImport: effectEditedDraftImport });

    check(result, "Travel Event Builder form edits introduce no AP/RAP, travel resource, or actor mutation", JSON.stringify(builderFormEconomyBefore) === JSON.stringify(getShipActionEconomy(actor)) && JSON.stringify(builderFormResourcesBefore) === JSON.stringify(getShipTravelResources(actor)) && ![applyTravelEventBuilderFormDataToDraft, prepareTravelEventBuilderFormOptions].some((helper) => /updateShipTravelResources|spendShipActionPoints|resetShipActionEconomy|game\.settings\.set|Actor\.update|actor\.update/.test(String(helper))), "no actor state mutation by form helpers", { economyBefore: builderFormEconomyBefore, economyAfter: getShipActionEconomy(actor), resourcesBefore: builderFormResourcesBefore, resourcesAfter: getShipTravelResources(actor) });
    check(result, "createTravelEventDraft returns canonical draft", builderDraft.builder?.status === "draft" && builderDraft.builder?.source === "builder" && builderDraft.roundCount === 4 && builderDraft.rounds.length === 4 && builderDraft.baseDC === 19 && builderDraft.category === "discovery" && builderDraft.travelStations.length === 5 && builderDraft.finalOutcomes && builderDraft.rounds.every((round) => round.outcomeBranches), "canonical builder draft", builderDraft);
    check(result, "normalizeTravelEventDraft does not mutate input", stringifySmokeData(normalizeInput) === normalizeBefore && normalizedBuilderDraft !== normalizeInput, "input unchanged and new object", { before: normalizeBefore, after: stringifySmokeData(normalizeInput), normalized: normalizedBuilderDraft });
    check(result, "validateTravelEventDraft rejects incomplete draft safely", invalidBuilderValidation.ok === false && invalidBuilderValidation.errors.some((error) => error.includes("key")), "safe validation failure", invalidBuilderValidation);
    check(result, "finalizeTravelEventDraft blocks invalid draft", invalidBuilderFinalize.ok === false && invalidBuilderFinalize.event === null, "invalid draft blocked", invalidBuilderFinalize);
    check(result, "finalized valid draft removes builder metadata", validBuilderFinalize.ok === true && validBuilderFinalize.event?.builder === undefined && validateTravelEventDefinition(validBuilderFinalize.event, { strictAuthoring: true }).ok === true, "final event without builder metadata", validBuilderFinalize);
    check(result, "cloneTravelEventToDraft preserves source event data but adds builder metadata", stringifySmokeData(sourceTravelEvent) === sourceTravelEventBeforeClone && clonedBuilderDraft.key === sourceTravelEvent.key && clonedBuilderDraft.builder?.source === "builder" && clonedBuilderDraft.builder?.status === "draft", "cloned draft with metadata", { cloned: clonedBuilderDraft, sourceUnchanged: stringifySmokeData(sourceTravelEvent) === sourceTravelEventBeforeClone });
    check(result, "createTravelBuilderResourceEffect builds resource effect", validResourceEffect.type === "resource" && validResourceEffect.resource === "morale" && validResourceEffect.mode === "add" && validResourceEffect.value === -1 && validResourceEffect.label === "Morale -1" && !Object.hasOwn(validResourceEffect, "warnings"), "valid resource effect", validResourceEffect);
    check(result, "createTravelBuilderResourceEffect rejects/flags bad resource", invalidResourceEffect.type === "resource" && invalidResourceEffect.resource === "hull" && Array.isArray(invalidResourceEffect.warnings) && invalidResourceEffect.warnings.some((warning) => warning.includes("Unknown travel resource")), "bad resource flagged", invalidResourceEffect);
    check(result, "prepareTravelEventBuilderPreview returns validation and round summaries", builderPreview.validation?.ok === true && builderPreview.rounds?.length === 4 && builderPreview.finalOutcomes?.length === 5 && builderPreview.baseDC === 19, "preview summary", builderPreview);
    check(result, "Travel Event Builder finalized data has no AP/RAP mutation", validBuilderFinalize.ok === true && !containsSmokeTerm(validBuilderFinalize.event, /\b(?:spend(?:ing)?\s+)?(?:AP|RAP|action points?|reaction action points?)\b/i), "no AP/RAP references", validBuilderFinalize.event);
    check(result, "Travel Event Builder helpers do not mutate travel resources", validResourceEffect.type === "resource" && ![createTravelEventDraft, normalizeTravelEventDraft, validateTravelEventDraft, finalizeTravelEventDraft, cloneTravelEventToDraft, applyTravelEventBuilderFormDataToDraft, prepareTravelEventBuilderFormOptions, prepareTravelEventBuilderPreview].some((helper) => /updateShipTravelResources|applyTravelStagedEffect|applyTravelStagedEffects/.test(String(helper))), "no resource mutation helper calls", validResourceEffect);
    check(result, "Travel Event Builder helpers do not automate combat", ![createTravelEventDraft, normalizeTravelEventDraft, validateTravelEventDraft, finalizeTravelEventDraft, cloneTravelEventToDraft, applyTravelEventBuilderFormDataToDraft, prepareTravelEventBuilderFormOptions, prepareTravelEventBuilderPreview].some((helper) => /Combat(?:ant)?\.create|createCombat|startCombat|combat\.start/i.test(String(helper))), "no combat automation calls", TRAVEL_EVENT_BUILDER_VERSION);

    check(result, "Ship sheet travel runner readout exposes open button state", travelRunnerReadout.canOpen === true && travelRunnerReadout.hasActiveEvent === false && travelRunnerReadout.message === "No active travel event.", "can open with no active event", travelRunnerReadout);
    await actor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: preservedCurrent });
    shipData = getArcflightShipData(actor);
    check(result, "Ship action economy helpers are exposed", typeof globalThis.game?.arcflight?.getShipActionEconomy === "function" && typeof globalThis.game?.arcflight?.resetShipActionEconomy === "function" && typeof globalThis.game?.arcflight?.spendShipActionPoints === "function" && typeof globalThis.game?.arcflight?.canSpendShipActionPoints === "function" && typeof globalThis.game?.arcflight?.devTools?.getShipActionEconomy === "function" && typeof globalThis.game?.arcflight?.devTools?.resetShipActionEconomy === "function" && typeof globalThis.game?.arcflight?.devTools?.spendShipActionPoints === "function" && typeof globalThis.game?.arcflight?.devTools?.canSpendShipActionPoints === "function", true, { getShipActionEconomy: typeof globalThis.game?.arcflight?.getShipActionEconomy, resetShipActionEconomy: typeof globalThis.game?.arcflight?.resetShipActionEconomy, spendShipActionPoints: typeof globalThis.game?.arcflight?.spendShipActionPoints, canSpendShipActionPoints: typeof globalThis.game?.arcflight?.canSpendShipActionPoints, devToolsGetShipActionEconomy: typeof globalThis.game?.arcflight?.devTools?.getShipActionEconomy, devToolsResetShipActionEconomy: typeof globalThis.game?.arcflight?.devTools?.resetShipActionEconomy, devToolsSpendShipActionPoints: typeof globalThis.game?.arcflight?.devTools?.spendShipActionPoints, devToolsCanSpendShipActionPoints: typeof globalThis.game?.arcflight?.devTools?.canSpendShipActionPoints });
    const builderIoDraft = createTravelEventDraft({ key: "void-whale-shadow", name: "Void Whale Shadow", category: "discovery", roundCount: 4, baseDC: 19 });
    const builderIoPreview = prepareTravelEventBuilderPreview(builderIoDraft);
    const validBuilderJson = JSON.stringify(builderIoDraft);
    const parsedValidBuilderJson = parseTravelEventBuilderJson(validBuilderJson);
    const parsedMalformedBuilderJson = parseTravelEventBuilderJson("{not valid json");
    const parsedArrayBuilderJson = parseTravelEventBuilderJson("[]");
    const importedBuilderDraft = importTravelEventDraftFromJson(validBuilderJson);
    const malformedImport = importTravelEventDraftFromJson("{not valid json");
    const importMutationSource = { ...builderIoDraft, tags: ["before"] };
    const importMutationSnapshot = JSON.stringify(importMutationSource);
    const importedFromData = importTravelEventDraftFromData(importMutationSource);
    const exportedBuilderDraft = exportTravelEventDraftToJson(builderIoDraft);
    const invalidBuilderDraft = normalizeTravelEventDraft({ ...builderIoDraft, key: "", name: "" });
    const exportedInvalidBuilderDraft = exportTravelEventDraftToJson(invalidBuilderDraft);
    const blockedInvalidBuilderDraft = exportTravelEventDraftToJson(invalidBuilderDraft, { requireValid: true });
    const exportedWithoutBuilderMetadata = exportTravelEventDraftToJson(builderIoDraft, { includeBuilderMetadata: false });
    const exportedWithoutBuilderMetadataData = exportedWithoutBuilderMetadata.json ? JSON.parse(exportedWithoutBuilderMetadata.json) : null;
    const blockedInvalidFinalExport = exportFinalTravelEventToJson(invalidBuilderDraft);
    const exportedFinalBuilderEvent = exportFinalTravelEventToJson(importedBuilderDraft.draft);
    const exportedFinalBuilderEventData = exportedFinalBuilderEvent.json ? JSON.parse(exportedFinalBuilderEvent.json) : null;
    const exportPreview = prepareTravelEventBuilderExportPreview(importedBuilderDraft.draft);
    const builderIoEconomyBefore = getShipActionEconomy(actor);
    const builderIoResourcesBefore = getShipTravelResources(actor);
    check(result, "Travel event builder foundation helper exports exist", typeof TRAVEL_EVENT_BUILDER_VERSION === "string" && typeof createTravelEventDraft === "function" && typeof normalizeTravelEventDraft === "function" && typeof validateTravelEventDraft === "function" && typeof finalizeTravelEventDraft === "function" && typeof cloneTravelEventToDraft === "function" && typeof createTravelBuilderResourceEffect === "function" && typeof createTravelBuilderRound === "function" && typeof createTravelBuilderStationPrompt === "function" && typeof createTravelBuilderOutcomeBranch === "function" && typeof createTravelBuilderFinalOutcome === "function" && typeof prepareTravelEventBuilderRoundEditorState === "function" && typeof applyTravelEventBuilderRoundFormDataToDraft === "function" && typeof prepareTravelEventBuilderPreview === "function", true, { version: TRAVEL_EVENT_BUILDER_VERSION });
    check(result, "Travel event builder IO helper exports exist", typeof TRAVEL_EVENT_BUILDER_IO_VERSION === "string" && typeof exportTravelEventDraftToJson === "function" && typeof importTravelEventDraftFromJson === "function" && typeof importTravelEventDraftFromData === "function" && typeof exportFinalTravelEventToJson === "function" && typeof parseTravelEventBuilderJson === "function" && typeof prepareTravelEventBuilderExportPreview === "function" && typeof globalThis.game?.arcflight?.exportTravelEventDraftToJson === "function" && typeof globalThis.game?.arcflight?.devTools?.exportTravelEventDraftToJson === "function", true, { version: TRAVEL_EVENT_BUILDER_IO_VERSION, api: typeof globalThis.game?.arcflight?.exportTravelEventDraftToJson, devTools: typeof globalThis.game?.arcflight?.devTools?.exportTravelEventDraftToJson });
    check(result, "parseTravelEventBuilderJson accepts valid JSON", parsedValidBuilderJson.ok === true && parsedValidBuilderJson.data?.key === builderIoDraft.key, "parsed object", parsedValidBuilderJson);
    check(result, "parseTravelEventBuilderJson rejects malformed JSON safely", parsedMalformedBuilderJson.ok === false && parsedMalformedBuilderJson.errors.length > 0 && parsedMalformedBuilderJson.data === null, "safe malformed failure", parsedMalformedBuilderJson);
    check(result, "parseTravelEventBuilderJson rejects non-object JSON roots safely", parsedArrayBuilderJson.ok === false && parsedArrayBuilderJson.data === null, "safe root failure", parsedArrayBuilderJson);
    check(result, "importTravelEventDraftFromJson imports valid draft JSON", importedBuilderDraft.ok === true && importedBuilderDraft.draft?.key === builderIoDraft.key && importedBuilderDraft.validation?.ok === true, "imported draft", importedBuilderDraft);
    check(result, "importTravelEventDraftFromJson rejects malformed JSON safely", malformedImport.ok === false && malformedImport.draft === null && malformedImport.errors.length > 0, "safe malformed import", malformedImport);
    check(result, "importTravelEventDraftFromData does not mutate input", importedFromData.ok === true && JSON.stringify(importMutationSource) === importMutationSnapshot, "input unchanged", { before: importMutationSnapshot, after: importMutationSource });
    check(result, "exportTravelEventDraftToJson exports draft JSON", exportedBuilderDraft.ok === true && typeof exportedBuilderDraft.json === "string" && JSON.parse(exportedBuilderDraft.json).builder?.version === TRAVEL_EVENT_BUILDER_VERSION, "draft JSON", exportedBuilderDraft.json);
    check(result, "exportTravelEventDraftToJson exports invalid drafts by default but blocks requireValid", exportedInvalidBuilderDraft.ok === true && blockedInvalidBuilderDraft.ok === false && blockedInvalidBuilderDraft.json === null, "WIP export allowed; requireValid blocked", { exportedInvalidBuilderDraft, blockedInvalidBuilderDraft });
    check(result, "exportTravelEventDraftToJson can omit builder metadata", exportedWithoutBuilderMetadata.ok === true && exportedWithoutBuilderMetadataData?.builder === undefined, "builder metadata omitted", exportedWithoutBuilderMetadataData);
    check(result, "exportFinalTravelEventToJson blocks invalid data", blockedInvalidFinalExport.ok === false && blockedInvalidFinalExport.json === null, "invalid final blocked", blockedInvalidFinalExport);
    check(result, "exportFinalTravelEventToJson exports valid event JSON without builder metadata", exportedFinalBuilderEvent.ok === true && exportedFinalBuilderEventData?.builder === undefined && exportedFinalBuilderEventData?.key === builderIoDraft.key, "final event data", exportedFinalBuilderEventData);
    check(result, "prepareTravelEventBuilderExportPreview returns useful summary", exportPreview.key === builderIoDraft.key && exportPreview.finalizable === true && exportPreview.exportDraftAvailable === true && exportPreview.exportFinalAvailable === true, "export preview", exportPreview);
    check(result, "Travel event builder foundation preserves PR171 defaults", createTravelEventDraft().roundCount === 4 && Array.isArray(builderIoDraft.futureAutomationNotes) && createTravelBuilderResourceEffect({ resource: "morale", value: -1 }).mode === "add" && createTravelBuilderResourceEffect({ resource: "morale", value: -1 }).value === -1 && Boolean(validateTravelEventDraft(builderIoDraft).normalizedDraft) && finalizeTravelEventDraft(builderIoDraft).event?.builder === undefined, "PR171 builder foundation contract", { defaultRoundCount: createTravelEventDraft().roundCount, futureAutomationNotes: builderIoDraft.futureAutomationNotes, resourceEffect: createTravelBuilderResourceEffect({ resource: "morale", value: -1 }), validation: validateTravelEventDraft(builderIoDraft), finalized: finalizeTravelEventDraft(builderIoDraft) });
    check(result, "Travel event builder preview remains valid", builderIoPreview.validation?.ok === true && builderIoPreview.rounds?.length === 4 && builderIoPreview.finalOutcomes?.length === 5 && builderIoPreview.baseDC === 19, "builder preview", builderIoPreview);
    check(result, "Builder IO introduces no AP/RAP, ship resource, combat, or persistence mutation", JSON.stringify(builderIoEconomyBefore) === JSON.stringify(getShipActionEconomy(actor)) && JSON.stringify(builderIoResourcesBefore) === JSON.stringify(getShipTravelResources(actor)), "no actor state mutation by IO helpers", { economyBefore: builderIoEconomyBefore, economyAfter: getShipActionEconomy(actor), resourcesBefore: builderIoResourcesBefore, resourcesAfter: getShipTravelResources(actor) });
    check(result, "canSpend AP/RAP passes with enough resources", canSpendShipActionPoints(actor, { ap: 1, rap: 0 }).canSpend === true, "can spend 1 AP", canSpendShipActionPoints(actor, { ap: 1, rap: 0 }));
    check(result, "canSpend AP/RAP blocks insufficient resources", canSpendShipActionPoints(actor, { ap: actionEconomy.maxAP + 1, rap: 0 }).canSpend === false, "cannot overspend AP", canSpendShipActionPoints(actor, { ap: actionEconomy.maxAP + 1, rap: 0 }));
    const spentEconomy = await spendShipActionPoints(actor, { ap: 1, rap: 0, reason: "Smoke spend" });
    check(result, "spend helper decrements AP/RAP", spentEconomy.ap === actionEconomy.ap - 1 && spentEconomy.rap === actionEconomy.rap, "AP decremented", { before: actionEconomy, after: spentEconomy });
    try {
      await spendShipActionPoints(actor, { ap: spentEconomy.maxAP + 1, rap: 0, reason: "Smoke overspend" });
      check(result, "spend helper blocks overspend", false, "overspend rejection", "accepted");
    } catch (error) {
      check(result, "spend helper blocks overspend", error.message.includes("Cannot spend"), "overspend rejection", error.message);
    }
    actionEconomy = await resetShipActionEconomy(actor);
    check(result, "reset helper restores AP/RAP to max", actionEconomy.ap === actionEconomy.maxAP && actionEconomy.rap === actionEconomy.maxRAP, "current equals max", actionEconomy);
    await assignStation(actor, "captain", { id: actor.id, uuid: actor.uuid, name: actor.name }, { assigneeType: "actor" });
    const affordablePreview = previewStationAction(actor, "rally-crew", { phase: "combat" });
    check(result, "Station action preview includes AP/RAP affordability and cost", affordablePreview.resourceCost?.ap === affordablePreview.apCost && affordablePreview.resourceCost?.rap === affordablePreview.rapCost && affordablePreview.canAfford === true, "cost and affordability", affordablePreview.resourceCost);
    await actor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.actionEconomy.ap`]: 0, [`flags.${ARCFLIGHT_MODULE_ID}.system.actionEconomy.rap`]: 0 });
    const unaffordablePreview = previewStationAction(actor, "rally-crew", { phase: "combat" });
    check(result, "Station action preview warns when AP/RAP is insufficient", unaffordablePreview.canAfford === false && unaffordablePreview.severity === "warning" && unaffordablePreview.warnings.length > 0, "warning affordability preview", unaffordablePreview);
    actionEconomy = await resetShipActionEconomy(actor);
    const beforeDefaultExecuteEconomy = getShipActionEconomy(actor);
    await executeStationAction(actor, "rally-crew", { phase: "combat", notes: "Smoke default no spend." });
    const afterDefaultExecuteEconomy = getShipActionEconomy(actor);
    check(result, "Default execute/record does not spend AP/RAP economy", beforeDefaultExecuteEconomy.ap === afterDefaultExecuteEconomy.ap && beforeDefaultExecuteEconomy.rap === afterDefaultExecuteEconomy.rap, "unchanged economy", { before: beforeDefaultExecuteEconomy, after: afterDefaultExecuteEconomy });
    const beforeDefaultRollEconomy = getShipActionEconomy(actor);
    const missingStatisticRoll = await rollStationAction(actor, "rally-crew", { phase: "combat", rollOptionKey: "diplomacy", skipDialog: true, createMessage: false });
    check(result, "Station action roll handles missing statistic safely", missingStatisticRoll?.recordType === "roll" && ["rolled", "missing-statistic", "failed"].includes(missingStatisticRoll?.rollStatus), "safe roll record", { rollStatus: missingStatisticRoll?.rollStatus, statisticMessage: missingStatisticRoll?.statisticMessage });
    const afterDefaultRollEconomy = getShipActionEconomy(actor);
    check(result, "Default station action roll does not spend AP/RAP economy", beforeDefaultRollEconomy.ap === afterDefaultRollEconomy.ap && beforeDefaultRollEconomy.rap === afterDefaultRollEconomy.rap, "unchanged economy", { before: beforeDefaultRollEconomy, after: afterDefaultRollEconomy });
    await clearStationActionHistory(actor);
    await clearStationAssignment(actor, "captain");
    const missingAssignedActorRollPreview = await previewStationActionRoll(actor, "rally-crew", { phase: "combat", rollOptionKey: "diplomacy" });
    check(result, "Station action roll preview handles missing assigned actor safely", missingAssignedActorRollPreview.blocked === true && missingAssignedActorRollPreview.readiness?.actorResolved === false, "blocked without assigned actor", { blocked: missingAssignedActorRollPreview.blocked, warnings: missingAssignedActorRollPreview.warnings, readiness: missingAssignedActorRollPreview.readiness });

    const baseTier = CORE_HULLS.frigate.classification.baseTier;
    const majorRefitThreshold = CORE_HULLS.frigate.refitTolerance.totalBeforeMajorRefitRequired;
    const belowThresholdPressureSystem = {
      base: { hull: CORE_HULLS.brigantine },
      installed: {
        shipUpgrades: [
          { refitPressure: { weaponPressure: 1, enginePressure: 1 } }
        ]
      }
    };
    const thresholdPressureSystem = {
      base: { hull: CORE_HULLS.brigantine },
      installed: {
        shipUpgrades: [
          { refitPressure: { infrastructurePressure: majorRefitThreshold } }
        ]
      }
    };
    const flagPressureSystem = {
      base: { hull: CORE_HULLS.brigantine },
      installed: {
        shipUpgrades: [
          { flags: { [ARCFLIGHT_MODULE_ID]: { system: { refitPressure: { occultPressure: 2 } } } } }
        ]
      }
    };
    const belowThresholdTier = getShipTierState(belowThresholdPressureSystem);
    const thresholdTier = getShipTierState(thresholdPressureSystem);
    const storedTierFlags = shipData.refitFlags;

    const componentPressureCategories = {
      arkengine: getComponentRefitPressure(componentItems.arkengine).enginePressure,
      arkengineMod: getComponentRefitPressure(componentItems.arkengineMod).enginePressure,
      room: getComponentRefitPressure(componentItems.room).infrastructurePressure,
      shipUpgrade: getComponentRefitPressure(componentItems.shipUpgrade).infrastructurePressure,
      crewAsset: getComponentRefitPressure(componentItems.crewAsset).total
    };
    const pressureBeforeUpgrade = shipData.refitPressure.total - shipData.installed.shipUpgrades[0].refitPressure.total;
    const legacyMetadata = getComponentTierMetadata({ componentType: "legacy-test-item" });

    check(result, "Retrofitted component pressure exists for each smoke category", Object.values(componentPressureCategories).every((value) => value > 0), "positive pressure per category", componentPressureCategories);
    checkEqual(result, "Installed pressure totals include retrofitted components", calculateRefitPressure(shipData).total, shipData.refitPressure.total);
    checkEqual(result, "Pressure total decreases when upgrade pressure is removed", pressureBeforeUpgrade, calculateRefitPressure({ ...shipData, installed: { ...shipData.installed, shipUpgrades: [{ ...shipData.installed.shipUpgrades[0], refitPressure: {} }] } }).total);
    check(result, "Tier metadata is readable", getComponentTierMetadata(componentItems.arkengine).recommendedTier >= 1 && getComponentTierMetadata(componentItems.room).refitTags.length > 0, "readable tier metadata", { arkengine: getComponentTierMetadata(componentItems.arkengine), room: getComponentTierMetadata(componentItems.room) });
    checkEqual(result, "Legacy component metadata defaults safely", 0, legacyMetadata.refitPressure.total);
    checkEqual(result, "Legacy component minimum tier defaults safely", 0, legacyMetadata.minimumTier);

    checkEqual(result, "Ship hull base tier copied into tier state", baseTier, shipData.tier.baseTier);
    checkEqual(result, "Frigate + Iron Choir replacement state requires major refit", "major-refit-required", shipData.tier.refitStatus);
    check(result, "Ship retrofitted refit pressure total is positive", shipData.refitPressure.total > 0, "positive pressure", shipData.refitPressure.total);
    checkEqual(result, "Component refitPressure below threshold is pressured", "pressured", belowThresholdTier.refitStatus);
    checkEqual(result, "Component refitPressure below threshold total", 2, getShipRefitPressure(belowThresholdPressureSystem).total);
    checkEqual(result, "Component flag refitPressure is counted", 2, calculateRefitPressure(flagPressureSystem).total);
    checkEqual(result, "Component refitPressure at threshold requires major refit", "major-refit-required", thresholdTier.refitStatus);
    check(result, "Stored replacement major refit flags are true", Object.values(storedTierFlags).every((value) => value === true), true, storedTierFlags);

    const pressureUpgradeEntries = shipData.installed.shipUpgrades.map((upgrade, index) => index === 0
      ? { ...upgrade, refitPressure: { infrastructurePressure: majorRefitThreshold } }
      : upgrade);
    await actor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.shipUpgrades`]: pressureUpgradeEntries });
    await updateShipTierState(actor);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Stored threshold refit status requires major refit", "major-refit-required", shipData.tier.refitStatus);
    check(result, "Major refit flags are stored correctly", [
      shipData.refitFlags.qualifiesForMajorRefit,
      shipData.refitFlags.requiresDrydock,
      shipData.refitFlags.requiresSpecialistLabor,
      shipData.refitFlags.requiresRareMaterials
    ].every(Boolean), true, shipData.refitFlags);

    const restoredUpgradeEntries = shipData.installed.shipUpgrades.map((upgrade) => ({ ...upgrade, refitPressure: {} }));
    await actor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.shipUpgrades`]: restoredUpgradeEntries });
    await recalculateShipStats(actor);
    shipData = getArcflightShipData(actor);

    const preparedShipViewData = prepareArcflightShipViewData({
      enabled: true,
      actorType: "ship",
      system: shipData
    });
    const legacyShipViewData = prepareArcflightShipViewData({
      enabled: true,
      actorType: "ship",
      system: {}
    });
    checkEqual(result, "Ship sheet readout exposes refit status", shipData.tier.refitStatus, preparedShipViewData.system.installValidationReadout.tier.refitStatus);
    checkEqual(result, "Ship sheet readout exposes pressure total", shipData.refitPressure.total, preparedShipViewData.system.installValidationReadout.pressure.total);
    checkEqual(result, "Ship sheet readout handles missing tier state", "native", legacyShipViewData.system.installValidationReadout.tier.refitStatus);
    checkEqual(result, "Ship sheet readout handles missing refit pressure", 0, legacyShipViewData.system.installValidationReadout.pressure.total);

    checkEqual(result, "Installed arkengine mod count", 1, shipData.installed.arkengineMods.length);
    checkEqual(result, "Installed room count", 1, shipData.installed.rooms.length);
    checkEqual(result, "Installed ship upgrade count", 1, shipData.installed.shipUpgrades.length);
    checkEqual(result, "Named crew count", 1, shipData.crew.namedCrew.length);

    checkEqual(result, "Derived hull integrity", 210, shipData.derived.hullIntegrity, "Frigate 190 + Reinforced Structural Ribbing 20.");
    checkEqual(result, "Derived strain capacity", 15, shipData.derived.strainCapacity, "Frigate 11 + Iron Choir Engine 3 + Pressure Lattice Tuning 1.");
    checkEqual(result, "Derived voyage speed travel hex days", 4, shipData.derived.voyageSpeedTravelHexDays);
    checkEqual(result, "Base Iron Choir fueling required spell rank", 3, shipData.base.arkengine.fueling?.requiredSpellRank);
    checkEqual(result, "Base Iron Choir fueling fuel slots", 10, shipData.base.arkengine.fueling?.fuelSlots);
    checkEqual(result, "Base Iron Choir max stored spell ranks", 30, shipData.base.arkengine.fueling?.maxStoredSpellRanks);
    checkEqual(result, "Derived normal hex fuel cost", 3, shipData.derived.normalHexCost);
    checkEqual(result, "Derived hard burn hex fuel cost", 5, shipData.derived.hardBurnHexCost);
    checkEqual(result, "Derived lean burn hex fuel cost", 2, shipData.derived.leanBurnHexCost);
    checkEqual(result, "Derived stealth burn hex fuel cost", 5, shipData.derived.stealthBurnHexCost);

    checkEqual(result, "Room slots used", 1, shipData.installed.roomSlots.used);
    checkEqual(result, "Arkengine mod slots capacity", 4, shipData.installed.arkengineModSlots.capacity);
    checkEqual(result, "Arkengine mod slots used", 1, shipData.installed.arkengineModSlots.used);
    checkEqual(result, "Ship upgrade slots used", 1, shipData.installed.shipUpgradeSlots.used);
    checkEqual(result, "Room slots shape has available", 3, shipData.installed.roomSlots.available);
    checkEqual(result, "Arkengine mod slots shape has available", 3, shipData.installed.arkengineModSlots.available);
    checkEqual(result, "Ship upgrade slots shape has available", 2, shipData.installed.shipUpgradeSlots.available);

    const removalInactiveBefore = getInactiveInstallRecords(actor).length;
    const removableArkengineModId = shipData.installed.arkengineMods[0]?.uuid || shipData.installed.arkengineMods[0]?.itemId || shipData.installed.arkengineMods[0]?.key;
    const removableRoomId = shipData.installed.rooms[0]?.uuid || shipData.installed.rooms[0]?.itemId || shipData.installed.rooms[0]?.key;
    const removableUpgradeId = shipData.installed.shipUpgrades[0]?.uuid || shipData.installed.shipUpgrades[0]?.itemId || shipData.installed.shipUpgrades[0]?.key;
    const removableCrewId = shipData.crew.namedCrew[0]?.uuid || shipData.crew.namedCrew[0]?.itemId || shipData.crew.namedCrew[0]?.key;
    const roomSlotsUsedBeforeRemoval = shipData.installed.roomSlots.used;
    const arkengineModSlotsUsedBeforeRemoval = shipData.installed.arkengineModSlots.used;
    const shipUpgradeSlotsUsedBeforeRemoval = shipData.installed.shipUpgradeSlots.used;
    const strainBeforeModRemoval = shipData.derived.strainCapacity;
    const hullBeforeUpgradeRemoval = shipData.derived.hullIntegrity;

    await removeInstalledArkengineMod(actor, removableArkengineModId);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Remove arkengine mod removes installed entry", 0, shipData.installed.arkengineMods.length);
    checkEqual(result, "Remove arkengine mod recalculates mod slots", arkengineModSlotsUsedBeforeRemoval - 1, shipData.installed.arkengineModSlots.used);
    checkEqual(result, "Remove arkengine mod recalculates derived strain", strainBeforeModRemoval - 1, shipData.derived.strainCapacity);

    await removeInstalledRoom(actor, removableRoomId);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Remove room removes installed entry", 0, shipData.installed.rooms.length);
    checkEqual(result, "Remove room recalculates room slots", roomSlotsUsedBeforeRemoval - 1, shipData.installed.roomSlots.used);

    await removeInstalledShipUpgrade(actor, removableUpgradeId);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Remove ship upgrade removes installed entry", 0, shipData.installed.shipUpgrades.length);
    checkEqual(result, "Remove ship upgrade recalculates upgrade slots", shipUpgradeSlotsUsedBeforeRemoval - 1, shipData.installed.shipUpgradeSlots.used);
    checkEqual(result, "Remove ship upgrade recalculates derived hull", hullBeforeUpgradeRemoval - 20, shipData.derived.hullIntegrity);

    await removeCrewAsset(actor, removableCrewId);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Remove crew asset removes roster entry", 0, shipData.crew.namedCrew.length);
    checkEqual(result, "Remove crew asset recalculates generic crew", 0, shipData.crew.currentGenericCrew);
    checkEqual(result, "Component removal increments inactive install count", removalInactiveBefore + 4, getInactiveInstallRecords(actor).length);
    check(result, "Component removal preserves inactive lifecycle history", getInactiveInstallRecords(actor).filter((record) => [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD, ARCFLIGHT_ITEM_TYPES.ROOM, ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE, ARCFLIGHT_ITEM_TYPES.CREW_ASSET].includes(record.componentType) && record.removalReason === "removed").length === 4, "four removed records", getInactiveInstallRecords(actor));

    await installArkengineMod(actor, componentItems.arkengineMod);
    await installRoom(actor, componentItems.room);
    await installShipUpgrade(actor, componentItems.shipUpgrade);
    await addCrewAsset(actor, componentItems.crewAsset);
    shipData = getArcflightShipData(actor);

    const previewBaseSystem = foundry.utils.deepClone(shipData);
    const lowPressurePreview = previewInstallValidation(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
      identity: { id: "smoke-low-pressure-preview", displayName: "Smoke Low Pressure Preview" },
      installation: { slotCost: 0 },
      refitPressure: {}
    });
    const overTierPreview = previewComponentInstall(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
      identity: { id: "smoke-over-tier-preview", displayName: "Smoke Over Tier Preview" },
      minimumTier: 99,
      recommendedTier: 99,
      installation: { slotCost: 0 },
      refitPressure: {}
    });
    const majorRefitPreview = previewInstallValidation(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
      identity: { id: "smoke-major-refit-preview", displayName: "Smoke Major Refit Preview" },
      installation: { slotCost: 0 },
      refitPressure: { infrastructurePressure: majorRefitThreshold }
    });
    const incompatibleArkenginePreview = previewInstallValidation(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.ARKENGINE,
      engineClass: "smoke-incompatible-engine",
      displayName: "Smoke Incompatible Engine",
      refitPressure: {}
    });
    const roomOverflowPreview = previewInstallValidation(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
      identity: { id: "smoke-room-overflow-preview", displayName: "Smoke Room Overflow Preview" },
      installation: { expansionSlotsRequired: 99 },
      refitPressure: {}
    });
    const modOverflowPreview = previewInstallValidation(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
      identity: { id: "smoke-mod-overflow-preview", displayName: "Smoke Mod Overflow Preview" },
      installation: { modSlotsRequired: 99 },
      refitPressure: {}
    });
    const uniqueCrewDuplicatePreview = previewInstallValidation(previewBaseSystem, componentItems.crewAsset);
    const validWeaponPreview = previewInstallValidation(previewBaseSystem, componentItems.weapon, { mountId: "fore-1", arc: "fore" });
    const invalidWeaponArcPreview = previewInstallValidation(previewBaseSystem, componentItems.weapon, { mountId: "fore-1", arc: "dorsal" });
    const missingWeaponMountPreview = previewInstallValidation(previewBaseSystem, componentItems.weapon, { mountId: "fore-99", arc: "fore" });
    const incompatibleWeaponSizePreview = previewInstallValidation(previewBaseSystem, componentItems.oversizedWeapon, { mountId: "fore-1", arc: "fore" });
    const incompatibleWeaponArcPreview = previewInstallValidation(previewBaseSystem, componentItems.incompatibleArcWeapon, { mountId: "aft-1", arc: "aft" });
    const occupiedWeaponPreviewSystem = foundry.utils.deepClone(previewBaseSystem);
    occupiedWeaponPreviewSystem.base.hull.weaponMounts.fore[0].occupied = true;
    const occupiedWeaponMountPreview = previewInstallValidation(occupiedWeaponPreviewSystem, componentItems.weapon, { mountId: "fore-1", arc: "fore" });
    const weaponInstallUiState = prepareInstallUiState(actor, ARCFLIGHT_ITEM_TYPES.WEAPON, componentItems.weapon.id, "fore:fore-1");
    const stationAssignmentRows = prepareStationRows(getArcflightShipData(actor).stations, { captain: "" });
    const roomBlockState = shouldBlockInstall(roomOverflowPreview);
    const modBlockState = shouldBlockInstall(modOverflowPreview);
    const uniqueCrewBlockState = shouldBlockInstall(uniqueCrewDuplicatePreview);
    const legacyPreview = previewInstallValidation(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
      identity: { id: "smoke-legacy-preview", displayName: "Smoke Legacy Preview" },
      installation: { expansionSlotsRequired: 0 }
    });
    const unsupportedPreview = previewInstallValidation(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.CARGO,
      identity: { id: "smoke-future-cargo-preview", displayName: "Smoke Future Cargo Preview" }
    });
    const warningStrings = getInstallValidationWarnings(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
      identity: { id: "smoke-warning-list-preview", displayName: "Smoke Warning List Preview" },
      installation: { expansionSlotsRequired: 99 }
    });

    check(result, "Install preview low-pressure install is ok/info", ["ok", "info"].includes(lowPressurePreview.severity) && lowPressurePreview.unsupported === false, "ok or info", lowPressurePreview);
    check(result, "Install preview over-tier component warns", ["warning", "danger"].includes(overTierPreview.severity) && overTierPreview.warnings.length > 0, "warning or danger", overTierPreview);
    checkEqual(result, "Install preview major refit is danger", "danger", majorRefitPreview.severity);
    checkEqual(result, "Install preview incompatible arkengine is danger", "danger", incompatibleArkenginePreview.severity);
    checkEqual(result, "Install preview room slot overflow is danger", "danger", roomOverflowPreview.severity);
    checkEqual(result, "Install preview mod slot overflow is danger", "danger", modOverflowPreview.severity);
    checkEqual(result, "Install preview duplicate unique crew is danger", "danger", uniqueCrewDuplicatePreview.severity);
    const weaponMountValidationErrors = ["invalid weapon arc", "does not exist", "no hull weapon mount id", "is not allowed", "already occupied", "not compatible with"];
    const validWeaponPreviewText = [...validWeaponPreview.messages, ...validWeaponPreview.warnings].join(" ").toLowerCase();
    check(result, "Install preview valid weapon mount validates mount", validWeaponPreview.unsupported === false && validWeaponPreview.messages.some((message) => message.includes("can be installed")) && !weaponMountValidationErrors.some((error) => validWeaponPreviewText.includes(error)), "supported weapon preview with valid mount messaging and no weapon mount errors", validWeaponPreview);
    check(result, "Ship sheet weapon install UI state builds mount options", weaponInstallUiState.isWeaponInstall === true && weaponInstallUiState.weaponMountOptions.some((option) => option.arc === "fore" && option.mountId === "fore-1") && weaponInstallUiState.selectedWeaponMountArc === "fore" && weaponInstallUiState.selectedWeaponMountId === "fore-1", "weapon UI mount options include selected fore mount", weaponInstallUiState.weaponMountOptions);
    check(result, "Ship sheet weapon install UI preview with selected mount does not crash", weaponInstallUiState.hasPreview === true && weaponInstallUiState.preview?.componentType === ARCFLIGHT_ITEM_TYPES.WEAPON && typeof weaponInstallUiState.preview.statusLabel === "string", "weapon UI preview ready", weaponInstallUiState.preview);
    check(result, "Ship sheet station assignment UI state builds actor options", stationAssignmentRows.some((row) => row.key === "captain" && Array.isArray(row.actorOptions) && row.hasAssignment === false && row.canAssign === false), "safe station assignment row UI state", stationAssignmentRows.find((row) => row.key === "captain"));
    checkEqual(result, "Install preview invalid weapon arc is danger", "danger", invalidWeaponArcPreview.severity);
    checkEqual(result, "Install preview missing weapon mount is danger", "danger", missingWeaponMountPreview.severity);
    checkEqual(result, "Install preview incompatible weapon size is danger", "danger", incompatibleWeaponSizePreview.severity);
    checkEqual(result, "Install preview occupied weapon mount is danger", "danger", occupiedWeaponMountPreview.severity);
    checkEqual(result, "Install preview incompatible weapon compatibleArcs is danger", "danger", incompatibleWeaponArcPreview.severity);
    check(result, "shouldBlockInstall blocks room slot overflow", roomBlockState.blocked === true && roomBlockState.reason.length > 0, "blocked with reason", roomBlockState);
    check(result, "shouldBlockInstall blocks mod slot overflow", modBlockState.blocked === true && modBlockState.reason.length > 0, "blocked with reason", modBlockState);
    check(result, "shouldBlockInstall blocks duplicate unique crew", uniqueCrewBlockState.blocked === true && uniqueCrewBlockState.reason.length > 0, "blocked with reason", uniqueCrewBlockState);
    check(result, "Install preview legacy metadata does not crash", legacyPreview && legacyPreview.unsupported === false && Array.isArray(legacyPreview.warnings), "stable report", legacyPreview);
    check(result, "Install preview unsupported future component warns", unsupportedPreview.unsupported === true && unsupportedPreview.warnings.length > 0, "unsupported warning", unsupportedPreview);
    check(result, "Install preview warning helper returns strings", Array.isArray(warningStrings) && warningStrings.length > 0, "warning strings", warningStrings);
    check(result, "Install preview helpers exposed", typeof globalThis.game?.arcflight?.previewInstallValidation === "function" && typeof globalThis.game?.arcflight?.previewComponentInstall === "function" && typeof globalThis.game?.arcflight?.getInstallValidationWarnings === "function" && typeof globalThis.game?.arcflight?.shouldBlockInstall === "function" && typeof globalThis.game?.arcflight?.installWeapon === "function" && typeof globalThis.game?.arcflight?.removeInstalledWeapon === "function", true, { previewInstallValidation: typeof globalThis.game?.arcflight?.previewInstallValidation, previewComponentInstall: typeof globalThis.game?.arcflight?.previewComponentInstall, getInstallValidationWarnings: typeof globalThis.game?.arcflight?.getInstallValidationWarnings, shouldBlockInstall: typeof globalThis.game?.arcflight?.shouldBlockInstall, installWeapon: typeof globalThis.game?.arcflight?.installWeapon, removeInstalledWeapon: typeof globalThis.game?.arcflight?.removeInstalledWeapon });
    check(result, "Install preview devTools exposed", typeof globalThis.game?.arcflight?.devTools?.previewInstallValidation === "function" && typeof globalThis.game?.arcflight?.devTools?.previewComponentInstall === "function" && typeof globalThis.game?.arcflight?.devTools?.getInstallValidationWarnings === "function" && typeof globalThis.game?.arcflight?.devTools?.shouldBlockInstall === "function" && typeof globalThis.game?.arcflight?.devTools?.installWeapon === "function" && typeof globalThis.game?.arcflight?.devTools?.removeInstalledWeapon === "function", true, { previewInstallValidation: typeof globalThis.game?.arcflight?.devTools?.previewInstallValidation, previewComponentInstall: typeof globalThis.game?.arcflight?.devTools?.previewComponentInstall, getInstallValidationWarnings: typeof globalThis.game?.arcflight?.devTools?.getInstallValidationWarnings, shouldBlockInstall: typeof globalThis.game?.arcflight?.devTools?.shouldBlockInstall, installWeapon: typeof globalThis.game?.arcflight?.devTools?.installWeapon, removeInstalledWeapon: typeof globalThis.game?.arcflight?.devTools?.removeInstalledWeapon });

    checkEqual(result, "Current hull preserved", preservedCurrent.hull, shipData.current.hull);
    checkEqual(result, "Current lifeveil preserved", preservedCurrent.lifeveil, shipData.current.lifeveil);
    checkEqual(result, "Current strain preserved", preservedCurrent.strain, shipData.current.strain);
    checkEqual(result, "Current morale preserved", preservedCurrent.morale, shipData.current.morale);
    checkEqual(result, "Current supplies preserved", preservedCurrent.supplies, shipData.current.supplies);
    checkEqual(result, "Current stored spell ranks preserved", preservedCurrent.storedSpellRanks, shipData.current.storedSpellRanks);

    const engineerAssignment = shipData.stations.assignments.engineer;
    check(result, "Engineer station assignment exists", Boolean(engineerAssignment), "assignment", engineerAssignment?.name ?? null);
    await clearStationAssignment(actor, "engineer");
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Engineer station assignment clears", null, shipData.stations.assignments.engineer);

    await assignStation(actor, "engineer", crewEntry, { assigneeType: "crewAsset" });
    await clearStationAssignments(actor);
    shipData = getArcflightShipData(actor);
    check(result, "All station assignments clear", Object.values(shipData.stations.assignments).every((assignment) => assignment === null), true, shipData.stations.assignments);

    await clearInstalledShipUpgrades(actor);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Clear helper removes ship upgrades", 0, shipData.installed.shipUpgrades.length);
    checkEqual(result, "Clear helper resets ship upgrade slots", 3, shipData.installed.shipUpgradeSlots.available);

    await clearInstalledArkengineMods(actor);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Clear helper removes arkengine mods", 0, shipData.installed.arkengineMods.length);
    checkEqual(result, "Clear helper preserves arkengine mod capacity", 4, shipData.installed.arkengineModSlots.capacity);

    await clearInstalledRooms(actor);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Clear helper removes rooms", 0, shipData.installed.rooms.length);

    await clearCrewRoster(actor);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Clear helper removes named crew", 0, shipData.crew.namedCrew.length);
    checkEqual(result, "Clear helper resets generic crew", 0, shipData.crew.currentGenericCrew);

    await clearShipBuild(actor);
    shipData = getArcflightShipData(actor);
    checkEqual(result, "Full clear removes installed rooms", 0, shipData.installed.rooms.length);
    checkEqual(result, "Full clear removes installed ship upgrades", 0, shipData.installed.shipUpgrades.length);
    checkEqual(result, "Full clear removes installed arkengine mods", 0, shipData.installed.arkengineMods.length);
    checkEqual(result, "Full clear removes installed weapons", 0, shipData.installed.weapons.length);
    checkEqual(result, "Full clear removes named crew", 0, shipData.crew.namedCrew.length);
    checkEqual(result, "Full clear resets hull reference", "", shipData.installed.hullItemId);
    checkEqual(result, "Full clear resets arkengine reference", "", shipData.installed.arkengineItemId);
  } catch (error) {
    check(result, "Smoke test threw unexpected error", false, "no unexpected error", error.message, error.stack ?? error.message);
    console.error("Arcflight | Framework smoke test failed with an unexpected error.", error);
  } finally {
    if (shouldRestoreTravelLibraries) {
      try {
        await globalThis.game.settings.set(ARCFLIGHT_MODULE_ID, PUBLISHED_TRAVEL_EVENT_LIBRARY_SETTING, originalPublishedTravelEventLibrary ?? { version: 1, events: {} });
        await globalThis.game.settings.set(ARCFLIGHT_MODULE_ID, TRAVEL_EVENT_RUNNER_SESSION_LIBRARY_SETTING, originalRunnerSessionLibrary ?? { version: 1, sessions: {} });
      } catch (error) {
        console.warn("Arcflight | Framework smoke test cleanup could not restore travel libraries.", error);
      }
    }

    if (cleanup) {
      await deleteDocuments(createdItems);

      if (actor && deleteActorOnCleanup) {
        try {
          await actor.delete();
        } catch (error) {
          console.warn(`Arcflight | Framework smoke test cleanup could not delete ${actor.name}.`, error);
        }
      }
    }

    summarize(result);
  }

  return result;
}
