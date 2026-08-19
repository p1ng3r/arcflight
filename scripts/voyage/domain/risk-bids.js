import {
  VOYAGE_ACTION_OUTCOME_BRANCHES as OUTCOME_BRANCHES,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES,
  VOYAGE_ROUND_PHASES
} from "./constants.js";
import { clonePlainData, isPlainObject } from "./defaults.js";
import { deriveOccupiedVoyageStationIds } from "./station-assignments.js";
import { validateVoyageEncounterStationSelections } from "./station-selection.js";
import { validateVoyageEncounterState } from "./validation.js";

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });
const hasId = (value) => typeof value === "string" && value.trim().length > 0;
const safeKey = (value) => !UNSAFE_KEYS.has(value);
const CANONICAL_DC_ADJUSTMENTS = new Set([2, 5, 8]);
const OUTCOME_FIELDS = Object.freeze([
  OUTCOME_BRANCHES.CRITICAL_SUCCESS,
  OUTCOME_BRANCHES.SUCCESS,
  OUTCOME_BRANCHES.FAILURE,
  OUTCOME_BRANCHES.CRITICAL_FAILURE
].map((branch) => Object.freeze({
  branch,
  field: branch.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
})));
function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((entry) => {
    const identity = `${entry.code}\u0000${entry.path}\u0000${entry.message}\u0000${entry.severity}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
const failure = (errors, warnings) => ({ ok: false, nextState: null, events: [], errors: deduplicateIssues(errors), warnings: deduplicateIssues(warnings) });
function stations(state, id, errors) {
  const found = [];
  const indices = ownArrayIndices(
    state.availableStations,
    "availableStations",
    errors
  );
  for (const index of indices) {
    const path = `availableStations[${index}]`;
    const stationRead = readOwnDataProperty(
      state.availableStations,
      String(index),
      path,
      errors
    );
    if (!stationRead.present || !stationRead.ok
      || !isPlainObjectSafely(stationRead.value, path, errors)) continue;
    const stationId = readOwnDataProperty(
      stationRead.value,
      "stationId",
      `${path}.stationId`,
      errors
    );
    if (stationId.ok && stationId.value === id) {
      found.push({ station: stationRead.value, index });
    }
  }
  return found;
}
function actions(actionList, id, stationIndex, errors) {
  const found = [];
  const indices = ownArrayIndices(
    actionList,
    `availableStations[${stationIndex}].actions`,
    errors
  );
  for (const index of indices) {
    const path = `availableStations[${stationIndex}].actions[${index}]`;
    const actionRead = readOwnDataProperty(
      actionList,
      String(index),
      path,
      errors
    );
    if (!actionRead.present || !actionRead.ok
      || !isPlainObjectSafely(actionRead.value, path, errors)) continue;
    const actionId = readOwnDataProperty(
      actionRead.value,
      "actionId",
      `${path}.actionId`,
      errors
    );
    if (actionId.ok && actionId.value === id) {
      found.push({ action: actionRead.value, index });
    }
  }
  return found;
}

function readOwnDataProperty(value, key, path, errors) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    issue(errors, "outcome-data-read-failed", path, "Risk Bid data could not be read safely.");
    return { present: true, ok: false, value: undefined };
  }
  if (!descriptor) return { present: false, ok: true, value: undefined };
  if (!Object.hasOwn(descriptor, "value")) {
    issue(errors, "outcome-data-read-failed", path, "Risk Bid properties must be own data properties.");
    return { present: true, ok: false, value: undefined };
  }
  return { present: true, ok: true, value: descriptor.value };
}

function readOwnKeys(value, path, errors) {
  try {
    return Reflect.ownKeys(value);
  } catch {
    issue(errors, "outcome-data-read-failed", path, "Risk Bid data could not be inspected safely.");
    return null;
  }
}

function ownArrayIndices(value, path, errors) {
  const keys = readOwnKeys(value, path, errors);
  if (!keys) return [];
  return keys
    .filter((key) => typeof key === "string"
      && /^(0|[1-9]\d*)$/.test(key)
      && Number.isSafeInteger(Number(key))
      && Number(key) < 0xffffffff)
    .map(Number)
    .sort((left, right) => left - right);
}

function isPlainObjectSafely(value, path, errors) {
  try {
    return isPlainObject(value);
  } catch {
    issue(errors, "outcome-data-read-failed", path, "Risk Bid data could not be inspected safely.");
    return false;
  }
}

function inspectExactObject(value, expectedFields, path, errors, invalidCode, unexpectedCode) {
  if (!isPlainObjectSafely(value, path, errors)) {
    issue(errors, invalidCode, path, "Authored Risk Bid data must be a plain object.");
    return null;
  }
  const keys = readOwnKeys(value, path, errors);
  if (!keys) return null;
  const values = {};
  for (const key of keys) {
    const childPath = `${path}.${typeof key === "symbol" ? "[symbol]" : key}`;
    if (typeof key !== "string" || !expectedFields.includes(key)) {
      issue(errors, unexpectedCode, childPath, "Unexpected authored Risk Bid field.");
      continue;
    }
    const read = readOwnDataProperty(value, key, childPath, errors);
    if (read.ok) values[key] = read.value;
  }
  return values;
}

function inspectDenseArray(value, path, errors, invalidCode, sparseCode, unexpectedCode) {
  let array = false;
  try {
    array = Array.isArray(value);
  } catch {
    issue(errors, "outcome-data-read-failed", path, "Risk Bid data could not be inspected safely.");
    return null;
  }
  if (!array) {
    issue(errors, invalidCode, path, "Authored Risk Bid data must be an array.");
    return null;
  }
  const lengthRead = readOwnDataProperty(value, "length", `${path}.length`, errors);
  if (!lengthRead.ok || !Number.isSafeInteger(lengthRead.value) || lengthRead.value < 0) return null;
  const keys = readOwnKeys(value, path, errors);
  if (!keys) return null;
  const indexedKeys = [];
  for (const key of keys) {
    if (key === "length") continue;
    const numeric = typeof key === "string" && /^(0|[1-9]\d*)$/.test(key);
    const index = numeric ? Number(key) : -1;
    if (!numeric || !Number.isSafeInteger(index) || index >= lengthRead.value) {
      issue(
        errors,
        unexpectedCode,
        `${path}.${typeof key === "symbol" ? "[symbol]" : key}`,
        "Risk Bid arrays must contain only indexed entries."
      );
    } else {
      indexedKeys.push({ index, key });
    }
  }
  indexedKeys.sort((left, right) => left.index - right.index);
  let firstMissingIndex = 0;
  for (const { index } of indexedKeys) {
    if (index !== firstMissingIndex) break;
    firstMissingIndex += 1;
  }
  const dense = firstMissingIndex === lengthRead.value
    && indexedKeys.length === lengthRead.value;
  if (!dense) {
    issue(
      errors,
      sparseCode,
      `${path}[${firstMissingIndex}]`,
      "Risk Bid arrays must contain dense own entries."
    );
  }
  const entries = [];
  for (const { index, key } of indexedKeys) {
    const read = readOwnDataProperty(value, key, `${path}[${index}]`, errors);
    if (read.ok) entries.push({ index, value: read.value });
  }
  return { dense, length: lengthRead.value, entries };
}

function analyzeOutcomeReferences(value, path, errors) {
  const start = errors.length;
  const array = inspectDenseArray(
    value,
    path,
    errors,
    "invalid-risk-bid-outcome-branch",
    "sparse-risk-bid-outcome-branch",
    "unexpected-risk-bid-outcome-array-key"
  );
  if (!array) return null;
  const references = array.dense ? new Array(array.length) : [];
  const referenceRecords = [];
  const seen = new Set();
  for (const { index, value: reference } of array.entries) {
    if (!hasId(reference)) {
      issue(errors, "invalid-effect-reference", `${path}[${index}]`, "Risk Bid effect references must be non-empty exact strings.");
    } else if (!safeKey(reference)) {
      issue(errors, "unsafe-effect-reference", `${path}[${index}]`, "Risk Bid effect references must be safe.");
    } else if (seen.has(reference)) {
      issue(errors, "duplicate-effect-reference", `${path}[${index}]`, "Risk Bid effect references must be unique within one outcome branch.");
    } else {
      seen.add(reference);
      if (array.dense) references[index] = reference;
      referenceRecords.push({ effectId: reference, path: `${path}[${index}]` });
    }
  }
  return errors.length === start ? { references, referenceRecords } : null;
}

function analyzeCanonicalRiskBidOption(option, index, path, errors, ids, adjustments) {
  const optionPath = `${path}[${index}]`;
  const start = errors.length;
  const values = inspectExactObject(
    option,
    ["riskBidId", "dcAdjustment", "outcomes"],
    optionPath,
    errors,
    "invalid-risk-bid-option",
    "unexpected-risk-bid-option-field"
  );
  if (!values) return null;

  for (const field of ["riskBidId", "dcAdjustment", "outcomes"]) {
    if (!Object.hasOwn(values, field)) {
      issue(errors, `missing-risk-bid-${field === "riskBidId" ? "id" : field === "dcAdjustment" ? "dc-adjustment" : "outcomes"}`, `${optionPath}.${field}`, `Authored Risk Bid option requires an own ${field}.`);
    }
  }

  const riskBidId = values.riskBidId;
  if (Object.hasOwn(values, "riskBidId")) {
    if (!hasId(riskBidId)) {
      issue(errors, "invalid-risk-bid-id", `${optionPath}.riskBidId`, "Authored Risk Bid option requires a non-empty exact riskBidId.");
    } else if (!safeKey(riskBidId)) {
      issue(errors, "unsafe-risk-bid-key", `${optionPath}.riskBidId`, "Authored Risk Bid option requires a safe riskBidId.");
    } else if (ids.has(riskBidId)) {
      issue(errors, "duplicate-risk-bid-id", `${optionPath}.riskBidId`, "Authored Risk Bid option riskBidId must be unique within an action.");
    } else {
      ids.add(riskBidId);
    }
  }

  const dcAdjustment = values.dcAdjustment;
  if (Object.hasOwn(values, "dcAdjustment")) {
    if (!Number.isSafeInteger(dcAdjustment) || !CANONICAL_DC_ADJUSTMENTS.has(dcAdjustment)) {
      issue(errors, "invalid-risk-bid-dc-adjustment", `${optionPath}.dcAdjustment`, "Risk Bid dcAdjustment must be exactly 2, 5, or 8.");
    } else if (adjustments.has(dcAdjustment)) {
      issue(errors, "duplicate-risk-bid-dc-adjustment", `${optionPath}.dcAdjustment`, "Risk Bid dcAdjustment must be unique within an action.");
    } else {
      adjustments.add(dcAdjustment);
    }
  }

  const outcomes = {};
  const localReferenceRecords = [];
  if (Object.hasOwn(values, "outcomes")) {
    const outcomeFields = OUTCOME_FIELDS.map(({ field }) => field);
    const outcomeValues = inspectExactObject(
      values.outcomes,
      outcomeFields,
      `${optionPath}.outcomes`,
      errors,
      "invalid-risk-bid-outcomes",
      "unexpected-risk-bid-outcome-branch"
    );
    if (outcomeValues) {
      for (const { field } of OUTCOME_FIELDS) {
        const branchPath = `${optionPath}.outcomes.${field}`;
        if (!Object.hasOwn(outcomeValues, field)) {
          issue(errors, "missing-risk-bid-outcome-branch", branchPath, "Every Risk Bid outcome branch is required.");
          continue;
        }
        const branch = analyzeOutcomeReferences(outcomeValues[field], branchPath, errors);
        if (!branch) continue;
        outcomes[field] = branch.references;
        localReferenceRecords.push(...branch.referenceRecords);
      }
    }
  }

  if (errors.length !== start) return null;
  const normalized = { riskBidId, dcAdjustment, outcomes };
  return {
    option: normalized,
    optionRecord: { optionIndex: index, optionPath, option: normalized },
    referenceRecords: localReferenceRecords
  };
}

export function analyzeAuthoredVoyageRiskBidOptions(
  action,
  path,
  errors,
  { noRoll = false } = {}
) {
  try {
    const optionsRead = readOwnDataProperty(action, "riskBidOptions", path, errors);
    if (!optionsRead.present) return { options: [], optionRecords: [], referenceRecords: [] };
    if (!optionsRead.ok) return null;
    const source = optionsRead.value;
    const array = inspectDenseArray(
      source,
      path,
      errors,
      "invalid-risk-bid-options",
      "sparse-risk-bid-option",
      "unexpected-risk-bid-options-array-key"
    );
    if (!array) return null;
    if (noRoll && array.length > 0) {
      issue(errors, "no-roll-risk-bid-options", path, "No-roll actions must not offer Risk Bid options.");
    }

    const ids = new Set();
    const adjustments = new Set();
    const options = noRoll || !array.dense ? [] : new Array(array.length);
    const optionRecords = [];
    const referenceRecords = [];
    for (const { index, value } of array.entries) {
      const analyzed = analyzeCanonicalRiskBidOption(
        value,
        index,
        path,
        errors,
        ids,
        adjustments
      );
      if (!analyzed || noRoll) continue;
      if (array.dense) options[index] = analyzed.option;
      optionRecords.push(analyzed.optionRecord);
      referenceRecords.push(...analyzed.referenceRecords);
    }
    return { options, optionRecords, referenceRecords };
  } catch {
    issue(errors, "outcome-data-read-failed", path, "Risk Bid data could not be analyzed safely.");
    return null;
  }
}
function options(action, path, errors, analyzerOptions) {
  return analyzeAuthoredVoyageRiskBidOptions(
    action,
    path,
    errors,
    analyzerOptions
  );
}

function hasOnlyAuthoredNoRollApproaches(action) {
  try {
    const approaches = Object.getOwnPropertyDescriptor(action, "approaches");
    if (!approaches || !Object.hasOwn(approaches, "value")
      || !Array.isArray(approaches.value)) return false;
    const length = Object.getOwnPropertyDescriptor(approaches.value, "length");
    if (!length || !Object.hasOwn(length, "value")
      || !Number.isSafeInteger(length.value)
      || length.value <= 0
      || length.value > 3) return false;
    for (let index = 0; index < length.value; index += 1) {
      const approach = Object.getOwnPropertyDescriptor(
        approaches.value,
        String(index)
      );
      if (!approach || !Object.hasOwn(approach, "value")
        || !isPlainObject(approach.value)) return false;
      const noRoll = Object.getOwnPropertyDescriptor(
        approach.value,
        "noRoll"
      );
      const statistic = Object.getOwnPropertyDescriptor(
        approach.value,
        "statisticSlugOrAbilityId"
      );
      if (!noRoll || !Object.hasOwn(noRoll, "value")
        || noRoll.value !== true || statistic) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function validateAuthoredOptions(state, errors) {
  const collections = new Map();
  const stationIndices = ownArrayIndices(
    state.availableStations,
    "availableStations",
    errors
  );
  for (const stationIndex of stationIndices) {
    const stationPath = `availableStations[${stationIndex}]`;
    const stationRead = readOwnDataProperty(
      state.availableStations,
      String(stationIndex),
      stationPath,
      errors
    );
    if (!stationRead.present || !stationRead.ok
      || !isPlainObjectSafely(stationRead.value, stationPath, errors)) continue;
    const actionsPath = `${stationPath}.actions`;
    const actionsRead = readOwnDataProperty(
      stationRead.value,
      "actions",
      actionsPath,
      errors
    );
    if (!actionsRead.present || !actionsRead.ok
      || !Array.isArray(actionsRead.value)) continue;
    const actionIndices = ownArrayIndices(
      actionsRead.value,
      actionsPath,
      errors
    );
    for (const actionIndex of actionIndices) {
      const actionPath = `${actionsPath}[${actionIndex}]`;
      const actionRead = readOwnDataProperty(
        actionsRead.value,
        String(actionIndex),
        actionPath,
        errors
      );
      if (actionRead.present && actionRead.ok
        && isPlainObjectSafely(actionRead.value, actionPath, errors)) {
        const action = actionRead.value;
        const errorCount = errors.length;
        const analyzed = options(
          action,
          `${actionPath}.riskBidOptions`,
          errors,
          { noRoll: hasOnlyAuthoredNoRollApproaches(action) }
        );
        collections.set(action, errors.length === errorCount ? analyzed : null);
      }
    }
  }
  return collections;
}
function resolve(state, stationId, actionId, riskBidId, errors, path, authoredOptions = null) {
  const stationMatches = stations(state, stationId, errors);
  if (stationMatches.length !== 1) { issue(errors, stationMatches.length ? "risk-bid-station-ambiguous" : "risk-bid-station-not-available", `${path}.stationId`, "Risk Bid station must match exactly one available station."); return null; }
  if (!deriveOccupiedVoyageStationIds(state.stationAssignments).includes(stationId)) {
    issue(errors, "risk-bid-station-not-occupied", `${path}.stationId`, "Risk Bid station must be occupied.");
    return null;
  }
  const { station, index } = stationMatches[0];
  const actionList = readOwnDataProperty(
    station,
    "actions",
    `availableStations[${index}].actions`,
    errors
  );
  if (!actionList.ok || !actionList.present
    || !Array.isArray(actionList.value)) {
    issue(errors, "invalid-available-station-actions", `availableStations[${index}].actions`, "Available Voyage station actions must be an array.");
    return null;
  }
  const actionMatches = actions(actionList.value, actionId, index, errors);
  if (actionMatches.length !== 1) { issue(errors, actionMatches.length ? "risk-bid-action-ambiguous" : "risk-bid-action-not-available", `${path}.actionId`, "Risk Bid action must match exactly one authored action."); return null; }
  const { action, index: actionIndex } = actionMatches[0];
  const optionList = authoredOptions?.has(action)
    ? authoredOptions.get(action)
    : options(
      action,
      `availableStations[${index}].actions[${actionIndex}].riskBidOptions`,
      errors,
      { noRoll: hasOnlyAuthoredNoRollApproaches(action) }
    );
  if (!optionList) return null;
  const matches = optionList.options.filter((option) => option && option.riskBidId === riskBidId);
  if (matches.length !== 1) issue(errors, matches.length ? "risk-bid-option-ambiguous" : "risk-bid-not-available", `${path}.riskBidId`, "Risk Bid must match exactly one authored option for the selected action.");
  return matches.length === 1 ? { station, action, option: matches[0] } : null;
}

function inspectExactRiskBidRecord(value, path, errors) {
  const values = inspectExactObject(
    value,
    ["stationId", "actionId", "riskBidId", "dcAdjustment"],
    path,
    errors,
    "invalid-risk-bid",
    "unexpected-risk-bid-field"
  );
  if (!values) return null;
  for (const field of ["stationId", "actionId", "riskBidId", "dcAdjustment"]) {
    if (!Object.hasOwn(values, field)) {
      issue(
        errors,
        field === "dcAdjustment"
          ? "missing-risk-bid-dc-adjustment"
          : `invalid-risk-bid-${field === "stationId" ? "station-id" : field === "actionId" ? "action-id" : "id"}`,
        `${path}.${field}`,
        `Stored Risk Bid requires an own ${field}.`
      );
    }
  }
  return values;
}

function validateStoredRiskBidIdentity(bid, path, errors) {
  let valid = true;
  for (const [field, code] of [
    ["stationId", "invalid-risk-bid-station-id"],
    ["actionId", "invalid-risk-bid-action-id"],
    ["riskBidId", "invalid-risk-bid-id"]
  ]) {
    if (!Object.hasOwn(bid, field)) {
      valid = false;
      continue;
    }
    if (!hasId(bid[field])) {
      issue(errors, code, `${path}.${field}`, `Stored Risk Bid requires a non-empty exact ${field}.`);
      valid = false;
    } else if (!safeKey(bid[field])) {
      issue(errors, `unsafe-risk-bid-${field === "stationId" ? "station-key" : field === "actionId" ? "action-id" : "key"}`, `${path}.${field}`, `Stored Risk Bid ${field} must be safe.`);
      valid = false;
    }
  }
  if (!Object.hasOwn(bid, "dcAdjustment")) return false;
  if (!Number.isSafeInteger(bid.dcAdjustment) || !CANONICAL_DC_ADJUSTMENTS.has(bid.dcAdjustment)) {
    issue(errors, "invalid-risk-bid-dc-adjustment", `${path}.dcAdjustment`, "Stored Risk Bid dcAdjustment must be exactly 2, 5, or 8.");
    valid = false;
  }
  return valid;
}

function inspectRolledSelection(selection, path, errors) {
  if (!isPlainObjectSafely(selection, path, errors)) {
    issue(errors, "invalid-risk-bid-selection", path, "Risk Bid requires a plain station selection.");
    return null;
  }
  const actionId = readOwnDataProperty(selection, "actionId", `${path}.actionId`, errors);
  const approachId = readOwnDataProperty(selection, "approachId", `${path}.approachId`, errors);
  const statistic = readOwnDataProperty(selection, "statisticSlugOrAbilityId", `${path}.statisticSlugOrAbilityId`, errors);
  const noRoll = readOwnDataProperty(selection, "noRoll", `${path}.noRoll`, errors);
  if (![actionId, approachId, statistic, noRoll].every((read) => read.ok)) return null;
  if (noRoll.present) {
    issue(errors, "risk-bid-requires-rolled-approach", `${path}.noRoll`, "Risk Bid requires a committed rolled approach.");
    return null;
  }
  if (!actionId.present || !hasId(actionId.value)) {
    issue(errors, "risk-bid-selection-missing-action", `${path}.actionId`, "Risk Bid requires an existing valid action selection.");
    return null;
  }
  if (!approachId.present || !hasId(approachId.value) || !statistic.present || !hasId(statistic.value)) {
    issue(errors, "risk-bid-requires-committed-approach", path, "Risk Bid requires a committed rolled approach for the selected action.");
    return null;
  }
  return {
    actionId: actionId.value,
    approachId: approachId.value,
    statisticSlugOrAbilityId: statistic.value
  };
}

function inspectRiskBidCollectionKeys(riskBids, errors) {
  const keys = readOwnKeys(riskBids, "riskBids", errors);
  if (!keys) return [];
  const stationKeys = [];
  for (const key of keys) {
    if (typeof key !== "string") {
      issue(errors, "unexpected-risk-bid-map-key", "riskBids.[symbol]", "Stored Risk Bid map keys must be exact station ID strings.");
      continue;
    }
    stationKeys.push(key);
  }
  return stationKeys;
}

function riskBidValidationReport(valid, errors, warnings, selectedRiskBidStationIds = [], baseActionStationIds = [], riskBidLimit = 0) {
  const selectedIds = [...selectedRiskBidStationIds];
  return {
    valid,
    selectedRiskBidCount: selectedIds.length,
    selectedRiskBidStationIds: selectedIds,
    baseActionStationIds: [...baseActionStationIds],
    riskBidLimit,
    overRiskBidLimit: selectedIds.length > riskBidLimit,
    errors: deduplicateIssues(errors),
    warnings: deduplicateIssues(warnings)
  };
}

function validateVoyageEncounterRiskBidsUnsafe(state) {
  const structural = validateVoyageEncounterState(state);
  if (!structural.valid) {
    return riskBidValidationReport(
      false,
      [...structural.errors],
      [...structural.warnings],
      [],
      [],
      deriveOccupiedVoyageStationIds(state?.stationAssignments).length
    );
  }
  const selections = validateVoyageEncounterStationSelections(state);
  const errors = [...selections.errors]; const warnings = [...structural.warnings, ...selections.warnings];
  const authoredOptions = validateAuthoredOptions(state, errors);
  const riskBidKeys = inspectRiskBidCollectionKeys(state.riskBids, errors);
  const occupiedStationIds = deriveOccupiedVoyageStationIds(state.stationAssignments);
  const validBidStationIds = new Set();
  for (const key of riskBidKeys) {
    const entryErrorCount = errors.length;
    const path = `riskBids.${key}`;
    if (!safeKey(key)) { issue(errors, "unsafe-risk-bid-station-key", path, "Stored Risk Bid uses an unsafe station key."); continue; }
    const bidRead = readOwnDataProperty(state.riskBids, key, path, errors);
    if (!bidRead.ok || !bidRead.present) continue;
    const bid = inspectExactRiskBidRecord(bidRead.value, path, errors);
    if (!bid || !validateStoredRiskBidIdentity(bid, path, errors)) continue;
    if (bid.stationId !== key) { issue(errors, "risk-bid-station-key-mismatch", `${path}.stationId`, "Stored Risk Bid stationId must match its riskBids map key."); continue; }
    const selectionRead = readOwnDataProperty(state.selections, key, `selections.${key}`, errors);
    if (!selectionRead.present) { issue(errors, "risk-bid-selection-missing", path, "Stored Risk Bid requires an existing station action selection."); continue; }
    if (!selectionRead.ok) continue;
    const selection = inspectRolledSelection(selectionRead.value, `selections.${key}`, errors);
    if (!selection) continue;
    if (selection.actionId !== bid.actionId) { issue(errors, "risk-bid-action-mismatch", `${path}.actionId`, "Stored Risk Bid actionId must match the station's selected action."); continue; }
    const resolved = resolve(state, bid.stationId, bid.actionId, bid.riskBidId, errors, path, authoredOptions);
    if (resolved && bid.dcAdjustment !== resolved.option.dcAdjustment) {
      issue(errors, "risk-bid-dc-adjustment-mismatch", `${path}.dcAdjustment`, "Stored Risk Bid dcAdjustment must match its authored option.");
    }
    if (resolved && selections.valid && errors.length === entryErrorCount) {
      validBidStationIds.add(key);
    }
  }
  const selectedRiskBidStationIds = occupiedStationIds.filter(
    (stationId) => validBidStationIds.has(stationId)
  );
  const riskBidKeySet = new Set(riskBidKeys);
  const baseActionStationIds = selections.valid
    ? occupiedStationIds.filter((stationId) => {
      if (riskBidKeySet.has(stationId)
        || !Object.hasOwn(state.selections, stationId)) return false;
      const selection = state.selections[stationId];
      return isPlainObject(selection) && Object.hasOwn(selection, "approachId");
    })
    : [];
  return riskBidValidationReport(
    errors.length === 0,
    errors,
    warnings,
    selectedRiskBidStationIds,
    baseActionStationIds,
    occupiedStationIds.length
  );
}

/** Validate persisted, action-and-approach-coupled Voyage Risk Bid selections. */
export function validateVoyageEncounterRiskBids(state) {
  try {
    return validateVoyageEncounterRiskBidsUnsafe(state);
  } catch {
    return riskBidValidationReport(
      false,
      [{ code: "risk-bid-data-read-failed", path: "encounterState", message: "Risk Bid state could not be read safely.", severity: "error" }],
      []
    );
  }
}

function inspectExactRequest(value, path, fields, errors) {
  if (!isPlainObjectSafely(value, path, errors)) {
    issue(errors, "invalid-risk-bid-request", path, "Risk Bid request must be a plain object.");
    return null;
  }
  const keys = readOwnKeys(value, path, errors);
  if (!keys) return null;
  const captured = {};
  for (const key of keys) {
    const keyPath = `${path}.${typeof key === "symbol" ? "[symbol]" : key}`;
    if (typeof key !== "string" || !fields.includes(key)) {
      issue(errors, "unexpected-risk-bid-request-field", keyPath, "Unexpected Risk Bid request field.");
      continue;
    }
    const read = readOwnDataProperty(value, key, keyPath, errors);
    if (read.ok) captured[key] = read.value;
  }
  for (const field of fields) {
    if (!Object.hasOwn(captured, field)) {
      issue(errors, field === "stationId" ? "invalid-risk-bid-station-id" : "invalid-risk-bid-id", `${path}.${field}`, `Risk Bid request requires an own ${field}.`);
    }
  }
  return captured;
}

function inspectMutationRequest(state, value, needsExisting, clear = false) {
  const errors = [];
  const path = clear ? "clearRequest" : "bidRequest";
  const captured = inspectExactRequest(value, path, clear ? ["stationId"] : ["stationId", "riskBidId"], errors);
  if (!captured) return { errors };
  const stationId = captured.stationId;
  const riskBidId = captured.riskBidId;
  if (!hasId(stationId)) issue(errors, "invalid-risk-bid-station-id", `${path}.stationId`, "Risk Bid requires a non-empty exact stationId.");
  else if (!safeKey(stationId)) issue(errors, "unsafe-risk-bid-station-key", `${path}.stationId`, "Risk Bid requires a safe station map key.");
  if (!clear) {
    if (!hasId(riskBidId)) issue(errors, "invalid-risk-bid-id", `${path}.riskBidId`, "Risk Bid requires a non-empty exact riskBidId.");
    else if (!safeKey(riskBidId)) issue(errors, "unsafe-risk-bid-key", `${path}.riskBidId`, "Risk Bid requires a safe riskBidId.");
  }
  if (errors.length) return { errors };

  const hasExisting = Object.hasOwn(state.riskBids, stationId);
  if (needsExisting !== hasExisting) {
    issue(errors, needsExisting ? "risk-bid-does-not-exist" : "risk-bid-already-exists", `riskBids.${stationId}`, needsExisting ? "Voyage station has no Risk Bid to edit." : "Voyage station already has a Risk Bid.");
  }
  if (clear || errors.length) return { errors, stationId, previous: state.riskBids[stationId] };

  const selectionRead = readOwnDataProperty(state.selections, stationId, `selections.${stationId}`, errors);
  if (!selectionRead.present) {
    issue(errors, "risk-bid-selection-missing", `selections.${stationId}`, "Risk Bid requires an existing station action selection.");
    return { errors, stationId, riskBidId };
  }
  if (!selectionRead.ok) return { errors, stationId, riskBidId };
  const selection = inspectRolledSelection(selectionRead.value, `selections.${stationId}`, errors);
  if (!selection) return { errors, stationId, riskBidId };
  const resolved = resolve(state, stationId, selection.actionId, riskBidId, errors, path);
  return { errors, stationId, riskBidId, selection, resolved, previous: state.riskBids[stationId] };
}

function mutateUnsafe(state, value, type, existing = false, clear = false) {
  const source = validateVoyageEncounterRiskBids(state);
  const warnings = [...source.warnings];
  if (!source.valid) return failure(source.errors, warnings);
  if (state.lifecycleState !== VOYAGE_ENCOUNTER_LIFECYCLE_STATES.ACTIVE) return failure([{ code: "risk-bid-requires-active", path: "lifecycleState", message: "Risk Bid editing requires an Active encounter.", severity: "error" }], warnings);
  if (state.phase !== VOYAGE_ROUND_PHASES.CREW_PLANNING) return failure([{ code: "risk-bid-requires-crew-planning", path: "phase", message: "Risk Bid editing requires the Crew Planning phase.", severity: "error" }], warnings);

  const input = inspectMutationRequest(state, value, existing || clear, clear);
  if (input.errors.length) return failure(input.errors, warnings);
  const previous = input.previous;
  if (existing && !clear && previous.riskBidId === input.riskBidId) {
    return failure([{ code: "risk-bid-unchanged", path: "bidRequest.riskBidId", message: "Requested Risk Bid is already selected.", severity: "error" }], warnings);
  }

  let candidate;
  try {
    candidate = clonePlainData(state);
  } catch {
    return failure([{ code: "risk-bid-candidate-construction-failed", path: "encounterState", message: "Risk Bid mutation could not clone encounter state.", severity: "error" }], warnings);
  }
  if (clear) {
    delete candidate.riskBids[input.stationId];
  } else {
    candidate.riskBids[input.stationId] = {
      stationId: input.stationId,
      actionId: input.selection.actionId,
      riskBidId: input.riskBidId,
      dcAdjustment: input.resolved.option.dcAdjustment
    };
  }
  candidate.revision = state.revision + 1;
  const final = validateVoyageEncounterRiskBids(candidate);
  warnings.push(...final.warnings);
  if (!final.valid) return failure(final.errors, warnings);

  const selectedBid = clear ? previous : candidate.riskBids[input.stationId];
  const event = {
    type,
    encounterId: candidate.encounterId,
    lifecycleState: candidate.lifecycleState,
    roundNumber: candidate.roundNumber,
    phase: candidate.phase,
    stationId: input.stationId,
    actionId: selectedBid.actionId,
    ...(previous && !clear ? {
      previousRiskBidId: previous.riskBidId,
      previousDcAdjustment: previous.dcAdjustment
    } : {}),
    riskBidId: selectedBid.riskBidId,
    dcAdjustment: selectedBid.dcAdjustment,
    previousRevision: state.revision,
    revision: candidate.revision
  };
  return { ok: true, nextState: candidate, events: [event], errors: [], warnings: deduplicateIssues(warnings) };
}

function mutate(state, value, type, existing = false, clear = false) {
  try {
    return mutateUnsafe(state, value, type, existing, clear);
  } catch {
    return failure([{ code: "risk-bid-data-read-failed", path: "encounterState", message: "Risk Bid mutation data could not be read safely.", severity: "error" }]);
  }
}

export const applyVoyageEncounterRiskBidSelection = (state, request) => mutate(state, request, "voyage.risk-bid-selected");
export const applyVoyageEncounterRiskBidChange = (state, request) => mutate(state, request, "voyage.risk-bid-changed", true);
export const applyVoyageEncounterRiskBidClear = (state, request) => mutate(state, request, "voyage.risk-bid-cleared", true, true);
