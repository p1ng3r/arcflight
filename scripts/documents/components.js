import {
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
    platform: "",
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
    coreSystems: [],
    hardBurnProfile: "",
    overchargeProfile: ""
  }),
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: Object.freeze({
    identity: {
      modCategory: "",
      model: "",
      manufacturer: "",
      grade: ""
    },
    installation: {
      installed: false,
      installedOn: "",
      slot: "",
      requirements: "",
      notes: ""
    },
    compatibility: {
      engineClasses: "",
      engines: "",
      hulls: "",
      restrictions: "",
      notes: ""
    },
    effects: {
      statModifiers: {
        hullIntegrity: 0,
        lifeveil: 0,
        crewLimits: 0,
        weaponMounts: 0,
        roomSlots: 0,
        handling: 0,
        notes: ""
      },
      fuelingModifiers: {
        fuelCapacity: 0,
        fuelCurrent: 0,
        consumption: "",
        refuelNotes: "",
        notes: ""
      },
      strainModifiers: {
        capacity: 0,
        current: 0,
        recovery: "",
        thresholdNotes: "",
        notes: ""
      },
      lifeveilModifiers: {
        output: 0,
        stability: 0,
        supportedCrew: 0,
        energyResistanceModifiers: {
          acid: 0,
          cold: 0,
          electricity: 0,
          fire: 0,
          force: 0,
          mental: 0,
          poison: 0,
          sonic: 0,
          vitality: 0,
          void: 0,
          notes: ""
        },
        notes: ""
      },
      voyageModifiers: {
        rating: 0,
        speed: "",
        endurance: "",
        navigationNotes: "",
        notes: ""
      },
      overchargeModifiers: {
        enabled: false,
        limit: 0,
        risk: "",
        notes: ""
      }
    },
    tradeoffs: {
      strainCost: 0,
      powerDraw: 0,
      drawback: "",
      notes: ""
    },
    traits: "",
    state: {
      active: false,
      disabled: false,
      condition: "",
      notes: ""
    },
    notes: ""
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
    identity: {
      upgradeCategory: "",
      model: "",
      manufacturer: "",
      grade: ""
    },
    installation: {
      installed: false,
      installedOn: "",
      location: "",
      requirements: "",
      notes: ""
    },
    compatibility: {
      hulls: "",
      arkengines: "",
      rooms: "",
      restrictions: "",
      notes: ""
    },
    effects: {
      summary: "",
      statModifiers: "",
      resourceModifiers: "",
      special: "",
      notes: ""
    },
    limits: {
      maxInstalled: 0,
      powerDraw: 0,
      strainCost: 0,
      restrictions: "",
      notes: ""
    },
    state: {
      active: false,
      disabled: false,
      condition: "",
      notes: ""
    },
    traits: "",
    notes: ""
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
    identity: {
      role: "",
      stationAffinity: "",
      factionIdentity: "",
      title: ""
    },
    crew: {
      count: 0,
      minimum: 0,
      quality: "",
      assignment: "",
      notes: ""
    },
    capabilities: {
      primary: "",
      specialistAction: "",
      proficiencies: "",
      bonuses: "",
      notes: ""
    },
    limits: {
      upkeep: 0,
      availability: "",
      restrictions: "",
      notes: ""
    },
    state: {
      active: false,
      injured: false,
      unavailable: false,
      condition: "",
      notes: ""
    },
    traits: "",
    notes: ""
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
