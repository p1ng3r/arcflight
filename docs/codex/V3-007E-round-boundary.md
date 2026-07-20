# V3-007E — Add Voyage Event Round-Boundary Advancement

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Starting branch:** latest `rebuild/arcflight-voyage-events-alpha` after V3-007D is merged

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-007E-round-boundary.md.`

---

TASK ID: V3-007E  
TITLE: Add strict new-round advancement and round-scoped reset

## DEPENDENCY

V3-007A through V3-007D must already be reviewed and merged. Extend the existing lifecycle manager and consume the special transition classification from the pure policy.

## READ FIRST

- `AGENTS.md`
- `docs/codex/V3-007-voyage-event-lifecycle-manager.md`
- `docs/codex/V3-007A-lifecycle-policy.md`
- `docs/codex/V3-007B-start-active-event.md`
- `docs/codex/V3-007C-pause-resume.md`
- `docs/codex/V3-007D-phase-advancement.md`
- `docs/voyage-event-v3-decisions.md`
- `docs/voyage-event-data-contracts.md`
- `docs/voyage-event-persistence.md`
- `docs/voyage-event-lifecycle-policy.md`
- `docs/voyage-event-lifecycle-manager.md`
- `scripts/voyage-events/constants.js`
- `scripts/voyage-events/defaults.js`
- `scripts/voyage-events/persistence.js`
- `scripts/voyage-events/lifecycle-policy.js`
- `scripts/voyage-events/lifecycle-manager.js`

## GOAL

Add the one special lifecycle mutation for moving from `nextRoundPreparation` into the next `roundOpening`. It increments the zero-based round index exactly once and resets only accepted round-scoped planning/resolution state.

## REQUIRED PUBLIC API

Add a stable equivalent of:

```js
advanceVoyageEventRound(shipActor, options)
```

Reuse the existing lifecycle error class, policy, and persistence layer.

## OPTIONS

Require `options.expectedRevision`. Pass through supported persistence values:

- `user`;
- `userId`;
- `timestamp`.

Do not accept a caller-supplied next round index, next phase, reset list, force flag, package, or maximum-round override.

## PRECONDITIONS

Before any write:

1. Defensively read the active runtime.
2. Reject missing active state with `ACTIVE_REQUIRED`.
3. Reject a paused runtime with `PAUSED`.
4. Require current phase `nextRoundPreparation`.
5. Confirm policy classifies `nextRoundPreparation -> roundOpening` as `roundBoundary`.
6. Any other current phase rejects with `TRANSITION_INVALID` and safe serializable details.
7. Delegate exact expected-revision, authority, Actor eligibility, cloning, stamping, and the single write to persistence.

## REQUIRED MUTATION

A successful round advancement must:

- set phase to `roundOpening`;
- set `roundIndex` to the normalized current non-negative integer plus exactly `1`;
- replace `stationOrder` with `[]`;
- replace `tentativeChoices` with `{}`;
- replace `lockedChoices` with `{}`;
- replace `completedStationResults` with `{}`;
- for each of the five active station runtime records:
  - preserve `stationKey`;
  - preserve `operatorActorUuid`;
  - preserve remaining station `focus`;
  - set `status` to `unresolved`;
  - set `activatedAt` to `null`;
  - set `resolvedAt` to `null`.

The candidate must be independent plain data and must not mutate the read result or Actor source flags.

## REQUIRED PRESERVATION

Preserve all other state, including:

- runtime/package/ship identity;
- paused state (`false` by precondition);
- incoming effects;
- event-local Pressure;
- Hazards;
- narrative flags;
- round history;
- posted vignettes;
- event score;
- staged aftermath;
- audit history;
- creation metadata.

Do not expire effects, change Pressure/Hazards, append history, score a round, restore Focus, select station order, or inspect package round count. Those rules belong to later gameplay slices.

## REVISION AND WRITE BEHAVIOR

- Use the caller's exact `expectedRevision`.
- Successful advancement performs exactly one persistence-layer Actor update.
- Revision increments exactly once.
- Stale revisions and all precondition failures perform no write.

## DOCUMENTATION

Update lifecycle-manager documentation with:

- exact API and options;
- zero-based round-index behavior;
- exact reset and preservation lists;
- phase and pause preconditions;
- revision and one-write behavior;
- exact manual Foundry console inspection steps.

## MANUAL FOUNDRY INSPECTION TO DOCUMENT — DO NOT RUN IN CODEX

Document checks that:

1. Missing active runtime rejects without a write.
2. A runtime in the wrong phase rejects without a write.
3. A paused runtime rejects without a write.
4. Seed a runtime at `nextRoundPreparation` with non-empty order/choices/results, station timestamps/statuses, non-default Focus, effects, Pressure, Hazards, flags, histories, score, aftermath, and audit data.
5. Round advancement sets phase `roundOpening` and increments round index exactly once.
6. Order, tentative choices, locked choices, and completed results reset to empty.
7. All five station statuses/timestamps reset while operator and Focus values remain unchanged.
8. Every required preserved field remains deeply equal.
9. Revision increments once and metadata updates once.
10. A stale retry rejects and complete stored data remains unchanged.
11. A non-GM call is rejected by persistence without a write.
12. Sibling Arcflight flags remain unchanged.

## OUT OF SCOPE

- no maximum-round/package-bound validation;
- no scoring or history generation;
- no effect expiration or application;
- no Focus restoration;
- no normal phase-policy change;
- no GM override or audit entry;
- no archive, clear, or abort operation;
- no station choice/order enforcement, rolls, bids, rewards, dangers, Pressure/Hazard execution, narrative, sockets, player requests, UI, hooks, registration, catalogs, or content;
- no automated tests, Foundry run, branch operation, or pull request.

## ACCEPTANCE CRITERIA

1. Only `nextRoundPreparation -> roundOpening` can use this helper.
2. Paused or missing runtime cannot advance.
3. Round index increments exactly once.
4. Only the specified round-scoped fields reset.
5. Station Focus and operator identity are preserved.
6. All event-scoped data is preserved.
7. Exact revision and GM authority remain enforced.
8. Success performs one Actor update; failures perform none.
9. Existing lifecycle operations remain unchanged.
10. `git diff --check` passes.

## FINAL RESPONSE

Return:

- concise summary;
- complete changed-file list;
- exact export and options;
- reset and preservation lists;
- authority, revision, and one-write behavior;
- errors;
- assumptions;
- exact manual Foundry inspection steps;
- known limitations;
- `git diff --check` result;
- confirmation that no scoring, effects, override, archive, gameplay enforcement, UI, sockets, tests, branch operations, or pull request were added.
