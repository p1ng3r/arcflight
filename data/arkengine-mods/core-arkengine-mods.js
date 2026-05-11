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

function defaultTierForMod(modType, traits = []) {
  if (["ritual", "deepVoid"].includes(modType) || traits.includes("deep-void")) return 3;
  if (["speed", "overcharge", "hardBurn"].includes(modType)) return 2;
  return 1;
}

function defaultPressureForMod(modType, minimumTier, traits = []) {
  if (modType === "lifeveil" || traits.includes("lifeveil")) return { lifeveilPressure: Math.max(1, minimumTier) };
  if (modType === "ritual") return { occultPressure: 2, lifeveilPressure: 1 };
  if (modType === "deepVoid") return { enginePressure: 1, occultPressure: 1 };
  return { enginePressure: Math.max(1, minimumTier) };
}

const STANDARD_INSTALLATION = Object.freeze({
  modSlotsRequired: 1,
  requiresPortOrDock: true,
  canInstallDuringTravel: false,
  installCost: "",
  installTimeDays: 0,
  playerAssistCostReductionMaxPercent: 0
});

function modifier(target, mode, value, summary = "") {
  return Object.freeze({ target, mode, value, summary });
}

function arkengineMod({
  id,
  displayName,
  modType,
  rarity = "standard",
  origin = "Arcflight Core",
  role,
  description = role,
  installation = {},
  derivedStatModifiers = [],
  hardBurnInteractions = [],
  overchargeInteractions = [],
  fuelInteractions = [],
  lifeveilInteractions = [],
  strainInteractions = [],
  resistanceInteractions = [],
  roomInteractions = [],
  systemInteractions = [],
  restrictions = {},
  systemState = "Functional",
  traits = [],
  minimumTier = defaultTierForMod(modType, traits),
  recommendedTier = minimumTier,
  tierImpact = `Tier ${recommendedTier} arkengine mod metadata for future hull and engine compatibility review.`,
  refitPressure = defaultPressureForMod(modType, minimumTier, traits),
  refitTags = ["arkengine-mod", modType, ...traits],
  refitCategory = Object.keys(refitPressure).find((key) => refitPressure[key] > 0) ?? "enginePressure",
  specialistRequirements = minimumTier >= 3 ? ["arkengine refit specialist"] : [],
  rareMaterialRequirements = minimumTier >= 4 ? ["attuned aetherite fittings"] : [],
  designIntent = role,
  gmNotes = ""
}) {
  return Object.freeze({
    componentType: "arkengineMod",
    identity: Object.freeze({
      id,
      displayName,
      modType,
      rarity,
      origin,
      role,
      description
    }),
    installation: Object.freeze({
      ...STANDARD_INSTALLATION,
      ...installation
    }),
    effects: Object.freeze({
      derivedStatModifiers: Object.freeze([...derivedStatModifiers]),
      hardBurnInteractions: Object.freeze([...hardBurnInteractions]),
      overchargeInteractions: Object.freeze([...overchargeInteractions]),
      fuelInteractions: Object.freeze([...fuelInteractions]),
      lifeveilInteractions: Object.freeze([...lifeveilInteractions]),
      strainInteractions: Object.freeze([...strainInteractions]),
      resistanceInteractions: Object.freeze([...resistanceInteractions]),
      roomInteractions: Object.freeze([...roomInteractions]),
      systemInteractions: Object.freeze([...systemInteractions])
    }),
    restrictions: Object.freeze({
      unique: false,
      maxInstances: 1,
      requiredArkengineTags: Object.freeze([]),
      blockedArkengineTags: Object.freeze([]),
      requiredVariantFamilies: Object.freeze([]),
      blockedVariantFamilies: Object.freeze([]),
      notes: "",
      ...restrictions
    }),
    state: Object.freeze({ systemState }),
    minimumTier,
    recommendedTier,
    tierImpact,
    refitPressure: buildRefitPressure(refitPressure),
    refitTags: Object.freeze([...new Set(refitTags)]),
    refitCategory,
    specialistRequirements: Object.freeze([...specialistRequirements]),
    rareMaterialRequirements: Object.freeze([...rareMaterialRequirements]),
    traits: Object.freeze([...traits]),
    notes: Object.freeze({
      designIntent,
      gmNotes
    })
  });
}

export const CORE_ARKENGINE_MODS = Object.freeze({
  "pressure-lattice-tuning": arkengineMod({
    id: "pressure-lattice-tuning",
    displayName: "Pressure Lattice Tuning",
    modType: "stability",
    role: "improves engine pressure tolerance",
    derivedStatModifiers: [modifier("strainCapacity", "add", 1, "+1 strain capacity")],
    strainInteractions: ["Placeholder: smoother pressure flow."],
    traits: ["standard", "stability", "pressure-lattice"]
  }),
  "veil-projector-focusing": arkengineMod({
    id: "veil-projector-focusing",
    displayName: "Veil Projector Focusing",
    modType: "lifeveil",
    role: "improves Lifeveil output",
    derivedStatModifiers: [modifier("lifeveilCapacity", "add", 5, "+5 Lifeveil capacity")],
    lifeveilInteractions: ["Placeholder: cleaner veil projection."],
    traits: ["standard", "lifeveil", "veil-projector"]
  }),
  "cooling-loop-expansion": arkengineMod({
    id: "cooling-loop-expansion",
    displayName: "Cooling Loop Expansion",
    modType: "cooling",
    role: "reduces dangerous heat/surge buildup",
    hardBurnInteractions: ["Placeholder: reduced heat stress."],
    overchargeInteractions: ["Placeholder: safer overcharge cooling."],
    traits: ["standard", "cooling", "hard-burn", "overcharge"]
  }),
  "fuel-matrix-efficiency": arkengineMod({
    id: "fuel-matrix-efficiency",
    displayName: "Fuel Matrix Efficiency",
    modType: "fueling",
    role: "improves spell-fuel conversion efficiency",
    fuelInteractions: ["Placeholder: reduced fueling waste."],
    traits: ["standard", "fueling", "fuel-matrix"]
  }),
  "stormwake-injector": arkengineMod({
    id: "stormwake-injector",
    displayName: "Stormwake Injector",
    modType: "overcharge",
    role: "increases burst output at higher risk",
    derivedStatModifiers: [modifier("voyageSpeedTravelHexDays", "subtract", 1, "-1 travel hex day; lower is faster")],
    strainInteractions: ["Placeholder: increased strain pressure."],
    systemInteractions: ["Placeholder: worsened overcharge risk profile; Overcharge resolution is not implemented in this phase."],
    traits: ["standard", "overcharge", "stormwake"]
  }),
  "voidglass-regulator": arkengineMod({
    id: "voidglass-regulator",
    displayName: "Voidglass Regulator",
    modType: "voidStability",
    role: "stabilizes void exposure and deep-space pressure",
    derivedStatModifiers: [modifier("resistanceTendencies", "append", "void", "Adds void resistance tendency")],
    resistanceInteractions: ["Placeholder: improves void/cold stability."],
    traits: ["standard", "void", "stability"]
  }),
  "choir-harmonic-lattice": arkengineMod({
    id: "choir-harmonic-lattice",
    displayName: "Choir Harmonic Lattice",
    modType: "harmonic",
    role: "stabilizes ritualized engine resonance",
    derivedStatModifiers: [modifier("lifeveilCapacity", "add", 5, "+5 Lifeveil capacity")],
    lifeveilInteractions: ["Placeholder: cleaner resonance."],
    traits: ["standard", "harmonic", "lifeveil"]
  }),
  "overburn-catalysts": arkengineMod({
    id: "overburn-catalysts",
    displayName: "Overburn Catalysts",
    modType: "overcharge",
    role: "increases dangerous emergency output",
    hardBurnInteractions: ["Placeholder: stronger hard burn potential."],
    strainInteractions: ["Placeholder: increased surge danger."],
    refitPressure: { enginePressure: 4 },
    refitTags: ["arkengine-mod", "overcharge", "experimental-overburn", "hard-burn"],
    specialistRequirements: ["arkengine refit specialist"],
    rareMaterialRequirements: ["volatile overburn catalysts"],
    traits: ["standard", "overcharge", "hard-burn"]
  }),
  "deepwake-stabilizers": arkengineMod({
    id: "deepwake-stabilizers",
    displayName: "Deepwake Stabilizers",
    modType: "deepVoid",
    role: "improves deep-void endurance",
    derivedStatModifiers: [modifier("resistanceTendencies", "append", "void", "Adds void resistance tendency")],
    resistanceInteractions: ["Placeholder: deep void stability."],
    traits: ["standard", "deep-void", "void", "stability"]
  }),
  "aetherite-core-bracing": arkengineMod({
    id: "aetherite-core-bracing",
    displayName: "Aetherite Core Bracing",
    modType: "coreStability",
    role: "reinforces the engine core against strain spikes",
    derivedStatModifiers: [modifier("strainCapacity", "add", 2, "+2 strain capacity")],
    systemInteractions: ["Placeholder: reduced core instability."],
    traits: ["standard", "core-stability", "aetherite"]
  }),
  "refined-fuel-siphons": arkengineMod({
    id: "refined-fuel-siphons",
    displayName: "Refined Fuel Siphons",
    modType: "fueling",
    role: "improves spell-rank fuel handling",
    derivedStatModifiers: [modifier("fuelSlots", "add", 1, "+1 fuel slot")],
    fuelInteractions: ["Placeholder: improved refueling efficiency."],
    traits: ["standard", "fueling", "fuel-siphons"]
  }),
  "hushglass-cowl": arkengineMod({
    id: "hushglass-cowl",
    displayName: "Hushglass Cowl",
    modType: "stealth",
    role: "suppresses arkengine glow and hum",
    derivedStatModifiers: [modifier("resistanceTendencies", "append", "detectionMasking", "Adds detection masking resistance tendency")],
    systemInteractions: ["Placeholder: stealth burn support."],
    traits: ["standard", "stealth", "hushglass"]
  }),
  "hard-burn-governor": arkengineMod({
    id: "hard-burn-governor",
    displayName: "Hard Burn Governor",
    modType: "hardBurn",
    role: "smooths aggressive burn pressure",
    derivedStatModifiers: [modifier("hardBurnStrainCost", "subtract", 1, "-1 hard burn strain cost; minimum 1 once minimum-bounded modifiers are supported")],
    hardBurnInteractions: ["Placeholder: safer hard burn handling."],
    traits: ["standard", "hard-burn", "governor"],
    gmNotes: "Current modifier helper supports the -1 cost adjustment but not minimum bounds; intended floor is 1 when minimum-bounded derived modifiers are supported."
  }),
  "overcharge-grounding-rods": arkengineMod({
    id: "overcharge-grounding-rods",
    displayName: "Overcharge Grounding Rods",
    modType: "overcharge",
    role: "vents dangerous surge buildup",
    derivedStatModifiers: [modifier("strainCapacity", "add", 1, "+1 strain capacity")],
    overchargeInteractions: ["Placeholder: reduced surge severity."],
    traits: ["standard", "overcharge", "grounding"]
  }),
  "lifeveil-harmonic-prism": arkengineMod({
    id: "lifeveil-harmonic-prism",
    displayName: "Lifeveil Harmonic Prism",
    modType: "lifeveil",
    role: "strengthens atmospheric veil projection",
    derivedStatModifiers: [modifier("lifeveilCapacity", "add", 10, "+10 Lifeveil capacity")],
    lifeveilInteractions: ["Placeholder: stronger atmospheric veil projection."],
    traits: ["standard", "lifeveil", "harmonic", "prism"]
  }),
  "emergency-pressure-bypass": arkengineMod({
    id: "emergency-pressure-bypass",
    displayName: "Emergency Pressure Bypass",
    modType: "emergency",
    role: "redirects dangerous engine pressure during crisis",
    derivedStatModifiers: [modifier("strainCapacity", "add", 1, "+1 strain capacity")],
    systemInteractions: ["Placeholder: emergency stabilization."],
    traits: ["standard", "emergency", "pressure"]
  }),
  "deepwake-resonance-baffles": arkengineMod({
    id: "deepwake-resonance-baffles",
    displayName: "Deepwake Resonance Baffles",
    modType: "deepVoid",
    role: "stabilizes engine rhythm in deep void currents",
    derivedStatModifiers: [modifier("resistanceTendencies", "append", "deepVoid", "Adds deep void resistance tendency")],
    resistanceInteractions: ["Placeholder: deep void current stability."],
    traits: ["standard", "deep-void", "resonance", "stability"]
  }),
  "quickspark-injectors": arkengineMod({
    id: "quickspark-injectors",
    displayName: "Quickspark Injectors",
    modType: "speed",
    role: "improves short-burst propulsion output",
    derivedStatModifiers: [
      modifier("voyageSpeedTravelHexDays", "subtract", 1, "-1 travel hex day; lower is faster"),
      modifier("hardBurnStrainCost", "add", 1, "+1 hard burn strain cost")
    ],
    hardBurnInteractions: ["Placeholder: higher hard burn pressure from burst output."],
    refitPressure: { enginePressure: 3 },
    refitTags: ["arkengine-mod", "speed", "burst-output", "hard-burn"],
    specialistRequirements: ["arkengine refit specialist"],
    traits: ["standard", "speed", "quickspark"]
  }),
  "ritual-channeling-rings": arkengineMod({
    id: "ritual-channeling-rings",
    displayName: "Ritual Channeling Rings",
    modType: "ritual",
    role: "improves ritual fueling and sanctified engine handling",
    derivedStatModifiers: [modifier("lifeveilCapacity", "add", 5, "+5 Lifeveil capacity")],
    fuelInteractions: ["Placeholder: ritual refueling support."],
    lifeveilInteractions: ["Placeholder: sanctified engine handling."],
    traits: ["standard", "ritual", "channeling", "lifeveil"]
  }),
  "aetheric-filter-mesh": arkengineMod({
    id: "aetheric-filter-mesh",
    displayName: "Aetheric Filter Mesh",
    modType: "filtration",
    role: "filters unstable spell energy before it reaches the core",
    derivedStatModifiers: [modifier("strainCapacity", "add", 1, "+1 strain capacity")],
    fuelInteractions: ["Placeholder: safer emergency spell sacrifice."],
    traits: ["standard", "filtration", "aetheric"]
  }),
  "coldwake-condensers": arkengineMod({
    id: "coldwake-condensers",
    displayName: "Coldwake Condensers",
    modType: "cooling",
    role: "reinforces cooling systems for long voyages",
    derivedStatModifiers: [modifier("resistanceTendencies", "append", "cold", "Adds cold resistance tendency")],
    hardBurnInteractions: ["Placeholder: reduced heat stress."],
    traits: ["standard", "cooling", "coldwake"]
  }),
  "veil-pressure-equalizer": arkengineMod({
    id: "veil-pressure-equalizer",
    displayName: "Veil Pressure Equalizer",
    modType: "lifeveil",
    role: "balances Lifeveil pressure across the ship",
    derivedStatModifiers: [
      modifier("lifeveilCapacity", "add", 5, "+5 Lifeveil capacity"),
      modifier("strainCapacity", "add", 1, "+1 strain capacity")
    ],
    lifeveilInteractions: ["Placeholder: balanced Lifeveil pressure."],
    strainInteractions: ["Placeholder: smoother veil pressure distribution."],
    traits: ["standard", "lifeveil", "pressure"]
  })
});

export const CORE_ARKENGINE_MOD_KEYS = Object.freeze(Object.keys(CORE_ARKENGINE_MODS));

export function getCoreArkengineModKeys() {
  return CORE_ARKENGINE_MOD_KEYS;
}

export function getCoreArkengineMod(modKey) {
  return CORE_ARKENGINE_MODS[modKey] ?? null;
}
