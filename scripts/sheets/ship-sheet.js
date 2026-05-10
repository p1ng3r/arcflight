import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE, getArcflightShipData } from "../documents/ships.js";
import { arcflightTemplatePath } from "./sheet-helpers.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

function prepareArcflightShipFlags(actor) {
  return {
    enabled: actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true,
    actorType: actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") ?? "",
    system: getArcflightShipData(actor)
  };
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function displayNameForEntry(entry = {}) {
  return entry.displayName
    || entry.identity?.displayName
    || entry.name
    || entry.key
    || entry.id
    || "Unnamed";
}

function prepareInstalledEntry(entry = {}) {
  return {
    ...entry,
    displayName: displayNameForEntry(entry),
    effects: {
      ...(entry.effects ?? {}),
      derivedStatModifiers: arrayOrEmpty(entry.effects?.derivedStatModifiers)
    }
  };
}

function prepareCrewEntry(entry = {}) {
  return {
    ...entry,
    displayName: displayNameForEntry(entry),
    identity: entry.identity ?? {},
    crew: entry.crew ?? {},
    stationAssignment: entry.stationAssignment ?? {}
  };
}

function prepareSlotState(slotState = {}, fallbackCapacity = 0) {
  const capacity = Number.isFinite(Number(slotState?.capacity)) ? Number(slotState.capacity) : fallbackCapacity;
  const used = Number.isFinite(Number(slotState?.used)) ? Number(slotState.used) : 0;
  const available = Number.isFinite(Number(slotState?.available)) ? Number(slotState.available) : Math.max(capacity - used, 0);

  return { capacity, used, available };
}

function prepareArcflightShipViewData(arcflight) {
  const system = foundry.utils.deepClone(arcflight.system ?? {});
  system.installed = system.installed ?? {};
  system.installed.arkengineMods = arrayOrEmpty(system.installed.arkengineMods).map(prepareInstalledEntry);
  system.installed.coreRooms = arrayOrEmpty(system.installed.coreRooms).map(prepareInstalledEntry);
  system.installed.rooms = arrayOrEmpty(system.installed.rooms).map(prepareInstalledEntry);
  system.installed.shipUpgrades = arrayOrEmpty(system.installed.shipUpgrades).map(prepareInstalledEntry);
  system.installed.arkengineModSlots = prepareSlotState(system.installed.arkengineModSlots);
  system.installed.roomSlots = prepareSlotState(system.installed.roomSlots);
  system.installed.shipUpgradeSlots = prepareSlotState(system.installed.shipUpgradeSlots, 3);
  system.crew = system.crew ?? {};
  system.crew.namedCrew = arrayOrEmpty(system.crew.namedCrew).map(prepareCrewEntry);

  return {
    ...arcflight,
    system
  };
}

function prepareStationRows(stations = {}) {
  return Object.values(stations.definitions ?? {}).map((station) => {
    const assignment = stations.assignments?.[station.key] ?? null;

    return {
      ...station,
      assignment,
      assigneeName: assignment?.name || "Unassigned"
    };
  });
}

/** Lightweight ApplicationV2 sheet foundation for Arcflight PF2E vehicle actors. */
export class ArcflightShipSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["arcflight", "sheet", "actor", "ship", "vehicle"],
    tag: "form",
    position: {
      width: 560,
      height: 640
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    sheet: {
      template: arcflightTemplatePath("actors/ship-sheet.hbs")
    }
  };

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    this.element
      .querySelector?.("[data-arcflight-enable-ship]")
      ?.addEventListener("click", this.#onEnableArcflightShip.bind(this));
  }

  async #onEnableArcflightShip(event) {
    event.preventDefault();

    if (this.document?.type !== "vehicle") {
      ui.notifications?.warn?.("Arcflight ships must be PF2E vehicle actors.");
      return;
    }

    await this.document.update({
      [`flags.${ARCFLIGHT_MODULE_ID}.enabled`]: true,
      [`flags.${ARCFLIGHT_MODULE_ID}.actorType`]: ARCFLIGHT_SHIP_ACTOR_TYPE,
      [`flags.${ARCFLIGHT_MODULE_ID}.system`]: getArcflightShipData(this.document)
    });

    this.render(true);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const arcflight = prepareArcflightShipViewData(prepareArcflightShipFlags(this.document));

    const stations = prepareStationRows(arcflight.system.stations);

    return {
      ...context,
      actor: this.document,
      arcflight,
      stations,
      arcflightActorType: ARCFLIGHT_SHIP_ACTOR_TYPE,
      arcflightSystemPath: `flags.${ARCFLIGHT_MODULE_ID}.system`
    };
  }
}

export { ArcflightShipSheet as ShipSheet };
