import { VOYAGE_HAZARD_CATEGORIES, VOYAGE_HAZARD_COLLISION_POLICIES, VOYAGE_HAZARD_STATUSES } from "./constants.js";

const RESULT_FIELDS = Object.freeze([
  "structurallyValid",
  "readyForHazardCollisionPlanning",
  "collision",
  "plan",
  "errors",
  "warnings"
]);

const PLAN_FIELDS = Object.freeze([
  "kind",
  "encounterId",
  "expectedRevision",
  "incomingHazardId",
  "existingHazardId",
  "existingHazardIndex",
  "pressureSystemId",
  "collisionPolicy",
  "incomingHazard",
  "existingHazard",
  "collisionPayload",
  "recommendedOperation"
]);

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function failure(code, path, message) {
  return {
    ok: false,
    collision: false,
    activeHazards: null,
    consequence: null,
    errors: [issue(code, path, message)],
    warnings: []
  };
}

function success(collision, activeHazards, consequence = null, collisionOutcome = null) {
  return {
    ok: true,
    collision,
    activeHazards,
    consequence,
    collisionOutcome,
    errors: [],
    warnings: []
  };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clonePlainData(value) {
  if (Array.isArray(value)) return value.map((entry) => clonePlainData(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clonePlainData(entry)]));
  }
  return value;
}

function samePlainData(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (Object.hasOwn(left, index) !== Object.hasOwn(right, index)) return false;
      if (!Object.hasOwn(left, index) || !samePlainData(left[index], right[index])) return false;
    }
    return Object.keys(left).sort().join("\u0000") === Object.keys(right).sort().join("\u0000");
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) return false;
    if (!samePlainData(left[leftKeys[index]], right[rightKeys[index]])) return false;
  }
  return true;
}

function exactKeys(value, expected) {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function validConsequence(value) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function validResultShape(collisionAnalysis) {
  return isPlainObject(collisionAnalysis)
    && exactKeys(collisionAnalysis, RESULT_FIELDS)
    && collisionAnalysis.structurallyValid === true
    && collisionAnalysis.readyForHazardCollisionPlanning === true
    && Array.isArray(collisionAnalysis.errors)
    && collisionAnalysis.errors.length === 0
    && Array.isArray(collisionAnalysis.warnings)
    && isPlainObject(collisionAnalysis.plan);
}

function validPlanShape(plan) {
  return exactKeys(plan, PLAN_FIELDS)
    && typeof plan.encounterId === "string"
    && plan.encounterId.trim().length > 0
    && Number.isSafeInteger(plan.expectedRevision)
    && plan.expectedRevision >= 0
    && typeof plan.incomingHazardId === "string"
    && plan.incomingHazardId.trim().length > 0
    && isPlainObject(plan.incomingHazard)
    && (plan.existingHazard === null || isPlainObject(plan.existingHazard));
}

function validNoCollisionPlan(plan, incomingHazard) {
  return plan.kind === "no-collision"
    && plan.incomingHazardId === incomingHazard.hazardId
    && plan.existingHazardId === null
    && plan.existingHazardIndex === null
    && plan.existingHazard === null
    && plan.pressureSystemId === incomingHazard.pressureSystemId
    && plan.collisionPolicy === null
    && plan.collisionPayload === null
    && plan.recommendedOperation === "persist-incoming"
    && samePlainData(plan.incomingHazard, incomingHazard);
}

function validTriggerPlan(plan, state, incomingHazard) {
  if (
    plan.kind !== "collision"
    || plan.incomingHazardId !== incomingHazard.hazardId
    || plan.existingHazardId !== state.activeHazards[plan.existingHazardIndex]?.hazardId
    || plan.existingHazardIndex < 0
    || plan.existingHazardIndex >= state.activeHazards.length
    || plan.pressureSystemId !== incomingHazard.pressureSystemId
    || plan.collisionPolicy !== VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE
    || plan.recommendedOperation !== VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE
    || incomingHazard.collisionPolicy !== VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE
    || !samePlainData(plan.incomingHazard, incomingHazard)
    || !samePlainData(plan.collisionPayload, incomingHazard.metadata.collision)
    || !samePlainData(plan.existingHazard, state.activeHazards[plan.existingHazardIndex])
  ) return false;

  const live = state.activeHazards[plan.existingHazardIndex];
  return Number.isSafeInteger(plan.existingHazardIndex)
    && live.category === VOYAGE_HAZARD_CATEGORIES.SYSTEM
    && live.status === VOYAGE_HAZARD_STATUSES.ACTIVE
    && live.encounterId === state.encounterId
    && live.pressureSystemId === plan.pressureSystemId;
}

/**
 * Validate and apply only the Hazard-side portion of a repeated Pressure
 * Breach collision. Pressure reset, Void Scar proposal, revision, and the
 * protected Pressure Breach event remain owned by the enclosing transaction.
 */
export function applyVoyageHazardTriggerExistingConsequence(state, incomingHazard, collisionAnalysis) {
  try {
    if (!isPlainObject(state) || !Array.isArray(state.activeHazards)) {
      return failure(
        "pressure-breach-application-state-invalid",
        "encounterState",
        "Repeated Pressure Breach application requires a valid encounter state."
      );
    }
    if (!isPlainObject(incomingHazard)) {
      return failure(
        "pressure-breach-application-hazard-invalid",
        "incomingHazard",
        "Repeated Pressure Breach application requires a plain incoming Hazard."
      );
    }
    if (!validResultShape(collisionAnalysis) || !validPlanShape(collisionAnalysis.plan)) {
      return failure(
        "pressure-breach-application-collision-invalid",
        "collisionPlan",
        "Repeated Pressure Breach application requires an exact collision analysis result."
      );
    }

    const plan = collisionAnalysis.plan;
    if (plan.encounterId !== state.encounterId) {
      return failure(
        "pressure-breach-application-encounter-mismatch",
        "collisionPlan.encounterId",
        "Collision plan and encounter state encounterId values must match."
      );
    }
    if (plan.expectedRevision !== state.revision) {
      return failure(
        "pressure-breach-application-revision-mismatch",
        "collisionPlan.expectedRevision",
        "Collision plan and encounter state revisions must match."
      );
    }

    if (plan.kind === "no-collision") {
      if (collisionAnalysis.collision !== false || !validNoCollisionPlan(plan, incomingHazard)) {
        return failure(
          "pressure-breach-application-collision-invalid",
          "collisionPlan",
          "No-collision analysis does not match the incoming Hazard."
        );
      }
      return success(false, clonePlainData(state.activeHazards));
    }

    if (collisionAnalysis.collision !== true || !Number.isSafeInteger(plan.existingHazardIndex)) {
      return failure(
        "pressure-breach-application-collision-invalid",
        "collisionPlan",
        "Collision analysis must identify one existing Hazard index."
      );
    }
    if (plan.existingHazardIndex < 0 || plan.existingHazardIndex >= state.activeHazards.length) {
      return failure(
        "pressure-breach-application-index-invalid",
        "collisionPlan.existingHazardIndex",
        "Collision plan Hazard index is not present in activeHazards."
      );
    }
    if (plan.collisionPolicy !== VOYAGE_HAZARD_COLLISION_POLICIES.TRIGGER_EXISTING_CONSEQUENCE) {
      return failure(
        "pressure-breach-application-collision-policy-invalid",
        "collisionPlan.collisionPolicy",
        "Repeated Pressure Breach application requires trigger-existing-consequence."
      );
    }
    if (state.activeHazards[plan.existingHazardIndex].hazardId !== plan.existingHazardId) {
      return failure(
        "pressure-breach-application-live-hazard-mismatch",
        `state.activeHazards[${plan.existingHazardIndex}]`,
        "The collision plan Hazard is no longer at its planned index."
      );
    }
    if (!samePlainData(state.activeHazards[plan.existingHazardIndex], plan.existingHazard)) {
      return failure(
        "pressure-breach-application-snapshot-mismatch",
        `state.activeHazards[${plan.existingHazardIndex}]`,
        "The live Hazard no longer matches the collision plan snapshot."
      );
    }
    if (!validTriggerPlan(plan, state, incomingHazard)) {
      return failure(
        "pressure-breach-application-collision-invalid",
        "collisionPlan",
        "Collision plan identity, slot, policy, or snapshot fields are invalid."
      );
    }

    const existingHazard = state.activeHazards[plan.existingHazardIndex];
    const consequence = existingHazard.metadata?.collision?.consequence;
    if (!validConsequence(consequence)) {
      return failure(
        "pressure-breach-application-consequence-invalid",
        `state.activeHazards[${plan.existingHazardIndex}].metadata.collision.consequence`,
        "The existing Hazard requires one exact authored collision consequence descriptor."
      );
    }

    const activeHazards = clonePlainData(state.activeHazards);
    activeHazards[plan.existingHazardIndex].metadata.collision.consequence = clonePlainData(consequence);
    return success(
      true,
      activeHazards,
      clonePlainData(consequence),
      {
        kind: "hazard-consequence-triggered",
        hazardId: plan.existingHazardId,
        incomingHazardId: incomingHazard.hazardId,
        pressureSystemId: incomingHazard.pressureSystemId,
        collisionPolicy: incomingHazard.collisionPolicy,
        consequence: clonePlainData(consequence)
      }
    );
  } catch {
    return failure(
      "pressure-breach-application-collision-invalid",
      "collisionPlan",
      "Repeated Pressure Breach collision application could not be completed safely."
    );
  }
}
