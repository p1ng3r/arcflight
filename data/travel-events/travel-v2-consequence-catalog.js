export const TRAVEL_V2_CONSEQUENCE_CATALOG_VERSION = 1;
export const TRAVEL_V2_CONSEQUENCE_SEVERITIES = Object.freeze(["minor", "major", "severe"]);
export const TRAVEL_V2_CONSEQUENCE_AFFECTED_TRACKS = Object.freeze(["Strain", "Lifeveil", "Route", "Hull", "Morale", "Cargo", "Supplies", "Threat", "Hazard", "Ship Scar"]);
export const TRAVEL_V2_CONSEQUENCE_SOURCES = Object.freeze(["engine-hazard", "engineer-critical-failure", "focus-backlash", "engineer-failure", "arkengine-noise", "lifeveil-hazard", "veilwarden-critical-failure", "void-environment", "unresolved-hazard", "veilwarden-failure", "navigation-hazard", "navigator-critical-failure", "unresolved-void-shear", "final-bad-outcome", "navigator-failure", "route-delay", "physical-hazard", "pressure-overflow", "missed-watchmaster-warning", "captain-failure", "failed-support", "frightening-event", "watchmaster-failure", "crew-fatigue", "hard-maneuver", "hull-shock", "ignored-cargo-hazard", "low-stores", "blocked-access", "cargo-access", "loud-arkengine-signature", "lifeveil-flare", "failed-stealth", "threat-seed", "failed-response", "countdown-expiry", "repeated-severe-pressure", "major-hazard-escalation", "stationFailure", "criticalFailure", "unresolvedHazard", "pressureOverflow", "focusBacklash", "supportBacklash", "finalOutcome", "manual"]);

export const TRAVEL_V2_CONSEQUENCE_CATALOG = Object.freeze([
  Object.freeze({
    id: "consequence-arkengine-surge",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Arkengine Surge",
    severity: "major",
    source: ["engine-hazard", "engineer-critical-failure", "focus-backlash"],
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
    id: "consequence-arkengine-whine",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Arkengine Whine",
    severity: "minor",
    source: ["focus-backlash", "engineer-failure", "arkengine-noise"],
    affectedTrack: "Strain",
    publicText: "The arkengine takes up a thin, uneasy whine that sets the deck plates trembling.",
    gmText: "Minor engine strain. No automatic strain mutation happens.",
    playerSafeSummary: "A faint arkengine whine creates Strain pressure for GM review.",
    applyEffectSummary: "Future GM Apply may record or review the Strain candidate after GM review; this PR does not apply it.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Strain", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "pressureCandidate", summary: "Future GM Apply may record or review minor Strain pressure from the arkengine whine.", mutation: "none" },
    narration: {
      onConsequenceCreated: "The arkengine whines beneath the floorboards.",
      onFailure: "The ship moves on, but the engine keeps its worried note."
    },
    tags: ["arkengine", "strain", "engineer", "pressure-candidate"]
  }),
  Object.freeze({
    id: "consequence-lifeveil-flicker",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Lifeveil Flicker",
    severity: "major",
    source: ["lifeveil-hazard", "veilwarden-critical-failure", "void-environment"],
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
    id: "consequence-veil-draft",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Veil Draft",
    severity: "minor",
    source: ["unresolved-hazard", "void-environment", "veilwarden-failure"],
    affectedTrack: "Lifeveil",
    publicText: "A cold draft slips through the veil before the glow gathers close again.",
    gmText: "Minor lifeveil weakness. No automatic lifeveil mutation happens.",
    playerSafeSummary: "A passing veil draft creates Lifeveil pressure for GM review.",
    applyEffectSummary: "Future GM Apply may record or review the Lifeveil candidate after GM review; this PR does not apply it.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Lifeveil", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "pressureCandidate", summary: "Future GM Apply may record or review minor Lifeveil pressure from the veil draft.", mutation: "none" },
    narration: {
      onConsequenceCreated: "A chill breath crosses the deck.",
      onFailure: "The veil closes, but not before the cold is felt."
    },
    tags: ["lifeveil", "veilwarden", "pressure-candidate", "void"]
  }),
  Object.freeze({
    id: "consequence-route-drift",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Route Drift",
    severity: "major",
    source: ["navigation-hazard", "navigator-critical-failure", "unresolved-void-shear"],
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
    id: "consequence-course-slip",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Course Slip",
    severity: "minor",
    source: ["final-bad-outcome", "navigator-failure", "route-delay"],
    affectedTrack: "Route",
    publicText: "The plotted course slips a little from the clean path, leaving a harder choice ahead.",
    gmText: "Minor route/final outcome complication. No automatic route or final outcome mutation happens.",
    playerSafeSummary: "A small course slip creates Route pressure for GM review.",
    applyEffectSummary: "Future GM Apply may record or review the Route candidate after GM review; this PR does not apply it.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Route", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "finalOutcomeCandidate", summary: "Future GM Apply may record or review a minor Route or final outcome complication.", mutation: "none" },
    narration: {
      onConsequenceCreated: "The course line wavers from its mark.",
      onFailure: "The ship holds together, but the way ahead bends."
    },
    tags: ["route", "navigator", "final-outcome-candidate", "delay"]
  }),
  Object.freeze({
    id: "consequence-hull-stress",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Hull Stress",
    severity: "minor",
    source: ["physical-hazard", "pressure-overflow", "missed-watchmaster-warning"],
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
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Crew Panic",
    severity: "minor",
    source: ["captain-failure", "failed-support", "frightening-event"],
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
    id: "consequence-watch-fatigue",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Watch Fatigue",
    severity: "minor",
    source: ["failed-support", "watchmaster-failure", "crew-fatigue"],
    affectedTrack: "Morale",
    publicText: "The watch grows heavy-eyed, and small orders take longer to answer.",
    gmText: "Crew fatigue and morale strain. No automatic morale mutation happens.",
    playerSafeSummary: "Tired watches create Morale pressure for GM review.",
    applyEffectSummary: "Future GM Apply may record or review the Morale candidate after GM review; this PR does not apply it.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Morale", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "pressureCandidate", summary: "Future GM Apply may record or review minor Morale pressure from watch fatigue.", mutation: "none" },
    narration: {
      onConsequenceCreated: "The watch rubs sleep from weary eyes.",
      onFailure: "No one breaks, but every answer comes late."
    },
    tags: ["morale", "crew", "watchmaster", "pressure-candidate"]
  }),
  Object.freeze({
    id: "consequence-cargo-shift",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Cargo Shift",
    severity: "minor",
    source: ["hard-maneuver", "hull-shock", "ignored-cargo-hazard"],
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
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Supplies Delay",
    severity: "minor",
    source: ["low-stores", "blocked-access", "route-delay"],
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
    id: "consequence-stores-tangle",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Stores Tangle",
    severity: "minor",
    source: ["failed-support", "low-stores", "cargo-access"],
    affectedTrack: "Supplies",
    publicText: "The needed stores are aboard, but straps, crates, and confusion slow the work.",
    gmText: "Supplies access complication. No inventory or supplies mutation happens.",
    playerSafeSummary: "Tangled stores create a Supplies complication for GM review.",
    applyEffectSummary: "Future GM Apply may record or review the Supplies candidate after GM review; this PR does not apply it.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Supplies", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "complicationCandidate", summary: "Future GM Apply may record or review a minor Supplies access complication.", mutation: "none" },
    narration: {
      onConsequenceCreated: "Crates and straps snarl the path to stores.",
      onFailure: "The stores remain, but reaching them costs time."
    },
    tags: ["supplies", "complication-candidate", "stores", "cargo"]
  }),
  Object.freeze({
    id: "consequence-threat-attracted",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Threat Attracted",
    severity: "major",
    source: ["loud-arkengine-signature", "lifeveil-flare", "failed-stealth"],
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
    id: "consequence-signal-echo",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Signal Echo",
    severity: "minor",
    source: ["unresolved-hazard", "failed-stealth", "threat-seed"],
    affectedTrack: "Threat",
    publicText: "A faint echo answers the ship from somewhere beyond the safe lights.",
    gmText: "Minor future threat seed. No encounter, scene, combat, token, chat, or journal creation happens.",
    playerSafeSummary: "A stray signal echo creates a future Threat seed for GM review.",
    applyEffectSummary: "Future GM Apply may record or review the Threat candidate after GM review; this PR does not apply it.",
    sessionLocalEffect: { kind: "candidateOnly", suggestedTrack: "Threat", suggestedDelta: 1, expires: "gmDecision" },
    explicitGmApplyEffect: { requiresGmApply: true, kind: "encounterSeedCandidate", summary: "Future GM Apply may record or review a minor future Threat seed.", mutation: "none" },
    narration: {
      onConsequenceCreated: "A thin echo returns from the dark.",
      onFailure: "The signal fades, but it may have been heard."
    },
    tags: ["threat", "encounter-seed-candidate", "stealth", "unresolved-hazard"]
  }),
  Object.freeze({
    id: "consequence-hazard-escalation",
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Hazard Escalation",
    severity: "major",
    source: ["unresolved-hazard", "failed-response", "countdown-expiry"],
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
    schemaVersion: "travel-v2-card-schema-v0",
    type: "consequence",
    title: "Ship Scar Candidate",
    severity: "severe",
    source: ["repeated-severe-pressure", "final-bad-outcome", "major-hazard-escalation"],
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
  if (consequence === undefined) return undefined;
  return JSON.parse(JSON.stringify(consequence));
}

export function getTravelV2ConsequenceCatalog() {
  return TRAVEL_V2_CONSEQUENCE_CATALOG.map((consequence) => cloneTravelV2Consequence(consequence));
}

export function getTravelV2ConsequenceById(id) {
  return getTravelV2ConsequenceCatalog().find((consequence) => consequence.id === id) ?? null;
}

export function getTravelV2ConsequencesBySource(source) {
  return getTravelV2ConsequenceCatalog().filter((consequence) => consequence.source.includes(source));
}

export function getTravelV2ConsequencesByAffectedTrack(affectedTrack) {
  return getTravelV2ConsequenceCatalog().filter((consequence) => consequence.affectedTrack === affectedTrack);
}

export function getTravelV2ConsequencesBySeverity(severity) {
  return getTravelV2ConsequenceCatalog().filter((consequence) => consequence.severity === severity);
}


export function normalizeTravelV2ConsequenceCatalogEntry(entry) {
  const normalized = cloneTravelV2Consequence(entry);
  if (typeof normalized?.id === "string") normalized.id = normalized.id.trim();
  if (typeof normalized?.title === "string") normalized.title = normalized.title.trim();
  if (normalized && normalized.status === undefined) normalized.status = "candidate";
  return normalized;
}

export function prepareTravelV2ConsequencePlayerSafeSummary(entry) {
  const normalized = normalizeTravelV2ConsequenceCatalogEntry(entry);
  return {
    id: normalized.id,
    title: normalized.title,
    severity: normalized.severity,
    affectedTrack: normalized.affectedTrack,
    publicText: normalized.publicText,
    playerSafeSummary: normalized.playerSafeSummary,
    source: Array.isArray(normalized.source) ? normalized.source.slice() : normalized.source,
    applyEffectSummary: normalized.applyEffectSummary
  };
}

export function prepareTravelV2ConsequenceGmReview(entry) {
  const normalized = normalizeTravelV2ConsequenceCatalogEntry(entry);
  return {
    id: normalized.id,
    title: normalized.title,
    severity: normalized.severity,
    source: Array.isArray(normalized.source) ? normalized.source.slice() : normalized.source,
    affectedTrack: normalized.affectedTrack,
    publicText: normalized.publicText,
    playerSafeSummary: normalized.playerSafeSummary,
    gmText: normalized.gmText,
    applyEffectSummary: normalized.applyEffectSummary,
    status: normalized.status,
    sessionLocalEffect: cloneTravelV2Consequence(normalized.sessionLocalEffect),
    explicitGmApplyEffect: cloneTravelV2Consequence(normalized.explicitGmApplyEffect)
  };
}
