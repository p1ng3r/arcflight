const ROOM_TYPES = Object.freeze({
  CRAFTING: "crafting",
  RECOVERY: "recovery",
  SURVIVAL: "survival",
  UTILITY: "utility",
  SOCIAL: "social",
  LOGISTICS: "logistics",
  OCCULT: "occult",
  MILITARY: "military",
  NAVIGATION: "navigation",
  RESEARCH: "research",
  INDUSTRIAL: "industrial",
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

export const ADDITIONAL_EXPANSION_ROOMS = Object.freeze({
  "salvage-bay": room({
    id: "salvage-bay",
    displayName: "Salvage Bay",
    roomType: ROOM_TYPES.LOGISTICS,
    role: "Wreck recovery and salvage processing",
    description: "A reinforced shipboard work bay for sorting wreckage, processing salvage, and staging recovery crews after an expedition or dockside haul.",
    downtimeFunctions: ["wreckRecovery", "salvageProcessing", "materialsSorting"],
    enabledActivities: ["processSalvage", "catalogRecoveredParts", "stageRecoveryGear"],
    supportedSkills: ["crafting", "society"],
    craftingTags: ["salvage", "shipParts", "reclaimedMaterials"],
    repairTags: ["salvage", "hull", "room", "shipUpgrade"],
    survivalTags: ["supplies"],
    mechanicalNotes: "Provides salvage, repair-prep, and logistics hooks only; it does not resolve salvage value or automate recovery actions.",
    traits: ["expansion-room", "logistics", "salvage"]
  }),
  "ritual-chamber": room({
    id: "ritual-chamber",
    displayName: "Ritual Chamber",
    roomType: ROOM_TYPES.OCCULT,
    role: "Ritual casting, occult operations, and strange engine rites",
    description: "A warded chamber with circle markings, anchor points, and controlled space for shipboard rites and unsettling occult work.",
    downtimeFunctions: ["ritualSupport", "occultOperations", "engineRites"],
    enabledActivities: ["prepareRitual", "performEngineRite", "containOccultWorking"],
    supportedSkills: ["occultism", "arcana", "religion"],
    socialTags: ["rites"],
    traits: ["expansion-room", "occult", "ritual"]
  }),
  armory: room({
    id: "armory",
    displayName: "Armory",
    roomType: ROOM_TYPES.MILITARY,
    role: "Weapons storage and boarding preparation",
    description: "A secure weapons locker and muster space for maintaining arms, staging boarding gear, and preparing defensive watches.",
    downtimeFunctions: ["weaponsStorage", "boardingPreparation", "equipmentMaintenance"],
    enabledActivities: ["inventoryWeapons", "prepareBoardingGear", "maintainArms"],
    supportedSkills: ["crafting", "warfareLore"],
    craftingTags: ["weapons", "armor", "boardingGear"],
    repairTags: ["weapon", "armor", "equipment"],
    mechanicalNotes: "Provides storage and preparation hooks only; it does not grant weapon damage, attack, initiative, or boarding automation bonuses.",
    traits: ["expansion-room", "military", "storage"]
  }),
  "chart-room": room({
    id: "chart-room",
    displayName: "Chart Room",
    roomType: ROOM_TYPES.NAVIGATION,
    role: "Route planning, maps, and void charts",
    description: "A dedicated planning room for maps, route ledgers, void charts, and navigational briefings before departure or during downtime.",
    downtimeFunctions: ["routePlanning", "mapStudy", "navigationBriefing"],
    enabledActivities: ["plotRoute", "compareCharts", "prepareNavigationBriefing"],
    supportedSkills: ["survival", "society", "pilotingLore"],
    survivalTags: ["navigation", "maps", "routePlanning"],
    mechanicalNotes: "Provides planning and reference hooks only; it does not alter voyage speed, fuel costs, encounter checks, or travel resolution.",
    traits: ["expansion-room", "navigation", "maps"]
  }),
  "smuggler-hold": room({
    id: "smuggler-hold",
    displayName: "Smuggler Hold",
    roomType: ROOM_TYPES.LOGISTICS,
    role: "Concealed cargo and contraband storage",
    description: "A compartmentalized cargo space with hidden lockers, false panels, and quiet access routes for sensitive or illicit goods.",
    downtimeFunctions: ["concealedStorage", "contrabandHandling", "cargoConcealment"],
    enabledActivities: ["hideCargo", "inspectConcealment", "catalogContraband"],
    supportedSkills: ["thievery", "society"],
    survivalTags: ["cargo"],
    socialTags: ["underworld"],
    mechanicalNotes: "Provides concealment and contraband hooks only; search DCs, legal consequences, and smuggling outcomes remain GM-adjudicated.",
    traits: ["expansion-room", "logistics", "concealed", "contraband"]
  }),
  "crew-lounge": room({
    id: "crew-lounge",
    displayName: "Crew Lounge",
    roomType: ROOM_TYPES.SOCIAL,
    role: "Morale, downtime, and crew gathering",
    description: "A common room for games, meals between watches, crew meetings, and informal downtime aboard ship.",
    downtimeFunctions: ["morale", "crewDowntime", "socialGathering"],
    enabledActivities: ["holdCrewGathering", "hostDowntimeScene", "shareShipNews"],
    supportedSkills: ["diplomacy", "performance", "society"],
    socialTags: ["morale", "community", "downtime"],
    traits: ["expansion-room", "social", "morale"]
  }),
  "quarantine-ward": room({
    id: "quarantine-ward",
    displayName: "Quarantine Ward",
    roomType: ROOM_TYPES.RECOVERY,
    role: "Disease, curse, and contamination isolation",
    description: "An isolated treatment ward with seals, screened bunks, and clean handling procedures for dangerous maladies or contamination.",
    downtimeFunctions: ["isolation", "contaminationControl", "curseObservation"],
    enabledActivities: ["isolatePatient", "monitorContamination", "prepareCleanRoom"],
    supportedSkills: ["medicine", "occultism", "religion"],
    recoveryTags: ["disease", "curse", "contamination", "isolation"],
    mechanicalNotes: "Provides isolation and treatment-context hooks only; disease, curse, and contamination mechanics remain manually adjudicated.",
    traits: ["expansion-room", "recovery", "quarantine"]
  }),
  "specimen-vault": room({
    id: "specimen-vault",
    displayName: "Specimen Vault",
    roomType: ROOM_TYPES.RESEARCH,
    role: "Strange samples, dangerous relics, and captured anomalies",
    description: "A secured vault with cataloging stations, restraints, and warded lockers for volatile samples and inexplicable finds.",
    downtimeFunctions: ["specimenStorage", "anomalyCataloging", "relicContainment"],
    enabledActivities: ["catalogSpecimen", "secureAnomaly", "studyRelic"],
    supportedSkills: ["arcana", "nature", "occultism", "society"],
    craftingTags: ["samples", "relics"],
    socialTags: ["research"],
    mechanicalNotes: "Provides research and containment hooks only; anomaly behavior, relic hazards, and escape events remain GM-controlled.",
    traits: ["expansion-room", "research", "containment", "specimen"]
  }),
  "forge-bay": room({
    id: "forge-bay",
    displayName: "Forge Bay",
    roomType: ROOM_TYPES.INDUSTRIAL,
    role: "Heavy repair, metalwork, and ship-part fabrication",
    description: "A heat-shielded industrial bay for metalwork, heavy repair staging, and fabrication of rugged ship components during downtime or dock work.",
    downtimeFunctions: ["heavyRepair", "metalwork", "shipPartFabrication"],
    enabledActivities: ["forgeParts", "stageHeavyRepair", "workMetal"],
    supportedSkills: ["crafting"],
    craftingTags: ["metalwork", "shipParts", "industrial"],
    repairTags: ["hull", "weapon", "room", "shipUpgrade"],
    mechanicalNotes: "Provides fabrication and heavy-repair hooks only; it does not automate repairs or grant combat durability bonuses.",
    traits: ["expansion-room", "industrial", "forge", "repair"]
  }),
  "diplomatic-suite": room({
    id: "diplomatic-suite",
    displayName: "Diplomatic Suite",
    roomType: ROOM_TYPES.LUXURY,
    role: "Envoys, noble passengers, and faction diplomacy",
    description: "A formal guest suite and meeting space suitable for envoys, dignitaries, patrons, and sensitive faction negotiations aboard ship.",
    downtimeFunctions: ["diplomacy", "envoyHosting", "factionNegotiation"],
    enabledActivities: ["hostEnvoy", "holdNegotiation", "receiveNoblePassenger"],
    supportedSkills: ["diplomacy", "society", "deception"],
    socialTags: ["diplomacy", "factions", "vip"],
    mechanicalNotes: "Provides hosting and negotiation hooks only; reputation changes, faction outcomes, and rewards remain GM-adjudicated.",
    traits: ["expansion-room", "luxury", "diplomacy"]
  })
});

export const CORE_ROOMS = Object.freeze({
  ...LOCKED_CORE_ROOMS,
  ...STARTER_EXPANSION_ROOMS,
  ...ADDITIONAL_EXPANSION_ROOMS
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
