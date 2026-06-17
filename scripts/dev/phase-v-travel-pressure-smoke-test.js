import {
  ARCFLIGHT_TRAVEL_PRESSURE_FALLOUT_RESET,
  ARCFLIGHT_TRAVEL_PRESSURE_MAX,
  applyTravelPressureChange,
  applyTravelPressureChanges,
  applyTravelRoundOutcomePressure,
  createEmptyTravelPressureState,
  getTravelPressureState,
  normalizeTravelPressureState,
  normalizeTravelRoundPressureProfile,
  resolveTravelPressureFallout
} from "../helpers/travel-pressure.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const empty = createEmptyTravelPressureState();
assert(empty.strain === 0 && empty.lifeveil === 0 && empty.morale === 0, "empty pressure starts all tracks at zero");

const normalized = normalizeTravelPressureState({ strain: 99, lifeveil: -3, morale: 2.8, hull: 4 });
assert(normalized.strain === 5, "pressure normalization clamps high values at 5");
assert(normalized.lifeveil === 0, "pressure normalization clamps low values at 0");
assert(normalized.morale === 2, "pressure normalization truncates fractional pressure values");
assert(!Object.hasOwn(normalized, "hull"), "pressure normalization drops non-pressure resources");

assert(getTravelPressureState(0).state === "stable", "pressure 0 is stable");
assert(getTravelPressureState(1).state === "warning", "pressure 1 is warning");
assert(getTravelPressureState(2).state === "pressured", "pressure 2 is pressured");
assert(getTravelPressureState(3).state === "stressed", "pressure 3 is stressed");
assert(getTravelPressureState(4).state === "severe", "pressure 4 is severe");
assert(getTravelPressureState(5).state === "crisis", "pressure 5 is crisis");

const singleChange = applyTravelPressureChange({ strain: 4, lifeveil: 0, morale: 0 }, "strain", 1);
assert(singleChange.pressure.strain === ARCFLIGHT_TRAVEL_PRESSURE_MAX, "single pressure change can reach crisis cap");
assert(singleChange.falloutTriggers.length === 1 && singleChange.falloutTriggers[0].pressureKey === "strain", "single pressure change reports fallout trigger when reaching 5");

const invalidChange = applyTravelPressureChange({ strain: 1 }, "hull", 1);
assert(invalidChange.warnings.some((warning) => warning.includes("Invalid pressure key")), "invalid pressure key is reported as warning");

const multiChange = applyTravelPressureChanges({ strain: 1, lifeveil: 2, morale: 3 }, [
  { pressureKey: "strain", amount: 2 },
  { resource: "lifeveil", value: -1 },
  "morale"
]);
assert(multiChange.pressure.strain === 3, "multi pressure changes add explicit pressure");
assert(multiChange.pressure.lifeveil === 1, "multi pressure changes allow pressure reduction");
assert(multiChange.pressure.morale === 4, "string changes add one pressure by default");

const profile = normalizeTravelRoundPressureProfile({ primaryPressure: "lifeveil", secondaryPressure: "morale", progressTarget: 3 });
assert(profile.primaryPressure === "lifeveil", "round pressure profile preserves primary pressure");
assert(profile.secondaryPressure === "morale", "round pressure profile preserves secondary pressure");
assert(profile.progressTarget === 3, "round pressure profile preserves progress target");

const mixed = applyTravelRoundOutcomePressure({ strain: 0, lifeveil: 1, morale: 2 }, { primaryPressure: "lifeveil", secondaryPressure: "morale" }, "mixed");
assert(mixed.pressure.lifeveil === 2 && mixed.pressure.morale === 2, "mixed round adds only primary pressure");

const failure = applyTravelRoundOutcomePressure({ strain: 0, lifeveil: 1, morale: 2 }, { primaryPressure: "lifeveil", secondaryPressure: "morale" }, "failure");
assert(failure.pressure.lifeveil === 2 && failure.pressure.morale === 3, "failed round adds primary and secondary pressure");

const disaster = applyTravelRoundOutcomePressure({ strain: 0, lifeveil: 3, morale: 4 }, { primaryPressure: "lifeveil", secondaryPressure: "morale" }, "disaster");
assert(disaster.pressure.lifeveil === 5 && disaster.pressure.morale === 5, "disaster round adds +2 primary and +1 secondary pressure");
assert(disaster.complication === true, "disaster round marks complication");
assert(disaster.falloutTriggers.length === 2, "disaster round reports fallout triggers for tracks that reach 5");

const criticalRoundFailureAlias = applyTravelRoundOutcomePressure({ strain: 0, lifeveil: 3, morale: 4 }, { primaryPressure: "lifeveil", secondaryPressure: "morale" }, "criticalRoundFailure");
assert(criticalRoundFailureAlias.roundPressureKey === "disaster", "runner criticalRoundFailure aliases to disaster pressure");

const fallout = resolveTravelPressureFallout({ strain: 5, lifeveil: 0, morale: 0 }, "strain");
assert(fallout.fallout?.deck === "strain", "fallout resolution identifies the matching deck");
assert(fallout.pressure.strain === ARCFLIGHT_TRAVEL_PRESSURE_FALLOUT_RESET, "fallout resolution drops pressure to fallback reset value");

const noFallout = resolveTravelPressureFallout({ strain: 4, lifeveil: 0, morale: 0 }, "strain");
assert(noFallout.fallout === null, "fallout resolution does nothing below crisis threshold");

console.log("Phase V travel pressure smoke test passed.");
