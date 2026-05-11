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

function defaultTierForUpgrade(upgradeType, traits = []) {
  if (["military", "deepVoid", "occult", "command"].includes(upgradeType) || traits.includes("deepVoid")) return 3;
  if (["lifeveil", "powerDistribution", "propulsionSupport", "catastrophe"].includes(upgradeType)) return 2;
  return 1;
}

function defaultPressureForUpgrade(upgradeType, minimumTier, traits = []) {
  if (upgradeType === "military") return { weaponPressure: Math.max(2, minimumTier), infrastructurePressure: 1 };
  if (["propulsionSupport", "sailSystem", "helmSystem", "mobility"].includes(upgradeType)) return { enginePressure: Math.max(1, minimumTier) };
  if (upgradeType === "lifeveil") return { lifeveilPressure: Math.max(1, minimumTier) };
  if (upgradeType === "command" || upgradeType === "coordination") return { crewCommandPressure: Math.max(1, minimumTier) };
  if (upgradeType === "occult") return { occultPressure: Math.max(1, minimumTier) };
  if (upgradeType === "deepVoid" || traits.includes("deepVoid")) return { infrastructurePressure: 1, occultPressure: 1 };
  return { infrastructurePressure: Math.max(1, minimumTier) };
}

const UPGRADE_TYPES = Object.freeze({
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

const SYSTEM_STATES = Object.freeze({
  FUNCTIONAL: "Functional",
  DAMAGED: "Damaged",
  DISABLED: "Disabled",
  DESTROYED: "Destroyed"
});

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function modifier(target, mode, value, summary = "") {
  return { target, mode, value, summary };
}

function shipUpgrade({
  id,
  displayName,
  upgradeType,
  role,
  description,
  derivedStatModifiers = [],
  conditionInteractions = [],
  operationalEffects = [],
  systemInteractions = [],
  stationInteractions = [],
  eventInteractions = [],
  unique = false,
  maxInstances = 1,
  requiredHullTags = [],
  blockedHullTags = [],
  requiredArkengineTags = [],
  restrictionNotes = "",
  traits = [],
  designIntent,
  gmNotes = "",
  installCost = "GM-defined",
  installTimeDays = 0,
  playerAssistCostReductionMaxPercent = 0,
  requiresPortOrDock = true,
  canInstallDuringTravel = false,
  systemState = SYSTEM_STATES.FUNCTIONAL,
  minimumTier = defaultTierForUpgrade(upgradeType, traits),
  recommendedTier = minimumTier,
  tierImpact = `Tier ${recommendedTier} ship upgrade profile for future install validation.`,
  refitPressure = defaultPressureForUpgrade(upgradeType, minimumTier, traits),
  refitTags = ["ship-upgrade", upgradeType, ...traits],
  refitCategory = Object.keys(refitPressure).find((key) => refitPressure[key] > 0) ?? "infrastructurePressure",
  specialistRequirements = minimumTier >= 3 ? ["shipwright specialist"] : [],
  rareMaterialRequirements = minimumTier >= 4 ? ["capital-grade refit materials"] : []
}) {
  return deepFreeze({
    componentType: "shipUpgrade",
    identity: {
      id,
      displayName,
      upgradeType,
      rarity: "standard",
      origin: "Arcflight Phase 4.5 Ship Upgrades Framework",
      role,
      description
    },
    installation: {
      requiresPortOrDock,
      canInstallDuringTravel,
      installCost,
      installTimeDays,
      playerAssistCostReductionMaxPercent
    },
    effects: {
      derivedStatModifiers,
      conditionInteractions,
      operationalEffects,
      systemInteractions,
      stationInteractions,
      eventInteractions
    },
    restrictions: {
      unique,
      maxInstances,
      requiredHullTags,
      blockedHullTags,
      requiredArkengineTags,
      notes: restrictionNotes
    },
    state: {
      systemState
    },
    minimumTier,
    recommendedTier,
    tierImpact,
    refitPressure: buildRefitPressure(refitPressure),
    refitTags: [...new Set(refitTags)],
    refitCategory,
    specialistRequirements,
    rareMaterialRequirements,
    traits,
    notes: {
      designIntent,
      gmNotes
    }
  });
}

export const CORE_SHIP_UPGRADES = Object.freeze({
  "reinforced-structural-ribbing": shipUpgrade({
    id: "reinforced-structural-ribbing",
    displayName: "Reinforced Structural Ribbing",
    upgradeType: UPGRADE_TYPES.STRUCTURAL,
    role: "Hull reinforcement",
    description: "Permanent frame reinforcement for hull durability, catastrophic damage resistance, and structural survival.",
    derivedStatModifiers: [
      modifier("hullIntegrity", "add", 20, "+20 hull integrity"),
      modifier("maneuverability", "subtract", 1, "-1 maneuverability")
    ],
    conditionInteractions: ["Placeholder: reduced catastrophic failure severity."],
    refitPressure: { infrastructurePressure: 2 },
    refitTags: ["ship-upgrade", "structural", "reinforcement", "hull"],
    traits: ["standard", "structural", "hull", "catastrophe"],
    designIntent: "Strengthens the vessel’s frame but makes handling heavier."
  }),
  "expanded-cargo-lattice": shipUpgrade({
    id: "expanded-cargo-lattice",
    displayName: "Expanded Cargo Lattice",
    upgradeType: UPGRADE_TYPES.CARGO,
    role: "Cargo and salvage capacity",
    description: "Permanent cargo latticework that supports logistics, cargo transport, and salvage operations.",
    derivedStatModifiers: [modifier("cargoCapacity", "add", 25, "+25 cargo capacity")],
    operationalEffects: ["Placeholder: improved salvage hauling."],
    systemInteractions: ["Placeholder: +1 Strain during Hard Burn later; Hard Burn gameplay is not implemented in Phase 4.5."],
    traits: ["standard", "cargo", "logistics", "salvage"],
    designIntent: "Expands cargo and salvage capacity at the cost of later Hard Burn strain pressure."
  }),
  "stabilized-helm-relays": shipUpgrade({
    id: "stabilized-helm-relays",
    displayName: "Stabilized Helm Relays",
    upgradeType: UPGRADE_TYPES.HELM_SYSTEM,
    role: "Helm signal stabilization",
    description: "Stabilized helm signaling infrastructure for Pilot station, maneuvering, and future Overcharge handling hooks.",
    stationInteractions: ["Placeholder: safer emergency steering."],
    systemInteractions: ["Placeholder: +1 maneuverability during Overcharge later; Overcharge gameplay is not implemented in Phase 4.5.", "Placeholder: +1 Strain while active later."],
    traits: ["standard", "helm", "pilot", "overcharge"],
    designIntent: "Supports future emergency steering without resolving Overcharge or strain activation gameplay yet."
  }),
  "fleet-signal-array": shipUpgrade({
    id: "fleet-signal-array",
    displayName: "Fleet Signal Array",
    upgradeType: UPGRADE_TYPES.COMMAND,
    role: "Communication and coordination",
    description: "A permanent shipwide communications array for fleet operations, communication, and coordination.",
    derivedStatModifiers: [modifier("detection", "add", 1, "+1 detection")],
    operationalEffects: ["Placeholder: long-range signaling support."],
    conditionInteractions: ["Placeholder: exposed vulnerable structure."],
    traits: ["standard", "command", "communication", "coordination"],
    designIntent: "Improves coordination and signaling while exposing a vulnerable vessel component."
  }),
  "reinforced-ram-prow": shipUpgrade({
    id: "reinforced-ram-prow",
    displayName: "Reinforced Ram Prow",
    upgradeType: UPGRADE_TYPES.MILITARY,
    role: "Frontal assault hardware",
    description: "Military prow reinforcement for future collision combat, boarding actions, and frontal assault support.",
    operationalEffects: ["Placeholder: reinforced collision structure."],
    conditionInteractions: ["Placeholder: improved frontal durability."],
    systemInteractions: ["Placeholder: reduced voyage efficiency later; collision combat is not implemented in Phase 4.5."],
    traits: ["standard", "military", "prow", "boarding"],
    designIntent: "Frames frontal assault hardware without implementing collision combat."
  }),
  "emergency-veil-relay": shipUpgrade({
    id: "emergency-veil-relay",
    displayName: "Emergency Veil Relay",
    upgradeType: UPGRADE_TYPES.DEFENSIVE,
    role: "Lifeveil emergency stabilization",
    description: "Emergency Lifeveil relay hardware for stabilization, emergency response, and catastrophe survival hooks.",
    operationalEffects: ["Placeholder: delayed Lifeveil collapse."],
    conditionInteractions: ["Placeholder: emergency stabilization options."],
    systemInteractions: ["Placeholder: heavy Strain spikes during activation later; activation gameplay is not implemented in Phase 4.5."],
    traits: ["standard", "defensive", "lifeveil", "catastrophe"],
    designIntent: "Stores Lifeveil emergency hooks for later systems without resolving activation gameplay."
  }),
  "void-anchor-array": shipUpgrade({
    id: "void-anchor-array",
    displayName: "Void Anchor Array",
    upgradeType: UPGRADE_TYPES.VOIDFARING,
    role: "Hazardous anchoring system",
    description: "Anchoring hardware for dangerous regions, void storms, and hazardous anchoring scenes.",
    eventInteractions: ["Placeholder: safer hazardous anchoring."],
    operationalEffects: ["Placeholder: improved storm stabilization."],
    traits: ["standard", "voidfaring", "anchor", "storm"],
    designIntent: "Improves future hazardous anchoring at the cost of increased installation mass."
  }),
  "deep-void-reinforcement": shipUpgrade({
    id: "deep-void-reinforcement",
    displayName: "Deep Void Reinforcement",
    upgradeType: UPGRADE_TYPES.ADAPTATION,
    role: "Deep void survival reinforcement",
    description: "Adaptation reinforcement for deep void travel, hostile environments, and long-range survival.",
    operationalEffects: ["Placeholder: improved environmental resistance."],
    conditionInteractions: ["Placeholder: reduced void degradation."],
    traits: ["standard", "adaptation", "deep-void", "survival"],
    designIntent: "Adds hostile-environment survival hooks with expensive upkeep reserved for later systems."
  }),
  "arc-conduit-stabilizers": shipUpgrade({
    id: "arc-conduit-stabilizers",
    displayName: "Arc Conduit Stabilizers",
    upgradeType: UPGRADE_TYPES.POWER_DISTRIBUTION,
    role: "Power routing stabilization",
    description: "Shipwide conduit stabilizers for Overcharge, energy routing, and arkengine stability hooks.",
    systemInteractions: ["Placeholder: smoother power routing.", "Placeholder: reduced Overcharge instability; Overcharge resolution is not implemented in Phase 4.5."],
    traits: ["standard", "powerDistribution", "overcharge", "maintenance"],
    designIntent: "Supports future power routing and Overcharge risk systems while remaining separate from arkengine mods."
  }),
  "lookout-spire": shipUpgrade({
    id: "lookout-spire",
    displayName: "Lookout Spire",
    upgradeType: UPGRADE_TYPES.LOOKOUT,
    role: "Elevated watch structure",
    description: "A visible elevated watch structure for Watchmaster station, hostile detection, and anomaly spotting hooks.",
    derivedStatModifiers: [modifier("detection", "add", 2, "+2 detection")],
    stationInteractions: ["Placeholder: reroll hostile spotting checks later; reroll mechanics are not implemented in Phase 4.5."],
    eventInteractions: ["Placeholder: improved ambush prevention."],
    traits: ["standard", "lookout", "watchmaster", "detection"],
    designIntent: "Improves detection and future watch hooks while creating an exposed mast structure."
  }),
  "reinforced-void-sails": shipUpgrade({
    id: "reinforced-void-sails",
    displayName: "Reinforced Void Sails",
    upgradeType: UPGRADE_TYPES.SAIL_SYSTEM,
    role: "Propulsion support and sail durability",
    description: "Durable sail system reinforcement for propulsion support, maneuvering, and Hard Burn handling hooks.",
    operationalEffects: ["Placeholder: safer aggressive maneuvering."],
    systemInteractions: ["Placeholder: improved propulsion stability."],
    traits: ["standard", "sailSystem", "propulsion", "hard-burn"],
    designIntent: "Supports later aggressive maneuvering while making sail handling heavier."
  }),
  "auxiliary-command-roost": shipUpgrade({
    id: "auxiliary-command-roost",
    displayName: "Auxiliary Command Roost",
    upgradeType: UPGRADE_TYPES.COMMAND,
    role: "Secondary command vantage",
    description: "Secondary command vantage infrastructure for Captain station, coordination, and flagship operation hooks.",
    stationInteractions: ["Placeholder: expanded command capability."],
    operationalEffects: ["Placeholder: improved coordination options."],
    traits: ["standard", "command", "captain", "flagship"],
    designIntent: "Adds command capability hooks with increased crew demand reserved for later systems."
  }),
  "pressure-redistribution-network": shipUpgrade({
    id: "pressure-redistribution-network",
    displayName: "Pressure Redistribution Network",
    upgradeType: UPGRADE_TYPES.CATASTROPHE,
    role: "Emergency pressure routing",
    description: "Emergency pressure routing for subsystem failure, emergency survival, and structural recovery hooks.",
    derivedStatModifiers: [modifier("cargoCapacity", "subtract", 10, "-10 cargo capacity")],
    conditionInteractions: ["Placeholder: reduced subsystem failure severity."],
    operationalEffects: ["Placeholder: improved emergency survivability."],
    traits: ["standard", "catastrophe", "pressure", "survival"],
    designIntent: "Improves emergency survival infrastructure while reducing cargo space."
  }),
  "detection-spire": shipUpgrade({
    id: "detection-spire",
    displayName: "Detection Spire",
    upgradeType: UPGRADE_TYPES.DETECTION,
    role: "Dedicated detection and scan tower",
    description: "Dedicated detection tower for Detection, Navigation, Watchmaster, anomaly event, and hostile spotting hooks.",
    derivedStatModifiers: [modifier("detection", "add", 2, "+2 detection")],
    eventInteractions: ["Placeholder: improved anomaly detection."],
    stationInteractions: ["Placeholder: hostile spotting support."],
    systemInteractions: ["Placeholder: additional Strain during active scanning later; active scanning gameplay is not implemented in Phase 4.5."],
    traits: ["standard", "detection", "navigation", "watchmaster"],
    designIntent: "Improves passive detection while storing active scanning costs for later systems."
  }),
  "docking-claw-system": shipUpgrade({
    id: "docking-claw-system",
    displayName: "Docking Claw System",
    upgradeType: UPGRADE_TYPES.LOGISTICS,
    role: "Docking, salvage, and boarding hardware",
    description: "External docking hardware for docking, salvage, and boarding support hooks.",
    operationalEffects: ["Placeholder: safer docking operations.", "Placeholder: improved salvage capture.", "Placeholder: improved tether stability."],
    traits: ["standard", "logistics", "docking", "salvage", "boarding"],
    designIntent: "Adds docking and salvage hardware while increasing hull complexity."
  }),
  "propulsion-stabilization-fins": shipUpgrade({
    id: "propulsion-stabilization-fins",
    displayName: "Propulsion Stabilization Fins",
    upgradeType: UPGRADE_TYPES.PROPULSION_SUPPORT,
    role: "High-speed propulsion handling",
    description: "Exposed stabilization fins for propulsion handling, high-speed maneuvering, and Hard Burn steering hooks.",
    operationalEffects: ["Placeholder: safer high-speed turning."],
    systemInteractions: ["Placeholder: improved Hard Burn handling."],
    traits: ["standard", "propulsionSupport", "hard-burn", "maneuvering"],
    designIntent: "Improves future high-speed handling with fragile exposed structures."
  }),
  "reinforced-bulkhead-network": shipUpgrade({
    id: "reinforced-bulkhead-network",
    displayName: "Reinforced Bulkhead Network",
    upgradeType: UPGRADE_TYPES.STRUCTURAL,
    role: "Internal compartment durability",
    description: "Reinforced internal bulkheads that improve compartment durability and vessel-wide defensive structure.",
    derivedStatModifiers: [
      modifier("hullIntegrity", "add", 20, "+20 hull integrity"),
      modifier("armorClass", "add", 1, "+1 armor class")
    ],
    traits: ["standard", "structural", "bulkhead", "durability"],
    designIntent: "Adds modest persistent hull and armor resilience through internal platform reinforcement."
  }),
  "expanded-lifeveil-array": shipUpgrade({
    id: "expanded-lifeveil-array",
    displayName: "Expanded Lifeveil Array",
    upgradeType: UPGRADE_TYPES.LIFEVEIL,
    role: "Vessel-wide Lifeveil projection hardware",
    description: "Expanded projection hardware that increases the vessel’s stable Lifeveil envelope.",
    derivedStatModifiers: [modifier("lifeveilCapacity", "add", 15, "+15 lifeveil capacity")],
    traits: ["standard", "lifeveil", "projection", "stability"],
    designIntent: "Expands persistent Lifeveil capacity without adding activation or fuel-spending automation."
  }),
  "void-scout-observation-spire": shipUpgrade({
    id: "void-scout-observation-spire",
    displayName: "Void Scout Observation Spire",
    upgradeType: UPGRADE_TYPES.DETECTION,
    role: "Long-range watch and void scanning",
    description: "A dedicated observation spire that improves long-range watch, void scanning, and anomaly spotting.",
    derivedStatModifiers: [modifier("detection", "add", 2, "+2 detection")],
    traits: ["standard", "detection", "watch", "scanning"],
    designIntent: "Adds a standard persistent detection platform for scouting-focused vessels."
  }),
  "emergency-repair-lockers": shipUpgrade({
    id: "emergency-repair-lockers",
    displayName: "Emergency Repair Lockers",
    upgradeType: UPGRADE_TYPES.SUPPORT,
    role: "Distributed repair kits and emergency patch stations",
    description: "Distributed repair lockers and emergency patch stations positioned throughout the vessel.",
    derivedStatModifiers: [modifier("resistanceTendencies", "append", "repairSupport", "Adds repair support tendency")],
    traits: ["standard", "support", "repair", "emergency"],
    designIntent: "Stores a future repair-support hook as data without implementing repair automation.",
    gmNotes: "Future support hook only; this upgrade does not automate repairs."
  }),
  "reinforced-maneuvering-fins": shipUpgrade({
    id: "reinforced-maneuvering-fins",
    displayName: "Reinforced Maneuvering Fins",
    upgradeType: UPGRADE_TYPES.MOBILITY,
    role: "Control surfaces and handling",
    description: "Reinforced control surfaces that improve ship handling and helm responsiveness.",
    derivedStatModifiers: [modifier("maneuverability", "add", 1, "+1 maneuverability")],
    traits: ["standard", "mobility", "maneuvering", "control"],
    designIntent: "Provides a modest persistent maneuverability improvement through platform hardware."
  }),
  "deep-void-insulation-web": shipUpgrade({
    id: "deep-void-insulation-web",
    displayName: "Deep Void Insulation Web",
    upgradeType: UPGRADE_TYPES.DEEP_VOID,
    role: "Deep-void degradation resistance",
    description: "An insulation web that reinforces the vessel against deep-void degradation and environmental wear.",
    derivedStatModifiers: [modifier("resistanceTendencies", "append", "deepVoid", "Adds deep-void resistance tendency")],
    traits: ["standard", "deepVoid", "insulation", "survival"],
    designIntent: "Adds a persistent deep-void resistance tendency for later hazard systems."
  }),
  "occult-signal-refractors": shipUpgrade({
    id: "occult-signal-refractors",
    displayName: "Occult Signal Refractors",
    upgradeType: UPGRADE_TYPES.OCCULT,
    role: "Occult interference and strange void signal refraction",
    description: "Refractor hardware that diffuses occult interference and strange void signals before they saturate ship systems.",
    derivedStatModifiers: [modifier("resistanceTendencies", "append", "occult", "Adds occult resistance tendency")],
    traits: ["standard", "occult", "signal", "interference"],
    designIntent: "Adds an occult resistance tendency as data without resolving occult event mechanics."
  }),
  "expanded-command-network": shipUpgrade({
    id: "expanded-command-network",
    displayName: "Expanded Command Network",
    upgradeType: UPGRADE_TYPES.COMMAND,
    role: "Command distribution and coordination infrastructure",
    description: "Expanded command infrastructure that improves shipwide order routing and coordination capacity.",
    derivedStatModifiers: [modifier("baseAP", "add", 1, "+1 base AP")],
    refitPressure: { crewCommandPressure: 3, infrastructurePressure: 1 },
    refitTags: ["ship-upgrade", "command-nexus", "crew-command", "infrastructure"],
    specialistRequirements: ["command systems architect"],
    traits: ["standard", "command", "coordination", "infrastructure"],
    designIntent: "Provides a modest persistent command capacity increase without adding AP spending systems."
  }),
  "auxiliary-veil-capacitors": shipUpgrade({
    id: "auxiliary-veil-capacitors",
    displayName: "Auxiliary Veil Capacitors",
    upgradeType: UPGRADE_TYPES.LIFEVEIL,
    role: "Extra veil charge for atmospheric stability",
    description: "Auxiliary capacitors that store extra veil charge for vessel-wide atmospheric stability.",
    derivedStatModifiers: [modifier("lifeveilCapacity", "add", 10, "+10 lifeveil capacity")],
    traits: ["standard", "lifeveil", "capacitor", "stability"],
    designIntent: "Adds a smaller Lifeveil capacity option without implementing charge-spending automation."
  }),
  "reinforced-docking-framework": shipUpgrade({
    id: "reinforced-docking-framework",
    displayName: "Reinforced Docking Framework",
    upgradeType: UPGRADE_TYPES.LOGISTICS,
    role: "Docking stability, loading, and salvage handling",
    description: "Reinforced docking framework that improves docking stability, loading, and salvage handling capacity.",
    derivedStatModifiers: [modifier("cargoCapacity", "add", 10, "+10 cargo capacity")],
    traits: ["standard", "logistics", "docking", "salvage"],
    designIntent: "Adds modest logistics capacity through persistent docking and loading hardware."
  }),
  "longwatch-lookout-platform": shipUpgrade({
    id: "longwatch-lookout-platform",
    displayName: "Longwatch Lookout Platform",
    upgradeType: UPGRADE_TYPES.DETECTION,
    role: "Elevated Watchmaster support platform",
    description: "A dedicated elevated lookout platform that supports Watchmaster observation and longwatch duties.",
    derivedStatModifiers: [modifier("detection", "add", 1, "+1 detection")],
    traits: ["standard", "detection", "lookout", "watchmaster"],
    designIntent: "Provides a modest detection platform distinct from larger spire upgrades."
  }),
  "distributed-strain-dampeners": shipUpgrade({
    id: "distributed-strain-dampeners",
    displayName: "Distributed Strain Dampeners",
    upgradeType: UPGRADE_TYPES.STRAIN,
    role: "Engine and hull stress dampening channels",
    description: "Distributed dampeners that spread engine and hull stress through reinforced dampening channels.",
    derivedStatModifiers: [modifier("strainCapacity", "add", 2, "+2 strain capacity")],
    traits: ["standard", "strain", "dampening", "reinforcement"],
    designIntent: "Adds modest persistent strain tolerance without implementing strain spending or recovery automation."
  })
});

export const CORE_SHIP_UPGRADE_KEYS = Object.freeze(Object.keys(CORE_SHIP_UPGRADES));

export function getCoreShipUpgradeKeys() {
  return CORE_SHIP_UPGRADE_KEYS;
}

export function getCoreShipUpgrade(upgradeKey) {
  return CORE_SHIP_UPGRADES[upgradeKey] ?? null;
}
