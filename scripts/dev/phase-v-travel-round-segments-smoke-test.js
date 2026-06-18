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

assert(ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.length === 11, "round segment order has eleven locked segments");
assert(ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER[0] === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "round reveal is first segment");
assert(ARCFLIGHT_TRAVEL_ROUND_SEGMENT_ORDER.at(-1) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_TRANSITION, "round transition is final segment");
assert(normalizeTravelRoundSegmentKey("bad-phase") === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "invalid phase falls back to round reveal");
assert(getNextTravelRoundSegment(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.TABLE_STRATEGY, "next segment advances from reveal to strategy");
assert(getPreviousTravelRoundSegment(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.TABLE_STRATEGY) === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL, "previous segment retreats from strategy to reveal");

const crisisDefinition = getTravelRoundSegmentDefinition(ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_CHECK);
assert(crisisDefinition.step === 10, "crisis check is tenth round segment");
assert(crisisDefinition.nextKey === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_TRANSITION, "crisis check advances to transition");

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
  roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION,
  pressure: { strain: 3, lifeveil: 1, morale: 5 }
};

const state = prepareTravelRoundSegmentState(session);
assert(state.hasRound, "segment state finds current round");
assert(state.roundNumber === 1 && state.roundTitle === "Opening Split", "segment state exposes current round identity");
assert(state.phase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION, "segment state preserves current phase");
assert(state.phaseStep === 7, "pressure application is seventh segment");
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
assert(state.segments.find((segment) => segment.key === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.PRESSURE_APPLICATION).active, "current segment is marked active");
assert(state.segments.find((segment) => segment.key === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_CHECK).pending, "later segments are marked pending");
assert(state.segments.every((segment) => [segment.active, segment.complete, segment.pending].filter(Boolean).length === 1), "each segment has exactly one active, complete, or pending status");

const firstState = prepareTravelRoundSegmentState(session, { roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_REVEAL });
assert(firstState.canAdvancePhase && !firstState.canRetreatPhase, "round reveal can advance but cannot retreat");

const lastState = prepareTravelRoundSegmentState(session, { roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.ROUND_TRANSITION });
assert(!lastState.canAdvancePhase && lastState.canRetreatPhase, "round transition can retreat but cannot advance");

const overrideState = prepareTravelRoundSegmentState(session, { roundPhase: ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_CHECK, pressure: { strain: 0, lifeveil: 0, morale: 0 } });
assert(overrideState.phase === ARCFLIGHT_TRAVEL_ROUND_SEGMENTS.CRISIS_CHECK, "options can override displayed phase");
assert(overrideState.pressure.morale === 5, "session pressure remains source of truth over options pressure when present");

console.log("Phase V travel round segments smoke test passed.");
