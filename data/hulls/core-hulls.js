const CORE_ROOMS = Object.freeze([
  "arkengine-chamber",
  "helm",
  "crew-quarters",
  "galley-mess",
  "cargo-hold",
  "officer-wardroom"
]);

const TIER_LABELS = Object.freeze({
  1: "Frontier / Local",
  2: "Established Voidfaring",
  3: "Military / Expeditionary",
  4: "Capital / Legendary",
  5: "Mythic / Impossible"
});

const REFIT_TOLERANCE_BY_TIER = Object.freeze({
  1: Object.freeze({
    weaponPressure: 2,
    enginePressure: 2,
    infrastructurePressure: 2,
    lifeveilPressure: 1,
    crewCommandPressure: 1,
    occultPressure: 1,
    totalBeforeMajorRefitRequired: 5
  }),
  2: Object.freeze({
    weaponPressure: 3,
    enginePressure: 3,
    infrastructurePressure: 3,
    lifeveilPressure: 2,
    crewCommandPressure: 2,
    occultPressure: 1,
    totalBeforeMajorRefitRequired: 8
  }),
  3: Object.freeze({
    weaponPressure: 4,
    enginePressure: 4,
    infrastructurePressure: 4,
    lifeveilPressure: 3,
    crewCommandPressure: 3,
    occultPressure: 2,
    totalBeforeMajorRefitRequired: 11
  }),
  4: Object.freeze({
    weaponPressure: 5,
    enginePressure: 5,
    infrastructurePressure: 5,
    lifeveilPressure: 4,
    crewCommandPressure: 4,
    occultPressure: 3,
    totalBeforeMajorRefitRequired: 14
  }),
  5: Object.freeze({
    weaponPressure: 6,
    enginePressure: 6,
    infrastructurePressure: 6,
    lifeveilPressure: 5,
    crewCommandPressure: 5,
    occultPressure: 5,
    totalBeforeMajorRefitRequired: 18
  })
});

const DEFAULT_ALLOWED_REFIT_THEMES = Object.freeze([
  "weapons",
  "arkengine",
  "infrastructure",
  "lifeveil",
  "crew-command"
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function classification(baseTier, maximumRefitTier = Math.min(5, baseTier + 2), canBeRefitAboveBaseTier = maximumRefitTier > baseTier) {
  return {
    baseTier,
    tierLabel: TIER_LABELS[baseTier],
    canBeRefitAboveBaseTier,
    maximumRefitTier
  };
}

function refitTolerance(baseTier, overrides = {}) {
  return {
    ...REFIT_TOLERANCE_BY_TIER[baseTier],
    ...overrides
  };
}

function refitNotes({
  allowedRefitThemes = DEFAULT_ALLOWED_REFIT_THEMES,
  restrictedRefitThemes = [],
  designIntent
}) {
  return {
    allowedRefitThemes: [...allowedRefitThemes],
    restrictedRefitThemes: [...restrictedRefitThemes],
    designIntent
  };
}

const WEAPON_ARCS = Object.freeze(["fore", "port", "starboard", "aft"]);
const ALLOWED_SIZES_BY_MAX_SIZE = Object.freeze({
  small: Object.freeze(["small"]),
  medium: Object.freeze(["small", "medium"]),
  large: Object.freeze(["small", "medium", "large"])
});

function weaponMount(id, arc, maxSize) {
  return {
    id,
    arc,
    maxSize,
    allowedSizes: [...ALLOWED_SIZES_BY_MAX_SIZE[maxSize]],
    occupied: false
  };
}

function weaponMounts(specification) {
  return Object.fromEntries(
    WEAPON_ARCS.map((arc) => [
      arc,
      Array.from({ length: specification[arc]?.count ?? 0 }, (_, index) => weaponMount(
        `${arc}-${index + 1}`,
        arc,
        specification[arc].maxSize
      ))
    ])
  );
}

function titleCasePlatform(platform) {
  return platform
    .split("-")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function hull({
  platform,
  displayName = titleCasePlatform(platform),
  hullIntegrity,
  voidScarCapacity,
  armorClass,
  physicalResistances,
  strainCapacity,
  lifeveilCapacity,
  cargoCapacity,
  detection,
  combatSpeed,
  maneuverability,
  baseAP,
  baseRAP,
  crew,
  expansionSlots,
  weapons,
  preferredArkengine,
  allowedArkengines,
  role,
  traits = [],
  baseTier,
  maximumRefitTier,
  canBeRefitAboveBaseTier,
  refitTolerance: refitToleranceOverrides = {},
  allowedRefitThemes,
  restrictedRefitThemes = [],
  refitDesignIntent,
  districtScale = false
}) {
  return deepFreeze({
    componentType: "hull",
    platform,
    displayName,
    hullIntegrity,
    voidScarCapacity,
    armorClass,
    physicalResistances: {
      bludgeoning: physicalResistances[0],
      piercing: physicalResistances[1],
      slashing: physicalResistances[2]
    },
    strainCapacity,
    lifeveilCapacity,
    cargoCapacity,
    detection,
    combatSpeed,
    maneuverability,
    baseAP,
    baseRAP,
    crew: {
      minimum: crew[0],
      recommended: crew[1],
      maximum: crew[2]
    },
    rooms: {
      coreRooms: [...CORE_ROOMS],
      expansionSlots,
      districtScale
    },
    weaponMounts: weaponMounts(weapons),
    arkengineCompatibility: {
      preferred: preferredArkengine,
      allowed: [...allowedArkengines]
    },
    classification: classification(baseTier, maximumRefitTier, canBeRefitAboveBaseTier),
    refitTolerance: refitTolerance(baseTier, refitToleranceOverrides),
    refitNotes: refitNotes({
      allowedRefitThemes,
      restrictedRefitThemes,
      designIntent: refitDesignIntent ?? role
    }),
    traits: ["core-hull", ...traits],
    role,
    designNotes: "Phase 2 locked core hull platform. Tier/refit-ready schema fields are data-only placeholders for the upcoming Refit Pressure framework."
  });
}

export const CORE_HULLS = Object.freeze({
  "void-skiff": hull({
    platform: "void-skiff",
    baseTier: 1,
    refitTolerance: { weaponPressure: 1, infrastructurePressure: 1, totalBeforeMajorRefitRequired: 4 },
    allowedRefitThemes: ["arkengine", "infrastructure", "scouting"],
    restrictedRefitThemes: ["large-weapons", "capital-command", "district-infrastructure"],
    refitDesignIntent: "A light frontier craft can accept practical scouting and utility refits but should not become a line warship.",
    hullIntegrity: 60,
    voidScarCapacity: 2,
    armorClass: 18,
    physicalResistances: [0, 0, 0],
    strainCapacity: 4,
    lifeveilCapacity: 20,
    cargoCapacity: 8,
    detection: 2,
    combatSpeed: 8,
    maneuverability: 3,
    baseAP: 3,
    baseRAP: 1,
    crew: [1, 3, 6],
    expansionSlots: 1,
    weapons: { fore: { count: 1, maxSize: "small" } },
    preferredArkengine: "Spark",
    allowedArkengines: ["Spark", "Lantern"],
    role: "Tiny fast craft, scout, launch, personal voidboat.",
    traits: ["tiny", "fast", "scout"]
  }),
  sloop: hull({
    platform: "sloop",
    baseTier: 1,
    refitTolerance: { totalBeforeMajorRefitRequired: 5 },
    allowedRefitThemes: ["weapons", "arkengine", "infrastructure", "scouting", "courier"],
    restrictedRefitThemes: ["large-weapons", "capital-command", "district-infrastructure"],
    refitDesignIntent: "An adaptable local vessel for party-scale upgrades, couriers, and light raiding without capital refits.",
    hullIntegrity: 90,
    voidScarCapacity: 3,
    armorClass: 18,
    physicalResistances: [1, 1, 0],
    strainCapacity: 6,
    lifeveilCapacity: 30,
    cargoCapacity: 16,
    detection: 3,
    combatSpeed: 7,
    maneuverability: 3,
    baseAP: 4,
    baseRAP: 1,
    crew: [3, 6, 12],
    expansionSlots: 2,
    weapons: {
      fore: { count: 1, maxSize: "small" },
      port: { count: 1, maxSize: "small" },
      starboard: { count: 1, maxSize: "small" }
    },
    preferredArkengine: "Lantern",
    allowedArkengines: ["Spark", "Lantern", "Wake"],
    role: "Small adventuring ship, courier, scout, light raider.",
    traits: ["small", "courier", "scout"]
  }),
  cutter: hull({
    platform: "cutter",
    baseTier: 1,
    refitTolerance: { weaponPressure: 3, totalBeforeMajorRefitRequired: 6 },
    allowedRefitThemes: ["weapons", "arkengine", "infrastructure", "patrol", "scouting"],
    restrictedRefitThemes: ["capital-command", "district-infrastructure"],
    refitDesignIntent: "A sturdy starter patrol hull can tolerate focused weapon or utility refits while staying below true military scale.",
    hullIntegrity: 120,
    voidScarCapacity: 4,
    armorClass: 17,
    physicalResistances: [2, 1, 1],
    strainCapacity: 8,
    lifeveilCapacity: 40,
    cargoCapacity: 28,
    detection: 3,
    combatSpeed: 6,
    maneuverability: 2,
    baseAP: 4,
    baseRAP: 1,
    crew: [4, 10, 20],
    expansionSlots: 3,
    weapons: {
      fore: { count: 1, maxSize: "medium" },
      port: { count: 1, maxSize: "small" },
      starboard: { count: 1, maxSize: "small" },
      aft: { count: 1, maxSize: "small" }
    },
    preferredArkengine: "Lantern",
    allowedArkengines: ["Spark", "Lantern", "Wake"],
    role: "Durable small ship, patrol craft, starter party vessel.",
    traits: ["small", "durable", "patrol"]
  }),
  brigantine: hull({
    platform: "brigantine",
    baseTier: 2,
    refitTolerance: { infrastructurePressure: 4, totalBeforeMajorRefitRequired: 9 },
    allowedRefitThemes: ["weapons", "arkengine", "infrastructure", "lifeveil", "crew-command", "expedition"],
    restrictedRefitThemes: ["mythic-core", "district-infrastructure"],
    refitDesignIntent: "The baseline adventuring workhorse is intentionally broad and forgiving for future campaign identity refits.",
    hullIntegrity: 160,
    voidScarCapacity: 5,
    armorClass: 17,
    physicalResistances: [2, 2, 1],
    strainCapacity: 10,
    lifeveilCapacity: 55,
    cargoCapacity: 40,
    detection: 4,
    combatSpeed: 5,
    maneuverability: 2,
    baseAP: 5,
    baseRAP: 1,
    crew: [5, 14, 32],
    expansionSlots: 4,
    weapons: {
      fore: { count: 1, maxSize: "medium" },
      port: { count: 2, maxSize: "small" },
      starboard: { count: 2, maxSize: "small" },
      aft: { count: 1, maxSize: "small" }
    },
    preferredArkengine: "Wake",
    allowedArkengines: ["Lantern", "Wake", "Iron Choir"],
    role: "Flexible home ship, adventuring workhorse.",
    traits: ["flexible", "workhorse"]
  }),
  frigate: hull({
    platform: "frigate",
    baseTier: 2,
    refitTolerance: { weaponPressure: 4, crewCommandPressure: 3, totalBeforeMajorRefitRequired: 9 },
    allowedRefitThemes: ["weapons", "arkengine", "infrastructure", "crew-command", "military"],
    restrictedRefitThemes: ["heavy-cargo", "district-infrastructure"],
    refitDesignIntent: "A disciplined escort hull favors military and command refits over merchant or sanctuary conversions.",
    hullIntegrity: 190,
    voidScarCapacity: 6,
    armorClass: 18,
    physicalResistances: [3, 2, 2],
    strainCapacity: 11,
    lifeveilCapacity: 50,
    cargoCapacity: 34,
    detection: 5,
    combatSpeed: 6,
    maneuverability: 2,
    baseAP: 6,
    baseRAP: 1,
    crew: [6, 24, 60],
    expansionSlots: 4,
    weapons: {
      fore: { count: 1, maxSize: "medium" },
      port: { count: 2, maxSize: "medium" },
      starboard: { count: 2, maxSize: "medium" },
      aft: { count: 1, maxSize: "small" }
    },
    preferredArkengine: "Iron Choir",
    allowedArkengines: ["Wake", "Iron Choir", "Furnace"],
    role: "Combat-focused escort and warship.",
    traits: ["escort", "warship"]
  }),
  galleon: hull({
    platform: "galleon",
    baseTier: 3,
    refitTolerance: { infrastructurePressure: 5, crewCommandPressure: 4, totalBeforeMajorRefitRequired: 12 },
    allowedRefitThemes: ["weapons", "arkengine", "infrastructure", "lifeveil", "crew-command", "cargo", "colony-support"],
    restrictedRefitThemes: ["stealth", "small-craft-only"],
    refitDesignIntent: "A large logistical platform can become a merchant, colony, or support flagship but resists nimble stealth identities.",
    hullIntegrity: 260,
    voidScarCapacity: 7,
    armorClass: 15,
    physicalResistances: [4, 3, 3],
    strainCapacity: 13,
    lifeveilCapacity: 75,
    cargoCapacity: 90,
    detection: 3,
    combatSpeed: 3,
    maneuverability: 1,
    baseAP: 7,
    baseRAP: 1,
    crew: [10, 45, 120],
    expansionSlots: 6,
    weapons: {
      fore: { count: 1, maxSize: "medium" },
      port: { count: 3, maxSize: "medium" },
      starboard: { count: 3, maxSize: "medium" },
      aft: { count: 1, maxSize: "medium" }
    },
    preferredArkengine: "Furnace",
    allowedArkengines: ["Iron Choir", "Furnace", "Breaker"],
    role: "Heavy cargo, logistics, colony support, merchant flagship.",
    traits: ["heavy-cargo", "logistics", "merchant"]
  }),
  hammerhead: hull({
    platform: "hammerhead",
    baseTier: 3,
    refitTolerance: { weaponPressure: 5, lifeveilPressure: 2, totalBeforeMajorRefitRequired: 11 },
    allowedRefitThemes: ["weapons", "arkengine", "infrastructure", "siege", "military"],
    restrictedRefitThemes: ["sanctuary", "luxury", "stealth"],
    refitDesignIntent: "A purpose-built assault frame takes heavy weapon and engine stress but has limited tolerance for soft-support conversions.",
    hullIntegrity: 240,
    voidScarCapacity: 7,
    armorClass: 16,
    physicalResistances: [5, 4, 3],
    strainCapacity: 14,
    lifeveilCapacity: 60,
    cargoCapacity: 55,
    detection: 3,
    combatSpeed: 4,
    maneuverability: 1,
    baseAP: 7,
    baseRAP: 1,
    crew: [8, 35, 90],
    expansionSlots: 5,
    weapons: {
      fore: { count: 1, maxSize: "large" },
      port: { count: 2, maxSize: "medium" },
      starboard: { count: 2, maxSize: "medium" },
      aft: { count: 1, maxSize: "small" }
    },
    preferredArkengine: "Breaker",
    allowedArkengines: ["Furnace", "Breaker", "Deepwake"],
    role: "Frontal assault, ramship, siege breaker.",
    traits: ["assault", "ramship", "siege"]
  }),
  arkcruiser: hull({
    platform: "arkcruiser",
    baseTier: 4,
    refitTolerance: { enginePressure: 6, crewCommandPressure: 5, totalBeforeMajorRefitRequired: 15 },
    allowedRefitThemes: ["weapons", "arkengine", "infrastructure", "lifeveil", "crew-command", "capital-command", "expedition"],
    restrictedRefitThemes: ["frontier-only", "small-craft-only"],
    refitDesignIntent: "A campaign flagship can support major capital, command, and expedition refits before crossing into mythic rebuilds.",
    hullIntegrity: 310,
    voidScarCapacity: 9,
    armorClass: 15,
    physicalResistances: [4, 4, 3],
    strainCapacity: 16,
    lifeveilCapacity: 95,
    cargoCapacity: 110,
    detection: 5,
    combatSpeed: 3,
    maneuverability: 1,
    baseAP: 8,
    baseRAP: 1,
    crew: [12, 70, 180],
    expansionSlots: 7,
    weapons: {
      fore: { count: 1, maxSize: "medium" },
      port: { count: 3, maxSize: "medium" },
      starboard: { count: 3, maxSize: "medium" },
      aft: { count: 2, maxSize: "small" }
    },
    preferredArkengine: "Deepwake",
    allowedArkengines: ["Breaker", "Deepwake", "Crown"],
    role: "Long-range capital cruiser and campaign flagship.",
    traits: ["capital", "long-range", "flagship"]
  }),
  "dread-caravel": hull({
    platform: "dread-caravel",
    baseTier: 4,
    refitTolerance: { weaponPressure: 6, occultPressure: 4, totalBeforeMajorRefitRequired: 15 },
    allowedRefitThemes: ["weapons", "arkengine", "infrastructure", "crew-command", "occult", "capital-command", "hunter-killer"],
    restrictedRefitThemes: ["merchant-flagship", "sanctuary"],
    refitDesignIntent: "An elite hunter-killer accepts severe weapon, engine, and occult refits while remaining a warship first.",
    hullIntegrity: 300,
    voidScarCapacity: 9,
    armorClass: 17,
    physicalResistances: [5, 4, 4],
    strainCapacity: 17,
    lifeveilCapacity: 80,
    cargoCapacity: 70,
    detection: 6,
    combatSpeed: 4,
    maneuverability: 1,
    baseAP: 8,
    baseRAP: 2,
    crew: [14, 90, 240],
    expansionSlots: 6,
    weapons: {
      fore: { count: 1, maxSize: "large" },
      port: { count: 3, maxSize: "medium" },
      starboard: { count: 3, maxSize: "medium" },
      aft: { count: 1, maxSize: "medium" }
    },
    preferredArkengine: "Crown",
    allowedArkengines: ["Deepwake", "Crown", "Sanctum"],
    role: "Elite warship and hunter-killer capital vessel.",
    traits: ["elite", "warship", "hunter-killer"]
  }),
  "cathedral-ship": hull({
    platform: "cathedral-ship",
    baseTier: 5,
    maximumRefitTier: 5,
    canBeRefitAboveBaseTier: false,
    refitTolerance: { lifeveilPressure: 7, occultPressure: 6, weaponPressure: 4, totalBeforeMajorRefitRequired: 18 },
    allowedRefitThemes: ["arkengine", "infrastructure", "lifeveil", "crew-command", "occult", "sanctuary"],
    restrictedRefitThemes: ["heavy-siege", "stealth", "small-craft-only"],
    refitDesignIntent: "A mythic sanctuary platform emphasizes Lifeveil and occult infrastructure rather than escalating beyond its base tier.",
    hullIntegrity: 280,
    voidScarCapacity: 10,
    armorClass: 14,
    physicalResistances: [3, 3, 3],
    strainCapacity: 15,
    lifeveilCapacity: 120,
    cargoCapacity: 75,
    detection: 6,
    combatSpeed: 2,
    maneuverability: 1,
    baseAP: 8,
    baseRAP: 1,
    crew: [12, 80, 220],
    expansionSlots: 7,
    weapons: {
      fore: { count: 1, maxSize: "medium" },
      port: { count: 2, maxSize: "medium" },
      starboard: { count: 2, maxSize: "medium" },
      aft: { count: 1, maxSize: "medium" }
    },
    preferredArkengine: "Sanctum",
    allowedArkengines: ["Crown", "Sanctum", "Worldbinder"],
    role: "Lifeveil fortress, religious vessel, ark sanctuary, support flagship.",
    traits: ["lifeveil", "sanctuary", "support-flagship"]
  }),
  "leviathan-class-platform": hull({
    platform: "leviathan-class-platform",
    baseTier: 5,
    maximumRefitTier: 5,
    canBeRefitAboveBaseTier: false,
    refitTolerance: { infrastructurePressure: 8, lifeveilPressure: 7, crewCommandPressure: 7, occultPressure: 7, totalBeforeMajorRefitRequired: 20 },
    allowedRefitThemes: ["district-infrastructure", "leviathan-core", "civilization", "mythic-infrastructure"],
    restrictedRefitThemes: ["standard-expansion-slots", "small-craft-only", "ordinary-refit-yard"],
    refitDesignIntent: "A Leviathan platform is district-scale infrastructure, not a normal ship refit chassis; future refits should be bespoke and narrative-scale.",
    districtScale: true,
    hullIntegrity: 500,
    voidScarCapacity: 12,
    armorClass: 12,
    physicalResistances: [6, 6, 5],
    strainCapacity: 22,
    lifeveilCapacity: 180,
    cargoCapacity: 250,
    detection: 7,
    combatSpeed: 1,
    maneuverability: 1,
    baseAP: 10,
    baseRAP: 3,
    crew: [50, 300, "1000+"],
    expansionSlots: "district-scale infrastructure",
    weapons: {
      fore: { count: 2, maxSize: "large" },
      port: { count: 4, maxSize: "large" },
      starboard: { count: 4, maxSize: "large" },
      aft: { count: 2, maxSize: "large" }
    },
    preferredArkengine: "Leviathan Core",
    allowedArkengines: ["Leviathan Core"],
    role: "Moving district/civilization, not a normal ship.",
    traits: ["leviathan", "district-scale", "civilization"]
  })
});

export const CORE_HULL_PLATFORM_KEYS = Object.freeze(Object.keys(CORE_HULLS));

export function getCoreHullPlatformKeys() {
  return CORE_HULL_PLATFORM_KEYS;
}

export function getCoreHull(platformKey) {
  return CORE_HULLS[platformKey] ?? null;
}
