function variant({ key, displayName, identity, description, effectsSummary, traits }) {
  return Object.freeze({
    key,
    displayName,
    identity,
    description,
    effectsSummary: Object.freeze([...effectsSummary]),
    traits: Object.freeze([...traits]),
    derivedModifiers: Object.freeze({})
  });
}

export const ARKENGINE_VARIANTS = Object.freeze({
  stormwake: variant({
    key: "stormwake",
    displayName: "Stormwake Pattern",
    identity: "speed-focused unstable engines",
    description: "Stormwake engines prioritize raw voyage velocity and volatile surge output over predictable strain behavior.",
    effectsSummary: [
      "Faster voyage speed",
      "Stronger overcharge",
      "Increased strain",
      "Surge-prone systems"
    ],
    traits: ["speed", "unstable", "surge-prone"]
  }),
  bastion: variant({
    key: "bastion",
    displayName: "Bastion Pattern",
    identity: "defensive Lifeveil engines",
    description: "Bastion engines emphasize protected Lifeveil output and steady defensive operations at the cost of movement profile.",
    effectsSummary: [
      "Stronger Lifeveil",
      "Improved resistances",
      "Slower movement",
      "Stable overcharge"
    ],
    traits: ["defensive", "lifeveil", "stable"]
  }),
  choirbound: variant({
    key: "choirbound",
    displayName: "Choirbound Pattern",
    identity: "militarized assault engines",
    description: "Choirbound engines tune pressure lattices for weapon-facing surges and aggressive combat support.",
    effectsSummary: [
      "Weapon overcharge synergy",
      "Stronger combat profile",
      "Higher strain generation"
    ],
    traits: ["militarized", "assault", "weapon-synergy"]
  }),
  deepveil: variant({
    key: "deepveil",
    displayName: "Deepveil Pattern",
    identity: "occult exploration engines",
    description: "Deepveil engines favor anomaly shielding and void-stable expedition profiles over direct battle output.",
    effectsSummary: [
      "Anomaly resistance",
      "Void stabilization",
      "Weaker direct combat support"
    ],
    traits: ["occult", "exploration", "void-stabilized"]
  }),
  longhaul: variant({
    key: "longhaul",
    displayName: "Longhaul Pattern",
    identity: "trade and endurance engines",
    description: "Longhaul engines support dependable commercial travel, supply discipline, and lower-maintenance endurance.",
    effectsSummary: [
      "Stable travel",
      "Reduced supply strain",
      "Weaker burst performance"
    ],
    traits: ["trade", "endurance", "stable"]
  }),
  riftburn: variant({
    key: "riftburn",
    displayName: "Riftburn Pattern",
    identity: "experimental overcharge engines",
    description: "Riftburn engines chase exceptional tactical output through dangerous, prototype overcharge channels.",
    effectsSummary: [
      "Extreme overcharge potential",
      "Catastrophic surge risk",
      "Unstable systems",
      "Exceptional tactical output"
    ],
    traits: ["experimental", "overcharge", "volatile"]
  }),
  pilgrim: variant({
    key: "pilgrim",
    displayName: "Pilgrim Pattern",
    identity: "ritual and sanctified engines",
    description: "Pilgrim engines are sanctified for morale support, occult steadiness, and purified Lifeveil projection.",
    effectsSummary: [
      "Morale support",
      "Occult stabilization",
      "Stronger Lifeveil purity"
    ],
    traits: ["ritual", "sanctified", "lifeveil-purity"]
  }),
  smuggler: variant({
    key: "smuggler",
    displayName: "Smuggler Pattern",
    identity: "illegal modified engines",
    description: "Smuggler engines use illicit baffles and field masks to reduce detection while complicating maintenance.",
    effectsSummary: [
      "Stealth",
      "Reduced detection",
      "Unstable maintenance profile"
    ],
    traits: ["illegal", "stealth", "maintenance-risk"]
  }),
  leviathan: variant({
    key: "leviathan",
    displayName: "Leviathan Pattern",
    identity: "district-scale infrastructure engines",
    description: "Leviathan engines are civic-scale infrastructure cores that sustain massive Lifeveil envelopes and staffing demands.",
    effectsSummary: [
      "Massive Lifeveil support",
      "Enormous staffing demands",
      "City-scale operational profile"
    ],
    traits: ["district-scale", "infrastructure", "lifeveil"]
  })
});

export const ARKENGINE_VARIANT_KEYS = Object.freeze(Object.keys(ARKENGINE_VARIANTS));

export function getArkengineVariantKeys() {
  return ARKENGINE_VARIANT_KEYS;
}

export function getArkengineVariant(variantKey) {
  return ARKENGINE_VARIANTS[variantKey] ?? null;
}

export function getArkengineVariants() {
  return ARKENGINE_VARIANTS;
}
