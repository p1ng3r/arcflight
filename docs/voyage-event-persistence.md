# Voyage Event Persistence Helpers

`scripts/voyage-events/persistence.js` is the GM-authoritative persistence boundary for Voyage Event runtime data. It does not implement a state machine, gameplay transitions, sockets, UI, rolls, catalogs, or bundled content.

## Storage and public API

The sole Actor update payload is:

```js
{ [ARCFLIGHT_VOYAGE_EVENT_FLAG_PATH]: normalizedContainer }
// ARCFLIGHT_VOYAGE_EVENT_FLAG_PATH === "flags.arcflight.system.voyageEvents"
```

This dotted update preserves every sibling under `flags.arcflight.system` and never writes PF2e `system` data. The required exported API is:

- `ARCFLIGHT_VOYAGE_EVENT_FLAG_PATH`
- `VOYAGE_EVENT_PERSISTENCE_ERROR_CODES`
- `isArcflightVoyageShip(shipActor)`
- `getVoyageEventsContainer(shipActor)`
- `getActiveVoyageEvent(shipActor)`
- `getActiveVoyageEventRevision(shipActor)`
- `persistVoyageEventsContainer(shipActor, nextContainer, options)`
- `persistActiveVoyageEvent(shipActor, nextRuntime, options)`

Backward-compatible aliases remain available: `VOYAGE_EVENTS_FLAG_PATH`, `isEligibleVoyageEventShip`, and `getVoyageEventRevision`. A writable Actor must be a `vehicle` with `flags.arcflight.enabled === true` and `flags.arcflight.actorType === "arcflightShip"`. Writes require an authorized user with `isGM === true`.

## Revision, active runtime, and metadata behavior

Active revisions are normalized to non-negative integers using `Math.max(0, Math.trunc(value))` for finite numbers; malformed values become `0`. `expectedRevision` is required and must be `null` or a non-negative integer. Valid nonmatching values—including `null` against an active runtime—throw a revision conflict with `{ expectedRevision, actualRevision }`; invalid non-null types, negative integers, and decimals are options errors.

A new active runtime starts at revision `1`; a later active write increments the normalized current revision once. Caller revisions are ignored. Non-null active runtimes require a non-empty trimmed `runtimeId`. Matching runtime IDs preserve authoritative creation metadata; different IDs establish it anew. Every active write stamps update metadata. Responsible user IDs come from a supplied `options.userId` or the authorized user and must normalize to a non-empty string. Explicit timestamps must be finite and non-negative; omitted timestamps use `Date.now()`.

`persistActiveVoyageEvent(ship, null, options)` clears only `active`, preserving the container schema and archive. It requires the exact active revision, delegates to the container writer, performs one dotted-path update, and returns `null`; it does not archive or add history.

## Error registry

`VOYAGE_EVENT_PERSISTENCE_ERROR_CODES` is frozen and has these values:

- `INVALID_SHIP`: `voyage.persistence.actor.invalid`
- `UNAUTHORIZED_USER`: `voyage.persistence.authority.denied`
- `EXPECTED_REVISION_REQUIRED`: `voyage.persistence.expectedRevision.required`
- `REVISION_CONFLICT`: `voyage.persistence.revision.conflict`
- `INVALID_CONTAINER`: `voyage.persistence.container.invalid`
- `INVALID_RUNTIME`: `voyage.persistence.runtime.invalid`
- `UNSAFE_DATA`: `voyage.persistence.data.unsafe`
- `UPDATE_UNAVAILABLE`: `voyage.persistence.update.unavailable`
- `INVALID_OPTIONS`: `voyage.persistence.options.invalid`
- `RUNTIME_ID_REQUIRED`: `voyage.persistence.runtimeId.required`

Complete containers must be plain objects; non-null runtimes must be plain objects. Safe caller-owned containers and runtimes are independently deep-cloned before normalization, so default factories never receive caller-owned objects. Nested unsafe data rejects before normalization with `UNSAFE_DATA`: functions, symbols, bigints, `undefined`, non-finite numbers, class instances, cyclic references, and accessor properties are all unsafe. Accessors are rejected by inspecting own property descriptors without invoking their getters or setters. Defensive reads remain safe for malformed persisted Actor data. Error details are independent JSON-compatible plain data.

Explicit `options.timestamp` values must be finite and non-negative, and explicit `options.userId` values must be non-empty after trimming. These option checks apply to every write, including active-runtime clearing. Candidate validation, safety inspection, cloning, and normalization occur before the current Actor container is read. The exact revision comparison then occurs at the authoritative write boundary with no asynchronous gap before the dotted Actor update.

## Manual Foundry console inspection

Do not run these as part of this task. In a Foundry console, load the module and select an eligible ship:

```js
const persistence = await import("/modules/arcflight/scripts/voyage-events/persistence.js");
const ship = game.actors.find((actor) => persistence.isArcflightVoyageShip(actor));
const runtime = { runtimeId: "manual-voyage", packageId: "manual", shipUuid: ship.uuid };
```

1. Confirm `persistence.getVoyageEventsContainer(ship)` returns `{ schemaVersion: 1, active: null, archive: [] }` for a ship with no flag and does not write.
2. As a GM, persist `runtime` using `expectedRevision: null`, a valid timestamp, and a non-empty user ID; confirm revision `1`.
3. Persist the same runtime with `expectedRevision: 1`; confirm revision `2` and preserved creation metadata.
4. Retry with stale `expectedRevision: 1`; confirm `REVISION_CONFLICT`, details `{ expectedRevision: 1, actualRevision: 2 }`, and no update.
5. With an active runtime, write using `expectedRevision: null`; confirm `REVISION_CONFLICT`, details containing `null` and the active revision, and no update.
6. Clear with `persistActiveVoyageEvent(ship, null, { expectedRevision: 2, userId: "gm", timestamp: 3 })`; confirm it returns `null`, performs one update, and the stored `active` value is `null`.
7. Attempt a valid active write with `timestamp: -1`; confirm `INVALID_OPTIONS` and no update.
8. Pass a non-object container to `persistVoyageEventsContainer`; confirm `INVALID_CONTAINER` and no update.
9. Pass a non-object non-null runtime to `persistActiveVoyageEvent`; confirm `INVALID_RUNTIME` and no update.
10. Attempt inputs containing a function, `new Date()`, `Infinity`, and a cyclic object; confirm `UNSAFE_DATA` and no update for each.
11. Clear with `timestamp: -1`; confirm `INVALID_OPTIONS` and no update. Repeat with a blank explicit `userId` and confirm the same result.
12. Attempt a plain object with an own getter property; confirm `UNSAFE_DATA`, no update, and that the getter was not invoked.
13. Compare `flags.arcflight.system.installState`, `refitPressure`, and `stations` before and after successful writes; confirm sibling data is unchanged.
14. Freeze or deep-compare each caller input before and after persistence; confirm it remains unchanged.
