import { prepareTravelV2RoundFinalizationState } from "./travel-v2-round-finalization-state.js";
import { TRAVEL_V2_ALPHA_CORE_STATION_KEYS, checkTravelV2StationActionLockInReady } from "./travel-v2-station-action-lock-in.js";

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


function currentRoundLockInSource(session = {}) {
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  const roundIndex = Number.isInteger(Number(session?.currentRoundIndex)) ? Math.min(Math.max(Number(session.currentRoundIndex), 0), Math.max(rounds.length - 1, 0)) : 0;
  const round = rounds[roundIndex] && typeof rounds[roundIndex] === "object" && !Array.isArray(rounds[roundIndex]) ? rounds[roundIndex] : {};
  const roundResult = Array.isArray(session?.roundResults) && session.roundResults[roundIndex] && typeof session.roundResults[roundIndex] === "object" && !Array.isArray(session.roundResults[roundIndex]) ? session.roundResults[roundIndex] : {};
  const stationOrder = Array.from(new Set([
    ...(Array.isArray(round.activeStations) ? round.activeStations : []),
    ...TRAVEL_V2_ALPHA_CORE_STATION_KEYS
  ].filter((key) => typeof key === "string" && key.trim()).map((key) => key.trim())));
  const actions = isPlainObject(roundResult.stationActions) ? roundResult.stationActions : {};
  const commitments = isPlainObject(roundResult.stationOrderCommitments) ? roundResult.stationOrderCommitments : {};
  const stationKeys = Array.from(new Set([...stationOrder, ...Object.keys(actions), ...Object.keys(commitments)]));
  const stations = {};
  for (const stationKey of stationKeys) {
    const action = isPlainObject(actions[stationKey]) ? actions[stationKey] : {};
    const commitment = isPlainObject(commitments[stationKey]) ? commitments[stationKey] : {};
    stations[stationKey] = {
      ...cloneData(action),
      actionKey: action.actionKey ?? action.key ?? action.type ?? action.action ?? "",
      label: action.label ?? action.actionLabel ?? action.name ?? "",
      locked: commitment.committed === true || commitment.locked === true || action.locked === true
    };
  }
  return { stationOrder, activeStations: stationOrder, stations };
}

function formatLockInGuardMessage(entry = {}) {
  const stationKey = typeof entry?.stationKey === "string" && entry.stationKey ? entry.stationKey : "unknown";
  switch (entry?.code) {
    case "invalidStationKey": return `Invalid required station key for Travel v2 round resolution: ${stationKey}.`;
    case "missingRequiredStation": return `Required Travel Five station is missing before round resolution: ${stationKey}.`;
    case "missingStationAction": return `Required Travel Five station has no selected action before round resolution: ${stationKey}.`;
    case "stationActionUnlocked": return `Required Travel Five station action is not locked before round resolution: ${stationKey}.`;
    case "resolveBeforeLockIn": return "Station action lock-in is not ready: all required Travel Five station actions must be selected and locked before round resolution.";
    default: return typeof entry?.message === "string" && entry.message.trim() ? entry.message.trim() : "Station action lock-in is not ready for round resolution.";
  }
}

export function inspectTravelV2StationActionLockInFinalizationGuard(session = {}, options = {}) {
  const source = currentRoundLockInSource(session);
  const readiness = checkTravelV2StationActionLockInReady(source, { ...options, requiredStationKeys: TRAVEL_V2_ALPHA_CORE_STATION_KEYS, stationOrder: source.stationOrder });
  const gmMessages = Array.from(new Set((readiness.validationErrors ?? []).map(formatLockInGuardMessage)));
  const ready = readiness.ready === true && gmMessages.length === 0;
  return {
    ready,
    gmMessage: ready ? "Station action lock-in is ready for round resolution." : (gmMessages[0] ?? "Station action lock-in is not ready for round resolution."),
    playerMessage: ready ? "Station actions are ready for round resolution." : "Round resolution is waiting for all required station actions to be selected and locked.",
    blockedReasons: ready ? [] : gmMessages,
    playerBlockedReasons: ready ? [] : ["Round resolution is waiting for all required station actions to be selected and locked."]
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

  const lockInGuard = inspectTravelV2StationActionLockInFinalizationGuard(session, options);
  if (lockInGuard.ready !== true) {
    return {
      ...blockedResult(session, { ...finalizationStateBefore, blockedReasons: lockInGuard.blockedReasons }, lockInGuard.gmMessage),
      stationActionLockInReady: false,
      gmMessage: lockInGuard.gmMessage,
      playerMessage: lockInGuard.playerMessage,
      playerBlockedReasons: lockInGuard.playerBlockedReasons
    };
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
