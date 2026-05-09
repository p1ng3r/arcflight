import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getComponentData, getComponentType } from "./components.js";

export const ARCFLIGHT_SHIP_ACTOR_TYPE = "arcflightShip";

const emptyInstalledHull = Object.freeze({
  hullItemId: "",
  hullUuid: "",
  hullPlatform: "",
  hullName: ""
});

const emptyCurrentShipState = Object.freeze({
  hull: 0,
  lifeveil: 0,
  strain: 0,
  morale: 0
});

const emptyBaseShipState = Object.freeze({
  hull: Object.freeze({})
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
  designNotes: ""
});

export const arcflightShipDefaults = Object.freeze({
  identity: Object.freeze({
    vesselClass: "",
    registry: "",
    callsign: "",
    owner: "",
    origin: ""
  }),
  installed: emptyInstalledHull,
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

function countWeaponMountsByArc(weaponMounts = {}) {
  return Object.values(weaponMounts).reduce((total, mounts) => total + (Array.isArray(mounts) ? mounts.length : 0), 0);
}

function deriveShipStatsFromBaseHull(baseHull = {}) {
  const hull = cloneData(baseHull ?? {});
  return foundry.utils.mergeObject(cloneData(emptyDerivedShipState), hull, { inplace: false });
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

  return foundry.utils.mergeObject(getDefaultArcflightShipData(), cloneData(flagData), { inplace: false });
}

export function getDefaultArcflightShipFlags(data = {}) {
  return {
    enabled: true,
    actorType: ARCFLIGHT_SHIP_ACTOR_TYPE,
    system: foundry.utils.mergeObject(getDefaultArcflightShipData(), data, { inplace: false })
  };
}

export function calculateDerivedShipStats(base = {}) {
  return deriveShipStatsFromBaseHull(base.hull ?? {});
}

export async function recalculateShipStats(shipActor) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error("Arcflight | recalculateShipStats requires an Arcflight-enabled PF2E vehicle actor.");
  }

  const systemData = getArcflightShipData(shipActor);
  const derived = calculateDerivedShipStats(systemData.base);
  const legacyDerivedStats = foundry.utils.mergeObject(
    systemData.derivedStats ?? {},
    getLegacyDerivedStatsFromDerived(derived),
    { inplace: false }
  );

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.derived`]: derived,
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
  const derived = calculateDerivedShipStats({ hull: baseHull });
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
  const legacyResources = foundry.utils.mergeObject(systemData.resources ?? {}, {
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

  return shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.installed`]: {
      hullItemId: hullItem.id ?? "",
      hullUuid: hullItem.uuid ?? "",
      hullPlatform: baseHull.platform ?? "",
      hullName: hullItem.name ?? baseHull.platform ?? ""
    },
    [`flags.${ARCFLIGHT_MODULE_ID}.system.base.hull`]: baseHull,
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

export const installHullOnShip = installHull;
