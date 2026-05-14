function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function station({
  key,
  displayName,
  role,
  description,
  gameplayDomains = [],
  primarySkills = [],
  traits = [],
  notes = ""
}) {
  return deepFreeze({
    key,
    displayName,
    role,
    description,
    gameplayDomains,
    primarySkills,
    traits,
    notes
  });
}

export const CORE_STATIONS = Object.freeze({
  captain: station({
    key: "captain",
    displayName: "Captain",
    role: "Command, leadership, morale, coordination",
    description: "The Captain coordinates the ship's crew, sets operational priorities, and anchors morale during shipboard scenes.",
    gameplayDomains: ["command", "morale"],
    primarySkills: ["diplomacy", "intimidation", "society"],
    traits: ["station", "command", "leadership"],
    notes: "Station framework only; no command actions or AP/RAP spending are implemented in this phase."
  }),
  pilot: station({
    key: "pilot",
    displayName: "Pilot / Helm",
    role: "Steering, movement, tactical handling",
    description: "The Pilot or Helm Officer operates the ship's handling posture and future maneuvering choices without requiring a room assignment.",
    gameplayDomains: ["piloting"],
    primarySkills: ["piloting-lore", "sailing-lore"],
    traits: ["station", "helm", "handling"],
    notes: "Stations are operating roles, not physical rooms; this station is not unlocked by a Helm room."
  }),
  navigator: station({
    key: "navigator",
    displayName: "Navigator",
    role: "Route planning, navigation, prediction",
    description: "The Navigator tracks routes, hazards, and predictive course planning for future travel systems.",
    gameplayDomains: ["navigation"],
    primarySkills: ["survival", "society", "sailing-lore"],
    traits: ["station", "navigation", "planning"],
    notes: "Travel gameplay and voyage events are not implemented in this phase."
  }),
  engineer: station({
    key: "engineer",
    displayName: "Engineer",
    role: "Strain, repairs, arkengine operation",
    description: "The Engineer oversees ship strain pressure, repairs, and arkengine operation for future system hooks.",
    gameplayDomains: ["engineering", "repairs"],
    primarySkills: ["crafting", "arcana"],
    traits: ["station", "engineering", "arkengine"],
    notes: "Assignment data only; no repair automation, overcharge resolution, or hard burn resolution is implemented."
  }),
  veilwarden: station({
    key: "veilwarden",
    displayName: "Veilwarden",
    role: "Lifeveil, occult shielding, atmospheric stability",
    description: "The Veilwarden monitors Lifeveil integrity, occult shielding, and atmospheric stability for future support systems.",
    gameplayDomains: ["lifeveil"],
    primarySkills: ["occultism", "arcana"],
    traits: ["station", "lifeveil", "occult"],
    notes: "This phase does not add Lifeveil actions or automated defensive effects."
  }),
  watchmaster: station({
    key: "watchmaster",
    displayName: "Watchmaster",
    role: "Detection, threat awareness, scouting",
    description: "The Watchmaster coordinates lookouts, sensors, scouting, and threat awareness for future encounter and exploration hooks.",
    gameplayDomains: ["detection"],
    primarySkills: ["perception", "survival"],
    traits: ["station", "detection", "scouting"],
    notes: "No encounter, scouting, or voyage event automation is implemented in this phase."
  }),
  gunnery: station({
    key: "gunnery",
    displayName: "Gunnery",
    role: "Weapon coordination and firing support",
    description: "The Gunnery station identifies who coordinates weapon crews and firing support once future weapon systems exist.",
    gameplayDomains: ["weapons"],
    primarySkills: ["warfare-lore", "perception"],
    traits: ["station", "weapons", "coordination"],
    notes: "No firing systems, combat rounds, or station attacks are implemented in this phase."
  }),
  quartermaster: station({
    key: "quartermaster",
    displayName: "Quartermaster",
    role: "Supplies, cargo, logistics, recovery",
    description: "The Quartermaster tracks responsibility for supplies, cargo, logistics, and recovery support in future systems.",
    gameplayDomains: ["logistics", "supplies"],
    primarySkills: ["society", "survival"],
    traits: ["station", "logistics", "supplies"],
    notes: "Cargo, recovery, and supply gameplay automation are not implemented in this phase."
  })
});

export const STATION_KEYS = Object.freeze(Object.keys(CORE_STATIONS));

export function getStationKeys() {
  return STATION_KEYS;
}

export function getStation(key) {
  return CORE_STATIONS[key] ?? null;
}

export function getStations() {
  return CORE_STATIONS;
}
