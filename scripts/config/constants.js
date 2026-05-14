/**
 * Core Arcflight constants shared by future data and document layers.
 *
 * Keep this file data-only. Gameplay pillars should consume these values rather
 * than hardcoding strings into document or UI logic.
 */
export const ARCFLIGHT_MODULE_ID = "arcflight";

export const ARCFLIGHT_ACTOR_TYPES = Object.freeze({
  SHIP: "ship"
});

export const ARCFLIGHT_ITEM_TYPES = Object.freeze({
  HULL: "hull",
  ARKENGINE: "arkengine",
  ARKENGINE_MOD: "arkengineMod",
  WEAPON: "weapon",
  ROOM: "room",
  SHIP_UPGRADE: "shipUpgrade",
  CARGO: "cargo",
  CREW_ASSET: "crewAsset"
});

export const ARCFLIGHT_SHIP_RESOURCES = Object.freeze({
  HULL: "hull",
  LIFEVEIL: "lifeveil",
  STRAIN: "strain"
});

export const ARCFLIGHT_TRAVEL_RESOURCES = Object.freeze({
  HULL: "hull",
  LIFEVEIL: "lifeveil",
  STRAIN: "strain",
  MORALE: "morale",
  SUPPLIES: "supplies",
  STORED_SPELL_RANKS: "storedSpellRanks"
});

export const ARCFLIGHT_TRAVEL_STATIONS = Object.freeze({
  NAVIGATOR: "navigator",
  ENGINEER: "engineer",
  VEILWARDEN: "veilwarden",
  WATCHMASTER: "watchmaster",
  CAPTAIN: "captain"
});


export const ARCFLIGHT_TRAVEL_EVENT_CATEGORIES = Object.freeze({
  ENVIRONMENTAL: "environmental",
  NAVIGATION: "navigation",
  THREAT: "threat",
  SOCIAL: "social",
  SHIPBOARD: "shipboard",
  DISCOVERY: "discovery",
  OCCULT: "occult"
});

export const ARCFLIGHT_TRAVEL_RESULT_TIERS = Object.freeze({
  CRITICAL_SUCCESS: "criticalSuccess",
  SUCCESS: "success",
  FAILURE: "failure",
  CRITICAL_FAILURE: "criticalFailure"
});

export const ARCFLIGHT_TRAVEL_ROUND_OUTCOMES = Object.freeze({
  DOMINANT_SUCCESS: "dominantSuccess",
  MIXED: "mixed",
  DOMINANT_FAILURE: "dominantFailure",
  CATASTROPHIC_FAILURE: "catastrophicFailure"
});

export const ARCFLIGHT_TRAVEL_EVENT_OUTCOMES = Object.freeze({
  MAJOR_VICTORY: "majorVictory",
  VICTORY: "victory",
  COSTLY_SUCCESS: "costlySuccess",
  FAILURE: "failure",
  CATASTROPHIC_FAILURE: "catastrophicFailure"
});

export const ARCFLIGHT_TRAVEL_TAGS = Object.freeze({
  STORM: "storm",
  NAVIGATION: "navigation",
  STRAIN: "strain",
  LIFEVEIL: "lifeveil",
  MORALE: "morale",
  HULL: "hull",
  SUPPLIES: "supplies",
  ARKENGINE: "arkengine",
  OCCULT: "occult",
  THREAT: "threat",
  SOCIAL: "social",
  DISCOVERY: "discovery",
  SALVAGE: "salvage",
  DERELICT: "derelict",
  STEALTH: "stealth",
  PURSUIT: "pursuit",
  AMBUSH: "ambush",
  COMBAT_HANDOFF: "combatHandoff",
  ENVIRONMENTAL: "environmental",
  SHIPBOARD: "shipboard",
  RESOURCE_PRESSURE: "resourcePressure",
  CREW_PRESSURE: "crewPressure"
});

export const ARCFLIGHT_WEAPON_ARCS = Object.freeze({
  FORE: "fore",
  PORT: "port",
  STARBOARD: "starboard",
  AFT: "aft"
});

export const ARCFLIGHT_WEAPON_SIZES = Object.freeze({
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large"
});

export const ARCFLIGHT_ROOM_CATEGORIES = Object.freeze({
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

export const ARCFLIGHT_SHIP_UPGRADE_CATEGORIES = Object.freeze({
  STRUCTURAL: "structural",
  MILITARY: "military",
  COMMAND: "command",
  DETECTION: "detection",
  LOGISTICS: "logistics",
  DEFENSIVE: "defensive",
  NAVIGATION: "navigation",
  CARGO: "cargo",
  VOIDFARING: "voidfaring",
  INDUSTRIAL: "industrial",
  COORDINATION: "coordination",
  CATASTROPHE: "catastrophe",
  ADAPTATION: "adaptation",
  POWER_DISTRIBUTION: "powerDistribution",
  PROPULSION_SUPPORT: "propulsionSupport",
  LOOKOUT: "lookout",
  HELM_SYSTEM: "helmSystem",
  SAIL_SYSTEM: "sailSystem",
  LIFEVEIL: "lifeveil",
  SUPPORT: "support",
  MOBILITY: "mobility",
  DEEP_VOID: "deepVoid",
  OCCULT: "occult",
  STRAIN: "strain"
});

export const ARCFLIGHT_ARKENGINE_CLASSES = Object.freeze({
  STANDARD: "standard",
  REFINED: "refined",
  EXPERIMENTAL: "experimental",
  ANCIENT: "ancient",
  PROTOTYPE: "prototype",
  RELIC: "relic",
  PLACEHOLDER: "placeholder"
});

export const ARCFLIGHT_RELOAD_STATES = Object.freeze({
  READY: "ready",
  LOADED: "loaded",
  RELOADING: "reloading",
  SPENT: "spent",
  DISABLED: "disabled"
});

export const ARCFLIGHT_CREW_QUALITIES = Object.freeze({
  GREEN: "green",
  TRAINED: "trained",
  VETERAN: "veteran",
  ELITE: "elite",
  LEGENDARY: "legendary"
});

export const ARCFLIGHT_WEAPON_SIZE_DEFAULTS = Object.freeze({
  [ARCFLIGHT_WEAPON_SIZES.SMALL]: Object.freeze({
    mountSlots: 1,
    crewRequired: 1,
    strainCost: 0
  }),
  [ARCFLIGHT_WEAPON_SIZES.MEDIUM]: Object.freeze({
    mountSlots: 1,
    crewRequired: 2,
    strainCost: 1
  }),
  [ARCFLIGHT_WEAPON_SIZES.LARGE]: Object.freeze({
    mountSlots: 2,
    crewRequired: 3,
    strainCost: 2
  })
});

export const ARCFLIGHT_SUGGESTED_WEAPON_TYPES = Object.freeze({
  BALLISTA: "ballista",
  CANNON: "cannon",
  CATAPULT: "catapult",
  HARPOON: "harpoon",
  LANCE: "lance",
  PROJECTOR: "projector",
  TORPEDO: "torpedo",
  OTHER: "other"
});

export const ARCFLIGHT_INSTALL_SLOTS = Object.freeze({
  HULL: "hull",
  ARKENGINE: "arkengine",
  WEAPON_FORE: "weaponFore",
  WEAPON_PORT: "weaponPort",
  WEAPON_STARBOARD: "weaponStarboard",
  WEAPON_AFT: "weaponAft",
  ROOM: "room",
  UPGRADE: "upgrade",
  CARGO: "cargo"
});

export const ARCFLIGHT_COMMON_TAGS = Object.freeze({
  MAGICAL: "magical",
  MECHANICAL: "mechanical",
  VOID: "void",
  ARCANE: "arcane",
  PLACEHOLDER: "placeholder"
});

export const ARCFLIGHT_COMMON_TRAITS = Object.freeze({
  UNIQUE: "unique",
  RARE: "rare",
  UNCOMMON: "uncommon",
  EXPERIMENTAL: "experimental",
  PLACEHOLDER: "placeholder"
});

export const ARCFLIGHT = Object.freeze({
  MODULE_ID: ARCFLIGHT_MODULE_ID,
  ACTOR_TYPES: ARCFLIGHT_ACTOR_TYPES,
  ITEM_TYPES: ARCFLIGHT_ITEM_TYPES,
  SHIP_RESOURCES: ARCFLIGHT_SHIP_RESOURCES,
  TRAVEL_RESOURCES: ARCFLIGHT_TRAVEL_RESOURCES,
  TRAVEL_STATIONS: ARCFLIGHT_TRAVEL_STATIONS,
  TRAVEL_EVENT_CATEGORIES: ARCFLIGHT_TRAVEL_EVENT_CATEGORIES,
  TRAVEL_RESULT_TIERS: ARCFLIGHT_TRAVEL_RESULT_TIERS,
  TRAVEL_ROUND_OUTCOMES: ARCFLIGHT_TRAVEL_ROUND_OUTCOMES,
  TRAVEL_EVENT_OUTCOMES: ARCFLIGHT_TRAVEL_EVENT_OUTCOMES,
  TRAVEL_TAGS: ARCFLIGHT_TRAVEL_TAGS,
  WEAPON_ARCS: ARCFLIGHT_WEAPON_ARCS,
  WEAPON_SIZES: ARCFLIGHT_WEAPON_SIZES,
  ROOM_CATEGORIES: ARCFLIGHT_ROOM_CATEGORIES,
  SHIP_UPGRADE_CATEGORIES: ARCFLIGHT_SHIP_UPGRADE_CATEGORIES,
  ARKENGINE_CLASSES: ARCFLIGHT_ARKENGINE_CLASSES,
  RELOAD_STATES: ARCFLIGHT_RELOAD_STATES,
  CREW_QUALITIES: ARCFLIGHT_CREW_QUALITIES,
  WEAPON_SIZE_DEFAULTS: ARCFLIGHT_WEAPON_SIZE_DEFAULTS,
  SUGGESTED_WEAPON_TYPES: ARCFLIGHT_SUGGESTED_WEAPON_TYPES,
  INSTALL_SLOTS: ARCFLIGHT_INSTALL_SLOTS,
  COMMON_TAGS: ARCFLIGHT_COMMON_TAGS,
  COMMON_TRAITS: ARCFLIGHT_COMMON_TRAITS
});
