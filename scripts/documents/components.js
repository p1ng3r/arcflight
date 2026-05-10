import {
  ARCFLIGHT_ITEM_TYPES,
  ARCFLIGHT_CREW_QUALITIES,
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
    componentType: ARCFLIGHT_ITEM_TYPES.HULL,
    platform: "",
    displayName: "",
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
    detection: 0,
    combatSpeed: 0,
    maneuverability: 0,
    baseAP: 0,
    baseRAP: 0,
    crew: {
      minimum: 0,
      recommended: 0,
      maximum: 0
    },
    rooms: {
      coreRooms: [],
      expansionSlots: 0
    },
    weaponMounts: {
      [ARCFLIGHT_WEAPON_ARCS.FORE]: [],
      [ARCFLIGHT_WEAPON_ARCS.PORT]: [],
      [ARCFLIGHT_WEAPON_ARCS.STARBOARD]: [],
      [ARCFLIGHT_WEAPON_ARCS.AFT]: []
    },
    arkengineCompatibility: {
      preferred: "",
      allowed: []
    },
    traits: [],
    role: "",
    designNotes: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE]: Object.freeze({
    ...commonComponentData,
    componentType: ARCFLIGHT_ITEM_TYPES.ARKENGINE,
    engineClass: "",
    displayName: "",
    spellRankRequired: 0,
    travelHexDays: 0,
    lifeveilModifier: 0,
    strainModifier: 0,
    overchargeRisk: "",
    hardBurnStrainCost: 0,
    modSlots: 0,
    resistanceTendencies: [],
    traits: [],
    variantFamily: "",
    allowedVariantFamilies: [],
    modSlotProfile: "",
    role: "",
    designNotes: "",
    ritualCircleRequired: false,
    coreSystems: [],
    fueling: {
      requiredSpellRank: 0,
      fuelSlots: 0,
      maxStoredSpellRanks: 0,
      currentStoredSpellRanks: 0,
      normalHexCostFormula: "requiredSpellRank",
      hardBurnHexCostFormula: "ceil(requiredSpellRank * 1.5)",
      leanBurnHexCostFormula: "ceil(requiredSpellRank / 2)",
      stealthBurnHexCostFormula: "ceil(requiredSpellRank * 1.5)",
      overchargeCostFormula: "definedByOverchargeAction",
      emergencySpellSlotFuelingAllowed: true
    },
    hardBurnProfile: "",
    overchargeProfile: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: Object.freeze({
    componentType: ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
    identity: {
      id: "",
      displayName: "",
      modType: "",
      rarity: "standard",
      origin: "",
      role: "",
      description: ""
    },
    installation: {
      modSlotsRequired: 1,
      requiresPortOrDock: true,
      canInstallDuringTravel: false,
      installCost: "",
      installTimeDays: 0,
      playerAssistCostReductionMaxPercent: 0
    },
    effects: {
      derivedStatModifiers: [],
      hardBurnInteractions: [],
      overchargeInteractions: [],
      fuelInteractions: [],
      lifeveilInteractions: [],
      strainInteractions: [],
      resistanceInteractions: [],
      roomInteractions: [],
      systemInteractions: []
    },
    restrictions: {
      unique: false,
      maxInstances: 1,
      requiredArkengineTags: [],
      blockedArkengineTags: [],
      requiredVariantFamilies: [],
      blockedVariantFamilies: [],
      notes: ""
    },
    state: {
      systemState: "Functional"
    },
    traits: [],
    notes: {
      designIntent: "",
      gmNotes: ""
    }
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
    componentType: ARCFLIGHT_ITEM_TYPES.ROOM,
    identity: {
      id: "",
      displayName: "",
      roomType: "utility",
      rarity: "common",
      origin: "",
      role: "",
      description: ""
    },
    installation: {
      expansionSlotsRequired: 1,
      canInstallDuringTravel: false,
      requiresPortOrDock: true,
      installCost: "",
      installTimeDays: 0,
      playerAssistCostReductionMaxPercent: 0
    },
    utility: {
      downtimeFunctions: [],
      enabledActivities: [],
      supportedSkills: [],
      craftingTags: [],
      recoveryTags: [],
      repairTags: [],
      socialTags: [],
      survivalTags: []
    },
    mechanicalEffects: {
      allowedInCombat: false,
      allowedDuringTravelEvent: false,
      outsideCombatDcModifier: 0,
      outsideCombatRecoveryModifier: 0,
      outsideCombatCraftingModifier: 0,
      notes: ""
    },
    upkeep: {
      supplyCostPerVoyage: 0,
      crewRequired: 0,
      notes: ""
    },
    state: {
      systemState: "Functional"
    },
    restrictions: {
      noDirectCombatBonuses: true,
      noDirectTravelStatBonuses: true,
      oneRoomPerExpansionSlot: true
    },
    traits: [],
    notes: {
      designIntent: "",
      gmNotes: ""
    }
  }),
  [ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE]: Object.freeze({
    componentType: ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
    identity: {
      id: "",
      displayName: "",
      upgradeType: "",
      rarity: "standard",
      origin: "",
      role: "",
      description: ""
    },
    installation: {
      requiresPortOrDock: true,
      canInstallDuringTravel: false,
      installCost: "",
      installTimeDays: 0,
      playerAssistCostReductionMaxPercent: 0
    },
    effects: {
      derivedStatModifiers: [],
      conditionInteractions: [],
      operationalEffects: [],
      systemInteractions: [],
      stationInteractions: [],
      eventInteractions: []
    },
    restrictions: {
      unique: false,
      maxInstances: 1,
      requiredHullTags: [],
      blockedHullTags: [],
      requiredArkengineTags: [],
      notes: ""
    },
    state: {
      systemState: "Functional"
    },
    traits: [],
    notes: {
      designIntent: "",
      gmNotes: ""
    }
  }),
  [ARCFLIGHT_ITEM_TYPES.CARGO]: Object.freeze({
    identity: {
      cargoType: "",
      origin: "",
      owner: "",
      manifestId: ""
    },
    cargo: {
      units: 0,
      bulk: "",
      contents: "",
      handlingNotes: ""
    },
    value: {
      price: "",
      currency: "",
      appraisalNotes: ""
    },
    storage: {
      location: "",
      container: "",
      requiredRoom: "",
      notes: ""
    },
    risk: {
      fragile: false,
      hazardous: false,
      illegal: false,
      perishable: false,
      notes: ""
    },
    use: {
      purpose: "",
      consumed: false,
      delivery: "",
      notes: ""
    },
    state: {
      secured: false,
      damaged: false,
      condition: "",
      notes: ""
    },
    traits: "",
    notes: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.CREW_ASSET]: Object.freeze({
    componentType: ARCFLIGHT_ITEM_TYPES.CREW_ASSET,
    identity: {
      id: "",
      displayName: "",
      role: "",
      title: "",
      factionIdentity: "",
      origin: "",
      description: ""
    },
    crew: {
      count: 1,
      minimum: 0,
      quality: ARCFLIGHT_CREW_QUALITIES.TRAINED,
      countsTowardCrewTotal: true,
      genericCrewEquivalent: 1,
      notes: ""
    },
    stationAssignment: {
      preferredStation: "",
      assignedStation: "",
      canAssignTo: [],
      notes: ""
    },
    capabilities: {
      primary: [],
      proficiencies: [],
      specialistTags: [],
      narrativePermissions: [],
      notes: ""
    },
    effects: {
      passiveModifiers: [],
      stationInteractions: [],
      operationalEffects: [],
      notes: ""
    },
    state: {
      active: true,
      injured: false,
      unavailable: false,
      condition: "",
      notes: ""
    },
    restrictions: {
      unique: false,
      maxInstances: 1,
      requiredShipTraits: [],
      blockedShipTraits: [],
      notes: ""
    },
    traits: [],
    notes: {
      designIntent: "",
      gmNotes: ""
    }
  })
});

export function normalizeArcflightComponentType(componentType) {
  const normalizedType = componentType;
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
