/** PF2e-facing isolated preflight boundary for persisted Voyage pending checks. */
import { resolveVoyagePf2ePendingCheckContext, validateVoyagePf2eAdapterDependencies } from "./resolution-check-context.js";
export { validateVoyagePf2eAdapterDependencies };
/** Returns only serializable preflight data; live context remains internal. */
export async function preflightVoyagePf2ePendingCheck(pendingCheck, dependencies) {
  const resolved = await resolveVoyagePf2ePendingCheckContext(pendingCheck, dependencies);
  return resolved.result ?? resolved;
}
