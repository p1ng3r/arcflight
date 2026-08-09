import { ARCFLIGHT_MODULE_ID } from "../../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE } from "../../documents/ships.js";
import {
  captureVoyageShipState,
  getVoyageHullVoidScarCapacity
} from "../domain/ship-state.js";
import { captureVoyageDurableVoidScarRecord } from "../domain/void-scar-schema.js";
import { applyVoyageEncounterApprovedCloseout } from "../domain/closeout-review.js";
import { VOYAGE_PRESSURE_SYSTEM_IDS, VOYAGE_ROUND_RESULTS } from "../domain/constants.js";
import { validateVoyageHazardRecord } from "../domain/hazard-schema.js";
import { analyzeVoyageCatastrophicBreakdown, validateVoyageCatastrophicBreakdownDefinition } from "../domain/catastrophic-breakdown.js";
import { analyzeVoyagePressureBreachCloseoutTransaction } from "../domain/pressure-breach.js";

const VOYAGE_PATH = `flags.${ARCFLIGHT_MODULE_ID}.system.voyage`;
const VOYAGE_LEDGER_PATH = `${VOYAGE_PATH}.closeoutLedger`;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const PERSIST_FIELDS = Object.freeze(["kind", "previewRequest", "reviewRequest", "applicationPlan"]);
const CONTINUE_FIELDS = Object.freeze(["kind", "applicationId", "receipt"]);
const CHECKPOINT_FIELDS = Object.freeze(["kind", "applicationId", "reservationId"]);
const FINALIZE_FIELDS = Object.freeze(["kind", "applicationId", "receipt"]);
const PROHIBITED = Object.freeze([
  "overallResult", "rewardAnalysis", "negativeAnalysis", "resultPackage", "hazardPlan", "pressurePlan", "breachPlan",
  "capacityAnalysis", "capacityExhaustion", "breakdownPlan", "outcomeProposal", "persistentProposals", "temporaryResetPlan",
  "preview", "previewId", "approved", "gmApproved", "approvalToken", "applicationId", "applicationPlan", "nextEncounterState",
  "nextCloseoutSnapshot", "nextShipState", "events", "patch", "ledgerEntry", "idempotencyStatus", "receipt",
  "sessionCommitReceipt", "requestId", "timestamp"
]);

const MESSAGES = Object.freeze({
  hostile: "M10 data could not be captured safely.",
  shape: "Request shape, order, or root values are invalid.",
  mode: "The requested M10 API mode is invalid.",
  activeGm: "Executing Foundry user is not the current active GM.",
  shipNotFound: "Exact Arcflight ship Actor was not resolved.",
  legacy: "Existing persistent data cannot be initialized safely.",
  ledgerConflict: "Ledger identity or state conflicts with this application.",
  writeFailed: "Foundry write did not complete or verify.",
  reservationRequired: "A verified M11 session reservation receipt is required.",
  reservationInvalid: "M11 session reservation receipt does not match the prepared closeout.",
  commitRequired: "A verified M11 session commit receipt is required.",
  commitInvalid: "M11 session commit receipt does not match the prepared closeout.",
  reconciliation: "Prepared state differs from both recorded before and after state."
});

function diagnostic(code, path, message, severity = "error") {
  return { code, path, message, severity };
}

function m10(code, path, severity = "error") {
  const messages = {
    "m10-hostile-data-capture-failed": MESSAGES.hostile,
    "m10-invalid-request-shape": MESSAGES.shape,
    "m10-invalid-mode": MESSAGES.mode,
    "m10-active-gm-required": MESSAGES.activeGm,
    "m10-ship-document-not-found": MESSAGES.shipNotFound,
    "m10-ambiguous-legacy-storage": MESSAGES.legacy,
    "m10-ledger-conflict": MESSAGES.ledgerConflict,
    "m10-persistence-write-failed": MESSAGES.writeFailed,
    "m10-session-reservation-receipt-required": MESSAGES.reservationRequired,
    "m10-invalid-session-reservation-receipt": MESSAGES.reservationInvalid,
    "m10-session-commit-receipt-required": MESSAGES.commitRequired,
    "m10-invalid-session-commit-receipt": MESSAGES.commitInvalid,
    "m10-reconciliation-required": MESSAGES.reconciliation
  };
  return diagnostic(code, path, messages[code] ?? "M10 data is invalid.", severity);
}

function dedupe(errors) {
  const seen = new Set();
  return errors.filter((error) => {
    const key = JSON.stringify([error.code, error.path, error.message, error.severity]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  } catch {
    return false;
  }
}

function capture(value, ancestors = new Set()) {
  try {
    if (value === null || typeof value === "string" || typeof value === "boolean") return { ok: true, value };
    if (typeof value === "number") return Number.isFinite(value) && Number.isSafeInteger(value) ? { ok: true, value } : { ok: false, value: null };
    if (typeof value !== "object" || ancestors.has(value)) return { ok: false, value: null };
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return { ok: false, value: null };
    const keys = Reflect.ownKeys(value);
    ancestors.add(value);
    try {
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
        if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) return { ok: false, value: null };
        const output = new Array(length);
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
          const nested = capture(descriptor.value, ancestors);
          if (!nested.ok) return nested;
          output[index] = nested.value;
        }
        for (const key of keys) {
          if (key === "length") continue;
          if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) return { ok: false, value: null };
        }
        return { ok: true, value: output };
      }
      const output = {};
      for (const key of keys) {
        if (typeof key !== "string" || UNSAFE_KEYS.has(key)) return { ok: false, value: null };
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
        const nested = capture(descriptor.value, ancestors);
        if (!nested.ok) return nested;
        output[key] = nested.value;
      }
      return { ok: true, value: output };
    } finally {
      ancestors.delete(value);
    }
  } catch {
    return { ok: false, value: null };
  }
}

function equal(left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => equal(entry, right[index]));
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
}

function exactKeys(value, fields) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((key, index) => key === fields[index]);
}

function failure(errors) {
  return {
    ok: false,
    status: "failed",
    applicationId: null,
    closeoutId: null,
    shipId: null,
    revision: null,
    events: [],
    errors: dedupe(errors),
    warnings: []
  };
}

function success(status, entry, revision) {
  return {
    ok: true,
    status,
    applicationId: entry.applicationId,
    closeoutId: entry.closeoutId,
    shipId: entry.shipId,
    revision,
    events: capture(entry.events).value,
    errors: [],
    warnings: []
  };
}

function knownFailure(status, entry, revision, errors) {
  return {
    ok: false,
    status,
    applicationId: entry.applicationId,
    closeoutId: entry.closeoutId,
    shipId: entry.shipId,
    revision,
    events: capture(entry.events).value,
    errors: dedupe(errors),
    warnings: []
  };
}

function checkpointFailure(errors) {
  return {
    ok: false,
    readyForSessionCommit: false,
    applicationId: null,
    closeoutId: null,
    shipId: null,
    revision: null,
    errors: dedupe(errors),
    warnings: []
  };
}

function checkpointSuccess(entry) {
  return {
    ok: true,
    readyForSessionCommit: true,
    applicationId: entry.applicationId,
    closeoutId: entry.closeoutId,
    shipId: entry.shipId,
    revision: entry.resultingShipRevision,
    errors: [],
    warnings: []
  };
}

function own(value, key) {
  return isPlainObject(value) && Object.hasOwn(value, key);
}

function prohibited(value, required) {
  return PROHIBITED.filter((key) => !required.includes(key) && own(value, key));
}

function captureRequest(request, fields, requiredMode, requiredAuthority = []) {
  const captured = capture(request);
  if (!captured.ok) return { errors: [m10("m10-hostile-data-capture-failed", "$ ".trim())] };
  const value = captured.value;
  if (!isPlainObject(value)) return { errors: [m10("m10-invalid-request-shape", "request")] };
  const authority = prohibited(value, requiredAuthority);
  if (authority.length > 0) return { errors: authority.map((key) => diagnostic("m10-caller-authority-rejected", `request.${key}`, "Caller supplied calculated, application, persistence, or runtime authority.")) };
  if (!exactKeys(value, fields)) return { errors: [m10("m10-invalid-request-shape", "request")] };
  if (value.kind !== requiredMode) return { errors: [m10("m10-invalid-mode", "request.kind")] };
  return { value, errors: [] };
}

function emptyVoyage() {
  return {
    schemaVersion: 1,
    revision: 0,
    voidScars: [],
    disabledSystems: [],
    rewards: [],
    resources: [],
    persistentConsequences: [],
    eventHistory: [],
    closeoutLedger: []
  };
}

const GAMEPLAY_FIELDS = Object.freeze(["schemaVersion", "revision", "voidScars", "disabledSystems", "rewards", "resources", "persistentConsequences", "eventHistory"]);
const VOYAGE_FIELDS = Object.freeze([...GAMEPLAY_FIELDS, "closeoutLedger"]);
const LEDGER_FIELDS = Object.freeze([
  "applicationId", "closeoutId", "status", "eventId", "sessionId", "definitionSnapshotId", "shipId",
  "expectedEncounterRevision", "resultingEncounterRevision", "expectedShipRevision", "resultingShipRevision", "gmUserId",
  "beforeState", "afterState", "completedCloseoutSnapshot", "events", "sessionReservationReceipt", "sessionCommitReceipt"
]);
const PROPOSAL_FIELDS = Object.freeze(["proposalId", "kind", "sourceKind", "sourceId", "targetKind", "targetId", "title", "description", "payload", "required"]);
const DURABLE_PROPOSAL_KINDS = new Set([
  "reward-grant", "void-fortune-grant", "field-repair-resource-grant", "misfortune", "persistent-consequence",
  "void-scar-create", "catastrophic-breakdown", "system-disablement", "catastrophic-hazard", "emergency-response-outcome", "event-history"
]);
const TARGET_KINDS = new Set(["ship", "system", "pressure-system", "event", "crew", "resource"]);
const ROUND_RESULTS = new Set(Object.values(VOYAGE_ROUND_RESULTS));
const M6_PERSISTENT_KINDS = new Set(["ship-damage", "resource-loss", "crew-consequence", "operational-restriction", "authored"]);
const M6_PERSISTENT_TARGET_KINDS = new Set(["ship", "system", "crew", "resource"]);
const REWARD_FIELDS = Object.freeze(["rewardId", "kind", "title", "description", "tags", "enhancementIds", "voidFortune", "fieldRepairResource"]);
const REWARD_ENHANCEMENT_FIELDS = Object.freeze(["enhancementId", "title", "description", "compatibleRewardIds", "compatibleRewardKinds", "maxApplicationsPerReward"]);
const VOID_FORTUNE_FIELDS = Object.freeze(["voidFortuneId", "title", "description", "tags"]);
const FIELD_REPAIR_FIELDS = Object.freeze(["fieldRepairResourceId", "title", "description", "compatibleScarTags", "timing", "safeRestRequired"]);
const MISFORTUNE_FIELDS = Object.freeze(["misfortuneId", "kind", "title", "description", "tags", "persistence", "enhancementIds", "scarConsequenceProposal"]);
const MISFORTUNE_ENHANCEMENT_FIELDS = Object.freeze(["misfortuneEnhancementId", "title", "description", "compatibleMisfortuneIds", "maxApplicationsPerMisfortune"]);
const CAPACITY_EXHAUSTION_FIELDS = Object.freeze(["kind", "eventId", "sessionId", "definitionSnapshotId", "shipId", "systemId", "systemKind", "liveRevision", "scarCapacity", "occupiedScarCount", "incomingScarProposalId", "incomingScarProposalKind", "incomingScarProposalStatus"]);
const BREAKDOWN_PLAN_FIELDS = Object.freeze(["systemDisablement", "catastrophicHazard", "pausePlan", "emergencyResponseDefinitionId", "scarApplication", "capacityExhaustion"]);
const SYSTEM_DISABLEMENT_FIELDS = Object.freeze(["systemId", "systemKind", "disabled"]);
const EMERGENCY_STABILIZED_FIELDS = Object.freeze(["kind", "eventId", "sessionId", "definitionSnapshotId", "shipId", "systemId", "breakdownDefinitionId", "emergencyResponseDefinitionId", "catastrophicHazardId", "catastropheStatus", "hazardDisposition", "systemStatus", "repairApplied", "scarAdded", "scarRemoved", "sourceEventStatus", "nextSituation", "requiresGmApproval"]);
const EMERGENCY_FAILED_FIELDS = Object.freeze(["kind", "eventId", "sessionId", "definitionSnapshotId", "shipId", "systemId", "breakdownDefinitionId", "emergencyResponseDefinitionId", "catastrophicHazardId", "catastropheStatus", "systemStatus", "sourceEventStatus", "retryAllowed", "consequence", "nextSituation", "requiresGmApproval"]);
const EMERGENCY_NEXT_SITUATION_FIELDS = Object.freeze(["nextSituationId", "title", "summary", "transitionKind"]);
const EMERGENCY_CONSEQUENCE_FIELDS = Object.freeze(["consequenceId", "kind", "title", "description", "nextSituationId"]);
const EMERGENCY_TRANSITIONS = new Set(["retreat", "diversion", "emergency", "capture", "delay", "repair", "authored"]);
const EMERGENCY_CONSEQUENCES = new Set(["strand", "diversion", "disablement", "loss"]);
const PRESSURE_EFFECT_FIELDS = Object.freeze(["pressureEffectId", "encounterId", "stageId", "roundNumber", "sequence", "stationId", "actionId", "pressureSystemId", "delta", "timing", "sourceKind", "sourceIntentId", "activationSource", "branch", "visibility"]);
const BREACH_FIELDS = Object.freeze(["pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureSystemId", "pressureEffectId", "sourceKind", "sourceIntentId", "activationSource", "branch", "timing", "visibility", "previousValue", "capacity", "remainingCapacity", "attemptedDelta", "overflowDelta"]);
const M6_HAZARD_FIELDS = Object.freeze(["hazardId", "pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureSystemId", "category", "status", "sourceKind", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility", "name"]);
const EVENT_HISTORY_FIELDS = Object.freeze([
  "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "overallResult",
  "previousEncounterRevision", "encounterRevision", "previousShipRevision", "shipRevision", "proposalIds"
]);
const EVENT_HISTORY_PROPOSAL_FIELDS = Object.freeze(["applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "overallResult", "previousEncounterRevision", "encounterRevision", "previousShipRevision", "shipRevision", "proposalIds"]);
const M6_SCAR_SOURCE_FIELDS = Object.freeze([
  "voidScarProposalId", "voidScarId", "pressureBreachId", "hazardId", "encounterId", "stageId", "roundNumber",
  "effectIndex", "sequence", "stationId", "actionId", "pressureSystemId", "consequenceKind", "status", "persistence",
  "sourceKind", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility", "name"
]);
const M10_SCAR_SOURCE_FIELDS = Object.freeze(["eventId", "sessionId", "definitionSnapshotId", "misfortuneId", "voidScarDefinitionId"]);
const CLOSEOUT_CONSEQUENCE_FIELDS = Object.freeze(["consequenceId", "kind", "pressureSystemId", "delta", "persistentProposal"]);
const PERSISTENT_CONSEQUENCE_FIELDS = Object.freeze(["proposalId", "kind", "title", "description", "targetKind", "targetId"]);
const EVENT_FIELDS = Object.freeze({
  "voyage.hazard-closeout-consequence-applied": [
    "type", "applicationId", "closeoutId", "encounterId", "eventId", "sessionId", "definitionSnapshotId", "shipId",
    "stageId", "roundNumber", "phase", "hazardId", "consequenceId", "consequenceKind", "pressureSystemId",
    "pressureEffect", "previousHazard", "disposition", "previousEncounterRevision", "encounterRevision"
  ],
  "voyage.pressure-breach-applied": [
    "type", "encounterId", "lifecycleState", "stageId", "roundNumber", "phase", "pressureEffectCount", "appliedEffectCount",
    "breach", "hazard", "collisionOutcome", "voidScarProposal", "pressureReset", "effects", "previousPressureSystems",
    "pressureSystems", "previousRevision", "revision"
  ],
  "voyage.void-scar-created": [
    "type", "shipId", "encounterId", "pressureSystemId", "sourceEventType", "sourceEncounterRevision", "sourceProposal",
    "previousShipRevision", "revision", "previousVoidScarCount", "voidScarCount", "voidScar"
  ],
  "voyage.closeout-void-scar-created": [
    "type", "applicationId", "closeoutId", "shipId", "eventId", "sessionId", "pressureSystemId", "sourceProposal",
    "previousShipRevision", "revision", "previousVoidScarCount", "voidScarCount", "voidScar"
  ],
  "voyage.closeout-persistent-state-applied": [
    "type", "applicationId", "closeoutId", "shipId", "proposalIds", "previousShipRevision", "revision"
  ],
  "voyage.closeout-applied": [
    "type", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "overallResult",
    "proposalIds", "previousEncounterRevision", "encounterRevision", "shipRevision"
  ]
});
const COMPLETED_SNAPSHOT_FIELDS = Object.freeze(["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "shipId", "encounterRevision", "shipRevision", "lifecycleState", "stageId", "roundNumber", "phase", "completedRoundHistory", "momentum", "focusPools", "pressureSystems", "activeHazards", "pendingStationBenefitIds", "unconsumedRiskBidBenefitIds", "temporaryFocusPenaltyIds", "roundOrderRestrictions", "hazardSuppressions", "temporaryConsequenceIds"]);
const FOCUS_FIELDS = Object.freeze(["operatorId", "stationId", "current", "capacity"]);
const PRESSURE_FIELDS = Object.freeze(["pressureSystemId", "value", "capacity"]);
const RESTRICTION_FIELDS = Object.freeze(["restrictionId", "persistence"]);
const SUPPRESSION_FIELDS = Object.freeze(["suppressionId", "hazardId"]);
const HISTORY_FIELDS = Object.freeze(["schemaVersion", "eventId", "sessionId", "definitionSnapshotId", "roundCount", "rounds"]);
const HISTORY_ROUND_FIELDS = Object.freeze(["roundId", "roundNumber", "roundResult"]);
const RECEIPT_RESERVATION_FIELDS = Object.freeze([
  "kind", "reservationId", "activeGmUserId", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId", "expectedEncounterRevision", "pressureBreachSources"
]);
const RECEIPT_COMMIT_FIELDS = Object.freeze([
  "kind", "reservationId", "activeGmUserId", "applicationId", "closeoutId", "eventId", "sessionId", "definitionSnapshotId", "shipId",
  "previousEncounterRevision", "encounterRevision", "completedCloseoutSnapshot", "encounterEvents", "pressureBreachSources"
]);
const PRESSURE_BREACH_SOURCE_FIELDS = Object.freeze([
  "breachEventIndex", "sourceHazardId", "expectedEncounterRevision", "closeoutContext",
  "pressureSystems", "activeHazards", "pressureEffect"
]);
const PRESSURE_BREACH_CONTEXT_FIELDS = Object.freeze(["eventId", "sessionId", "stageId", "roundNumber", "phase"]);

function gameplayFromVoyage(voyage) {
  return {
    schemaVersion: voyage.schemaVersion,
    revision: voyage.revision,
    voidScars: voyage.voidScars,
    disabledSystems: voyage.disabledSystems,
    rewards: voyage.rewards,
    resources: voyage.resources,
    persistentConsequences: voyage.persistentConsequences,
    eventHistory: voyage.eventHistory
  };
}

function validArray(value) {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index) || value[index] === undefined) return false;
  }
  return true;
}

function nonBlank(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function nullableNonBlank(value) {
  return value === null || nonBlank(value);
}

function exactPlainRecord(value, fields) {
  return isPlainObject(value) && exactKeys(value, fields);
}

function denseStrings(value) {
  return validArray(value) && value.every(nonBlank);
}

function validRewardRecord(value) {
  return exactPlainRecord(value, REWARD_FIELDS)
    && nonBlank(value.rewardId) && nonBlank(value.kind) && nonBlank(value.title) && nonBlank(value.description)
    && denseStrings(value.tags) && denseStrings(value.enhancementIds)
    && (value.voidFortune === null || validVoidFortuneRecord(value.voidFortune))
    && (value.fieldRepairResource === null || validFieldRepairRecord(value.fieldRepairResource));
}

function validVoidFortuneRecord(value) {
  return exactPlainRecord(value, VOID_FORTUNE_FIELDS)
    && nonBlank(value.voidFortuneId) && nonBlank(value.title) && nonBlank(value.description) && denseStrings(value.tags);
}

function validFieldRepairRecord(value) {
  return exactPlainRecord(value, FIELD_REPAIR_FIELDS)
    && nonBlank(value.fieldRepairResourceId) && nonBlank(value.title) && nonBlank(value.description)
    && denseStrings(value.compatibleScarTags) && nonBlank(value.timing)
    && typeof value.safeRestRequired === "boolean";
}

function validRewardEnhancement(value) {
  return exactPlainRecord(value, REWARD_ENHANCEMENT_FIELDS)
    && nonBlank(value.enhancementId) && nonBlank(value.title) && nonBlank(value.description)
    && denseStrings(value.compatibleRewardIds) && denseStrings(value.compatibleRewardKinds)
    && value.maxApplicationsPerReward === 1;
}

function validRewardEnhancementGraph(reward, enhancementIds, enhancements) {
  return denseStrings(enhancementIds)
    && equal(reward.enhancementIds, enhancementIds)
    && validArray(enhancements)
    && enhancements.length === enhancementIds.length
    && enhancements.every((enhancement, index) => validRewardEnhancement(enhancement)
      && enhancement.enhancementId === enhancementIds[index]
      && enhancement.compatibleRewardIds.includes(reward.rewardId)
      && enhancement.compatibleRewardKinds.includes(reward.kind));
}

function validMisfortuneRecord(value) {
  return exactPlainRecord(value, MISFORTUNE_FIELDS)
    && nonBlank(value.misfortuneId) && nonBlank(value.kind) && nonBlank(value.title) && nonBlank(value.description)
    && denseStrings(value.tags) && ["temporary", "persistent"].includes(value.persistence)
    && denseStrings(value.enhancementIds)
    && (value.scarConsequenceProposal === null || (exactPlainRecord(value.scarConsequenceProposal, ["voidScarDefinitionId", "pressureSystemId", "source"])
      && nonBlank(value.scarConsequenceProposal.voidScarDefinitionId)
      && VOYAGE_PRESSURE_SYSTEM_IDS.includes(value.scarConsequenceProposal.pressureSystemId)
      && value.scarConsequenceProposal.source === "m8-critical-overall-failure"));
}

function validMisfortuneEnhancement(value) {
  return exactPlainRecord(value, MISFORTUNE_ENHANCEMENT_FIELDS)
    && nonBlank(value.misfortuneEnhancementId) && nonBlank(value.title) && nonBlank(value.description)
    && denseStrings(value.compatibleMisfortuneIds) && value.maxApplicationsPerMisfortune === 1;
}

function validEmergencyNextSituation(value) {
  return exactPlainRecord(value, EMERGENCY_NEXT_SITUATION_FIELDS)
    && nonBlank(value.nextSituationId) && nonBlank(value.title) && nonBlank(value.summary)
    && EMERGENCY_TRANSITIONS.has(value.transitionKind);
}

function validEmergencyConsequence(value) {
  return exactPlainRecord(value, EMERGENCY_CONSEQUENCE_FIELDS)
    && nonBlank(value.consequenceId) && EMERGENCY_CONSEQUENCES.has(value.kind)
    && nonBlank(value.title) && nonBlank(value.description) && nonBlank(value.nextSituationId);
}

function validEmergencyOutcome(value) {
  if (!isPlainObject(value) || !["m9-emergency-response-stabilized", "m9-emergency-response-failed"].includes(value.kind)) return false;
  const fields = value.kind === "m9-emergency-response-stabilized" ? EMERGENCY_STABILIZED_FIELDS : EMERGENCY_FAILED_FIELDS;
  if (!exactKeys(value, fields)) return false;
  if (![value.eventId, value.sessionId, value.definitionSnapshotId, value.shipId, value.breakdownDefinitionId, value.emergencyResponseDefinitionId, value.catastrophicHazardId].every(nonBlank)
    || !VOYAGE_PRESSURE_SYSTEM_IDS.includes(value.systemId)
    || value.requiresGmApproval !== true
    || !validEmergencyNextSituation(value.nextSituation)) return false;
  if (value.kind === "m9-emergency-response-stabilized") {
    return value.catastropheStatus === "stabilized" && value.hazardDisposition === "contained"
      && value.systemStatus === "disabled" && value.repairApplied === false && value.scarAdded === false
      && value.scarRemoved === false && value.sourceEventStatus === "ended";
  }
  return value.catastropheStatus === "failed" && value.systemStatus === "disabled"
    && value.sourceEventStatus === "ended" && value.retryAllowed === false
    && validEmergencyConsequence(value.consequence);
}

function validPersistentConsequenceRecord(value) {
  return exactPlainRecord(value, ["proposalId", "kind", "title", "description", "targetKind", "targetId"])
    && nonBlank(value.proposalId)
    && M6_PERSISTENT_KINDS.has(value.kind)
    && M6_PERSISTENT_TARGET_KINDS.has(value.targetKind)
    && nonBlank(value.targetId)
    && nonBlank(value.title)
    && nonBlank(value.description);
}

function validM10ScarIncoming(value) {
  return exactPlainRecord(value, ["voidScarDefinitionId", "pressureSystemId", "source"])
    && nonBlank(value.voidScarDefinitionId)
    && VOYAGE_PRESSURE_SYSTEM_IDS.includes(value.pressureSystemId)
    && exactPlainRecord(value.source, M10_SCAR_SOURCE_FIELDS)
    && M10_SCAR_SOURCE_FIELDS.every((key) => nonBlank(value.source[key]))
    && value.source.voidScarDefinitionId === value.voidScarDefinitionId;
}

function validNestedProposalPayload(proposal) {
  const payload = proposal.payload;
  if (!isPlainObject(payload)) return false;
  if (proposal.kind === "reward-grant") {
    return exactKeys(payload, ["reward", "enhancementIds", "enhancements"])
      && validRewardRecord(payload.reward)
      && validRewardEnhancementGraph(payload.reward, payload.enhancementIds, payload.enhancements);
  }
  if (proposal.kind === "void-fortune-grant") {
    return exactKeys(payload, ["reward", "voidFortune", "enhancementIds", "enhancements"])
      && validRewardRecord(payload.reward)
      && validVoidFortuneRecord(payload.voidFortune)
      && equal(payload.reward.voidFortune, payload.voidFortune)
      && nonBlank(payload.reward.rewardId) && nonBlank(payload.voidFortune.voidFortuneId)
      && validRewardEnhancementGraph(payload.reward, payload.enhancementIds, payload.enhancements);
  }
  if (proposal.kind === "field-repair-resource-grant") {
    return exactKeys(payload, ["reward", "fieldRepairResource", "enhancementIds", "enhancements"])
      && validRewardRecord(payload.reward)
      && validFieldRepairRecord(payload.fieldRepairResource)
      && equal(payload.reward.fieldRepairResource, payload.fieldRepairResource)
      && nonBlank(payload.reward.rewardId) && nonBlank(payload.fieldRepairResource.fieldRepairResourceId)
      && validRewardEnhancementGraph(payload.reward, payload.enhancementIds, payload.enhancements);
  }
  if (proposal.kind === "misfortune") {
    return exactKeys(payload, ["misfortune", "negativePackage"])
      && validMisfortuneRecord(payload.misfortune)
      && exactPlainRecord(payload.negativePackage, ["misfortuneId", "enhancementIds", "misfortune", "enhancements", "nextSituation", "scarConsequenceProposals"])
      && payload.negativePackage.misfortuneId === payload.misfortune.misfortuneId
      && equal(payload.negativePackage.misfortune, payload.misfortune)
      && equal(payload.negativePackage.enhancementIds, payload.misfortune.enhancementIds)
      && validMisfortuneRecord(payload.negativePackage.misfortune)
      && validArray(payload.negativePackage.enhancements)
      && payload.negativePackage.enhancements.length === payload.negativePackage.enhancementIds.length
      && payload.negativePackage.enhancements.every((enhancement, index) => validMisfortuneEnhancement(enhancement)
        && enhancement.misfortuneEnhancementId === payload.negativePackage.enhancementIds[index]
        && enhancement.compatibleMisfortuneIds.includes(payload.misfortune.misfortuneId))
      && validEmergencyNextSituation(payload.negativePackage.nextSituation)
      && validArray(payload.negativePackage.scarConsequenceProposals)
      && (payload.misfortune.scarConsequenceProposal === null
        ? payload.negativePackage.scarConsequenceProposals.length === 0
        : payload.negativePackage.scarConsequenceProposals.length === 1
          && equal(payload.negativePackage.scarConsequenceProposals[0], payload.misfortune.scarConsequenceProposal))
      && payload.negativePackage.scarConsequenceProposals.every((scar) => exactPlainRecord(scar, ["voidScarDefinitionId", "pressureSystemId", "source"])
        && nonBlank(scar.voidScarDefinitionId) && VOYAGE_PRESSURE_SYSTEM_IDS.includes(scar.pressureSystemId)
        && scar.source === "m8-critical-overall-failure");
  }
  if (proposal.kind === "persistent-consequence") {
    return validPersistentConsequenceRecord(payload) && payload.proposalId === proposal.sourceId;
  }
  if (proposal.kind === "void-scar-create") {
    const incoming = proposal.sourceKind === "m7-pressure-breach" ? payload?.incomingScarProposal : payload?.incomingScarProposal;
    const incomingValid = proposal.sourceKind === "m7-pressure-breach"
      ? exactPlainRecord(incoming, M6_SCAR_SOURCE_FIELDS)
        && [incoming.voidScarProposalId, incoming.voidScarId, incoming.pressureBreachId, incoming.hazardId, incoming.encounterId, incoming.stageId, incoming.pressureEffectId, incoming.sourceIntentId, incoming.activationSource, incoming.branch, incoming.timing, incoming.visibility, incoming.name].every(nonBlank)
        && VOYAGE_PRESSURE_SYSTEM_IDS.includes(incoming.pressureSystemId)
        && [incoming.roundNumber, incoming.effectIndex, incoming.sequence].every(safeInteger)
        && [incoming.status, incoming.persistence, incoming.sourceKind].every(nonBlank)
      : validM10ScarIncoming(incoming)
    return exactKeys(payload, ["incomingScarProposal", "voidScar"])
      && incomingValid
      && captureVoyageDurableVoidScarRecord(payload.voidScar).ok;
  }
  if (proposal.kind === "catastrophic-breakdown") {
    const breakdownRegeneration = isPlainObject(payload.capacityExhaustion) && isPlainObject(payload.breakdownDefinition)
      ? analyzeVoyageCatastrophicBreakdown({
        kind: "m9-catastrophic-breakdown",
        sessionId: payload.capacityExhaustion.sessionId,
        breakdownDefinition: payload.breakdownDefinition,
        capacityExhaustion: payload.capacityExhaustion
      })
      : { ok: false, breakdownPlan: null };
    return exactKeys(payload, ["capacityExhaustion", "breakdownDefinition", "breakdownPlan"])
      && exactPlainRecord(payload.capacityExhaustion, CAPACITY_EXHAUSTION_FIELDS)
      && payload.capacityExhaustion.kind === "voyage.m10-capacity-exhaustion"
      && VOYAGE_PRESSURE_SYSTEM_IDS.includes(payload.capacityExhaustion.systemId)
      && payload.capacityExhaustion.systemKind === "pressure-system"
      && [payload.capacityExhaustion.eventId, payload.capacityExhaustion.sessionId, payload.capacityExhaustion.definitionSnapshotId, payload.capacityExhaustion.shipId, payload.capacityExhaustion.incomingScarProposalId].every(nonBlank)
      && [payload.capacityExhaustion.liveRevision, payload.capacityExhaustion.scarCapacity, payload.capacityExhaustion.occupiedScarCount].every(safeInteger)
      && validateVoyageCatastrophicBreakdownDefinition(payload.breakdownDefinition).valid
      && exactKeys(payload.breakdownPlan, BREAKDOWN_PLAN_FIELDS)
      && exactKeys(payload.breakdownPlan.systemDisablement, SYSTEM_DISABLEMENT_FIELDS)
      && payload.breakdownPlan.systemDisablement.systemId === payload.capacityExhaustion.systemId
      && payload.breakdownPlan.systemDisablement.systemKind === "pressure-system"
      && payload.breakdownPlan.systemDisablement.disabled === true
      && validateVoyageHazardRecord(payload.breakdownPlan.catastrophicHazard, { mode: "snapshot" }).valid
      && exactPlainRecord(payload.breakdownPlan.pausePlan, ["timing", "resumeCondition"])
      && nonBlank(payload.breakdownPlan.pausePlan.timing) && nonBlank(payload.breakdownPlan.pausePlan.resumeCondition)
      && nonBlank(payload.breakdownPlan.emergencyResponseDefinitionId)
      && (payload.breakdownPlan.scarApplication === null || (exactPlainRecord(payload.breakdownPlan.scarApplication, ["kind", "voidScarId", "pressureSystemId"])
        && nonBlank(payload.breakdownPlan.scarApplication.kind) && nonBlank(payload.breakdownPlan.scarApplication.voidScarId)
        && VOYAGE_PRESSURE_SYSTEM_IDS.includes(payload.breakdownPlan.scarApplication.pressureSystemId)))
      && exactPlainRecord(payload.breakdownPlan.capacityExhaustion, CAPACITY_EXHAUSTION_FIELDS)
      && payload.breakdownPlan.capacityExhaustion.eventId === payload.capacityExhaustion.eventId
      && payload.breakdownPlan.capacityExhaustion.incomingScarProposalId === payload.capacityExhaustion.incomingScarProposalId
      && breakdownRegeneration.ok && equal(payload.breakdownPlan, breakdownRegeneration.breakdownPlan);
  }
  if (proposal.kind === "system-disablement") {
    return exactKeys(payload, ["systemId", "systemKind", "disabled"])
      && VOYAGE_PRESSURE_SYSTEM_IDS.includes(payload.systemId) && payload.systemKind === "pressure-system" && payload.disabled === true;
  }
  if (proposal.kind === "catastrophic-hazard") {
    return validateVoyageHazardRecord(payload, { mode: "snapshot" }).valid;
  }
  if (proposal.kind === "emergency-response-outcome") {
    return validEmergencyOutcome(payload);
  }
  return proposal.kind === "event-history"
    ? exactKeys(payload, EVENT_HISTORY_PROPOSAL_FIELDS) && validEventHistory(payload)
    : false;
}

function canonicalProposalId(closeoutId, proposal) {
  return `arcflight-closeout-proposal:${JSON.stringify([closeoutId, proposal.kind, proposal.sourceKind, proposal.sourceId, proposal.targetKind, proposal.targetId])}`;
}

function canonicalM10ScarSourceId(source, pressureSystemId = source.pressureSystemId) {
  return `arcflight-closeout-scar-proposal:${JSON.stringify([
    "m8-critical-overall-failure",
    source.eventId,
    source.sessionId,
    source.definitionSnapshotId,
    source.misfortuneId,
    source.voidScarDefinitionId,
    pressureSystemId
  ])}`;
}

function validEventHistory(entry) {
  if (!isPlainObject(entry) || !exactKeys(entry, EVENT_HISTORY_FIELDS)) return false;
  if (!["overall-success", "overall-failure"].includes(entry.overallResult)) return false;
  if (![entry.applicationId, entry.closeoutId, entry.eventId, entry.sessionId, entry.definitionSnapshotId, entry.shipId].every(nonBlank)) return false;
  if (![entry.previousEncounterRevision, entry.encounterRevision, entry.previousShipRevision, entry.shipRevision].every((value) => Number.isSafeInteger(value) && value >= 0)) return false;
  return validArray(entry.proposalIds) && entry.proposalIds.every(nonBlank) && new Set(entry.proposalIds).size === entry.proposalIds.length;
}

function validProposal(proposal, closeoutId) {
  if (!isPlainObject(proposal) || !exactKeys(proposal, PROPOSAL_FIELDS) || !DURABLE_PROPOSAL_KINDS.has(proposal.kind)) return false;
  if (![proposal.proposalId, proposal.sourceKind, proposal.sourceId, proposal.targetKind, proposal.targetId, proposal.title, proposal.description].every(nonBlank)
    || !TARGET_KINDS.has(proposal.targetKind)
    || (closeoutId != null && proposal.proposalId !== canonicalProposalId(closeoutId, proposal))
    || proposal.required !== true) return false;
  const mapping = {
    "reward-grant": ["m8-reward", "ship"],
    "void-fortune-grant": ["m8-reward", "ship"],
    "field-repair-resource-grant": ["m8-reward", "ship"],
    misfortune: ["m8-misfortune", "ship"],
    "persistent-consequence": ["m6-hazard-closeout", proposal.targetKind],
    "void-scar-create": [new Set(["m7-pressure-breach", "m8-critical-overall-failure"]), "pressure-system"],
    "catastrophic-breakdown": ["m9-capacity-exhaustion", "pressure-system"],
    "system-disablement": ["m9-breakdown", "pressure-system"],
    "catastrophic-hazard": ["m9-breakdown", "event"],
    "emergency-response-outcome": ["m9-emergency-response", "pressure-system"],
    "event-history": ["m10-closeout", "event"]
  }[proposal.kind];
  if (!mapping || !(mapping[0] instanceof Set ? mapping[0].has(proposal.sourceKind) : proposal.sourceKind === mapping[0]) || proposal.targetKind !== mapping[1]) return false;
  if (!validNestedProposalPayload(proposal)) return false;
  const payload = proposal.payload;
  if (proposal.kind === "reward-grant" || proposal.kind === "void-fortune-grant" || proposal.kind === "field-repair-resource-grant") {
    return proposal.sourceId === payload.reward.rewardId && proposal.targetKind === "ship"
      && proposal.title === payload.reward.title && proposal.description === payload.reward.description;
  }
  if (proposal.kind === "misfortune") {
    return proposal.sourceId === payload.misfortune.misfortuneId && proposal.targetKind === "ship"
      && proposal.title === payload.misfortune.title && proposal.description === payload.misfortune.description;
  }
  if (proposal.kind === "persistent-consequence") {
    return proposal.sourceId === payload.proposalId && proposal.targetKind === payload.targetKind && proposal.targetId === payload.targetId
      && proposal.title === payload.title && proposal.description === payload.description;
  }
  if (proposal.kind === "void-scar-create") {
    const incoming = payload.incomingScarProposal;
    return proposal.targetKind === "pressure-system" && proposal.targetId === payload.voidScar.pressureSystemId
      && proposal.title === payload.voidScar.name && proposal.description === payload.voidScar.description
      && (proposal.sourceKind === "m7-pressure-breach" ? proposal.sourceId === incoming.voidScarProposalId
        : proposal.sourceId === canonicalM10ScarSourceId(incoming.source));
  }
  if (proposal.kind === "catastrophic-breakdown") {
    return proposal.sourceId === payload.capacityExhaustion.incomingScarProposalId
      && proposal.targetKind === "pressure-system" && proposal.targetId === payload.capacityExhaustion.systemId
      && proposal.title === payload.breakdownDefinition.title && proposal.description === payload.breakdownDefinition.description;
  }
  if (proposal.kind === "system-disablement") {
    return proposal.targetKind === "pressure-system" && proposal.targetId === payload.systemId;
  }
  if (proposal.kind === "catastrophic-hazard") {
    return proposal.targetKind === "event" && proposal.targetId === payload.encounterId
      && proposal.title === payload.name;
  }
  if (proposal.kind === "emergency-response-outcome") {
    return proposal.targetKind === "pressure-system" && proposal.targetId === payload.systemId;
  }
  return proposal.kind === "event-history"
    && proposal.sourceId === proposal.payload.closeoutId && proposal.targetKind === "event" && proposal.targetId === proposal.payload.eventId;
}

function validProposalCollection(value, allowedKinds, closeoutId) {
  return validArray(value) && value.every((entry) => validProposal(entry, closeoutId) && allowedKinds.has(entry.kind));
}

function validCrossProposalBindings(proposals, historyRecords = []) {
  const breakdowns = proposals.filter((proposal) => proposal.kind === "catastrophic-breakdown");
  const history = historyRecords.at(-1) ?? null;
  const breakdownByDefinition = new Map();
  for (const proposal of breakdowns) {
    const definition = proposal.payload.breakdownDefinition;
    if (breakdownByDefinition.has(definition.breakdownDefinitionId)) return false;
    breakdownByDefinition.set(definition.breakdownDefinitionId, proposal);
  }
  for (const proposal of proposals) {
    if (history) {
      const identity = [history.eventId, history.sessionId, history.definitionSnapshotId, history.shipId];
      if (proposal.kind === "void-scar-create" && proposal.sourceKind === "m8-critical-overall-failure") {
        const source = proposal.payload.incomingScarProposal.source;
        if (![source.eventId, source.sessionId, source.definitionSnapshotId].every((value, index) => value === identity[index])) return false;
        const misfortune = proposals.find((candidate) => candidate.kind === "misfortune" && candidate.sourceId === source.misfortuneId);
        if (!misfortune) return false;
      }
    }
    if (proposal.kind === "system-disablement" || proposal.kind === "catastrophic-hazard") {
      const source = breakdownByDefinition.get(proposal.sourceId);
      if (!source) return false;
      const definition = source.payload.breakdownDefinition;
      if (proposal.kind === "system-disablement") {
        if (proposal.targetId !== source.targetId || proposal.title !== definition.title || proposal.description !== definition.description
          || !equal(proposal.payload, source.payload.breakdownPlan.systemDisablement)) return false;
      } else if (proposal.targetId !== source.payload.breakdownPlan.catastrophicHazard.encounterId
        || proposal.title !== source.payload.breakdownPlan.catastrophicHazard.name
        || proposal.description !== (typeof source.payload.breakdownPlan.catastrophicHazard.currentEffect === "string"
          ? source.payload.breakdownPlan.catastrophicHazard.currentEffect
          : source.payload.breakdownPlan.catastrophicHazard.currentEffect?.description ?? "Catastrophic Hazard.")
        || !equal(proposal.payload, source.payload.breakdownPlan.catastrophicHazard)) return false;
    }
    if (proposal.kind === "emergency-response-outcome") {
      const source = breakdowns.find((candidate) => candidate.payload.breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId === proposal.sourceId);
      if (!source) return false;
      const response = source.payload.breakdownDefinition.emergencyResponseDefinition;
      const outcome = proposal.payload;
      const capacity = source.payload.capacityExhaustion;
      const hazard = source.payload.breakdownPlan.catastrophicHazard;
      if (proposal.title !== response.title || proposal.description !== response.description || proposal.targetId !== source.targetId
        || outcome.eventId !== capacity.eventId
        || outcome.sessionId !== capacity.sessionId
        || outcome.definitionSnapshotId !== capacity.definitionSnapshotId
        || outcome.shipId !== capacity.shipId
        || outcome.systemId !== capacity.systemId
        || outcome.breakdownDefinitionId !== source.payload.breakdownDefinition.breakdownDefinitionId
        || outcome.emergencyResponseDefinitionId !== response.emergencyResponseDefinitionId
        || outcome.catastrophicHazardId !== hazard.hazardId) return false;
    }
    if (proposal.kind === "event-history"
      && (proposal.title !== "Voyage closeout" || proposal.description !== "Approved Voyage closeout history.")) return false;
  }
  return true;
}

function validM9ProposalBindings(proposals, entry) {
  const breakdowns = proposals.filter((proposal) => proposal.kind === "catastrophic-breakdown");
  for (const proposal of breakdowns) {
    const exhaustion = proposal.payload.capacityExhaustion;
    const definition = proposal.payload.breakdownDefinition;
    const plan = proposal.payload.breakdownPlan;
    const hazard = plan.catastrophicHazard;
    const response = definition.emergencyResponseDefinition;
    if (exhaustion.eventId !== entry.eventId
      || exhaustion.sessionId !== entry.sessionId
      || exhaustion.definitionSnapshotId !== entry.definitionSnapshotId
      || exhaustion.shipId !== entry.shipId
      || exhaustion.systemId !== definition.systemId
      || exhaustion.systemId !== hazard.failurePressureSystemId
      || hazard.encounterId !== entry.eventId
      || hazard.pressureSystemId !== exhaustion.systemId
      || definition.systemId !== exhaustion.systemId
      || plan.emergencyResponseDefinitionId !== response.emergencyResponseDefinitionId
      || response.breakdownDefinitionId !== definition.breakdownDefinitionId
      || response.systemId !== exhaustion.systemId) return false;
  }
  for (const proposal of proposals) {
    if (proposal.kind === "system-disablement" || proposal.kind === "catastrophic-hazard") {
      const breakdown = breakdowns.find((candidate) => candidate.payload.breakdownDefinition.breakdownDefinitionId === proposal.sourceId);
      if (!breakdown) return false;
      const exhaustion = breakdown.payload.capacityExhaustion;
      const definition = breakdown.payload.breakdownDefinition;
      const hazard = breakdown.payload.breakdownPlan.catastrophicHazard;
      if (proposal.kind === "system-disablement"
        ? proposal.targetId !== exhaustion.systemId || proposal.payload.systemId !== exhaustion.systemId
        : proposal.targetId !== entry.eventId || proposal.payload.encounterId !== entry.eventId || proposal.payload.pressureSystemId !== exhaustion.systemId
          || proposal.payload.hazardId !== hazard.hazardId) return false;
      if (definition.systemId !== exhaustion.systemId) return false;
    }
    if (proposal.kind === "emergency-response-outcome") {
      const breakdown = breakdowns.find((candidate) => candidate.payload.breakdownDefinition.emergencyResponseDefinition.emergencyResponseDefinitionId === proposal.sourceId);
      if (!breakdown) return false;
      const exhaustion = breakdown.payload.capacityExhaustion;
      const definition = breakdown.payload.breakdownDefinition;
      const outcome = proposal.payload;
      if (outcome.eventId !== entry.eventId
        || outcome.sessionId !== entry.sessionId
        || outcome.definitionSnapshotId !== entry.definitionSnapshotId
        || outcome.shipId !== entry.shipId
        || outcome.breakdownDefinitionId !== definition.breakdownDefinitionId
        || outcome.emergencyResponseDefinitionId !== proposal.sourceId
        || outcome.catastrophicHazardId !== definition.catastrophicHazard.hazardId
        || outcome.systemId !== exhaustion.systemId) return false;
    }
  }
  return true;
}

function validCompletedSnapshot(snapshot) {
  const history = snapshot?.completedRoundHistory;
  const validHistory = isPlainObject(history) && exactKeys(history, HISTORY_FIELDS) && history.schemaVersion === 1 && [history.eventId, history.sessionId, history.definitionSnapshotId].every(nonBlank) && Number.isSafeInteger(history.roundCount) && history.roundCount >= 0 && validArray(history.rounds) && history.rounds.length === history.roundCount && history.rounds.every((round) => isPlainObject(round) && exactKeys(round, HISTORY_ROUND_FIELDS) && nonBlank(round.roundId) && Number.isSafeInteger(round.roundNumber) && round.roundNumber >= 0 && ROUND_RESULTS.has(round.roundResult));
  const validFocus = validArray(snapshot?.focusPools) && snapshot.focusPools.every((pool) => isPlainObject(pool) && exactKeys(pool, FOCUS_FIELDS) && nonBlank(pool.operatorId) && nonBlank(pool.stationId) && pool.current === 0 && Number.isSafeInteger(pool.capacity) && pool.capacity >= 0);
  const validPressure = validArray(snapshot?.pressureSystems) && snapshot.pressureSystems.length === VOYAGE_PRESSURE_SYSTEM_IDS.length && snapshot.pressureSystems.every((system, index) => isPlainObject(system) && exactKeys(system, PRESSURE_FIELDS) && system.pressureSystemId === VOYAGE_PRESSURE_SYSTEM_IDS[index] && system.value === 0 && Number.isSafeInteger(system.capacity) && system.capacity >= 0);
  const validRestrictions = validArray(snapshot?.roundOrderRestrictions)
    && snapshot.roundOrderRestrictions.every((restriction) => isPlainObject(restriction) && exactKeys(restriction, RESTRICTION_FIELDS) && nonBlank(restriction.restrictionId) && restriction.persistence === "persistent")
    && new Set(snapshot.roundOrderRestrictions.map((restriction) => restriction.restrictionId)).size === snapshot.roundOrderRestrictions.length;
  const validSuppressions = validArray(snapshot?.hazardSuppressions) && snapshot.hazardSuppressions.length === 0;
  return isPlainObject(snapshot)
    && exactKeys(snapshot, COMPLETED_SNAPSHOT_FIELDS)
    && snapshot.schemaVersion === 1
    && [snapshot.eventId, snapshot.sessionId, snapshot.definitionSnapshotId, snapshot.shipId, snapshot.stageId, snapshot.phase].every(nonBlank)
    && history.eventId === snapshot.eventId && history.sessionId === snapshot.sessionId && history.definitionSnapshotId === snapshot.definitionSnapshotId
    && [snapshot.encounterRevision, snapshot.shipRevision, snapshot.roundNumber].every((value) => Number.isSafeInteger(value) && value >= 0)
    && snapshot.momentum === 0
    && ["completed-success", "completed-failure"].includes(snapshot.lifecycleState)
    && validHistory
    && validFocus
    && validPressure
    && validArray(snapshot.activeHazards) && snapshot.activeHazards.length === 0
    && validArray(snapshot.pendingStationBenefitIds) && snapshot.pendingStationBenefitIds.length === 0
    && validArray(snapshot.unconsumedRiskBidBenefitIds) && snapshot.unconsumedRiskBidBenefitIds.length === 0
    && validArray(snapshot.temporaryFocusPenaltyIds) && snapshot.temporaryFocusPenaltyIds.length === 0
    && validRestrictions
    && validSuppressions
    && validArray(snapshot.temporaryConsequenceIds) && snapshot.temporaryConsequenceIds.length === 0;
}

function validGameplaySnapshot(state, closeoutId) {
  if (!isPlainObject(state) || !exactKeys(state, GAMEPLAY_FIELDS) || state.schemaVersion !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0) return false;
  const proposalCollections = [
    state.disabledSystems,
    state.rewards,
    state.resources,
    state.persistentConsequences
  ];
  const proposalIds = new Set();
  const uniqueProposals = proposalCollections.every((collection) => validArray(collection) && collection.every((proposal) => {
    if (proposalIds.has(proposal?.proposalId)) return false;
    proposalIds.add(proposal?.proposalId);
    return true;
  }));
  const validDisabled = validProposalCollection(state.disabledSystems, new Set(["system-disablement"]), closeoutId);
  const validRewards = validProposalCollection(state.rewards, new Set(["reward-grant", "void-fortune-grant"]), closeoutId);
  const validResources = validProposalCollection(state.resources, new Set(["field-repair-resource-grant"]), closeoutId);
  const validConsequences = validProposalCollection(state.persistentConsequences, new Set(["misfortune", "persistent-consequence", "catastrophic-breakdown", "catastrophic-hazard", "emergency-response-outcome"]), closeoutId);
  const validScars = validArray(state.voidScars) && state.voidScars.every((scar) => captureVoyageDurableVoidScarRecord(scar).ok);
  const validHistory = validArray(state.eventHistory) && state.eventHistory.every(validEventHistory);
  const allProposals = [...state.disabledSystems, ...state.rewards, ...state.resources, ...state.persistentConsequences];
  return validDisabled
    && validRewards
    && validResources
    && validConsequences
    && validScars
    && validHistory
    && validCrossProposalBindings(allProposals, state.eventHistory)
    && uniqueProposals
    ;
}

function validPressureEffect(value) {
  return exactKeys(value, PRESSURE_EFFECT_FIELDS)
    && [value.pressureEffectId, value.encounterId, value.stageId, value.sourceKind, value.sourceIntentId, value.activationSource, value.branch, value.visibility].every(nonBlank)
    && nullableNonBlank(value.stationId) && nullableNonBlank(value.actionId)
    && safeInteger(value.roundNumber) && safeInteger(value.sequence) && VOYAGE_PRESSURE_SYSTEM_IDS.includes(value.pressureSystemId)
    && Number.isSafeInteger(value.delta) && value.delta > 0;
}

function validCloseoutConsequence(value) {
  if (!exactPlainRecord(value, CLOSEOUT_CONSEQUENCE_FIELDS) || !nonBlank(value.consequenceId)) return false;
  if (value.kind === "pressure-change") {
    return VOYAGE_PRESSURE_SYSTEM_IDS.includes(value.pressureSystemId)
      && Number.isSafeInteger(value.delta) && value.delta > 0
      && value.persistentProposal === null;
  }
  if (value.kind === "persistent-consequence") {
    return value.pressureSystemId === null && value.delta === null
      && exactPlainRecord(value.persistentProposal, PERSISTENT_CONSEQUENCE_FIELDS)
      && nonBlank(value.persistentProposal.proposalId)
      && M6_PERSISTENT_KINDS.has(value.persistentProposal.kind)
      && nonBlank(value.persistentProposal.title)
      && nonBlank(value.persistentProposal.description)
      && TARGET_KINDS.has(value.persistentProposal.targetKind)
      && nonBlank(value.persistentProposal.targetId);
  }
  return false;
}

function validHazardCloseoutBindings(event, previousHazard, entry) {
  if (previousHazard.hazardId !== event.hazardId
    || !validCloseoutConsequence(previousHazard.ignoredConsequence)
    || previousHazard.ignoredConsequence.consequenceId !== event.consequenceId
    || previousHazard.ignoredConsequence.kind !== event.consequenceKind) return false;
  const pressureEffect = event.pressureEffect;
  if (pressureEffect === null) return event.pressureSystemId === null && previousHazard.ignoredConsequence.kind === "persistent-consequence";
  const consequence = previousHazard.ignoredConsequence;
  return consequence.kind === "pressure-change"
    && pressureEffect.encounterId === entry.eventId
    && pressureEffect.stageId === event.stageId
    && pressureEffect.roundNumber === event.roundNumber
    && pressureEffect.sourceKind === "hazard-closeout"
    && pressureEffect.sourceIntentId === event.consequenceId
    && pressureEffect.activationSource === "event-closeout"
    && pressureEffect.branch === "no-roll"
    && pressureEffect.timing === "gm-confirmed"
    && pressureEffect.stationId === null
    && pressureEffect.actionId === null
    && pressureEffect.pressureSystemId === event.pressureSystemId
    && pressureEffect.pressureSystemId === consequence.pressureSystemId
    && pressureEffect.delta === consequence.delta
    && pressureEffect.visibility === previousHazard.visibility
    && pressureEffect.pressureEffectId === `arcflight-pressure-effect:${JSON.stringify([
      "hazard-closeout", entry.eventId, entry.sessionId, event.stageId, event.roundNumber,
      event.hazardId, event.consequenceId, pressureEffect.sequence, pressureEffect.pressureSystemId
    ])}`;
}

function validM6Breach(value) {
  return exactKeys(value, BREACH_FIELDS)
    && [value.pressureBreachId, value.encounterId, value.stageId, value.pressureEffectId, value.sourceKind, value.sourceIntentId, value.activationSource, value.branch, value.timing, value.visibility].every(nonBlank)
    && nullableNonBlank(value.stationId) && nullableNonBlank(value.actionId)
    && VOYAGE_PRESSURE_SYSTEM_IDS.includes(value.pressureSystemId)
    && [value.roundNumber, value.effectIndex, value.sequence, value.previousValue, value.capacity, value.remainingCapacity, value.attemptedDelta, value.overflowDelta].every(Number.isSafeInteger)
    && value.previousValue >= 0 && value.capacity >= 0 && value.remainingCapacity >= 0 && value.attemptedDelta > 0 && value.overflowDelta > 0
    && value.previousValue <= value.capacity
    && value.remainingCapacity === value.capacity - value.previousValue
    && value.attemptedDelta > value.remainingCapacity
    && value.overflowDelta === value.attemptedDelta - value.remainingCapacity
    && value.pressureBreachId === `arcflight-pressure-breach:${JSON.stringify([value.encounterId, value.stageId, value.roundNumber, value.effectIndex, value.pressureSystemId, value.pressureEffectId])}`;
}

function validM6ScarSource(value) {
  return exactPlainRecord(value, M6_SCAR_SOURCE_FIELDS)
    && [value.voidScarProposalId, value.voidScarId, value.pressureBreachId, value.hazardId, value.encounterId, value.stageId, value.pressureEffectId, value.sourceIntentId, value.activationSource, value.branch, value.timing, value.visibility, value.name].every(nonBlank)
    && VOYAGE_PRESSURE_SYSTEM_IDS.includes(value.pressureSystemId)
    && [value.roundNumber, value.effectIndex, value.sequence].every(safeInteger)
    && [value.status, value.persistence, value.sourceKind].every(nonBlank)
    && value.sourceKind === "pressure-breach"
    && value.status === "proposed"
    && value.persistence === "lasting"
    && value.voidScarProposalId === `arcflight-void-scar-proposal:${JSON.stringify(["pressure-breach", value.pressureBreachId])}`
    && value.voidScarId === `arcflight-void-scar:${JSON.stringify(["pressure-breach", value.pressureBreachId])}`;
}

function validM6Hazard(value) {
  return exactKeys(value, M6_HAZARD_FIELDS)
    && [value.hazardId, value.pressureBreachId, value.encounterId, value.stageId, value.sourceKind, value.pressureEffectId, value.sourceIntentId, value.activationSource, value.branch, value.timing, value.visibility, value.name].every(nonBlank)
    && VOYAGE_PRESSURE_SYSTEM_IDS.includes(value.pressureSystemId)
    && safeInteger(value.roundNumber) && safeInteger(value.effectIndex) && safeInteger(value.sequence)
    && value.category === "system" && value.status === "active" && value.sourceKind === "pressure-breach"
    && value.hazardId === `arcflight-hazard:${JSON.stringify(["pressure-breach", value.pressureBreachId])}`;
}

function validPressureSystemsMap(value) {
  if (!isPlainObject(value) || Object.keys(value).length !== VOYAGE_PRESSURE_SYSTEM_IDS.length) return false;
  if (!equal(Object.keys(value), VOYAGE_PRESSURE_SYSTEM_IDS)) return false;
  return VOYAGE_PRESSURE_SYSTEM_IDS.every((id) => Object.hasOwn(value, id)
    && exactPlainRecord(value[id], ["pressureSystemId", "value", "capacity"])
    && value[id].pressureSystemId === id && safeInteger(value[id].value) && safeInteger(value[id].capacity));
}

function fieldsEqual(left, right, fields) {
  return fields.every((field) => left?.[field] === right?.[field]);
}

function allStoredProposals(entry) {
  return [
    ...entry.afterState.disabledSystems,
    ...entry.afterState.rewards,
    ...entry.afterState.resources,
    ...entry.afterState.persistentConsequences
  ];
}

function validM7EventBinding(event, entry) {
  const source = entry.events.find((candidate) => candidate.type === "voyage.pressure-breach-applied" && candidate.revision === event.sourceEncounterRevision);
  return Boolean(source)
    && event.encounterId === source.encounterId
    && event.pressureSystemId === source.breach.pressureSystemId
    && equal(event.sourceProposal, source.voidScarProposal)
    && fieldsEqual(event.voidScar, {
      pressureBreachId: source.breach.pressureBreachId,
      hazardId: source.hazard.hazardId,
      encounterId: source.encounterId,
      pressureSystemId: source.breach.pressureSystemId
    }, ["pressureBreachId", "hazardId", "encounterId", "pressureSystemId"])
    && event.voidScar.voidScarId === event.sourceProposal.voidScarId;
}

function validM10EventBinding(event, entry) {
  const proposal = allStoredProposals(entry).find((candidate) => candidate.kind === "void-scar-create"
    && candidate.sourceKind === "m8-critical-overall-failure"
    && equal(candidate.payload.incomingScarProposal, event.sourceProposal));
  const incoming = event.sourceProposal;
  if (proposal && (proposal.targetId !== event.pressureSystemId || !equal(proposal.payload.voidScar, event.voidScar))) return false;
  if (!exactPlainRecord(incoming, ["voidScarDefinitionId", "pressureSystemId", "source"])
    || incoming.pressureSystemId !== event.pressureSystemId
    || incoming.source !== "m8-critical-overall-failure"
    || !exactPlainRecord(event.voidScar?.source, M10_SCAR_SOURCE_FIELDS)
    || !M10_SCAR_SOURCE_FIELDS.every((key) => nonBlank(event.voidScar.source[key]))) return false;
  const source = event.voidScar.source;
  const misfortune = allStoredProposals(entry).find((candidate) => candidate.kind === "misfortune"
    && candidate.payload.misfortune.misfortuneId === source.misfortuneId);
  if (!misfortune) return false;
  const m8Sources = misfortune.payload.negativePackage.scarConsequenceProposals;
  const result = source.eventId === entry.eventId
    && source.sessionId === entry.sessionId
    && source.definitionSnapshotId === entry.definitionSnapshotId
    && source.misfortuneId === misfortune.payload.misfortune.misfortuneId
    && incoming.voidScarDefinitionId === source.voidScarDefinitionId
    && m8Sources.some((candidate) => candidate.voidScarDefinitionId === source.voidScarDefinitionId
      && candidate.pressureSystemId === incoming.pressureSystemId
      && candidate.source === "m8-critical-overall-failure");
  return result
    && source.voidScarDefinitionId === incoming.voidScarDefinitionId
    && source.voidScarDefinitionId === event.voidScar.source.voidScarDefinitionId
    && source.eventId === entry.eventId
    && source.sessionId === entry.sessionId
    && source.definitionSnapshotId === entry.definitionSnapshotId
    && event.voidScar.voidScarId === `arcflight-void-scar:${JSON.stringify([
      "m8-critical-overall-failure", source.eventId, source.sessionId,
      source.definitionSnapshotId, source.misfortuneId, source.voidScarDefinitionId,
      event.pressureSystemId
    ])}`
    && event.voidScar.sourceKind === "m8-critical-overall-failure"
    && event.voidScar.pressureSystemId === event.pressureSystemId;
}

function hasSharedReference(value, seen = new Set(), ancestors = new Set()) {
  try {
    if (value === null || typeof value !== "object") return false;
    if (ancestors.has(value) || seen.has(value)) return true;
    seen.add(value);
    ancestors.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value") || hasSharedReference(descriptor.value, seen, ancestors)) return true;
    }
    ancestors.delete(value);
    return false;
  } catch {
    return true;
  }
}

function hasSharedReceiptReference(request) {
  try {
    if (!isPlainObject(request)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(request, "receipt");
    return Boolean(descriptor && Object.hasOwn(descriptor, "value") && hasSharedReference(descriptor.value));
  } catch {
    return true;
  }
}

function validEventHistoryBinding(entry) {
  if (!validArray(entry.afterState.eventHistory) || entry.afterState.eventHistory.length !== 1) return false;
  const history = entry.afterState.eventHistory[0];
  const finalEvent = entry.events.find((event) => event.type === "voyage.closeout-applied");
  if (!finalEvent) return false;
  return history.applicationId === entry.applicationId
    && history.closeoutId === entry.closeoutId
    && history.eventId === entry.eventId
    && history.sessionId === entry.sessionId
    && history.definitionSnapshotId === entry.definitionSnapshotId
    && history.shipId === entry.shipId
    && history.previousEncounterRevision === entry.expectedEncounterRevision
    && history.encounterRevision === entry.resultingEncounterRevision
    && history.previousShipRevision === entry.expectedShipRevision
    && history.shipRevision === entry.resultingShipRevision
    && equal(history.proposalIds, finalEvent.proposalIds);
}

function validPressureMapTransition(event) {
  const systemId = event.breach.pressureSystemId;
  const previous = event.previousPressureSystems[systemId];
  const next = event.pressureSystems[systemId];
  if (!previous || !next || previous.value !== event.breach.previousValue || previous.capacity !== event.breach.capacity
    || next.value !== 0 || next.capacity !== previous.capacity) return false;
  return VOYAGE_PRESSURE_SYSTEM_IDS.every((id) => id === systemId
    || equal(event.previousPressureSystems[id], event.pressureSystems[id]));
}

function validCanonicalM6Event(event, existingHazard = null, allowPersistedCollision = false, source = null, deferCollision = false) {
  const breach = event.breach;
  const effect = event.effects[0];
  const previous = event.previousPressureSystems[breach.pressureSystemId];
  const next = event.pressureSystems[breach.pressureSystemId];
  if (!previous || !next
    || breach.remainingCapacity !== breach.capacity - breach.previousValue
    || breach.attemptedDelta !== effect.delta
    || breach.overflowDelta !== breach.attemptedDelta - breach.remainingCapacity
    || breach.overflowDelta <= 0
    || previous.value !== breach.previousValue
    || next.value !== 0) return false;
  if (event.collisionOutcome !== null) {
    if (!source && deferCollision) return true;
    if (!source && (!allowPersistedCollision || !existingHazard)) return false;
    const sourcePressureSystems = source?.pressureSystems ?? event.previousPressureSystems;
    const sourceActiveHazards = source?.activeHazards ?? [existingHazard];
    const sourcePressureEffect = source?.pressureEffect ?? event.effects[0];
    const canonical = analyzeVoyagePressureBreachCloseoutTransaction({
      expectedEncounterRevision: event.previousRevision,
      closeoutContext: {
        eventId: event.encounterId,
        sessionId: event.sessionId,
        stageId: event.stageId,
        roundNumber: event.roundNumber,
        phase: event.phase
      },
      pressureSystems: Object.values(sourcePressureSystems),
      activeHazards: sourceActiveHazards,
      pressureEffect: sourcePressureEffect
    });
    return canonical.ok && canonical.breachRequired && equal(canonical.event, event);
  }
  const canonical = analyzeVoyagePressureBreachCloseoutTransaction({
    expectedEncounterRevision: event.previousRevision,
    closeoutContext: {
      eventId: event.encounterId,
      sessionId: event.sessionId,
      stageId: event.stageId,
      roundNumber: event.roundNumber,
      phase: event.phase
    },
    pressureSystems: Object.values(event.previousPressureSystems),
    activeHazards: [],
    pressureEffect: event.effects[0]
  });
  return canonical.ok && equal(canonical.event, event);
}

function validPressureBreachSourceShape(source) {
  return exactKeys(source, PRESSURE_BREACH_SOURCE_FIELDS)
    && Number.isSafeInteger(source.breachEventIndex) && source.breachEventIndex >= 0
    && nonBlank(source.sourceHazardId)
    && Number.isSafeInteger(source.expectedEncounterRevision) && source.expectedEncounterRevision >= 0
    && exactKeys(source.closeoutContext, PRESSURE_BREACH_CONTEXT_FIELDS)
    && nonBlank(source.closeoutContext.eventId) && nonBlank(source.closeoutContext.sessionId)
    && nonBlank(source.closeoutContext.stageId) && Number.isSafeInteger(source.closeoutContext.roundNumber)
    && source.closeoutContext.phase === "cleanup-advance"
    && validPressureSystemsMap(source.pressureSystems)
    && validArray(source.activeHazards)
    && source.activeHazards.every((hazard) => validateVoyageHazardRecord(hazard, { mode: "snapshot", expectedEncounterId: source.closeoutContext.eventId }).valid)
    && validPressureEffect(source.pressureEffect)
    && source.pressureEffect.encounterId === source.closeoutContext.eventId
    && source.pressureEffect.stageId === source.closeoutContext.stageId
    && source.pressureEffect.roundNumber === source.closeoutContext.roundNumber
    && source.pressureEffect.sourceKind === "hazard-closeout"
    && source.pressureEffect.timing === "gm-confirmed"
    && source.pressureEffect.activationSource === "event-closeout"
    && source.pressureEffect.branch === "no-roll"
    && source.pressureEffect.stationId === null && source.pressureEffect.actionId === null;
}

function sourceForBreachEvent(entry, event, pressureBreachSources = null) {
  if (!validArray(pressureBreachSources)) return null;
  const index = entry.events
    .filter((candidate) => candidate.type === "voyage.pressure-breach-applied")
    .findIndex((candidate) => candidate.breach?.pressureBreachId === event?.breach?.pressureBreachId);
  return pressureBreachSources[index] ?? null;
}

function canonicalActiveHazardsAfter(entry, eventPosition) {
  const hazards = [];
  for (let index = eventPosition + 1; index < entry.events.length; index += 1) {
    const event = entry.events[index];
    if (event?.type !== "voyage.hazard-closeout-consequence-applied" || hazards.some((hazard) => hazard.hazardId === event.hazardId)) continue;
    hazards.push(event.previousHazard);
  }
  return hazards;
}

function validPressureBreachSources(entry, pressureBreachSources) {
  if (!validArray(pressureBreachSources)) return false;
  const breachEvents = entry.events.filter((event) => event.type === "voyage.pressure-breach-applied");
  if (pressureBreachSources.length !== breachEvents.length) return false;
  for (let index = 0; index < breachEvents.length; index += 1) {
    const event = breachEvents[index];
    const source = pressureBreachSources[index];
    const eventPosition = entry.events.indexOf(event);
    const preceding = eventPosition > 0 ? entry.events[eventPosition - 1] : null;
    const canonicalActiveHazards = canonicalActiveHazardsAfter(entry, eventPosition);
    if (!validPressureBreachSourceShape(source)
      || source.breachEventIndex !== index
      || !preceding || preceding.type !== "voyage.hazard-closeout-consequence-applied"
      || source.sourceHazardId !== preceding.hazardId
      || source.expectedEncounterRevision !== event.previousRevision
      || source.closeoutContext.eventId !== entry.eventId
      || source.closeoutContext.sessionId !== entry.sessionId
      || source.closeoutContext.stageId !== preceding.stageId
      || source.closeoutContext.roundNumber !== preceding.roundNumber
      || source.closeoutContext.phase !== preceding.phase
      || preceding.encounterRevision !== event.previousRevision
      || !equal(source.pressureSystems, event.previousPressureSystems)
      || !equal(source.activeHazards, canonicalActiveHazards)
      || !equal(source.pressureEffect, preceding.pressureEffect)
      || !validCanonicalM6Event(event, null, false, source)) return false;
  }
  return true;
}

function validEventRecord(event, entry, allowPersistedCollision = false, pressureBreachSource = null, deferCollision = false) {
  if (!isPlainObject(event) || !Object.hasOwn(event, "type") || !EVENT_FIELDS[event.type] || !exactKeys(event, EVENT_FIELDS[event.type])) return false;
  const type = event.type;
  if (type === "voyage.hazard-closeout-consequence-applied") {
    const validPressureConsequence = event.consequenceKind === "pressure-change"
      && event.pressureSystemId !== null
      && event.pressureEffect !== null
      && validPressureEffect(event.pressureEffect)
      && event.pressureEffect.encounterId === entry.eventId
      && event.pressureEffect.stageId === event.stageId
      && event.pressureEffect.roundNumber === event.roundNumber
      && event.pressureEffect.pressureSystemId === event.pressureSystemId
      && event.pressureEffect.sourceKind === "hazard-closeout"
      && event.pressureEffect.sourceIntentId === event.consequenceId
      && event.pressureEffect.timing === "gm-confirmed"
      && event.pressureEffect.activationSource === "event-closeout"
      && event.pressureEffect.branch === "no-roll"
      && event.pressureEffect.stationId === null
      && event.pressureEffect.actionId === null;
    const validPersistentConsequence = event.consequenceKind === "persistent-consequence"
      && event.pressureSystemId === null
      && event.pressureEffect === null;
    return [event.applicationId, event.closeoutId, event.encounterId, event.eventId, event.sessionId, event.definitionSnapshotId, event.shipId, event.stageId, event.hazardId, event.consequenceId, event.consequenceKind, event.disposition].every(nonBlank)
      && event.applicationId === entry.applicationId && event.closeoutId === entry.closeoutId && event.encounterId === entry.eventId && event.eventId === entry.eventId
      && event.sessionId === entry.sessionId && event.definitionSnapshotId === entry.definitionSnapshotId && event.shipId === entry.shipId
      && event.phase === "cleanup-advance" && event.disposition === "removed" && safeInteger(event.roundNumber)
      && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision) && event.encounterRevision === event.previousEncounterRevision + 1
      && (event.pressureEffect === null || validPressureEffect(event.pressureEffect))
      && (validPressureConsequence || validPersistentConsequence)
      && validateVoyageHazardRecord(event.previousHazard, { mode: "snapshot", expectedEncounterId: entry.eventId }).valid
      && event.previousHazard.hazardId === event.hazardId
      && validHazardCloseoutBindings(event, event.previousHazard, entry)
      && (event.pressureSystemId === null || VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureSystemId));
  }
  if (type === "voyage.pressure-breach-applied") {
    const m6ok = nonBlank(event.encounterId) && event.encounterId === entry.eventId && event.lifecycleState === "active"
      && nonBlank(event.stageId) && safeInteger(event.roundNumber) && event.phase === "cleanup-advance"
      && event.pressureEffectCount === 1 && event.appliedEffectCount === 1 && validM6Breach(event.breach) && validM6Hazard(event.hazard)
      && event.breach.encounterId === event.encounterId && event.hazard.encounterId === event.encounterId
      && event.breach.stageId === event.stageId && event.hazard.stageId === event.stageId
      && event.breach.roundNumber === event.roundNumber && event.hazard.roundNumber === event.roundNumber
      && fieldsEqual(event.hazard, event.breach, ["pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureSystemId", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility"])
      && validArray(event.effects) && event.effects.length === 1 && validPressureEffect(event.effects[0])
      && event.effects[0].encounterId === event.encounterId && event.effects[0].stageId === event.stageId
      && event.effects[0].roundNumber === event.roundNumber
      && fieldsEqual(event.breach, event.effects[0], ["encounterId", "stageId", "roundNumber", "sequence", "stationId", "actionId", "pressureSystemId", "pressureEffectId", "sourceKind", "sourceIntentId", "activationSource", "branch", "timing", "visibility"])
      && event.effects[0].delta === event.breach.attemptedDelta
      && validM6ScarSource(event.voidScarProposal)
      && fieldsEqual(event.voidScarProposal, event.breach, ["pressureBreachId", "encounterId", "stageId", "roundNumber", "effectIndex", "sequence", "stationId", "actionId", "pressureSystemId", "pressureEffectId", "sourceIntentId", "activationSource", "branch", "timing", "visibility"])
      && event.voidScarProposal.hazardId === event.hazard.hazardId
      && exactPlainRecord(event.pressureReset, ["pressureBreachId", "pressureSystemId", "previousValue", "resetValue"])
      && VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureReset.pressureSystemId) && event.pressureReset.resetValue === 0
      && validPressureSystemsMap(event.previousPressureSystems) && validPressureSystemsMap(event.pressureSystems)
      && validPressureMapTransition(event)
      && safeInteger(event.previousRevision) && safeInteger(event.revision) && event.revision === event.previousRevision + 1
      && validCanonicalM6Event(event, event.collisionOutcome === null
        ? null
        : entry.events.find((candidate) => candidate.type === "voyage.hazard-closeout-consequence-applied"
          && candidate.previousHazard?.hazardId === event.collisionOutcome.hazardId)?.previousHazard, allowPersistedCollision, pressureBreachSource, deferCollision);
    return m6ok;
  }
  if (type === "voyage.void-scar-created") {
    return nonBlank(event.shipId) && event.shipId === entry.shipId && nonBlank(event.encounterId) && event.pressureSystemId !== undefined
      && event.sourceEventType === "voyage.pressure-breach-applied" && safeInteger(event.sourceEncounterRevision)
      && validM6ScarSource(event.sourceProposal) && captureVoyageDurableVoidScarRecord(event.voidScar).ok
      && safeInteger(event.previousShipRevision) && safeInteger(event.revision) && event.revision === event.previousShipRevision + 1
      && safeInteger(event.previousVoidScarCount) && safeInteger(event.voidScarCount) && event.voidScarCount === event.previousVoidScarCount + 1
      && validM7EventBinding(event, entry);
  }
  if (type === "voyage.closeout-void-scar-created") {
    const result = [event.applicationId, event.closeoutId, event.shipId, event.eventId, event.sessionId, event.pressureSystemId].every(nonBlank)
      && event.applicationId === entry.applicationId && event.closeoutId === entry.closeoutId && event.shipId === entry.shipId && event.eventId === entry.eventId && event.sessionId === entry.sessionId
      && VOYAGE_PRESSURE_SYSTEM_IDS.includes(event.pressureSystemId) && exactPlainRecord(event.sourceProposal, ["voidScarDefinitionId", "pressureSystemId", "source"])
      && nonBlank(event.sourceProposal.voidScarDefinitionId) && event.sourceProposal.pressureSystemId === event.pressureSystemId
      && event.sourceProposal.source === "m8-critical-overall-failure"
      && exactPlainRecord(event.voidScar?.source, M10_SCAR_SOURCE_FIELDS)
      && M10_SCAR_SOURCE_FIELDS.every((key) => nonBlank(event.voidScar.source[key]))
      && captureVoyageDurableVoidScarRecord(event.voidScar).ok
      && safeInteger(event.previousShipRevision) && safeInteger(event.revision) && event.revision === event.previousShipRevision + 1
      && safeInteger(event.previousVoidScarCount) && safeInteger(event.voidScarCount) && event.voidScarCount === event.previousVoidScarCount + 1
      && validM10EventBinding(event, entry);
    return result;
  }
  if (type === "voyage.closeout-persistent-state-applied") {
    return [event.applicationId, event.closeoutId, event.shipId].every(nonBlank)
      && event.applicationId === entry.applicationId && event.closeoutId === entry.closeoutId && event.shipId === entry.shipId
      && denseStrings(event.proposalIds) && new Set(event.proposalIds).size === event.proposalIds.length
      && safeInteger(event.previousShipRevision) && safeInteger(event.revision) && event.revision === event.previousShipRevision + 1;
  }
  return [event.applicationId, event.closeoutId, event.eventId, event.sessionId, event.definitionSnapshotId, event.shipId, event.overallResult].every(nonBlank)
    && event.applicationId === entry.applicationId && event.closeoutId === entry.closeoutId && event.eventId === entry.eventId && event.sessionId === entry.sessionId
    && event.definitionSnapshotId === entry.definitionSnapshotId && event.shipId === entry.shipId && ["overall-success", "overall-failure"].includes(event.overallResult)
    && denseStrings(event.proposalIds) && safeInteger(event.previousEncounterRevision) && safeInteger(event.encounterRevision)
    && event.encounterRevision === event.previousEncounterRevision + 1 && safeInteger(event.shipRevision);
}

function validEventCollection(events, entry, allowPersistedCollision = false, pressureBreachSources = null, deferCollision = false) {
  if (!validArray(events)) return false;
  let encounterRevision = entry.expectedEncounterRevision;
  let shipRevision = entry.expectedShipRevision;
  let phase = 0;
  let finalEncounter = false;
  let finalShip = false;
  const breachRevisions = new Set();
  const breachIds = new Set();
  const m7SourceRevisions = new Set();
  const scarIds = new Set();
  const finalProposalIds = new Set(entry.afterState.eventHistory.at(-1)?.proposalIds ?? []);
  const scarProposalIds = new Set();
  for (const event of events) {
    if (event?.type === "voyage.void-scar-created") {
      if (!isPlainObject(event.sourceProposal)) return false;
      scarProposalIds.add(canonicalProposalId(entry.closeoutId, {
        kind: "void-scar-create",
        sourceKind: "m7-pressure-breach",
        sourceId: event.sourceProposal.voidScarProposalId,
        targetKind: "pressure-system",
        targetId: event.pressureSystemId
      }));
    }
    if (event?.type === "voyage.closeout-void-scar-created") {
      const source = allStoredProposals(entry).find((proposal) => proposal.kind === "void-scar-create" && equal(proposal.payload.incomingScarProposal, event.sourceProposal));
      if (source) scarProposalIds.add(source.proposalId);
      else if (isPlainObject(event.sourceProposal) && isPlainObject(event.voidScar?.source)) {
        const generated = canonicalProposalId(entry.closeoutId, {
          kind: "void-scar-create",
          sourceKind: "m8-critical-overall-failure",
          sourceId: canonicalM10ScarSourceId(event.voidScar.source, event.pressureSystemId),
          targetKind: "pressure-system",
          targetId: event.pressureSystemId
        });
        scarProposalIds.add(generated);
      }
    }
  }
  const expectedBatchProposalIds = [...finalProposalIds].filter((id) => !scarProposalIds.has(id));
  for (const event of events) {
    if (!validEventRecord(event, entry, allowPersistedCollision, sourceForBreachEvent(entry, event, pressureBreachSources), deferCollision)) return false;
    if (event.type === "voyage.hazard-closeout-consequence-applied") {
      if (phase !== 0 || finalEncounter) return false;
      if (event.previousEncounterRevision !== encounterRevision) return false;
      encounterRevision = event.encounterRevision;
    } else if (event.type === "voyage.pressure-breach-applied") {
      if (phase !== 0 || finalEncounter) return false;
      if (breachIds.has(event.breach.pressureBreachId)) return false;
      breachIds.add(event.breach.pressureBreachId);
      if (event.previousRevision !== encounterRevision) return false;
      encounterRevision = event.revision;
      breachRevisions.add(event.revision);
    } else if (event.type === "voyage.closeout-applied") {
      if (event.previousEncounterRevision !== encounterRevision || finalEncounter) return false;
      encounterRevision = event.encounterRevision;
      finalEncounter = true;
      phase = 3;
      const history = entry.afterState.eventHistory.at(-1);
      if (event.encounterRevision !== entry.resultingEncounterRevision || event.shipRevision !== entry.resultingShipRevision
        || !history || !equal(event.proposalIds, history.proposalIds) || new Set(event.proposalIds).size !== event.proposalIds.length) return false;
    } else if (event.type === "voyage.void-scar-created" || event.type === "voyage.closeout-void-scar-created") {
      if (phase > 1 || finalEncounter) return false;
      phase = 1;
      if (event.type === "voyage.void-scar-created" && (!breachRevisions.has(event.sourceEncounterRevision) || m7SourceRevisions.has(event.sourceEncounterRevision))) return false;
      if (event.type === "voyage.void-scar-created") m7SourceRevisions.add(event.sourceEncounterRevision);
      if (scarIds.has(event.voidScar.voidScarId)) return false;
      scarIds.add(event.voidScar.voidScarId);
      if (event.previousShipRevision !== shipRevision) return false;
      shipRevision = event.revision;
    } else if (event.type === "voyage.closeout-persistent-state-applied") {
      if (phase > 2 || finalEncounter) return false;
      phase = 2;
      if (event.previousShipRevision !== shipRevision || finalShip) return false;
      if (!equal(event.proposalIds, expectedBatchProposalIds)) return false;
      shipRevision = event.revision;
      finalShip = true;
    }
  }
  const valid = finalEncounter && encounterRevision === entry.resultingEncounterRevision && shipRevision === entry.resultingShipRevision;
  return valid;
}

function validLedgerEntry(entry, allowPersistedCollision = false, pressureBreachSources = null, deferCollision = false, deferCollisionApplicationId = null) {
  if (!isPlainObject(entry) || !exactKeys(entry, LEDGER_FIELDS)) return false;
  if (!["prepared-awaiting-session", "ship-applied-awaiting-session", "committed", "reconciliation-required"].includes(entry.status)) return false;
  if (![entry.applicationId, entry.closeoutId, entry.eventId, entry.sessionId, entry.definitionSnapshotId, entry.shipId, entry.gmUserId].every(nonBlank)) return false;
  if (![entry.expectedEncounterRevision, entry.resultingEncounterRevision, entry.expectedShipRevision, entry.resultingShipRevision].every((value) => Number.isSafeInteger(value) && value >= 0)) return false;
  if (!validGameplaySnapshot(entry.beforeState, entry.closeoutId) || !validGameplaySnapshot(entry.afterState, entry.closeoutId)) return false;
  if (!validCompletedSnapshot(entry.completedCloseoutSnapshot)) return false;
  if (entry.completedCloseoutSnapshot.eventId !== entry.eventId || entry.completedCloseoutSnapshot.sessionId !== entry.sessionId || entry.completedCloseoutSnapshot.definitionSnapshotId !== entry.definitionSnapshotId || entry.completedCloseoutSnapshot.shipId !== entry.shipId || entry.completedCloseoutSnapshot.encounterRevision !== entry.resultingEncounterRevision || entry.completedCloseoutSnapshot.shipRevision !== entry.resultingShipRevision || entry.beforeState.revision !== entry.expectedShipRevision || entry.afterState.revision !== entry.resultingShipRevision) return false;
  if (entry.sessionReservationReceipt && (entry.sessionReservationReceipt.applicationId !== entry.applicationId || entry.sessionReservationReceipt.closeoutId !== entry.closeoutId || entry.sessionReservationReceipt.eventId !== entry.eventId || entry.sessionReservationReceipt.sessionId !== entry.sessionId || entry.sessionReservationReceipt.definitionSnapshotId !== entry.definitionSnapshotId || entry.sessionReservationReceipt.shipId !== entry.shipId || entry.sessionReservationReceipt.expectedEncounterRevision !== entry.expectedEncounterRevision)) return false;
  if (entry.sessionCommitReceipt && (entry.sessionCommitReceipt.reservationId !== entry.sessionReservationReceipt?.reservationId || entry.sessionCommitReceipt.applicationId !== entry.applicationId || entry.sessionCommitReceipt.closeoutId !== entry.closeoutId || entry.sessionCommitReceipt.eventId !== entry.eventId || entry.sessionCommitReceipt.sessionId !== entry.sessionId || entry.sessionCommitReceipt.definitionSnapshotId !== entry.definitionSnapshotId || entry.sessionCommitReceipt.shipId !== entry.shipId || entry.sessionCommitReceipt.previousEncounterRevision !== entry.expectedEncounterRevision || entry.sessionCommitReceipt.encounterRevision !== entry.resultingEncounterRevision || !equal(entry.sessionCommitReceipt.completedCloseoutSnapshot, entry.completedCloseoutSnapshot))) return false;
  if (entry.status === "prepared-awaiting-session" && (entry.sessionReservationReceipt !== null || entry.sessionCommitReceipt !== null)) return false;
  if (entry.status === "ship-applied-awaiting-session" && (entry.sessionReservationReceipt === null || entry.sessionCommitReceipt !== null)) return false;
  if (entry.status === "committed" && (entry.sessionReservationReceipt === null || entry.sessionCommitReceipt === null)) return false;
  const p = validM9ProposalBindings(allStoredProposals(entry), entry);
  const h = validEventHistoryBinding(entry);
  const storedSources = pressureBreachSources ?? entry.sessionReservationReceipt?.pressureBreachSources ?? null;
  const entryCollisionDeferred = deferCollision || (deferCollisionApplicationId !== null && entry.applicationId === deferCollisionApplicationId);
  const e = validEventCollection(entry.events, entry, allowPersistedCollision, storedSources, entryCollisionDeferred);
  return p && h && e
    && (entry.sessionReservationReceipt === null || (exactReservationReceipt(entry.sessionReservationReceipt) && validPressureBreachSources(entry, entry.sessionReservationReceipt.pressureBreachSources)))
    && (entry.sessionCommitReceipt === null || exactCommitReceipt(entry.sessionCommitReceipt, entry));
}

function validateStoredVoyage(voyage, allowPersistedCollision = false, pressureBreachSources = null, deferCollision = false, deferCollisionApplicationId = null) {
  const captured = capture(voyage);
  if (!captured.ok || !exactKeys(captured.value, VOYAGE_FIELDS) || captured.value.schemaVersion !== 1 || !Number.isSafeInteger(captured.value.revision) || captured.value.revision < 0) return false;
  const gameplayValid = validGameplaySnapshot({
    schemaVersion: captured.value.schemaVersion,
    revision: captured.value.revision,
    voidScars: captured.value.voidScars,
    disabledSystems: captured.value.disabledSystems,
    rewards: captured.value.rewards,
    resources: captured.value.resources,
    persistentConsequences: captured.value.persistentConsequences,
    eventHistory: captured.value.eventHistory
  });
  const ledgerIds = new Set();
  const ledgerCloseouts = new Set();
  const ledgerValid = validArray(captured.value.closeoutLedger) && captured.value.closeoutLedger.every((entry) => {
    if (!validLedgerEntry(entry, allowPersistedCollision, pressureBreachSources, deferCollision, deferCollisionApplicationId) || ledgerIds.has(entry.applicationId) || ledgerCloseouts.has(entry.closeoutId)) return false;
    ledgerIds.add(entry.applicationId);
    ledgerCloseouts.add(entry.closeoutId);
    return true;
  });
  return gameplayValid && ledgerValid;
}

function readActorFlags(actor) {
  try {
    const flags = actor.flags;
    const moduleFlags = flags?.[ARCFLIGHT_MODULE_ID];
    const system = moduleFlags?.system;
    return { moduleFlags, system };
  } catch {
    return null;
  }
}

function captureActorMetadata(actor) {
  try {
    const typeDescriptor = Object.getOwnPropertyDescriptor(actor, "type");
    const flagsDescriptor = Object.getOwnPropertyDescriptor(actor, "flags");
    if (!typeDescriptor || !flagsDescriptor || typeDescriptor.enumerable !== true || flagsDescriptor.enumerable !== true
      || !Object.hasOwn(typeDescriptor, "value") || !Object.hasOwn(flagsDescriptor, "value")) return { ok: false, hostile: false, value: null };
    const flagsPrototype = Object.getPrototypeOf(flagsDescriptor.value);
    if (flagsPrototype !== Object.prototype && flagsPrototype !== null) {
      return { ok: false, hostile: flagsPrototype === undefined || Object.getPrototypeOf(flagsPrototype) !== Object.prototype, value: null };
    }
    const moduleFlags = flagsDescriptor.value?.[ARCFLIGHT_MODULE_ID];
    if (moduleFlags !== null && typeof moduleFlags === "object") {
      const modulePrototype = Object.getPrototypeOf(moduleFlags);
      if (modulePrototype !== Object.prototype && modulePrototype !== null) {
        return { ok: false, hostile: modulePrototype === undefined || Object.getPrototypeOf(modulePrototype) !== Object.prototype, value: null };
      }
    }
    const captured = capture({ type: typeDescriptor.value, flags: flagsDescriptor.value });
    return captured.ok ? { ok: true, hostile: false, value: captured.value } : { ok: false, hostile: true, value: null };
  } catch {
    return { ok: false, hostile: true, value: null };
  }
}

function projectActor(actor, validationContext = false) {
  const allowPersistedCollision = validationContext === true || validationContext?.allowPersistedCollision === true;
  const pressureBreachSources = validationContext?.pressureBreachSources ?? null;
  const deferCollision = validationContext?.deferCollision === true;
  const deferCollisionApplicationId = validationContext?.deferCollisionApplicationId ?? null;
  const metadataCapture = captureActorMetadata(actor);
  if (!metadataCapture.ok) {
    return { errors: [m10(metadataCapture.hostile ? "m10-hostile-data-capture-failed" : "m10-ship-document-not-found", metadataCapture.hostile ? "$" : "shipId")] };
  }
  const metadata = metadataCapture.value;
  if (metadata.type !== "vehicle" || !isPlainObject(metadata.flags)) {
    return { errors: [m10("m10-ship-document-not-found", "shipId")] };
  }
  const flags = readActorFlags(metadata);
  if (!flags || !isPlainObject(flags.moduleFlags) || flags.moduleFlags.enabled !== true || flags.moduleFlags.actorType !== ARCFLIGHT_SHIP_ACTOR_TYPE) {
    return { errors: [m10("m10-ship-document-not-found", "shipId")] };
  }
  const system = flags.system;
  if (!isPlainObject(system)) return { errors: [m10("m10-ship-document-not-found", "shipId")] };
  const voyageValue = system.voyage;
  if (voyageValue === undefined || voyageValue === null) {
    const legacyScar = (Array.isArray(system.voidScars) && system.voidScars.length > 0)
      || (Array.isArray(flags.moduleFlags.voidScars) && flags.moduleFlags.voidScars.length > 0);
    if (legacyScar) return { errors: [m10("m10-ambiguous-legacy-storage", `flags.${ARCFLIGHT_MODULE_ID}.system.voyage`)] };
  } else if (!validateStoredVoyage(voyageValue, allowPersistedCollision, pressureBreachSources, deferCollision, deferCollisionApplicationId)) {
    return { errors: [m10("m10-ledger-conflict", "closeoutLedger")] };
  }
  const voyage = voyageValue === undefined || voyageValue === null ? emptyVoyage() : capture(voyageValue).value;
  const installed = system.installed;
  const base = system.base;
  const platform = installed?.hullPlatform;
  const capacity = base?.hull?.voidScarCapacity;
  if (typeof platform !== "string" || getVoyageHullVoidScarCapacity(platform) !== capacity) return { errors: [m10("m10-ship-document-not-found", "shipId")] };
  const shipState = {
    shipId: actor.id,
    revision: voyage.revision,
    installed: { hullPlatform: platform },
    hull: { voidScarCapacity: capacity },
    voidScars: voyage.voidScars
  };
  const shipCapture = captureVoyageShipState(shipState);
  if (!shipCapture.ok) return { errors: shipCapture.errors };
  const gameplay = gameplayFromVoyage(voyage);
  const capturedGameplay = capture(gameplay);
  if (!capturedGameplay.ok) return { errors: [m10("m10-hostile-data-capture-failed", "$ ".trim())] };
  return { voyage, shipState: shipCapture.state, gameplay: capturedGameplay.value };
}

function actorsList(actors) {
  if (!actors) return [];
  if (Array.isArray(actors.contents)) return actors.contents;
  if (typeof actors.values === "function") {
    try { return [...actors.values()]; } catch { return []; }
  }
  if (typeof actors[Symbol.iterator] === "function") {
    try { return [...actors]; } catch { return []; }
  }
  return [];
}

function resolveActor(shipId) {
  try {
    const game = globalThis.game;
    if (!game || !game.actors) return null;
    const direct = typeof game.actors.get === "function" ? game.actors.get(shipId) : null;
    if (direct) return direct;
    const matches = actorsList(game.actors).filter((actor) => actor?.id === shipId);
    return matches.length === 1 ? matches[0] : null;
  } catch {
    return null;
  }
}

function currentGm(expectedId) {
  try {
    const game = globalThis.game;
    const active = game?.users?.activeGM;
    const user = game?.user;
    return Boolean(user?.isGM === true && active && user.id === active.id && user.id === expectedId);
  } catch {
    return false;
  }
}

function activeGmAvailable() {
  try {
    const game = globalThis.game;
    const active = game?.users?.activeGM;
    const user = game?.user;
    return Boolean(user?.isGM === true && active && user.id === active.id);
  } catch {
    return false;
  }
}

function currentActiveGmId() {
  try { return globalThis.game?.users?.activeGM?.id ?? null; } catch { return null; }
}

function writeGamePath(actor, path, value) {
  if (!actor || typeof actor.update !== "function") throw new Error("update unavailable");
  return actor.update({ [path]: value });
}

function requestShipId(value) {
  return value?.previewRequest?.closeoutSnapshot?.shipId ?? value?.reviewRequest?.previewRequest?.closeoutSnapshot?.shipId ?? null;
}

function planIdentity(value) {
  const plan = value?.applicationPlan;
  return {
    applicationId: plan?.applicationId ?? null,
    closeoutId: plan?.closeoutId ?? null,
    eventId: plan?.eventId ?? null,
    sessionId: plan?.sessionId ?? null,
    definitionSnapshotId: plan?.definitionSnapshotId ?? null,
    gmUserId: plan?.gmUserId ?? null,
    shipId: plan?.shipId ?? requestShipId(value),
    expectedEncounterRevision: plan?.expectedEncounterRevision ?? null,
    expectedShipRevision: plan?.expectedShipRevision ?? null
  };
}

function replaceLiveShipState(value, shipState) {
  const previewRequest = { ...value.previewRequest, shipState };
  const reviewPreviewRequest = { ...value.reviewRequest.previewRequest, shipState };
  const reviewRequest = { ...value.reviewRequest, previewRequest: reviewPreviewRequest };
  return { kind: "m10-apply-approved-closeout", previewRequest, reviewRequest, applicationPlan: value.applicationPlan };
}

function pureApply(value, snapshot, shipState) {
  const effective = replaceLiveShipState(value, shipState);
  return applyVoyageEncounterApprovedCloseout(snapshot, shipState, effective);
}

function ledgerFor(voyage, applicationId) {
  return voyage.closeoutLedger.find((entry) => entry.applicationId === applicationId) ?? null;
}

function ledgerIdentityMatches(entry, identity, applied = null) {
  return entry.applicationId === identity.applicationId
    && entry.closeoutId === identity.closeoutId
    && entry.eventId === identity.eventId
    && entry.sessionId === identity.sessionId
    && entry.definitionSnapshotId === identity.definitionSnapshotId
    && entry.shipId === identity.shipId
    && entry.gmUserId === identity.gmUserId
    && entry.expectedEncounterRevision === identity.expectedEncounterRevision
    && entry.expectedShipRevision === identity.expectedShipRevision
    && (!applied || (entry.resultingEncounterRevision === applied.nextCloseoutSnapshot.encounterRevision
      && entry.resultingShipRevision === applied.nextShipState.revision));
}

function conflictingLedger(voyage, identity) {
  return voyage.closeoutLedger.find((entry) => entry.closeoutId === identity.closeoutId && entry.applicationId !== identity.applicationId) ?? null;
}

function makeLedger(identity, beforeState, applied) {
  const afterState = applied.nextShipState;
  return {
    applicationId: identity.applicationId,
    closeoutId: identity.closeoutId,
    status: "prepared-awaiting-session",
    eventId: identity.eventId,
    sessionId: identity.sessionId,
    definitionSnapshotId: identity.definitionSnapshotId,
    shipId: identity.shipId,
    expectedEncounterRevision: identity.expectedEncounterRevision,
    resultingEncounterRevision: applied.nextCloseoutSnapshot.encounterRevision,
    expectedShipRevision: identity.expectedShipRevision,
    resultingShipRevision: afterState.revision,
    gmUserId: identity.gmUserId,
    beforeState,
    afterState,
    completedCloseoutSnapshot: applied.nextCloseoutSnapshot,
    events: applied.events,
    sessionReservationReceipt: null,
    sessionCommitReceipt: null
  };
}

function captureLedgerEntry(entry) {
  const captured = capture(entry);
  if (!captured.ok || !exactKeys(captured.value, LEDGER_FIELDS)) return null;
  return captured.value;
}

function replaceLedger(voyage, entry, gameplay = null) {
  return {
    ...voyage,
    ...(gameplay ? {
      revision: gameplay.revision,
      voidScars: gameplay.voidScars,
      disabledSystems: gameplay.disabledSystems,
      rewards: gameplay.rewards,
      resources: gameplay.resources,
      persistentConsequences: gameplay.persistentConsequences,
      eventHistory: gameplay.eventHistory
    } : {}),
    closeoutLedger: voyage.closeoutLedger.map((existing) => existing.applicationId === entry.applicationId ? entry : existing)
  };
}

async function markReconciliation(actor, projection, entry, expectedGmUserId = entry?.gmUserId) {
  const revision = projection.shipState.revision;
  const error = m10("m10-reconciliation-required", "closeoutLedger");
  if (!entry) return knownFailure("reconciliation-required", entry, revision, [error]);
  if (!currentGm(expectedGmUserId)) return knownFailure("reconciliation-required", entry, revision, [m10("m10-active-gm-required", "game.user")]);
  if (entry.status === "reconciliation-required") return knownFailure("reconciliation-required", entry, revision, [error]);
  const nextEntry = { ...entry, status: "reconciliation-required" };
  const latest = await rereadAndProject(actor.id);
  if (latest.errors) return knownFailure("reconciliation-required", entry, revision, [latest.errors[0]]);
  if (latest.shipState.shipId !== actor.id || latest.shipState.revision !== revision) return knownFailure("reconciliation-required", entry, latest.shipState.revision, [m10("m10-reconciliation-required", "closeoutLedger")]);
  if (!currentGm(expectedGmUserId)) return knownFailure("reconciliation-required", entry, latest.shipState.revision, [m10("m10-active-gm-required", "game.user")]);
  const latestEntry = ledgerFor(latest.voyage, entry.applicationId);
  if (!latestEntry || !equal(latestEntry, entry)) return knownFailure("reconciliation-required", latestEntry ?? entry, latest.shipState.revision, [m10("m10-reconciliation-required", "closeoutLedger")]);
  const latestLedger = latest.voyage.closeoutLedger.map((existing) => existing.applicationId === entry.applicationId ? nextEntry : existing);
  const latestCaptured = capture(latestLedger);
  if (!latestCaptured.ok) return knownFailure("reconciliation-required", entry, latest.shipState.revision, [error]);
  try {
    if (!currentGm(expectedGmUserId)) return knownFailure("reconciliation-required", entry, latest.shipState.revision, [m10("m10-active-gm-required", "game.user")]);
    await writeGamePath(latest.actor, VOYAGE_LEDGER_PATH, latestCaptured.value);
  } catch {
    return knownFailure("reconciliation-required", entry, revision, [m10("m10-persistence-write-failed", VOYAGE_PATH)]);
  }
  const reread = await rereadAndProject(actor.id);
  const verified = !reread.errors && ledgerFor(reread.voyage, entry.applicationId)?.status === "reconciliation-required";
  return verified
    ? knownFailure("reconciliation-required", nextEntry, reread.shipState.revision, [error])
    : knownFailure("reconciliation-required", entry, revision, [m10("m10-persistence-write-failed", VOYAGE_PATH)]);
}

async function classifyVerificationFailure(actor, applicationId, expectedGameplay, expectedGmUserId) {
  const reread = await rereadAndProject(actor.id);
  if (reread.errors) return failure([m10("m10-persistence-write-failed", VOYAGE_PATH)]);
  const entry = ledgerFor(reread.voyage, applicationId);
  if (!entry || entry.status === "committed" || !equal(reread.gameplay, expectedGameplay)) return failure([m10("m10-persistence-write-failed", VOYAGE_PATH)]);
  return markReconciliation(actor, reread, entry, expectedGmUserId);
}

async function rereadAndProject(shipId, validationContext = false) {
  const actor = resolveActor(shipId);
  if (!actor) return { errors: [m10("m10-ship-document-not-found", "shipId")] };
  const projection = projectActor(actor, validationContext);
  return projection.errors ? projection : { ...projection, actor };
}

function resolveCheckpointActors() {
  const matches = [];
  for (const candidate of actorsList(globalThis.game?.actors)) {
    try {
      const typeDescriptor = Object.getOwnPropertyDescriptor(candidate, "type");
      const flagsDescriptor = Object.getOwnPropertyDescriptor(candidate, "flags");
      if (!typeDescriptor || !flagsDescriptor || typeDescriptor.enumerable !== true || flagsDescriptor.enumerable !== true
        || !Object.hasOwn(typeDescriptor, "value") || !Object.hasOwn(flagsDescriptor, "value") || typeDescriptor.value !== "vehicle") continue;
      const flags = flagsDescriptor.value;
      if (!isPlainObject(flags)) continue;
      const moduleDescriptor = Object.getOwnPropertyDescriptor(flags, ARCFLIGHT_MODULE_ID);
      if (!moduleDescriptor || moduleDescriptor.enumerable !== true || !Object.hasOwn(moduleDescriptor, "value") || !isPlainObject(moduleDescriptor.value)) continue;
      const moduleFlags = moduleDescriptor.value;
      const enabledDescriptor = Object.getOwnPropertyDescriptor(moduleFlags, "enabled");
      const actorTypeDescriptor = Object.getOwnPropertyDescriptor(moduleFlags, "actorType");
      if (!enabledDescriptor || !actorTypeDescriptor || enabledDescriptor.enumerable !== true || actorTypeDescriptor.enumerable !== true
        || !Object.hasOwn(enabledDescriptor, "value") || !Object.hasOwn(actorTypeDescriptor, "value")
        || enabledDescriptor.value !== true || actorTypeDescriptor.value !== ARCFLIGHT_SHIP_ACTOR_TYPE) continue;
      matches.push(candidate);
    } catch {
      continue;
    }
  }
  return matches;
}

async function persistPrepared(actor, projection, entry, identity) {
  if (!currentGm(identity.gmUserId)) return { errors: [m10("m10-active-gm-required", "game.user")] };
  const latest = await rereadAndProject(identity.shipId);
  if (latest.errors) return { errors: latest.errors };
  if (latest.shipState.shipId !== identity.shipId || latest.shipState.revision !== projection.shipState.revision) return { errors: [m10("m10-ship-revision-mismatch", "expectedShipRevision")] };
  if (!equal(latest.gameplay, entry.beforeState)) return { errors: [m10("m10-reconciliation-required", "closeoutLedger")] };
  if (ledgerFor(latest.voyage, entry.applicationId)) return { errors: [m10("m10-reconciliation-required", "closeoutLedger")] };
  const nextLedger = [...latest.voyage.closeoutLedger, entry];
  const captured = capture(nextLedger);
  if (!captured.ok) return { errors: [m10("m10-persistence-write-failed", VOYAGE_PATH)] };
  try {
    if (!currentGm(identity.gmUserId)) return { errors: [m10("m10-active-gm-required", "game.user")] };
    await writeGamePath(latest.actor, VOYAGE_LEDGER_PATH, captured.value);
  } catch {
    return { errors: [m10("m10-persistence-write-failed", VOYAGE_PATH)] };
  }
  const reread = await rereadAndProject(identity.shipId, true);
  if (reread.errors || !equal(reread.voyage.closeoutLedger, captured.value) || !equal(reread.gameplay, entry.beforeState)) return { response: await classifyVerificationFailure(actor, identity.applicationId, entry.beforeState, identity.gmUserId) };
  return { entry, revision: reread.shipState.revision };
}

function exactReservationReceipt(receipt) {
  return exactKeys(receipt, RECEIPT_RESERVATION_FIELDS)
    && receipt.kind === "voyage.m11-closeout-session-reserved"
    && [receipt.reservationId, receipt.activeGmUserId, receipt.applicationId, receipt.closeoutId, receipt.eventId, receipt.sessionId, receipt.definitionSnapshotId, receipt.shipId].every(nonBlank)
    && Number.isSafeInteger(receipt.expectedEncounterRevision) && receipt.expectedEncounterRevision >= 0
    && validArray(receipt.pressureBreachSources)
    && receipt.reservationId === `arcflight-closeout-reservation:${JSON.stringify([receipt.applicationId])}`;
}

function exactCommitReceipt(receipt, entry = null) {
  return exactKeys(receipt, RECEIPT_COMMIT_FIELDS)
    && receipt.kind === "voyage.m11-closeout-session-committed"
    && [receipt.reservationId, receipt.activeGmUserId, receipt.applicationId, receipt.closeoutId, receipt.eventId, receipt.sessionId, receipt.definitionSnapshotId, receipt.shipId].every(nonBlank)
    && [receipt.previousEncounterRevision, receipt.encounterRevision].every((value) => Number.isSafeInteger(value) && value >= 0)
    && validCompletedSnapshot(receipt.completedCloseoutSnapshot)
    && validArray(receipt.encounterEvents)
    && receipt.encounterEvents.every((event) => isPlainObject(event) && EVENT_FIELDS[event.type] && exactKeys(event, EVENT_FIELDS[event.type]))
    && validArray(receipt.pressureBreachSources)
    && (!entry || (validPressureBreachSources(entry, receipt.pressureBreachSources)
      && receipt.encounterEvents.every((event) => validEventRecord(event, entry, false, sourceForBreachEvent(entry, event, receipt.pressureBreachSources)))
      && equal(receipt.encounterEvents, commitEvents(entry))));
}

function reservationMatches(entry, receipt) {
  return exactReservationReceipt(receipt)
    && receipt.activeGmUserId === currentActiveGmId()
    && receipt.applicationId === entry.applicationId
    && receipt.closeoutId === entry.closeoutId
    && receipt.eventId === entry.eventId
    && receipt.sessionId === entry.sessionId
    && receipt.definitionSnapshotId === entry.definitionSnapshotId
    && receipt.shipId === entry.shipId
    && receipt.expectedEncounterRevision === entry.expectedEncounterRevision
    && validPressureBreachSources(entry, receipt.pressureBreachSources);
}

function commitEvents(entry) {
  return entry.events.filter((event) => event.type === "voyage.hazard-closeout-consequence-applied" || event.type === "voyage.pressure-breach-applied" || event.type === "voyage.closeout-applied");
}

function commitMatches(entry, receipt) {
  return exactCommitReceipt(receipt, entry)
    && receipt.activeGmUserId === currentActiveGmId()
    && receipt.reservationId === entry.sessionReservationReceipt?.reservationId
    && receipt.applicationId === entry.applicationId
    && receipt.closeoutId === entry.closeoutId
    && receipt.eventId === entry.eventId
    && receipt.sessionId === entry.sessionId
    && receipt.definitionSnapshotId === entry.definitionSnapshotId
    && receipt.shipId === entry.shipId
    && receipt.previousEncounterRevision === entry.expectedEncounterRevision
    && receipt.encounterRevision === entry.resultingEncounterRevision
    && equal(receipt.completedCloseoutSnapshot, entry.completedCloseoutSnapshot)
    && equal(receipt.pressureBreachSources, entry.sessionReservationReceipt?.pressureBreachSources)
    && equal(receipt.encounterEvents, commitEvents(entry));
}

function validateContinuation(value) {
  if (!exactKeys(value, CONTINUE_FIELDS)) return [m10("m10-invalid-request-shape", "request")];
  if (typeof value.applicationId !== "string" || value.applicationId.trim() !== value.applicationId || value.applicationId.length === 0) return [m10("m10-invalid-request-shape", "request.applicationId")];
  return [];
}

function validateCheckpoint(value) {
  if (!exactKeys(value, CHECKPOINT_FIELDS)) return [m10("m10-invalid-request-shape", "request")];
  if (typeof value.applicationId !== "string" || typeof value.reservationId !== "string") return [m10("m10-invalid-request-shape", "request")];
  return [];
}

async function capturePublicRequest(request, fields, mode, requiredAuthority = []) {
  const result = captureRequest(request, fields, mode, requiredAuthority);
  if (result.errors.length > 0) return result;
  return result;
}

export async function persistVoyageEncounterApprovedCloseout(request) {
  try {
    const captured = await capturePublicRequest(request, PERSIST_FIELDS, "m10-persist-approved-closeout", ["applicationPlan"]);
    if (captured.errors.length > 0) return failure(captured.errors);
    const value = captured.value;
    const identity = planIdentity(value);
    const actor = resolveActor(requestShipId(value));
    if (!actor) return failure([m10("m10-ship-document-not-found", "shipId")]);
    if (!currentGm(identity.gmUserId)) return failure([m10("m10-active-gm-required", "game.user")]);
    const projection = projectActor(actor, { deferCollisionApplicationId: identity.applicationId });
    if (projection.errors) return failure(projection.errors);
    const existing = ledgerFor(projection.voyage, identity.applicationId);
    if (existing) {
      if (!ledgerIdentityMatches(existing, identity)) {
        return failure([m10("m10-ledger-conflict", "closeoutLedger")]);
      }
      const regenerated = pureApply(value, value.previewRequest.closeoutSnapshot, projection.shipState);
      if (!regenerated.ok) {
        if (existing.status === "committed" && !equal(projection.gameplay, existing.afterState)) {
          return knownFailure("reconciliation-required", existing, projection.shipState.revision, [m10("m10-reconciliation-required", "closeoutLedger")]);
        }
        return failure([m10("m10-ledger-conflict", "closeoutLedger")]);
      }
      const regeneratedIdentity = {
        ...identity,
        eventId: regenerated.nextCloseoutSnapshot.eventId,
        sessionId: regenerated.nextCloseoutSnapshot.sessionId,
        definitionSnapshotId: regenerated.nextCloseoutSnapshot.definitionSnapshotId,
        shipId: regenerated.nextCloseoutSnapshot.shipId
      };
      if (!ledgerIdentityMatches(existing, regeneratedIdentity, regenerated)) return failure([m10("m10-ledger-conflict", "closeoutLedger")]);
      if (!equal(existing.events, regenerated.events)
        || !equal(existing.completedCloseoutSnapshot, regenerated.nextCloseoutSnapshot)
        || !equal(existing.afterState, regenerated.nextShipState)) return failure([m10("m10-ledger-conflict", "closeoutLedger")]);
      if (existing.status === "prepared-awaiting-session" && equal(projection.gameplay, existing.beforeState)) return success("already-prepared-awaiting-session", existing, projection.shipState.revision);
      if (existing.status === "ship-applied-awaiting-session" && equal(projection.gameplay, existing.afterState)) return success("already-ship-applied-awaiting-session", existing, projection.shipState.revision);
      if (existing.status === "committed") {
        if (equal(projection.gameplay, existing.afterState)) return success("already-committed", existing, projection.shipState.revision);
        return knownFailure("reconciliation-required", existing, projection.shipState.revision, [m10("m10-reconciliation-required", "closeoutLedger")]);
      }
      return markReconciliation(actor, projection, existing);
    }
    if (conflictingLedger(projection.voyage, identity)) return failure([m10("m10-ledger-conflict", "closeoutLedger")]);
    const applied = pureApply(value, value.previewRequest.closeoutSnapshot, projection.shipState);
    if (!applied.ok) return failure(applied.errors);
    const appliedIdentity = {
      ...identity,
      eventId: applied.nextCloseoutSnapshot.eventId,
      sessionId: applied.nextCloseoutSnapshot.sessionId,
      definitionSnapshotId: applied.nextCloseoutSnapshot.definitionSnapshotId,
      shipId: applied.nextCloseoutSnapshot.shipId
    };
    if (appliedIdentity.shipId !== actor.id || appliedIdentity.expectedShipRevision !== projection.shipState.revision) return failure([m10("m10-ship-revision-mismatch", "expectedShipRevision")]);
    const beforeState = projection.gameplay;
    const entry = makeLedger(appliedIdentity, beforeState, applied);
    const written = await persistPrepared(actor, projection, entry, appliedIdentity);
    if (written.response) return written.response;
    if (written.errors) return failure(written.errors);
    return success("prepared-awaiting-session", entry, written.revision);
  } catch {
    return failure([m10("m10-hostile-data-capture-failed", "$")]);
  }
}

export async function continueVoyageEncounterCloseoutReservation(request) {
  try {
    if (hasSharedReceiptReference(request)) return failure([m10("m10-invalid-session-reservation-receipt", "receipt")]);
    const captured = await capturePublicRequest(request, CONTINUE_FIELDS, "m10-continue-closeout-reservation", ["applicationId", "receipt"]);
    if (captured.errors.length > 0) return failure(captured.errors);
    const value = captured.value;
    if (value.receipt === null || value.receipt === undefined) return failure([m10("m10-session-reservation-receipt-required", "receipt")]);
    const actorId = value.receipt?.shipId;
    const actor = resolveActor(actorId);
    if (!actor) return failure([m10("m10-ship-document-not-found", "shipId")]);
    if (!currentGm(value.receipt.activeGmUserId)) return failure([m10("m10-active-gm-required", "game.user")]);
    const projection = projectActor(actor, { allowPersistedCollision: true, deferCollision: true });
    if (projection.errors) return failure(projection.errors);
    const entry = ledgerFor(projection.voyage, value.applicationId);
    if (!entry) return failure([m10("m10-ledger-conflict", "closeoutLedger")]);
    const reservationValid = reservationMatches(entry, value.receipt);
    if (!reservationValid) return failure([m10("m10-invalid-session-reservation-receipt", "receipt")]);
    if (entry.status === "committed") {
      if (equal(projection.gameplay, entry.afterState)) return success("already-committed", entry, projection.shipState.revision);
      return knownFailure("reconciliation-required", entry, projection.shipState.revision, [m10("m10-reconciliation-required", "closeoutLedger")]);
    }
    if (entry.status === "ship-applied-awaiting-session" && equal(projection.gameplay, entry.afterState)) return success("already-ship-applied-awaiting-session", entry, projection.shipState.revision);
    if (entry.status !== "prepared-awaiting-session") return markReconciliation(actor, projection, entry, value.receipt.activeGmUserId);
    if (!equal(projection.gameplay, entry.beforeState)) return failure([m10("m10-reconciliation-required", "closeoutLedger")]);
    if (!currentGm(value.receipt.activeGmUserId)) return failure([m10("m10-active-gm-required", "game.user")]);
    if (projection.shipState.revision !== entry.expectedShipRevision) return failure([m10("m10-ship-revision-mismatch", "expectedShipRevision")]);
    const latest = await rereadAndProject(actor.id, { allowPersistedCollision: true, deferCollision: true });
    if (latest.errors) return failure(latest.errors);
    if (latest.shipState.shipId !== actor.id || latest.shipState.revision !== entry.expectedShipRevision) return failure([m10("m10-ship-revision-mismatch", "expectedShipRevision")]);
    if (!equal(latest.gameplay, entry.beforeState)) return failure([m10("m10-reconciliation-required", "closeoutLedger")]);
    const latestEntry = ledgerFor(latest.voyage, entry.applicationId);
    if (!latestEntry || !equal(latestEntry, entry)) return failure([m10("m10-reconciliation-required", "closeoutLedger")]);
    const nextEntry = { ...entry, status: "ship-applied-awaiting-session", sessionReservationReceipt: value.receipt };
    const nextVoyage = replaceLedger(latest.voyage, nextEntry, entry.afterState);
    const capturedVoyage = capture(nextVoyage);
    try {
      if (!capturedVoyage.ok) throw new Error("capture");
      if (!currentGm(value.receipt.activeGmUserId)) return failure([m10("m10-active-gm-required", "game.user")]);
      await writeGamePath(latest.actor, VOYAGE_PATH, capturedVoyage.value);
    } catch (error) {
      if (error?.message === "M10 active GM") return failure([m10("m10-active-gm-required", "game.user")]);
      return failure([m10("m10-persistence-write-failed", VOYAGE_PATH)]);
    }
    const reread = await rereadAndProject(actor.id);
    if (reread.errors || !equal(reread.gameplay, entry.afterState) || !equal(ledgerFor(reread.voyage, entry.applicationId), nextEntry)) return classifyVerificationFailure(actor, entry.applicationId, entry.afterState, value.receipt.activeGmUserId);
    return success("ship-applied-awaiting-session", nextEntry, reread.shipState.revision);
  } catch {
    return failure([m10("m10-hostile-data-capture-failed", "$")]);
  }
}

export async function verifyVoyageEncounterCloseoutShipCheckpoint(request) {
  try {
    const captured = await capturePublicRequest(request, CHECKPOINT_FIELDS, "m10-verify-closeout-ship-checkpoint", ["applicationId"]);
    if (captured.errors.length > 0) return checkpointFailure(captured.errors);
    const value = captured.value;
    const candidates = resolveCheckpointActors();
    if (candidates.length === 0) return checkpointFailure([m10("m10-ship-document-not-found", "shipId")]);
    if (!activeGmAvailable()) return checkpointFailure([m10("m10-active-gm-required", "game.user")]);
    const projections = candidates.map((candidate) => ({ candidate, projection: projectActor(candidate) }));
    const matching = projections.filter(({ projection }) => !projection.errors && ledgerFor(projection.voyage, value.applicationId));
    if (matching.length !== 1) {
      if (candidates.length === 1 && projections[0].projection.errors) return checkpointFailure(projections[0].projection.errors);
      return checkpointFailure([m10("m10-ship-document-not-found", "shipId")]);
    }
    const projection = matching[0].projection;
    const entry = ledgerFor(projection.voyage, value.applicationId);
    if (!entry || entry.status !== "ship-applied-awaiting-session" || entry.sessionReservationReceipt?.reservationId !== value.reservationId || !equal(projection.gameplay, entry.afterState)) return checkpointFailure([m10("m10-ledger-conflict", "closeoutLedger")]);
    return checkpointSuccess(entry);
  } catch {
    return checkpointFailure([m10("m10-hostile-data-capture-failed", "$")]);
  }
}

export async function finalizeVoyageEncounterCloseoutReceipt(request) {
  try {
    if (hasSharedReceiptReference(request)) return failure([m10("m10-invalid-session-commit-receipt", "receipt")]);
    const captured = await capturePublicRequest(request, FINALIZE_FIELDS, "m10-finalize-closeout-receipt", ["applicationId", "receipt"]);
    if (captured.errors.length > 0) return failure(captured.errors);
    const value = captured.value;
    if (value.receipt === null || value.receipt === undefined) return failure([m10("m10-session-commit-receipt-required", "receipt")]);
    const actor = resolveActor(value.receipt.shipId);
    if (!actor) return failure([m10("m10-ship-document-not-found", "shipId")]);
    if (!currentGm(value.receipt.activeGmUserId)) return failure([m10("m10-active-gm-required", "game.user")]);
    const projection = projectActor(actor, { allowPersistedCollision: true, deferCollision: true });
    if (projection.errors) return failure(projection.errors);
    const entry = ledgerFor(projection.voyage, value.applicationId);
    if (!entry) return failure([m10("m10-ledger-conflict", "closeoutLedger")]);
    const commitValid = commitMatches(entry, value.receipt);
    if (entry.status === "committed") {
      if (commitValid) return success("already-committed", entry, projection.shipState.revision);
      return failure([m10("m10-invalid-session-commit-receipt", "receipt")]);
    }
    if (!commitValid) return failure([m10("m10-invalid-session-commit-receipt", "receipt")]);
    if (entry.status !== "ship-applied-awaiting-session") return markReconciliation(actor, projection, entry, value.receipt.activeGmUserId);
    if (!equal(projection.gameplay, entry.afterState)) return failure([m10("m10-reconciliation-required", "closeoutLedger")]);
    if (!currentGm(value.receipt.activeGmUserId)) return failure([m10("m10-active-gm-required", "game.user")]);
    const latest = await rereadAndProject(actor.id);
    if (latest.errors) return failure(latest.errors);
    if (latest.shipState.shipId !== actor.id || latest.shipState.revision !== entry.resultingShipRevision) return failure([m10("m10-ship-revision-mismatch", "expectedShipRevision")]);
    if (!equal(latest.gameplay, entry.afterState)) return markReconciliation(actor, latest, entry);
    const latestEntry = ledgerFor(latest.voyage, entry.applicationId);
    if (!latestEntry || !equal(latestEntry, entry)) return failure([m10("m10-reconciliation-required", "closeoutLedger")]);
    const nextEntry = { ...entry, status: "committed", sessionCommitReceipt: value.receipt };
    const capturedLedger = capture(nextEntry);
    if (!capturedLedger.ok) return failure([m10("m10-persistence-write-failed", VOYAGE_PATH)]);
    try {
      if (!currentGm(value.receipt.activeGmUserId)) return failure([m10("m10-active-gm-required", "game.user")]);
      await writeGamePath(latest.actor, VOYAGE_LEDGER_PATH, latest.voyage.closeoutLedger.map((existing) => existing.applicationId === entry.applicationId ? capturedLedger.value : existing));
    } catch {
      return failure([m10("m10-persistence-write-failed", VOYAGE_PATH)]);
    }
    const reread = await rereadAndProject(actor.id);
    if (reread.errors || !equal(reread.gameplay, entry.afterState) || ledgerFor(reread.voyage, entry.applicationId)?.status !== "committed") return classifyVerificationFailure(actor, entry.applicationId, entry.afterState, value.receipt.activeGmUserId);
    return success("committed", nextEntry, reread.shipState.revision);
  } catch {
    return failure([m10("m10-hostile-data-capture-failed", "$")]);
  }
}
