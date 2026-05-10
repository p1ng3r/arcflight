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
  })
});

export const CORE_CREW_ASSET_KEYS = Object.freeze(Object.keys(CORE_CREW_ASSETS));

export function getCoreCrewAssetKeys() {
  return CORE_CREW_ASSET_KEYS;
}

export function getCoreCrewAsset(crewAssetKey) {
  return CORE_CREW_ASSETS[crewAssetKey] ?? null;
}
