import { prepareTravelV2PressureApplicationState } from "../helpers/travel-v2-pressure-application-state.js";
import { prepareTravelV2EventCompletionReadiness } from "../helpers/travel-v2-event-completion-readiness.js";
import { prepareTravelV2RoundFinalizationState } from "../helpers/travel-v2-round-finalization-state.js";
import { prepareTravelV2EventOutcomePackage } from "../helpers/travel-v2-event-outcome-package.js";
import { prepareTravelV2ActorApplicationPreviewFromSession } from "../helpers/travel-v2-actor-application-bridge.js";
import { prepareTravelV2FollowUpState } from "../helpers/travel-v2-followups.js";
import { prepareTravelV2RoundActionOrderState } from "../helpers/travel-v2-round-action-order-state.js";
import { sanitizeTravelV2ActiveCardsForPlayers, sanitizeTravelV2ActiveCardPreviewForPlayers, sanitizeTravelV2ActiveCardApplicationPreviewsForPlayers, applyTravelV2ActiveCardApplicationPreviewToSession } from "../helpers/travel-v2-session-round-finalization.js";

export const TRAVEL_EVENT_RUNNER_V2_PREVIEW_PANEL_VERSION = 15;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneData(value) {
  if (value == null) return value;
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function recordsFromContainer(container) {
  if (Array.isArray(container)) return container;
  if (Array.isArray(container?.records)) return container.records;
  return [];
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


function normalizeFinalizationState(state = null, latestResult = null) {
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const resultBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const roundNumber = state?.roundNumber ?? null;
  const successText = latestResult?.ok === true && latestResult?.finalized === true
    ? `Finalized Travel v2 round ${latestResult.roundNumber ?? latestResult.roundIndex + 1}.`
    : "";
  const feedbackText = successText || resultBlockedReasons[0] || latestResult?.error || "";
  const isEventCompleteReady = state?.isEventCompleteReady === true;
  const isFinalized = state?.isFinalized === true;
  const canFinalize = state?.canFinalize === true;
  const buttonLabel = isEventCompleteReady
    ? "Event Ready"
    : (isFinalized ? "Round Finalized" : (canFinalize ? "Finalize Round" : "Cannot Finalize"));
  const readinessText = isEventCompleteReady
    ? "Final event round finalized. Event completion will be handled in a later step."
    : "";

  return {
    lifecycleState: state?.lifecycleState ?? "previewing",
    canFinalize,
    finalizeDisabled: !canFinalize,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    roundIndex: Number.isInteger(Number(state?.roundIndex)) ? Number(state.roundIndex) : -1,
    roundNumber,
    effectiveOutcomeKey: state?.effectiveOutcomeKey ?? "",
    isFinalized,
    isEventCompleteReady,
    footerText: state?.footerText ?? "Current Travel v2 round is not ready to finalize.",
    buttonLabel,
    feedbackText,
    hasFeedback: Boolean(feedbackText),
    readinessText,
    hasReadinessText: Boolean(readinessText)
  };
}

function normalizeStationActionResolutionSummary(summary = null) {
  const stations = Array.isArray(summary?.stations) ? summary.stations.map((row) => ({
    stationKey: row?.stationKey ?? "",
    stationLabel: row?.stationLabel || humanizeIdentifier(row?.stationKey || "station"),
    selectedActionKey: row?.selectedActionKey ?? "",
    selectedActionType: row?.selectedActionType ?? "",
    selectedActionLabel: row?.selectedActionLabel || humanizeIdentifier(row?.selectedActionKey || row?.selectedActionType || "station action"),
    difficultyBidKey: row?.difficultyBidKey ?? "none",
    difficultyBidLabel: row?.difficultyBidLabel ?? "No Bid",
    difficultyBidDcModifier: Number.isFinite(Number(row?.difficultyBidDcModifier)) ? Number(row.difficultyBidDcModifier) : 0,
    difficultyBidRewardPreview: row?.difficultyBidRewardPreview ?? null,
    hasDifficultyBidRewardPreview: Boolean(row?.difficultyBidRewardPreview),
    effectiveDcPreview: row?.effectiveDcPreview ?? null,
    hasEffectiveDcPreview: Boolean(row?.effectiveDcPreview),
    targetStationKey: row?.targetStationKey ?? "",
    targetStationLabel: row?.targetStationLabel ?? "",
    hasTargetStation: Boolean(row?.targetStationKey && row?.targetStationLabel),
    locked: row?.locked === true,
    committed: row?.committed === true,
    stateLabel: row?.committed === true || row?.locked === true ? "Locked / committed" : "Not committed",
    roundIndex: Number.isInteger(Number(row?.roundIndex)) ? Number(row.roundIndex) : null,
    roundNumber: row?.roundNumber ?? summary?.roundNumber ?? null
  })) : [];
  return {
    available: stations.length > 0,
    title: "Finalized Station Actions",
    subtitle: stations.length > 0
      ? `Round ${summary?.roundNumber ?? "?"} locked station actions captured for resolution summary only.`
      : "No finalized station action summary has been captured yet.",
    roundIndex: Number.isInteger(Number(summary?.roundIndex)) ? Number(summary.roundIndex) : null,
    roundNumber: summary?.roundNumber ?? null,
    stations,
    hasStations: stations.length > 0,
    stationCount: stations.length,
    playerSafe: true,
    readOnly: true
  };
}

export function activeCardApplicationControlLabel(preview = {}) {
  if (preview.effectKey === "minorOpeningBonus") return "Apply +1 Opening";
  if (preview.effectKey === "greaterOpeningBonus") return "Apply +3 Opening";
  if (preview.effectKey === "heroicDegreeUpgrade") return "Apply Heroic Upgrade";
  if (preview.effectKey === "legendarySuccessFloor") return "Arm Success Floor";
  return `Apply ${humanizeIdentifier(preview.effectKey || preview.applicationType || "Card")}`;
}

export function canUserApplyTravelV2ActiveCardPreview(preview = {}, session = {}, options = {}) {
  const isGM = options?.isGM === true || options?.user?.isGM === true;
  const previewId = typeof preview.previewId === "string" ? preview.previewId.trim() : "";
  const sourceCardId = typeof preview.sourceCardId === "string" ? preview.sourceCardId.trim() : "";
  const sourceCard = recordsFromContainer(session?.travelV2ActiveCards).find((card) => card?.cardId === sourceCardId || card?.id === sourceCardId) ?? null;
  const blockedReasons = [];
  if (!isGM) blockedReasons.push("Only the GM can apply active Travel Card previews.");
  if (!previewId) blockedReasons.push("Active card application preview id is missing.");
  if (preview.requiresGMConfirmation !== true) blockedReasons.push("GM confirmation is required.");
  if (preview.canApplyPreview !== true) blockedReasons.push(preview.blockedReason || "Active card application preview is not apply-ready.");
  if (!sourceCard) blockedReasons.push("Source active card was not found.");
  if (sourceCard && sourceCard.status !== "pending") blockedReasons.push("Source active card is already consumed.");
  return {
    canApply: blockedReasons.length === 0,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    sourceCardStatus: sourceCard?.status ?? "missing",
    isGM,
    playerSafe: true,
    readOnly: true
  };
}

export function prepareTravelV2ActiveCardApplicationControls(applicationPreviewState = {}, session = {}, options = {}) {
  const records = recordsFromContainer(applicationPreviewState).map((preview) => {
    const gate = canUserApplyTravelV2ActiveCardPreview(preview, session, options);
    const controlLabel = activeCardApplicationControlLabel(preview);
    const control = {
      controlKey: `travel-v2-active-card-apply:${preview.previewId || preview.id || "missing-preview"}`,
      controlLabel,
      controlTitle: gate.canApply ? `${controlLabel} (GM confirmed)` : (gate.blockedReason || "Active card application is not available."),
      enabledForGM: gate.canApply,
      disabledForPlayers: options?.isGM !== true && options?.user?.isGM !== true,
      requiresGMConfirmation: preview.requiresGMConfirmation === true,
      canApplyPreview: preview.canApplyPreview === true,
      blockedReason: gate.blockedReason,
      previewId: preview.previewId ?? preview.id ?? "",
      sourceCardId: preview.sourceCardId ?? "",
      applicationType: preview.applicationType ?? "",
      effectKey: preview.effectKey ?? "",
      playerSafe: true,
      readOnly: true
    };
    return { ...preview, ...control, control };
  });
  const controls = records.map((record) => record.control);
  return {
    ...applicationPreviewState,
    records,
    controls,
    hasControls: controls.length > 0,
    playerSafe: true,
    readOnly: true
  };
}

export function applyTravelV2ActiveCardPreviewFromPanelState(runnerSession = {}, previewId = "", options = {}) {
  const isGM = options?.isGM === true || options?.user?.isGM === true;
  if (!isGM) {
    return { ok: false, applied: false, blocked: true, blockedReason: "Only the GM can apply active Travel Card previews.", session: cloneData(runnerSession), playerSafe: true, readOnly: true };
  }
  const id = typeof previewId === "string" ? previewId.trim() : "";
  if (!id) {
    return { ok: false, applied: false, blocked: true, blockedReason: "Active card application preview id is missing.", session: cloneData(runnerSession), playerSafe: true, readOnly: true };
  }
  return applyTravelV2ActiveCardApplicationPreviewToSession(runnerSession, id, { ...options, previewId: id, confirmedByGM: true, now: options?.now });
}

function normalizeActiveTravelCards(session, options = {}, ...containers) {
  const mergedRecords = [];
  for (const container of containers) {
    mergedRecords.push(...sanitizeTravelV2ActiveCardsForPlayers(container).records);
  }
  const normalized = sanitizeTravelV2ActiveCardPreviewForPlayers(mergedRecords, session);
  const applicationPreviews = prepareTravelV2ActiveCardApplicationControls(sanitizeTravelV2ActiveCardApplicationPreviewsForPlayers(normalized, session), session, options);
  return {
    ...normalized,
    title: "Active Travel Cards",
    subtitle: normalized.records.length > 0
      ? `${normalized.records.length} pending Difficulty Bid card${normalized.records.length === 1 ? "" : "s"} available for a future card-application pass.`
      : "No active Travel v2 cards have been created yet.",
    available: normalized.records.length > 0,
    applicationPreviews,
    activeCardApplicationPreviews: applicationPreviews,
    travelV2ActiveCardApplicationPreviews: applicationPreviews
  };
}

function normalizeStationActionEventApproachEffects(eventApproachEffects = null) {
  const effectsSource = Array.isArray(eventApproachEffects) ? eventApproachEffects : eventApproachEffects?.effects;
  const effects = Array.isArray(effectsSource) ? effectsSource.map((effect) => ({
    sourceStationKey: effect?.sourceStationKey ?? "",
    sourceStationLabel: effect?.sourceStationLabel || humanizeIdentifier(effect?.sourceStationKey || "source station"),
    effectKey: effect?.effectKey ?? "eventApproach",
    effectType: effect?.effectType ?? "eventApproach",
    effectLabel: effect?.effectLabel || `${effect?.sourceStationLabel || "Source station"} uses Event Approach.`,
    selectedSkillLabel: effect?.selectedSkillLabel ?? "",
    hasSelectedSkillLabel: Boolean(effect?.selectedSkillLabel),
    stationOutcome: effect?.stationOutcome ?? "",
    hasStationOutcome: Boolean(effect?.stationOutcome),
    roundIndex: Number.isInteger(Number(effect?.roundIndex)) ? Number(effect.roundIndex) : null,
    roundNumber: effect?.roundNumber ?? eventApproachEffects?.roundNumber ?? null,
    playerSafe: true,
    readOnly: true
  })) : [];
  return {
    available: effects.length > 0,
    title: "Event Approach Effects",
    subtitle: effects.length > 0
      ? `Round ${eventApproachEffects?.roundNumber ?? effects[0]?.roundNumber ?? "?"} read-only Event Approach effects captured for later resolution.`
      : "No Event Approach effects have been captured yet.",
    roundIndex: Number.isInteger(Number(eventApproachEffects?.roundIndex)) ? Number(eventApproachEffects.roundIndex) : null,
    roundNumber: eventApproachEffects?.roundNumber ?? effects[0]?.roundNumber ?? null,
    effects,
    hasEffects: effects.length > 0,
    effectCount: effects.length,
    playerSafe: true,
    readOnly: true
  };
}

function normalizeStationActionEventApproachContributions(eventApproachContributions = null) {
  const recordsSource = Array.isArray(eventApproachContributions) ? eventApproachContributions : eventApproachContributions?.records;
  const records = Array.isArray(recordsSource) ? recordsSource.map((record) => {
    const sourceStationKey = record?.sourceStationKey ?? "";
    const sourceStationLabel = record?.sourceStationLabel || humanizeIdentifier(sourceStationKey || "source station");
    const contributionValue = Number.isFinite(Number(record?.contributionValue)) ? Number(record.contributionValue) : 0;
    const valueLabel = `${contributionValue > 0 ? "+" : ""}${contributionValue}`;
    const stationOutcome = record?.stationOutcome ?? "unknown";
    return {
      sourceStationKey,
      sourceStationLabel,
      contributionKey: record?.contributionKey ?? "eventApproach",
      contributionType: record?.contributionType ?? "eventApproach",
      stationOutcome,
      hasStationOutcome: Boolean(stationOutcome && stationOutcome !== "unknown"),
      contributionValue,
      valueLabel,
      contributionLabel: record?.contributionLabel || `${sourceStationLabel} Event Approach: ${humanizeIdentifier(stationOutcome || "unknown result")} (${valueLabel}).`,
      selectedSkillLabel: record?.selectedSkillLabel ?? "",
      hasSelectedSkillLabel: Boolean(record?.selectedSkillLabel),
      roundIndex: Number.isInteger(Number(record?.roundIndex)) ? Number(record.roundIndex) : (Number.isInteger(Number(eventApproachContributions?.roundIndex)) ? Number(eventApproachContributions.roundIndex) : null),
      roundNumber: record?.roundNumber ?? eventApproachContributions?.roundNumber ?? null,
      playerSafe: true,
      readOnly: true
    };
  }) : [];
  return {
    available: records.length > 0,
    title: "Event Approach Contributions",
    subtitle: records.length > 0
      ? `Round ${eventApproachContributions?.roundNumber ?? records[0]?.roundNumber ?? "?"} read-only Event Approach contributions captured for later resolution.`
      : "No Event Approach contributions have been captured yet.",
    roundIndex: Number.isInteger(Number(eventApproachContributions?.roundIndex)) ? Number(eventApproachContributions.roundIndex) : null,
    roundNumber: eventApproachContributions?.roundNumber ?? records[0]?.roundNumber ?? null,
    records,
    hasRecords: records.length > 0,
    recordCount: records.length,
    playerSafe: true,
    readOnly: true
  };
}

function normalizeStationActionEventApproachContributionTally(eventApproachContributionTally = null) {
  const totalContributionValue = Number.isFinite(Number(eventApproachContributionTally?.totalContributionValue)) ? Number(eventApproachContributionTally.totalContributionValue) : 0;
  const valueLabel = `${totalContributionValue > 0 ? "+" : ""}${totalContributionValue}`;
  const contributionCount = Number.isInteger(Number(eventApproachContributionTally?.contributionCount)) ? Number(eventApproachContributionTally.contributionCount) : 0;
  const contributingStationLabels = Array.isArray(eventApproachContributionTally?.contributingStationLabels)
    ? eventApproachContributionTally.contributingStationLabels.filter((label) => typeof label === "string" && label.trim()).map((label) => label.trim())
    : [];
  return {
    available: contributionCount > 0 || eventApproachContributionTally?.hasContributions === true,
    title: "Event Approach Contribution Tally",
    subtitle: contributionCount > 0
      ? `Round ${eventApproachContributionTally?.roundNumber ?? "?"} read-only Event Approach contribution tally captured for later resolution.`
      : "No Event Approach contribution tally has been captured yet.",
    tallyKey: eventApproachContributionTally?.tallyKey ?? "eventApproach",
    tallyType: eventApproachContributionTally?.tallyType ?? "eventApproach",
    tallyLabel: eventApproachContributionTally?.tallyLabel || `Event Approach contribution tally: ${valueLabel} from ${contributionCount} contribution${contributionCount === 1 ? "" : "s"}.`,
    totalContributionValue,
    valueLabel,
    contributionCount,
    positiveContributionCount: Number.isInteger(Number(eventApproachContributionTally?.positiveContributionCount)) ? Number(eventApproachContributionTally.positiveContributionCount) : 0,
    zeroContributionCount: Number.isInteger(Number(eventApproachContributionTally?.zeroContributionCount)) ? Number(eventApproachContributionTally.zeroContributionCount) : 0,
    negativeContributionCount: Number.isInteger(Number(eventApproachContributionTally?.negativeContributionCount)) ? Number(eventApproachContributionTally.negativeContributionCount) : 0,
    contributingStationLabels,
    contributingStationLabelText: contributingStationLabels.join(", "),
    hasContributingStationLabels: contributingStationLabels.length > 0,
    roundIndex: Number.isInteger(Number(eventApproachContributionTally?.roundIndex)) ? Number(eventApproachContributionTally.roundIndex) : null,
    roundNumber: eventApproachContributionTally?.roundNumber ?? null,
    playerSafe: true,
    readOnly: true
  };
}

function normalizeStationActionEventApproachTallyStatus(eventApproachTallyStatus = null, fallbackTally = null) {
  const totalContributionValue = Number.isFinite(Number(eventApproachTallyStatus?.totalContributionValue))
    ? Number(eventApproachTallyStatus.totalContributionValue)
    : (Number.isFinite(Number(fallbackTally?.totalContributionValue)) ? Number(fallbackTally.totalContributionValue) : 0);
  const valueLabel = `${totalContributionValue > 0 ? "+" : ""}${totalContributionValue}`;
  const fallbackBand = totalContributionValue >= 3
    ? { statusKey: "strongProgress", statusLabel: "Strong Progress", statusTone: "safe" }
    : (totalContributionValue >= 1
      ? { statusKey: "partialProgress", statusLabel: "Partial Progress", statusTone: "warning" }
      : (totalContributionValue === 0
        ? { statusKey: "noNetProgress", statusLabel: "No Net Progress", statusTone: "neutral" }
        : { statusKey: "setback", statusLabel: "Setback", statusTone: "danger" }));
  const statusKey = eventApproachTallyStatus?.statusKey ?? fallbackBand.statusKey;
  const statusLabel = eventApproachTallyStatus?.statusLabel ?? fallbackBand.statusLabel;
  const statusTone = eventApproachTallyStatus?.statusTone ?? eventApproachTallyStatus?.statusCategory ?? fallbackBand.statusTone;
  const contributionCount = Number.isInteger(Number(fallbackTally?.contributionCount)) ? Number(fallbackTally.contributionCount) : 0;
  const available = eventApproachTallyStatus?.playerSafe === true || fallbackTally?.available === true || contributionCount > 0 || fallbackTally?.hasContributions === true;
  return {
    available,
    title: "Event Approach Tally Status",
    subtitle: available
      ? `Round ${eventApproachTallyStatus?.roundNumber ?? fallbackTally?.roundNumber ?? "?"} read-only Event Approach tally status captured for preview only; not applied yet.`
      : "No Event Approach tally status preview has been captured yet.",
    statusKey,
    statusLabel,
    statusTone,
    statusCategory: statusTone,
    totalContributionValue,
    valueLabel,
    previewLabel: eventApproachTallyStatus?.previewLabel || `${statusLabel} preview: ${valueLabel} Event Approach tally captured for later resolution.`,
    previewMessage: eventApproachTallyStatus?.previewMessage || `${statusLabel} preview: ${valueLabel} Event Approach tally captured as read-only and not applied yet. It does not change pressure, hazards, rewards, resources, DCs, event progress, or completion.`,
    roundIndex: Number.isInteger(Number(eventApproachTallyStatus?.roundIndex)) ? Number(eventApproachTallyStatus.roundIndex) : (Number.isInteger(Number(fallbackTally?.roundIndex)) ? Number(fallbackTally.roundIndex) : null),
    roundNumber: eventApproachTallyStatus?.roundNumber ?? fallbackTally?.roundNumber ?? null,
    playerSafe: true,
    readOnly: true
  };
}

function normalizeStationActionSupportEffects(supportEffects = null) {
  const effectsSource = Array.isArray(supportEffects) ? supportEffects : supportEffects?.effects;
  const effects = Array.isArray(effectsSource) ? effectsSource.map((effect) => ({
    sourceStationKey: effect?.sourceStationKey ?? "",
    sourceStationLabel: effect?.sourceStationLabel || humanizeIdentifier(effect?.sourceStationKey || "source station"),
    targetStationKey: effect?.targetStationKey ?? "",
    targetStationLabel: effect?.targetStationLabel || humanizeIdentifier(effect?.targetStationKey || "target station"),
    effectKey: effect?.effectKey ?? "support",
    effectType: effect?.effectType ?? "support",
    effectLabel: effect?.effectLabel || `${effect?.sourceStationLabel || "Source station"} supports ${effect?.targetStationLabel || "target station"}.`,
    roundIndex: Number.isInteger(Number(effect?.roundIndex)) ? Number(effect.roundIndex) : null,
    roundNumber: effect?.roundNumber ?? supportEffects?.roundNumber ?? null,
    playerSafe: true,
    readOnly: true
  })) : [];
  const warnings = Array.isArray(supportEffects?.warnings) ? supportEffects.warnings.filter((warning) => typeof warning === "string" && warning.trim()).map((warning) => warning.trim()) : [];
  return {
    available: effects.length > 0 || warnings.length > 0,
    title: "Station Action Effects",
    subtitle: effects.length > 0
      ? `Round ${supportEffects?.roundNumber ?? effects[0]?.roundNumber ?? "?"} read-only Support effects captured for later resolution.`
      : "No station action effects have been captured yet.",
    roundIndex: Number.isInteger(Number(supportEffects?.roundIndex)) ? Number(supportEffects.roundIndex) : null,
    roundNumber: supportEffects?.roundNumber ?? effects[0]?.roundNumber ?? null,
    effects,
    warnings,
    hasEffects: effects.length > 0,
    hasWarnings: warnings.length > 0,
    effectCount: effects.length,
    playerSafe: true,
    readOnly: true
  };
}

function normalizeSupportBonusRecord(record = {}, fallback = {}, forcedStatus = "") {
  const sourceStationKey = record?.sourceStationKey ?? "";
  const targetStationKey = record?.targetStationKey ?? fallback.targetStationKey ?? "";
  const sourceStationLabel = record?.sourceStationLabel || humanizeIdentifier(sourceStationKey || "source station");
  const targetStationLabel = record?.targetStationLabel || humanizeIdentifier(targetStationKey || "target station");
  const bonusValue = Number.isFinite(Number(record?.bonusValue)) ? Number(record.bonusValue) : 1;
  const status = forcedStatus || (record?.consumed === true ? "consumed" : "pending");
  const statusLabel = status === "applied" ? "Applied" : (status === "consumed" ? "Consumed" : "Pending");
  const bonusType = record?.bonusType ?? "circumstance";
  return {
    sourceStationKey,
    sourceStationLabel,
    targetStationKey,
    targetStationLabel,
    bonusKey: record?.bonusKey ?? "support",
    bonusType,
    bonusValue,
    bonusLabel: record?.bonusLabel || `${sourceStationLabel} supports ${targetStationLabel}: +${bonusValue} ${bonusType} bonus.`,
    readableLabel: record?.readableLabel || `${sourceStationLabel} supports ${targetStationLabel}: +${bonusValue} ${bonusType} bonus`,
    status,
    statusLabel,
    stateLabel: statusLabel,
    pending: status === "pending",
    applied: status === "applied",
    consumed: status === "consumed",
    roundIndex: Number.isInteger(Number(record?.roundIndex)) ? Number(record.roundIndex) : (Number.isInteger(Number(fallback.roundIndex)) ? Number(fallback.roundIndex) : null),
    roundNumber: record?.roundNumber ?? fallback.roundNumber ?? null,
    appliesToRoundIndex: Number.isInteger(Number(record?.appliesToRoundIndex)) ? Number(record.appliesToRoundIndex) : (Number.isInteger(Number(record?.nextRoundIndex)) ? Number(record.nextRoundIndex) : null),
    nextRoundIndex: Number.isInteger(Number(record?.nextRoundIndex)) ? Number(record.nextRoundIndex) : (Number.isInteger(Number(record?.appliesToRoundIndex)) ? Number(record.appliesToRoundIndex) : null),
    playerSafe: true,
    readOnly: true
  };
}

function normalizePendingStationActionBonuses(pendingBonuses = null) {
  const recordsSource = Array.isArray(pendingBonuses) ? pendingBonuses : pendingBonuses?.records;
  const records = Array.isArray(recordsSource) ? recordsSource.map((record) => normalizeSupportBonusRecord(record, pendingBonuses, record?.consumed === true ? "consumed" : "pending")) : [];
  return {
    available: records.length > 0,
    title: "Pending Support Bonuses",
    subtitle: records.length > 0
      ? "Read-only Support bonuses are pending for later station-check logic."
      : "No pending Support bonuses have been captured yet.",
    roundIndex: Number.isInteger(Number(pendingBonuses?.roundIndex)) ? Number(pendingBonuses.roundIndex) : null,
    roundNumber: pendingBonuses?.roundNumber ?? records[0]?.roundNumber ?? null,
    records,
    hasRecords: records.length > 0,
    recordCount: records.length,
    playerSafe: true,
    readOnly: true
  };
}

function normalizeAppliedStationActionBonuses(roundResults = []) {
  const records = [];
  if (!Array.isArray(roundResults)) return { available: false, title: "Applied Support Bonuses", subtitle: "No Support bonuses have been applied to station checks yet.", records, hasRecords: false, recordCount: 0, playerSafe: true, readOnly: true };
  roundResults.forEach((roundResult, roundIndex) => {
    const appliedByStation = isPlainObject(roundResult?.stationCheckAppliedBonuses) ? roundResult.stationCheckAppliedBonuses : {};
    for (const [stationKey, stationBonuses] of Object.entries(appliedByStation)) {
      const bonuses = Array.isArray(stationBonuses) ? stationBonuses : [];
      bonuses.filter((bonus) => bonus?.bonusKey === "support").forEach((bonus) => {
        records.push(normalizeSupportBonusRecord(bonus, { targetStationKey: stationKey, roundIndex, roundNumber: roundResult?.roundNumber ?? roundIndex + 1 }, "applied"));
      });
    }
  });
  return {
    available: records.length > 0,
    title: "Applied Support Bonuses",
    subtitle: records.length > 0 ? "Read-only Support bonuses applied to station checks." : "No Support bonuses have been applied to station checks yet.",
    records,
    hasRecords: records.length > 0,
    recordCount: records.length,
    playerSafe: true,
    readOnly: true
  };
}

function normalizeEventCompletionReadiness(state = null, latestResult = null) {
  const eventRoundCount = Number(state?.eventRoundCount) || 0;
  const finalizedRoundCount = Number(state?.finalizedRoundCount) || 0;
  const pendingRoundCount = Number(state?.pendingRoundCount) || 0;
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const completed = state?.isCompleted === true || latestResult?.completed === true;
  const resultBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const countText = completed
    ? "Event completed."
    : `${finalizedRoundCount} / ${eventRoundCount} rounds finalized. ${pendingRoundCount} ${pendingRoundCount === 1 ? "round" : "rounds"} pending.`;
  const feedbackText = latestResult?.ok === true && latestResult?.completed === true
    ? (latestResult.summaryText ?? "Completed Travel v2 event.")
    : (resultBlockedReasons[0] ?? latestResult?.error ?? "");
  const canCompleteEvent = state?.canCompleteEvent === true && !completed;
  return {
    version: state?.version ?? 1,
    title: state?.title ?? "Event Completion Readiness",
    status: state?.status ?? "blocked",
    lifecycleState: state?.lifecycleState ?? "event-completion-blocked",
    eventReady: state?.eventReady === true,
    canCompleteEvent,
    completeDisabled: !canCompleteEvent,
    completeButtonLabel: completed ? "Event Completed" : (canCompleteEvent ? "Complete Event" : "Cannot Complete Event"),
    isCompleted: completed,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    eventRoundCount,
    finalizedRoundCount,
    pendingRoundCount,
    countText,
    summaryText: state?.summaryText ?? "Finalize all Travel v2 rounds before event completion.",
    footerText: state?.footerText ?? "Finalize all Travel v2 rounds before event completion.",
    nextStepText: completed ? "Travel v2 event session is completed locally." : (state?.nextStepText ?? "Finalize all Travel v2 rounds before event completion."),
    feedbackText,
    hasFeedback: Boolean(feedbackText)
  };
}


function normalizeOutcomePackage(state = null, latestResult = null) {
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const resultBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const alreadyApplied = state?.alreadyApplied === true || latestResult?.applied === true;
  const canApply = state?.canPreparePackage === true && !alreadyApplied;
  return {
    canPreparePackage: state?.canPreparePackage === true,
    canApply,
    applyDisabled: !canApply,
    applyButtonLabel: alreadyApplied ? "Outcome Applied" : (canApply ? "Apply Outcome Package" : "Cannot Apply Outcome"),
    alreadyApplied,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    eventOutcomeKey: state?.eventOutcomeKey ?? "mixed",
    eventOutcomeLabel: state?.eventOutcomeLabel ?? "Mixed",
    summaryText: state?.summaryText ?? "Complete the Travel v2 event before preparing an outcome package.",
    nextStepText: state?.nextStepText ?? "Complete the Travel v2 event before preparing an outcome package.",
    pressureSummary: state?.pressureSummary ?? {},
    hazardSummary: Array.isArray(state?.hazardSummary) ? state.hazardSummary : [],
    shipScarCandidates: Array.isArray(state?.shipScarCandidates) ? state.shipScarCandidates : [],
    fortuneCandidates: Array.isArray(state?.fortuneCandidates) ? state.fortuneCandidates : [],
    rewardCandidates: Array.isArray(state?.rewardCandidates) ? state.rewardCandidates : [],
    consequenceCandidates: Array.isArray(state?.consequenceCandidates) ? state.consequenceCandidates : [],
    hasHazards: Array.isArray(state?.hazardSummary) && state.hazardSummary.length > 0,
    hasShipScars: Array.isArray(state?.shipScarCandidates) && state.shipScarCandidates.length > 0,
    hasFortunes: Array.isArray(state?.fortuneCandidates) && state.fortuneCandidates.length > 0,
    hasRewards: Array.isArray(state?.rewardCandidates) && state.rewardCandidates.length > 0,
    hasConsequences: Array.isArray(state?.consequenceCandidates) && state.consequenceCandidates.length > 0,
    feedbackText: latestResult?.ok === true && latestResult?.applied === true ? "Applied Travel v2 outcome package to this runner session." : (resultBlockedReasons[0] ?? latestResult?.error ?? ""),
    hasFeedback: Boolean(latestResult?.ok === true && latestResult?.applied === true || resultBlockedReasons[0] || latestResult?.error)
  };
}

function normalizeActorApplicationPreview(state = null, latestResult = null) {
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const resultBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const applied = latestResult?.ok === true && latestResult?.applied === true;
  return {
    canApply: state?.canApply === true && !applied,
    applyDisabled: state?.canApply !== true || applied,
    applyButtonLabel: applied ? "Approved Changes Applied" : (state?.canApply === true ? "Apply Approved Changes to Ship" : "Cannot Apply to Ship"),
    targetActorName: state?.targetActor?.name ?? "No ship selected",
    targetActorType: state?.targetActor?.type ?? "",
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    proposedChanges: Array.isArray(state?.proposedChanges) ? state.proposedChanges : [],
    manualFollowUps: Array.isArray(state?.manualFollowUps) ? state.manualFollowUps : [],
    hasProposedChanges: Array.isArray(state?.proposedChanges) && state.proposedChanges.length > 0,
    hasManualFollowUps: Array.isArray(state?.manualFollowUps) && state.manualFollowUps.length > 0,
    feedbackText: applied ? "Applied approved Travel v2 changes to the selected ship." : (resultBlockedReasons[0] ?? latestResult?.error ?? ""),
    hasFeedback: Boolean(applied || resultBlockedReasons[0] || latestResult?.error)
  };
}

function normalizeStationBenefitDisplay(state = null) {
  const selectedCandidate = isPlainObject(state?.selectedCandidate) ? state.selectedCandidate : null;
  const reviewRequest = {
    requested: Boolean(state?.selectedQueueKey),
    selectedQueueKey: state?.selectedQueueKey ?? null,
    status: selectedCandidate?.status ?? "blocked",
    ready: selectedCandidate?.ready === true,
    feedbackText: selectedCandidate?.ready === true
      ? "Station benefit review candidate is ready for GM/table review. No benefit has been used or applied."
      : (selectedCandidate?.reason ?? "No station benefit review requested."),
    hasFeedback: Boolean(state?.selectedQueueKey || selectedCandidate?.ready === true)
  };
  const rows = Array.isArray(state?.rows) ? state.rows.map((row) => {
    const status = typeof row?.status === "string" && row.status.trim() ? row.status.trim() : "blocked";
    const useAvailable = row?.useAvailable === true;
    const canReview = row?.canReview === true;
    const disabledReason = typeof row?.disabledReason === "string" && row.disabledReason.trim()
      ? row.disabledReason.trim()
      : (useAvailable ? "" : (status === "pending" ? "Use requests are not available in this display-only pass." : `Pending station benefit is ${status}.`));
    return {
      queueKey: row?.queueKey ?? null,
      title: row?.title || "Pending station benefit",
      sourceStationLabel: row?.sourceStationLabel || row?.sourceStation || "Source station",
      targetStationLabel: row?.targetStationLabel || row?.targetStation || "Target station",
      displaySummary: row?.playerSafeSummary || row?.publicText || "Station benefit details are unavailable.",
      status,
      statusLabel: status === "pending" ? "Pending" : humanizeIdentifier(status || "blocked"),
      requestAvailabilityLabel: useAvailable ? "Request available" : (canReview ? "Review only" : "Not ready"),
      disabledReason,
      canReview,
      useAvailable,
      reviewOnly: row?.reviewOnly !== false
    };
  }) : [];
  return {
    available: rows.length > 0,
    title: "Pending Station Benefits",
    subtitle: rows.length > 0
      ? "Display-only player-safe station benefit review. Request and use controls arrive in a later pass."
      : "No pending station benefits to display.",
    rows,
    hasRows: rows.length > 0,
    pendingCount: rows.filter((row) => row.status === "pending").length,
    disabledCount: rows.filter((row) => !row.useAvailable).length,
    reviewRequest,
    reviewOnly: true
  };
}

function normalizeRoundActionOrderReorderRequest(request = null) {
  const currentRows = Array.isArray(request?.currentRows) ? request.currentRows : [];
  const proposedRows = Array.isArray(request?.proposedRows) ? request.proposedRows : [];
  const blockedReasons = Array.isArray(request?.blockedReasons) ? request.blockedReasons : [];
  return {
    requested: request?.requested === true,
    ready: request?.ready === true,
    blocked: request?.blocked !== false,
    status: request?.status ?? "not-requested",
    feedbackText: request?.feedbackText ?? "No GM reorder review requested.",
    hasFeedback: Boolean(request?.requested === true || request?.feedbackText),
    showComparison: request?.requested === true,
    currentRows,
    proposedRows,
    hasComparisonRows: currentRows.length > 0 || proposedRows.length > 0,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    mutationNote: request?.mutationNote ?? "Review-only reorder candidate. No order is persisted or applied.",
    reviewOnly: true
  };
}

function normalizeRoundActionOrderDisplay(state = null, options = {}) {
  const rows = Array.isArray(state?.rows) ? state.rows.map((row) => ({
    stationKey: row?.stationKey ?? "",
    stationName: row?.stationName || "Station",
    orderNumber: Number.isInteger(Number(row?.orderNumber)) ? Number(row.orderNumber) : null,
    orderLabel: Number.isInteger(Number(row?.orderNumber)) ? `#${Number(row.orderNumber)}` : "—",
    selectedActionLabel: row?.selectedActionLabel || row?.actionTypeLabel || "Station order",
    status: row?.status || "needs-order",
    statusLabel: row?.statusLabel || humanizeIdentifier(row?.status || "needs-order"),
    current: row?.current === true,
    currentMarker: row?.current === true ? "Current" : "",
    resultLabel: row?.resultLabel || "Unresolved"
  })) : [];
  const blockedReasons = Array.isArray(state?.blockedReasons) ? state.blockedReasons : [];
  const blockedText = blockedReasons[0] ?? "";
  const proposedShellOrder = rows.map((row) => row.stationKey).reverse();
  return {
    available: rows.length > 0,
    title: "Round Action Order",
    subtitle: rows.length > 0
      ? "Display-only station action order for the current Travel v2 round."
      : "No round action order is available for this state.",
    roundIndex: Number.isInteger(Number(state?.roundIndex)) ? Number(state.roundIndex) : -1,
    roundNumber: state?.roundNumber ?? null,
    phase: state?.phase ?? "roundReveal",
    rows,
    hasRows: rows.length > 0,
    rowCount: rows.length,
    hasCurrent: state?.hasCurrent === true,
    blocked: state?.blocked === true,
    blockedReasons,
    blockedText,
    hasBlockedText: Boolean(blockedText),
    canRequestReorderReview: rows.length > 1,
    proposedShellOrder,
    proposedShellOrderCsv: proposedShellOrder.join(","),
    footerText: state?.footerText || (rows.length > 0 ? "Round action order is display-only." : "No round action-order rows are available."),
    reorderRequest: normalizeRoundActionOrderReorderRequest(state?.reorderRequest),
    commitResult: normalizeRoundActionOrderCommitResult(options.commitResult, rows, options),
    persistResult: normalizeRoundActionOrderPersistResult(options.persistResult, rows, options),
    canPersistCommittedOrder: options.hasCommittedOrder === true && (options.isGM === true || options.user?.isGM === true),
    readOnly: true
  };
}

function orderLabelsForKeys(keys = [], rows = []) {
  const rowByKey = new Map(rows.map((row) => [row.stationKey, row]));
  return (Array.isArray(keys) ? keys : []).map((stationKey, index) => {
    const row = rowByKey.get(stationKey);
    const stationName = row?.stationName || humanizeIdentifier(stationKey || "station");
    return {
      stationKey,
      stationName,
      orderNumber: index + 1,
      orderLabel: `#${index + 1}`,
      displayText: `#${index + 1} · ${stationName}`,
      playerSafe: true
    };
  });
}

function normalizeRoundActionOrderPersistResult(result = null, rows = [], options = {}) {
  if (!isPlainObject(result)) {
    return { available: false, hasFeedback: false, status: "none", title: "Latest Persistence Result", summaryText: "No committed round action-order persistence has been attempted.", readOnly: true };
  }
  const isGm = options.isGM === true || options.user?.isGM === true;
  const blockedReasons = Array.isArray(result.blockedReasons) ? result.blockedReasons.filter((reason) => typeof reason === "string" && reason.trim()) : [];
  const status = result.persisted === true ? "persisted" : (result.duplicate === true ? "duplicate" : (result.blocked === true || result.ok === false ? "blocked" : "review"));
  const keys = Array.isArray(result.persistedRecord?.order) ? result.persistedRecord.order : (Array.isArray(result.persistedRecord?.stationOrder) ? result.persistedRecord.stationOrder : []);
  const persistedRows = orderLabelsForKeys(keys, rows);
  const orderText = persistedRows.length > 0 ? persistedRows.map((row) => row.displayText).join(" → ") : "No persisted order listed.";
  const summaryText = typeof result.summaryText === "string" && result.summaryText.trim()
    ? result.summaryText.trim()
    : (status === "persisted" ? `Committed action order persisted: ${orderText}.` : (status === "duplicate" ? `Committed action order was already persisted: ${orderText}. No local session changes were made.` : `Committed action order persistence blocked: ${blockedReasons[0] ?? "No reason provided."}`));
  return {
    available: true,
    hasFeedback: true,
    status,
    statusLabel: status === "persisted" ? "Persisted" : (status === "duplicate" ? "Duplicate" : (status === "blocked" ? "Blocked" : "Review")),
    title: "Latest Persistence Result",
    summaryText,
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    persistedRows: isGm || status !== "blocked" ? persistedRows : [],
    hasPersistedRows: (isGm || status !== "blocked") && persistedRows.length > 0,
    persistedOrderText: isGm || status !== "blocked" ? orderText : "",
    playerSafe: !isGm,
    readOnly: true
  };
}

function normalizeRoundActionOrderCommitResult(result = null, rows = [], options = {}) {
  if (!isPlainObject(result)) {
    return { available: false, hasFeedback: false, status: "none", title: "Latest Commit Result", summaryText: "No round action-order commit has been attempted.", readOnly: true };
  }
  const isGm = options.isGM === true || options.user?.isGM === true;
  const blockedReasons = Array.isArray(result.blockedReasons) ? result.blockedReasons.filter((reason) => typeof reason === "string" && reason.trim()) : [];
  const status = result.committed === true ? "committed" : (result.duplicate === true ? "duplicate" : (result.blocked === true || result.ok === false ? "blocked" : "review"));
  const committedRows = orderLabelsForKeys(result.committedOrder, rows);
  const previousRows = orderLabelsForKeys(result.previousOrder, rows);
  const safeAudit = isGm && isPlainObject(result.auditRecord) ? result.auditRecord : {};
  const roundNumber = result.roundNumber ?? safeAudit.roundNumber ?? null;
  const roundIndex = Number.isInteger(Number(result.roundIndex ?? safeAudit.roundIndex)) ? Number(result.roundIndex ?? safeAudit.roundIndex) : null;
  const orderText = committedRows.length > 0 ? committedRows.map((row) => row.displayText).join(" → ") : "No committed order listed.";
  const previousOrderText = previousRows.length > 0 ? previousRows.map((row) => row.displayText).join(" → ") : "No previous order listed.";
  const roundText = roundNumber ? `Round ${roundNumber}` : (roundIndex !== null ? `Round index ${roundIndex}` : "Current round");
  const summaryText = status === "committed"
    ? `${roundText} action order committed: ${orderText}.`
    : (status === "duplicate"
      ? `${roundText} already had this committed action order: ${orderText}. No session changes were made.`
      : `${roundText} action order commit blocked: ${blockedReasons[0] ?? result.reason ?? "No reason provided."}`);
  return {
    available: true,
    hasFeedback: true,
    status,
    statusLabel: status === "committed" ? "Committed" : (status === "duplicate" ? "Duplicate" : (status === "blocked" ? "Blocked" : "Review")),
    title: "Latest Commit Result",
    summaryText,
    reason: typeof result.reason === "string" ? result.reason : "",
    blockedReasons,
    blockedReason: blockedReasons[0] ?? "",
    roundNumber,
    roundIndex,
    hasRoundMetadata: roundNumber !== null || roundIndex !== null,
    committedRows: isGm || status !== "blocked" ? committedRows : [],
    previousRows: isGm ? previousRows : [],
    hasCommittedRows: (isGm || status !== "blocked") && committedRows.length > 0,
    hasPreviousRows: isGm && previousRows.length > 0,
    committedOrderText: isGm || status !== "blocked" ? orderText : "",
    previousOrderText: isGm ? previousOrderText : "",
    timestamp: isGm && typeof safeAudit.timestamp === "string" ? safeAudit.timestamp : "",
    source: isGm && typeof safeAudit.source === "string" ? safeAudit.source : "",
    userName: isGm && typeof safeAudit.userName === "string" ? safeAudit.userName : "",
    hasAuditMetadata: Boolean(isGm && (safeAudit.timestamp || safeAudit.source || safeAudit.userName)),
    playerSafe: !isGm,
    readOnly: true
  };
}

function normalizePreviewRow(row = {}, applicationState = null, correctionState = {}) {
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
  const rowApplicationState = applicationState
    ? prepareTravelV2PressureApplicationState(applicationState.session, { selectedOutcomeKey: outcomeKey })
    : null;
  const blockedReasons = Array.isArray(rowApplicationState?.blockedReasons) ? rowApplicationState.blockedReasons : [];
  const effectiveOutcomeKey = correctionState.effectiveOutcomeKey ?? rowApplicationState?.applicationRecord?.outcomeKey ?? "";
  const isEffectiveAppliedOutcome = Boolean(effectiveOutcomeKey && effectiveOutcomeKey === outcomeKey);
  const hasEffectiveApplication = Boolean(correctionState.hasEffectiveApplication);
  const sessionCompleted = correctionState.sessionCompleted === true;
  const hasRealOutcomeKey = Boolean(outcomeKey && outcomeKey !== "skipped");
  const canCorrectPressure = hasEffectiveApplication
    && row.ok === true
    && hasRealOutcomeKey
    && !isEffectiveAppliedOutcome
    && !sessionCompleted;
  const correctionBlockedReasons = [];
  if (!hasEffectiveApplication) correctionBlockedReasons.push("Current Travel v2 round has no pressure application record to correct.");
  if (sessionCompleted) correctionBlockedReasons.push("Completed Travel v2 runner sessions cannot be corrected.");
  if (!hasRealOutcomeKey) correctionBlockedReasons.push("Correction requires a real Travel v2 pressure outcome key.");
  if (row.ok !== true) correctionBlockedReasons.push(`Selected Travel v2 pressure correction outcome is not available: ${outcomeKey}.`);
  if (isEffectiveAppliedOutcome) correctionBlockedReasons.push("Corrected Travel v2 pressure outcome must be different from the prior applied outcome.");
  return {
    outcomeKey,
    outcomeLabel: row.outcomeLabel || humanizeIdentifier(outcomeKey),
    tone: normalizeOutcomeTone(row),
    ok: row.ok === true,
    requestCount: Number(row.requestCount) || pressureChips.length,
    hasRequests: row.hasRequests === true || pressureChips.length > 0,
    summaryText: typeof row.summaryText === "string" && row.summaryText.trim() ? row.summaryText.trim() : "No Travel v2 pressure change.",
    pressureChips,
    errors: Array.isArray(row.errors) ? row.errors : [],
    canApplyPressure: rowApplicationState?.canApply === true,
    pressureApplyDisabled: rowApplicationState?.canApply !== true,
    pressureApplyBlockedReason: blockedReasons[0] ?? "",
    pressureApplyLabel: `Apply ${row.outcomeLabel || humanizeIdentifier(outcomeKey)}`,
    canCorrectPressure,
    pressureCorrectionDisabled: !canCorrectPressure,
    pressureCorrectionBlockedReason: correctionBlockedReasons[0] ?? "",
    pressureCorrectionLabel: `Correct to ${row.outcomeLabel || humanizeIdentifier(outcomeKey)}`,
    isEffectiveAppliedOutcome
  };
}

export function prepareTravelEventRunnerV2PreviewPanelState(appState = {}) {
  const preview = isPlainObject(appState.travelV2Preview) ? appState.travelV2Preview : {};
  const appSessionHasPressureApplications = isPlainObject(appState.session?.travelV2PressureApplications) || Array.isArray(appState.session?.travelV2PressureApplications);
  const runnerSession = appSessionHasPressureApplications ? appState.session : (isPlainObject(appState.travelV2PressureRunnerSession) ? appState.travelV2PressureRunnerSession : appState.session);
  const applicationState = isPlainObject(runnerSession) ? { session: runnerSession } : null;
  const currentApplicationState = isPlainObject(runnerSession) ? prepareTravelV2PressureApplicationState(runnerSession) : null;
  const effectiveOutcomeKey = currentApplicationState?.applicationRecord?.outcomeKey ?? "";
  const correctionState = {
    hasEffectiveApplication: Boolean(currentApplicationState?.applicationRecord),
    effectiveOutcomeKey,
    sessionCompleted: currentApplicationState?.sessionCompleted === true || runnerSession?.status === "completed" || appState.isCompleted === true
  };
  const rows = Array.isArray(preview.rows) ? preview.rows.map((row) => normalizePreviewRow(row, applicationState, correctionState)) : [];
  const available = preview.ok === true && rows.length > 0;
  const latestResult = isPlainObject(appState.travelV2PressureApplicationResult) ? appState.travelV2PressureApplicationResult : null;
  const latestFinalizationResult = isPlainObject(appState.travelV2RoundFinalizationResult) ? appState.travelV2RoundFinalizationResult : null;
  const latestCorrectionResult = isPlainObject(appState.travelV2PressureCorrectionResult) ? appState.travelV2PressureCorrectionResult : null;
  const latestBlockedReasons = Array.isArray(latestResult?.blockedReasons) ? latestResult.blockedReasons : [];
  const latestCorrectionBlockedReasons = Array.isArray(latestCorrectionResult?.blockedReasons) ? latestCorrectionResult.blockedReasons : [];
  const latestOutcomeLabel = latestResult?.selectedOutcomeKey ? humanizeIdentifier(latestResult.selectedOutcomeKey) : "";
  const previousCorrectionOutcomeLabel = latestCorrectionResult?.previousOutcomeKey ? humanizeIdentifier(latestCorrectionResult.previousOutcomeKey) : "";
  const correctedOutcomeLabel = latestCorrectionResult?.selectedOutcomeKey ? humanizeIdentifier(latestCorrectionResult.selectedOutcomeKey) : "";
  const correctionFeedbackText = latestCorrectionResult?.ok === true && latestCorrectionResult?.corrected === true
    ? `Corrected Travel v2 pressure outcome: ${previousCorrectionOutcomeLabel} → ${correctedOutcomeLabel}.`
    : (latestCorrectionBlockedReasons[0] ?? latestCorrectionResult?.error ?? "");
  const feedbackText = correctionFeedbackText || (latestResult?.ok === true && latestResult?.applied === true
    ? `Applied Travel v2 pressure outcome: ${latestOutcomeLabel}.`
    : (latestBlockedReasons[0] ?? latestResult?.error ?? ""));
  const travelV2RoundFinalizationState = normalizeFinalizationState(
    isPlainObject(runnerSession) ? prepareTravelV2RoundFinalizationState(runnerSession) : null,
    latestFinalizationResult
  );
  const resolutionRecords = recordsFromContainer(runnerSession?.travelV2RoundResolutions);
  const latestResolutionRecord = resolutionRecords.length > 0 ? resolutionRecords[resolutionRecords.length - 1] : null;
  const stationActionResolutionSummary = normalizeStationActionResolutionSummary(latestFinalizationResult?.stationActionSummary ?? latestResolutionRecord?.stationActionSummary);
  const stationActionSupportEffects = normalizeStationActionSupportEffects(latestFinalizationResult?.stationActionSupportEffects ?? latestResolutionRecord?.stationActionSupportEffects);
  const stationActionEventApproachEffects = normalizeStationActionEventApproachEffects(latestFinalizationResult?.stationActionEventApproachEffects ?? latestResolutionRecord?.stationActionEventApproachEffects);
  const stationActionEventApproachContributions = normalizeStationActionEventApproachContributions(latestFinalizationResult?.stationActionEventApproachContributions ?? latestFinalizationResult?.eventApproachContributions ?? latestResolutionRecord?.stationActionEventApproachContributions ?? latestResolutionRecord?.eventApproachContributions);
  const stationActionEventApproachContributionTally = normalizeStationActionEventApproachContributionTally(latestFinalizationResult?.stationActionEventApproachContributionTally ?? latestFinalizationResult?.eventApproachContributionTally ?? latestResolutionRecord?.stationActionEventApproachContributionTally ?? latestResolutionRecord?.eventApproachContributionTally);
  const stationActionEventApproachTallyStatus = normalizeStationActionEventApproachTallyStatus(latestFinalizationResult?.stationActionEventApproachTallyStatus ?? latestFinalizationResult?.eventApproachTallyStatus ?? latestResolutionRecord?.stationActionEventApproachTallyStatus ?? latestResolutionRecord?.eventApproachTallyStatus, stationActionEventApproachContributionTally);
  const pendingStationActionBonuses = normalizePendingStationActionBonuses(latestFinalizationResult?.pendingStationActionBonuses ?? latestResolutionRecord?.pendingStationActionBonuses ?? runnerSession?.travelV2PendingStationActionBonuses);
  const travelV2ActiveCards = normalizeActiveTravelCards(runnerSession, { user: appState.user, isGM: appState.isGM === true }, runnerSession?.travelV2ActiveCards, latestResolutionRecord?.travelV2ActiveCards, latestFinalizationResult?.travelV2ActiveCards);
  const travelV2ActiveCardApplicationPreviews = travelV2ActiveCards.travelV2ActiveCardApplicationPreviews;
  const appliedStationActionBonuses = normalizeAppliedStationActionBonuses(runnerSession?.roundResults);
  const supportBonusStatusAvailable = stationActionSupportEffects.available || pendingStationActionBonuses.hasRecords || appliedStationActionBonuses.hasRecords;
  const stationActionEffectsAvailable = supportBonusStatusAvailable || stationActionEventApproachEffects.available || stationActionEventApproachContributions.available || stationActionEventApproachContributionTally.available || stationActionEventApproachTallyStatus.available;
  const latestEventCompletionResult = isPlainObject(appState.travelV2EventCompletionResult) ? appState.travelV2EventCompletionResult : null;
  const travelV2EventCompletionReadiness = normalizeEventCompletionReadiness(
    isPlainObject(runnerSession) ? prepareTravelV2EventCompletionReadiness(runnerSession) : null,
    latestEventCompletionResult
  );
  const latestOutcomeApplicationResult = isPlainObject(appState.travelV2EventOutcomeApplicationResult) ? appState.travelV2EventOutcomeApplicationResult : null;
  const travelV2EventOutcomePackage = normalizeOutcomePackage(
    isPlainObject(runnerSession) ? prepareTravelV2EventOutcomePackage(runnerSession) : null,
    latestOutcomeApplicationResult
  );
  const latestActorApplicationResult = isPlainObject(appState.travelV2ActorApplicationResult) ? appState.travelV2ActorApplicationResult : null;
  const actorPreviewSource = isPlainObject(runnerSession) ? prepareTravelV2ActorApplicationPreviewFromSession(runnerSession, appState.actor, { session: runnerSession }) : null;
  const travelV2ActorApplicationPreview = normalizeActorApplicationPreview(actorPreviewSource, latestActorApplicationResult);
  const travelV2FollowUps = prepareTravelV2FollowUpState(appState.actor, latestActorApplicationResult?.applicationRecord ?? actorPreviewSource, { session: runnerSession });
  const stationBenefitDisplay = normalizeStationBenefitDisplay(appState.travelV2StationBenefitUseReviewPlayerState);
  const currentOrderState = isPlainObject(runnerSession?.travelV2RoundActionOrder?.rounds) ? (runnerSession.travelV2RoundActionOrder.rounds[String(runnerSession.currentRoundIndex ?? 0)] ?? runnerSession.travelV2RoundActionOrder.rounds[runnerSession.currentRoundIndex ?? 0] ?? null) : null;
  const hasCommittedOrder = isPlainObject(currentOrderState) && (Array.isArray(currentOrderState.order) || Array.isArray(currentOrderState.stationOrder));
  const roundActionOrderDisplay = normalizeRoundActionOrderDisplay(isPlainObject(runnerSession) ? prepareTravelV2RoundActionOrderState(runnerSession, { user: appState.user, isGM: appState.isGM === true, travelV2RoundActionOrderReorderRequested: appState.travelV2RoundActionOrderReorderRequested === true, proposedOrder: appState.travelV2ProposedRoundActionOrder }) : null, { user: appState.user, isGM: appState.isGM === true, commitResult: appState.travelV2RoundActionOrderCommitResult, persistResult: appState.travelV2RoundActionOrderPersistResult, hasCommittedOrder });
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
    travelV2RoundFinalizationState,
    roundFinalization: travelV2RoundFinalizationState,
    stationActionResolutionSummary,
    travelV2StationActionResolutionSummary: stationActionResolutionSummary,
    stationActionSupportEffects,
    travelV2StationActionSupportEffects: stationActionSupportEffects,
    stationActionEventApproachEffects,
    travelV2StationActionEventApproachEffects: stationActionEventApproachEffects,
    stationActionEventApproachContributions,
    travelV2StationActionEventApproachContributions: stationActionEventApproachContributions,
    stationActionEventApproachContributionTally,
    travelV2StationActionEventApproachContributionTally: stationActionEventApproachContributionTally,
    stationActionEventApproachTallyStatus,
    travelV2StationActionEventApproachTallyStatus: stationActionEventApproachTallyStatus,
    supportBonusStatusAvailable,
    stationActionEffectsAvailable,
    pendingStationActionBonuses,
    travelV2PendingStationActionBonuses: pendingStationActionBonuses,
    appliedStationActionBonuses,
    travelV2AppliedStationActionBonuses: appliedStationActionBonuses,
    travelV2ActiveCards,
    activeTravelCards: travelV2ActiveCards,
    travelV2ActiveCardApplicationPreviews,
    activeCardApplicationPreviews: travelV2ActiveCardApplicationPreviews,
    travelV2EventCompletionReadiness,
    eventCompletionReadiness: travelV2EventCompletionReadiness,
    travelV2EventOutcomePackage,
    eventOutcomePackage: travelV2EventOutcomePackage,
    travelV2ActorApplicationPreview,
    actorApplicationPreview: travelV2ActorApplicationPreview,
    travelV2FollowUps,
    followUps: travelV2FollowUps,
    stationBenefitDisplay,
    travelV2StationBenefitDisplay: stationBenefitDisplay,
    roundActionOrderDisplay,
    travelV2RoundActionOrderDisplay: roundActionOrderDisplay,
    pressureApplication: {
      canApply: currentApplicationState?.canApply === true,
      alreadyApplied: currentApplicationState?.alreadyApplied === true,
      appliedOutcomeLabel: currentApplicationState?.applicationRecord?.outcomeKey ? humanizeIdentifier(currentApplicationState.applicationRecord.outcomeKey) : "",
      blockedReasons: Array.isArray(currentApplicationState?.blockedReasons) ? currentApplicationState.blockedReasons : [],
      feedbackText,
      hasFeedback: Boolean(feedbackText)
    },
    errors: Array.isArray(preview.errors) ? preview.errors : [],
    footerText: "GM-only session-local controls apply pressure to this runner session only. They do not notify players, send chat, emit sockets, or change actors."
  };
}

export default prepareTravelEventRunnerV2PreviewPanelState;
