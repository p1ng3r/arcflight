import {
  ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER,
  ARCFLIGHT_TRAVEL_ROUND_SEGMENTS,
  getNextTravelRoundSegment,
  getPreviousTravelRoundSegment,
  getTravelRoundSegmentDefinition,
  normalizeTravelRoundSegmentKey,
  prepareTravelRoundSegmentState
} from "../helpers/travel-round-segments.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.length === 6, "round segment order has six table-facing segments");
assert(ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER[0] === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "round reveal is first segment");
assert(ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER[ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.length - 1] === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION, "crisis transition is final segment");
assert(normalizeTravelRoundSegmentKey("bad-phase") === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "invalid phase falls back to round reveal");
assert(getNextTravelRoundSegment(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY, "next segment advances from reveal to crew strategy");
assert(getPreviousTravelRoundSegment(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "previous segment retreats from crew strategy to reveal");

const crisisDefinition = getTravelRoundSegmentDefinition(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION);
assert(crisisDefinition.step === 6, "crisis transition is sixth round segment");
assert(crisisDefinition.nextKey === "", "crisis transition has no next phase");

assert(normalizeTravelRoundSegmentKey(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.TABLE_STRATEGY) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY, "legacy tableStrategy normalizes to crewStrategy");
assert(normalizeTravelRoundSegmentKey(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_COMMITMENT) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CREW_STRATEGY, "legacy stationCommitment normalizes to crewStrategy");
assert(normalizeTravelRoundSegmentKey(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, "legacy pressureApplication normalizes to outcomePressure");
assert(normalizeTravelRoundSegmentKey(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STABILIZE_RESOLUTION) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, "legacy stabilizeResolution normalizes to outcomePressure");
assert(normalizeTravelRoundSegmentKey(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_TRANSITION) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION, "legacy roundTransition normalizes to crisisTransition");

const session = {
  event: {
    key: "segment-smoke",
    name: "Segment Smoke",
    rounds: [
      {
        round: 1,
        title: "Opening Split",
        primaryPressure: "strain",
        secondaryPressure: "morale",
        progressTarget: 3,
        activeStations: ["navigator", { stationKey: "engineer" }, "captain"]
      }
    ]
  },
  currentRoundIndex: 0,
  roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE,
  pressure: { strain: 3, lifeveil: 1, morale: 5 }
};

const state = prepareTravelRoundSegmentState(session);
assert(state.hasRound, "segment state finds current round");
assert(state.roundNumber === 1 && state.roundTitle === "Opening Split", "segment state exposes current round identity");
assert(state.phase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, "segment state preserves current phase");
assert(state.phaseStep === 5, "outcome pressure is fifth segment");
assert(typeof state.phaseLabel === "string" && state.phaseLabel.length > 0, "segment state exposes the current phase label");
assert(typeof state.phaseGuidance === "string" && state.phaseGuidance.length > 0, "segment state exposes current phase guidance");
assert(state.canAdvancePhase && state.canRetreatPhase, "middle segment can advance and retreat");
assert(state.primaryPressure === "strain" && state.primaryPressureLabel === "Strain", "segment state exposes primary pressure label");
assert(state.secondaryPressure === "morale" && state.secondaryPressureLabel === "Morale", "segment state exposes secondary pressure label");
assert(state.progressTarget === 3 && state.hasProgressTarget, "segment state exposes round progress target");
assert(state.pressure.strain === 3 && state.pressure.lifeveil === 1 && state.pressure.morale === 5, "segment state normalizes pressure tracks");
assert(state.pressureTracks.some((track) => track.pressureKey === "morale" && track.atCrisis && track.stateLabel === "Crisis"), "segment state flags crisis pressure tracks");
assert(state.activeStationCount === 3, "segment state normalizes active station count");
assert(state.segments.find((segment) => segment.key === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.STATION_ROLLS).complete, "earlier segments are marked complete");
assert(state.segments.find((segment) => segment.key === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE).active, "current segment is marked active");
assert(state.segments.find((segment) => segment.key === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION).pending, "later segments are marked pending");
assert(state.segments.every((segment) => [segment.active, segment.complete, segment.pending].filter(Boolean).length === 1), "each segment has exactly one active, complete, or pending status");

const legacyState = prepareTravelRoundSegmentState({ ...session, roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION });
assert(legacyState.phase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.OUTCOME_PRESSURE, "legacy session phase is normalized for display");

const firstState = prepareTravelRoundSegmentState(session, { roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL });
assert(firstState.canAdvancePhase && !firstState.canRetreatPhase, "round reveal can advance but cannot retreat");

const lastState = prepareTravelRoundSegmentState(session, { roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION });
assert(!lastState.canAdvancePhase && lastState.canRetreatPhase, "crisis transition can retreat but cannot advance");

const overrideState = prepareTravelRoundSegmentState(session, { roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION, pressure: { strain: 0, lifeveil: 0, morale: 0 } });
assert(overrideState.phase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_TRANSITION, "options can override displayed phase");
assert(overrideState.pressure.morale === 5, "session pressure remains source of truth over options pressure when present");

console.log("Phase V travel round segments smoke test passed.");
