import { CORE_ARKENGINE_KEYS, getCoreArkengine } from "../../data/arkengines/core-arkengines.js";
import { CORE_ARKENGINE_MOD_KEYS, getCoreArkengineMod } from "../../data/arkengine-mods/core-arkengine-mods.js";
import { CORE_CREW_ASSET_KEYS, getCoreCrewAsset } from "../../data/crew/core-crew-assets.js";
import { CORE_HULL_PLATFORM_KEYS, getCoreHull } from "../../data/hulls/core-hulls.js";
import { CORE_ROOM_KEYS, getCoreRoom } from "../../data/rooms/core-rooms.js";
import { CORE_SHIP_UPGRADE_KEYS, getCoreShipUpgrade } from "../../data/ship-upgrades/core-ship-upgrades.js";
import { CORE_WEAPON_KEYS, getCoreWeapon } from "../../data/weapons/core-weapons.js";
import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import {
  createCoreArkengine,
  createCoreArkengineMod,
  createCoreCrewAsset,
  createCoreHull,
  createCoreRoom,
  createCoreWeapon,
  createCoreShipUpgrade
} from "../documents/creation.js";
import { getArcflightComponentFlags, getComponentType, isArcflightItem } from "../documents/components.js";
import { organizeArcflightItems } from "./item-organization.js";

const CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({
    category: "hull",
    componentType: ARCFLIGHT_ITEM_TYPES.HULL,
    keys: CORE_HULL_PLATFORM_KEYS,
    getSource: getCoreHull,
    create: createCoreHull,
    getName: (source, key) => source?.displayName ?? source?.platform ?? key
  }),
  Object.freeze({
    category: "arkengine",
    componentType: ARCFLIGHT_ITEM_TYPES.ARKENGINE,
    keys: CORE_ARKENGINE_KEYS,
    getSource: getCoreArkengine,
    create: createCoreArkengine,
    getName: (source, key) => source?.displayName ?? source?.engineClass ?? key
  }),
  Object.freeze({
    category: "arkengineMod",
    componentType: ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
    keys: CORE_ARKENGINE_MOD_KEYS,
    getSource: getCoreArkengineMod,
    create: createCoreArkengineMod,
    getName: (source, key) => source?.identity?.displayName ?? source?.displayName ?? key
  }),
  Object.freeze({
    category: "weapon",
    componentType: ARCFLIGHT_ITEM_TYPES.WEAPON,
    keys: CORE_WEAPON_KEYS,
    getSource: getCoreWeapon,
    create: createCoreWeapon,
    getName: (source, key) => source?.name ?? source?.displayName ?? key
  }),
  Object.freeze({
    category: "room",
    componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
    keys: CORE_ROOM_KEYS,
    getSource: getCoreRoom,
    create: createCoreRoom,
    getName: (source, key) => source?.identity?.displayName ?? source?.displayName ?? key
  }),
  Object.freeze({
    category: "shipUpgrade",
    componentType: ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
    keys: CORE_SHIP_UPGRADE_KEYS,
    getSource: getCoreShipUpgrade,
    create: createCoreShipUpgrade,
    getName: (source, key) => source?.identity?.displayName ?? source?.displayName ?? key
  }),
  Object.freeze({
    category: "crewAsset",
    componentType: ARCFLIGHT_ITEM_TYPES.CREW_ASSET,
    keys: CORE_CREW_ASSET_KEYS,
    getSource: getCoreCrewAsset,
    create: createCoreCrewAsset,
    getName: (source, key) => source?.identity?.displayName ?? source?.displayName ?? key
  })
]);

const SKIPPED_SOURCE_CATEGORIES = Object.freeze([
  Object.freeze({
    category: "stations",
    reason: "Core stations are data-only in the current architecture and are not materialized as world Items."
  })
]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value) {
  return normalizeText(value).toLocaleLowerCase();
}

function addString(values, value) {
  const normalized = normalizeText(value);
  if (normalized) values.add(normalized);
}

function getArcflightFlags(item) {
  return item?.flags?.[ARCFLIGHT_MODULE_ID] ?? {};
}

function getSourceKeyCandidatesFromSystem(system = {}) {
  const values = new Set();
  addString(values, system.key);
  addString(values, system.platform);
  addString(values, system.engineClass);
  addString(values, system.sourceKey);
  addString(values, system.coreKey);
  addString(values, system.identity?.id);
  addString(values, system.id);
  return values;
}

function getSourceKeyCandidates(source = {}, registryKey = "") {
  const values = getSourceKeyCandidatesFromSystem(source);
  addString(values, registryKey);
  return values;
}

function getItemSourceKeyCandidates(item) {
  const values = new Set();
  const flags = getArcflightFlags(item);
  const componentFlags = getArcflightComponentFlags(item);
  const system = componentFlags.system ?? flags.system ?? {};

  for (const key of getSourceKeyCandidatesFromSystem(system)) values.add(key);
  addString(values, flags.key);
  addString(values, flags.sourceKey);
  addString(values, flags.coreKey);
  return values;
}

function hasAnySharedValue(leftValues, rightValues) {
  for (const value of leftValues) {
    if (rightValues.has(value)) return true;
  }

  return false;
}

function isWorldItemDocument(item) {
  return Boolean(item?.id) && !item?.pack && item?.parent == null && item?.actor == null;
}

function summarizeItem(item) {
  return {
    id: item?.id ?? null,
    name: item?.name ?? "",
    type: item?.type ?? "",
    componentType: getComponentType(item),
    sourceKeys: Array.from(getItemSourceKeyCandidates(item)),
    folderId: item?.folder?.id ?? item?.folder ?? null,
    folderName: item?.folder?.name ?? null
  };
}

function summarizeCoreEntry(definition, key, source) {
  return {
    key,
    name: definition.getName(source, key),
    componentType: definition.componentType,
    sourceKeys: Array.from(getSourceKeyCandidates(source, key))
  };
}

function createCategoryReport(definition) {
  return {
    category: definition.category,
    componentType: definition.componentType,
    total: definition.keys.length,
    existing: [],
    missing: [],
    createdItems: [],
    wouldCreateItems: [],
    skipped: [],
    warnings: []
  };
}

function createCoreItemSyncReport(dryRun = true) {
  return {
    dryRun,
    categories: Object.fromEntries(CATEGORY_DEFINITIONS.map((definition) => [definition.category, createCategoryReport(definition)])),
    existingItems: [],
    missingItems: [],
    createdItems: [],
    wouldCreateItems: [],
    skippedItems: [],
    skippedCategories: SKIPPED_SOURCE_CATEGORIES.map((entry) => ({ ...entry })),
    warnings: []
  };
}

function getWorldItems() {
  return Array.from(globalThis.game?.items ?? []);
}

function getArcflightWorldItems() {
  return getWorldItems().filter((item) => isWorldItemDocument(item) && isArcflightItem(item));
}

function findExistingCoreItem(sourceEntry, componentType, arcflightWorldItems) {
  const sourceKeys = new Set(sourceEntry.sourceKeys);
  const sourceName = normalizeName(sourceEntry.name);

  return arcflightWorldItems.find((item) => {
    if (getComponentType(item) !== componentType) return false;

    const itemKeys = getItemSourceKeyCandidates(item);
    if (itemKeys.size > 0 && sourceKeys.size > 0) return hasAnySharedValue(itemKeys, sourceKeys);

    return normalizeName(item?.name) === sourceName;
  }) ?? null;
}

function addCategoryEntry(report, categoryReport, listName, entry) {
  categoryReport[listName].push(entry);
  report[listName === "missing" ? "missingItems" : "existingItems"].push({ category: categoryReport.category, ...entry });
}

function buildCoreItemAvailabilityReport({ dryRun = true } = {}) {
  const report = createCoreItemSyncReport(dryRun);
  const arcflightWorldItems = getArcflightWorldItems();

  if (globalThis.game?.ready !== true) {
    report.warnings.push("Foundry world is not ready; scanned no world Items and performed no changes.");
  }

  for (const definition of CATEGORY_DEFINITIONS) {
    const categoryReport = report.categories[definition.category];

    for (const key of definition.keys) {
      const source = definition.getSource(key);
      if (!source) {
        const warning = `Source registry entry ${definition.category}:${key} could not be loaded; skipping.`;
        categoryReport.warnings.push(warning);
        categoryReport.skipped.push({ key, reason: warning });
        report.skippedItems.push({ category: definition.category, key, reason: warning });
        report.warnings.push(warning);
        continue;
      }

      const sourceEntry = summarizeCoreEntry(definition, key, source);
      const existingItem = findExistingCoreItem(sourceEntry, definition.componentType, arcflightWorldItems);

      if (existingItem) {
        addCategoryEntry(report, categoryReport, "existing", { ...sourceEntry, item: summarizeItem(existingItem) });
      } else {
        addCategoryEntry(report, categoryReport, "missing", sourceEntry);
      }
    }
  }

  return report;
}

/**
 * Report missing Arcflight core component source entries without creating, moving, updating, or deleting Items.
 *
 * @returns {Promise<object>}
 */
export async function findMissingCoreArcflightItems() {
  const report = buildCoreItemAvailabilityReport({ dryRun: true });
  console.log(
    `Arcflight | Core item availability found ${report.missingItems.length} missing source entr${report.missingItems.length === 1 ? "y" : "ies"} and ${report.existingItems.length} existing world Item match(es).`,
    report
  );
  return report;
}

/**
 * Safely materialize missing Arcflight core component source entries as world Items.
 *
 * Defaults to dry-run mode. Passing { dryRun: false } creates only missing world
 * Items via the existing createCore* helpers, then organizes Arcflight Items into
 * their configured folders. Existing Items, duplicates, actor embedded Items,
 * and compendium contents are never deleted or mutated by this helper.
 *
 * @param {{dryRun?: boolean}} [options]
 * @returns {Promise<object>}
 */
export async function syncCoreArcflightItems(options = {}) {
  const dryRun = options?.dryRun !== false;
  const report = buildCoreItemAvailabilityReport({ dryRun });

  for (const missingItem of report.missingItems) {
    const categoryReport = report.categories[missingItem.category];
    categoryReport.wouldCreateItems.push(missingItem);
    report.wouldCreateItems.push(missingItem);
  }

  if (dryRun) {
    console.log(
      `Arcflight | Core item sync dry run would create ${report.wouldCreateItems.length} world Item(s). No Items were created.`,
      report
    );
    return report;
  }

  if (globalThis.game?.ready !== true) {
    const warning = "Foundry world is not ready; core item sync created no Items.";
    report.warnings.push(warning);
    console.warn(`Arcflight | ${warning}`, report);
    return report;
  }

  if (typeof globalThis.Item?.create !== "function") {
    const warning = "Foundry Item document API is not available; core item sync created no Items.";
    report.warnings.push(warning);
    console.warn(`Arcflight | ${warning}`, report);
    return report;
  }

  for (const missingItem of report.missingItems) {
    const definition = CATEGORY_DEFINITIONS.find((candidate) => candidate.category === missingItem.category);
    const categoryReport = report.categories[missingItem.category];
    if (!definition?.create) {
      const warning = `No create helper is registered for ${missingItem.category}:${missingItem.key}; skipping.`;
      categoryReport.warnings.push(warning);
      categoryReport.skipped.push({ ...missingItem, reason: warning });
      report.skippedItems.push({ ...missingItem, reason: warning });
      report.warnings.push(warning);
      continue;
    }

    const latestReport = buildCoreItemAvailabilityReport({ dryRun: true });
    const stillMissing = latestReport.categories[missingItem.category]?.missing?.some((entry) => entry.key === missingItem.key) === true;
    if (!stillMissing) {
      const warning = `Skipped ${missingItem.category}:${missingItem.key} because a matching world Item appeared before creation.`;
      categoryReport.warnings.push(warning);
      categoryReport.skipped.push({ ...missingItem, reason: warning });
      report.skippedItems.push({ ...missingItem, reason: warning });
      report.warnings.push(warning);
      continue;
    }

    try {
      const createdItem = await definition.create(missingItem.key);
      const summarizedItem = summarizeItem(createdItem);
      const createdEntry = { ...missingItem, item: summarizedItem };
      categoryReport.createdItems.push(createdEntry);
      report.createdItems.push({ category: missingItem.category, ...createdEntry });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const warning = `Could not create ${missingItem.category}:${missingItem.key}: ${message}`;
      categoryReport.warnings.push(warning);
      categoryReport.skipped.push({ ...missingItem, reason: warning });
      report.skippedItems.push({ ...missingItem, reason: warning });
      report.warnings.push(warning);
      console.warn("Arcflight | Core item sync skipped a source entry after creation failed.", { entry: missingItem, error });
    }
  }

  try {
    report.organization = await organizeArcflightItems();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const warning = `Created Items were not organized because organizeArcflightItems failed: ${message}`;
    report.warnings.push(warning);
    console.warn("Arcflight | Core item sync could not organize Arcflight Items after creation.", { error });
  }

  console.log(
    `Arcflight | Core item sync created ${report.createdItems.length} missing world Item(s); ${report.existingItems.length} source entr${report.existingItems.length === 1 ? "y" : "ies"} already existed; ${report.warnings.length} warning(s).`,
    report
  );
  return report;
}
