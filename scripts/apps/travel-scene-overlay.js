import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { prepareTravelSceneOverlayState } from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let activeTravelSceneOverlay = null;

function isOverlayRendered(app) {
  return Boolean(app && (app.rendered === true || app.element));
}

function bringOverlayToFront(app) {
  if (!app) return;
  if (typeof app.bringToFront === "function") {
    app.bringToFront();
    return;
  }
  if (typeof app.setPosition === "function") app.setPosition();
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
    position: { width: 640, height: "auto" },
    window: { title: "Travel Scene Overlay", resizable: true }
  };

  static PARTS = {
    overlay: { template: arcflightTemplatePath("apps/travel-scene-overlay.hbs") }
  };

  setContext({ session = this.session, actor = this.actor } = {}, { render = true, bringToFront = false } = {}) {
    this.session = session ?? null;
    this.actor = actor ?? null;
    if (render) this.render(true);
    if (bringToFront) bringOverlayToFront(this);
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

export function updateActiveTravelSceneOverlayContext(options = {}, renderOptions = {}) {
  if (!isOverlayRendered(activeTravelSceneOverlay)) return null;
  return activeTravelSceneOverlay.setContext(options, renderOptions);
}

export function openTravelSceneOverlay(options = {}) {
  const appOptions = options && typeof options === "object" ? options : {};
  const app = isOverlayRendered(activeTravelSceneOverlay)
    ? activeTravelSceneOverlay
    : new ArcflightTravelSceneOverlay(appOptions);
  activeTravelSceneOverlay = app;
  return app.setContext(appOptions, { render: true, bringToFront: true });
}
