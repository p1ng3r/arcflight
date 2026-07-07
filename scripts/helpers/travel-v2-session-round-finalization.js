import { prepareTravelV2RoundFinalizationState } from "./travel-v2-round-finalization-state.js";
import { TRAVEL_V2_ALPHA_CORE_STATION_KEYS, checkTravelV2StationActionLockInReady } from "./travel-v2-station-action-lock-in.js";

export const TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION = 1;
export const TRAVEL_V2_STATION_ACTION_RESOLUTION_SUMMARY_VERSION = 1;
export const TRAVEL_V2_STATION_ACTION_EFFECTS_VERSION = 1;

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

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeKey(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) ? trimmed : "";
}

function stationLabel(round = {}, stationKey = "") {
  const prompt = isPlainObject(round?.stationPrompts?.[stationKey]) ? round.stationPrompts[stationKey] : {};
  return optionalString(prompt.stationName)
    ?? optionalString(prompt.stationLabel)
    ?? optionalString(prompt.label)
    ?? humanizeIdentifier(stationKey);
}

function actionLabel(action = {}, actionKey = "") {
  return optionalString(action.label)
    ?? optionalString(action.actionLabel)
    ?? optionalString(action.name)
    ?? humanizeIdentifier(actionKey || "station-action");
}

function isSupportActionSummaryRow(row = {}) {
  return row?.selectedActionKey === "support" || row?.selectedActionType === "support";
}

function buildSafeSupportWarning(sourceStationLabel = "Station") {
  return `${sourceStationLabel} selected Support, but no valid target station was available; no Support effect was recorded.`;
}

export function prepareTravelV2StationActionSupportEffects(stationActionSummary = {}) {
  const stations = Array.isArray(stationActionSummary?.stations) ? stationActionSummary.stations : [];
  const activeStationKeys = new Set(TRAVEL_V2_ALPHA_CORE_STATION_KEYS);
  const stationLabels = new Map(stations
    .filter((row) => activeStationKeys.has(row?.stationKey))
    .map((row) => [row.stationKey, optionalString(row.stationLabel) ?? humanizeIdentifier(row.stationKey)]));
  const effects = [];
  const warnings = [];
  for (const row of stations) {
    const sourceStationKey = safeKey(row?.stationKey);
    if (!activeStationKeys.has(sourceStationKey) || !isSupportActionSummaryRow(row)) continue;
    const sourceStationLabel = stationLabels.get(sourceStationKey) ?? humanizeIdentifier(sourceStationKey);
    const targetStationKey = safeKey(row?.targetStationKey);
    const targetStationLabel = stationLabels.get(targetStationKey);
    if (!targetStationKey || !activeStationKeys.has(targetStationKey) || targetStationKey === sourceStationKey || !targetStationLabel) {
      warnings.push(buildSafeSupportWarning(sourceStationLabel));
      continue;
    }
    effects.push({
      sourceStationKey,
      sourceStationLabel,
      targetStationKey,
      targetStationLabel,
      effectKey: "support",
      effectType: "support",
      effectLabel: `${sourceStationLabel} supports ${targetStationLabel}.`,
      roundIndex: Number.isInteger(Number(stationActionSummary.roundIndex)) ? Number(stationActionSummary.roundIndex) : (Number.isInteger(Number(row?.roundIndex)) ? Number(row.roundIndex) : null),
      roundNumber: stationActionSummary.roundNumber ?? row?.roundNumber ?? null,
      playerSafe: true,
      readOnly: true
    });
  }
  return {
    version: TRAVEL_V2_STATION_ACTION_EFFECTS_VERSION,
    roundIndex: Number.isInteger(Number(stationActionSummary?.roundIndex)) ? Number(stationActionSummary.roundIndex) : null,
    roundNumber: stationActionSummary?.roundNumber ?? null,
    effects,
    warnings,
    hasEffects: effects.length > 0,
    playerSafe: true,
    readOnly: true
  };
}

function recordsFromContainer(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
}

function createRoundResolutionRecord(finalizationState = {}, options = {}) {
  const supportEffects = isPlainObject(finalizationState.stationActionSupportEffects) ? finalizationState.stationActionSupportEffects : null;
  const record = {
    roundIndex: finalizationState.roundIndex,
    roundNumber: finalizationState.roundNumber,
    finalizedAt: timestampFromOptions(options),
    helperVersion: TRAVEL_V2_SESSION_ROUND_FINALIZATION_VERSION,
    lifecycleState: "finalized",
    effectiveOutcomeKey: finalizationState.effectiveOutcomeKey,
    pressureApplicationRecord: cloneData(finalizationState.pressureApplicationRecord),
    correctionRecord: finalizationState.correctionRecord ? cloneData(finalizationState.correctionRecord) : null,
    stationSummary: finalizationState.stationSummary ? cloneData(finalizationState.stationSummary) : null,
    stationActionSummary: finalizationState.stationActionSummary ? cloneData(finalizationState.stationActionSummary) : null,
    stationActionSupportEffects: supportEffects ? cloneData(supportEffects) : null,
    stationActionEffects: supportEffects ? cloneData(supportEffects.effects ?? []) : []
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

export function prepareTravelV2StationActionResolutionSummary(session = {}, options = {}) {
  const rounds = Array.isArray(session?.event?.rounds) ? session.event.rounds : [];
  const roundIndex = Number.isInteger(Number(options.roundIndex))
    ? Number(options.roundIndex)
    : (Number.isInteger(Number(session?.currentRoundIndex)) ? Number(session.currentRoundIndex) : 0);
  const boundedRoundIndex = rounds.length > 0 ? Math.min(Math.max(roundIndex, 0), rounds.length - 1) : Math.max(roundIndex, 0);
  const round = isPlainObject(rounds[boundedRoundIndex]) ? rounds[boundedRoundIndex] : {};
  const roundResult = Array.isArray(session?.roundResults) && isPlainObject(session.roundResults[boundedRoundIndex]) ? session.roundResults[boundedRoundIndex] : {};
  const source = currentRoundLockInSource({ ...session, currentRoundIndex: boundedRoundIndex });
  const activeStationKeys = new Set(source.stationOrder);
  const stations = TRAVEL_V2_ALPHA_CORE_STATION_KEYS.map((stationKey) => {
    const action = isPlainObject(roundResult.stationActions?.[stationKey]) ? roundResult.stationActions[stationKey] : {};
    const commitment = isPlainObject(roundResult.stationOrderCommitments?.[stationKey]) ? roundResult.stationOrderCommitments[stationKey] : {};
    const selectedActionKey = safeKey(action.actionKey ?? action.key ?? action.action ?? action.type);
    const selectedActionType = safeKey(action.type ?? action.actionType ?? selectedActionKey);
    const targetStationKey = safeKey(action.targetStationKey ?? action.targetStation ?? "");
    const hasTarget = targetStationKey && activeStationKeys.has(targetStationKey);
    return {
      stationKey,
      stationLabel: stationLabel(round, stationKey),
      selectedActionKey,
      selectedActionType,
      selectedActionLabel: actionLabel(action, selectedActionKey || selectedActionType),
      targetStationKey: hasTarget ? targetStationKey : "",
      targetStationLabel: hasTarget ? stationLabel(round, targetStationKey) : "",
      locked: commitment.committed === true || commitment.locked === true || action.locked === true,
      committed: commitment.committed === true || commitment.locked === true || action.locked === true,
      roundIndex: boundedRoundIndex,
      roundNumber: round.roundNumber ?? round.number ?? boundedRoundIndex + 1
    };
  });
  return {
    version: TRAVEL_V2_STATION_ACTION_RESOLUTION_SUMMARY_VERSION,
    roundIndex: boundedRoundIndex,
    roundNumber: round.roundNumber ?? round.number ?? boundedRoundIndex + 1,
    stations,
    stationCount: stations.length,
    playerSafe: true
  };
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
  const stationActionSummary = prepareTravelV2StationActionResolutionSummary(session, { ...options, roundIndex: finalizationStateBefore.roundIndex });
  const stationActionSupportEffects = prepareTravelV2StationActionSupportEffects(stationActionSummary);
  const roundResolutionRecord = createRoundResolutionRecord({ ...finalizationStateBefore, stationActionSummary, stationActionSupportEffects }, options);
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
    finalizationStateAfter,
    stationActionSummary: cloneData(stationActionSummary),
    stationActionSupportEffects: cloneData(stationActionSupportEffects),
    stationActionEffects: cloneData(stationActionSupportEffects.effects),
    stationActionEffectWarnings: cloneData(stationActionSupportEffects.warnings)
  };
}

export default finalizeTravelV2RoundOnRunnerSession;
