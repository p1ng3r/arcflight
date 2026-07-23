import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVoyageEncounterStationActionSelectionChange,
  applyVoyageEncounterStationActionSelectionClear,
  applyVoyageEncounterCrewPlanningLock,
  prepareVoyageEncounterCrewPlanningCompleteness,
  prepareVoyageEncounterCrewPlanningReadiness,
  validateVoyageEncounterRiskBids,
  applyVoyageEncounterRiskBidSelection,
  applyVoyageEncounterRiskBidChange,
  applyVoyageEncounterRiskBidClear,
  prepareVoyageEncounterResolutionOrder,
  applyVoyageEncounterResolutionTransition,
  validateVoyageEncounterActionExecutionDefinitions,
  prepareVoyageEncounterActionExecutionRequests,
  validateVoyageEncounterPendingChecks,
  applyVoyageEncounterPendingCheckPreparation,
  applyVoyageEncounterPendingCheckResult,
  preflightVoyagePf2ePendingCheck,
  validateVoyagePf2eAdapterDependencies,
  createVoyagePf2eRuntimeDependencies,
  preflightVoyagePf2ePendingCheckInFoundry,
  executeVoyagePf2ePendingCheck,
  validateVoyagePf2eExecutionDependencies,
  createVoyagePf2eRuntimeExecutionDependencies,
  executeVoyagePf2ePendingCheckInFoundry,
  registerVoyageStationSelectionEditingApi
} from "../../../scripts/voyage/station-selection-api.js";

test("registers station-selection editing helpers on public and devTools APIs", () => {
  const previousConfig = globalThis.CONFIG;
  const previousGame = globalThis.game;

  try {
    const originalDevTools = Object.freeze({ existingTool: () => "kept" });
    const originalApi = Object.freeze({ existingApi: () => "kept", devTools: originalDevTools });
    globalThis.CONFIG = { arcflight: originalApi };
    globalThis.game = { arcflight: originalApi };

    const result = registerVoyageStationSelectionEditingApi();

    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.devTools));
    assert.equal(result.existingApi(), "kept");
    assert.equal(result.devTools.existingTool(), "kept");
    assert.equal(result.applyVoyageEncounterStationActionSelectionChange, applyVoyageEncounterStationActionSelectionChange);
    assert.equal(result.applyVoyageEncounterStationActionSelectionClear, applyVoyageEncounterStationActionSelectionClear);
    for (const helper of [validateVoyageEncounterRiskBids, applyVoyageEncounterRiskBidSelection, applyVoyageEncounterRiskBidChange, applyVoyageEncounterRiskBidClear]) { assert.equal(result[helper.name], helper); assert.equal(result.devTools[helper.name], helper); }
    for (const helper of [prepareVoyageEncounterCrewPlanningCompleteness, prepareVoyageEncounterCrewPlanningReadiness, applyVoyageEncounterCrewPlanningLock, prepareVoyageEncounterResolutionOrder, applyVoyageEncounterResolutionTransition, validateVoyageEncounterActionExecutionDefinitions, prepareVoyageEncounterActionExecutionRequests, validateVoyageEncounterPendingChecks, applyVoyageEncounterPendingCheckPreparation, applyVoyageEncounterPendingCheckResult, preflightVoyagePf2ePendingCheck, validateVoyagePf2eAdapterDependencies, createVoyagePf2eRuntimeDependencies, preflightVoyagePf2ePendingCheckInFoundry, executeVoyagePf2ePendingCheck, validateVoyagePf2eExecutionDependencies, createVoyagePf2eRuntimeExecutionDependencies, executeVoyagePf2ePendingCheckInFoundry]) {
      assert.equal(result[helper.name], helper);
      assert.equal(result.devTools[helper.name], helper);
    }
    assert.equal(result.devTools.applyVoyageEncounterStationActionSelectionChange, applyVoyageEncounterStationActionSelectionChange);
    assert.equal(result.devTools.applyVoyageEncounterStationActionSelectionClear, applyVoyageEncounterStationActionSelectionClear);
    assert.equal(globalThis.CONFIG.arcflight, result);
    assert.equal(globalThis.game.arcflight, result);
  } finally {
    if (previousConfig === undefined) delete globalThis.CONFIG;
    else globalThis.CONFIG = previousConfig;
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }
});

test("returns null without replacing state when the base API is unavailable", () => {
  const previousConfig = globalThis.CONFIG;
  const previousGame = globalThis.game;

  try {
    globalThis.CONFIG = {};
    globalThis.game = {};
    assert.equal(registerVoyageStationSelectionEditingApi(), null);
    assert.equal(globalThis.CONFIG.arcflight, undefined);
    assert.equal(globalThis.game.arcflight, undefined);
  } finally {
    if (previousConfig === undefined) delete globalThis.CONFIG;
    else globalThis.CONFIG = previousConfig;
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }
});

test("station-selection editing API module exposes named helpers", () => {
  assert.equal(typeof applyVoyageEncounterStationActionSelectionChange, "function");
  assert.equal(typeof applyVoyageEncounterStationActionSelectionClear, "function");
  assert.equal(typeof prepareVoyageEncounterCrewPlanningCompleteness, "function");
  assert.equal(typeof prepareVoyageEncounterCrewPlanningReadiness, "function");
  assert.equal(typeof applyVoyageEncounterCrewPlanningLock, "function");
  for (const helper of [validateVoyageEncounterRiskBids, applyVoyageEncounterRiskBidSelection, applyVoyageEncounterRiskBidChange, applyVoyageEncounterRiskBidClear, prepareVoyageEncounterResolutionOrder, applyVoyageEncounterResolutionTransition, validateVoyageEncounterActionExecutionDefinitions, prepareVoyageEncounterActionExecutionRequests, validateVoyageEncounterPendingChecks, applyVoyageEncounterPendingCheckPreparation, applyVoyageEncounterPendingCheckResult, preflightVoyagePf2ePendingCheck, validateVoyagePf2eAdapterDependencies, createVoyagePf2eRuntimeDependencies, preflightVoyagePf2ePendingCheckInFoundry, executeVoyagePf2ePendingCheck, validateVoyagePf2eExecutionDependencies, createVoyagePf2eRuntimeExecutionDependencies, executeVoyagePf2ePendingCheckInFoundry]) assert.equal(typeof helper, "function");
  assert.equal(typeof registerVoyageStationSelectionEditingApi, "function");
});
