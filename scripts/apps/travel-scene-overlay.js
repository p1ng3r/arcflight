import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { prepareTravelSceneOverlayState } from "../helpers/travel-event-runner.js";

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

  constructor(options = {}) {
    super(options);
    this.session = options.session ?? null;
    this.actor = options.actor ?? null;
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

  async setContext({ session = this.session, actor = this.actor } = {}, { render = true } = {}) {
    this.session = session ?? null;
    this.actor = actor ?? null;
    if (render) await this.render(true);
    return this;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = prepareTravelSceneOverlayState(this.session, { actor: this.actor });
    return {
      ...context,
      state,
      hardBoundaryHint: "Read-only scene overlay shell: no rolls, effects, ownership changes, combat integration, or travel automation."
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element?.removeEventListener("click", this.#boundOverlayClick);
    this.element?.addEventListener("click", this.#boundOverlayClick);
  }

  async close(options = {}) {
    if (activeTravelSceneOverlay === this) activeTravelSceneOverlay = null;
    return super.close(options);
  }

  #onOverlayClick(event) {
    const target = event.target?.closest?.("[data-arcflight-refresh-travel-scene-overlay]");
    if (!target || !this.element?.contains(target) || target.disabled === true) return;
    event.preventDefault();
    this.render(true);
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
