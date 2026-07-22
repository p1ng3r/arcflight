/**
 * Foundry/PF2e runtime wiring for the Voyage pending-check preflight adapter.
 * This boundary only discovers public runtime objects; it never rolls, posts
 * chat, mutates documents, or advances Voyage state.
 */

import { preflightVoyagePf2ePendingCheck } from "./resolution-check-adapter.js";
import { captureVoyagePf2eResultIdentity } from "./result-identity.js";

function safeRead(object, key) { try { return { ok: true, value: object?.[key] }; } catch { return { ok: false, value: undefined }; } }


function runtimeBlocked(pendingCheck, code, path, message) {
  return {
    ok: false,
    status: "blocked",
    ...captureVoyagePf2eResultIdentity(pendingCheck),
    errors: [{ code, path, message, severity: "error" }],
    warnings: []
  };
}

export function createRuntimeDependenciesFromResolver(runtime, capturedResolver) {
  return {
    async resolveUuid(uuid) {
      if (typeof capturedResolver !== "function") throw new Error("Foundry UUID resolver is unavailable.");
      return capturedResolver.call(runtime, uuid);
    },

    getActorFromResolvedDocument(document) {
      if (document === null || (typeof document !== "object" && typeof document !== "function")) return null;
      const documentName = safeRead(document, "documentName");
      if (!documentName.ok) throw new Error("Resolved document name could not be read safely.");
      if (documentName.value === "Actor") return document;
      const actor = safeRead(document, "actor");
      if (!actor.ok) throw new Error("Resolved document actor could not be read safely.");
      return actor.value !== null && (typeof actor.value === "object" || typeof actor.value === "function") ? actor.value : null;
    },

    getStatistic(actor, slug) {
      if (actor === null || (typeof actor !== "object" && typeof actor !== "function")) return null;
      const lookup = safeRead(actor, "getStatistic");
      if (!lookup.ok) throw new Error("Actor statistic lookup could not be read safely.");
      if (typeof lookup.value !== "function") return null;
      return lookup.value.call(actor, slug) ?? null;
    }
  };
}

/**
 * Creates the exact public-runtime dependency contract consumed by the
 * runtime-independent adapter. Creation captures, but does not invoke, the
 * current UUID resolver; resolveUuid never rereads the runtime property.
 */
export function createVoyagePf2eRuntimeDependencies(runtime = globalThis) {
  const resolver = safeRead(runtime, "fromUuid");
  return createRuntimeDependenciesFromResolver(runtime, resolver.ok && typeof resolver.value === "function" ? resolver.value : null);
}

/**
 * Validates the minimum Foundry/PF2e runtime before delegating to the
 * persisted-check adapter. Validation failures intentionally make no adapter
 * or runtime dependency calls.
 */
export async function preflightVoyagePf2ePendingCheckInFoundry(pendingCheck, runtime = globalThis) {
  if (runtime === null || (typeof runtime !== "object" && typeof runtime !== "function")) {
    return runtimeBlocked(pendingCheck, "voyage-pf2e-runtime-unavailable", "runtime", "Foundry runtime is unavailable.");
  }
  const game = safeRead(runtime, "game");
  if (!game.ok || game.value === null || (typeof game.value !== "object" && typeof game.value !== "function")) {
    return runtimeBlocked(pendingCheck, "voyage-pf2e-runtime-unavailable", "runtime.game", "Foundry game runtime is unavailable.");
  }
  const system = safeRead(game.value, "system");
  if (!system.ok || system.value === null || (typeof system.value !== "object" && typeof system.value !== "function")) {
    return runtimeBlocked(pendingCheck, "voyage-pf2e-runtime-unavailable", "runtime.game.system", "Foundry game system runtime is unavailable.");
  }
  const systemId = safeRead(system.value, "id");
  if (!systemId.ok) {
    return runtimeBlocked(pendingCheck, "voyage-pf2e-runtime-unavailable", "runtime.game.system.id", "Foundry game system ID could not be read safely.");
  }
  if (systemId.value !== "pf2e") {
    return runtimeBlocked(pendingCheck, "voyage-pf2e-system-mismatch", "runtime.game.system.id", "Voyage PF2e preflight requires the pf2e game system.");
  }
  const resolver = safeRead(runtime, "fromUuid");
  if (!resolver.ok || typeof resolver.value !== "function") {
    return runtimeBlocked(pendingCheck, "voyage-pf2e-uuid-resolver-unavailable", "runtime.fromUuid", "Foundry UUID resolver is unavailable.");
  }
  return preflightVoyagePf2ePendingCheck(pendingCheck, createRuntimeDependenciesFromResolver(runtime, resolver.value));
}
