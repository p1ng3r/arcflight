# V3-007A — Add Pure Voyage Event Lifecycle Policy

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Starting branch:** latest `rebuild/arcflight-voyage-events-alpha`

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-007A-lifecycle-policy.md.`

---

TASK ID: V3-007A  
TITLE: Add pure Voyage Event transition policy and lifecycle error contract

## READ FIRST

- `AGENTS.md`
- `docs/codex/V3-007-voyage-event-lifecycle-manager.md`
- `docs/voyage-event-v3-decisions.md`
- `docs/voyage-event-data-contracts.md`
- `docs/voyage-event-validation.md`
- `docs/voyage-event-persistence.md`
- `scripts/voyage-events/constants.js`
- `scripts/voyage-events/defaults.js`
- `scripts/voyage-events/contracts.js`
- `scripts/voyage-events/validation.js`
- `scripts/voyage-events/persistence.js`

## GOAL

Create the pure, immutable lifecycle policy that later state-manager slices will consume. This slice defines legal phase edges, distinguishes the special new-round boundary, and establishes stable state-manager error codes. It performs no Foundry Document reads or writes.

## REQUIRED DELIVERABLES

Expected files:

- `scripts/voyage-events/lifecycle-policy.js`
- `docs/voyage-event-lifecycle-policy.md`

Do not create `lifecycle-manager.js` yet.

## PHASE POLICY

Use only the accepted values from `VOYAGE_EVENT_PHASES`.

Normal forward edges are exactly:

1. `setup -> opening`
2. `opening -> roundOpening`
3. `roundOpening -> crewPlanning`
4. `crewPlanning -> orderLock`
5. `orderLock -> stationResolution`
6. `stationResolution -> roundResolution`
7. `roundResolution -> endRoundVignette`
8. `endRoundVignette -> nextRoundPreparation`
9. `nextRoundPreparation -> eventResolution`
10. `eventResolution -> aftermathReview`

The one special round-boundary edge is:

- `nextRoundPreparation -> roundOpening`

The special edge is legal only through the later round-boundary helper because it must increment the round and reset round-scoped state. Pure policy should classify it as `roundBoundary`, not as an ordinary transition.

`aftermathReview -> archive` is intentionally not available in V3-007. A later atomic archive workflow will move the runtime into the container archive and clear `active`; V3-007 must not leave an archived runtime active.

No backward, skipping, self, unknown, or other edges are legal through normal advancement.

## REQUIRED PUBLIC API

Export stable equivalents of:

```js
VOYAGE_EVENT_LIFECYCLE_TRANSITION_KINDS
VOYAGE_EVENT_NORMAL_PHASE_TRANSITIONS
VOYAGE_EVENT_ROUND_BOUNDARY_TRANSITION
VOYAGE_EVENT_LIFECYCLE_ERROR_CODES
isVoyageEventPhase(value)
getVoyageEventTransitionKind(currentPhase, nextPhase)
canAdvanceVoyageEventPhase(currentPhase, nextPhase, options)
getAllowedVoyageEventNextPhases(currentPhase, options)
```

Requirements:

- all exported registries are frozen;
- returned arrays/objects do not expose mutable registry references;
- unknown phase values return safe `false`, `invalid`, or empty results rather than throwing;
- `getVoyageEventTransitionKind` returns only `normal`, `roundBoundary`, or `invalid`;
- `canAdvanceVoyageEventPhase(..., { allowRoundBoundary: false })` accepts only normal edges;
- `allowRoundBoundary: true` also accepts the one special edge;
- options must not permit arbitrary overrides or bypasses;
- functions are deterministic and have no dependency on `game`, `foundry`, Actors, users, clocks, sockets, or persistence.

## ERROR CONTRACT

Create one frozen `VOYAGE_EVENT_LIFECYCLE_ERROR_CODES` registry for all V3-007 slices. Include stable string values equivalent to:

- `ACTIVE_REQUIRED`: `voyage.lifecycle.active.required`
- `ACTIVE_EXISTS`: `voyage.lifecycle.active.exists`
- `PACKAGE_INVALID`: `voyage.lifecycle.package.invalid`
- `RUNTIME_ID_REQUIRED`: `voyage.lifecycle.runtimeId.required`
- `PAUSED`: `voyage.lifecycle.paused`
- `ALREADY_PAUSED`: `voyage.lifecycle.pause.already`
- `NOT_PAUSED`: `voyage.lifecycle.resume.notPaused`
- `PHASE_INVALID`: `voyage.lifecycle.phase.invalid`
- `TRANSITION_INVALID`: `voyage.lifecycle.transition.invalid`
- `ROUND_BOUNDARY_REQUIRED`: `voyage.lifecycle.transition.roundBoundaryRequired`
- `OVERRIDE_REASON_REQUIRED`: `voyage.lifecycle.override.reason.required`
- `OVERRIDE_CHANGES_REQUIRED`: `voyage.lifecycle.override.changes.required`
- `OVERRIDE_CHANGES_INVALID`: `voyage.lifecycle.override.changes.invalid`

Document that later slices may introduce a small custom error class using these codes, but this pure slice does not need to throw errors.

## DOCUMENTATION

Document:

- the exact normal edge table;
- the special round-boundary edge;
- why archive is deferred;
- all public exports;
- stable error codes reserved for V3-007;
- examples showing normal, round-boundary, and invalid classifications;
- that this module is pure policy only.

## OUT OF SCOPE

- no active-event start;
- no pause or resume;
- no runtime mutation;
- no Actor reads or writes;
- no persistence calls;
- no revision checks beyond documenting later use;
- no GM authority logic;
- no archive or abort operation;
- no station, roll, scoring, effect, Pressure, Hazard, narrative, socket, UI, hook, registration, catalog, or content work;
- no automated tests, Foundry run, branch operation, or pull request.

## ACCEPTANCE CRITERIA

1. Policy uses only accepted phase constants.
2. Exactly ten normal edges are defined.
3. The new-round edge is classified separately.
4. Archive cannot be reached through V3-007 normal policy.
5. Unknown, self, skipped, and backward edges are invalid.
6. Public registries are frozen and callers cannot mutate internal arrays.
7. Stable lifecycle error codes are exported and documented.
8. Module is deterministic and Foundry-independent.
9. No runtime manager or Actor write code is added.
10. `git diff --check` passes.

## FINAL RESPONSE

Return:

- concise summary;
- complete changed-file list;
- exact exports;
- exact edge table;
- error-code list;
- assumptions;
- known limitations;
- `git diff --check` result;
- confirmation that no Foundry access, persistence, runtime mutation, tests, branch operations, or pull request were added.
