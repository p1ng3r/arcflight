import { getCoreStationAction, getStationActionOutcome, getStationActionRollOptions, previewStationActionOutcome } from "../../data/station-actions/core-station-actions.js";
import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, canSpendShipActionPoints, getArcflightShipData, getShipActionEconomy, spendShipActionPoints } from "../documents/ships.js";

const VALID_STATION_ACTION_PHASES = Object.freeze(["combat", "travel", "both"]);
const BLOCKED_SEVERITIES = Object.freeze(["danger"]);
const PF2E_SKILL_ABBREVIATIONS = Object.freeze({
  acrobatics: "acr",
  arcana: "arc",
  athletics: "ath",
  crafting: "cra",
  diplomacy: "dip",
  intimidation: "itm",
  occultism: "occ",
  religion: "rel",
  society: "soc",
  survival: "sur"
});

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

function candidateStatisticKeys(statisticKey = "") {
  const key = String(statisticKey ?? "");
  const skillAbbreviation = PF2E_SKILL_ABBREVIATIONS[key];
  const loreBaseKey = key.endsWith("-lore") ? key.replace(/-lore$/, "") : "";

  return Array.from(new Set([
    key,
    skillAbbreviation,
    loreBaseKey,
    key.replace(/-/g, ""),
    key.replace(/-/g, "_")
  ].filter(Boolean)));
}

function getMapLikeValue(collection, key) {
  if (!collection) return null;
  if (typeof collection.get === "function") return collection.get(key) ?? null;
  return collection[key] ?? null;
}

function resolveActorStatistic(actor, statisticKey = "") {
  for (const key of candidateStatisticKeys(statisticKey)) {
    const statistic = getMapLikeValue(actor?.statistics, key)
      ?? getMapLikeValue(actor?.skills, key)
      ?? getMapLikeValue(actor?.system?.skills, key)
      ?? getMapLikeValue(actor?.system?.statistics, key)
      ?? (key === "perception" ? actor?.perception ?? actor?.system?.perception : null)
      ?? (key === "reflex" ? getMapLikeValue(actor?.saves, "reflex") ?? getMapLikeValue(actor?.system?.saves, "reflex") : null);

    if (statistic) return { statistic, resolvedKey: key };
  }

  return { statistic: null, resolvedKey: statisticKey };
}

async function rollStatistic(actor, statistic, preview, options = {}) {
  const rollOptions = {
    event: options.event,
    skipDialog: options.skipDialog === true,
    createMessage: options.createMessage !== false,
    dc: options.dc,
    extraRollOptions: Array.isArray(options.extraRollOptions) ? options.extraRollOptions : [],
    callback: options.callback
  };

  if (typeof statistic?.roll === "function") return statistic.roll(rollOptions);
  if (typeof statistic?.check?.roll === "function") return statistic.check.roll(rollOptions);
  if (typeof actor?.rollStatistic === "function") return actor.rollStatistic(preview.statisticKey, rollOptions);
  if (typeof actor?.rollSkill === "function") return actor.rollSkill(preview.statisticKey, rollOptions);

  return null;
}

function getRollTotal(rollResult) {
  return Number.isFinite(Number(rollResult?.total)) ? Number(rollResult.total)
    : Number.isFinite(Number(rollResult?.roll?.total)) ? Number(rollResult.roll.total)
      : null;
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
  const { statistic, resolvedKey } = assignedActor && statisticKey ? resolveActorStatistic(assignedActor, statisticKey) : { statistic: null, resolvedKey: statisticKey };
  const canRollStatistic = Boolean(statistic);
  if (!blocked && !canRollStatistic) warnings.push(`${assignedActor?.name ?? "Assigned actor"} does not expose a PF2E statistic for ${rollOption?.label ?? statisticKey}.`);
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
    resolvedStatisticKey: resolvedKey,
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
  const { statistic } = resolveActorStatistic(assignedActor, preview.statisticKey);
  let rollResult = null;
  let rollStatus = "rolled";

  if (statistic) {
    try {
      rollResult = await rollStatistic(assignedActor, statistic, preview, options);
      if (!rollResult) rollStatus = "roll-api-unavailable";
    } catch (error) {
      rollStatus = "roll-failed";
      console.warn("Arcflight | Station action statistic roll failed.", error);
    }
  } else {
    rollStatus = "statistic-missing";
  }

  if (rollStatus !== "rolled") {
    globalThis.ui?.notifications?.warn?.(`Arcflight could not roll ${preview.rollOptionLabel || preview.statisticKey} for ${preview.actorName || "assigned actor"}.`);
    console.warn("Arcflight | Station action roll could not be made.", { actionKey, preview, rollStatus });
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
    resolvedStatisticKey: preview.resolvedStatisticKey,
    rollStatus,
    total: getRollTotal(rollResult),
    degreeOfSuccess,
    degree: degreeOfSuccess,
    result: outcome.label,
    outcomeKey: outcome.outcomeKey,
    outcomeLabel: outcome.label,
    outcomeText: outcome.text,
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
