import {
  cleanupDuplicateArcflightItems,
  createArcflightItemFolders,
  findDuplicateArcflightItems,
  organizeArcflightItems
} from "../helpers/item-organization.js";
import { findMissingCoreArcflightItems, syncCoreArcflightItems } from "../helpers/core-item-sync.js";
import { CORE_WEAPON_KEYS, getCoreWeapon, getCoreWeaponKeys } from "../../data/weapons/core-weapons.js";
import {
  CORE_STATION_ACTION_KEYS,
  CORE_STATION_ACTIONS,
  getCoreStationAction,
  getCoreStationActionKeys,
  getCoreStationActions,
  getCoreStationActionsForStation,
  getStationActionOutcome,
  previewStationActionOutcome
} from "../../data/station-actions/core-station-actions.js";
import { createCoreWeapon, createWeapon } from "../documents/creation.js";
import { canSpendShipActionPoints, getShipActionEconomy, installWeapon, removeInstalledWeapon, resetShipActionEconomy, spendShipActionPoints } from "../documents/ships.js";
import { getInstallValidationWarnings, previewComponentInstall, previewInstallValidation, shouldBlockInstall } from "../helpers/install-validation-preview.js";
import { clearStationActionHistory, executeStationAction, getStationActionRollOptions, getStationActionState, previewStationAction, previewStationActionRoll, rollStationAction } from "../helpers/station-action-execution.js";
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
} from "../helpers/install-state.js";

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
     * Return immutable core weapon source keys.
     */
    getCoreWeaponKeys,

    /**
     * Return immutable core weapon source data by key.
     */
    getCoreWeapon,

    /**
     * Core weapon key constants for console inspection.
     */
    CORE_WEAPON_KEYS,

    /**
     * Data-only station action registry for future station-action systems.
     */
    CORE_STATION_ACTIONS,

    /**
     * Immutable station action source keys.
     */
    CORE_STATION_ACTION_KEYS,

    /**
     * Return immutable station action source keys.
     */
    getCoreStationActionKeys,

    /**
     * Return all immutable station action source data.
     */
    getCoreStationActions,

    /**
     * Return immutable station action source data by key.
     */
    getCoreStationAction,

    /**
     * Interpret a station action degree of success into outcome copy.
     */
    getStationActionOutcome,

    /**
     * Interpret a PF2E roll result into station action outcome copy.
     */
    previewStationActionOutcome,

    /**
     * Return station action execution state for an Arcflight ship.
     */
    getStationActionState,

    /**
     * Preview whether a station action can be recorded.
     */
    previewStationAction,

    /**
     * Return roll options for a station action.
     */
    getStationActionRollOptions,

    /**
     * Preview the assigned PF2E actor/statistic for a station action roll.
     */
    previewStationActionRoll,

    /**
     * Best-effort PF2E statistic roll for an assigned station actor.
     */
    rollStationAction,

    /**
     * Validate and append a station action history record without applying gameplay effects.
     */
    executeStationAction,

    /**
     * Clear ship-owned station action history.
     */
    clearStationActionHistory,

    /**
     * Return station action source data for a station key.
     */
    getCoreStationActionsForStation,

    /**
     * Create a core weapon as a PF2E equipment world Item.
     */
    createCoreWeapon,

    /**
     * Alias for createCoreWeapon.
     */
    createWeapon,

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
     * Return normalized ship AP/RAP economy state.
     */
    getShipActionEconomy,

    /**
     * Reset current AP/RAP to max AP/RAP.
     */
    resetShipActionEconomy,

    /**
     * Spend AP/RAP from ship-owned economy state.
     */
    spendShipActionPoints,

    /**
     * Preview whether AP/RAP can be spent.
     */
    canSpendShipActionPoints,

    /**
     * Install a weapon component into a hull weapon mount.
     */
    installWeapon,

    /**
     * Remove an installed weapon by mountedWeaponId.
     */
    removeInstalledWeapon,

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
     * Return whether a validation preview blocks helper-driven installation.
     */
    shouldBlockInstall,

    /**
     * Generate a lightweight install record id.
     */
    createInstallId,

    /**
     * Return normalized install records currently active on an Arcflight ship.
     */
    getActiveInstallRecords,

    /**
     * Return normalized install records currently inactive on an Arcflight ship.
     */
    getInactiveInstallRecords,

    /**
     * Legacy alias for getActiveInstallRecords.
     */
    getInstalledComponents,

    /**
     * Return the normalized persistent install-state object for an Arcflight ship.
     */
    getInstallState,

    /**
     * Append one normalized persistent install record to an Arcflight ship.
     */
    recordInstallState,

    /**
     * Mark one persistent install record inactive while preserving record history.
     */
    deactivateInstallRecord,

    /**
     * Mark active persistent install records matching a component as inactive.
     */
    deactivateInstallRecordsByComponent,

    /**
     * Legacy alias for deactivateInstallRecord.
     */
    removeInstallState,

    /**
     * Find one persistent install record by installId.
     */
    findInstallRecord,

    /**
     * Prepare active/inactive counts, component counts, pressure totals, and categories.
     */
    prepareInstallStateSummary,

    /**
     * Dry-run report of Arcflight ships with installed data missing install-state records.
     */
    findShipsMissingInstallState,

    /**
     * Dry-run by default. Backfill one ship's install-state records from existing installed data.
     */
    backfillInstallStateForShip,

    /**
     * Dry-run by default. Backfill all Arcflight ships' install-state records from existing installed data.
     */
    backfillInstallStateForAllShips,

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
