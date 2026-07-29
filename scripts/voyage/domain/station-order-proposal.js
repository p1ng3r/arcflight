import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import {
  analyzeVoyageEncounterStationOrder,
  analyzeVoyageStationOrderPermutation
} from "./station-order.js";

const OPERATIONS = Object.freeze({
  PROPOSE: "propose",
  CHANGE: "change",
  CLEAR: "clear"
});

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function issueIdentity(entry) {
  return `${entry.code}\0${entry.path}\0${entry.message}\0${entry.severity}`;
}

function cloneIssues(issues) {
  return issues.map((entry) => ({ ...entry }));
}

function deduplicateIssues(issues) {
  const seen = new Set();
  const unique = [];
  for (const entry of issues) {
    const identity = issueIdentity(entry);
    if (seen.has(identity)) continue;
    seen.add(identity);
    unique.push({ ...entry });
  }
  return unique;
}

function failure(errors, warnings = []) {
  return {
    ok: false,
    nextState: null,
    events: [],
    errors: deduplicateIssues(errors),
    warnings: deduplicateIssues(warnings)
  };
}

function inspectPlainObject(value, path, errors) {
  try {
    return isPlainObject(value);
  } catch {
    errors.push(issue(
      "station-order-proposal-data-read-failed",
      path,
      "Voyage station-order proposal data could not be inspected safely."
    ));
    return false;
  }
}

function readOwnDataProperty(value, key, path, errors) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    errors.push(issue(
      "station-order-proposal-data-read-failed",
      path,
      "Voyage station-order proposal data could not be read safely."
    ));
    return { ok: false, present: false, value: undefined };
  }

  if (!descriptor) return { ok: true, present: false, value: undefined };
  if (!Object.hasOwn(descriptor, "value")) {
    errors.push(issue(
      "station-order-proposal-data-read-failed",
      path,
      "Voyage station-order proposal fields must be own data properties."
    ));
    return { ok: false, present: true, value: undefined };
  }
  return { ok: true, present: true, value: descriptor.value };
}

function readRequest(request, operation, errors) {
  const clear = operation === OPERATIONS.CLEAR;
  const requestPath = clear ? "clearRequest" : "proposalRequest";
  if (!inspectPlainObject(request, requestPath, errors)) {
    if (errors.length === 0) {
      errors.push(issue(
        "invalid-station-order-proposal-request",
        requestPath,
        "Voyage station-order proposal request must be a plain object."
      ));
    }
    return null;
  }
  if (clear) return {};

  const orderRead = readOwnDataProperty(
    request,
    "stationOrder",
    `${requestPath}.stationOrder`,
    errors
  );
  if (!orderRead.ok) return null;
  if (!orderRead.present) {
    errors.push(issue(
      "missing-station-order-proposal",
      `${requestPath}.stationOrder`,
      "Voyage station-order proposal request requires an own stationOrder field."
    ));
    return null;
  }
  return { stationOrder: orderRead.value };
}

function arraysEqual(first, second) {
  return first.length === second.length
    && first.every((entry, index) => entry === second[index]);
}

function validateMutationContext(encounterState) {
  const stationOrder = analyzeVoyageEncounterStationOrder(encounterState);
  const warnings = cloneIssues(stationOrder.warnings);
  if (!stationOrder.valid) {
    return {
      ok: false,
      stationOrder,
      errors: cloneIssues(stationOrder.errors),
      warnings
    };
  }

  const errors = [];
  if (encounterState.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) {
    errors.push(issue(
      "station-order-proposal-requires-active",
      "lifecycleState",
      "Voyage station-order proposals require an Active encounter."
    ));
  }
  if (encounterState.phase !== VOYAGE_ROUND_PHASES.CREW_PLANNING) {
    errors.push(issue(
      "station-order-proposal-requires-crew-planning",
      "phase",
      "Voyage station-order proposals require the Crew Planning phase."
    ));
  }
  if (stationOrder.committedStationOrder.length > 0) {
    errors.push(issue(
      "station-order-proposal-already-committed",
      "committedStationOrder",
      "Voyage station-order proposals cannot be edited after commitment."
    ));
  }

  return {
    ok: errors.length === 0,
    stationOrder,
    errors,
    warnings
  };
}

function validateOperationState(operation, stationOrder, errors) {
  const proposalExists = stationOrder.proposedStationOrder.length > 0;
  if (operation === OPERATIONS.PROPOSE && proposalExists) {
    errors.push(issue(
      "station-order-proposal-already-exists",
      "proposedStationOrder",
      "A Voyage station-order proposal already exists."
    ));
  }
  if (operation !== OPERATIONS.PROPOSE && !proposalExists) {
    errors.push(issue(
      "station-order-proposal-does-not-exist",
      "proposedStationOrder",
      "A non-empty Voyage station-order proposal is required for this operation."
    ));
  }
}

function validateRequestedOrder(requestedOrder, occupiedStationIds, operation, errors) {
  const result = analyzeVoyageStationOrderPermutation(
    requestedOrder,
    occupiedStationIds,
    "proposalRequest.stationOrder"
  );
  errors.push(...result.errors);
  if (result.valid && !result.complete) {
    errors.push(issue(
      "incomplete-station-order-proposal",
      "proposalRequest.stationOrder",
      "Voyage station-order proposals must be complete exact permutations."
    ));
  }
  if (
    operation === OPERATIONS.PROPOSE
    && result.valid
    && result.complete
    && occupiedStationIds.length === 0
  ) {
    errors.push(issue(
      "station-order-proposal-unnecessary",
      "proposalRequest.stationOrder",
      "An empty order is already complete when no stations are occupied."
    ));
  }
  return result;
}

function cloneCandidate(encounterState, warnings) {
  try {
    return { ok: true, candidate: clonePlainData(encounterState) };
  } catch {
    return {
      ok: false,
      result: failure([
        issue(
          "station-order-proposal-clone-failed",
          "encounterState",
          "Voyage encounter state could not be cloned safely."
        )
      ], warnings)
    };
  }
}

function createEvent(operation, candidate, previousOrder, previousRevision) {
  const shared = {
    encounterId: candidate.encounterId,
    lifecycleState: candidate.lifecycleState,
    roundNumber: candidate.roundNumber,
    phase: candidate.phase
  };

  if (operation === OPERATIONS.PROPOSE) {
    return {
      type: "voyage.station-order-proposed",
      ...shared,
      proposedStationOrder: [...candidate.proposedStationOrder],
      previousRevision,
      revision: candidate.revision
    };
  }
  if (operation === OPERATIONS.CHANGE) {
    return {
      type: "voyage.station-order-proposal-changed",
      ...shared,
      previousProposedStationOrder: [...previousOrder],
      proposedStationOrder: [...candidate.proposedStationOrder],
      previousRevision,
      revision: candidate.revision
    };
  }
  return {
    type: "voyage.station-order-proposal-cleared",
    ...shared,
    clearedProposedStationOrder: [...previousOrder],
    previousRevision,
    revision: candidate.revision
  };
}

function applyProposal(encounterState, request, operation) {
  const context = validateMutationContext(encounterState);
  if (!context.ok) return failure(context.errors, context.warnings);

  const errors = [];
  const warnings = cloneIssues(context.warnings);
  const normalizedRequest = readRequest(request, operation, errors);
  if (!normalizedRequest || errors.length > 0) return failure(errors, warnings);
  validateOperationState(operation, context.stationOrder, errors);
  if (errors.length > 0) return failure(errors, warnings);

  let requested = null;
  if (operation !== OPERATIONS.CLEAR) {
    requested = validateRequestedOrder(
      normalizedRequest.stationOrder,
      context.stationOrder.occupiedStationIds,
      operation,
      errors
    );
    if (
      operation === OPERATIONS.CHANGE
      && requested.valid
      && requested.complete
      && arraysEqual(
        requested.stationOrder,
        context.stationOrder.proposedStationOrder
      )
    ) {
      errors.push(issue(
        "station-order-proposal-unchanged",
        "proposalRequest.stationOrder",
        "The requested Voyage station-order proposal is unchanged."
      ));
    }
    if (errors.length > 0) return failure(errors, warnings);
  }

  const cloned = cloneCandidate(encounterState, warnings);
  if (!cloned.ok) return cloned.result;
  const candidate = cloned.candidate;
  const previousRevision = encounterState.revision;
  const previousOrder = [...context.stationOrder.proposedStationOrder];
  candidate.proposedStationOrder = operation === OPERATIONS.CLEAR
    ? []
    : [...requested.stationOrder];
  candidate.revision = previousRevision + 1;

  const candidateValidation = analyzeVoyageEncounterStationOrder(candidate);
  warnings.push(...candidateValidation.warnings);
  if (!candidateValidation.valid) {
    return failure(candidateValidation.errors, warnings);
  }

  const event = createEvent(
    operation,
    candidate,
    previousOrder,
    previousRevision
  );
  return {
    ok: true,
    nextState: candidate,
    events: [event],
    errors: [],
    warnings: deduplicateIssues(warnings)
  };
}

function applySafely(encounterState, request, operation) {
  try {
    return applyProposal(encounterState, request, operation);
  } catch {
    return failure([
      issue(
        "station-order-proposal-data-read-failed",
        "encounterState",
        "Voyage station-order proposal state could not be read safely."
      )
    ]);
  }
}

export function applyVoyageEncounterStationOrderProposal(
  encounterState,
  proposalRequest
) {
  return applySafely(encounterState, proposalRequest, OPERATIONS.PROPOSE);
}

export function applyVoyageEncounterStationOrderProposalChange(
  encounterState,
  proposalRequest
) {
  return applySafely(encounterState, proposalRequest, OPERATIONS.CHANGE);
}

export function applyVoyageEncounterStationOrderProposalClear(
  encounterState,
  clearRequest
) {
  return applySafely(encounterState, clearRequest, OPERATIONS.CLEAR);
}
