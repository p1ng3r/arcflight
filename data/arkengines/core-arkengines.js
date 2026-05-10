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
  traits = []
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
    coreSystems: CORE_SYSTEMS,
    hardBurnProfile: `Hard burn costs ${hardBurnStrainCost} strain. Phase 3 records this profile only and does not resolve hard burn gameplay.`,
    overchargeProfile: `${overchargeRisk} overcharge risk. Phase 3 records this profile only and does not resolve overcharge gameplay.`
  });
}

export const CORE_ARKENGINES = Object.freeze({
  "emberwake-sparkdrive": arkengine({
    engineClass: "emberwake-sparkdrive",
    displayName: "Emberwake Sparkdrive",
    spellRankRequired: 1,
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
