import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { prepareTravelSceneOverlayState } from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ArcflightTravelSceneOverlay extends HandlebarsApplicationMixin(ApplicationV2) {
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

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = prepareTravelSceneOverlayState(this.session, { actor: this.actor });
    return {
      ...context,
      state,
      hardBoundaryHint: "Read-only scene overlay shell: no rolls, effects, ownership changes, combat integration, or travel automation."
    };
  }
}

export function openTravelSceneOverlay(options = {}) {
  const appOptions = options && typeof options === "object" ? options : {};
  const app = new ArcflightTravelSceneOverlay(appOptions);
  app.render(true);
  return app;
}
