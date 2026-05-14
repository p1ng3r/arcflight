import { getCoreStationAction, getStationActionOutcome, getStationActionRollOptions, previewStationActionOutcome } from "../../data/station-actions/core-station-actions.js";
import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, canSpendShipActionPoints, getArcflightShipData, getShipActionEconomy, spendShipActionPoints } from "../documents/ships.js";

const VALID_STATION_ACTION_PHASES = Object.freeze(["combat", "travel", "both"]);
const BLOCKED_SEVERITIES = Object.freeze(["danger"]);

function cloneData(data) {
  return globalThis.foundry?.utils?.deepClone?.(data) ?? JSON.parse(JSON.stringify(data ?? null));
}

function isArcflightVehicle(actor) {
  return actor?.type === "vehicle"
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

function normalizeHistory(history) {
  return Array.isArray(history) ? cloneData(history) : [];
}

function normalizePhase(phase, fallback = "both") {
  return VALID_STATION_ACTION_PHASES.includes(phase) ? phase : fallback;
}

function isActionAvailableInPhase(actionPhase, requestedPhase) {
  if (!VALID_STATION_ACTION_PHASES.includes(requestedPhase)) return false;
  if (actionPhase === "both") return true;

  return actionPhase === requestedPhase;
}

function hasAssignedCrew(assignment) {
  return Boolean(
    assignment
    && assignment.assigneeType !== "none"
    && (
      assignment.name
      || assignment.actorId
      || assignment.actorUuid
      || assignment.crewAssetId
      || assignment.crewAssetUuid
    )
  );
}

function getAssignedCrewName(assignment) {
  return assignment?.name
    ?? assignment?.actorUuid
    ?? assignment?.actorId
    ?? assignment?.crewAssetUuid
    ?? assignment?.crewAssetId
    ?? "";
}

function createStationActionId(actionKey) {
  const randomId = globalThis.foundry?.utils?.randomID?.(10)
    ?? Math.random().toString(36).slice(2, 12).padEnd(10, "0");

  return `station-action-${actionKey || "unknown"}-${Date.now().toString(36)}-${randomId}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function buildPreview({ actionKey, options, action, messages, warnings, blocked, affordability = null }) {
  const phase = normalizePhase(options.phase, action?.phase ?? "both");
  const severity = blocked ? "danger" : (warnings.length > 0 ? "warning" : "ok");
  const apCost = Number.isFinite(Number(action?.apCost)) ? Number(action.apCost) : 0;
  const rapCost = Number.isFinite(Number(action?.rapCost)) ? Number(action.rapCost) : 0;
  const canAfford = affordability?.canSpend ?? true;
  const actionEconomy = affordability?.state ?? null;

  return {
    ok: !blocked,
    severity,
    actionKey,
    actionName: action?.name ?? "",
    stationKey: action?.stationKey ?? "",
    phase,
    messages,
    warnings,
    requirements: Array.isArray(action?.requirements) ? cloneData(action.requirements) : [],
    effectsPreview: Array.isArray(action?.effectsPreview) ? cloneData(action.effectsPreview) : [],
    apCost,
    rapCost,
    canAfford,
    affordable: canAfford,
    affordabilityMessages: affordability?.messages ?? [],
    affordabilityLabel: canAfford ? "Affordable" : "Insufficient AP/RAP",
    actionEconomy: actionEconomy ? cloneData(actionEconomy) : null,
    resourceCost: {
      ap: apCost,
      rap: rapCost,
      label: `${apCost} AP / ${rapCost} RAP`,
      canAfford,
      messages: affordability?.messages ?? []
    },
    blocked
  };
}

function normalizeRollOption(action, requestedOptionKey = "") {
  const rollOptions = getStationActionRollOptions(action?.key);
  if (rollOptions.length === 0) return null;

  const optionKey = String(requestedOptionKey || rollOptions[0]?.key || "");
  return rollOptions.find((option) => option.key === optionKey || option.statisticKey === optionKey) ?? null;
}

async function resolveAssignedActor(assignment = {}) {
  if (assignment?.actorUuid && typeof globalThis.fromUuid === "function") {
    try {
      const actor = await globalThis.fromUuid(assignment.actorUuid);
      if (actor) return actor;
    } catch (error) {
      console.warn("Arcflight | Could not resolve assigned station actor UUID.", error);
    }
  }

  if (assignment?.actorId) return globalThis.game?.actors?.get?.(assignment.actorId) ?? null;
  return null;
}

function collectionKeys(collection) {
  if (!collection) return [];
  if (collection instanceof Map) return Array.from(collection.keys());
  if (typeof collection.keys === "function") {
    try {
      return Array.from(collection.keys());
    } catch (_error) {
      // Fall through to object key discovery for Foundry/PF2E data wrappers.
    }
  }

  return Object.keys(collection);
}

function normalizeStatisticKey(statisticKey = "") {
  return String(statisticKey ?? "").trim().toLowerCase();
}

function findMatchingLoreSkillKeys(actor, baseKey = "") {
  if (!baseKey) return [];
  const normalizedBase = normalizeStatisticKey(baseKey).replace(/-lore$/, "");
  const keys = [
    ...collectionKeys(actor?.statistics),
    ...collectionKeys(actor?.skills),
    ...collectionKeys(actor?.system?.skills)
  ];

  return keys.filter((key) => {
    const slug = normalizeStatisticKey(key);
    return slug.endsWith("lore") && slug.includes(normalizedBase);
  });
}

function candidateStatisticKeys(statisticKey = "", actor = null) {
  const key = normalizeStatisticKey(statisticKey);
  const loreBaseKey = key.endsWith("-lore") ? key.replace(/-lore$/, "") : "";
  const candidates = [key];

  if (loreBaseKey) {
    candidates.push(loreBaseKey);
    candidates.push(...findMatchingLoreSkillKeys(actor, loreBaseKey));
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function getMapLikeValue(collection, key) {
  if (!collection || !key) return null;
  if (typeof collection.get === "function") return collection.get(key) ?? null;
  return collection[key] ?? null;
}

function resolveStatisticLabel(statistic, fallbackKey = "") {
  return statistic?.label
    ?? statistic?.name
    ?? statistic?.slug
    ?? statistic?.system?.label
    ?? statistic?.system?.name
    ?? fallbackKey
    ?? "";
}

function isRollableStatistic(statistic) {
  return typeof statistic?.roll === "function" || typeof statistic?.check?.roll === "function";
}

function createStatisticResolution({ statistic = null, statisticKey = "", source = "missing", label = "", ok = false, message = "" } = {}) {
  const resolvedLabel = label || resolveStatisticLabel(statistic, statisticKey);

  return {
    statistic,
    statisticKey,
    source,
    label: resolvedLabel,
    ok,
    message: message || (ok
      ? `Resolved ${resolvedLabel || statisticKey} from ${source}.`
      : `Could not resolve a rollable PF2E statistic for ${statisticKey}.`)
  };
}

function tryActorGetStatistic(actor, key) {
  if (typeof actor?.getStatistic !== "function") return null;

  try {
    return actor.getStatistic(key) ?? null;
  } catch (error) {
    console.warn("Arcflight | actor.getStatistic failed while resolving station action statistic.", { actor: actor?.name, key, error });
    return null;
  }
}

function resolveFromCandidates(actor, candidates, resolvers) {
  for (const resolve of resolvers) {
    for (const key of candidates) {
      const statistic = resolve.get(actor, key);
      if (statistic) return { statistic, statisticKey: key, source: resolve.source };
    }
  }

  return null;
}

export function resolveAssignedActorStatistic(actor, statisticKey = "") {
  const requestedKey = normalizeStatisticKey(statisticKey);
  if (!actor) {
    return createStatisticResolution({
      statisticKey: requestedKey,
      ok: false,
      message: "No assigned actor was available for this station action roll."
    });
  }

  const candidates = candidateStatisticKeys(requestedKey, actor);
  const saveKeys = new Set(["fortitude", "reflex", "will"]);
  const resolved = resolveFromCandidates(actor, candidates, [
    { source: "actor.getStatistic", get: (candidateActor, key) => tryActorGetStatistic(candidateActor, key) },
    { source: "actor.skills", get: (candidateActor, key) => candidateActor?.skills?.[key] ?? null },
    { source: "actor.skills.get", get: (candidateActor, key) => candidateActor?.skills?.get?.(key) ?? null },
    { source: "actor.perception", get: (candidateActor, key) => key === "perception" ? candidateActor?.perception ?? null : null },
    { source: "actor.saves", get: (candidateActor, key) => saveKeys.has(key) ? candidateActor?.saves?.[key] ?? null : null },
    { source: "actor.saves.get", get: (candidateActor, key) => saveKeys.has(key) ? candidateActor?.saves?.get?.(key) ?? null : null }
  ]);

  if (resolved) {
    const ok = isRollableStatistic(resolved.statistic);
    return createStatisticResolution({
      ...resolved,
      label: resolveStatisticLabel(resolved.statistic, resolved.statisticKey),
      ok,
      message: ok
        ? `Resolved rollable PF2E statistic ${resolveStatisticLabel(resolved.statistic, resolved.statisticKey)} from ${resolved.source}.`
        : `Resolved ${resolveStatisticLabel(resolved.statistic, resolved.statisticKey)} from ${resolved.source}, but it does not expose statistic.roll or statistic.check.roll.`
    });
  }

  const systemSkill = resolveFromCandidates(actor, candidates, [
    { source: "actor.system.skills", get: (candidateActor, key) => getMapLikeValue(candidateActor?.system?.skills, key) }
  ]);

  if (systemSkill) {
    return createStatisticResolution({
      ...systemSkill,
      label: resolveStatisticLabel(systemSkill.statistic, systemSkill.statisticKey),
      ok: false,
      message: `Found read-only PF2E system skill metadata for ${systemSkill.statisticKey}, but no rollable Statistic object was available.`
    });
  }

  return createStatisticResolution({
    statisticKey: requestedKey,
    ok: false,
    message: `${actor.name ?? "Assigned actor"} does not expose a PF2E Statistic for ${requestedKey || "the selected roll option"}.`
  });
}

function mergeRollOptions(extraRollOptions) {
  const options = Array.isArray(extraRollOptions) ? extraRollOptions : [];
  return Array.from(new Set(options.filter(Boolean)));
}

function captureRollMetadata(target, roll, outcome, message) {
  if (!target || !roll) return;
  const total = getRollTotal(roll);
  if (Number.isFinite(total)) target.total = total;
  const degreeOfSuccess = roll?.degreeOfSuccess ?? roll?.degree ?? outcome?.degreeOfSuccess ?? outcome?.degree;
  if (degreeOfSuccess !== undefined && degreeOfSuccess !== null) target.degreeOfSuccess = degreeOfSuccess;
  const outcomeValue = roll?.outcome ?? outcome?.outcome ?? outcome?.label ?? outcome?.value;
  if (outcomeValue !== undefined && outcomeValue !== null) target.outcome = outcomeValue;
  target.rollId = roll?.id ?? roll?.rollId ?? target.rollId ?? "";
  target.messageId = message?.id ?? message?._id ?? roll?.message?.id ?? roll?.messageId ?? target.messageId ?? "";
}

async function rollStatistic(_actor, statistic, preview, options = {}) {
  const callbackMetadata = {};
  const rollArgs = {
    event: options.event,
    title: `Arcflight: ${preview.actionName} — ${preview.rollOptionLabel}`,
    label: `${preview.actionName} — ${preview.rollOptionLabel}`,
    slug: preview.actionKey,
    action: preview.actionKey,
    dc: options.dc,
    extraRollOptions: mergeRollOptions([
      "arcflight",
      `arcflight:station:${preview.stationKey}`,
      `arcflight:action:${preview.actionKey}`,
      `arcflight:roll-option:${preview.rollOptionKey}`,
      ...(Array.isArray(options.extraRollOptions) ? options.extraRollOptions : [])
    ]),
    skipDialog: options.skipDialog ?? false,
    createMessage: options.createMessage ?? true,
    callback: async (roll, outcome, message) => {
      captureRollMetadata(callbackMetadata, roll, outcome, message);
      if (typeof options.callback === "function") await options.callback(roll, outcome, message);
    }
  };

  const rollResult = typeof statistic?.roll === "function"
    ? await statistic.roll(rollArgs)
    : typeof statistic?.check?.roll === "function"
      ? await statistic.check.roll(rollArgs)
      : null;

  if (!rollResult && Object.keys(callbackMetadata).length === 0) return null;

  if (rollResult) captureRollMetadata(callbackMetadata, rollResult);
  return Object.keys(callbackMetadata).length > 0
    ? { ...callbackMetadata, roll: rollResult ?? null }
    : rollResult;
}

function getNumericRollTotal(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getRollTotal(rollResult) {
  return getNumericRollTotal(rollResult?.total)
    ?? getNumericRollTotal(rollResult?.roll?.total)
    ?? null;
}

function getRollDegree(rollResult) {
  return previewStationActionOutcome("", rollResult).degreeOfSuccess;
}

export function getStationActionState(shipActor) {
  const systemData = isArcflightVehicle(shipActor) ? getArcflightShipData(shipActor) : {};
  const stationActions = systemData.stationActions ?? {};
  const history = normalizeHistory(stationActions.history);

  return {
    actorId: shipActor?.id ?? "",
    actorName: shipActor?.name ?? "",
    isArcflightVehicle: isArcflightVehicle(shipActor),
    history,
    lastAction: history.at?.(-1) ?? history[history.length - 1] ?? null,
    count: history.length
  };
}

export { getStationActionOutcome, getStationActionRollOptions, previewStationActionOutcome };

export function previewStationAction(shipActor, actionKey, options = {}) {
  const messages = [];
  const warnings = [];
  let blocked = false;

  if (!isArcflightVehicle(shipActor)) {
    blocked = true;
    messages.push("Station actions require an Arcflight-enabled PF2E vehicle actor.");
  }

  const action = getCoreStationAction(actionKey);
  if (!action) {
    blocked = true;
    messages.push(`Unknown station action key: ${actionKey ?? ""}`.trim());
  }

  const station = action ? getStation(action.stationKey) : null;
  if (action && !station) {
    blocked = true;
    messages.push(`Unknown station key for action ${action.key}: ${action.stationKey}`);
  }

  const requestedPhase = options.phase ?? action?.phase ?? "both";
  if (!VALID_STATION_ACTION_PHASES.includes(requestedPhase)) {
    blocked = true;
    messages.push(`Invalid station action phase: ${requestedPhase}`);
  }

  if (action && VALID_STATION_ACTION_PHASES.includes(requestedPhase) && !isActionAvailableInPhase(action.phase, requestedPhase)) {
    blocked = true;
    messages.push(`${action.name} is available during ${action.phase} phase, not ${requestedPhase}.`);
  }

  const systemData = isArcflightVehicle(shipActor) ? getArcflightShipData(shipActor) : {};
  const assignment = action ? systemData.stations?.assignments?.[action.stationKey] ?? null : null;
  if (action?.requiredCrewRole && !hasAssignedCrew(assignment)) {
    blocked = true;
    warnings.push(`${action.name} requires an assigned ${action.requiredCrewRole} at the ${station?.displayName ?? station?.name ?? action.stationKey} station.`);
  }

  let affordability = null;
  if (action && isArcflightVehicle(shipActor)) {
    affordability = canSpendShipActionPoints(shipActor, { ap: action.apCost, rap: action.rapCost });
    if (!affordability.canSpend) warnings.push(...affordability.messages);
  } else if (isArcflightVehicle(shipActor)) {
    affordability = { canSpend: true, messages: [], state: getShipActionEconomy(shipActor) };
  }

  if (!blocked) messages.push(`${action.name} is ready to record. No AP/RAP, dice, combat, travel, or effects automation will be applied by default.`);

  return buildPreview({
    actionKey,
    options: { ...options, phase: requestedPhase },
    action,
    messages,
    warnings,
    blocked,
    affordability
  });
}

export async function previewStationActionRoll(shipActor, actionKey, options = {}) {
  const actionPreview = previewStationAction(shipActor, actionKey, options);
  const messages = [...actionPreview.messages];
  const warnings = [...actionPreview.warnings];
  let blocked = actionPreview.blocked === true;
  const action = getCoreStationAction(actionKey);
  const station = action ? getStation(action.stationKey) : null;
  const rollOptions = getStationActionRollOptions(actionKey);
  const rollOption = normalizeRollOption(action, options.rollOptionKey ?? options.rollOption ?? options.statisticKey);
  const assignment = action ? getArcflightShipData(shipActor).stations?.assignments?.[action.stationKey] ?? null : null;

  if (action && rollOptions.length === 0) {
    blocked = true;
    warnings.push(`${action.name} does not define roll options.`);
  }

  if (action && rollOptions.length > 0 && !rollOption) {
    blocked = true;
    warnings.push(`Invalid roll option for ${action.name}: ${options.rollOptionKey ?? options.rollOption ?? options.statisticKey ?? ""}`.trim());
  }

  const assignedActor = !blocked || hasAssignedCrew(assignment) ? await resolveAssignedActor(assignment) : null;
  if (action && hasAssignedCrew(assignment) && !assignedActor) {
    blocked = true;
    warnings.push(`Assigned ${station?.displayName ?? station?.name ?? action.stationKey} actor could not be resolved for ${action.name}.`);
  }

  const statisticKey = rollOption?.statisticKey ?? rollOption?.key ?? "";
  const statisticResolution = assignedActor && statisticKey
    ? resolveAssignedActorStatistic(assignedActor, statisticKey)
    : resolveAssignedActorStatistic(null, statisticKey);
  const canRollStatistic = statisticResolution.ok === true;
  if (!blocked && !canRollStatistic) warnings.push(statisticResolution.message || `${assignedActor?.name ?? "Assigned actor"} does not expose a PF2E statistic for ${rollOption?.label ?? statisticKey}.`);
  if (!blocked) messages.push(`${action?.name ?? "Station action"} roll is ready. No AP/RAP or gameplay effects will be automated.`);

  return {
    ...actionPreview,
    ok: !blocked,
    blocked,
    severity: blocked ? "danger" : (warnings.length > 0 ? "warning" : "ok"),
    messages,
    warnings,
    station: station?.displayName ?? station?.name ?? actionPreview.stationKey,
    action: actionPreview.actionName,
    actorId: assignedActor?.id ?? "",
    actorUuid: assignedActor?.uuid ?? assignment?.actorUuid ?? "",
    actorName: assignedActor?.name ?? getAssignedCrewName(assignment),
    assignedActorName: assignedActor?.name ?? getAssignedCrewName(assignment),
    assignment: assignment ? cloneData(assignment) : null,
    rollOption: rollOption ? cloneData(rollOption) : null,
    rollOptionKey: rollOption?.key ?? "",
    rollOptionLabel: rollOption?.label ?? "",
    statisticKey,
    resolvedStatisticKey: statisticResolution.statisticKey,
    statisticSource: statisticResolution.source,
    statisticLabel: statisticResolution.label,
    statisticMessage: statisticResolution.message,
    readiness: {
      canRoll: !blocked && canRollStatistic,
      canRollStatistic,
      actorResolved: Boolean(assignedActor),
      rollOptionValid: Boolean(rollOption),
      assigned: hasAssignedCrew(assignment)
    }
  };
}

export async function executeStationAction(shipActor, actionKey, options = {}) {
  const preview = previewStationAction(shipActor, actionKey, options);

  if (preview.blocked || BLOCKED_SEVERITIES.includes(preview.severity)) {
    throw new Error(`Arcflight | Station action blocked: ${[...preview.messages, ...preview.warnings].join(" ")}`.trim());
  }

  if (typeof shipActor?.update !== "function") {
    throw new Error("Arcflight | executeStationAction requires an updatable Arcflight ship actor.");
  }

  const spentResources = options.spendResources === true
    ? await spendShipActionPoints(shipActor, { ap: preview.apCost, rap: preview.rapCost, reason: options.reason ?? `Station action: ${preview.actionName || actionKey}` })
    : null;
  const history = getStationActionState(shipActor).history;
  const record = {
    id: createStationActionId(actionKey),
    recordType: "record",
    actionKey: preview.actionKey,
    actionName: preview.actionName,
    stationKey: preview.stationKey,
    phase: preview.phase,
    actorId: shipActor?.id ?? "",
    actorName: shipActor?.name ?? "",
    executedAt: Date.now(),
    executedBy: globalThis.game?.user?.id ?? "",
    assignedCrewName: getAssignedCrewName(getArcflightShipData(shipActor).stations?.assignments?.[preview.stationKey] ?? null),
    apCost: preview.apCost,
    rapCost: preview.rapCost,
    spentResources: options.spendResources === true,
    actionEconomy: spentResources ? cloneData(spentResources) : null,
    notes: options.notes ?? ""
  };

  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.stationActions.history`]: [...history, record]
  });

  return record;
}

export async function rollStationAction(shipActor, actionKey, options = {}) {
  const preview = await previewStationActionRoll(shipActor, actionKey, options);

  if (preview.blocked || BLOCKED_SEVERITIES.includes(preview.severity)) {
    throw new Error(`Arcflight | Station action roll blocked: ${[...preview.messages, ...preview.warnings].join(" ")}`.trim());
  }

  if (typeof shipActor?.update !== "function") {
    throw new Error("Arcflight | rollStationAction requires an updatable Arcflight ship actor.");
  }

  const spentResources = options.spendResources === true
    ? await spendShipActionPoints(shipActor, { ap: preview.apCost, rap: preview.rapCost, reason: options.reason ?? `Station action roll: ${preview.actionName || actionKey}` })
    : null;

  const assignedActor = await resolveAssignedActor(preview.assignment);
  const statisticResolution = resolveAssignedActorStatistic(assignedActor, preview.statisticKey);
  let rollResult = null;
  let rollStatus = "rolled";

  if (statisticResolution.ok) {
    try {
      rollResult = await rollStatistic(assignedActor, statisticResolution.statistic, preview, options);
      if (!rollResult) rollStatus = "failed";
    } catch (error) {
      rollStatus = "failed";
      console.warn("Arcflight | Station action statistic roll failed.", { actionKey, statisticResolution, error });
    }
  } else {
    rollStatus = "missing-statistic";
  }

  if (rollStatus !== "rolled") {
    const message = rollStatus === "missing-statistic"
      ? `Arcflight could not find a rollable PF2E statistic for ${preview.rollOptionLabel || preview.statisticKey} on ${preview.actorName || "assigned actor"}.`
      : `Arcflight could not roll ${preview.rollOptionLabel || preview.statisticKey} for ${preview.actorName || "assigned actor"}.`;
    globalThis.ui?.notifications?.warn?.(message);
    console.warn("Arcflight | Station action roll could not be made.", { actionKey, preview, statisticResolution, rollStatus });
  }

  const outcome = previewStationActionOutcome(actionKey, rollResult);
  const degreeOfSuccess = getRollDegree(rollResult);
  const history = getStationActionState(shipActor).history;
  const record = {
    id: createStationActionId(actionKey),
    recordType: "roll",
    actionKey: preview.actionKey,
    actionName: preview.actionName,
    stationKey: preview.stationKey,
    phase: preview.phase,
    actorId: shipActor?.id ?? "",
    actorName: shipActor?.name ?? "",
    executedAt: Date.now(),
    executedBy: globalThis.game?.user?.id ?? "",
    assignedActorId: preview.actorId,
    assignedActorUuid: preview.actorUuid,
    assignedActorName: preview.actorName,
    assignedCrewName: preview.actorName,
    rollOptionKey: preview.rollOptionKey,
    rollOptionLabel: preview.rollOptionLabel,
    statisticKey: preview.statisticKey,
    resolvedStatisticKey: statisticResolution.statisticKey || preview.resolvedStatisticKey,
    statisticLabel: statisticResolution.label || preview.statisticLabel || "",
    statisticSource: statisticResolution.source || preview.statisticSource || "",
    statisticMessage: statisticResolution.message || preview.statisticMessage || "",
    rollStatus,
    total: getRollTotal(rollResult),
    degreeOfSuccess,
    degree: degreeOfSuccess,
    result: outcome.label,
    outcomeKey: outcome.outcomeKey,
    outcomeLabel: outcome.label,
    outcomeText: outcome.text,
    outcome: rollResult?.outcome ?? outcome.outcomeKey,
    rollId: rollResult?.rollId ?? rollResult?.id ?? rollResult?.roll?.id ?? "",
    messageId: rollResult?.messageId ?? rollResult?.message?.id ?? rollResult?.roll?.message?.id ?? "",
    apCost: preview.apCost,
    rapCost: preview.rapCost,
    spentResources: options.spendResources === true,
    actionEconomy: spentResources ? cloneData(spentResources) : null,
    notes: options.notes ?? ""
  };

  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.stationActions.history`]: [...history, record]
  });

  return record;
}

export async function clearStationActionHistory(shipActor) {
  if (!isArcflightVehicle(shipActor)) {
    throw new Error("Arcflight | clearStationActionHistory requires an Arcflight-enabled PF2E vehicle actor.");
  }

  await shipActor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.system.stationActions.history`]: []
  });

  return [];
}
