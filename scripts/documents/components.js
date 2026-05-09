import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";

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
    tags: "",
    traits: "",
    source: "",
    identity: {
      platform: "",
      displayName: "",
      sizeCategory: "",
      role: "",
      rarity: "common",
      origin: "",
      description: ""
    },
    coreStats: {
      hullIntegrity: 0,
      armorClass: 0,
      physicalResistances: {
        bludgeoning: 0,
        piercing: 0,
        slashing: 0
      },
      strainCapacity: 0,
      lifeveilCapacity: 0,
      cargoCapacity: 0,
      detection: "",
      combatSpeed: "",
      maneuverability: "",
      baseAP: 0,
      baseRAP: 0
    },
    crew: {
      minimum: 0,
      recommended: 0,
      maximum: 0
    },
    rooms: {
      coreRooms: "",
      expansionSlots: ""
    },
    weaponMounts: {
      fore: 0,
      port: 0,
      starboard: 0,
      aft: 0
    },
    arkengineCompatibility: {
      preferred: "",
      allowed: "",
      notes: ""
    },
    rules: {
      canOperateBelowMinimumCrew: false,
      usesGeneralExpansionSlotsOnly: true,
      oneRoomPerExpansionSlot: true
    },
    notes: {
      designIntent: "",
      gmNotes: ""
    }
  }),
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE]: Object.freeze({
    ...commonComponentData,
    class: "",
    spellRankRequirement: "",
    strainCapacity: "",
    modSlots: "",
    hardBurnMetadata: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: Object.freeze({
    ...commonComponentData,
    modCategory: "",
    compatibleEngineClasses: "",
    effectSummary: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.WEAPON]: Object.freeze({
    ...commonComponentData,
    firingArcs: "",
    reload: "",
    crewRequirement: "",
    rangeBands: "",
    damageProfile: "",
    weaponTraits: ""
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
