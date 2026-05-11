import { ARKENGINE_VARIANT_KEYS } from "./arkengine-variants.js";

const CORE_SYSTEMS = Object.freeze([
  "Aetherite Core",
  "Pressure Lattice",
  "Veil Projector",
  "Cooling System",
  "Regulator",
  "Fuel Matrix",
  "Channeling Assembly"
]);

const FUEL_COST_FORMULAS = Object.freeze({
  normalHexCostFormula: "requiredSpellRank",
  hardBurnHexCostFormula: "ceil(requiredSpellRank * 1.5)",
  leanBurnHexCostFormula: "ceil(requiredSpellRank / 2)",
  stealthBurnHexCostFormula: "ceil(requiredSpellRank * 1.5)",
  overchargeCostFormula: "definedByOverchargeAction"
});

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

function defaultArkengineTier(spellRankRequired) {
  const rank = Number.parseInt(spellRankRequired, 10);
  if (rank >= 7) return 5;
  if (rank >= 6) return 4;
  if (rank >= 3) return 3;
  if (rank >= 2) return 2;
  return 1;
}

function buildArkengineFueling(requiredSpellRank, fuelSlots) {
  const numericRequiredSpellRank = Number.isFinite(Number(requiredSpellRank)) ? Number(requiredSpellRank) : 0;
  const numericFuelSlots = Number.isFinite(Number(fuelSlots)) ? Number(fuelSlots) : 0;

  return Object.freeze({
    requiredSpellRank: numericRequiredSpellRank,
    fuelSlots: numericFuelSlots,
    maxStoredSpellRanks: numericRequiredSpellRank * numericFuelSlots,
    currentStoredSpellRanks: 0,
    ...FUEL_COST_FORMULAS,
    emergencySpellSlotFuelingAllowed: true
  });
}

function arkengine({
  engineClass,
  displayName,
  spellRankRequired,
  travelHexDays,
  lifeveilModifier,
  strainModifier,
  overchargeRisk,
  hardBurnStrainCost,
  modSlots,
  resistanceTendencies,
  identity,
  variantFamily = "",
  allowedVariantFamilies = ARKENGINE_VARIANT_KEYS,
  modSlotProfile = "standard",
  role = identity,
  traits = [],
  fuelSlots = 0,
  fuelingRequiredSpellRank = spellRankRequired,
  ritualCircleRequired = false,
  minimumTier = defaultArkengineTier(spellRankRequired),
  recommendedTier = minimumTier,
  tierImpact = `Tier ${recommendedTier} arkengine pressure profile; future install validation can compare this engine class against the hull tier.`,
  refitPressure = { enginePressure: Math.max(1, minimumTier) },
  refitTags = ["arkengine", variantFamily, modSlotProfile].filter(Boolean),
  refitCategory = "enginePressure",
  specialistRequirements = minimumTier >= 3 ? ["arkenginewright"] : [],
  rareMaterialRequirements = minimumTier >= 4 ? ["stabilized aetherite core"] : []
}) {
  return Object.freeze({
    componentType: "arkengine",
    engineClass,
    displayName,
    spellRankRequired,
    travelHexDays,
    lifeveilModifier,
    strainModifier,
    overchargeRisk,
    hardBurnStrainCost,
    modSlots,
    resistanceTendencies: Object.freeze([...resistanceTendencies]),
    traits: Object.freeze([...traits]),
    variantFamily,
    allowedVariantFamilies: Object.freeze([...allowedVariantFamilies]),
    modSlotProfile,
    role,
    designNotes: identity,
    ritualCircleRequired,
    minimumTier,
    recommendedTier,
    tierImpact,
    refitPressure: buildRefitPressure(refitPressure),
    refitTags: Object.freeze([...refitTags]),
    refitCategory,
    specialistRequirements: Object.freeze([...specialistRequirements]),
    rareMaterialRequirements: Object.freeze([...rareMaterialRequirements]),
    coreSystems: CORE_SYSTEMS,
    fueling: buildArkengineFueling(fuelingRequiredSpellRank, fuelSlots),
    hardBurnProfile: `Hard burn costs ${hardBurnStrainCost} strain. Phase 3 records this profile only and does not resolve hard burn gameplay.`,
    overchargeProfile: `${overchargeRisk} overcharge risk. Phase 3 records this profile only and does not resolve overcharge gameplay.`
  });
}

export const CORE_ARKENGINES = Object.freeze({
  "emberwake-sparkdrive": arkengine({
    engineClass: "emberwake-sparkdrive",
    displayName: "Emberwake Sparkdrive",
    spellRankRequired: 1,
    fuelSlots: 6,
    travelHexDays: 7,
    lifeveilModifier: 0,
    strainModifier: 0,
    overchargeRisk: "High",
    hardBurnStrainCost: 3,
    modSlots: 3,
    resistanceTendencies: ["electricity"],
    identity: "unstable skiff-grade starter engine",
    variantFamily: "stormwake",
    traits: ["unstable", "skiff-grade", "starter"]
  }),
  "lanterncoil-arkengine": arkengine({
    engineClass: "lanterncoil-arkengine",
    displayName: "Lanterncoil Arkengine",
    spellRankRequired: 1,
    fuelSlots: 8,
    travelHexDays: 6,
    lifeveilModifier: 5,
    strainModifier: 1,
    overchargeRisk: "Standard",
    hardBurnStrainCost: 2,
    modSlots: 3,
    resistanceTendencies: ["fire", "cold"],
    identity: "common civilian voyage engine",
    variantFamily: "longhaul",
    traits: ["civilian", "common", "voyage"]
  }),
  "tidewake-arkengine": arkengine({
    engineClass: "tidewake-arkengine",
    displayName: "Tidewake Arkengine",
    spellRankRequired: 2,
    fuelSlots: 10,
    travelHexDays: 5,
    lifeveilModifier: 10,
    strainModifier: 2,
    overchargeRisk: "Standard",
    hardBurnStrainCost: 2,
    modSlots: 4,
    resistanceTendencies: ["cold", "void"],
    identity: "reliable explorer-class engine",
    variantFamily: "deepveil",
    traits: ["reliable", "explorer-class", "voyage"]
  }),
  "iron-choir-engine": arkengine({
    engineClass: "iron-choir-engine",
    displayName: "Iron Choir Engine",
    spellRankRequired: 3,
    fuelSlots: 10,
    travelHexDays: 4,
    lifeveilModifier: 8,
    strainModifier: 3,
    overchargeRisk: "Standard/High",
    hardBurnStrainCost: 3,
    modSlots: 4,
    resistanceTendencies: ["fire", "electricity"],
    identity: "militarized pressure lattice engine",
    variantFamily: "choirbound",
    traits: ["militarized", "pressure-lattice", "warship"]
  }),
  "furnaceheart-drive": arkengine({
    engineClass: "furnaceheart-drive",
    displayName: "Furnaceheart Drive",
    spellRankRequired: 4,
    fuelSlots: 12,
    travelHexDays: 4,
    lifeveilModifier: 15,
    strainModifier: 4,
    overchargeRisk: "Standard",
    hardBurnStrainCost: 3,
    modSlots: 4,
    resistanceTendencies: ["fire"],
    identity: "heavy cargo and industrial engine",
    variantFamily: "longhaul",
    traits: ["heavy", "cargo", "industrial"]
  }),
  "voidbreaker-arkengine": arkengine({
    engineClass: "voidbreaker-arkengine",
    displayName: "Voidbreaker Arkengine",
    spellRankRequired: 4,
    fuelSlots: 10,
    travelHexDays: 3,
    lifeveilModifier: 10,
    strainModifier: 5,
    overchargeRisk: "High",
    hardBurnStrainCost: 4,
    modSlots: 5,
    resistanceTendencies: ["force", "fire"],
    identity: "aggressive assault-pattern engine",
    variantFamily: "choirbound",
    traits: ["aggressive", "assault-pattern", "warship"]
  }),
  "deepwake-veil-engine": arkengine({
    engineClass: "deepwake-veil-engine",
    displayName: "Deepwake Veil Engine",
    spellRankRequired: 5,
    fuelSlots: 14,
    travelHexDays: 3,
    lifeveilModifier: 25,
    strainModifier: 5,
    overchargeRisk: "Standard",
    hardBurnStrainCost: 3,
    modSlots: 5,
    resistanceTendencies: ["cold", "void"],
    identity: "deep-void endurance engine",
    variantFamily: "deepveil",
    traits: ["deep-void", "endurance", "veil"]
  }),
  "crownfire-arkengine": arkengine({
    engineClass: "crownfire-arkengine",
    displayName: "Crownfire Arkengine",
    spellRankRequired: 6,
    fuelSlots: 12,
    travelHexDays: 2,
    lifeveilModifier: 20,
    strainModifier: 6,
    overchargeRisk: "High",
    hardBurnStrainCost: 4,
    modSlots: 5,
    resistanceTendencies: ["force", "electricity"],
    identity: "elite flagship-grade engine",
    variantFamily: "riftburn",
    traits: ["elite", "flagship-grade", "crownfire"]
  }),
  "sanctum-choir-core": arkengine({
    engineClass: "sanctum-choir-core",
    displayName: "Sanctum Choir Core",
    spellRankRequired: 6,
    fuelSlots: 16,
    travelHexDays: 3,
    lifeveilModifier: 35,
    strainModifier: 5,
    overchargeRisk: "Low/Standard",
    hardBurnStrainCost: 3,
    modSlots: 5,
    resistanceTendencies: ["spirit", "void", "vitality"],
    identity: "ritual-focused Lifeveil engine",
    variantFamily: "pilgrim",
    traits: ["ritual", "lifeveil", "sanctum"]
  }),
  "worldbinder-arkengine": arkengine({
    engineClass: "worldbinder-arkengine",
    displayName: "Worldbinder Arkengine",
    spellRankRequired: 7,
    fuelSlots: 18,
    travelHexDays: 2,
    lifeveilModifier: 40,
    strainModifier: 7,
    overchargeRisk: "High",
    hardBurnStrainCost: 5,
    modSlots: 6,
    resistanceTendencies: ["force", "void", "spirit"],
    identity: "mythic reality-binding engine",
    variantFamily: "riftburn",
    traits: ["mythic", "reality-binding", "worldbinder"]
  }),
  "leviathan-heart-core": arkengine({
    engineClass: "leviathan-heart-core",
    displayName: "Leviathan Heart Core",
    spellRankRequired: "7 + ritual circle",
    fuelingRequiredSpellRank: 7,
    fuelSlots: 30,
    ritualCircleRequired: true,
    travelHexDays: 1,
    lifeveilModifier: 75,
    strainModifier: 10,
    overchargeRisk: "Catastrophic",
    hardBurnStrainCost: 6,
    modSlots: 7,
    resistanceTendencies: ["broad energy resistance"],
    identity: "city-scale arkengine infrastructure",
    variantFamily: "leviathan",
    traits: ["leviathan", "city-scale", "infrastructure"]
  })
});

export const CORE_ARKENGINE_KEYS = Object.freeze(Object.keys(CORE_ARKENGINES));

export function getCoreArkengineKeys() {
  return CORE_ARKENGINE_KEYS;
}

export function getCoreArkengine(engineKey) {
  return CORE_ARKENGINES[engineKey] ?? null;
}
