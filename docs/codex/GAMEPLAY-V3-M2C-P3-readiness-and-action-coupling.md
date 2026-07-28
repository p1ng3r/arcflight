# Gameplay V3 Milestone 2C — Pass 3: Action Coupling, Completeness, and Readiness

**Parent task:** `GAMEPLAY-V3-M2C`
**Pass:** 3 of 4
**Working branch:** `codex/gameplay-v3-2c-approach-selection`
**Expected starting commit:** `57c313a31018b4a1b871e8ba413b2f4e463b1db8`

## Objective

Integrate committed approaches with existing action-selection mutations and Crew Planning lock readiness.

This pass:

- clears committed approaches when actions change;
- removes committed approaches when actions clear;
- preserves existing legacy Risk Bid clearing behavior;
- extends completeness and readiness reporting;
- requires one valid action and one valid committed approach for every occupied station.

This pass does not implement station order, canonical Risk Bids, execution-request alignment, pending checks, or PF2e adapter changes.

## Read first

- `AGENTS.md`
- `docs/codex/GAMEPLAY-V3-M2C-approach-selection-editing.md`
- `docs/codex/GAMEPLAY-V3-M2C-P1-selection-contract.md`
- `docs/codex/GAMEPLAY-V3-M2C-P2-approach-mutations.md`
- `scripts/voyage/domain/station-selection.js`
- `scripts/voyage/domain/crew-planning-completeness.js`
- `scripts/voyage/domain/crew-planning-readiness.js`
- `scripts/voyage/domain/risk-bids.js`
- Crew Planning lock and phase-transition tests
- existing action-selection and readiness tests

The master specification controls this pass.

## In scope

Modify:

- `scripts/voyage/domain/station-selection.js`
- `scripts/voyage/domain/crew-planning-completeness.js`
- `scripts/voyage/domain/crew-planning-readiness.js`

Update focused tests for:

- station action-selection mutation coupling;
- Crew Planning completeness;
- Crew Planning readiness;
- any direct lock integration affected by readiness.

Do not change the approach mutation request or event contract established in Pass 2 except to fix a direct integration defect discovered by focused regression.

## Action change coupling

Existing operation:

`applyVoyageEncounterStationActionSelectionChange`

When changing a station's selected action, replace the selection with exactly:

`{ stationId, actionId }`

This means:

- any committed `approachId` is cleared;
- any persisted `statisticSlugOrAbilityId` is cleared;
- any persisted `noRoll` is cleared;
- the new action does not inherit or auto-select an approach;
- existing legacy Risk Bid clearing remains unchanged.

The action-change operation must continue to:

- require Active lifecycle;
- require Crew Planning phase;
- require an occupied station;
- resolve exactly one available action;
- increment revision exactly once;
- emit exactly one event;
- remain atomic.

## Action-change event

Preserve event type:

`voyage.station-action-selection-changed`

Preserve existing accepted fields.

When the prior selection owned a valid committed approach, add:

`clearedApproachId`

Do not add `clearedApproachId` when no committed approach existed.

The event may include the cleared execution identity only if the implementation already has an established isolated audit pattern and the added data is deterministic. It is not required for acceptance.

Continue reporting `clearedRiskBidId` when a legacy Risk Bid was removed.

The event must never report an inherited or malformed approach as successfully cleared.

## Action clear coupling

Existing operation:

`applyVoyageEncounterStationActionSelectionClear`

Clearing the action deletes the complete station selection record.

This removes:

- `stationId`;
- `actionId`;
- `approachId`;
- persisted execution identity.

Continue clearing the station's legacy Risk Bid.

The operation must remain atomic and increment revision exactly once.

## Action-clear event

Preserve event type:

`voyage.station-action-selection-cleared`

Preserve existing accepted fields.

When the prior selection owned a valid committed approach, add:

`clearedApproachId`

Continue reporting `clearedRiskBidId` when present.

Do not report approach-clearing metadata for action-only selections.

## Initial action selection

Existing operation:

`applyVoyageEncounterStationActionSelection`

Continue creating exactly:

`{ stationId, actionId }`

Do not auto-select an approach.

This rule applies even when:

- the action authors exactly one approach;
- the approach's statistic matches an operator's obvious best statistic;
- the action is no-roll;
- a previous round used an approach with the same ID.

No implicit approach inheritance or fallback is allowed.

## Legacy Risk Bid behavior

Preserve existing Milestone 2A behavior:

- action change clears the station's current Risk Bid;
- action clear clears the station's current Risk Bid.

Approach selection operations from Pass 2 continue leaving Risk Bids unchanged.

Do not redesign the Risk Bid schema or add canonical tier logic.

## Completeness report

Existing export:

`prepareVoyageEncounterCrewPlanningCompleteness`

Preserve these fields:

- `occupiedStationIds`;
- `selectedStationIds`;
- `missingOccupiedStationIds`;
- `errors`;
- `warnings`.

Add:

- `approachSelectedStationIds`;
- `missingApproachStationIds`.

## Completeness definitions

### `occupiedStationIds`

The deterministic occupied-station list derived from accepted station assignments.

### `selectedStationIds`

Occupied stations with exactly one valid selected action.

A valid action-only selection belongs in this list.

### `missingOccupiedStationIds`

Occupied stations without one valid selected action.

### `approachSelectedStationIds`

Occupied stations whose persisted selection has:

- one valid selected action;
- one valid committed approach;
- an execution identity exactly matching the authored approach.

### `missingApproachStationIds`

Occupied stations that have a valid selected action but do not have a valid committed approach.

Do not include stations missing an action in `missingApproachStationIds`; they are already represented by `missingOccupiedStationIds`.

This keeps action and approach deficiencies separately observable.

## Completeness result rules

`complete` is true only when:

- there are no errors;
- every occupied station appears in `selectedStationIds`;
- every occupied station appears in `approachSelectedStationIds`;
- both missing arrays are empty.

An action-only selection is valid but incomplete.

An occupied station with malformed committed approach data must not be reported as approach-selected.

If persisted selection validation fails, return a safely incomplete report and do not claim trusted approach completion from invalid records.

## Zero occupied stations

When there are zero occupied stations and no structural errors:

- `occupiedStationIds: []`;
- `selectedStationIds: []`;
- `missingOccupiedStationIds: []`;
- `approachSelectedStationIds: []`;
- `missingApproachStationIds: []`;
- `complete: true`.

Do not invent a minimum occupied-station requirement.

## Unoccupied stations

Unoccupied stations require:

- no action;
- no approach.

A valid state must not count unoccupied station selections toward readiness.

Existing station-selection validation should continue rejecting persisted selections for unoccupied stations.

## Ordering and isolation

All reported station ID arrays must be:

- fresh arrays;
- deterministic;
- derived in occupied-station order;
- free of duplicates;
- exact strings without normalization.

Mutating a returned report must not mutate encounter state or another report.

## Readiness report

Existing export:

`prepareVoyageEncounterCrewPlanningReadiness`

Preserve:

- `structurallyValid`;
- `active`;
- `crewPlanning`;
- `occupiedStationIds`;
- `selectedStationIds`;
- `missingOccupiedStationIds`;
- `complete`;
- `readyToLock`;
- `errors`;
- `warnings`.

Add:

- `approachSelectedStationIds`;
- `missingApproachStationIds`.

Copy report arrays into fresh arrays.

## Readiness gate

`readyToLock` is true only when:

- encounter state is structurally valid;
- lifecycle is Active;
- phase is Crew Planning;
- current stage ID is valid;
- persisted station selections are valid;
- legacy Risk Bids are valid;
- completeness has no errors;
- every occupied station has a valid action;
- every occupied station has a valid committed approach.

Missing approaches must prevent lock readiness.

Do not change Lock Readiness snapshots, phase transitions, or revision behavior in this pass.

## Error and warning handling

Preserve deterministic deduplication.

Do not emit a second generic readiness error when a precise completeness or selection-validation issue already identifies the failure unless an existing accepted convention requires the summary issue.

Precise paths should remain available for malformed approach records.

Missing but otherwise structurally valid approaches should normally be represented by `missingApproachStationIds`, not fabricated structural-validation errors.

## Safety

Follow existing Voyage-domain requirements:

- own properties only;
- exact identifiers;
- safe hostile-data handling;
- sparse and inherited entries do not count;
- no source mutation;
- no JSON cloning;
- isolated reports and events;
- deterministic issue ordering;
- atomic mutations;
- no Foundry or PF2e globals.

## Likely changed files

Expected:

- `scripts/voyage/domain/station-selection.js`
- `scripts/voyage/domain/crew-planning-completeness.js`
- `scripts/voyage/domain/crew-planning-readiness.js`
- `tests/voyage/domain/station-selection.test.mjs`
- `tests/voyage/domain/crew-planning-completeness.test.mjs`
- `tests/voyage/domain/crew-planning-readiness.test.mjs`

Possible only if readiness directly gates a focused lock test:

- relevant Crew Planning lock test file;
- relevant phase-transition test file.

Avoid unrelated modules.

## Required action-coupling tests

At minimum cover:

1. action change from action-only selection;
2. action change clears statistic approach;
3. action change clears no-roll approach;
4. action change emits `clearedApproachId`;
5. action change omits `clearedApproachId` for action-only record;
6. action change continues clearing Risk Bid;
7. action change can clear approach and Risk Bid atomically;
8. new action remains action-only;
9. matching approach ID on new action is not inherited;
10. initial action selection does not auto-select sole approach;
11. action clear removes statistic approach;
12. action clear removes no-roll approach;
13. action clear emits `clearedApproachId`;
14. action clear continues clearing Risk Bid;
15. failed action mutations leave action, approach, bid, and revision unchanged;
16. unrelated station selections remain unchanged;
17. event output is isolated.

## Required completeness tests

At minimum cover:

1. one occupied station with action only;
2. one occupied station with statistic approach;
3. one occupied station with no-roll approach;
4. missing action;
5. missing approach after valid action;
6. separate action and approach missing arrays;
7. multiple occupied stations with mixed completion;
8. every occupied station fully complete;
9. malformed committed approach;
10. unoccupied stations skipped;
11. zero occupied stations complete;
12. deterministic occupied-station ordering;
13. fresh isolated arrays;
14. source non-mutation;
15. exact complete flag behavior.

## Required readiness tests

At minimum cover:

1. action-only plan not ready;
2. missing approach IDs surfaced;
3. statistic approach plan ready;
4. no-roll approach plan ready;
5. mixed occupied-station plan not ready;
6. every occupied station fully planned is ready;
7. invalid stage still blocks readiness;
8. wrong lifecycle still blocks readiness;
9. wrong phase still blocks readiness;
10. invalid Risk Bid state still blocks readiness;
11. malformed committed selection still blocks readiness;
12. zero occupied stations remains ready when all other gates pass;
13. readiness arrays are isolated;
14. deterministic issue deduplication.

## Verification

Run:

- `node --check scripts/voyage/domain/station-selection.js`
- `node --check scripts/voyage/domain/crew-planning-completeness.js`
- `node --check scripts/voyage/domain/crew-planning-readiness.js`
- `node --check tests/voyage/domain/station-selection.test.mjs`
- `node --check tests/voyage/domain/crew-planning-completeness.test.mjs`
- `node --check tests/voyage/domain/crew-planning-readiness.test.mjs`
- `node --test tests/voyage/domain/station-selection.test.mjs`
- `node --test tests/voyage/domain/crew-planning-completeness.test.mjs`
- `node --test tests/voyage/domain/crew-planning-readiness.test.mjs`
- focused lock tests if changed;
- `git diff --check`
- `git status --short`
- `git diff --stat`
- `git diff`
- `git ls-files --others --exclude-standard`

Report exact focused test totals.

## Stop condition

Stop after:

- action change clears committed approach and legacy Risk Bid;
- action clear removes committed approach and legacy Risk Bid;
- initial action select remains action-only;
- completeness separately reports action and approach state;
- readiness requires action and approach for every occupied station;
- unoccupied stations remain skipped;
- focused tests pass;
- no station-order or execution behavior is added.

Return:

- complete changed-file list;
- final completeness and readiness shapes;
- exact focused test totals;
- any direct integration assumptions.

Do not begin Pass 4.

Do not commit, push, merge, rebase, reset, delete branches, or open a pull request.
