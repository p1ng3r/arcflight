import {
  analyzeVoyageEncounterCloseoutPreview,
  analyzeVoyageEncounterCloseoutPressureBreach,
  captureVoyageEncounterCloseoutSnapshot
} from "./closeout.js";
import { captureVoyageShipState } from "./ship-state.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const REVIEW_FIELDS = Object.freeze(["kind", "sessionId", "gmUserId", "confirmed", "previewRequest", "suppliedPreview"]);
const APPLY_FIELDS = Object.freeze(["kind", "previewRequest", "reviewRequest", "applicationPlan"]);
const REVIEW_PROHIBITED = Object.freeze([
  "overallResult", "rewardAnalysis", "negativeAnalysis", "resultPackage", "hazardPlan", "pressurePlan", "breachPlan",
  "capacityAnalysis", "capacityExhaustion", "breakdownPlan", "outcomeProposal", "persistentProposals", "temporaryResetPlan",
  "preview", "previewId", "approved", "gmApproved", "approvalToken", "applicationId", "applicationPlan", "nextEncounterState",
  "nextCloseoutSnapshot", "nextShipState", "events", "patch", "ledgerEntry", "idempotencyStatus", "receipt",
  "sessionCommitReceipt", "requestId", "timestamp"
]);
const APPLY_PROHIBITED = Object.freeze(REVIEW_PROHIBITED.filter((key) => key !== "applicationPlan"));

function diagnostic(code, path, message, severity = "error") {
  return { code, path, message, severity };
}

const MESSAGES = Object.freeze({
  hostile: "M10 data could not be captured safely.",
  authority: "Caller supplied calculated, application, persistence, or runtime authority.",
  mode: "The requested M10 API mode is invalid.",
  shape: "Request shape, order, or root values are invalid.",
  previewMismatch: "Supplied preview differs from regenerated preview.",
  confirmation: "Complete GM confirmation is required.",
  planMismatch: "Supplied plan differs from regenerated plan.",
  invalidSnapshot: "Closeout snapshot is invalid.",
  emergency: "Breakdown requires completed Emergency Response before application.",
  session: "Session identity is not bound.",
  event: "Event identity is not bound.",
  definition: "Definition snapshot is not bound.",
  ship: "Ship identity is not bound.",
  encounterRevision: "Encounter revision is stale.",
  shipRevision: "Ship revision is stale.",
  duplicate: "Pure state already contains this application."
});

function m10(code, path, severity = "error") {
  const text = {
    "m10-hostile-data-capture-failed": MESSAGES.hostile,
    "m10-caller-authority-rejected": MESSAGES.authority,
    "m10-invalid-mode": MESSAGES.mode,
    "m10-invalid-request-shape": MESSAGES.shape,
    "m10-invalid-closeout-snapshot": MESSAGES.invalidSnapshot,
    "m10-preview-mismatch": MESSAGES.previewMismatch,
    "m10-gm-confirmation-required": MESSAGES.confirmation,
    "m10-application-plan-mismatch": MESSAGES.planMismatch,
    "m10-emergency-response-required": MESSAGES.emergency,
    "m10-session-identity-mismatch": MESSAGES.session,
    "m10-event-identity-mismatch": MESSAGES.event,
    "m10-definition-snapshot-mismatch": MESSAGES.definition,
    "m10-ship-identity-mismatch": MESSAGES.ship,
    "m10-encounter-revision-mismatch": MESSAGES.encounterRevision,
    "m10-ship-revision-mismatch": MESSAGES.shipRevision,
    "m10-closeout-already-applied": MESSAGES.duplicate
  };
  return diagnostic(code, path, text[code] ?? "M10 data is invalid.", severity);
}

function dedupe(errors) {
  const seen = new Set();
  return errors.filter((entry) => {
    const key = JSON.stringify([entry.code, entry.path, entry.message, entry.severity]);
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
    if (typeof value === "number") return Number.isSafeInteger(value) ? { ok: true, value } : { ok: false, value: null };
    if (typeof value !== "object" || ancestors.has(value)) return { ok: false, value: null };
    const array = Array.isArray(value);
    const proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) return { ok: false, value: null };
    const keys = Reflect.ownKeys(value);
    ancestors.add(value);
    try {
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
        if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) return { ok: false, value: null };
        const out = new Array(length);
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
          const nested = capture(descriptor.value, ancestors);
          if (!nested.ok) return nested;
          out[index] = nested.value;
        }
        for (const key of keys) {
          if (key === "length") continue;
          if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) return { ok: false, value: null };
        }
        return { ok: true, value: out };
      }
      const out = {};
      for (const key of keys) {
        if (typeof key !== "string" || UNSAFE_KEYS.has(key)) return { ok: false, value: null };
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, "value")) return { ok: false, value: null };
        const nested = capture(descriptor.value, ancestors);
        if (!nested.ok) return nested;
        out[key] = nested.value;
      }
      return { ok: true, value: out };
    } finally {
      ancestors.delete(value);
    }
  } catch {
    return { ok: false, value: null };
  }
}

function exactKeys(value, fields) {
  return isPlainObject(value) && Object.keys(value).length === fields.length && Object.keys(value).every((key, index) => key === fields[index]);
}

function equal(left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => equal(value, right[index]));
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
}

function reviewFailure(errors) {
  return {
    ok: false,
    readyForEmergencyResponse: false,
    readyForControlledApplication: false,
    closeoutId: null,
    emergencyResponseHandoff: null,
    applicationPlan: null,
    errors: dedupe(errors),
    warnings: []
  };
}

function reviewSuccess(values) {
  return {
    ok: true,
    readyForEmergencyResponse: Boolean(values.readyForEmergencyResponse),
    readyForControlledApplication: Boolean(values.readyForControlledApplication),
    closeoutId: values.closeoutId,
    emergencyResponseHandoff: values.emergencyResponseHandoff ?? null,
    applicationPlan: values.applicationPlan ?? null,
    errors: [],
    warnings: values.warnings ?? []
  };
}

function applicationFailure(errors) {
  return {
    ok: false,
    applicationId: null,
    closeoutId: null,
    nextCloseoutSnapshot: null,
    nextShipState: null,
    events: [],
    errors: dedupe(errors),
    warnings: []
  };
}

function applicationId(closeoutId) {
  return `arcflight-closeout-application:${JSON.stringify([closeoutId])}`;
}

function gmEvidence(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function buildHandoff(previewRequest, preview) {
  const index = preview.breakdownResults.findIndex((entry) => entry.emergencyResponseAnalysis === null);
  if (index < 0) return null;
  const result = preview.breakdownResults[index];
  const definitions = previewRequest.breakdownDefinitions.filter((entry) => entry.breakdownDefinitionId === result.breakdownDefinitionId);
  if (definitions.length !== 1) return null;
  return {
    kind: "voyage.m10-emergency-response-required",
    closeoutId: preview.closeoutId,
    eventId: preview.eventId,
    sessionId: preview.sessionId,
    definitionSnapshotId: preview.definitionSnapshotId,
    shipId: preview.shipId,
    expectedEncounterRevision: preview.expectedEncounterRevision,
    expectedShipRevision: preview.expectedShipRevision,
    breakdownDefinition: definitions[0],
    breakdownPlan: result.breakdownAnalysis.breakdownPlan
  };
}

function makePlan(previewRequest, preview, gmUserId) {
  const persistentProposals = capture(preview.persistentProposals);
  const temporaryResetPlan = capture(preview.temporaryResetPlan);
  const expectedPreview = capture(preview);
  if (!persistentProposals.ok || !temporaryResetPlan.ok || !expectedPreview.ok) return null;
  return {
    schemaVersion: 1,
    applicationId: applicationId(preview.closeoutId),
    closeoutId: preview.closeoutId,
    eventId: preview.eventId,
    sessionId: preview.sessionId,
    definitionSnapshotId: preview.definitionSnapshotId,
    shipId: preview.shipId,
    expectedEncounterRevision: preview.expectedEncounterRevision,
    expectedShipRevision: preview.expectedShipRevision,
    gmUserId,
    persistentProposals: persistentProposals.value,
    temporaryResetPlan: temporaryResetPlan.value,
    expectedPreview: expectedPreview.value
  };
}

function validateReviewRequest(value) {
  if (!exactKeys(value, REVIEW_FIELDS)) return [m10("m10-invalid-request-shape", "request")];
  if (value.kind !== "m10-closeout-review") return [m10("m10-invalid-mode", "request.kind")];
  if (!gmEvidence(value.sessionId) || !gmEvidence(value.gmUserId) || typeof value.confirmed !== "boolean" || !isPlainObject(value.previewRequest) || !isPlainObject(value.suppliedPreview)) {
    return [m10("m10-invalid-request-shape", "request")];
  }
  return [];
}

export function analyzeVoyageEncounterCloseoutReview(request) {
  const captured = capture(request);
  if (!captured.ok) return reviewFailure([m10("m10-hostile-data-capture-failed", "$")]);
  const value = captured.value;
  if (!isPlainObject(value)) return reviewFailure([m10("m10-invalid-request-shape", "request")]);
  const authority = REVIEW_PROHIBITED.filter((key) => Object.hasOwn(value, key));
  if (authority.length > 0) return reviewFailure(authority.map((key) => m10("m10-caller-authority-rejected", `request.${key}`)));
  const shapeErrors = validateReviewRequest(value);
  if (shapeErrors.length > 0) return reviewFailure(shapeErrors);

  const regenerated = analyzeVoyageEncounterCloseoutPreview(value.previewRequest);
  if (!regenerated.ok) return reviewFailure(regenerated.errors);
  if (!equal(regenerated.preview, value.suppliedPreview)) return reviewFailure([m10("m10-preview-mismatch", "suppliedPreview")]);
  if (value.confirmed !== true) return reviewFailure([m10("m10-gm-confirmation-required", "confirmed")]);
  if (regenerated.preview.sessionId !== value.sessionId) return reviewFailure([m10("m10-session-identity-mismatch", "sessionId")]);

  if (regenerated.preview.blockedByEmergencyResponse) {
    const handoff = buildHandoff(value.previewRequest, regenerated.preview);
    if (!handoff) return reviewFailure([m10("m10-emergency-response-required", "emergencyResponseEvidence[0]")]);
    return reviewSuccess({
      readyForEmergencyResponse: true,
      readyForControlledApplication: false,
      closeoutId: regenerated.closeoutId,
      emergencyResponseHandoff: handoff,
      warnings: regenerated.warnings
    });
  }
  const applicationPlan = makePlan(value.previewRequest, regenerated.preview, value.gmUserId);
  if (!applicationPlan) return reviewFailure([m10("m10-pressure-closeout-failed", "preview")]);
  return reviewSuccess({
    readyForEmergencyResponse: false,
    readyForControlledApplication: true,
    closeoutId: regenerated.closeoutId,
    applicationPlan,
    warnings: regenerated.warnings
  });
}

function hazardById(snapshot, hazardId) {
  return snapshot.activeHazards.find((hazard) => hazard.hazardId === hazardId) ?? null;
}

function makeHazardEvent(application, preview, snapshot, result, previousHazard, previousRevision, revision) {
  return {
    type: "voyage.hazard-closeout-consequence-applied",
    applicationId: application,
    closeoutId: preview.closeoutId,
    encounterId: preview.eventId,
    eventId: preview.eventId,
    sessionId: preview.sessionId,
    definitionSnapshotId: preview.definitionSnapshotId,
    shipId: preview.shipId,
    stageId: snapshot.stageId,
    roundNumber: snapshot.roundNumber,
    phase: "cleanup-advance",
    hazardId: result.hazardId,
    consequenceId: result.consequenceId,
    consequenceKind: result.consequenceKind,
    pressureSystemId: result.pressureEffect?.pressureSystemId ?? null,
    pressureEffect: result.pressureEffect,
    previousHazard,
    disposition: "removed",
    previousEncounterRevision: previousRevision,
    encounterRevision: revision
  };
}

function makeM7Event(application, preview, source, scar, previousRevision, revision, previousCount) {
  return {
    type: "voyage.void-scar-created",
    shipId: preview.shipId,
    encounterId: source.event.encounterId,
    pressureSystemId: source.proposal.pressureSystemId,
    sourceEventType: source.event.type,
    sourceEncounterRevision: source.event.revision,
    sourceProposal: source.proposal,
    previousShipRevision: previousRevision,
    revision,
    previousVoidScarCount: previousCount,
    voidScarCount: previousCount + 1,
    voidScar: scar
  };
}

function makeM10Event(application, preview, proposal, scar, previousRevision, revision, previousCount) {
  return {
    type: "voyage.closeout-void-scar-created",
    applicationId: application,
    closeoutId: preview.closeoutId,
    shipId: preview.shipId,
    eventId: preview.eventId,
    sessionId: preview.sessionId,
    pressureSystemId: proposal.targetId,
    sourceProposal: proposal.payload.incomingScarProposal,
    previousShipRevision: previousRevision,
    revision,
    previousVoidScarCount: previousCount,
    voidScarCount: previousCount + 1,
    voidScar: scar
  };
}

function applyCandidates(snapshot, ship, plan, preview) {
  const application = plan.applicationId;
  const events = [];
  let encounterRevision = snapshot.encounterRevision;
  let pressureSystems = snapshot.pressureSystems.map((system) => ({ ...system }));
  let activeHazards = snapshot.activeHazards.map((hazard) => ({ ...hazard }));
  const breachEventsByProposal = new Map();
  for (const result of preview.hazardCloseoutResults) {
    const hazard = hazardById(snapshot, result.hazardId);
    if (!hazard) return applicationFailure([m10("m10-pressure-closeout-failed", "hazardCloseoutResults")]);
    const previous = encounterRevision;
    encounterRevision += 1;
    events.push(makeHazardEvent(application, preview, snapshot, result, hazard, previous, encounterRevision));
    activeHazards = activeHazards.filter((entry) => entry.hazardId !== result.hazardId);
    if (result.pressureEffect) {
      const breach = preview.pressureBreachResults.find((entry) => entry.hazardId === result.hazardId);
      if (!breach) return applicationFailure([m10("m10-pressure-closeout-failed", "pressureBreachResults")]);
      const system = pressureSystems.find((entry) => entry.pressureSystemId === result.pressureEffect.pressureSystemId);
      if (!system) return applicationFailure([m10("m10-pressure-closeout-failed", "pressureBreachResults")]);
      const regeneratedBreach = analyzeVoyageEncounterCloseoutPressureBreach({
        kind: "m10-closeout-pressure-breach",
        expectedEncounterRevision: encounterRevision,
        closeoutContext: {
          eventId: preview.eventId,
          sessionId: preview.sessionId,
          stageId: result.pressureEffect.stageId,
          roundNumber: result.pressureEffect.roundNumber,
          phase: "cleanup-advance"
        },
        pressureSystems,
        activeHazards,
        pressureEffect: result.pressureEffect
      });
      if (!regeneratedBreach.ok || regeneratedBreach.breachRequired !== breach.breachRequired || !equal(regeneratedBreach.breach, breach.breach) || !equal(regeneratedBreach.hazard, breach.hazard) || !equal(regeneratedBreach.ordinaryScarProposal, breach.ordinaryScarProposal)) {
        return applicationFailure([m10("m10-pressure-closeout-failed", "pressureBreachResults")]);
      }
      if (breach.breachRequired) {
        const breachEvent = regeneratedBreach.event;
        if (!breachEvent || breachEvent.previousRevision !== encounterRevision) return applicationFailure([m10("m10-pressure-closeout-failed", "pressureBreachResults")]);
        events.push(breachEvent);
        breachEventsByProposal.set(breach.ordinaryScarProposal?.voidScarProposalId, breachEvent);
        encounterRevision = breachEvent.revision;
        pressureSystems = regeneratedBreach.nextPressureSystems.map((entry) => ({ ...entry }));
        activeHazards = regeneratedBreach.nextActiveHazards.map((entry) => ({ ...entry }));
      } else {
        pressureSystems = regeneratedBreach.nextPressureSystems.map((entry) => ({ ...entry }));
      }
    }
  }

  let shipRevision = ship.revision;
  let voidScars = [...ship.voidScars];
  const disabledSystems = [];
  const rewards = [];
  const resources = [];
  const persistentConsequences = [];
  const scarEvents = [];
  const sourceByProposal = new Map();
  for (const entry of preview.pressureBreachResults) if (entry.ordinaryScarProposal) sourceByProposal.set(entry.ordinaryScarProposal.voidScarProposalId, entry);
  for (const proposal of preview.persistentProposals) {
    if (proposal.kind !== "void-scar-create") continue;
    const scar = proposal.payload.voidScar;
    const previous = shipRevision;
    const count = voidScars.length;
    shipRevision += 1;
    voidScars.push(scar);
    const source = sourceByProposal.get(proposal.sourceId);
    if (proposal.sourceKind === "m7-pressure-breach") {
      const breachEvent = breachEventsByProposal.get(proposal.sourceId);
      if (!source || !breachEvent) return applicationFailure([m10("m10-pressure-closeout-failed", "pressureBreachResults")]);
      scarEvents.push(makeM7Event(application, preview, { event: breachEvent, proposal: source.ordinaryScarProposal }, scar, previous, shipRevision, count));
    } else {
      scarEvents.push(makeM10Event(application, preview, proposal, scar, previous, shipRevision, count));
    }
  }
  events.push(...scarEvents);
  for (const proposal of preview.persistentProposals) {
    if (proposal.kind === "system-disablement") disabledSystems.push(proposal);
    else if (proposal.kind === "reward-grant" || proposal.kind === "void-fortune-grant") rewards.push(proposal);
    else if (proposal.kind === "field-repair-resource-grant") resources.push(proposal);
    else if (proposal.kind === "misfortune" || proposal.kind === "persistent-consequence" || proposal.kind === "catastrophic-breakdown" || proposal.kind === "catastrophic-hazard" || proposal.kind === "emergency-response-outcome") persistentConsequences.push(proposal);
  }
  const nonScar = preview.persistentProposals.filter((proposal) => proposal.kind !== "void-scar-create");
  if (nonScar.length > 0) {
    const previous = shipRevision;
    shipRevision += 1;
    events.push({
      type: "voyage.closeout-persistent-state-applied",
      applicationId: application,
      closeoutId: preview.closeoutId,
      shipId: preview.shipId,
      proposalIds: nonScar.map((proposal) => proposal.proposalId),
      previousShipRevision: previous,
      revision: shipRevision
    });
  }
  const previousEncounterRevision = encounterRevision;
  encounterRevision += 1;
  events.push({
    type: "voyage.closeout-applied",
    applicationId: application,
    closeoutId: preview.closeoutId,
    eventId: preview.eventId,
    sessionId: preview.sessionId,
    definitionSnapshotId: preview.definitionSnapshotId,
    shipId: preview.shipId,
    overallResult: preview.overallResult,
    proposalIds: preview.persistentProposals.map((proposal) => proposal.proposalId),
    previousEncounterRevision,
    encounterRevision,
    shipRevision
  });

  const nextSnapshot = {
    ...snapshot,
    encounterRevision,
    shipRevision,
    lifecycleState: preview.overallResult === "overall-success" ? "completed-success" : "completed-failure",
    momentum: 0,
    focusPools: snapshot.focusPools.map((pool) => ({ ...pool, current: 0 })),
    pressureSystems: snapshot.pressureSystems.map((system) => ({ ...system, value: 0 })),
    pendingStationBenefitIds: [],
    unconsumedRiskBidBenefitIds: [],
    temporaryFocusPenaltyIds: [],
    roundOrderRestrictions: snapshot.roundOrderRestrictions.filter((restriction) => restriction.persistence === "persistent").map((restriction) => ({ ...restriction })),
    hazardSuppressions: [],
    temporaryConsequenceIds: [],
    activeHazards: []
  };
  const history = preview.persistentProposals.find((proposal) => proposal.kind === "event-history");
  const eventHistory = history ? [{ ...history.payload, applicationId: application }] : [];
  const nextShip = {
    schemaVersion: 1,
    revision: shipRevision,
    voidScars,
    disabledSystems,
    rewards,
    resources,
    persistentConsequences,
    eventHistory
  };
  const isolated = capture({ nextCloseoutSnapshot: nextSnapshot, nextShipState: nextShip, events });
  if (!isolated.ok) return applicationFailure([m10("m10-pressure-closeout-failed", "events")]);
  return { ok: true, applicationId: application, closeoutId: preview.closeoutId, nextCloseoutSnapshot: isolated.value.nextCloseoutSnapshot, nextShipState: isolated.value.nextShipState, events: isolated.value.events, errors: [], warnings: [] };
}

function validateApplyRequest(value) {
  if (!exactKeys(value, APPLY_FIELDS)) return [m10("m10-invalid-request-shape", "request")];
  if (value.kind !== "m10-apply-approved-closeout") return [m10("m10-invalid-mode", "request.kind")];
  if (!isPlainObject(value.previewRequest) || !isPlainObject(value.reviewRequest) || !(value.applicationPlan === null || isPlainObject(value.applicationPlan))) return [m10("m10-invalid-request-shape", "request")];
  return [];
}

export function applyVoyageEncounterApprovedCloseout(closeoutSnapshot, shipState, request) {
  const requestCapture = capture(request);
  const snapshotCapture = capture(closeoutSnapshot);
  const shipCapture = capture(shipState);
  if (!requestCapture.ok || !snapshotCapture.ok || !shipCapture.ok) return applicationFailure([m10("m10-hostile-data-capture-failed", "$")]);
  const value = requestCapture.value;
  if (!isPlainObject(value)) return applicationFailure([m10("m10-invalid-request-shape", "request")]);
  const authority = APPLY_PROHIBITED.filter((key) => Object.hasOwn(value, key));
  if (authority.length > 0) return applicationFailure(authority.map((key) => m10("m10-caller-authority-rejected", `request.${key}`)));
  const shapeErrors = validateApplyRequest(value);
  if (shapeErrors.length > 0) return applicationFailure(shapeErrors);

  const snapshotValidation = captureVoyageEncounterCloseoutSnapshot(snapshotCapture.value);
  if (!snapshotValidation.ok) return applicationFailure([m10("m10-invalid-closeout-snapshot", "closeoutSnapshot"), ...snapshotValidation.errors]);
  const shipValidation = captureVoyageShipState(shipCapture.value);
  if (!shipValidation.ok) {
    return applicationFailure(shipValidation.errors.map((error) => ({
      ...error,
      path: `shipState${error.path === "$" ? "" : error.path.slice(1)}`
    })));
  }

  const review = analyzeVoyageEncounterCloseoutReview(value.reviewRequest);
  if (!review.ok) return applicationFailure(review.errors);
  if (!equal(value.previewRequest, value.reviewRequest.previewRequest)) return applicationFailure([m10("m10-application-plan-mismatch", "applicationPlan")]);
  if (review.readyForEmergencyResponse) {
    const blockedPreview = analyzeVoyageEncounterCloseoutPreview(value.previewRequest);
    const blockedIndex = blockedPreview.ok
      ? blockedPreview.preview.breakdownResults.findIndex((entry) => entry.emergencyResponseAnalysis === null)
      : 0;
    return applicationFailure([m10("m10-emergency-response-required", `emergencyResponseEvidence[${Math.max(0, blockedIndex)}]`)]);
  }
  if (!review.readyForControlledApplication || !review.applicationPlan) return applicationFailure([m10("m10-application-plan-mismatch", "applicationPlan")]);
  if (!equal(value.applicationPlan, review.applicationPlan)) return applicationFailure([m10("m10-application-plan-mismatch", "applicationPlan")]);

  const snapshot = snapshotValidation.closeoutSnapshot;
  const ship = shipValidation.state;
  const plan = review.applicationPlan;
  if (!isPlainObject(snapshot) || !isPlainObject(ship)) return applicationFailure([m10("m10-invalid-request-shape", "request")]);
  if (plan.eventId !== snapshot.eventId) return applicationFailure([m10("m10-event-identity-mismatch", "closeoutSnapshot.eventId")]);
  if (plan.sessionId !== snapshot.sessionId) return applicationFailure([m10("m10-session-identity-mismatch", "closeoutSnapshot.sessionId")]);
  if (plan.definitionSnapshotId !== snapshot.definitionSnapshotId) return applicationFailure([m10("m10-definition-snapshot-mismatch", "closeoutSnapshot.definitionSnapshotId")]);
  if (plan.shipId !== ship.shipId || plan.shipId !== snapshot.shipId) return applicationFailure([m10("m10-ship-identity-mismatch", "closeoutSnapshot.shipId")]);
  if (plan.expectedEncounterRevision !== snapshot.encounterRevision) return applicationFailure([m10("m10-encounter-revision-mismatch", "expectedEncounterRevision")]);
  if (plan.expectedShipRevision !== ship.revision || snapshot.shipRevision !== ship.revision) return applicationFailure([m10("m10-ship-revision-mismatch", "expectedShipRevision")]);

  const preview = plan.expectedPreview;
  const candidate = applyCandidates(snapshot, ship, plan, preview);
  return candidate.ok ? candidate : applicationFailure(candidate.errors);
}
