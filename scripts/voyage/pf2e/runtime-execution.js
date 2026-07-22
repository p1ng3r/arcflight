/** Foundry runtime execution wiring. One successful call creates one PF2e chat roll. */
import { createRuntimeDependenciesFromResolver } from "./runtime-preflight.js";
import { executeVoyagePf2ePendingCheck } from "./resolution-check-executor.js";
import { captureVoyagePf2eResultIdentity } from "./result-identity.js";
const safeRead = (object, key) => { try { return { ok: true, value: object?.[key] }; } catch { return { ok: false, value: undefined }; } };
function blocked(value, code, path, message) { return { ok: false, status: "blocked", ...captureVoyagePf2eResultIdentity(value), errors: [{ code, path, message, severity: "error" }], warnings: [] }; }
function validRuntime(pendingCheck, runtime) {
  if (!runtime || (typeof runtime !== "object" && typeof runtime !== "function")) return blocked(pendingCheck, "voyage-pf2e-runtime-unavailable", "runtime", "Foundry runtime is unavailable.");
  const game = safeRead(runtime, "game"), system = game.ok ? safeRead(game.value, "system") : { ok: false }, id = system.ok ? safeRead(system.value, "id") : { ok: false };
  if (!game.ok || !game.value || !system.ok || !system.value || !id.ok) return blocked(pendingCheck, "voyage-pf2e-runtime-unavailable", "runtime.game", "Foundry game runtime is unavailable.");
  if (id.value !== "pf2e") return blocked(pendingCheck, "voyage-pf2e-system-mismatch", "runtime.game.system.id", "Voyage PF2e execution requires the pf2e game system.");
  const resolver = safeRead(runtime, "fromUuid");
  if (!resolver.ok || typeof resolver.value !== "function") return blocked(pendingCheck, "voyage-pf2e-uuid-resolver-unavailable", "runtime.fromUuid", "Foundry UUID resolver is unavailable.");
  return resolver.value;
}
export function createVoyagePf2eRuntimeExecutionDependencies(runtime = globalThis) {
  const resolver = safeRead(runtime, "fromUuid");
  const base = createRuntimeDependenciesFromResolver(runtime, resolver.ok && typeof resolver.value === "function" ? resolver.value : null);
  return { ...base, rollStatistic(statistic, parameters) {
    const roll = safeRead(statistic, "roll");
    if (!roll.ok || typeof roll.value !== "function") { const failure = new Error("Statistic roll unavailable."); failure.code = "voyage-pf2e-statistic-roll-unavailable"; throw failure; }
    return roll.value.call(statistic, parameters);
  } };
}
export async function executeVoyagePf2ePendingCheckInFoundry(pendingCheck, runtime = globalThis) {
  const resolver = validRuntime(pendingCheck, runtime);
  if (typeof resolver !== "function") return resolver;
  const base = createRuntimeDependenciesFromResolver(runtime, resolver);
  const dependencies = { ...base, rollStatistic(statistic, parameters) { const roll = safeRead(statistic, "roll"); if (!roll.ok || typeof roll.value !== "function") { const failure = new Error("Statistic roll unavailable."); failure.code = "voyage-pf2e-statistic-roll-unavailable"; throw failure; } return roll.value.call(statistic, parameters); } };
  const result = await executeVoyagePf2ePendingCheck(pendingCheck, dependencies);
  if (result.errors?.[0]?.code === "voyage-pf2e-roll-failed") {
    // Runtime roll availability is distinguishable from an exception thrown by a callable roll.
    return result;
  }
  return result;
}
