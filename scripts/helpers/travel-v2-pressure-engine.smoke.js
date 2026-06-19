import { ARCFLIGHT_TRAVEL_RESOURCES } from "../config/constants.js";
import { createTravelV2SessionState } from "./travel-v2-state.js";
import {
  applyTravelV2HiddenRiskPressure,
  applyTravelV2ManualPressureChange,
  applyTravelV2PressureChanges,
  clearTravelV2PendingHazardDraws,
  createTravelV2HazardDrawRequestsForCurrentPressure,
  createTravelV2HiddenRiskPressureChange,
  createTravelV2PressureChangeRequest,
  getTravelV2HiddenRiskPressureAmount,
  previewTravelV2PressureChangeRequest,
  TRAVEL_V2_PRESSURE_CHANGE_SOURCES,
  TRAVEL_V2_PRESSURE_ENGINE_VERSION
} from "./travel-v2-pressure-engine.js";

function assertSmoke(condition, message) {
  if (!condition) throw new Error(`Travel v2 pressure engine smoke check failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Travel v2 pressure engine smoke check failed: ${message}. Expected ${expected}, got ${actual}.`);
  }
}

function assertArrayEqual(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`Travel v2 pressure engine smoke check failed: ${message}. Expected ${expectedText}, got ${actualText}.`);
  }
}

function pendingThresholds(session, pressureType) {
  return session.hazards.pendingDraws
    .filter((draw) => draw.pressureType === pressureType)
    .map((draw) => draw.threshold);
}

export function runTravelV2PressureEngineSmokeChecks() {
  assertEqual(TRAVEL_V2_PRESSURE_ENGINE_VERSION, 1, "pressure engine version should be 1");

  const request = createTravelV2PressureChangeRequest({
    pressureType: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
    delta: 2,
    source: "",
    roundNumber: 0,
    stationKey: "engineer",
    note: "  manual test  "
  });
  assertEqual(request.pressureType, ARCFLIGHT_TRAVEL_RESOURCES.HULL, "request should preserve valid pressure type");
  assertEqual(request.amount, 2, "request should normalize delta as amount");
  assertEqual(request.source, TRAVEL_V2_PRESSURE_CHANGE_SOURCES.MANUAL, "blank source should fall back to manual");
  assertEqual(request.roundNumber, 1, "round number should normalize to at least 1");
  assertEqual(request.note, "manual test", "request note should trim");

  const session = createTravelV2SessionState({ round: { number: 1 } });
  const preview = previewTravelV2PressureChangeRequest(session, {
    pressureType: ARCFLIGHT_TRAVEL_RESOURCES.HULL,
    amount: 2,
    source: TRAVEL_V2_PRESSURE_CHANGE_SOURCES.MANUAL,
    roundNumber: 1
  });
  assertEqual(preview.preview.previousValue, 0, "preview should read current pressure value");
  assertEqual(preview.preview.value, 2, "preview should calculate next pressure value");
  assertArrayEqual(preview.preview.thresholdCrossings.map((entry) => entry.threshold), [2], "preview should detect threshold 2 crossing");
  assertArrayEqual(preview.preview.hazardDraws.map((entry) => entry.count), [1], "threshold 2 should draw one Hazard");

  const manual = applyTravelV2ManualPressureChange(session, ARCFLIGHT_TRAVEL_RESOURCES.HULL, 2, { roundNumber: 1 });
  assertEqual(manual.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 2, "manual pressure should raise Hull to 2");
  assertArrayEqual(pendingThresholds(manual.session, ARCFLIGHT_TRAVEL_RESOURCES.HULL), [2], "manual pressure should queue threshold 2 Hazard draw");
  assertEqual(manual.hazardDraws.length, 1, "manual pressure result should report one Hazard draw request");
  assertEqual(manual.shipScarTriggers.length, 0, "manual pressure to 2 should not trigger Ship Scar");

  const followUp = applyTravelV2ManualPressureChange(manual.session, ARCFLIGHT_TRAVEL_RESOURCES.HULL, 2, { roundNumber: 2 });
  assertEqual(followUp.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 4, "follow-up manual pressure should raise Hull to 4");
  assertArrayEqual(pendingThresholds(followUp.session, ARCFLIGHT_TRAVEL_RESOURCES.HULL), [2, 3, 4], "follow-up pressure should queue threshold 3 and 4 Hazard draws without duplicating 2");
  assertArrayEqual(followUp.hazardDraws.map((draw) => draw.count), [2, 3], "threshold 3 and 4 should draw 2 and 3 Hazards");

  const overflow = applyTravelV2ManualPressureChange(followUp.session, ARCFLIGHT_TRAVEL_RESOURCES.HULL, 1, { roundNumber: 3 });
  assertEqual(overflow.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.HULL].value, 4, "overflow should keep normal pressure capped at 4");
  assertEqual(overflow.shipScarTriggers.length, 1, "overflow should report one Ship Scar trigger");
  assertEqual(overflow.session.shipScars.pending.length, 1, "overflow should queue one pending Ship Scar on the session");
  assertEqual(overflow.session.shipScars.pending[0].overflowAmount, 1, "Ship Scar trigger should record overflow amount");

  assertEqual(getTravelV2HiddenRiskPressureAmount("success", { failureIncrease: 1 }), 0, "success should not apply hidden risk pressure");
  assertEqual(getTravelV2HiddenRiskPressureAmount("failure", { failureIncrease: 1 }), 1, "failure should apply hidden risk failure increase");
  assertEqual(getTravelV2HiddenRiskPressureAmount("criticalFailure", { criticalFailureIncrease: 2 }), 2, "critical failure should apply hidden risk critical failure increase");

  const hiddenRiskSession = createTravelV2SessionState({
    round: { number: 1 },
    hiddenRisk: {
      pressureType: ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
      pressureStation: "engineer",
      failureIncrease: 1,
      criticalFailureIncrease: 2
    }
  });
  const hiddenRequest = createTravelV2HiddenRiskPressureChange(hiddenRiskSession, "failure");
  assertEqual(hiddenRequest.source, TRAVEL_V2_PRESSURE_CHANGE_SOURCES.HIDDEN_RISK, "hidden risk request should identify hidden risk source");
  assertEqual(hiddenRequest.pressureType, ARCFLIGHT_TRAVEL_RESOURCES.STRAIN, "hidden risk request should use hidden pressure type");
  assertEqual(hiddenRequest.amount, 1, "hidden risk failure should request +1 pressure");

  const hiddenApplied = applyTravelV2HiddenRiskPressure(hiddenRiskSession, "failure");
  assertEqual(hiddenApplied.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN].value, 1, "hidden risk failure should apply Strain pressure");
  assertEqual(hiddenApplied.hazardDraws.length, 0, "hidden risk failure to 1 should not draw Hazards");

  const hiddenCritical = applyTravelV2HiddenRiskPressure(hiddenApplied.session, "criticalFailure");
  assertEqual(hiddenCritical.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.STRAIN].value, 3, "hidden risk critical failure should raise Strain by 2");
  assertArrayEqual(pendingThresholds(hiddenCritical.session, ARCFLIGHT_TRAVEL_RESOURCES.STRAIN), [2, 3], "hidden risk critical failure should queue threshold 2 and 3 Hazard draws");

  const batched = applyTravelV2PressureChanges(createTravelV2SessionState(), [
    { pressureType: ARCFLIGHT_TRAVEL_RESOURCES.MORALE, amount: 1, source: TRAVEL_V2_PRESSURE_CHANGE_SOURCES.MANUAL },
    { pressureType: ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES, amount: 2, source: TRAVEL_V2_PRESSURE_CHANGE_SOURCES.MANUAL }
  ]);
  assertEqual(batched.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.MORALE].value, 1, "batch should apply Morale change");
  assertEqual(batched.session.pressure[ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES].value, 2, "batch should apply Supplies change");
  assertArrayEqual(pendingThresholds(batched.session, ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES), [2], "batch should queue Supplies threshold 2 Hazard draw");

  const rebuiltDraws = createTravelV2HazardDrawRequestsForCurrentPressure(followUp.session);
  assertArrayEqual(rebuiltDraws.filter((draw) => draw.pressureType === ARCFLIGHT_TRAVEL_RESOURCES.HULL).map((draw) => draw.threshold), [2, 3, 4], "current pressure helper should rebuild crossed Hull Hazard draws");

  const cleared = clearTravelV2PendingHazardDraws(followUp.session, (draw) => draw.pressureType === ARCFLIGHT_TRAVEL_RESOURCES.HULL && draw.threshold === 3);
  assertEqual(cleared.cleared.length, 1, "clear helper should report cleared draw");
  assertArrayEqual(pendingThresholds(cleared.session, ARCFLIGHT_TRAVEL_RESOURCES.HULL), [2, 4], "clear helper should leave nonmatching pending draws");

  assertSmoke(overflow.ok && hiddenCritical.ok && batched.ok && cleared.ok, "all engine helpers should return ok results");

  return {
    ok: true,
    checked: [
      "request-normalization",
      "pressure-preview",
      "manual-pressure-application",
      "hazard-threshold-queueing",
      "ship-scar-overflow",
      "hidden-risk-pressure",
      "batch-pressure-application",
      "current-pressure-hazard-rebuild",
      "pending-hazard-clearing"
    ]
  };
}

export default runTravelV2PressureEngineSmokeChecks;
