function hullPattern({
  key,
  displayName,
  description,
  traits = [],
  derivedStatModifiers = {},
  notes = []
}) {
  return Object.freeze({
    key,
    displayName,
    appliesTo: "hull",
    description,
    traits: Object.freeze([...traits]),
    derivedStatModifiers: Object.freeze({ ...derivedStatModifiers }),
    notes: Object.freeze([...notes])
  });
}

export const HULL_PATTERNS = Object.freeze({
  standard: hullPattern({
    key: "standard",
    displayName: "Standard Pattern",
    description: "Baseline hull configuration with no specialized operational emphasis.",
    traits: ["baseline", "general-purpose"],
    notes: ["Default configured hull pattern for ordinary installations."]
  }),
  battle: hullPattern({
    key: "battle",
    displayName: "Battle Pattern",
    description: "Reinforced hull configuration emphasizing protection, weapon readiness, and battle-line endurance.",
    traits: ["reinforced", "martial", "battle-line"],
    derivedStatModifiers: {
      armorClass: 1,
      hullIntegrity: 20,
      maneuverability: -1,
      cargoCapacity: -5,
      detection: 1
    },
    notes: ["Records intended battle emphasis only; modifiers are applied during ship stat recalculation."]
  }),
  explorer: hullPattern({
    key: "explorer",
    displayName: "Explorer Pattern",
    description: "Survey-oriented hull configuration prioritizing range, redundancy, and reliable expedition support.",
    traits: ["survey", "expedition", "redundant-systems"],
    derivedStatModifiers: {
      lifeveilCapacity: 5,
      strainCapacity: 1,
      cargoCapacity: -2
    },
    notes: ["Intended for long-duration scouting and charting roles."]
  }),
  trade: hullPattern({
    key: "trade",
    displayName: "Trade Pattern",
    description: "Cargo-forward hull configuration tuned for merchant routes and volume-efficient stowage.",
    traits: ["merchant", "cargo", "route-optimized"],
    derivedStatModifiers: {
      cargoCapacity: 10,
      maneuverability: -1
    },
    notes: ["Represents commercial fitting data only; no cargo automation is added."]
  }),
  stealth: hullPattern({
    key: "stealth",
    displayName: "Stealth Pattern",
    description: "Low-observable hull configuration that favors masked profiles and quiet running over capacity.",
    traits: ["low-observable", "quiet-running", "covert"],
    derivedStatModifiers: {
      detection: -1,
      cargoCapacity: -4,
      hullIntegrity: -5
    },
    notes: ["Stores stealth configuration intent without changing detection gameplay."]
  }),
  racing: hullPattern({
    key: "racing",
    displayName: "Racing Pattern",
    description: "Lightweight hull configuration built for speed, response, and competitive voidsailing.",
    traits: ["lightweight", "fast", "responsive"],
    derivedStatModifiers: {
      combatSpeed: 1,
      maneuverability: 1,
      cargoCapacity: -6,
      hullIntegrity: -5
    },
    notes: ["Records racing fit data only; no movement rules are changed."]
  }),
  occult: hullPattern({
    key: "occult",
    displayName: "Occult Pattern",
    description: "Esoteric hull configuration prepared for veil-sensitive rites, warding geometry, and unusual phenomena.",
    traits: ["esoteric", "warded", "veil-sensitive"],
    derivedStatModifiers: {
      lifeveilCapacity: 10,
      strainCapacity: -1,
      detection: 1
    },
    notes: ["Reserved for supernatural configuration data; no ritual or hazard automation is added."]
  })
});

export const HULL_PATTERN_KEYS = Object.freeze(Object.keys(HULL_PATTERNS));

export function getHullPatternKeys() {
  return HULL_PATTERN_KEYS;
}

export function getHullPattern(patternKey) {
  return HULL_PATTERNS[patternKey] ?? null;
}
