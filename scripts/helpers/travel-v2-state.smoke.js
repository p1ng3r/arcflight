import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import {
  applyTravelV2PressureChange,
  createTravelV2FocusState,
  createTravelV2HazardDrawRequest,
  createTravelV2MomentumState,
  createTravelV2PressureState,
  createTravelV2SessionState,
  createTravelV2ThresholdCrossings,
  resetTravelV2EventPressure,
  TRAVEL_V2_DEFAULT_MOMENTUM_MAX,
  TRAVEL_V2_DEFAULT_STATION_FOCUS_MAX,
  TRAVEL_V2_DEFAULT_VOID_FORTUNE_HAND_LIMIT,
  TRAVEL_V2_HAZARD_DRAW_COUNT_BY_THRESHOLD,
  TRAVEL_V2_PRESSURE_TRACK_KEYS
} from "./travel-v2-state.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 state smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 state smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function assertArrayEqual(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`Travel v2 state smoke check failed: ${message}. Expected ${expectedText}, got ${actualText}.`);
  }
}

export function runTravelV2StateSmokeChecks() {
  const pressureKeys = TRAVEL_V2_PRESSURE_TRACK_KEYS;
  assertArrayEqual(pressureKeys, [
    ARCFLIGHT_TRAVEL_RESOURCES.HULL,
    ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
    ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
    ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
    ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES
  ], "pressure track keys should be the five event pressure tracks only");
  assertSmoke(!pressureKeys.includes(ARCFLIGHT_TRAVEL_RESOURCES.STORED_SPELL_RANKS), "stored spell ranks must not be a normal Travel v2 pressure track");

  const session = createTravelV2SessionState();
  assertEqual(session.version, 2, "session version should be 2");
  assertEqual(session.event.roundCount, 3, "default event round count should be 3");
  assertEqual(session.momentum.max, TRAVEL_V2_DEFAULT_MOMENTUM_MAX, "default Momentum max should match constant");
  assertEqual(session.voidFortune.handLimit, TRAVEL_V2_DEFAULT_VOID_FORTUNE_HAND_LIMIT, "default Void Fortune hand limit should match constant");

  const focus = createTravelV2FocusState();
  for (const [stationKey, stationFocus] of Object.entries(focus)) {
    assertEqual(stationFocus.max, TRAVEL_V2_DEFAULT_STATION_FOCUS_MAX, `${stationKey} Focus max should default to 1`);
    assertEqual(stationFocus.value, TRAVEL_V2_DEFAULT_STATION_FOCUS_MAX, `${stationKey} Focus value should default to full`);
  }

  const momentum = createTravelV2MomentumState({ value: 99, max: 3 });
  assertEqual(momentum.value, 3, "Momentum should clamp to max");

  const pressure = createTravelV2PressureState({
    [ARCFLIGHT_TRAVEL_RESOURCES.STRAIN]: { value: 99, crossed: [4, 2, 2, "bad", 3] },
    [ARCFLIGHT_TRAVEL_RESOURCES.STORED_SPELL_RANKS]: { value: 4, crossed: [2] }
  });
  assertEqual(pressure[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN].value, 4, "pressure should clamp at 4");
  assertArrayEqual(pressure[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN].crossed, [2, 3, 4], "pressure crossings should normalize unique sorted thresholds");
  assertSmoke(pressure[ARCFLIGHT_TRAVEL_RESOURCES.STORED_SPELL_RANKS] == null, "stored spell ranks should be dropped from v2 pressure state");

  assertEqual(createTravelV2HazardDrawRequest({ threshold: 2 }).count, TRAVEL_V2_HAZARD_DRAW_COUNT_BY_THRESHOLD[2], "threshold 2 should draw 1 Hazard by default");
  assertEqual(createTravelV2HazardDrawRequest({ threshold: 3 }).count, TRAVEL_V2_HAZARD_DRAW_COUNT_BY_THRESHOLD[3], "threshold 3 should draw 2 Hazards by default");
  assertEqual(createTravelV2HazardDrawRequest({ threshold: 4 }).count, TRAVEL_V2_HAZARD_DRAW_COUNT_BY_THRESHOLD[4], "threshold 4 should draw 3 Hazards by default");

  const crossings = createTravelV2ThresholdCrossings({
    pressureType: ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
    fromValue: 1,
    toValue: 4,
    crossed: []
  });
  assertArrayEqual(crossings.map((entry) => entry.threshold), [2, 3, 4], "1 to 4 pressure increase should cross 2, 3, and 4");
  assertArrayEqual(crossings.map((entry) => entry.hazardDrawCount), [1, 2, 3], "threshold crossings should carry correct Hazard draw counts");

  const applied = applyTravelV2PressureChange(session, ARCFLIGHT_TRAVEL_RESOURCES.STRAIN, 5, { roundNumber: 1 });
  assertEqual(applied.pressure[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN].value, 4, "applied pressure should clamp at 4");
  assertEqual(applied.hazards.pendingDraws.length, 3, "pressure jump to 4 should queue three threshold Hazard draw requests");
  assertEqual(applied.shipScars.pending.length, 1, "pressure overflow beyond 4 should queue one pending Ship Scar trigger");
  assertEqual(applied.shipScars.pending[0].overflowAmount, 1, "Ship Scar trigger should record overflow amount");

  const reset = resetTravelV2EventPressure(applied);
  assertEqual(reset.pressure[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN].value, 0, "reset should clear event pressure value");
  assertEqual(reset.hazards.pendingDraws.length, 0, "reset should clear pending Hazard draw requests");
  assertEqual(reset.momentum.max, applied.momentum.max, "reset should preserve Momentum max");
  assertEqual(reset.focus.navigator.max, applied.focus.navigator.max, "reset should preserve station Focus caps");
  assertEqual(reset.shipScars.pending.length, applied.shipScars.pending.length, "reset should not clear pending Ship Scars");

  return {
    ok: true,
    checked: [
      "pressure-track-keys",
      "session-defaults",
      "focus-defaults",
      "momentum-clamp",
      "pressure-normalization",
      "hazard-draw-defaults",
      "threshold-crossings",
      "pressure-overflow-ship-scar",
      "event-pressure-reset"
    ]
  };
}

export default runTravelV2StateSmokeChecks;
