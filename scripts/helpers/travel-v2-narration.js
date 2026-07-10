import { ARCFLIGHT_TRAVEL_STATION_ACTIONS } from "./travel-pressure.js";
import { sanitizeTravelV2PublicHazard, sanitizeTravelV2GmHazard } from "./travel-v2-hazards.js";

const RESULT_LABELS = Object.freeze({ criticalSuccess: "Critical Success", success: "Success", failure: "Failure", criticalFailure: "Critical Failure", skipped: "Skipped" });
const ACTION_LABELS = Object.freeze({ eventApproach: "Push Forward", stabilize: "Stabilize / Repair", hazardResponse: "Respond to Hazard", support: "Support" });
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
function stabilizeRecords(session = {}, roundIndex = 0) { return (session.stabilizeResolutionRecords?.records ?? []).filter((record) => isPlainObject(record) && Number(record.roundIndex) === Number(roundIndex)); }
function momentumRecords(session = {}, roundIndex = 0) { return (session.travelV2Momentum?.records ?? []).filter((record) => isPlainObject(record) && Number(record.roundIndex) === Number(roundIndex) && record.status !== "dismissed"); }
function focusBacklashRecords(session = {}, roundIndex = 0) { return (session.travelV2FocusBacklashRecords?.records ?? []).filter((record) => isPlainObject(record) && Number(record.roundIndex) === Number(roundIndex)); }
function supportRecords(session = {}, roundIndex = 0) { return (session.travelV2SupportRecords?.records ?? []).filter((record) => isPlainObject(record) && Number(record.roundIndex) === Number(roundIndex)); }
function supportBacklashRecords(session = {}, roundIndex = 0) { return (session.travelV2SupportBacklashRecords?.records ?? []).filter((record) => isPlainObject(record) && Number(record.roundIndex) === Number(roundIndex)); }
function sanitizePublicSupportRecord(record = {}) { return { id: record.id ?? "", roundIndex: Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : null, supportingStationKey: typeof record.supportingStationKey === "string" ? record.supportingStationKey : "", supportingStationName: typeof record.supportingStationName === "string" ? record.supportingStationName : "", targetStationKey: typeof record.targetStationKey === "string" ? record.targetStationKey : "", targetStationName: typeof record.targetStationName === "string" ? record.targetStationName : "", assistValue: Number(record.assistValue) || 0, status: ["pending", "used", "dismissed"].includes(record.status) ? record.status : "pending", publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "", publicAssistText: typeof record.publicAssistText === "string" ? record.publicAssistText : "" }; }
function supportNarrationText(record = {}) {
  const supporting = record.supportingStationName || stationLabel(record.supportingStationKey);
  const target = record.targetStationName || stationLabel(record.targetStationKey);
  const assist = Math.max(0, Math.trunc(Number(record.assistValue) || 0));
  if (record.status === "used") return `${target} used ${supporting}’s assist.`;
  if (record.status === "dismissed") return `${supporting}’s assist was dismissed.`;
  if (assist >= 2) return `${supporting} gives ${target} a strong opening. Pending assist: +${assist}.`;
  return `${supporting} is helping ${target}. Pending assist: +${assist}.`;
}
function sanitizePublicSupportBacklashRecord(record = {}) { return { id: record.id ?? "", roundIndex: Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : null, supportingStationKey: typeof record.supportingStationKey === "string" ? record.supportingStationKey : "", supportingStationName: typeof record.supportingStationName === "string" ? record.supportingStationName : "", targetStationKey: typeof record.targetStationKey === "string" ? record.targetStationKey : "", targetStationName: typeof record.targetStationName === "string" ? record.targetStationName : "", severity: record.severity === "major" ? "major" : "minor", sourceResult: record.sourceResult === "criticalFailure" ? "criticalFailure" : "failure", status: ["pending", "applied", "dismissed"].includes(record.status) ? record.status : "pending", statusLabel: typeof record.statusLabel === "string" ? record.statusLabel : "", publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "", publicRiskText: typeof record.publicRiskText === "string" ? record.publicRiskText : "" }; }
function supportBacklashNarrationText(record = {}) { const supporting = record.supportingStationName || stationLabel(record.supportingStationKey); const target = record.targetStationName || stationLabel(record.targetStationKey); if (record.status === "applied") return `The GM marked ${supporting}’s Support backlash as applied; any actual consequence remains manually handled.`; if (record.status === "dismissed") return `${supporting}’s Support backlash was dismissed.`; if (record.sourceResult === "criticalFailure" || record.severity === "major") return `${supporting}’s Support for ${target} backfires, creating a major backlash candidate.`; return `${supporting}’s Support for ${target} falters, creating a minor complication candidate.`; }
function sanitizePublicFocusBacklashRecord(record = {}) { return { id: record.id ?? "", roundIndex: Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : null, stationKey: typeof record.stationKey === "string" ? record.stationKey : "", stationName: typeof record.stationName === "string" ? record.stationName : "", focusKey: typeof record.focusKey === "string" ? record.focusKey : "", focusLabel: typeof record.focusLabel === "string" ? record.focusLabel : "", publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "", publicRiskText: typeof record.publicRiskText === "string" ? record.publicRiskText : "", publicBacklashPreviewText: typeof record.publicBacklashPreviewText === "string" ? record.publicBacklashPreviewText : "", status: ["pending", "applied", "dismissed"].includes(record.status) ? record.status : "pending" }; }
function sanitizePublicMomentumRecord(record = {}) { return { id: record.id ?? "", roundIndex: Number.isInteger(Number(record.roundIndex)) ? Number(record.roundIndex) : null, stationKey: typeof record.stationKey === "string" ? record.stationKey : "", source: typeof record.source === "string" ? record.source : "", amount: Number(record.amount) || 0, status: typeof record.status === "string" ? record.status : "", publicSummary: typeof record.publicSummary === "string" ? record.publicSummary : "" }; }


function sanitizeHookText(value) { return typeof value === "string" ? value.trim() : ""; }
function sanitizeHookTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === "string") return entry.trim();
    if (isPlainObject(entry)) return sanitizeHookText(entry.label ?? entry.name ?? entry.text ?? entry.summary);
    return "";
  }).filter(Boolean);
}

function prepareVisibleStakeHooks(session = {}) {
  const stakes = isPlainObject(session?.event?.visibleStakes) ? session.event.visibleStakes : (isPlainObject(session?.event?.stakes) ? session.event.stakes : {});
  return {
    crisisSummary: sanitizeHookText(stakes.crisisSummary),
    threatenedResources: sanitizeHookTextList(stakes.threatenedResources),
    knownDangers: sanitizeHookTextList(stakes.knownDangers),
    knownTells: sanitizeHookTextList(stakes.knownTells),
    broadReward: sanitizeHookText(stakes.broadReward),
    broadConsequence: sanitizeHookText(stakes.broadConsequence)
  };
}

function buildNarrationHookPrompts({ visibleStakes, narration, publicHazards }) {
  const prompts = [];
  if (visibleStakes.crisisSummary) prompts.push(`Frame the immediate crisis: ${visibleStakes.crisisSummary}`);
  if (visibleStakes.threatenedResources.length) prompts.push(`Keep these threatened resources in view: ${visibleStakes.threatenedResources.join(", ")}.`);
  if (visibleStakes.knownDangers.length) prompts.push(`Use only revealed dangers as pressure cues: ${visibleStakes.knownDangers.join(", ")}.`);
  if (visibleStakes.knownTells.length) prompts.push(`Echo these table-known tells: ${visibleStakes.knownTells.join(", ")}.`);
  if (publicHazards.length) prompts.push(`Mention revealed hazards only: ${publicHazards.map((hazard) => hazard.name).filter(Boolean).join(", ")}.`);
  if (narration.stationVignettes.length) prompts.push(`Spotlight station beats: ${narration.stationVignettes.map((vignette) => vignette.publicText).join(" ")}`);
  if (narration.momentum.value || narration.momentum.earnedThisRound || narration.momentum.spentThisRound) prompts.push(`Reflect shared Momentum without applying changes: current ${narration.momentum.value}, earned ${narration.momentum.earnedThisRound}, spent ${narration.momentum.spentThisRound}.`);
  if (visibleStakes.broadReward) prompts.push(`Foreshadow the broad reward: ${visibleStakes.broadReward}`);
  if (visibleStakes.broadConsequence) prompts.push(`Foreshadow the broad consequence without making it certain: ${visibleStakes.broadConsequence}`);
  return prompts;
}

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
function summarizeMechanical(result, action = {}, stabilizeRecord = null) {
  if (!result) return "No station result has been recorded yet.";
  if (result === "skipped") return "Station did not roll this round.";
  if (action?.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE) {
    const label = stabilizeRecord?.pressureLabel || (action?.stabilizePressureKey ? humanizeIdentifier(action.stabilizePressureKey) : "selected");
    const status = stabilizeRecord?.status === "applied" ? "applied" : (stabilizeRecord?.status === "dismissed" ? "dismissed" : "pending GM apply");
    if (Number(stabilizeRecord?.pressureDelta) < 0) return `Stabilize ${status}: reduced ${label} pressure by ${Math.abs(Number(stabilizeRecord.pressureDelta))}.`;
    if (Number(stabilizeRecord?.pressureDelta) > 0) return `Stabilize ${status}: ${label} pressure increase or complication candidate.`;
    if (result === "criticalSuccess") return "Stabilize candidate: reduce the selected pressure by 2 if the GM applies it.";
    if (result === "success") return "Stabilize candidate: reduce the selected pressure by 1 if the GM applies it.";
    if (result === "criticalFailure") return "Stabilize complication candidate: pressure may worsen if the GM applies it.";
    return "Stabilize effort did not reduce pressure.";
  }
  if (action?.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.SUPPORT) return "Support creates session-local assists for another station; it does not count toward main-objective progress or apply a bonus automatically.";
  if (action?.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE) {
    if (["criticalSuccess", "success"].includes(result)) return "Hazard response succeeded and may clear or suppress the active hazard.";
    if (result === "criticalFailure") return "Hazard response failed with a complication candidate.";
    return "Hazard response did not clear the hazard.";
  }
  if (["criticalSuccess", "success"].includes(result)) return "Counts as progress toward the round objective.";
  if (result === "criticalFailure") return "Counts as a failed objective attempt with heightened scene pressure.";
  return "Counts as a failed objective attempt.";
}
function narrativeSentence({ stationName, actorName, result, actionText, optionLabel, hazardName, stabilizeRecord }) {
  const subject = actorName || `The ${stationName}`;
  const target = hazardName ? ` against ${hazardName}` : (optionLabel ? ` through ${optionLabel}` : "");
  if (stabilizeRecord) {
    const pressureLabel = stabilizeRecord.pressureLabel || "pressure";
    const status = stabilizeRecord.status === "applied" ? "applied" : (stabilizeRecord.status === "dismissed" ? "dismissed" : "pending GM apply");
    if (Number(stabilizeRecord.pressureDelta) < 0) return `${subject}'s stabilize work reduces ${pressureLabel} by ${Math.abs(Number(stabilizeRecord.pressureDelta))}, ${status}, without adding main objective progress.`;
    if (Number(stabilizeRecord.pressureDelta) > 0) return `${subject}'s stabilize work creates a ${pressureLabel} complication candidate, ${status}, without adding main objective progress.`;
    return `${subject}'s stabilize work does not reduce ${pressureLabel} and does not add main objective progress.`;
  }
  if (actionText === "Support") return `${subject} coordinates with the target station; any assist remains session-local and separate from main-objective progress.`;
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
  const stabilizeLookup = new Map(stabilizeRecords(session, roundIndex).map((record) => [record.stationKey, record]));
  return activeStations.map((stationKey) => {
    const action = roundResult.stationActions?.[stationKey] ?? { type: ARCFLIGHT_TRAVEL_STATION_ACTIONS.EVENT_APPROACH };
    const result = roundResult.stationResults?.[stationKey] ?? null;
    const stationName = stationLabel(stationKey);
    const actorName = assignments[stationKey]?.actorName ?? "";
    const actionText = actionLabel(action);
    const optionLabel = roundResult.selectedStationOptionLabels?.[stationKey] ?? "";
    const hazardName = action?.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.HAZARD_RESPONSE ? (action.hazardName || optionLabel) : "";
    const stabilizeRecord = action?.type === ARCFLIGHT_TRAVEL_STATION_ACTIONS.STABILIZE ? stabilizeLookup.get(stationKey) : null;
    const narrativeText = narrativeSentence({ stationName, actorName, result, actionText, optionLabel, hazardName, stabilizeRecord });
    return { stationKey, stationLabel: stationName, actorName, actionType: action?.type ?? "eventApproach", actionLabel: actionText, selectedOptionLabel: optionLabel, hazardName, stabilizePressureLabel: stabilizeRecord?.pressureLabel ?? "", stabilizePressureDelta: Number(stabilizeRecord?.pressureDelta) || 0, stabilizeStatus: stabilizeRecord?.status ?? "", result, resultLabel: resultLabel(result), degreeOfSuccess: result ?? "", tone: RESULT_TONES[result] ?? "pending", mechanicalSummary: summarizeMechanical(result, action, stabilizeRecord), narrativeText, publicText: `${stationName}: ${narrativeText}`, complete: Boolean(result) };
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
  const roundMomentumRecords = momentumRecords(session, index);
  const momentumEarned = roundMomentumRecords.filter((record) => Number(record.amount) > 0).reduce((sum, record) => sum + Number(record.amount), 0);
  const momentumSpent = Math.abs(roundMomentumRecords.filter((record) => Number(record.amount) < 0).reduce((sum, record) => sum + Number(record.amount), 0));
  const momentumFacts = { value: Number(session?.travelV2Momentum?.value) || 0, earnedThisRound: momentumEarned, spentThisRound: momentumSpent, records: roundMomentumRecords.map(cloneData), publicRecords: roundMomentumRecords.map(sanitizePublicMomentumRecord) };
  for (const [key, value] of Object.entries(session?.pressure ?? {})) if (Number.isFinite(Number(value)) && Number(value) > 0) pressureNotes.push(`${humanizeIdentifier(key)} ${value}`);
  const whatHappened = complete
    ? `The round resolves through ${vignettes.length} station beat${vignettes.length === 1 ? "" : "s"}: ${vignettes.map((v) => `${v.stationLabel} ${v.resultLabel.toLowerCase()}`).join(", ")}.`
    : `Draft narration: ${vignettes.filter((v) => v.complete).length} of ${vignettes.length} station beat${vignettes.length === 1 ? "" : "s"} have results, so keep the outcome provisional.`;
  const safePublicHazards = publicHazardRecords(session).map(sanitizeTravelV2PublicHazard);
  const publicStationVignettes = vignettes.map(sanitizePublicStationVignette);
  const publicWhatHappened = buildPublicRoundSummary(publicStationVignettes, { complete });
  const publicSuggestedReadAloud = buildPublicReadAloud(publicWhatHappened, publicStationVignettes, safePublicHazards, { complete });
  const momentumText = momentumEarned || momentumSpent ? ` Momentum this round: +${momentumEarned} earned, ${momentumSpent} spent.` : "";
  const roundSupportRecords = supportRecords(session, index);
  const supportFacts = { records: roundSupportRecords.map((record) => ({ ...sanitizePublicSupportRecord(record), narrationText: supportNarrationText(record) })), publicRecords: roundSupportRecords.map(sanitizePublicSupportRecord), pendingCount: roundSupportRecords.filter((record) => record.status === "pending").length, usedCount: roundSupportRecords.filter((record) => record.status === "used").length, dismissedCount: roundSupportRecords.filter((record) => record.status === "dismissed").length, narrationLines: roundSupportRecords.map(supportNarrationText), summaryText: roundSupportRecords.length ? "Support assists are session-local openings; they do not count toward main-objective progress or mutate rolls automatically." : "" };
  const supportText = supportFacts.narrationLines.length ? ` Support: ${supportFacts.narrationLines.join(" ")} ${supportFacts.summaryText}` : "";
  const roundSupportBacklashRecords = supportBacklashRecords(session, index);
  const supportBacklashFacts = { records: roundSupportBacklashRecords.map(sanitizePublicSupportBacklashRecord), publicRecords: roundSupportBacklashRecords.map(sanitizePublicSupportBacklashRecord), pendingCount: roundSupportBacklashRecords.filter((record) => record.status === "pending").length, appliedCount: roundSupportBacklashRecords.filter((record) => record.status === "applied").length, dismissedCount: roundSupportBacklashRecords.filter((record) => record.status === "dismissed").length, narrationLines: roundSupportBacklashRecords.map(supportBacklashNarrationText), summaryText: roundSupportBacklashRecords.length ? "Failed Support creates GM-controlled consequence candidates only; nothing is automatically applied." : "" };
  const supportBacklashText = supportBacklashFacts.narrationLines.length ? ` Support backlash: ${supportBacklashFacts.narrationLines.join(" ")} ${supportBacklashFacts.summaryText}` : "";
  const roundFocusBacklashRecords = focusBacklashRecords(session, index);
  const focusBacklashFacts = { records: roundFocusBacklashRecords.map(cloneData), publicRecords: roundFocusBacklashRecords.map(sanitizePublicFocusBacklashRecord), pendingCount: roundFocusBacklashRecords.filter((record) => record.status === "pending").length, appliedCount: roundFocusBacklashRecords.filter((record) => record.status === "applied").length, dismissedCount: roundFocusBacklashRecords.filter((record) => record.status === "dismissed").length };
  return { roundIndex: index, roundNumber: index + 1, title, completionState: complete ? "complete" : "partial", complete, whatHappened, publicWhatHappened, stationVignettes: vignettes, stationOutcomeBullets: stationBullets, publicStationOutcomeBullets: publicStationVignettes.map((v) => v.publicText), hazardNotes: { active: activeHazards.map(sanitizeTravelV2GmHazard), responded: respondedHazardNames, cleared: clearedHazards.map(sanitizeTravelV2GmHazard), unresolved: unresolvedHazards.map(sanitizeTravelV2GmHazard) }, publicHazardNotes: { revealed: safePublicHazards }, pressureNotes, momentum: momentumFacts, support: supportFacts, supportBacklash: supportBacklashFacts, focusBacklash: focusBacklashFacts, suggestedReadAloud: `${whatHappened}${momentumText}${supportText}${supportBacklashText} ${complete ? "Read the strongest success first, then frame any remaining hazard pressure." : "Ask for the remaining station results before making final consequences sound certain."}`.trim(), publicSuggestedReadAloud: `${publicSuggestedReadAloud}${momentumText}`.trim(), generatedAt: options.now ?? new Date().toISOString() };
}

export function prepareTravelV2NarrationHookState(session, options = {}) {
  const safeSession = isPlainObject(session) ? session : {};
  const event = isPlainObject(safeSession.event) ? safeSession.event : {};
  const rounds = Array.isArray(event.rounds) ? event.rounds : [];
  const currentRoundIndex = normalizeRoundIndex(safeSession, options.roundIndex);
  const currentRound = rounds[currentRoundIndex] ?? {};
  const roundCount = Number.isInteger(Number(event.roundCount)) && Number(event.roundCount) > 0 ? Number(event.roundCount) : rounds.length;
  const category = typeof event.category === "string" ? event.category : "";
  const phase = typeof currentRound.phase === "string" && currentRound.phase ? currentRound.phase : (typeof currentRound.title === "string" ? currentRound.title : "");
  const narration = sanitizeTravelV2PublicNarration(prepareTravelV2RoundNarration(safeSession, currentRoundIndex, options));
  const visibleStakes = prepareVisibleStakeHooks(safeSession);
  const publicHazards = publicHazardRecords(safeSession).map(sanitizeTravelV2PublicHazard);
  const availableStations = (Array.isArray(currentRound.activeStations) ? currentRound.activeStations : narration.stationVignettes.map((vignette) => vignette.stationKey))
    .filter((stationKey, index, stationKeys) => typeof stationKey === "string" && stationKey && stationKeys.indexOf(stationKey) === index)
    .map((stationKey) => ({ stationKey, stationLabel: stationLabel(stationKey) }));
  const stationHooks = narration.stationVignettes.map((vignette) => ({
    stationKey: vignette.stationKey,
    stationLabel: vignette.stationLabel,
    actionLabel: vignette.actionLabel,
    resultLabel: vignette.resultLabel,
    tone: vignette.tone,
    publicText: vignette.publicText,
    complete: vignette.complete === true
  }));
  const pressureHooks = Object.entries(safeSession.pressure ?? {})
    .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
    .map(([key, value]) => ({ key, label: humanizeIdentifier(key), value: Number(value) }));
  const hazardHooks = publicHazards.map((hazard) => ({ id: hazard.id, name: hazard.name, status: hazard.status, publicSummary: hazard.publicSummary }));
  const hasRuntimeContext = Boolean(event.key || event.name || rounds.length || stationHooks.length || publicHazards.length);
  const outcomeHooks = hasRuntimeContext ? [
    ...(narration.publicWhatHappened ? [{ type: "roundSummary", text: narration.publicWhatHappened }] : []),
    ...narration.stationOutcomeBullets.map((text, index) => ({ type: "stationOutcome", stationKey: stationHooks[index]?.stationKey ?? "", text })),
    ...(narration.suggestedReadAloud ? [{ type: "readAloud", text: narration.suggestedReadAloud }] : [])
  ] : [];
  const visibleStakesSummary = [
    visibleStakes.crisisSummary,
    visibleStakes.threatenedResources.length ? `Threatened: ${visibleStakes.threatenedResources.join(", ")}.` : "",
    visibleStakes.knownDangers.length ? `Known dangers: ${visibleStakes.knownDangers.join(", ")}.` : "",
    visibleStakes.knownTells.length ? `Known tells: ${visibleStakes.knownTells.join(", ")}.` : ""
  ].filter(Boolean).join(" ");
  const promptSeeds = buildNarrationHookPrompts({ visibleStakes, narration, publicHazards });
  const hasNarrationHooks = Boolean(event.key || event.name || visibleStakesSummary || availableStations.length || stationHooks.length || pressureHooks.length || hazardHooks.length || outcomeHooks.length || promptSeeds.length);
  return {
    hasNarrationHooks,
    eventKey: typeof event.key === "string" ? event.key : "",
    eventName: typeof event.name === "string" ? event.name : "",
    category,
    categoryLabel: typeof event.categoryLabel === "string" && event.categoryLabel ? event.categoryLabel : humanizeIdentifier(category),
    roundCount,
    currentRoundIndex,
    currentRoundNumber: currentRoundIndex + 1,
    phase,
    phaseLabel: phase ? humanizeIdentifier(phase) : "",
    crisisSummary: visibleStakes.crisisSummary,
    visibleStakesSummary,
    threatenedResources: visibleStakes.threatenedResources,
    knownDangers: visibleStakes.knownDangers,
    knownTells: visibleStakes.knownTells,
    availableStations,
    stationHooks,
    pressureHooks,
    hazardHooks,
    outcomeHooks,
    promptSeeds,
    safetyNote: "Player-safe narration hook state only. No persistent changes are applied."
  };
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
  const publicMomentum = isPlainObject(source.momentum) ? { value: Number(source.momentum.value) || 0, earnedThisRound: Number(source.momentum.earnedThisRound) || 0, spentThisRound: Number(source.momentum.spentThisRound) || 0, records: (Array.isArray(source.momentum.publicRecords) ? source.momentum.publicRecords : []).map(sanitizePublicMomentumRecord) } : { value: 0, earnedThisRound: 0, spentThisRound: 0, records: [] };
  const publicSupport = isPlainObject(source.support) ? { records: (Array.isArray(source.support.publicRecords) ? source.support.publicRecords : []).map(sanitizePublicSupportRecord), pendingCount: Number(source.support.pendingCount) || 0, usedCount: Number(source.support.usedCount) || 0, dismissedCount: Number(source.support.dismissedCount) || 0, narrationLines: (Array.isArray(source.support.narrationLines) ? source.support.narrationLines : []).map((line) => String(line ?? "")).filter(Boolean), summaryText: typeof source.support.summaryText === "string" ? source.support.summaryText : "" } : { records: [], pendingCount: 0, usedCount: 0, dismissedCount: 0, narrationLines: [], summaryText: "" };
  const publicSupportBacklash = isPlainObject(source.supportBacklash) ? { records: (Array.isArray(source.supportBacklash.publicRecords) ? source.supportBacklash.publicRecords : []).map(sanitizePublicSupportBacklashRecord), pendingCount: Number(source.supportBacklash.pendingCount) || 0, appliedCount: Number(source.supportBacklash.appliedCount) || 0, dismissedCount: Number(source.supportBacklash.dismissedCount) || 0, narrationLines: (Array.isArray(source.supportBacklash.narrationLines) ? source.supportBacklash.narrationLines : []).map((line) => String(line ?? "")).filter(Boolean), summaryText: typeof source.supportBacklash.summaryText === "string" ? source.supportBacklash.summaryText : "" } : { records: [], pendingCount: 0, appliedCount: 0, dismissedCount: 0, narrationLines: [], summaryText: "" };
  const publicFocusBacklash = isPlainObject(source.focusBacklash) ? { records: (Array.isArray(source.focusBacklash.publicRecords) ? source.focusBacklash.publicRecords : []).map(sanitizePublicFocusBacklashRecord), pendingCount: Number(source.focusBacklash.pendingCount) || 0, appliedCount: Number(source.focusBacklash.appliedCount) || 0, dismissedCount: Number(source.focusBacklash.dismissedCount) || 0 } : { records: [], pendingCount: 0, appliedCount: 0, dismissedCount: 0 };
  return { roundNumber: source.roundNumber, title: source.title, completionState: source.completionState, complete, whatHappened: publicWhatHappened, publicWhatHappened, momentum: publicMomentum, support: publicSupport, supportBacklash: publicSupportBacklash, focusBacklash: publicFocusBacklash, stationVignettes, stationOutcomeBullets: stationVignettes.map((v) => v.publicText), hazardNotes: { revealed: safeHazards }, suggestedReadAloud: publicSuggestedReadAloud, publicSuggestedReadAloud };
}

export function sanitizeTravelV2GmNarration(narration) { return cloneData(narration ?? {}); }
