import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE } from "../documents/ships.js";
import { createVoyageEventRuntime, createVoyageEventsContainer } from "./defaults.js";

export const ARCFLIGHT_VOYAGE_EVENT_FLAG_PATH = `flags.${ARCFLIGHT_MODULE_ID}.system.voyageEvents`;
/** @deprecated Use ARCFLIGHT_VOYAGE_EVENT_FLAG_PATH. */
export const VOYAGE_EVENTS_FLAG_PATH = ARCFLIGHT_VOYAGE_EVENT_FLAG_PATH;

export const VOYAGE_EVENT_PERSISTENCE_ERROR_CODES = Object.freeze({
  INVALID_SHIP: "voyage.persistence.actor.invalid",
  UNAUTHORIZED_USER: "voyage.persistence.authority.denied",
  EXPECTED_REVISION_REQUIRED: "voyage.persistence.expectedRevision.required",
  REVISION_CONFLICT: "voyage.persistence.revision.conflict",
  INVALID_CONTAINER: "voyage.persistence.container.invalid",
  INVALID_RUNTIME: "voyage.persistence.runtime.invalid",
  UNSAFE_DATA: "voyage.persistence.data.unsafe",
  UPDATE_UNAVAILABLE: "voyage.persistence.update.unavailable",
  INVALID_OPTIONS: "voyage.persistence.options.invalid",
  RUNTIME_ID_REQUIRED: "voyage.persistence.runtimeId.required"
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isJsonCompatibleData(value, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || !value || (!Array.isArray(value) && !isPlainObject(value))) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const valid = Reflect.ownKeys(descriptors).every((key) => {
    if (typeof key === "symbol") return false;
    if (Array.isArray(value) && key === "length") return true;
    const descriptor = descriptors[key];
    if (descriptor.get || descriptor.set || !descriptor.enumerable) return false;
    return isJsonCompatibleData(descriptor.value, seen);
  });
  seen.delete(value);
  return valid;
}

function cloneJsonCompatibleData(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const clone = [];
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (key !== "length" && descriptor.enumerable) {
        Object.defineProperty(clone, key, {
          value: cloneJsonCompatibleData(descriptor.value), enumerable: true, configurable: true, writable: true
        });
      }
    }
    return clone;
  }
  const clone = Object.create(Object.getPrototypeOf(value));
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (descriptor.enumerable) {
      Object.defineProperty(clone, key, {
        value: cloneJsonCompatibleData(descriptor.value), enumerable: true, configurable: true, writable: true
      });
    }
  }
  return clone;
}

/** A stable error contract whose details are always independent JSON-compatible plain data. */
export class VoyageEventPersistenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "VoyageEventPersistenceError";
    this.code = code;
    this.details = isJsonCompatibleData(details) ? cloneJsonCompatibleData(details) : {};
  }
}

function persistenceError(code, message, details) {
  return new VoyageEventPersistenceError(code, message, details);
}

function getActorFlag(shipActor, key) {
  return shipActor?.getFlag?.(ARCFLIGHT_MODULE_ID, key)
    ?? shipActor?.flags?.[ARCFLIGHT_MODULE_ID]?.[key];
}

function getStoredContainer(shipActor) {
  return shipActor?.getFlag?.(ARCFLIGHT_MODULE_ID, "system")?.voyageEvents
    ?? shipActor?.flags?.[ARCFLIGHT_MODULE_ID]?.system?.voyageEvents;
}

/** Normalizes revisions to non-negative integers; malformed values deterministically become 0. */
export function normalizeVoyageEventRevision(value) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function normalizeActiveRuntime(source) {
  const runtime = createVoyageEventRuntime(source);
  return { ...runtime, runtimeId: runtime.runtimeId.trim(), revision: normalizeVoyageEventRevision(runtime.revision) };
}

function normalizeVoyageEventsContainer(source) {
  const container = createVoyageEventsContainer(source);
  return container.active === null ? container : { ...container, active: normalizeActiveRuntime(container.active) };
}

/** Returns whether an Actor is an Arcflight-enabled PF2e vehicle ship. */
export function isArcflightVoyageShip(shipActor) {
  return shipActor?.type === "vehicle"
    && getActorFlag(shipActor, "enabled") === true
    && getActorFlag(shipActor, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

/** @deprecated Use isArcflightVoyageShip. */
export const isEligibleVoyageEventShip = isArcflightVoyageShip;

function assertEligibleShip(shipActor) {
  if (!isArcflightVoyageShip(shipActor)) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.INVALID_SHIP, "Voyage Event persistence requires an Arcflight-enabled PF2e vehicle ship.");
  }
}

function resolveAuthorizedUser(options) {
  const user = options?.user ?? globalThis.game?.user;
  if (user?.isGM !== true) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.UNAUTHORIZED_USER, "Voyage Event persistence requires GM authority.");
  }
  return user;
}

function assertExpectedRevision(options) {
  if (!isPlainObject(options)) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.INVALID_OPTIONS, "Voyage Event persistence options must be a plain object.");
  }
  if (!Object.hasOwn(options, "expectedRevision") || options.expectedRevision === undefined) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.EXPECTED_REVISION_REQUIRED, "Voyage Event persistence requires expectedRevision.");
  }
  if (options.expectedRevision !== null && (!Number.isInteger(options.expectedRevision) || options.expectedRevision < 0)) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.INVALID_OPTIONS, "Voyage Event expectedRevision must be null or a non-negative integer.");
  }
}

function assertRevisionMatches(expectedRevision, actualRevision) {
  if (expectedRevision !== actualRevision) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.REVISION_CONFLICT, "Voyage Event persistence revision does not match the current active event.", { expectedRevision, actualRevision });
  }
}

function assertSafeData(value) {
  if (!isJsonCompatibleData(value)) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.UNSAFE_DATA, "Voyage Event persistence accepts only JSON-compatible plain data.");
  }
}

function assertExplicitWriteOptions(options) {
  if (Object.hasOwn(options, "timestamp") && (!Number.isFinite(options.timestamp) || options.timestamp < 0)) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.INVALID_OPTIONS, "Voyage Event persistence timestamp must be a non-negative finite number.");
  }
  if (Object.hasOwn(options, "userId") && (typeof options.userId !== "string" || options.userId.trim() === "")) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.INVALID_OPTIONS, "Voyage Event persistence userId must be a non-empty string.");
  }
}

function stampOptions(options, user) {
  const timestamp = options.timestamp ?? Date.now();
  const userIdSource = Object.hasOwn(options, "userId") ? options.userId : user?.id;
  const userId = typeof userIdSource === "string" ? userIdSource.trim() : "";
  if (!Number.isFinite(timestamp) || timestamp < 0 || userId === "") {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.INVALID_OPTIONS, "Voyage Event persistence timestamp and responsible user ID must be valid values.");
  }
  return { timestamp, userId };
}

function createPersistedActive(nextRuntime, currentActive, revision, metadata) {
  const runtime = normalizeActiveRuntime(nextRuntime);
  if (runtime.runtimeId === "") {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.RUNTIME_ID_REQUIRED, "Voyage Event active runtimes require a non-empty runtimeId.");
  }
  // The future state manager, not persistence, decides whether runtime IDs or phases may legally change.
  const sameRuntime = currentActive !== null && runtime.runtimeId === currentActive.runtimeId;
  return normalizeActiveRuntime({
    ...runtime, revision,
    createdAt: sameRuntime ? currentActive.createdAt : metadata.timestamp,
    createdByUserId: sameRuntime ? currentActive.createdByUserId : metadata.userId,
    updatedAt: metadata.timestamp, updatedByUserId: metadata.userId
  });
}

async function writeContainer(shipActor, container) {
  if (typeof shipActor?.update !== "function") {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.UPDATE_UNAVAILABLE, "Voyage Event persistence requires an Actor update method.");
  }
  // Updating only this dotted flag path preserves every sibling in flags.arcflight.system.
  await shipActor.update({ [ARCFLIGHT_VOYAGE_EVENT_FLAG_PATH]: container });
}

/** Reads a normalized, independent Voyage Event container without changing the Actor. */
export function getVoyageEventsContainer(shipActor) {
  const stored = getStoredContainer(shipActor);
  return normalizeVoyageEventsContainer(isJsonCompatibleData(stored) ? stored : {});
}

/** Reads the normalized active Voyage Event runtime, or null when none is persisted. */
export function getActiveVoyageEvent(shipActor) {
  return getVoyageEventsContainer(shipActor).active;
}

/** Reads the normalized active runtime revision, or null when no active runtime exists. */
export function getActiveVoyageEventRevision(shipActor) {
  return getActiveVoyageEvent(shipActor)?.revision ?? null;
}

/** @deprecated Use getActiveVoyageEventRevision. */
export const getVoyageEventRevision = getActiveVoyageEventRevision;

/** GM-authoritatively persists a complete normalized Voyage Event container. */
export async function persistVoyageEventsContainer(shipActor, nextContainer, options = {}) {
  assertEligibleShip(shipActor);
  assertExpectedRevision(options);
  assertExplicitWriteOptions(options);
  const user = resolveAuthorizedUser(options);

  if (!isPlainObject(nextContainer)) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.INVALID_CONTAINER, "Voyage Event container must be a plain object.");
  }
  assertSafeData(nextContainer);
  const candidate = cloneJsonCompatibleData(nextContainer);
  if (candidate.active !== null && candidate.active !== undefined && !isPlainObject(candidate.active)) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.INVALID_RUNTIME, "Voyage Event active runtime must be a plain object or null.");
  }
  const normalized = normalizeVoyageEventsContainer(candidate);

  const current = getVoyageEventsContainer(shipActor);
  const actualRevision = current.active?.revision ?? null;
  // This exact optimistic comparison is at the authoritative write boundary before Actor.update.
  assertRevisionMatches(options.expectedRevision, actualRevision);
  let persisted = normalized;
  if (normalized.active !== null) {
    const metadata = stampOptions(options, user);
    persisted = normalizeVoyageEventsContainer({
      ...normalized,
      active: createPersistedActive(normalized.active, current.active, actualRevision === null ? 1 : actualRevision + 1, metadata)
    });
  }
  await writeContainer(shipActor, persisted);
  return normalizeVoyageEventsContainer(persisted);
}

/** Persists an active runtime, or clears it when nextRuntime is null. */
export async function persistActiveVoyageEvent(shipActor, nextRuntime, options = {}) {
  if (nextRuntime !== null && !isPlainObject(nextRuntime)) {
    throw persistenceError(VOYAGE_EVENT_PERSISTENCE_ERROR_CODES.INVALID_RUNTIME, "Voyage Event runtime must be a plain object or null.");
  }
  const runtime = nextRuntime === null ? null : (() => {
    assertSafeData(nextRuntime);
    return cloneJsonCompatibleData(nextRuntime);
  })();
  const current = getVoyageEventsContainer(shipActor);
  const container = await persistVoyageEventsContainer(shipActor, { ...current, active: runtime }, options);
  return container.active;
}
