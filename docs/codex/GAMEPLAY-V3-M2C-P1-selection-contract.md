# Gameplay V3 Milestone 2C — Pass 1: Selection Contract

**Parent task:** `GAMEPLAY-V3-M2C`
**Pass:** 1 of 4
**Working branch:** `codex/gameplay-v3-2c-approach-selection`
**Expected starting commit:** `57c313a31018b4a1b871e8ba413b2f4e463b1db8`

## Objective

Extend the persisted Crew Planning station-selection contract so it can safely represent either:

- an action-only intermediate selection; or
- an action with one committed authored approach.

This pass establishes validation only. It does not add the public approach select, change, or clear mutations.

## Read first

- `AGENTS.md`
- `docs/codex/GAMEPLAY-V3-M2C-approach-selection-editing.md`
- `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`
- `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`
- `scripts/voyage/domain/station-selection.js`
- `scripts/voyage/domain/round-action-authoring.js`
- `tests/voyage/domain/station-selection.test.mjs`
- `tests/voyage/domain/round-action-authoring.test.mjs`

The master specification controls this pass.

## In scope

Modify the existing station-selection validator to accept and validate these exact persisted forms.

### Action-only intermediate selection

`{ stationId, actionId }`

This record is structurally valid but does not represent a complete Crew Plan.

### Statistic or ability approach

`{ stationId, actionId, approachId, statisticSlugOrAbilityId }`

### Explicit no-roll approach

`{ stationId, actionId, approachId, noRoll: true }`

Do not create a separate approach-selection map or collection.

## Authored lookup

For every stored selection:

1. resolve exactly one available station using `selection.stationId`;
2. confirm the station is occupied;
3. resolve exactly one action using `selection.actionId`;
4. when approach data is present, inspect that action's own `approaches` array;
5. resolve exactly one authored approach using `selection.approachId`;
6. validate that the persisted execution identity exactly matches that authored approach.

Do not select the first result when authored records are ambiguous.

## Action-only validation

An action-only selection remains valid when it has own valid:

- `stationId`;
- `actionId`.

It must not own any of:

- `approachId`;
- `statisticSlugOrAbilityId`;
- `noRoll`.

An inherited approach-related property does not convert an action-only selection into a committed approach.

## Committed approach detection

Treat a record as attempting to commit an approach when it owns any of:

- `approachId`;
- `statisticSlugOrAbilityId`;
- `noRoll`.

Once any of these fields is present, require the complete appropriate committed shape.

This prevents partially authored or partially persisted approach records from being accepted as action-only selections.

## Approach ID requirements

A committed approach requires an own `approachId` that is:

- a string;
- non-empty without repair;
- safe for use as an identifier;
- an exact match for one authored approach on the selected action.

Reject:

- missing approach ID;
- blank approach ID;
- unsafe approach ID;
- approach from another action;
- missing authored approach;
- duplicate authored approach matches;
- inherited-only approach ID.

Do not trim or normalize the ID.

## Statistic or ability identity

For an authored statistic-or-ability approach, the persisted selection must own:

`statisticSlugOrAbilityId`

The value must:

- be a non-empty exact string;
- be safe;
- exactly equal the authored approach's value.

The selection must not own `noRoll`.

Reject:

- missing statistic or ability ID;
- blank or unsafe ID;
- mismatched ID;
- inherited-only identity;
- simultaneous `noRoll`.

## No-roll identity

For an authored no-roll approach, the persisted selection must own:

`noRoll: true`

The selection must not own `statisticSlugOrAbilityId`.

Reject:

- missing `noRoll`;
- `noRoll: false`;
- any non-true value;
- inherited-only `noRoll`;
- simultaneous statistic or ability ID.

## Authored execution identity safety

The validator must reject authored approach records that are unusable at the Event Session boundary, including:

- neither execution identity;
- both execution identities;
- blank or unsafe statistic or ability ID;
- `noRoll` other than exactly `true`;
- malformed approach record;
- sparse approach collection;
- inherited numeric approach entry;
- unreadable approach data;
- duplicate exact approach IDs.

Do not silently reinterpret malformed authored data.

## Persisted field discipline

Do not add new required top-level state fields.

Do not mutate, trim, repair, normalize, or replace persisted selection values.

Avoid accepting unrelated caller-controlled execution fields.

A narrow exact-field check may be added when consistent with existing state compatibility, but do not introduce a broad state migration or reject unrelated previously accepted metadata without reviewed evidence.

## Safety

Follow existing Voyage-domain requirements:

- own properties only;
- safe descriptor reads where hostile data may occur;
- sparse and inherited array entries do not count;
- unsafe identifiers rejected;
- deterministic source-order issues;
- precise paths;
- no input mutation;
- no JSON cloning;
- no Foundry or PF2e globals;
- atomic validation;
- structured failure rather than thrown hostile-read exceptions.

If helper extraction is needed, keep it narrow and local unless genuine reuse justifies a separate module.

## Likely changed files

Expected:

- `scripts/voyage/domain/station-selection.js`
- `tests/voyage/domain/station-selection.test.mjs`

Possible only if required to avoid a contradictory duplicate contract:

- one small shared pure-domain helper module;
- focused fixtures used solely by Voyage-domain tests.

Do not add `approach-selection.js` in this pass.

## Required tests

Add focused tests covering at least:

1. existing action-only selection remains valid;
2. valid statistic approach record;
3. valid no-roll approach record;
4. approach ID without execution identity;
5. execution identity without approach ID;
6. both persisted execution identities;
7. blank and unsafe approach IDs;
8. approach belonging to another action;
9. missing authored approach;
10. duplicate authored approach matches;
11. matching and mismatching statistic or ability IDs;
12. blank and unsafe persisted statistic IDs;
13. `noRoll: true`;
14. `noRoll: false`;
15. statistic field on no-roll approach;
16. no-roll field on statistic approach;
17. inherited approach ID does not satisfy the contract;
18. inherited execution identity does not satisfy the contract;
19. sparse and inherited authored approach entries;
20. malformed authored approach object;
21. malformed authored execution identity;
22. hostile authored approach read;
23. exact issue paths and deterministic ordering;
24. source-state non-mutation;
25. Foundry-free import;
26. existing station-selection mutation regressions remain green.

## Issue paths

Prefer precise paths such as:

- `selections.engineer.approachId`
- `selections.engineer.statisticSlugOrAbilityId`
- `selections.engineer.noRoll`
- `availableStations[0].actions[1].approaches[2]`
- `availableStations[0].actions[1].approaches[2].approachId`

Do not collapse all errors to the station-selection root when a precise child path is available.

## Verification

Run:

- `node --check scripts/voyage/domain/station-selection.js`
- `node --check tests/voyage/domain/station-selection.test.mjs`
- `node --test tests/voyage/domain/station-selection.test.mjs`
- `git diff --check`
- `git status --short`
- `git diff --stat`
- `git diff`
- `git ls-files --others --exclude-standard`

Do not claim full Voyage or PF2e regression until Pass 4 unless a change in this pass requires those suites for diagnosis.

## Stop condition

Stop after:

- the persisted selection validator supports all three canonical selection shapes;
- focused station-selection tests pass;
- existing action-selection behavior remains unchanged;
- the diff contains no approach mutation operations;
- the diff contains no completeness or readiness changes.

Return the exact focused test total and the complete changed-file list for review.

Do not begin Pass 2.

Do not commit, push, merge, rebase, reset, delete branches, or open a pull request.
