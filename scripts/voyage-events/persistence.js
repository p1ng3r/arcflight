import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";
import { ARCFLIGHT_SHIP_ACTOR_TYPE } from "../documents/ships.js";
import { createVoyageEventRuntime, createVoyageEventsContainer } from "./defaults.js";

export const VOYAGE_EVENTS_FLAG_PATH = `flags.${ARCFLIGHT_MODULE_ID}.system.voyageEvents`;

/** A stable, serializable error contract for Voyage Event persistence callers. */
export class VoyageEventPersistenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "VoyageEventPersistenceError";
    this.code = code;
    this.details = { ...details };
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
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
  return {
    ...runtime,
    runtimeId: runtime.runtimeId.trim(),
    revision: normalizeVoyageEventRevision(runtime.revision)
  };
}

function normalizeVoyageEventsContainer(source) {
  const container = createVoyageEventsContainer(source);
  return container.active === null
    ? container
    : { ...container, active: normalizeActiveRuntime(container.active) };
}

/** Returns whether an Actor is an Arcflight-enabled PF2e vehicle ship. */
export function isEligibleVoyageEventShip(shipActor) {
  return shipActor?.type === "vehicle"
    && getActorFlag(shipActor, "enabled") === true
    && getActorFlag(shipActor, "actorType") === ARCFLIGHT_SHIP_ACTOR_TYPE;
}

function assertEligibleShip(shipActor) {
  if (!isEligibleVoyageEventShip(shipActor)) {
    throw new VoyageEventPersistenceError(
      "voyage.persistence.actor.invalid",
      "Voyage Event persistence requires an Arcflight-enabled PF2e vehicle ship."
    );
  }
}

function resolveAuthorizedUser(options) {
  const user = options?.user ?? globalThis.game?.user;
  if (user?.isGM !== true) {
    throw new VoyageEventPersistenceError(
      "voyage.persistence.authority.denied",
      "Voyage Event persistence requires GM authority."
    );
  }
  return user;
}

function assertExpectedRevision(options) {
  if (!isPlainObject(options) || !Object.hasOwn(options, "expectedRevision") || options.expectedRevision === undefined) {
    throw new VoyageEventPersistenceError(
      "voyage.persistence.expectedRevision.required",
      "Voyage Event persistence requires expectedRevision."
    );
  }
  if (options.expectedRevision !== null
    && (!Number.isInteger(options.expectedRevision) || options.expectedRevision < 0)) {
    throw new VoyageEventPersistenceError(
      "voyage.persistence.options.invalid",
      "Voyage Event expectedRevision must be null or a non-negative integer."
    );
  }
}

function assertRevisionMatches(expectedRevision, actualRevision) {
  if (expectedRevision !== actualRevision) {
    throw new VoyageEventPersistenceError(
      "voyage.persistence.revision.conflict",
      "Voyage Event persistence revision does not match the current active event.",
      { expectedRevision, actualRevision }
    );
  }
}

function stampOptions(options, user) {
  const timestamp = options.timestamp ?? Date.now();
  const suppliedUserId = Object.hasOwn(options, "userId");
  const userIdSource = suppliedUserId ? options.userId : user?.id;
  const userId = typeof userIdSource === "string" ? userIdSource.trim() : "";
  if (!Number.isFinite(timestamp) || userId === "") {
    throw new VoyageEventPersistenceError(
      "voyage.persistence.options.invalid",
      "Voyage Event persistence timestamp and responsible user ID must be valid values."
    );
  }
  return { timestamp, userId };
}

function createPersistedActive(nextRuntime, currentActive, revision, metadata) {
  const runtime = normalizeActiveRuntime(nextRuntime);
  if (runtime.runtimeId === "") {
    throw new VoyageEventPersistenceError(
      "voyage.persistence.runtimeId.required",
      "Voyage Event active runtimes require a non-empty runtimeId."
    );
  }
  const sameRuntime = currentActive !== null
    && runtime.runtimeId !== ""
    && runtime.runtimeId === currentActive.runtimeId;
  return normalizeActiveRuntime({
    ...runtime,
    revision,
    createdAt: sameRuntime ? currentActive.createdAt : metadata.timestamp,
    createdByUserId: sameRuntime ? currentActive.createdByUserId : metadata.userId,
    updatedAt: metadata.timestamp,
    updatedByUserId: metadata.userId
  });
}

async function writeContainer(shipActor, container) {
  if (typeof shipActor?.update !== "function") {
    throw new VoyageEventPersistenceError(
      "voyage.persistence.update.unavailable",
      "Voyage Event persistence requires an Actor update method."
    );
  }
  await shipActor.update({ [VOYAGE_EVENTS_FLAG_PATH]: container });
}

/** Reads a normalized, independent Voyage Event container without changing the Actor. */
export function getVoyageEventsContainer(shipActor) {
  return normalizeVoyageEventsContainer(getStoredContainer(shipActor));
}

/** Reads the normalized active Voyage Event runtime, or null when none is persisted. */
export function getActiveVoyageEvent(shipActor) {
  return getVoyageEventsContainer(shipActor).active;
}

/** Reads the normalized active runtime revision, or null when no active runtime exists. */
export function getVoyageEventRevision(shipActor) {
  return getActiveVoyageEvent(shipActor)?.revision ?? null;
}

/**
 * GM-authoritatively persists a complete normalized Voyage Event container.
 * Revision protection always compares the currently persisted active runtime.
 */
export async function persistVoyageEventsContainer(shipActor, nextContainer, options = {}) {
  assertEligibleShip(shipActor);
  assertExpectedRevision(options);
  const user = resolveAuthorizedUser(options);
  const current = getVoyageEventsContainer(shipActor);
  const actualRevision = current.active?.revision ?? null;
  assertRevisionMatches(options.expectedRevision, actualRevision);

  if (!isPlainObject(nextContainer)) {
    throw new VoyageEventPersistenceError("voyage.persistence.options.invalid", "Voyage Event container must be a plain object.");
  }

  const normalized = normalizeVoyageEventsContainer(nextContainer);
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

/** GM-authoritatively persists one active runtime and returns an independent normalized copy. */
export async function persistActiveVoyageEvent(shipActor, nextRuntime, options = {}) {
  if (!isPlainObject(nextRuntime)) {
    throw new VoyageEventPersistenceError("voyage.persistence.options.invalid", "Voyage Event runtime must be a plain object.");
  }
  const current = getVoyageEventsContainer(shipActor);
  const container = await persistVoyageEventsContainer(shipActor, {
    ...current,
    active: normalizeActiveRuntime(nextRuntime)
  }, options);
  return container.active;
}
