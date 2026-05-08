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
  CARGO: "cargo",
  CREW_ASSET: "crewAsset"
});

export const ARCFLIGHT_SHIP_RESOURCES = Object.freeze({
  HULL: "hull",
  LIFEVEIL: "lifeveil",
  STRAIN: "strain"
});

export const ARCFLIGHT_WEAPON_ARCS = Object.freeze({
  FORE: "fore",
  PORT: "port",
  STARBOARD: "starboard",
  AFT: "aft"
});

export const ARCFLIGHT_WEAPON_SIZES = Object.freeze({
  LIGHT: "light",
  MEDIUM: "medium",
  HEAVY: "heavy",
  CAPITAL: "capital"
});

export const ARCFLIGHT_ROOM_CATEGORIES = Object.freeze({
  COMMAND: "command",
  CREW: "crew",
  ENGINEERING: "engineering",
  CARGO: "cargo",
  DEFENSE: "defense",
  UTILITY: "utility",
  SPECIAL: "special"
});

export const ARCFLIGHT_ARKENGINE_CLASSES = Object.freeze({
  STANDARD: "standard",
  REFINED: "refined",
  EXPERIMENTAL: "experimental",
  ANCIENT: "ancient",
  PLACEHOLDER: "placeholder"
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
  WEAPON_ARCS: ARCFLIGHT_WEAPON_ARCS,
  WEAPON_SIZES: ARCFLIGHT_WEAPON_SIZES,
  ROOM_CATEGORIES: ARCFLIGHT_ROOM_CATEGORIES,
  ARKENGINE_CLASSES: ARCFLIGHT_ARKENGINE_CLASSES,
  INSTALL_SLOTS: ARCFLIGHT_INSTALL_SLOTS,
  COMMON_TAGS: ARCFLIGHT_COMMON_TAGS,
  COMMON_TRAITS: ARCFLIGHT_COMMON_TRAITS
});
