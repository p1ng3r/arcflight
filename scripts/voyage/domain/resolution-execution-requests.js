import {
  VOYAGE_ACTION_EXECUTION_MODES as MODES,
  VOYAGE_CHECK_SECRECY as SECRECY,
  VOYAGE_CHECK_SOURCE_KINDS as SOURCES,
  VOYAGE_DC_SOURCE_KINDS as DCS,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE,
  VOYAGE_ROUND_PHASES as PHASES
} from "./constants.js";
import { isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import {
  analyzeVoyageEncounterResolutionOrder,
  deduplicateVoyageResolutionIssues
} from "./resolution-order.js";

const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });
const own = (value, key) => Object.hasOwn(value, key);
const sourceKinds = new Set(Object.values(SOURCES).filter((value) => value !== SOURCES.NO_ROLL));
const dcKinds = new Set(Object.values(DCS));
const isNonBlankExactString = (value) => typeof value === "string" && value.trim().length > 0;

function readOwnValue(object, key, path, errors) {
  if (
    object === null
    || (typeof object !== "object" && typeof object !== "function")
  ) {
    return { present: false, ok: false, value: undefined };
  }

  if (!Object.hasOwn(object, key)) {
    return { present: false, ok: true, value: undefined };
  }

  try {
    return { present: true, ok: true, value: object[key] };
  } catch {
    issue(errors, "execution-data-read-failed", path, "Execution data could not be read safely.");
    return { present: true, ok: false, value: undefined };
  }
}

function numericIndices(array) {
  if (!Array.isArray(array)) return [];

  const result = [];
  for (let index = 0; index < array.length; index += 1) {
    if (Object.hasOwn(array, index)) result.push(index);
  }
  return result;
}

function capturePlainData(value, path, errors, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value };
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) return { ok: true, value };
    issue(errors, "invalid-execution-plain-data", path, "Execution data numbers must be finite.");
    return { ok: false, value: undefined };
  }

  if (typeof value !== "object" || ancestors.has(value)) {
    issue(errors, "invalid-execution-plain-data", path, "Execution data must be recursively plain and acyclic.");
    return { ok: false, value: undefined };
  }

  const array = Array.isArray(value);
  if (!array && !isPlainObject(value)) {
    issue(errors, "invalid-execution-plain-data", path, "Execution data must be recursively plain.");
    return { ok: false, value: undefined };
  }

  ancestors.add(value);

  if (array) {
    const result = new Array(value.length);
    let ok = true;

    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) continue;

      const childPath = `${path}[${index}]`;
      const read = readOwnValue(value, index, childPath, errors);
      if (!read.ok) {
        ok = false;
        continue;
      }

      const child = capturePlainData(read.value, childPath, errors, ancestors);
      if (!child.ok) {
        ok = false;
        continue;
      }

      result[index] = child.value;
    }

    ancestors.delete(value);
    return { ok, value: ok ? result : undefined };
  }

  const result = {};
  let ok = true;
  for (const key of Object.keys(value)) {
    const childPath = `${path}.${key}`;
    const read = readOwnValue(value, key, childPath, errors);
    if (!read.ok) {
      ok = false;
      continue;
    }

    const child = capturePlainData(read.value, childPath, errors, ancestors);
    if (!child.ok) {
      ok = false;
      continue;
    }

    Object.defineProperty(result, key, {
      value: child.value,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }

  ancestors.delete(value);
  return { ok, value: ok ? result : undefined };
}

function readAndCapturePlainValue(object, key, path, errors) {
  const read = readOwnValue(object, key, path, errors);
  if (!read.present) return { present: false, ok: true, value: undefined };
  if (!read.ok) return { present: true, ok: false, value: undefined };

  const captured = capturePlainData(read.value, path, errors);
  return { present: true, ok: captured.ok, value: captured.value };
}

function defaultActionAnalysis() {
  return {
    valid: true,
    mode: MODES.NO_ROLL,
    source: { kind: SOURCES.NO_ROLL },
    statisticOptions: [],
    dcSource: null,
    secrecy: SECRECY.PUBLIC,
    metadata: {},
    errors: [],
    warnings: []
  };
}

function analyzeActionDefinition(action, path) {
  const errors = [];
  const analysis = defaultActionAnalysis();
  const checkRead = readOwnValue(action, "check", `${path}.check`, errors);

  if (!checkRead.present) return analysis;
  if (!checkRead.ok) {
    analysis.valid = false;
    analysis.errors = errors;
    return analysis;
  }

  const check = checkRead.value;
  if (!isPlainObject(check)) {
    issue(errors, "invalid-action-check", `${path}.check`, "Action check must be a plain object when authored.");
    analysis.valid = false;
    analysis.errors = errors;
    return analysis;
  }

  const sourceRead = readAndCapturePlainValue(check, "source", `${path}.check.source`, errors);
  const optionsRead = readAndCapturePlainValue(check, "statisticOptions", `${path}.check.statisticOptions`, errors);
  const dcRead = readAndCapturePlainValue(check, "dcSource", `${path}.check.dcSource`, errors);
  const secrecyRead = readOwnValue(check, "secrecy", `${path}.check.secrecy`, errors);
  const metadataRead = readAndCapturePlainValue(check, "metadata", `${path}.check.metadata`, errors);

  for (const [field, read] of [
    ["source", sourceRead],
    ["statisticOptions", optionsRead],
    ["dcSource", dcRead],
    ["secrecy", secrecyRead]
  ]) {
    if (!read.present) issue(errors, "missing-action-check-field", `${path}.check.${field}`, `Action check requires ${field}.`);
  }

  if (sourceRead.present && sourceRead.ok) {
    analysis.source = sourceRead.value;
    if (!isPlainObject(analysis.source)) {
      issue(errors, "invalid-check-source", `${path}.check.source`, "Check source must be a plain object.");
    } else if (!own(analysis.source, "kind") || !sourceKinds.has(analysis.source.kind)) {
      issue(errors, "invalid-check-source-kind", `${path}.check.source.kind`, "Check source kind is not recognized.");
    }
  }

  if (optionsRead.present && optionsRead.ok) {
    analysis.statisticOptions = optionsRead.value;
    if (!Array.isArray(analysis.statisticOptions)) {
      issue(errors, "invalid-check-statistic-options", `${path}.check.statisticOptions`, "statisticOptions must be an array.");
    } else {
      const indices = numericIndices(analysis.statisticOptions);
      if (indices.length === 0) issue(errors, "empty-check-statistic-options", `${path}.check.statisticOptions`, "statisticOptions requires an own numeric entry.");

      const seen = new Set();
      for (let indexPosition = 0; indexPosition < indices.length; indexPosition += 1) {
        const index = indices[indexPosition];
        const value = analysis.statisticOptions[index];
        if (!isNonBlankExactString(value)) {
          issue(errors, "invalid-check-statistic-option", `${path}.check.statisticOptions[${index}]`, "Statistic option must be a non-blank exact string.");
        } else if (seen.has(value)) {
          issue(errors, "duplicate-check-statistic-option", `${path}.check.statisticOptions[${index}]`, "Statistic options must be unique.");
        } else {
          seen.add(value);
        }
      }
    }
  }

  if (dcRead.present && dcRead.ok) {
    analysis.dcSource = dcRead.value;
    if (!isPlainObject(analysis.dcSource)) {
      issue(errors, "invalid-check-dc-source", `${path}.check.dcSource`, "DC source must be a plain object.");
    } else if (!own(analysis.dcSource, "kind") || !dcKinds.has(analysis.dcSource.kind)) {
      issue(errors, "invalid-check-dc-source-kind", `${path}.check.dcSource.kind`, "DC source kind is not recognized.");
    } else if (
      analysis.dcSource.kind === DCS.FIXED
      && (!own(analysis.dcSource, "value")
        || !Number.isSafeInteger(analysis.dcSource.value)
        || analysis.dcSource.value < 0)
    ) {
      issue(errors, "invalid-fixed-check-dc", `${path}.check.dcSource.value`, "Fixed DC requires a non-negative safe integer value.");
    }
  }

  if (secrecyRead.present && secrecyRead.ok) {
    analysis.secrecy = secrecyRead.value;
    if (!Object.values(SECRECY).includes(analysis.secrecy)) issue(errors, "invalid-check-secrecy", `${path}.check.secrecy`, "Check secrecy must be public or secret.");
  }

  if (metadataRead.present && metadataRead.ok) {
    analysis.metadata = metadataRead.value;
    if (!isPlainObject(analysis.metadata)) issue(errors, "invalid-check-metadata", `${path}.check.metadata`, "Check metadata must be a plain object.");
  }

  analysis.mode = MODES.CHECK;
  analysis.valid = errors.length === 0;
  analysis.errors = errors;
  return analysis;
}

function analyzeActionDefinitions(state) {
  const errors = [];
  const analyses = new Map();
  const stations = state.availableStations;

  for (let stationIndex = 0; stationIndex < stations.length; stationIndex += 1) {
    if (!Object.hasOwn(stations, stationIndex)) continue;

    const station = stations[stationIndex];
    if (!isPlainObject(station) || !Array.isArray(station.actions)) continue;

    const stationAnalyses = new Map();
    analyses.set(station.stationId, stationAnalyses);
    for (let actionIndex = 0; actionIndex < station.actions.length; actionIndex += 1) {
      if (!Object.hasOwn(station.actions, actionIndex)) continue;

      const action = station.actions[actionIndex];
      if (!isPlainObject(action)) continue;
      const actionPath = `availableStations[${stationIndex}].actions[${actionIndex}]`;
      const analysis = analyzeActionDefinition(action, actionPath);
      stationAnalyses.set(action.actionId, analysis);
      errors.push(...analysis.errors, ...analysis.warnings);
    }
  }

  return { analyses, errors };
}

function actionAnalysisFor(analyses, stationId, actionId) {
  return analyses.get(stationId)?.get(actionId) ?? null;
}

function pendingChecksAreEmpty(state) {
  if (!Array.isArray(state.pendingChecks)) return false;

  for (let index = 0; index < state.pendingChecks.length; index += 1) {
    if (Object.hasOwn(state.pendingChecks, index)) return false;
  }
  return true;
}

export function validateVoyageEncounterActionExecutionDefinitions(state) {
  try {
    const structural = validateVoyageEncounterState(state);
    const errors = [...structural.errors];
    const warnings = [...structural.warnings];

    if (structural.valid && Array.isArray(state.availableStations)) {
      const analyzed = analyzeActionDefinitions(state);
      errors.push(...analyzed.errors);
    }

    const final = deduplicateVoyageResolutionIssues(errors);
    return {
      valid: final.length === 0,
      errors: final,
      warnings: deduplicateVoyageResolutionIssues(warnings)
    };
  } catch {
    const errors = [];
    issue(errors, "execution-data-read-failed", "$", "Execution data could not be read safely.");
    return { valid: false, errors, warnings: [] };
  }
}

export function prepareVoyageEncounterActionExecutionRequests(state) {
  let structural = null;
  let active = false;
  let resolution = false;

  try {
    structural = validateVoyageEncounterState(state);
    active = state?.lifecycleState === LIFE.ACTIVE;
    resolution = state?.phase === PHASES.RESOLUTION;

    const order = analyzeVoyageEncounterResolutionOrder(state);
    const definitions = structural.valid && Array.isArray(state.availableStations)
      ? analyzeActionDefinitions(state)
      : { analyses: new Map(), errors: [] };
    const errors = [...order.errors, ...definitions.errors];
    const warnings = [...structural.warnings, ...order.warnings];

    if (structural.valid && !active) issue(errors, "execution-requires-active", "lifecycleState", "Preparing execution requests requires an Active encounter.");
    if (structural.valid && !resolution) issue(errors, "execution-requires-resolution", "phase", "Preparing execution requests requires Resolution phase.");

    const validPlan = structural.valid && active && resolution && order.valid && errors.length === 0;
    const requests = [];

    if (validPlan) {
      for (let rowIndex = 0; rowIndex < order.orderedActions.length; rowIndex += 1) {
        const row = order.orderedActions[rowIndex];
        const analysis = actionAnalysisFor(definitions.analyses, row.stationId, row.actionId);
        const targetRead = readAndCapturePlainValue(state.targets, row.stationId, `targets.${row.stationId}`, errors);
        const target = targetRead.present && targetRead.ok ? targetRead.value : null;

        if (!analysis || !analysis.valid || !targetRead.ok) continue;

        requests.push({
          ...row,
          target,
          mode: analysis.mode,
          source: analysis.source,
          statisticOptions: analysis.mode === MODES.CHECK ? analysis.statisticOptions : [],
          dcSource: analysis.mode === MODES.CHECK ? analysis.dcSource : null,
          secrecy: analysis.mode === MODES.CHECK ? analysis.secrecy : SECRECY.PUBLIC,
          metadata: analysis.mode === MODES.CHECK ? analysis.metadata : {}
        });
      }
    }

    const final = deduplicateVoyageResolutionIssues(errors);
    const checkCount = requests.reduce((count, request) => count + (request.mode === MODES.CHECK ? 1 : 0), 0);
    const pendingChecksEmpty = structural.valid ? pendingChecksAreEmpty(state) : false;

    return {
      structurallyValid: structural.valid,
      active,
      resolution,
      pendingChecksEmpty,
      readyForExecution: validPlan && final.length === 0,
      pendingCheckPreparationRequired: validPlan && checkCount > 0,
      readyToPreparePendingChecks: validPlan && checkCount > 0 && pendingChecksEmpty && final.length === 0,
      actionCount: requests.length,
      checkCount,
      noRollActionCount: requests.length - checkCount,
      executionRequests: requests,
      errors: final,
      warnings: deduplicateVoyageResolutionIssues(warnings)
    };
  } catch {
    const errors = [];
    issue(errors, "execution-data-read-failed", "$", "Execution data could not be read safely.");
    return {
      structurallyValid: structural?.valid ?? false,
      active,
      resolution,
      pendingChecksEmpty: structural?.valid ? pendingChecksAreEmpty(state) : false,
      readyForExecution: false,
      pendingCheckPreparationRequired: false,
      readyToPreparePendingChecks: false,
      actionCount: 0,
      checkCount: 0,
      noRollActionCount: 0,
      executionRequests: [],
      errors,
      warnings: structural?.warnings ?? []
    };
  }
}
