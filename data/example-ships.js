import { LOCKED_CORE_ROOM_KEYS } from "./rooms/core-rooms.js";

const LOCKED_CORE_ROOM_KEY_SET = new Set(LOCKED_CORE_ROOM_KEYS);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function exampleShipBuild({
  key,
  name,
  role,
  description,
  hullKey,
  hullPatternKey,
  arkengineKey,
  arkenginePatternKey,
  arkengineMods = [],
  rooms = [],
  expectedCoreRoomKeys = rooms.filter((roomKey) => LOCKED_CORE_ROOM_KEY_SET.has(roomKey)),
  expansionRooms = rooms.filter((roomKey) => !LOCKED_CORE_ROOM_KEY_SET.has(roomKey)),
  shipUpgrades = [],
  crewAssets = [],
  stationAssignmentSuggestions = {}
}) {
  return deepFreeze({
    key,
    name,
    role,
    description,
    hullKey,
    hullPatternKey,
    arkengineKey,
    arkenginePatternKey,
    arkengineMods,
    rooms,
    expectedCoreRoomKeys,
    expansionRooms,
    shipUpgrades,
    crewAssets,
    stationAssignmentSuggestions
  });
}

export const EXAMPLE_SHIP_BUILDS = Object.freeze({
  "starter-brigantine": exampleShipBuild({
    key: "starter-brigantine",
    name: "Starter Brigantine",
    role: "Balanced starter ship",
    description: "A sturdy general-purpose brigantine suitable for validating basic hull, arkengine, room, upgrade, and crew installation flows.",
    hullKey: "brigantine",
    hullPatternKey: "standard",
    arkengineKey: "tidewake-arkengine",
    arkenginePatternKey: "standard",
    arkengineMods: ["pressure-lattice-tuning", "fuel-matrix-efficiency"],
    rooms: ["workshop", "infirmary"],
    shipUpgrades: ["reinforced-structural-ribbing", "stabilized-helm-relays"],
    crewAssets: ["veteran-chief-engineer", "seasoned-navigator", "steady-quartermaster"],
    stationAssignmentSuggestions: {
      engineer: "veteran-chief-engineer",
      navigator: "seasoned-navigator",
      quartermaster: "steady-quartermaster"
    }
  }),
  "scout-sloop": exampleShipBuild({
    key: "scout-sloop",
    name: "Scout Sloop",
    role: "Fast reconnaissance platform",
    description: "A lean sloop configured for lookout, navigation, and testing compact builds with limited room capacity.",
    hullKey: "sloop",
    hullPatternKey: "stealth",
    arkengineKey: "lanterncoil-arkengine",
    arkenginePatternKey: "smuggler",
    arkengineMods: ["voidglass-regulator", "fuel-matrix-efficiency"],
    rooms: ["observatory", "workshop"],
    shipUpgrades: ["lookout-spire", "propulsion-stabilization-fins"],
    crewAssets: ["seasoned-navigator", "sharp-eyed-watchmaster", "veteran-chief-engineer"],
    stationAssignmentSuggestions: {
      navigator: "seasoned-navigator",
      watchmaster: "sharp-eyed-watchmaster",
      engineer: "veteran-chief-engineer"
    }
  }),
  "trade-galleon": exampleShipBuild({
    key: "trade-galleon",
    name: "Trade Galleon",
    role: "Cargo and logistics hauler",
    description: "A heavy galleon emphasizing cargo slots, logistics support, and long-haul arkengine validation.",
    hullKey: "galleon",
    hullPatternKey: "trade",
    arkengineKey: "furnaceheart-drive",
    arkenginePatternKey: "longhaul",
    arkengineMods: ["cooling-loop-expansion", "fuel-matrix-efficiency", "aetherite-core-bracing"],
    rooms: ["expanded-cargo-hold", "workshop", "officer-wardroom", "luxury-quarters"],
    shipUpgrades: ["expanded-cargo-lattice", "docking-claw-system", "fleet-signal-array"],
    crewAssets: ["steady-quartermaster", "seasoned-navigator", "veteran-chief-engineer", "sharp-eyed-watchmaster"],
    stationAssignmentSuggestions: {
      quartermaster: "steady-quartermaster",
      navigator: "seasoned-navigator",
      engineer: "veteran-chief-engineer",
      watchmaster: "sharp-eyed-watchmaster"
    }
  }),
  "battle-frigate": exampleShipBuild({
    key: "battle-frigate",
    name: "Battle Frigate",
    role: "Military test platform",
    description: "A disciplined frigate build for stress-testing battle-pattern hulls, military arkengine patterns, and station-ready crew assets without adding combat automation.",
    hullKey: "frigate",
    hullPatternKey: "battle",
    arkengineKey: "iron-choir-engine",
    arkenginePatternKey: "military",
    arkengineMods: ["pressure-lattice-tuning", "choir-harmonic-lattice", "cooling-loop-expansion"],
    rooms: ["workshop", "infirmary", "brig"],
    shipUpgrades: ["reinforced-structural-ribbing", "reinforced-ram-prow", "auxiliary-command-roost"],
    crewAssets: ["veteran-gunner", "veteran-chief-engineer", "sharp-eyed-watchmaster", "seasoned-navigator"],
    stationAssignmentSuggestions: {
      gunnery: "veteran-gunner",
      engineer: "veteran-chief-engineer",
      watchmaster: "sharp-eyed-watchmaster",
      navigator: "seasoned-navigator"
    }
  }),
  "occult-cathedral-ship": exampleShipBuild({
    key: "occult-cathedral-ship",
    name: "Occult Cathedral Ship",
    role: "Ritual lifeveil vessel",
    description: "A cathedral ship configured around sanctum systems, ritual rooms, and specialist crew for validating large occult-themed complete builds.",
    hullKey: "cathedral-ship",
    hullPatternKey: "occult",
    arkengineKey: "sanctum-choir-core",
    arkenginePatternKey: "pilgrim",
    arkengineMods: ["choir-harmonic-lattice", "veil-projector-focusing", "deepwake-stabilizers", "aetherite-core-bracing"],
    rooms: ["shrine", "archive", "infirmary", "observatory", "luxury-quarters"],
    shipUpgrades: ["emergency-veil-relay", "deep-void-reinforcement", "arc-conduit-stabilizers"],
    crewAssets: ["veteran-chief-engineer", "seasoned-navigator", "sharp-eyed-watchmaster", "steady-quartermaster"],
    stationAssignmentSuggestions: {
      engineer: "veteran-chief-engineer",
      navigator: "seasoned-navigator",
      watchmaster: "sharp-eyed-watchmaster",
      quartermaster: "steady-quartermaster"
    }
  })
});

export const EXAMPLE_SHIP_BUILD_KEYS = Object.freeze(Object.keys(EXAMPLE_SHIP_BUILDS));

function cloneData(data) {
  if (typeof foundry !== "undefined" && foundry.utils?.deepClone) return foundry.utils.deepClone(data);
  return structuredClone(data);
}

export function getExampleShipBuildKeys() {
  return EXAMPLE_SHIP_BUILD_KEYS;
}

export function getExampleShipBuild(buildKey) {
  const build = EXAMPLE_SHIP_BUILDS[buildKey] ?? null;
  return build ? cloneData(build) : null;
}
