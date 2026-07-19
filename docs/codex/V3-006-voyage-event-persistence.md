# V3-006 — Add Voyage Event Persistence Helpers

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Starting branch:** `rebuild/arcflight-voyage-events-alpha`

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-006-voyage-event-persistence.md.`

---

TASK ID: V3-006  
TITLE: Add GM-authoritative Voyage Event persistence helpers

Repository: p1ng3r/arcflight  
Starting branch: rebuild/arcflight-voyage-events-alpha

## READ FIRST

- `AGENTS.md`
- `docs/voyage-event-v3-decisions.md`
- `docs/voyage-event-data-contracts.md`
- `docs/voyage-event-validation.md`
- `scripts/voyage-events/constants.js`
- `scripts/voyage-events/defaults.js`
- `scripts/voyage-events/contracts.js`
- `scripts/voyage-events/validation.js`
- `scripts/documents/ships.js`
- `scripts/helpers/install-state.js`
- `scripts/config/constants.js`

## GOAL

Create the small Foundry-facing persistence boundary for Voyage Event state stored on an Arcflight-enabled PF2e vehicle Actor at:

`flags.arcflight.system.voyageEvents`

This task adds safe reads, normalized writes, GM authority checks, revision-conflict protection, and timestamp/user stamping. It does not implement event gameplay transitions, sockets, UI, rolls, catalog execution, or bundled content.

## REQUIRED DELIVERABLES

Create only the files needed for a focused persistence layer, expected to include:

- `scripts/voyage-events/persistence.js`
- `docs/voyage-event-persistence.md`

Update an existing Voyage Event contract/default file only when a small consistency correction is strictly required. Do not register the new module anywhere in this task.

## A. ACTOR ELIGIBILITY

Persistence writes are allowed only for an Arcflight-enabled PF2e vehicle Actor using the existing project conventions:

- Actor type is `vehicle`;
- `flags.arcflight.enabled` is `true`;
- `flags.arcflight.actorType` is the Arcflight ship actor type.

Reuse existing constants where practical. Do not duplicate or alter ship actor architecture.

Read helpers must be defensive and may safely return normalized defaults for a missing, older, or partially malformed flag container.

Write helpers must reject an ineligible Actor with a stable error.

## B. CANONICAL FLAG PATH

The only persistence location for this task is:

`flags.arcflight.system.voyageEvents`

Requirements:

- never write Voyage Event data into PF2e `system` data;
- never overwrite the entire `flags.arcflight.system` object;
- use a dotted Actor update path targeting only `flags.arcflight.system.voyageEvents`;
- preserve install state, refit pressure, stations, and all sibling Arcflight flag data;
- normalize data through the accepted Voyage Event default factories before returning or writing it;
- do not retain mutable references to Actor source data or caller input.

## C. PUBLIC READ API

Provide clear APIs equivalent to:

```js
getVoyageEventsContainer(shipActor)
getActiveVoyageEvent(shipActor)
getVoyageEventRevision(shipActor)
```

Required behavior:

- reads do not mutate the Actor;
- missing data returns the accepted normalized container default;
- returned objects are safe independent plain data;
- `getActiveVoyageEvent` returns the normalized active runtime or `null`;
- revision reads return the current active runtime revision, or `null` when no active event exists.

Exact names may vary only for a strong existing repository convention. Document final names.

## D. GM WRITE AUTHORITY

Actual Actor writes are GM-authoritative.

Provide an authority check that supports normal Foundry runtime use and explicit manual inspection context. Requirements:

- use the current Foundry user by default when available;
- require `isGM === true` for writes;
- allow an explicitly supplied user-like object for manual inspection or later internal callers;
- non-GM writes fail before `Actor.update` is called;
- no socket forwarding or player request handling in this task;
- errors contain stable machine-readable codes.

Do not add notifications, dialogs, hooks, or global registration.

## E. REVISION-CONFLICT PROTECTION

Provide optimistic revision checking for writes.

The caller supplies an `expectedRevision` representing the revision it read before preparing the write.

Rules:

- when no active event exists, the current revision is `null`;
- when an active event exists, use its normalized non-negative integer revision;
- an explicitly supplied `expectedRevision` must exactly match the current revision;
- a mismatch must fail before `Actor.update` and report a stable revision-conflict error containing expected and actual revisions;
- successful persistence of an active runtime increments its revision exactly once;
- a new active runtime written when the current active value is `null` begins at revision `1`;
- caller-provided runtime revision values are not trusted as the authoritative next revision;
- do not implement gameplay phase-transition rules in this task.

Require `expectedRevision` for write helpers. Do not silently perform unguarded writes.

## F. TIMESTAMPS AND RESPONSIBLE USER

A successful active-runtime write must stamp:

- `updatedAt`;
- `updatedByUserId`.

For a newly persisted active runtime, also establish:

- `createdAt`;
- `createdByUserId`.

Rules:

- accept an explicit finite timestamp and user ID through options for deterministic internal/manual use;
- otherwise use the current time and authorized user ID;
- preserve original creation metadata when updating the same active runtime;
- use plain serializable numbers and strings;
- do not add audit or override entries automatically in this task.

Audit and GM override semantics will be handled by later state-management work.

## G. PUBLIC WRITE API

Provide focused APIs equivalent to:

```js
persistVoyageEventsContainer(shipActor, nextContainer, options)
persistActiveVoyageEvent(shipActor, nextRuntime, options)
```

Required behavior:

- validate Actor eligibility and GM authority;
- require `expectedRevision` in options;
- compare against the currently persisted active revision;
- normalize and clone all data before writing;
- stamp authoritative revision and metadata for an active runtime;
- write only the canonical dotted flag path;
- await `shipActor.update(...)`;
- return a fresh normalized copy of the persisted container or runtime;
- never mutate `nextContainer`, `nextRuntime`, or Actor source flag objects;
- ordinary invalid input and conflict failures must expose stable error codes.

For the full-container writer, revision protection is based on the currently persisted active runtime. If `nextContainer.active` is not null, apply the same authoritative revision and timestamp rules. If `nextContainer.active` is null, preserve a normalized null active value and do not invent a revision.

Do not add specialized start, pause, phase advance, resolve, archive, abort, or clear-event gameplay functions in this task.

## H. ERROR CONTRACT

Provide a stable persistence error shape, either through a small custom Error class or another clear project-appropriate mechanism.

At minimum support codes equivalent to:

- `voyage.persistence.actor.invalid`
- `voyage.persistence.authority.denied`
- `voyage.persistence.expectedRevision.required`
- `voyage.persistence.revision.conflict`
- `voyage.persistence.update.unavailable`

A revision conflict must expose expected and actual revisions as serializable details.

Do not expose UI notifications or localized strings in this task.

## I. DOCUMENTATION

Document:

- exact flag path;
- final read and write API names;
- eligible Actor requirements;
- GM authority rule;
- revision lifecycle including `null` to `1` for a new active runtime;
- timestamp and user stamping;
- dotted-path update behavior that preserves sibling Arcflight data;
- stable persistence error codes;
- that this task is a persistence boundary only, not the state machine;
- exact manual Foundry console inspection steps.

Manual inspection should verify:

1. A ship with no Voyage Event flag reads as `{ schemaVersion, active: null, archive: [] }` without writing.
2. A non-GM write is rejected and does not call Actor update.
3. A GM write with `expectedRevision: null` persists a new runtime at revision `1`.
4. A later write with `expectedRevision: 1` persists revision `2` while preserving creation metadata.
5. A stale write with `expectedRevision: 1` after revision `2` is rejected.
6. Sibling `flags.arcflight.system` data remains unchanged.
7. Caller input objects remain unchanged after persistence.

Do not run these steps in Codex.

## OUT OF SCOPE

- no Voyage Event state machine or gameplay transitions;
- no start/pause/advance/resolve/archive/abort manager;
- no socket handling or player-to-GM requests;
- no PF2e rolls;
- no reward, danger, Hazard, or effect execution;
- no catalog content;
- no bundled events;
- no import/export library UI;
- no ApplicationV2 classes;
- no templates, CSS, localization, or chat messages;
- no hooks or module registration;
- no changes to `module.json`;
- no changes to `scripts/arcflight.js`;
- no version bump;
- no branch operations;
- no pull request;
- do not run automated tests or Foundry.

## ACCEPTANCE CRITERIA

1. Reads safely normalize missing and malformed flag data without Actor mutation.
2. Writes target only `flags.arcflight.system.voyageEvents`.
3. Existing sibling Arcflight flag data is preserved.
4. Only eligible Arcflight PF2e vehicle Actors may be written.
5. Writes require GM authority.
6. Writes require an exact expected revision.
7. New active runtime begins at revision `1`; later successful writes increment exactly once.
8. Stale writes fail before Actor update with stable conflict details.
9. Creation metadata is established once and preserved for updates to the same runtime.
10. Update metadata reflects the successful writer and time.
11. Inputs and Actor source flag data are not mutated.
12. No gameplay transitions, sockets, UI, rolls, registration, or content are added.
13. `git diff --check` passes.

## FINAL RESPONSE

Return:

- concise summary;
- complete changed-file list;
- final public API names;
- exact Actor update payload path;
- revision behavior;
- authority behavior;
- stable error codes;
- assumptions;
- exact manual Foundry inspection steps;
- known limitations;
- `git diff --check` result;
- confirmation that no state machine, sockets, UI, rolls, registration, content, tests, branch operations, or pull request were added.