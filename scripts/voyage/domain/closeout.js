import {
  VOYAGE_ACTION_OUTCOME_BRANCHES,
  VOYAGE_EFFECT_INTENT_TIMING,
  VOYAGE_EVENT_RUNNER_STATION_IDS,
  VOYAGE_HAZARD_STATUSES,
  VOYAGE_HAZARD_VISIBILITY,
  VOYAGE_MOMENTUM_MAX,
  VOYAGE_PRESSURE_MAX_CAPACITY,
  VOYAGE_PRESSURE_SYSTEM_IDS,
  VOYAGE_ROUND_RESULTS,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import {
  captureVoyageHazardRecord,
  VOYAGE_HAZARD_RECORD_FIELDS
} from "./hazard-schema.js";
import { analyzeVoyagePressureBreachCloseoutTransaction } from "./pressure-breach.js";
import { analyzeVoyageEncounterOverallResult } from "./event-result.js";
import { analyzeVoyageEncounterRewardSteps } from "./rewards.js";
import { analyzeVoyageEncounterRewardAllocation } from "./reward-allocation.js";
import { analyzeVoyageEncounterNegativeSteps } from "./misfortunes.js";
import {
  analyzeVoyageCatastrophicBreakdown,
  validateVoyageCatastrophicBreakdownDefinition
} from "./catastrophic-breakdown.js";
import { analyzeVoyageEmergencyResponseResult } from "./emergency-response.js";
import { captureVoyageShipState } from "./ship-state.js";
import { analyzeVoyageVoidScarCapacity } from "./void-scar-capacity.js";
import { VOYAGE_PRESSURE_BREACH_VOID_SCAR_DESCRIPTORS } from "./void-scar-creation.js";
import {
  captureVoyageDurableVoidScarRecord,
  VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID
} from "./void-scar-schema.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SNAPSHOT_FIELDS = Object.freeze([
  "schemaVersion",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "encounterRevision",
  "shipRevision",
  "lifecycleState",
  "stageId",
  "roundNumber",
  "phase",
  "completedRoundHistory",
  "momentum",
  "focusPools",
  "pressureSystems",
  "activeHazards",
  "pendingStationBenefitIds",
  "unconsumedRiskBidBenefitIds",
  "temporaryFocusPenaltyIds",
  "roundOrderRestrictions",
  "hazardSuppressions",
  "temporaryConsequenceIds"
]);
const HISTORY_FIELDS = Object.freeze([
  "schemaVersion",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "roundCount",
  "rounds"
]);
const HISTORY_ROUND_FIELDS = Object.freeze(["roundId", "roundNumber", "roundResult"]);
const FOCUS_POOL_FIELDS = Object.freeze(["operatorId", "stationId", "current", "capacity"]);
const PRESSURE_SYSTEM_FIELDS = Object.freeze(["pressureSystemId", "value", "capacity"]);
const ROUND_ORDER_RESTRICTION_FIELDS = Object.freeze(["restrictionId", "persistence"]);
const HAZARD_SUPPRESSION_FIELDS = Object.freeze(["suppressionId", "hazardId"]);
const CONSEQUENCE_FIELDS = Object.freeze([
  "consequenceId",
  "kind",
  "pressureSystemId",
  "delta",
  "persistentProposal"
]);
const PERSISTENT_PROPOSAL_FIELDS = Object.freeze([
  "proposalId",
  "kind",
  "title",
  "description",
  "targetKind",
  "targetId"
]);
const CLOSEOUT_BREACH_REQUEST_FIELDS = Object.freeze([
  "kind",
  "expectedEncounterRevision",
  "closeoutContext",
  "pressureSystems",
  "activeHazards",
  "pressureEffect"
]);
const CLOSEOUT_CONTEXT_FIELDS = Object.freeze([
  "eventId",
  "sessionId",
  "stageId",
  "roundNumber",
  "phase"
]);
const PRESSURE_EFFECT_FIELDS = Object.freeze([
  "pressureEffectId",
  "encounterId",
  "stageId",
  "roundNumber",
  "sequence",
  "stationId",
  "actionId",
  "pressureSystemId",
  "delta",
  "timing",
  "sourceKind",
  "sourceIntentId",
  "activationSource",
  "branch",
  "visibility"
]);
const HAZARD_CLOSEOUT_REQUEST_FIELDS = Object.freeze([
  "kind",
  "sessionId",
  "expectedEncounterRevision",
  "closeoutSnapshot"
]);
const CLOSEOUT_PREVIEW_REQUEST_FIELDS = Object.freeze([
  "kind",
  "sessionId",
  "expectedEncounterRevision",
  "expectedShipRevision",
  "closeoutSnapshot",
  "shipState",
  "eventDefinition",
  "rewardAllocation",
  "negativeSelection",
  "closeoutScarDefinitions",
  "breakdownDefinitions",
  "emergencyResponseEvidence"
]);
const CLOSEOUT_SCAR_DEFINITION_FIELDS = Object.freeze([
  "schemaVersion",
  "voidScarDefinitionId",
  "pressureSystemId",
  "name",
  "description",
  "operationalEffects",
  "baseRepairCost",
  "baseRepairTime",
  "repairDcSource",
  "eligibleRepairChecks",
  "requiredFacilities",
  "compatibleFieldRepairTags"
]);
const EMERGENCY_RESPONSE_EVIDENCE_FIELDS = Object.freeze([
  "breakdownDefinition",
  "breakdownPlan",
  "completedRoundHistory",
  "suppliedOutcome"
]);
const PREVIEW_FIELDS = Object.freeze([
  "schemaVersion",
  "closeoutId",
  "eventId",
  "sessionId",
  "definitionSnapshotId",
  "shipId",
  "expectedEncounterRevision",
  "expectedShipRevision",
  "overallResult",
  "successfulRoundCount",
  "failedRoundCount",
  "resultPackage",
  "hazardCloseoutResults",
  "pressureBreachResults",
  "ordinaryScarResults",
  "breakdownResults",
  "emergencyResponseOutcomes",
  "persistentProposals",
  "temporaryResetPlan",
  "blockedByEmergencyResponse",
  "requiresGmApproval"
]);
const TEMPORARY_RESET_FIELDS = Object.freeze([
  "momentum",
  "focusPools",
  "pressureSystems",
  "pendingStationBenefitIds",
  "unconsumedRiskBidBenefitIds",
  "temporaryFocusPenaltyIds",
  "roundOrderRestrictions",
  "hazardSuppressions",
  "temporaryConsequenceIds",
  "activeHazards"
]);
const REWARD_PROPOSAL_KINDS = new Set(["item", "benefit", "void-fortune", "field-repair-resource"]);
const PROHIBITED_AUTHORITY_KEYS = Object.freeze([
  "overallResult", "rewardAnalysis", "negativeAnalysis", "resultPackage",
  "hazardPlan", "pressurePlan", "breachPlan", "capacityAnalysis",
  "capacityExhaustion", "breakdownPlan", "outcomeProposal",
  "persistentProposals", "temporaryResetPlan", "preview", "previewId",
  "approved", "gmApproved", "approvalToken", "applicationId",
  "applicationPlan", "nextEncounterState", "nextCloseoutSnapshot",
  "nextShipState", "events",
  "patch", "ledgerEntry", "idempotencyStatus", "receipt",
  "sessionCommitReceipt", "requestId", "timestamp"
]);
const ROUND_RESULTS = new Set(Object.values(VOYAGE_ROUND_RESULTS));
const LIFECYCLE_STATES = new Set(["active", "paused"]);
const STATION_IDS = new Set(VOYAGE_EVENT_RUNNER_STATION_IDS);
const PRESSURE_SYSTEM_IDS = new Set(VOYAGE_PRESSURE_SYSTEM_IDS);
const PERSISTENT_PROPOSAL_KINDS = new Set([
  "ship-damage",
  "resource-loss",
  "crew-consequence",
  "operational-restriction",
  "authored"
]);
const PERSISTENT_TARGET_KINDS = new Set(["ship", "system", "crew", "resource"]);

function diagnostic(code, path, message, severity = "error") {
  return { code, path, message, severity };
}

function m10Diagnostic(code, path) {
  const messages = {
    "m10-hostile-data-capture-failed": "M10 data could not be captured safely.",
    "m10-caller-authority-rejected": "Caller supplied calculated, application, persistence, or runtime authority.",
    "m10-invalid-mode": "The requested M10 API mode is invalid.",
    "m10-invalid-request-shape": "Request shape, order, or root values are invalid.",
    "m10-invalid-closeout-snapshot": "Closeout snapshot is invalid.",
    "m10-session-identity-mismatch": "Session identity is not bound.",
    "m10-encounter-revision-mismatch": "Encounter revision is stale.",
    "m10-invalid-hazard-closeout-consequence": "Closeout consequence is malformed.",
    "m10-unsupported-hazard-closeout-consequence": "M6 descriptive consequence is outside the closed M10 vocabulary.",
    "m10-duplicate-closeout-consequence-id": "Consequence identity is duplicated.",
    "m10-pressure-closeout-failed": "Pressure/Breach simulation failed.",
    "m10-event-identity-mismatch": "Event identity is not bound.",
    "m10-definition-snapshot-mismatch": "Definition snapshot is not bound.",
    "m10-ship-identity-mismatch": "Ship identity is not bound.",
    "m10-ship-revision-mismatch": "Ship revision is stale.",
    "m10-result-regeneration-failed": "Applicable M8 analysis failed.",
    "m10-invalid-closeout-scar-definition": "Closeout Scar Definition is invalid.",
    "m10-unresolved-closeout-scar-definition": "M8 Scar definition does not resolve exactly once.",
    "m10-duplicate-scar-identity": "Generated Scar already exists or repeats.",
    "m10-missing-breakdown-definition": "Exhausted system has no exact authored M9 definition.",
    "m10-ambiguous-breakdown-definition": "More than one M9 definition matches the exhausted system.",
    "m10-breakdown-regeneration-failed": "M9 Breakdown analysis failed.",
    "m10-emergency-response-required": "Breakdown requires completed Emergency Response before application.",
    "m10-emergency-response-mismatch": "Supplied M9 outcome does not match regeneration."
  };
  return diagnostic(code, path, messages[code] ?? "M10 data is invalid.");
}

function deduplicate(diagnostics) {
  const seen = new Set();
  return diagnostics.filter((entry) => {
    const key = JSON.stringify([entry.code, entry.path, entry.message, entry.severity]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function capturePlainData(value, ancestors = new Set()) {
  try {
    if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
    if (typeof value === "number") return Number.isSafeInteger(value) ? { ok: true, value } : { ok: false, value: null };
    if (typeof value !== "object" || ancestors.has(value)) return { ok: false, value: null };

    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      return { ok: false, value: null };
    }
    const keys = Reflect.ownKeys(value);
    ancestors.add(value);
    try {
      if (array) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
        const length = lengthDescriptor && Object.hasOwn(lengthDescriptor, "value") ? lengthDescriptor.value : null;
        if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) return { ok: false, value: null };
        const clone = new Array(length);
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
          const nested = capturePlainData(descriptor.value, ancestors);
          if (!nested.ok) return nested;
          clone[index] = nested.value;
        }
        for (const key of keys) {
          if (key === "length") continue;
          if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) return { ok: false, value: null };
        }
        return { ok: true, value: clone };
      }

      const clone = {};
      for (const key of keys) {
        if (typeof key !== "string" || UNSAFE_KEYS.has(key)) return { ok: false, value: null };
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
        const nested = capturePlainData(descriptor.value, ancestors);
        if (!nested.ok) return nested;
        clone[key] = nested.value;
      }
      return { ok: true, value: clone };
    } finally {
      ancestors.delete(value);
    }
  } catch {
    return { ok: false, value: null };
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, fields) {
  return isPlainObject(value)
    && Object.keys(value).length === fields.length
    && Object.keys(value).every((key, index) => key === fields[index]);
}

function nonBlank(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function nonnegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function positiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function snapshotError(errors, path) {
  errors.push(m10Diagnostic("m10-invalid-closeout-snapshot", path));
}

function validateCompletedRoundHistory(history, snapshot, errors) {
  if (!exactKeys(history, HISTORY_FIELDS)) {
    snapshotError(errors, "closeoutSnapshot.completedRoundHistory");
    return;
  }
  if (
    history.schemaVersion !== 1
    || history.eventId !== snapshot.eventId
    || history.sessionId !== snapshot.sessionId
    || history.definitionSnapshotId !== snapshot.definitionSnapshotId
    || history.roundCount !== snapshot.roundNumber
    || !Array.isArray(history.rounds)
    || history.rounds.length !== snapshot.roundNumber
  ) {
    snapshotError(errors, "closeoutSnapshot.completedRoundHistory");
    return;
  }
  const roundIds = new Set();
  for (let index = 0; index < history.rounds.length; index += 1) {
    const round = history.rounds[index];
    if (
      !exactKeys(round, HISTORY_ROUND_FIELDS)
      || !nonBlank(round.roundId)
      || roundIds.has(round.roundId)
      || round.roundNumber !== index + 1
      || !ROUND_RESULTS.has(round.roundResult)
    ) {
      snapshotError(errors, `closeoutSnapshot.completedRoundHistory.rounds[${index}]`);
      return;
    }
    roundIds.add(round.roundId);
  }
}

function validateFocusPools(pools, errors) {
  if (!Array.isArray(pools)) {
    snapshotError(errors, "closeoutSnapshot.focusPools");
    return;
  }
  const operatorIds = new Set();
  const stationIds = new Set();
  for (let index = 0; index < pools.length; index += 1) {
    const pool = pools[index];
    if (
      !exactKeys(pool, FOCUS_POOL_FIELDS)
      || !nonBlank(pool.operatorId)
      || !STATION_IDS.has(pool.stationId)
      || operatorIds.has(pool.operatorId)
      || stationIds.has(pool.stationId)
      || !nonnegativeSafeInteger(pool.current)
      || !nonnegativeSafeInteger(pool.capacity)
      || pool.current > pool.capacity
    ) {
      snapshotError(errors, `closeoutSnapshot.focusPools[${index}]`);
      return;
    }
    operatorIds.add(pool.operatorId);
    stationIds.add(pool.stationId);
  }
}

function validatePressureSystems(pressureSystems, errors, path = "closeoutSnapshot.pressureSystems") {
  if (!Array.isArray(pressureSystems) || pressureSystems.length !== VOYAGE_PRESSURE_SYSTEM_IDS.length) {
    snapshotError(errors, path);
    return false;
  }
  for (let index = 0; index < pressureSystems.length; index += 1) {
    const system = pressureSystems[index];
    if (
      !exactKeys(system, PRESSURE_SYSTEM_FIELDS)
      || system.pressureSystemId !== VOYAGE_PRESSURE_SYSTEM_IDS[index]
      || !nonnegativeSafeInteger(system.value)
      || !nonnegativeSafeInteger(system.capacity)
      || system.capacity > VOYAGE_PRESSURE_MAX_CAPACITY
      || system.value > system.capacity
    ) {
      snapshotError(errors, `${path}[${index}]`);
      return false;
    }
  }
  return true;
}

function validateActiveHazards(hazards, eventId, errors, path = "closeoutSnapshot.activeHazards") {
  if (!Array.isArray(hazards)) {
    snapshotError(errors, path);
    return false;
  }
  const hazardIds = new Set();
  const occupiedSystems = new Set();
  for (let index = 0; index < hazards.length; index += 1) {
    const hazard = hazards[index];
    if (!exactKeys(hazard, VOYAGE_HAZARD_RECORD_FIELDS)) {
      snapshotError(errors, `${path}[${index}]`);
      return false;
    }
    const capture = captureVoyageHazardRecord(hazard, { mode: "active", expectedEncounterId: eventId });
    if (!capture.ok) {
      errors.push(...capture.errors);
      return false;
    }
    if (
      capture.record.status !== VOYAGE_HAZARD_STATUSES.ACTIVE
      || hazardIds.has(capture.record.hazardId)
      || (capture.record.category === "system" && occupiedSystems.has(capture.record.pressureSystemId))
    ) {
      snapshotError(errors, `${path}[${index}]`);
      return false;
    }
    hazardIds.add(capture.record.hazardId);
    if (capture.record.category === "system") occupiedSystems.add(capture.record.pressureSystemId);
  }
  return true;
}

function validateIdCollection(value, path, errors) {
  if (!Array.isArray(value)) {
    snapshotError(errors, path);
    return false;
  }
  const ids = new Set();
  for (let index = 0; index < value.length; index += 1) {
    if (!nonBlank(value[index]) || ids.has(value[index])) {
      snapshotError(errors, `${path}[${index}]`);
      return false;
    }
    ids.add(value[index]);
  }
  return true;
}

function validateTemporaryCollections(snapshot, errors) {
  for (const field of [
    "pendingStationBenefitIds",
    "unconsumedRiskBidBenefitIds",
    "temporaryFocusPenaltyIds",
    "temporaryConsequenceIds"
  ]) validateIdCollection(snapshot[field], `closeoutSnapshot.${field}`, errors);

  if (!Array.isArray(snapshot.roundOrderRestrictions)) {
    snapshotError(errors, "closeoutSnapshot.roundOrderRestrictions");
  } else {
    const ids = new Set();
    for (let index = 0; index < snapshot.roundOrderRestrictions.length; index += 1) {
      const restriction = snapshot.roundOrderRestrictions[index];
      if (
        !exactKeys(restriction, ROUND_ORDER_RESTRICTION_FIELDS)
        || !nonBlank(restriction.restrictionId)
        || ids.has(restriction.restrictionId)
        || (restriction.persistence !== "temporary" && restriction.persistence !== "persistent")
      ) {
        snapshotError(errors, `closeoutSnapshot.roundOrderRestrictions[${index}]`);
        break;
      }
      ids.add(restriction.restrictionId);
    }
  }

  if (!Array.isArray(snapshot.hazardSuppressions)) {
    snapshotError(errors, "closeoutSnapshot.hazardSuppressions");
    return;
  }
  if (!Array.isArray(snapshot.activeHazards)) {
    snapshotError(errors, "closeoutSnapshot.activeHazards");
    return;
  }
  const suppressionIds = new Set();
  const suppressedHazardIds = new Set();
  const activeHazardIds = new Set(snapshot.activeHazards.map((hazard) => hazard?.hazardId));
  for (let index = 0; index < snapshot.hazardSuppressions.length; index += 1) {
    const suppression = snapshot.hazardSuppressions[index];
    if (
      !exactKeys(suppression, HAZARD_SUPPRESSION_FIELDS)
      || !nonBlank(suppression.suppressionId)
      || !nonBlank(suppression.hazardId)
      || suppressionIds.has(suppression.suppressionId)
      || suppressedHazardIds.has(suppression.hazardId)
      || !activeHazardIds.has(suppression.hazardId)
    ) {
      snapshotError(errors, `closeoutSnapshot.hazardSuppressions[${index}]`);
      return;
    }
    suppressionIds.add(suppression.suppressionId);
    suppressedHazardIds.add(suppression.hazardId);
  }
}

function validateCapturedCloseoutSnapshot(snapshot) {
  const errors = [];
  if (!exactKeys(snapshot, SNAPSHOT_FIELDS)) {
    snapshotError(errors, "closeoutSnapshot");
    return { valid: false, errors: deduplicate(errors), warnings: [] };
  }
  if (
    snapshot.schemaVersion !== 1
    || !nonBlank(snapshot.eventId)
    || !nonBlank(snapshot.sessionId)
    || !nonBlank(snapshot.definitionSnapshotId)
    || !nonBlank(snapshot.shipId)
    || !nonnegativeSafeInteger(snapshot.encounterRevision)
    || !nonnegativeSafeInteger(snapshot.shipRevision)
    || !LIFECYCLE_STATES.has(snapshot.lifecycleState)
    || !nonBlank(snapshot.stageId)
    || !positiveSafeInteger(snapshot.roundNumber)
    || snapshot.phase !== VOYAGE_ROUND_PHASES.CLEANUP_ADVANCE
    || !nonnegativeSafeInteger(snapshot.momentum)
    || snapshot.momentum > VOYAGE_MOMENTUM_MAX
  ) snapshotError(errors, "closeoutSnapshot");

  validateCompletedRoundHistory(snapshot.completedRoundHistory, snapshot, errors);
  validateFocusPools(snapshot.focusPools, errors);
  validatePressureSystems(snapshot.pressureSystems, errors);
  validateActiveHazards(snapshot.activeHazards, snapshot.eventId, errors);
  validateTemporaryCollections(snapshot, errors);
  return { valid: errors.length === 0, errors: deduplicate(errors), warnings: [] };
}

function snapshotCapture(closeoutSnapshot) {
  const captured = capturePlainData(closeoutSnapshot);
  if (!captured.ok) {
    return { ok: false, closeoutSnapshot: null, errors: [m10Diagnostic("m10-hostile-data-capture-failed", "$")], warnings: [] };
  }
  const validation = validateCapturedCloseoutSnapshot(captured.value);
  return validation.valid
    ? { ok: true, closeoutSnapshot: captured.value, errors: [], warnings: [] }
    : { ok: false, closeoutSnapshot: null, errors: validation.errors, warnings: [] };
}

function validateCloseoutConsequence(hazard, index, consequenceIds, proposalIds, errors) {
  const consequence = hazard.ignoredConsequence;
  const path = `closeoutSnapshot.activeHazards[${index}].ignoredConsequence`;
  if (!isPlainObject(consequence)) {
    errors.push(m10Diagnostic("m10-invalid-hazard-closeout-consequence", path));
    return null;
  }
  if (!Object.hasOwn(consequence, "kind") || !Object.hasOwn(consequence, "consequenceId")) {
    errors.push(m10Diagnostic("m10-unsupported-hazard-closeout-consequence", path));
    return null;
  }
  if (!exactKeys(consequence, CONSEQUENCE_FIELDS)) {
    errors.push(m10Diagnostic(
      consequence.kind === "pressure-change" || consequence.kind === "persistent-consequence"
        ? "m10-invalid-hazard-closeout-consequence"
        : "m10-unsupported-hazard-closeout-consequence",
      path
    ));
    return null;
  }
  if (!nonBlank(consequence.consequenceId)) {
    errors.push(m10Diagnostic("m10-invalid-hazard-closeout-consequence", `${path}.consequenceId`));
    return null;
  }
  if (consequenceIds.has(consequence.consequenceId)) {
    errors.push(m10Diagnostic("m10-duplicate-closeout-consequence-id", `${path}.consequenceId`));
    return null;
  }
  consequenceIds.add(consequence.consequenceId);

  if (consequence.kind === "pressure-change") {
    if (
      !PRESSURE_SYSTEM_IDS.has(consequence.pressureSystemId)
      || !positiveSafeInteger(consequence.delta)
      || consequence.persistentProposal !== null
      || (hazard.failurePressureSystemId !== null && hazard.failurePressureSystemId !== consequence.pressureSystemId)
    ) {
      errors.push(m10Diagnostic("m10-invalid-hazard-closeout-consequence", path));
      return null;
    }
    return consequence;
  }

  if (consequence.kind === "persistent-consequence") {
    const proposal = consequence.persistentProposal;
    if (
      consequence.pressureSystemId !== null
      || consequence.delta !== null
      || !exactKeys(proposal, PERSISTENT_PROPOSAL_FIELDS)
      || !nonBlank(proposal.proposalId)
      || !PERSISTENT_PROPOSAL_KINDS.has(proposal.kind)
      || !nonBlank(proposal.title)
      || !nonBlank(proposal.description)
      || !PERSISTENT_TARGET_KINDS.has(proposal.targetKind)
      || !nonBlank(proposal.targetId)
    ) {
      errors.push(m10Diagnostic("m10-invalid-hazard-closeout-consequence", path));
      return null;
    }
    if (proposalIds.has(proposal.proposalId)) {
      errors.push(m10Diagnostic("m10-duplicate-closeout-consequence-id", `${path}.persistentProposal.proposalId`));
      return null;
    }
    proposalIds.add(proposal.proposalId);
    return consequence;
  }

  errors.push(m10Diagnostic("m10-unsupported-hazard-closeout-consequence", `${path}.kind`));
  return null;
}

function closeoutPressureEffect(snapshot, hazard, consequence, sequence) {
  const pressureSystemId = consequence.pressureSystemId;
  return {
    pressureEffectId: `arcflight-pressure-effect:${JSON.stringify([
      "hazard-closeout",
      snapshot.eventId,
      snapshot.sessionId,
      snapshot.stageId,
      snapshot.roundNumber,
      hazard.hazardId,
      consequence.consequenceId,
      sequence,
      pressureSystemId
    ])}`,
    encounterId: snapshot.eventId,
    stageId: snapshot.stageId,
    roundNumber: snapshot.roundNumber,
    sequence,
    stationId: null,
    actionId: null,
    pressureSystemId,
    delta: consequence.delta,
    timing: VOYAGE_EFFECT_INTENT_TIMING.GM_CONFIRMED,
    sourceKind: "hazard-closeout",
    sourceIntentId: consequence.consequenceId,
    activationSource: "event-closeout",
    branch: VOYAGE_ACTION_OUTCOME_BRANCHES.NO_ROLL,
    visibility: hazard.visibility
  };
}

function breachFailure(errors) {
  return {
    ok: false,
    breachRequired: false,
    previousEncounterRevision: null,
    encounterRevision: null,
    nextPressureSystems: [],
    nextActiveHazards: [],
    breach: null,
    hazard: null,
    ordinaryScarProposal: null,
    pressureReset: null,
    event: null,
    errors: deduplicate(errors),
    warnings: []
  };
}

function validateCloseoutPressureBreachRequest(value) {
  if (!exactKeys(value, CLOSEOUT_BREACH_REQUEST_FIELDS) || value.kind !== "m10-closeout-pressure-breach") {
    return [m10Diagnostic("m10-pressure-closeout-failed", "request")];
  }
  if (
    !nonnegativeSafeInteger(value.expectedEncounterRevision)
    || !exactKeys(value.closeoutContext, CLOSEOUT_CONTEXT_FIELDS)
    || !nonBlank(value.closeoutContext.eventId)
    || !nonBlank(value.closeoutContext.sessionId)
    || !nonBlank(value.closeoutContext.stageId)
    || !positiveSafeInteger(value.closeoutContext.roundNumber)
    || value.closeoutContext.phase !== VOYAGE_ROUND_PHASES.CLEANUP_ADVANCE
    || !exactKeys(value.pressureEffect, PRESSURE_EFFECT_FIELDS)
  ) return [m10Diagnostic("m10-pressure-closeout-failed", "request")];

  const errors = [];
  validatePressureSystems(value.pressureSystems, errors, "request.pressureSystems");
  validateActiveHazards(value.activeHazards, value.closeoutContext.eventId, errors, "request.activeHazards");
  const effect = value.pressureEffect;
  if (
    !nonBlank(effect.pressureEffectId)
    || effect.encounterId !== value.closeoutContext.eventId
    || effect.stageId !== value.closeoutContext.stageId
    || effect.roundNumber !== value.closeoutContext.roundNumber
    || !positiveSafeInteger(effect.sequence)
    || effect.stationId !== null
    || effect.actionId !== null
    || !PRESSURE_SYSTEM_IDS.has(effect.pressureSystemId)
    || !positiveSafeInteger(effect.delta)
    || effect.timing !== VOYAGE_EFFECT_INTENT_TIMING.GM_CONFIRMED
    || effect.sourceKind !== "hazard-closeout"
    || !nonBlank(effect.sourceIntentId)
    || effect.activationSource !== "event-closeout"
    || effect.branch !== VOYAGE_ACTION_OUTCOME_BRANCHES.NO_ROLL
    || !Object.values(VOYAGE_HAZARD_VISIBILITY).includes(effect.visibility)
  ) errors.push(m10Diagnostic("m10-pressure-closeout-failed", "request.pressureEffect"));
  return errors.length === 0 ? [] : [m10Diagnostic("m10-pressure-closeout-failed", "request")];
}

function analyzeCapturedCloseoutPressureBreach(value, lifecycleState) {
  const requestErrors = validateCloseoutPressureBreachRequest(value);
  if (requestErrors.length > 0) return breachFailure(requestErrors);
  const m6Result = analyzeVoyagePressureBreachCloseoutTransaction({
    expectedEncounterRevision: value.expectedEncounterRevision,
    closeoutContext: value.closeoutContext,
    pressureSystems: value.pressureSystems,
    activeHazards: value.activeHazards,
    pressureEffect: value.pressureEffect,
    lifecycleState
  });
  if (!m6Result.ok) return breachFailure(m6Result.errors);
  return {
    ok: true,
    breachRequired: m6Result.breachRequired,
    previousEncounterRevision: m6Result.previousEncounterRevision,
    encounterRevision: m6Result.encounterRevision,
    nextPressureSystems: m6Result.nextPressureSystems,
    nextActiveHazards: m6Result.nextActiveHazards,
    breach: m6Result.breach,
    hazard: m6Result.hazard,
    ordinaryScarProposal: m6Result.ordinaryScarProposal,
    pressureReset: m6Result.pressureReset,
    event: m6Result.event,
    errors: [],
    warnings: []
  };
}

function analysisFailure(errors) {
  return {
    ok: false,
    readyForHazardCloseout: false,
    eventId: null,
    sessionId: null,
    definitionSnapshotId: null,
    shipId: null,
    expectedEncounterRevision: null,
    hazardCloseoutResults: [],
    pressureBreachResults: [],
    ordinaryScarProposals: [],
    postHazardPressureSystems: [],
    hazardRemovalPlan: [],
    errors: deduplicate(errors),
    warnings: []
  };
}

function analyzeCapturedHazardCloseout(request) {
  if (!isPlainObject(request)) {
    return analysisFailure([m10Diagnostic("m10-invalid-request-shape", "request")]);
  }
  const prohibited = PROHIBITED_AUTHORITY_KEYS.filter((key) => Object.hasOwn(request, key));
  if (prohibited.length > 0) {
    return analysisFailure(prohibited.map((key) => m10Diagnostic("m10-caller-authority-rejected", `request.${key}`)));
  }
  if (request.kind !== "m10-hazard-closeout") return analysisFailure([m10Diagnostic("m10-invalid-mode", "request.kind")]);
  if (
    !exactKeys(request, HAZARD_CLOSEOUT_REQUEST_FIELDS)
    || !nonBlank(request.sessionId)
    || !nonnegativeSafeInteger(request.expectedEncounterRevision)
  ) return analysisFailure([m10Diagnostic("m10-invalid-request-shape", "request")]);

  const snapshot = snapshotCapture(request.closeoutSnapshot);
  if (!snapshot.ok) return analysisFailure([m10Diagnostic("m10-invalid-closeout-snapshot", "closeoutSnapshot"), ...snapshot.errors]);
  if (request.sessionId !== snapshot.closeoutSnapshot.sessionId) {
    return analysisFailure([m10Diagnostic("m10-session-identity-mismatch", "closeoutSnapshot.sessionId")]);
  }
  if (request.expectedEncounterRevision !== snapshot.closeoutSnapshot.encounterRevision) {
    return analysisFailure([m10Diagnostic("m10-encounter-revision-mismatch", "expectedEncounterRevision")]);
  }

  const consequenceIds = new Set();
  const proposalIds = new Set();
  const consequenceErrors = [];
  const consequences = snapshot.closeoutSnapshot.activeHazards.map((hazard, index) => (
    validateCloseoutConsequence(hazard, index, consequenceIds, proposalIds, consequenceErrors)
  ));
  if (consequenceErrors.length > 0) return analysisFailure(consequenceErrors);

  let encounterRevision = request.expectedEncounterRevision;
  let pressureSystems = snapshot.closeoutSnapshot.pressureSystems;
  let activeHazards = snapshot.closeoutSnapshot.activeHazards;
  const hazardCloseoutResults = [];
  const pressureBreachResults = [];
  const ordinaryScarProposals = [];
  const hazardRemovalPlan = [];

  for (let index = 0; index < snapshot.closeoutSnapshot.activeHazards.length; index += 1) {
    const hazard = snapshot.closeoutSnapshot.activeHazards[index];
    const consequence = consequences[index];
    const liveIndex = activeHazards.findIndex((entry) => entry.hazardId === hazard.hazardId);
    if (liveIndex < 0) return analysisFailure([m10Diagnostic("m10-pressure-closeout-failed", "hazardCloseoutResults")]);
    const removal = { hazardId: hazard.hazardId, previousStatus: "active", disposition: "removed" };
    const nextHazardRevision = encounterRevision + 1;
    if (!Number.isSafeInteger(nextHazardRevision)) {
      return analysisFailure([m10Diagnostic("m10-pressure-closeout-failed", "hazardCloseoutResults")]);
    }
    activeHazards = activeHazards.filter((entry) => entry.hazardId !== hazard.hazardId);
    const pressureEffect = consequence.kind === "pressure-change"
      ? closeoutPressureEffect(snapshot.closeoutSnapshot, hazard, consequence, index + 1)
      : null;
    let pressureBreach = null;
    if (pressureEffect) {
      pressureBreach = analyzeCapturedCloseoutPressureBreach({
        kind: "m10-closeout-pressure-breach",
        expectedEncounterRevision: nextHazardRevision,
        closeoutContext: {
          eventId: snapshot.closeoutSnapshot.eventId,
          sessionId: snapshot.closeoutSnapshot.sessionId,
          stageId: snapshot.closeoutSnapshot.stageId,
          roundNumber: snapshot.closeoutSnapshot.roundNumber,
          phase: VOYAGE_ROUND_PHASES.CLEANUP_ADVANCE
        },
        pressureSystems,
        activeHazards,
        pressureEffect
      }, snapshot.closeoutSnapshot.lifecycleState);
      if (!pressureBreach.ok) {
        return analysisFailure([
          m10Diagnostic("m10-pressure-closeout-failed", "hazardCloseoutResults"),
          ...pressureBreach.errors
        ]);
      }
      pressureSystems = pressureBreach.nextPressureSystems;
      activeHazards = pressureBreach.nextActiveHazards;
      encounterRevision = pressureBreach.encounterRevision;
      const breachResult = {
        hazardId: hazard.hazardId,
        consequenceId: consequence.consequenceId,
        pressureEffectId: pressureEffect.pressureEffectId,
        breachRequired: pressureBreach.breachRequired,
        breach: pressureBreach.breach,
        hazard: pressureBreach.hazard,
        ordinaryScarProposal: pressureBreach.ordinaryScarProposal,
        pressureReset: pressureBreach.pressureReset
      };
      pressureBreachResults.push(breachResult);
      if (pressureBreach.ordinaryScarProposal !== null) ordinaryScarProposals.push(pressureBreach.ordinaryScarProposal);
    } else {
      encounterRevision = nextHazardRevision;
    }
    hazardCloseoutResults.push({
      hazardId: hazard.hazardId,
      consequenceId: consequence.consequenceId,
      consequenceKind: consequence.kind,
      consequence,
      pressureEffect,
      removal
    });
    hazardRemovalPlan.push(removal);
  }

  const result = {
    ok: true,
    readyForHazardCloseout: true,
    eventId: snapshot.closeoutSnapshot.eventId,
    sessionId: snapshot.closeoutSnapshot.sessionId,
    definitionSnapshotId: snapshot.closeoutSnapshot.definitionSnapshotId,
    shipId: snapshot.closeoutSnapshot.shipId,
    expectedEncounterRevision: request.expectedEncounterRevision,
    hazardCloseoutResults,
    pressureBreachResults,
    ordinaryScarProposals,
    postHazardPressureSystems: pressureSystems,
    hazardRemovalPlan,
    errors: [],
    warnings: []
  };
  const isolated = capturePlainData(result);
  return isolated.ok ? isolated.value : analysisFailure([m10Diagnostic("m10-pressure-closeout-failed", "hazardCloseoutResults")]);
}

function previewFailure(errors) {
  return {
    ok: false,
    readyForGmReview: false,
    closeoutId: null,
    preview: null,
    errors: deduplicate(errors),
    warnings: []
  };
}

function previewWarning(code, path) {
  const warning = m10Diagnostic(code, path);
  warning.severity = "warning";
  return warning;
}

function structurallyEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function closeoutIdentity(snapshot, shipState) {
  return `arcflight-closeout:${JSON.stringify([
    snapshot.eventId,
    snapshot.sessionId,
    snapshot.definitionSnapshotId,
    shipState.shipId
  ])}`;
}

function proposalIdentity(closeoutId, kind, sourceKind, sourceId, targetKind, targetId) {
  return `arcflight-closeout-proposal:${JSON.stringify([
    closeoutId,
    kind,
    sourceKind,
    sourceId,
    targetKind,
    targetId
  ])}`;
}

function cloneCaptured(value) {
  const captured = capturePlainData(value);
  return captured.ok ? captured.value : null;
}

function descriptorValueValid(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0;
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function descriptorArrayValid(value) {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry === "string") {
      if (!nonBlank(entry)) return false;
    } else if (!descriptorValueValid(entry)) return false;
  }
  return true;
}

function validateCloseoutScarDefinition(value, path) {
  if (!exactKeys(value, CLOSEOUT_SCAR_DEFINITION_FIELDS)
    || value.schemaVersion !== 1
    || !nonBlank(value.voidScarDefinitionId)
    || !PRESSURE_SYSTEM_IDS.has(value.pressureSystemId)
    || !nonBlank(value.name)
    || !nonBlank(value.description)
    || !descriptorArrayValid(value.operationalEffects)
    || !descriptorValueValid(value.baseRepairCost)
    || !descriptorValueValid(value.baseRepairTime)
    || !(nonBlank(value.repairDcSource) || descriptorValueValid(value.repairDcSource))
    || !descriptorArrayValid(value.eligibleRepairChecks)
    || !descriptorArrayValid(value.requiredFacilities)
    || !descriptorArrayValid(value.compatibleFieldRepairTags)) {
    return [m10Diagnostic("m10-invalid-closeout-scar-definition", path)];
  }
  return [];
}

function validateBreakdownCatalog(definitions) {
  if (!Array.isArray(definitions)) return [m10Diagnostic("m10-breakdown-regeneration-failed", "breakdownDefinitions")];
  for (let index = 0; index < definitions.length; index += 1) {
    const validation = validateVoyageCatastrophicBreakdownDefinition(definitions[index]);
    if (!validation.valid) return [
      m10Diagnostic("m10-breakdown-regeneration-failed", `breakdownDefinitions[${index}]`),
      ...validation.errors
    ];
  }
  return [];
}

function makeRewardProposal(closeoutId, reward, enhancements, shipId) {
  if (!REWARD_PROPOSAL_KINDS.has(reward.kind)) return null;
  let kind = "reward-grant";
  let title = reward.title;
  let description = reward.description;
  let payload = {
    reward,
    enhancementIds: enhancements.map((entry) => entry.enhancementId),
    enhancements
  };
  if (reward.kind === "void-fortune") {
    kind = "void-fortune-grant";
    title = reward.voidFortune.title;
    description = reward.voidFortune.description;
    payload = {
      reward,
      voidFortune: reward.voidFortune,
      enhancementIds: enhancements.map((entry) => entry.enhancementId),
      enhancements
    };
  } else if (reward.kind === "field-repair-resource") {
    kind = "field-repair-resource-grant";
    title = reward.fieldRepairResource.title;
    description = reward.fieldRepairResource.description;
    payload = {
      reward,
      fieldRepairResource: reward.fieldRepairResource,
      enhancementIds: enhancements.map((entry) => entry.enhancementId),
      enhancements
    };
  }
  const sourceKind = "m8-reward";
  const sourceId = reward.rewardId;
  const targetKind = "ship";
  const targetId = shipId;
  return {
    proposalId: proposalIdentity(closeoutId, kind, sourceKind, sourceId, targetKind, targetId),
    kind,
    sourceKind,
    sourceId,
    targetKind,
    targetId,
    title,
    description,
    payload,
    required: true
  };
}

function makeMisfortuneProposal(closeoutId, negativeAnalysis, shipId) {
  const misfortune = negativeAnalysis.negativePackage.misfortune;
  const kind = "misfortune";
  const sourceKind = "m8-misfortune";
  const sourceId = misfortune.misfortuneId;
  const targetKind = "ship";
  const targetId = shipId;
  return {
    proposalId: proposalIdentity(closeoutId, kind, sourceKind, sourceId, targetKind, targetId),
    kind,
    sourceKind,
    sourceId,
    targetKind,
    targetId,
    title: misfortune.title,
    description: misfortune.description,
    payload: {
      misfortune,
      negativePackage: negativeAnalysis.negativePackage
    },
    required: true
  };
}

function makePersistentConsequenceProposal(closeoutId, consequence, shipId) {
  const descriptor = consequence.persistentProposal;
  const kind = "persistent-consequence";
  const sourceKind = "m6-hazard-closeout";
  const sourceId = consequence.consequenceId;
  const targetKind = descriptor.targetKind;
  const targetId = descriptor.targetId;
  return {
    proposalId: proposalIdentity(closeoutId, kind, sourceKind, sourceId, targetKind, targetId),
    kind,
    sourceKind,
    sourceId,
    targetKind,
    targetId,
    title: descriptor.title,
    description: descriptor.description,
    payload: descriptor,
    required: true
  };
}

function makeM7CloseoutScar(proposal) {
  const system = proposal.pressureSystemId;
  const descriptor = VOYAGE_PRESSURE_BREACH_VOID_SCAR_DESCRIPTORS[system];
  const name = VOYAGE_VOID_SCAR_NAME_BY_PRESSURE_SYSTEM_ID[system];
  return {
    voidScarId: proposal.voidScarId,
    name,
    pressureSystemId: system,
    status: "active",
    sourceKind: "pressure-breach",
    description: descriptor.description,
    operationalEffects: [...descriptor.operationalEffects],
    baseRepairCost: descriptor.baseRepairCost,
    baseRepairTime: descriptor.baseRepairTime,
    repairDcSource: descriptor.repairDcSource,
    eligibleRepairChecks: [...descriptor.eligibleRepairChecks],
    requiredFacilities: [...descriptor.requiredFacilities],
    compatibleFieldRepairTags: [...descriptor.compatibleFieldRepairTags],
    pressureBreachId: proposal.pressureBreachId,
    hazardId: proposal.hazardId,
    encounterId: proposal.encounterId,
    stageId: proposal.stageId,
    roundNumber: proposal.roundNumber,
    effectIndex: proposal.effectIndex,
    sequence: proposal.sequence,
    // The closeout Pressure-effect variant intentionally carries null station/action
    // fields. Durable M7 Scar records still require canonical non-blank descriptors;
    // retain authored provenance when present and use the closeout boundary labels
    // only for this authorized null-bearing variant.
    stationId: proposal.stationId === null ? "hazard-closeout" : proposal.stationId,
    actionId: proposal.actionId === null ? "hazard-closeout" : proposal.actionId,
    pressureEffectId: proposal.pressureEffectId,
    sourceIntentId: proposal.sourceIntentId,
    activationSource: proposal.activationSource,
    branch: proposal.branch,
    timing: proposal.timing,
    visibility: proposal.visibility
  };
}

function makeM10CloseoutScar(definition, source) {
  const record = {
    schemaVersion: 2,
    voidScarId: `arcflight-void-scar:${JSON.stringify([
      "m8-critical-overall-failure",
      source.eventId,
      source.sessionId,
      source.definitionSnapshotId,
      source.misfortuneId,
      source.voidScarDefinitionId,
      definition.pressureSystemId
    ])}`,
    name: definition.name,
    pressureSystemId: definition.pressureSystemId,
    status: "active",
    sourceKind: "m8-critical-overall-failure",
    description: definition.description,
    operationalEffects: definition.operationalEffects,
    baseRepairCost: definition.baseRepairCost,
    baseRepairTime: definition.baseRepairTime,
    repairDcSource: definition.repairDcSource,
    eligibleRepairChecks: definition.eligibleRepairChecks,
    requiredFacilities: definition.requiredFacilities,
    compatibleFieldRepairTags: definition.compatibleFieldRepairTags,
    source
  };
  return record;
}

function makeCapacityExhaustion(snapshot, ship, proposalId, systemId) {
  const capacity = analyzeVoyageVoidScarCapacity(ship);
  if (!capacity.ok) return null;
  return {
    kind: "voyage.m10-capacity-exhaustion",
    eventId: snapshot.eventId,
    sessionId: snapshot.sessionId,
    definitionSnapshotId: snapshot.definitionSnapshotId,
    shipId: snapshot.shipId,
    systemId,
    systemKind: "pressure-system",
    liveRevision: ship.revision,
    scarCapacity: capacity.voidScarCapacity,
    occupiedScarCount: capacity.activeVoidScarCount,
    incomingScarProposalId: proposalId,
    incomingScarProposalKind: "ordinary-void-scar",
    incomingScarProposalStatus: "approved-unapplied"
  };
}

function makeBreakdownProposal(closeoutId, capacityExhaustion, breakdownDefinition, breakdownAnalysis) {
  const breakdownDefinitionId = breakdownAnalysis.breakdownDefinitionId;
  const breakdownTitle = breakdownDefinition.title;
  const breakdownDescription = breakdownDefinition.description;
  return {
    proposalId: proposalIdentity(
      closeoutId,
      "catastrophic-breakdown",
      "m9-capacity-exhaustion",
      capacityExhaustion.incomingScarProposalId,
      "pressure-system",
      capacityExhaustion.systemId
    ),
    kind: "catastrophic-breakdown",
    sourceKind: "m9-capacity-exhaustion",
    sourceId: capacityExhaustion.incomingScarProposalId,
    targetKind: "pressure-system",
    targetId: capacityExhaustion.systemId,
    title: breakdownTitle,
    description: breakdownDescription,
    payload: {
      capacityExhaustion,
      breakdownDefinition,
      breakdownPlan: breakdownAnalysis.breakdownPlan
    },
    required: true
  };
}

function makeSystemAndHazardProposals(closeoutId, breakdownDefinition, breakdownPlan) {
  const systemId = breakdownPlan.systemDisablement.systemId;
  const definitionId = breakdownDefinition.breakdownDefinitionId;
  const systemKind = "system-disablement";
  const hazardKind = "catastrophic-hazard";
  return [
    {
      proposalId: proposalIdentity(closeoutId, systemKind, "m9-breakdown", definitionId, "pressure-system", systemId),
      kind: systemKind,
      sourceKind: "m9-breakdown",
      sourceId: definitionId,
      targetKind: "pressure-system",
      targetId: systemId,
      title: breakdownDefinition.title,
      description: breakdownDefinition.description,
      payload: breakdownPlan.systemDisablement,
      required: true
    },
    {
      proposalId: proposalIdentity(closeoutId, hazardKind, "m9-breakdown", definitionId, "event", breakdownPlan.catastrophicHazard.encounterId),
      kind: hazardKind,
      sourceKind: "m9-breakdown",
      sourceId: definitionId,
      targetKind: "event",
      targetId: breakdownPlan.catastrophicHazard.encounterId,
      title: breakdownPlan.catastrophicHazard.name,
      description: typeof breakdownPlan.catastrophicHazard.currentEffect === "string"
        ? breakdownPlan.catastrophicHazard.currentEffect
        : breakdownPlan.catastrophicHazard.currentEffect?.description ?? "Catastrophic Hazard.",
      payload: breakdownPlan.catastrophicHazard,
      required: true
    }
  ];
}

function makeEmergencyOutcomeProposal(closeoutId, breakdownDefinition, outcomeProposal, systemId) {
  const kind = "emergency-response-outcome";
  const sourceKind = "m9-emergency-response";
  const sourceId = breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId;
  const targetKind = "pressure-system";
  const targetId = systemId;
  return {
    proposalId: proposalIdentity(closeoutId, kind, sourceKind, sourceId, targetKind, targetId),
    kind,
    sourceKind,
    sourceId,
    targetKind,
    targetId,
    title: breakdownDefinition.emergencyResponseDefinition.title,
    description: breakdownDefinition.emergencyResponseDefinition.description,
    payload: outcomeProposal,
    required: true
  };
}

function makeEventHistoryProposal(closeoutId, snapshot, overallResult, previousEncounterRevision, encounterRevision, previousShipRevision, shipRevision, proposalIds) {
  const kind = "event-history";
  const sourceKind = "m10-closeout";
  const sourceId = closeoutId;
  const targetKind = "event";
  const targetId = snapshot.eventId;
  return {
    proposalId: proposalIdentity(closeoutId, kind, sourceKind, sourceId, targetKind, targetId),
    kind,
    sourceKind,
    sourceId,
    targetKind,
    targetId,
    title: "Voyage closeout",
    description: "Approved Voyage closeout history.",
    payload: {
      applicationId: null,
      closeoutId,
      eventId: snapshot.eventId,
      sessionId: snapshot.sessionId,
      definitionSnapshotId: snapshot.definitionSnapshotId,
      shipId: snapshot.shipId,
      overallResult,
      previousEncounterRevision,
      encounterRevision,
      previousShipRevision,
      shipRevision,
      proposalIds
    },
    required: true
  };
}

function makeTemporaryResetPlan(snapshot, postHazardPressureSystems, hazardRemovalPlan, containedHazards = []) {
  return {
    momentum: { previousValue: snapshot.momentum, nextValue: 0 },
    focusPools: snapshot.focusPools.map((pool) => ({
      operatorId: pool.operatorId,
      stationId: pool.stationId,
      previousValue: pool.current,
      nextValue: 0
    })),
    pressureSystems: postHazardPressureSystems.map((system) => ({
      pressureSystemId: system.pressureSystemId,
      previousValue: system.value,
      nextValue: 0,
      capacity: system.capacity
    })),
    pendingStationBenefitIds: [],
    unconsumedRiskBidBenefitIds: [],
    temporaryFocusPenaltyIds: [],
    roundOrderRestrictions: snapshot.roundOrderRestrictions
      .filter((restriction) => restriction.persistence === "persistent")
      .map((restriction) => ({ ...restriction })),
    hazardSuppressions: [],
    temporaryConsequenceIds: [],
    activeHazards: [
      ...hazardRemovalPlan.map((entry) => ({ ...entry })),
      ...containedHazards.map((hazard) => ({
        hazardId: hazard.hazardId,
        previousStatus: "active",
        disposition: "contained"
      }))
    ]
  };
}

function validateEmergencyEvidenceEntry(entry, path) {
  if (!exactKeys(entry, EMERGENCY_RESPONSE_EVIDENCE_FIELDS)
    || !isPlainObject(entry.breakdownDefinition)
    || !isPlainObject(entry.breakdownPlan)
    || !isPlainObject(entry.completedRoundHistory)
    || !isPlainObject(entry.suppliedOutcome)) {
    return [m10Diagnostic("m10-invalid-request-shape", path)];
  }
  return [];
}

function regenerateM8Preview(value, closeoutId, shipId) {
  const overall = analyzeVoyageEncounterOverallResult({
    kind: "m8-overall-result",
    sessionId: value.sessionId,
    eventDefinition: value.eventDefinition,
    completedRoundHistory: value.closeoutSnapshot.completedRoundHistory
  });
  if (!overall.ok) {
    return {
      ok: false,
      errors: [m10Diagnostic("m10-result-regeneration-failed", "resultPackage"), ...overall.errors]
    };
  }

  if (overall.overallResult === "overall-success") {
    if (value.rewardAllocation === null || value.negativeSelection !== null) {
      return { ok: false, errors: [m10Diagnostic("m10-result-regeneration-failed", "resultPackage")] };
    }
    const rewardAnalysis = analyzeVoyageEncounterRewardSteps({
      kind: "m8-reward-steps",
      sessionId: value.sessionId,
      eventDefinition: value.eventDefinition,
      completedRoundHistory: value.closeoutSnapshot.completedRoundHistory
    });
    if (!rewardAnalysis.ok) {
      return {
        ok: false,
        errors: [m10Diagnostic("m10-result-regeneration-failed", "resultPackage"), ...rewardAnalysis.errors]
      };
    }
    const allocationAnalysis = analyzeVoyageEncounterRewardAllocation({
      kind: "m8-reward-allocation",
      sessionId: value.sessionId,
      eventDefinition: value.eventDefinition,
      completedRoundHistory: value.closeoutSnapshot.completedRoundHistory,
      allocation: value.rewardAllocation
    });
    if (!allocationAnalysis.ok) {
      return {
        ok: false,
        errors: [m10Diagnostic("m10-result-regeneration-failed", "resultPackage"), ...allocationAnalysis.errors]
      };
    }
    const rewardById = new Map(value.eventDefinition.rewards.map((reward) => [reward.rewardId, reward]));
    const enhancementById = new Map(value.eventDefinition.enhancements.map((enhancement) => [enhancement.enhancementId, enhancement]));
    const rewardProposals = [];
    for (const allocated of allocationAnalysis.allocatedRewards) {
      const reward = rewardById.get(allocated.rewardId);
      const enhancements = allocated.enhancementIds.map((id) => enhancementById.get(id));
      const proposal = makeRewardProposal(closeoutId, reward, enhancements, shipId);
      if (!proposal) return { ok: false, errors: [m10Diagnostic("m10-result-regeneration-failed", "resultPackage")] };
      rewardProposals.push(proposal);
    }
    return {
      ok: true,
      overall,
      rewardAnalysis,
      negativeAnalysis: null,
      allocationAnalysis,
      resultPackage: {
        kind: "voyage.m8-result-package",
        eventId: overall.eventId,
        sessionId: overall.sessionId,
        definitionSnapshotId: overall.definitionSnapshotId,
        overallResult: overall,
        rewardAnalysis,
        negativeAnalysis: null,
        allocationAnalysis,
        requiresGmApproval: true
      },
      rewardProposals,
      scarConsequenceProposals: []
    };
  }

  if (value.rewardAllocation !== null || value.negativeSelection === null) {
    return { ok: false, errors: [m10Diagnostic("m10-result-regeneration-failed", "resultPackage")] };
  }
  const negativeAnalysis = analyzeVoyageEncounterNegativeSteps({
    kind: "m8-negative-steps",
    sessionId: value.sessionId,
    eventDefinition: value.eventDefinition,
    completedRoundHistory: value.closeoutSnapshot.completedRoundHistory,
    negativeSelection: value.negativeSelection
  });
  if (!negativeAnalysis.ok) {
    return {
      ok: false,
      errors: [m10Diagnostic("m10-result-regeneration-failed", "resultPackage"), ...negativeAnalysis.errors]
    };
  }
  const scarConsequenceProposals = negativeAnalysis.negativePackage.scarConsequenceProposals.map((proposal) => ({ ...proposal }));
  return {
    ok: true,
    overall,
    rewardAnalysis: null,
    negativeAnalysis,
    allocationAnalysis: null,
    resultPackage: {
      kind: "voyage.m8-result-package",
      eventId: overall.eventId,
      sessionId: overall.sessionId,
      definitionSnapshotId: overall.definitionSnapshotId,
      overallResult: overall,
      rewardAnalysis: null,
      negativeAnalysis,
      allocationAnalysis: null,
      requiresGmApproval: true
    },
    rewardProposals: [],
    scarConsequenceProposals
  };
}

export function analyzeVoyageEncounterCloseoutPreview(request) {
  const captured = capturePlainData(request);
  if (!captured.ok) return previewFailure([m10Diagnostic("m10-hostile-data-capture-failed", "$")]);
  const value = captured.value;
  if (!isPlainObject(value)) return previewFailure([m10Diagnostic("m10-invalid-request-shape", "request")]);

  const prohibited = PROHIBITED_AUTHORITY_KEYS.filter((key) => Object.hasOwn(value, key));
  if (prohibited.length > 0) {
    return previewFailure(prohibited.map((key) => m10Diagnostic("m10-caller-authority-rejected", `request.${key}`)));
  }
  if (value.kind !== "m10-closeout-preview") return previewFailure([m10Diagnostic("m10-invalid-mode", "request.kind")]);
  if (!exactKeys(value, CLOSEOUT_PREVIEW_REQUEST_FIELDS)
    || !nonBlank(value.sessionId)
    || !nonnegativeSafeInteger(value.expectedEncounterRevision)
    || !nonnegativeSafeInteger(value.expectedShipRevision)
    || !isPlainObject(value.closeoutSnapshot)
    || !isPlainObject(value.shipState)
    || !isPlainObject(value.eventDefinition)
    || !(value.rewardAllocation === null || isPlainObject(value.rewardAllocation))
    || !(value.negativeSelection === null || isPlainObject(value.negativeSelection))
    || !Array.isArray(value.closeoutScarDefinitions)
    || !Array.isArray(value.breakdownDefinitions)
    || !Array.isArray(value.emergencyResponseEvidence)) {
    return previewFailure([m10Diagnostic("m10-invalid-request-shape", "request")]);
  }

  const snapshot = snapshotCapture(value.closeoutSnapshot);
  if (!snapshot.ok) return previewFailure([m10Diagnostic("m10-invalid-closeout-snapshot", "closeoutSnapshot"), ...snapshot.errors]);
  const shipCapture = captureVoyageShipState(value.shipState);
  if (!shipCapture.ok) {
    return previewFailure(shipCapture.errors.map((error) => ({
      ...error,
      path: `shipState${error.path === "$" ? "" : error.path.slice(1)}`
    })));
  }
  const closeoutSnapshot = snapshot.closeoutSnapshot;
  const shipState = shipCapture.state;

  if (nonBlank(value.eventDefinition.eventId) && value.eventDefinition.eventId !== closeoutSnapshot.eventId) return previewFailure([m10Diagnostic("m10-event-identity-mismatch", "eventDefinition.eventId")]);
  if (value.sessionId !== closeoutSnapshot.sessionId) return previewFailure([m10Diagnostic("m10-session-identity-mismatch", "closeoutSnapshot.sessionId")]);
  if (nonBlank(value.eventDefinition.definitionSnapshotId) && value.eventDefinition.definitionSnapshotId !== closeoutSnapshot.definitionSnapshotId) return previewFailure([m10Diagnostic("m10-definition-snapshot-mismatch", "eventDefinition.definitionSnapshotId")]);
  if (closeoutSnapshot.shipId !== shipState.shipId) return previewFailure([m10Diagnostic("m10-ship-identity-mismatch", "closeoutSnapshot.shipId")]);
  if (value.expectedEncounterRevision !== closeoutSnapshot.encounterRevision) return previewFailure([m10Diagnostic("m10-encounter-revision-mismatch", "expectedEncounterRevision")]);
  if (closeoutSnapshot.shipRevision !== shipState.revision || value.expectedShipRevision !== shipState.revision) return previewFailure([m10Diagnostic("m10-ship-revision-mismatch", "expectedShipRevision")]);

  const analysisInput = { ...value, closeoutSnapshot };
  const closeoutId = closeoutIdentity(closeoutSnapshot, shipState);
  const m8 = regenerateM8Preview(analysisInput, closeoutId, shipState.shipId);
  if (!m8.ok) return previewFailure(m8.errors);

  const hazardCloseout = analyzeVoyageEncounterHazardCloseout({
    kind: "m10-hazard-closeout",
    sessionId: closeoutSnapshot.sessionId,
    expectedEncounterRevision: closeoutSnapshot.encounterRevision,
    closeoutSnapshot
  });
  if (!hazardCloseout.ok) return previewFailure(hazardCloseout.errors);

  const closeoutDefinitionErrors = [];
  const closeoutDefinitionIds = new Set();
  for (let index = 0; index < value.closeoutScarDefinitions.length; index += 1) {
    const definition = value.closeoutScarDefinitions[index];
    const path = `closeoutScarDefinitions[${index}]`;
    const errors = validateCloseoutScarDefinition(definition, path);
    if (errors.length > 0) {
      closeoutDefinitionErrors.push(...errors);
      break;
    }
    if (closeoutDefinitionIds.has(definition.voidScarDefinitionId)) {
      closeoutDefinitionErrors.push(m10Diagnostic("m10-invalid-closeout-scar-definition", path));
      break;
    }
    closeoutDefinitionIds.add(definition.voidScarDefinitionId);
  }
  if (closeoutDefinitionErrors.length > 0) return previewFailure(closeoutDefinitionErrors);

  const persistentProposals = [...m8.rewardProposals];
  if (m8.negativeAnalysis) persistentProposals.push(makeMisfortuneProposal(closeoutId, m8.negativeAnalysis, shipState.shipId));
  for (const result of hazardCloseout.hazardCloseoutResults) {
    if (result.consequenceKind === "persistent-consequence") {
      persistentProposals.push(makePersistentConsequenceProposal(closeoutId, result.consequence, shipState.shipId));
    }
  }

  const selectedScarProposals = [];
  if (m8.scarConsequenceProposals.length > 0) {
    for (let index = 0; index < m8.scarConsequenceProposals.length; index += 1) {
      const proposal = m8.scarConsequenceProposals[index];
      const matches = value.closeoutScarDefinitions.filter((definition) => definition.voidScarDefinitionId === proposal.voidScarDefinitionId);
      if (matches.length !== 1) return previewFailure([m10Diagnostic("m10-unresolved-closeout-scar-definition", `negativeAnalysis.negativePackage.scarConsequenceProposals[${index}]`)]);
      if (matches[0].pressureSystemId !== proposal.pressureSystemId) return previewFailure([m10Diagnostic("m10-invalid-closeout-scar-definition", `closeoutScarDefinitions[${value.closeoutScarDefinitions.indexOf(matches[0])}]`)]);
      selectedScarProposals.push({
        sourceKind: "m8-critical-overall-failure",
        incomingScarProposalId: `arcflight-closeout-scar-proposal:${JSON.stringify([
          "m8-critical-overall-failure",
          closeoutSnapshot.eventId,
          closeoutSnapshot.sessionId,
          closeoutSnapshot.definitionSnapshotId,
          m8.negativeAnalysis.negativePackage.misfortuneId,
          proposal.voidScarDefinitionId,
          proposal.pressureSystemId
        ])}`,
        pressureSystemId: proposal.pressureSystemId,
        definition: matches[0],
        incomingScarProposal: { ...proposal },
        source: {
          eventId: closeoutSnapshot.eventId,
          sessionId: closeoutSnapshot.sessionId,
          definitionSnapshotId: closeoutSnapshot.definitionSnapshotId,
          misfortuneId: m8.negativeAnalysis.negativePackage.misfortuneId,
          voidScarDefinitionId: proposal.voidScarDefinitionId
        }
      });
    }
  }
  for (const proposal of hazardCloseout.ordinaryScarProposals) {
    selectedScarProposals.push({
      sourceKind: "m7-pressure-breach",
      incomingScarProposalId: proposal.voidScarProposalId,
      pressureSystemId: proposal.pressureSystemId,
      proposal
    });
  }

  const breakdownCatalogErrors = validateBreakdownCatalog(value.breakdownDefinitions);
  if (breakdownCatalogErrors.length > 0) return previewFailure(breakdownCatalogErrors);
  for (let index = 0; index < value.emergencyResponseEvidence.length; index += 1) {
    const evidenceErrors = validateEmergencyEvidenceEntry(value.emergencyResponseEvidence[index], `emergencyResponseEvidence[${index}]`);
    if (evidenceErrors.length > 0) return previewFailure(evidenceErrors);
  }

  let simulatedShip = cloneCaptured(shipState);
  const ordinaryScarResults = [];
  const breakdownResults = [];
  const emergencyResponseOutcomes = [];
  const containedHazards = [];
  const warnings = [];
  let evidenceIndex = 0;
  let blockedByEmergencyResponse = false;

  for (const source of selectedScarProposals) {
    const capacity = analyzeVoyageVoidScarCapacity(simulatedShip);
    if (!capacity.ok) return previewFailure(capacity.errors);
    const voidScar = source.sourceKind === "m7-pressure-breach"
      ? makeM7CloseoutScar(source.proposal)
      : makeM10CloseoutScar(source.definition, source.source);
    const scarCapture = captureVoyageDurableVoidScarRecord(voidScar);
    if (!scarCapture.ok) return previewFailure([m10Diagnostic("m10-pressure-closeout-failed", "ordinaryScarResults"), ...scarCapture.errors]);
    const duplicate = simulatedShip.voidScars.some((scar) => scar.voidScarId === scarCapture.record.voidScarId);
    if (duplicate) return previewFailure([m10Diagnostic("m10-duplicate-scar-identity", "ordinaryScarResults")]);

    if (capacity.canAcceptVoidScar) {
      simulatedShip = {
        shipId: simulatedShip.shipId,
        revision: simulatedShip.revision + 1,
        installed: { ...simulatedShip.installed },
        hull: { ...simulatedShip.hull },
        voidScars: [...simulatedShip.voidScars, scarCapture.record]
      };
      ordinaryScarResults.push({
        incomingScarProposalId: source.incomingScarProposalId,
        sourceKind: source.sourceKind,
        pressureSystemId: source.pressureSystemId,
        disposition: "void-scar",
        voidScar: scarCapture.record,
        capacityExhaustion: null,
        breakdownAnalysis: null,
        emergencyResponseAnalysis: null
      });
      const scarProposal = {
        proposalId: proposalIdentity(closeoutId, "void-scar-create", source.sourceKind === "m7-pressure-breach" ? "m7-pressure-breach" : "m8-critical-overall-failure", source.incomingScarProposalId, "pressure-system", source.pressureSystemId),
        kind: "void-scar-create",
        sourceKind: source.sourceKind,
        sourceId: source.incomingScarProposalId,
        targetKind: "pressure-system",
        targetId: source.pressureSystemId,
        title: scarCapture.record.name,
        description: scarCapture.record.description,
        payload: {
          incomingScarProposal: source.sourceKind === "m7-pressure-breach"
            ? source.proposal
            : source.incomingScarProposal,
          voidScar: scarCapture.record
        },
        required: true
      };
      persistentProposals.push(scarProposal);
      continue;
    }

    const capacityExhaustion = makeCapacityExhaustion(closeoutSnapshot, simulatedShip, source.incomingScarProposalId, source.pressureSystemId);
    if (!capacityExhaustion) return previewFailure([m10Diagnostic("m10-breakdown-regeneration-failed", "breakdownResults")]);
    const matchingDefinitions = value.breakdownDefinitions.filter((definition) => definition.systemId === source.pressureSystemId);
    if (matchingDefinitions.length === 0) return previewFailure([m10Diagnostic("m10-missing-breakdown-definition", "breakdownDefinitions")]);
    if (matchingDefinitions.length !== 1) return previewFailure([m10Diagnostic("m10-ambiguous-breakdown-definition", "breakdownDefinitions")]);
    const breakdownDefinition = matchingDefinitions[0];
    const breakdownAnalysis = analyzeVoyageCatastrophicBreakdown({
      kind: "m9-catastrophic-breakdown",
      sessionId: closeoutSnapshot.sessionId,
      breakdownDefinition,
      capacityExhaustion
    });
    if (!breakdownAnalysis.ok) return previewFailure([m10Diagnostic("m10-breakdown-regeneration-failed", "breakdownResults"), ...breakdownAnalysis.errors]);

    let emergencyResponseAnalysis = null;
    const breakdownResult = {
      incomingScarProposalId: source.incomingScarProposalId,
      capacityExhaustion,
      breakdownDefinitionId: breakdownAnalysis.breakdownDefinitionId,
      breakdownAnalysis,
      emergencyResponseAnalysis: null
    };
    ordinaryScarResults.push({
      incomingScarProposalId: source.incomingScarProposalId,
      sourceKind: source.sourceKind,
      pressureSystemId: source.pressureSystemId,
      disposition: "catastrophic-breakdown",
      voidScar: null,
      capacityExhaustion,
      breakdownAnalysis,
      emergencyResponseAnalysis: null
    });
    breakdownResults.push(breakdownResult);
    persistentProposals.push(makeBreakdownProposal(closeoutId, capacityExhaustion, breakdownDefinition, breakdownAnalysis));
    persistentProposals.push(...makeSystemAndHazardProposals(closeoutId, breakdownDefinition, breakdownAnalysis.breakdownPlan));

    if (evidenceIndex >= value.emergencyResponseEvidence.length) {
      blockedByEmergencyResponse = true;
      warnings.push(previewWarning("m10-emergency-response-required", `emergencyResponseEvidence[${evidenceIndex}]`));
      break;
    }
    const evidence = value.emergencyResponseEvidence[evidenceIndex];
    if (!structurallyEqual(evidence.breakdownDefinition, breakdownDefinition)
      || !structurallyEqual(evidence.breakdownPlan, breakdownAnalysis.breakdownPlan)) {
      return previewFailure([m10Diagnostic("m10-breakdown-regeneration-failed", "breakdownResults")]);
    }
    const emergencyResult = analyzeVoyageEmergencyResponseResult({
      kind: "m9-emergency-response",
      sessionId: closeoutSnapshot.sessionId,
      breakdownDefinition: evidence.breakdownDefinition,
      breakdownPlan: evidence.breakdownPlan,
      completedRoundHistory: evidence.completedRoundHistory
    });
    if (!emergencyResult.ok) return previewFailure([m10Diagnostic("m10-breakdown-regeneration-failed", "breakdownResults"), ...emergencyResult.errors]);
    if (!structurallyEqual(emergencyResult, evidence.suppliedOutcome)) return previewFailure([m10Diagnostic("m10-emergency-response-mismatch", `emergencyResponseEvidence[${evidenceIndex}].suppliedOutcome`)]);
    emergencyResponseAnalysis = emergencyResult;
    breakdownResult.emergencyResponseAnalysis = emergencyResult;
    ordinaryScarResults[ordinaryScarResults.length - 1].emergencyResponseAnalysis = emergencyResult;
    emergencyResponseOutcomes.push(emergencyResult);
    if (emergencyResult.outcomeProposal.hazardDisposition === "contained") {
      containedHazards.push(breakdownAnalysis.breakdownPlan.catastrophicHazard);
    }
    persistentProposals.push(makeEmergencyOutcomeProposal(closeoutId, evidence.breakdownDefinition, emergencyResult.outcomeProposal, source.pressureSystemId));
    evidenceIndex += 1;
  }

  if (!blockedByEmergencyResponse && evidenceIndex !== value.emergencyResponseEvidence.length) {
    return previewFailure([m10Diagnostic("m10-emergency-response-mismatch", `emergencyResponseEvidence[${evidenceIndex}]`)]);
  }

  const temporaryResetPlan = makeTemporaryResetPlan(
    closeoutSnapshot,
    hazardCloseout.postHazardPressureSystems,
    hazardCloseout.hazardRemovalPlan,
    containedHazards
  );
  if (!blockedByEmergencyResponse) {
    const eventHistoryId = proposalIdentity(closeoutId, "event-history", "m10-closeout", closeoutId, "event", closeoutSnapshot.eventId);
    const proposalIds = [...persistentProposals.map((proposal) => proposal.proposalId), eventHistoryId];
    const resultingEncounterRevision = closeoutSnapshot.encounterRevision
      + hazardCloseout.hazardCloseoutResults.length
      + hazardCloseout.pressureBreachResults.filter((result) => result.breachRequired).length
      + 1;
    const nonScarProposalCount = persistentProposals.filter((proposal) => proposal.kind !== "void-scar-create").length;
    const resultingShipRevision = simulatedShip.revision + (nonScarProposalCount > 0 ? 1 : 0);
    persistentProposals.push(makeEventHistoryProposal(
      closeoutId,
      closeoutSnapshot,
      m8.overall.overallResult,
      closeoutSnapshot.encounterRevision,
      resultingEncounterRevision,
      value.expectedShipRevision,
      resultingShipRevision,
      proposalIds
    ));
  }

  const preview = {
    schemaVersion: 1,
    closeoutId,
    eventId: closeoutSnapshot.eventId,
    sessionId: closeoutSnapshot.sessionId,
    definitionSnapshotId: closeoutSnapshot.definitionSnapshotId,
    shipId: shipState.shipId,
    expectedEncounterRevision: value.expectedEncounterRevision,
    expectedShipRevision: value.expectedShipRevision,
    overallResult: m8.overall.overallResult,
    successfulRoundCount: m8.overall.successfulRoundCount,
    failedRoundCount: m8.overall.failedRoundCount,
    resultPackage: m8.resultPackage,
    hazardCloseoutResults: hazardCloseout.hazardCloseoutResults,
    pressureBreachResults: hazardCloseout.pressureBreachResults,
    ordinaryScarResults,
    breakdownResults,
    emergencyResponseOutcomes,
    persistentProposals,
    temporaryResetPlan,
    blockedByEmergencyResponse,
    requiresGmApproval: true
  };
  if (!exactKeys(preview, PREVIEW_FIELDS) || !exactKeys(temporaryResetPlan, TEMPORARY_RESET_FIELDS)) {
    return previewFailure([m10Diagnostic("m10-invalid-request-shape", "preview")]);
  }
  const isolated = capturePlainData(preview);
  if (!isolated.ok) return previewFailure([m10Diagnostic("m10-pressure-closeout-failed", "preview")]);
  return {
    ok: true,
    readyForGmReview: true,
    closeoutId,
    preview: isolated.value,
    errors: [],
    warnings
  };
}

export function validateVoyageEncounterCloseoutSnapshot(closeoutSnapshot) {
  const captured = snapshotCapture(closeoutSnapshot);
  return {
    valid: captured.ok,
    errors: captured.errors,
    warnings: []
  };
}

export function captureVoyageEncounterCloseoutSnapshot(closeoutSnapshot) {
  return snapshotCapture(closeoutSnapshot);
}

export function analyzeVoyageEncounterCloseoutPressureBreach(request) {
  const captured = capturePlainData(request);
  if (!captured.ok) return breachFailure([m10Diagnostic("m10-hostile-data-capture-failed", "$")]);
  const result = analyzeCapturedCloseoutPressureBreach(captured.value, "active");
  const isolated = capturePlainData(result);
  return isolated.ok ? isolated.value : breachFailure([m10Diagnostic("m10-pressure-closeout-failed", "request")]);
}

export function analyzeVoyageEncounterHazardCloseout(request) {
  const captured = capturePlainData(request);
  if (!captured.ok) return analysisFailure([m10Diagnostic("m10-hostile-data-capture-failed", "$")]);
  return analyzeCapturedHazardCloseout(captured.value);
}
