function arkenginePattern({
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
    appliesTo: "arkengine",
    description,
    traits: Object.freeze([...traits]),
    derivedStatModifiers: Object.freeze({ ...derivedStatModifiers }),
    notes: Object.freeze([...notes])
  });
}

export const ARKENGINE_PATTERNS = Object.freeze({
  standard: arkenginePattern({
    key: "standard",
    displayName: "Standard Pattern",
    description: "Baseline arkengine configuration with factory-normal channeling and maintenance assumptions.",
    traits: ["baseline", "general-purpose"],
    notes: ["Default configured arkengine pattern for ordinary installations."]
  }),
  guild: arkenginePattern({
    key: "guild",
    displayName: "Guild Pattern",
    description: "Licensed guild configuration favoring predictable output, documented servicing, and regulated operation.",
    traits: ["licensed", "regulated", "serviceable"],
    derivedStatModifiers: {
      overchargeRiskStep: -1,
      hardBurnStrainCost: 1
    },
    notes: ["Represents conservative guild tuning only; overcharge and hard burn gameplay are not changed."]
  }),
  military: arkenginePattern({
    key: "military",
    displayName: "Military Pattern",
    description: "Hardened arkengine configuration emphasizing battle damage tolerance and aggressive pressure handling.",
    traits: ["hardened", "martial", "pressure-rated"],
    derivedStatModifiers: {
      strainModifier: 1,
      lifeveilModifier: -2,
      overchargeRiskStep: 1
    },
    notes: ["Records military tuning intent without applying derived stat changes."]
  }),
  experimental: arkenginePattern({
    key: "experimental",
    displayName: "Experimental Pattern",
    description: "Prototype arkengine configuration that trades stability for unusual output curves and research access.",
    traits: ["prototype", "volatile", "research"],
    derivedStatModifiers: {
      travelHexDays: -1,
      overchargeRiskStep: 2,
      strainModifier: 1
    },
    notes: ["Derived stat modifiers are applied during recalculation; experimental risks are not resolved."]
  }),
  smuggler: arkenginePattern({
    key: "smuggler",
    displayName: "Smuggler Pattern",
    description: "Concealed arkengine configuration adapted for quiet burn profiles and inspection evasion.",
    traits: ["concealed", "quiet-burn", "illegal"],
    derivedStatModifiers: {
      stealthBurnHexCost: -1,
      fuelSlots: -1,
      overchargeRiskStep: 1
    },
    notes: ["No stealth travel, inspection, or legality automation is added."]
  }),
  pilgrim: arkenginePattern({
    key: "pilgrim",
    displayName: "Pilgrim Pattern",
    description: "Devotional arkengine configuration emphasizing life-support stability and ritual familiarity.",
    traits: ["devotional", "lifeveil", "ritual"],
    derivedStatModifiers: {
      lifeveilModifier: 5,
      travelHexDays: 1
    },
    notes: ["Stores religious voyage flavor and modifier data only."]
  }),
  stormwake: arkenginePattern({
    key: "stormwake",
    displayName: "Stormwake Pattern",
    description: "High-discharge arkengine configuration tuned for turbulent wakes and storm-channel response.",
    traits: ["storm-tuned", "high-discharge", "volatile"],
    derivedStatModifiers: {
      combatSpeed: 1,
      hardBurnStrainCost: -1,
      overchargeRiskStep: 1
    },
    notes: ["No weather, travel, or combat-speed automation is added."]
  }),
  deepveil: arkenginePattern({
    key: "deepveil",
    displayName: "Deepveil Pattern",
    description: "Shielded arkengine configuration suited to dim routes, pressure anomalies, and veil-dense regions.",
    traits: ["shielded", "deep-route", "veil-adapted"],
    derivedStatModifiers: {
      lifeveilModifier: 5,
      strainModifier: 1,
      travelHexDays: 1
    },
    notes: ["No anomaly or hazard automation is added."]
  }),
  longhaul: arkenginePattern({
    key: "longhaul",
    displayName: "Longhaul Pattern",
    description: "Endurance arkengine configuration optimized for steady routes, fuel discipline, and sustained voyages.",
    traits: ["endurance", "efficient", "route-optimized"],
    derivedStatModifiers: {
      fuelSlots: 2,
      leanBurnHexCost: -1,
      travelHexDays: 1
    },
    notes: ["Records endurance tuning only; travel and resource gameplay are not implemented."]
  })
});

export const ARKENGINE_PATTERN_KEYS = Object.freeze(Object.keys(ARKENGINE_PATTERNS));

export function getArkenginePatternKeys() {
  return ARKENGINE_PATTERN_KEYS;
}

export function getArkenginePattern(patternKey) {
  return ARKENGINE_PATTERNS[patternKey] ?? null;
}
