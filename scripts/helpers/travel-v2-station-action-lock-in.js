const REQUIRED_STATION_KEYS = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAction(action, stationKey) {
  if (!isPlainObject(action) || !action.type) return null;
  const actionKey = typeof action.type === "string" ? action.type : "";
  const label = typeof action.label === "string" && action.label.trim()
    ? action.label.trim()
    : humanizeIdentifier(actionKey || stationKey);
  return { actionKey, actionLabel: label, type: actionKey };
}

export function getTravelV2RequiredStationActionLockInKeys() {
  return [...REQUIRED_STATION_KEYS];
}

export function prepareTravelV2StationActionLockInState(session = null, options = {}) {
  const requiredStationKeys = Array.isArray(options.requiredStationKeys) && options.requiredStationKeys.length > 0
    ? options.requiredStationKeys.filter((key) => typeof key === "string" && key.trim())
    : REQUIRED_STATION_KEYS;
  const roundIndex = Number.isInteger(Number(options.roundIndex)) ? Number(options.roundIndex) : Number(session?.currentRoundIndex ?? 0);
  const round = session?.event?.rounds?.[roundIndex] ?? null;
  const roundResult = session?.roundResults?.[roundIndex] ?? null;
  const activeStations = Array.isArray(round?.activeStations) ? round.activeStations : [];
  const stationActions = isPlainObject(roundResult?.stationActions) ? roundResult.stationActions : {};
  const stationOrderCommitments = isPlainObject(roundResult?.stationOrderCommitments) ? roundResult.stationOrderCommitments : {};
  const rows = [];
  const validationMessages = [];
  for (const stationKey of requiredStationKeys) {
    const stationName = humanizeIdentifier(stationKey);
    const stationPresent = activeStations.includes(stationKey) || Object.hasOwn(stationActions, stationKey) || Object.hasOwn(stationOrderCommitments, stationKey);
    const action = normalizeAction(stationActions[stationKey], stationKey);
    const commitment = isPlainObject(stationOrderCommitments[stationKey]) ? stationOrderCommitments[stationKey] : {};
    const locked = commitment.committed === true;
    if (!stationPresent) validationMessages.push(`${stationName}: missing required station.`);
    if (!action) validationMessages.push(`${stationName}: missing station action.`);
    if (action && !locked) validationMessages.push(`${stationName}: station action must be locked before resolution.`);
    rows.push({
      stationKey,
      stationName,
      stationPresent,
      actionKey: action?.actionKey ?? "",
      actionLabel: action?.actionLabel ?? "No action selected",
      hasAction: Boolean(action),
      locked,
      lockState: locked ? "locked" : "unlocked",
      lockStateLabel: locked ? "Locked" : "Unlocked",
      readinessLabel: stationPresent && action && locked ? "Ready" : "Not ready",
      message: !stationPresent ? "Missing required station." : (!action ? "No action selected." : (!locked ? "Must be locked before resolution." : "Ready."))
    });
  }
  for (const stationKey of [...Object.keys(stationActions), ...Object.keys(stationOrderCommitments)]) {
    if (stationKey && !requiredStationKeys.includes(stationKey)) validationMessages.push(`${humanizeIdentifier(stationKey)}: invalid station key for alpha station action lock-in.`);
  }
  const ready = rows.length === requiredStationKeys.length && rows.every((row) => row.stationPresent && row.hasAction && row.locked);
  if (!ready) validationMessages.push("Attempted resolution before lock-in: all required station actions must be selected and locked before resolution.");
  return {
    roundIndex,
    requiredStationKeys: [...requiredStationKeys],
    rows,
    ready,
    statusLabel: ready ? "Ready to resolve" : "Not ready to resolve",
    readinessText: ready ? "Ready to resolve: all required station actions are selected and locked." : "Not ready: all required station actions must be selected and locked before resolution.",
    validationMessages: Array.from(new Set(validationMessages)),
    hasValidationMessages: validationMessages.length > 0,
    blockedReason: ready ? "" : "Resolution requires all required station actions to be selected and locked."
  };
}

export function validateTravelV2StationActionLockInForResolution(session = null, options = {}) {
  const state = prepareTravelV2StationActionLockInState(session, options);
  return { ok: state.ready, ready: state.ready, blockedReasons: state.ready ? [] : [state.blockedReason, ...state.validationMessages], state };
}
