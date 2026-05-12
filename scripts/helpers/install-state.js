import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE } from "../documents/ships.js";

export const ARCFLIGHT_INSTALL_STATE_VERSION = 1;

const PRESSURE_KEYS = Object.freeze([
  "weapon",
  "engine",
  "infrastructure",
  "lifeveil",
  "crewCommand",
  "occult"
]);

const PRESSURE_KEY_ALIASES = Object.freeze({
  weapon: "weaponPressure",
  engine: "enginePressure",
  infrastructure: "infrastructurePressure",
  lifeveil: "lifeveilPressure",
  crewCommand: "crewCommandPressure",
  occult: "occultPressure"
});

function cloneData(data) {
  if (globalThis.foundry?.utils?.deepClone) return foundry.utils.deepClone(data);
  return data === undefined ? undefined : JSON.parse(JSON.stringify(data));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function numericValue(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value) {
  const normalized = stringValue(value);
  return normalized === "" ? undefined : normalized;
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function getActorInstallStateFlag(shipActor) {
  return shipActor?.getFlag?.(ARCFLIGHT_MODULE_ID, "system")?.installState
    ?? shipActor?.flags?.[ARCFLIGHT_MODULE_ID]?.system?.installState
    ?? {};
}

function isArcflightShipActor(actor) {
  return actor?.type === "vehicle"
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, "enabled") === true
    && actor.getFlag?.(ARCFLIGHT_MODULE_ID, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

function assertArcflightShipActor(shipActor, helperName) {
  if (!isArcflightShipActor(shipActor)) {
    throw new Error(`Arcflight | ${helperName} requires an Arcflight-enabled PF2E vehicle actor.`);
  }
}

function normalizePressureContribution(pressureContribution = {}) {
  const source = isPlainObject(pressureContribution) ? pressureContribution : {};
  const pressure = {};

  for (const key of PRESSURE_KEYS) {
    pressure[key] = Math.max(0, numericValue(source[key], numericValue(source[PRESSURE_KEY_ALIASES[key]])));
  }

  pressure.total = Math.max(
    0,
    numericValue(
      source.total,
      PRESSURE_KEYS.reduce((total, key) => total + pressure[key], 0)
    )
  );

  return pressure;
}

function makeUniqueInstallId(baseInstallId, usedInstallIds) {
  let installId = baseInstallId || createInstallId();
  while (usedInstallIds.has(installId)) installId = createInstallId();
  usedInstallIds.add(installId);
  return installId;
}

export function createInstallId(prefix = "install") {
  const randomId = globalThis.foundry?.utils?.randomID?.(10)
    ?? Math.random().toString(36).slice(2, 12).padEnd(10, "0");
  return `${stringValue(prefix) || "install"}-${Date.now().toString(36)}-${randomId}`;
}

export function normalizeInstallRecord(record = {}, options = {}) {
  const usedInstallIds = options.usedInstallIds instanceof Set ? options.usedInstallIds : new Set();
  const source = isPlainObject(record) ? cloneData(record) : {};
  const installId = makeUniqueInstallId(optionalString(source.installId), usedInstallIds);
  const active = booleanValue(source.active, true);
  const normalized = {
    installId,
    itemId: stringValue(source.itemId),
    componentType: stringValue(source.componentType),
    installedAt: Math.max(0, numericValue(source.installedAt, Date.now())),
    nativeInstall: booleanValue(source.nativeInstall),
    refitInstall: booleanValue(source.refitInstall),
    temporaryInstall: booleanValue(source.temporaryInstall),
    pressureContribution: normalizePressureContribution(source.pressureContribution ?? source.refitPressure),
    active
  };

  const optionalFields = [
    "itemUuid",
    "componentKey",
    "installedBy",
    "hullSlot",
    "roomSlot",
    "weaponArc",
    "installCategory",
    "notes",
    "removedBy",
    "removalReason",
    "replacedByInstallId"
  ];

  for (const field of optionalFields) {
    const value = optionalString(source[field]);
    if (value !== undefined) normalized[field] = value;
  }

  if (source.tierAtInstall !== undefined && source.tierAtInstall !== null && source.tierAtInstall !== "") {
    normalized.tierAtInstall = numericValue(source.tierAtInstall);
  }

  if (source.removedAt !== undefined && source.removedAt !== null && source.removedAt !== "") {
    normalized.removedAt = Math.max(0, numericValue(source.removedAt));
  }

  return normalized;
}

export function normalizeInstallState(installState = {}) {
  const source = isPlainObject(installState) ? cloneData(installState) : {};
  const usedInstallIds = new Set();
  const installs = Array.isArray(source.installs)
    ? source.installs
      .filter(isPlainObject)
      .map((record) => normalizeInstallRecord(record, { usedInstallIds }))
    : [];

  return {
    version: ARCFLIGHT_INSTALL_STATE_VERSION,
    installs
  };
}

export function getInstallState(shipActor) {
  return normalizeInstallState(getActorInstallStateFlag(shipActor));
}

export function getActiveInstallRecords(shipActor) {
  return getInstallState(shipActor).installs.filter((record) => record.active === true);
}

export function getInactiveInstallRecords(shipActor) {
  return getInstallState(shipActor).installs.filter((record) => record.active !== true);
}

export function getInstalledComponents(shipActor) {
  return getActiveInstallRecords(shipActor);
}

export function findInstallRecord(shipActor, installId) {
  const normalizedInstallId = stringValue(installId);
  if (!normalizedInstallId) return null;
  return getInstallState(shipActor).installs.find((record) => record.installId === normalizedInstallId) ?? null;
}

export async function recordInstallState(shipActor, installRecord = {}) {
  assertArcflightShipActor(shipActor, "recordInstallState");

  const installState = getInstallState(shipActor);
  const installId = optionalString(installRecord?.installId) ?? createInstallId();
  if (installState.installs.some((record) => record.installId === installId)) {
    throw new Error(`Arcflight | installId "${installId}" is already recorded on this ship.`);
  }

  const usedInstallIds = new Set(installState.installs.map((record) => record.installId));
  const normalizedRecord = normalizeInstallRecord({ ...installRecord, installId }, { usedInstallIds });
  const nextInstallState = normalizeInstallState({
    version: ARCFLIGHT_INSTALL_STATE_VERSION,
    installs: [...installState.installs, normalizedRecord]
  });

  await shipActor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: nextInstallState });
  return normalizedRecord;
}

function createRemovalMetadata(options = {}) {
  const source = isPlainObject(options) ? options : {};
  const metadata = {
    removedAt: Math.max(0, numericValue(source.removedAt, Date.now())),
    removedBy: optionalString(source.removedBy) ?? globalThis.game?.user?.id ?? "",
    removalReason: optionalString(source.removalReason ?? source.reason) ?? "removed"
  };
  const replacedByInstallId = optionalString(source.replacedByInstallId);
  if (replacedByInstallId !== undefined) metadata.replacedByInstallId = replacedByInstallId;
  return metadata;
}

function componentMatcherMatches(record, componentMatcher) {
  if (typeof componentMatcher === "function") return componentMatcher(record) === true;
  if (typeof componentMatcher === "string") return record.componentType === stringValue(componentMatcher);
  if (!isPlainObject(componentMatcher)) return false;

  return Object.entries(componentMatcher).every(([key, value]) => {
    if (value === undefined) return true;
    return record[key] === value;
  });
}

export async function deactivateInstallRecord(shipActor, installId, options = {}) {
  assertArcflightShipActor(shipActor, "deactivateInstallRecord");

  const normalizedInstallId = stringValue(installId);
  if (!normalizedInstallId) return null;

  const installState = getInstallState(shipActor);
  let targetRecord = null;
  let changed = false;
  const removalMetadata = createRemovalMetadata(options);
  const nextInstalls = installState.installs.map((record) => {
    if (record.installId !== normalizedInstallId) return record;
    if (record.active !== true) {
      targetRecord = record;
      return record;
    }
    targetRecord = { ...record, active: false, ...removalMetadata };
    changed = true;
    return targetRecord;
  });

  if (!targetRecord) return null;
  if (!changed) return targetRecord;

  const nextInstallState = normalizeInstallState({
    version: ARCFLIGHT_INSTALL_STATE_VERSION,
    installs: nextInstalls
  });
  await shipActor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: nextInstallState });
  return targetRecord;
}

export async function deactivateInstallRecordsByComponent(shipActor, componentMatcher, options = {}) {
  assertArcflightShipActor(shipActor, "deactivateInstallRecordsByComponent");

  const installState = getInstallState(shipActor);
  const removalMetadata = createRemovalMetadata(options);
  const deactivatedRecords = [];
  let changed = false;
  const nextInstalls = installState.installs.map((record) => {
    if (!componentMatcherMatches(record, componentMatcher)) return record;
    if (record.active !== true) return record;
    const deactivatedRecord = { ...record, active: false, ...removalMetadata };
    deactivatedRecords.push(deactivatedRecord);
    changed = true;
    return deactivatedRecord;
  });

  if (!changed) return deactivatedRecords;

  const nextInstallState = normalizeInstallState({
    version: ARCFLIGHT_INSTALL_STATE_VERSION,
    installs: nextInstalls
  });
  await shipActor.update({ [`flags.${ARCFLIGHT_MODULE_ID}.system.installState`]: nextInstallState });
  return deactivatedRecords;
}

export async function removeInstallState(shipActor, installId, options = {}) {
  return deactivateInstallRecord(shipActor, installId, options);
}

export function prepareInstallStateSummary(shipActor) {
  const installState = getInstallState(shipActor);
  const summary = {
    version: installState.version,
    totalInstalls: installState.installs.length,
    activeInstalls: 0,
    inactiveInstalls: 0,
    countsByComponentType: {},
    pressureContribution: normalizePressureContribution(),
    installCategories: []
  };
  const categories = new Set();

  for (const record of installState.installs) {
    if (record.active) {
      summary.activeInstalls += 1;
      if (record.componentType) {
        summary.countsByComponentType[record.componentType] = (summary.countsByComponentType[record.componentType] ?? 0) + 1;
      }
      if (record.installCategory) categories.add(record.installCategory);
      for (const key of PRESSURE_KEYS) {
        summary.pressureContribution[key] += record.pressureContribution?.[key] ?? 0;
      }
      summary.pressureContribution.total += record.pressureContribution?.total ?? 0;
    } else {
      summary.inactiveInstalls += 1;
    }
  }

  summary.installCategories = Array.from(categories).sort();
  summary.pressureContribution = normalizePressureContribution(summary.pressureContribution);
  return summary;
}
