/** Executes one already-persisted pending check without applying or persisting it. */
import { resolveVoyagePf2ePendingCheckContext } from "./resolution-check-context.js";
import { validateVoyagePf2eAdapterDependencies } from "./resolution-check-adapter.js";

const degreeSlugs = ["critical-failure", "failure", "success", "critical-success"];
const error = (code, path, message) => ({ code, path, message, severity: "error" });
function identity(value) {
  const result = {};
  try { if (value && Object.hasOwn(value, "pendingCheckId") && typeof value.pendingCheckId === "string") result.pendingCheckId = value.pendingCheckId; } catch {}
  try { if (value && Object.hasOwn(value, "sequence") && Number.isSafeInteger(value.sequence) && value.sequence >= 0) result.sequence = value.sequence; } catch {}
  return result;
}
function blocked(value, entry) { return { ok: false, status: "blocked", ...identity(value), errors: [entry], warnings: [] }; }
function ownFunction(object, key) {
  try { return object && (typeof object === "object" || typeof object === "function") && Object.hasOwn(object, key) && typeof object[key] === "function" ? object[key] : null; } catch { return null; }
}
export function validateVoyagePf2eExecutionDependencies(dependencies) {
  try {
    const adapter = validateVoyagePf2eAdapterDependencies(dependencies);
    const rollStatistic = ownFunction(dependencies, "rollStatistic");
    if (!adapter.valid || !rollStatistic) return { valid: false, errors: [error("voyage-pf2e-invalid-execution-dependencies", "dependencies", "Execution dependencies require four own functions.")], warnings: [] };
    return { valid: true, errors: [], warnings: [] };
  } catch { return { valid: false, errors: [error("voyage-pf2e-invalid-execution-dependencies", "dependencies", "Execution dependencies could not be inspected safely.")], warnings: [] }; }
}
export async function executeVoyagePf2ePendingCheck(pendingCheck, dependencies) {
  const validation = validateVoyagePf2eExecutionDependencies(dependencies);
  if (!validation.valid) return blocked(pendingCheck, validation.errors[0]);
  const rollStatistic = ownFunction(dependencies, "rollStatistic");
  const resolved = await resolveVoyagePf2ePendingCheckContext(pendingCheck, dependencies);
  if (!resolved.result || !resolved.context) return resolved.result ?? resolved;
  const ready = resolved.result;
  let roll;
  try { roll = await rollStatistic(resolved.context.statistic, { dc: ready.dc, messageMode: ready.rollMode, skipDialog: true, createMessage: true, identifier: ready.pendingCheckId }); }
  catch (cause) { const code = cause?.code === "voyage-pf2e-statistic-roll-unavailable" ? cause.code : "voyage-pf2e-roll-failed"; return { ...ready, ok: false, status: "blocked", errors: [error(code, "statistic.roll", "PF2e statistic roll failed.")], warnings: [] }; }
  if (roll == null) return { ...ready, ok: false, status: "blocked", errors: [error("voyage-pf2e-roll-cancelled", "statistic.roll", "PF2e statistic roll was cancelled.")], warnings: [] };
  if (typeof roll !== "object" && typeof roll !== "function") return { ...ready, ok: false, status: "blocked", errors: [error("voyage-pf2e-invalid-roll-result", "roll", "PF2e roll result is invalid.")], warnings: [] };
  let total, degreeOfSuccess;
  try { total = roll.total; degreeOfSuccess = roll.degreeOfSuccess; } catch { return { ...ready, ok: false, status: "blocked", errors: [error("voyage-pf2e-invalid-roll-result", "roll", "PF2e roll result could not be read safely.")], warnings: [] }; }
  if (!Number.isFinite(total) || !Number.isSafeInteger(degreeOfSuccess) || degreeOfSuccess < 0 || degreeOfSuccess > 3) return { ...ready, ok: false, status: "blocked", errors: [error("voyage-pf2e-invalid-roll-result", "roll", "PF2e roll total or degree of success is invalid.")], warnings: [] };
  return { ...ready, ok: true, status: "rolled", result: { total, degreeOfSuccess, degreeOfSuccessSlug: degreeSlugs[degreeOfSuccess] }, errors: [], warnings: [] };
}
