import {
  VOYAGE_ACTION_EXECUTION_MODES as MODES,
  VOYAGE_CHECK_SECRECY as SECRECY,
  VOYAGE_CHECK_SOURCE_KINDS as SOURCES,
  VOYAGE_DC_SOURCE_KINDS as DCS,
  VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE,
  VOYAGE_ROUND_PHASES as PHASES
} from "./constants.js";
import { isPlainObject } from "./defaults.js";
import { deriveOccupiedVoyageStationIds } from "./station-assignments.js";
import { analyzeAuthoredVoyageStationApproaches } from "./station-selection.js";
import { analyzeAuthoredVoyageRiskBidOptions } from "./risk-bids.js";
import { validateVoyageEncounterState } from "./validation.js";
import {
  analyzeVoyageEncounterResolutionOrder,
  deduplicateVoyageResolutionIssues
} from "./resolution-order.js";

const issue = (errors, code, path, message) => errors.push({ code, path, message, severity: "error" });
const own = (value, key) => Object.hasOwn(value, key);
const unsafeIds = new Set(["__proto__", "constructor", "prototype"]);
const selectionFields = Object.freeze([
  "stationId",
  "actionId",
  "approachId",
  "statisticSlugOrAbilityId",
  "noRoll"
]);
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

function readOwnDataValue(object, key, path, errors) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return { present: false, ok: true, value: undefined };
    if (!Object.hasOwn(descriptor, "value")) {
      issue(
        errors,
        "execution-approach-selection-data-read-failed",
        path,
        "Execution approach selections must use own data properties."
      );
      return { present: true, ok: false, value: undefined };
    }
    return { present: true, ok: true, value: descriptor.value };
  } catch {
    issue(
      errors,
      "execution-approach-selection-data-read-failed",
      path,
      "Execution approach selection data could not be read safely."
    );
    return { present: true, ok: false, value: undefined };
  }
}

function readOwnExecutionDataValue(object, key, path, errors) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return { present: false, ok: true, value: undefined };
    if (!Object.hasOwn(descriptor, "value")) {
      issue(
        errors,
        "execution-dc-data-read-failed",
        path,
        "Execution DC data must use own data properties."
      );
      return { present: true, ok: false, value: undefined };
    }
    return { present: true, ok: true, value: descriptor.value };
  } catch {
    issue(
      errors,
      "execution-dc-data-read-failed",
      path,
      "Execution DC data could not be inspected safely."
    );
    return { present: true, ok: false, value: undefined };
  }
}

function validExactSafeId(value) {
  return isNonBlankExactString(value) && !unsafeIds.has(value);
}

function captureCommittedApproachSelections(state) {
  const errors = [];
  const selections = new Map();
  const seenStationIds = new Set();
  let keys;

  try {
    keys = Reflect.ownKeys(state.selections);
  } catch {
    issue(
      errors,
      "execution-approach-selection-data-read-failed",
      "selections",
      "Execution approach selections could not be inspected safely."
    );
    return { valid: false, selections, errors };
  }

  for (const key of keys) {
    const selectionPath = typeof key === "symbol"
      ? "selections.[symbol]"
      : `selections.${key}`;
    if (typeof key !== "string" || unsafeIds.has(key)) {
      issue(
        errors,
        "unexpected-execution-approach-selection-key",
        selectionPath,
        "Execution approach selections require safe string station keys."
      );
      continue;
    }

    const selectionRead = readOwnDataValue(
      state.selections,
      key,
      selectionPath,
      errors
    );
    if (!selectionRead.ok || !selectionRead.present) continue;
    const selection = selectionRead.value;
    if (!isPlainObject(selection)) {
      issue(
        errors,
        "invalid-execution-approach-selection",
        selectionPath,
        "Execution approach selection must be a plain object."
      );
      continue;
    }

    let selectionKeys;
    try {
      selectionKeys = Reflect.ownKeys(selection);
    } catch {
      issue(
        errors,
        "execution-approach-selection-data-read-failed",
        selectionPath,
        "Execution approach selection could not be inspected safely."
      );
      continue;
    }

    const reads = Object.create(null);
    for (const field of selectionFields) {
      reads[field] = readOwnDataValue(
        selection,
        field,
        `${selectionPath}.${field}`,
        errors
      );
    }

    const rolled = reads.statisticSlugOrAbilityId.present;
    const noRoll = reads.noRoll.present;
    const expectedFields = rolled && !noRoll
      ? selectionFields.slice(0, 4)
      : !rolled && noRoll
        ? ["stationId", "actionId", "approachId", "noRoll"]
        : ["stationId", "actionId", "approachId"];

    for (const selectionKey of selectionKeys) {
      if (
        typeof selectionKey !== "string"
        || !expectedFields.includes(selectionKey)
      ) {
        issue(
          errors,
          "unexpected-execution-approach-selection-field",
          `${selectionPath}.${typeof selectionKey === "symbol" ? "[symbol]" : selectionKey}`,
          "Execution approach selection has an unexpected own field."
        );
      }
    }

    for (const field of ["stationId", "actionId", "approachId"]) {
      const read = reads[field];
      if (!read.present) {
        issue(
          errors,
          "missing-execution-approach-selection-field",
          `${selectionPath}.${field}`,
          `Execution approach selection requires an own ${field}.`
        );
      } else if (read.ok && !validExactSafeId(read.value)) {
        issue(
          errors,
          "invalid-execution-approach-selection-field",
          `${selectionPath}.${field}`,
          `Execution approach selection ${field} must be a safe non-blank exact string.`
        );
      }
    }

    if (rolled === noRoll) {
      issue(
        errors,
        "ambiguous-execution-approach-selection-identity",
        selectionPath,
        "Execution approach selection requires exactly one execution identity."
      );
    } else if (
      rolled
      && reads.statisticSlugOrAbilityId.ok
      && !validExactSafeId(reads.statisticSlugOrAbilityId.value)
    ) {
      issue(
        errors,
        "invalid-execution-statistic-or-ability-id",
        `${selectionPath}.statisticSlugOrAbilityId`,
        "Execution statistic or ability identity must be a safe non-blank exact string."
      );
    } else if (noRoll && reads.noRoll.ok && reads.noRoll.value !== true) {
      issue(
        errors,
        "invalid-execution-no-roll-identity",
        `${selectionPath}.noRoll`,
        "Execution no-roll identity must be exactly true."
      );
    }

    const stationId = reads.stationId.value;
    if (reads.stationId.ok && validExactSafeId(stationId)) {
      if (stationId !== key) {
        issue(
          errors,
          "execution-approach-selection-station-mismatch",
          `${selectionPath}.stationId`,
          "Execution approach selection stationId must match its selections key."
        );
      }
      if (seenStationIds.has(stationId)) {
        issue(
          errors,
          "duplicate-execution-approach-selection",
          `${selectionPath}.stationId`,
          "Execution approach selection matches a station more than once."
        );
      } else {
        seenStationIds.add(stationId);
      }
    }

    const errorCount = errors.length;
    const allReadsValid = expectedFields.every(
      (field) => reads[field]?.present && reads[field]?.ok
    );
    if (
      allReadsValid
      && stationId === key
      && validExactSafeId(reads.stationId.value)
      && validExactSafeId(reads.actionId.value)
      && validExactSafeId(reads.approachId.value)
      && (rolled
        ? validExactSafeId(reads.statisticSlugOrAbilityId.value)
        : reads.noRoll.value === true)
    ) {
      selections.set(key, rolled
        ? {
            stationId,
            actionId: reads.actionId.value,
            approachId: reads.approachId.value,
            statisticSlugOrAbilityId: reads.statisticSlugOrAbilityId.value
          }
        : {
            stationId,
            actionId: reads.actionId.value,
            approachId: reads.approachId.value,
            noRoll: true
          });
    } else if (errors.length === errorCount) {
      issue(
        errors,
        "invalid-execution-approach-selection",
        selectionPath,
        "Execution approach selection is malformed."
      );
    }
  }

  for (const stationId of deriveOccupiedVoyageStationIds(state.stationAssignments)) {
    if (!selections.has(stationId)) {
      issue(
        errors,
        "missing-execution-approach-selection",
        `selections.${stationId}`,
        "Occupied station requires one committed execution approach selection."
      );
    }
  }

  return { valid: errors.length === 0, selections, errors };
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
    actionDcAdjustment: 0,
    upgradeDcReduction: 0,
    secrecy: SECRECY.PUBLIC,
    metadata: {},
    errors: [],
    warnings: []
  };
}

function inspectDcSource(value, path, errors) {
  if (!isPlainObject(value)) {
    issue(errors, "invalid-check-dc-source", path, "DC source must be a plain object.");
    return null;
  }

  let keys;
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issue(errors, "execution-dc-data-read-failed", path, "DC source could not be inspected safely.");
    return null;
  }

  const allowed = new Set(["kind", "value"]);
  for (const key of keys) {
    const keyPath = `${path}.${typeof key === "symbol" ? "[symbol]" : key}`;
    if (typeof key !== "string" || !allowed.has(key) || unsafeIds.has(key)) {
      issue(errors, "unexpected-check-dc-source-field", keyPath, "DC source contains an unexpected field.");
    }
  }

  const kindRead = readOwnExecutionDataValue(value, "kind", `${path}.kind`, errors);
  if (!kindRead.present) {
    issue(errors, "invalid-check-dc-source-kind", `${path}.kind`, "DC source requires an own kind.");
    return null;
  }
  if (!kindRead.ok) return null;
  if (!dcKinds.has(kindRead.value)) {
    issue(errors, "invalid-check-dc-source-kind", `${path}.kind`, "DC source kind is not recognized.");
    return null;
  }

  const valueRead = readOwnExecutionDataValue(value, "value", `${path}.value`, errors);
  if (kindRead.value === DCS.FIXED) {
    if (
      !valueRead.present
      || !valueRead.ok
      || !Number.isSafeInteger(valueRead.value)
      || valueRead.value < 0
    ) {
      if (!valueRead.present || valueRead.ok) {
        issue(errors, "invalid-fixed-check-dc", `${path}.value`, "Fixed DC requires a non-negative safe integer value.");
      }
      return null;
    }
    return { kind: kindRead.value, value: valueRead.value };
  }

  if (valueRead.present) {
    issue(errors, "unexpected-check-dc-source-value", `${path}.value`, "Only a fixed DC source may own a value.");
    return null;
  }
  return { kind: kindRead.value };
}

function inspectOptionalDcComponent(check, field, path, errors, { nonNegative = false } = {}) {
  const read = readOwnExecutionDataValue(check, field, `${path}.${field}`, errors);
  if (!read.present) return 0;
  if (!read.ok) return null;
  if (
    !Number.isSafeInteger(read.value)
    || (nonNegative && read.value < 0)
  ) {
    issue(
      errors,
      field === "upgradeDcReduction"
        ? "invalid-upgrade-dc-reduction"
        : "invalid-action-dc-adjustment",
      `${path}.${field}`,
      field === "upgradeDcReduction"
        ? "upgradeDcReduction must be a non-negative safe integer reduction magnitude."
        : "actionDcAdjustment must be a signed safe integer."
    );
    return null;
  }
  return read.value;
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
  const dcRead = readOwnExecutionDataValue(check, "dcSource", `${path}.check.dcSource`, errors);
  const secrecyRead = readOwnValue(check, "secrecy", `${path}.check.secrecy`, errors);
  const metadataRead = readAndCapturePlainValue(check, "metadata", `${path}.check.metadata`, errors);
  const actionDcAdjustment = inspectOptionalDcComponent(
    check,
    "actionDcAdjustment",
    `${path}.check`,
    errors
  );
  const upgradeDcReduction = inspectOptionalDcComponent(
    check,
    "upgradeDcReduction",
    `${path}.check`,
    errors,
    { nonNegative: true }
  );

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
    analysis.dcSource = inspectDcSource(
      dcRead.value,
      `${path}.check.dcSource`,
      errors
    );
  }
  if (actionDcAdjustment !== null) analysis.actionDcAdjustment = actionDcAdjustment;
  if (upgradeDcReduction !== null) analysis.upgradeDcReduction = upgradeDcReduction;

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

function resolveBaseDc(analysis, path, errors) {
  if (analysis.dcSource?.kind === DCS.FIXED) return analysis.dcSource.value;
  if (analysis.dcSource && dcKinds.has(analysis.dcSource.kind)) {
    issue(
      errors,
      "unresolved-execution-dc-source",
      `${path}.check.dcSource.kind`,
      `DC source kind "${analysis.dcSource.kind}" cannot be resolved from locked domain state.`
    );
  }
  return null;
}

function resolveRiskBidDcAdjustment(definition, row, errors) {
  if (row.riskBidId === null && row.dcAdjustment === null) return 0;

  const analyzed = analyzeAuthoredVoyageRiskBidOptions(
    definition.action,
    `${definition.actionPath}.riskBidOptions`,
    errors
  );
  if (!analyzed) return null;
  const matches = analyzed.options.filter(
    (option) => option?.riskBidId === row.riskBidId
  );
  if (matches.length !== 1) {
    issue(
      errors,
      matches.length === 0
        ? "execution-risk-bid-not-authored"
        : "execution-risk-bid-ambiguous",
      `riskBids.${row.stationId}.riskBidId`,
      "Execution Risk Bid must match exactly one canonical authored option."
    );
    return null;
  }
  if (row.dcAdjustment !== matches[0].dcAdjustment) {
    issue(
      errors,
      "execution-risk-bid-dc-adjustment-mismatch",
      `riskBids.${row.stationId}.dcAdjustment`,
      "Stored Risk Bid adjustment must match its canonical authored option."
    );
    return null;
  }
  return matches[0].dcAdjustment;
}

function addSafeDcValues(left, right, path, errors) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    issue(
      errors,
      "unsafe-final-dc-arithmetic",
      path,
      "Final DC arithmetic must remain within the safe integer range."
    );
    return null;
  }
  return result;
}

function constructFinalDc(definition, analysis, row, errors) {
  const baseDc = resolveBaseDc(analysis, definition.actionPath, errors);
  const riskBidDcAdjustment = resolveRiskBidDcAdjustment(
    definition,
    row,
    errors
  );
  if (baseDc === null || riskBidDcAdjustment === null) return null;

  const afterActionAdjustment = addSafeDcValues(
    baseDc,
    analysis.actionDcAdjustment,
    `${definition.actionPath}.check.actionDcAdjustment`,
    errors
  );
  if (afterActionAdjustment === null) return null;
  const uncappedPreBidDc = addSafeDcValues(
    afterActionAdjustment,
    -analysis.upgradeDcReduction,
    `${definition.actionPath}.check.upgradeDcReduction`,
    errors
  );
  if (uncappedPreBidDc === null) return null;

  const cappedPreBidDc = Math.max(baseDc - 5, uncappedPreBidDc);
  const finalDc = addSafeDcValues(
    cappedPreBidDc,
    riskBidDcAdjustment,
    `riskBids.${row.stationId}.dcAdjustment`,
    errors
  );
  if (finalDc === null) return null;
  if (finalDc < 0) {
    issue(
      errors,
      "invalid-final-dc",
      `riskBids.${row.stationId}.dcAdjustment`,
      "Constructed final DC must be a non-negative safe integer."
    );
    return null;
  }

  return {
    baseDc,
    actionDcAdjustment: analysis.actionDcAdjustment,
    upgradeDcReduction: analysis.upgradeDcReduction,
    riskBidDcAdjustment,
    finalDc
  };
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
      stationAnalyses.set(action.actionId, { action, actionPath, analysis });
      errors.push(...analysis.errors, ...analysis.warnings);
    }
  }

  return { analyses, errors };
}

function actionDefinitionFor(analyses, stationId, actionId) {
  return analyses.get(stationId)?.get(actionId) ?? null;
}

function executionIdentityFor(definition, selection, selectionPath, errors) {
  if (!definition || !selection) return null;

  const authored = analyzeAuthoredVoyageStationApproaches(
    definition.action,
    definition.actionPath,
    selection.approachId,
    errors
  );
  if (authored.matches.length === 0) {
    if (authored.valid) {
      issue(
        errors,
        "execution-approach-not-authored",
        `${selectionPath}.approachId`,
        "Committed execution approach is not authored by the selected action."
      );
    }
    return null;
  }
  if (authored.matches.length > 1) {
    issue(
      errors,
      "execution-approach-is-ambiguous",
      `${selectionPath}.approachId`,
      "Committed execution approach is authored more than once."
    );
    return null;
  }
  if (!authored.valid || !authored.matches[0].executionValid) return null;

  const selectedApproach = authored.matches[0];
  if (selectedApproach.executionKind === "no-roll") {
    if (selection.noRoll !== true || own(selection, "statisticSlugOrAbilityId")) {
      issue(
        errors,
        "execution-approach-identity-mismatch",
        selectionPath,
        "Committed rolled identity cannot target an authored no-roll approach."
      );
      return null;
    }
    return { approachId: selection.approachId, noRoll: true };
  }

  if (
    own(selection, "noRoll")
    || selection.statisticSlugOrAbilityId !== selectedApproach.statisticSlugOrAbilityId
  ) {
    issue(
      errors,
      "execution-approach-identity-mismatch",
      selectionPath,
      "Committed statistic or ability identity must exactly match its authored approach."
    );
    return null;
  }
  if (definition.analysis.mode !== MODES.CHECK) {
    issue(
      errors,
      "execution-rolled-approach-requires-check",
      definition.actionPath,
      "A committed rolled approach requires an authored action check."
    );
    return null;
  }

  return {
    approachId: selection.approachId,
    statisticSlugOrAbilityId: selection.statisticSlugOrAbilityId
  };
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

export function analyzeVoyageEncounterActionExecutionRequests(state, { requireResolution = true } = {}) {
  let structural = null;
  let active = false;
  let resolution = false;

  try {
    structural = validateVoyageEncounterState(state);
    active = state?.lifecycleState === LIFE.ACTIVE;
    resolution = state?.phase === PHASES.RESOLUTION;

    const committedSelections = structural.valid
      ? captureCommittedApproachSelections(state)
      : { valid: false, selections: new Map(), errors: [] };
    const order = committedSelections.valid
      ? analyzeVoyageEncounterResolutionOrder(state)
      : { valid: false, orderedActions: [], errors: [], warnings: [] };
    const definitions = structural.valid && Array.isArray(state.availableStations)
      ? analyzeActionDefinitions(state)
      : { analyses: new Map(), errors: [] };
    const errors = [
      ...committedSelections.errors,
      ...order.errors,
      ...definitions.errors
    ];
    const warnings = [...structural.warnings, ...order.warnings];

    if (structural.valid && !active) issue(errors, "execution-requires-active", "lifecycleState", "Preparing execution requests requires an Active encounter.");
    if (structural.valid && requireResolution && !resolution) issue(errors, "execution-requires-resolution", "phase", "Preparing execution requests requires Resolution phase.");

    const validPlan = structural.valid
      && active
      && (!requireResolution || resolution)
      && committedSelections.valid
      && order.valid
      && errors.length === 0;
    const requests = [];

    if (validPlan) {
      for (let rowIndex = 0; rowIndex < order.orderedActions.length; rowIndex += 1) {
        const row = order.orderedActions[rowIndex];
        const definition = actionDefinitionFor(
          definitions.analyses,
          row.stationId,
          row.actionId
        );
        const analysis = definition?.analysis ?? null;
        const selection = committedSelections.selections.get(row.stationId);
        const selectionPath = `selections.${row.stationId}`;
        const identity = executionIdentityFor(
          definition,
          selection,
          selectionPath,
          errors
        );
        const targetRead = readAndCapturePlainValue(state.targets, row.stationId, `targets.${row.stationId}`, errors);
        const target = targetRead.present && targetRead.ok ? targetRead.value : null;

        if (!analysis || !analysis.valid || !identity || !targetRead.ok) continue;

        if (identity.noRoll === true) {
          requests.push({
            ...row,
            target,
            mode: MODES.NO_ROLL,
            source: { kind: SOURCES.NO_ROLL },
            approachId: identity.approachId,
            noRoll: true,
            secrecy: SECRECY.PUBLIC,
            metadata: {}
          });
        } else {
          const dc = constructFinalDc(definition, analysis, row, errors);
          if (!dc) continue;
          requests.push({
            ...row,
            target,
            mode: MODES.CHECK,
            source: analysis.source,
            approachId: identity.approachId,
            statisticSlugOrAbilityId: identity.statisticSlugOrAbilityId,
            ...dc,
            secrecy: analysis.secrecy,
            metadata: analysis.metadata
          });
        }
      }
    }

    const final = deduplicateVoyageResolutionIssues(errors);
    const executionRequests = final.length === 0 ? requests : [];
    const checkCount = executionRequests.reduce((count, request) => count + (request.mode === MODES.CHECK ? 1 : 0), 0);
    const pendingChecksEmpty = structural.valid ? pendingChecksAreEmpty(state) : false;

    return {
      structurallyValid: structural.valid,
      active,
      resolution,
      pendingChecksEmpty,
      readyForExecution: validPlan && final.length === 0,
      pendingCheckPreparationRequired: validPlan && checkCount > 0,
      readyToPreparePendingChecks: validPlan && checkCount > 0 && pendingChecksEmpty && final.length === 0,
      actionCount: executionRequests.length,
      checkCount,
      noRollActionCount: executionRequests.length - checkCount,
      executionRequests,
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


export function prepareVoyageEncounterActionExecutionRequests(state) {
  return analyzeVoyageEncounterActionExecutionRequests(state, { requireResolution: true });
}
