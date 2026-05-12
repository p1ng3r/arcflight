import {
  cleanupDuplicateArcflightItems,
  createArcflightItemFolders,
  findDuplicateArcflightItems,
  organizeArcflightItems
} from "../helpers/item-organization.js";
import { findMissingCoreArcflightItems, syncCoreArcflightItems } from "../helpers/core-item-sync.js";
import { getInstallValidationWarnings, previewComponentInstall, previewInstallValidation } from "../helpers/install-validation-preview.js";

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
     * Create the suggested Arcflight folder tree in the world Items panel.
     */
    createItemFolders: createArcflightItemFolders,

    /**
     * Move only Arcflight equipment components into matching Arcflight folders.
     */
    organizeArcflightItems,

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
