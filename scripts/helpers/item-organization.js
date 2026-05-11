import { ARCFLIGHT_MODULE_ID, ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { getArcflightComponentFlags, getComponentType, isArcflightItem } from "../documents/components.js";

export const ARCFLIGHT_ITEM_FOLDER_ROOT = "Arcflight";
export const ARCFLIGHT_ITEM_FOLDER_TYPE = "Item";

export const arcflightItemFolderNames = Object.freeze({
  [ARCFLIGHT_ITEM_TYPES.HULL]: "Hulls",
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE]: "Arkengines",
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: "Arkengine Mods",
  [ARCFLIGHT_ITEM_TYPES.WEAPON]: "Weapons",
  [ARCFLIGHT_ITEM_TYPES.ROOM]: "Rooms",
  [ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE]: "Ship Upgrades",
  [ARCFLIGHT_ITEM_TYPES.CARGO]: "Cargo",
  [ARCFLIGHT_ITEM_TYPES.CREW_ASSET]: "Crew Assets",
  ammo: "Ammo"
});

export const arcflightComponentFolderNames = Object.freeze({
  [ARCFLIGHT_ITEM_TYPES.HULL]: arcflightItemFolderNames[ARCFLIGHT_ITEM_TYPES.HULL],
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE]: arcflightItemFolderNames[ARCFLIGHT_ITEM_TYPES.ARKENGINE],
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: arcflightItemFolderNames[ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD],
  [ARCFLIGHT_ITEM_TYPES.WEAPON]: arcflightItemFolderNames[ARCFLIGHT_ITEM_TYPES.WEAPON],
  [ARCFLIGHT_ITEM_TYPES.ROOM]: arcflightItemFolderNames[ARCFLIGHT_ITEM_TYPES.ROOM],
  [ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE]: arcflightItemFolderNames[ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE],
  [ARCFLIGHT_ITEM_TYPES.CARGO]: arcflightItemFolderNames[ARCFLIGHT_ITEM_TYPES.CARGO],
  [ARCFLIGHT_ITEM_TYPES.CREW_ASSET]: arcflightItemFolderNames[ARCFLIGHT_ITEM_TYPES.CREW_ASSET]
});

const MISSING_SOURCE_KEY = "";

function assertFoundryWorldReady() {
  if (globalThis.game?.ready !== true) {
    throw new Error("Arcflight | Item organization helpers require game.ready === true.");
  }

  if (typeof globalThis.Folder?.create !== "function") {
    throw new Error("Arcflight | Foundry Folder document API is not available.");
  }
}

function warnFoundryWorldNotReady(helperName) {
  if (globalThis.game?.ready !== true) {
    console.warn(`Arcflight | ${helperName} requires game.ready === true; returning a safe empty report.`);
    return true;
  }

  return false;
}

function getWorldItemFolders() {
  return Array.from(globalThis.game?.folders ?? []).filter((folder) => folder?.type === ARCFLIGHT_ITEM_FOLDER_TYPE);
}

function getParentFolderId(folder) {
  const parent = folder?.folder;
  return parent?.id ?? parent ?? null;
}

function findItemFolder(name, parentFolder = null) {
  const parentId = parentFolder?.id ?? null;
  return getWorldItemFolders().find((folder) => folder?.name === name && getParentFolderId(folder) === parentId) ?? null;
}

async function getOrCreateItemFolder(name, parentFolder = null) {
  const existingFolder = findItemFolder(name, parentFolder);
  if (existingFolder) return existingFolder;

  return globalThis.Folder.create({
    name,
    type: ARCFLIGHT_ITEM_FOLDER_TYPE,
    folder: parentFolder?.id ?? null
  });
}

function getFolderId(folderOrId) {
  return folderOrId?.id ?? folderOrId ?? null;
}

function getArcflightRootFolderIds() {
  return new Set(
    getWorldItemFolders()
      .filter((folder) => folder?.name === ARCFLIGHT_ITEM_FOLDER_ROOT && getParentFolderId(folder) === null)
      .map((folder) => folder.id)
      .filter(Boolean)
  );
}

function getFolderById(folderId) {
  if (!folderId) return null;
  const folders = globalThis.game?.folders;
  return folders?.get?.(folderId) ?? Array.from(folders ?? []).find((folder) => folder?.id === folderId) ?? null;
}

function isInArcflightItemFolderTree(item, rootFolderIds = getArcflightRootFolderIds()) {
  let folder = getFolderById(getFolderId(item?.folder)) ?? item?.folder;

  while (folder) {
    if (rootFolderIds.has(folder.id)) return true;
    folder = folder.folder ?? getFolderById(getParentFolderId(folder));
  }

  return false;
}

function getArcflightFlags(item) {
  return item?.flags?.[ARCFLIGHT_MODULE_ID] ?? {};
}

function firstStringValue(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }

  return MISSING_SOURCE_KEY;
}

function getArcflightSourceKey(item) {
  const flags = getArcflightFlags(item);
  const componentFlags = getArcflightComponentFlags(item);
  const system = componentFlags.system ?? flags.system ?? {};

  return firstStringValue(
    system.key,
    flags.key,
    flags.sourceKey,
    flags.coreKey,
    system.sourceKey,
    system.coreKey,
    system.identity?.id,
    system.id,
    system.platform,
    system.engineClass
  );
}

function getItemCreatedTime(item) {
  const candidates = [
    item?._stats?.createdTime,
    item?.createdTime,
    item?.creationTime,
    item?.sort,
    item?._stats?.modifiedTime
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }

  return 0;
}

function summarizeItem(item) {
  return {
    id: item?.id ?? null,
    name: item?.name ?? "",
    type: item?.type ?? "",
    componentType: getComponentType(item),
    sourceKey: getArcflightSourceKey(item),
    folderId: getFolderId(item?.folder),
    folderName: item?.folder?.name ?? null,
    createdTime: getItemCreatedTime(item)
  };
}

function getDuplicateGroupKey(item) {
  return JSON.stringify({
    name: item?.name ?? "",
    type: item?.type ?? "",
    enabled: true,
    componentType: getComponentType(item),
    sourceKey: getArcflightSourceKey(item)
  });
}

function sortDuplicateCandidates(items) {
  return [...items].sort((a, b) => {
    const createdDelta = getItemCreatedTime(a) - getItemCreatedTime(b);
    if (createdDelta !== 0) return createdDelta;

    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  });
}

function createDuplicateCleanupReport(dryRun = true) {
  return {
    dryRun,
    duplicateGroups: [],
    skippedItems: [],
    deletedItems: [],
    warnings: []
  };
}

function addSkippedItem(report, item, reason) {
  report.skippedItems.push({ ...summarizeItem(item), reason });
}

function isWorldItemDocument(item) {
  return Boolean(item?.id) && !item?.pack && item?.parent == null && item?.actor == null;
}

function addDuplicateCandidate(report, item, rootFolderIds) {
  if (!isWorldItemDocument(item)) {
    addSkippedItem(report, item, "not a world Item document");
    return null;
  }

  if (!isArcflightItem(item)) {
    addSkippedItem(report, item, "not an Arcflight-enabled PF2E equipment item");
    return null;
  }

  const componentType = getComponentType(item);
  if (!componentType) {
    addSkippedItem(report, item, "missing or unsupported flags.arcflight.componentType");
    return null;
  }

  if (!isInArcflightItemFolderTree(item, rootFolderIds)) {
    addSkippedItem(report, item, "not inside the Arcflight item folder tree");
    return null;
  }

  return item;
}

function buildDuplicateCleanupReport(items, { dryRun = true } = {}) {
  const report = createDuplicateCleanupReport(dryRun);
  const rootFolderIds = getArcflightRootFolderIds();
  const groupedItems = new Map();

  if (rootFolderIds.size === 0) {
    report.warnings.push(`Arcflight item folder root "${ARCFLIGHT_ITEM_FOLDER_ROOT}" was not found; no Items are eligible for duplicate cleanup.`);
  }

  for (const item of items) {
    const candidate = addDuplicateCandidate(report, item, rootFolderIds);
    if (!candidate) continue;

    const key = getDuplicateGroupKey(candidate);
    const group = groupedItems.get(key) ?? [];
    group.push(candidate);
    groupedItems.set(key, group);
  }

  for (const [key, groupItems] of groupedItems.entries()) {
    if (groupItems.length < 2) continue;

    const sortedItems = sortDuplicateCandidates(groupItems);
    const keptItem = sortedItems[0];
    const duplicateItems = sortedItems.slice(1);

    report.duplicateGroups.push({
      key,
      name: keptItem.name,
      type: keptItem.type,
      componentType: getComponentType(keptItem),
      sourceKey: getArcflightSourceKey(keptItem),
      keptItem: summarizeItem(keptItem),
      duplicateItems: duplicateItems.map(summarizeItem)
    });
  }

  return report;
}

/**
 * Create the suggested Arcflight world Items panel folder tree.
 *
 * This helper creates only folders. It does not create, delete, or move Items.
 *
 * @returns {Promise<{rootFolder: Folder, folders: Record<string, Folder>, componentFolders: Record<string, Folder>}>}
 */
export async function createArcflightItemFolders() {
  assertFoundryWorldReady();

  const rootFolder = await getOrCreateItemFolder(ARCFLIGHT_ITEM_FOLDER_ROOT);
  const folders = {};
  const componentFolders = {};

  for (const [folderKey, folderName] of Object.entries(arcflightItemFolderNames)) {
    const folder = await getOrCreateItemFolder(folderName, rootFolder);
    folders[folderKey] = folder;

    if (arcflightComponentFolderNames[folderKey]) {
      componentFolders[folderKey] = folder;
    }
  }

  console.log("Arcflight | Item folder tree is ready.", { rootFolder, folders, componentFolders });
  return { rootFolder, folders, componentFolders };
}

/**
 * Move existing Arcflight world equipment items into their suggested Items panel folders.
 *
 * Normal PF2E equipment is ignored because only equipment items with
 * flags.arcflight.enabled === true and a supported flags.arcflight.componentType
 * are eligible for movement. Items are never deleted.
 *
 * @returns {Promise<{rootFolder: Folder, folders: Record<string, Folder>, movedItems: Item[], unchangedItems: Item[], skippedItems: Item[]}>}
 */
export async function organizeArcflightItems() {
  const { rootFolder, folders, componentFolders } = await createArcflightItemFolders();
  const movedItems = [];
  const unchangedItems = [];
  const skippedItems = [];

  for (const item of Array.from(globalThis.game?.items ?? [])) {
    if (!isArcflightItem(item)) continue;

    const componentType = getComponentType(item);
    const destinationFolder = componentFolders[componentType];

    if (!destinationFolder) {
      skippedItems.push(item);
      continue;
    }

    if (item.folder?.id === destinationFolder.id) {
      unchangedItems.push(item);
      continue;
    }

    await item.update({ folder: destinationFolder.id });
    movedItems.push(item);
  }

  console.log(
    `Arcflight | Organized ${movedItems.length} Arcflight world item(s); ${unchangedItems.length} already organized; ${skippedItems.length} skipped.`,
    { movedItems, unchangedItems, skippedItems }
  );

  return { rootFolder, folders, movedItems, unchangedItems, skippedItems };
}

/**
 * Find duplicate Arcflight component world Items inside the Arcflight item folder tree.
 *
 * This helper scans only game.items world documents and reports duplicates by
 * name, Foundry item type, Arcflight enabled flag, component type, and Arcflight
 * source key when one exists. It never deletes Items.
 *
 * @returns {Promise<{dryRun: true, duplicateGroups: object[], skippedItems: object[], deletedItems: object[], warnings: string[]}>}
 */
export async function findDuplicateArcflightItems() {
  if (warnFoundryWorldNotReady("findDuplicateArcflightItems")) return createDuplicateCleanupReport(true);

  const report = buildDuplicateCleanupReport(Array.from(globalThis.game?.items ?? []), { dryRun: true });
  console.log(
    `Arcflight | Found ${report.duplicateGroups.length} duplicate Arcflight item group(s); ${report.skippedItems.length} item(s) skipped.`,
    report
  );

  return report;
}

/**
 * Safely clean up duplicate Arcflight component world Items inside the Arcflight item folder tree.
 *
 * The default is a dry run. Passing { dryRun: false } deletes only later Items in
 * duplicate groups after re-checking that each document is a world Item,
 * Arcflight-enabled PF2E equipment, not embedded on an Actor, not from a
 * compendium, and still inside the Arcflight item folder tree.
 *
 * @param {{dryRun?: boolean}} [options]
 * @returns {Promise<{dryRun: boolean, duplicateGroups: object[], skippedItems: object[], deletedItems: object[], warnings: string[]}>}
 */
export async function cleanupDuplicateArcflightItems(options = {}) {
  const dryRun = options?.dryRun !== false;
  if (warnFoundryWorldNotReady("cleanupDuplicateArcflightItems")) return createDuplicateCleanupReport(dryRun);

  const report = buildDuplicateCleanupReport(Array.from(globalThis.game?.items ?? []), { dryRun });

  if (dryRun) {
    console.log(
      `Arcflight | Duplicate cleanup dry run found ${report.duplicateGroups.length} duplicate group(s). No Items were deleted.`,
      report
    );
    return report;
  }

  const rootFolderIds = getArcflightRootFolderIds();
  for (const group of report.duplicateGroups) {
    for (const duplicateItem of group.duplicateItems) {
      const item = globalThis.game?.items?.get?.(duplicateItem.id) ?? null;
      if (!item) {
        report.warnings.push(`Item ${duplicateItem.id} was not found at delete time; skipping.`);
        continue;
      }

      const candidate = addDuplicateCandidate(report, item, rootFolderIds);
      if (!candidate) continue;

      try {
        await candidate.delete();
        report.deletedItems.push(summarizeItem(candidate));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        report.warnings.push(`Could not delete duplicate item ${candidate.name} (${candidate.id}): ${message}`);
        console.warn("Arcflight | Duplicate item cleanup skipped a document after delete failed.", { item: candidate, error });
      }
    }
  }

  console.log(
    `Arcflight | Duplicate cleanup deleted ${report.deletedItems.length} duplicate Arcflight world item(s); ${report.warnings.length} warning(s).`,
    report
  );

  return report;
}
