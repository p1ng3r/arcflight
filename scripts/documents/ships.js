import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getComponentData, getComponentRefitPressure, getComponentTierMetadata, getComponentType } from "./components.js";
import { getLockedCoreRoom, getLockedCoreRoomKeys } from "../../data/rooms/core-rooms.js";
import { getHullPattern } from "../../data/hulls/hull-patterns.js";
import { getArkenginePattern } from "../../data/arkengines/arkengine-patterns.js";
import { CORE_STATIONS, STATION_KEYS, getStation } from "../../data/stations/core-stations.js";

export const ARCFLIGHT_SHIP_ACTOR_TYPE = "arcflightShip";

const emptyInstalledState = Object.freeze({
  hullItemId: "",
  hullUuid: "",
  hullPlatform: "",
  hullName: "",
  hullPattern: Object.freeze({}),
  arkengineItemId: "",
  arkengineUuid: "",
  arkengineKey: "",
  arkengineName: "",
  arkenginePattern: Object.freeze({}),
  arkengineMods: Object.freeze([]),
  arkengineModSlots: Object.freeze({
    capacity: 0,
    used: 0,
    available: 0
  }),
  coreRooms: Object.freeze([]),
  rooms: Object.freeze([]),
  roomSlots: Object.freeze({
    capacity: 0,
    used: 0,
    available: 0
  }),
  shipUpgrades: Object.freeze([]),
  shipUpgradeSlots: Object.freeze({
    capacity: 3,
    used: 0,
    available: 3
  })
});

const emptyCurrentShipState = Object.freeze({
  hull: 0,
  lifeveil: 0,
  strain: 0,
  morale: 0,
  storedSpellRanks: 0
});

const REFIT_PRESSURE_KEYS = Object.freeze([
  "weaponPressure",
  "enginePressure",
  "infrastructurePressure",
  "lifeveilPressure",
  "crewCommandPressure",
  "occultPressure"
]);

const REFIT_STATUSES = Object.freeze({
  NATIVE: "native",
  PRESSURED: "pressured",
  MAJOR_REFIT_REQUIRED: "major-refit-required",
  REFIT_COMPLETE: "refit-complete"
});

const emptyTierState = Object.freeze({
  baseTier: 0,
  currentTier: 0,
  refitStatus: REFIT_STATUSES.NATIVE,
  majorRefitsCompleted: 0
});

const emptyRefitPressureState = Object.freeze({
  weaponPressure: 0,
  enginePressure: 0,
  infrastructurePressure: 0,
  lifeveilPressure: 0,
  crewCommandPressure: 0,
  occultPressure: 0,
  total: 0
});

const emptyRefitFlagsState = Object.freeze({
  qualifiesForMajorRefit: false,
  requiresDrydock: false,
  requiresSpecialistLabor: false,
  requiresRareMaterials: false
});

const emptyInstallState = Object.freeze({
  version: 1,
  installs: Object.freeze([])
});

const emptyCrewState = Object.freeze({
  minimum: 0,
  recommended: 0,
  maximum: 0,
  current: 0,
  currentGenericCrew: 0,
  namedCrew: Object.freeze([]),
  roster: "",
  notes: ""
});

const emptyBaseShipState = Object.freeze({
  hull: Object.freeze({}),
  arkengine: Object.freeze({}),
  coreRooms: Object.freeze([])
});

const emptyDerivedShipState = Object.freeze({
  hullIntegrity: 0,
  armorClass: 0,
  physicalResistances: Object.freeze({
    bludgeoning: 0,
    piercing: 0,
    slashing: 0
  }),
  strainCapacity: 0,
  lifeveilCapacity: 0,
  cargoCapacity: 0,
  detection: 0,
  combatSpeed: 0,
  maneuverability: 0,
  baseAP: 0,
  baseRAP: 0,
  crew: Object.freeze({
    minimum: 0,
    recommended: 0,
    maximum: 0
  }),
  rooms: Object.freeze({
    coreRooms: Object.freeze([]),
    expansionSlots: 0
  }),
  weaponMounts: Object.freeze({}),
  arkengineCompatibility: Object.freeze({
    preferred: "",
    allowed: Object.freeze([])
  }),
  traits: Object.freeze([]),
  role: "",
  designNotes: "",
  voyageSpeedTravelHexDays: 0,
  resistanceTendencies: Object.freeze([]),
  energyResistances: Object.freeze([]),
  arkengineVariantFamily: "",
  arkengineModSlots: 0,
  arkengineModSlotsUsed: 0,
  arkengineModSlotsAvailable: 0,
  hardBurnStrainCost: 0,
  overchargeRisk: "",
  spellRankRequired: 0,
  arkengineLifeveilModifier: 0,
  arkengineStrainModifier: 0,
  requiredSpellRank: 0,
  fuelSlots: 0,
  maxStoredSpellRanks: 0,
  normalHexCost: 0,
  hardBurnHexCost: 0,
  leanBurnHexCost: 0,
  stealthBurnHexCost: 0
});

export const arcflightShipDefaults = Object.freeze({
  identity: Object.freeze({
    vesselClass: "",
    registry: "",
    callsign: "",
    owner: "",
    origin: ""
  }),
  installed: emptyInstalledState,
  installState: emptyInstallState,
  base: emptyBaseShipState,
  derived: emptyDerivedShipState,
  current: emptyCurrentShipState,
  tier: emptyTierState,
  refitPressure: emptyRefitPressureState,
  refitFlags: emptyRefitFlagsState,
  installedSystems: Object.freeze({
    hull: "",
    arkengine: "",
    weapons: "",
    arkengineMods: "",
    rooms: "",
    cargo: "",
    crewAssets: "",
    shipUpgrades: "",
    notes: ""
  }),
  resources: Object.freeze({
    hull: Object.freeze({
      value: 0,
      max: 0
    }),
    lifeveil: Object.freeze({
      value: 0,
      max: 0
    }),
    strain: Object.freeze({
      value: 0,
      max: 0
    }),
    supplies: 0,
    morale: 0,
    notes: ""
  }),
  derivedStats: Object.freeze({
    speed: 0,
    handling: 0,
    crewCapacity: 0,
    cargoCapacity: 0,
    weaponMounts: 0,
    roomSlots: 0,
    notes: ""
  }),
  crew: emptyCrewState,
  cargo: Object.freeze({
    capacity: 0,
    used: 0,
    manifest: "",
    notes: ""
  }),
  stations: Object.freeze({
    definitions: CORE_STATIONS,
    assignments: Object.freeze(Object.fromEntries(STATION_KEYS.map((stationKey) => [stationKey, null])))
  }),
  conditions: Object.freeze({
    active: "",
    damage: "",
    notes: ""
  }),
  state: Object.freeze({
    active: false,
    docked: false,
    disabled: false,
    location: "",
    status: "",
    notes: ""
  }),
  history: Object.freeze({
    commissioned: "",
    notableEvents: "",
    previousOwners: "",
    notes: ""
  }),
  notes: ""
});

function cloneData(data) {
  return foundry.utils.deepClone(data);
}

function buildEmptyInstalledState(overrides = {}) {
  return foundry.utils.mergeObject(cloneData(emptyInstalledState), cloneData(overrides), { inplace: false });
}

function buildEmptyBaseShipState(overrides = {}) {
  return foundry.utils.mergeObject(cloneData(emptyBaseShipState), cloneData(overrides), { inplace: false });
}

function buildEmptyInstalledSystemsState(overrides = {}) {
  return foundry.utils.mergeObject(cloneData(arcflightShipDefaults.installedSystems), cloneData(overrides), { inplace: false });
}

function buildEmptyResourcesState(overrides = {}) {
  return foundry.utils.mergeObject(cloneData(arcflightShipDefaults.resources), cloneData(overrides), { inplace: false });
}

function getDefaultStationAssignments() {
  return Object.fromEntries(STATION_KEYS.map((stationKey) => [stationKey, null]));
}

function normalizeStationAssignment(stationKey, assignment) {
  if (!assignment || assignment.assigneeType === "none") return null;

  return {
    stationKey,
    assigneeType: assignment.assigneeType ?? "actor",
    actorId: assignment.actorId ?? "",
    actorUuid: assignment.actorUuid ?? "",
    crewAssetId: assignment.crewAssetId ?? "",
    crewAssetUuid: assignment.crewAssetUuid ?? "",
    name: assignment.name ?? "",
    notes: assignment.notes ?? ""
  };
}

export function getDefaultStationState(existingStations = {}) {
  const existingAssignments = existingStations.assignments ?? {};
  const assignments = getDefaultStationAssignments();

  for (const stationKey of STATION_KEYS) {
    assignments[stationKey] = normalizeStationAssignment(stationKey, existingAssignments[stationKey]);
  }

  return {
    definitions: cloneData(CORE_STATIONS),
    assignments
  };
}

function getDefaultCrewState(existingCrew = {}) {
  const crew = foundry.utils.mergeObject(cloneData(emptyCrewState), cloneData(existingCrew ?? {}), { inplace: false });

  crew.minimum = numericValue(crew.minimum);
  crew.recommended = numericValue(crew.recommended);
  crew.maximum = numericValue(crew.maximum);
  crew.current = numericValue(crew.current);
  crew.currentGenericCrew = numericValue(crew.currentGenericCrew, numericValue(crew.current));
  crew.namedCrew = Array.isArray(crew.namedCrew) ? cloneData(crew.namedCrew) : [];

  return crew;
}

function isCrewAssetAssignment(assignee, options = {}) {
  const hasCrewAssetShape = assignee?.identity?.id !== undefined
    && assignee?.crew !== undefined
    && assignee?.stationAssignment !== undefined;

  return options.assigneeType === "crewAsset"
    || assignee?.componentType === ARCFLIGHT_ITEM_TYPES.CREW_ASSET
    || assignee?.crewAssetId !== undefined
    || hasCrewAssetShape;
}

function getCrewAssetAssignmentName(assignee, options = {}) {
  return options.name
    ?? assignee?.name
    ?? assignee?.identity?.displayName
    ?? assignee?.identity?.title
    ?? assignee?.identity?.id
    ?? "";
}

function buildStationAssignment(stationKey, assignee, options = {}) {
  if (!assignee) return null;

  if (isCrewAssetAssignment(assignee, options)) {
    return {
      stationKey,
      assigneeType: "crewAsset",
      actorId: "",
      actorUuid: "",
      crewAssetId: options.crewAssetId ?? assignee.crewAssetId ?? assignee.itemId ?? assignee.id ?? assignee.identity?.id ?? "",
      crewAssetUuid: options.crewAssetUuid ?? assignee.crewAssetUuid ?? assignee.itemUuid ?? assignee.uuid ?? "",
      name: getCrewAssetAssignmentName(assignee, options),
      notes: options.notes ?? assignee.stationAssignment?.notes ?? ""
    };
  }

  const assigneeType = options.assigneeType ?? (assignee.type === "npc" ? "npc" : "actor");

  return {
    stationKey,
    assigneeType,
    actorId: assignee.id ?? "",
    actorUuid: assignee.uuid ?? "",
    crewAssetId: options.crewAssetId ?? "",
    crewAssetUuid: options.crewAssetUuid ?? "",
    name: options.name ?? assignee.name ?? "",
    notes: options.notes ?? ""
  };
}

function countWeaponMountsByArc(weaponMounts = {}) {
  return Object.values(weaponMounts).reduce((total, mounts) => total + (Array.isArray(mounts) ? mounts.length : 0), 0);
}

function numericValue(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeArkengineFueling(arkengine = {}) {
  const existingFueling = cloneData(arkengine.fueling ?? {});
  const requiredSpellRank = numericValue(
    existingFueling.requiredSpellRank,
    numericValue(arkengine.spellRankRequired)
  );
  const fuelSlots = numericValue(existingFueling.fuelSlots);

  return {
    requiredSpellRank,
    fuelSlots,
    maxStoredSpellRanks: requiredSpellRank * fuelSlots,
    currentStoredSpellRanks: numericValue(existingFueling.currentStoredSpellRanks),
    normalHexCostFormula: existingFueling.normalHexCostFormula ?? "requiredSpellRank",
    hardBurnHexCostFormula: existingFueling.hardBurnHexCostFormula ?? "ceil(requiredSpellRank * 1.5)",
    leanBurnHexCostFormula: existingFueling.leanBurnHexCostFormula ?? "ceil(requiredSpellRank / 2)",
    stealthBurnHexCostFormula: existingFueling.stealthBurnHexCostFormula ?? "ceil(requiredSpellRank * 1.5)",
    overchargeCostFormula: existingFueling.overchargeCostFormula ?? "definedByOverchargeAction",
    emergencySpellSlotFuelingAllowed: existingFueling.emergencySpellSlotFuelingAllowed ?? true
  };
}

function normalizeArkengineData(arkengine = {}) {
  const normalizedArkengine = cloneData(arkengine ?? {});
  normalizedArkengine.fueling = normalizeArkengineFueling(normalizedArkengine);

  return normalizedArkengine;
}

function getArkengineFuelingCosts(fueling = {}) {
  const requiredSpellRank = numericValue(fueling.requiredSpellRank);

  return {
    normalHexCost: requiredSpellRank,
    hardBurnHexCost: Math.ceil(requiredSpellRank * 1.5),
    leanBurnHexCost: Math.ceil(requiredSpellRank / 2),
    stealthBurnHexCost: Math.ceil(requiredSpellRank * 1.5)
  };
}

function getInstalledArkengineMods(installed = {}) {
  return Array.isArray(installed.arkengineMods) ? cloneData(installed.arkengineMods) : [];
}

function getArkengineModSlotCost(mod = {}) {
  return numericValue(mod.modSlotsRequired ?? mod.installation?.modSlotsRequired, 1);
}

function buildSlotState(capacity, used) {
  return {
    capacity,
    used,
    available: capacity - used
  };
}

function getArkengineModSlotState(arkengine = {}, installed = {}) {
  const capacity = numericValue(arkengine.modSlots);
  const used = getInstalledArkengineMods(installed).reduce((total, mod) => total + getArkengineModSlotCost(mod), 0);

  return buildSlotState(capacity, used);
}

function getInstalledRooms(installed = {}) {
  return Array.isArray(installed.rooms) ? cloneData(installed.rooms) : [];
}

function getRoomSlotState(hull = {}, installed = {}) {
  const capacity = numericValue(hull.rooms?.expansionSlots);
  const used = getInstalledRooms(installed).reduce((total, room) => total + numericValue(room.expansionSlotsRequired, 1), 0);

  return buildSlotState(capacity, used);
}

function getInstalledShipUpgrades(installed = {}) {
  return Array.isArray(installed.shipUpgrades) ? cloneData(installed.shipUpgrades) : [];
}


function installedEntryMatchesIdentifier(entry = {}, identifier = "") {
  const normalizedIdentifier = String(identifier ?? "").trim();
  if (!normalizedIdentifier) return false;

  return [
    entry.id,
    entry.itemId,
    entry.itemUuid,
    entry.uuid,
    entry.key,
    entry.identity?.id
  ].filter(Boolean).includes(normalizedIdentifier);
}

function installRecordMatchesInstalledEntry(record = {}, entry = {}, componentType = "") {
  if (record.active !== true || record.componentType !== componentType) return false;

  return Boolean(
    (entry.itemUuid && record.itemUuid === entry.itemUuid)
    || (entry.uuid && record.itemUuid === entry.uuid)
    || (entry.itemId && record.itemId === entry.itemId)
    || (entry.id && record.itemId === entry.id)
    || (entry.key && record.componentKey === entry.key)
    || (entry.identity?.id && record.componentKey === entry.identity.id)
  );
}

function buildInstallStateWithDeactivatedEntry(systemData = {}, entry = {}, componentType = "", reason = "removed") {
  const installState = normalizeBasicInstallState(systemData.installState);
  const removalMetadata = {
    removedAt: Date.now(),
    removedBy: globalThis.game?.user?.id ?? "",
    removalReason: reason
  };
  let deactivatedCount = 0;

  const installs = installState.installs.map((record) => {
    if (!installRecordMatchesInstalledEntry(record, entry, componentType)) return record;
    deactivatedCount += 1;
    return {
      ...record,
      active: false,
      ...removalMetadata
    };
  });

  return {
    installState: normalizeBasicInstallState({ version: installState.version, installs }),
    deactivatedCount
  };
}

function hasInstalledEntry(entries = [], entry = {}) {
  const identifiers = [entry.key, entry.itemId, entry.uuid].filter(Boolean);
  if (identifiers.length === 0) return false;

  return entries.some((existing) => (
    [existing.key, existing.itemId, existing.uuid].filter(Boolean).some((identifier) => identifiers.includes(identifier))
  ));
}

function activeSingleInstallMatches(systemData = {}, item, componentType) {
  const componentData = getComponentData(item) ?? {};
  const itemId = item?.id ?? "";
  const uuid = item?.uuid ?? "";
  const key = componentData.identity?.id ?? componentData.platform ?? componentData.engineClass ?? item?.slug ?? "";

  if (componentType === ARCFLIGHT_ITEM_TYPES.HULL) {
    const installed = systemData.installed ?? {};
    return Boolean(
      (itemId && installed.hullItemId === itemId)
      || (uuid && installed.hullUuid === uuid)
      || (key && installed.hullPlatform === key)
    );
  }

  if (componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE) {
    const installed = systemData.installed ?? {};
    return Boolean(
      (itemId && installed.arkengineItemId === itemId)
      || (uuid && installed.arkengineUuid === uuid)
      || (key && installed.arkengineKey === key)
    );
  }

  return false;
}

function duplicateInstallError(componentName, placementName) {
  return new Error(`Arcflight | ${componentName || "This component"} is already installed or rostered on this ship as ${placementName}; duplicate installs are blocked.`);
}

function getShipUpgradeSlotState(installed = {}) {
  const existingCapacity = Number(installed.shipUpgradeSlots?.capacity);
  const capacity = Number.isFinite(existingCapacity) ? existingCapacity : 3;
  const used = getInstalledShipUpgrades(installed).reduce((total, upgrade) => total + numericValue(upgrade.slotCost, 1), 0);

  return buildSlotState(capacity, used);
}

function buildInstalledArkengineModEntry(modItem) {
  const modData = cloneData(getComponentData(modItem));
  const key = modData.identity?.id ?? modItem?.slug ?? modItem?.id ?? "";

  return {
    itemId: modItem?.id ?? "",
    uuid: modItem?.uuid ?? "",
    key,
    name: modItem?.name ?? modData.identity?.displayName ?? key,
    componentType: ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
    modType: modData.identity?.modType ?? "",
    rarity: modData.identity?.rarity ?? "standard",
    origin: modData.identity?.origin ?? "",
    role: modData.identity?.role ?? "",
    modSlotsRequired: numericValue(modData.installation?.modSlotsRequired, 1),
    systemState: modData.state?.systemState ?? "Functional",
    effects: cloneData(modData.effects ?? {}),
    refitPressure: getComponentRefitPressure(modItem),
    tierMetadata: getComponentTierMetadata(modItem),
    restrictions: cloneData(modData.restrictions ?? {}),
    traits: cloneData(modData.traits ?? []),
    notes: cloneData(modData.notes ?? {})
  };
}

function getArkengineTags(arkengine = {}) {
  return new Set([
    arkengine.engineClass,
    arkengine.variantFamily,
    ...(Array.isArray(arkengine.traits) ? arkengine.traits : [])
  ].filter(Boolean));
}

function validateArkengineModEntryForEngine(modEntry, arkengine = {}, installed = {}) {
  const restrictions = modEntry.restrictions ?? {};
  const existingMods = getInstalledArkengineMods(installed);
  const existingCount = existingMods.filter((existing) => existing.key === modEntry.key).length;
  const maxInstances = numericValue(restrictions.maxInstances, 1);

  if ((restrictions.unique === true && existingCount > 0) || existingCount >= maxInstances) {
    throw new Error(`Arcflight | ${modEntry.name} cannot be installed more than ${maxInstances} time(s) on this arkengine.`);
  }

  const arkengineTags = getArkengineTags(arkengine);
  const requiredTags = Array.isArray(restrictions.requiredArkengineTags) ? restrictions.requiredArkengineTags : [];
  const blockedTags = Array.isArray(restrictions.blockedArkengineTags) ? restrictions.blockedArkengineTags : [];
  const missingTag = requiredTags.find((tag) => !arkengineTags.has(tag));
  const blockedTag = blockedTags.find((tag) => arkengineTags.has(tag));

  if (missingTag) {
    throw new Error(`Arcflight | ${modEntry.name} requires an arkengine with the ${missingTag} tag.`);
  }

  if (blockedTag) {
    throw new Error(`Arcflight | ${modEntry.name} cannot be installed on an arkengine with the ${blockedTag} tag.`);
  }

  const variantFamily = arkengine.variantFamily ?? "";
  const requiredFamilies = Array.isArray(restrictions.requiredVariantFamilies) ? restrictions.requiredVariantFamilies : [];
  const blockedFamilies = Array.isArray(restrictions.blockedVariantFamilies) ? restrictions.blockedVariantFamilies : [];

  if (requiredFamilies.length > 0 && !requiredFamilies.includes(variantFamily)) {
    throw new Error(`Arcflight | ${modEntry.name} requires one of these arkengine variant families: ${requiredFamilies.join(", ")}.`);
  }

  if (blockedFamilies.includes(variantFamily)) {
    throw new Error(`Arcflight | ${modEntry.name} cannot be installed on ${variantFamily} arkengines.`);
  }
}

function buildInstalledShipUpgradeEntry(upgradeItem) {
  const upgradeData = cloneData(getComponentData(upgradeItem));
  const key = upgradeData.identity?.id ?? upgradeItem?.slug ?? upgradeItem?.id ?? "";

  return {
    itemId: upgradeItem?.id ?? "",
    uuid: upgradeItem?.uuid ?? "",
    key,
    name: upgradeItem?.name ?? upgradeData.identity?.displayName ?? key,
    componentType: ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
    upgradeType: upgradeData.identity?.upgradeType ?? "",
    rarity: upgradeData.identity?.rarity ?? "standard",
    systemState: upgradeData.state?.systemState ?? "Functional",
    slotCost: numericValue(upgradeData.installation?.slotCost, 1),
    effects: cloneData(upgradeData.effects ?? {}),
    refitPressure: getComponentRefitPressure(upgradeItem),
    tierMetadata: getComponentTierMetadata(upgradeItem),
    restrictions: cloneData(upgradeData.restrictions ?? {}),
    traits: cloneData(upgradeData.traits ?? [])
  };
}

const SUPPORTED_ARKENGINE_MODIFIER_TARGETS = new Set([
  "voyageSpeedTravelHexDays",
  "lifeveilCapacity",
  "strainCapacity",
  "hardBurnStrainCost",
  "overchargeRisk",
  "resistanceTendencies",
  "arkengineModSlots",
  "fuelSlots"
]);

function applyDerivedModifier(derived, modifier = {}, supportedTargets, label) {
  const target = modifier.target;
  const mode = modifier.mode ?? "add";
  const value = modifier.value;

  if (!supportedTargets.has(target)) {
    console.warn(`Arcflight | Skipping unsupported ${label} modifier target: ${target}`);
    return;
  }

  if (mode === "append") {
    const existing = Array.isArray(derived[target]) ? derived[target] : [];
    const additions = Array.isArray(value) ? value : [value];
    derived[target] = [...new Set([...existing, ...additions])];
    return;
  }

  if (mode === "set") {
    derived[target] = cloneData(value);
    return;
  }

  if (mode === "add") {
    derived[target] = numericValue(derived[target]) + numericValue(value);
    return;
  }

  if (mode === "subtract") {
    derived[target] = numericValue(derived[target]) - numericValue(value);
    return;
  }

  console.warn(`Arcflight | Skipping unsupported ${label} modifier mode: ${mode}`);
}

function normalizeDerivedStatModifiers(derivedStatModifiers = {}) {
  if (Array.isArray(derivedStatModifiers)) return derivedStatModifiers.map((modifier) => cloneData(modifier));

  return Object.entries(derivedStatModifiers ?? {}).map(([target, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { target, mode: value.mode ?? "add", value: value.value, summary: value.summary ?? "" };
    }

    return { target, mode: "add", value };
  });
}

const PATTERN_DERIVED_STAT_TARGET_ALIASES = Object.freeze({
  travelHexDays: "voyageSpeedTravelHexDays"
});

function withPatternTargetAlias(modifier = {}) {
  const target = PATTERN_DERIVED_STAT_TARGET_ALIASES[modifier.target] ?? modifier.target;

  return { ...modifier, target };
}

const SUPPORTED_HULL_PATTERN_MODIFIER_TARGETS = new Set([
  "hullIntegrity",
  "armorClass",
  "strainCapacity",
  "lifeveilCapacity",
  "cargoCapacity",
  "detection",
  "combatSpeed",
  "maneuverability",
  "baseAP",
  "baseRAP",
  "resistanceTendencies",
  "traits"
]);

function applyHullPatternDerivedStatModifiers(derived, installed = {}) {
  const pattern = installed.hullPattern;
  if (pattern?.appliesTo !== "hull") return;

  for (const modifier of normalizeDerivedStatModifiers(pattern.derivedStatModifiers)) {
    applyDerivedModifier(derived, withPatternTargetAlias(modifier), SUPPORTED_HULL_PATTERN_MODIFIER_TARGETS, "hull pattern");
  }
}

const IGNORED_FUTURE_ARKENGINE_PATTERN_MODIFIER_TARGETS = new Set([
  "overchargeRiskStep"
]);

const SUPPORTED_ARKENGINE_PATTERN_MODIFIER_TARGETS = new Set([
  "voyageSpeedTravelHexDays",
  "lifeveilCapacity",
  "strainCapacity",
  "hardBurnStrainCost",
  "overchargeRisk",
  "resistanceTendencies",
  "arkengineModSlots",
  "combatSpeed",
  "fuelSlots",
  "maxStoredSpellRanks",
  "normalHexCost",
  "hardBurnHexCost",
  "leanBurnHexCost",
  "stealthBurnHexCost",
  "arkengineLifeveilModifier",
  "arkengineStrainModifier"
]);

function expandArkenginePatternModifier(modifier = {}) {
  if (modifier.target === "lifeveilModifier") {
    return [
      { ...modifier, target: "lifeveilCapacity" },
      { ...modifier, target: "arkengineLifeveilModifier" }
    ];
  }

  if (modifier.target === "strainModifier") {
    return [
      { ...modifier, target: "strainCapacity" },
      { ...modifier, target: "arkengineStrainModifier" }
    ];
  }

  return [withPatternTargetAlias(modifier)];
}

function applyArkenginePatternDerivedStatModifiers(derived, installed = {}) {
  const pattern = installed.arkenginePattern;
  if (pattern?.appliesTo !== "arkengine") return;

  for (const modifier of normalizeDerivedStatModifiers(pattern.derivedStatModifiers)) {
    if (IGNORED_FUTURE_ARKENGINE_PATTERN_MODIFIER_TARGETS.has(modifier.target)) continue;

    for (const expandedModifier of expandArkenginePatternModifier(modifier)) {
      applyDerivedModifier(derived, expandedModifier, SUPPORTED_ARKENGINE_PATTERN_MODIFIER_TARGETS, "arkengine pattern");
    }
  }
}

function applyArkengineModDerivedStatModifiers(derived, installed = {}) {
  for (const mod of getInstalledArkengineMods(installed)) {
    const modifiers = Array.isArray(mod.effects?.derivedStatModifiers) ? mod.effects.derivedStatModifiers : [];
    for (const modifier of modifiers) applyDerivedModifier(derived, modifier, SUPPORTED_ARKENGINE_MODIFIER_TARGETS, "arkengine mod");
  }
}

const SUPPORTED_SHIP_UPGRADE_MODIFIER_TARGETS = new Set([
  "hullIntegrity",
  "armorClass",
  "strainCapacity",
  "lifeveilCapacity",
  "cargoCapacity",
  "detection",
  "combatSpeed",
  "maneuverability",
  "baseAP",
  "baseRAP",
  "resistanceTendencies"
]);

function applyShipUpgradeModifier(derived, modifier = {}) {
  applyDerivedModifier(derived, modifier, SUPPORTED_SHIP_UPGRADE_MODIFIER_TARGETS, "ship upgrade");
}

function applyShipUpgradeDerivedStatModifiers(derived, installed = {}) {
  for (const upgrade of getInstalledShipUpgrades(installed)) {
    const modifiers = Array.isArray(upgrade.effects?.derivedStatModifiers) ? upgrade.effects.derivedStatModifiers : [];
    for (const modifier of modifiers) applyShipUpgradeModifier(derived, modifier);
  }
}

function coreRoomEntry(roomKey) {
  const room = getLockedCoreRoom(roomKey);

  return {
    key: roomKey,
    name: room?.identity?.displayName ?? roomKey,
    componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
    roomType: room?.identity?.roomType ?? "utility",
    expansionSlotsRequired: 0,
    systemState: room?.state?.systemState ?? "Functional",
    role: room?.identity?.role ?? "",
    utility: cloneData(room?.utility ?? {}),
    mechanicalEffects: cloneData(room?.mechanicalEffects ?? {}),
    traits: cloneData(room?.traits ?? [])
  };
}

function getCoreRoomsFromHull(hull = {}) {
  const configuredCoreRooms = Array.isArray(hull.rooms?.coreRooms) ? hull.rooms.coreRooms : getLockedCoreRoomKeys();

  return configuredCoreRooms.map((roomReference) => {
    if (typeof roomReference === "string") {
      const key = roomReference.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return coreRoomEntry(key);
    }

    return {
      ...coreRoomEntry(roomReference?.key ?? roomReference?.id ?? ""),
      ...cloneData(roomReference)
    };
  });
}

function buildInstalledRoomEntry(roomItem) {
  const roomData = cloneData(getComponentData(roomItem));
  const key = roomData.identity?.id ?? roomItem?.slug ?? roomItem?.id ?? "";

  return {
    itemId: roomItem?.id ?? "",
    uuid: roomItem?.uuid ?? "",
    key,
    name: roomItem?.name ?? roomData.identity?.displayName ?? key,
    componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
    roomType: roomData.identity?.roomType ?? "utility",
    expansionSlotsRequired: numericValue(roomData.installation?.expansionSlotsRequired, 1),
    systemState: roomData.state?.systemState ?? "Functional",
    utility: cloneData(roomData.utility ?? {}),
    refitPressure: getComponentRefitPressure(roomItem),
    tierMetadata: getComponentTierMetadata(roomItem),
    mechanicalEffects: cloneData(roomData.mechanicalEffects ?? {}),
    traits: cloneData(roomData.traits ?? [])
  };
}

function deriveShipStatsFromBase(base = {}, installed = {}) {
  const hull = cloneData(base.hull ?? {});
  const arkengine = normalizeArkengineData(base.arkengine ?? {});
  const roomSlots = getRoomSlotState(hull, installed);
  const coreRooms = getCoreRoomsFromHull(hull);

  // Calculation order is intentionally linear: hull base -> hull pattern ->
  // arkengine base/effects -> arkengine pattern -> arkengine mods ->
  // ship upgrades -> final derived slot/readout fields.
  // Future gameplay hooks (travel, hard burn, overcharge, combat, morale,
  // events) should consume these results rather than mutate source items.
  const derived = foundry.utils.mergeObject(cloneData(emptyDerivedShipState), hull, { inplace: false });
  applyHullPatternDerivedStatModifiers(derived, installed);

  derived.lifeveilCapacity = numericValue(derived.lifeveilCapacity) + numericValue(arkengine.lifeveilModifier);
  derived.strainCapacity = numericValue(derived.strainCapacity) + numericValue(arkengine.strainModifier);
  derived.voyageSpeedTravelHexDays = numericValue(arkengine.travelHexDays);
  derived.resistanceTendencies = Array.isArray(arkengine.resistanceTendencies)
    ? cloneData(arkengine.resistanceTendencies)
    : [];
  derived.arkengineVariantFamily = arkengine.variantFamily ?? "";
  derived.hardBurnStrainCost = numericValue(arkengine.hardBurnStrainCost);
  derived.overchargeRisk = arkengine.overchargeRisk ?? "";
  derived.spellRankRequired = arkengine.spellRankRequired ?? 0;
  derived.arkengineLifeveilModifier = numericValue(arkengine.lifeveilModifier);
  derived.arkengineStrainModifier = numericValue(arkengine.strainModifier);
  derived.requiredSpellRank = numericValue(arkengine.fueling?.requiredSpellRank);
  derived.fuelSlots = numericValue(arkengine.fueling?.fuelSlots);
  derived.maxStoredSpellRanks = numericValue(arkengine.fueling?.maxStoredSpellRanks);
  foundry.utils.mergeObject(derived, getArkengineFuelingCosts(arkengine.fueling), { inplace: true });

  applyArkenginePatternDerivedStatModifiers(derived, installed);
  applyArkengineModDerivedStatModifiers(derived, installed);
  applyShipUpgradeDerivedStatModifiers(derived, installed);

  const arkengineModSlots = getArkengineModSlotState(arkengine, installed, derived);
  derived.arkengineModSlots = arkengineModSlots.capacity;
  derived.arkengineModSlotsUsed = arkengineModSlots.used;
  derived.arkengineModSlotsAvailable = arkengineModSlots.available;
  derived.energyResistances = cloneData(derived.resistanceTendencies);
  derived.rooms = foundry.utils.mergeObject(cloneData(derived.rooms ?? {}), {
    coreRooms,
    expansionSlots: roomSlots.capacity,
    expansionSlotsUsed: roomSlots.used,
    expansionSlotsAvailable: roomSlots.available
  }, { inplace: false });

  return derived;
}

function getLegacyDerivedStatsFromDerived(derived = {}) {
  return {
    speed: derived.combatSpeed ?? 0,
    handling: derived.maneuverability ?? 0,
    crewCapacity: derived.crew?.maximum ?? 0,
    cargoCapacity: derived.cargoCapacity ?? 0,
    weaponMounts: countWeaponMountsByArc(derived.weaponMounts),
    roomSlots: derived.rooms?.expansionSlots ?? 0
  };
}

function hasInstalledHull(systemData = {}) {
  return Boolean(systemData.installed?.hullItemId || systemData.installed?.hullUuid || systemData.installed?.hullPlatform);
}

function hasInstalledArkengine(systemData = {}) {
  return Boolean(systemData.installed?.arkengineItemId || systemData.installed?.arkengineUuid || systemData.installed?.arkengineKey);
}


function normalizeBasicInstallState(installState = {}) {
  const source = installState && typeof installState === "object" && !Array.isArray(installState) ? installState : {};
  return {
    version: 1,
    installs: Array.isArray(source.installs) ? cloneData(source.installs) : []
  };
}

const INSTALL_STATE_PRESSURE_KEY_MAP = Object.freeze({
  weaponPressure: "weapon",
  enginePressure: "engine",
  infrastructurePressure: "infrastructure",
  lifeveilPressure: "lifeveil",
  crewCommandPressure: "crewCommand",
  occultPressure: "occult"
});

function normalizeInstallStatePressureContribution(refitPressure = {}) {
  const pressure = {};
  let total = 0;

  for (const [sourceKey, targetKey] of Object.entries(INSTALL_STATE_PRESSURE_KEY_MAP)) {
    pressure[targetKey] = Math.max(0, numericValue(refitPressure?.[sourceKey]));
    total += pressure[targetKey];
  }

  pressure.total = total;
  return pressure;
}

function getInstallStateComponentIdentity(item, componentType) {
  const componentData = getComponentData(item) ?? {};
  return {
    itemId: item?.id ?? "",
    itemUuid: item?.uuid ?? "",
    componentType,
    key: componentData.identity?.id
      ?? componentData.platform
      ?? componentData.engineClass
      ?? item?.slug
      ?? item?.id
      ?? ""
  };
}

function installStateRecordMatchesComponent(record = {}, identity = {}) {
  if (record.componentType !== identity.componentType) return false;

  return Boolean(
    (identity.itemUuid && record.itemUuid === identity.itemUuid)
    || (identity.itemId && record.itemId === identity.itemId)
    || (identity.key && record.componentKey === identity.key)
  );
}

function createInstallStateRecord(shipActor, item, componentType, installCategory, tierState = {}) {
  const identity = getInstallStateComponentIdentity(item, componentType);
  const pressureContribution = normalizeInstallStatePressureContribution(getComponentRefitPressure(item));
  const installIdKey = identity.key || identity.itemId || componentType || "component";
  const randomId = globalThis.foundry?.utils?.randomID?.(10)
    ?? Math.random().toString(36).slice(2, 12).padEnd(10, "0");

  return {
    installId: `${componentType || "component"}-${installIdKey}-${Date.now().toString(36)}-${randomId}`.replace(/[^a-zA-Z0-9_-]+/g, "-"),
    itemId: identity.itemId,
    itemUuid: identity.itemUuid,
    componentKey: identity.key,
    componentType,
    installedAt: Date.now(),
    installedBy: globalThis.game?.user?.id ?? "",
    installCategory,
    nativeInstall: installCategory === "native",
    refitInstall: installCategory === "refit",
    temporaryInstall: false,
    pressureContribution,
    tierAtInstall: numericValue(tierState.currentTier),
    active: true
  };
}

function shouldDeactivateReplacedInstallRecord(record = {}, componentType) {
  return record.active === true
    && (componentType === ARCFLIGHT_ITEM_TYPES.HULL || componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE)
    && record.componentType === componentType;
}

function buildReplacementRemovalMetadata(replacedByInstallId) {
  const metadata = {
    removedAt: Date.now(),
    removedBy: globalThis.game?.user?.id ?? "",
    removalReason: "replaced"
  };

  if (replacedByInstallId) metadata.replacedByInstallId = replacedByInstallId;
  return metadata;
}

function buildInstallStateWithComponent(systemData, shipActor, item, componentType, installCategory, tierState = {}) {
  const installState = normalizeBasicInstallState(systemData.installState);
  const identity = getInstallStateComponentIdentity(item, componentType);

  if (installState.installs.some((record) => record.active === true && installStateRecordMatchesComponent(record, identity))) {
    return installState;
  }

  const installRecord = createInstallStateRecord(shipActor, item, componentType, installCategory, tierState);
  const replacementRemovalMetadata = buildReplacementRemovalMetadata(installRecord.installId);
  const installs = installState.installs.map((record) => {
    if (!shouldDeactivateReplacedInstallRecord(record, componentType)) return record;
    return {
      ...record,
      active: false,
      ...replacementRemovalMetadata
    };
  });

  return normalizeBasicInstallState({
    version: installState.version,
    installs: [
      ...installs,
      installRecord
    ]
  });
}

function normalizeRefitPressure(refitPressure = {}) {
  const pressure = {};
  let total = 0;

  for (const key of REFIT_PRESSURE_KEYS) {
    pressure[key] = Math.max(0, numericValue(refitPressure?.[key]));
    total += pressure[key];
  }

  pressure.total = total;
  return pressure;
}

function hasRefitPressure(component = {}) {
  return getComponentRefitPressure(component).total > 0;
}

function getInstalledRefitPressureComponents(systemData = {}) {
  return [
    systemData.base?.arkengine,
    ...(Array.isArray(systemData.installed?.arkengineMods) ? systemData.installed.arkengineMods : []),
    ...(Array.isArray(systemData.installed?.rooms) ? systemData.installed.rooms : []),
    ...(Array.isArray(systemData.installed?.shipUpgrades) ? systemData.installed.shipUpgrades : []),
    ...(Array.isArray(systemData.installed?.weapons) ? systemData.installed.weapons : []),
    ...(Array.isArray(systemData.installed?.weaponMounts) ? systemData.installed.weaponMounts : []),
    ...(Array.isArray(systemData.crew?.namedCrew) ? systemData.crew.namedCrew : [])
  ].filter(hasRefitPressure);
}

function getShipSystemData(shipOrSystem = {}) {
  if (shipOrSystem?.getFlag) return getArcflightShipData(shipOrSystem);
  if (shipOrSystem?.flags?.[ARCFLIGHT_MODULE_ID]?.system) {
    return foundry.utils.mergeObject(
      getDefaultArcflightShipData(),
      cloneData(shipOrSystem.flags[ARCFLIGHT_MODULE_ID].system),
      { inplace: false }
    );
  }

  return foundry.utils.mergeObject(getDefaultArcflightShipData(), cloneData(shipOrSystem ?? {}), { inplace: false });
}

function getHullClassification(systemData = {}) {
  return systemData.base?.hull?.classification ?? {};
}

function getHullRefitTolerance(systemData = {}) {
  return systemData.base?.hull?.refitTolerance ?? {};
}

function clampTier(value, minimum = 0, maximum = value) {
  return Math.min(Math.max(numericValue(value), numericValue(minimum)), numericValue(maximum, value));
}

export function calculateRefitPressure(shipOrSystem = {}) {
  const systemData = getShipSystemData(shipOrSystem);
  const pressure = normalizeRefitPressure();

  for (const component of getInstalledRefitPressureComponents(systemData)) {
    const componentPressure = getComponentRefitPressure(component);
    for (const key of REFIT_PRESSURE_KEYS) {
      pressure[key] += componentPressure[key];
    }
  }

  pressure.total = REFIT_PRESSURE_KEYS.reduce((total, key) => total + pressure[key], 0);
  return pressure;
}

function calculateShipTierFrameworkState(shipOrSystem = {}) {
  const systemData = getShipSystemData(shipOrSystem);
  const classification = getHullClassification(systemData);
  const tolerance = getHullRefitTolerance(systemData);
  const pressure = calculateRefitPressure(systemData);
  const existingTier = systemData.tier ?? {};
  const baseTier = numericValue(classification.baseTier, numericValue(existingTier.baseTier));
  const maximumRefitTier = numericValue(classification.maximumRefitTier, baseTier);
  const majorRefitsCompleted = Math.max(0, numericValue(existingTier.majorRefitsCompleted));
  const currentTier = clampTier(baseTier + majorRefitsCompleted, baseTier, maximumRefitTier);
  const majorRefitThreshold = numericValue(tolerance.totalBeforeMajorRefitRequired);
  const qualifiesForMajorRefit = majorRefitThreshold > 0 && pressure.total >= majorRefitThreshold;
  const refitStatus = qualifiesForMajorRefit
    ? REFIT_STATUSES.MAJOR_REFIT_REQUIRED
    : pressure.total > 0
      ? REFIT_STATUSES.PRESSURED
      : REFIT_STATUSES.NATIVE;
  const refitFlags = {
    qualifiesForMajorRefit,
    requiresDrydock: qualifiesForMajorRefit,
    requiresSpecialistLabor: qualifiesForMajorRefit,
    requiresRareMaterials: qualifiesForMajorRefit
  };

  return {
    tier: {
      baseTier,
      currentTier,
      refitStatus,
      majorRefitsCompleted
    },
    refitPressure: pressure,
    refitFlags
  };
}

function getTierFrameworkUpdatePaths(systemData = {}) {
  const frameworkState = calculateShipTierFrameworkState(systemData);

  return {
    [`flags.${ARCFLIGHT_MODULE_ID}.system.tier`]: frameworkState.tier,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.refitPressure`]: frameworkState.refitPressure,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.refitFlags`]: frameworkState.refitFlags
  };
}

export function getShipTierState(shipOrSystem = {}) {
  return calculateShipTierFrameworkState(shipOrSystem).tier;
}

export function getShipRefitPressure(shipOrSystem = {}) {
  return calculateShipTierFrameworkState(shipOrSystem).refitPressure;
}

export function getShipRefitStatus(shipOrSystem = {}) {
  return getShipTierState(shipOrSystem).refitStatus;
}

export async function updateShipTierState(shipActor) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | updateShipTierState requires an Arcflight-enabled PF2E vehicle actor.");
  }

  return shipActor.update(getTierFrameworkUpdatePaths(getArcflightShipData(shipActor)));
}

function buildLegacyResources(systemData, current, derived) {
  return foundry.utils.mergeObject(systemData.resources ?? {}, {
    hull: {
      value: current.hull,
      max: derived.hullIntegrity ?? 0
    },
    lifeveil: {
      value: current.lifeveil,
      max: derived.lifeveilCapacity ?? 0
    },
    strain: {
      value: current.strain,
      max: derived.strainCapacity ?? 0
    },
    morale: current.morale
  }, { inplace: false });
}

function hasRuntimeValue(current = {}, key) {
  return current[key] !== undefined && current[key] !== null && current[key] !== "";
}

function getCurrentFallback(systemData = {}, key) {
  if (hasRuntimeValue(systemData.current, key)) return systemData.current[key];

  if (key === "hull") return systemData.resources?.hull?.value;
  if (key === "lifeveil") return systemData.resources?.lifeveil?.value;
  if (key === "strain") return systemData.resources?.strain?.value;
  if (key === "morale") return systemData.resources?.morale;

  return undefined;
}

function shouldInitializeRuntimeValue(existingCurrent = {}, key, shouldInitialize = false) {
  return !hasRuntimeValue(existingCurrent, key)
    || (shouldInitialize && numericValue(existingCurrent[key]) <= 0);
}

function buildCurrentShipState(systemData = {}, derived = {}, initialize = {}) {
  const fallbackCurrent = {
    hull: getCurrentFallback(systemData, "hull"),
    lifeveil: getCurrentFallback(systemData, "lifeveil"),
    strain: getCurrentFallback(systemData, "strain"),
    morale: getCurrentFallback(systemData, "morale"),
    storedSpellRanks: getCurrentFallback(systemData, "storedSpellRanks")
  };
  const current = foundry.utils.mergeObject(cloneData(emptyCurrentShipState), cloneData(fallbackCurrent), { inplace: false });

  if (shouldInitializeRuntimeValue(current, "hull", initialize.hull)) current.hull = derived.hullIntegrity ?? 0;
  if (shouldInitializeRuntimeValue(current, "lifeveil", initialize.lifeveil)) current.lifeveil = derived.lifeveilCapacity ?? 0;
  if (shouldInitializeRuntimeValue(current, "strain", initialize.strain)) current.strain = 0;
  if (shouldInitializeRuntimeValue(current, "morale", initialize.morale)) current.morale = 0;
  if (shouldInitializeRuntimeValue(current, "storedSpellRanks", initialize.storedSpellRanks)) current.storedSpellRanks = derived.maxStoredSpellRanks ?? 0;

  current.hull = numericValue(current.hull);
  current.lifeveil = numericValue(current.lifeveil);
  current.strain = numericValue(current.strain);
  current.morale = numericValue(current.morale);
  current.storedSpellRanks = numericValue(current.storedSpellRanks);

  return current;
}

function alignInstalledSlotStates(installed = {}, base = {}, derived = {}) {
  const nextInstalled = cloneData(installed ?? {});
  nextInstalled.arkengineModSlots = getArkengineModSlotState(base.arkengine, nextInstalled, derived);
  nextInstalled.roomSlots = getRoomSlotState(base.hull, nextInstalled);
  nextInstalled.shipUpgradeSlots = getShipUpgradeSlotState(nextInstalled);

  return nextInstalled;
}

function isArcflightShipActor(actor) {
  return actor?.type === "vehicle"
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

export function getDefaultArcflightShipData() {
  return cloneData(arcflightShipDefaults);
}

export function getArcflightShipData(actor) {
  const flagData = actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "system") ?? actor?.flags?.[ARCFLIGHT_MODULE_ID]?.system ?? {};
  const systemData = foundry.utils.mergeObject(getDefaultArcflightShipData(), cloneData(flagData), { inplace: false });

  systemData.stations = getDefaultStationState(systemData.stations);
  systemData.crew = getDefaultCrewState(systemData.crew);
  systemData.tier = foundry.utils.mergeObject(cloneData(emptyTierState), cloneData(systemData.tier ?? {}), { inplace: false });
  systemData.tier.baseTier = numericValue(systemData.tier.baseTier);
  systemData.tier.currentTier = numericValue(systemData.tier.currentTier);
  systemData.tier.majorRefitsCompleted = Math.max(0, numericValue(systemData.tier.majorRefitsCompleted));
  if (!Object.values(REFIT_STATUSES).includes(systemData.tier.refitStatus)) systemData.tier.refitStatus = REFIT_STATUSES.NATIVE;
  systemData.refitPressure = normalizeRefitPressure(systemData.refitPressure);
  systemData.refitFlags = foundry.utils.mergeObject(cloneData(emptyRefitFlagsState), cloneData(systemData.refitFlags ?? {}), { inplace: false });
  systemData.installState = normalizeBasicInstallState(systemData.installState);

  return systemData;
}

export function getDefaultArcflightShipFlags(data = {}) {
  const system = foundry.utils.mergeObject(getDefaultArcflightShipData(), data, { inplace: false });
  system.stations = getDefaultStationState(system.stations);
  system.crew = getDefaultCrewState(system.crew);
  system.installState = normalizeBasicInstallState(system.installState);

  return {
    enabled: true,
    actorType: ARCFLIGHT_SHIP_ACTOR_TYPE,
    system
  };
}

export function calculateDerivedShipStats(base = {}, installed = {}) {
  return deriveShipStatsFromBase(base, installed);
}

export async function recalculateShipStats(shipActor) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | recalculateShipStats requires an Arcflight-enabled PF2E vehicle actor.");
  }

  const systemData = getArcflightShipData(shipActor);
  const coreRooms = getCoreRoomsFromHull(systemData.base?.hull);
  const base = foundry.utils.mergeObject(cloneData(systemData.base ?? {}), { coreRooms }, { inplace: false });
  const installed = foundry.utils.mergeObject(cloneData(systemData.installed ?? {}), { coreRooms }, { inplace: false });
  const derived = calculateDerivedShipStats(base, installed);
  const nextInstalled = alignInstalledSlotStates(installed, base, derived);
  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );

  const current = buildCurrentShipState(systemData, derived);
  const legacyResources = buildLegacyResources(systemData, current, derived);

  const stations = getDefaultStationState(systemData.stations);
  const tierSystemData = foundry.utils.mergeObject(cloneData(systemData), { base, installed: nextInstalled }, { inplace: false });

  return shipActor.update({
    ...getTierFrameworkUpdatePaths(tierSystemData),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.stations`]: stations,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: nextInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: current,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats
  });
}

function assertArcflightShipActor(shipActor, helperName) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error(`Arcflight | ${helperName} requires an Arcflight-enabled PF2E vehicle actor.`);
  }
}

function buildCleanCurrentShipState(systemData = {}, preserveCurrentResources = false) {
  if (preserveCurrentResources) return buildCurrentShipState(systemData, emptyDerivedShipState);

  return cloneData(emptyCurrentShipState);
}

function buildCleanLegacyResources(systemData = {}, current = {}, preserveCurrentResources = false) {
  if (preserveCurrentResources) return buildLegacyResources(systemData, current, emptyDerivedShipState);

  return buildEmptyResourcesState();
}

/**
 * Clear all installed Arcflight ship build references from a vehicle without
 * deleting actor items, source items, compendium entries, PF2E data, or the
 * Arcflight enabled state.
 *
 * @param {Actor} shipActor Arcflight-enabled PF2E vehicle actor.
 * @param {object} options Reset options.
 * @param {boolean} options.preserveCurrentResources Keep current resource values when true.
 * @param {boolean} options.preserveCrew Keep named crew and generic crew counts when true.
 * @param {boolean} options.preserveStations Keep station assignments when true.
 * @returns {Promise<Actor>} The updated ship actor.
 */
export async function clearShipBuild(shipActor, options = {}) {
  assertArcflightShipActor(shipActor, "clearShipBuild");

  const resetOptions = {
    preserveCurrentResources: false,
    preserveCrew: false,
    preserveStations: false,
    ...options
  };
  const systemData = getArcflightShipData(shipActor);
  const crew = resetOptions.preserveCrew
    ? getDefaultCrewState(systemData.crew)
    : getDefaultCrewState({});
  const stations = resetOptions.preserveStations
    ? getDefaultStationState(systemData.stations)
    : getDefaultStationState({});
  const current = buildCleanCurrentShipState(systemData, resetOptions.preserveCurrentResources);
  const resources = buildCleanLegacyResources(systemData, current, resetOptions.preserveCurrentResources);

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: buildEmptyInstalledState(),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base`]: buildEmptyBaseShipState(),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: cloneData(emptyDerivedShipState),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: current,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.tier`]: cloneData(emptyTierState),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.refitPressure`]: cloneData(emptyRefitPressureState),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.refitFlags`]: cloneData(emptyRefitFlagsState),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: resources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: cloneData(arcflightShipDefaults.derivedStats),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems`]: buildEmptyInstalledSystemsState(),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew`]: crew,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.stations`]: stations,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.cargo.capacity`]: 0
  });
}

/**
 * Clear expansion rooms installed on a ship. Hull-provided core rooms are kept.
 *
 * @param {Actor} shipActor Arcflight-enabled PF2E vehicle actor.
 * @returns {Promise<Actor>} The updated ship actor.
 */
export async function clearInstalledRooms(shipActor) {
  assertArcflightShipActor(shipActor, "clearInstalledRooms");

  const systemData = getArcflightShipData(shipActor);
  const baseHull = cloneData(systemData.base?.hull ?? {});
  const roomSlots = getRoomSlotState(baseHull, { rooms: [] });
  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.rooms`]: [],
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.roomSlots`]: roomSlots,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.rooms`]: ""
  });

  return recalculateShipStats(shipActor);
}

/**
 * Clear installed ship upgrades and reset the Phase 0 upgrade slot track.
 *
 * @param {Actor} shipActor Arcflight-enabled PF2E vehicle actor.
 * @returns {Promise<Actor>} The updated ship actor.
 */
export async function clearInstalledShipUpgrades(shipActor) {
  assertArcflightShipActor(shipActor, "clearInstalledShipUpgrades");

  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.shipUpgrades`]: [],
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.shipUpgradeSlots`]: buildSlotState(3, 0),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.shipUpgrades`]: ""
  });

  return recalculateShipStats(shipActor);
}

/**
 * Clear arkengine mods without uninstalling the arkengine.
 *
 * @param {Actor} shipActor Arcflight-enabled PF2E vehicle actor.
 * @returns {Promise<Actor>} The updated ship actor.
 */
export async function clearInstalledArkengineMods(shipActor) {
  assertArcflightShipActor(shipActor, "clearInstalledArkengineMods");

  const systemData = getArcflightShipData(shipActor);
  const arkengineModSlots = getArkengineModSlotState(systemData.base?.arkengine, { arkengineMods: [] });
  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.arkengineMods`]: [],
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.arkengineModSlots`]: arkengineModSlots,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.arkengineMods`]: ""
  });

  return recalculateShipStats(shipActor);
}

/**
 * Clear the named crew roster.
 *
 * @param {Actor} shipActor Arcflight-enabled PF2E vehicle actor.
 * @param {object} options Clear options.
 * @param {boolean} options.preserveCurrentGenericCrew Keep generic crew count when true.
 * @returns {Promise<Actor>} The updated ship actor.
 */
export async function clearCrewRoster(shipActor, options = {}) {
  assertArcflightShipActor(shipActor, "clearCrewRoster");

  const systemData = getArcflightShipData(shipActor);
  const crew = getDefaultCrewState(systemData.crew);
  crew.namedCrew = [];
  if (!options.preserveCurrentGenericCrew) crew.currentGenericCrew = 0;

  const tierSystemData = foundry.utils.mergeObject(cloneData(systemData), { crew }, { inplace: false });

  return shipActor.update({
    ...getTierFrameworkUpdatePaths(tierSystemData),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew`]: crew,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.crewAssets`]: ""
  });
}

/**
 * Clear all station assignments while preserving station definitions.
 *
 * @param {Actor} shipActor Arcflight-enabled PF2E vehicle actor.
 * @returns {Promise<Actor>} The updated ship actor.
 */
export async function clearStationAssignments(shipActor) {
  assertArcflightShipActor(shipActor, "clearStationAssignments");

  const systemData = getArcflightShipData(shipActor);
  const stations = getDefaultStationState(systemData.stations);
  stations.assignments = getDefaultStationAssignments();

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.stations`]: stations
  });
}

/**
 * Clear installed hull and arkengine patterns, then recalculate derived stats.
 *
 * @param {Actor} shipActor Arcflight-enabled PF2E vehicle actor.
 * @returns {Promise<Actor>} The updated ship actor.
 */
export async function clearComponentPatterns(shipActor) {
  assertArcflightShipActor(shipActor, "clearComponentPatterns");

  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.hullPattern`]: {},
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.arkenginePattern`]: {}
  });

  return recalculateShipStats(shipActor);
}

function getPatternSnapshot(pattern) {
  return cloneData(pattern ?? {});
}

function validatePatternAppliesTo(pattern, appliesTo, helperName) {
  if (!pattern) {
    throw new Error(`Arcflight | ${helperName} requires a known ${appliesTo} pattern key.`);
  }

  if (pattern.appliesTo !== appliesTo) {
    throw new Error(`Arcflight | ${helperName} received a pattern that does not apply to ${appliesTo} components.`);
  }
}

export async function setHullPattern(shipActor, patternKey) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | setHullPattern requires an Arcflight-enabled PF2E vehicle actor.");
  }

  const systemData = getArcflightShipData(shipActor);
  if (!hasInstalledHull(systemData)) {
    throw new Error("Arcflight | setHullPattern requires an installed hull before a hull pattern can be selected.");
  }

  const pattern = getHullPattern(patternKey);
  validatePatternAppliesTo(pattern, "hull", "setHullPattern");

  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.hullPattern`]: getPatternSnapshot(pattern)
  });

  return recalculateShipStats(shipActor);
}

export async function setArkenginePattern(shipActor, patternKey) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | setArkenginePattern requires an Arcflight-enabled PF2E vehicle actor.");
  }

  const systemData = getArcflightShipData(shipActor);
  if (!hasInstalledArkengine(systemData)) {
    throw new Error("Arcflight | setArkenginePattern requires an installed arkengine before an arkengine pattern can be selected.");
  }

  const pattern = getArkenginePattern(patternKey);
  validatePatternAppliesTo(pattern, "arkengine", "setArkenginePattern");

  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.arkenginePattern`]: getPatternSnapshot(pattern)
  });

  return recalculateShipStats(shipActor);
}


async function removeInstalledArrayEntry(shipActor, componentId, options = {}) {
  assertArcflightShipActor(shipActor, options.helperName ?? "removeInstalledArrayEntry");

  const componentType = options.componentType;
  const installedPath = options.installedPath;
  const installedSystemsPath = options.installedSystemsPath;
  const entries = options.getEntries?.(getArcflightShipData(shipActor).installed) ?? [];
  const removedEntry = entries.find((entry) => installedEntryMatchesIdentifier(entry, componentId));

  if (!removedEntry) return shipActor;

  const systemData = getArcflightShipData(shipActor);
  const currentEntries = options.getEntries?.(systemData.installed) ?? entries;
  const nextEntries = currentEntries.filter((entry) => !installedEntryMatchesIdentifier(entry, componentId));
  const { installState } = buildInstallStateWithDeactivatedEntry(systemData, removedEntry, componentType, "removed");

  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.${installedPath}`]: nextEntries,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.${installedSystemsPath}`]: nextEntries.map((entry) => entry.name).join(", "),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: installState
  });

  return recalculateShipStats(shipActor);
}

export async function removeInstalledArkengineMod(shipActor, componentId) {
  return removeInstalledArrayEntry(shipActor, componentId, {
    helperName: "removeInstalledArkengineMod",
    componentType: ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
    installedPath: "arkengineMods",
    installedSystemsPath: "arkengineMods",
    getEntries: getInstalledArkengineMods
  });
}

export async function removeInstalledRoom(shipActor, componentId) {
  return removeInstalledArrayEntry(shipActor, componentId, {
    helperName: "removeInstalledRoom",
    componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
    installedPath: "rooms",
    installedSystemsPath: "rooms",
    getEntries: getInstalledRooms
  });
}

export async function removeInstalledShipUpgrade(shipActor, componentId) {
  return removeInstalledArrayEntry(shipActor, componentId, {
    helperName: "removeInstalledShipUpgrade",
    componentType: ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
    installedPath: "shipUpgrades",
    installedSystemsPath: "shipUpgrades",
    getEntries: getInstalledShipUpgrades
  });
}

export async function installHull(shipActor, hullItem) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | installHull requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (getComponentType(hullItem) !== ARCFLIGHT_ITEM_TYPES.HULL) {
    throw new Error("Arcflight | installHull requires an Arcflight hull component item.");
  }

  const rawSystemData = shipActor.getFlag(ARCFLIGHT_MODULE_ID, "system") ?? {};
  const systemData = getArcflightShipData(shipActor);
  if (activeSingleInstallMatches(systemData, hullItem, ARCFLIGHT_ITEM_TYPES.HULL)) {
    throw duplicateInstallError(hullItem.name, "the active hull slot");
  }

  const baseHull = cloneData(getComponentData(hullItem));
  const baseArkengine = cloneData(systemData.base?.arkengine ?? {});
  const coreRooms = getCoreRoomsFromHull(baseHull);
  const nextInstalled = foundry.utils.mergeObject(cloneData(systemData.installed ?? {}), {
    hullItemId: hullItem.id ?? "",
    hullUuid: hullItem.uuid ?? "",
    hullPlatform: baseHull.platform ?? "",
    hullName: hullItem.name ?? baseHull.displayName ?? baseHull.platform ?? "",
    coreRooms
  }, { inplace: false });
  nextInstalled.roomSlots = getRoomSlotState(baseHull, nextInstalled);
  nextInstalled.shipUpgradeSlots = getShipUpgradeSlotState(nextInstalled);
  const derived = calculateDerivedShipStats({ hull: baseHull, arkengine: baseArkengine, coreRooms }, nextInstalled);
  const alignedInstalled = alignInstalledSlotStates(nextInstalled, { hull: baseHull, arkengine: baseArkengine }, derived);
  const firstHullInstall = !hasInstalledHull(rawSystemData);
  const current = buildCurrentShipState(systemData, derived, {
    hull: firstHullInstall,
    lifeveil: firstHullInstall,
    strain: firstHullInstall
  });

  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );
  const legacyResources = buildLegacyResources(systemData, current, derived);
  const tierSystemData = foundry.utils.mergeObject(cloneData(systemData), { base: { hull: baseHull, arkengine: baseArkengine, coreRooms }, installed: alignedInstalled }, { inplace: false });
  const tierUpdatePaths = getTierFrameworkUpdatePaths(tierSystemData);
  const nextInstallState = buildInstallStateWithComponent(systemData, shipActor, hullItem, ARCFLIGHT_ITEM_TYPES.HULL, "native", tierUpdatePaths[`flags.${ARCFLIGHT_MODULE_ID}.system.tier`]);

  return shipActor.update({
    ...tierUpdatePaths,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: alignedInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.hull`]: baseHull,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: current,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.hull`]: hullItem.name ?? baseHull.displayName ?? baseHull.platform ?? "",
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.minimum`]: derived.crew?.minimum ?? 0,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.recommended`]: derived.crew?.recommended ?? 0,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.maximum`]: derived.crew?.maximum ?? 0,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.cargo.capacity`]: derived.cargoCapacity ?? 0,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: nextInstallState
  });
}

export async function installArkengine(shipActor, arkengineItem) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | installArkengine requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (getComponentType(arkengineItem) !== ARCFLIGHT_ITEM_TYPES.ARKENGINE) {
    throw new Error("Arcflight | installArkengine requires an Arcflight arkengine component item.");
  }

  const rawSystemData = shipActor.getFlag(ARCFLIGHT_MODULE_ID, "system") ?? {};
  const systemData = getArcflightShipData(shipActor);
  if (activeSingleInstallMatches(systemData, arkengineItem, ARCFLIGHT_ITEM_TYPES.ARKENGINE)) {
    throw duplicateInstallError(arkengineItem.name, "the active arkengine slot");
  }

  const baseHull = cloneData(systemData.base?.hull ?? {});
  const baseArkengine = normalizeArkengineData(getComponentData(arkengineItem));
  const installedArkengineMods = [];
  const installedArkengineModSlots = getArkengineModSlotState(baseArkengine, { arkengineMods: installedArkengineMods });
  const coreRooms = getCoreRoomsFromHull(baseHull);
  const nextInstalled = foundry.utils.mergeObject(cloneData(systemData.installed ?? {}), {
    arkengineItemId: arkengineItem.id ?? "",
    arkengineUuid: arkengineItem.uuid ?? "",
    arkengineKey: baseArkengine.engineClass ?? "",
    arkengineName: arkengineItem.name ?? baseArkengine.displayName ?? baseArkengine.engineClass ?? "",
    arkengineMods: installedArkengineMods,
    arkengineModSlots: installedArkengineModSlots,
    coreRooms
  }, { inplace: false });
  nextInstalled.roomSlots = getRoomSlotState(baseHull, nextInstalled);
  nextInstalled.shipUpgradeSlots = getShipUpgradeSlotState(nextInstalled);
  const derived = calculateDerivedShipStats({ hull: baseHull, arkengine: baseArkengine, coreRooms }, nextInstalled);
  const alignedInstalled = alignInstalledSlotStates(nextInstalled, { hull: baseHull, arkengine: baseArkengine }, derived);
  const firstArkengineInstall = !hasInstalledArkengine(rawSystemData);
  const current = buildCurrentShipState(systemData, derived, {
    hull: false,
    lifeveil: firstArkengineInstall,
    strain: false,
    storedSpellRanks: firstArkengineInstall
  });

  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );
  const legacyResources = buildLegacyResources(systemData, current, derived);
  const tierSystemData = foundry.utils.mergeObject(cloneData(systemData), { base: { hull: baseHull, arkengine: baseArkengine, coreRooms }, installed: alignedInstalled }, { inplace: false });
  const tierUpdatePaths = getTierFrameworkUpdatePaths(tierSystemData);
  const nextInstallState = buildInstallStateWithComponent(systemData, shipActor, arkengineItem, ARCFLIGHT_ITEM_TYPES.ARKENGINE, "native", tierUpdatePaths[`flags.${ARCFLIGHT_MODULE_ID}.system.tier`]);

  return shipActor.update({
    ...tierUpdatePaths,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: alignedInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.arkengine`]: baseArkengine,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: current,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.arkengine`]: arkengineItem.name ?? baseArkengine.displayName ?? baseArkengine.engineClass ?? "",
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: nextInstallState
  });
}

export async function installArkengineMod(shipActor, modItem) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | installArkengineMod requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (getComponentType(modItem) !== ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD) {
    throw new Error("Arcflight | installArkengineMod requires an Arcflight arkengine mod component item.");
  }

  const systemData = getArcflightShipData(shipActor);
  if (!hasInstalledArkengine(systemData)) {
    throw new Error("Arcflight | installArkengineMod requires an installed arkengine before arkengine mods can be installed.");
  }

  const baseHull = cloneData(systemData.base?.hull ?? {});
  const baseArkengine = cloneData(systemData.base?.arkengine ?? {});
  const coreRooms = getCoreRoomsFromHull(baseHull);
  const installedArkengineMods = getInstalledArkengineMods(systemData.installed);
  const modEntry = buildInstalledArkengineModEntry(modItem);
  if (hasInstalledEntry(installedArkengineMods, modEntry)) {
    throw duplicateInstallError(modEntry.name, "an arkengine mod slot");
  }

  validateArkengineModEntryForEngine(modEntry, baseArkengine, systemData.installed);

  const nextInstalled = foundry.utils.mergeObject(cloneData(systemData.installed ?? {}), {
    coreRooms,
    arkengineMods: [...installedArkengineMods, modEntry]
  }, { inplace: false });

  nextInstalled.arkengineModSlots = getArkengineModSlotState(baseArkengine, nextInstalled);
  nextInstalled.roomSlots = getRoomSlotState(baseHull, nextInstalled);
  nextInstalled.shipUpgradeSlots = getShipUpgradeSlotState(nextInstalled);

  if (nextInstalled.arkengineModSlots.available < 0) {
    throw new Error("Arcflight | installArkengineMod would exceed this arkengine's mod slot capacity.");
  }

  const derived = calculateDerivedShipStats({ hull: baseHull, arkengine: baseArkengine, coreRooms }, nextInstalled);
  const alignedInstalled = alignInstalledSlotStates(nextInstalled, { hull: baseHull, arkengine: baseArkengine }, derived);
  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );
  const current = buildCurrentShipState(systemData, derived);
  const legacyResources = buildLegacyResources(systemData, current, derived);
  const tierSystemData = foundry.utils.mergeObject(cloneData(systemData), { base: { hull: baseHull, arkengine: baseArkengine, coreRooms }, installed: alignedInstalled }, { inplace: false });
  const tierUpdatePaths = getTierFrameworkUpdatePaths(tierSystemData);
  const nextInstallState = buildInstallStateWithComponent(systemData, shipActor, modItem, ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD, "refit", tierUpdatePaths[`flags.${ARCFLIGHT_MODULE_ID}.system.tier`]);

  return shipActor.update({
    ...tierUpdatePaths,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: alignedInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: current,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.arkengineMods`]: alignedInstalled.arkengineMods.map((mod) => mod.name).join(", "),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: nextInstallState
  });
}

export async function installRoom(shipActor, roomItem) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | installRoom requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (getComponentType(roomItem) !== ARCFLIGHT_ITEM_TYPES.ROOM) {
    throw new Error("Arcflight | installRoom requires an Arcflight room component item.");
  }

  const systemData = getArcflightShipData(shipActor);
  const baseHull = cloneData(systemData.base?.hull ?? {});
  const baseArkengine = cloneData(systemData.base?.arkengine ?? {});
  const roomEntry = buildInstalledRoomEntry(roomItem);

  if (roomEntry.traits.includes("core-room") || roomEntry.expansionSlotsRequired <= 0) {
    throw new Error("Arcflight | installRoom installs expansion rooms only; core rooms are provided by hulls.");
  }

  const installedRooms = getInstalledRooms(systemData.installed);
  if (hasInstalledEntry(installedRooms, roomEntry)) {
    throw duplicateInstallError(roomEntry.name, "a room slot");
  }

  const coreRooms = getCoreRoomsFromHull(baseHull);
  const nextInstalled = foundry.utils.mergeObject(cloneData(systemData.installed ?? {}), {
    coreRooms,
    rooms: [...installedRooms, roomEntry]
  }, { inplace: false });

  nextInstalled.roomSlots = getRoomSlotState(baseHull, nextInstalled);
  nextInstalled.shipUpgradeSlots = getShipUpgradeSlotState(nextInstalled);

  if (nextInstalled.roomSlots.available < 0) {
    throw new Error("Arcflight | installRoom would exceed this ship's expansion room slot capacity.");
  }

  const derived = calculateDerivedShipStats({ hull: baseHull, arkengine: baseArkengine, coreRooms }, nextInstalled);
  const alignedInstalled = alignInstalledSlotStates(nextInstalled, { hull: baseHull, arkengine: baseArkengine }, derived);
  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );
  const current = buildCurrentShipState(systemData, derived);
  const legacyResources = buildLegacyResources(systemData, current, derived);
  const tierSystemData = foundry.utils.mergeObject(cloneData(systemData), { base: { hull: baseHull, arkengine: baseArkengine, coreRooms }, installed: alignedInstalled }, { inplace: false });
  const tierUpdatePaths = getTierFrameworkUpdatePaths(tierSystemData);
  const roomInstallCategory = getComponentRefitPressure(roomItem).total > 0 ? "refit" : "native";
  const nextInstallState = buildInstallStateWithComponent(systemData, shipActor, roomItem, ARCFLIGHT_ITEM_TYPES.ROOM, roomInstallCategory, tierUpdatePaths[`flags.${ARCFLIGHT_MODULE_ID}.system.tier`]);

  return shipActor.update({
    ...tierUpdatePaths,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: alignedInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: current,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.rooms`]: alignedInstalled.rooms.map((room) => room.name).join(", "),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: nextInstallState
  });
}

export async function installShipUpgrade(shipActor, upgradeItem) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | installShipUpgrade requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (getComponentType(upgradeItem) !== ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE) {
    throw new Error("Arcflight | installShipUpgrade requires an Arcflight ship upgrade component item.");
  }

  const rawSystemData = shipActor.getFlag(ARCFLIGHT_MODULE_ID, "system") ?? {};
  const systemData = getArcflightShipData(shipActor);
  const hasShipUpgradeSlotSystem = Object.prototype.hasOwnProperty.call(rawSystemData.installed ?? {}, "shipUpgradeSlots");
  const baseHull = cloneData(systemData.base?.hull ?? {});
  const baseArkengine = cloneData(systemData.base?.arkengine ?? {});
  const coreRooms = getCoreRoomsFromHull(baseHull);
  const installedShipUpgrades = getInstalledShipUpgrades(systemData.installed);
  const upgradeEntry = buildInstalledShipUpgradeEntry(upgradeItem);
  if (hasInstalledEntry(installedShipUpgrades, upgradeEntry)) {
    throw duplicateInstallError(upgradeEntry.name, "a ship upgrade slot");
  }

  const nextInstalled = foundry.utils.mergeObject(cloneData(systemData.installed ?? {}), {
    coreRooms,
    shipUpgrades: [...installedShipUpgrades, upgradeEntry]
  }, { inplace: false });

  nextInstalled.roomSlots = getRoomSlotState(baseHull, nextInstalled);
  nextInstalled.shipUpgradeSlots = getShipUpgradeSlotState(nextInstalled);

  if (hasShipUpgradeSlotSystem && nextInstalled.shipUpgradeSlots.available < 0) {
    throw new Error("Arcflight | installShipUpgrade would exceed this ship's upgrade slot capacity.");
  }

  const derived = calculateDerivedShipStats({ hull: baseHull, arkengine: baseArkengine, coreRooms }, nextInstalled);
  const alignedInstalled = alignInstalledSlotStates(nextInstalled, { hull: baseHull, arkengine: baseArkengine }, derived);
  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );
  const current = buildCurrentShipState(systemData, derived);
  const legacyResources = buildLegacyResources(systemData, current, derived);
  const tierSystemData = foundry.utils.mergeObject(cloneData(systemData), { base: { hull: baseHull, arkengine: baseArkengine, coreRooms }, installed: alignedInstalled }, { inplace: false });
  const tierUpdatePaths = getTierFrameworkUpdatePaths(tierSystemData);
  const nextInstallState = buildInstallStateWithComponent(systemData, shipActor, upgradeItem, ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE, "refit", tierUpdatePaths[`flags.${ARCFLIGHT_MODULE_ID}.system.tier`]);

  return shipActor.update({
    ...tierUpdatePaths,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: alignedInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: current,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.shipUpgrades`]: alignedInstalled.shipUpgrades.map((upgrade) => upgrade.name).join(", "),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.cargo.capacity`]: derived.cargoCapacity ?? 0,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: nextInstallState
  });
}


function getCrewAssetCountValue(crewAssetEntry = {}) {
  return numericValue(crewAssetEntry.crew?.genericCrewEquivalent ?? crewAssetEntry.crew?.count, 1);
}

function buildCrewAssetRosterEntry(crewItem) {
  const crewData = cloneData(getComponentData(crewItem));
  const identity = cloneData(crewData.identity ?? {});
  const key = identity.id ?? crewItem?.slug ?? crewItem?.id ?? "";
  const displayName = crewItem?.name ?? identity.displayName ?? key;

  identity.id = key;
  identity.displayName = identity.displayName || displayName;

  return {
    id: crewItem?.id ?? key,
    itemId: crewItem?.id ?? "",
    itemUuid: crewItem?.uuid ?? "",
    uuid: crewItem?.uuid ?? "",
    key,
    name: displayName,
    componentType: ARCFLIGHT_ITEM_TYPES.CREW_ASSET,
    identity,
    crew: cloneData(crewData.crew ?? {}),
    stationAssignment: cloneData(crewData.stationAssignment ?? {}),
    capabilities: cloneData(crewData.capabilities ?? {}),
    refitPressure: getComponentRefitPressure(crewItem),
    tierMetadata: getComponentTierMetadata(crewItem),
    effects: cloneData(crewData.effects ?? {}),
    state: cloneData(crewData.state ?? {}),
    restrictions: cloneData(crewData.restrictions ?? {}),
    traits: cloneData(crewData.traits ?? []),
    notes: cloneData(crewData.notes ?? {})
  };
}

function crewAssetMatches(entry = {}, crewIdOrUuid) {
  return [
    entry.id,
    entry.itemId,
    entry.uuid,
    entry.itemUuid,
    entry.key,
    entry.identity?.id
  ].filter(Boolean).includes(crewIdOrUuid);
}

export async function addCrewAsset(shipActor, crewItem) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | addCrewAsset requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (getComponentType(crewItem) !== ARCFLIGHT_ITEM_TYPES.CREW_ASSET) {
    throw new Error("Arcflight | addCrewAsset requires an Arcflight crew asset component item.");
  }

  const systemData = getArcflightShipData(shipActor);
  const crewState = getDefaultCrewState(systemData.crew);
  const crewEntry = buildCrewAssetRosterEntry(crewItem);
  if (hasInstalledEntry(crewState.namedCrew, crewEntry)) {
    throw duplicateInstallError(crewEntry.name, crewEntry.restrictions?.unique === true ? "a unique crew roster entry" : "the crew roster");
  }

  const namedCrew = [...crewState.namedCrew, crewEntry];
  const currentGenericCrew = crewEntry.crew?.countsTowardCrewTotal === false
    ? crewState.currentGenericCrew
    : crewState.currentGenericCrew + getCrewAssetCountValue(crewEntry);
  const nextCrew = { ...crewState, namedCrew, currentGenericCrew };
  const tierSystemData = foundry.utils.mergeObject(cloneData(systemData), { crew: nextCrew }, { inplace: false });
  const tierUpdatePaths = getTierFrameworkUpdatePaths(tierSystemData);
  const nextInstallState = buildInstallStateWithComponent(systemData, shipActor, crewItem, ARCFLIGHT_ITEM_TYPES.CREW_ASSET, "native", tierUpdatePaths[`flags.${ARCFLIGHT_MODULE_ID}.system.tier`]);
  return shipActor.update({
    ...tierUpdatePaths,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.namedCrew`]: namedCrew,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.currentGenericCrew`]: currentGenericCrew,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.crewAssets`]: namedCrew.map((crewAsset) => crewAsset.name).join(", "),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: nextInstallState
  });
}

export async function removeInstalledCrewAsset(shipActor, crewIdOrUuid) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | removeCrewAsset requires an Arcflight-enabled PF2E vehicle actor.");
  }

  const systemData = getArcflightShipData(shipActor);
  const crewState = getDefaultCrewState(systemData.crew);
  const removed = crewState.namedCrew.find((entry) => crewAssetMatches(entry, crewIdOrUuid));

  if (!removed) return shipActor;

  const namedCrew = crewState.namedCrew.filter((entry) => !crewAssetMatches(entry, crewIdOrUuid));
  const currentGenericCrew = removed.crew?.countsTowardCrewTotal === false
    ? crewState.currentGenericCrew
    : Math.max(0, crewState.currentGenericCrew - getCrewAssetCountValue(removed));
  const nextCrew = { ...crewState, namedCrew, currentGenericCrew };
  const { installState } = buildInstallStateWithDeactivatedEntry(systemData, removed, ARCFLIGHT_ITEM_TYPES.CREW_ASSET, "removed");
  const tierSystemData = foundry.utils.mergeObject(cloneData(systemData), { crew: nextCrew, installState }, { inplace: false });
  await shipActor.update({
    ...getTierFrameworkUpdatePaths(tierSystemData),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.namedCrew`]: namedCrew,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.currentGenericCrew`]: currentGenericCrew,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.crewAssets`]: namedCrew.map((crewAsset) => crewAsset.name).join(", "),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: installState
  });

  return recalculateShipStats(shipActor);
}

export const removeCrewAsset = removeInstalledCrewAsset;

export async function assignStation(shipActor, stationKey, assignee = null, options = {}) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | assignStation requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (!getStation(stationKey)) {
    throw new Error(`Arcflight | Unknown station key: ${stationKey}`);
  }

  const systemData = getArcflightShipData(shipActor);
  const stations = getDefaultStationState(systemData.stations);
  const assignment = buildStationAssignment(stationKey, assignee, options);

  stations.assignments[stationKey] = assignment;

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.stations`]: stations
  });
}

export async function clearStationAssignment(shipActor, stationKey) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | clearStationAssignment requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (!getStation(stationKey)) {
    throw new Error(`Arcflight | Unknown station key: ${stationKey}`);
  }

  const systemData = getArcflightShipData(shipActor);
  const stations = getDefaultStationState(systemData.stations);
  stations.assignments[stationKey] = null;

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.stations`]: stations
  });
}

export const installHullOnShip = installHull;
export const installArkengineOnShip = installArkengine;
export const installArkengineModOnShip = installArkengineMod;
export const installRoomOnShip = installRoom;
export const installShipUpgradeOnShip = installShipUpgrade;
