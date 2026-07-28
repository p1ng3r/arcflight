# Gameplay V3 Milestone 2C — Pass 2: Approach Mutations

**Parent task:** `GAMEPLAY-V3-M2C`
**Pass:** 2 of 4
**Working branch:** `codex/gameplay-v3-2c-approach-selection`
**Expected starting commit:** `57c313a31018b4a1b871e8ba413b2f4e463b1db8`

## Objective

Implement the pure-domain operations for selecting, changing, and clearing one committed authored approach for an occupied station's currently selected action.

This pass assumes Pass 1 has established the persisted selection contract. It does not change Crew Planning completeness, readiness, or action-selection coupling.

## Read first

- `AGENTS.md`
- `docs/codex/GAMEPLAY-V3-M2C-approach-selection-editing.md`
- `docs/codex/GAMEPLAY-V3-M2C-P1-selection-contract.md`
- `scripts/voyage/domain/station-selection.js`
- `scripts/voyage/domain/round-action-authoring.js`
- existing action-selection mutation tests
- existing Risk Bid validation tests

The master specification controls this pass.

## In scope

Create:

`scripts/voyage/domain/approach-selection.js`

Export:

- `applyVoyageEncounterStationApproachSelection`
- `applyVoyageEncounterStationApproachSelectionChange`
- `applyVoyageEncounterStationApproachSelectionClear`

Add focused tests:

`tests/voyage/domain/approach-selection.test.mjs`

Do not modify completeness or readiness in this pass.

## Shared mutation gates

Every operation requires:

- a plain encounter state;
- structurally valid current persisted selections;
- structurally valid current legacy Risk Bids;
- Active lifecycle;
- Crew Planning phase;
- exact safe station ID;
- occupied station;
- exactly one matching available station;
- exactly one current selected action for that station.

All failures are atomic:

- `ok: false`;
- `nextState: null`;
- no events;
- no revision increment;
- no source mutation.

## Request shapes

### Initial select

`{ stationId, approachId }`

### Change

`{ stationId, approachId }`

### Clear

`{ stationId }`

Requests must be plain objects with own fields.

The caller does not supply:

- action ID;
- statistic or ability ID;
- no-roll flag;
- execution mode;
- Risk Bid ID;
- final DC.

Ignore no caller-supplied execution authority. Prefer rejecting unexpected execution fields if doing so matches existing strict request conventions without breaking accepted compatibility.

## Current action lookup

Resolve the action from the persisted station selection:

1. find `encounterState.selections[stationId]`;
2. require a valid action selection;
3. read its exact `actionId`;
4. resolve exactly one action within the exact matching available station;
5. inspect only that action's own approaches.

Do not accept `actionId` from the request.

## Approach lookup

The requested `approachId` must:

- be an own non-empty exact string;
- be safe;
- match exactly one authored approach on the current selected action.

Reject:

- missing or blank approach ID;
- unsafe approach ID;
- approach from another action;
- no match;
- duplicate matches;
- malformed authored approach;
- sparse or inherited approach entry;
- unreadable authored approach;
- invalid authored execution identity.

Do not choose the first ambiguous match.

## Execution identity copying

### Statistic or ability approach

Persist:

`{ stationId, actionId, approachId, statisticSlugOrAbilityId }`

Copy `statisticSlugOrAbilityId` exactly from authored data.

### No-roll approach

Persist:

`{ stationId, actionId, approachId, noRoll: true }`

Copy `noRoll: true` from authored data.

Never persist both execution identities.

Never trust or copy caller-provided execution identity fields.

## Initial selection operation

`applyVoyageEncounterStationApproachSelection`

Requires:

- valid action-only station selection;
- no currently committed approach;
- valid requested authored approach.

Reject when:

- no action is selected;
- the current record is malformed;
- an approach is already committed;
- the requested approach is invalid.

On success:

- replace only that station's selection with the committed form;
- preserve all unrelated stations;
- preserve Risk Bids unchanged;
- increment revision exactly once;
- validate the candidate;
- emit exactly one event.

Event type:

`voyage.station-approach-selected`

Event fields:

- `encounterId`;
- Active lifecycle;
- current round number;
- Crew Planning phase;
- `stationId`;
- current `actionId`;
- `approachId`;
- exactly one execution identity;
- `previousRevision`;
- `revision`.

## Change operation

`applyVoyageEncounterStationApproachSelectionChange`

Requires:

- valid action-plus-approach station selection;
- requested approach on the same current action;
- requested approach differs from current `approachId`.

Reject when:

- no action exists;
- no approach is committed;
- requested approach is unchanged;
- requested approach is invalid.

On success:

- keep the same action;
- replace the approach and execution identity;
- preserve Risk Bids unchanged;
- preserve unrelated stations;
- increment revision exactly once;
- validate the candidate;
- emit exactly one event.

Event type:

`voyage.station-approach-selection-changed`

Event fields:

- `encounterId`;
- lifecycle;
- round number;
- phase;
- `stationId`;
- `actionId`;
- `previousApproachId`;
- new `approachId`;
- exactly one new execution identity;
- `previousRevision`;
- `revision`.

The event may include the prior execution identity only when represented as isolated plain data and useful for deterministic auditing. Do not expose live runtime objects.

## Clear operation

`applyVoyageEncounterStationApproachSelectionClear`

Requires:

- valid action-plus-approach station selection.

Reject when:

- no action exists;
- no approach is committed;
- station is unavailable or unoccupied;
- request is malformed.

On success, replace the committed record with:

`{ stationId, actionId }`

Do not clear the action.

Do not clear or alter the Risk Bid.

Increment revision exactly once and emit exactly one event.

Event type:

`voyage.station-approach-selection-cleared`

Event fields:

- `encounterId`;
- lifecycle;
- round number;
- phase;
- `stationId`;
- `actionId`;
- cleared `approachId`;
- cleared execution identity;
- `previousRevision`;
- `revision`.

## Candidate validation

After mutation, validate:

- persisted station selections;
- current legacy Risk Bids;
- complete encounter structural state when required by existing conventions.

Candidate validation must not make action-only records invalid after an approach clear.

Warnings must be isolated and deterministically deduplicated.

## Isolation

Successful output must not alias:

- source encounter state;
- source selection records;
- authored station records;
- authored action records;
- authored approach records;
- request objects;
- emitted event objects.

Mutating the result must not mutate the source.

## Hostile-data safety

Cover:

- getters that throw;
- proxy or descriptor reads that fail;
- unsafe map keys;
- sparse approach arrays;
- inherited numeric entries;
- duplicate authored IDs;
- non-plain requests;
- malformed persisted selection records;
- malformed authored execution identity.

Convert failures into structured issues instead of uncaught exceptions.

## Likely changed files

Expected:

- `scripts/voyage/domain/approach-selection.js`
- `tests/voyage/domain/approach-selection.test.mjs`

Possible only when direct reuse is necessary:

- narrow helpers in `scripts/voyage/domain/station-selection.js`;
- one small shared pure-domain approach lookup helper;
- focused test fixtures.

Do not modify Crew Planning completeness or readiness.

Do not change action-selection behavior in this pass.

## Required tests

At minimum cover:

1. statistic approach initial selection;
2. no-roll initial selection;
3. change statistic to statistic;
4. change statistic to no-roll;
5. change no-roll to statistic;
6. clear statistic approach;
7. clear no-roll approach;
8. clear leaves action-only record;
9. missing action selection;
10. approach already selected;
11. change without committed approach;
12. clear without committed approach;
13. unchanged approach request;
14. unavailable station;
15. unoccupied station;
16. blank and unsafe station IDs;
17. blank and unsafe approach IDs;
18. approach from another action;
19. missing approach;
20. duplicate approach IDs;
21. malformed authored approach;
22. malformed authored execution identity;
23. caller execution fields cannot override authored identity;
24. caller action ID cannot redirect lookup;
25. Risk Bid unchanged on select;
26. Risk Bid unchanged on change;
27. Risk Bid unchanged on clear;
28. unrelated station selections unchanged;
29. exact event types and fields;
30. exactly one revision increment;
31. deterministic issue paths;
32. atomic failure;
33. source non-mutation;
34. output isolation;
35. hostile reads become structured errors;
36. Foundry-free import.

## Verification

Run:

- `node --check scripts/voyage/domain/approach-selection.js`
- `node --check tests/voyage/domain/approach-selection.test.mjs`
- `node --test tests/voyage/domain/approach-selection.test.mjs`
- focused station-selection tests if shared helpers changed;
- `git diff --check`
- `git status --short`
- `git diff --stat`
- `git diff`
- `git ls-files --others --exclude-standard`

Report the exact focused test total.

## Stop condition

Stop after:

- all three approach mutation exports exist;
- each request chooses only station and approach IDs;
- execution identity is copied exactly from authored data;
- select, change, and clear are atomic;
- approach edits preserve Risk Bids;
- focused tests pass;
- no action-coupling changes exist;
- no completeness or readiness changes exist.

Return the complete changed-file list and exact focused test total.

Do not begin Pass 3.

Do not commit, push, merge, rebase, reset, delete branches, or open a pull request.
