import { prepareTravelV2InterStationHelpActions } from "./travel-v2-inter-station-help-actions.js";

export const TRAVEL_V2_INTER_STATION_HELP_APPLICATION_VERSION = 2;
const SUCCESS = new Set(["success", "criticalSuccess"]);
const RESOLVED = new Set(["criticalSuccess", "success", "failure", "criticalFailure", "skipped"]);

function isPlainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function cloneData(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === "string" ? value.trim() : ""; }
function uniqueStrings(values = []) { return Array.from(new Set(values.map(text).filter(Boolean))); }
function strictIntegerOrNull(value) { if (typeof value === "number") return Number.isInteger(value) ? value : null; if (typeof value !== "string" || value.trim() === "") return null; if (!/^-?\d+$/.test(value.trim())) return null; const number = Number(value.trim()); return Number.isInteger(number) ? number : null; }
function positiveIntegerOrNull(value) { if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null; if (typeof value !== "string") return null; const normalized = value.trim(); if (normalized === "" || !/^\d+$/.test(normalized)) return null; const number = Number(normalized); return Number.isInteger(number) && number > 0 ? number : null; }
function stablePart(value) { const raw = value === null || value === undefined ? "" : String(value).trim(); return raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "none"; }
function applicationKeyFor(queueKey = "") { return `inter-station-help-application:${queueKey}`; }
function nowIso(options = {}) { return typeof options.now === "string" && options.now ? options.now : new Date().toISOString(); }
function queueRecords(session = {}) { return Array.isArray(session?.travelV2PendingStationBenefits) ? session.travelV2PendingStationBenefits : []; }
function applicationRecords(session = {}) { return Array.isArray(session?.travelV2InterStationHelpApplications?.records) ? session.travelV2InterStationHelpApplications.records : []; }
function stationResult(session = {}, roundIndex, stationKey = "") { return session?.roundResults?.[roundIndex]?.stationResults?.[stationKey]; }

function isLegacySlice06Application(app = {}) {
  if (!isPlainObject(app)) return false;
  return strictIntegerOrNull(app.version) === 1
    && app.applied === true
    && text(app.status) === "applied"
    && text(app.benefitKind) === "dcReduction"
    && positiveIntegerOrNull(app.magnitude) !== null
    && !Object.hasOwn(app, "baseMagnitude")
    && !Object.hasOwn(app, "effectiveMagnitude")
    && !Object.hasOwn(app, "criticalMagnitude")
    && !Object.hasOwn(app, "strengthened")
    && !Object.hasOwn(app, "strengtheningMode")
    && !Object.hasOwn(app, "effectSource")
    && !Object.hasOwn(app, "criticalSuccess");
}

function isCompleteSlice07Application(app = {}) {
  if (!isPlainObject(app)) return false;
  return strictIntegerOrNull(app.version) === 2
    && app.applied === true
    && text(app.status) === "applied"
    && text(app.benefitKind) === "dcReduction"
    && Object.hasOwn(app, "baseMagnitude")
    && Object.hasOwn(app, "magnitude")
    && Object.hasOwn(app, "effectiveMagnitude")
    && Object.hasOwn(app, "strengthened")
    && Object.hasOwn(app, "strengtheningMode")
    && Object.hasOwn(app, "effectSource")
    && Object.hasOwn(app, "criticalSuccess")
    && typeof app.strengthened === "boolean"
    && typeof app.criticalSuccess === "boolean";
}

function fallbackBaseDcForReview(session = {}, roundIndex, stationKey = "") {
  const round = session?.event?.rounds?.[roundIndex] ?? {};
  const card = (Array.isArray(round.stationCards) ? round.stationCards : []).find((entry) => text(entry?.stationKey ?? entry?.key) === stationKey) ?? {};
  const prompt = isPlainObject(round.stationPrompts) ? round.stationPrompts[stationKey] ?? {} : {};
  for (const value of [card.dc, card.DC, prompt.dc, prompt.DC]) { const number = Number(value); if (Number.isFinite(number) && number > 0) return number; }
  const eventDc = Number(session?.event?.baseDC);
  const modifier = Number(card.dcModifier ?? prompt.dcModifier);
  if (Number.isFinite(eventDc) && eventDc > 0 && Number.isFinite(modifier)) return eventDc + modifier;
  return Number.isFinite(eventDc) && eventDc > 0 ? eventDc : null;
}

function criticalMetadataMatches(recordMetadata, actionMetadata) {
  return text(recordMetadata?.strengthening) === text(actionMetadata?.strengthening)
    && text(recordMetadata?.benefitKind) === text(actionMetadata?.benefitKind)
    && positiveIntegerOrNull(recordMetadata?.magnitude) === positiveIntegerOrNull(actionMetadata?.magnitude);
}

function supportedCriticalMetadata(metadata = {}, baseMagnitude = null) {
  const criticalMagnitude = positiveIntegerOrNull(metadata?.magnitude);
  if (!isPlainObject(metadata)) return { supported: false, reason: null, criticalMagnitude: null };
  if (text(metadata.strengthening) !== "replaceMagnitude" || text(metadata.benefitKind) !== "dcReduction" || criticalMagnitude === null) {
    return { supported: false, reason: "critical-success-strengthening-unsupported", criticalMagnitude };
  }
  if (criticalMagnitude <= baseMagnitude) return { supported: false, reason: "critical-success-strengthening-not-stronger", criticalMagnitude };
  return { supported: true, reason: null, criticalMagnitude };
}

export function resolveTravelV2InterStationHelpBenefit({ matchedAction = {}, record = {}, sourceResult = "" } = {}) {
  const blockedReasons = [];
  const warnings = [];
  const benefitKind = text(matchedAction.benefitKind ?? record.benefitKind);
  const baseMagnitude = positiveIntegerOrNull(matchedAction.magnitude);
  const currentSourceResult = text(sourceResult);
  const recordResultBand = text(record.resultBand);
  const recordCriticalSuccess = record.criticalSuccess === true;
  if (benefitKind !== "dcReduction") blockedReasons.push("inter-station-help-application-kind-unsupported");
  if (baseMagnitude === null) blockedReasons.push("inter-station-help-application-magnitude-invalid");
  if (recordResultBand !== currentSourceResult) blockedReasons.push("inter-station-help-source-result-mismatch");
  if (recordCriticalSuccess !== (currentSourceResult === "criticalSuccess")) blockedReasons.push("inter-station-help-critical-success-flag-mismatch");
  const authored = supportedCriticalMetadata(matchedAction.criticalSuccessMetadata, baseMagnitude);
  if (authored.reason) warnings.push(authored.reason);
  const criticalSuccess = currentSourceResult === "criticalSuccess" && recordResultBand === "criticalSuccess" && recordCriticalSuccess === true;
  if (criticalSuccess && authored.supported && !criticalMetadataMatches(record.criticalSuccessMetadata, matchedAction.criticalSuccessMetadata)) blockedReasons.push("inter-station-help-critical-success-metadata-mismatch");
  const strengthened = blockedReasons.length === 0 && criticalSuccess && authored.supported === true;
  const criticalMagnitude = strengthened ? authored.criticalMagnitude : null;
  const effectiveMagnitude = strengthened ? criticalMagnitude : baseMagnitude;
  return { ok: blockedReasons.length === 0 && baseMagnitude !== null && benefitKind === "dcReduction", benefitKind, baseMagnitude, criticalMagnitude, effectiveMagnitude, magnitude: effectiveMagnitude, dcReduction: effectiveMagnitude, strengthened, strengtheningMode: strengthened ? "replaceMagnitude" : null, effectSource: strengthened ? "criticalSuccess" : "base", criticalSuccess, blockedReasons: uniqueStrings(blockedReasons), warnings: uniqueStrings(warnings) };
}

function blocked(session, queueKey, reasons, record = null) { return { version: TRAVEL_V2_INTER_STATION_HELP_APPLICATION_VERSION, ok: false, applied: false, duplicate: reasons.includes("inter-station-help-application-already-applied"), shouldAdoptSession: false, nextSession: cloneData(session), queueKey: queueKey || null, record: record ? cloneData(record) : null, blockedReasons: uniqueStrings(reasons), status: { ok: false, applied: false, status: "blocked", message: reasons[0] || "Inter-Station Help application was blocked.", blockedReasons: uniqueStrings(reasons), queueKey: queueKey || null } }; }

function validate(session = {}, selection = {}, options = {}) {
  const reasons = [];
  const allowAlreadyApplied = options.allowAlreadyApplied === true;
  const queueKey = text(selection.queueKey ?? selection.selectedQueueKey);
  const expectedApplicationKey = applicationKeyFor(queueKey);
  if (!isPlainObject(session)) reasons.push("travel-v2-session-required");
  if (!queueKey) reasons.push("missing-queue-key");
  const matches = queueKey ? queueRecords(session).map((record, index) => ({ record, index })).filter(({ record }) => text(record?.queueKey) === queueKey) : [];
  if (queueKey && matches.length === 0) reasons.push("unknown-queue-key");
  if (matches.length > 1) reasons.push("duplicate-queue-key");
  const match = matches.length === 1 ? matches[0] : null;
  const record = match?.record ?? null;
  if (!record) return { ok: false, queueKey, reasons: uniqueStrings(reasons), record: null, index: -1, matchedAction: null, fallbackBaseDc: null, applicationKey: expectedApplicationKey };

  const status = text(record.status);
  const alreadyApplied = record.applied === true;
  if (status !== "used" || record.used !== true || record.consumed !== true) reasons.push("inter-station-help-application-record-not-used");
  if (alreadyApplied && !allowAlreadyApplied) reasons.push("inter-station-help-application-already-applied");
  if (allowAlreadyApplied && alreadyApplied !== true) reasons.push("inter-station-help-application-record-not-applied");
  if (allowAlreadyApplied && text(record.applicationKey) !== expectedApplicationKey) reasons.push("inter-station-help-application-key-mismatch");
  if (["dismissed", "expired", "blocked"].includes(status) || record.dismissed === true || record.expired === true || record.blocked === true) reasons.push(`inter-station-help-application-record-${status || "blocked"}`);

  const currentRoundIndex = strictIntegerOrNull(session.currentRoundIndex);
  const roundIndex = strictIntegerOrNull(record.roundIndex);
  if (currentRoundIndex === null) reasons.push("missing-current-round");
  if (roundIndex === null) reasons.push("malformed-round");
  if (currentRoundIndex !== null && roundIndex !== null && currentRoundIndex !== roundIndex) reasons.push("stale-round");

  const actionId = text(record.actionId);
  const authoredActionId = text(record.authoredActionId);
  if (!actionId) reasons.push("inter-station-help-application-action-id-required");
  if (!authoredActionId) reasons.push("inter-station-help-application-authored-action-id-required");
  if (actionId && authoredActionId && actionId !== authoredActionId) reasons.push("inter-station-help-application-action-id-mismatch");
  const sourceStationKey = text(record.sourceStationKey ?? record.sourceStation);
  const targetStationKey = text(record.targetStationKey ?? record.targetStation);
  const expectedKey = currentRoundIndex !== null && actionId && sourceStationKey && targetStationKey ? ["inter-station-help", currentRoundIndex, actionId, sourceStationKey, targetStationKey].map(stablePart).join(":") : "";
  if (expectedKey && (text(record.pendingHelpKey) !== expectedKey || text(record.dedupeKey) !== expectedKey)) reasons.push("inter-station-help-application-action-mismatch");

  const prepared = currentRoundIndex === null ? null : prepareTravelV2InterStationHelpActions(session, { ...options, roundIndex: currentRoundIndex, includeUnavailable: true });
  const order = Array.isArray(prepared?.stationOrder) ? prepared.stationOrder : [];
  if (prepared?.stationOrderLocked !== true) reasons.push("station-order-not-locked");
  const matchedAction = prepared?.helpActions?.find((action) => text(action.actionId) === actionId && text(action.actionId) === authoredActionId && text(action.sourceStationKey) === sourceStationKey && text(action.targetStationKey) === targetStationKey && strictIntegerOrNull(action.roundIndex) === currentRoundIndex) ?? null;
  if (!matchedAction) reasons.push("inter-station-help-application-action-mismatch");
  else {
    if (text(record.benefitKind) !== text(matchedAction.benefitKind)) reasons.push("inter-station-help-application-benefit-mismatch");
    if (positiveIntegerOrNull(record.magnitude) !== positiveIntegerOrNull(matchedAction.magnitude)) reasons.push("inter-station-help-application-magnitude-mismatch");
    if (text(record.expires) !== text(matchedAction.expires)) reasons.push("inter-station-help-application-expiration-mismatch");
    if (matchedAction.available !== true || matchedAction.targetLaterInOrder !== true) reasons.push("target-station-not-later-in-order");
  }
  if (text(record.benefitKind) !== "dcReduction") reasons.push("inter-station-help-application-kind-unsupported");
  if (positiveIntegerOrNull(record.magnitude) === null) reasons.push("inter-station-help-application-magnitude-invalid");
  const sourceIndex = order.indexOf(sourceStationKey); const targetIndex = order.indexOf(targetStationKey);
  if (sourceIndex < 0) reasons.push("source-station-inactive");
  if (targetIndex < 0) reasons.push("target-station-inactive");
  if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex >= targetIndex) reasons.push("source-not-before-target");
  if (!SUCCESS.has(text(stationResult(session, roundIndex, sourceStationKey)))) reasons.push("source-result-not-successful");
  if (!allowAlreadyApplied && RESOLVED.has(text(stationResult(session, roundIndex, targetStationKey)))) reasons.push("target-station-already-resolved");
  const fallbackBaseDc = roundIndex === null ? null : fallbackBaseDcForReview(session, roundIndex, targetStationKey);
  if (!Number.isFinite(fallbackBaseDc)) reasons.push("missing-base-dc");
  if (!allowAlreadyApplied && applicationRecords(session).some((record) => text(record.applicationKey) === expectedApplicationKey)) reasons.push("inter-station-help-application-already-applied");
  return { ok: reasons.length === 0, queueKey, reasons: uniqueStrings(reasons), record, index: match.index, matchedAction, fallbackBaseDc, applicationKey: expectedApplicationKey };
}

export function prepareTravelV2InterStationHelpApplicationReview(session = {}, selection = {}, options = {}) {
  const validation = validate(session, selection, options);
  if (!validation.record) return blocked(session, validation.queueKey, validation.reasons);
  const resolved = resolveTravelV2InterStationHelpBenefit({ matchedAction: validation.matchedAction, record: validation.record, sourceResult: stationResult(session, strictIntegerOrNull(validation.record.roundIndex), text(validation.record.sourceStationKey)) });
  const reviewOk = validation.ok === true && resolved.ok === true;
  const magnitude = reviewOk ? resolved.effectiveMagnitude : null;
  const fallbackEffectiveDc = reviewOk && Number.isFinite(validation.fallbackBaseDc) && magnitude !== null ? Math.max(0, validation.fallbackBaseDc - magnitude) : null;
  const criticalSuccessNote = !reviewOk ? "" : (resolved.strengthened ? `Critical success strengthens this Help effect from DC −${resolved.baseMagnitude} to DC −${resolved.effectiveMagnitude}.` : (validation.record.criticalSuccess === true && resolved.warnings.length > 0 ? `Critical-success strengthening is not supported by this slice’s authored metadata. The normal DC −${resolved.baseMagnitude} Help effect will apply.` : ""));
  return { version: TRAVEL_V2_INTER_STATION_HELP_APPLICATION_VERSION, ok: reviewOk, canApply: reviewOk && options.canApply === true, applyAvailable: reviewOk && options.canApply === true, queueKey: validation.queueKey, blockedReasons: uniqueStrings([...validation.reasons, ...resolved.blockedReasons]), title: text(validation.record.title) || "Inter-Station Help", publicText: text(validation.record.publicText), sourceStationKey: text(validation.record.sourceStationKey), sourceStationName: text(validation.record.sourceStationName), targetStationKey: text(validation.record.targetStationKey), targetStationName: text(validation.record.targetStationName), roundIndex: strictIntegerOrNull(validation.record.roundIndex), roundNumber: strictIntegerOrNull(validation.record.roundNumber), benefitKind: reviewOk ? text(validation.record.benefitKind) : null, baseMagnitude: reviewOk ? resolved.baseMagnitude : null, criticalMagnitude: reviewOk ? resolved.criticalMagnitude : null, effectiveMagnitude: magnitude, magnitude, expires: reviewOk ? text(validation.record.expires) : null, dcReduction: magnitude ?? 0, strengthened: reviewOk && resolved.strengthened, strengtheningMode: reviewOk ? resolved.strengtheningMode : null, effectSource: reviewOk ? resolved.effectSource : null, fallbackBaseDc: validation.fallbackBaseDc, fallbackEffectiveDc, fallbackDcPreview: reviewOk && Number.isFinite(validation.fallbackBaseDc), helpSummary: reviewOk && magnitude !== null ? `${text(validation.record.sourceStationName) || "Help"} reduces this check's DC by ${magnitude}.` : "", criticalSuccessNote, warnings: reviewOk ? resolved.warnings : [] };
}

export function applyTravelV2InterStationHelpApplicationToSession(session = {}, selection = {}, options = {}) {
  const permissionReasons = [];
  if (options.canApply !== true) permissionReasons.push("gm-apply-permission-required");
  if (options.applyRequested !== true) permissionReasons.push("explicit-apply-request-required");
  const validation = validate(session, selection, options);
  if (permissionReasons.length || !validation.ok) return blocked(session, validation.queueKey, [...permissionReasons, ...validation.reasons], validation.record);
  const timestamp = nowIso(options);
  const nextSession = cloneData(session);
  const record = nextSession.travelV2PendingStationBenefits[validation.index];
  const resolved = resolveTravelV2InterStationHelpBenefit({ matchedAction: validation.matchedAction, record: validation.record, sourceResult: stationResult(session, strictIntegerOrNull(validation.record.roundIndex), text(validation.record.sourceStationKey)) });
  if (resolved.ok !== true) return blocked(session, validation.queueKey, resolved.blockedReasons, validation.record);
  const appRecord = { version: 2, applicationKey: validation.applicationKey, queueKey: validation.queueKey, pendingHelpKey: text(record.pendingHelpKey), actionId: text(record.actionId), roundIndex: strictIntegerOrNull(record.roundIndex), roundNumber: strictIntegerOrNull(record.roundNumber), sourceStationKey: text(record.sourceStationKey), sourceStationName: text(record.sourceStationName), targetStationKey: text(record.targetStationKey), targetStationName: text(record.targetStationName), benefitKind: "dcReduction", baseMagnitude: resolved.baseMagnitude, ...(resolved.criticalMagnitude !== null ? { criticalMagnitude: resolved.criticalMagnitude } : {}), magnitude: resolved.effectiveMagnitude, effectiveMagnitude: resolved.effectiveMagnitude, strengthened: resolved.strengthened, strengtheningMode: resolved.strengtheningMode, effectSource: resolved.effectSource, criticalSuccess: resolved.criticalSuccess, status: "applied", applied: true, appliedAt: timestamp, playerSafe: true };
  nextSession.travelV2InterStationHelpApplications = { version: 2, records: [...applicationRecords(nextSession), appRecord] };
  Object.assign(record, { applied: true, appliedAt: timestamp, applicationKey: validation.applicationKey });
  nextSession.updatedAt = timestamp; nextSession.summary = null;
  return { version: TRAVEL_V2_INTER_STATION_HELP_APPLICATION_VERSION, ok: true, applied: true, duplicate: false, shouldAdoptSession: true, nextSession, record: cloneData(appRecord), status: { ok: true, applied: true, status: "applied", message: "Inter-Station Help effect applied to session-local check context. No roll was made.", blockedReasons: [], queueKey: validation.queueKey } };
}

export function prepareTravelV2InterStationHelpCheckAdjustment(session = {}, options = {}) {
  const roundIndex = strictIntegerOrNull(options.roundIndex ?? session?.currentRoundIndex);
  const stationKey = text(options.stationKey);
  const blockedReasons = [];
  if (roundIndex === null) blockedReasons.push("malformed-round");
  if (!stationKey) blockedReasons.push("missing-station-key");
  const seen = new Set();
  const applications = [];
  for (const app of applicationRecords(session)) {
    const appKey = text(app.applicationKey);
    if (!appKey || seen.has(appKey)) continue;
    seen.add(appKey);
    if (app.applied !== true || text(app.status) !== "applied" || strictIntegerOrNull(app.roundIndex) !== roundIndex || text(app.targetStationKey) !== stationKey || text(app.benefitKind) !== "dcReduction") continue;
    const rawRecord = queueRecords(session).find((record) => text(record.queueKey) === text(app.queueKey));
    if (!rawRecord) continue;
    const validation = validate(session, { queueKey: text(rawRecord.queueKey) }, { ...options, allowAlreadyApplied: true });
    if (validation.ok !== true) continue;
    const expectedApplicationKey = validation.applicationKey;
    if (appKey !== expectedApplicationKey || text(rawRecord.applicationKey) !== expectedApplicationKey || text(app.applicationKey) !== expectedApplicationKey) continue;
    if (text(app.queueKey) !== validation.queueKey || text(app.pendingHelpKey) !== text(validation.record.pendingHelpKey) || text(app.actionId) !== text(validation.record.actionId) || text(app.sourceStationKey) !== text(validation.record.sourceStationKey) || text(app.targetStationKey) !== text(validation.record.targetStationKey) || strictIntegerOrNull(app.roundIndex) !== strictIntegerOrNull(validation.record.roundIndex)) continue;
    const resolved = resolveTravelV2InterStationHelpBenefit({ matchedAction: validation.matchedAction, record: validation.record, sourceResult: stationResult(session, strictIntegerOrNull(validation.record.roundIndex), text(validation.record.sourceStationKey)) });
    if (resolved.ok !== true) continue;
    const applicationVersion = strictIntegerOrNull(app.version);
    if (applicationVersion === 1) {
      if (!isLegacySlice06Application(app)) continue;
      const legacyMagnitude = positiveIntegerOrNull(app.magnitude);
      if (legacyMagnitude !== resolved.baseMagnitude) continue;
      applications.push({ applicationKey: expectedApplicationKey, queueKey: validation.queueKey, title: text(validation.record.title), sourceStationKey: text(validation.record.sourceStationKey), sourceStationName: text(validation.record.sourceStationName), magnitude: resolved.baseMagnitude, baseMagnitude: resolved.baseMagnitude, criticalMagnitude: null, strengthened: false, strengtheningMode: null, effectSource: "base", criticalSuccess: false, legacyApplication: true });
      continue;
    }
    if (applicationVersion !== 2 || !isCompleteSlice07Application(app)) continue;
    const storedBaseMagnitude = positiveIntegerOrNull(app.baseMagnitude);
    const storedMagnitude = positiveIntegerOrNull(app.magnitude);
    const storedEffectiveMagnitude = positiveIntegerOrNull(app.effectiveMagnitude);
    if (storedBaseMagnitude !== resolved.baseMagnitude) continue;
    if (storedEffectiveMagnitude !== resolved.effectiveMagnitude) continue;
    if (storedMagnitude !== storedEffectiveMagnitude) continue;
    if (app.criticalSuccess !== resolved.criticalSuccess) continue;
    if (resolved.strengthened === true) {
      if (app.strengthened !== true) continue;
      if (app.strengtheningMode !== "replaceMagnitude") continue;
      if (app.effectSource !== "criticalSuccess") continue;
      if (!Object.hasOwn(app, "criticalMagnitude")) continue;
      if (positiveIntegerOrNull(app.criticalMagnitude) !== resolved.criticalMagnitude) continue;
      if (storedEffectiveMagnitude !== resolved.criticalMagnitude) continue;
    } else {
      if (app.strengthened !== false) continue;
      if (app.strengtheningMode !== null) continue;
      if (app.effectSource !== "base") continue;
      if (Object.hasOwn(app, "criticalMagnitude")) continue;
    }
    applications.push({ applicationKey: expectedApplicationKey, queueKey: validation.queueKey, title: text(validation.record.title), sourceStationKey: text(validation.record.sourceStationKey), sourceStationName: text(validation.record.sourceStationName), magnitude: resolved.effectiveMagnitude, baseMagnitude: resolved.baseMagnitude, criticalMagnitude: resolved.criticalMagnitude, strengthened: resolved.strengthened, strengtheningMode: resolved.strengtheningMode, effectSource: resolved.effectSource, criticalSuccess: resolved.criticalSuccess, legacyApplication: false });
  }
  applications.sort((a, b) => a.applicationKey.localeCompare(b.applicationKey));
  const dcReduction = applications.reduce((sum, app) => sum + app.magnitude, 0);
  return { version: TRAVEL_V2_INTER_STATION_HELP_APPLICATION_VERSION, ok: blockedReasons.length === 0, roundIndex, stationKey, dcReduction, hasAdjustment: dcReduction > 0, applications, blockedReasons };
}
