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
  })
});

export const CORE_ARKENGINE_MOD_KEYS = Object.freeze(Object.keys(CORE_ARKENGINE_MODS));

export function getCoreArkengineModKeys() {
  return CORE_ARKENGINE_MOD_KEYS;
}

export function getCoreArkengineMod(modKey) {
  return CORE_ARKENGINE_MODS[modKey] ?? null;
}
