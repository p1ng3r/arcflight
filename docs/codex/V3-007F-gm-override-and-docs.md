# V3-007F — Add Audited GM Override and Complete Lifecycle Documentation

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Starting branch:** latest `rebuild/arcflight-voyage-events-alpha` after V3-007E is merged

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-007F-gm-override-and-docs.md.`

---

TASK ID: V3-007F  
TITLE: Add reasoned audited GM override and finish V3-007 lifecycle documentation

## DEPENDENCY

V3-007A through V3-007E must already be reviewed and merged. Extend the existing lifecycle manager. Do not create a competing state path, manager, policy, or persistence layer.

## READ FIRST

- `AGENTS.md`
- `docs/codex/V3-007-voyage-event-lifecycle-manager.md`
- every V3-007A through V3-007E slice document
- `docs/voyage-event-v3-decisions.md`
- `docs/voyage-event-data-contracts.md`
- `docs/voyage-event-validation.md`
- `docs/voyage-event-persistence.md`
- `docs/voyage-event-lifecycle-policy.md`
- `docs/voyage-event-lifecycle-manager.md`
- `scripts/voyage-events/constants.js`
- `scripts/voyage-events/defaults.js`
- `scripts/voyage-events/contracts.js`
- `scripts/voyage-events/validation.js`
- `scripts/voyage-events/persistence.js`
- `scripts/voyage-events/lifecycle-policy.js`
- `scripts/voyage-events/lifecycle-manager.js`

## GOAL

Add one explicit GM correction path that can bypass ordinary lifecycle edges only when given a reason, while preserving runtime identity and prior audit history and appending exactly one serializable audit entry. Then complete the consolidated lifecycle documentation and end-to-end manual Foundry inspection checklist.

## REQUIRED PUBLIC API

Add stable equivalents of:

```js
VOYAGE_EVENT_OVERRIDEABLE_FIELDS
overrideActiveVoyageEvent(shipActor, changes, options)
```

Reuse the existing `VoyageEventLifecycleError`, lifecycle error codes, default factories, and persistence layer.

## OPTIONS

Require:

- `expectedRevision`;
- `reason`: non-empty after trimming.

Support the same authority/stamping values as persistence:

- `user`;
- `userId`;
- `timestamp`.

Resolve one responsible user ID and one timestamp for the operation, then use those exact values both in the audit entry and in the persistence call. Preserve persistence's validation requirements: explicit timestamps must be finite and non-negative; responsible user IDs must be non-empty.

Do not add force-without-revision, unaudited, skipAuthority, skipReason, or arbitrary callback options.

## OVERRIDEABLE FIELDS

Export one frozen allowlist containing only these mutable top-level runtime fields:

- `phase`
- `paused`
- `roundIndex`
- `stationOrder`
- `stations`
- `incomingEffects`
- `pressure`
- `hazards`
- `narrativeFlags`
- `tentativeChoices`
- `lockedChoices`
- `completedStationResults`
- `roundHistory`
- `postedVignettes`
- `eventScore`
- `stagedAftermath`

The override path must never accept caller replacement of:

- `runtimeId`
- `packageId`
- `packageVersion`
- `shipUuid`
- `revision`
- `auditHistory`
- `createdAt`
- `createdByUserId`
- `updatedAt`
- `updatedByUserId`

Unknown or forbidden fields are invalid; do not silently strip them.

## SAFE CHANGE VALIDATION

Before reading any candidate property value:

- require `changes` to be a plain object;
- inspect own property descriptors without invoking getters or setters;
- reject accessors;
- reject functions, symbols, bigint, `undefined`, non-finite numbers, class instances, and cycles;
- clone accepted values into independent plain data while preserving own `__proto__` data properties safely;
- require at least one own override field;
- reject unknown/forbidden fields with `OVERRIDE_CHANGES_INVALID`;
- reject missing/empty changes with `OVERRIDE_CHANGES_REQUIRED`.

A small extraction or reuse of the persistence layer's descriptor-safe validation/clone logic is allowed only when it keeps V3-006 public behavior and error codes unchanged. Do not weaken persistence validation or duplicate unsafe variants casually.

## FIELD-SPECIFIC VALIDATION

- `phase`, when present, must be an accepted phase except `archive`; invalid values use `PHASE_INVALID`.
- `paused`, when present, must be boolean.
- `roundIndex`, when present, must be a non-negative integer.
- other allowlisted fields are normalized by the accepted runtime factory/persistence boundary after safe-data validation.
- do not enforce station gameplay legality, scoring, effect semantics, or content references in this slice.

Override may be used while the runtime is paused and may change `paused`. It may bypass normal phase edges, but it may not set `archive`; atomic archival remains future work.

## REQUIRED OPERATION

`overrideActiveVoyageEvent` must:

1. defensively read the active runtime;
2. reject missing active state with `ACTIVE_REQUIRED`;
3. require a trimmed non-empty reason; reject with `OVERRIDE_REASON_REQUIRED`;
4. safely validate and clone the `changes` object;
5. resolve the responsible user ID and timestamp once;
6. create an independent candidate from the current runtime;
7. shallow-replace only explicitly supplied allowlisted top-level fields;
8. forcibly preserve current runtime/package/ship identity and creation metadata;
9. preserve every prior audit entry unchanged;
10. append exactly one new audit entry;
11. persist through `persistActiveVoyageEvent` with the caller's exact expected revision and the same resolved user ID/timestamp;
12. return the fresh persisted active runtime.

## AUDIT ENTRY

Append plain serializable data equivalent to:

```js
{
  type: "gmOverride",
  userId: "responsible-user-id",
  timestamp: 123,
  detail: {
    reason: "trimmed reason",
    changedFields: ["phase", "paused"],
    previousPhase: "crewPlanning",
    nextPhase: "roundResolution"
  }
}
```

Requirements:

- `changedFields` contains unique supplied field names in deterministic order;
- `previousPhase` and `nextPhase` reflect the actual before/after phases, even when phase was not changed;
- reason is trimmed;
- no Actor, user object, package, function, or mutable caller reference is retained;
- failed overrides append nothing and perform no write.

## IDENTITY AND HISTORY INVARIANTS

A successful override must preserve exactly:

- runtime ID;
- package ID and package version;
- ship UUID;
- creation timestamp and creator user ID;
- all previous audit entries in the same order.

Persistence remains authoritative for revision and update metadata. Success performs one Actor update and increments revision once.

## DOCUMENTATION

Complete `docs/voyage-event-lifecycle-manager.md` so it documents the full V3-007 public API:

- `VoyageEventLifecycleError`
- `startVoyageEvent`
- `pauseVoyageEvent`
- `resumeVoyageEvent`
- `advanceVoyageEventPhase`
- `advanceVoyageEventRound`
- `overrideActiveVoyageEvent`
- transition policy exports and lifecycle error codes
- exact state path and persistence dependency
- options, authority, revision, metadata, reset, preservation, and audit behavior
- V3-007 boundaries and deferred archive behavior
- exact end-to-end manual Foundry console inspection steps

Update `docs/voyage-event-lifecycle-policy.md` only for small final cross-reference corrections. Do not register lifecycle APIs globally in this slice.

## MANUAL FOUNDRY INSPECTION TO DOCUMENT — DO NOT RUN IN CODEX

Provide a complete ordered checklist that verifies:

1. Module imports and all V3-007 exports exist.
2. Start succeeds from no active state at revision 1.
3. Duplicate start fails with no change.
4. Pause succeeds, redundant pause fails, resume succeeds, redundant resume fails.
5. Normal legal advancement succeeds and illegal/self/skipped/backward/unknown transitions fail.
6. Paused normal advancement fails.
7. Normal phase helper rejects the new-round edge.
8. Round helper succeeds only from `nextRoundPreparation`, increments round index, resets exactly the accepted fields, and preserves Focus/event-scoped state.
9. Override requires an active runtime, reason, non-empty safe changes, allowed fields, exact revision, and GM authority.
10. Override can intentionally bypass a normal phase edge and can operate while paused.
11. Override preserves identity, creation metadata, and prior audit entries.
12. Override appends exactly one audit record with matching user/timestamp/reason/changed fields.
13. Forbidden identity/audit/metadata fields reject without a write.
14. Unknown fields, accessors, functions, class instances, non-finite numbers, cycles, and unsafe `__proto__` handling reject safely without getter execution or prototype pollution.
15. Stale expected revisions reject every operation without changing complete stored data.
16. Non-GM operations are rejected by persistence without writes.
17. Each successful operation causes exactly one revision increment and one Actor update.
18. Caller inputs remain unchanged.
19. Sibling Arcflight system flags remain unchanged.
20. Cleanup uses `persistActiveVoyageEvent(ship, null, ...)` with the current revision and does not archive.

The checklist must clearly warn the human tester before selecting or modifying a Foundry Actor. Do not require token selection.

## OUT OF SCOPE

- no archive/container transfer or abort workflow;
- no package registration or global API registration;
- no station-choice, station-order, action, result, or readiness enforcement;
- no PF2e rolls;
- no bids, scoring, rewards, dangers, effects, Pressure, Hazards, narrative composition, chat, sockets, player requests, UI, templates, CSS, localization, hooks, catalogs, or bundled content;
- no automated tests, Foundry run, branch operation, or pull request.

## ACCEPTANCE CRITERIA

1. Override requires active state, reason, safe non-empty changes, exact revision, and GM authority.
2. Only allowlisted fields can change.
3. Identity, creation metadata, and prior audit history cannot be replaced.
4. Exactly one audit entry is appended on success.
5. Audit and persistence use the same resolved user ID/timestamp.
6. Invalid/unsafe/forbidden changes fail before write and without getter execution or prototype mutation.
7. Archive cannot be set through override.
8. Success performs one Actor update and increments once.
9. Full lifecycle documentation and manual checklist are complete.
10. All earlier V3-007 APIs remain unchanged.
11. No global registration or gameplay systems are added.
12. `git diff --check` passes.

## FINAL RESPONSE

Return:

- concise summary;
- complete changed-file list;
- complete final V3-007 public API;
- override allowlist and forbidden fields;
- audit shape and identity preservation behavior;
- authority, revision, and one-write behavior;
- error codes;
- assumptions;
- exact end-to-end manual Foundry inspection steps;
- known limitations and deferred archive behavior;
- `git diff --check` result;
- confirmation that no archive, gameplay mechanics, global registration, UI, sockets, tests, branch operations, or pull request were added.
