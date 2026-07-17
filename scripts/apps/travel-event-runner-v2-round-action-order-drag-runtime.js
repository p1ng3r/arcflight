import {
  prepareTravelV2RoundActionOrderState,
  resolveTravelV2RoundActionOrderDropTarget
} from "../helpers/travel-v2-round-action-order-state.js";

export const TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_RUNTIME_VERSION = 1;

export const TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME =
  "application/x-arcflight-travel-v2-round-action-order";

export const TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR =
  "[data-arcflight-travel-v2-order-drag-list]";

export const TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR =
  "[data-arcflight-travel-v2-order-drag-row]";

const PAYLOAD_TYPE = "travel-v2-round-action-order";

function blocked(reason, extra = {}) {
  return { ok: false, blocked: true, reason, ...extra };
}

function normalizeRoundIndex(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function contextFor(app) {
  return {
    sessionKey: String(app?.session?.key ?? app?.selectedSessionKey ?? ""),
    roundIndex: normalizeRoundIndex(app?.session?.currentRoundIndex)
  };
}

function payloadClone(payload) {
  return payload ? { ...payload } : null;
}

function validPayload(payload) {
  return payload
    && payload.version === TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_RUNTIME_VERSION
    && payload.type === PAYLOAD_TYPE
    && typeof payload.stationKey === "string"
    && payload.stationKey.trim() !== ""
    && typeof payload.sessionKey === "string"
    && Number.isInteger(payload.roundIndex)
    && payload.roundIndex >= 0;
}

function parsePayload(json) {
  if (typeof json !== "string" || json.trim() === "") return blocked("Round action-order drag payload is missing.");
  try {
    const payload = JSON.parse(json);
    if (!validPayload(payload)) return blocked("Round action-order drag payload is malformed.");
    return { ok: true, blocked: false, payload: payloadClone(payload) };
  } catch (_error) {
    return blocked("Round action-order drag payload JSON is malformed.");
  }
}

function prepareState(app) {
  return prepareTravelV2RoundActionOrderState(app?.session, {
    user: globalThis.game?.user,
    isGM: globalThis.game?.user?.isGM === true,
    proposedOrder: app?.uiState?.travelV2ProposedRoundActionOrder,
    travelV2RoundActionOrderReorderRequested:
      app?.uiState?.travelV2RoundActionOrderReorderRequested === true
  });
}

function rootFor(app, event) {
  return event?.currentTarget ?? app?.element ?? null;
}

function contains(root, node) {
  if (!root || !node) return false;
  if (root === node) return true;
  return root.contains?.(node) === true;
}

function findRow(event) {
  return event?.target?.closest?.(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR) ?? null;
}

function findListFromTarget(event) {
  return event?.target?.closest?.(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR) ?? null;
}

function findListForRow(row) {
  return row?.closest?.(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_LIST_SELECTOR) ?? null;
}

function findInteractionRow(interaction, stationKey) {
  return Array.isArray(interaction?.rows)
    ? interaction.rows.find((row) => row?.stationKey === stationKey)
    : null;
}

function contextMatches(payload, app) {
  const context = contextFor(app);
  return payload?.sessionKey === context.sessionKey && payload?.roundIndex === context.roundIndex;
}

function readDropPayload(event, activePayload) {
  const dataTransfer = event?.dataTransfer;
  let mayUseActiveFallback = false;
  if (typeof dataTransfer?.getData === "function") {
    let rawPayload = "";
    try {
      rawPayload = dataTransfer.getData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME);
    } catch (_error) {
      return blocked("Round action-order drag payload could not be read.");
    }
    if (typeof rawPayload !== "string") {
      return blocked("Round action-order drag payload is malformed.");
    }
    if (rawPayload !== "") {
      return parsePayload(rawPayload);
    }
    mayUseActiveFallback = true;
  } else {
    mayUseActiveFallback = true;
  }
  if (mayUseActiveFallback) {
    if (validPayload(activePayload)) return { ok: true, blocked: false, payload: payloadClone(activePayload) };
  }
  return blocked("A valid internal round action-order drag payload is required.");
}

function rowBoundsFor(list) {
  const rows = Array.from(list?.querySelectorAll?.(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_ROW_SELECTOR) ?? []);
  return rows.map((row) => {
    const rect = row?.getBoundingClientRect?.() ?? {};
    return {
      stationKey: row?.dataset?.stationKey,
      top: rect.top,
      bottom: rect.bottom
    };
  });
}

export function createTravelV2RoundActionOrderDragRuntime(app = null) {
  let activePayload = null;

  function clear() {
    activePayload = null;
    return { ok: true, cleared: true };
  }

  function inspect() {
    return Object.freeze({
      active: activePayload !== null,
      payload: activePayload ? Object.freeze(payloadClone(activePayload)) : null
    });
  }

  function onDragStart(event) {
    const row = findRow(event);
    if (!row) return blocked("Round action-order drag row was not found.", { started: false });
    const list = findListForRow(row);
    if (!list) return blocked("Round action-order drag list was not found.", { started: false });
    const root = rootFor(app, event);
    if (!contains(root, row) || !contains(root, list)) return blocked("Round action-order drag is outside the runner.", { started: false });
    const stationKey = typeof row?.dataset?.stationKey === "string" ? row.dataset.stationKey.trim() : "";
    if (!stationKey) return blocked("Round action-order drag station key is missing.", { started: false });

    const state = prepareState(app);
    const interaction = state.reorderInteraction;
    if (interaction?.dragEnabled !== true) return blocked(interaction?.blockedReason || "Round action-order drag is unavailable.", { started: false });
    const interactionRow = findInteractionRow(interaction, stationKey);
    if (interactionRow?.draggable !== true) return blocked("Round action-order row is not draggable.", { started: false });
    if (typeof event?.dataTransfer?.setData !== "function") return blocked("Round action-order drag data transfer is unavailable.", { started: false });

    const context = contextFor(app);
    const payload = {
      version: TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_RUNTIME_VERSION,
      type: PAYLOAD_TYPE,
      stationKey,
      sessionKey: context.sessionKey,
      roundIndex: context.roundIndex
    };
    try {
      event.dataTransfer.setData(TRAVEL_V2_ROUND_ACTION_ORDER_DRAG_MIME, JSON.stringify(payload));
    } catch (_error) {
      return blocked("Round action-order drag payload could not be written.", { started: false });
    }
    try { event.dataTransfer.effectAllowed = "move"; } catch (_error) { /* no-op */ }
    activePayload = payloadClone(payload);
    return { ok: true, started: true, blocked: false, payload: payloadClone(payload) };
  }

  function onDragOver(event) {
    if (!validPayload(activePayload) || !contextMatches(activePayload, app)) return blocked("No valid internal round action-order drag is active.");
    const list = findListFromTarget(event);
    const root = rootFor(app, event);
    if (!contains(root, list)) return blocked("Round action-order dragover is outside the runner list.");
    const state = prepareState(app);
    if (state.reorderInteraction?.dropTargetEnabled !== true) return blocked(state.reorderInteraction?.blockedReason || "Round action-order drop target is unavailable.");
    event?.preventDefault?.();
    try { if (event?.dataTransfer) event.dataTransfer.dropEffect = "move"; } catch (_error) { /* no-op */ }
    return { ok: true, blocked: false, over: true };
  }

  function onDrop(event) {
    const list = findListFromTarget(event);
    const root = rootFor(app, event);
    if (!contains(root, list)) return blocked("Round action-order drop is outside the runner list.");
    const payloadResult = readDropPayload(event, activePayload);
    if (payloadResult.ok !== true) {
      clear();
      return payloadResult;
    }
    const payload = payloadResult.payload;
    if (!contextMatches(payload, app)) {
      clear();
      return blocked("Round action-order drag payload is stale.");
    }

    const state = prepareState(app);
    const interaction = state.reorderInteraction;
    if (interaction?.dragEnabled !== true || interaction?.dropTargetEnabled !== true) {
      clear();
      return blocked(interaction?.blockedReason || "Round action-order drop is unavailable.");
    }

    event?.preventDefault?.();
    const resolved = resolveTravelV2RoundActionOrderDropTarget(interaction.candidateOrder, {
      stationKey: payload.stationKey,
      pointerY: event?.clientY,
      rowBounds: rowBoundsFor(list),
      activeStations: state.activeStations
    });
    if (resolved?.blocked === true) {
      clear();
      app.statusMessage = resolved.reason || "Round action-order drop target is blocked.";
      globalThis.ui?.notifications?.warn?.(app.statusMessage);
      return resolved;
    }
    if (resolved?.sameIndex === true) {
      clear();
      return { ...resolved, ok: true, blocked: false, dropped: true, moved: false };
    }
    if (resolved?.wouldMove === true) {
      clear();
      const movement = app?.moveTravelV2RoundActionOrderCandidate?.(payload.stationKey, { targetIndex: resolved.targetIndex });
      return { ...resolved, dropped: true, movement };
    }
    clear();
    return blocked("Round action-order drop target did not resolve movement.");
  }

  function onDragEnd(_event) {
    clear();
    return { ok: true, blocked: false, ended: true };
  }

  return Object.freeze({ onDragStart, onDragOver, onDrop, onDragEnd, clear, inspect });
}

export default createTravelV2RoundActionOrderDragRuntime;
