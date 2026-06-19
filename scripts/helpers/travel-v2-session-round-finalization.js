import { prepareTravelV2RoundFinalizationState } from "./travel-v2-round-finalization-state.js";

export const TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION = 1;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function timestampFromOptions(options = {}) {
  for (const key of ["finalizedAt", "createdAt", "now"]) {
    const value = options[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value instanceof Date) return value.toISOString();
  }
  if (typeof options.now === "function") {
    const value = options.now();
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value instanceof Date) return value.toISOString();
  }
  return new Date().toISOString();
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordsFromContainer(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

function createRoundResolutionRecord(finalizationState = {}, options = {}) {
  const record = {
    roundIndex: finalizationState.roundIndex,
    roundNumber: finalizationState.roundNumber,
    finalizedAt: timestampFromOptions(options),
    helperVersion: TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION,
    lifecycleState: "finalized",
    effectiveOutcomeKey: finalizationState.effectiveOutcomeKey,
    pressureApplicationRecord: cloneData(finalizationState.pressureApplicationRecord),
    correctionRecord: finalizationState.correctionRecord ? cloneData(finalizationState.correctionRecord) : null,
    stationSummary: finalizationState.stationSummary ? cloneData(finalizationState.stationSummary) : null
  };
  const notes = optionalString(options.notes);
  const reason = optionalString(options.reason);
  if (notes !== undefined) record.notes = notes;
  if (reason !== undefined) record.reason = reason;
  return record;
}

function appendRoundResolutionRecord(session = {}, roundResolutionRecord = {}) {
  const existingContainer = session.travelV2RoundResolutions;
  const existingRecords = recordsFromContainer(existingContainer);
  return {
    ...session,
    travelV2RoundResolutions: {
      ...(isPlainObject(existingContainer) ? existingContainer : {}),
      records: [...cloneData(existingRecords), cloneData(roundResolutionRecord)]
    }
  };
}

function stateSummary(finalizationState = {}) {
  return {
    lifecycleState: finalizationState.lifecycleState,
    roundIndex: finalizationState.roundIndex,
    roundNumber: finalizationState.roundNumber,
    effectiveOutcomeKey: finalizationState.effectiveOutcomeKey,
    isEventCompleteReady: finalizationState.isEventCompleteReady === true
  };
}

function blockedResult(session, finalizationState = {}, error = "Travel v2 round finalization is blocked for this runner session.") {
  return {
    ok: false,
    finalized: false,
    session,
    blockedReasons: cloneData(finalizationState.blockedReasons ?? [error]),
    error,
    ...stateSummary(finalizationState)
  };
}

export function finalizeTravelV2RoundOnRunnerSession(session, options = {}) {
  const finalizationStateBefore = prepareTravelV2RoundFinalizationState(session, options);

  if (finalizationStateBefore.canFinalize !== true) {
    return blockedResult(session, finalizationStateBefore, finalizationStateBefore.blockedReasons[0]);
  }

  const clonedSession = cloneData(session);
  const roundResolutionRecord = createRoundResolutionRecord(finalizationStateBefore, options);
  const finalizedSession = appendRoundResolutionRecord(clonedSession, roundResolutionRecord);
  const finalizationStateAfter = prepareTravelV2RoundFinalizationState(finalizedSession, options);
  const lifecycleState = finalizationStateAfter.lifecycleState;

  return {
    ok: true,
    finalized: true,
    session: finalizedSession,
    roundResolutionRecord,
    lifecycleState,
    roundIndex: finalizationStateBefore.roundIndex,
    roundNumber: finalizationStateBefore.roundNumber,
    effectiveOutcomeKey: finalizationStateBefore.effectiveOutcomeKey,
    isEventCompleteReady: finalizationStateAfter.isEventCompleteReady === true,
    finalizationStateBefore,
    finalizationStateAfter
  };
}

export default finalizeTravelV2RoundOnRunnerSession;
