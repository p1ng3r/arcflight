import { validateVoyageEncounterState } from "./validation.js";
import { analyzeVoyageEncounterResolutionOrder, deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { analyzeVoyageEncounterActionExecutionRequests } from "./resolution-execution-requests.js";
import { analyzeVoyageEncounterPendingChecks } from "./pending-checks.js";
import { analyzeVoyageEncounterActionOutcomeDefinitions } from "./consequence-rules.js";

export function analyzeVoyageEncounterActionOutcomes(state) {
  // Lightweight safe clone that never invokes getters and preserves sparse arrays
  function safeClone(value, ancestors = new Set()) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (ancestors.has(value)) return undefined;
    if (Array.isArray(value)) {
      const clone = new Array(value.length);
      for (let i = 0; i < value.length; i += 1) {
        if (!Object.hasOwn(value, i)) continue;
        const desc = Object.getOwnPropertyDescriptor(value, i);
        if (!desc || !Object.prototype.hasOwnProperty.call(desc, "value")) continue;
        ancestors.add(value);
        clone[i] = safeClone(desc.value, ancestors);
        ancestors.delete(value);
      }
      return clone;
    }
    if (typeof value === "object") {
      const result = {};
      const keys = Reflect.ownKeys(value);
      for (const key of keys) {
        const desc = Object.getOwnPropertyDescriptor(value, key);
        if (!desc || !Object.prototype.hasOwnProperty.call(desc, "value")) continue;
        ancestors.add(value);
        result[key] = safeClone(desc.value, ancestors);
        ancestors.delete(value);
      }
      return result;
    }
    return undefined;
  }

  const structural = validateVoyageEncounterState(state);
  const order = analyzeVoyageEncounterResolutionOrder(state);
  const execution = analyzeVoyageEncounterActionExecutionRequests(state, { requireResolution: false });
  const pending = analyzeVoyageEncounterPendingChecks(state);
  const definitions = analyzeVoyageEncounterActionOutcomeDefinitions(state);

  const upstreamErrors = [...structural.errors, ...order.errors, ...execution.errors, ...pending.errors, ...definitions.errors];
  const upstreamWarnings = [...structural.warnings, ...order.warnings, ...execution.warnings, ...pending.warnings, ...definitions.warnings];

  // Compute resolutionComplete independently
  const resolutionComplete = Boolean(
    order.valid
    && execution.readyForExecution
    && pending.pendingChecksValid
    && (pending.pendingCheckCount === (execution.checkCount || 0))
    && (pending.resolvedCheckCount === pending.pendingCheckCount)
  );

  const reportTemplate = {
    structurallyValid: structural.valid,
    definitionsValid: definitions.definitionsValid,
    pendingChecksValid: !!pending.pendingChecksValid,
    resolutionComplete,
    active: state?.lifecycleState === "active",
    consequences: state?.phase === "consequences",
    readyForInterpretation: false,
    actionCount: order.orderedActions.length,
    interpretedActionCount: 0,
    checkActionCount: execution.checkCount ?? 0,
    noRollActionCount: execution.noRollActionCount ?? 0,
    intentCount: 0,
    actions: [],
    intents: [],
    errors: [],
    warnings: []
  };

  // Start with upstream issues but keep them until dedupe at end
  reportTemplate.errors.push(...upstreamErrors);
  reportTemplate.warnings.push(...upstreamWarnings);

  // Interpreter-owned gate checks: require Active before doing any interpretation work.
  if (!reportTemplate.active) {
    reportTemplate.errors.push({ code: "outcome-interpretation-requires-active", path: "lifecycleState", message: "Interpretation requires an Active encounter.", severity: "error" });
    reportTemplate.errors = deduplicateVoyageResolutionIssues(reportTemplate.errors);
    reportTemplate.warnings = deduplicateVoyageResolutionIssues(reportTemplate.warnings);
    return reportTemplate;
  }

  // Preflight every ordered action and collect potential interpreter issues
  const interpreterValidationErrors = [];

  const requests = execution.executionRequests || [];
  const defs = definitions.actions || [];
  const pchecks = pending.pendingChecks || [];

  // If outcome definitions are invalid, block interpretation early so callers
  // do not emit actions/intents based on malformed authored data.
  if (!definitions.definitionsValid) {
    interpreterValidationErrors.push({ code: "outcome-interpretation-definitions-invalid", path: "availableStations", message: "Outcome definitions are invalid.", severity: "error" });
  }

  // helper to find matches without Map overwrites
  function findMatches(arr, predicate) {
    const matches = [];
    for (let i = 0; i < arr.length; i += 1) {
      if (!Object.hasOwn(arr, i)) continue;
      try {
        if (predicate(arr[i])) matches.push({ index: i, value: arr[i] });
      } catch (e) {
        interpreterValidationErrors.push({ code: "outcome-interpretation-data-read-failed", path: "$", message: "Data could not be read safely.", severity: "error" });
      }
    }
    return matches;
  }

  // Preflight loop
  for (let ordIndex = 0; ordIndex < order.orderedActions.length; ordIndex += 1) {
    const row = order.orderedActions[ordIndex];
    const { sequence, stationId, actionId } = row;

    // execution requests match by sequence, stationId, actionId
    const reqMatches = findMatches(requests, (r) => r.sequence === sequence && r.stationId === stationId && r.actionId === actionId);
    if (reqMatches.length === 0) interpreterValidationErrors.push({ code: "outcome-interpretation-execution-request-missing", path: `orderedActions[${sequence}]`, message: "Execution request missing.", severity: "error" });
    if (reqMatches.length > 1) interpreterValidationErrors.push({ code: "outcome-interpretation-execution-request-ambiguous", path: `orderedActions[${sequence}]`, message: "Execution request ambiguous.", severity: "error" });
    if (reqMatches.length !== 1) continue;
    const req = reqMatches[0].value;

    if (req.mode !== "check" && req.mode !== "no-roll") interpreterValidationErrors.push({ code: "outcome-interpretation-mode-mismatch", path: `executionRequests[${reqMatches[0].index}]`, message: "Execution request mode invalid.", severity: "error" });

    // definitions match by stationId/actionId
    const defMatches = findMatches(defs, (d) => d.stationId === stationId && d.actionId === actionId);
    if (defMatches.length === 0) interpreterValidationErrors.push({ code: "outcome-interpretation-definition-missing", path: `selections.${stationId}`, message: "Outcome definition missing.", severity: "error" });
    if (defMatches.length > 1) interpreterValidationErrors.push({ code: "outcome-interpretation-definition-ambiguous", path: `selections.${stationId}`, message: "Outcome definition ambiguous.", severity: "error" });
    if (defMatches.length !== 1) continue;
    const def = defMatches[0].value;

    if (def.mode !== req.mode) interpreterValidationErrors.push({ code: "outcome-interpretation-mode-mismatch", path: `availableStations`, message: "Definition and request mode mismatch.", severity: "error" });

    // For check mode, find pending check matches
    let branch = def.mode === "no-roll" ? "no-roll" : null;
    if (def.mode === "check") {
      const pMatches = findMatches(pchecks, (p) => p.stageId === state.currentStage?.stageId && p.roundNumber === state.roundNumber && p.sequence === sequence && p.stationId === stationId && p.actionId === actionId && p.mode === req.mode);
      if (pMatches.length === 0) interpreterValidationErrors.push({ code: "outcome-interpretation-pending-check-missing", path: `orderedActions[${sequence}]`, message: "Pending check missing.", severity: "error" });
      if (pMatches.length > 1) interpreterValidationErrors.push({ code: "outcome-interpretation-pending-check-ambiguous", path: `orderedActions[${sequence}]`, message: "Pending check ambiguous.", severity: "error" });
      if (pMatches.length !== 1) continue;
      const p = pMatches[0].value;
      if (p.status !== "resolved") interpreterValidationErrors.push({ code: "outcome-interpretation-pending-check-unresolved", path: `pendingChecks[${p.pendingCheckIndex}].status`, message: "Pending check unresolved.", severity: "error" });
      if (!p.result) interpreterValidationErrors.push({ code: "outcome-interpretation-pending-check-unresolved", path: `pendingChecks[${p.pendingCheckIndex}].result`, message: "Pending check has no result.", severity: "error" });
      if (!p.result || typeof p.result.degreeOfSuccessSlug !== "string") {
        interpreterValidationErrors.push({ code: "outcome-interpretation-result-branch-invalid", path: `pendingChecks[${p.pendingCheckIndex}].result.degreeOfSuccessSlug`, message: "Result branch invalid.", severity: "error" });
        continue;
      }
      const slug = p.result.degreeOfSuccessSlug;
      const validSlugs = new Set(["critical-failure", "failure", "success", "critical-success"]);
      if (!validSlugs.has(slug)) {
        interpreterValidationErrors.push({ code: "outcome-interpretation-result-branch-invalid", path: `pendingChecks[${p.pendingCheckIndex}].result.degreeOfSuccessSlug`, message: "Result branch invalid.", severity: "error" });
        continue;
      }
      branch = slug;
    }

    // Validate branch references resolve to effect rules (only own numeric entries)
    const branches = def.branches || {};
    const branchRefs = Object.hasOwn(branches, branch) ? branches[branch] : [];
    for (let refIndex = 0; refIndex < (branchRefs ? branchRefs.length : 0); refIndex += 1) {
      if (!Object.hasOwn(branchRefs, refIndex)) continue;
      const effectId = branchRefs[refIndex];
      if (!effectId) continue;
      // find own effect rule by effectId
      const found = findMatches(def.effectRules || [], (er) => er && er.effectId === effectId);
      if (found.length === 0) {
        interpreterValidationErrors.push({ code: "outcome-interpretation-effect-rule-missing", path: `orderedActions[${sequence}].branches.${branch}[${refIndex}]`, message: "Effect rule missing.", severity: "error" });
      }
    }
  }

  // If any interpreter validation error, return atomic empty output with deduped issues
  if (interpreterValidationErrors.length) {
    reportTemplate.errors.push(...interpreterValidationErrors);
    reportTemplate.errors = deduplicateVoyageResolutionIssues(reportTemplate.errors);
    reportTemplate.warnings = deduplicateVoyageResolutionIssues(reportTemplate.warnings);
    reportTemplate.readyForInterpretation = false;
    reportTemplate.interpretedActionCount = 0;
    reportTemplate.intentCount = 0;
    reportTemplate.actions = [];
    reportTemplate.intents = [];
    return reportTemplate;
  }

  // All preflight checks passed — now emit actions and intents
  // Mark readyForInterpretation only if we are in the Consequences phase.
  reportTemplate.readyForInterpretation = reportTemplate.consequences === true;

  for (let ordIndex = 0; ordIndex < order.orderedActions.length; ordIndex += 1) {
    const row = order.orderedActions[ordIndex];
    const { sequence, stationId, actionId } = row;

    // locate single execution request and definition (guaranteed by preflight)
    const reqMatch = requests.find((r, i) => Object.hasOwn(requests, i) && r.sequence === sequence && r.stationId === stationId && r.actionId === actionId);
    const defMatch = defs.find((d, i) => Object.hasOwn(defs, i) && d.stationId === stationId && d.actionId === actionId);
    const req = reqMatch;
    const def = defMatch;

    const mode = req.mode;
    let branch = def.mode === "no-roll" ? "no-roll" : null;
    let pendingRecord = null;
    if (def.mode === "check") {
      pendingRecord = pchecks.find((p, i) => Object.hasOwn(pchecks, i) && p.stageId === state.currentStage?.stageId && p.roundNumber === state.roundNumber && p.sequence === sequence && p.stationId === stationId && p.actionId === actionId && p.mode === req.mode);
      branch = pendingRecord.result.degreeOfSuccessSlug;
    }

    // Build branchEffectIds preserving sparse own indexes
    const branchRefs = Object.hasOwn(def.branches || {}, branch) ? def.branches[branch] : [];
    const branchEffectIds = new Array(branchRefs.length);
    for (let idx = 0; idx < branchRefs.length; idx += 1) {
      if (!Object.hasOwn(branchRefs, idx)) continue;
      const eff = branchRefs[idx];
      branchEffectIds[idx] = safeClone(eff);
    }

    const riskBidEffectIds = [];

    // Intents
    const intentIds = [];
    if (Array.isArray(branchRefs)) {
      for (let idx = 0; idx < branchRefs.length; idx += 1) {
        if (!Object.hasOwn(branchRefs, idx)) continue;
        const effectId = branchRefs[idx];
        if (!effectId) continue;
        const rule = (def.effectRules || []).find((r) => r && r.effectId === effectId);
        if (!rule) continue; // preflight ensures presence

        const intentId = `arcflight-intent:${JSON.stringify([state.encounterId, state.currentStage?.stageId, state.roundNumber, sequence, "branch", idx, effectId])}`;

        const intent = {
          intentId,
          encounterId: state.encounterId,
          stageId: state.currentStage?.stageId,
          roundNumber: state.roundNumber,
          sequence,
          stationId,
          actionId,
          mode,
          branch,
          riskBidId: row.riskBidId ?? null,
          activationSource: "branch",
          referenceIndex: idx,
          effectId,
          intentType: rule.intentType,
          timing: rule.timing,
          visibility: rule.visibility,
          target: safeClone(rule.target),
          selectedTarget: safeClone(req.target ?? null),
          payload: safeClone(rule.payload)
        };

        reportTemplate.intents.push(intent);
        intentIds.push(intentId);
      }
    }

    const actionRecord = {
      sequence,
      stationId,
      actionId,
      mode,
      branch,
      riskBidId: row.riskBidId ?? null,
      branchEffectIds,
      riskBidEffectIds,
      intentIds
    };

    reportTemplate.actions.push(actionRecord);
  }

  reportTemplate.interpretedActionCount = reportTemplate.actions.length;
  reportTemplate.intentCount = reportTemplate.intents.length;
  reportTemplate.errors = deduplicateVoyageResolutionIssues(reportTemplate.errors);
  reportTemplate.warnings = deduplicateVoyageResolutionIssues(reportTemplate.warnings);

  return reportTemplate;
}

// Note: only named export `analyzeVoyageEncounterActionOutcomes` is provided.
