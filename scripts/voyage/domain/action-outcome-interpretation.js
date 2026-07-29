import { validateVoyageEncounterState } from "./validation.js";
import { analyzeVoyageEncounterResolutionOrder, deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { analyzeVoyageEncounterActionExecutionRequests } from "./resolution-execution-requests.js";
import { analyzeVoyageEncounterPendingChecks } from "./pending-checks.js";
import { analyzeVoyageEncounterActionOutcomeDefinitions } from "./consequence-rules.js";

const CHECK_BRANCHES = new Set(["critical-failure", "failure", "success", "critical-success"]);
const UNSAFE_IDS = new Set(["__proto__", "constructor", "prototype"]);
const RISK_BID_OUTCOME_FIELDS = Object.freeze({
  "critical-failure": "criticalFailure",
  failure: "failure",
  success: "success",
  "critical-success": "criticalSuccess"
});
const NORMAL_ACTION_BID_BRANCHES = new Set(["success", "critical-success"]);

function issue(code, path, message) {
  return { code, path, message, severity: "error" };
}

function createReport({
  structurallyValid = false,
  definitionsValid = false,
  pendingChecksValid = false,
  resolutionComplete = false,
  active = false,
  consequences = false,
  actionCount = 0,
  checkActionCount = 0,
  noRollActionCount = 0,
  errors = [],
  warnings = []
} = {}) {
  return {
    structurallyValid,
    definitionsValid,
    pendingChecksValid,
    resolutionComplete,
    active,
    consequences,
    readyForInterpretation: false,
    actionCount,
    interpretedActionCount: 0,
    checkActionCount,
    noRollActionCount,
    intentCount: 0,
    actions: [],
    intents: [],
    errors,
    warnings
  };
}

function createDataReadFailureReport(existingReport = null) {
  const report = existingReport ?? createReport();
  report.readyForInterpretation = false;
  report.interpretedActionCount = 0;
  report.intentCount = 0;
  report.actions = [];
  report.intents = [];
  report.errors = deduplicateVoyageResolutionIssues([
    ...report.errors,
    issue(
      "outcome-interpretation-data-read-failed",
      "$",
      "Outcome interpretation data could not be read safely."
    )
  ]);
  report.warnings = deduplicateVoyageResolutionIssues(report.warnings);
  return report;
}

function readOwnDataValue(value, key) {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, "value")) throw new TypeError("Expected an own data property.");
  return descriptor.value;
}

function ownArrayEntries(value) {
  if (!Array.isArray(value)) return [];

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    !lengthDescriptor
    || !Object.hasOwn(lengthDescriptor, "value")
    || !Number.isSafeInteger(lengthDescriptor.value)
    || lengthDescriptor.value < 0
  ) {
    throw new TypeError("Array length must be an own non-negative safe integer.");
  }

  const entries = [];
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    const numeric = typeof key === "string" && /^(0|[1-9]\d*)$/.test(key);
    const index = numeric ? Number(key) : -1;
    if (
      !numeric
      || !Number.isSafeInteger(index)
      || index >= lengthDescriptor.value
    ) {
      throw new TypeError("Arrays may contain only own canonical index keys.");
    }
    entries.push({ index, value: readOwnDataValue(value, key) });
  }
  entries.sort((left, right) => left.index - right.index);
  return entries;
}

function clonePlainDataSafely(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || ancestors.has(value)) throw new TypeError("Expected finite acyclic plain data.");

  const array = Array.isArray(value);
  const arrayEntries = array ? ownArrayEntries(value) : null;
  const arrayLength = array
    ? Object.getOwnPropertyDescriptor(value, "length")?.value
    : null;
  const clone = array ? new Array(arrayLength) : {};
  ancestors.add(value);

  const keys = array
    ? arrayEntries.map(({ index }) => String(index))
    : Reflect.ownKeys(value);

  for (const key of keys) {
    if (typeof key === "symbol") throw new TypeError("Plain data cannot contain symbol keys.");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new TypeError("Plain data properties must be data properties.");
    Object.defineProperty(clone, key, {
      value: clonePlainDataSafely(descriptor.value, ancestors),
      enumerable: true,
      configurable: true,
      writable: true
    });
  }

  ancestors.delete(value);
  return clone;
}

function findMatches(records, predicate) {
  const matches = [];
  for (const entry of ownArrayEntries(records)) {
    if (predicate(entry.value)) matches.push(entry);
  }
  return matches;
}

function exactRiskBidMetadata(value) {
  return {
    riskBidId: readOwnDataValue(value, "riskBidId"),
    dcAdjustment: readOwnDataValue(value, "dcAdjustment")
  };
}

function riskBidMetadataMatches(left, right) {
  return left.riskBidId === right.riskBidId
    && left.dcAdjustment === right.dcAdjustment;
}

function validRiskBidMetadata(metadata) {
  return typeof metadata.riskBidId === "string"
    && metadata.riskBidId.trim().length > 0
    && !UNSAFE_IDS.has(metadata.riskBidId)
    && [2, 5, 8].includes(metadata.dcAdjustment);
}

function resolveRiskBidBranchPreflight({
  state,
  row,
  request,
  pendingCheck,
  definition,
  branch,
  orderedPath,
  requestPath,
  pendingPath,
  errors
}) {
  const ordered = exactRiskBidMetadata(row);
  const requestMetadata = exactRiskBidMetadata(request);
  const pendingMetadata = pendingCheck
    ? exactRiskBidMetadata(pendingCheck)
    : { riskBidId: null, dcAdjustment: null };
  const selected = ordered.riskBidId !== null || ordered.dcAdjustment !== null;
  const riskBids = readOwnDataValue(state, "riskBids");
  const storedRead = readOwnDataValue(riskBids, row.stationId);
  const stored = storedRead === undefined ? null : exactRiskBidMetadata(storedRead);

  if (!selected) {
    const noBid = { riskBidId: null, dcAdjustment: null };
    if (!riskBidMetadataMatches(ordered, noBid)) {
      errors.push(issue(
        "outcome-interpretation-risk-bid-ordered-action-invalid",
        orderedPath,
        "Ordered action must contain either one complete selected Risk Bid or exact null Risk Bid metadata."
      ));
    }
    if (!riskBidMetadataMatches(requestMetadata, noBid)) {
      errors.push(issue(
        "outcome-interpretation-risk-bid-execution-request-mismatch",
        requestPath,
        "Execution request Risk Bid metadata must match the ordered action exactly."
      ));
    }
    if (pendingCheck && !riskBidMetadataMatches(pendingMetadata, noBid)) {
      errors.push(issue(
        "outcome-interpretation-risk-bid-pending-check-mismatch",
        pendingPath,
        "Pending-check Risk Bid metadata must match the ordered action exactly."
      ));
    }
    if (stored !== null) {
      errors.push(issue(
        "outcome-interpretation-risk-bid-state-mismatch",
        `riskBids.${row.stationId}`,
        "Base action metadata contradicts a stored selected Risk Bid."
      ));
    }
    return {
      selected: false,
      branch,
      outcomeField: null,
      branchEffectIds: [],
      effectRecords: []
    };
  }

  if (!validRiskBidMetadata(ordered)) {
    errors.push(issue(
      "outcome-interpretation-risk-bid-ordered-action-invalid",
      orderedPath,
      "Ordered action selected Risk Bid metadata must contain one safe canonical ID and tier."
    ));
  }
  if (!riskBidMetadataMatches(requestMetadata, ordered)) {
    errors.push(issue(
      "outcome-interpretation-risk-bid-execution-request-mismatch",
      requestPath,
      "Execution request Risk Bid metadata must match the ordered action exactly."
    ));
  }
  if (!pendingCheck || !riskBidMetadataMatches(pendingMetadata, ordered)) {
    errors.push(issue(
      "outcome-interpretation-risk-bid-pending-check-mismatch",
      pendingPath ?? orderedPath,
      "Pending-check Risk Bid metadata must match the ordered action exactly."
    ));
  }
  if (stored === null || !riskBidMetadataMatches(stored, ordered)) {
    errors.push(issue(
      "outcome-interpretation-risk-bid-state-mismatch",
      `riskBids.${row.stationId}`,
      "Stored Risk Bid metadata must match the ordered action exactly."
    ));
  }
  if (request.mode !== "check" || definition.mode !== "check") {
    errors.push(issue(
      "outcome-interpretation-risk-bid-requires-check",
      orderedPath,
      "A selected Risk Bid requires one rolled action and pending check."
    ));
  }

  const optionRecords = findMatches(
    definition.riskBidOptions,
    (option) => readOwnDataValue(option, "riskBidId") === ordered.riskBidId
  );
  const exactMatches = optionRecords.filter(
    ({ value: option }) => readOwnDataValue(option, "dcAdjustment") === ordered.dcAdjustment
  );
  if (optionRecords.length === 0) {
    errors.push(issue(
      "outcome-interpretation-risk-bid-option-missing",
      `${orderedPath}.riskBidId`,
      "Selected Risk Bid ID does not match an authored option."
    ));
    return null;
  }
  if (optionRecords.length > 1 || exactMatches.length > 1) {
    errors.push(issue(
      "outcome-interpretation-risk-bid-option-ambiguous",
      `${orderedPath}.riskBidId`,
      "Selected Risk Bid must match exactly one authored option."
    ));
    return null;
  }
  if (exactMatches.length === 0) {
    errors.push(issue(
      "outcome-interpretation-risk-bid-adjustment-mismatch",
      `${orderedPath}.dcAdjustment`,
      "Selected Risk Bid tier does not match its authored option."
    ));
    return null;
  }

  const optionRecord = exactMatches[0];
  const outcomes = readOwnDataValue(optionRecord.value, "outcomes");
  const outcomeField = RISK_BID_OUTCOME_FIELDS[branch];
  const branchEffectIds = readOwnDataValue(outcomes, outcomeField);
  if (!outcomeField || !Array.isArray(branchEffectIds)) {
    errors.push(issue(
      "outcome-interpretation-risk-bid-branch-invalid",
      `${orderedPath}.riskBidOutcome.${outcomeField ?? branch}`,
      "Selected Risk Bid requires one valid outcome array for the resolved degree."
    ));
    return null;
  }

  const effectRecords = [];
  for (const referenceRecord of ownArrayEntries(branchEffectIds)) {
    const effectId = referenceRecord.value;
    const effectRuleMatches = findMatches(
      definition.effectRules,
      (effectRule) => effectRule?.effectId === effectId
    );
    if (effectRuleMatches.length !== 1) {
      errors.push(issue(
        effectRuleMatches.length === 0
          ? "outcome-interpretation-risk-bid-effect-rule-missing"
          : "outcome-interpretation-risk-bid-effect-rule-ambiguous",
        `${orderedPath}.riskBidOutcome.${outcomeField}[${referenceRecord.index}]`,
        "Selected Risk Bid outcome reference must match exactly one action-local effect rule."
      ));
      continue;
    }
    effectRecords.push({
      referenceIndex: referenceRecord.index,
      effectId,
      effectRuleRecord: effectRuleMatches[0]
    });
  }

  return {
    selected: true,
    riskBidId: ordered.riskBidId,
    dcAdjustment: ordered.dcAdjustment,
    optionRecord,
    branch,
    outcomeField,
    branchEffectIds,
    effectRecords
  };
}

function finalizeReport(report) {
  report.errors = deduplicateVoyageResolutionIssues(report.errors);
  report.warnings = deduplicateVoyageResolutionIssues(report.warnings);
  return report;
}

export function analyzeVoyageEncounterActionOutcomes(state) {
  let report = null;
  try {
    const structural = validateVoyageEncounterState(state);
    const order = analyzeVoyageEncounterResolutionOrder(state);
    const execution = analyzeVoyageEncounterActionExecutionRequests(state, { requireResolution: false });
    const pending = analyzeVoyageEncounterPendingChecks(state);
    const definitions = analyzeVoyageEncounterActionOutcomeDefinitions(state);

    const active = execution.active === true;
    const consequences = definitions.consequences === true;
    const checkActionCount = execution.checkCount ?? 0;
    const resolutionComplete = Boolean(
      order.valid
      && execution.readyForExecution
      && pending.pendingChecksValid
      && pending.pendingCheckCount === checkActionCount
      && pending.resolvedCheckCount === pending.pendingCheckCount
    );

    report = createReport({
      structurallyValid: structural.valid,
      definitionsValid: definitions.definitionsValid,
      pendingChecksValid: Boolean(pending.pendingChecksValid),
      resolutionComplete,
      active,
      consequences,
      actionCount: order.orderedActions.length,
      checkActionCount,
      noRollActionCount: execution.noRollActionCount ?? 0,
      errors: [
        ...structural.errors,
        ...order.errors,
        ...execution.errors,
        ...pending.errors,
        ...definitions.errors
      ],
      warnings: [
        ...structural.warnings,
        ...order.warnings,
        ...execution.warnings,
        ...pending.warnings,
        ...definitions.warnings
      ]
    });

    const lifecycleState = readOwnDataValue(state, "lifecycleState");
    const phase = readOwnDataValue(state, "phase");
    const currentStage = readOwnDataValue(state, "currentStage");
    const encounterId = readOwnDataValue(state, "encounterId");
    const roundNumber = readOwnDataValue(state, "roundNumber");
    const stageId = readOwnDataValue(currentStage, "stageId");
    if ((lifecycleState === "active") !== active || (phase === "consequences") !== consequences) {
      throw new TypeError("Normalized encounter context does not match source data.");
    }

    if (!active) {
      report.errors.push(
        issue(
          "outcome-interpretation-requires-active",
          "lifecycleState",
          "Interpretation requires an Active encounter."
        )
      );
    }
    if (!consequences) {
      report.errors.push(
        issue(
          "outcome-interpretation-requires-consequences",
          "phase",
          "Interpretation requires the Consequences phase."
        )
      );
    }
    if (!resolutionComplete) {
      report.errors.push(
        issue(
          "outcome-interpretation-resolution-incomplete",
          "pendingChecks",
          "Interpretation requires complete action resolution."
        )
      );
    }

    const requests = execution.executionRequests;
    const normalizedDefinitions = definitions.actions;
    const pendingChecks = pending.pendingChecks;
    const preflightRecords = [];

    for (const { index: orderedIndex, value: row } of ownArrayEntries(order.orderedActions)) {
      const recordErrorStart = report.errors.length;
      let recordComplete = true;
      const { sequence, stationId, actionId } = row;
      const orderedPath = `orderedActions[${sequence}]`;

      const requestMatches = findMatches(
        requests,
        (request) => request.sequence === sequence
          && request.stationId === stationId
          && request.actionId === actionId
      );
      if (requestMatches.length === 0) {
        report.errors.push(
          issue(
            "outcome-interpretation-execution-request-missing",
            orderedPath,
            "Execution request missing."
          )
        );
      } else if (requestMatches.length > 1) {
        report.errors.push(
          issue(
            "outcome-interpretation-execution-request-ambiguous",
            orderedPath,
            "Execution request ambiguous."
          )
        );
      }
      if (requestMatches.length !== 1) continue;
      const requestRecord = requestMatches[0];
      const request = requestRecord.value;

      if (request.mode !== "check" && request.mode !== "no-roll") {
        report.errors.push(
          issue(
            "outcome-interpretation-mode-mismatch",
            `executionRequests[${requestRecord.index}].mode`,
            "Execution request mode is invalid."
          )
        );
      }

      const definitionMatches = findMatches(
        normalizedDefinitions,
        (definition) => definition.stationId === stationId && definition.actionId === actionId
      );
      if (definitionMatches.length === 0) {
        report.errors.push(
          issue(
            "outcome-interpretation-definition-missing",
            `selections.${stationId}`,
            "Outcome definition missing."
          )
        );
      } else if (definitionMatches.length > 1) {
        report.errors.push(
          issue(
            "outcome-interpretation-definition-ambiguous",
            `selections.${stationId}`,
            "Outcome definition ambiguous."
          )
        );
      }
      if (definitionMatches.length !== 1) continue;
      const definitionRecord = definitionMatches[0];
      const definition = definitionRecord.value;

      if (definition.mode !== request.mode) {
        report.errors.push(
          issue(
            "outcome-interpretation-mode-mismatch",
            `definitions[${definitionRecord.index}].mode`,
            "Definition and execution request modes do not match."
          )
        );
      }

      let pendingCheckRecord = null;
      let pendingPath = null;
      let branch = "no-roll";
      if (definition.mode === "check") {
        const pendingMatches = findMatches(
          pendingChecks,
          (pendingCheck) => pendingCheck.stageId === stageId
            && pendingCheck.roundNumber === roundNumber
            && pendingCheck.sequence === sequence
            && pendingCheck.stationId === stationId
            && pendingCheck.actionId === actionId
            && pendingCheck.mode === request.mode
        );
        if (pendingMatches.length === 0) {
          report.errors.push(
            issue(
              "outcome-interpretation-pending-check-missing",
              orderedPath,
              "Pending check missing."
            )
          );
        } else if (pendingMatches.length > 1) {
          report.errors.push(
            issue(
              "outcome-interpretation-pending-check-ambiguous",
              orderedPath,
              "Pending check ambiguous."
            )
          );
        }
        if (pendingMatches.length !== 1) continue;
        pendingCheckRecord = pendingMatches[0];
        const pendingCheck = pendingCheckRecord.value;
        pendingPath = `pendingChecks[${pendingCheck.pendingCheckIndex}]`;

        if (pendingCheck.status !== "resolved") {
          report.errors.push(
            issue(
              "outcome-interpretation-pending-check-unresolved",
              `${pendingPath}.status`,
              "Pending check unresolved."
            )
          );
          continue;
        }
        if (pendingCheck.result === null || typeof pendingCheck.result !== "object") {
          report.errors.push(
            issue(
              "outcome-interpretation-pending-check-unresolved",
              `${pendingPath}.result`,
              "Pending check has no result."
            )
          );
          continue;
        }

        branch = readOwnDataValue(pendingCheck.result, "degreeOfSuccessSlug");
        if (!CHECK_BRANCHES.has(branch)) {
          report.errors.push(
            issue(
              "outcome-interpretation-result-branch-invalid",
              `${pendingPath}.result.degreeOfSuccessSlug`,
              "Result branch is invalid."
            )
          );
          continue;
        }
      }

      const riskBidBranchRecord = resolveRiskBidBranchPreflight({
        state,
        row,
        request,
        pendingCheck: pendingCheckRecord?.value ?? null,
        definition,
        branch,
        orderedPath,
        requestPath: `executionRequests[${requestRecord.index}]`,
        pendingPath,
        errors: report.errors
      });
      if (!riskBidBranchRecord) {
        recordComplete = false;
      }

      const branches = definition.branches;
      const normalActionBranchActive = !riskBidBranchRecord?.selected
        || branch === "no-roll"
        || NORMAL_ACTION_BID_BRANCHES.has(branch);
      const branchEffectIds = normalActionBranchActive
        ? readOwnDataValue(branches, branch)
        : [];
      if (!Array.isArray(branchEffectIds)) {
        if (definitions.definitionsValid) {
          throw new TypeError("Normalized outcome branch must be an array.");
        }
        recordComplete = false;
        continue;
      }

      const effectRecords = [];
      for (const referenceRecord of ownArrayEntries(branchEffectIds)) {
        const effectId = referenceRecord.value;
        const effectRuleMatches = findMatches(
          definition.effectRules,
          (effectRule) => effectRule?.effectId === effectId
        );
        const referencePath = `${orderedPath}.branches.${branch}[${referenceRecord.index}]`;
        if (effectRuleMatches.length === 0) {
          report.errors.push(
            issue(
              "outcome-interpretation-effect-rule-missing",
              referencePath,
              "Effect rule missing."
            )
          );
        } else if (effectRuleMatches.length > 1) {
          recordComplete = false;
        } else {
          effectRecords.push({
            referenceIndex: referenceRecord.index,
            effectId,
            effectRuleRecord: effectRuleMatches[0]
          });
        }
      }

      if (recordComplete && report.errors.length === recordErrorStart) {
        preflightRecords.push({
          orderedActionRecord: { index: orderedIndex, value: row },
          executionRequestRecord: requestRecord,
          definitionRecord,
          pendingCheckRecord,
          branchRecord: {
            branch,
            branchEffectIds,
            effectRecords
          },
          riskBidBranchRecord
        });
      }
    }

    finalizeReport(report);
    if (report.errors.length > 0) return report;
    if (preflightRecords.length !== report.actionCount) {
      throw new TypeError("Every accepted action requires one complete preflight record.");
    }

    const actions = [];
    const intents = [];
    for (const preflight of preflightRecords) {
      const row = preflight.orderedActionRecord.value;
      const request = preflight.executionRequestRecord.value;
      const { branch, branchEffectIds, effectRecords } = preflight.branchRecord;
      const riskBidBranchRecord = preflight.riskBidBranchRecord;
      const riskBidEffectIds = riskBidBranchRecord.selected
        ? riskBidBranchRecord.branchEffectIds
        : [];
      const intentIds = [];

      const emitIntents = (records, activationSource) => {
        for (const effectRecord of records) {
          const effectRule = effectRecord.effectRuleRecord.value;
          const intentId = `arcflight-intent:${JSON.stringify([
            encounterId,
            stageId,
            roundNumber,
            row.sequence,
            activationSource,
            effectRecord.referenceIndex,
            effectRecord.effectId
          ])}`;
          intents.push({
            intentId,
            encounterId,
            stageId,
            roundNumber,
            sequence: row.sequence,
            stationId: row.stationId,
            actionId: row.actionId,
            mode: request.mode,
            branch,
            riskBidId: row.riskBidId ?? null,
            dcAdjustment: row.dcAdjustment ?? null,
            activationSource,
            referenceIndex: effectRecord.referenceIndex,
            effectId: effectRecord.effectId,
            intentType: effectRule.intentType,
            timing: effectRule.timing,
            visibility: effectRule.visibility,
            target: clonePlainDataSafely(effectRule.target),
            selectedTarget: clonePlainDataSafely(request.target ?? null),
            payload: clonePlainDataSafely(effectRule.payload)
          });
          intentIds.push(intentId);
        }
      };

      emitIntents(effectRecords, "branch");
      if (riskBidBranchRecord.selected) {
        emitIntents(riskBidBranchRecord.effectRecords, "risk-bid");
      }

      actions.push({
        sequence: row.sequence,
        stationId: row.stationId,
        actionId: row.actionId,
        mode: request.mode,
        branch,
        riskBidId: row.riskBidId ?? null,
        dcAdjustment: row.dcAdjustment ?? null,
        branchEffectIds: clonePlainDataSafely(branchEffectIds),
        riskBidEffectIds: clonePlainDataSafely(riskBidEffectIds),
        intentIds
      });
    }

    report.readyForInterpretation = true;
    report.actions = actions;
    report.intents = intents;
    report.interpretedActionCount = actions.length;
    report.intentCount = intents.length;
    return report;
  } catch {
    return createDataReadFailureReport(report);
  }
}

// Note: only named export `analyzeVoyageEncounterActionOutcomes` is provided.
