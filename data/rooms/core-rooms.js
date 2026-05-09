const ROOM_TYPES = Object.freeze({
  CRAFTING: "crafting",
  RECOVERY: "recovery",
  SURVIVAL: "survival",
  UTILITY: "utility",
  SOCIAL: "social",
  LOGISTICS: "logistics",
  OCCULT: "occult",
  LUXURY: "luxury",
  CONTAINMENT: "containment"
});

const SYSTEM_STATES = Object.freeze({
  FUNCTIONAL: "Functional",
  DAMAGED: "Damaged",
  DISABLED: "Disabled",
  DESTROYED: "Destroyed"
});

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function room({
  id,
  displayName,
  roomType,
  rarity = "common",
  origin = "Arcflight Phase 4 Room Framework",
  role,
  description,
  expansionSlotsRequired = 1,
  canInstallDuringTravel = false,
  requiresPortOrDock = true,
  installCost = "GM-defined",
  installTimeDays = 0,
  playerAssistCostReductionMaxPercent = 0,
  downtimeFunctions = [],
  enabledActivities = [],
  supportedSkills = [],
  craftingTags = [],
  recoveryTags = [],
  repairTags = [],
  socialTags = [],
  survivalTags = [],
  allowedInCombat = false,
  allowedDuringTravelEvent = false,
  outsideCombatDcModifier = 0,
  outsideCombatRecoveryModifier = 0,
  outsideCombatCraftingModifier = 0,
  mechanicalNotes = "Rooms provide downtime, logistical, narrative, or recovery support only; they do not grant direct combat or travel stat bonuses.",
  supplyCostPerVoyage = 0,
  crewRequired = 0,
  upkeepNotes = "",
  systemState = SYSTEM_STATES.FUNCTIONAL,
  noDirectCombatBonuses = true,
  noDirectTravelStatBonuses = true,
  oneRoomPerExpansionSlot = true,
  traits = [],
  designIntent = "Ship infrastructure for downtime, narrative identity, logistics, recovery, and support scenes.",
  gmNotes = ""
}) {
  return deepFreeze({
    componentType: "room",
    identity: {
      id,
      displayName,
      roomType,
      rarity,
      origin,
      role,
      description
    },
    installation: {
      expansionSlotsRequired,
      canInstallDuringTravel,
      requiresPortOrDock,
      installCost,
      installTimeDays,
      playerAssistCostReductionMaxPercent
    },
    utility: {
      downtimeFunctions,
      enabledActivities,
      supportedSkills,
      craftingTags,
      recoveryTags,
      repairTags,
      socialTags,
      survivalTags
    },
    mechanicalEffects: {
      allowedInCombat,
      allowedDuringTravelEvent,
      outsideCombatDcModifier,
      outsideCombatRecoveryModifier,
      outsideCombatCraftingModifier,
      notes: mechanicalNotes
    },
    upkeep: {
      supplyCostPerVoyage,
      crewRequired,
      notes: upkeepNotes
    },
    state: {
      systemState
    },
    restrictions: {
      noDirectCombatBonuses,
      noDirectTravelStatBonuses,
      oneRoomPerExpansionSlot
    },
    traits,
    notes: {
      designIntent,
      gmNotes
    }
  });
}

function coreRoom(id, displayName, role, description, tags = []) {
  return room({
    id,
    displayName,
    roomType: ROOM_TYPES.UTILITY,
    role,
    description,
    expansionSlotsRequired: 0,
    downtimeFunctions: tags,
    enabledActivities: tags,
    traits: ["core-room", "hull-provided", ...tags],
    designIntent: "Mandatory ship infrastructure provided by every standard Arcflight hull; does not consume expansion room slots.",
    gmNotes: "Core rooms support scenes and future targeting hooks but are not optional expansion upgrades."
  });
}

export const LOCKED_CORE_ROOM_KEYS = Object.freeze([
  "arkengine-chamber",
  "helm",
  "crew-quarters",
  "galley-and-mess",
  "cargo-hold",
  "officer-wardroom"
]);

export const LOCKED_CORE_ROOMS = Object.freeze({
  "arkengine-chamber": coreRoom(
    "arkengine-chamber",
    "Arkengine Chamber",
    "Arkengine infrastructure and engineering access",
    "Houses arkengine infrastructure and engineering access for maintenance scenes, repair narration, and future critical damage targeting.",
    ["engineering", "maintenance", "repairNarration"]
  ),
  helm: coreRoom(
    "helm",
    "Helm",
    "Command, navigation, steering, and observation deck",
    "Houses navigation, piloting, command, and watch functions for Captain, Pilot, Navigator, and Watchmaster scenes.",
    ["command", "navigation", "watch"]
  ),
  "crew-quarters": coreRoom(
    "crew-quarters",
    "Crew Quarters",
    "Crew sleeping, rest, habitation, lockers, and personal storage",
    "Supports crew rest and morale narration as standard ship habitation.",
    ["rest", "habitation", "morale"]
  ),
  "galley-and-mess": coreRoom(
    "galley-and-mess",
    "Galley & Mess",
    "Food preparation and communal gathering",
    "Supports morale scenes and shipboard social events through food preparation and shared gathering space.",
    ["food", "morale", "social"]
  ),
  "cargo-hold": coreRoom(
    "cargo-hold",
    "Cargo Hold",
    "Primary operational storage",
    "Stores supplies, spare parts, trade goods, salvage, fuel materials, and special cargo for cargo, salvage, and supply systems.",
    ["cargo", "salvage", "supplies"]
  ),
  "officer-wardroom": coreRoom(
    "officer-wardroom",
    "Officer Wardroom",
    "Planning table, maps, officer seating, and briefing space",
    "Supports PC planning scenes and command narration.",
    ["planning", "briefing", "command"]
  )
});

export const STARTER_EXPANSION_ROOMS = Object.freeze({
  workshop: room({
    id: "workshop",
    displayName: "Workshop",
    roomType: ROOM_TYPES.CRAFTING,
    role: "Crafting and repair infrastructure",
    description: "A shipboard workshop for crafting, repair support, and salvage refinement during downtime and dock work.",
    downtimeFunctions: ["crafting", "repairSupport", "salvageRefinement"],
    enabledActivities: ["craftGear", "repairEquipment", "refineSalvage"],
    supportedSkills: ["crafting"],
    craftingTags: ["mundane", "mechanical", "shipParts"],
    repairTags: ["hull", "weapon", "room", "shipUpgrade"],
    outsideCombatDcModifier: -2,
    outsideCombatCraftingModifier: 1,
    mechanicalNotes: "Benefits apply only to downtime, dock work, and non-combat repair/crafting scenes.",
    traits: ["expansion-room", "crafting", "repair"]
  }),
  "alchemy-lab": room({
    id: "alchemy-lab",
    displayName: "Alchemy Lab",
    roomType: ROOM_TYPES.CRAFTING,
    role: "Potions, bombs, reagents, and alchemical crafting",
    description: "A controlled shipboard laboratory for alchemical downtime work and reagent handling.",
    downtimeFunctions: ["alchemy", "crafting", "reagentPreparation"],
    enabledActivities: ["craftAlchemy", "prepareReagents"],
    supportedSkills: ["crafting"],
    craftingTags: ["alchemy", "consumables", "reagents"],
    traits: ["expansion-room", "crafting", "alchemy"]
  }),
  infirmary: room({
    id: "infirmary",
    displayName: "Infirmary",
    roomType: ROOM_TYPES.RECOVERY,
    role: "Treat wounds, disease, and injury recovery",
    description: "A dedicated recovery space for treatment, triage, and longer-term care outside combat.",
    downtimeFunctions: ["recovery", "triage", "longTermCare"],
    enabledActivities: ["treatWounds", "treatDisease", "recoverInjury"],
    supportedSkills: ["medicine"],
    recoveryTags: ["wounds", "disease", "injury"],
    traits: ["expansion-room", "recovery", "medical"]
  }),
  greenhouse: room({
    id: "greenhouse",
    displayName: "Greenhouse",
    roomType: ROOM_TYPES.SURVIVAL,
    role: "Supply support and long-voyage sustainability",
    description: "A shipboard growing space that supports supplies and voyage sustainability without increasing travel speed.",
    downtimeFunctions: ["cultivation", "supplySupport"],
    enabledActivities: ["growFood", "tendPlants"],
    supportedSkills: ["nature", "survival"],
    survivalTags: ["food", "plants", "sustainability"],
    traits: ["expansion-room", "survival", "supplies"]
  }),
  observatory: room({
    id: "observatory",
    displayName: "Observatory",
    roomType: ROOM_TYPES.UTILITY,
    role: "Research, scouting prep, and navigation support",
    description: "Observation instruments and star charts for research, scouting preparation, and navigation support without direct speed bonuses.",
    downtimeFunctions: ["research", "scoutingPreparation", "navigationSupport"],
    enabledActivities: ["studyRoute", "prepareScoutBriefing"],
    supportedSkills: ["astronomy", "nature", "survival"],
    survivalTags: ["navigation", "scouting"],
    traits: ["expansion-room", "utility", "navigation"]
  }),
  shrine: room({
    id: "shrine",
    displayName: "Shrine",
    roomType: `${ROOM_TYPES.SOCIAL}/${ROOM_TYPES.OCCULT}`,
    role: "Morale, rituals, and spiritual support",
    description: "A sacred or contemplative space for morale scenes, rites, and spiritual support without combat bonuses.",
    downtimeFunctions: ["ritualSupport", "morale", "spiritualCare"],
    enabledActivities: ["performRite", "holdService"],
    supportedSkills: ["religion", "occultism"],
    socialTags: ["morale", "community"],
    traits: ["expansion-room", "social", "occult"]
  }),
  archive: room({
    id: "archive",
    displayName: "Archive",
    roomType: ROOM_TYPES.UTILITY,
    role: "Research, lore, and Recall Knowledge support",
    description: "A compact shipboard archive for research and lore scenes outside combat.",
    downtimeFunctions: ["research", "lore", "recordkeeping"],
    enabledActivities: ["researchLore", "prepareBriefing"],
    supportedSkills: ["arcana", "occultism", "religion", "society"],
    socialTags: ["records"],
    traits: ["expansion-room", "utility", "research"]
  }),
  "expanded-cargo-hold": room({
    id: "expanded-cargo-hold",
    displayName: "Expanded Cargo Hold",
    roomType: ROOM_TYPES.LOGISTICS,
    role: "Increases abstract cargo handling and storage",
    description: "Additional logistical infrastructure for cargo handling and storage hooks without combat or travel optimization.",
    downtimeFunctions: ["cargoHandling", "logistics"],
    enabledActivities: ["sortCargo", "secureSpecialCargo"],
    supportedSkills: ["crafting", "society"],
    survivalTags: ["supplies"],
    traits: ["expansion-room", "logistics", "cargo"]
  }),
  brig: room({
    id: "brig",
    displayName: "Brig",
    roomType: ROOM_TYPES.CONTAINMENT,
    role: "Prisoners and dangerous passengers",
    description: "A secure containment space for prisoners, dangerous passengers, and narrative custody scenes.",
    downtimeFunctions: ["containment", "custody"],
    enabledActivities: ["securePrisoner", "guardDangerousPassenger"],
    supportedSkills: ["intimidation", "society"],
    traits: ["expansion-room", "containment"]
  }),
  "luxury-quarters": room({
    id: "luxury-quarters",
    displayName: "Luxury Quarters",
    roomType: `${ROOM_TYPES.SOCIAL}/${ROOM_TYPES.LUXURY}`,
    role: "Morale, diplomacy, and VIP transport",
    description: "Comfortable quarters for morale scenes, diplomacy, and VIP transport without combat bonuses.",
    downtimeFunctions: ["morale", "diplomacy", "vipTransport"],
    enabledActivities: ["hostGuest", "negotiateAboard"],
    supportedSkills: ["diplomacy", "society"],
    socialTags: ["morale", "diplomacy", "vip"],
    traits: ["expansion-room", "social", "luxury"]
  })
});

export const CORE_ROOMS = Object.freeze({
  ...LOCKED_CORE_ROOMS,
  ...STARTER_EXPANSION_ROOMS
});

export const CORE_ROOM_KEYS = Object.freeze(Object.keys(CORE_ROOMS));

export function getCoreRoomKeys() {
  return CORE_ROOM_KEYS;
}

export function getCoreRoom(roomKey) {
  return CORE_ROOMS[roomKey] ?? null;
}

export function getLockedCoreRoomKeys() {
  return LOCKED_CORE_ROOM_KEYS;
}

export function getLockedCoreRoom(roomKey) {
  return LOCKED_CORE_ROOMS[roomKey] ?? null;
}
