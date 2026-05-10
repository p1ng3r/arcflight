const CORE_ROOMS = Object.freeze([
  "Arkengine Chamber",
  "Helm",
  "Crew Quarters",
  "Galley & Mess",
  "Cargo Hold",
  "Officer Wardroom"
]);

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
  traits = []
}) {
  return Object.freeze({
    componentType: "hull",
    platform,
    displayName,
    hullIntegrity,
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
      expansionSlots
    },
    weaponMounts: weaponMounts(weapons),
    arkengineCompatibility: {
      preferred: preferredArkengine,
      allowed: [...allowedArkengines]
    },
    traits: ["core-hull", ...traits],
    role,
    designNotes: "Phase 2 locked core hull platform. Placeholder balance from Hull Statout V1."
  });
}

export const CORE_HULLS = Object.freeze({
  "void-skiff": hull({
    platform: "void-skiff",
    hullIntegrity: 60,
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
    hullIntegrity: 90,
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
    hullIntegrity: 120,
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
    hullIntegrity: 160,
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
    hullIntegrity: 190,
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
    hullIntegrity: 260,
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
    hullIntegrity: 240,
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
    hullIntegrity: 310,
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
    hullIntegrity: 300,
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
    hullIntegrity: 280,
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
    hullIntegrity: 500,
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
