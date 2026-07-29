import { validateVoyageEncounterState } from "./validation.js";
import { analyzeVoyageEncounterResolutionOrder, deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { analyzeVoyageEncounterActionExecutionRequests } from "./resolution-execution-requests.js";
import { analyzeVoyageEncounterPendingChecks } from "./pending-checks.js";
import { analyzeVoyageEncounterActionOutcomeDefinitions } from "./consequence-rules.js";

const CHECK_BRANCHES = new Set(["critical-failure", "failure", "success", "critical-success"]);

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

  const entries = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) continue;
    entries.push({ index, value: readOwnDataValue(value, index) });
  }
  return entries;
}

function clonePlainDataSafely(value, ancestors = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || ancestors.has(value)) throw new TypeError("Expected finite acyclic plain data.");

  const array = Array.isArray(value);
  const clone = array ? new Array(value.length) : {};
  ancestors.add(value);

  const keys = array
    ? ownArrayEntries(value).map(({ index }) => String(index))
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
        const pendingPath = `pendingChecks[${pendingCheck.pendingCheckIndex}]`;

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

      const branches = definition.branches;
      const branchEffectIds = readOwnDataValue(branches, branch);
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
          }
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
      const intentIds = [];

      for (const effectRecord of effectRecords) {
        const effectRule = effectRecord.effectRuleRecord.value;
        const intentId = `arcflight-intent:${JSON.stringify([
          encounterId,
          stageId,
          roundNumber,
          row.sequence,
          "branch",
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
          activationSource: "branch",
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

      actions.push({
        sequence: row.sequence,
        stationId: row.stationId,
        actionId: row.actionId,
        mode: request.mode,
        branch,
        riskBidId: row.riskBidId ?? null,
        dcAdjustment: row.dcAdjustment ?? null,
        branchEffectIds: clonePlainDataSafely(branchEffectIds),
        riskBidEffectIds: [],
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
