import {
  applyVoyageEncounterStationActionSelectionChange,
  applyVoyageEncounterStationActionSelectionClear
} from "./domain/station-selection.js";
import { prepareVoyageEncounterCrewPlanningCompleteness } from "./domain/crew-planning-completeness.js";
import { prepareVoyageEncounterCrewPlanningReadiness } from "./domain/crew-planning-readiness.js";
import { applyVoyageEncounterCrewPlanningLock } from "./domain/crew-planning-lock.js";
import { validateVoyageEncounterRiskBids, applyVoyageEncounterRiskBidSelection, applyVoyageEncounterRiskBidChange, applyVoyageEncounterRiskBidClear } from "./domain/risk-bids.js";
import { prepareVoyageEncounterResolutionOrder } from "./domain/resolution-order.js";
import { applyVoyageEncounterResolutionTransition } from "./domain/resolution-transition.js";
import { validateVoyageEncounterActionExecutionDefinitions, prepareVoyageEncounterActionExecutionRequests } from "./domain/resolution-execution-requests.js";
import { validateVoyageEncounterPendingChecks, applyVoyageEncounterPendingCheckPreparation } from "./domain/pending-checks.js";
import { preflightVoyagePf2ePendingCheck, validateVoyagePf2eAdapterDependencies } from "./pf2e/resolution-check-adapter.js";
import { createVoyagePf2eRuntimeDependencies, preflightVoyagePf2ePendingCheckInFoundry } from "./pf2e/runtime-preflight.js";

/**
 * Extend Arcflight's frozen public API with Voyage planning and Resolution
 * preparation helpers after the main Arcflight init callback has built it.
 */
export function registerVoyageStationSelectionEditingApi() {
  const currentApi = globalThis.CONFIG?.arcflight ?? globalThis.game?.arcflight;
  if (!currentApi || typeof currentApi !== "object") {
    console.warn("Arcflight | Base API unavailable; station-selection editing API was not registered.");
    return null;
  }

  const currentDevTools = currentApi.devTools && typeof currentApi.devTools === "object"
    ? currentApi.devTools
    : {};

  const devTools = Object.freeze({
    ...currentDevTools,
    prepareVoyageEncounterCrewPlanningCompleteness,
    prepareVoyageEncounterCrewPlanningReadiness,
    applyVoyageEncounterCrewPlanningLock,
    applyVoyageEncounterStationActionSelectionChange,
    applyVoyageEncounterStationActionSelectionClear,
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
    preflightVoyagePf2ePendingCheck,
    validateVoyagePf2eAdapterDependencies,
    createVoyagePf2eRuntimeDependencies,
    preflightVoyagePf2ePendingCheckInFoundry
  });

  const extendedApi = Object.freeze({
    ...currentApi,
    prepareVoyageEncounterCrewPlanningCompleteness,
    prepareVoyageEncounterCrewPlanningReadiness,
    applyVoyageEncounterCrewPlanningLock,
    applyVoyageEncounterStationActionSelectionChange,
    applyVoyageEncounterStationActionSelectionClear,
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
    preflightVoyagePf2ePendingCheck,
    validateVoyagePf2eAdapterDependencies,
    createVoyagePf2eRuntimeDependencies,
    preflightVoyagePf2ePendingCheckInFoundry,
    devTools
  });

  if (globalThis.CONFIG) globalThis.CONFIG.arcflight = extendedApi;
  if (globalThis.game) globalThis.game.arcflight = extendedApi;
  return extendedApi;
}

if (globalThis.Hooks?.once) {
  globalThis.Hooks.once("init", registerVoyageStationSelectionEditingApi);
}

export {
  applyVoyageEncounterStationActionSelectionChange,
  applyVoyageEncounterStationActionSelectionClear,
  prepareVoyageEncounterCrewPlanningCompleteness,
  prepareVoyageEncounterCrewPlanningReadiness,
  applyVoyageEncounterCrewPlanningLock,
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
  preflightVoyagePf2ePendingCheck,
  validateVoyagePf2eAdapterDependencies,
  createVoyagePf2eRuntimeDependencies,
  preflightVoyagePf2ePendingCheckInFoundry
};
