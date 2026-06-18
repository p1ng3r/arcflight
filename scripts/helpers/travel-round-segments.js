import { getTravelPressureIdentity, getTravelPressureState, normalizeTravelPressureState, normalizeTravelRoundPressureProfile } from "./travel-pressure.js";

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENTS = Object.freeze({
  ROUND_REVEAL: "roundReveal",
  CREW_STRATEGY: "crewStrategy",
  STATION_ORDERS: "stationOrders",
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
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ORDERS,
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ROLLS,
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.REACTION_WINDOW,
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE
]);

const LEGACY_ROUND_SEGMENT_ALIASES = Object.freeze({
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.TABLE_STRATEGY]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_COMMITMENT]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_OUTCOME_TALLY]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STABILIZE_RESOLUTION]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.END_OF_ROUND_FOCUS]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_CHECK]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_TRANSITION]: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE
});

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENT_LABELS = Object.freeze({
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL]: "Round Reveal",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY]: "Crew Strategy",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ORDERS]: "Station Orders",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ROLLS]: "Station Rolls",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.REACTION_WINDOW]: "Reactions",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE]: "Outcome & Pressure",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION]: "Crisis & Transition"
});

export const ARCFLIGHT_TRAVEL_ROUND_SEGMENT_GUIDANCE = Object.freeze({
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL]: "GM reads the round vignette and reveals the active stations.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY]: "Players discuss assignments, resources, and who is handling each station.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ORDERS]: "Players choose Push Forward, Stabilize, and optional Focus.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ROLLS]: "Resolve station checks and record results.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.REACTION_WINDOW]: "Resolve triggered reaction abilities such as Hard Correction.",
  [ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE]: "Apply Stabilize pressure, backlash, pressure changes, and round consequences.",
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
  const roundResult = Array.isArray(session?.roundResults) ? session.roundResults[index] : null;
  const stationOrdersPending = activeStations.filter((key) => !roundResult?.stationOrderCommitments?.[key]?.committed).length;
  const stationRollsPending = activeStations.filter((key) => !roundResult?.stationResults?.[key]).length;
  const reactionPromptsPending = Number(options.reactionPromptReview?.pendingCount ?? 0);
  const stabilizeResolutionsPending = Number(options.stabilizeResolutionReview?.pendingCount ?? 0);
  const focusEffectsPending = Number(options.focusEffectReview?.pendingCount ?? 0);

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
    activeStationCount: activeStations.length,
    stationOrdersPending, stationRollsPending, reactionPromptsPending, stabilizeResolutionsPending, focusEffectsPending,
    hasPendingReactions: reactionPromptsPending > 0
  };
}
