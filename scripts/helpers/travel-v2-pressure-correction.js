import { prepareTravelV2PressureApplicationState } from "./travel-v2-pressure-application-state.js";
import { applyTravelV2PressureToRunnerSession } from "./travel-v2-session-pressure-application.js";

export const TRAVEL_V2_PRESSURE_CORRECTION_VERSION = 1;

const ROUND_RECORD_KEYS = Object.freeze([
  "travelV2PressureApplication",
  "travelV2PressureApplicationRecord",
  "pressureApplication",
  "pressureApplicationRecord"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function selectedOutcomeKeyFromOptions(options = {}) {
  const value = options.correctedOutcomeKey ?? options.selectedOutcomeKey;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function createdAtFromOptions(options = {}) {
  if (typeof options.createdAt === "string" && options.createdAt.trim()) return options.createdAt.trim();
  if (typeof options.now === "string" && options.now.trim()) return options.now.trim();
  if (typeof options.now === "function") {
    const value = options.now();
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value instanceof Date) return value.toISOString();
  }
  return new Date().toISOString();
}

function roundMatches(record = {}, roundIndex, roundNumber) {
  if (!isPlainObject(record)) return false;
  if (Number.isInteger(Number(record.roundIndex)) && Number(record.roundIndex) === roundIndex) return true;
  return roundNumber != null && Number(record.roundNumber ?? record.round) === roundNumber;
}

function applicationRecordsFromSession(session = {}) {
  const container = session.travelV2PressureApplications;
  return Array.isArray(container) ? container : (Array.isArray(container?.records) ? container.records : []);
}

function blockedResult(session, blockedReasons, details = {}) {
  return {
    ok: false,
    corrected: false,
    session,
    blockedReasons: cloneData(blockedReasons),
    error: blockedReasons[0] ?? "Travel v2 pressure correction is blocked for this runner session.",
    ...details
  };
}

function validateTotals(totalsByPressureType) {
  if (!isPlainObject(totalsByPressureType)) return false;
  return Object.entries(totalsByPressureType).every(([pressureType, amount]) => (
    typeof pressureType === "string" && pressureType.trim() && Number.isInteger(Number(amount)) && Number(amount) >= 0
  ));
}

function reversePressureDeltas(clonedSession, originalApplicationRecord) {
  const totals = originalApplicationRecord?.totalsByPressureType;
  if (!validateTotals(totals)) {
    return { ok: false, blockedReasons: ["Original Travel v2 pressure application record does not include reversible pressure totals."] };
  }

  const pressure = cloneData(clonedSession.pressure ?? {});
  const reversed = {};
  for (const [pressureType, rawAmount] of Object.entries(totals)) {
    const amount = Number(rawAmount);
    if (amount === 0) continue;
    const track = pressure[pressureType];
    const currentValue = Number(track?.value ?? 0);
    const nextValue = currentValue - amount;
    if (!Number.isInteger(currentValue) || nextValue < 0) {
      return { ok: false, blockedReasons: [`Reversing ${pressureType} pressure would push the track below zero.`] };
    }
    const crossed = Array.isArray(track?.crossed) ? track.crossed.map((entry) => Number(entry)).filter(Number.isInteger) : [];
    if (crossed.some((threshold) => threshold > nextValue)) {
      return { ok: false, blockedReasons: [`Reversing ${pressureType} pressure would require unproven hazard draw or ship scar overflow reversal.`] };
    }
    pressure[pressureType] = { ...(isPlainObject(track) ? track : {}), value: nextValue, crossed };
    reversed[pressureType] = { previousValue: currentValue, reversedAmount: amount, value: nextValue };
  }

  return {
    ok: true,
    session: { ...clonedSession, pressure },
    summary: { totalsByPressureType: cloneData(totals), reversed }
  };
}

function removeCurrentRoundApplicationMarkers(session, roundIndex, roundNumber) {
  const rounds = Array.isArray(session.event?.rounds) ? session.event.rounds.map((round, index) => {
    if (index !== roundIndex || !isPlainObject(round)) return round;
    const nextRound = { ...round };
    for (const key of ROUND_RECORD_KEYS) delete nextRound[key];
    return nextRound;
  }) : session.event?.rounds;
  const existingContainer = session.travelV2PressureApplications;
  const keptRecords = applicationRecordsFromSession(session).filter((record) => !roundMatches(record, roundIndex, roundNumber));
  return {
    ...session,
    event: isPlainObject(session.event) ? { ...session.event, rounds } : session.event,
    travelV2PressureApplications: {
      ...(isPlainObject(existingContainer) ? existingContainer : {}),
      records: cloneData(keptRecords)
    }
  };
}

function withEffectiveApplicationRecord(session, applicationRecord, allRecords, roundIndex) {
  const rounds = Array.isArray(session.event?.rounds) ? session.event.rounds.map((round, index) => (
    index === roundIndex && isPlainObject(round) ? { ...round, travelV2PressureApplicationRecord: cloneData(applicationRecord) } : round
  )) : session.event?.rounds;
  return {
    ...session,
    event: isPlainObject(session.event) ? { ...session.event, rounds } : session.event,
    travelV2PressureApplications: {
      ...(isPlainObject(session.travelV2PressureApplications) ? session.travelV2PressureApplications : {}),
      records: cloneData(allRecords)
    }
  };
}

export function correctTravelV2PressureApplicationOnRunnerSession(session, options = {}) {
  const selectedOutcomeKey = selectedOutcomeKeyFromOptions(options);
  if (!isPlainObject(session)) {
    return blockedResult(session, ["No active Travel v2 runner session."], { selectedOutcomeKey, previousOutcomeKey: null });
  }

  const priorStateSelectedOutcomeKey = selectedOutcomeKey || "__missing-corrected-outcome__";
  const priorState = prepareTravelV2PressureApplicationState(session, { ...options, selectedOutcomeKey: priorStateSelectedOutcomeKey });
  const previousOutcomeKey = priorState.applicationRecord?.outcomeKey ?? null;
  const blockedReasons = [];

  if (!priorState.hasCurrentRound) blockedReasons.push("Travel v2 runner session has no current round.");
  if (!priorState.applicationRecord) blockedReasons.push("Current Travel v2 round has no pressure application record to correct.");
  if (!selectedOutcomeKey) blockedReasons.push("A corrected Travel v2 pressure outcome key is required.");
  if (selectedOutcomeKey && !priorState.rows.some((row) => row.outcomeKey === selectedOutcomeKey && row.ok === true)) blockedReasons.push(`Selected Travel v2 pressure correction outcome is not available: ${selectedOutcomeKey}.`);
  if (previousOutcomeKey && selectedOutcomeKey === previousOutcomeKey) blockedReasons.push("Corrected Travel v2 pressure outcome must be different from the prior applied outcome.");

  if (blockedReasons.length > 0) return blockedResult(session, blockedReasons, { selectedOutcomeKey, previousOutcomeKey });

  const clonedSession = cloneData(session);
  const reversal = reversePressureDeltas(clonedSession, priorState.applicationRecord);
  if (!reversal.ok) return blockedResult(session, reversal.blockedReasons, { selectedOutcomeKey, previousOutcomeKey, originalApplicationRecord: priorState.applicationRecord });

  const sessionForApply = removeCurrentRoundApplicationMarkers(reversal.session, priorState.roundIndex, priorState.roundNumber);
  const correctedApplicationResult = applyTravelV2PressureToRunnerSession(sessionForApply, { ...options, selectedOutcomeKey });
  if (correctedApplicationResult.ok !== true) {
    return blockedResult(session, correctedApplicationResult.blockedReasons ?? [correctedApplicationResult.error], { selectedOutcomeKey, previousOutcomeKey, originalApplicationRecord: priorState.applicationRecord });
  }

  const originalRecords = applicationRecordsFromSession(clonedSession);
  const correctedApplicationRecord = correctedApplicationResult.applicationRecord;
  const allRecords = [...cloneData(originalRecords), cloneData(correctedApplicationRecord)];
  const correctionRecord = {
    roundIndex: priorState.roundIndex,
    roundNumber: priorState.roundNumber,
    previousOutcomeKey,
    selectedOutcomeKey,
    correctedOutcomeKey: selectedOutcomeKey,
    reason: typeof options.reason === "string" ? options.reason : "",
    createdAt: createdAtFromOptions(options),
    helperVersion: TRAVEL_V2_PRESSURE_CORRECTION_VERSION,
    originalApplicationRecord: cloneData(priorState.applicationRecord),
    pressureDeltaReversal: cloneData(reversal.summary),
    correctedApplicationRecord: cloneData(correctedApplicationRecord)
  };
  const existingCorrections = Array.isArray(clonedSession.travelV2PressureCorrections?.records) ? clonedSession.travelV2PressureCorrections.records : [];
  const correctedSession = {
    ...withEffectiveApplicationRecord(correctedApplicationResult.session, correctedApplicationRecord, allRecords, priorState.roundIndex),
    travelV2PressureCorrections: {
      ...(isPlainObject(clonedSession.travelV2PressureCorrections) ? clonedSession.travelV2PressureCorrections : {}),
      records: [...cloneData(existingCorrections), cloneData(correctionRecord)]
    }
  };

  return {
    ok: true,
    corrected: true,
    session: correctedSession,
    originalApplicationRecord: cloneData(priorState.applicationRecord),
    correctionRecord,
    correctedApplicationResult,
    selectedOutcomeKey,
    previousOutcomeKey
  };
}

export default correctTravelV2PressureApplicationOnRunnerSession;
