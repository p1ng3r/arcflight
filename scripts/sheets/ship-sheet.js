import { getArkenginePattern, getArkenginePatternKeys } from "../../data/arkengines/arkengine-patterns.js";
import { getHullPattern, getHullPatternKeys } from "../../data/hulls/hull-patterns.js";
import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getComponentType } from "../documents/components.js";
import { getInstallState, prepareInstallStateSummary } from "../helpers/install-state.js";
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

function prepareExampleBuildOptions(selectedKey = "") {
  const arcflightApi = game?.arcflight;
  const getBuildKeys = arcflightApi?.getExampleShipBuildKeys;
  const getBuild = arcflightApi?.getExampleShipBuild;

  if (typeof getBuildKeys !== "function" || typeof getBuild !== "function") return [];

  return arrayOrEmpty(getBuildKeys.call(arcflightApi)).map((key) => {
    const build = getBuild.call(arcflightApi, key) ?? {};
    const name = build.name || displayNameForEntry({ ...build, key });

    return {
      value: key,
      name,
      role: build.role ?? "",
      description: build.description ?? "",
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

function numericDisplayValue(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function prepareFuelingDisplay(system = {}) {
  const derived = system.derived ?? {};
  const current = system.current ?? {};
  const fueling = system.base?.arkengine?.fueling ?? {};
  const requiredSpellRank = numericDisplayValue(fueling.requiredSpellRank);
  const fuelSlots = numericDisplayValue(derived.fuelSlots, numericDisplayValue(fueling.fuelSlots));
  const maxStoredSpellRanks = numericDisplayValue(
    derived.maxStoredSpellRanks,
    numericDisplayValue(fueling.maxStoredSpellRanks, requiredSpellRank * fuelSlots)
  );

  return {
    fuelSlots,
    maxStoredSpellRanks,
    currentStoredSpellRanks: numericDisplayValue(current.storedSpellRanks),
    normalHexCost: numericDisplayValue(derived.normalHexCost, requiredSpellRank),
    hardBurnHexCost: numericDisplayValue(derived.hardBurnHexCost, Math.ceil(requiredSpellRank * 1.5)),
    leanBurnHexCost: numericDisplayValue(derived.leanBurnHexCost, Math.ceil(requiredSpellRank / 2)),
    stealthBurnHexCost: numericDisplayValue(derived.stealthBurnHexCost, Math.ceil(requiredSpellRank * 1.5))
  };
}

function prepareSlotState(slotState = {}, fallbackCapacity = 0) {
  const capacity = Number.isFinite(Number(slotState?.capacity)) ? Number(slotState.capacity) : fallbackCapacity;
  const used = Number.isFinite(Number(slotState?.used)) ? Number(slotState.used) : 0;
  const available = Number.isFinite(Number(slotState?.available)) ? Number(slotState.available) : Math.max(capacity - used, 0);

  return { capacity, used, available };
}

function prepareBooleanDisplay(value) {
  return value === true ? "Yes" : "No";
}

function prepareValidationSummary(refitStatus = "native") {
  switch (refitStatus) {
    case "major-refit-required":
      return {
        label: "Major refit required",
        message: "Major refit required / drydock needed.",
        severity: "danger",
        cssClass: "arcflight-validation-danger"
      };
    case "pressured":
      return {
        label: "Pressured",
        message: "Ship has refit pressure but is below the major refit threshold.",
        severity: "info",
        cssClass: "arcflight-validation-info"
      };
    case "native":
      return {
        label: "Native",
        message: "Stable / no refit pressure.",
        severity: "ok",
        cssClass: "arcflight-validation-ok"
      };
    default:
      return {
        label: humanizeIdentifier(refitStatus || "Unknown"),
        message: "Stored refit status is not recognized by this sheet version.",
        severity: "warning",
        cssClass: "arcflight-validation-warning"
      };
  }
}


function prepareLabelValueRows(values = {}, labels = {}) {
  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: numericDisplayValue(values[key])
  }));
}

function prepareTextArray(values = []) {
  return arrayOrEmpty(values).map((value) => String(value ?? "").trim()).filter(Boolean);
}

function prepareComponentTypeCounts(countsByComponentType = {}) {
  return Object.entries(countsByComponentType)
    .map(([componentType, count]) => ({
      componentType,
      label: humanizeIdentifier(componentType || "Unknown"),
      count: numericDisplayValue(count)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function prepareInstallRecordReadout(record = {}) {
  const flags = [];
  if (record.nativeInstall === true) flags.push("native");
  if (record.refitInstall === true) flags.push("refit");
  if (record.temporaryInstall === true) flags.push("temporary");

  const placements = [
    { label: "Hull Slot", value: record.hullSlot },
    { label: "Room Slot", value: record.roomSlot },
    { label: "Weapon Arc", value: record.weaponArc }
  ].filter((entry) => String(entry.value ?? "").trim());

  return {
    ...record,
    componentTypeLabel: humanizeIdentifier(record.componentType || "Unknown Component"),
    installCategoryLabel: humanizeIdentifier(record.installCategory || "Uncategorized"),
    itemReference: record.itemId || record.itemUuid || "No item reference",
    flags,
    flagsLabel: flags.length ? flags.join(", ") : "none",
    placements,
    hasPlacements: placements.length > 0,
    hasTierAtInstall: record.tierAtInstall !== undefined && record.tierAtInstall !== null && record.tierAtInstall !== "",
    hasNotes: String(record.notes ?? "").trim().length > 0
  };
}

function prepareInstallStateReadout(shipActor) {
  const installState = getInstallState(shipActor);
  const summary = prepareInstallStateSummary(shipActor);
  const activeRecords = installState.installs.filter((record) => record.active === true).map(prepareInstallRecordReadout);
  const pressureLabels = {
    total: "Total",
    weapon: "Weapon",
    engine: "Engine",
    infrastructure: "Infrastructure",
    lifeveil: "Lifeveil",
    crewCommand: "Crew Command",
    occult: "Occult"
  };

  return {
    version: summary.version,
    hasRecords: summary.totalInstalls > 0,
    summary: {
      activeInstalls: summary.activeInstalls,
      inactiveInstalls: summary.inactiveInstalls,
      totalInstalls: summary.totalInstalls,
      installCategories: prepareTextArray(summary.installCategories),
      installCategoriesLabel: summary.installCategories.length ? summary.installCategories.map(humanizeIdentifier).join(", ") : "None",
      componentTypeCounts: prepareComponentTypeCounts(summary.countsByComponentType),
      hasComponentTypeCounts: Object.keys(summary.countsByComponentType ?? {}).length > 0
    },
    pressure: {
      ...summary.pressureContribution,
      rows: prepareLabelValueRows(summary.pressureContribution, pressureLabels)
    },
    activeRecords,
    hasActiveRecords: activeRecords.length > 0
  };
}

function prepareInstallValidationReadout(system = {}) {
  const tier = system.tier ?? {};
  const refitPressure = system.refitPressure ?? {};
  const refitFlags = system.refitFlags ?? {};
  const refitStatus = tier.refitStatus || "native";
  const summary = prepareValidationSummary(refitStatus);

  return {
    tier: {
      baseTier: numericDisplayValue(tier.baseTier),
      currentTier: numericDisplayValue(tier.currentTier),
      refitStatus,
      refitStatusLabel: summary.label,
      majorRefitsCompleted: numericDisplayValue(tier.majorRefitsCompleted)
    },
    pressure: {
      total: numericDisplayValue(refitPressure.total),
      weaponPressure: numericDisplayValue(refitPressure.weaponPressure),
      enginePressure: numericDisplayValue(refitPressure.enginePressure),
      infrastructurePressure: numericDisplayValue(refitPressure.infrastructurePressure),
      lifeveilPressure: numericDisplayValue(refitPressure.lifeveilPressure),
      crewCommandPressure: numericDisplayValue(refitPressure.crewCommandPressure),
      occultPressure: numericDisplayValue(refitPressure.occultPressure)
    },
    flags: {
      qualifiesForMajorRefit: refitFlags.qualifiesForMajorRefit === true,
      qualifiesForMajorRefitLabel: prepareBooleanDisplay(refitFlags.qualifiesForMajorRefit),
      requiresDrydock: refitFlags.requiresDrydock === true,
      requiresDrydockLabel: prepareBooleanDisplay(refitFlags.requiresDrydock),
      requiresSpecialistLabor: refitFlags.requiresSpecialistLabor === true,
      requiresSpecialistLaborLabel: prepareBooleanDisplay(refitFlags.requiresSpecialistLabor),
      requiresRareMaterials: refitFlags.requiresRareMaterials === true,
      requiresRareMaterialsLabel: prepareBooleanDisplay(refitFlags.requiresRareMaterials)
    },
    summary
  };
}

function prepareArcflightShipViewData(arcflight, shipActor = null) {
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
  system.fuelingDisplay = prepareFuelingDisplay(system);
  system.installValidationReadout = prepareInstallValidationReadout(system);
  system.installStateReadout = prepareInstallStateReadout(shipActor);
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

function getSheetActor(sheet) {
  return sheet?.actor ?? sheet?.document ?? null;
}

async function confirmClearShipBuild(actor) {
  const actorName = actor?.name ?? "this ship";
  const escapedActorName = foundry.utils.escapeHTML(actorName);
  const title = "Clear Arcflight Ship Build";
  const content = `<p>Clear the Arcflight ship build for <strong>${escapedActorName}</strong>?</p><p>This removes installed build references from the actor but does not delete source items, compendium items, or the actor.</p>`;
  const dialogV2 = foundry.applications.api.DialogV2;

  if (typeof dialogV2?.confirm === "function") {
    return await dialogV2.confirm({
      window: { title },
      content,
      rejectClose: false
    });
  }

  if (typeof globalThis.Dialog?.confirm === "function") {
    return await globalThis.Dialog.confirm({
      title,
      content,
      defaultYes: false
    });
  }

  return globalThis.confirm?.(`Clear the Arcflight ship build for ${actorName}?`) === true;
}

async function enableArcflightShip(actor) {
  return actor.update({
    [`flags.${ARCFLIGHT_MODULE_ID}.enabled`]: true,
    [`flags.${ARCFLIGHT_MODULE_ID}.actorType`]: ARCFLIGHT_SHIP_ACTOR_TYPE,
    [`flags.${ARCFLIGHT_MODULE_ID}.system`]: getArcflightShipData(actor)
  });
}

async function ensureArcflightShipEnabled(actor) {
  if (actor?.type !== "vehicle") {
    ui.notifications?.warn?.("Arcflight ships must be PF2E vehicle actors.");
    return null;
  }

  if (isArcflightShipEnabled(actor)) return actor;

  return await enableArcflightShip(actor) ?? actor;
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
  #selectedExampleBuildKey = "";

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

    this.element
      .querySelector?.("[data-arcflight-example-build]")
      ?.addEventListener("change", this.#onChangeExampleBuild.bind(this));

    this.element
      .querySelector?.("[data-arcflight-apply-clean-build]")
      ?.addEventListener("click", this.#onApplyCleanExampleBuild.bind(this));

    this.element
      .querySelector?.("[data-arcflight-clear-build]")
      ?.addEventListener("click", this.#onClearBuild.bind(this));
  }

  #onChangeExampleBuild(event) {
    this.#selectedExampleBuildKey = event.currentTarget?.value ?? "";
    const selectedOption = event.currentTarget?.selectedOptions?.[0];
    const details = this.element.querySelector?.("[data-arcflight-example-build-details]");
    if (!details) return;

    const name = selectedOption?.dataset?.name ?? "";
    const role = selectedOption?.dataset?.role ?? "";
    const description = selectedOption?.dataset?.description ?? "";
    details.hidden = !this.#selectedExampleBuildKey;
    details.querySelector?.("[data-arcflight-example-build-name]")?.replaceChildren(name);
    details.querySelector?.("[data-arcflight-example-build-role]")?.replaceChildren(role);
    details.querySelector?.("[data-arcflight-example-build-description]")?.replaceChildren(description);
  }

  async #onApplyCleanExampleBuild(event) {
    event.preventDefault();

    const selectedBuildKey = this.element.querySelector?.("[data-arcflight-example-build]")?.value
      ?? this.#selectedExampleBuildKey;
    if (!selectedBuildKey) {
      ui.notifications?.warn?.("Select an Arcflight example build before applying a clean build.");
      return;
    }

    const applyCleanExampleShipBuild = game?.arcflight?.applyCleanExampleShipBuild;
    if (typeof applyCleanExampleShipBuild !== "function") {
      ui.notifications?.warn?.("Arcflight example ship build helpers are not available.");
      return;
    }

    try {
      const actor = await ensureArcflightShipEnabled(getSheetActor(this));
      if (!actor) return;

      await game.arcflight.applyCleanExampleShipBuild(actor, selectedBuildKey);
      this.#selectedExampleBuildKey = selectedBuildKey;
      this.render(true);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not apply that example ship build.");
      console.warn("Arcflight | Example ship build apply failed.", error);
    }
  }

  async #onClearBuild(event) {
    event.preventDefault();

    const actor = getSheetActor(this);
    if (!isArcflightShipEnabled(actor)) {
      ui.notifications?.warn?.("Clear Build requires an Arcflight-enabled PF2E vehicle actor.");
      return;
    }

    const clearShipBuild = game?.arcflight?.clearShipBuild;
    if (typeof clearShipBuild !== "function") {
      ui.notifications?.warn?.("Arcflight clear build helper is not available.");
      return;
    }

    const confirmed = await confirmClearShipBuild(actor);
    if (!confirmed) return;

    try {
      await clearShipBuild(actor);
      this.#selectedExampleBuildKey = "";
      this.render(true);
      ui.notifications?.info?.("Arcflight ship build cleared.");
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not clear this ship build.");
      console.warn("Arcflight | Ship build clear failed.", error);
    }
  }

  async #onChangeHullPattern(event) {
    event.preventDefault();

    const patternKey = event.currentTarget?.value ?? "";
    if (!patternKey) return;

    const actor = getSheetActor(this);

    try {
      await setHullPattern(actor, patternKey);
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

    const actor = getSheetActor(this);

    try {
      await setArkenginePattern(actor, patternKey);
      this.render(true);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not set that arkengine pattern.");
      console.warn("Arcflight | Arkengine pattern selection failed.", error);
    }
  }

  #onDragOverShipBuilder(event) {
    if (!isArcflightShipEnabled(getSheetActor(this))) return;

    event.preventDefault();
    event.stopPropagation();
  }

  async #onDropShipBuilder(event) {
    const actor = getSheetActor(this);
    if (!isArcflightShipEnabled(actor)) return;

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
      await install(actor, item);
      this.render(true);
    } catch (error) {
      ui.notifications?.warn?.(error.message ?? "Arcflight could not install that component on this ship.");
      console.warn("Arcflight | Ship builder drop install failed.", error);
    }
  }

  async #onEnableArcflightShip(event) {
    event.preventDefault();

    const actor = await ensureArcflightShipEnabled(getSheetActor(this));
    if (!actor) return;

    this.render(true);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = getSheetActor(this);
    const arcflight = prepareArcflightShipViewData(prepareArcflightShipFlags(actor), actor);

    const stations = prepareStationRows(arcflight.system.stations);
    const exampleBuildOptions = prepareExampleBuildOptions(this.#selectedExampleBuildKey);
    const selectedExampleBuild = exampleBuildOptions.find((build) => build.selected) ?? null;

    return {
      ...context,
      actor,
      arcflight,
      stations,
      exampleBuildOptions,
      selectedExampleBuild,
      arcflightActorType: ARCFLIGHT_SHIP_ACTOR_TYPE,
      arcflightSystemPath: `flags.${ARCFLIGHT_MODULE_ID}.system`
    };
  }
}

export { ArcflightShipSheet as ShipSheet, prepareArcflightShipViewData, prepareInstallStateReadout, prepareInstallValidationReadout };
