import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { getComponentData, getComponentRefitPressure, getComponentTierMetadata, getComponentType } from "../documents/components.js";
import { calculateRefitPressure, getArcflightShipData, getShipRefitPressure, getShipTierState } from "../documents/ships.js";

const SUPPORTED_COMPONENT_TYPES = new Set([
  ARCFLIGHT_ITEM_TYPES.HULL,
  ARCFLIGHT_ITEM_TYPES.ARKENGINE,
  ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD,
  ARCFLIGHT_ITEM_TYPES.ROOM,
  ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE,
  ARCFLIGHT_ITEM_TYPES.CREW_ASSET
]);

const FUTURE_UNSUPPORTED_COMPONENT_TYPES = new Set([
  ARCFLIGHT_ITEM_TYPES.WEAPON,
  ARCFLIGHT_ITEM_TYPES.CARGO
]);

const REFIT_PRESSURE_KEYS = Object.freeze([
  "weaponPressure",
  "enginePressure",
  "infrastructurePressure",
  "lifeveilPressure",
  "crewCommandPressure",
  "occultPressure"
]);

const REFIT_STATUSES = Object.freeze({
  NATIVE: "native",
  PRESSURED: "pressured",
  MAJOR_REFIT_REQUIRED: "major-refit-required"
});

const SEVERITY_RANK = Object.freeze({
  ok: 0,
  info: 1,
  warning: 2,
  danger: 3
});

const NEAR_THRESHOLD_RATIO = 0.75;

function cloneData(data) {
  return foundry.utils.deepClone(data);
}

function numericValue(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function normalizeRefitPressure(refitPressure = {}) {
  const pressure = {};
  let total = 0;

  for (const key of REFIT_PRESSURE_KEYS) {
    pressure[key] = Math.max(0, numericValue(refitPressure?.[key]));
    total += pressure[key];
  }

  pressure.total = total;
  return pressure;
}

function addRefitPressure(left = {}, right = {}) {
  const pressure = {};

  for (const key of REFIT_PRESSURE_KEYS) {
    pressure[key] = numericValue(left?.[key]) + numericValue(right?.[key]);
  }

  pressure.total = REFIT_PRESSURE_KEYS.reduce((total, key) => total + pressure[key], 0);
  return pressure;
}

function hasOwnProperty(source, key) {
  return Object.prototype.hasOwnProperty.call(source ?? {}, key);
}

function markShipUpgradeSlotSystem(systemData, rawSystemData = {}) {
  Object.defineProperty(systemData, "__arcflightHasShipUpgradeSlotSystem", {
    value: hasOwnProperty(rawSystemData.installed, "shipUpgradeSlots"),
    enumerable: false,
    configurable: true
  });

  return systemData;
}

function getShipSystemData(shipActor) {
  if (!shipActor) throw new Error("Arcflight | previewInstallValidation requires an Arcflight ship actor or ship system data.");
  if (shipActor?.getFlag) {
    const rawSystemData = shipActor.getFlag(ARCFLIGHT_MODULE_ID, "system") ?? {};
    return markShipUpgradeSlotSystem(getArcflightShipData(shipActor), rawSystemData);
  }

  if (shipActor?.flags?.[ARCFLIGHT_MODULE_ID]?.system) {
    const rawSystemData = shipActor.flags[ARCFLIGHT_MODULE_ID].system ?? {};
    return markShipUpgradeSlotSystem(getArcflightShipData({ flags: shipActor.flags }), rawSystemData);
  }

  return markShipUpgradeSlotSystem(getArcflightShipData({ flags: { [ARCFLIGHT_MODULE_ID]: { system: shipActor } } }), shipActor);
}

function getFlagValue(documentLike, key) {
  return documentLike?.flags?.[ARCFLIGHT_MODULE_ID]?.[key] ?? documentLike?.getFlag?.(ARCFLIGHT_MODULE_ID, key);
}

function inferComponentType(componentItemOrData) {
  const itemType = getComponentType(componentItemOrData);
  if (itemType) return itemType;

  const directType = componentItemOrData?.componentType
    ?? componentItemOrData?.system?.componentType
    ?? componentItemOrData?.flags?.[ARCFLIGHT_MODULE_ID]?.componentType
    ?? getFlagValue(componentItemOrData, "componentType");

  return directType ?? null;
}

function getComponentSystemData(componentItemOrData, componentType) {
  const componentData = getComponentData(componentItemOrData);
  if (componentData) return componentData;

  return cloneData(
    componentItemOrData?.system
    ?? componentItemOrData?.flags?.[ARCFLIGHT_MODULE_ID]?.system
    ?? getFlagValue(componentItemOrData, "system")
    ?? componentItemOrData
    ?? {}
  );
}

function getComponentName(componentItemOrData, componentData = {}) {
  return componentItemOrData?.name
    ?? componentData.displayName
    ?? componentData.identity?.displayName
    ?? componentData.identity?.title
    ?? componentData.platform
    ?? componentData.engineClass
    ?? componentData.identity?.id
    ?? componentData.componentType
    ?? "Unknown Component";
}

function getComponentKey(componentItemOrData, componentData = {}) {
  return componentData.identity?.id
    ?? componentData.platform
    ?? componentData.engineClass
    ?? componentItemOrData?.slug
    ?? componentItemOrData?.id
    ?? "";
}

function getComponentIdentity(componentItemOrData, componentType, componentData = {}) {
  return {
    itemId: componentItemOrData?.id ?? componentItemOrData?.itemId ?? componentData.itemId ?? "",
    uuid: componentItemOrData?.uuid ?? componentItemOrData?.itemUuid ?? componentData.uuid ?? componentData.itemUuid ?? "",
    key: getComponentKey(componentItemOrData, componentData),
    name: getComponentName(componentItemOrData, componentData),
    componentType
  };
}

function emptySlotState(capacity = 0, used = 0) {
  return { capacity, used, available: capacity - used };
}

function withAddedSlotCost(slotState = {}, added = 0) {
  const capacity = numericValue(slotState.capacity);
  const used = numericValue(slotState.used) + numericValue(added);
  return emptySlotState(capacity, used);
}

function getInstalledEntriesForType(systemData = {}, componentType) {
  const installed = systemData.installed ?? {};

  if (componentType === ARCFLIGHT_ITEM_TYPES.HULL) {
    return [{
      itemId: installed.hullItemId ?? "",
      uuid: installed.hullUuid ?? "",
      key: installed.hullPlatform ?? systemData.base?.hull?.platform ?? "",
      name: installed.hullName ?? systemData.base?.hull?.displayName ?? "",
      componentType
    }].filter((entry) => entry.itemId || entry.uuid || entry.key || entry.name);
  }

  if (componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE) {
    return [{
      itemId: installed.arkengineItemId ?? "",
      uuid: installed.arkengineUuid ?? "",
      key: installed.arkengineKey ?? systemData.base?.arkengine?.engineClass ?? "",
      name: installed.arkengineName ?? systemData.base?.arkengine?.displayName ?? "",
      componentType
    }].filter((entry) => entry.itemId || entry.uuid || entry.key || entry.name);
  }

  if (componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD) return Array.isArray(installed.arkengineMods) ? installed.arkengineMods : [];
  if (componentType === ARCFLIGHT_ITEM_TYPES.ROOM) return Array.isArray(installed.rooms) ? installed.rooms : [];
  if (componentType === ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE) return Array.isArray(installed.shipUpgrades) ? installed.shipUpgrades : [];
  if (componentType === ARCFLIGHT_ITEM_TYPES.CREW_ASSET) return Array.isArray(systemData.crew?.namedCrew) ? systemData.crew.namedCrew : [];

  return [];
}

function entryIdentifiers(entry = {}) {
  return {
    ids: [entry.id, entry.itemId].filter(Boolean),
    uuids: [entry.uuid, entry.itemUuid].filter(Boolean),
    keys: [entry.key, entry.sourceKey, entry.coreKey, entry.identity?.id].filter(Boolean),
    nameType: `${entry.name ?? ""}::${entry.componentType ?? ""}`
  };
}

function isDuplicateEntry(existing = {}, candidate = {}) {
  const existingIds = entryIdentifiers(existing);
  const candidateIds = entryIdentifiers(candidate);

  return candidateIds.ids.some((id) => existingIds.ids.includes(id))
    || candidateIds.uuids.some((uuid) => existingIds.uuids.includes(uuid))
    || candidateIds.keys.some((key) => existingIds.keys.includes(key))
    || (candidateIds.nameType !== "::" && candidateIds.nameType === existingIds.nameType);
}

function calculateProjectedRefitStatus(projectedPressure = {}, hullTolerance = {}) {
  const majorRefitThreshold = numericValue(hullTolerance.totalBeforeMajorRefitRequired);
  if (majorRefitThreshold > 0 && numericValue(projectedPressure.total) >= majorRefitThreshold) return REFIT_STATUSES.MAJOR_REFIT_REQUIRED;
  if (numericValue(projectedPressure.total) > 0) return REFIT_STATUSES.PRESSURED;
  return REFIT_STATUSES.NATIVE;
}

function addReportMessage(report, severity, message) {
  if (severity === "info") report.messages.push(message);
  if (severity === "warning" || severity === "danger") report.warnings.push(message);
  if (SEVERITY_RANK[severity] > SEVERITY_RANK[report.severity]) report.severity = severity;
}

function evaluateTierFit(report, systemData = {}, componentData = {}, componentType) {
  const tierMetadata = getComponentTierMetadata(componentData);
  const currentTier = numericValue(systemData.tier?.currentTier, numericValue(systemData.tier?.baseTier));
  const baseTier = numericValue(systemData.tier?.baseTier);
  const hullMaximumRefitTier = componentType === ARCFLIGHT_ITEM_TYPES.HULL
    ? numericValue(componentData.classification?.maximumRefitTier, numericValue(componentData.classification?.baseTier, currentTier))
    : numericValue(systemData.base?.hull?.classification?.maximumRefitTier, currentTier);

  report.current.tier = { baseTier, currentTier, maximumRefitTier: hullMaximumRefitTier };
  report.projected.tier = {
    minimumTier: tierMetadata.minimumTier,
    recommendedTier: tierMetadata.recommendedTier,
    maximumRefitTier: hullMaximumRefitTier
  };

  if (tierMetadata.minimumTier > currentTier) {
    addReportMessage(report, "warning", `${report.componentName} requires minimum ship tier ${tierMetadata.minimumTier}; current tier is ${currentTier}.`);
  }

  if (tierMetadata.recommendedTier > currentTier) {
    addReportMessage(report, "info", `${report.componentName} is recommended for ship tier ${tierMetadata.recommendedTier}; current tier is ${currentTier}.`);
  }

  const componentTier = Math.max(tierMetadata.minimumTier, tierMetadata.recommendedTier);
  if (hullMaximumRefitTier > 0 && componentTier > hullMaximumRefitTier) {
    addReportMessage(report, "danger", `${report.componentName} tier ${componentTier} exceeds the hull maximum refit tier ${hullMaximumRefitTier}.`);
  }
}

function evaluateRefitPressure(report, systemData = {}, componentItemOrData, componentData = {}) {
  const currentPressure = normalizeRefitPressure(getShipRefitPressure(systemData) ?? calculateRefitPressure(systemData));
  const addedPressure = getComponentRefitPressure(componentItemOrData) ?? getComponentRefitPressure(componentData);
  const projectedPressure = addRefitPressure(currentPressure, addedPressure);
  const tolerance = systemData.base?.hull?.refitTolerance ?? {};
  const projectedStatus = calculateProjectedRefitStatus(projectedPressure, tolerance);
  const majorRefitThreshold = numericValue(tolerance.totalBeforeMajorRefitRequired);

  report.current.refitPressure = currentPressure;
  report.projected.refitPressure = {
    ...projectedPressure,
    added: normalizeRefitPressure(addedPressure)
  };
  report.projected.refitStatus = projectedStatus;

  if (projectedStatus === REFIT_STATUSES.MAJOR_REFIT_REQUIRED && addedPressure.total > 0) {
    addReportMessage(report, "danger", `Projected refit pressure ${projectedPressure.total} meets or exceeds the major refit threshold ${majorRefitThreshold}.`);
  } else if (majorRefitThreshold > 0 && addedPressure.total > 0 && projectedPressure.total >= majorRefitThreshold * NEAR_THRESHOLD_RATIO) {
    addReportMessage(report, "warning", `Projected refit pressure ${projectedPressure.total} is close to the major refit threshold ${majorRefitThreshold}.`);
  }

  for (const key of REFIT_PRESSURE_KEYS) {
    const categoryTolerance = numericValue(tolerance[key]);
    if (categoryTolerance > 0 && addedPressure[key] > 0 && projectedPressure[key] > categoryTolerance) {
      addReportMessage(report, "danger", `Projected ${key} ${projectedPressure[key]} exceeds hull category tolerance ${categoryTolerance}.`);
    }
  }
}

function evaluateArkengineCompatibility(report, systemData = {}, componentData = {}) {
  const hull = systemData.base?.hull ?? {};
  if (!systemData.installed?.hullItemId && !systemData.installed?.hullUuid && !systemData.installed?.hullPlatform && !hull.platform) {
    addReportMessage(report, "warning", "No hull is installed, so arkengine compatibility cannot be confirmed.");
    return;
  }

  const compatibility = hull.arkengineCompatibility ?? {};
  const preferred = compatibility.preferred ?? "";
  const allowed = normalizeList(compatibility.allowed);
  const engineKey = componentData.engineClass ?? componentData.identity?.id ?? componentData.key ?? "";

  if (allowed.length > 0 && !allowed.includes(engineKey)) {
    addReportMessage(report, "danger", `${report.componentName} (${engineKey}) is not in the hull allowed arkengine list.`);
    return;
  }

  if (preferred && engineKey !== preferred) {
    addReportMessage(report, "info", `${report.componentName} is allowed but not the hull preferred arkengine (${preferred}).`);
  }
}

function evaluateArkengineModSlots(report, systemData = {}, componentData = {}) {
  const installed = systemData.installed ?? {};
  const hasArkengine = Boolean(installed.arkengineItemId || installed.arkengineUuid || installed.arkengineKey || systemData.base?.arkengine?.engineClass);
  if (!hasArkengine) {
    addReportMessage(report, "danger", "No arkengine is installed for this arkengine mod.");
    return;
  }

  const required = numericValue(componentData.installation?.modSlotsRequired ?? componentData.modSlotsRequired, 1);
  const capacity = numericValue(installed.arkengineModSlots?.capacity, numericValue(systemData.derived?.arkengineModSlots, numericValue(systemData.base?.arkengine?.modSlots)));
  const used = numericValue(installed.arkengineModSlots?.used, (Array.isArray(installed.arkengineMods) ? installed.arkengineMods : []).reduce((total, mod) => total + numericValue(mod.modSlotsRequired, 1), 0));
  const current = emptySlotState(capacity, used);
  const projected = withAddedSlotCost(current, required);

  report.current.slots.arkengineMods = current;
  report.projected.slots.arkengineMods = projected;

  if (projected.available < 0) {
    addReportMessage(report, "danger", `Projected arkengine mod slots ${projected.used}/${projected.capacity} exceed capacity.`);
  } else if (projected.capacity > 0 && projected.used / projected.capacity >= NEAR_THRESHOLD_RATIO) {
    addReportMessage(report, "warning", `Projected arkengine mod slots ${projected.used}/${projected.capacity} are near capacity.`);
  }
}

function evaluateRoomSlots(report, systemData = {}, componentData = {}) {
  const hull = systemData.base?.hull ?? {};
  const installed = systemData.installed ?? {};
  const hasHull = Boolean(installed.hullItemId || installed.hullUuid || installed.hullPlatform || hull.platform);
  if (!hasHull) {
    addReportMessage(report, "danger", "No hull is installed for this expansion room.");
    return;
  }

  if (hull.rooms?.districtScale === true && hull.rooms?.normalRoomSlotsSupported !== true) {
    addReportMessage(report, "warning", "This hull is district-scale; normal room slot logic is not explicitly supported.");
    return;
  }

  const required = numericValue(componentData.installation?.expansionSlotsRequired ?? componentData.expansionSlotsRequired, 1);
  const capacity = numericValue(installed.roomSlots?.capacity, numericValue(hull.rooms?.expansionSlots));
  const used = numericValue(installed.roomSlots?.used, (Array.isArray(installed.rooms) ? installed.rooms : []).reduce((total, room) => total + numericValue(room.expansionSlotsRequired, 1), 0));
  const current = emptySlotState(capacity, used);
  const projected = withAddedSlotCost(current, required);

  report.current.slots.rooms = current;
  report.projected.slots.rooms = projected;

  if (projected.available < 0) {
    addReportMessage(report, "danger", `Projected room slots ${projected.used}/${projected.capacity} exceed capacity.`);
  } else if (projected.capacity > 0 && projected.used / projected.capacity >= NEAR_THRESHOLD_RATIO) {
    addReportMessage(report, "warning", `Projected room slots ${projected.used}/${projected.capacity} are near capacity.`);
  }
}

function evaluateShipUpgradeSlots(report, systemData = {}, componentData = {}) {
  const installed = systemData.installed ?? {};
  const required = numericValue(componentData.installation?.slotCost ?? componentData.slotCost, 1);
  const hasSlotSystem = systemData.__arcflightHasShipUpgradeSlotSystem === true && Number.isFinite(Number(installed.shipUpgradeSlots?.capacity));

  if (!hasSlotSystem) {
    addReportMessage(report, "warning", "Ship upgrade slot capacity is not defined on this ship; upgrade slot enforcement remains advisory.");
    return;
  }

  const capacity = numericValue(installed.shipUpgradeSlots?.capacity);
  const used = numericValue(installed.shipUpgradeSlots?.used, (Array.isArray(installed.shipUpgrades) ? installed.shipUpgrades : []).reduce((total, upgrade) => total + numericValue(upgrade.slotCost, 1), 0));
  const current = emptySlotState(capacity, used);
  const projected = withAddedSlotCost(current, required);

  report.current.slots.shipUpgrades = current;
  report.projected.slots.shipUpgrades = projected;

  if (projected.available < 0) {
    addReportMessage(report, "danger", `Projected ship upgrade slots ${projected.used}/${projected.capacity} exceed capacity.`);
  } else if (projected.capacity > 0 && projected.used / projected.capacity >= NEAR_THRESHOLD_RATIO) {
    addReportMessage(report, "warning", `Projected ship upgrade slots ${projected.used}/${projected.capacity} are near capacity.`);
  }
}

function evaluateDuplicateInstall(report, systemData = {}, candidate = {}, componentData = {}) {
  const installedEntries = getInstalledEntriesForType(systemData, candidate.componentType);
  const duplicate = installedEntries.find((entry) => isDuplicateEntry(entry, candidate));

  if (candidate.componentType === ARCFLIGHT_ITEM_TYPES.CREW_ASSET && componentData.restrictions?.unique === true && duplicate) {
    addReportMessage(report, "danger", `${candidate.name} is marked unique and appears to already be rostered.`);
    return;
  }

  if (duplicate) {
    addReportMessage(report, "warning", `${candidate.name} appears to already be installed or rostered as ${duplicate.name ?? duplicate.key ?? duplicate.itemId ?? "an existing component"}.`);
  }
}

function buildReport(systemData, componentItemOrData, componentType, componentData) {
  const tierState = getShipTierState(systemData);
  const currentRefitPressure = normalizeRefitPressure(getShipRefitPressure(systemData));

  return {
    ok: true,
    severity: "ok",
    componentType,
    componentName: getComponentName(componentItemOrData, componentData),
    messages: [],
    warnings: [],
    projected: {
      tier: cloneData(tierState),
      refitPressure: cloneData(currentRefitPressure),
      refitStatus: tierState.refitStatus ?? REFIT_STATUSES.NATIVE,
      slots: {}
    },
    current: {
      tier: cloneData(tierState),
      refitPressure: cloneData(currentRefitPressure),
      slots: cloneData({
        arkengineMods: systemData.installed?.arkengineModSlots ?? emptySlotState(),
        rooms: systemData.installed?.roomSlots ?? emptySlotState(),
        shipUpgrades: systemData.installed?.shipUpgradeSlots ?? emptySlotState()
      })
    },
    unsupported: false
  };
}

export function previewInstallValidation(shipActor, componentItemOrData) {
  if (!componentItemOrData) throw new Error("Arcflight | previewInstallValidation requires a component item or component data.");

  const systemData = getShipSystemData(shipActor);
  const componentType = inferComponentType(componentItemOrData);
  const componentData = getComponentSystemData(componentItemOrData, componentType);
  const report = buildReport(systemData, componentItemOrData, componentType, componentData);
  const candidate = getComponentIdentity(componentItemOrData, componentType, componentData);

  if (!componentType || FUTURE_UNSUPPORTED_COMPONENT_TYPES.has(componentType) || !SUPPORTED_COMPONENT_TYPES.has(componentType)) {
    report.unsupported = true;
    addReportMessage(report, "warning", `${report.componentName} uses unsupported install preview component type ${componentType ?? "unknown"}.`);
    return report;
  }

  evaluateDuplicateInstall(report, systemData, candidate, componentData);
  evaluateTierFit(report, systemData, componentData, componentType);
  evaluateRefitPressure(report, systemData, componentItemOrData, componentData);

  if (componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE) evaluateArkengineCompatibility(report, systemData, componentData);
  if (componentType === ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD) evaluateArkengineModSlots(report, systemData, componentData);
  if (componentType === ARCFLIGHT_ITEM_TYPES.ROOM) evaluateRoomSlots(report, systemData, componentData);
  if (componentType === ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE) evaluateShipUpgradeSlots(report, systemData, componentData);

  return report;
}

export function previewComponentInstall(shipActor, componentItemOrData) {
  return previewInstallValidation(shipActor, componentItemOrData);
}

export function getInstallValidationWarnings(shipActor, componentItemOrData) {
  return previewInstallValidation(shipActor, componentItemOrData).warnings;
}

export function shouldBlockInstall(preview = {}) {
  if (!preview || typeof preview !== "object") return { blocked: true, reason: "Install validation preview is unavailable." };

  if (preview.severity === "danger") {
    const reason = preview.warnings?.[0] ?? preview.messages?.[0] ?? "Danger validation blocks this install.";
    return { blocked: true, reason };
  }

  const projectedSlots = preview.projected?.slots ?? {};
  for (const [slotKey, slotState] of Object.entries(projectedSlots)) {
    if (numericValue(slotState?.available) < 0) {
      return {
        blocked: true,
        reason: `Projected ${humanizeSlotKey(slotKey)} slots ${numericValue(slotState.used)}/${numericValue(slotState.capacity)} exceed capacity.`
      };
    }
  }

  return { blocked: false, reason: "" };
}

function humanizeSlotKey(value) {
  return String(value ?? "slots")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}
