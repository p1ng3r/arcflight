# Gameplay V3 Milestone 2C — Approach Selection and Editing

**Codex mode:** Code
**Repository:** `p1ng3r/arcflight`
**Authoritative base branch:** `rebuild/arcflight-gameplay-v3`
**Expected starting commit:** `57c313a31018b4a1b871e8ba413b2f4e463b1db8`
**Working branch:** `codex/gameplay-v3-2c-approach-selection`

---

TASK ID: GAMEPLAY-V3-M2C
TITLE: Implement canonical approach selection and editing

## Authority

Read first:

- `AGENTS.md`
- this master specification
- `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`
- `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`
- `docs/gameplay-v3/reconciliation-and-continuation-roadmap.md`
- `docs/codex/CURRENT-GAMEPLAY-V3.md`
- archived Milestone 2A documents under `docs/codex/archive/gameplay-v3/milestone-2a/`
- archived Milestone 2B documents under `docs/codex/archive/gameplay-v3/milestone-2b/`
- current Voyage-domain planning modules and tests

The canonical rules and milestone map control whenever an older document conflicts.

Milestones 2A and 2B are accepted. This branch begins from merge commit `57c313a`, after the current-task pointer was updated through PR #572.

## Goal

Implement only Milestone 2C:

- select one authored approach for an occupied station's selected action;
- change an existing committed approach;
- clear an existing committed approach without clearing the action;
- validate the approach against the currently selected action;
- copy the authored execution identity into the committed selection;
- clear the committed approach when the selected action changes;
- require a valid action and committed approach for every occupied station before Crew Planning can lock;
- preserve the existing pure-domain mutation and reporting pattern.

Do not implement station ordering, canonical Risk Bids, final DC calculation, execution-request alignment, pending-check changes, or PF2e adapter changes.

## Accepted starting facts

Preserve these accepted foundations:

- fixed event-long station assignments;
- occupied stations derived from valid assignments;
- unoccupied stations skipped;
- encounter-local `availableStations`;
- encounter-local `selections` map keyed by station ID;
- action select, change, and clear mutations;
- action changes clear the station's current legacy Risk Bid;
- action clears remove the action selection and current legacy Risk Bid;
- Crew Planning completeness and readiness are derived reports;
- round action authoring provides one to three approaches per action;
- every authored approach has exactly one execution identity;
- execution identity is either `statisticSlugOrAbilityId` or explicit `noRoll: true`;
- plain-data, atomic, hostile-data-safe domain behavior.

The current persisted selection is action-only:

`{ stationId, actionId }`

Milestone 2C extends this record. It must not create a separate competing approach-selection collection.

## Canonical selection records

### Action selected, approach not yet committed

`{ stationId, actionId }`

This remains a valid intermediate Crew Planning state, but it is not complete and cannot lock.

### Statistic or ability approach committed

`{ stationId, actionId, approachId, statisticSlugOrAbilityId }`

Requirements:

- `approachId` exactly matches one authored approach on the selected action;
- `statisticSlugOrAbilityId` is copied from that authored approach;
- the request does not choose or override the execution identity;
- no `noRoll` field is added.

### No-roll approach committed

`{ stationId, actionId, approachId, noRoll: true }`

Requirements:

- `approachId` exactly matches one authored no-roll approach;
- `noRoll: true` is copied from the authored approach;
- no `statisticSlugOrAbilityId` field is added.

Do not trim, normalize, case-convert, repair, infer, or substitute identifiers.

## Authored approach source

The selected action is resolved from the current round's encounter-local structure:

- `encounterState.availableStations`;
- exact occupied `stationId`;
- exact currently selected `actionId`;
- that action's own `approaches` array;
- exact requested `approachId`.

A valid lookup requires:

- exactly one matching available station;
- the station is occupied;
- exactly one matching selected action;
- an own dense approaches array;
- exactly one matching approach;
- a valid authored execution identity.

Missing or duplicate matches are errors. Do not choose the first ambiguous result.

Milestone 2B's Event Definition analyzer remains the authoring authority. Milestone 2C must not create a contradictory approach schema.

## Approach mutation module

Create:

`scripts/voyage/domain/approach-selection.js`

Export:

- `applyVoyageEncounterStationApproachSelection`
- `applyVoyageEncounterStationApproachSelectionChange`
- `applyVoyageEncounterStationApproachSelectionClear`

These are pure-domain named exports following the existing station-selection mutation pattern.

Do not register them through `game.arcflight`, `CONFIG.arcflight`, sockets, dev tools, or a Foundry application in this milestone.

## Request contracts

### Initial approach selection

`{ stationId, approachId }`

Requires:

- Active lifecycle;
- Crew Planning phase;
- occupied station;
- existing valid action selection;
- no currently committed approach;
- exact authored approach on the selected action.

### Approach change

`{ stationId, approachId }`

Requires:

- Active lifecycle;
- Crew Planning phase;
- occupied station;
- existing valid action and approach selection;
- requested approach differs from the current approach;
- exact authored approach on the same selected action.

### Approach clear

`{ stationId }`

Requires:

- Active lifecycle;
- Crew Planning phase;
- occupied station;
- existing valid action and committed approach.

Clearing the approach leaves:

`{ stationId, actionId }`

It does not clear the action.

## Caller authority boundary

The caller chooses only:

- `stationId`;
- `approachId` when selecting or changing.

The caller must not control:

- `actionId`;
- `statisticSlugOrAbilityId`;
- `noRoll`;
- execution mode;
- operator identity;
- Risk Bid identity;
- final DC.

The mutation resolves the current action from state and copies the execution identity from the authored approach.

Caller-supplied execution fields must never override authored data.

## Mutation behavior

Every successful mutation:

- clones the encounter state without mutating the input;
- changes exactly one station selection;
- increments revision exactly once;
- validates the candidate state;
- emits exactly one deterministic event;
- returns isolated plain data;
- leaves unrelated stations untouched.

Every failed mutation:

- returns `ok: false`;
- returns `nextState: null`;
- emits no events;
- does not mutate the source state;
- does not increment revision;
- reports deterministic structured issues.

## Events

### Initial selection

Event type:

`voyage.station-approach-selected`

Include:

- encounter ID;
- lifecycle state;
- round number;
- phase;
- station ID;
- selected action ID;
- approach ID;
- exact committed execution identity;
- previous revision;
- revision.

### Change

Event type:

`voyage.station-approach-selection-changed`

Include:

- encounter ID;
- lifecycle state;
- round number;
- phase;
- station ID;
- action ID;
- previous approach ID;
- new approach ID;
- exact new execution identity;
- previous revision;
- revision.

### Clear

Event type:

`voyage.station-approach-selection-cleared`

Include:

- encounter ID;
- lifecycle state;
- round number;
- phase;
- station ID;
- action ID;
- cleared approach ID;
- cleared execution identity;
- previous revision;
- revision.

Events must not expose live Actor, Statistic, Roll, Item, or Foundry objects.

## Persisted selection validation

Extend the existing station-selection validation so that it accepts both:

- valid action-only intermediate selections;
- valid action-plus-approach committed selections.

For a committed approach, validate:

- own non-empty exact `approachId`;
- exact membership on the selected action;
- unique authored match;
- exactly one persisted execution identity;
- persisted identity exactly equals the authored identity;
- statistic approaches have no `noRoll`;
- no-roll approaches have no statistic field;
- `noRoll` must be exactly `true`;
- unsafe identifiers rejected;
- inherited fields do not satisfy required own fields.

Reject partially committed records such as:

- `approachId` without execution identity;
- execution identity without `approachId`;
- both execution identities;
- mismatched statistic or ability ID;
- `noRoll: false`;
- approach from another action;
- ambiguous duplicate approach IDs.

Action-only selections remain structurally valid but incomplete for Crew Planning lock.

## Action mutation coupling

Extend existing action-selection mutations.

### Action change

Changing an action must:

- replace the station record with action-only `{ stationId, actionId }`;
- clear any previously committed approach;
- continue clearing the current legacy Risk Bid;
- report `clearedApproachId` when an approach was present;
- preserve the existing action-change event and accepted behavior otherwise.

The new action does not inherit an approach merely because an approach ID or statistic happens to match.

### Action clear

Clearing an action must:

- delete the complete selection record;
- therefore remove both action and approach;
- continue clearing the current legacy Risk Bid;
- report `clearedApproachId` when an approach was present;
- preserve existing action-clear behavior otherwise.

### Initial action selection

Initial action selection continues to create only:

`{ stationId, actionId }`

Do not auto-select an approach, including when the action has only one approach.

## Legacy Risk Bid interaction

Milestone 2C does not redesign Risk Bids.

Rules for this milestone:

- action change continues to clear the station's current Risk Bid;
- action clear continues to clear the station's current Risk Bid;
- approach select does not change the Risk Bid;
- approach change does not change the Risk Bid;
- approach clear does not change the Risk Bid.

Canonical Risk Bid compatibility is Milestone 2E.

## Crew Planning completeness

Preserve existing report fields:

- `occupiedStationIds`;
- `selectedStationIds`;
- `missingOccupiedStationIds`.

Their action-selection meaning remains unchanged.

Add:

- `approachSelectedStationIds`;
- `missingApproachStationIds`.

Definitions:

- `selectedStationIds`: occupied stations with one valid selected action;
- `missingOccupiedStationIds`: occupied stations without a valid action;
- `approachSelectedStationIds`: occupied stations with a valid action and valid committed approach;
- `missingApproachStationIds`: occupied stations that have a valid action but lack a valid committed approach.

If selection validation fails, the report must remain safely incomplete and must not claim readiness from partially trusted records.

`complete` is true only when:

- there are no errors;
- every occupied station has a valid action;
- every occupied station has a valid committed approach.

An event with zero occupied stations remains complete if no structural errors exist.

## Crew Planning readiness

Extend the readiness report with:

- `approachSelectedStationIds`;
- `missingApproachStationIds`.

`readyToLock` requires:

- structurally valid encounter state;
- Active lifecycle;
- Crew Planning phase;
- valid current stage ID;
- valid legacy Risk Bid state;
- completeness with action and approach for every occupied station;
- no accumulated errors.

Do not change lifecycle transitions or snapshot mechanics.

## Safety requirements

Follow existing Voyage conventions:

- plain objects and arrays only;
- own properties only;
- safe getter reads;
- unsafe map keys and identifiers rejected;
- duplicate authored matches rejected;
- sparse and inherited entries do not silently satisfy contracts;
- no JSON cloning;
- no source mutation;
- deterministic issue order;
- precise issue paths;
- isolated outputs;
- atomic failure;
- no Foundry or PF2e globals;
- hostile reads converted to structured errors.

A narrow shared helper extraction is allowed only when it removes real duplication without changing unrelated accepted behavior.

## Likely files

Expected:

- `scripts/voyage/domain/approach-selection.js`
- `scripts/voyage/domain/station-selection.js`
- `scripts/voyage/domain/crew-planning-completeness.js`
- `scripts/voyage/domain/crew-planning-readiness.js`
- `tests/voyage/domain/approach-selection.test.mjs`
- `tests/voyage/domain/station-selection.test.mjs`
- `tests/voyage/domain/crew-planning-completeness.test.mjs`
- `tests/voyage/domain/crew-planning-readiness.test.mjs`

Possible only if directly required by focused regression:

- `scripts/voyage/domain/resolution-order.js`
- Crew Planning lock tests or phase-transition tests.

Avoid unrelated state-schema, PF2e, pending-check, execution, UI, socket, and Foundry changes.

## Required tests

At minimum cover:

1. statistic approach initial selection;
2. no-roll approach initial selection;
3. approach change between statistic approaches;
4. approach change between statistic and no-roll;
5. approach clear leaving the action selected;
6. missing action selection;
7. approach already selected;
8. approach not selected for change or clear;
9. unchanged approach request;
10. unavailable, unoccupied, blank, unsafe, and ambiguous station IDs;
11. missing, blank, unsafe, unavailable, and ambiguous approach IDs;
12. approach belonging to another action;
13. caller execution identity cannot override authored identity;
14. malformed, sparse, inherited, or hostile approach collections;
15. duplicate approach IDs;
16. missing, dual, invalid, or mismatched execution identities;
17. action change clears committed approach and Risk Bid;
18. action clear removes committed approach and Risk Bid;
19. initial action selection does not auto-select an approach;
20. approach edits leave Risk Bid state unchanged;
21. action-only selection remains structurally valid;
22. action-only selection is incomplete;
23. action-plus-approach selection is complete;
24. mixed occupied-station completeness;
25. unoccupied stations require neither action nor approach;
26. zero occupied stations;
27. readiness rejects missing approaches;
28. readiness accepts every occupied station with action and approach;
29. deterministic events and revision increments;
30. atomic failure and source non-mutation;
31. output isolation;
32. precise deterministic errors;
33. Foundry-free imports;
34. full Voyage-domain regression;
35. combined Voyage-domain and PF2e regression.

## Verification

For every pass inspect:

- branch;
- status;
- diff statistics;
- complete diff;
- untracked files;
- whitespace.

Run `node --check` on every changed JavaScript or MJS file.

Final commands:

- `git diff --check`
- `node --test tests/voyage/domain/approach-selection.test.mjs`
- `node --test tests/voyage/domain/station-selection.test.mjs`
- `node --test tests/voyage/domain/crew-planning-completeness.test.mjs`
- `node --test tests/voyage/domain/crew-planning-readiness.test.mjs`
- `node --test tests/voyage/domain/*.test.mjs`
- `node --test tests/voyage/domain/*.test.mjs tests/voyage/pf2e/*.test.mjs`
- `git status --short`
- `git diff --stat`
- `git diff --name-only`
- `git ls-files --others --exclude-standard`

Report exact test totals.

No Foundry runtime validation is expected or may be claimed.

## Pass sequence

1. selection contract and persisted validation;
2. approach mutation operations;
3. action coupling, completeness, and readiness;
4. integration and regression review.

Do not begin a later pass before review.

## Out of scope

No player-committed station order, canonical Risk Bid redesign, Risk Bid tier or branch behavior, final DC calculation, execution-request changes, pending-check changes, PF2e adapter changes, Focus, Momentum, Pressure, Hazards, Void Scars, rewards, Misfortunes, closeout, persistence, sockets, UI, localization, imported content loading, catalog resolution, version changes, unrelated refactors, commits, pushes, PRs, merges, rebases, resets, branch deletion, Foundry launch, or browser automation.

## Acceptance criteria

Complete only when:

- approach select, change, and clear operations exist;
- requests choose only station and approach IDs;
- execution identity is copied exactly from authored data;
- action-only intermediate selections remain valid;
- committed selections validate against the selected action;
- statistic and no-roll records are mutually exclusive;
- action changes clear approach and legacy Risk Bid;
- action clears remove action, approach, and legacy Risk Bid;
- approach edits do not alter the legacy Risk Bid;
- completeness reports action and approach status separately;
- readiness requires action and approach for every occupied station;
- unoccupied stations remain skipped;
- all mutations are atomic and deterministic;
- hostile data produces structured safe failure;
- focused, full domain, and combined PF2e suites pass;
- no 2D-or-later behavior is implemented.

## Return

Return:

- summary;
- changed files;
- final selection and request shapes;
- exports;
- event shapes;
- issue rules;
- exact verification commands and totals;
- assumptions;
- limitations;
- explicit no-Foundry-validation statement;
- unmet acceptance criteria;
- incomplete work.

Do not commit, push, merge, rebase, reset, delete branches, or open a pull request.
