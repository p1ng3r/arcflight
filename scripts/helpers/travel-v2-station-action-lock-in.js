const ALPHA_STATION_KEYS = ["captain", "navigator", "engineer", "veilwarden", "watchmaster"];
const FORBIDDEN_PLAYER_SAFE_KEYS = ["auditRecord", "commitRecords", "userId", "userName", "gmText", "applyPayload", "targetActorUuid", "mutationScope", "internalMutation", "secret", "pendingConsequenceQueue", "gmOnly", "unrevealedHazard", "catalogSuggestions"];

function cloneData(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function humanizeIdentifier(value) {
  return String(value ?? "").replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRequiredStationKeys(options = {}) {
  const keys = Array.isArray(options.requiredStationKeys) && options.requiredStationKeys.length > 0 ? options.requiredStationKeys : ALPHA_STATION_KEYS;
  return keys.filter((key) => typeof key === "string" && key.trim());
}

function normalizeChoice(choice = {}, fallbackStationKey = "") {
  if (!isPlainObject(choice)) return null;
  const stationKey = typeof choice.stationKey === "string" && choice.stationKey ? choice.stationKey : fallbackStationKey;
  const actionKey = typeof choice.actionKey === "string" ? choice.actionKey : (typeof choice.type === "string" ? choice.type : "");
  if (!stationKey || !actionKey) return null;
  const actionLabel = typeof choice.actionLabel === "string" && choice.actionLabel.trim() ? choice.actionLabel.trim() : (typeof choice.label === "string" && choice.label.trim() ? choice.label.trim() : humanizeIdentifier(actionKey));
  return { stationKey, stationName: humanizeIdentifier(stationKey), actionKey, actionLabel, selected: true };
}

function readChoicesByStation(value = {}) {
  if (isPlainObject(value?.choicesByStation)) return value.choicesByStation;
  if (isPlainObject(value?.stationActionChoices)) return value.stationActionChoices;
  if (isPlainObject(value?.stationActions)) return value.stationActions;
  if (isPlainObject(value?.roundResult?.stationActions)) return value.roundResult.stationActions;
  if (isPlainObject(value)) return value;
  return {};
}

function readLocksByStation(value = {}) {
  if (isPlainObject(value?.locksByStation)) return value.locksByStation;
  if (isPlainObject(value?.stationActionLocks)) return value.stationActionLocks;
  if (isPlainObject(value?.stationOrderCommitments)) return value.stationOrderCommitments;
  if (isPlainObject(value?.roundResult?.stationOrderCommitments)) return value.roundResult.stationOrderCommitments;
  return {};
}

function normalizeLock(lock = {}) {
  if (!isPlainObject(lock)) return { locked: false };
  return { locked: lock.locked === true || lock.committed === true };
}

export function normalizeTravelV2StationActionChoices(value = {}, options = {}) {
  const requiredStationKeys = normalizeRequiredStationKeys(options);
  const choicesByStation = readChoicesByStation(value);
  const normalizedChoices = {};
  const invalidStationKeys = [];
  for (const [stationKey, choice] of Object.entries(choicesByStation)) {
    if (!requiredStationKeys.includes(stationKey)) {
      if (stationKey) invalidStationKeys.push(stationKey);
      continue;
    }
    const normalized = normalizeChoice(choice, stationKey);
    if (normalized) normalizedChoices[stationKey] = normalized;
  }
  return { requiredStationKeys, choicesByStation: normalizedChoices, invalidStationKeys };
}

export function selectTravelV2StationAction(state = {}, stationKey = "", action = {}, options = {}) {
  const normalized = normalizeTravelV2StationActionChoices(state, options);
  if (!normalized.requiredStationKeys.includes(stationKey)) return { ok: false, errors: [`Invalid station key: ${stationKey}.`], state: cloneData(state) ?? {} };
  const choice = normalizeChoice({ ...action, stationKey }, stationKey);
  if (!choice) return { ok: false, errors: [`Missing station action for ${stationKey}.`], state: cloneData(state) ?? {} };
  const nextState = cloneData(state) ?? {};
  nextState.choicesByStation = { ...(normalized.choicesByStation ?? {}), [stationKey]: choice };
  return { ok: true, errors: [], state: nextState };
}

export function lockTravelV2StationAction(state = {}, stationKey = "", options = {}) {
  const requiredStationKeys = normalizeRequiredStationKeys(options);
  if (!requiredStationKeys.includes(stationKey)) return { ok: false, errors: [`Invalid station key: ${stationKey}.`], state: cloneData(state) ?? {} };
  const nextState = cloneData(state) ?? {};
  nextState.locksByStation = { ...readLocksByStation(nextState), [stationKey]: { locked: true } };
  return { ok: true, errors: [], state: nextState };
}

export function unlockTravelV2StationAction(state = {}, stationKey = "", options = {}) {
  const requiredStationKeys = normalizeRequiredStationKeys(options);
  if (!requiredStationKeys.includes(stationKey)) return { ok: false, errors: [`Invalid station key: ${stationKey}.`], state: cloneData(state) ?? {} };
  const nextState = cloneData(state) ?? {};
  nextState.locksByStation = { ...readLocksByStation(nextState), [stationKey]: { locked: false } };
  return { ok: true, errors: [], state: nextState };
}

export function checkTravelV2StationActionLockInReady(state = {}, options = {}) {
  const requiredStationKeys = normalizeRequiredStationKeys(options);
  const activeStations = Array.isArray(state?.activeStations) ? state.activeStations : requiredStationKeys;
  const { choicesByStation, invalidStationKeys } = normalizeTravelV2StationActionChoices(state, { requiredStationKeys });
  const locksByStation = readLocksByStation(state);
  const rows = [];
  const validationMessages = [];
  for (const stationKey of requiredStationKeys) {
    const stationName = humanizeIdentifier(stationKey);
    const stationPresent = activeStations.includes(stationKey);
    const choice = choicesByStation[stationKey] ?? null;
    const locked = normalizeLock(locksByStation[stationKey]).locked;
    if (!stationPresent) validationMessages.push(`${stationName}: missing required station.`);
    if (!choice) validationMessages.push(`${stationName}: missing station action.`);
    if (choice && !locked) validationMessages.push(`${stationName}: station action must be locked before resolution.`);
    rows.push({ stationKey, stationName, stationPresent, actionKey: choice?.actionKey ?? "", actionLabel: choice?.actionLabel ?? "No action selected", hasAction: Boolean(choice), locked, lockState: locked ? "locked" : "unlocked", lockStateLabel: locked ? "Locked" : "Unlocked", readinessLabel: stationPresent && choice && locked ? "Ready" : "Not ready", message: !stationPresent ? "Missing required station." : (!choice ? "No action selected." : (!locked ? "Must be locked before resolution." : "Ready.")) });
  }
  for (const stationKey of invalidStationKeys) validationMessages.push(`${humanizeIdentifier(stationKey)}: invalid station key.`);
  const ready = rows.length === requiredStationKeys.length && rows.every((row) => row.stationPresent && row.hasAction && row.locked);
  if (!ready) validationMessages.push("Attempted resolution before lock-in: all required station actions must be selected and locked before resolution.");
  return { ready, ok: ready, requiredStationKeys, rows, validationMessages: Array.from(new Set(validationMessages)), blockedReasons: ready ? [] : ["Resolution requires all required station actions to be selected and locked."] };
}

export function preparePlayerSafeTravelV2StationActionLockState(state = {}, options = {}) {
  const readiness = checkTravelV2StationActionLockInReady(state, options);
  return { rows: readiness.rows, ready: readiness.ready, statusLabel: readiness.ready ? "Ready to resolve" : "Not ready to resolve", readinessText: readiness.ready ? "Ready to resolve: all required station actions are selected and locked." : "Not ready: all required station actions must be selected and locked before resolution.", validationMessages: readiness.validationMessages, hasValidationMessages: readiness.validationMessages.length > 0, blockedReason: readiness.ready ? "" : readiness.blockedReasons[0], requiredStationKeys: readiness.requiredStationKeys };
}

export function prepareGmTravelV2StationActionLockState(state = {}, options = {}) {
  return { ...preparePlayerSafeTravelV2StationActionLockState(state, options), canOverrideLocks: options.canOverrideLocks === true };
}

export function playerSafeTravelV2StationActionLockStateHasForbiddenKeys(state = {}) {
  const text = JSON.stringify(state ?? {});
  return FORBIDDEN_PLAYER_SAFE_KEYS.some((key) => text.includes(key));
}

export default {
  normalizeTravelV2StationActionChoices,
  selectTravelV2StationAction,
  lockTravelV2StationAction,
  unlockTravelV2StationAction,
  checkTravelV2StationActionLockInReady,
  preparePlayerSafeTravelV2StationActionLockState,
  prepareGmTravelV2StationActionLockState,
  playerSafeTravelV2StationActionLockStateHasForbiddenKeys
};
