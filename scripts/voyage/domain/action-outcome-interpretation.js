import { clonePlainData, isPlainObject } from "./defaults.js";
import { validateVoyageEncounterState } from "./validation.js";
import { analyzeVoyageEncounterResolutionOrder, deduplicateVoyageResolutionIssues } from "./resolution-order.js";
import { analyzeVoyageEncounterActionExecutionRequests } from "./resolution-execution-requests.js";
import { analyzeVoyageEncounterPendingChecks } from "./pending-checks.js";
import { analyzeVoyageEncounterActionOutcomeDefinitions } from "./consequence-rules.js";

export function analyzeVoyageEncounterActionOutcomes(state) {
  try {
    const structural = validateVoyageEncounterState(state);
    const order = analyzeVoyageEncounterResolutionOrder(state);
    const execution = analyzeVoyageEncounterActionExecutionRequests(state, { requireResolution: false });
    const pending = analyzeVoyageEncounterPendingChecks(state);
    const definitions = analyzeVoyageEncounterActionOutcomeDefinitions(state);

    const errors = [...structural.errors, ...order.errors, ...execution.errors, ...pending.errors, ...definitions.errors];
    const warnings = [...structural.warnings, ...order.warnings, ...execution.warnings, ...pending.warnings, ...definitions.warnings];
    const finalErrors = deduplicateVoyageResolutionIssues(errors);
    const finalWarnings = deduplicateVoyageResolutionIssues(warnings);

    const report = {
      structurallyValid: structural.valid,
      definitionsValid: definitions.definitionsValid,
      pendingChecksValid: pending.pendingChecksValid ?? false,
      resolutionComplete: order.valid,
      active: definitions.active,
      consequences: definitions.consequences,
      readyForInterpretation: definitions.readyForInterpretation,
      actionCount: order.orderedActions.length,
      interpretedActionCount: 0,
      checkActionCount: execution.checkCount ?? 0,
      noRollActionCount: execution.noRollActionCount ?? 0,
      intentCount: 0,
      actions: [],
      intents: [],
      errors: finalErrors,
      warnings: finalWarnings
    };

    // If any underlying errors, return atomic empty actions/intents per spec.
    if (finalErrors.length) return report;

    // Build lookup maps
    const execMap = new Map();
    for (const req of execution.executionRequests || []) {
      const key = `${req.sequence}\0${req.stationId}\0${req.actionId}`;
      execMap.set(key, req);
    }

    const defMap = new Map();
    for (const def of definitions.actions || []) {
      defMap.set(`${def.stationId}\0${def.actionId}`, def);
    }

    const pendingMap = new Map();
    for (const p of pending.pendingChecks || []) {
      const key = `${p.stageId}\0${p.roundNumber}\0${p.sequence}\0${p.stationId}\0${p.actionId}\0${p.mode}`;
      pendingMap.set(key, p);
    }

    // Interpret ordered actions only
    for (const row of order.orderedActions) {
      const sequence = row.sequence;
      const stationId = row.stationId;
      const actionId = row.actionId;
      const riskBidId = row.riskBidId ?? null;
      const execKey = `${sequence}\0${stationId}\0${actionId}`;
      const req = execMap.get(execKey);
      if (!req) {
        report.errors.push({ code: "missing-execution-request", path: `orderedActions[${sequence}]`, message: "Missing execution request for ordered action.", severity: "error" });
        return { ...report, errors: deduplicateVoyageResolutionIssues(report.errors) };
      }

      const def = defMap.get(`${stationId}\0${actionId}`);
      if (!def) {
        report.errors.push({ code: "missing-outcome-definition", path: `selections.${stationId}`, message: "Missing outcome definition for selected action.", severity: "error" });
        return { ...report, errors: deduplicateVoyageResolutionIssues(report.errors) };
      }

      // For check mode, locate pending check
      let branch = def.mode === "no-roll" ? "no-roll" : null;
      if (def.mode === "check") {
        const pkey = `${state.currentStage?.stageId}\0${state.roundNumber}\0${sequence}\0${stationId}\0${actionId}\0${req.mode}`;
        const p = pendingMap.get(pkey);
        if (!p) {
          report.errors.push({ code: "missing-pending-check", path: "pendingChecks", message: `Missing pending check for sequence ${sequence}.`, severity: "error" });
          return { ...report, errors: deduplicateVoyageResolutionIssues(report.errors) };
        }
        if (p.status !== "resolved") {
          // unresolved pending check diagnostic must reference pendingChecks[index].status
          report.errors.push({ code: "unresolved-pending-check", path: `pendingChecks[${p.pendingCheckIndex}].status`, message: "Pending check is not resolved.", severity: "error" });
          return { ...report, errors: deduplicateVoyageResolutionIssues(report.errors) };
        }
        const degreeSlug = p.result?.degreeOfSuccessSlug;
        branch = degreeSlug || "failure";
      }

      // Assemble branchEffectIds preserving sparse own indexes
      const branchRefs = def.branches && Object.hasOwn(def.branches, branch) ? def.branches[branch] : [];
      const branchEffectIds = clonePlainData(branchRefs || []);
      const riskBidEffectIds = [];

      const intentIds = [];
      // For each own index in branchRefs, create intents
      for (let idx = 0; idx < (branchRefs ? branchRefs.length : 0); idx += 1) {
        if (!Object.hasOwn(branchRefs, idx)) continue;
        const effectId = branchRefs[idx];
        if (!effectId) continue;
        // find effect rule
        const rule = (def.effectRules || []).find((r) => r && r.effectId === effectId);
        if (!rule) continue;
        const intentId = `arcflight-intent:${JSON.stringify([state.encounterId, state.currentStage?.stageId, state.roundNumber, sequence, "branch", idx, effectId])}`;
        const intent = {
          intentId,
          encounterId: state.encounterId,
          stageId: state.currentStage?.stageId,
          roundNumber: state.roundNumber,
          sequence,
          stationId,
          actionId,
          mode: req.mode,
          branch,
          riskBidId,
          activationSource: "branch",
          referenceIndex: idx,
          effectId,
          intentType: rule.intentType,
          timing: rule.timing,
          visibility: rule.visibility,
          target: clonePlainData(rule.target),
          selectedTarget: clonePlainData(req.target ?? null),
          payload: clonePlainData(rule.payload)
        };
        report.intents.push(intent);
        intentIds.push(intentId);
      }

      const actionRecord = {
        sequence,
        stationId,
        actionId,
        mode: req.mode,
        branch,
        riskBidId,
        branchEffectIds,
        riskBidEffectIds,
        intentIds
      };

      report.actions.push(actionRecord);
    }

    report.interpretedActionCount = report.actions.length;
    report.intentCount = report.intents.length;

    return report;
  } catch (e) {
    return { structurallyValid: false, definitionsValid: false, pendingChecksValid: false, resolutionComplete: false, active: false, consequences: false, readyForInterpretation: false, actionCount: 0, interpretedActionCount: 0, checkActionCount: 0, noRollActionCount: 0, intentCount: 0, actions: [], intents: [], errors: [{ code: "interpretation-failed", path: "$", message: "Action outcome interpretation failed.", severity: "error" }], warnings: [] };
  }
}

// Note: only named export `analyzeVoyageEncounterActionOutcomes` is provided.
