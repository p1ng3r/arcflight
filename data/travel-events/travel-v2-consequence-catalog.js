export const TRAVEL_V2_CONSEQUENCE_CATALOG_VERSION = 1;

export const TRAVEL_V2_CONSEQUENCE_CATALOG = Object.freeze([
  Object.freeze({
    id: "consequence-arkengine-surge",
    schemaVersion: 1,
    type: "consequence",
    title: "Arkengine Surge",
    severity: "major",
    source: "engine hazard, Engineer critical failure, Focus backlash",
    affectedTrack: "Strain",
    publicText: "The arkengine pulses out of rhythm, rattling braces and making the next beat feel unstable.",
    gmText: "Use this when the engine's instability should become a reviewed pressure candidate. Do not apply Strain or alter engine records automatically.",
    playerSafeSummary: "An unstable arkengine pulse creates Strain pressure for GM review.",
    applyEffectSummary: "Future GM Apply may record Strain pressure or engine instability after review.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Strain", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "pressureCandidate", summary: "Future GM Apply may record Strain pressure or engine instability.", mutation: "none" },
    narration: {
      onConsequenceCreated: "The arkengine surges once, too bright and too loud.",
      onFailure: "The pulse comes back wrong, and the deck answers with a groan."
    },
    tags: ["arkengine", "engineer", "strain", "focus", "pressure-candidate"]
  }),
  Object.freeze({
    id: "consequence-lifeveil-flicker",
    schemaVersion: 1,
    type: "consequence",
    title: "Lifeveil Flicker",
    severity: "major",
    source: "lifeveil hazard, Veilwarden critical failure, void environment",
    affectedTrack: "Lifeveil",
    publicText: "The lifeveil flickers thin enough for the hostile void to feel close.",
    gmText: "Spotlight the Veilwarden and the ship's protective envelope. Persistent veil instability remains a future GM-reviewed apply choice only.",
    playerSafeSummary: "The lifeveil weakens and may create Lifeveil pressure for GM review.",
    applyEffectSummary: "Future GM Apply may record Lifeveil pressure or veil instability.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Lifeveil", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "pressureCandidate", summary: "Future GM Apply may record Lifeveil pressure or veil instability.", mutation: "none" },
    narration: {
      onConsequenceCreated: "The lifeveil thins to a pale shimmer around the hull.",
      onFailure: "Cold light leaks through the veil before it seals again."
    },
    tags: ["lifeveil", "veilwarden", "void", "pressure-candidate"]
  }),
  Object.freeze({
    id: "consequence-route-drift",
    schemaVersion: 1,
    type: "consequence",
    title: "Route Drift",
    severity: "major",
    source: "navigation hazard, Navigator critical failure, unresolved Void Shear",
    affectedTrack: "Route",
    publicText: "The ship slips off the clean line, turning the route ahead uncertain.",
    gmText: "Use as a reviewed candidate to worsen a final outcome or seed an off-course follow-up. Do not change encounter state automatically.",
    playerSafeSummary: "The route drifts and may worsen the final travel outcome.",
    applyEffectSummary: "Future GM Apply may worsen a final outcome step or create an off-course follow-up.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Route", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "finalOutcomeCandidate", summary: "Future GM Apply may worsen final outcome pressure or note an off-course follow-up.", mutation: "none" },
    narration: {
      onConsequenceCreated: "The plotted line bends away from where it should be.",
      onFailure: "The helm finds purchase, but the route has already wandered."
    },
    tags: ["route", "navigator", "void-shear", "final-outcome", "follow-up"]
  }),
  Object.freeze({
    id: "consequence-hull-stress",
    schemaVersion: 1,
    type: "consequence",
    title: "Hull Stress",
    severity: "minor",
    source: "physical hazard, pressure overflow, missed Watchmaster warning",
    affectedTrack: "Hull",
    publicText: "The hull takes a hard flex that leaves everyone listening for the next sound.",
    gmText: "Use for physical strain that may matter if repeated. No ship actor, item, or damage mutation occurs automatically.",
    playerSafeSummary: "The hull is stressed and may create Hull pressure for GM review.",
    applyEffectSummary: "Future GM Apply may record Hull pressure or flag a repeated-stress scar candidate.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Hull", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "pressureCandidate", summary: "Future GM Apply may record Hull pressure or a repeated-stress ship scar candidate.", mutation: "none" },
    narration: {
      onConsequenceCreated: "A long metallic complaint runs through the ship's bones.",
      onFailure: "The impact passes, but the hull remembers it."
    },
    tags: ["hull", "watchmaster", "physical", "ship-scar-candidate", "pressure-candidate"]
  }),
  Object.freeze({
    id: "consequence-crew-panic",
    schemaVersion: 1,
    type: "consequence",
    title: "Crew Panic",
    severity: "minor",
    source: "Captain failure, failed Support, frightening event",
    affectedTrack: "Morale",
    publicText: "Fear moves faster than orders, and the crew hesitates at the wrong moment.",
    gmText: "Use when leadership pressure should become visible without changing Focus, Support, or Morale behavior automatically.",
    playerSafeSummary: "Crew fear may create Morale pressure or hesitation for GM review.",
    applyEffectSummary: "Future GM Apply may record Morale pressure or a crew hesitation follow-up.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Morale", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "pressureCandidate", summary: "Future GM Apply may record Morale pressure or crew hesitation.", mutation: "none" },
    narration: {
      onConsequenceCreated: "A whisper becomes a dozen worried voices.",
      onFailure: "Orders land a heartbeat late as fear crosses the deck."
    },
    tags: ["crew", "morale", "captain", "support", "pressure-candidate"]
  }),
  Object.freeze({
    id: "consequence-cargo-shift",
    schemaVersion: 1,
    type: "consequence",
    title: "Cargo Shift",
    severity: "minor",
    source: "hard maneuver, hull shock, ignored cargo hazard",
    affectedTrack: "Cargo",
    publicText: "Cargo breaks loose below, turning stored weight into a new complication.",
    gmText: "Use for a reviewed cargo complication or later supply delay hook. Do not alter item stacks, inventories, or cargo records automatically.",
    playerSafeSummary: "Shifted cargo may create a cargo complication for GM review.",
    applyEffectSummary: "Future GM Apply may record a cargo complication or future supply delay.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Cargo", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "complicationCandidate", summary: "Future GM Apply may record a cargo complication or supply delay hook.", mutation: "none" },
    narration: {
      onConsequenceCreated: "Something heavy breaks restraint and slams below decks.",
      onFailure: "The maneuver works, but the hold answers with a crash."
    },
    tags: ["cargo", "hull", "supplies", "complication-candidate"]
  }),
  Object.freeze({
    id: "consequence-supplies-delay",
    schemaVersion: 1,
    type: "consequence",
    title: "Supplies Delay",
    severity: "minor",
    source: "low stores, blocked access, route delay",
    affectedTrack: "Supplies",
    publicText: "Essential stores are still aboard, but getting to them will take time the ship may not have.",
    gmText: "Use for temporary access trouble, ration confusion, or a follow-up delay. Do not mutate supplies or inventories automatically.",
    playerSafeSummary: "Supplies are delayed and may create supply pressure for GM review.",
    applyEffectSummary: "Future GM Apply may record supply pressure or a follow-up delay.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Supplies", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "pressureCandidate", summary: "Future GM Apply may record supply pressure or a delay follow-up.", mutation: "none" },
    narration: {
      onConsequenceCreated: "The manifest is clear; the path to the stores is not.",
      onFailure: "Help is coming from stores, but not quickly enough."
    },
    tags: ["supplies", "delay", "stores", "pressure-candidate"]
  }),
  Object.freeze({
    id: "consequence-threat-attracted",
    schemaVersion: 1,
    type: "consequence",
    title: "Threat Attracted",
    severity: "major",
    source: "loud arkengine signature, Lifeveil flare, failed stealth",
    affectedTrack: "Threat",
    publicText: "Something notices the ship's signature and turns attention toward it.",
    gmText: "Use as a future encounter seed or threat follow-up candidate. Do not create scenes, combats, tokens, chat, or journal entries automatically.",
    playerSafeSummary: "The ship draws attention and may seed a future threat.",
    applyEffectSummary: "Future GM Apply may record a threat follow-up or encounter seed.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Threat", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "encounterSeedCandidate", summary: "Future GM Apply may record a threat follow-up or encounter seed.", mutation: "none" },
    narration: {
      onConsequenceCreated: "Far out in the dark, something answers the ship's noise.",
      onFailure: "The silence after the flare feels less empty than before."
    },
    tags: ["threat", "encounter-seed", "arkengine", "lifeveil", "stealth"]
  }),
  Object.freeze({
    id: "consequence-hazard-escalation",
    schemaVersion: 1,
    type: "consequence",
    title: "Hazard Escalation",
    severity: "major",
    source: "unresolved hazard, failed response, countdown expiry",
    affectedTrack: "Hazard",
    publicText: "The active danger worsens before the crew can bring it under control.",
    gmText: "Use to offer a reviewed escalation of an existing hazard or draw a stronger one later. This catalog does not change hazard behavior automatically.",
    playerSafeSummary: "An unresolved hazard may worsen for GM review.",
    applyEffectSummary: "Future GM Apply may worsen an active hazard or draw a stronger hazard.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Hazard", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "hazardEscalationCandidate", summary: "Future GM Apply may worsen an active hazard or draw a stronger one.", mutation: "none" },
    narration: {
      onConsequenceCreated: "The problem finds a sharper edge.",
      onFailure: "The attempted fix buys seconds, not safety."
    },
    tags: ["hazard", "escalation", "countdown", "response-failure"]
  }),
  Object.freeze({
    id: "consequence-ship-scar-candidate",
    schemaVersion: 1,
    type: "consequence",
    title: "Ship Scar Candidate",
    severity: "severe",
    source: "repeated severe pressure, final bad outcome, major hazard escalation",
    affectedTrack: "Ship Scar",
    publicText: "The voyage leaves a mark serious enough for the GM to consider after the encounter.",
    gmText: "This is only a handoff candidate for a future GM-reviewed ship scar. No actor, item, hull, room, or ship mutation happens automatically.",
    playerSafeSummary: "A severe outcome may become a GM-reviewed ship scar candidate.",
    applyEffectSummary: "Future GM Apply may create a reviewed ship scar handoff candidate; no actor or item mutation happens automatically.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Ship Scar", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "shipScarHandoffCandidate", summary: "Future GM Apply may create a GM-reviewed ship scar handoff candidate. No actor or item mutation happens automatically.", mutation: "none" },
    narration: {
      onConsequenceCreated: "For a moment, everyone can tell the ship will remember this.",
      onFailure: "The danger passes, but not cleanly, and not without a mark."
    },
    tags: ["ship-scar", "severe", "final-outcome", "handoff-candidate", "no-automatic-mutation"]
  })
]);

function cloneTravelV2Consequence(consequence) {
  return JSON.parse(JSON.stringify(consequence));
}

export function getTravelV2ConsequenceCatalog() {
  return TRAVEL_V2_CONSEQUENCE_CATALOG.map((consequence) => cloneTravelV2Consequence(consequence));
}

export function getTravelV2ConsequenceById(id) {
  return getTravelV2ConsequenceCatalog().find((consequence) => consequence.id === id) ?? null;
}

export function getTravelV2ConsequencesBySource(source) {
  return getTravelV2ConsequenceCatalog().filter((consequence) => consequence.source === source);
}

export function getTravelV2ConsequencesByAffectedTrack(affectedTrack) {
  return getTravelV2ConsequenceCatalog().filter((consequence) => consequence.affectedTrack === affectedTrack);
}

export function getTravelV2ConsequencesBySeverity(severity) {
  return getTravelV2ConsequenceCatalog().filter((consequence) => consequence.severity === severity);
}
