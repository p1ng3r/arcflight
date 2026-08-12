import { readVoyageEventSessionProjection, reloadVoyageEventSession } from "../foundry/event-session-runtime.js";
import { buildVoyageEventManagerDashboardModel, launchVoyageEventSession, listVoyageEventLaunchShips, normalizeVoyageEventOperatorSelections } from "../foundry/event-launcher.js";
import { M12_EVENT_PRESENTATION, M12_STATION_IDS } from "../m12/event-definition.js";
import { arcflightTemplatePath } from "../../sheets/sheet-helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

function actors() {
  try { return game.actors ? (typeof game.actors.values === "function" ? [...game.actors.values()] : Array.from(game.actors)) : []; } catch { return []; }
}
function activeGmId() {
  try { return game.users?.activeGM?.id ?? game.users?.find?.((user) => user?.isGM && user.active)?.id ?? null; } catch { return null; }
}
function eventContext() {
  const connectionId = game.socket?.id ?? null;
  return {
    authenticatedUserId: game.user?.id ?? null,
    authenticatedConnectionId: connectionId,
    trustedTransportContext: typeof connectionId === "string" && connectionId.length > 0,
    activeGmUserId: activeGmId(),
    users: game.users,
    actors: game.actors,
    journalEntries: game.journal,
    JournalEntry,
    isJournalEntryDocument: (document) => document?.documentName === "JournalEntry" || document?.constructor?.name === "JournalEntry",
    createDocumentId: () => foundry.utils.randomID(),
    resolveEventDefinitionSnapshot: async (eventId, definitionSnapshotId) => game.arcflight.getM12EventDefinition(eventId, definitionSnapshotId),
    runExclusiveSessionMutation: game.arcflight?.runExclusiveSessionMutation
  };
}
function randomId(prefix) { return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`; }

export class ArcflightEventManager extends HandlebarsApplicationMixin(ApplicationV2) {
  #expectedRevision = 0;
  #mode = "setup";
  #sessionId = null;
  #operatorSelections = Object.fromEntries(M12_STATION_IDS.map((stationId) => [stationId, null]));
  #shipId = "";

  static DEFAULT_OPTIONS = {
    id: "arcflight-event-manager",
    classes: ["arcflight", "event-manager"],
    tag: "section",
    position: { width: 720, height: 680 },
    window: { resizable: true }
  };

  static PARTS = { body: { template: arcflightTemplatePath("voyage/event-manager.hbs") } };

  async _prepareContext() {
    const allActors = actors();
    const ships = listVoyageEventLaunchShips(allActors);
    if (!this.#shipId && ships[0]) this.#shipId = ships[0].id;
    let dashboard = null;
    if (this.#mode === "live" && this.#sessionId) {
      const projection = readVoyageEventSessionProjection({ kind: "voyage.m11-read-projection", requestId: randomId("m12-read"), sessionId: this.#sessionId, expectedRevision: this.#expectedRevision ?? 0 }, eventContext());
      if (projection.ok) dashboard = { ...buildVoyageEventManagerDashboardModel(projection.projection, M12_EVENT_PRESENTATION, eventContext().activeGmUserId), shipName: allActors.find((actor) => actor.id === this.#shipId)?.name ?? this.#shipId ?? "" };
    }
    const operatorActors = allActors.filter((actor) => actor?.type !== "vehicle").map((actor) => ({ id: actor.id, name: actor.name ?? actor.id }));
    const normalized = normalizeVoyageEventOperatorSelections(this.#operatorSelections, allActors);
    return {
      mode: this.#mode,
      event: M12_EVENT_PRESENTATION,
      ships: ships.map((ship) => ({ ...ship, selected: ship.id === this.#shipId })),
      operators: operatorActors,
      stations: M12_STATION_IDS.map((stationId) => ({ stationId, label: stationId.replace(/(^|-)(\w)/g, (_m, _p, c) => c.toUpperCase()), selected: this.#operatorSelections[stationId] ?? "", occupied: Boolean(this.#operatorSelections[stationId]), options: [{ id: "", name: "Unoccupied", selected: !this.#operatorSelections[stationId] }, ...operatorActors.map((operator) => ({ ...operator, selected: operator.id === this.#operatorSelections[stationId] }))] })),
      setupMode: this.#mode === "setup",
      liveMode: this.#mode === "live",
      validationErrors: normalized.valid ? [] : normalized.errors.map((error) => error.message),
      launchEnabled: Boolean(this.#shipId && normalized.valid && game.user?.isGM && activeGmId() === game.user?.id),
      sessionId: this.#sessionId,
      dashboard
    };
  }

  discoverDurableSession() {
    if (!game.user?.isGM || activeGmId() !== game.user.id) return false;
    const journals = (() => { try { return game.journal ? (typeof game.journal.values === "function" ? [...game.journal.values()] : Array.from(game.journal)) : []; } catch { return []; } })();
    const candidates = journals.map((entry) => {
      try {
        const session = entry?.flags?.arcflight?.system?.voyageSession ?? entry?.toObject?.()?.flags?.arcflight?.system?.voyageSession;
        if (!session || session.eventId !== M12_EVENT_PRESENTATION.eventId) return null;
        const reloaded = reloadVoyageEventSession(session.sessionId, eventContext());
        if (!reloaded.ok || ["completed", "aborted"].includes(reloaded.status)) return null;
        return { sessionId: session.sessionId, revision: reloaded.revision, shipId: session.shipId };
      } catch { return null; }
    }).filter(Boolean);
    if (candidates.length !== 1) return false;
    this.#sessionId = candidates[0].sessionId;
    this.#expectedRevision = candidates[0].revision;
    this.#shipId = candidates[0].shipId;
    this.#mode = "live";
    return true;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelectorAll("[data-m12-ship]").forEach((input) => input.addEventListener("change", (event) => { this.#shipId = event.currentTarget.value; this.render(); }));
    this.element.querySelectorAll("[data-m12-operator]").forEach((input) => input.addEventListener("change", (event) => { this.#operatorSelections[event.currentTarget.dataset.m12Operator] = event.currentTarget.value || null; this.render(); }));
    this.element.querySelector("[data-m12-launch]")?.addEventListener("click", () => this.#launch());
    this.element.querySelector("[data-m12-refresh]")?.addEventListener("click", () => this.render());
    this.element.querySelector("[data-m12-new-session]")?.addEventListener("click", () => { this.#mode = "setup"; this.#sessionId = null; this.render(); });
  }

  async #launch() {
    const request = { kind: "voyage.m12-launch-event", requestId: randomId("m12-launch"), sessionId: randomId("voyage-session"), expectedRevision: 0, authorityEpoch: 0, eventId: M12_EVENT_PRESENTATION.eventId, definitionSnapshotId: M12_EVENT_PRESENTATION.definitionSnapshotId, shipId: this.#shipId, operatorSelections: { ...this.#operatorSelections } };
    const result = await (game.arcflight?.launchVoyageEventSession ?? launchVoyageEventSession)(request);
    if (!result.ok) return ui.notifications?.error?.(result.errors?.[0]?.message ?? "Arcflight could not launch the event.");
    this.#sessionId = result.sessionId; this.#expectedRevision = result.revision; this.#mode = "live"; this.render();
  }
}

export function openArcflightEventManager() {
  if (!game.user?.isGM || activeGmId() !== game.user.id) return ui.notifications?.warn?.("Only the active GM can open the Arcflight Event Manager.");
  const manager = new ArcflightEventManager();
  manager.discoverDurableSession();
  return manager.render({ force: true });
}
