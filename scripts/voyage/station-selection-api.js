import {
  applyVoyageEncounterStationActionSelectionChange,
  applyVoyageEncounterStationActionSelectionClear
} from "./domain/station-selection.js";

/**
 * Extend Arcflight's frozen public API with the V3-003L station-selection
 * editing helpers after the main Arcflight init callback has built it.
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
    applyVoyageEncounterStationActionSelectionChange,
    applyVoyageEncounterStationActionSelectionClear
  });

  const extendedApi = Object.freeze({
    ...currentApi,
    applyVoyageEncounterStationActionSelectionChange,
    applyVoyageEncounterStationActionSelectionClear,
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
  applyVoyageEncounterStationActionSelectionClear
};
