import { getTravelPressureIdentity, getTravelPressureState, normalizeTravelPressureState, normalizeTravelRoundPressureProfile } from "./travel-pressure.js";

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENTS = Object.freeze({
  ROUND_REVEAL: "roundReveal",
  CREW_STRATEGY: "crewStrategy",
  STATION_ROLLS: "stationRolls",
  REACTION_WINDOW: "reactionWindow",
  OUTCOME_PRESSURE: "outcomePressure",
  CRISIS_TRANSITION: "crisisTransition",

  // Legacy aliases kept so old saved sessions and older helper callers normalize cleanly.
  TABLE_STRATEGY: "tableStrategy",
  STATION_COMMITMENT: "stationCommitment",
  ROUND_OUTCOME_TALLY: "roundOutcomeTally",
  PRESSURE_APPLICATION: "pressureApplication",
  STABILIZE_RESOLUTION: "stabilizeResolution",
  END_OF_ROUND_FOCUS: "endOfRoundFocus",
  CRISIS_CHECK: "crisisCheck",
  ROUND_TRANSITION: "roundTransition"
});

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER = Object.freeze([
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL,
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY,
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ROLLS,
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.REACTION_WINDOW,
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION
]);

const LEGACY_ROUND_SEGMENT_ALIASES = Object.freeze({
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.TABLE_STRATEGY]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_COMMITMENT]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_OUTCOME_TALLY]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STABILIZE_RESOLUTION]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.END_OF_ROUND_FOCUS]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_CHECK]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_TRANSITION]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION
});

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENT_LABELS = Object.freeze({
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL]: "Round Reveal",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY]: "Crew Strategy",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ROLLS]: "Station Rolls",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.REACTION_WINDOW]: "Reaction Window",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE]: "Outcome & Pressure",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION]: "Crisis & Transition"
});

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENT_GUIDANCE = Object.freeze({
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL]: "Reveal the round vignette, active stations, current pressure, primary/secondary pressure, Focus, exhausted actions, and progress target.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY]: "Let the table choose priorities, then each active station commits to an Event Approach, Stabilize, Focus use, or Overpower risk.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ROLLS]: "Resolve station checks. Event approaches create progress; Stabilize rolls create pending pressure reduction.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.REACTION_WINDOW]: "Trigger once-per-event reaction actions after failures or revealed consequences.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE]: "Tally progress, determine the whole-round outcome, apply pressure, apply Stabilize reductions, and resolve end-of-round Focus decisions.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION]: "Check pressure tracks at 5, draw Fallout if needed, narrate what changed, preview the next round, and advance when ready."
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeTravelRoundSegmentKey(value) {
  if (ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.includes(value)) return value;
  return LEGACY_ROUND_SEGMENT_ALIASES[value] ?? ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL;
}

export function getTravelRoundSegmentIndex(segmentKey) {
  const normalized = normalizeTravelRoundSegmentKey(segmentKey);
  return ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.indexOf(normalized);
}

export function getTravelRoundSegmentDefinition(segmentKey) {
  const key = normalizeTravelRoundSegmentKey(segmentKey);
  const index = getTravelRoundSegmentIndex(key);
  return {
    key,
    index,
    step: index + 1,
    label: ARCFLIGHT_TRAVEL_ROUND_SEGMENT_LABELS[key] ?? humanizeIdentifier(key),
    guidance: ARCFLIGHT_TRAVEL_ROUND_SEGMENT_GUIDANCE[key] ?? "",
    first: index === 0,
    last: index === ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.length - 1,
    previousKey: index > 0 ? ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER[index - 1] : "",
    nextKey: index < ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.length - 1 ? ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER[index + 1] : ""
  };
}

export function getNextTravelRoundSegment(segmentKey) {
  return getTravelRoundSegmentDefinition(segmentKey).nextKey || normalizeTravelRoundSegmentKey(segmentKey);
}

export function getPreviousTravelRoundSegment(segmentKey) {
  return getTravelRoundSegmentDefinition(segmentKey).previousKey || normalizeTravelRoundSegmentKey(segmentKey);
}

export function normalizeTravelRunnerRoundPhase(value) {
  return normalizeTravelRoundSegmentKey(value);
}

function currentRoundFromSession(session = {}) {
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  const index = Math.min(Math.max(Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0, 0), Math.max(rounds.length - 1, 0));
  return { round: rounds[index] ?? null, index };
}

function pressureTrackRows(pressure = {}) {
  const normalized = normalizeTravelPressureState(pressure);
  return Object.entries(normalized).map(([pressureKey, value]) => {
    const identity = getTravelPressureIdentity(pressureKey) ?? { key: pressureKey, label: humanizeIdentifier(pressureKey), summary: "" };
    const state = getTravelPressureState(value);
    return {
      pressureKey,
      key: pressureKey,
      label: identity.label,
      summary: identity.summary,
      value,
      max: 5,
      state: state.state,
      stateLabel: state.label,
      stateDescription: state.description,
      atCrisis: state.state === "crisis"
    };
  });
}

function pressureProfileLabels(profile = {}) {
  const primary = getTravelPressureIdentity(profile.primaryPressure);
  const secondary = getTravelPressureIdentity(profile.secondaryPressure);
  return {
    primaryPressureLabel: primary?.label ?? "None",
    secondaryPressureLabel: secondary?.label ?? "None",
    hasPrimaryPressure: Boolean(primary),
    hasSecondaryPressure: Boolean(secondary)
  };
}

export function prepareTravelRoundSegmentState(session = {}, options = {}) {
  const { round, index } = currentRoundFromSession(session);
  const sourcePhase = options.roundPhase ?? session?.roundPhase ?? session?.currentRoundPhase;
  const segment = getTravelRoundSegmentDefinition(sourcePhase);
  const pressure = normalizeTravelPressureState(session?.pressure ?? session?.travelPressure ?? options.pressure);
  const pressureTracks = pressureTrackRows(pressure);
  const pressureProfile = normalizeTravelRoundPressureProfile(round ?? {});
  const labels = pressureProfileLabels(pressureProfile);
  const activeStations = Array.isArray(round?.activeStations) ? round.activeStations.map((station) => typeof station === "string" ? station : station?.stationKey).filter(Boolean) : [];

  return {
    hasSession: isPlainObject(session),
    hasRound: Boolean(round),
    round,
    roundIndex: index,
    roundNumber: Number.isInteger(Number(round?.round)) ? Number(round.round) : index + 1,
    roundTitle: typeof round?.title === "string" ? round.title : (round ? `Round ${index + 1}` : "No Active Round"),
    phase: segment.key,
    phaseIndex: segment.index,
    phaseStep: segment.step,
    phaseLabel: segment.label,
    phaseGuidance: segment.guidance,
    phasePreviousKey: segment.previousKey,
    phaseNextKey: segment.nextKey,
    canAdvancePhase: !segment.last,
    canRetreatPhase: !segment.first,
    segment,
    segments: ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.map((key) => {
      const definition = getTravelRoundSegmentDefinition(key);
      return {
        ...definition,
        active: definition.key === segment.key,
        complete: definition.index < segment.index,
        pending: definition.index > segment.index
      };
    }),
    pressure,
    pressureTracks,
    primaryPressure: pressureProfile.primaryPressure,
    secondaryPressure: pressureProfile.secondaryPressure,
    progressTarget: pressureProfile.progressTarget,
    hasProgressTarget: Number.isInteger(pressureProfile.progressTarget),
    ...labels,
    activeStations,
    activeStationCount: activeStations.length
  };
}
