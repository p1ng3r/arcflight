import { getTravelPressureIdentity, getTravelPressureState, normalizeTravelPressureState, normalizeTravelRoundPressureProfile } from "./travel-pressure.js";

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENTS = Object.freeze({
  ROUND_REVEAL: "roundReveal",
  TABLE_STRATEGY: "tableStrategy",
  STATION_COMMITMENT: "stationCommitment",
  STATION_ROLLS: "stationRolls",
  REACTION_WINDOW: "reactionWindow",
  ROUND_OUTCOME_TALLY: "roundOutcomeTally",
  PRESSURE_APPLICATION: "pressureApplication",
  STABILIZE_RESOLUTION: "stabilizeResolution",
  END_OF_ROUND_FOCUS: "endOfRoundFocus",
  CRISIS_CHECK: "crisisCheck",
  ROUND_TRANSITION: "roundTransition"
});

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS));

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENT_LABELS = Object.freeze({
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL]: "Round Reveal",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.TABLE_STRATEGY]: "Table Strategy",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_COMMITMENT]: "Station Commitment",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ROLLS]: "Station Rolls",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.REACTION_WINDOW]: "Reaction Window",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_OUTCOME_TALLY]: "Round Outcome Tally",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION]: "Pressure Application",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STABILIZE_RESOLUTION]: "Stabilize Resolution",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.END_OF_ROUND_FOCUS]: "End-of-Round Focus",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_CHECK]: "Crisis Check",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_TRANSITION]: "Round Transition"
});

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENT_GUIDANCE = Object.freeze({
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL]: "Reveal the round vignette, active stations, current pressure, primary/secondary pressure, Focus, exhausted actions, and progress target.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.TABLE_STRATEGY]: "Let the table discuss whether to push progress, stabilize pressure, save Focus, or risk Overpower.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_COMMITMENT]: "Each active station commits to an Event Approach or Stabilize choice.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ROLLS]: "Resolve station checks. Event approaches create progress; Stabilize rolls create pending pressure reduction.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.REACTION_WINDOW]: "Trigger once-per-event reaction actions after failures or revealed consequences.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_OUTCOME_TALLY]: "Tally station progress and determine the whole-round outcome.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION]: "Apply primary and secondary pressure from the whole-round outcome.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STABILIZE_RESOLUTION]: "Apply successful Stabilize reductions after pressure is added.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.END_OF_ROUND_FOCUS]: "Resolve end-of-round Focus actions and flexible pressure decisions after the pressure result is visible.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_CHECK]: "Check pressure tracks at 5 after all reductions and end-round actions; draw Fallout if needed.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_TRANSITION]: "Narrate what changed, mark exhausted actions, preview the next round, and advance when ready."
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
  return ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.includes(value) ? value : ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL;
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
