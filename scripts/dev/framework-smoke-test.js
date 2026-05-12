import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
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
  getShipRefitPressure,
  getShipRefitStatus,
  getShipTierState
} from "../documents/ships.js";
import { CORE_HULL_PLATFORM_KEYS, CORE_HULLS } from "../../data/hulls/core-hulls.js";
import { CORE_ARKENGINE_KEYS } from "../../data/arkengines/core-arkengines.js";
import { CORE_ARKENGINE_MOD_KEYS } from "../../data/arkengine-mods/core-arkengine-mods.js";
import { CORE_ROOM_KEYS } from "../../data/rooms/core-rooms.js";
import { CORE_SHIP_UPGRADE_KEYS } from "../../data/ship-upgrades/core-ship-upgrades.js";
import { CORE_CREW_ASSET_KEYS } from "../../data/crew/core-crew-assets.js";
import { CORE_WEAPON_KEYS, CORE_WEAPONS } from "../../data/weapons/core-weapons.js";
import { STATION_KEYS } from "../../data/stations/core-stations.js";
import { findMissingCoreArcflightItems, syncCoreArcflightItems } from "../helpers/core-item-sync.js";
import { getComponentRefitPressure, getComponentTierMetadata } from "../documents/components.js";
import { getInstallValidationWarnings, previewComponentInstall, previewInstallValidation, shouldBlockInstall } from "../helpers/install-validation-preview.js";
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

const SMOKE_TEST_ACTOR_NAME = "Arcflight Smoke Test Ship";
const SMOKE_TEST_FLAG = "frameworkSmokeTestHelper";

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

  try {
    check(result, "Core hull key array exists", isCoreKeyArray(CORE_HULL_PLATFORM_KEYS), "non-empty array", CORE_HULL_PLATFORM_KEYS?.length ?? 0);
    check(result, "Core arkengine key array exists", isCoreKeyArray(CORE_ARKENGINE_KEYS), "non-empty array", CORE_ARKENGINE_KEYS?.length ?? 0);
    check(result, "Core arkengine mod key array exists", isCoreKeyArray(CORE_ARKENGINE_MOD_KEYS), "non-empty array", CORE_ARKENGINE_MOD_KEYS?.length ?? 0);
    check(result, "Core room key array exists", isCoreKeyArray(CORE_ROOM_KEYS), "non-empty array", CORE_ROOM_KEYS?.length ?? 0);
    check(result, "Core ship upgrade key array exists", isCoreKeyArray(CORE_SHIP_UPGRADE_KEYS), "non-empty array", CORE_SHIP_UPGRADE_KEYS?.length ?? 0);
    check(result, "Core crew asset key array exists", isCoreKeyArray(CORE_CREW_ASSET_KEYS), "non-empty array", CORE_CREW_ASSET_KEYS?.length ?? 0);
    check(result, "Core weapon key array exists", isCoreKeyArray(CORE_WEAPON_KEYS), "non-empty array", CORE_WEAPON_KEYS?.length ?? 0);
    check(result, "Every core weapon has size/family/reload/damageProfile", CORE_WEAPON_KEYS.every((key) => hasCoreWeaponFoundationData(CORE_WEAPONS[key])), true, CORE_WEAPON_KEYS.filter((key) => !hasCoreWeaponFoundationData(CORE_WEAPONS[key])));
    check(result, "Core station key array exists", isCoreKeyArray(STATION_KEYS), "non-empty array", STATION_KEYS?.length ?? 0);
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

    const preservedCurrent = { hull: 120, lifeveil: 4, strain: 2, morale: 1, storedSpellRanks: 7 };
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
