import { ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { getComponentType, isArcflightItem } from "../documents/components.js";

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

function assertFoundryWorldReady() {
  if (globalThis.game?.ready !== true) {
    throw new Error("Arcflight | Item organization helpers require game.ready === true.");
  }

  if (typeof globalThis.Folder?.create !== "function") {
    throw new Error("Arcflight | Foundry Folder document API is not available.");
  }
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
