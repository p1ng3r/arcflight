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
    "m10-pressure-closeout-failed": "Pressure/Breach simulation failed."
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
