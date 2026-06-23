import { ARCFLIGHT_TRAVEL_STATION_ACTIONS } from "./travel-pressure.js";
import { sanitizeTravelV2PublicHazard, sanitizeTravelV2GmHazard } from "./travel-v2-hazards.js";

const RESULT_LABELS = Object.freeze({ criticalSuccess: "Critical Success", success: "Success", failure: "Failure", criticalFailure: "Critical Failure", skipped: "Skipped" });
const ACTION_LABELS = Object.freeze({ eventApproach: "Push Forward", stabilize: "Stabilize / Repair", hazardResponse: "Respond to Hazard" });
const RESULT_TONES = Object.freeze({
  criticalSuccess: "decisive momentum",
  success: "steady progress",
  failure: "unresolved pressure",
  criticalFailure: "fresh complication",
  skipped: "not attempted"
});

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { if (value == null) return value; if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value); if (typeof structuredClone === "function") return structuredClone(value); return JSON.parse(JSON.stringify(value)); }
function humanizeIdentifier(value = "") { return String(value ?? "").replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function normalizeRoundIndex(session, roundIndex) { const index = Number.isInteger(Number(roundIndex)) ? Number(roundIndex) : Number(session?.currentRoundIndex ?? 0); return Math.max(0, Math.min(index, Math.max((session?.event?.rounds?.length ?? session?.roundResults?.length ?? 1) - 1, 0))); }
function stationLabel(stationKey) { return humanizeIdentifier(stationKey); }
function resultLabel(result) { return RESULT_LABELS[result] ?? (result ? humanizeIdentifier(result) : "Pending"); }
function actionLabel(action = {}) { return ACTION_LABELS[action?.type] ?? ACTION_LABELS.eventApproach; }
function publicHazardRecords(session = {}) { return (session.travelV2Hazards?.records ?? session.hazards?.records ?? []).filter((record) => record?.revealed === true); }
function gmHazardRecords(session = {}) { return (session.travelV2Hazards?.records ?? session.hazards?.records ?? []).filter(isPlainObject); }

function sanitizePublicStationVignette(vignette = {}) {
  const publicStationLabel = typeof vignette.stationLabel === "string" && vignette.stationLabel ? vignette.stationLabel : stationLabel(vignette.stationKey);
  const resultText = typeof vignette.resultLabel === "string" && vignette.resultLabel ? vignette.resultLabel : resultLabel(vignette.result);
  const actionText = typeof vignette.actionLabel === "string" && vignette.actionLabel ? vignette.actionLabel : actionLabel({ type: vignette.actionType });
  const publicText = typeof vignette.publicText === "string" && vignette.publicText
    ? vignette.publicText
    : `${publicStationLabel}: ${resultText} on ${actionText}.`;
  return {
    stationKey: typeof vignette.stationKey === "string" ? vignette.stationKey : "",
    stationLabel: publicStationLabel,
    actorName: typeof vignette.actorName === "string" ? vignette.actorName : "",
    actionLabel: actionText,
    selectedOptionLabel: typeof vignette.selectedOptionLabel === "string" ? vignette.selectedOptionLabel : "",
    resultLabel: resultText,
    tone: typeof vignette.tone === "string" ? vignette.tone : "",
    publicText,
    complete: vignette.complete === true
  };
}

function buildPublicRoundSummary(stationVignettes = [], options = {}) {
  const complete = options.complete === true;
  const count = stationVignettes.length;
  const resolvedCount = stationVignettes.filter((entry) => entry.complete).length;
  if (!count) return "No public station outcomes are available yet.";
  const stationResults = stationVignettes.map((entry) => `${entry.stationLabel} ${String(entry.resultLabel || "Pending").toLowerCase()}`).join(", ");
  return complete
    ? `The round resolves through ${count} station beat${count === 1 ? "" : "s"}: ${stationResults}.`
    : `Draft public summary: ${resolvedCount} of ${count} station beat${count === 1 ? "" : "s"} have results.`;
}

function buildPublicReadAloud(publicWhatHappened, stationVignettes = [], safeHazards = [], options = {}) {
  const hazardText = safeHazards.length
    ? ` Revealed hazards in the scene: ${safeHazards.map((hazard) => hazard.name).filter(Boolean).join(", ")}.`
    : "";
  if (publicWhatHappened) return `${publicWhatHappened}${hazardText}`.trim();
  return `${buildPublicRoundSummary(stationVignettes, options)}${hazardText}`.trim();
}
function summarizeMechanical(result, action = {}) {
  if (!result) return "No station result has been recorded yet.";
  if (result === "skipped") return "Station did not roll this round.";
  if (action?.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE) {
    if (result === "criticalSuccess") return "Stabilize candidate: reduce the selected pressure by 2 if the GM applies it.";
    if (result === "success") return "Stabilize candidate: reduce the selected pressure by 1 if the GM applies it.";
    if (result === "criticalFailure") return "Stabilize complication candidate: pressure may worsen if the GM applies it.";
    return "Stabilize effort did not reduce pressure.";
  }
  if (action?.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE) {
    if (["criticalSuccess", "success"].includes(result)) return "Hazard response succeeded and may clear or suppress the active hazard.";
    if (result === "criticalFailure") return "Hazard response failed with a complication candidate.";
    return "Hazard response did not clear the hazard.";
  }
  if (["criticalSuccess", "success"].includes(result)) return "Counts as progress toward the round objective.";
  if (result === "criticalFailure") return "Counts as a failed objective attempt with heightened scene pressure.";
  return "Counts as a failed objective attempt.";
}
function narrativeSentence({ stationName, actorName, result, actionText, optionLabel, hazardName }) {
  const subject = actorName || `The ${stationName}`;
  const target = hazardName ? ` against ${hazardName}` : (optionLabel ? ` through ${optionLabel}` : "");
  if (!result) return `${subject} is still waiting to resolve ${actionText.toLowerCase()}${target}; keep this beat provisional.`;
  if (result === "criticalSuccess") return `${subject} lands a decisive ${actionText.toLowerCase()}${target}, turning the crisis into momentum without locking in permanent fallout.`;
  if (result === "success") return `${subject} makes useful ${actionText.toLowerCase()}${target}, steadying the scene and giving the crew something to build on.`;
  if (result === "criticalFailure") return `${subject}'s ${actionText.toLowerCase()}${target} misfires, adding a temporary disruption or follow-up complication for the GM to frame.`;
  if (result === "skipped") return `${subject} does not press this station beat, leaving the scene for the other stations to carry.`;
  return `${subject}'s ${actionText.toLowerCase()}${target} falls short, so pressure remains visible at the table.`;
}

export function prepareTravelV2StationResultVignettes(session, options = {}) {
  const roundIndex = normalizeRoundIndex(session, options.roundIndex);
  const round = session?.event?.rounds?.[roundIndex] ?? {};
  const roundResult = session?.roundResults?.[roundIndex] ?? {};
  const activeStations = Array.isArray(round.activeStations) ? round.activeStations : Object.keys(roundResult.stationResults ?? {});
  const assignments = isPlainObject(session?.stationAssignments) ? session.stationAssignments : {};
  return activeStations.map((stationKey) => {
    const action = roundResult.stationActions?.[stationKey] ?? { type: ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH };
    const result = roundResult.stationResults?.[stationKey] ?? null;
    const stationName = stationLabel(stationKey);
    const actorName = assignments[stationKey]?.actorName ?? "";
    const actionText = actionLabel(action);
    const optionLabel = roundResult.selectedStationOptionLabels?.[stationKey] ?? "";
    const hazardName = action?.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE ? (action.hazardName || optionLabel) : "";
    const narrativeText = narrativeSentence({ stationName, actorName, result, actionText, optionLabel, hazardName });
    return { stationKey, stationLabel: stationName, actorName, actionType: action?.type ?? "eventApproach", actionLabel: actionText, selectedOptionLabel: optionLabel, hazardName, result, resultLabel: resultLabel(result), degreeOfSuccess: result ?? "", tone: RESULT_TONES[result] ?? "pending", mechanicalSummary: summarizeMechanical(result, action), narrativeText, publicText: `${stationName}: ${narrativeText}`, complete: Boolean(result) };
  });
}

export function prepareTravelV2RoundNarration(session, roundIndex = undefined, options = {}) {
  const index = normalizeRoundIndex(session, roundIndex ?? options.roundIndex);
  const round = session?.event?.rounds?.[index] ?? {};
  const vignettes = prepareTravelV2StationResultVignettes(session, { ...options, roundIndex: index });
  const complete = vignettes.length > 0 && vignettes.every((entry) => entry.complete);
  const activeHazards = gmHazardRecords(session).filter((record) => record.status === "active");
  const clearedHazards = gmHazardRecords(session).filter((record) => record.status === "cleared");
  const respondedHazardNames = Array.from(new Set(vignettes.filter((v) => v.actionType === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE).map((v) => v.hazardName).filter(Boolean)));
  const unresolvedHazards = activeHazards.filter((record) => record.status !== "cleared");
  const stationBullets = vignettes.map((v) => `${v.stationLabel} — ${v.resultLabel}: ${v.narrativeText}`);
  const title = round.title ? `Round ${index + 1}: ${round.title}` : `Round ${index + 1}`;
  const pressureNotes = [];
  for (const [key, value] of Object.entries(session?.pressure ?? {})) if (Number.isFinite(Number(value)) && Number(value) > 0) pressureNotes.push(`${humanizeIdentifier(key)} ${value}`);
  const whatHappened = complete
    ? `The round resolves through ${vignettes.length} station beat${vignettes.length === 1 ? "" : "s"}: ${vignettes.map((v) => `${v.stationLabel} ${v.resultLabel.toLowerCase()}`).join(", ")}.`
    : `Draft narration: ${vignettes.filter((v) => v.complete).length} of ${vignettes.length} station beat${vignettes.length === 1 ? "" : "s"} have results, so keep the outcome provisional.`;
  const safePublicHazards = publicHazardRecords(session).map(sanitizeTravelV2PublicHazard);
  const publicStationVignettes = vignettes.map(sanitizePublicStationVignette);
  const publicWhatHappened = buildPublicRoundSummary(publicStationVignettes, { complete });
  const publicSuggestedReadAloud = buildPublicReadAloud(publicWhatHappened, publicStationVignettes, safePublicHazards, { complete });
  return { roundIndex: index, roundNumber: index + 1, title, completionState: complete ? "complete" : "partial", complete, whatHappened, publicWhatHappened, stationVignettes: vignettes, stationOutcomeBullets: stationBullets, publicStationOutcomeBullets: publicStationVignettes.map((v) => v.publicText), hazardNotes: { active: activeHazards.map(sanitizeTravelV2GmHazard), responded: respondedHazardNames, cleared: clearedHazards.map(sanitizeTravelV2GmHazard), unresolved: unresolvedHazards.map(sanitizeTravelV2GmHazard) }, publicHazardNotes: { revealed: safePublicHazards }, pressureNotes, suggestedReadAloud: `${whatHappened} ${complete ? "Read the strongest success first, then frame any remaining hazard pressure." : "Ask for the remaining station results before making final consequences sound certain."}`.trim(), publicSuggestedReadAloud, generatedAt: options.now ?? new Date().toISOString() };
}

export function sanitizeTravelV2PublicNarration(narration) {
  const source = cloneData(narration ?? {});
  const stationVignettes = (Array.isArray(source.stationVignettes) ? source.stationVignettes : []).map(sanitizePublicStationVignette);
  const hazardSourceRecords = [
    ...(source.publicHazardNotes?.revealed ?? []),
    ...(source.hazardNotes?.active ?? []),
    ...(source.hazardNotes?.cleared ?? []),
    ...(source.hazardNotes?.unresolved ?? [])
  ];
  const safeHazards = publicHazardRecords({ travelV2Hazards: { records: hazardSourceRecords } }).map(sanitizeTravelV2PublicHazard);
  const complete = source.complete === true;
  const publicWhatHappened = typeof source.publicWhatHappened === "string" && source.publicWhatHappened
    ? source.publicWhatHappened
    : (typeof source.publicSummary?.whatHappened === "string" && source.publicSummary.whatHappened
      ? source.publicSummary.whatHappened
      : buildPublicRoundSummary(stationVignettes, { complete }));
  const publicSuggestedReadAloud = typeof source.publicSuggestedReadAloud === "string" && source.publicSuggestedReadAloud
    ? source.publicSuggestedReadAloud
    : (typeof source.publicSummary?.suggestedReadAloud === "string" && source.publicSummary.suggestedReadAloud
      ? source.publicSummary.suggestedReadAloud
      : buildPublicReadAloud(publicWhatHappened, stationVignettes, safeHazards, { complete }));
  return { roundNumber: source.roundNumber, title: source.title, completionState: source.completionState, complete, whatHappened: publicWhatHappened, publicWhatHappened, stationVignettes, stationOutcomeBullets: stationVignettes.map((v) => v.publicText), hazardNotes: { revealed: safeHazards }, suggestedReadAloud: publicSuggestedReadAloud, publicSuggestedReadAloud };
}

export function sanitizeTravelV2GmNarration(narration) { return cloneData(narration ?? {}); }
