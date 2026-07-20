# V3-007C — Add Guarded Voyage Event Pause and Resume

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Starting branch:** latest `rebuild/arcflight-voyage-events-alpha` after V3-007B is merged

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-007C-pause-resume.md.`

---

TASK ID: V3-007C  
TITLE: Add guarded GM-authoritative Voyage Event pause and resume

## DEPENDENCY

V3-007A and V3-007B must already be reviewed and merged. Extend the existing lifecycle manager; do not create a competing manager.

## READ FIRST

- `AGENTS.md`
- `docs/codex/V3-007-voyage-event-lifecycle-manager.md`
- `docs/codex/V3-007A-lifecycle-policy.md`
- `docs/codex/V3-007B-start-active-event.md`
- `docs/voyage-event-v3-decisions.md`
- `docs/voyage-event-persistence.md`
- `docs/voyage-event-lifecycle-policy.md`
- `docs/voyage-event-lifecycle-manager.md`
- `scripts/voyage-events/constants.js`
- `scripts/voyage-events/defaults.js`
- `scripts/voyage-events/persistence.js`
- `scripts/voyage-events/lifecycle-policy.js`
- `scripts/voyage-events/lifecycle-manager.js`

## GOAL

Add two narrow lifecycle operations that toggle the active runtime's `paused` state through the accepted persistence boundary. They do not change phase or any gameplay state.

## REQUIRED PUBLIC API

Add stable equivalents of:

```js
pauseVoyageEvent(shipActor, options)
resumeVoyageEvent(shipActor, options)
```

Reuse the existing `VoyageEventLifecycleError` and `VOYAGE_EVENT_LIFECYCLE_ERROR_CODES`.

## OPTIONS

Both operations require `options.expectedRevision` and pass through the existing persistence options:

- `user`;
- `userId`;
- `timestamp`.

Do not add force, silent, skipRevision, skipAuthority, or arbitrary mutation options.

## PAUSE BEHAVIOR

`pauseVoyageEvent` must:

1. defensively read the active runtime;
2. reject missing active state with `ACTIVE_REQUIRED`;
3. reject an already paused runtime with `ALREADY_PAUSED`;
4. create an independent candidate that differs only by `paused: true` before persistence metadata/revision stamping;
5. persist through `persistActiveVoyageEvent` using the caller's exact expected revision;
6. return the fresh persisted active runtime.

## RESUME BEHAVIOR

`resumeVoyageEvent` must:

1. defensively read the active runtime;
2. reject missing active state with `ACTIVE_REQUIRED`;
3. reject a runtime that is not paused with `NOT_PAUSED`;
4. create an independent candidate that differs only by `paused: false` before persistence metadata/revision stamping;
5. persist through `persistActiveVoyageEvent` using the caller's exact expected revision;
6. return the fresh persisted active runtime.

## INVARIANTS

For both operations:

- preserve runtime ID, package ID/version, ship UUID, phase, round index, station data, Focus, order, choices, results, effects, Pressure, Hazards, flags, histories, vignettes, score, staged aftermath, audit history, and creation metadata;
- allow pause/resume at any currently active V3-007 phase; phase-specific pause restrictions are not accepted alpha rules;
- perform no write for missing-active, already-paused, not-paused, unauthorized, invalid-option, or stale-revision failures;
- perform exactly one persistence-layer Actor update on success;
- do not add audit entries merely for normal pause/resume; persistence update metadata is sufficient;
- never mutate the object returned by the read helper or Actor source data.

## DOCUMENTATION

Update lifecycle-manager documentation with:

- exact APIs and options;
- precondition errors;
- state preservation guarantees;
- revision behavior;
- authority delegation;
- exact manual Foundry console inspection steps.

## MANUAL FOUNDRY INSPECTION TO DOCUMENT — DO NOT RUN IN CODEX

The steps must verify:

1. Missing active runtime rejects pause and resume without a write.
2. A revision-1 active runtime pauses successfully and becomes revision 2.
3. Pause preserves every field except paused/update metadata/revision.
4. Pausing again rejects with `ALREADY_PAUSED` and leaves complete stored data unchanged.
5. Resume with revision 2 succeeds and becomes revision 3.
6. Resume preserves every field except paused/update metadata/revision.
7. Resuming again rejects with `NOT_PAUSED` and leaves data unchanged.
8. A stale expected revision rejects both operations without a write.
9. A non-GM call is rejected by persistence without a write.
10. Sibling Arcflight flags remain unchanged.

## OUT OF SCOPE

- no phase advancement or transition policy change;
- no round reset;
- no GM override or audit entry;
- no archive, clear, or abort operation;
- no station choices, order, rolls, scoring, bids, rewards, dangers, effects, Pressure, Hazards, narrative, sockets, player requests, UI, hooks, registration, catalogs, or content;
- no automated tests, Foundry run, branch operation, or pull request.

## ACCEPTANCE CRITERIA

1. Pause and resume require an active runtime.
2. Redundant toggles fail without writes.
3. Exact expected revision and GM authority remain enforced by persistence.
4. Success performs one Actor update and increments revision once.
5. Only paused/update metadata/revision change.
6. Inputs and stored source objects are not mutated.
7. Existing start behavior remains unchanged.
8. No other lifecycle or gameplay behavior is added.
9. Documentation includes exact manual checks.
10. `git diff --check` passes.

## FINAL RESPONSE

Return:

- concise summary;
- complete changed-file list;
- exact exports;
- pause/resume preservation behavior;
- authority and revision behavior;
- errors;
- assumptions;
- exact manual Foundry inspection steps;
- known limitations;
- `git diff --check` result;
- confirmation that no phase advance, round reset, override, archive, gameplay mechanics, UI, sockets, tests, branch operations, or pull request were added.
