const DEGREE_SLUGS = Object.freeze([
  "critical-failure",
  "failure",
  "success",
  "critical-success"
]);

const DEGREE_VALUES = new Map(DEGREE_SLUGS.map((slug, degreeOfSuccess) => [slug, degreeOfSuccess]));

function nonBlank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function syntheticTotal(finalDc, degreeOfSuccess) {
  if (degreeOfSuccess === 0) return finalDc - 10;
  if (degreeOfSuccess === 1) return finalDc - 1;
  if (degreeOfSuccess === 3) return finalDc + 10;
  return finalDc;
}

/**
 * Builds the narrow trusted executor used only by the Event Test Engine.
 * It returns the same normalized result shape as the PF2e boundary without
 * resolving an Actor, Statistic, Roll, or Foundry global.
 */
export function createDeterministicPendingCheckExecutor({ degree } = {}) {
  if (!DEGREE_VALUES.has(degree)) return null;
  const degreeOfSuccess = DEGREE_VALUES.get(degree);
  return async function executeDeterministicPendingCheck(pendingCheck) {
    if (!pendingCheck || typeof pendingCheck !== "object"
      || pendingCheck.status !== "pending"
      || pendingCheck.mode !== "check"
      || !nonBlank(pendingCheck.pendingCheckId)
      || !Number.isSafeInteger(pendingCheck.sequence)
      || !Number.isSafeInteger(pendingCheck.finalDc)
      || pendingCheck.finalDc < 0
      || !pendingCheck.source || typeof pendingCheck.source !== "object"
      || pendingCheck.source.kind !== "character"
      || !nonBlank(pendingCheck.source.uuid)
      || !nonBlank(pendingCheck.statisticSlugOrAbilityId)
      || !["public", "secret"].includes(pendingCheck.secrecy)) {
      return { ok: false, status: "blocked", errors: [{ code: "voyage-pf2e-invalid-request", path: "pendingCheck", message: "Pending check is invalid.", severity: "error" }], warnings: [] };
    }
    return {
      ok: true,
      status: "rolled",
      pendingCheckId: pendingCheck.pendingCheckId,
      sequence: pendingCheck.sequence,
      sourceKind: "character",
      sourceUuid: pendingCheck.source.uuid,
      statisticSlug: pendingCheck.statisticSlugOrAbilityId,
      dc: pendingCheck.finalDc,
      rollMode: pendingCheck.secrecy === "secret" ? "blind" : "public",
      result: {
        total: syntheticTotal(pendingCheck.finalDc, degreeOfSuccess),
        degreeOfSuccess,
        degreeOfSuccessSlug: degree
      },
      errors: [],
      warnings: []
    };
  };
}

export const EVENT_TEST_DEGREES = Object.freeze([...DEGREE_SLUGS]);
