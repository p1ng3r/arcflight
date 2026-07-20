# V3-007B — Add Validated Active Voyage Event Start

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Starting branch:** latest `rebuild/arcflight-voyage-events-alpha` after V3-007A is merged

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-007B-start-active-event.md.`

---

TASK ID: V3-007B  
TITLE: Add validated GM-authoritative active Voyage Event start

## DEPENDENCY

V3-007A must already be reviewed and merged. Do not reimplement or alter its transition policy unless a minimal consistency correction is unavoidable and explicitly reported.

## READ FIRST

- `AGENTS.md`
- `docs/codex/V3-007-voyage-event-lifecycle-manager.md`
- `docs/codex/V3-007A-lifecycle-policy.md`
- `docs/voyage-event-v3-decisions.md`
- `docs/voyage-event-data-contracts.md`
- `docs/voyage-event-validation.md`
- `docs/voyage-event-persistence.md`
- `docs/voyage-event-lifecycle-policy.md`
- `scripts/voyage-events/constants.js`
- `scripts/voyage-events/defaults.js`
- `scripts/voyage-events/contracts.js`
- `scripts/voyage-events/validation.js`
- `scripts/voyage-events/persistence.js`
- `scripts/voyage-events/lifecycle-policy.js`

## GOAL

Create the first focused state-manager operation: start one structurally valid declarative Voyage Event package as the ship's active runtime through the accepted GM-authoritative persistence boundary.

## REQUIRED DELIVERABLES

Expected files:

- `scripts/voyage-events/lifecycle-manager.js`
- `docs/voyage-event-lifecycle-manager.md`

This slice adds only start behavior. Do not add pause, resume, phase advance, round advance, overrides, archive, or abort functions.

## REQUIRED PUBLIC API

Export stable equivalents of:

```js
VoyageEventLifecycleError
startVoyageEvent(shipActor, packageData, options)
```

The error class must expose:

- `name`;
- stable `code` from `VOYAGE_EVENT_LIFECYCLE_ERROR_CODES`;
- a human-readable message;
- independent JSON-compatible plain `details`.

It must not retain Actor, package, catalog, function, class-instance, or cyclic references.

## START OPTIONS

`options` supports:

- required `runtimeId`: non-empty after trimming;
- required `expectedRevision`: the caller must explicitly provide `null` because start means it observed no active runtime;
- optional `catalogs`: passed only to package validation;
- optional persistence authority/stamping values already supported by the persistence layer: `user`, `userId`, and `timestamp`.

Do not invent UI notifications or hidden global registration.

## START VALIDATION ORDER

Before any Actor update:

1. Validate the package with `validateVoyageEventPackage(packageData, { catalogs })`.
2. Reject an invalid package with `PACKAGE_INVALID` and independent serializable validation details.
3. Require a trimmed non-empty `runtimeId`; reject with `RUNTIME_ID_REQUIRED`.
4. Read the current active runtime defensively.
5. Reject when an active runtime already exists with `ACTIVE_EXISTS`; include only safe identity details such as current runtime ID, package ID, phase, and revision.
6. Delegate authority, Actor eligibility, option validation, exact revision protection, metadata stamping, cloning, and the single Actor update to `persistActiveVoyageEvent`.

Warnings from valid package validation do not block start. Preserve them only in the returned start result if the API returns a wrapper; do not persist the validation report inside the runtime.

## INITIAL RUNTIME

Build the candidate through the accepted default factory. The new runtime must contain:

- the supplied trimmed `runtimeId`;
- `packageId` and `packageVersion` from the validated normalized package;
- `shipUuid` from the target Actor;
- phase `setup`;
- `paused: false`;
- `roundIndex: 0`;
- empty station order, choices, completed results, histories, vignettes, incoming effects, staged aftermath, and audit history unless the accepted factory supplies equivalent defaults;
- exactly the five active station records with initial Focus from the accepted defaults;
- zero event-local Pressure lanes and no Hazards;
- `eventScore: 0`.

Do not persist the full package, catalogs, executable values, validation functions, or external mutable references.

The persistence layer remains authoritative for revision and creation/update metadata. A successful first start must persist revision `1`.

## RETURN VALUE

Return a fresh normalized copy of the persisted active runtime. Do not return the Actor or caller-owned package object.

## ERROR BEHAVIOR

- Lifecycle precondition failures use `VoyageEventLifecycleError` and lifecycle error codes.
- Persistence errors retain their existing persistence codes and details; do not wrap them into misleading lifecycle codes.
- Every failure occurs before Actor update unless the underlying Actor update itself fails.

## DOCUMENTATION

Document:

- final API name and options;
- validation and warning behavior;
- initial runtime fields;
- revision `null -> 1` behavior;
- authority and Actor eligibility delegation;
- one-write guarantee;
- stable start-related errors;
- manual Foundry console inspection steps.

## MANUAL FOUNDRY INSPECTION TO DOCUMENT — DO NOT RUN IN CODEX

The documented steps must verify:

1. An eligible Arcflight ship with no active runtime can start a minimal valid package.
2. The result and stored runtime have the supplied runtime ID, package identity, ship UUID, phase `setup`, `paused === false`, round index `0`, five station records with initial Focus, and revision `1`.
3. The package input remains unchanged.
4. Starting an invalid package fails without a write.
5. Starting without a valid runtime ID fails without a write.
6. Starting while another runtime is active fails without changing stored data.
7. A non-GM start is rejected by persistence without a write.
8. Sibling Arcflight system flags remain unchanged.
9. Cleanup uses the public persistence helper rather than direct legacy flag-deletion syntax.

## OUT OF SCOPE

- no package registry or content library;
- no automatic runtime ID generator;
- no pause/resume or phase transitions;
- no round reset;
- no override, archive, clear, or abort manager operation;
- no station choices, order, rolls, scoring, bids, rewards, dangers, effects, Pressure, Hazards, narrative, sockets, player requests, UI, hooks, registration, catalogs, or bundled events;
- no automated tests, Foundry run, branch operation, or pull request.

## ACCEPTANCE CRITERIA

1. Only a valid package can start.
2. Runtime ID is explicit and non-empty.
3. Existing active runtime blocks start.
4. Start uses `persistActiveVoyageEvent` with exact expected revision.
5. Successful start performs one Actor update and begins at revision `1`.
6. Initial runtime matches accepted defaults and package/ship identity.
7. Inputs are not mutated or retained.
8. Errors are stable and serializable.
9. No other lifecycle operation is added.
10. `git diff --check` passes.

## FINAL RESPONSE

Return:

- concise summary;
- complete changed-file list;
- exact exports and options;
- initial runtime behavior;
- validation, authority, and revision behavior;
- errors;
- assumptions;
- exact manual Foundry inspection steps;
- known limitations;
- `git diff --check` result;
- confirmation that no other lifecycle operations, gameplay mechanics, UI, sockets, tests, branch operations, or pull request were added.
