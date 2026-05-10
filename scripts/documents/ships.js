import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getComponentData, getComponentType } from "./components.js";
import { getLockedCoreRoom, getLockedCoreRoomKeys } from "../../data/rooms/core-rooms.js";
import { CORE_STATIONS, STATION_KEYS, getStation } from "../../data/stations/core-stations.js";

export const ARCFLIGHT_SHIP_ACTOR_TYPE = "arcflightShip";

const emptyInstalledState = Object.freeze({
  hullItemId: "",
  hullUuid: "",
  hullPlatform: "",
  hullName: "",
  arkengineItemId: "",
  arkengineUuid: "",
  arkengineKey: "",
  arkengineName: "",
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
  morale: 0
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
  arkengineStrainModifier: 0
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
  base: emptyBaseShipState,
  derived: emptyDerivedShipState,
  current: emptyCurrentShipState,
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
  crew: Object.freeze({
    minimum: 0,
    recommended: 0,
    maximum: 0,
    current: 0,
    roster: "",
    notes: ""
  }),
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

function buildActorStationAssignment(stationKey, assignee, options = {}) {
  if (!assignee) return null;

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

function getInstalledArkengineMods(installed = {}) {
  return Array.isArray(installed.arkengineMods) ? cloneData(installed.arkengineMods) : [];
}

function getArkengineModSlotCost(mod = {}) {
  return numericValue(mod.modSlotsRequired ?? mod.installation?.modSlotsRequired, 1);
}

function getArkengineModSlotState(arkengine = {}, installed = {}) {
  const capacity = numericValue(arkengine.modSlots);
  const used = getInstalledArkengineMods(installed).reduce((total, mod) => total + getArkengineModSlotCost(mod), 0);

  return {
    capacity,
    used,
    available: capacity - used
  };
}

function getInstalledRooms(installed = {}) {
  return Array.isArray(installed.rooms) ? cloneData(installed.rooms) : [];
}

function getRoomSlotState(hull = {}, installed = {}) {
  const capacity = numericValue(hull.rooms?.expansionSlots);
  const used = getInstalledRooms(installed).reduce((total, room) => total + numericValue(room.expansionSlotsRequired, 1), 0);

  return {
    capacity,
    used,
    available: capacity - used
  };
}

function getInstalledShipUpgrades(installed = {}) {
  return Array.isArray(installed.shipUpgrades) ? cloneData(installed.shipUpgrades) : [];
}

function getShipUpgradeSlotState(installed = {}) {
  const existingCapacity = Number(installed.shipUpgradeSlots?.capacity);
  const capacity = Number.isFinite(existingCapacity) ? existingCapacity : 3;
  const used = getInstalledShipUpgrades(installed).reduce((total, upgrade) => total + numericValue(upgrade.slotCost, 1), 0);

  return {
    capacity,
    used,
    available: capacity - used
  };
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
    effects: cloneData(upgradeData.effects ?? {}),
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
  "arkengineModSlots"
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
    mechanicalEffects: cloneData(roomData.mechanicalEffects ?? {}),
    traits: cloneData(roomData.traits ?? [])
  };
}

function deriveShipStatsFromBase(base = {}, installed = {}) {
  const hull = cloneData(base.hull ?? {});
  const arkengine = cloneData(base.arkengine ?? {});
  const arkengineModSlots = getArkengineModSlotState(arkengine, installed);
  const roomSlots = getRoomSlotState(hull, installed);
  const coreRooms = getCoreRoomsFromHull(hull);
  const derived = foundry.utils.mergeObject(cloneData(emptyDerivedShipState), hull, { inplace: false });

  derived.lifeveilCapacity = numericValue(hull.lifeveilCapacity) + numericValue(arkengine.lifeveilModifier);
  derived.strainCapacity = numericValue(hull.strainCapacity) + numericValue(arkengine.strainModifier);
  derived.voyageSpeedTravelHexDays = numericValue(arkengine.travelHexDays);
  derived.resistanceTendencies = Array.isArray(arkengine.resistanceTendencies)
    ? cloneData(arkengine.resistanceTendencies)
    : [];
  derived.arkengineVariantFamily = arkengine.variantFamily ?? "";
  derived.arkengineModSlots = arkengineModSlots.capacity;
  derived.arkengineModSlotsUsed = arkengineModSlots.used;
  derived.arkengineModSlotsAvailable = arkengineModSlots.available;
  derived.hardBurnStrainCost = numericValue(arkengine.hardBurnStrainCost);
  derived.overchargeRisk = arkengine.overchargeRisk ?? "";
  derived.spellRankRequired = arkengine.spellRankRequired ?? 0;
  derived.arkengineLifeveilModifier = numericValue(arkengine.lifeveilModifier);
  derived.arkengineStrainModifier = numericValue(arkengine.strainModifier);

  applyArkengineModDerivedStatModifiers(derived, installed);

  derived.energyResistances = cloneData(derived.resistanceTendencies);
  derived.arkengineModSlotsUsed = arkengineModSlots.used;
  derived.arkengineModSlotsAvailable = numericValue(derived.arkengineModSlots) - arkengineModSlots.used;
  derived.rooms = foundry.utils.mergeObject(cloneData(derived.rooms ?? {}), {
    coreRooms,
    expansionSlots: roomSlots.capacity,
    expansionSlotsUsed: roomSlots.used,
    expansionSlotsAvailable: roomSlots.available
  }, { inplace: false });
  applyShipUpgradeDerivedStatModifiers(derived, installed);

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

  return systemData;
}

export function getDefaultArcflightShipFlags(data = {}) {
  const system = foundry.utils.mergeObject(getDefaultArcflightShipData(), data, { inplace: false });
  system.stations = getDefaultStationState(system.stations);

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
  const derived = calculateDerivedShipStats(systemData.base, systemData.installed);
  const arkengineModSlots = getArkengineModSlotState(systemData.base?.arkengine, systemData.installed);
  const roomSlots = getRoomSlotState(systemData.base?.hull, systemData.installed);
  const shipUpgradeSlots = getShipUpgradeSlotState(systemData.installed);
  const coreRooms = getCoreRoomsFromHull(systemData.base?.hull);
  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );

  const existingCurrent = cloneData(systemData.current ?? {});
  const current = foundry.utils.mergeObject(cloneData(emptyCurrentShipState), existingCurrent, { inplace: false });
  const legacyResources = buildLegacyResources(systemData, current, derived);

  const stations = getDefaultStationState(systemData.stations);

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.stations`]: stations,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.arkengineModSlots`]: arkengineModSlots,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.roomSlots`]: roomSlots,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed.shipUpgradeSlots`]: shipUpgradeSlots,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats
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
  const baseHull = cloneData(getComponentData(hullItem));
  const baseArkengine = cloneData(systemData.base?.arkengine ?? {});
  const coreRooms = getCoreRoomsFromHull(baseHull);
  const nextInstalled = foundry.utils.mergeObject(cloneData(systemData.installed ?? {}), {
    hullItemId: hullItem.id ?? "",
    hullUuid: hullItem.uuid ?? "",
    hullPlatform: baseHull.platform ?? "",
    hullName: hullItem.name ?? baseHull.platform ?? "",
    coreRooms
  }, { inplace: false });
  nextInstalled.roomSlots = getRoomSlotState(baseHull, nextInstalled);
  nextInstalled.shipUpgradeSlots = getShipUpgradeSlotState(nextInstalled);
  const derived = calculateDerivedShipStats({ hull: baseHull, arkengine: baseArkengine, coreRooms }, nextInstalled);
  const firstHullInstall = !hasInstalledHull(rawSystemData);
  const existingCurrent = cloneData(rawSystemData.current ?? {});
  const current = foundry.utils.mergeObject(cloneData(emptyCurrentShipState), existingCurrent, { inplace: false });

  if (firstHullInstall || !hasRuntimeValue(existingCurrent, "hull")) current.hull = derived.hullIntegrity ?? 0;
  if (firstHullInstall || !hasRuntimeValue(existingCurrent, "lifeveil")) current.lifeveil = derived.lifeveilCapacity ?? 0;
  if (firstHullInstall || !hasRuntimeValue(existingCurrent, "strain")) current.strain = 0;
  if (!hasRuntimeValue(existingCurrent, "morale")) current.morale = systemData.resources?.morale ?? 0;

  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );
  const legacyResources = buildLegacyResources(systemData, current, derived);

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: nextInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.hull`]: baseHull,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: current,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.hull`]: hullItem.name ?? baseHull.platform ?? "",
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.minimum`]: derived.crew?.minimum ?? 0,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.recommended`]: derived.crew?.recommended ?? 0,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.crew.maximum`]: derived.crew?.maximum ?? 0,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.cargo.capacity`]: derived.cargoCapacity ?? 0
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
  const baseHull = cloneData(systemData.base?.hull ?? {});
  const baseArkengine = cloneData(getComponentData(arkengineItem));
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
  const firstArkengineInstall = !hasInstalledArkengine(rawSystemData);
  const existingCurrent = cloneData(rawSystemData.current ?? {});
  const current = foundry.utils.mergeObject(cloneData(emptyCurrentShipState), existingCurrent, { inplace: false });

  if (!hasRuntimeValue(existingCurrent, "hull")) current.hull = derived.hullIntegrity ?? 0;
  if (firstArkengineInstall && !hasRuntimeValue(existingCurrent, "lifeveil")) current.lifeveil = derived.lifeveilCapacity ?? 0;
  if (!hasRuntimeValue(existingCurrent, "strain")) current.strain = 0;
  if (!hasRuntimeValue(existingCurrent, "morale")) current.morale = systemData.resources?.morale ?? 0;

  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );
  const legacyResources = buildLegacyResources(systemData, current, derived);

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: nextInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.arkengine`]: baseArkengine,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.current`]: current,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.arkengine`]: arkengineItem.name ?? baseArkengine.displayName ?? baseArkengine.engineClass ?? "",
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats
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
  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );
  const existingCurrent = cloneData(systemData.current ?? {});
  const current = foundry.utils.mergeObject(cloneData(emptyCurrentShipState), existingCurrent, { inplace: false });
  const legacyResources = buildLegacyResources(systemData, current, derived);

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: nextInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.arkengineMods`]: nextInstalled.arkengineMods.map((mod) => mod.name).join(", ")
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
  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: nextInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.rooms`]: nextInstalled.rooms.map((room) => room.name).join(", ")
  });
}

export async function installShipUpgrade(shipActor, upgradeItem) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | installShipUpgrade requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (getComponentType(upgradeItem) !== ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE) {
    throw new Error("Arcflight | installShipUpgrade requires an Arcflight ship upgrade component item.");
  }

  const systemData = getArcflightShipData(shipActor);
  const baseHull = cloneData(systemData.base?.hull ?? {});
  const baseArkengine = cloneData(systemData.base?.arkengine ?? {});
  const coreRooms = getCoreRoomsFromHull(baseHull);
  const installedShipUpgrades = getInstalledShipUpgrades(systemData.installed);
  const upgradeEntry = buildInstalledShipUpgradeEntry(upgradeItem);
  const nextInstalled = foundry.utils.mergeObject(cloneData(systemData.installed ?? {}), {
    coreRooms,
    shipUpgrades: [...installedShipUpgrades, upgradeEntry]
  }, { inplace: false });

  nextInstalled.roomSlots = getRoomSlotState(baseHull, nextInstalled);
  nextInstalled.shipUpgradeSlots = getShipUpgradeSlotState(nextInstalled);

  if (nextInstalled.shipUpgradeSlots.available < 0) {
    throw new Error("Arcflight | installShipUpgrade would exceed this ship's upgrade slot capacity.");
  }

  const derived = calculateDerivedShipStats({ hull: baseHull, arkengine: baseArkengine, coreRooms }, nextInstalled);
  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );
  const existingCurrent = cloneData(systemData.current ?? {});
  const current = foundry.utils.mergeObject(cloneData(emptyCurrentShipState), existingCurrent, { inplace: false });
  const legacyResources = buildLegacyResources(systemData, current, derived);

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: nextInstalled,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.coreRooms`]: coreRooms,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.resources`]: legacyResources,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derivedStats`]: legacyDerivedStats,
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installedSystems.shipUpgrades`]: nextInstalled.shipUpgrades.map((upgrade) => upgrade.name).join(", "),
    [`flags.${ARCFLIGHT_MODULE_ID}.system.cargo.capacity`]: derived.cargoCapacity ?? 0
  });
}


export async function assignStation(shipActor, stationKey, assignee = null, options = {}) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | assignStation requires an Arcflight-enabled PF2E vehicle actor.");
  }

  if (!getStation(stationKey)) {
    throw new Error(`Arcflight | Unknown station key: ${stationKey}`);
  }

  const systemData = getArcflightShipData(shipActor);
  const stations = getDefaultStationState(systemData.stations);
  const assignment = buildActorStationAssignment(stationKey, assignee, options);

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
