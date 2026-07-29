import {
  VOYAGE_ACTION_BRANCH_UNIT_CONTRIBUTIONS as UNIT_CONTRIBUTIONS,
  VOYAGE_ACTION_EXECUTION_MODES as MODES
} from "./constants.js";
import { analyzeVoyageEncounterActionOutcomes } from "./action-outcome-interpretation.js";

const RISK_BID_TIERS = Object.freeze([2, 5, 8]);
const UNSAFE_IDS = new Set(["__proto__", "constructor", "prototype"]);
const ROLLED_BRANCHES = UNIT_CONTRIBUTIONS;

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function safeRead(value, key) {
  try {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return { ok: true, value: undefined };
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return { ok: false, value: undefined };
    return { ok: true, value: descriptor.value };
  } catch {
    return { ok: false, value: undefined };
  }
}

function ownArrayEntries(value) {
  try {
    if (!Array.isArray(value)) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, "value") || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const entries = [];
    for (const key of Reflect.ownKeys(value)) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) return null;
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index >= lengthDescriptor.value) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
      entries.push({ index, value: descriptor.value });
    }
    entries.sort((left, right) => left.index - right.index);
    if (entries.length !== lengthDescriptor.value || entries.some(({ index }, expected) => index !== expected)) return null;
    return entries;
  } catch {
    return null;
  }
}

function safeIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.trim() === value && !UNSAFE_IDS.has(value);
}

function cloneIssues(value, path, errors) {
  const entries = ownArrayEntries(value);
  if (!entries) {
    errors.push(issue("round-unit-aggregation-upstream-data-invalid", path, "Upstream action interpretation issues must be a dense safe array."));
    return [];
  }
  const cloned = [];
  for (const { index, value: entry } of entries) {
    const code = safeRead(entry, "code");
    const issuePath = safeRead(entry, "path");
    const message = safeRead(entry, "message");
    const severity = safeRead(entry, "severity");
    if (!code.ok || !issuePath.ok || !message.ok || !severity.ok
      || typeof code.value !== "string" || typeof issuePath.value !== "string"
      || typeof message.value !== "string" || typeof severity.value !== "string") {
      errors.push(issue("round-unit-aggregation-upstream-data-invalid", `${path}[${index}]`, "Upstream action interpretation issues must contain safe string fields."));
      continue;
    }
    cloned.push({ code: code.value, path: issuePath.value, message: message.value, severity: severity.value });
  }
  return cloned;
}

function invalidReport(localErrors, localWarnings, preservedErrors = [], preservedWarnings = []) {
  return {
    outcomesReady: false,
    readyForAggregation: false,
    actionCount: 0,
    checkActionCount: 0,
    noRollActionCount: 0,
    contributingActionCount: 0,
    successUnits: 0,
    failureUnits: 0,
    contributions: [],
    errors: [...preservedErrors, ...localErrors],
    warnings: [...preservedWarnings, ...localWarnings]
  };
}

function validateActionRecord(value, index, seenSequences, errors) {
  const path = `actions[${index}]`;
  const fields = {};
  for (const key of ["sequence", "stationId", "actionId", "mode", "branch", "riskBidId", "dcAdjustment"]) {
    const result = safeRead(value, key);
    if (!result.ok) {
      errors.push(issue("round-unit-aggregation-action-data-read-failed", `${path}.${key}`, "Interpreted action field must be an own data property."));
      return null;
    }
    fields[key] = result.value;
  }

  if (!Number.isSafeInteger(fields.sequence) || fields.sequence < 0 || seenSequences.has(fields.sequence)) {
    errors.push(issue("round-unit-aggregation-action-sequence-invalid", `${path}.sequence`, "Interpreted action sequence must be a unique non-negative safe integer."));
  } else seenSequences.add(fields.sequence);
  if (!safeIdentifier(fields.stationId)) errors.push(issue("round-unit-aggregation-action-station-invalid", `${path}.stationId`, "Interpreted action stationId must be a safe exact string."));
  if (!safeIdentifier(fields.actionId)) errors.push(issue("round-unit-aggregation-action-id-invalid", `${path}.actionId`, "Interpreted action actionId must be a safe exact string."));

  const modeIsCheck = fields.mode === MODES.CHECK;
  const modeIsNoRoll = fields.mode === MODES.NO_ROLL;
  if (!modeIsCheck && !modeIsNoRoll) errors.push(issue("round-unit-aggregation-action-mode-invalid", `${path}.mode`, "Interpreted action mode is not canonical."));
  const branchContribution = Object.hasOwn(ROLLED_BRANCHES, fields.branch) ? ROLLED_BRANCHES[fields.branch] : null;
  if (modeIsCheck && !branchContribution) errors.push(issue("round-unit-aggregation-action-branch-invalid", `${path}.branch`, "A check action must use one canonical rolled branch."));
  if (modeIsNoRoll && fields.branch !== "no-roll") errors.push(issue("round-unit-aggregation-action-mode-branch-mismatch", path, "A no-roll action must use the no-roll branch."));
  if (modeIsCheck && fields.branch === "no-roll") errors.push(issue("round-unit-aggregation-action-mode-branch-mismatch", path, "A check action cannot use the no-roll branch."));

  const noRiskBid = fields.riskBidId === null && fields.dcAdjustment === null;
  const validRiskBid = safeIdentifier(fields.riskBidId) && RISK_BID_TIERS.includes(fields.dcAdjustment);
  if (modeIsNoRoll && !noRiskBid) errors.push(issue("round-unit-aggregation-no-roll-risk-bid-invalid", path, "A no-roll action must have null Risk Bid metadata."));
  if (modeIsCheck && !noRiskBid && !validRiskBid) errors.push(issue("round-unit-aggregation-risk-bid-metadata-invalid", path, "Risk Bid metadata must be exact nulls or a canonical ID and tier."));
  if (modeIsCheck && noRiskBid === false && validRiskBid === false) return null;
  if (errors.some(({ path: errorPath }) => errorPath.startsWith(path))) return null;

  return {
    sequence: fields.sequence,
    stationId: fields.stationId,
    actionId: fields.actionId,
    mode: fields.mode,
    branch: fields.branch,
    riskBidId: fields.riskBidId,
    dcAdjustment: fields.dcAdjustment,
    successUnits: modeIsCheck ? branchContribution.successUnits : 0,
    failureUnits: modeIsCheck ? branchContribution.failureUnits : 0
  };
}

export function analyzeVoyageEncounterRoundUnitAggregation(state) {
  const localErrors = [];
  let upstream;
  try {
    upstream = analyzeVoyageEncounterActionOutcomes(state);
  } catch {
    return invalidReport([issue("round-unit-aggregation-upstream-data-read-failed", "$", "Action interpretation could not be read safely.")], []);
  }

  const upstreamErrors = [];
  const upstreamWarnings = [];
  const errorsValue = safeRead(upstream, "errors");
  const warningsValue = safeRead(upstream, "warnings");
  if (!errorsValue.ok || !warningsValue.ok) return invalidReport([issue("round-unit-aggregation-upstream-data-read-failed", "$", "Action interpretation report could not be read safely.")], []);
  const errors = cloneIssues(errorsValue.value, "upstream.errors", upstreamErrors);
  const warnings = cloneIssues(warningsValue.value, "upstream.warnings", upstreamWarnings);
  if (upstreamErrors.length > 0 || upstreamWarnings.length > 0) {
    return invalidReport([...upstreamErrors, ...upstreamWarnings], [], errors, warnings);
  }
  const ready = safeRead(upstream, "readyForInterpretation");
  if (!ready.ok || ready.value !== true) return invalidReport(localErrors, upstreamErrors, errors, warnings);

  const actionsValue = safeRead(upstream, "actions");
  if (!actionsValue.ok) return invalidReport([issue("round-unit-aggregation-upstream-data-read-failed", "upstream.actions", "Interpreted action records could not be read safely.")], upstreamErrors, errors, warnings);
  const actionEntries = ownArrayEntries(actionsValue.value);
  if (!actionEntries) return invalidReport([issue("round-unit-aggregation-upstream-actions-invalid", "upstream.actions", "Interpreted action records must be a dense safe array.")], upstreamErrors, errors, warnings);

  const upstreamCounts = {};
  for (const key of ["actionCount", "checkActionCount", "noRollActionCount"]) {
    const count = safeRead(upstream, key);
    if (!count.ok || !Number.isSafeInteger(count.value) || count.value < 0) localErrors.push(issue("round-unit-aggregation-upstream-count-invalid", `upstream.${key}`, "Upstream action counts must be non-negative safe integers."));
    upstreamCounts[key] = count.value;
  }
  if (localErrors.length > 0) return invalidReport(localErrors, [], errors, warnings);

  const seenSequences = new Set();
  const contributions = [];
  for (const { index, value } of actionEntries) {
    const contribution = validateActionRecord(value, index, seenSequences, localErrors);
    if (contribution) contributions.push(contribution);
    if (contribution && contribution.sequence !== index) localErrors.push(issue("round-unit-aggregation-sequence-order-invalid", `actions[${index}].sequence`, "Interpreted action sequences must match authoritative action order."));
  }
  if (localErrors.length > 0 || contributions.length !== actionEntries.length) return invalidReport(localErrors, upstreamErrors, errors, warnings);

  const checkActionCount = contributions.filter(({ mode }) => mode === MODES.CHECK).length;
  const noRollActionCount = contributions.filter(({ mode }) => mode === MODES.NO_ROLL).length;
  const successUnits = contributions.reduce((total, contribution) => total + contribution.successUnits, 0);
  const failureUnits = contributions.reduce((total, contribution) => total + contribution.failureUnits, 0);
  if (!Number.isSafeInteger(successUnits) || !Number.isSafeInteger(failureUnits)
    || contributions.length !== checkActionCount + noRollActionCount
    || upstreamCounts.actionCount !== contributions.length
    || upstreamCounts.checkActionCount !== checkActionCount
    || upstreamCounts.noRollActionCount !== noRollActionCount) {
    return invalidReport([issue("round-unit-aggregation-totals-invalid", "$", "Aggregated unit totals or action counts are not safe canonical values.")], upstreamErrors, errors, warnings);
  }

  return {
    outcomesReady: true,
    readyForAggregation: true,
    actionCount: contributions.length,
    checkActionCount,
    noRollActionCount,
    contributingActionCount: checkActionCount,
    successUnits,
    failureUnits,
    contributions,
    errors,
    warnings
  };
}
