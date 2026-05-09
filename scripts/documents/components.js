import {
  ARCFLIGHT_ARKENGINE_CLASSES,
  ARCFLIGHT_ITEM_TYPES,
  ARCFLIGHT_MODULE_ID,
  ARCFLIGHT_RELOAD_STATES,
  ARCFLIGHT_SUGGESTED_WEAPON_TYPES,
  ARCFLIGHT_WEAPON_ARCS,
  ARCFLIGHT_WEAPON_SIZE_DEFAULTS,
  ARCFLIGHT_WEAPON_SIZES
} from "../config/constants.js";

export const ARCFLIGHT_COMPONENT_ITEM_TYPE = "equipment";

const commonComponentData = Object.freeze({
  tags: "",
  traits: "",
  source: "",
  notes: ""
});

export const arcflightComponentTypeLabels = Object.freeze({
  [ARCFLIGHT_ITEM_TYPES.HULL]: "Arcflight Component: Hull",
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE]: "Arcflight Component: Arkengine",
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: "Arcflight Component: Arkengine Mod",
  [ARCFLIGHT_ITEM_TYPES.WEAPON]: "Arcflight Component: Weapon",
  [ARCFLIGHT_ITEM_TYPES.ROOM]: "Arcflight Component: Room",
  [ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE]: "Arcflight Component: Ship Upgrade",
  [ARCFLIGHT_ITEM_TYPES.CARGO]: "Arcflight Component: Cargo",
  [ARCFLIGHT_ITEM_TYPES.CREW_ASSET]: "Arcflight Component: Crew Asset"
});

export const arcflightComponentDefaults = Object.freeze({
  [ARCFLIGHT_ITEM_TYPES.HULL]: Object.freeze({
    ...commonComponentData,
    hullIntegrity: "",
    lifeveil: "",
    crewLimits: "",
    weaponMounts: "",
    roomSlots: "",
    arkengineCompatibility: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE]: Object.freeze({
    ...commonComponentData,
    identity: {
      engineClass: ARCFLIGHT_ARKENGINE_CLASSES.STANDARD,
      model: "",
      manufacturer: "",
      grade: "",
      spellRankRequirement: 0
    },
    fueling: {
      fuelType: "",
      fuelCapacity: 0,
      fuelCurrent: 0,
      consumption: "",
      refuelNotes: ""
    },
    voyage: {
      rating: 0,
      speed: "",
      endurance: "",
      navigationNotes: ""
    },
    lifeveil: {
      output: 0,
      stability: 0,
      supportedCrew: 0,
      notes: ""
    },
    strain: {
      capacity: 0,
      current: 0,
      recovery: "",
      thresholdNotes: ""
    },
    overcharge: {
      enabled: false,
      limit: 0,
      risk: "",
      notes: ""
    },
    mods: {
      slots: 0,
      installed: "",
      notes: ""
    },
    subsystems: {
      conduits: "",
      stabilizers: "",
      regulators: "",
      notes: ""
    },
    traits: "",
    notes: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: Object.freeze({
    ...commonComponentData,
    modCategory: "",
    compatibleEngineClasses: "",
    effectSummary: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.WEAPON]: Object.freeze({
    ...commonComponentData,
    identity: {
      weaponType: ARCFLIGHT_SUGGESTED_WEAPON_TYPES.BALLISTA,
      size: ARCFLIGHT_WEAPON_SIZES.LIGHT,
      model: "",
      manufacturer: "",
      grade: ""
    },
    mounting: {
      arc: ARCFLIGHT_WEAPON_ARCS.FORE,
      mountSlots: ARCFLIGHT_WEAPON_SIZE_DEFAULTS[ARCFLIGHT_WEAPON_SIZES.LIGHT].mountSlots,
      mountType: "",
      notes: ""
    },
    attack: {
      bonus: 0,
      damage: "",
      damageType: "",
      critical: "",
      notes: ""
    },
    rangeBands: {
      close: 0,
      near: 0,
      far: 0,
      extreme: 0,
      notes: ""
    },
    reload: {
      state: ARCFLIGHT_RELOAD_STATES.READY,
      actions: 0,
      value: "",
      notes: ""
    },
    crew: {
      required: ARCFLIGHT_WEAPON_SIZE_DEFAULTS[ARCFLIGHT_WEAPON_SIZES.LIGHT].crewRequired,
      station: "",
      notes: ""
    },
    strain: {
      cost: ARCFLIGHT_WEAPON_SIZE_DEFAULTS[ARCFLIGHT_WEAPON_SIZES.LIGHT].strainCost,
      generated: 0,
      notes: ""
    },
    shipStatModifiers: {
      hull: 0,
      lifeveil: 0,
      speed: 0,
      handling: 0,
      notes: ""
    },
    traits: "",
    installation: {
      installed: false,
      installedOn: "",
      slot: "",
      notes: ""
    },
    state: {
      armed: false,
      disabled: false,
      condition: "",
      notes: ""
    },
    notes: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.ROOM]: Object.freeze({
    ...commonComponentData,
    roomCategory: "",
    utilitySummary: "",
    downtimePlaceholder: "",
    craftingPlaceholder: "",
    recoveryPlaceholder: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE]: Object.freeze({
    ...commonComponentData,
    upgradeCategory: "",
    installLocation: "",
    effectSummary: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.CARGO]: Object.freeze({
    ...commonComponentData,
    cargoUnits: "",
    specialHandlingNotes: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.CREW_ASSET]: Object.freeze({
    ...commonComponentData,
    role: "",
    stationAffinity: "",
    factionIdentity: "",
    specialistAction: ""
  })
});

const arcflightDocumentTypeToComponentType = Object.freeze(
  Object.fromEntries(Object.values(ARCFLIGHT_ITEM_TYPES).map((componentType) => [`${ARCFLIGHT_MODULE_ID}.${componentType}`, componentType]))
);

export function normalizeArcflightComponentType(componentType) {
  const normalizedType = arcflightDocumentTypeToComponentType[componentType] ?? componentType;
  if (!arcflightComponentDefaults[normalizedType]) {
    throw new Error(`Arcflight | ${componentType} is not a supported Arcflight component type.`);
  }

  return normalizedType;
}

export function getDefaultArcflightComponentData(componentType) {
  return foundry.utils.deepClone(arcflightComponentDefaults[normalizeArcflightComponentType(componentType)]);
}

export function getDefaultArcflightComponentFlags(componentType, data = {}) {
  const normalizedType = normalizeArcflightComponentType(componentType);
  return {
    enabled: true,
    componentType: normalizedType,
    system: foundry.utils.mergeObject(getDefaultArcflightComponentData(normalizedType), data, { inplace: false })
  };
}

function getArcflightFlag(item, key) {
  // Arcflight component metadata lives on document flags, never PF2E system data.
  return item?.flags?.[ARCFLIGHT_MODULE_ID]?.[key] ?? item?.getFlag?.(ARCFLIGHT_MODULE_ID, key);
}

export function getArcflightComponentFlags(item) {
  const directFlags = item?.flags?.[ARCFLIGHT_MODULE_ID] ?? {};

  return {
    enabled: getArcflightFlag(item, "enabled"),
    componentType: getArcflightFlag(item, "componentType"),
    system: getArcflightFlag(item, "system") ?? directFlags.system ?? {}
  };
}

export function isArcflightItem(item) {
  return item?.type === ARCFLIGHT_COMPONENT_ITEM_TYPE && getArcflightFlag(item, "enabled") === true;
}

export function getComponentType(item) {
  if (!isArcflightItem(item)) return null;

  const componentType = getArcflightFlag(item, "componentType");
  return arcflightComponentDefaults[componentType] ? componentType : null;
}

export function getComponentData(item) {
  const componentType = getComponentType(item);
  if (!componentType) return null;

  const flagData = getArcflightFlag(item, "system") ?? {};
  return foundry.utils.mergeObject(getDefaultArcflightComponentData(componentType), flagData, { inplace: false });
}
