import { arcflightTemplatePath } from "../sheets/sheet-helpers.js";
import { prepareTravelPlayerStationCardState } from "../helpers/travel-event-runner.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const activeTravelPlayerStationCards = new Map();

function stationCardInstanceKey(session, stationKey) {
  return `${session?.key ?? "unsaved-session"}:${stationKey || "station"}`;
}

function bringCardToFront(app) {
  if (!app) return;
  if (typeof app.bringToFront === "function") app.bringToFront();
}

export class ArcflightTravelPlayerStationCard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.session = options.session ?? null;
    this.stationKey = options.stationKey ?? "";
    this.actor = options.actor ?? null;
    this.instanceKey = stationCardInstanceKey(this.session, this.stationKey);
  }

  static DEFAULT_OPTIONS = {
    id: "arcflight-travel-player-station-card",
    classes: ["arcflight", "arcflight-travel-player-station-card"],
    position: { width: 420, height: "auto" },
    window: { title: "Travel Station Card", resizable: true }
  };

  static PARTS = {
    card: { template: arcflightTemplatePath("apps/travel-player-station-card.hbs") }
  };

  async setContext({ session = this.session, stationKey = this.stationKey, actor = this.actor } = {}, { render = true } = {}) {
    const previousKey = this.instanceKey;
    this.session = session ?? null;
    this.stationKey = stationKey ?? "";
    this.actor = actor ?? null;
    this.instanceKey = stationCardInstanceKey(this.session, this.stationKey);
    if (previousKey !== this.instanceKey && activeTravelPlayerStationCards.get(previousKey) === this) activeTravelPlayerStationCards.delete(previousKey);
    activeTravelPlayerStationCards.set(this.instanceKey, this);
    if (render) await this.render(true);
    return this;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = prepareTravelPlayerStationCardState(this.session, this.stationKey, { actor: this.actor });
    return { ...context, state };
  }

  async close(options = {}) {
    if (activeTravelPlayerStationCards.get(this.instanceKey) === this) activeTravelPlayerStationCards.delete(this.instanceKey);
    return super.close(options);
  }
}

export async function openTravelPlayerStationCard(options = {}) {
  const appOptions = options && typeof options === "object" ? options : {};
  const key = stationCardInstanceKey(appOptions.session, appOptions.stationKey);
  const app = activeTravelPlayerStationCards.get(key) ?? new ArcflightTravelPlayerStationCard(appOptions);
  activeTravelPlayerStationCards.set(key, app);

  try {
    await app.setContext(appOptions, { render: true });
    bringCardToFront(app);
  } catch (error) {
    console.warn("Arcflight | Unable to open Travel Player Station Card.", error);
  }

  return app;
}
