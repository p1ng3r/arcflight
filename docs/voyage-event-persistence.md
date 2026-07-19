# Voyage Event Persistence Helpers

`scripts/voyage-events/persistence.js` is the small GM-authoritative persistence boundary for Voyage Event runtime data. It is not the Voyage Event state machine and does not implement transitions, sockets, UI, rolls, catalogs, or content.

## Storage and eligibility

The exact and only update path is `flags.arcflight.system.voyageEvents` (exported as `VOYAGE_EVENTS_FLAG_PATH`). Writes use a single dotted Actor update payload:

```js
{ "flags.arcflight.system.voyageEvents": normalizedContainer }
```

This preserves sibling `flags.arcflight.system` data, including install state, refit pressure, and station data. It never writes PF2e `system` data. A writable Actor must have `type === "vehicle"`, `flags.arcflight.enabled === true`, and `flags.arcflight.actorType === "arcflightShip"`.

## Public API

- `getVoyageEventsContainer(shipActor)` returns an independent normalized container. Missing or malformed data reads as `{ schemaVersion: 1, active: null, archive: [] }` and does not update the Actor.
- `getActiveVoyageEvent(shipActor)` returns an independent normalized active runtime or `null`.
- `getVoyageEventRevision(shipActor)` returns the active runtime revision or `null`.
- `isEligibleVoyageEventShip(shipActor)` reports the Actor eligibility check.
- `persistVoyageEventsContainer(shipActor, nextContainer, options)` writes a full normalized container.
- `persistActiveVoyageEvent(shipActor, nextRuntime, options)` writes an active runtime and returns it.

Both write APIs require `{ expectedRevision }`. `expectedRevision` must be `null` or a non-negative integer; decimal, negative, and other invalid values reject with `voyage.persistence.options.invalid` before conflict comparison. They use `options.user` (or `game.user`) and require `isGM === true`; `options.timestamp` and `options.userId` allow deterministic manual/internal callers. A supplied `userId`, or the authorized user's fallback ID, must normalize to a non-empty trimmed string. Supplying `userId` never bypasses the GM check. No socket forwarding is provided.

## Revision and metadata lifecycle

Active revisions are always non-negative integers. Stored finite revisions use `Math.max(0, Math.trunc(value))`; missing, negative, and malformed values normalize to `0`. `getVoyageEventRevision` therefore returns only `null` or a non-negative integer. `expectedRevision` must exactly equal the current normalized active revision (or be `null` when no event is active). A successful new active runtime starts at revision `1`; every later successful active write increments the normalized current revision exactly once. Caller runtime revision values are ignored.

A non-null active runtime must normalize to a non-empty `runtimeId`, otherwise it rejects with `voyage.persistence.runtimeId.required`. A same valid normalized `runtimeId` preserves `createdAt` and `createdByUserId`; a different ID establishes authoritative creation metadata. Caller-provided creation metadata never overrides those values. Every active write sets `updatedAt` and the normalized non-empty `updatedByUserId`.

## Error contract

`VoyageEventPersistenceError` exposes `code` and serializable `details`. Stable codes are:

- `voyage.persistence.actor.invalid`
- `voyage.persistence.authority.denied`
- `voyage.persistence.expectedRevision.required`
- `voyage.persistence.revision.conflict` (details include `expectedRevision` and `actualRevision`)
- `voyage.persistence.update.unavailable`
- `voyage.persistence.options.invalid`
- `voyage.persistence.runtimeId.required`

## Manual Foundry console inspection

Do not run these as part of this task. In a Foundry world, import the helpers in the console and use an eligible Arcflight ship Actor as `ship`.

1. Confirm `getVoyageEventsContainer(ship)` returns `{ schemaVersion: 1, active: null, archive: [] }` for a ship with no Voyage Event flag; inspect `ship.flags.arcflight.system` before and after to confirm no write.
2. Call `persistActiveVoyageEvent(ship, runtime, { expectedRevision: null, user: { id: "player", isGM: false } })`; verify it rejects with `voyage.persistence.authority.denied` and spy on `ship.update` to confirm no call.
3. As a GM, call `persistActiveVoyageEvent(ship, runtime, { expectedRevision: null, timestamp: 1000, userId: "gm" })`; inspect the dotted-path payload and confirm `revision === 1` plus creation/update metadata.
4. Seed an active flag with `revision: 2.9`, then read it; confirm the returned revision is `2`. Repeat with missing, negative, or malformed revisions and confirm each normalizes to `0` without a write.
5. Call with `expectedRevision: 1.5`; confirm `voyage.persistence.options.invalid` and no Actor update.
6. Call with an active runtime whose `runtimeId` is `""` or whitespace; confirm `voyage.persistence.runtimeId.required` and no Actor update.
7. Call an otherwise valid active write with `userId: "   "`; confirm `voyage.persistence.options.invalid` and no Actor update.
8. Call it again using `expectedRevision: 1`, a later timestamp, and the same valid `runtimeId`; confirm revision `2`, unchanged creation metadata, and changed update metadata.
9. Retry with `expectedRevision: 1`; confirm `voyage.persistence.revision.conflict`, details `{ expectedRevision: 1, actualRevision: 2 }`, and no Actor update.
10. Compare sibling fields such as `flags.arcflight.system.installState`, `refitPressure`, and `stations` before and after; confirm they are unchanged.
11. Freeze or deep-compare the caller container/runtime before and after each write; confirm it remains unchanged.
