import {
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES,
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { deriveOccupiedVoyageStationIds } from "./station-assignments.js";
import { validateVoyageEncounterRiskBids } from "./risk-bids.js";
import { analyzeAuthoredVoyageStationApproaches } from "./station-selection.js";

const UNSAFE_STATION_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const APPROACH_SELECTION_FIELDS = Object.freeze([
  "approachId",
  "statisticSlugOrAbilityId",
  "noRoll",
]);
const APPROACH_SELECTION_OPERATIONS = Object.freeze({
  SELECT: "select",
  CHANGE: "change",
  CLEAR: "clear",
});

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const key = `${entry.code}\u0000${entry.path}\u0000${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function failure(errors, warnings = []) {
  return {
    ok: false,
    nextState: null,
    events: [],
    errors: deduplicateIssues(errors),
    warnings: deduplicateIssues(warnings),
  };
}

function readOwnDataProperty(value, key, path, errors) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    errors.push(
      issue(
        "approach-selection-data-read-failed",
        path,
        "Approach selection data could not be read safely.",
      ),
    );
    return { ok: false, present: false, value: undefined };
  }

  if (!descriptor) return { ok: true, present: false, value: undefined };
  if (!Object.hasOwn(descriptor, "value")) {
    errors.push(
      issue(
        "approach-selection-data-read-failed",
        path,
        "Approach selection data must use a plain data property.",
      ),
    );
    return { ok: false, present: true, value: undefined };
  }

  return { ok: true, present: true, value: descriptor.value };
}

function inspectPlainObject(value, path, errors) {
  try {
    if (isPlainObject(value)) return true;
  } catch {
    errors.push(
      issue(
        "approach-selection-data-read-failed",
        path,
        "Approach selection data could not be inspected safely.",
      ),
    );
  }

  return false;
}

function validateExactSafeId(
  value,
  path,
  { invalidCode, unsafeCode, label },
  errors,
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(
      issue(
        invalidCode,
        path,
        `${label} must be a non-empty exact string.`,
      ),
    );
    return false;
  }

  if (UNSAFE_STATION_KEYS.has(value)) {
    errors.push(
      issue(
        unsafeCode,
        path,
        `${label} cannot use a prototype-sensitive value.`,
      ),
    );
    return false;
  }

  return true;
}

function readRequest(request, errors, clear = false) {
  const requestPath = clear ? "clearRequest" : "approachRequest";
  if (!inspectPlainObject(request, requestPath, errors)) {
    if (errors.length === 0) {
      errors.push(
        issue(
          "invalid-approach-selection-request",
          requestPath,
          "Approach selection request must be a plain object.",
        ),
      );
    }
    return null;
  }

  const stationId = readOwnDataProperty(
    request,
    "stationId",
    `${requestPath}.stationId`,
    errors,
  );

  let stationIdValid = false;
  if (stationId.ok) {
    stationIdValid = validateExactSafeId(
      stationId.present ? stationId.value : undefined,
      `${requestPath}.stationId`,
      {
        invalidCode: "invalid-approach-selection-station-id",
        unsafeCode: "unsafe-approach-selection-station-key",
        label: "Approach selection station ID",
      },
      errors,
    );
  }

  if (clear) {
    return stationIdValid ? { stationId: stationId.value } : null;
  }

  const approachId = readOwnDataProperty(
    request,
    "approachId",
    `${requestPath}.approachId`,
    errors,
  );
  let approachIdValid = false;
  if (approachId.ok) {
    approachIdValid = validateExactSafeId(
      approachId.present ? approachId.value : undefined,
      `${requestPath}.approachId`,
      {
        invalidCode: "invalid-approach-id",
        unsafeCode: "unsafe-approach-id",
        label: "Approach ID",
      },
      errors,
    );
  }

  if (!stationIdValid || !approachIdValid) return null;
  return { stationId: stationId.value, approachId: approachId.value };
}

function findExactOwnIdMatches(source, idField, id, path, errors) {
  if (!Array.isArray(source)) return [];

  const length = readOwnDataProperty(source, "length", `${path}.length`, errors);
  if (!length.ok || !length.present) return [];

  const matches = [];
  for (let index = 0; index < length.value; index += 1) {
    const entryPath = `${path}[${index}]`;
    const entry = readOwnDataProperty(source, String(index), entryPath, errors);
    if (!entry.ok || !entry.present) continue;
    if (!inspectPlainObject(entry.value, entryPath, errors)) continue;

    const entryId = readOwnDataProperty(
      entry.value,
      idField,
      `${entryPath}.${idField}`,
      errors,
    );
    if (entryId.ok && entryId.present && entryId.value === id) {
      matches.push({ value: entry.value, path: entryPath });
    }
  }

  return matches;
}

function inspectCommittedApproach(selection, selectionPath, errors) {
  const reads = Object.create(null);
  let committed = false;

  for (const field of APPROACH_SELECTION_FIELDS) {
    reads[field] = readOwnDataProperty(
      selection,
      field,
      `${selectionPath}.${field}`,
      errors,
    );
    if (reads[field].present) committed = true;
  }

  return { committed, reads };
}

function defineSelection(selections, stationId, selection) {
  Object.defineProperty(selections, stationId, {
    value: selection,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function applySelection(
  encounterState,
  request,
  operation = APPROACH_SELECTION_OPERATIONS.SELECT,
) {
  const change = operation === APPROACH_SELECTION_OPERATIONS.CHANGE;
  const clear = operation === APPROACH_SELECTION_OPERATIONS.CLEAR;
  const sourceValidation = validateVoyageEncounterRiskBids(encounterState);
  const warnings = [...sourceValidation.warnings];
  if (!sourceValidation.valid) {
    return failure(sourceValidation.errors, warnings);
  }

  const errors = [];
  if (
    encounterState.lifecycleState !==
    VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE
  ) {
    errors.push(
      issue(
        "approach-selection-requires-active-encounter",
        "lifecycleState",
        "Station approaches can only be selected for an Active encounter.",
      ),
    );
  }
  if (encounterState.phase !== VOYAGE_ROUND_PHASES.CREW_PLANNING) {
    errors.push(
      issue(
        "approach-selection-requires-crew-planning",
        "phase",
        "Station approaches can only be selected during Crew Planning.",
      ),
    );
  }

  const requestPath = clear ? "clearRequest" : "approachRequest";
  const normalizedRequest = readRequest(request, errors, clear);
  if (errors.length > 0) return failure(errors, warnings);

  const { stationId, approachId = null } = normalizedRequest;
  const stationMatches = findExactOwnIdMatches(
    encounterState.availableStations,
    "stationId",
    stationId,
    "availableStations",
    errors,
  );
  if (stationMatches.length === 0) {
    errors.push(
      issue(
        "approach-selection-station-not-available",
        `${requestPath}.stationId`,
        "The requested station is not available in this encounter.",
      ),
    );
  } else if (stationMatches.length > 1) {
    errors.push(
      issue(
        "approach-selection-station-is-ambiguous",
        `${requestPath}.stationId`,
        "The requested station is not uniquely available.",
      ),
    );
  }
  if (errors.length > 0) return failure(errors, warnings);

  const occupiedStationIds = deriveOccupiedVoyageStationIds(
    encounterState.stationAssignments,
  );
  if (!occupiedStationIds.includes(stationId)) {
    return failure(
      [
        issue(
          "approach-selection-station-not-occupied",
          `${requestPath}.stationId`,
          "The requested station is not currently occupied.",
        ),
      ],
      warnings,
    );
  }

  const selectionPath = `selections.${stationId}`;
  const selectionRead = readOwnDataProperty(
    encounterState.selections,
    stationId,
    selectionPath,
    errors,
  );
  if (!selectionRead.ok) return failure(errors, warnings);
  if (!selectionRead.present) {
    return failure(
      [
        issue(
          "station-action-selection-missing",
          selectionPath,
          "An action must be selected before selecting an approach.",
        ),
      ],
      warnings,
    );
  }

  const selection = selectionRead.value;
  const currentApproach = inspectCommittedApproach(
    selection,
    selectionPath,
    errors,
  );
  if (operation === APPROACH_SELECTION_OPERATIONS.SELECT && currentApproach.committed) {
    errors.push(
      issue(
        "station-approach-selection-already-exists",
        selectionPath,
        "This station already has a committed approach selection.",
      ),
    );
  }
  if (operation !== APPROACH_SELECTION_OPERATIONS.SELECT && !currentApproach.committed) {
    errors.push(
      issue(
        "station-approach-selection-does-not-exist",
        selectionPath,
        "This station does not have a committed approach selection to edit.",
      ),
    );
  }
  const actionId = readOwnDataProperty(
    selection,
    "actionId",
    `${selectionPath}.actionId`,
    errors,
  );
  if (errors.length > 0) return failure(errors, warnings);

  const previousApproachId = change || clear
    ? currentApproach.reads.approachId.value
    : null;
  if (change && approachId === previousApproachId) {
    return failure(
      [
        issue(
          "station-approach-selection-unchanged",
          `${requestPath}.approachId`,
          "The requested approach is already selected for this station.",
        ),
      ],
      warnings,
    );
  }

  const station = stationMatches[0];
  const actions = readOwnDataProperty(
    station.value,
    "actions",
    `${station.path}.actions`,
    errors,
  );
  if (!actions.ok || !actions.present || !Array.isArray(actions.value)) {
    errors.push(
      issue(
        "invalid-station-actions",
        `${station.path}.actions`,
        "Station actions must be an array.",
      ),
    );
    return failure(errors, warnings);
  }

  const actionMatches = findExactOwnIdMatches(
    actions.value,
    "actionId",
    actionId.value,
    `${station.path}.actions`,
    errors,
  );
  if (actionMatches.length === 0) {
    errors.push(
      issue(
        "selected-action-not-available",
        `${selectionPath}.actionId`,
        "The selected action is not available for this station.",
      ),
    );
  } else if (actionMatches.length > 1) {
    errors.push(
      issue(
        "selected-action-is-ambiguous",
        `${selectionPath}.actionId`,
        "The selected action is not unique for this station.",
      ),
    );
  }
  if (errors.length > 0) return failure(errors, warnings);

  let authoredApproach = null;
  if (!clear) {
    const action = actionMatches[0];
    const authored = analyzeAuthoredVoyageStationApproaches(
      action.value,
      action.path,
      approachId,
      errors,
    );
    if (authored.matches.length === 0) {
      if (authored.valid) {
        errors.push(
          issue(
            "approach-not-available",
            `${requestPath}.approachId`,
            "The requested approach is not authored for the selected action.",
          ),
        );
      }
    } else if (authored.matches.length > 1) {
      errors.push(
        issue(
          "approach-is-ambiguous",
          `${requestPath}.approachId`,
          "The requested approach is not unique for the selected action.",
        ),
      );
    }
    if (!authored.valid || errors.length > 0) return failure(errors, warnings);
    authoredApproach = authored.matches[0];
  }

  let nextState;
  try {
    nextState = clonePlainData(encounterState);
  } catch {
    return failure(
      [
        issue(
          "approach-selection-clone-failed",
          "encounterState",
          "Encounter state could not be cloned safely.",
        ),
      ],
      warnings,
    );
  }

  const committedSelection = clear
    ? { stationId, actionId: actionId.value }
    : authoredApproach.executionKind === "no-roll"
      ? { stationId, actionId: actionId.value, approachId, noRoll: true }
      : {
          stationId,
          actionId: actionId.value,
          approachId,
          statisticSlugOrAbilityId:
            authoredApproach.statisticSlugOrAbilityId,
        };
  defineSelection(nextState.selections, stationId, committedSelection);

  const clearsRiskBid = clear || authoredApproach.executionKind === "no-roll";
  const clearedRiskBid = clearsRiskBid
    && Object.hasOwn(nextState.riskBids, stationId)
    ? nextState.riskBids[stationId]
    : null;
  if (clearedRiskBid) delete nextState.riskBids[stationId];

  const previousRevision = encounterState.revision;
  nextState.revision = previousRevision + 1;

  const candidateValidation = validateVoyageEncounterRiskBids(nextState);
  warnings.push(...candidateValidation.warnings);
  if (!candidateValidation.valid) {
    return failure(candidateValidation.errors, warnings);
  }

  const executionIdentity = clear
    ? currentApproach.reads.noRoll.present
      ? { noRoll: true }
      : {
          statisticSlugOrAbilityId:
            currentApproach.reads.statisticSlugOrAbilityId.value,
        }
    : authoredApproach.executionKind === "no-roll"
      ? { noRoll: true }
      : {
          statisticSlugOrAbilityId:
            authoredApproach.statisticSlugOrAbilityId,
        };

  const eventType = clear
    ? "voyage.station-approach-selection-cleared"
    : change
      ? "voyage.station-approach-selection-changed"
      : "voyage.station-approach-selected";

  return {
    ok: true,
    nextState,
    events: [
      {
        type: eventType,
        encounterId: encounterState.encounterId,
        lifecycleState: encounterState.lifecycleState,
        roundNumber: encounterState.roundNumber,
        phase: encounterState.phase,
        stationId,
        actionId: actionId.value,
        ...(change ? { previousApproachId } : {}),
        approachId: clear ? previousApproachId : approachId,
        ...executionIdentity,
        ...(clearedRiskBid ? {
          clearedRiskBidId: clearedRiskBid.riskBidId,
          clearedRiskBidDcAdjustment: clearedRiskBid.dcAdjustment,
        } : {}),
        previousRevision,
        revision: nextState.revision,
      },
    ],
    errors: [],
    warnings: deduplicateIssues(warnings),
  };
}

function applySafely(
  encounterState,
  request,
  operation = APPROACH_SELECTION_OPERATIONS.SELECT,
) {
  try {
    return applySelection(encounterState, request, operation);
  } catch {
    return failure([
      issue(
        "approach-selection-data-read-failed",
        "encounterState",
        "Encounter state could not be read safely.",
      ),
    ]);
  }
}

export function applyVoyageEncounterStationApproachSelection(
  encounterState,
  request,
) {
  return applySafely(encounterState, request);
}

export function applyVoyageEncounterStationApproachSelectionChange(
  encounterState,
  request,
) {
  return applySafely(
    encounterState,
    request,
    APPROACH_SELECTION_OPERATIONS.CHANGE,
  );
}

export function applyVoyageEncounterStationApproachSelectionClear(
  encounterState,
  request,
) {
  return applySafely(
    encounterState,
    request,
    APPROACH_SELECTION_OPERATIONS.CLEAR,
  );
}
