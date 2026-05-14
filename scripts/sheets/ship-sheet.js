import { getArkenginePattern, getArkenginePatternKeys } from "../../data/arkengines/arkengine-patterns.js";
import { getHullPattern, getHullPatternKeys } from "../../data/hulls/hull-patterns.js";
import { getCoreStationActionsForStation, getStationActionOutcome, getStationActionRollOptions } from "../../data/station-actions/core-station-actions.js";
import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID, ARCFLIGHT_WEAPON_ARCS } from "../config/constants.js";
import { ARCFLIGHT_COMPONENT_ITEM_TYPE, getComponentData, getComponentType } from "../documents/components.js";
import { getInstallState, prepareInstallStateSummary } from "../helpers/install-state.js";
import { previewInstallValidation, shouldBlockInstall } from "../helpers/install-validation-preview.js";
import { clearStationActionHistory, executeStationAction, getStationActionState, previewStationAction, rollStationAction } from "../helpers/station-action-execution.js";
import {
  ARCFLIGHT_SHIP_ACTOR_TYPE,
  addCrewAsset,
  assignStation,
  clearStationAssignment,
  getArcflightShipData,
  getShipActionEconomy,
  installArkengine,
  installArkengineMod,
  installHull,
  installRoom,
  installShipUpgrade,
  installWeapon,
  removeCrewAsset,
  removeInstalledArkengineMod,
  removeInstalledRoom,
  removeInstalledShipUpgrade,
  removeInstalledWeapon,
  resetShipActionEconomy,
  setArkenginePattern,
  setHullPattern
} from "../documents/ships.js";
import { arcflightTemplatePath } from "./sheet-helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const INSTALL_COMPONENT_TYPES = Object.freeze([
  { value: ARCFLIGHT_ITEM_TYPES.HULL, label: "Hull" },
  { value: ARCFLIGHT_ITEM_TYPES.ARKENGINE, label: "Arkengine" },
  { value: ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD, label: "Arkengine Mod" },
  { value: ARCFLIGHT_ITEM_TYPES.WEAPON, label: "Weapon" },
  { value: ARCFLIGHT_ITEM_TYPES.ROOM, label: "Room" },
  { value: ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE, label: "Ship Upgrade" },
  { value: ARCFLIGHT_ITEM_TYPES.CREW_ASSET, label: "Crew Asset" }
]);

const INSTALL_COMPONENT_TYPE_VALUES = new Set(INSTALL_COMPONENT_TYPES.map((entry) => entry.value));

const STATION_ACTION_STATION_ORDER = Object.freeze([
  "captain",
  "pilot",
  "engineer",
  "gunnery",
  "veilwarden",
  "watchmaster",
  "quartermaster"
]);

const STATION_ACTION_HISTORY_LIMIT = 5;

const SHIP_SHEET_TABS = Object.freeze([
  { id: "overview", label: "Overview" },
  { id: "components", label: "Components" },
  { id: "weapons", label: "Weapons" },
  { id: "crew-stations", label: "Crew & Stations" },
  { id: "station-actions", label: "Station Actions" },
  { id: "validation-history", label: "Validation & History" },
  { id: "developer", label: "Developer" }
]);

const SHIP_SHEET_TAB_IDS = new Set(SHIP_SHEET_TABS.map((tab) => tab.id));

function normalizeShipSheetTab(tabId = "") {
  return SHIP_SHEET_TAB_IDS.has(tabId) ? tabId : "overview";
}

function prepareShipSheetTabs(activeTab = "overview") {
  const normalizedActiveTab = normalizeShipSheetTab(activeTab);

  return SHIP_SHEET_TABS.map((tab) => ({
    ...tab,
    active: tab.id === normalizedActiveTab,
    cssClass: tab.id === normalizedActiveTab ? "active" : ""
  }));
}

function prepareShipSheetTabState(activeTab = "overview") {
  const normalizedActiveTab = normalizeShipSheetTab(activeTab);

  return {
    overview: normalizedActiveTab === "overview",
    components: normalizedActiveTab === "components",
    weapons: normalizedActiveTab === "weapons",
    crewStations: normalizedActiveTab === "crew-stations",
    stationActions: normalizedActiveTab === "station-actions",
    validationHistory: normalizedActiveTab === "validation-history",
    developer: normalizedActiveTab === "developer"
  };
}

function prepareArcflightShipFlags(actor) {
  return {
    enabled: actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true,
    actorType: actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") ?? "",
    system: getArcflightShipData(actor)
  };
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayNameForEntry(entry = {}) {
  const displayName = entry.displayName
    || entry.identity?.displayName
    || entry.name
    || entry.key
    || entry.id
    || "Unnamed";

  return humanizeIdentifier(displayName);
}

function displayNameForInstalledSingle(name, fallback = "") {
  return humanizeIdentifier(name || fallback);
}

function preparePatternOptions(patternKeys = [], getPattern, selectedKey = "") {
  return arrayOrEmpty(patternKeys).map((key) => {
    const pattern = getPattern(key) ?? {};

    return {
      value: key,
      label: displayNameForEntry({ ...pattern, key }),
      selected: key === selectedKey
    };
  });
}

function prepareExampleBuildOptions(selectedKey = "") {
  const arcflightApi = game?.arcflight;
  const getBuildKeys = arcflightApi?.getExampleShipBuildKeys;
  const getBuild = arcflightApi?.getExampleShipBuild;

  if (typeof getBuildKeys !== "function" || typeof getBuild !== "function") return [];

  return arrayOrEmpty(getBuildKeys.call(arcflightApi)).map((key) => {
    const build = getBuild.call(arcflightApi, key) ?? {};
    const name = build.name || displayNameForEntry({ ...build, key });

    return {
      value: key,
      name,
      role: build.role ?? "",
      description: build.description ?? "",
      selected: key === selectedKey
    };
  });
}

function getInstalledEntryRemoveId(entry = {}) {
  return entry.itemUuid || entry.uuid || entry.itemId || entry.id || entry.key || entry.identity?.id || "";
}

function prepareInstalledEntry(entry = {}) {
  return {
    ...entry,
    removeId: getInstalledEntryRemoveId(entry),
    displayName: displayNameForEntry(entry),
    effects: {
      ...(entry.effects ?? {}),
      derivedStatModifiers: arrayOrEmpty(entry.effects?.derivedStatModifiers)
    }
  };
}

function prepareCrewEntry(entry = {}) {
  return {
    ...entry,
    removeId: getInstalledEntryRemoveId(entry),
    displayName: displayNameForEntry(entry),
    identity: entry.identity ?? {},
    crew: entry.crew ?? {},
    stationAssignment: entry.stationAssignment ?? {}
  };
}

function numericDisplayValue(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function prepareFuelingDisplay(system = {}) {
  const derived = system.derived ?? {};
  const current = system.current ?? {};
  const fueling = system.base?.arkengine?.fueling ?? {};
  const requiredSpellRank = numericDisplayValue(fueling.requiredSpellRank);
  const fuelSlots = numericDisplayValue(derived.fuelSlots, numericDisplayValue(fueling.fuelSlots));
  const maxStoredSpellRanks = numericDisplayValue(
    derived.maxStoredSpellRanks,
    numericDisplayValue(fueling.maxStoredSpellRanks, requiredSpellRank * fuelSlots)
  );

  return {
    fuelSlots,
    maxStoredSpellRanks,
    currentStoredSpellRanks: numericDisplayValue(current.storedSpellRanks),
    normalHexCost: numericDisplayValue(derived.normalHexCost, requiredSpellRank),
    hardBurnHexCost: numericDisplayValue(derived.hardBurnHexCost, Math.ceil(requiredSpellRank * 1.5)),
    leanBurnHexCost: numericDisplayValue(derived.leanBurnHexCost, Math.ceil(requiredSpellRank / 2)),
    stealthBurnHexCost: numericDisplayValue(derived.stealthBurnHexCost, Math.ceil(requiredSpellRank * 1.5))
  };
}

function prepareSlotState(slotState = {}, fallbackCapacity = 0) {
  const capacity = Number.isFinite(Number(slotState?.capacity)) ? Number(slotState.capacity) : fallbackCapacity;
  const used = Number.isFinite(Number(slotState?.used)) ? Number(slotState.used) : 0;
  const available = Number.isFinite(Number(slotState?.available)) ? Number(slotState.available) : Math.max(capacity - used, 0);

  return { capacity, used, available };
}

function prepareBooleanDisplay(value) {
  return value === true ? "Yes" : "No";
}

function prepareValidationSummary(refitStatus = "native") {
  switch (refitStatus) {
    case "major-refit-required":
      return {
        label: "Major refit required",
        message: "Major refit required / drydock needed.",
        severity: "danger",
        cssClass: "arcflight-validation-danger"
      };
    case "pressured":
      return {
        label: "Pressured",
        message: "Ship has refit pressure but is below the major refit threshold.",
        severity: "info",
        cssClass: "arcflight-validation-info"
      };
    case "native":
      return {
        label: "Native",
        message: "Stable / no refit pressure.",
        severity: "ok",
        cssClass: "arcflight-validation-ok"
      };
    default:
      return {
        label: humanizeIdentifier(refitStatus || "Unknown"),
        message: "Stored refit status is not recognized by this sheet version.",
        severity: "warning",
        cssClass: "arcflight-validation-warning"
      };
  }
}


function prepareLabelValueRows(values = {}, labels = {}) {
  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: numericDisplayValue(values[key])
  }));
}

function prepareTextArray(values = []) {
  return arrayOrEmpty(values).map((value) => String(value ?? "").trim()).filter(Boolean);
}

function prepareComponentTypeCounts(countsByComponentType = {}) {
  return Object.entries(countsByComponentType)
    .map(([componentType, count]) => ({
      componentType,
      label: humanizeIdentifier(componentType || "Unknown"),
      count: numericDisplayValue(count)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function prepareInstallRecordReadout(record = {}) {
  const flags = [];
  if (record.nativeInstall === true) flags.push("native");
  if (record.refitInstall === true) flags.push("refit");
  if (record.temporaryInstall === true) flags.push("temporary");

  const placements = [
    { label: "Hull Slot", value: record.hullSlot },
    { label: "Room Slot", value: record.roomSlot },
    { label: "Weapon Arc", value: record.weaponArc }
  ].filter((entry) => String(entry.value ?? "").trim());

  return {
    ...record,
    componentTypeLabel: humanizeIdentifier(record.componentType || "Unknown Component"),
    installCategoryLabel: humanizeIdentifier(record.installCategory || "Uncategorized"),
    itemReference: record.itemId || record.itemUuid || "No item reference",
    flags,
    flagsLabel: flags.length ? flags.join(", ") : "none",
    placements,
    hasPlacements: placements.length > 0,
    hasTierAtInstall: record.tierAtInstall !== undefined && record.tierAtInstall !== null && record.tierAtInstall !== "",
    hasNotes: String(record.notes ?? "").trim().length > 0
  };
}

function prepareInstallStateReadout(shipActor) {
  const installState = getInstallState(shipActor);
  const summary = prepareInstallStateSummary(shipActor);
  const activeRecords = installState.installs.filter((record) => record.active === true).map(prepareInstallRecordReadout);
  const pressureLabels = {
    total: "Total",
    weapon: "Weapon",
    engine: "Engine",
    infrastructure: "Infrastructure",
    lifeveil: "Lifeveil",
    crewCommand: "Crew Command",
    occult: "Occult"
  };

  return {
    version: summary.version,
    hasRecords: summary.totalInstalls > 0,
    summary: {
      activeInstalls: summary.activeInstalls,
      inactiveInstalls: summary.inactiveInstalls,
      totalInstalls: summary.totalInstalls,
      installCategories: prepareTextArray(summary.installCategories),
      installCategoriesLabel: summary.installCategories.length ? summary.installCategories.map(humanizeIdentifier).join(", ") : "None",
      componentTypeCounts: prepareComponentTypeCounts(summary.countsByComponentType),
      hasComponentTypeCounts: Object.keys(summary.countsByComponentType ?? {}).length > 0
    },
    pressure: {
      ...summary.pressureContribution,
      rows: prepareLabelValueRows(summary.pressureContribution, pressureLabels)
    },
    activeRecords,
    hasActiveRecords: activeRecords.length > 0
  };
}

function normalizeInstallComponentType(componentType = ARCFLIGHT_ITEM_TYPES.HULL) {
  return INSTALL_COMPONENT_TYPE_VALUES.has(componentType) ? componentType : ARCFLIGHT_ITEM_TYPES.HULL;
}

function getGameWorldItems() {
  const items = game?.items;
  if (!items) return [];
  if (Array.isArray(items.contents)) return items.contents;
  if (typeof items.values === "function") return Array.from(items.values());
  return Array.from(items);
}

function prepareInstallComponentTypeOptions(selectedComponentType) {
  return INSTALL_COMPONENT_TYPES.map((entry) => ({
    ...entry,
    selected: entry.value === selectedComponentType
  }));
}

function getArcflightFlagValue(documentLike, key) {
  return documentLike?.flags?.[ARCFLIGHT_MODULE_ID]?.[key] ?? documentLike?.getFlag?.(ARCFLIGHT_MODULE_ID, key);
}

function getInstallComponentKey(item) {
  const componentData = getComponentData(item) ?? {};

  return componentData.identity?.id
    ?? componentData.platform
    ?? componentData.engineClass
    ?? item?.slug
    ?? "";
}

function prepareInstallItemOptions(selectedComponentType, selectedItemId = "") {
  return getGameWorldItems()
    .filter((item) => item?.type === ARCFLIGHT_COMPONENT_ITEM_TYPE)
    .filter((item) => getArcflightFlagValue(item, "enabled") === true)
    .filter((item) => getComponentType(item) === selectedComponentType)
    .map((item) => {
      const componentKey = getInstallComponentKey(item);
      const name = item.name ?? "Unnamed Component";

      return {
        id: item.id,
        uuid: item.uuid ?? "",
        name,
        componentKey,
        label: componentKey ? `${name} [${componentKey}]` : name,
        selected: item.id === selectedItemId
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function getWeaponArcLabel(arc = "") {
  const normalizedArc = String(arc ?? "").trim().toLowerCase();
  const arcEntry = Object.entries(ARCFLIGHT_WEAPON_ARCS).find(([, value]) => value === normalizedArc);
  return arcEntry ? humanizeIdentifier(arcEntry[1]) : humanizeIdentifier(normalizedArc || "Unknown Arc");
}

function getWeaponMountAllowedSizesLabel(mount = {}) {
  const allowedSizes = arrayOrEmpty(mount.allowedSizes).map(humanizeIdentifier);
  if (allowedSizes.length > 0) return allowedSizes.join(", ");
  if (mount.maxSize) return `Up to ${humanizeIdentifier(mount.maxSize)}`;
  return "Any size";
}

function isWeaponMountOptionOccupied(mount = {}, installedWeapons = []) {
  return mount.occupied === true
    || Boolean(mount.mountedWeaponId)
    || installedWeapons.some((weapon) => weapon.arc === mount.arc && weapon.mountId === mount.id);
}

function prepareWeaponMountOptions(system = {}, selectedMountValue = "") {
  const weaponMounts = system.base?.hull?.weaponMounts ?? {};
  const installedWeapons = arrayOrEmpty(system.installed?.weapons);

  return Object.values(ARCFLIGHT_WEAPON_ARCS).flatMap((arc) => {
    const mounts = arrayOrEmpty(weaponMounts[arc]);

    return mounts.map((mount) => {
      const mountId = String(mount.id ?? "").trim();
      const value = `${arc}:${mountId}`;
      const occupied = isWeaponMountOptionOccupied({ ...mount, arc }, installedWeapons);
      const allowedSizesLabel = getWeaponMountAllowedSizesLabel(mount);
      const occupancyLabel = occupied ? "occupied" : "available";

      return {
        arc,
        arcLabel: getWeaponArcLabel(arc),
        mountId,
        value,
        allowedSizesLabel,
        occupied,
        disabled: occupied,
        selected: value === selectedMountValue,
        label: `${getWeaponArcLabel(arc)} / ${mountId} / allowed sizes: ${allowedSizesLabel} (${occupancyLabel})`
      };
    });
  });
}

function getSelectedWeaponMountOption(weaponMountOptions = [], selectedMountValue = "") {
  const selectedOption = weaponMountOptions.find((option) => option.selected && option.disabled !== true);
  if (selectedOption) return selectedOption;
  return weaponMountOptions.find((option) => option.disabled !== true) ?? null;
}

function getWeaponInstallOptions(selectedWeaponMountOption = null) {
  if (!selectedWeaponMountOption) return {};
  return {
    arc: selectedWeaponMountOption.arc,
    mountId: selectedWeaponMountOption.mountId
  };
}

function prepareInstalledWeaponEntry(entry = {}) {
  const displayName = displayNameForEntry(entry);
  return {
    ...entry,
    removeId: entry.mountedWeaponId ?? "",
    displayName,
    arcLabel: getWeaponArcLabel(entry.arc),
    sizeLabel: humanizeIdentifier(entry.size || "Unknown Size"),
    familyLabel: humanizeIdentifier(entry.family || entry.category || "Weapon"),
    traitsLabel: prepareTextArray(entry.traits).join(", "),
    hasTraits: prepareTextArray(entry.traits).length > 0
  };
}

function prepareInstalledWeaponGroups(installedWeapons = []) {
  const weapons = arrayOrEmpty(installedWeapons).map(prepareInstalledWeaponEntry);

  return Object.values(ARCFLIGHT_WEAPON_ARCS)
    .map((arc) => {
      const arcWeapons = weapons.filter((weapon) => weapon.arc === arc);
      return {
        arc,
        arcLabel: getWeaponArcLabel(arc),
        weapons: arcWeapons,
        hasWeapons: arcWeapons.length > 0
      };
    })
    .filter((group) => group.hasWeapons);
}

function preparePreviewSlotRows(preview = {}) {
  const projectedSlots = preview.projected?.slots ?? {};
  const currentSlots = preview.current?.slots ?? {};

  return Object.entries(projectedSlots).map(([key, projected = {}]) => {
    const current = currentSlots[key] ?? {};

    return {
      key,
      label: humanizeIdentifier(key),
      currentUsed: numericDisplayValue(current.used),
      currentCapacity: numericDisplayValue(current.capacity),
      projectedUsed: numericDisplayValue(projected.used),
      projectedCapacity: numericDisplayValue(projected.capacity),
      projectedAvailable: numericDisplayValue(projected.available)
    };
  });
}

function prepareInstallPreviewReadout(actor, selectedItem, selectedComponentType = "", installOptions = {}) {
  if (!selectedItem) return null;

  const componentType = getComponentType(selectedItem) || selectedComponentType;
  const severityRanks = new Set(["ok", "info", "warning", "danger"]);
  const itemIdentity = {
    name: selectedItem.name ?? "Unnamed Component",
    componentType,
    componentTypeLabel: humanizeIdentifier(componentType || "Unknown Component"),
    uuid: selectedItem.uuid ?? "",
    componentKey: getInstallComponentKey(selectedItem)
  };

  try {
    const preview = previewInstallValidation(actor, selectedItem, installOptions);
    const messages = prepareTextArray(preview.messages);
    const warnings = prepareTextArray(preview.warnings);
    const slotRows = preparePreviewSlotRows(preview);
    const severity = severityRanks.has(preview.severity) ? preview.severity : "ok";
    const blockState = shouldBlockInstall(preview);
    const installBlocked = blockState.blocked === true;

    return {
      ...preview,
      ...itemIdentity,
      severity,
      severityLabel: severity,
      cssClass: `arcflight-validation-${severity}`,
      badgeClass: `arcflight-install-ui__badge--${severity}`,
      blocked: installBlocked,
      blockedReason: blockState.reason,
      statusLabel: installBlocked ? `Install blocked: ${blockState.reason}` : "Install allowed",
      statusClass: installBlocked ? "arcflight-install-ui__status--blocked" : "arcflight-install-ui__status--allowed",
      messages,
      warnings,
      hasMessages: messages.length > 0,
      hasWarnings: warnings.length > 0,
      slotRows,
      hasSlotRows: slotRows.length > 0,
      projectedRefitStatusLabel: humanizeIdentifier(preview.projected?.refitStatus || "native"),
      projectedRefitPressureTotal: numericDisplayValue(preview.projected?.refitPressure?.total)
    };
  } catch (error) {
    console.warn("Arcflight | Install validation preview failed.", error);
    const message = error.message ?? "Arcflight could not preview this component install.";

    return {
      ...itemIdentity,
      severity: "danger",
      severityLabel: "danger",
      cssClass: "arcflight-validation-danger",
      badgeClass: "arcflight-install-ui__badge--danger",
      statusLabel: "Install blocked",
      statusClass: "arcflight-install-ui__status--blocked",
      messages: [],
      warnings: [message],
      hasMessages: false,
      hasWarnings: true,
      slotRows: [],
      hasSlotRows: false,
      blocked: true,
      blockedReason: message,
      projectedRefitStatusLabel: "Unknown",
      projectedRefitPressureTotal: 0
    };
  }
}

function prepareInstallUiState(actor, selectedComponentType = ARCFLIGHT_ITEM_TYPES.HULL, selectedItemId = "", selectedWeaponMountValue = "") {
  const componentType = normalizeInstallComponentType(selectedComponentType);
  const itemOptions = prepareInstallItemOptions(componentType, selectedItemId);
  const selectedItemOption = itemOptions.find((option) => option.selected) ?? null;
  const selectedItem = selectedItemOption ? game?.items?.get?.(selectedItemOption.id) : null;
  const isWeaponInstall = componentType === ARCFLIGHT_ITEM_TYPES.WEAPON;
  const weaponMountOptions = isWeaponInstall
    ? prepareWeaponMountOptions(getArcflightShipData(actor), selectedWeaponMountValue)
    : [];
  const selectedWeaponMountOption = isWeaponInstall
    ? getSelectedWeaponMountOption(weaponMountOptions, selectedWeaponMountValue)
    : null;
  const weaponInstallOptions = getWeaponInstallOptions(selectedWeaponMountOption);
  const preview = prepareInstallPreviewReadout(actor, selectedItem, componentType, weaponInstallOptions);
  const missingWeaponMountReason = isWeaponInstall && !selectedWeaponMountOption
    ? "Select an available hull weapon mount before installing a weapon."
    : "";
  const disabledReason = !selectedItem
    ? "Select a world item to preview and install."
    : missingWeaponMountReason
      || (preview?.blocked === true
        ? preview.blockedReason || "Install validation blocks this install. Resolve the listed warnings before installing."
        : "");

  return {
    selectedComponentType: componentType,
    selectedItemId: selectedItemOption?.id ?? "",
    componentTypeOptions: prepareInstallComponentTypeOptions(componentType),
    itemOptions,
    hasItemOptions: itemOptions.length > 0,
    selectedComponentTypeLabel: humanizeIdentifier(componentType),
    noItemsHint: "No matching Arcflight world Items found for this component type. Run core item sync, confirm the item is PF2E equipment, and confirm flags.arcflight.enabled plus flags.arcflight.componentType are set.",
    isWeaponInstall,
    weaponMountOptions: weaponMountOptions.map((option) => ({
      ...option,
      selected: selectedWeaponMountOption?.value === option.value
    })),
    hasWeaponMountOptions: weaponMountOptions.length > 0,
    selectedWeaponMountValue: selectedWeaponMountOption?.value ?? "",
    selectedWeaponMountArc: selectedWeaponMountOption?.arc ?? "",
    selectedWeaponMountId: selectedWeaponMountOption?.mountId ?? "",
    preview,
    hasPreview: Boolean(preview),
    canInstall: Boolean(selectedItem) && (!isWeaponInstall || Boolean(selectedWeaponMountOption)) && preview?.blocked !== true,
    disabledReason,
    hasDisabledReason: Boolean(disabledReason)
  };
}


function getAssignedCrewName(assignment = null) {
  return assignment?.name
    || assignment?.actorUuid
    || assignment?.actorId
    || assignment?.crewAssetUuid
    || assignment?.crewAssetId
    || "";
}

function formatStationActionTimestamp(timestamp) {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) return "Unknown time";

  try {
    return new Date(numericTimestamp).toLocaleString();
  } catch (_error) {
    return String(timestamp);
  }
}

function prepareStationActionPreviewReadout(actor, action = {}) {
  try {
    const phase = action.phase || "both";
    const preview = previewStationAction(actor, action.key, { phase });
    const messages = prepareTextArray(preview.messages);
    const warnings = prepareTextArray(preview.warnings);
    const severity = ["ok", "warning", "danger"].includes(preview.severity) ? preview.severity : "warning";
    const blocked = preview.blocked === true || severity === "danger";

    return {
      ...preview,
      phase,
      severity,
      blocked,
      messages,
      warnings,
      hasMessages: messages.length > 0,
      hasWarnings: warnings.length > 0,
      cssClass: `arcflight-station-actions__action--${severity}`,
      badgeClass: `arcflight-install-ui__badge--${severity}`,
      statusLabel: blocked ? "Blocked" : (severity === "warning" ? "Warning" : "Ready"),
      statusText: [...messages, ...warnings].join(" ") || (blocked ? "Action blocked by station-action preview." : "Ready to record."),
      canExecute: blocked !== true
    };
  } catch (error) {
    const message = error.message ?? "Arcflight could not preview this station action.";
    console.warn("Arcflight | Station action preview failed.", error);

    return {
      actionKey: action.key ?? "",
      actionName: action.name ?? "Station Action",
      stationKey: action.stationKey ?? "",
      phase: action.phase || "both",
      apCost: numericDisplayValue(action.apCost),
      rapCost: numericDisplayValue(action.rapCost),
      severity: "danger",
      blocked: true,
      messages: [],
      warnings: [message],
      hasMessages: false,
      hasWarnings: true,
      cssClass: "arcflight-station-actions__action--danger",
      badgeClass: "arcflight-install-ui__badge--danger",
      statusLabel: "Blocked",
      statusText: message,
      canExecute: false
    };
  }
}

function prepareStationActionGroups(actor, stations = {}) {
  const definitions = stations.definitions ?? {};
  const assignments = stations.assignments ?? {};

  return STATION_ACTION_STATION_ORDER.map((stationKey) => {
    const station = definitions[stationKey] ?? { key: stationKey, displayName: humanizeIdentifier(stationKey) };
    const assignment = assignments[stationKey] ?? null;
    const assignedCrewName = getAssignedCrewName(assignment);
    const actions = getCoreStationActionsForStation(stationKey).map((action) => {
      const preview = prepareStationActionPreviewReadout(actor, action);
      const assignedCrewStatus = assignedCrewName
        ? `Assigned: ${assignedCrewName}`
        : `Requires assigned ${action.requiredCrewRole || station.displayName || humanizeIdentifier(stationKey)}`;

      const rollOptions = getStationActionRollOptions(action.key).map((option, index) => ({
        ...option,
        selected: index === 0
      }));

      return {
        ...action,
        stationDisplayName: station.displayName || humanizeIdentifier(stationKey),
        phaseLabel: humanizeIdentifier(action.phase || "both"),
        costLabel: `${numericDisplayValue(action.apCost)} AP / ${numericDisplayValue(action.rapCost)} RAP`,
        assignedCrewName,
        assignedCrewStatus,
        hasAssignedCrew: Boolean(assignedCrewName),
        rollOptions,
        hasRollOptions: rollOptions.length > 0,
        preview
      };
    });

    return {
      key: stationKey,
      displayName: station.displayName || humanizeIdentifier(stationKey),
      role: station.role ?? "",
      assignment,
      assigneeName: assignedCrewName || "Unassigned",
      actions,
      hasActions: actions.length > 0
    };
  });
}

function prepareStationActionHistoryReadout(actor, limit = STATION_ACTION_HISTORY_LIMIT) {
  const history = getStationActionState(actor).history.map((record = {}) => {
    const derivedOutcome = getStationActionOutcome(record.actionKey, record.degreeOfSuccess ?? record.degree ?? record.result);
    const outcomeLabel = record.outcomeLabel || derivedOutcome.label || "Unresolved";
    const outcomeText = record.outcomeText || derivedOutcome.text || "Unresolved";

    return {
      ...record,
      stationLabel: humanizeIdentifier(record.stationKey || "Unknown Station"),
      phaseLabel: humanizeIdentifier(record.phase || "both"),
      assignedCrewName: record.assignedActorName || record.assignedCrewName || "Unassigned",
      timestampLabel: formatStationActionTimestamp(record.executedAt),
      recordType: record.recordType || "record",
      isRoll: record.recordType === "roll",
      rollLabel: record.rollOptionLabel || record.statisticKey || "",
      rollTotalLabel: Number.isFinite(Number(record.total)) ? `Total ${record.total}` : "No total",
      rollResultLabel: outcomeLabel,
      outcomeLabel,
      outcomeText,
      hasOutcomeText: record.recordType === "roll" && String(outcomeText ?? "").trim().length > 0,
      hasRollResult: Boolean(record.rollStatus || Number.isFinite(Number(record.total)) || outcomeLabel),
      hasNotes: String(record.notes ?? "").trim().length > 0
    };
  }).reverse();
  const latestRecords = history.slice(0, limit);

  return {
    records: latestRecords,
    hasRecords: latestRecords.length > 0,
    totalRecords: history.length,
    hiddenRecords: Math.max(history.length - latestRecords.length, 0)
  };
}

function prepareStationActionUiState(actor, stations = {}) {
  const groups = prepareStationActionGroups(actor, stations);
  const history = prepareStationActionHistoryReadout(actor);

  return {
    groups,
    hasGroups: groups.some((group) => group.hasActions),
    history,
    canClearHistory: history.totalRecords > 0
  };
}

function prepareActionEconomyReadout(actor, system = {}) {
  let economy = system.actionEconomy ?? {};
  try {
    if (actor) economy = getShipActionEconomy(actor);
  } catch (_error) {
    economy = system.actionEconomy ?? {};
  }

  const ap = numericDisplayValue(economy.ap);
  const maxAP = numericDisplayValue(economy.maxAP);
  const rap = numericDisplayValue(economy.rap);
  const maxRAP = numericDisplayValue(economy.maxRAP);

  return {
    ap,
    maxAP,
    rap,
    maxRAP,
    apLabel: `${ap}/${maxAP} AP`,
    rapLabel: `${rap}/${maxRAP} RAP`,
    lastReason: economy.lastReason ?? "",
    lastUpdatedAt: economy.lastUpdatedAt ?? 0
  };
}

function prepareInstallValidationReadout(system = {}) {
  const tier = system.tier ?? {};
  const refitPressure = system.refitPressure ?? {};
  const refitFlags = system.refitFlags ?? {};
  const refitStatus = tier.refitStatus || "native";
  const summary = prepareValidationSummary(refitStatus);

  return {
    tier: {
      baseTier: numericDisplayValue(tier.baseTier),
      currentTier: numericDisplayValue(tier.currentTier),
      refitStatus,
      refitStatusLabel: summary.label,
      majorRefitsCompleted: numericDisplayValue(tier.majorRefitsCompleted)
    },
    pressure: {
      total: numericDisplayValue(refitPressure.total),
      weaponPressure: numericDisplayValue(refitPressure.weaponPressure),
      enginePressure: numericDisplayValue(refitPressure.enginePressure),
      infrastructurePressure: numericDisplayValue(refitPressure.infrastructurePressure),
      lifeveilPressure: numericDisplayValue(refitPressure.lifeveilPressure),
      crewCommandPressure: numericDisplayValue(refitPressure.crewCommandPressure),
      occultPressure: numericDisplayValue(refitPressure.occultPressure)
    },
    flags: {
      qualifiesForMajorRefit: refitFlags.qualifiesForMajorRefit === true,
      qualifiesForMajorRefitLabel: prepareBooleanDisplay(refitFlags.qualifiesForMajorRefit),
      requiresDrydock: refitFlags.requiresDrydock === true,
      requiresDrydockLabel: prepareBooleanDisplay(refitFlags.requiresDrydock),
      requiresSpecialistLabor: refitFlags.requiresSpecialistLabor === true,
      requiresSpecialistLaborLabel: prepareBooleanDisplay(refitFlags.requiresSpecialistLabor),
      requiresRareMaterials: refitFlags.requiresRareMaterials === true,
      requiresRareMaterialsLabel: prepareBooleanDisplay(refitFlags.requiresRareMaterials)
    },
    summary
  };
}

function prepareArcflightShipViewData(arcflight, shipActor = null) {
  const system = foundry.utils.deepClone(arcflight.system ?? {});
  system.installed = system.installed ?? {};
  system.installed.hullDisplayName = displayNameForInstalledSingle(
    system.installed.hullName,
    system.base?.hull?.displayName || system.base?.hull?.platform
  );
  system.installed.arkengineDisplayName = displayNameForInstalledSingle(
    system.installed.arkengineName,
    system.base?.arkengine?.displayName || system.installed.arkengineKey
  );
  system.installed.hasHull = Boolean(system.installed.hullItemId || system.installed.hullUuid || system.installed.hullName);
  system.installed.hasArkengine = Boolean(system.installed.arkengineItemId || system.installed.arkengineUuid || system.installed.arkengineName);
  system.installed.hullPatternKey = system.installed.hullPattern?.key ?? "";
  system.installed.arkenginePatternKey = system.installed.arkenginePattern?.key ?? "";
  system.installed.hullPatternOptions = preparePatternOptions(
    getHullPatternKeys(),
    getHullPattern,
    system.installed.hullPatternKey
  );
  system.installed.arkenginePatternOptions = preparePatternOptions(
    getArkenginePatternKeys(),
    getArkenginePattern,
    system.installed.arkenginePatternKey
  );
  system.installed.arkengineMods = arrayOrEmpty(system.installed.arkengineMods).map(prepareInstalledEntry);
  system.installed.coreRooms = arrayOrEmpty(system.installed.coreRooms).map(prepareInstalledEntry);
  system.installed.rooms = arrayOrEmpty(system.installed.rooms).map(prepareInstalledEntry);
  system.installed.shipUpgrades = arrayOrEmpty(system.installed.shipUpgrades).map(prepareInstalledEntry);
  system.installed.weapons = arrayOrEmpty(system.installed.weapons).map(prepareInstalledWeaponEntry);
  system.installed.weaponGroups = prepareInstalledWeaponGroups(system.installed.weapons);
  system.installed.hasWeapons = system.installed.weapons.length > 0;
  system.installed.arkengineModSlots = prepareSlotState(system.installed.arkengineModSlots);
  system.installed.roomSlots = prepareSlotState(system.installed.roomSlots);
  system.installed.shipUpgradeSlots = prepareSlotState(system.installed.shipUpgradeSlots, 3);
  system.fuelingDisplay = prepareFuelingDisplay(system);
  system.actionEconomyReadout = prepareActionEconomyReadout(shipActor, system);
  system.installValidationReadout = prepareInstallValidationReadout(system);
  system.installStateReadout = prepareInstallStateReadout(shipActor);
  system.crew = system.crew ?? {};
  system.crew.namedCrew = arrayOrEmpty(system.crew.namedCrew).map(prepareCrewEntry);

  return {
    ...arcflight,
    system
  };
}

function isActorDocument(documentLike) {
  return documentLike?.documentName === "Actor"
    || documentLike?.constructor?.documentName === "Actor"
    || (typeof documentLike?.type === "string" && typeof documentLike?.getFlag === "function" && typeof documentLike?.update === "function");
}

function isArcflightShipEnabled(actor) {
  return actor?.type === "vehicle"
    && actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true;
}

function getSheetActor(sheet) {
  const candidates = [
    sheet?.document,
    sheet?.document?.actor,
    sheet?.actor,
    sheet?.object,
    sheet?.object?.actor
  ];

  return candidates.find(isActorDocument) ?? null;
}

function isArcflightShipActorType(actor) {
  return actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

async function normalizeArcflightShipActorType(actor) {
  if (isArcflightShipActorType(actor)) return true;
  if (typeof actor?.update !== "function") return false;

  try {
    const updatedActor = await actor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.actorType`]: ARCFLIGHT_SHIP_ACTOR_TYPE });
    return isArcflightShipActorType(updatedActor) || isArcflightShipActorType(actor);
  } catch (error) {
    ui.notifications?.warn?.("Arcflight could not normalize this ship's actor type flag. Ship action helpers may reject it.");
    console.warn("Arcflight | Failed to normalize Arcflight ship actor type flag.", { actor, error });
    return false;
  }
}

async function ensureArcflightShipActor(actor) {
  if (actor?.type !== "vehicle") {
    ui.notifications?.warn?.("Arcflight ship actions require a PF2E vehicle actor.");
    return null;
  }

  if (actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") !== true) {
    ui.notifications?.warn?.("Arcflight ship actions require an Arcflight-enabled PF2E vehicle actor.");
    return null;
  }

  const normalized = await normalizeArcflightShipActorType(actor);
  if (!normalized) {
    ui.notifications?.warn?.("Arcflight ship actions require a normalized Arcflight ship actor type flag.");
    return null;
  }

  return actor;
}

async function getMutatingSheetShipActor(sheet) {
  return ensureArcflightShipActor(getSheetActor(sheet));
}

async function confirmClearShipBuild(actor) {
  const actorName = actor?.name ?? "this ship";
  const escapedActorName = foundry.utils.escapeHTML(actorName);
  const title = "Clear Arcflight Ship Build";
  const content = `<p>Clear the Arcflight ship build for <strong>${escapedActorName}</strong>?</p><p>This removes installed build references from the actor but does not delete source items, compendium items, or the actor.</p>`;
  const dialogV2 = foundry.applications.api.DialogV2;

  if (typeof dialogV2?.confirm === "function") {
    return await dialogV2.confirm({
      window: { title },
      content,
      rejectClose: false
    });
  }

  if (typeof globalThis.Dialog?.confirm === "function") {
    return await globalThis.Dialog.confirm({
      title,
      content,
      defaultYes: false
    });
  }

  return globalThis.confirm?.(`Clear the Arcflight ship build for ${actorName}?`) === true;
}

async function enableArcflightShip(actor) {
  return actor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.enabled`]: true,
    [`flags.${ARCFLIGHT_MODULE_ID}.actorType`]: ARCFLIGHT_SHIP_ACTOR_TYPE,
    [`flags.${ARCFLIGHT_MODULE_ID}.system`]: getArcflightShipData(actor)
  });
}

async function ensureArcflightShipEnabled(actor) {
  if (actor?.type !== "vehicle") {
    ui.notifications?.warn?.("Arcflight ships must be PF2E vehicle actors.");
    return null;
  }

  if (isArcflightShipEnabled(actor)) {
    await normalizeArcflightShipActorType(actor);
    return actor;
  }

  return await enableArcflightShip(actor) ?? actor;
}

async function getDroppedItem(event) {
  const dragData = globalThis.TextEditor?.getDragEventData?.(event) ?? {};
  const uuid = dragData.uuid || dragData.itemUuid;
  if (uuid) {
    const document = await globalThis.fromUuid?.(uuid);
    return document?.documentName === "Item" ? document : null;
  }

  if (dragData.type !== "Item") return null;
  if (dragData.pack && dragData.id) {
    return await game.packs?.get(dragData.pack)?.getDocument?.(dragData.id) ?? null;
  }

  return game.items?.get?.(dragData.id) ?? null;
}

const dropInstallers = Object.freeze({
  [ARCFLIGHT_ITEM_TYPES.HULL]: installHull,
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE]: installArkengine,
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: installArkengineMod,
  [ARCFLIGHT_ITEM_TYPES.ROOM]: installRoom,
  [ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE]: installShipUpgrade,
  [ARCFLIGHT_ITEM_TYPES.CREW_ASSET]: addCrewAsset
});

const componentRemovers = Object.freeze({
  [ARCFLIGHT_ITEM_TYPES.WEAPON]: removeInstalledWeapon,
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: removeInstalledArkengineMod,
  [ARCFLIGHT_ITEM_TYPES.ROOM]: removeInstalledRoom,
  [ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE]: removeInstalledShipUpgrade,
  [ARCFLIGHT_ITEM_TYPES.CREW_ASSET]: removeCrewAsset
});

function getWorldActorCollectionEntries() {
  const actors = game?.actors;
  if (!actors) return [];
  if (Array.isArray(actors)) return actors;
  if (Array.isArray(actors.contents)) return actors.contents;
  if (typeof actors.values === "function") return Array.from(actors.values());

  const entries = [];
  if (typeof actors.forEach === "function") actors.forEach((actor) => entries.push(actor));
  return entries;
}

function isStationAssignableActor(actor) {
  return isActorDocument(actor) && actor?.type === "character";
}

function prepareStationActorOptions(selectedActorId = "") {
  return getWorldActorCollectionEntries()
    .filter(isStationAssignableActor)
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")))
    .map((actor) => ({
      id: actor.id ?? "",
      uuid: actor.uuid ?? "",
      name: actor.name ?? "Unnamed Actor",
      selected: actor.id === selectedActorId
    }));
}

function getAssignmentActorId(assignment = null) {
  return assignment?.assigneeType === "actor" ? assignment.actorId ?? "" : "";
}

function prepareStationRows(stations = {}, selectedStationActorIds = {}) {
  return Object.values(stations.definitions ?? {}).map((station) => {
    const assignment = stations.assignments?.[station.key] ?? null;
    const selectedActorId = selectedStationActorIds[station.key] ?? getAssignmentActorId(assignment);
    const actorOptions = prepareStationActorOptions(selectedActorId);
    const selectedActorOption = actorOptions.find((option) => option.selected) ?? null;

    return {
      ...station,
      assignment,
      assigneeName: assignment?.name || "Unassigned",
      actorOptions,
      selectedActorId: selectedActorOption?.id ?? "",
      canAssign: Boolean(selectedActorOption),
      hasAssignment: Boolean(assignment)
    };
  });
}


function installRecordMatchesRemoveRequest(record = {}, componentType = "", componentId = "") {
  if (record.active !== true || record.componentType !== componentType) return false;
  const identifiers = [record.itemUuid, record.itemId, record.componentKey, record.hullSlot, record.roomSlot].filter(Boolean);
  return identifiers.includes(componentId);
}

function hasActiveInstallRecordForRemoval(actor, componentType = "", componentId = "") {
  if (!componentId) return false;
  return getInstallState(actor).installs.some((record) => installRecordMatchesRemoveRequest(record, componentType, componentId));
}

/** Lightweight ApplicationV2 sheet foundation for Arcflight PF2E vehicle actors. */
export class ArcflightShipSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  #activeTab = "overview";
  #pendingScrollRestore = null;
  #selectedExampleBuildKey = "";
  #selectedInstallComponentType = ARCFLIGHT_ITEM_TYPES.HULL;
  #selectedInstallItemId = "";
  #selectedWeaponMountValue = "";
  #selectedStationActorIds = {};

  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "sheet", "actor", "ship", "vehicle"],
    tag: "form",
    position: {
      width: 560,
      height: 640
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    sheet: {
      template: arcflightTemplatePath("actors/ship-sheet.hbs")
    }
  };

  #getScrollableBody() {
    const sheetRoot = this.element ?? null;

    return sheetRoot?.querySelector?.(".arcflight-sheet__body")
      ?? sheetRoot?.querySelector?.("[data-arcflight-sheet-scroll]")
      ?? null;
  }

  #getCurrentActiveTab() {
    return normalizeShipSheetTab(
      this.element?.querySelector?.("[data-arcflight-ship-tab].active")?.dataset?.arcflightShipTab
      ?? this.element?.querySelector?.("[data-arcflight-ship-tab][aria-selected='true']")?.dataset?.arcflightShipTab
      ?? this.element?.querySelector?.("[data-arcflight-ship-tab-panel]:not([hidden])")?.dataset?.arcflightShipTabPanel
      ?? this.#activeTab
    );
  }

  #captureCurrentSheetContext() {
    const scrollableBody = this.#getScrollableBody();

    return {
      activeTab: this.#getCurrentActiveTab(),
      bodyScrollTop: Number.isFinite(scrollableBody?.scrollTop) ? scrollableBody.scrollTop : null,
      bodyScrollLeft: Number.isFinite(scrollableBody?.scrollLeft) ? scrollableBody.scrollLeft : null
    };
  }

  #queueSheetContextRestore(state) {
    if (!state) return;

    const pending = this.#pendingScrollRestore;
    const bodyScrollTop = pending?.bodyScrollTop > 0 && (state.bodyScrollTop ?? 0) === 0
      ? pending.bodyScrollTop
      : state.bodyScrollTop;
    const bodyScrollLeft = pending?.bodyScrollLeft > 0 && (state.bodyScrollLeft ?? 0) === 0
      ? pending.bodyScrollLeft
      : state.bodyScrollLeft;

    this.#activeTab = normalizeShipSheetTab(state.activeTab);
    this.#pendingScrollRestore = {
      activeTab: this.#activeTab,
      bodyScrollTop,
      bodyScrollLeft
    };
  }

  #queueCurrentSheetContextRestore() {
    const state = this.#captureCurrentSheetContext();
    this.#queueSheetContextRestore(state);
    return state;
  }

  async #afterRenderFrame() {
    const waitForFrame = () => new Promise((resolve) => {
      if (typeof globalThis.requestAnimationFrame === "function") {
        globalThis.requestAnimationFrame(() => resolve());
      } else if (typeof globalThis.setTimeout === "function") {
        globalThis.setTimeout(resolve, 0);
      } else {
        resolve();
      }
    });

    await waitForFrame();
    await waitForFrame();
  }

  async #restoreSheetContext(state) {
    if (!state) return;

    this.#setActiveTab(state.activeTab);
    await this.#afterRenderFrame();

    const scrollableBody = this.#getScrollableBody();
    if (!scrollableBody) return;
    if (state.bodyScrollTop !== null) scrollableBody.scrollTop = state.bodyScrollTop;
    if (state.bodyScrollLeft !== null) scrollableBody.scrollLeft = state.bodyScrollLeft;
  }

  async #restorePendingSheetContext() {
    const state = this.#pendingScrollRestore;
    if (!state) return;

    try {
      await this.#restoreSheetContext(state);
    } finally {
      this.#pendingScrollRestore = null;
    }
  }

  async #renderPreservingScroll(force = true) {
    this.#queueCurrentSheetContextRestore();
    await this.render(force);
  }

  #setActiveTab(tabId = "", { resetScroll = false } = {}) {
    this.#activeTab = normalizeShipSheetTab(tabId);

    this.element
      ?.querySelectorAll?.("[data-arcflight-ship-tab]")
      ?.forEach((button) => {
        const active = button.dataset?.arcflightShipTab === this.#activeTab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });

    this.element
      ?.querySelectorAll?.("[data-arcflight-ship-tab-panel]")
      ?.forEach((panel) => {
        const active = panel.dataset?.arcflightShipTabPanel === this.#activeTab;
        panel.hidden = !active;
      });

    if (resetScroll) {
      const scrollableBody = this.#getScrollableBody();
      if (scrollableBody) scrollableBody.scrollTop = 0;
    }
  }

  #onClickTab(event) {
    event.preventDefault();
    this.#setActiveTab(event.currentTarget?.dataset?.arcflightShipTab, { resetScroll: true });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    this.element
      .querySelectorAll?.("[data-arcflight-ship-tab]")
      ?.forEach((button) => button.addEventListener("click", this.#onClickTab.bind(this)));

    this.#setActiveTab(this.#activeTab);

    this.element
      .querySelector?.("[data-arcflight-enable-ship]")
      ?.addEventListener("click", this.#onEnableArcflightShip.bind(this));

    const builder = this.element.querySelector?.("[data-arcflight-ship-builder]");
    builder?.addEventListener("dragover", this.#onDragOverShipBuilder.bind(this));
    builder?.addEventListener("drop", this.#onDropShipBuilder.bind(this));

    this.element
      .querySelector?.("[data-arcflight-hull-pattern]")
      ?.addEventListener("change", this.#onChangeHullPattern.bind(this));

    this.element
      .querySelector?.("[data-arcflight-arkengine-pattern]")
      ?.addEventListener("change", this.#onChangeArkenginePattern.bind(this));

    this.element
      .querySelector?.("[data-arcflight-example-build]")
      ?.addEventListener("change", this.#onChangeExampleBuild.bind(this));

    this.element
      .querySelector?.("[data-arcflight-apply-clean-build]")
      ?.addEventListener("click", this.#onApplyCleanExampleBuild.bind(this));

    this.element
      .querySelector?.("[data-arcflight-clear-build]")
      ?.addEventListener("click", this.#onClearBuild.bind(this));

    this.element
      .querySelector?.("[data-arcflight-install-component-type]")
      ?.addEventListener("change", this.#onChangeInstallComponentType.bind(this));

    this.element
      .querySelector?.("[data-arcflight-install-item]")
      ?.addEventListener("change", this.#onChangeInstallItem.bind(this));

    this.element
      .querySelector?.("[data-arcflight-install-weapon-mount]")
      ?.addEventListener("change", this.#onChangeInstallWeaponMount.bind(this));

    this.element
      .querySelector?.("[data-arcflight-install-component]")
      ?.addEventListener("click", this.#onInstallSelectedComponent.bind(this));

    this.element
      .querySelector?.("[data-arcflight-reset-action-economy]")
      ?.addEventListener("click", this.#onResetActionEconomy.bind(this));

    this.element
      .querySelectorAll?.("[data-arcflight-remove-component]")
      ?.forEach((button) => button.addEventListener("click", this.#onRemoveInstalledComponent.bind(this)));

    this.element
      .querySelectorAll?.("[data-arcflight-station-actor-select]")
      ?.forEach((select) => select.addEventListener("change", this.#onChangeStationActor.bind(this)));

    this.element
      .querySelectorAll?.("[data-arcflight-assign-station]")
      ?.forEach((button) => button.addEventListener("click", this.#onAssignStation.bind(this)));

    this.element
      .querySelectorAll?.("[data-arcflight-clear-station]")
      ?.forEach((button) => button.addEventListener("click", this.#onClearStation.bind(this)));

    this.element
      .querySelectorAll?.("[data-arcflight-execute-station-action]")
      ?.forEach((button) => button.addEventListener("click", this.#onExecuteStationAction.bind(this)));

    this.element
      .querySelectorAll?.("[data-arcflight-roll-station-action]")
      ?.forEach((button) => button.addEventListener("click", this.#onRollStationAction.bind(this)));

    this.element
      .querySelector?.("[data-arcflight-clear-station-action-history]")
      ?.addEventListener("click", this.#onClearStationActionHistory.bind(this));

  }

  /** @override */
  async _postRender(context, options) {
    if (typeof super._postRender === "function") await super._postRender(context, options);
    await this.#restorePendingSheetContext();
  }

  #onChangeStationActor(event) {
    const stationKey = event.currentTarget?.dataset?.stationKey ?? "";
    if (!stationKey) return;

    this.#selectedStationActorIds[stationKey] = event.currentTarget?.value ?? "";

    const stationElement = event.currentTarget?.closest?.("[data-arcflight-station-row]");
    const assignButton = stationElement?.querySelector?.("[data-arcflight-assign-station]");
    if (assignButton) assignButton.disabled = !this.#selectedStationActorIds[stationKey];
  }

  async #onAssignStation(event) {
    event.preventDefault();

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    const stationKey = event.currentTarget?.dataset?.stationKey ?? "";
    const stationElement = event.currentTarget?.closest?.("[data-arcflight-station-row]");
    const select = stationElement?.querySelector?.("[data-arcflight-station-actor-select]");
    const actorId = select?.value ?? this.#selectedStationActorIds[stationKey] ?? "";
    const assignee = game?.actors?.get?.(actorId);

    if (!stationKey || !isStationAssignableActor(assignee)) {
      ui.notifications?.warn?.("Select a PF2E character actor before assigning this station.");
      return;
    }

    this.#selectedStationActorIds[stationKey] = actorId;
    this.#queueCurrentSheetContextRestore();

    try {
      await assignStation(actor, stationKey, { id: assignee.id, uuid: assignee.uuid, name: assignee.name }, { assigneeType: "actor" });
      ui.notifications?.info?.(`Assigned ${assignee.name ?? "actor"} to ${humanizeIdentifier(stationKey)}.`);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not assign that station.");
      console.warn("Arcflight | Station assignment failed.", error);
    }
  }

  async #onClearStation(event) {
    event.preventDefault();

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    const stationKey = event.currentTarget?.dataset?.stationKey ?? "";
    if (!stationKey) {
      ui.notifications?.warn?.("Arcflight station key was missing.");
      return;
    }

    this.#selectedStationActorIds[stationKey] = "";
    this.#queueCurrentSheetContextRestore();

    try {
      await clearStationAssignment(actor, stationKey);
      ui.notifications?.info?.(`Cleared ${humanizeIdentifier(stationKey)} assignment.`);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not clear that station assignment.");
      console.warn("Arcflight | Station assignment clear failed.", error);
    }
  }

  async #onResetActionEconomy(event) {
    event.preventDefault();

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    this.#queueCurrentSheetContextRestore();

    try {
      const economy = await resetShipActionEconomy(actor);
      ui.notifications?.info?.(`Reset AP/RAP to ${economy.ap}/${economy.maxAP} AP and ${economy.rap}/${economy.maxRAP} RAP.`);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not reset AP/RAP.");
      console.warn("Arcflight | AP/RAP reset failed.", error);
    }
  }

  async #onExecuteStationAction(event) {
    event.preventDefault();

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    const button = event.currentTarget;
    const actionKey = button?.dataset?.actionKey ?? "";
    const phase = button?.dataset?.phase ?? "both";
    const preview = previewStationAction(actor, actionKey, { phase });

    if (preview.blocked === true || preview.severity === "danger") {
      ui.notifications?.warn?.(`Arcflight blocked this station action: ${[...prepareTextArray(preview.messages), ...prepareTextArray(preview.warnings)].join(" ") || "preview did not allow it."}`);
      return;
    }

    this.#queueCurrentSheetContextRestore();

    try {
      await executeStationAction(actor, actionKey, { phase });
      ui.notifications?.info?.(`Recorded ${preview.actionName || "station action"}.`);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not record that station action.");
      console.warn("Arcflight | Station action execute failed.", error);
    }
  }


  async #onRollStationAction(event) {
    event.preventDefault();

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    const button = event.currentTarget;
    const actionElement = button?.closest?.("[data-station-action-key]");
    const actionKey = button?.dataset?.actionKey ?? actionElement?.dataset?.stationActionKey ?? "";
    const phase = button?.dataset?.phase ?? "both";
    const rollOptionKey = actionElement?.querySelector?.("[data-arcflight-station-action-roll-option]")?.value ?? "";

    this.#queueCurrentSheetContextRestore();

    try {
      const record = await rollStationAction(actor, actionKey, { phase, rollOptionKey, event });
      ui.notifications?.info?.(`Recorded ${record.rollOptionLabel || "station action"} roll for ${record.actionName || actionKey}.`);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not roll that station action.");
      console.warn("Arcflight | Station action roll failed.", error);
    }
  }

  async #onClearStationActionHistory(event) {
    event.preventDefault();

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    this.#queueCurrentSheetContextRestore();

    try {
      await clearStationActionHistory(actor);
      ui.notifications?.info?.("Arcflight station action history cleared.");
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not clear station action history.");
      console.warn("Arcflight | Station action history clear failed.", error);
    }
  }


  async #onRemoveInstalledComponent(event) {
    event.preventDefault();

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    const button = event.currentTarget;
    const componentType = button?.dataset?.componentType ?? "";
    const componentId = button?.dataset?.componentId ?? "";
    const componentName = button?.dataset?.componentName || "Arcflight component";
    const remove = componentRemovers[componentType];

    if (typeof remove !== "function" || !componentId) {
      ui.notifications?.warn?.("Arcflight remove helper is not available for that installed component.");
      return;
    }

    const hadLifecycleRecord = hasActiveInstallRecordForRemoval(actor, componentType, componentId);
    this.#queueCurrentSheetContextRestore();

    try {
      await remove(actor, componentId);
      if (hadLifecycleRecord) {
        ui.notifications?.info?.(`Removed ${componentName}.`);
      } else {
        ui.notifications?.warn?.(`Removed ${componentName}, but no matching active install lifecycle record was found.`);
      }
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not remove that component from this ship.");
      console.warn("Arcflight | Controlled component removal failed.", error);
    }
  }

  async #onChangeInstallComponentType(event) {
    this.#selectedInstallComponentType = normalizeInstallComponentType(event.currentTarget?.value);
    this.#selectedInstallItemId = "";
    this.#selectedWeaponMountValue = "";
    await this.#renderPreservingScroll(false);
  }

  async #onChangeInstallItem(event) {
    this.#selectedInstallItemId = event.currentTarget?.value ?? "";
    await this.#renderPreservingScroll(false);
  }

  async #onChangeInstallWeaponMount(event) {
    this.#selectedWeaponMountValue = event.currentTarget?.value ?? "";
    await this.#renderPreservingScroll(false);
  }

  async #onInstallSelectedComponent(event) {
    event.preventDefault();

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    const componentType = normalizeInstallComponentType(this.#selectedInstallComponentType);
    const item = game?.items?.get?.(this.#selectedInstallItemId);
    const isWeaponInstall = componentType === ARCFLIGHT_ITEM_TYPES.WEAPON;
    const weaponMountOptions = isWeaponInstall
      ? prepareWeaponMountOptions(getArcflightShipData(actor), this.#selectedWeaponMountValue)
      : [];
    const selectedWeaponMountOption = isWeaponInstall
      ? getSelectedWeaponMountOption(weaponMountOptions, this.#selectedWeaponMountValue)
      : null;
    const installOptions = getWeaponInstallOptions(selectedWeaponMountOption);
    const install = isWeaponInstall ? installWeapon : dropInstallers[componentType];

    if (!item || getComponentType(item) !== componentType) {
      ui.notifications?.warn?.("Select a matching Arcflight world item before installing.");
      return;
    }

    if (isWeaponInstall && !selectedWeaponMountOption) {
      ui.notifications?.warn?.("Select an available hull weapon mount before installing a weapon.");
      return;
    }

    const preview = prepareInstallPreviewReadout(actor, item, componentType, installOptions);
    if (preview?.blocked === true) {
      ui.notifications?.warn?.(`Arcflight blocked this install: ${preview.blockedReason || "validation rules did not allow it."}`);
      return;
    }

    if (typeof install !== "function") {
      ui.notifications?.warn?.("Arcflight install helper is not available for this component type.");
      return;
    }

    this.#queueCurrentSheetContextRestore();

    try {
      const installStateBefore = JSON.stringify(getInstallState(actor));
      const installResult = await install(actor, item, installOptions);
      const installStateAfter = JSON.stringify(getInstallState(actor));

      if (installResult === actor && installStateAfter === installStateBefore) {
        ui.notifications?.warn?.(`Install skipped: ${item.name ?? "Arcflight component"} appears to already be installed on this ship.`);
        return;
      }

      this.#selectedInstallItemId = "";
      if (isWeaponInstall) this.#selectedWeaponMountValue = "";
      ui.notifications?.info?.(`Installed ${item.name ?? "Arcflight component"}.`);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not install that component on this ship.");
      console.warn("Arcflight | Controlled component install failed.", error);
    }
  }

  #onChangeExampleBuild(event) {
    this.#selectedExampleBuildKey = event.currentTarget?.value ?? "";
    const selectedOption = event.currentTarget?.selectedOptions?.[0];
    const details = this.element.querySelector?.("[data-arcflight-example-build-details]");
    if (!details) return;

    const name = selectedOption?.dataset?.name ?? "";
    const role = selectedOption?.dataset?.role ?? "";
    const description = selectedOption?.dataset?.description ?? "";
    details.hidden = !this.#selectedExampleBuildKey;
    details.querySelector?.("[data-arcflight-example-build-name]")?.replaceChildren(name);
    details.querySelector?.("[data-arcflight-example-build-role]")?.replaceChildren(role);
    details.querySelector?.("[data-arcflight-example-build-description]")?.replaceChildren(description);
  }

  async #onApplyCleanExampleBuild(event) {
    event.preventDefault();

    const selectedBuildKey = this.element.querySelector?.("[data-arcflight-example-build]")?.value
      ?? this.#selectedExampleBuildKey;
    if (!selectedBuildKey) {
      ui.notifications?.warn?.("Select an Arcflight example build before applying a clean build.");
      return;
    }

    const applyCleanExampleShipBuild = game?.arcflight?.applyCleanExampleShipBuild;
    if (typeof applyCleanExampleShipBuild !== "function") {
      ui.notifications?.warn?.("Arcflight example ship build helpers are not available.");
      return;
    }

    try {
      const actor = await getMutatingSheetShipActor(this);
      if (!actor) return;

      this.#queueCurrentSheetContextRestore();

      await game.arcflight.applyCleanExampleShipBuild(actor, selectedBuildKey);
      this.#selectedExampleBuildKey = selectedBuildKey;
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not apply that example ship build.");
      console.warn("Arcflight | Example ship build apply failed.", error);
    }
  }

  async #onClearBuild(event) {
    event.preventDefault();

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    const clearShipBuild = game?.arcflight?.clearShipBuild;
    if (typeof clearShipBuild !== "function") {
      ui.notifications?.warn?.("Arcflight clear build helper is not available.");
      return;
    }

    const confirmed = await confirmClearShipBuild(actor);
    if (!confirmed) return;

    this.#queueCurrentSheetContextRestore();

    try {
      await clearShipBuild(actor);
      this.#selectedExampleBuildKey = "";
      ui.notifications?.info?.("Arcflight ship build cleared.");
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not clear this ship build.");
      console.warn("Arcflight | Ship build clear failed.", error);
    }
  }

  async #onChangeHullPattern(event) {
    event.preventDefault();

    const patternKey = event.currentTarget?.value ?? "";
    if (!patternKey) return;

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    this.#queueCurrentSheetContextRestore();

    try {
      await setHullPattern(actor, patternKey);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not set that hull pattern.");
      console.warn("Arcflight | Hull pattern selection failed.", error);
    }
  }

  async #onChangeArkenginePattern(event) {
    event.preventDefault();

    const patternKey = event.currentTarget?.value ?? "";
    if (!patternKey) return;

    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    this.#queueCurrentSheetContextRestore();

    try {
      await setArkenginePattern(actor, patternKey);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not set that arkengine pattern.");
      console.warn("Arcflight | Arkengine pattern selection failed.", error);
    }
  }

  #onDragOverShipBuilder(event) {
    if (!isArcflightShipEnabled(getSheetActor(this))) return;

    event.preventDefault();
    event.stopPropagation();
  }

  async #onDropShipBuilder(event) {
    const actor = await getMutatingSheetShipActor(this);
    if (!actor) return;

    event.preventDefault();
    event.stopPropagation();
    const item = await getDroppedItem(event);
    const componentType = getComponentType(item);
    const install = dropInstallers[componentType];

    if (!install) {
      ui.notifications?.warn?.("Drop an Arcflight Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, or Crew Asset component onto this ship builder. Use the controlled Install Component UI for weapon mount installs.");
      return;
    }

    this.#queueCurrentSheetContextRestore();

    try {
      await install(actor, item);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not install that component on this ship.");
      console.warn("Arcflight | Ship builder drop install failed.", error);
    }
  }

  async #onEnableArcflightShip(event) {
    event.preventDefault();

    this.#queueCurrentSheetContextRestore();

    const actor = await ensureArcflightShipEnabled(getSheetActor(this));
    if (!actor) return;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = getSheetActor(this);
    const arcflight = prepareArcflightShipViewData(prepareArcflightShipFlags(actor), actor);
    const installUi = prepareInstallUiState(actor, this.#selectedInstallComponentType, this.#selectedInstallItemId, this.#selectedWeaponMountValue);
    this.#selectedInstallComponentType = installUi.selectedComponentType;
    this.#selectedInstallItemId = installUi.selectedItemId;
    this.#selectedWeaponMountValue = installUi.selectedWeaponMountValue;

    const stations = prepareStationRows(arcflight.system.stations, this.#selectedStationActorIds);
    const stationActionUi = prepareStationActionUiState(actor, arcflight.system.stations);
    const exampleBuildOptions = prepareExampleBuildOptions(this.#selectedExampleBuildKey);
    const selectedExampleBuild = exampleBuildOptions.find((build) => build.selected) ?? null;

    return {
      ...context,
      actor,
      arcflight,
      installUi,
      stations,
      stationActionUi,
      exampleBuildOptions,
      selectedExampleBuild,
      shipTabs: prepareShipSheetTabs(this.#activeTab),
      tabState: prepareShipSheetTabState(this.#activeTab),
      activeTab: normalizeShipSheetTab(this.#activeTab),
      arcflightActorType: ARCFLIGHT_SHIP_ACTOR_TYPE,
      arcflightSystemPath: `flags.${ARCFLIGHT_MODULE_ID}.system`
    };
  }
}

export { ArcflightShipSheet as ShipSheet, prepareArcflightShipViewData, prepareInstallStateReadout, prepareInstallUiState, prepareInstallValidationReadout, prepareStationActionHistoryReadout, prepareStationActionUiState, prepareStationRows };
