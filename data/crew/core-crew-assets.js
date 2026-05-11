import { ARCFLIGHT_CREW_QUALITIES, ARCFLIGHT_ITEM_TYPES } from "../../scripts/config/constants.js";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function crewAsset({
  id,
  displayName,
  role,
  title = "",
  description,
  quality = ARCFLIGHT_CREW_QUALITIES.TRAINED,
  preferredStation = "",
  canAssignTo = [],
  primary = [],
  proficiencies = [],
  specialistTags = [],
  narrativePermissions = [],
  stationInteractions = [],
  operationalEffects = [],
  unique = false,
  traits = [],
  designIntent,
  gmNotes = ""
}) {
  return deepFreeze({
    componentType: ARCFLIGHT_ITEM_TYPES.CREW_ASSET,
    identity: {
      id,
      displayName,
      role,
      title,
      factionIdentity: "",
      origin: "Arcflight Phase 7 Crew Assets Framework",
      description
    },
    crew: {
      count: 1,
      minimum: 0,
      quality,
      countsTowardCrewTotal: true,
      genericCrewEquivalent: 1,
      notes: "Named crew assets are meaningful specialists; generic crew remains a simple ship-owned number."
    },
    stationAssignment: {
      preferredStation,
      assignedStation: "",
      canAssignTo,
      notes: "Assignment data only; no station actions, AP/RAP logic, morale automation, combat automation, or travel automation."
    },
    capabilities: {
      primary,
      proficiencies,
      specialistTags,
      narrativePermissions,
      notes: "Capabilities describe where this specialist matters without adding passive modifier spam."
    },
    effects: {
      passiveModifiers: [],
      stationInteractions,
      operationalEffects,
      notes: "Framework hooks only; effects are not automatically resolved in Phase 7."
    },
    state: {
      active: true,
      injured: false,
      unavailable: false,
      condition: "",
      notes: ""
    },
    restrictions: {
      unique,
      maxInstances: unique ? 1 : 99,
      requiredShipTraits: [],
      blockedShipTraits: [],
      notes: ""
    },
    traits,
    notes: {
      designIntent,
      gmNotes
    }
  });
}

export const CORE_CREW_ASSETS = Object.freeze({
  "veteran-chief-engineer": crewAsset({
    id: "veteran-chief-engineer",
    displayName: "Veteran Chief Engineer",
    role: "Arkengine maintenance and strain triage specialist",
    title: "Chief Engineer",
    description: "A seasoned engineer who understands temperamental arkengines, emergency repairs, and shipboard maintenance priorities.",
    quality: ARCFLIGHT_CREW_QUALITIES.VETERAN,
    preferredStation: "engineer",
    canAssignTo: ["engineer"],
    primary: ["arkengine oversight", "repair coordination", "strain triage"],
    proficiencies: ["crafting", "arcana"],
    specialistTags: ["engineering", "arkengine", "repairs"],
    stationInteractions: ["Placeholder: can inform future Engineer station options without implementing station actions."],
    traits: ["crew-asset", "named-crew", "engineer", "veteran"],
    designIntent: "Represents a meaningful engineering specialist without replacing a PC or adding automated repair gameplay."
  }),
  "seasoned-navigator": crewAsset({
    id: "seasoned-navigator",
    displayName: "Seasoned Navigator",
    role: "Route planning and hazard-reading specialist",
    title: "Navigator",
    description: "An experienced void-route reader who can support course planning, charts, and long-range travel decisions.",
    quality: ARCFLIGHT_CREW_QUALITIES.TRAINED,
    preferredStation: "navigator",
    canAssignTo: ["navigator", "pilot"],
    primary: ["route planning", "chart keeping", "hazard reading"],
    proficiencies: ["survival", "society", "sailingLore"],
    specialistTags: ["navigation", "planning", "void-routes"],
    stationInteractions: ["Placeholder: can inform future Navigator station options without implementing travel automation."],
    traits: ["crew-asset", "named-crew", "navigator", "trained"],
    designIntent: "Supports navigation scenes while travel systems remain unimplemented."
  }),
  "sharp-eyed-watchmaster": crewAsset({
    id: "sharp-eyed-watchmaster",
    displayName: "Sharp-Eyed Watchmaster",
    role: "Lookout coordination and threat awareness specialist",
    title: "Watchmaster",
    description: "A vigilant watch coordinator who keeps lookouts focused and knows how to spot subtle threats.",
    quality: ARCFLIGHT_CREW_QUALITIES.TRAINED,
    preferredStation: "watchmaster",
    canAssignTo: ["watchmaster", "navigator"],
    primary: ["lookout coordination", "threat awareness", "scouting discipline"],
    proficiencies: ["perception", "survival"],
    specialistTags: ["watch", "detection", "scouting"],
    stationInteractions: ["Placeholder: can inform future Watchmaster station options without encounter automation."],
    traits: ["crew-asset", "named-crew", "watchmaster", "trained"],
    designIntent: "Gives the watch role an identifiable specialist without creating passive detection modifiers."
  }),
  "veteran-gunner": crewAsset({
    id: "veteran-gunner",
    displayName: "Veteran Gunner",
    role: "Weapon crew coordination specialist",
    title: "Gunner",
    description: "A practiced ship gunner who can coordinate weapon crews and maintain firing discipline when weapon systems exist.",
    quality: ARCFLIGHT_CREW_QUALITIES.VETERAN,
    preferredStation: "gunnery",
    canAssignTo: ["gunnery"],
    primary: ["weapon crew coordination", "firing discipline", "ordnance handling"],
    proficiencies: ["warfareLore", "perception"],
    specialistTags: ["gunnery", "weapons", "coordination"],
    stationInteractions: ["Placeholder: can inform future Gunnery station options without firing actions or combat automation."],
    traits: ["crew-asset", "named-crew", "gunner", "veteran"],
    designIntent: "Prepares for future weapon crews without adding attacks, AP/RAP spending, or combat rounds."
  }),
  "steady-quartermaster": crewAsset({
    id: "steady-quartermaster",
    displayName: "Steady Quartermaster",
    role: "Supplies, cargo, and shipboard logistics specialist",
    title: "Quartermaster",
    description: "A reliable logistics specialist who keeps cargo, stores, and crew needs organized without turning crew into a simulator.",
    quality: ARCFLIGHT_CREW_QUALITIES.TRAINED,
    preferredStation: "quartermaster",
    canAssignTo: ["quartermaster"],
    primary: ["supply organization", "cargo records", "crew logistics"],
    proficiencies: ["society", "survival"],
    specialistTags: ["logistics", "cargo", "supplies"],
    stationInteractions: ["Placeholder: can inform future Quartermaster station options without wages, upkeep, or morale automation."],
    traits: ["crew-asset", "named-crew", "quartermaster", "trained"],
    designIntent: "Adds a meaningful logistics specialist while keeping generic crew as a simple number."
  }),
  "grizzled-bosun": crewAsset({
    id: "grizzled-bosun",
    displayName: "Grizzled Bosun",
    role: "Discipline, deck order, and crew coordination specialist",
    title: "Bosun",
    description: "A hard-bitten deck leader who keeps watches orderly, relays command intent, and coordinates working parties without taking over a PC's command role.",
    quality: ARCFLIGHT_CREW_QUALITIES.VETERAN,
    preferredStation: "captain",
    canAssignTo: ["captain", "quartermaster"],
    primary: ["deck order", "crew coordination", "discipline"],
    proficiencies: ["intimidation", "sailingLore"],
    specialistTags: ["bosun", "command", "crew"],
    stationInteractions: ["Placeholder: can inform future Captain or Quartermaster station options without morale, wage, or station action automation."],
    traits: ["crew-asset", "named-crew", "bosun", "command", "crew", "veteran"],
    designIntent: "Adds a named deck-order specialist as a roleplay and assignment hook, not a passive command bonus."
  }),
  "voidscarred-helmsman": crewAsset({
    id: "voidscarred-helmsman",
    displayName: "Voidscarred Helmsman",
    role: "Risky maneuvers and ship handling specialist",
    title: "Helmsman",
    description: "A scarred voidfarer with steady hands at the helm and a reputation for surviving desperate maneuvers.",
    quality: ARCFLIGHT_CREW_QUALITIES.VETERAN,
    preferredStation: "pilot",
    canAssignTo: ["pilot"],
    primary: ["ship handling", "risky maneuvers", "helm discipline"],
    proficiencies: ["pilotingLore", "acrobatics"],
    specialistTags: ["pilot", "voidfarer", "crew"],
    stationInteractions: ["Placeholder: can inform future Pilot station options without travel movement, maneuver actions, or combat automation."],
    traits: ["crew-asset", "named-crew", "pilot", "voidfarer", "crew", "veteran"],
    designIntent: "Provides a memorable helm specialist while avoiding passive maneuverability modifiers or movement rules."
  }),
  "junior-engine-apprentice": crewAsset({
    id: "junior-engine-apprentice",
    displayName: "Junior Engine Apprentice",
    role: "Basic arkengine maintenance support",
    title: "Engine Apprentice",
    description: "An eager apprentice who hauls tools, checks gauges, and learns arkengine routines under supervision.",
    quality: ARCFLIGHT_CREW_QUALITIES.GREEN,
    preferredStation: "engineer",
    canAssignTo: ["engineer"],
    primary: ["basic maintenance", "tool running", "engine-room support"],
    proficiencies: ["crafting"],
    specialistTags: ["engineer", "apprentice", "crew"],
    stationInteractions: ["Placeholder: can inform future Engineer support options without repair automation or strain resolution."],
    traits: ["crew-asset", "named-crew", "engineer", "apprentice", "crew", "green"],
    designIntent: "Adds a lightweight green crew specialist for engineering scenes without creating an automated repair engine."
  }),
  "occult-veil-adept": crewAsset({
    id: "occult-veil-adept",
    displayName: "Occult Veil Adept",
    role: "Lifeveil rituals and occult shielding support",
    title: "Veil Adept",
    description: "A disciplined occult practitioner who tends Lifeveil rites, warding routines, and strange shipboard omens.",
    quality: ARCFLIGHT_CREW_QUALITIES.TRAINED,
    preferredStation: "veilwarden",
    canAssignTo: ["veilwarden"],
    primary: ["lifeveil rituals", "occult shielding", "warding support"],
    proficiencies: ["occultism", "religion"],
    specialistTags: ["occult", "veilwarden", "crew"],
    stationInteractions: ["Placeholder: can inform future Veilwarden station options without Lifeveil automation or occult resolution rules."],
    traits: ["crew-asset", "named-crew", "occult", "veilwarden", "crew", "trained"],
    designIntent: "Supports Lifeveil and occult table fiction while leaving shielding and resource systems data-only."
  }),
  "old-star-cartographer": crewAsset({
    id: "old-star-cartographer",
    displayName: "Old Star Cartographer",
    role: "Routes, maps, hidden lanes, and old void lore specialist",
    title: "Cartographer",
    description: "An aging scholar of star charts, forgotten crossings, hidden lanes, and void legends annotated in a dozen fading hands.",
    quality: ARCFLIGHT_CREW_QUALITIES.VETERAN,
    preferredStation: "navigator",
    canAssignTo: ["navigator"],
    primary: ["route lore", "map keeping", "hidden lane research"],
    proficiencies: ["society", "survival", "voidLore"],
    specialistTags: ["navigator", "scholar", "crew"],
    stationInteractions: ["Placeholder: can inform future Navigator options without implementing routes, travel turns, or hidden-lane automation."],
    traits: ["crew-asset", "named-crew", "navigator", "scholar", "crew", "veteran"],
    designIntent: "Adds a lore-forward navigator specialist without introducing travel systems or passive route bonuses."
  }),
  "powdermaster-gunner": crewAsset({
    id: "powdermaster-gunner",
    displayName: "Powdermaster Gunner",
    role: "Munitions, reload discipline, and firing crew specialist",
    title: "Powdermaster",
    description: "A stern ordnance hand who tracks powder, shot, safety drills, and firing crew routines before the first broadside ever sounds.",
    quality: ARCFLIGHT_CREW_QUALITIES.VETERAN,
    preferredStation: "gunnery",
    canAssignTo: ["gunnery"],
    primary: ["munitions handling", "reload discipline", "firing crew coordination"],
    proficiencies: ["warfareLore", "crafting"],
    specialistTags: ["gunner", "military", "crew"],
    stationInteractions: ["Placeholder: can inform future Gunnery station options without weapon firing, reload actions, or combat automation."],
    traits: ["crew-asset", "named-crew", "gunner", "military", "crew", "veteran"],
    designIntent: "Represents ordnance expertise without adding direct weapon damage, attack, reload, or AP/RAP effects."
  }),
  "quiet-smuggler-contact": crewAsset({
    id: "quiet-smuggler-contact",
    displayName: "Quiet Smuggler Contact",
    role: "Hidden cargo, black-market ports, and false manifest specialist",
    title: "Smuggler Contact",
    description: "A discreet logistics operator with whispered port ties, false manifest habits, and an eye for cargo that should stay unnoticed.",
    quality: ARCFLIGHT_CREW_QUALITIES.TRAINED,
    preferredStation: "quartermaster",
    canAssignTo: ["quartermaster"],
    primary: ["hidden cargo", "black-market contacts", "false manifests"],
    proficiencies: ["deception", "society", "underworldLore"],
    specialistTags: ["smuggler", "logistics", "crew"],
    stationInteractions: ["Placeholder: can inform future Quartermaster hooks without market systems, contraband automation, or cargo minigames."],
    traits: ["crew-asset", "named-crew", "smuggler", "logistics", "crew", "trained"],
    designIntent: "Provides a narrative logistics contact without implementing commerce, smuggling, or cargo automation."
  }),
  "shipboard-surgeon": crewAsset({
    id: "shipboard-surgeon",
    displayName: "Shipboard Surgeon",
    role: "Injury recovery, disease control, and triage specialist",
    title: "Surgeon",
    description: "A practiced shipboard medic who manages splints, quarantine instincts, and triage priorities when the voyage turns ugly.",
    quality: ARCFLIGHT_CREW_QUALITIES.TRAINED,
    preferredStation: "quartermaster",
    canAssignTo: ["quartermaster"],
    primary: ["triage", "disease control", "injury recovery support"],
    proficiencies: ["medicine", "survival"],
    specialistTags: ["medic", "recovery", "crew"],
    stationInteractions: ["Placeholder: can inform future recovery hooks without injury automation, disease rules, or medical station actions."],
    operationalEffects: ["Placeholder: may be referenced by future downtime recovery systems; no automatic recovery is applied."],
    traits: ["crew-asset", "named-crew", "medic", "recovery", "crew", "trained"],
    designIntent: "Adds a recovery-focused support specialist without morale, injury, disease, or healing automation."
  }),
  "morale-cook": crewAsset({
    id: "morale-cook",
    displayName: "Morale Cook",
    role: "Meals, gossip, and crew comfort specialist",
    title: "Cook",
    description: "A beloved galley presence who knows who needs a hot meal, a rumor, or a quiet word before discipline frays.",
    quality: ARCFLIGHT_CREW_QUALITIES.TRAINED,
    preferredStation: "quartermaster",
    canAssignTo: ["quartermaster"],
    primary: ["meal planning", "crew comfort", "shipboard gossip"],
    proficiencies: ["cookingLore", "diplomacy"],
    specialistTags: ["cook", "morale", "crew"],
    stationInteractions: ["Placeholder: can inform future Quartermaster hooks without morale tracks, upkeep, or comfort automation."],
    traits: ["crew-asset", "named-crew", "cook", "morale", "crew", "trained"],
    designIntent: "Makes morale table-facing and narrative without adding morale gameplay or passive bonuses."
  }),
  "hull-patcher": crewAsset({
    id: "hull-patcher",
    displayName: "Hull Patcher",
    role: "Emergency patch work and structural maintenance specialist",
    title: "Hull Patcher",
    description: "A practical repair hand who knows where to brace a beam, slap a patch, and keep water or void out until proper work can begin.",
    quality: ARCFLIGHT_CREW_QUALITIES.TRAINED,
    preferredStation: "engineer",
    canAssignTo: ["engineer"],
    primary: ["emergency patch work", "structural maintenance", "damage control support"],
    proficiencies: ["crafting", "sailingLore"],
    specialistTags: ["repair", "hull", "crew"],
    stationInteractions: ["Placeholder: can inform future Engineer repair hooks without hull damage automation or repair actions."],
    traits: ["crew-asset", "named-crew", "repair", "hull", "crew", "trained"],
    designIntent: "Adds a repair-flavored specialist without automating hull damage, patch actions, or recovery values."
  })
});

export const CORE_CREW_ASSET_KEYS = Object.freeze(Object.keys(CORE_CREW_ASSETS));

export function getCoreCrewAssetKeys() {
  return CORE_CREW_ASSET_KEYS;
}

export function getCoreCrewAsset(crewAssetKey) {
  return CORE_CREW_ASSETS[crewAssetKey] ?? null;
}
