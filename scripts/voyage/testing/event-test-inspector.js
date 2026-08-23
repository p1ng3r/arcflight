import { getM12EventDefinition, M12_DEFINITION_SNAPSHOT_ID, M12_EVENT_ID } from "../m12/event-definition.js";
import { listVoyageEventLaunchShips } from "../foundry/event-launcher.js";
import { readVoyageEventSessionMultiplayerProjection, readVoyageEventSessionPlanning, readVoyageEventSessionProjection, readVoyageEventSessionResolution } from "../foundry/event-session-runtime.js";
import { eventTestFailure } from "./event-test-authority.js";

const STATIONS = Object.freeze(["captain", "engineer", "navigator", "watchmaster", "veilwarden"]);

function safeClone(value) {
  try {
    const cloned = structuredClone(value);
    return { ok: true, value: cloned };
  } catch {
    return { ok: false, value: null };
  }
}

function nonBlank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueRequestId(prefix) {
  try {
    const suffix = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    return `${prefix}-${suffix}`;
  } catch {
    return `${prefix}-event-test`;
  }
}

function valuesFromCollection(collection) {
  try {
    if (Array.isArray(collection)) return [...collection];
    if (Array.isArray(collection?.contents)) return [...collection.contents];
    if (typeof collection?.values === "function") return [...collection.values()];
  } catch {
    return [];
  }
  return [];
}

function targetUser(context, userId) {
  const users = valuesFromCollection(context?.users);
  const user = users.find((entry) => entry?.id === userId);
  return user && typeof user.id === "string"
    ? { id: user.id, name: typeof user.name === "string" ? user.name : user.id, isGM: user.isGM === true }
    : { id: userId, name: userId, isGM: false };
}

function projectionRequest(sessionId, expectedRevision, multiplayer = false) {
  return {
    kind: multiplayer ? "voyage.m12-read-multiplayer-projection" : "voyage.m11-read-projection",
    requestId: uniqueRequestId("event-test-read"),
    sessionId,
    expectedRevision
  };
}

function inspectFailure(result, sessionId) {
  if (result?.ok) return null;
  return eventTestFailure(result?.errors?.[0] ?? {
    code: "m11-invalid-session-document",
    path: "flags.arcflight.system.voyageSession",
    message: "Event Session could not be inspected.",
    severity: "error"
  }, { sessionId });
}

function conciseDefinition(definition) {
  return {
    eventId: definition.eventId,
    title: definition.title ?? definition.name ?? definition.eventId,
    definitionSnapshotId: definition.definitionSnapshotId ?? null,
    breachDC: Number.isFinite(definition.breachDC) ? definition.breachDC : null,
    rounds: Array.isArray(definition.rounds) ? definition.rounds.map((round) => ({
      roundId: round.roundId,
      roundNumber: round.roundNumber,
      title: round.title ?? round.name ?? round.roundId,
      stationIds: Array.isArray(round.availableStations) ? round.availableStations.map((entry) => entry.stationId).filter(nonBlank) : []
    })) : []
  };
}

export function listEventDefinitions(context = {}) {
  try {
    const sourceResolver = context.listEventDefinitions ?? context.resolveEventDefinitions;
    const source = typeof sourceResolver === "function"
      ? sourceResolver()
      : (Array.isArray(context.eventDefinitions) ? context.eventDefinitions : [getM12EventDefinition()]);
    const normalize = (value) => {
      const definitions = value === null ? [] : (Array.isArray(value) ? value : [value]);
      return definitions.map(conciseDefinition).filter((definition) => nonBlank(definition.eventId));
    };
    if (source && typeof source.then === "function") return Promise.resolve(source).then(normalize);
    return normalize(source);
  } catch {
    return [];
  }
}

function projectionSnapshot(gmProjection, planningProjection, resolutionProjection) {
  const projection = gmProjection.projection ?? {};
  const planning = planningProjection?.projection ?? {};
  const resolution = resolutionProjection?.projection ?? {};
  return {
    session: {
      sessionId: projection.sessionId ?? planning.sessionId ?? resolution.sessionId ?? null,
      eventId: projection.eventId ?? planning.eventId ?? null,
      definitionSnapshotId: projection.definitionSnapshotId ?? null,
      revision: projection.revision ?? planning.revision ?? resolution.revision ?? null,
      authorityEpoch: gmProjection.authorityEpoch ?? planning.authorityEpoch ?? null,
      sessionState: projection.sessionState ?? planning.sessionState ?? resolution.sessionState ?? null,
      lifecycleState: projection.lifecycleState ?? null,
      phase: projection.phase ?? planning.phase ?? resolution.phase ?? null,
      roundId: projection.roundId ?? resolution.roundId ?? null,
      roundNumber: projection.roundNumber ?? planning.roundNumber ?? resolution.roundNumber ?? null
    },
    planning: {
      assignments: planning.stationAssignments ?? projection.stationAssignments ?? [],
      stations: planning.stations ?? [],
      selections: planning.selections ?? {},
      stationLocks: planning.stationLocks ?? [],
      proposedStationOrder: planning.proposedStationOrder ?? [],
      committedStationOrder: planning.committedStationOrder ?? projection.committedStationOrder ?? []
    },
    resolution: {
      pendingChecks: resolution.stations ?? [],
      currentStationId: resolution.currentStationId ?? null,
      currentReaction: resolution.reactionWindowPending ?? resolution.reactionWindow ?? null,
      pendingBreachSave: resolution.pendingBreachSave ?? null
    },
    ship: {
      pressureSystems: projection.pressureSystems ?? [],
      activeHazards: projection.activeHazards ?? [],
      voidScarEvidence: null
    },
    aftermath: {
      eligible: resolution.roundCloseoutReady === true,
      visible: ["round-closeout", "event-closeout-review", "completed"].includes(projection.sessionState),
      closeoutReady: resolution.roundCloseoutReady === true,
      closeoutBlockedReason: resolution.roundCloseoutReady === true ? null : "round-closeout-not-ready"
    }
  };
}

export async function inspectEventSession(sessionId, context = {}) {
  if (!nonBlank(sessionId)) return eventTestFailure({ code: "m11-invalid-request-shape", path: "sessionId", message: "sessionId is required.", severity: "error" });
  const planningResult = await Promise.resolve(readVoyageEventSessionPlanning(sessionId, context));
  if (!planningResult?.ok) return inspectFailure(planningResult, sessionId);
  const expectedRevision = planningResult.revision ?? planningResult.projection?.revision;
  const projectionResult = await Promise.resolve(readVoyageEventSessionProjection(projectionRequest(sessionId, expectedRevision), context));
  if (!projectionResult?.ok) return inspectFailure(projectionResult, sessionId);
  const resolutionResult = await Promise.resolve(readVoyageEventSessionResolution(sessionId, context));
  if (!resolutionResult?.ok) return inspectFailure(resolutionResult, sessionId);
  const snapshot = projectionSnapshot(projectionResult, planningResult, resolutionResult);
  const isolated = safeClone(snapshot);
  if (!isolated.ok) return eventTestFailure({ code: "m11-invalid-session-document", path: "flags.arcflight.system.voyageSession", message: "Event Session inspection could not be isolated.", severity: "error" }, { sessionId });
  return { ok: true, sessionId, revision: expectedRevision, snapshot: isolated.value };
}

export async function inspectEventSessionAs(sessionId, userId, context = {}) {
  if (!nonBlank(sessionId) || !nonBlank(userId)) return eventTestFailure({ code: "m11-invalid-request-shape", path: "request", message: "sessionId and userId are required.", severity: "error" }, { sessionId });
  const planning = await Promise.resolve(readVoyageEventSessionPlanning(sessionId, context));
  if (!planning?.ok) return inspectFailure(planning, sessionId);
  const gm = readVoyageEventSessionProjection(projectionRequest(sessionId, planning.revision ?? planning.projection?.revision), context);
  const gmResult = await Promise.resolve(gm);
  if (!gmResult?.ok) return inspectFailure(gmResult, sessionId);
  const playerContext = { ...context, authenticatedUserId: userId };
  const result = await Promise.resolve(readVoyageEventSessionMultiplayerProjection(projectionRequest(sessionId, gmResult.revision, true), playerContext));
  if (!result?.ok) return inspectFailure(result, sessionId);
  const projection = result.projection ?? {};
  const visible = {
    projectionRole: projection.projectionRole ?? "observer",
    sessionState: projection.sessionState ?? null,
    phase: projection.phase ?? null,
    roundId: projection.roundId ?? null,
    roundNumber: projection.roundNumber ?? null,
    roundTitle: projection.roundTitle ?? null,
    vignette: projection.vignette ?? null,
    situation: projection.situation ?? null,
    objective: projection.objective ?? null,
    knownStakes: projection.knownStakes ?? null,
    assignedStations: projection.ownedOperators ?? [],
    visibleChoices: projection.ownedPlanningOptions ?? [],
    sharedStationOrder: projection.sharedStationOrder ?? [],
    planLocked: projection.planLocked === true,
    currentActingStationId: projection.currentActingStationId ?? null,
    reactionWindow: projection.reactionWindow ?? null,
    reactionControls: projection.reactionControls ?? projection.reactionWindowPending ?? [],
    aftermath: projection.aftermath ?? null,
    allowedActions: projection.allowedActions ?? []
  };
  const isolated = safeClone(visible);
  return isolated.ok ? { ok: true, sessionId, targetUser: targetUser(context, userId), projection: isolated.value } : eventTestFailure({ code: "m11-invalid-session-document", path: "projection", message: "Player projection could not be isolated.", severity: "error" }, { sessionId });
}

function actionMatches(action, filters) {
  const rules = Array.isArray(action?.outcomeDefinition?.effectRules) ? action.outcomeDefinition.effectRules : [];
  const branches = rules.filter((rule) => {
    if (filters.branch && rule?.payload?.branch !== filters.branch && rule?.branch !== filters.branch) return false;
    if (filters.effectKind && rule?.effectKind !== filters.effectKind && rule?.intentType !== filters.effectKind) return false;
    if (filters.intentType && rule?.intentType !== filters.intentType) return false;
    if (filters.pressureSystemId && rule?.pressureSystemId !== filters.pressureSystemId && rule?.payload?.pressureSystemId !== filters.pressureSystemId) return false;
    return true;
  });
  return branches;
}

function authoredActionMatches(input, source) {
  const matches = [];
  for (const round of source?.rounds ?? []) {
    if (input.roundId && round.roundId !== input.roundId) continue;
    for (const station of round.availableStations ?? []) {
      if (input.stationId && station.stationId !== input.stationId) continue;
      for (const action of station.actions ?? []) {
        const effects = actionMatches(action, input);
        if ((input.branch || input.effectKind || input.intentType || input.pressureSystemId) && effects.length === 0) continue;
        matches.push({
          roundId: round.roundId,
          roundNumber: round.roundNumber,
          stationId: station.stationId,
          actionId: action.actionId,
          name: action.name,
          description: action.description,
          branches: effects.map((rule) => rule.payload?.branch ?? rule.branch ?? null).filter(nonBlank),
          effects
        });
      }
    }
  }
  const isolated = safeClone(matches);
  return isolated.ok
    ? { ok: true, matches: isolated.value }
    : eventTestFailure({ code: "m11-invalid-session-document", path: "eventDefinition", message: "Authored action data could not be isolated.", severity: "error" });
}

export function findAuthoredActions(filters = {}, context = {}) {
  try {
    const captured = safeClone(filters);
    const input = captured.value;
    if (!captured.ok || input === null || typeof input !== "object" || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) {
      return eventTestFailure({ code: "m11-invalid-request-shape", path: "filters", message: "Action filters must be a plain object.", severity: "error" });
    }
    const eventId = input.eventId ?? M12_EVENT_ID;
    if (eventId !== M12_EVENT_ID) return { ok: true, matches: [] };
    const resolver = context.resolveEventDefinitionSnapshot;
    const definition = typeof resolver === "function" ? resolver(eventId, input.definitionSnapshotId ?? M12_DEFINITION_SNAPSHOT_ID) : getM12EventDefinition();
    if (definition && typeof definition.then === "function") return Promise.resolve(definition).then((resolved) => authoredActionMatches(input, resolved));
    return authoredActionMatches(input, definition);
  } catch {
    return eventTestFailure({ code: "m11-invalid-session-document", path: "eventDefinition", message: "Authored action data could not be read safely.", severity: "error" });
  }
}
export { STATIONS };
