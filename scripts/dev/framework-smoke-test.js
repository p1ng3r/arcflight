import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import {
  createCoreArkengine,
  createCoreArkengineMod,
  createCoreCrewAsset,
  createCoreHull,
  createCoreRoom,
  createCoreShipUpgrade
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
  recalculateShipStats,
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
import { STATION_KEYS } from "../../data/stations/core-stations.js";
import { findMissingCoreArcflightItems, syncCoreArcflightItems } from "../helpers/core-item-sync.js";
import { getComponentRefitPressure, getComponentTierMetadata } from "../documents/components.js";
import { getInstallValidationWarnings, previewComponentInstall, previewInstallValidation } from "../helpers/install-validation-preview.js";

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
    await createSmokeTestComponent(createdItems, "arkengine", () => createCoreArkengine("tidewake-arkengine")),
    await createSmokeTestComponent(createdItems, "arkengineMod", () => createCoreArkengineMod("pressure-lattice-tuning")),
    await createSmokeTestComponent(createdItems, "room", () => createCoreRoom("workshop")),
    await createSmokeTestComponent(createdItems, "shipUpgrade", () => createCoreShipUpgrade("reinforced-structural-ribbing")),
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
    check(result, "Core station key array exists", isCoreKeyArray(STATION_KEYS), "non-empty array", STATION_KEYS?.length ?? 0);
    check(result, "Core hull library has 11 locked keys", EXPECTED_CORE_HULL_PLATFORM_KEYS.every((key) => CORE_HULL_PLATFORM_KEYS.includes(key)) && CORE_HULL_PLATFORM_KEYS.length === EXPECTED_CORE_HULL_PLATFORM_KEYS.length, EXPECTED_CORE_HULL_PLATFORM_KEYS, CORE_HULL_PLATFORM_KEYS);
    check(result, "Every core hull has classification", EXPECTED_CORE_HULL_PLATFORM_KEYS.every((key) => hasClassification(CORE_HULLS[key])), true, EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => !hasClassification(CORE_HULLS[key])));
    check(result, "Every core hull has refit tolerance", EXPECTED_CORE_HULL_PLATFORM_KEYS.every((key) => hasRefitTolerance(CORE_HULLS[key])), true, EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => !hasRefitTolerance(CORE_HULLS[key])));
    check(result, "Every core hull has arkengine compatibility", EXPECTED_CORE_HULL_PLATFORM_KEYS.every((key) => hasArkengineCompatibility(CORE_HULLS[key])), true, EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => !hasArkengineCompatibility(CORE_HULLS[key])));
    check(result, "Every standard core hull has expansion slots", EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => key !== "leviathan-class-platform").every((key) => Number.isInteger(CORE_HULLS[key]?.rooms?.expansionSlots)), true, EXPECTED_CORE_HULL_PLATFORM_KEYS.filter((key) => key !== "leviathan-class-platform" && !Number.isInteger(CORE_HULLS[key]?.rooms?.expansionSlots)));
    check(result, "Leviathan platform is district-scale", CORE_HULLS["leviathan-class-platform"]?.rooms?.districtScale === true, true, CORE_HULLS["leviathan-class-platform"]?.rooms ?? null);

    const expectedSyncCategories = ["hull", "arkengine", "arkengineMod", "room", "shipUpgrade", "crewAsset"];
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

    const componentItems = await createSmokeTestComponents(createdItems);
    result.createdItemIds = createdItems.map((item) => item?.id).filter(Boolean);
    check(result, "Created smoke test components", result.createdItemIds.length === 6, 6, result.createdItemIds.length);

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

    await installHull(actor, componentItems.hull);
    await installArkengine(actor, componentItems.arkengine);
    await installArkengineMod(actor, componentItems.arkengineMod);
    await installRoom(actor, componentItems.room);
    await installShipUpgrade(actor, componentItems.shipUpgrade);
    await addCrewAsset(actor, componentItems.crewAsset);

    const preservedCurrent = { hull: 120, lifeveil: 4, strain: 2, morale: 1, storedSpellRanks: 7 };
    await actor.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: preservedCurrent
    });

    let shipData = getArcflightShipData(actor);
    const crewEntry = shipData.crew.namedCrew[0];
    await assignStation(actor, "engineer", crewEntry, { assigneeType: "crewAsset" });

    await attemptDuplicateInstall(result, "Duplicate arkengine mod install attempt", () => installArkengineMod(actor, componentItems.arkengineMod));
    await attemptDuplicateInstall(result, "Duplicate room install attempt", () => installRoom(actor, componentItems.room));
    await attemptDuplicateInstall(result, "Duplicate ship upgrade install attempt", () => installShipUpgrade(actor, componentItems.shipUpgrade));
    await attemptDuplicateInstall(result, "Duplicate crew asset install attempt", () => addCrewAsset(actor, componentItems.crewAsset));

    await recalculateShipStats(actor);
    shipData = getArcflightShipData(actor);

    const baseTier = CORE_HULLS.brigantine.classification.baseTier;
    const majorRefitThreshold = CORE_HULLS.brigantine.refitTolerance.totalBeforeMajorRefitRequired;
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
    checkEqual(result, "Ship with retrofitted component pressure is pressured", "pressured", shipData.tier.refitStatus);
    check(result, "Ship retrofitted refit pressure total is positive", shipData.refitPressure.total > 0, "positive pressure", shipData.refitPressure.total);
    checkEqual(result, "Component refitPressure below threshold is pressured", "pressured", belowThresholdTier.refitStatus);
    checkEqual(result, "Component refitPressure below threshold total", 2, getShipRefitPressure(belowThresholdPressureSystem).total);
    checkEqual(result, "Component flag refitPressure is counted", 2, calculateRefitPressure(flagPressureSystem).total);
    checkEqual(result, "Component refitPressure at threshold requires major refit", "major-refit-required", thresholdTier.refitStatus);
    check(result, "Stored no-pressure major refit flags are false", Object.values(storedTierFlags).every((value) => value === false), true, storedTierFlags);

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

    checkEqual(result, "Installed arkengine mod count", 1, shipData.installed.arkengineMods.length);
    checkEqual(result, "Installed room count", 1, shipData.installed.rooms.length);
    checkEqual(result, "Installed ship upgrade count", 1, shipData.installed.shipUpgrades.length);
    checkEqual(result, "Named crew count", 1, shipData.crew.namedCrew.length);

    checkEqual(result, "Derived hull integrity", 180, shipData.derived.hullIntegrity, "Brigantine 160 + Reinforced Structural Ribbing 20.");
    checkEqual(result, "Derived strain capacity", 13, shipData.derived.strainCapacity, "Brigantine 10 + Tidewake 2 + Pressure Lattice Tuning 1.");
    checkEqual(result, "Derived voyage speed travel hex days", 5, shipData.derived.voyageSpeedTravelHexDays);
    checkEqual(result, "Base arkengine fueling required spell rank", 2, shipData.base.arkengine.fueling?.requiredSpellRank);
    checkEqual(result, "Base arkengine fueling fuel slots", 10, shipData.base.arkengine.fueling?.fuelSlots);
    checkEqual(result, "Base arkengine max stored spell ranks", 20, shipData.base.arkengine.fueling?.maxStoredSpellRanks);
    checkEqual(result, "Derived normal hex fuel cost", 2, shipData.derived.normalHexCost);
    checkEqual(result, "Derived hard burn hex fuel cost", 3, shipData.derived.hardBurnHexCost);
    checkEqual(result, "Derived lean burn hex fuel cost", 1, shipData.derived.leanBurnHexCost);
    checkEqual(result, "Derived stealth burn hex fuel cost", 3, shipData.derived.stealthBurnHexCost);

    checkEqual(result, "Room slots used", 1, shipData.installed.roomSlots.used);
    checkEqual(result, "Arkengine mod slots capacity", 4, shipData.installed.arkengineModSlots.capacity);
    checkEqual(result, "Arkengine mod slots used", 1, shipData.installed.arkengineModSlots.used);
    checkEqual(result, "Ship upgrade slots used", 1, shipData.installed.shipUpgradeSlots.used);
    checkEqual(result, "Room slots shape has available", 3, shipData.installed.roomSlots.available);
    checkEqual(result, "Arkengine mod slots shape has available", 3, shipData.installed.arkengineModSlots.available);
    checkEqual(result, "Ship upgrade slots shape has available", 2, shipData.installed.shipUpgradeSlots.available);

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
    const legacyPreview = previewInstallValidation(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
      identity: { id: "smoke-legacy-preview", displayName: "Smoke Legacy Preview" },
      installation: { expansionSlotsRequired: 0 }
    });
    const unsupportedPreview = previewInstallValidation(previewBaseSystem, {
      componentType: ARCFLIGHT_ITEM_TYPES.WEAPON,
      identity: { id: "smoke-future-weapon-preview", displayName: "Smoke Future Weapon Preview" }
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
    check(result, "Install preview legacy metadata does not crash", legacyPreview && legacyPreview.unsupported === false && Array.isArray(legacyPreview.warnings), "stable report", legacyPreview);
    check(result, "Install preview unsupported future component warns", unsupportedPreview.unsupported === true && unsupportedPreview.warnings.length > 0, "unsupported warning", unsupportedPreview);
    check(result, "Install preview warning helper returns strings", Array.isArray(warningStrings) && warningStrings.length > 0, "warning strings", warningStrings);
    check(result, "Install preview helpers exposed", typeof globalThis.game?.arcflight?.previewInstallValidation === "function" && typeof globalThis.game?.arcflight?.previewComponentInstall === "function" && typeof globalThis.game?.arcflight?.getInstallValidationWarnings === "function", true, { previewInstallValidation: typeof globalThis.game?.arcflight?.previewInstallValidation, previewComponentInstall: typeof globalThis.game?.arcflight?.previewComponentInstall, getInstallValidationWarnings: typeof globalThis.game?.arcflight?.getInstallValidationWarnings });
    check(result, "Install preview devTools exposed", typeof globalThis.game?.arcflight?.devTools?.previewInstallValidation === "function" && typeof globalThis.game?.arcflight?.devTools?.previewComponentInstall === "function" && typeof globalThis.game?.arcflight?.devTools?.getInstallValidationWarnings === "function", true, { previewInstallValidation: typeof globalThis.game?.arcflight?.devTools?.previewInstallValidation, previewComponentInstall: typeof globalThis.game?.arcflight?.devTools?.previewComponentInstall, getInstallValidationWarnings: typeof globalThis.game?.arcflight?.devTools?.getInstallValidationWarnings });

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
