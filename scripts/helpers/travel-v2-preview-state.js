import {
  previewTravelV2RunnerCurrentRoundOutcomePressure,
  previewTravelV2RunnerRoundOutcomePressure
} from "./travel-v2-runner-bridge.js";
import { TRAVEL_V2_ROUND_OUTCOME_KEYS } from "./travel-v2-round-pressure-adapter.js";

export const TRAVEL_V2_PREVIEW_STATE_VERSION = 1;

export const TRAVEL_V2_PREVIEW_OUTCOME_ORDER = Object.freeze([
  TRAVEL_V2_ROUND_OUTCOME_KEYS.CRITICAL_SUCCESS,
  TRAVEL_V2_ROUND_OUTCOME_KEYS.SUCCESS,
  TRAVEL_V2_ROUND_OUTCOME_KEYS.MIXED,
  TRAVEL_V2_ROUND_OUTCOME_KEYS.FAILURE,
  TRAVEL_V2_ROUND_OUTCOME_KEYS.CRITICAL_FAILURE
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pressureSummaryText(summary = {}) {
  const totals = isPlainObject(summary.totalsByPressureType) ? summary.totalsByPressureType : {};
  const entries = Object.entries(totals).filter(([, amount]) => Number(amount) !== 0);
  if (entries.length === 0) return "No Travel v2 pressure change.";
  return entries.map(([pressureType, amount]) => `+${amount} ${humanizeIdentifier(pressureType)}`).join(", ");
}

function previewResultToRow(preview = {}) {
  const outcomeKey = preview.outcomeKey ?? TRAVEL_V2_ROUND_OUTCOME_KEYS.SKIPPED;
  return {
    outcomeKey,
    outcomeLabel: humanizeIdentifier(outcomeKey),
    ok: preview.ok === true,
    requestCount: preview.summary?.requestCount ?? 0,
    hasRequests: preview.summary?.hasRequests === true,
    requests: Array.isArray(preview.requests) ? preview.requests : [],
    totalsByPressureType: isPlainObject(preview.summary?.totalsByPressureType) ? preview.summary.totalsByPressureType : {},
    summaryText: preview.ok === true ? pressureSummaryText(preview.summary) : "Travel v2 pressure preview unavailable.",
    errors: Array.isArray(preview.errors) ? preview.errors : []
  };
}

export function prepareTravelV2RunnerRoundPreviewState(sessionInput = {}, roundIndex = null, options = {}) {
  const rows = TRAVEL_V2_PREVIEW_OUTCOME_ORDER.map((outcomeKey) => previewResultToRow(
    previewTravelV2RunnerRoundOutcomePressure(sessionInput, roundIndex, outcomeKey, options)
  ));
  const firstError = rows.flatMap((row) => row.errors)[0] ?? "";
  const roundPreview = previewTravelV2RunnerRoundOutcomePressure(sessionInput, roundIndex, TRAVEL_V2_ROUND_OUTCOME_KEYS.SKIPPED, options);
  return {
    version: TRAVEL_V2_PREVIEW_STATE_VERSION,
    ok: rows.every((row) => row.ok),
    roundIndex: roundPreview.roundIndex ?? -1,
    roundNumber: roundPreview.roundNumber ?? null,
    hasPreview: rows.some((row) => row.ok),
    rows,
    errors: firstError ? [firstError] : [],
    summaryText: rows.map((row) => `${row.outcomeLabel}: ${row.summaryText}`).join(" | ")
  };
}

export function prepareTravelV2RunnerCurrentRoundPreviewState(sessionInput = {}, options = {}) {
  const rows = TRAVEL_V2_PREVIEW_OUTCOME_ORDER.map((outcomeKey) => previewResultToRow(
    previewTravelV2RunnerCurrentRoundOutcomePressure(sessionInput, outcomeKey, options)
  ));
  const firstPreview = previewTravelV2RunnerCurrentRoundOutcomePressure(sessionInput, TRAVEL_V2_ROUND_OUTCOME_KEYS.SKIPPED, options);
  const firstError = rows.flatMap((row) => row.errors)[0] ?? "";
  return {
    version: TRAVEL_V2_PREVIEW_STATE_VERSION,
    ok: rows.every((row) => row.ok),
    roundIndex: firstPreview.roundIndex ?? -1,
    roundNumber: firstPreview.roundNumber ?? null,
    hasPreview: rows.some((row) => row.ok),
    rows,
    errors: firstError ? [firstError] : [],
    summaryText: rows.map((row) => `${row.outcomeLabel}: ${row.summaryText}`).join(" | ")
  };
}
