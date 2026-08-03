import { captureVoyageShipState } from "./ship-state.js";

const RESULT_FIELDS = Object.freeze([
  "ok",
  "shipId",
  "hullPlatform",
  "voidScarCapacity",
  "activeVoidScarCount",
  "availableSlots",
  "capacityExhausted",
  "canAcceptVoidScar",
  "errors",
  "warnings"
]);

function failure(errors, warnings) {
  return {
    ok: false,
    shipId: null,
    hullPlatform: null,
    voidScarCapacity: null,
    activeVoidScarCount: null,
    availableSlots: null,
    capacityExhausted: null,
    canAcceptVoidScar: null,
    errors: errors.map((error) => ({ ...error })),
    warnings: warnings.map((warning) => ({ ...warning }))
  };
}

/**
 * Analyze canonical durable Void Scar capacity without mutation, revision, or
 * event production. Exact-capacity ships are valid exhausted states.
 */
export function analyzeVoyageVoidScarCapacity(shipState) {
  const captured = captureVoyageShipState(shipState);
  if (!captured.ok) return failure(captured.errors, captured.warnings);

  const state = captured.state;
  const voidScarCapacity = state.hull.voidScarCapacity;
  const activeVoidScarCount = state.voidScars.length;
  const availableSlots = voidScarCapacity - activeVoidScarCount;
  return {
    ok: true,
    shipId: state.shipId,
    hullPlatform: state.installed.hullPlatform,
    voidScarCapacity,
    activeVoidScarCount,
    availableSlots,
    capacityExhausted: availableSlots === 0,
    canAcceptVoidScar: availableSlots > 0,
    errors: [],
    warnings: []
  };
}

export const VOYAGE_VOID_SCAR_CAPACITY_RESULT_FIELDS = RESULT_FIELDS;
