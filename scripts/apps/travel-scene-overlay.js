import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { broadcastTravelPlayerStationCardToAllPlayers, openTravelPlayerStationCard, sendAllTravelPlayerStationCardsToPlayers, sendTravelPlayerMissionBoardToPlayers, sendTravelPlayerStationCardSocketDiagnostic, sendTravelPlayerStationCardToPlayers } from "./travel-player-station-card.js";
import {
  clearTravelEventRunnerStationAssignment,
  prepareTravelSceneOverlayState,
  resetTravelEventRunnerStationAssignmentToShip,
  setTravelEventRunnerStationResult,
  setTravelEventRunnerStationSkillApproach,
  updateTravelEventRunnerStationAssignment
} from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let activeTravelSceneOverlay = null;

const OVERLAY_VIEWPORT_MARGIN = 20;
const DEFAULT_OVERLAY_POSITION = Object.freeze({ left: 880, top: 120, width: 640, height: 720 });

function clampNumber(value, min, max) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return min;
  return Math.min(Math.max(normalized, min), max);
}

function getViewportSize() {
  return {
    width: Math.max(Number(globalThis.window?.innerWidth) || DEFAULT_OVERLAY_POSITION.width + (OVERLAY_VIEWPORT_MARGIN * 2), OVERLAY_VIEWPORT_MARGIN * 2),
    height: Math.max(Number(globalThis.window?.innerHeight) || DEFAULT_OVERLAY_POSITION.height + (OVERLAY_VIEWPORT_MARGIN * 2), OVERLAY_VIEWPORT_MARGIN * 2)
  };
}

function getClampedOverlayPosition(position = {}) {
  const viewport = getViewportSize();
  const margin = OVERLAY_VIEWPORT_MARGIN;
  const availableWidth = Math.max(viewport.width - (margin * 2), 1);
  const availableHeight = Math.max(viewport.height - (margin * 2), 1);
  const preferredWidth = Number(position.width) || DEFAULT_OVERLAY_POSITION.width;
  const preferredHeight = Number(position.height) || DEFAULT_OVERLAY_POSITION.height;
  const width = Math.min(preferredWidth, availableWidth);
  const height = Math.min(preferredHeight, availableHeight);
  const maxLeft = Math.max(viewport.width - width - margin, margin);
  const maxTop = Math.max(viewport.height - height - margin, margin);

  return {
    ...position,
    width,
    height,
    left: clampNumber(position.left ?? DEFAULT_OVERLAY_POSITION.left, margin, maxLeft),
    top: clampNumber(position.top ?? DEFAULT_OVERLAY_POSITION.top, margin, maxTop)
  };
}

function getOverlayElement(app) {
  const element = app?.element;
  if (!element) return null;
  if (element instanceof HTMLElement) return element;
  if (element[0] instanceof HTMLElement) return element[0];
  return null;
}

function isOverlayRendered(app) {
  return Boolean(app && (app.rendered === true || getOverlayElement(app)));
}

function bringOverlayToFront(app) {
  if (!isOverlayRendered(app) || !getOverlayElement(app)) return;
  if (typeof app.bringToFront === "function") app.bringToFront();
}

export class ArcflightTravelSceneOverlay extends HandlebarsApplicationMixin(ApplicationV2) {
  #boundOverlayClick = this.#onOverlayClick.bind(this);
  #boundOverlayChange = this.#onOverlayChange.bind(this);
  #pendingScrollState = null;

  constructor(options = {}) {
    super(options);
    this.session = options.session ?? null;
    this.actor = options.actor ?? null;
    this.onSessionUpdate = typeof options.onSessionUpdate === "function" ? options.onSessionUpdate : null;
    this.uiState = {
      scrollTop: 0,
      scrollSelector: ""
    };
  }

  static DEFAULT_OPTIONS = {
    id: "arcflight-travel-scene-overlay",
    classes: ["arcflight", "arcflight-travel-scene-overlay"],
    position: getClampedOverlayPosition(DEFAULT_OVERLAY_POSITION),
    window: { title: "Travel Scene Overlay", resizable: true }
  };

  static PARTS = {
    overlay: { template: arcflightTemplatePath("apps/travel-scene-overlay.hbs") }
  };

  render(force, options) {
    if (force === true) this.#captureScrollPosition();
    return super.render(force, options);
  }

  #getApplicationRoot() {
    return this.element?.closest?.(".app, .application, .window-app")
      ?? this.element
      ?? null;
  }

  #getScrollCandidates() {
    const root = this.#getApplicationRoot();
    const selectors = [
      ".arcflight-travel-scene-overlay",
      ".arcflight-travel-scene-overlay__body",
      ".window-content",
      ".application-content",
      "[data-application-part='overlay']",
      "[data-application-part]"
    ];
    const candidates = [];
    for (const element of [this.element, root]) {
      if (element) candidates.push({ element, selector: "" });
    }
    for (const selector of selectors) {
      const scoped = root?.querySelector?.(selector);
      if (scoped) candidates.push({ element: scoped, selector });
      const local = this.element?.querySelector?.(selector);
      if (local) candidates.push({ element: local, selector });
    }
    return candidates.filter((candidate, index, array) => candidate.element && array.findIndex((other) => other.element === candidate.element) === index);
  }

  #findScrollContainer(preferredSelector = "") {
    const candidates = this.#getScrollCandidates();
    if (preferredSelector) {
      const preferred = candidates.find((candidate) => candidate.selector === preferredSelector && this.#isScrollable(candidate.element));
      if (preferred) return preferred;
    }
    return candidates.find((candidate) => this.#isScrollable(candidate.element) && Number(candidate.element.scrollTop) > 0)
      ?? candidates.find((candidate) => this.#isScrollable(candidate.element))
      ?? candidates.find((candidate) => candidate.element)
      ?? null;
  }

  #isScrollable(element) {
    return Boolean(element && Number(element.scrollHeight) > Number(element.clientHeight) + 1);
  }

  #captureScrollPosition() {
    if (this.#pendingScrollState) return;
    const candidate = this.#findScrollContainer(this.uiState.scrollSelector);
    if (!candidate?.element || !Number.isFinite(Number(candidate.element.scrollTop))) return;
    this.uiState.scrollTop = candidate.element.scrollTop;
    this.uiState.scrollSelector = candidate.selector;
    this.#pendingScrollState = { scrollTop: candidate.element.scrollTop, selector: candidate.selector };
  }

  #restoreScrollPosition() {
    if (!this.#pendingScrollState) return;
    const pending = this.#pendingScrollState;
    const { scrollTop, selector } = pending;
    const restore = () => {
      const candidate = this.#findScrollContainer(selector);
      if (candidate?.element) {
        candidate.element.scrollTop = scrollTop;
        this.uiState.scrollTop = scrollTop;
        this.uiState.scrollSelector = candidate.selector;
      }
      if (this.#pendingScrollState === pending) this.#pendingScrollState = null;
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(restore));
    else setTimeout(restore, 0);
  }

  async setContext({ session = this.session, actor = this.actor, onSessionUpdate } = {}, { render = true } = {}) {
    this.session = session ?? null;
    this.actor = actor ?? null;
    if (typeof onSessionUpdate === "function") this.onSessionUpdate = onSessionUpdate;
    else if (onSessionUpdate === null) this.onSessionUpdate = null;
    if (render) await this.render(true);
    return this;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = prepareTravelSceneOverlayState(this.session, { actor: this.actor });
    return {
      ...context,
      state,
      hardBoundaryHint: "GM cockpit: manual station roll/result controls only; no combat integration, sockets/player ownership, player prompts, or actor/resource mutation beyond explicit runner-session updates."
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element?.removeEventListener("click", this.#boundOverlayClick);
    this.element?.addEventListener("click", this.#boundOverlayClick);
    this.element?.removeEventListener("change", this.#boundOverlayChange);
    this.element?.addEventListener("change", this.#boundOverlayChange);
    this.#restoreScrollPosition();
  }

  async close(options = {}) {
    if (activeTravelSceneOverlay === this) activeTravelSceneOverlay = null;
    return super.close(options);
  }

  async #onOverlayChange(event) {
    const assignmentSelect = event.target?.closest?.("[data-arcflight-overlay-assignment-select]");
    if (assignmentSelect && this.element?.contains(assignmentSelect)) {
      this.#captureScrollPosition();
      return this.#updateStationAssignment(assignmentSelect);
    }

    const approachSelect = event.target?.closest?.("[data-arcflight-overlay-approach-select]");
    if (approachSelect && this.element?.contains(approachSelect)) {
      this.#captureScrollPosition();
      return this.#updateStationSkillApproach(approachSelect);
    }
  }

  async #onOverlayClick(event) {
    const target = event.target?.closest?.("[data-arcflight-refresh-travel-scene-overlay], [data-arcflight-overlay-send-mission-board], [data-arcflight-overlay-socket-test], [data-arcflight-overlay-preview-player-card], [data-arcflight-overlay-send-player-card], [data-arcflight-overlay-broadcast-player-card], [data-arcflight-overlay-send-all-player-cards], [data-arcflight-overlay-roll-station], [data-arcflight-overlay-clear-assignment], [data-arcflight-overlay-reset-assignment]");
    if (!target || !this.element?.contains(target) || target.disabled === true) return;
    event.preventDefault();
    this.#captureScrollPosition();

    if (target.hasAttribute("data-arcflight-refresh-travel-scene-overlay")) return this.render(true);
    if (target.hasAttribute("data-arcflight-overlay-send-mission-board")) return this.#sendPlayerMissionBoard();
    if (target.hasAttribute("data-arcflight-overlay-socket-test")) return this.#sendSocketDiagnostic();
    if (target.hasAttribute("data-arcflight-overlay-preview-player-card")) return this.#previewPlayerStationCard(target);
    if (target.hasAttribute("data-arcflight-overlay-send-player-card")) return this.#sendPlayerStationCard(target);
    if (target.hasAttribute("data-arcflight-overlay-broadcast-player-card")) return this.#broadcastPlayerStationCard(target);
    if (target.hasAttribute("data-arcflight-overlay-send-all-player-cards")) return this.#sendAllPlayerStationCards();
    if (target.hasAttribute("data-arcflight-overlay-roll-station")) return this.#rollStationCheck(target);
    if (target.hasAttribute("data-arcflight-overlay-clear-assignment")) return this.#clearStationAssignment(target);
    if (target.hasAttribute("data-arcflight-overlay-reset-assignment")) return this.#resetStationAssignment(target);
  }

  async #previewPlayerStationCard(target) {
    const stationKey = target.dataset.stationKey ?? "";
    return openTravelPlayerStationCard({ session: this.session, stationKey, actor: this.actor });
  }

  async #sendPlayerMissionBoard() {
    const result = sendTravelPlayerMissionBoardToPlayers(this.session, { actor: this.actor, refresh: true });
    if (!result.ok) ui.notifications?.warn?.(result.errors?.[0] ?? "No active non-GM users found.");
    else ui.notifications?.info?.(`Sent player mission board to ${result.sentRecipients} active player recipient(s).`);
    return result;
  }

  async #sendSocketDiagnostic() {
    const result = sendTravelPlayerStationCardSocketDiagnostic();
    if (!result.ok) ui.notifications?.warn?.(result.errors?.[0] ?? "No active non-GM users found.");
    else ui.notifications?.info?.(`Sent socket diagnostic to ${result.sentRecipients} active player${result.sentRecipients === 1 ? "" : "s"}.`);
    return result;
  }

  async #sendPlayerStationCard(target) {
    const stationKey = target.dataset.stationKey ?? "";
    const result = sendTravelPlayerStationCardToPlayers(this.session, stationKey, { actor: this.actor });
    console.debug("Arcflight | Sending player station card.", {
      stationKey,
      targetUserIds: result.targetUserIds,
      owners: result.owners,
      fallbackBroadcast: result.fallbackBroadcast
    });
    if (!result.ok) ui.notifications?.warn?.(result.errors?.[0] ?? "No active player users found.");
    else if (result.fallbackBroadcast) ui.notifications?.warn?.(`No active player observer found for this station; sent fallback broadcast to ${result.sentRecipients} active non-GM player${result.sentRecipients === 1 ? "" : "s"}.`);
    else ui.notifications?.info?.(`Sent player station card to ${result.sentRecipients} active player recipient${result.sentRecipients === 1 ? "" : "s"}.`);
    return result;
  }

  async #broadcastPlayerStationCard(target) {
    const stationKey = target?.dataset?.stationKey ?? "";
    console.warn("Arcflight | Overlay Broadcast Player Card clicked.", {
      stationKey,
      hasSession: Boolean(this.session),
      sessionKey: this.session?.key
    });

    if (!stationKey) {
      ui.notifications?.error?.("Arcflight cannot broadcast player card: missing station key.");
      return null;
    }

    if (!this.session) {
      ui.notifications?.error?.("Arcflight cannot broadcast player card: overlay session is missing.");
      console.error("Arcflight | Overlay broadcast failed: missing session.", this);
      return null;
    }

    const result = broadcastTravelPlayerStationCardToAllPlayers(this.session, stationKey, { actor: this.actor });
    console.warn("Arcflight | Overlay Broadcast Player Card result.", result);

    if (!result?.ok) {
      ui.notifications?.error?.(`Arcflight failed to broadcast player card: ${(result?.errors ?? []).join(", ") || "unknown error"}`);
      return result;
    }

    ui.notifications?.info?.(`Broadcast player station card to ${result.sentRecipients ?? result.sent ?? 0} active player recipient(s).`);
    return result;
  }

  async #sendAllPlayerStationCards() {
    const result = sendAllTravelPlayerStationCardsToPlayers(this.session, { actor: this.actor });
    console.debug("Arcflight | Sending all player station cards.", {
      results: result.results?.map((entry) => ({
        stationKey: entry.stationKey,
        targetUserIds: entry.targetUserIds,
        owners: entry.owners,
        fallbackBroadcast: entry.fallbackBroadcast
      })) ?? []
    });
    if (!result.ok) ui.notifications?.warn?.(result.errors?.[0] ?? "No player station cards were sent.");
    else ui.notifications?.info?.(`Sent ${result.sentCards} player station card${result.sentCards === 1 ? "" : "s"} to ${result.sentRecipients} active player recipient(s). ${result.fallbackBroadcasts} used fallback broadcast. Skipped ${result.skipped}.`);
    return result;
  }

  async #applySessionUpdate(updated, fallbackMessage = "Travel overlay session updated.") {
    if (!updated?.ok || !updated.session) {
      const message = updated?.errors?.[0] ?? "Travel overlay update failed.";
      ui.notifications?.warn?.(message);
      await this.render(true);
      return false;
    }

    this.session = updated.session;
    if (typeof this.onSessionUpdate === "function") {
      try {
        await this.onSessionUpdate(updated.session, { source: "travelSceneOverlay" });
      } catch (error) {
        console.warn("Arcflight | Travel Scene Overlay session update callback failed.", error);
      }
    }
    ui.notifications?.info?.(fallbackMessage);
    await this.render(true);
    return true;
  }

  async #updateStationAssignment(select) {
    const stationKey = select.dataset.stationKey ?? "";
    const actorIdOrUuid = select.value ?? "";
    const updated = actorIdOrUuid
      ? updateTravelEventRunnerStationAssignment(this.session, stationKey, actorIdOrUuid, { ship: this.actor })
      : clearTravelEventRunnerStationAssignment(this.session, stationKey, { ship: this.actor });
    return this.#applySessionUpdate(updated, actorIdOrUuid ? "Updated travel station assignment." : "Cleared travel station assignment.");
  }

  async #updateStationSkillApproach(select) {
    const roundIndex = Number(select.dataset.roundIndex);
    const stationKey = select.dataset.stationKey ?? "";
    const skill = select.value ?? "";
    const updated = setTravelEventRunnerStationSkillApproach(this.session, roundIndex, stationKey, skill);
    return this.#applySessionUpdate(updated, "Updated travel station approach.");
  }

  #calculateDegree(total, dc, d20) {
    if (d20 === 20) return "criticalSuccess";
    if (d20 === 1) return "criticalFailure";
    if (total >= dc + 10) return "criticalSuccess";
    if (total >= dc) return "success";
    if (total <= dc - 10) return "criticalFailure";
    return "failure";
  }

  #degreeLabel(result) {
    return String(result ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  async #rollStationCheck(target) {
    const roundIndex = Number(target.dataset.roundIndex);
    const stationKey = target.dataset.stationKey ?? "";
    const dc = Number(target.dataset.dc);
    const modifier = Number(target.dataset.modifier);
    if (!Number.isFinite(roundIndex) || !stationKey || !Number.isFinite(dc) || !Number.isFinite(modifier)) {
      ui.notifications?.warn?.("Travel station roll is unavailable.");
      await this.render(true);
      return false;
    }

    let d20 = 0;
    if (globalThis.Roll) {
      const roll = await new Roll("1d20").evaluate();
      d20 = Number(roll.total);
      if (typeof roll.toMessage === "function") {
        await roll.toMessage({ flavor: `Arcflight Travel Station Check: ${stationKey}` }, { rollMode: "gmroll" });
      }
    } else {
      d20 = Math.floor(Math.random() * 20) + 1;
    }

    const total = d20 + modifier;
    const result = this.#calculateDegree(total, dc, d20);
    const updated = setTravelEventRunnerStationResult(this.session, roundIndex, stationKey, result);
    return this.#applySessionUpdate(updated, `Travel station roll: d20 ${d20} ${modifier >= 0 ? "+" : ""}${modifier} = ${total} vs DC ${dc} — ${this.#degreeLabel(result)} recorded.`);
  }

  async #clearStationAssignment(target) {
    const stationKey = target.dataset.stationKey ?? "";
    const updated = clearTravelEventRunnerStationAssignment(this.session, stationKey, { ship: this.actor });
    return this.#applySessionUpdate(updated, "Cleared travel station assignment.");
  }

  async #resetStationAssignment(target) {
    const stationKey = target.dataset.stationKey ?? "";
    const updated = resetTravelEventRunnerStationAssignmentToShip(this.session, stationKey, { ship: this.actor });
    const ok = await this.#applySessionUpdate(updated, updated?.warnings?.[0] ?? "Reset travel station assignment to ship assignment.");
    if (ok && updated?.warnings?.length) ui.notifications?.warn?.(updated.warnings[0]);
    return ok;
  }
}

export function getActiveTravelSceneOverlay() {
  return activeTravelSceneOverlay;
}

export async function updateActiveTravelSceneOverlayContext(options = {}, renderOptions = {}) {
  const app = activeTravelSceneOverlay;
  if (!app) return null;
  try {
    return await app.setContext(options, renderOptions);
  } catch (error) {
    console.warn("Arcflight | Unable to update Travel Scene Overlay context.", error);
    return null;
  }
}

export async function openTravelSceneOverlay(options = {}) {
  const appOptions = options && typeof options === "object" ? options : {};
  const app = activeTravelSceneOverlay ?? new ArcflightTravelSceneOverlay(appOptions);
  activeTravelSceneOverlay = app;

  try {
    await app.setContext(appOptions, { render: true });
    if (typeof app.setPosition === "function") app.setPosition(getClampedOverlayPosition({ ...DEFAULT_OVERLAY_POSITION, ...(appOptions.position ?? {}) }));
    bringOverlayToFront(app);
  } catch (error) {
    console.warn("Arcflight | Unable to open Travel Scene Overlay.", error);
  }

  return app;
}
