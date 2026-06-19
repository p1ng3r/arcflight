export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION = 1;

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

function normalizeOutcomeTone(row = {}) {
  const outcomeKey = String(row.outcomeKey ?? "");
  if (outcomeKey === "criticalSuccess" || outcomeKey === "success") return "safe";
  if (outcomeKey === "mixed") return "warning";
  if (outcomeKey === "failure") return "danger";
  if (outcomeKey === "criticalFailure") return "severe";
  return row.hasRequests ? "warning" : "neutral";
}

function normalizePreviewRow(row = {}) {
  const outcomeKey = String(row.outcomeKey ?? "skipped");
  const totals = isPlainObject(row.totalsByPressureType) ? row.totalsByPressureType : {};
  const pressureChips = Object.entries(totals)
    .filter(([, amount]) => Number(amount) !== 0)
    .map(([pressureType, amount]) => ({
      pressureType,
      label: humanizeIdentifier(pressureType),
      amount: Number(amount),
      displayAmount: `${Number(amount) > 0 ? "+" : ""}${Number(amount)}`
    }));
  return {
    outcomeKey,
    outcomeLabel: row.outcomeLabel || humanizeIdentifier(outcomeKey),
    tone: normalizeOutcomeTone(row),
    ok: row.ok === true,
    requestCount: Number(row.requestCount) || pressureChips.length,
    hasRequests: row.hasRequests === true || pressureChips.length > 0,
    summaryText: typeof row.summaryText === "string" && row.summaryText.trim() ? row.summaryText.trim() : "No Travel v2 pressure change.",
    pressureChips,
    errors: Array.isArray(row.errors) ? row.errors : []
  };
}

export function prepareTravelEventRunnerV2PreviewPanelState(appState = {}) {
  const preview = isPlainObject(appState.travelV2Preview) ? appState.travelV2Preview : {};
  const rows = Array.isArray(preview.rows) ? preview.rows.map(normalizePreviewRow) : [];
  const available = preview.ok === true && rows.length > 0;
  return {
    version: TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION,
    available,
    title: "Travel v2 Pressure Preview",
    subtitle: available
      ? `Round ${preview.roundNumber ?? appState.currentRoundNumber ?? "?"} — read-only GM preview`
      : "Travel v2 preview unavailable for this runner state.",
    roundIndex: Number.isInteger(Number(preview.roundIndex)) ? Number(preview.roundIndex) : -1,
    roundNumber: preview.roundNumber ?? appState.currentRoundNumber ?? null,
    rows,
    hasPressureChanges: rows.some((row) => row.hasRequests),
    errors: Array.isArray(preview.errors) ? preview.errors : [],
    footerText: "Preview only. This does not apply pressure, mutate the runner, notify players, or change actors."
  };
}

export default prepareTravelEventRunnerV2PreviewPanelState;
