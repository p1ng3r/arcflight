import { getArkenginePattern, getArkenginePatternKeys } from "../../data/arkengines/arkengine-patterns.js";
import { getHullPattern, getHullPatternKeys } from "../../data/hulls/hull-patterns.js";
import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getComponentType } from "../documents/components.js";
import {
  ARCFLIGHT_SHIP_ACTOR_TYPE,
  addCrewAsset,
  getArcflightShipData,
  installArkengine,
  installArkengineMod,
  installHull,
  installRoom,
  installShipUpgrade,
  setArkenginePattern,
  setHullPattern
} from "../documents/ships.js";
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

function humanizeIdentifier(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayNameForEntry(entry = {}) {
  const displayName = entry.displayName
    || entry.identity?.displayName
    || entry.name
    || entry.key
    || entry.id
    || "Unnamed";

  return humanizeIdentifier(displayName);
}

function displayNameForInstalledSingle(name, fallback = "") {
  return humanizeIdentifier(name || fallback);
}

function preparePatternOptions(patternKeys = [], getPattern, selectedKey = "") {
  return arrayOrEmpty(patternKeys).map((key) => {
    const pattern = getPattern(key) ?? {};

    return {
      value: key,
      label: displayNameForEntry({ ...pattern, key }),
      selected: key === selectedKey
    };
  });
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
  system.installed.hullDisplayName = displayNameForInstalledSingle(
    system.installed.hullName,
    system.base?.hull?.displayName || system.base?.hull?.platform
  );
  system.installed.arkengineDisplayName = displayNameForInstalledSingle(
    system.installed.arkengineName,
    system.base?.arkengine?.displayName || system.installed.arkengineKey
  );
  system.installed.hasHull = Boolean(system.installed.hullItemId || system.installed.hullUuid || system.installed.hullName);
  system.installed.hasArkengine = Boolean(system.installed.arkengineItemId || system.installed.arkengineUuid || system.installed.arkengineName);
  system.installed.hullPatternKey = system.installed.hullPattern?.key ?? "";
  system.installed.arkenginePatternKey = system.installed.arkenginePattern?.key ?? "";
  system.installed.hullPatternOptions = preparePatternOptions(
    getHullPatternKeys(),
    getHullPattern,
    system.installed.hullPatternKey
  );
  system.installed.arkenginePatternOptions = preparePatternOptions(
    getArkenginePatternKeys(),
    getArkenginePattern,
    system.installed.arkenginePatternKey
  );
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

function isArcflightShipEnabled(actor) {
  return actor?.type === "vehicle"
    && actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true
    && actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

async function getDroppedItem(event) {
  const dragData = globalThis.TextEditor?.getDragEventData?.(event) ?? {};
  const uuid = dragData.uuid || dragData.itemUuid;
  if (uuid) {
    const document = await globalThis.fromUuid?.(uuid);
    return document?.documentName === "Item" ? document : null;
  }

  if (dragData.type !== "Item") return null;
  if (dragData.pack && dragData.id) {
    return await game.packs?.get(dragData.pack)?.getDocument?.(dragData.id) ?? null;
  }

  return game.items?.get?.(dragData.id) ?? null;
}

const dropInstallers = Object.freeze({
  [ARCFLIGHT_ITEM_TYPES.HULL]: installHull,
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE]: installArkengine,
  [ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD]: installArkengineMod,
  [ARCFLIGHT_ITEM_TYPES.ROOM]: installRoom,
  [ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE]: installShipUpgrade,
  [ARCFLIGHT_ITEM_TYPES.CREW_ASSET]: addCrewAsset
});

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

    const builder = this.element.querySelector?.("[data-arcflight-ship-builder]");
    builder?.addEventListener("dragover", this.#onDragOverShipBuilder.bind(this));
    builder?.addEventListener("drop", this.#onDropShipBuilder.bind(this));

    this.element
      .querySelector?.("[data-arcflight-hull-pattern]")
      ?.addEventListener("change", this.#onChangeHullPattern.bind(this));

    this.element
      .querySelector?.("[data-arcflight-arkengine-pattern]")
      ?.addEventListener("change", this.#onChangeArkenginePattern.bind(this));
  }

  async #onChangeHullPattern(event) {
    event.preventDefault();

    const patternKey = event.currentTarget?.value ?? "";
    if (!patternKey) return;

    try {
      await setHullPattern(this.document, patternKey);
      this.render(true);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not set that hull pattern.");
      console.warn("Arcflight | Hull pattern selection failed.", error);
    }
  }

  async #onChangeArkenginePattern(event) {
    event.preventDefault();

    const patternKey = event.currentTarget?.value ?? "";
    if (!patternKey) return;

    try {
      await setArkenginePattern(this.document, patternKey);
      this.render(true);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not set that arkengine pattern.");
      console.warn("Arcflight | Arkengine pattern selection failed.", error);
    }
  }

  #onDragOverShipBuilder(event) {
    if (!isArcflightShipEnabled(this.document)) return;

    event.preventDefault();
    event.stopPropagation();
  }

  async #onDropShipBuilder(event) {
    if (!isArcflightShipEnabled(this.document)) return;

    event.preventDefault();
    event.stopPropagation();
    const item = await getDroppedItem(event);
    const componentType = getComponentType(item);
    const install = dropInstallers[componentType];

    if (!install) {
      ui.notifications?.warn?.("Drop an Arcflight Hull, Arkengine, Arkengine Mod, Room, Ship Upgrade, or Crew Asset component onto this ship builder.");
      return;
    }

    try {
      await install(this.document, item);
      this.render(true);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not install that component on this ship.");
      console.warn("Arcflight | Ship builder drop install failed.", error);
    }
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
