import { VOYAGE_EVENT_RUNNER_STATION_IDS } from "./constants.js";
import { isPlainObject } from "./defaults.js";

const ALLOWED_ROUND_COUNTS = new Set([3, 5, 7, 9, 11]);
const ALLOWED_THIRD_APPROACH_DISTINCTIONS = new Set([
  "result-narration",
  "critical-success-benefit",
  "failure-risk",
  "upgrade-interaction",
  "risk-bid-availability",
  "target",
  "affected-system"
]);
const CANONICAL_STATION_IDS = new Set(VOYAGE_EVENT_RUNNER_STATION_IDS);
const UNSAFE_IDENTIFIERS = new Set(["__proto__", "constructor", "prototype"]);

function issue(errors, code, path, message) {
  errors.push({ code, path, message, severity: "error" });
}

function failureReport(errors, roundCount = 0, structurallyValid = false) {
  return {
    structurallyValid,
    authoringValid: false,
    roundCount,
    rounds: [],
    errors,
    warnings: []
  };
}

function isArrayIndexKey(key, length) {
  if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
}

function displayKey(key) {
  return typeof key === "symbol" ? "[symbol]" : key;
}

function objectChildPath(path, key) {
  return path === "$" ? String(key) : `${path}.${String(key)}`;
}

function readOwnDataProperty(value, key, path, errors) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    issue(
      errors,
      "event-definition-data-read-failed",
      path,
      "Event Definition data could not be read safely."
    );
    return { present: true, ok: false, value: undefined };
  }

  if (!descriptor) return { present: false, ok: true, value: undefined };
  if (!Object.hasOwn(descriptor, "value")) {
    issue(
      errors,
      "event-definition-data-read-failed",
      path,
      "Event Definition properties must be own data properties."
    );
    return { present: true, ok: false, value: undefined };
  }

  return { present: true, ok: true, value: descriptor.value };
}

function ownKeys(value, path, errors) {
  try {
    return Reflect.ownKeys(value);
  } catch {
    issue(
      errors,
      "event-definition-data-read-failed",
      path,
      "Event Definition data could not be inspected safely."
    );
    return null;
  }
}

function validateRecursivelyPlainData(value, path, errors, ancestors = new Set()) {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) return true;
    issue(
      errors,
      "invalid-event-definition-plain-data",
      path,
      "Event Definition numbers must be finite."
    );
    return false;
  }

  if (typeof value !== "object") {
    issue(
      errors,
      "invalid-event-definition-plain-data",
      path,
      "Event Definition data must be declarative and nonexecuting."
    );
    return false;
  }

  if (ancestors.has(value)) {
    issue(
      errors,
      "cyclic-event-definition-data",
      path,
      "Event Definition data must be acyclic."
    );
    return false;
  }

  const array = Array.isArray(value);
  let plainObject = false;
  if (!array) {
    try {
      plainObject = isPlainObject(value);
    } catch {
      issue(
        errors,
        "event-definition-data-read-failed",
        path,
        "Event Definition data could not be inspected safely."
      );
      return false;
    }
  }

  if (!array && !plainObject) {
    issue(
      errors,
      "invalid-event-definition-plain-data",
      path,
      "Event Definition data must contain only arrays and plain objects."
    );
    return false;
  }

  ancestors.add(value);
  const keys = ownKeys(value, path, errors);
  if (!keys) {
    ancestors.delete(value);
    return false;
  }

  let valid = true;
  const arrayLength = array
    ? readOwnDataProperty(value, "length", `${path}.length`, errors)
    : null;
  if (array && (!arrayLength.ok || !arrayLength.present)) valid = false;

  for (const key of keys) {
    if (array && key === "length") continue;

    const keyDisplay = displayKey(key);
    const childPath = array && typeof key === "string" && isArrayIndexKey(key, arrayLength?.value)
      ? `${path}[${key}]`
      : objectChildPath(path, keyDisplay);

    if (typeof key === "symbol") {
      issue(
        errors,
        "invalid-event-definition-plain-data",
        childPath,
        "Event Definition data must not contain symbol keys."
      );
      valid = false;
      continue;
    }

    if (array && !isArrayIndexKey(key, arrayLength?.value)) {
      issue(
        errors,
        "unexpected-event-definition-array-key",
        childPath,
        "Event Definition arrays must contain only indexed entries."
      );
      valid = false;
      continue;
    }

    if (!array && UNSAFE_IDENTIFIERS.has(key)) {
      issue(
        errors,
        "unsafe-event-definition-key",
        childPath,
        "Event Definition object keys must be safe."
      );
      valid = false;
    }

    const read = readOwnDataProperty(value, key, childPath, errors);
    if (!read.ok) {
      valid = false;
      continue;
    }

    if (!validateRecursivelyPlainData(read.value, childPath, errors, ancestors)) {
      valid = false;
    }
  }

  ancestors.delete(value);
  return valid;
}

function countOwnArrayEntries(value) {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (Object.hasOwn(value, index)) count += 1;
  }
  return count;
}

function analyzeApproaches(action, actionPath, errors) {
  const approachesPath = `${actionPath}.approaches`;
  const approachesRead = readOwnDataProperty(action, "approaches", approachesPath, errors);
  if (!approachesRead.present) {
    issue(
      errors,
      "missing-event-definition-approaches",
      approachesPath,
      "Each action requires an own approaches field."
    );
    return {
      structurallyValid: false,
      approachCount: 0,
      approaches: [],
      approachIdCounts: new Map()
    };
  }
  if (!approachesRead.ok) {
    return {
      structurallyValid: false,
      approachCount: 0,
      approaches: [],
      approachIdCounts: new Map()
    };
  }

  const approaches = approachesRead.value;
  if (!Array.isArray(approaches)) {
    issue(
      errors,
      "invalid-event-definition-approaches",
      approachesPath,
      "Action approaches must be an array."
    );
    return {
      structurallyValid: false,
      approachCount: 0,
      approaches: [],
      approachIdCounts: new Map()
    };
  }

  let structurallyValid = true;
  const approachCount = countOwnArrayEntries(approaches);
  if (approachCount < 1 || approachCount > 3) {
    issue(
      errors,
      "invalid-event-definition-approach-count",
      approachesPath,
      "Each action must own one, two, or three approach entries."
    );
  }

  const normalizedApproaches = [];
  const approachIdCounts = new Map();
  const seenApproachIds = new Set();

  for (let approachIndex = 0; approachIndex < approaches.length; approachIndex += 1) {
    const approachPath = `${approachesPath}[${approachIndex}]`;
    if (!Object.hasOwn(approaches, approachIndex)) {
      issue(
        errors,
        "sparse-event-definition-approaches",
        approachPath,
        "Action approaches must be a dense own-entry array."
      );
      structurallyValid = false;
      continue;
    }

    const approachRead = readOwnDataProperty(
      approaches,
      approachIndex,
      approachPath,
      errors
    );
    if (!approachRead.ok) {
      structurallyValid = false;
      continue;
    }

    if (!isPlainObject(approachRead.value)) {
      issue(
        errors,
        "invalid-event-definition-approach",
        approachPath,
        "Each action approach must be a plain object."
      );
      structurallyValid = false;
      continue;
    }

    const approachIdPath = `${approachPath}.approachId`;
    const approachIdRead = readOwnDataProperty(
      approachRead.value,
      "approachId",
      approachIdPath,
      errors
    );
    if (!approachIdRead.present) {
      issue(
        errors,
        "missing-event-definition-approach-id",
        approachIdPath,
        "Each approach requires an own approachId."
      );
      structurallyValid = false;
      continue;
    }
    if (!approachIdRead.ok) {
      structurallyValid = false;
      continue;
    }

    const approachId = approachIdRead.value;
    let approachIdValid = true;
    let approachIdUnique = true;
    if (typeof approachId !== "string" || approachId.trim().length === 0) {
      issue(
        errors,
        "invalid-event-definition-approach-id",
        approachIdPath,
        "Approach ID must be a non-empty exact string."
      );
      approachIdValid = false;
    } else if (UNSAFE_IDENTIFIERS.has(approachId)) {
      issue(
        errors,
        "unsafe-event-definition-approach-id",
        approachIdPath,
        "Approach ID must be safe."
      );
      approachIdValid = false;
    } else {
      approachIdCounts.set(approachId, (approachIdCounts.get(approachId) ?? 0) + 1);
      if (seenApproachIds.has(approachId)) {
        issue(
          errors,
          "duplicate-event-definition-approach-id",
          approachIdPath,
          `Approach ID "${approachId}" must be unique within its action.`
        );
        approachIdUnique = false;
      } else {
        seenApproachIds.add(approachId);
      }
    }

    const statisticPath = `${approachPath}.statisticSlugOrAbilityId`;
    const noRollPath = `${approachPath}.noRoll`;
    const statisticRead = readOwnDataProperty(
      approachRead.value,
      "statisticSlugOrAbilityId",
      statisticPath,
      errors
    );
    const noRollRead = readOwnDataProperty(
      approachRead.value,
      "noRoll",
      noRollPath,
      errors
    );
    if (!statisticRead.ok || !noRollRead.ok) {
      structurallyValid = false;
      continue;
    }

    let executionKind = null;
    let statisticSlugOrAbilityId = null;
    if (statisticRead.present && noRollRead.present) {
      issue(
        errors,
        "ambiguous-event-definition-approach-execution-identity",
        approachPath,
        "An approach must not author both statisticSlugOrAbilityId and noRoll."
      );
    } else if (!statisticRead.present && !noRollRead.present) {
      issue(
        errors,
        "missing-event-definition-approach-execution-identity",
        approachPath,
        "An approach requires exactly one execution identity."
      );
    } else if (statisticRead.present) {
      if (
        typeof statisticRead.value !== "string"
        || statisticRead.value.trim().length === 0
      ) {
        issue(
          errors,
          "invalid-event-definition-statistic-or-ability-id",
          statisticPath,
          "statisticSlugOrAbilityId must be a non-empty exact string."
        );
      } else if (UNSAFE_IDENTIFIERS.has(statisticRead.value)) {
        issue(
          errors,
          "unsafe-event-definition-statistic-or-ability-id",
          statisticPath,
          "statisticSlugOrAbilityId must be safe."
        );
      } else {
        executionKind = "statistic-or-ability";
        statisticSlugOrAbilityId = statisticRead.value;
      }
    } else if (noRollRead.value !== true) {
      issue(
        errors,
        "invalid-event-definition-no-roll-identity",
        noRollPath,
        "A no-roll approach must author noRoll: true."
      );
    } else {
      executionKind = "no-roll";
    }

    if (
      approachIdValid
      && approachIdUnique
      && executionKind !== null
    ) {
      normalizedApproaches.push({
        approachIndex,
        approachId,
        executionKind,
        statisticSlugOrAbilityId
      });
    }
  }

  return {
    structurallyValid,
    approachCount,
    approaches: normalizedApproaches,
    approachIdCounts
  };
}

function analyzeThirdApproachDistinctions(value, path, errors) {
  if (!Array.isArray(value)) {
    issue(
      errors,
      "invalid-third-approach-distinctions",
      path,
      "Third-approach distinctions must be an array."
    );
    return { structurallyValid: false, distinctions: [] };
  }

  let structurallyValid = true;
  const distinctionCount = countOwnArrayEntries(value);
  if (distinctionCount === 0) {
    issue(
      errors,
      "empty-third-approach-distinctions",
      path,
      "Third-approach distinctions must contain at least one own entry."
    );
  }

  const distinctions = [];
  const seenDistinctions = new Set();
  for (let distinctionIndex = 0; distinctionIndex < value.length; distinctionIndex += 1) {
    const distinctionPath = `${path}[${distinctionIndex}]`;
    if (!Object.hasOwn(value, distinctionIndex)) {
      issue(
        errors,
        "sparse-third-approach-distinctions",
        distinctionPath,
        "Third-approach distinctions must be a dense own-entry array."
      );
      structurallyValid = false;
      continue;
    }

    const distinctionRead = readOwnDataProperty(
      value,
      distinctionIndex,
      distinctionPath,
      errors
    );
    if (!distinctionRead.ok) {
      structurallyValid = false;
      continue;
    }

    const distinction = distinctionRead.value;
    if (typeof distinction !== "string" || distinction.trim().length === 0) {
      issue(
        errors,
        "invalid-third-approach-distinction",
        distinctionPath,
        "Third-approach distinction must be a non-empty exact string."
      );
    } else if (!ALLOWED_THIRD_APPROACH_DISTINCTIONS.has(distinction)) {
      issue(
        errors,
        "unsupported-third-approach-distinction",
        distinctionPath,
        "Third-approach distinction must be canonical."
      );
    } else if (seenDistinctions.has(distinction)) {
      issue(
        errors,
        "duplicate-third-approach-distinction",
        distinctionPath,
        "Third-approach distinctions must be unique."
      );
    } else {
      seenDistinctions.add(distinction);
      distinctions.push(distinction);
    }
  }

  return { structurallyValid, distinctions };
}

function analyzeThirdApproachException(action, actionPath, approachAnalysis, errors) {
  const exceptionPath = `${actionPath}.thirdApproachException`;
  const exceptionRead = readOwnDataProperty(
    action,
    "thirdApproachException",
    exceptionPath,
    errors
  );
  if (!exceptionRead.ok) {
    return { structurallyValid: false, thirdApproachException: null };
  }

  if (approachAnalysis.approachCount !== 3) {
    if (
      (approachAnalysis.approachCount === 1 || approachAnalysis.approachCount === 2)
      && exceptionRead.present
    ) {
      issue(
        errors,
        "unexpected-third-approach-exception",
        exceptionPath,
        "Actions with one or two approaches must not author thirdApproachException."
      );
    }
    return { structurallyValid: true, thirdApproachException: null };
  }

  if (!exceptionRead.present) {
    issue(
      errors,
      "missing-third-approach-exception",
      exceptionPath,
      "An action with three approaches requires thirdApproachException."
    );
    return { structurallyValid: false, thirdApproachException: null };
  }

  if (!isPlainObject(exceptionRead.value)) {
    issue(
      errors,
      "invalid-third-approach-exception",
      exceptionPath,
      "thirdApproachException must be a plain object."
    );
    return { structurallyValid: false, thirdApproachException: null };
  }

  const errorCount = errors.length;
  let structurallyValid = true;
  const approachIdPath = `${exceptionPath}.approachId`;
  const approachIdRead = readOwnDataProperty(
    exceptionRead.value,
    "approachId",
    approachIdPath,
    errors
  );
  if (!approachIdRead.present) {
    issue(
      errors,
      "missing-third-approach-exception-id",
      approachIdPath,
      "thirdApproachException requires an own approachId."
    );
    structurallyValid = false;
  } else if (!approachIdRead.ok) {
    structurallyValid = false;
  } else if (
    typeof approachIdRead.value !== "string"
    || approachIdRead.value.trim().length === 0
  ) {
    issue(
      errors,
      "invalid-third-approach-exception-id",
      approachIdPath,
      "Third-approach exception ID must be a non-empty exact string."
    );
  } else if (UNSAFE_IDENTIFIERS.has(approachIdRead.value)) {
    issue(
      errors,
      "unsafe-third-approach-exception-id",
      approachIdPath,
      "Third-approach exception ID must be safe."
    );
  } else if (!approachAnalysis.approachIdCounts.has(approachIdRead.value)) {
    issue(
      errors,
      "unmatched-third-approach-exception-id",
      approachIdPath,
      "Third-approach exception ID must match exactly one authored approach."
    );
  } else if (approachAnalysis.approachIdCounts.get(approachIdRead.value) > 1) {
    issue(
      errors,
      "ambiguous-third-approach-exception-id",
      approachIdPath,
      "Third-approach exception ID must not ambiguously reference duplicate approaches."
    );
  }

  const distinctionsPath = `${exceptionPath}.distinctions`;
  const distinctionsRead = readOwnDataProperty(
    exceptionRead.value,
    "distinctions",
    distinctionsPath,
    errors
  );
  let distinctionAnalysis = { structurallyValid: true, distinctions: [] };
  if (!distinctionsRead.present) {
    issue(
      errors,
      "missing-third-approach-distinctions",
      distinctionsPath,
      "thirdApproachException requires an own distinctions field."
    );
    structurallyValid = false;
  } else if (!distinctionsRead.ok) {
    structurallyValid = false;
  } else {
    distinctionAnalysis = analyzeThirdApproachDistinctions(
      distinctionsRead.value,
      distinctionsPath,
      errors
    );
    if (!distinctionAnalysis.structurallyValid) structurallyValid = false;
  }

  if (
    errors.length !== errorCount
    || !approachIdRead.present
    || !approachIdRead.ok
    || !distinctionsRead.present
    || !distinctionsRead.ok
  ) {
    return { structurallyValid, thirdApproachException: null };
  }

  return {
    structurallyValid,
    thirdApproachException: {
      approachId: approachIdRead.value,
      distinctions: distinctionAnalysis.distinctions
    }
  };
}

function analyzeActions(actions, stationPath, errors) {
  const actionsPath = `${stationPath}.actions`;
  if (!Array.isArray(actions)) {
    issue(
      errors,
      "invalid-event-definition-actions",
      actionsPath,
      "Available station actions must be an array."
    );
    return { structurallyValid: false, actionCount: 0, actions: [] };
  }

  let structurallyValid = true;
  const actionCount = countOwnArrayEntries(actions);
  if (actionCount !== 3) {
    issue(
      errors,
      "invalid-event-definition-action-count",
      actionsPath,
      "Each available station must own exactly three action entries."
    );
  }

  const normalizedActions = [];
  const seenActionIds = new Set();

  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const actionPath = `${actionsPath}[${actionIndex}]`;
    if (!Object.hasOwn(actions, actionIndex)) {
      issue(
        errors,
        "sparse-event-definition-actions",
        actionPath,
        "Available station actions must be a dense own-entry array."
      );
      structurallyValid = false;
      continue;
    }

    const actionRead = readOwnDataProperty(actions, actionIndex, actionPath, errors);
    if (!actionRead.ok) {
      structurallyValid = false;
      continue;
    }

    if (!isPlainObject(actionRead.value)) {
      issue(
        errors,
        "invalid-event-definition-action",
        actionPath,
        "Each available station action must be a plain object."
      );
      structurallyValid = false;
      continue;
    }

    const actionIdPath = `${actionPath}.actionId`;
    const actionIdRead = readOwnDataProperty(actionRead.value, "actionId", actionIdPath, errors);
    if (!actionIdRead.present) {
      issue(
        errors,
        "missing-event-definition-action-id",
        actionIdPath,
        "Each available station action requires an own actionId."
      );
      structurallyValid = false;
      continue;
    }
    if (!actionIdRead.ok) {
      structurallyValid = false;
      continue;
    }

    const actionId = actionIdRead.value;
    if (typeof actionId !== "string" || actionId.trim().length === 0) {
      issue(
        errors,
        "invalid-event-definition-action-id",
        actionIdPath,
        "Action ID must be a non-empty exact string."
      );
      continue;
    }
    if (UNSAFE_IDENTIFIERS.has(actionId)) {
      issue(
        errors,
        "unsafe-event-definition-action-id",
        actionIdPath,
        "Action ID must be safe."
      );
      continue;
    }
    if (seenActionIds.has(actionId)) {
      issue(
        errors,
        "duplicate-event-definition-action-id",
        actionIdPath,
        `Action ID "${actionId}" must be unique within its station and round.`
      );
      continue;
    }

    seenActionIds.add(actionId);
    const approachAnalysis = analyzeApproaches(actionRead.value, actionPath, errors);
    if (!approachAnalysis.structurallyValid) structurallyValid = false;
    const exceptionAnalysis = analyzeThirdApproachException(
      actionRead.value,
      actionPath,
      approachAnalysis,
      errors
    );
    if (!exceptionAnalysis.structurallyValid) structurallyValid = false;
    normalizedActions.push({
      actionIndex,
      actionId,
      approachCount: approachAnalysis.approachCount,
      approaches: approachAnalysis.approaches,
      thirdApproachException: exceptionAnalysis.thirdApproachException
    });
  }

  return { structurallyValid, actionCount, actions: normalizedActions };
}

function analyzeStations(round, roundPath, errors) {
  const stationsPath = `${roundPath}.availableStations`;
  const stationsRead = readOwnDataProperty(round, "availableStations", stationsPath, errors);
  if (!stationsRead.present) {
    issue(
      errors,
      "missing-event-definition-available-stations",
      stationsPath,
      "Each Event Definition round requires an own availableStations field."
    );
    return { structurallyValid: false, stationCount: 0, stations: [] };
  }
  if (!stationsRead.ok) {
    return { structurallyValid: false, stationCount: 0, stations: [] };
  }

  const availableStations = stationsRead.value;
  if (!Array.isArray(availableStations)) {
    issue(
      errors,
      "invalid-event-definition-available-stations",
      stationsPath,
      "Round availableStations must be an array."
    );
    return { structurallyValid: false, stationCount: 0, stations: [] };
  }

  let structurallyValid = true;
  const stationCount = countOwnArrayEntries(availableStations);
  if (stationCount === 0) {
    issue(
      errors,
      "empty-event-definition-available-stations",
      stationsPath,
      "Each Event Definition round must make at least one station available."
    );
  }

  const normalizedStations = [];
  const seenStationIds = new Set();

  for (let stationIndex = 0; stationIndex < availableStations.length; stationIndex += 1) {
    const stationPath = `${stationsPath}[${stationIndex}]`;
    if (!Object.hasOwn(availableStations, stationIndex)) {
      issue(
        errors,
        "sparse-event-definition-available-stations",
        stationPath,
        "Round availableStations must be a dense own-entry array."
      );
      structurallyValid = false;
      continue;
    }

    const stationRead = readOwnDataProperty(
      availableStations,
      stationIndex,
      stationPath,
      errors
    );
    if (!stationRead.ok) {
      structurallyValid = false;
      continue;
    }

    if (!isPlainObject(stationRead.value)) {
      issue(
        errors,
        "invalid-event-definition-station",
        stationPath,
        "Each available station must be a plain object."
      );
      structurallyValid = false;
      continue;
    }

    const stationIdPath = `${stationPath}.stationId`;
    const stationIdRead = readOwnDataProperty(
      stationRead.value,
      "stationId",
      stationIdPath,
      errors
    );
    if (!stationIdRead.present) {
      issue(
        errors,
        "missing-event-definition-station-id",
        stationIdPath,
        "Each available station requires an own stationId."
      );
      structurallyValid = false;
      continue;
    }
    if (!stationIdRead.ok) {
      structurallyValid = false;
      continue;
    }

    const stationId = stationIdRead.value;
    let stationIdValid = true;
    if (typeof stationId !== "string" || stationId.trim().length === 0) {
      issue(
        errors,
        "invalid-event-definition-station-id",
        stationIdPath,
        "Station ID must be a non-empty exact string."
      );
      stationIdValid = false;
    } else if (UNSAFE_IDENTIFIERS.has(stationId)) {
      issue(
        errors,
        "unsafe-event-definition-station-id",
        stationIdPath,
        "Station ID must be safe."
      );
      stationIdValid = false;
    } else if (!CANONICAL_STATION_IDS.has(stationId)) {
      issue(
        errors,
        "unsupported-event-definition-station-id",
        stationIdPath,
        "Station ID must identify a canonical Event Runner station."
      );
      stationIdValid = false;
    } else if (seenStationIds.has(stationId)) {
      issue(
        errors,
        "duplicate-event-definition-station-id",
        stationIdPath,
        `Station ID "${stationId}" must be unique within its round.`
      );
      stationIdValid = false;
    }

    if (!stationIdValid) continue;
    seenStationIds.add(stationId);

    const actionsPath = `${stationPath}.actions`;
    const actionsRead = readOwnDataProperty(stationRead.value, "actions", actionsPath, errors);
    if (!actionsRead.present) {
      issue(
        errors,
        "missing-event-definition-actions",
        actionsPath,
        "Each available station requires an own actions field."
      );
      structurallyValid = false;
      continue;
    }
    if (!actionsRead.ok) {
      structurallyValid = false;
      continue;
    }

    const actionAnalysis = analyzeActions(actionsRead.value, stationPath, errors);
    if (!actionAnalysis.structurallyValid) structurallyValid = false;
    normalizedStations.push({
      stationIndex,
      stationId,
      actionCount: actionAnalysis.actionCount,
      actions: actionAnalysis.actions
    });
  }

  return { structurallyValid, stationCount, stations: normalizedStations };
}

function analyzeRounds(rounds, errors) {
  if (!Array.isArray(rounds)) {
    issue(
      errors,
      "invalid-event-definition-rounds",
      "rounds",
      "Event Definition rounds must be an array."
    );
    return { structurallyValid: false, roundCount: 0, rounds: [] };
  }

  let structurallyValid = true;
  const roundCount = countOwnArrayEntries(rounds);
  if (!ALLOWED_ROUND_COUNTS.has(rounds.length)) {
    issue(
      errors,
      "invalid-event-definition-round-count",
      "rounds",
      "Event Definition rounds must contain exactly 3, 5, 7, 9, or 11 entries."
    );
  }

  const normalizedRounds = [];
  const seenRoundIds = new Set();

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
    const roundPath = `rounds[${roundIndex}]`;
    if (!Object.hasOwn(rounds, roundIndex)) {
      issue(
        errors,
        "sparse-event-definition-rounds",
        roundPath,
        "Event Definition rounds must be a dense own-entry array."
      );
      structurallyValid = false;
      continue;
    }

    const roundRead = readOwnDataProperty(rounds, roundIndex, roundPath, errors);
    if (!roundRead.ok) {
      structurallyValid = false;
      continue;
    }

    if (!isPlainObject(roundRead.value)) {
      issue(
        errors,
        "invalid-event-definition-round",
        roundPath,
        "Each Event Definition round must be a plain object."
      );
      structurallyValid = false;
      continue;
    }

    const roundIdPath = `${roundPath}.roundId`;
    const roundIdRead = readOwnDataProperty(roundRead.value, "roundId", roundIdPath, errors);
    if (!roundIdRead.present) {
      issue(
        errors,
        "missing-event-definition-round-id",
        roundIdPath,
        "Each Event Definition round requires an own roundId."
      );
      structurallyValid = false;
      continue;
    }
    if (!roundIdRead.ok) {
      structurallyValid = false;
      continue;
    }

    const roundId = roundIdRead.value;
    if (typeof roundId !== "string" || roundId.trim().length === 0) {
      issue(
        errors,
        "invalid-event-definition-round-id",
        roundIdPath,
        "Round ID must be a non-empty exact string."
      );
      continue;
    }
    if (UNSAFE_IDENTIFIERS.has(roundId)) {
      issue(
        errors,
        "unsafe-event-definition-round-id",
        roundIdPath,
        "Round ID must be safe."
      );
      continue;
    }
    if (seenRoundIds.has(roundId)) {
      issue(
        errors,
        "duplicate-event-definition-round-id",
        roundIdPath,
        `Round ID "${roundId}" must be unique within the Event Definition.`
      );
      continue;
    }

    seenRoundIds.add(roundId);
    const stationAnalysis = analyzeStations(roundRead.value, roundPath, errors);
    if (!stationAnalysis.structurallyValid) structurallyValid = false;
    normalizedRounds.push({
      roundIndex,
      roundId,
      stationCount: stationAnalysis.stationCount,
      stations: stationAnalysis.stations
    });
  }

  return { structurallyValid, roundCount, rounds: normalizedRounds };
}

export function analyzeVoyageEventDefinitionRoundActionAuthoring(definition) {
  const errors = [];

  try {
    if (!isPlainObject(definition)) {
      issue(
        errors,
        "invalid-voyage-event-definition",
        "$",
        "Voyage Event Definition must be a plain object."
      );
      return failureReport(errors);
    }

    if (!validateRecursivelyPlainData(definition, "$", errors)) {
      return failureReport(errors);
    }

    const roundsRead = readOwnDataProperty(definition, "rounds", "rounds", errors);
    if (!roundsRead.present) {
      issue(
        errors,
        "missing-event-definition-rounds",
        "rounds",
        "Voyage Event Definition requires an own rounds field."
      );
      return failureReport(errors);
    }
    if (!roundsRead.ok) return failureReport(errors);

    const analysis = analyzeRounds(roundsRead.value, errors);
    if (errors.length > 0) {
      return failureReport(errors, analysis.roundCount, analysis.structurallyValid);
    }

    return {
      structurallyValid: true,
      authoringValid: true,
      roundCount: analysis.roundCount,
      rounds: analysis.rounds,
      errors: [],
      warnings: []
    };
  } catch {
    return failureReport([{
      code: "event-definition-data-read-failed",
      path: "$",
      message: "Event Definition data could not be read safely.",
      severity: "error"
    }]);
  }
}

export function validateVoyageEventDefinitionRoundActionAuthoring(definition) {
  const report = analyzeVoyageEventDefinitionRoundActionAuthoring(definition);
  return {
    valid: report.structurallyValid && report.authoringValid,
    errors: report.errors.map((entry) => ({ ...entry })),
    warnings: report.warnings.map((entry) => ({ ...entry }))
  };
}
