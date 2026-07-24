import { VOYAGE_ACTION_OUTCOME_BRANCHES as BRANCHES, VOYAGE_ACTION_EXECUTION_MODES as MODES, VOYAGE_ENCOUNTER_LIFECYCLE_STATES as LIFE, VOYAGE_ROUND_PHASES as PHASES } from "./constants.js";
import { validateVoyageEncounterState } from "./validation.js";
import { analyzeVoyageEncounterResolutionOrder, deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { analyzeVoyageEncounterActionExecutionRequests } from "./resolution-execution-requests.js";
import { analyzeVoyageEncounterPendingChecks } from "./pending-checks.js";
import { analyzeVoyageEncounterActionOutcomeDefinitions } from "./consequence-rules.js";

const error = (code, path, message) => ({ code, path, message, severity: "error" });
const numericIndices = (value) => Array.isArray(value)
  ? Array.from({ length: value.length }, (_, index) => index).filter((index) => Object.hasOwn(value, index)) : [];

function clone(value) {
  if (Array.isArray(value)) {
    const result = new Array(value.length);
    for (const index of numericIndices(value)) result[index] = clone(value[index]);
    return result;
  }
  if (value && typeof value === "object") {
    const result = Object.getPrototypeOf(value) === null ? Object.create(null) : {};
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) Object.defineProperty(result, key, { value: clone(descriptor.value), enumerable: true, configurable: true, writable: true });
    }
    return result;
  }
  return value;
}

function empty(structural, definitions, pending, active, consequences, errors, warnings, actionCount = 0, checkActionCount = 0, noRollActionCount = 0) {
  return { structurallyValid: structural, definitionsValid: definitions, pendingChecksValid: pending, resolutionComplete: false, active, consequences, readyForInterpretation: false, actionCount, interpretedActionCount: 0, checkActionCount, noRollActionCount, intentCount: 0, actions: [], intents: [], errors: deduplicateVoyageResolutionIssues(errors), warnings: deduplicateVoyageResolutionIssues(warnings) };
}

export function analyzeVoyageEncounterActionOutcomes(state) {
  try {
    const structural = validateVoyageEncounterState(state);
    const order = analyzeVoyageEncounterResolutionOrder(state);
    const execution = analyzeVoyageEncounterActionExecutionRequests(state, { requireResolution: false });
    const pending = analyzeVoyageEncounterPendingChecks(state);
    const definitions = analyzeVoyageEncounterActionOutcomeDefinitions(state);
    const active = state?.lifecycleState === LIFE.ACTIVE;
    const consequences = state?.phase === PHASES.CONSEQUENCES;
    const errors = [...structural.errors, ...order.errors, ...execution.errors, ...pending.errors, ...definitions.errors];
    const warnings = [...structural.warnings, ...order.warnings, ...execution.warnings, ...pending.warnings, ...definitions.warnings];
    const actions = order.valid ? order.orderedActions : [];
    const checkActionCount = execution.readyForExecution ? execution.checkCount : 0;
    const noRollActionCount = execution.readyForExecution ? execution.noRollActionCount : 0;
    if (structural.valid && !active) errors.push(error("outcome-interpretation-requires-active", "lifecycleState", "Outcome interpretation requires an Active encounter."));
    if (structural.valid && !consequences) errors.push(error("outcome-interpretation-requires-consequences", "phase", "Outcome interpretation requires Consequences phase."));
    const complete = order.valid && execution.readyForExecution && pending.pendingChecksValid
      && pending.pendingCheckCount === checkActionCount && pending.resolvedCheckCount === pending.pendingCheckCount;
    if (structural.valid && !complete) errors.push(error("outcome-interpretation-resolution-incomplete", "pendingChecks", "Resolution must be complete before outcomes can be interpreted."));
    if (errors.length) return empty(structural.valid, definitions.definitionsValid, pending.pendingChecksValid, active, consequences, errors, warnings, actions.length, checkActionCount, noRollActionCount);

    const outputActions = [];
    const intents = [];
    for (const action of actions) {
      const path = `orderedActions[${action.sequence}]`;
      const requests = execution.executionRequests.filter((request) => request.sequence === action.sequence && request.stationId === action.stationId && request.actionId === action.actionId);
      if (!requests.length) { errors.push(error("outcome-interpretation-execution-request-missing", path, "Ordered action has no execution request.")); break; }
      if (requests.length !== 1) { errors.push(error("outcome-interpretation-execution-request-ambiguous", path, "Ordered action has ambiguous execution requests.")); break; }
      const request = requests[0];
      if (![MODES.CHECK, MODES.NO_ROLL].includes(request.mode)) { errors.push(error("outcome-interpretation-mode-mismatch", path, "Execution request mode is invalid.")); break; }
      const matches = definitions.actions.filter((definition) => definition.stationId === action.stationId && definition.actionId === action.actionId);
      if (!matches.length) { errors.push(error("outcome-interpretation-definition-missing", path, "Ordered action has no outcome definition.")); break; }
      if (matches.length !== 1) { errors.push(error("outcome-interpretation-definition-ambiguous", path, "Ordered action has ambiguous outcome definitions.")); break; }
      const definition = matches[0];
      if (definition.mode !== request.mode) { errors.push(error("outcome-interpretation-mode-mismatch", path, "Outcome definition mode does not match execution request mode.")); break; }
      let branch = BRANCHES.NO_ROLL;
      if (request.mode === MODES.CHECK) {
        const records = pending.pendingChecks.filter((record) => record.stageId === state.currentStage.stageId && record.roundNumber === state.roundNumber && record.sequence === action.sequence && record.stationId === action.stationId && record.actionId === action.actionId && record.mode === request.mode);
        if (!records.length) { errors.push(error("outcome-interpretation-pending-check-missing", "pendingChecks", "Check action has no pending check.")); break; }
        if (records.length !== 1) { errors.push(error("outcome-interpretation-pending-check-ambiguous", "pendingChecks", "Check action has ambiguous pending checks.")); break; }
        const record = records[0];
        const index = pending.pendingChecks.indexOf(record);
        if (record.status !== "resolved" || record.result === null) { errors.push(error("outcome-interpretation-pending-check-unresolved", `pendingChecks[${index}].status`, "Pending check must be resolved.")); break; }
        branch = record.result.degreeOfSuccessSlug;
        if (![BRANCHES.CRITICAL_FAILURE, BRANCHES.FAILURE, BRANCHES.SUCCESS, BRANCHES.CRITICAL_SUCCESS].includes(branch)) { errors.push(error("outcome-interpretation-result-branch-invalid", `pendingChecks[${index}].result.degreeOfSuccessSlug`, "Pending check result branch is invalid.")); break; }
      }
      const branchEffects = definition.branches[branch];
      const effectRules = new Map(definition.effectRules.filter((rule) => rule).map((rule) => [rule.effectId, rule]));
      const actionIntents = [];
      const effectIds = [];
      for (const referenceIndex of numericIndices(branchEffects)) {
        const effectId = branchEffects[referenceIndex]; const rule = effectRules.get(effectId);
        if (!rule) { errors.push(error("outcome-interpretation-effect-rule-missing", `${path}.branches.${branch}[${referenceIndex}]`, "Branch effect reference has no effect rule.")); break; }
        const intentId = `arcflight-intent:${JSON.stringify([state.encounterId, state.currentStage.stageId, state.roundNumber, action.sequence, "branch", referenceIndex, effectId])}`;
        actionIntents.push({ intentId, encounterId: state.encounterId, stageId: state.currentStage.stageId, roundNumber: state.roundNumber, sequence: action.sequence, stationId: action.stationId, actionId: action.actionId, mode: request.mode, branch, riskBidId: action.riskBidId, activationSource: "branch", referenceIndex, effectId, intentType: rule.intentType, timing: rule.timing, visibility: rule.visibility, target: clone(rule.target), selectedTarget: clone(request.target), payload: clone(rule.payload) });
        effectIds.push(effectId);
      }
      if (errors.length) break;
      intents.push(...actionIntents);
      outputActions.push({ sequence: action.sequence, stationId: action.stationId, actionId: action.actionId, mode: request.mode, branch, riskBidId: action.riskBidId, branchEffectIds: effectIds, riskBidEffectIds: [], intentIds: actionIntents.map((intent) => intent.intentId) });
    }
    if (errors.length) return empty(structural.valid, definitions.definitionsValid, pending.pendingChecksValid, active, consequences, errors, warnings, actions.length, checkActionCount, noRollActionCount);
    return { structurallyValid: structural.valid, definitionsValid: definitions.definitionsValid, pendingChecksValid: pending.pendingChecksValid, resolutionComplete: complete, active, consequences, readyForInterpretation: true, actionCount: actions.length, interpretedActionCount: outputActions.length, checkActionCount, noRollActionCount, intentCount: intents.length, actions: clone(outputActions), intents: clone(intents), errors: [], warnings: deduplicateVoyageResolutionIssues(warnings) };
  } catch {
    return empty(false, false, false, false, false, [error("outcome-interpretation-data-read-failed", "$", "Outcome interpretation data could not be read safely.")], []);
  }
}
