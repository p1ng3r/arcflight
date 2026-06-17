function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function buildRefitPressure(overrides = {}) {
  return Object.freeze({
    weaponPressure: 0,
    enginePressure: 0,
    infrastructurePressure: 0,
    lifeveilPressure: 0,
    crewCommandPressure: 0,
    occultPressure: 0,
    ...overrides
  });
}

export const ARCFLIGHT_CORE_WEAPON_SIZES = Object.freeze({
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large"
});

export const ARCFLIGHT_CORE_WEAPON_FAMILIES = Object.freeze({
  BALLISTA: "ballista",
  CANNON: "cannon",
  CATAPULT: "catapult",
  HARPOON: "harpoon",
  LANCE: "lance",
  PROJECTOR: "projector"
});

export const ARCFLIGHT_CORE_WEAPON_RELOAD_TYPES = Object.freeze({
  SINGLE_SHOT: "singleShot",
  CREW_SERVED: "crewServed",
  CHARGE: "charge",
  MAGAZINE: "magazine"
});

function defaultMountSlots(size) {
  if (size === ARCFLIGHT_CORE_WEAPON_SIZES.LARGE) return 2;
  return 1;
}

function defaultMinimumTier(size, traits = []) {
  if (traits.includes("arcane") || traits.includes("experimental")) return 3;
  if (size === ARCFLIGHT_CORE_WEAPON_SIZES.LARGE) return 2;
  return 1;
}

function defaultRefitPressure(size, traits = []) {
  const weaponPressure = size === ARCFLIGHT_CORE_WEAPON_SIZES.LARGE ? 3 : size === ARCFLIGHT_CORE_WEAPON_SIZES.MEDIUM ? 2 : 1;
  const infrastructurePressure = size === ARCFLIGHT_CORE_WEAPON_SIZES.LARGE ? 1 : 0;
  const occultPressure = traits.includes("arcane") ? 1 : 0;

  return {
    weaponPressure,
    infrastructurePressure,
    occultPressure
  };
}

function weapon({
  key,
  name,
  size = ARCFLIGHT_CORE_WEAPON_SIZES.SMALL,
  family,
  category = family,
  role,
  description,
  crewRequired = size === ARCFLIGHT_CORE_WEAPON_SIZES.LARGE ? 3 : size === ARCFLIGHT_CORE_WEAPON_SIZES.MEDIUM ? 2 : 1,
  reloadType = ARCFLIGHT_CORE_WEAPON_RELOAD_TYPES.CREW_SERVED,
  reloadActions = size === ARCFLIGHT_CORE_WEAPON_SIZES.LARGE ? 3 : size === ARCFLIGHT_CORE_WEAPON_SIZES.MEDIUM ? 2 : 1,
  reloadCrewRequired = crewRequired,
  reloadNotes = "Data-only reload profile for future combat systems; no reload tracking is implemented.",
  compatibleArcs = ["fore", "port", "starboard", "aft"],
  mountSlots = defaultMountSlots(size),
  traits = [],
  damageDice,
  damageType,
  damageNotes = "Data-only damage profile for future combat systems; no attack or damage rolls are implemented.",
  minimumTier = defaultMinimumTier(size, traits),
  recommendedTier = minimumTier,
  refitPressure = defaultRefitPressure(size, traits),
  refitTags = ["weapon", family, category, size, ...traits],
  specialistRequirements = minimumTier >= 3 ? ["specialized shipwright gunner"] : [],
  rareMaterialRequirements = [],
  designIntent,
  gmNotes = ""
}) {
  return deepFreeze({
    componentType: "weapon",
    key,
    name,
    size,
    family,
    category,
    role,
    description,
    crewRequired,
    reload: {
      type: reloadType,
      actions: reloadActions,
      crewRequired: reloadCrewRequired,
      notes: reloadNotes
    },
    compatibleArcs,
    mounting: {
      mountSlots,
      compatibleArcs,
      notes: "Mount compatibility is source data consumed by backend install helpers; no weapon UI or combat firing is implemented."
    },
    traits,
    damageProfile: {
      dice: damageDice,
      type: damageType,
      notes: damageNotes
    },
    minimumTier,
    recommendedTier,
    tierImpact: `Tier ${recommendedTier} ${size} ${family} weapon source data for future refit validation.`,
    refitPressure: buildRefitPressure(refitPressure),
    refitTags: [...new Set(refitTags)],
    refitCategory: "weaponPressure",
    specialistRequirements,
    rareMaterialRequirements,
    notes: {
      designIntent,
      gmNotes
    }
  });
}

export const CORE_WEAPONS = Object.freeze({
  "deck-ballista": weapon({
    key: "deck-ballista",
    name: "Deck Ballista",
    family: ARCFLIGHT_CORE_WEAPON_FAMILIES.BALLISTA,
    category: "bolt-thrower",
    role: "Baseline crew-served piercing weapon",
    description: "A reinforced deck-mounted ballista intended as the simplest Arcflight ship weapon source item.",
    damageDice: "2d10",
    damageType: "piercing",
    traits: ["mechanical", "bolt", "crew-served"],
    designIntent: "Provides a small starter weapon profile without firing, attack roll, damage roll, ammo, AP/RAP, or station-action automation."
  }),
  "swivel-cannon": weapon({
    key: "swivel-cannon",
    name: "Swivel Cannon",
    family: ARCFLIGHT_CORE_WEAPON_FAMILIES.CANNON,
    category: "cannon",
    role: "Flexible medium deck gun",
    description: "A compact ship cannon on a reinforced swivel mount, useful as a middle-weight starter weapon profile.",
    size: ARCFLIGHT_CORE_WEAPON_SIZES.MEDIUM,
    damageDice: "3d8",
    damageType: "bludgeoning",
    compatibleArcs: ["fore", "port", "starboard"],
    traits: ["mechanical", "black-powder", "crew-served"],
    designIntent: "Defines medium weapon data for later install/backend work while avoiding attack, damage, ammo, or reload state automation."
  }),
  "stormglass-lance": weapon({
    key: "stormglass-lance",
    name: "Stormglass Lance",
    family: ARCFLIGHT_CORE_WEAPON_FAMILIES.LANCE,
    category: "arcane-lance",
    role: "Large arcane prow weapon profile",
    description: "A heavy stormglass focusing lance that channels stored force through a reinforced ship mount.",
    size: ARCFLIGHT_CORE_WEAPON_SIZES.LARGE,
    damageDice: "4d10",
    damageType: "electricity",
    compatibleArcs: ["fore"],
    reloadType: ARCFLIGHT_CORE_WEAPON_RELOAD_TYPES.CHARGE,
    reloadActions: 3,
    reloadNotes: "Data-only charge profile for a future backend; no charge, ammo, AP/RAP, or station-action tracking is implemented.",
    traits: ["arcane", "magical", "crew-served", "experimental"],
    rareMaterialRequirements: ["stormglass focusing rods"],
    designIntent: "Provides one large occult-adjacent weapon profile to exercise schema pressure without adding combat mechanics."
  }),
  "grapnel-harpoon": weapon({
    key: "grapnel-harpoon",
    name: "Grapnel Harpoon",
    family: ARCFLIGHT_CORE_WEAPON_FAMILIES.HARPOON,
    category: "harpoon",
    role: "Utility-flavored tether weapon profile",
    description: "A shipboard harpoon thrower with reinforced grapnel heads and tether winch fittings.",
    size: ARCFLIGHT_CORE_WEAPON_SIZES.SMALL,
    damageDice: "2d8",
    damageType: "piercing",
    reloadType: ARCFLIGHT_CORE_WEAPON_RELOAD_TYPES.SINGLE_SHOT,
    compatibleArcs: ["fore", "port", "starboard"],
    traits: ["mechanical", "tether", "crew-served"],
    designIntent: "Captures utility weapon identity as data only; tether, boarding, firing, hit, and movement rules are future work."
  })
});

export const CORE_WEAPON_KEYS = Object.freeze(Object.keys(CORE_WEAPONS));

export function getCoreWeaponKeys() {
  return CORE_WEAPON_KEYS;
}

export function getCoreWeapon(weaponKey) {
  return CORE_WEAPONS[weaponKey] ?? null;
}
