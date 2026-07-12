export const TRAVEL_V2_RISK_BID_MODEL_VERSION = 1;
export const TRAVEL_V2_RISK_BID_TIERS = Object.freeze([2, 5, 8]);

const EMPTY_RESULT = Object.freeze([]);

function clonePlain(value) {
  if (!value || typeof value !== "object") return {};
  return JSON.parse(JSON.stringify(value));
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function freezeRiskBidOutput(value) {
  if (Array.isArray(value)) {
    for (const entry of value) freezeRiskBidOutput(entry);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) freezeRiskBidOutput(entry);
  }
  return Object.freeze(value);
}

export function normalizeTravelV2RiskBidTier(value) {
  let normalized = null;
  if (typeof value === "number" && Number.isInteger(value)) {
    normalized = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\+?(2|5|8)$/.test(trimmed)) normalized = Number(trimmed.replace("+", ""));
  }
  return TRAVEL_V2_RISK_BID_TIERS.includes(normalized) ? normalized : null;
}

export function isTravelV2RiskBidTier(value) {
  return normalizeTravelV2RiskBidTier(value) !== null;
}

export function prepareTravelV2RiskBidOptionsForStationAction(input = {}, options = {}) {
  const blockedReasons = [];
  const riskBids = Array.isArray(input?.riskBids) ? input.riskBids : EMPTY_RESULT;
  if (riskBids.length === 0) blockedReasons.push("no-risk-bids-authored");

  const seen = new Set();
  const preparedOptions = [];
  for (const bid of riskBids) {
    const tier = normalizeTravelV2RiskBidTier(bid?.tier);
    if (!tier || seen.has(tier)) continue;
    seen.add(tier);
    preparedOptions.push({
      tier,
      dcModifier: tier,
      label: safeString(bid?.label) || `+${tier} Risk Bid`,
      text: safeString(bid?.text),
      isAllowed: true
    });
  }

  if (preparedOptions.length === 0 && !blockedReasons.includes("no-valid-risk-bids")) blockedReasons.push("no-valid-risk-bids");

  const result = {
    version: TRAVEL_V2_RISK_BID_MODEL_VERSION,
    hasRiskBids: preparedOptions.length > 0,
    stationKey: safeString(input?.stationKey),
    stationName: safeString(input?.stationName),
    actionId: safeString(input?.actionId),
    actionName: safeString(input?.actionName),
    options: preparedOptions,
    blockedReasons
  };
  void options;
  return freezeRiskBidOutput(result);
}

function normalizeRoundSelection(selection) {
  const hasRoundIndex = Number.isInteger(selection?.roundIndex);
  const hasRoundNumber = Number.isInteger(selection?.roundNumber);
  return {
    hasRound: hasRoundIndex || hasRoundNumber,
    roundIndex: hasRoundIndex ? selection.roundIndex : null,
    roundNumber: hasRoundNumber ? selection.roundNumber : null
  };
}

function riskBidRecordKey(record) {
  const roundPart = Number.isInteger(record?.roundIndex) ? `i:${record.roundIndex}` : `n:${record?.roundNumber}`;
  return `${roundPart}|${record?.stationKey}|${record?.actionId}`;
}

function validateSessionSelection(selection, requireTier = false) {
  const blockedReasons = [];
  const stationKey = safeString(selection?.stationKey);
  const actionId = safeString(selection?.actionId);
  const round = normalizeRoundSelection(selection);
  const tier = normalizeTravelV2RiskBidTier(selection?.tier);
  if (!stationKey) blockedReasons.push("missing-station-key");
  if (!actionId) blockedReasons.push("missing-action-id");
  if (!round.hasRound) blockedReasons.push("missing-round");
  if (requireTier && !tier) blockedReasons.push("invalid-risk-bid-tier");
  return { blockedReasons, stationKey, actionId, round, tier };
}

function sanitizeRiskBidSelectionRecord(record) {
  const tier = normalizeTravelV2RiskBidTier(record?.tier);
  const stationKey = safeString(record?.stationKey);
  const actionId = safeString(record?.actionId);
  const round = normalizeRoundSelection(record);

  if (!tier || !stationKey || !actionId || !round.hasRound) return null;

  return {
    version: TRAVEL_V2_RISK_BID_MODEL_VERSION,
    selected: record?.selected !== false,
    roundIndex: round.roundIndex,
    roundNumber: round.roundNumber,
    stationKey,
    actionId,
    tier,
    dcModifier: tier,
    selectedAt: safeString(record?.selectedAt)
  };
}

function ensureSelectionContainer(session) {
  const cloned = clonePlain(session);
  const existing = cloned.travelV2RiskBidSelections && typeof cloned.travelV2RiskBidSelections === "object"
    ? cloned.travelV2RiskBidSelections
    : {};
  const rawRecords = Array.isArray(existing.records) ? existing.records : [];
  const sanitizedRecords = rawRecords
    .map((record) => sanitizeRiskBidSelectionRecord(record))
    .filter(Boolean);
  cloned.travelV2RiskBidSelections = {
    version: TRAVEL_V2_RISK_BID_MODEL_VERSION,
    records: sanitizedRecords
  };
  return cloned;
}

export function selectTravelV2RiskBidForRunnerSession(session, selection = {}, options = {}) {
  const validation = validateSessionSelection(selection, true);
  const cloned = ensureSelectionContainer(session);
  if (validation.blockedReasons.length > 0) {
    return { ok: false, selected: false, session: cloned, selectionRecord: null, blockedReasons: validation.blockedReasons, error: validation.blockedReasons[0] };
  }

  const selectedAt = safeString(options?.selectedAt) || (typeof options?.now === "function" ? safeString(options.now()) : safeString(options?.now)) || new Date().toISOString();
  const selectionRecord = {
    version: TRAVEL_V2_RISK_BID_MODEL_VERSION,
    selected: true,
    roundIndex: validation.round.roundIndex,
    roundNumber: validation.round.roundNumber,
    stationKey: validation.stationKey,
    actionId: validation.actionId,
    tier: validation.tier,
    dcModifier: validation.tier,
    selectedAt
  };
  const key = riskBidRecordKey(selectionRecord);
  cloned.travelV2RiskBidSelections.records = cloned.travelV2RiskBidSelections.records.filter((record) => riskBidRecordKey(record) !== key);
  cloned.travelV2RiskBidSelections.records.push(selectionRecord);
  return { ok: true, selected: true, session: cloned, selectionRecord, blockedReasons: [], error: null };
}

export function clearTravelV2RiskBidSelectionForRunnerSession(session, selection = {}, options = {}) {
  const validation = validateSessionSelection(selection, false);
  const cloned = ensureSelectionContainer(session);
  if (validation.blockedReasons.length > 0) {
    return { ok: false, cleared: false, session: cloned, clearedRecord: null, blockedReasons: validation.blockedReasons, error: validation.blockedReasons[0] };
  }

  const target = { roundIndex: validation.round.roundIndex, roundNumber: validation.round.roundNumber, stationKey: validation.stationKey, actionId: validation.actionId };
  const key = riskBidRecordKey(target);
  let clearedRecord = null;
  cloned.travelV2RiskBidSelections.records = cloned.travelV2RiskBidSelections.records.filter((record) => {
    if (riskBidRecordKey(record) !== key) return true;
    clearedRecord = record;
    return false;
  });
  void options;
  return { ok: true, cleared: Boolean(clearedRecord), session: cloned, clearedRecord, blockedReasons: [], error: null };
}

function safeRiskBidNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && Number.isFinite(number) ? number : null;
}

function sanitizeRiskBidSelectionForRunnerState(record) {
  const tier = normalizeTravelV2RiskBidTier(record?.tier);
  const stationKey = safeString(record?.stationKey);
  const actionId = safeString(record?.actionId);
  const roundIndex = safeRiskBidNumber(record?.roundIndex);
  const roundNumber = safeRiskBidNumber(record?.roundNumber);
  if (!tier || !stationKey || !actionId || (roundIndex == null && roundNumber == null)) return null;
  return {
    version: TRAVEL_V2_RISK_BID_MODEL_VERSION,
    selected: record?.selected !== false,
    roundIndex,
    roundNumber,
    stationKey,
    actionId,
    tier,
    dcModifier: tier,
    selectedAt: safeString(record?.selectedAt)
  };
}

function riskBidContextMatchesRecord(record, context) {
  if (!record || record.selected === false) return false;
  if (record.stationKey !== context.stationKey || record.actionId !== context.actionId) return false;
  if (context.roundIndex != null && record.roundIndex === context.roundIndex) return true;
  if (context.roundNumber != null && record.roundNumber === context.roundNumber) return true;
  return false;
}

function normalizeRiskBidRunnerContext(session, options = {}) {
  const source = options.travelV2RiskBidContext && typeof options.travelV2RiskBidContext === "object" ? options.travelV2RiskBidContext : null;
  const stationKey = safeString(source?.stationKey);
  const actionId = safeString(source?.actionId);
  const sourceHasRoundIndex = source ? Object.hasOwn(source, "roundIndex") : false;
  const sourceHasRoundNumber = source ? Object.hasOwn(source, "roundNumber") : false;
  const roundIndex = safeRiskBidNumber(sourceHasRoundIndex ? source.roundIndex : session?.currentRoundIndex);
  const roundNumber = safeRiskBidNumber(sourceHasRoundNumber ? source.roundNumber : (roundIndex == null ? null : roundIndex + 1));
  if (!source || !stationKey || !actionId) return { ok: false, blockedReasons: ["missing-station-action-context"], context: { roundIndex, roundNumber, stationKey: "", stationName: "", actionId: "", actionName: "", riskBids: [] } };
  const blockedReasons = roundIndex == null && roundNumber == null ? ["missing-round-context"] : [];
  return {
    ok: true,
    blockedReasons,
    context: {
      roundIndex,
      roundNumber,
      stationKey,
      stationName: safeString(source.stationName),
      actionId,
      actionName: safeString(source.actionName),
      riskBids: Array.isArray(source.riskBids) ? source.riskBids : []
    }
  };
}

export function prepareTravelV2RiskBidRunnerState(session = null, options = {}) {
  const normalized = normalizeRiskBidRunnerContext(session, options);
  const prepared = normalized.ok
    ? prepareTravelV2RiskBidOptionsForStationAction(normalized.context)
    : prepareTravelV2RiskBidOptionsForStationAction(normalized.context);
  const blockedReasons = Array.from(new Set([...(prepared.blockedReasons ?? []), ...normalized.blockedReasons]));
  const records = Array.isArray(session?.travelV2RiskBidSelections?.records) ? session.travelV2RiskBidSelections.records : [];
  const selectedRecord = normalized.ok
    ? records.map((record) => sanitizeRiskBidSelectionForRunnerState(record)).find((record) => riskBidContextMatchesRecord(record, normalized.context)) ?? null
    : null;
  return freezeRiskBidOutput({
    version: TRAVEL_V2_RISK_BID_MODEL_VERSION,
    hasRiskBids: prepared.hasRiskBids === true,
    stationKey: prepared.stationKey,
    stationName: prepared.stationName,
    actionId: prepared.actionId,
    actionName: prepared.actionName,
    roundIndex: normalized.context?.roundIndex ?? null,
    roundNumber: normalized.context?.roundNumber ?? null,
    options: prepared.options.map((option) => ({ ...option })),
    selected: Boolean(selectedRecord),
    selectedTier: selectedRecord?.tier ?? null,
    selectedDcModifier: selectedRecord?.dcModifier ?? null,
    selectedRecord,
    blockedReasons
  });
}
