import { getCoreStationAction } from "../../data/station-actions/core-station-actions.js";
import { getStation } from "../../data/stations/core-stations.js";
import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, getArcflightShipData } from "../documents/ships.js";

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

function buildPreview({ actionKey, options, action, messages, warnings, blocked }) {
  const phase = normalizePhase(options.phase, action?.phase ?? "both");
  const severity = blocked ? "danger" : (warnings.length > 0 ? "warning" : "ok");

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
    apCost: Number.isFinite(Number(action?.apCost)) ? Number(action.apCost) : 0,
    rapCost: Number.isFinite(Number(action?.rapCost)) ? Number(action.rapCost) : 0,
    blocked
  };
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
    warnings.push(`${action.name} requires an assigned ${action.requiredCrewRole} at the ${station?.name ?? action.stationKey} station.`);
  }

  if (!blocked) messages.push(`${action.name} is ready to record. No AP/RAP, dice, combat, travel, or effects automation will be applied.`);

  return buildPreview({
    actionKey,
    options: { ...options, phase: requestedPhase },
    action,
    messages,
    warnings,
    blocked
  });
}

export async function executeStationAction(shipActor, actionKey, options = {}) {
  const preview = previewStationAction(shipActor, actionKey, options);

  if (preview.blocked || BLOCKED_SEVERITIES.includes(preview.severity)) {
    throw new Error(`Arcflight | Station action blocked: ${[...preview.messages, ...preview.warnings].join(" ")}`.trim());
  }

  if (typeof shipActor?.update !== "function") {
    throw new Error("Arcflight | executeStationAction requires an updatable Arcflight ship actor.");
  }

  const history = getStationActionState(shipActor).history;
  const record = {
    id: createStationActionId(actionKey),
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
