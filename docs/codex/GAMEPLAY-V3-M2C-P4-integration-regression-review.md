# Gameplay V3 Milestone 2C — Pass 4: Integration and Regression Review

**Parent task:** `GAMEPLAY-V3-M2C`
**Pass:** 4 of 4
**Working branch:** `codex/gameplay-v3-2c-approach-selection`
**Expected starting commit:** `57c313a31018b4a1b871e8ba413b2f4e463b1db8`

## Objective

Perform the final Milestone 2C integration review, close focused gaps, run complete Voyage-domain and PF2e regressions, and prove that approach selection and editing are complete without implementing Milestone 2D or later behavior.

This pass is primarily review, repair, and verification.

Do not broaden scope merely because a neighboring module is visible.

## Read first

- `AGENTS.md`
- `docs/codex/GAMEPLAY-V3-M2C-approach-selection-editing.md`
- `docs/codex/GAMEPLAY-V3-M2C-P1-selection-contract.md`
- `docs/codex/GAMEPLAY-V3-M2C-P2-approach-mutations.md`
- `docs/codex/GAMEPLAY-V3-M2C-P3-readiness-and-action-coupling.md`
- all changed implementation and test files
- `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`
- `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`
- `docs/codex/CURRENT-GAMEPLAY-V3.md`

The master specification controls this pass.

## Review goals

Prove that Milestone 2C now provides:

- valid action-only intermediate selections;
- valid statistic or ability approach selections;
- valid explicit no-roll approach selections;
- approach select, change, and clear operations;
- exact authored execution identity copying;
- no caller authority over execution identity;
- action change clearing approach and legacy Risk Bid;
- action clear removing action, approach, and legacy Risk Bid;
- separate action and approach completeness reporting;
- Crew Planning readiness requiring both for every occupied station;
- deterministic atomic behavior;
- no Foundry or PF2e runtime dependency.

## Scope discipline

Milestone 2C ends at Crew Planning lock readiness.

Do not implement:

- player-committed station order;
- proposed or committed order fields;
- changes to resolution ordering;
- Captain or GM order authority;
- canonical Risk Bid tiers;
- `+2`, `+5`, or `+8` DC changes;
- four-degree Risk Bid branches;
- final DC calculation;
- execution-request approach consumption;
- pending-check approach persistence;
- PF2e statistic resolution changes;
- Focus;
- Momentum;
- Pressure;
- Hazards;
- Void Scars;
- rewards or Misfortunes;
- closeout;
- persistent Foundry writes;
- sockets;
- UI.

If a regression reveals that an accepted pre-2C module assumes action-only records, make only the smallest compatibility correction required to allow the new canonical selection shapes.

## Canonical final selection shapes

### Action-only intermediate

`{ stationId, actionId }`

### Statistic or ability committed approach

`{ stationId, actionId, approachId, statisticSlugOrAbilityId }`

### Explicit no-roll committed approach

`{ stationId, actionId, approachId, noRoll: true }`

No other execution shape is canonical for Milestone 2C.

## Final request shapes

### Approach select

`{ stationId, approachId }`

### Approach change

`{ stationId, approachId }`

### Approach clear

`{ stationId }`

The caller does not supply action or execution identity.

## Final exports

Expected new exports:

- `applyVoyageEncounterStationApproachSelection`
- `applyVoyageEncounterStationApproachSelectionChange`
- `applyVoyageEncounterStationApproachSelectionClear`

Verify:

- exact spelling;
- named ESM exports;
- Foundry-free import;
- no accidental public API registration;
- no duplicate competing implementation.

## Final event contracts

Verify these event types:

- `voyage.station-approach-selected`
- `voyage.station-approach-selection-changed`
- `voyage.station-approach-selection-cleared`

Verify existing event types remain stable:

- `voyage.station-action-selected`
- `voyage.station-action-selection-changed`
- `voyage.station-action-selection-cleared`

Action-change and action-clear events may add `clearedApproachId` only when a valid committed approach was actually removed.

Existing `clearedRiskBidId` behavior must remain intact.

## Final completeness shape

Expected report fields:

- `occupiedStationIds`;
- `selectedStationIds`;
- `missingOccupiedStationIds`;
- `approachSelectedStationIds`;
- `missingApproachStationIds`;
- `complete`;
- `errors`;
- `warnings`.

Definitions must remain distinct:

- missing action belongs in `missingOccupiedStationIds`;
- missing approach after a valid action belongs in `missingApproachStationIds`;
- a station missing an action must not also be redundantly listed as missing an approach.

## Final readiness shape

Expected report fields:

- `structurallyValid`;
- `active`;
- `crewPlanning`;
- `occupiedStationIds`;
- `selectedStationIds`;
- `missingOccupiedStationIds`;
- `approachSelectedStationIds`;
- `missingApproachStationIds`;
- `complete`;
- `readyToLock`;
- `errors`;
- `warnings`.

`readyToLock` requires every occupied station to have:

- one valid action;
- one valid committed approach.

Zero occupied stations remain valid and ready when every other readiness gate passes.

## Regression audit areas

Review all direct consumers of `encounterState.selections`.

At minimum inspect:

- station selection validation;
- Risk Bid validation;
- Crew Planning completeness;
- Crew Planning readiness;
- Crew Planning lock transition;
- resolution-order analysis;
- execution-request preparation;
- pending-check preparation;
- snapshots and state cloning;
- tests and fixtures that deep-compare selection records.

Inspection does not authorize implementation of 2D, 2E, or 2F.

## Resolution-order compatibility boundary

Current resolution-order code may read `stationId` and `actionId` from a selection.

It must tolerate additional canonical approach fields without:

- rejecting valid committed selections;
- using approach data as station order;
- changing authored-priority behavior;
- attempting to implement committed player order.

A minimal compatibility fix is allowed if regression proves one is necessary.

Do not otherwise alter resolution ordering.

## Risk Bid compatibility boundary

Legacy Risk Bid validation must continue coupling bids to the selected action.

It must tolerate additional approach fields in the same station selection.

Approach select, change, and clear must not alter Risk Bids.

Action change and clear must retain existing Risk Bid clearing.

Do not redesign the Risk Bid definition or selection contract.

## Execution compatibility boundary

Existing execution code may continue using pre-2F behavior.

Milestone 2C must not claim that committed approaches are consumed by execution.

Valid committed approach fields must not cause unrelated execution preparation or tests to fail merely because selection records gained canonical fields.

When an execution test deep-compares the old action-only record, update the test only when the production contract legitimately preserves the richer selection.

Do not pass the selected approach into PF2e execution in this milestone.

## Snapshot and cloning compatibility

Verify canonical selection records survive:

- plain-data cloning;
- boundary snapshots where selections are included;
- state normalization;
- test fixture cloning;
- serialization-compatible operations.

Do not add live runtime objects.

Ensure no approach field is silently dropped by a manual field whitelist.

## Hostile-data regression

Review hostile-data protections for:

- unsafe station keys;
- unsafe approach IDs;
- unsafe statistic or ability IDs;
- throwing getters;
- proxies;
- sparse authored approach arrays;
- inherited numeric entries;
- duplicate IDs;
- malformed selected records;
- malformed authored execution identity.

No hostile source should escape as an uncaught exception from a public Milestone 2C operation or validator.

## Atomicity regression

For every failed mutation verify:

- source state unchanged;
- revision unchanged;
- `nextState: null`;
- no events;
- unrelated station data unchanged;
- Risk Bids unchanged unless a successful action change or clear explicitly removes one.

For every successful mutation verify:

- exactly one revision increment;
- exactly one event;
- only intended station record changes;
- isolated return data.

## Issue quality review

Verify:

- deterministic issue order;
- no duplicate issue spam;
- precise station, action, and approach paths;
- missing approach represented as planning incompleteness when structurally valid;
- malformed committed approach represented as validation errors;
- no generic error hides the precise upstream cause.

Do not rename accepted preexisting issue codes without a compelling integration need.

## Test review

Ensure tests cover the master specification rather than only happy paths.

At minimum, final coverage must include:

### Persisted selection contract

- action-only;
- statistic approach;
- no-roll approach;
- partial records;
- mismatched authored identity;
- duplicate or hostile authored approaches.

### Approach mutations

- select;
- change;
- clear;
- unchanged request;
- missing action;
- caller override attempts;
- Risk Bid preservation;
- atomic failure.

### Action coupling

- action change clears approach and bid;
- action clear removes approach and bid;
- initial action selection remains action-only.

### Completeness and readiness

- missing action;
- missing approach;
- mixed occupied stations;
- full completion;
- unoccupied stations;
- zero occupied stations;
- isolated arrays.

### Regression

- resolution-order tolerance;
- Risk Bid validation tolerance;
- snapshots or cloning tolerance when directly affected;
- Foundry-free imports;
- combined PF2e suites.

## Allowed repair work

Only make code changes needed to:

- satisfy a missing 2C acceptance criterion;
- fix a direct regression caused by canonical approach fields;
- correct deterministic safety or atomicity defects in 2C code;
- remove duplicate 2C implementations;
- align focused tests with the accepted final contract.

Do not perform unrelated cleanup.

Do not rewrite established modules for style.

## Expected implementation files

Likely final implementation set:

- `scripts/voyage/domain/approach-selection.js`
- `scripts/voyage/domain/station-selection.js`
- `scripts/voyage/domain/crew-planning-completeness.js`
- `scripts/voyage/domain/crew-planning-readiness.js`

Likely final focused test set:

- `tests/voyage/domain/approach-selection.test.mjs`
- `tests/voyage/domain/station-selection.test.mjs`
- `tests/voyage/domain/crew-planning-completeness.test.mjs`
- `tests/voyage/domain/crew-planning-readiness.test.mjs`

Additional files require a direct regression explanation.

## Syntax verification

Run `node --check` on every changed JavaScript and MJS file.

Do not omit tests from syntax checking merely because Node's test runner can parse them.

Report the exact list of files checked.

## Focused tests

Run all focused Milestone 2C tests individually.

At minimum:

- `node --test tests/voyage/domain/approach-selection.test.mjs`
- `node --test tests/voyage/domain/station-selection.test.mjs`
- `node --test tests/voyage/domain/crew-planning-completeness.test.mjs`
- `node --test tests/voyage/domain/crew-planning-readiness.test.mjs`

Run any additional directly changed test file individually.

Report exact test, pass, fail, skipped, and duration totals as printed by Node.

## Full regression suites

Run:

- `node --test tests/voyage/domain/*.test.mjs`
- `node --test tests/voyage/domain/*.test.mjs tests/voyage/pf2e/*.test.mjs`

If shell expansion or Windows command length causes a failure unrelated to tests, report that exact limitation and use the repository's accepted equivalent command without hiding the substitution.

Do not claim a suite passed unless terminal output confirms it.

## Diff review

Before final return, inspect:

- `git status --short`;
- `git diff --stat`;
- `git diff --name-only`;
- `git diff`;
- `git diff --cached --stat`;
- `git diff --cached --name-only`;
- `git ls-files --others --exclude-standard`;
- `git diff --check`.

Because planning documents may already be staged while implementation remains unstaged, inspect both index and working-tree diffs deliberately.

Do not accidentally commit staged planning documents while reviewing runtime work.

## Branch and history review

Verify:

- current branch is `codex/gameplay-v3-2c-approach-selection`;
- merge base remains the intended accepted 2C starting point;
- no unintended merge, rebase, or cherry-pick occurred;
- no branch was deleted;
- no commit was created without authorization.

Suggested read-only commands:

- `git branch --show-current`
- `git log -5 --oneline --decorate`
- `git status --short`

## Final verification command set

Run and report:

- `git diff --check`
- all `node --check` commands for changed JS/MJS files
- focused Milestone 2C test files
- `node --test tests/voyage/domain/*.test.mjs`
- `node --test tests/voyage/domain/*.test.mjs tests/voyage/pf2e/*.test.mjs`
- `git status --short`
- `git diff --stat`
- `git diff --name-only`
- `git diff --cached --stat`
- `git diff --cached --name-only`
- `git ls-files --others --exclude-standard`

No Foundry runtime validation is required or may be claimed.

## Final acceptance checklist

Milestone 2C is complete only when all are true:

- action-only intermediate selections remain valid;
- statistic approach selections validate;
- no-roll approach selections validate;
- partial or mismatched committed records fail;
- approach select exists;
- approach change exists;
- approach clear exists;
- caller chooses only station and approach IDs;
- authored execution identity is copied exactly;
- approach operations preserve Risk Bids;
- action change clears approach and Risk Bid;
- action clear removes approach and Risk Bid;
- initial action selection does not auto-select;
- completeness reports action and approach separately;
- readiness requires both for every occupied station;
- unoccupied stations remain skipped;
- zero occupied stations remain supported;
- all mutations are atomic;
- outputs are isolated;
- hostile data fails safely;
- focused tests pass;
- full Voyage-domain tests pass;
- combined Voyage-domain and PF2e tests pass;
- no Foundry or PF2e runtime integration was added;
- no 2D-or-later behavior was added;
- whitespace check passes.

## Final return format

Return:

### Summary

What Milestone 2C now does.

### Changed files

Every changed and untracked file, grouped into:

- planning documents;
- implementation;
- tests;
- any justified compatibility files.

### Final contracts

List:

- selection shapes;
- request shapes;
- exports;
- event types;
- completeness shape;
- readiness shape.

### Verification

Report:

- every syntax-check command;
- every focused test command and exact totals;
- full domain suite totals;
- combined PF2e suite totals;
- `git diff --check`;
- final status;
- staged versus unstaged state.

### Scope confirmation

Explicitly state that no Milestone 2D, 2E, or 2F behavior was implemented.

### Runtime validation

Explicitly state that Foundry runtime validation was not performed and is not claimed.

### Unmet criteria

List any unmet acceptance criterion.

### Incomplete work

List any remaining work or state `None`.

Do not commit, push, merge, rebase, reset, delete branches, or open a pull request.
