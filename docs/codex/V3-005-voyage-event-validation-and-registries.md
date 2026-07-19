# V3-005 — Validate Voyage Event Packages and Define Catalog Registries

**Codex mode:** Code  
**Repository:** `p1ng3r/arcflight`  
**Working branch:** `rebuild/arcflight-voyage-events-alpha`

Tell Codex:

`Read AGENTS.md and perform the task in docs/codex/V3-005-voyage-event-validation-and-registries.md.`

---

TASK ID: V3-005
TITLE: Validate Voyage Event packages and define catalog registries

Repository: p1ng3r/arcflight
Working branch: rebuild/arcflight-voyage-events-alpha

READ FIRST

- AGENTS.md
- docs/voyage-event-v3-decisions.md
- docs/voyage-event-data-contracts.md
- scripts/voyage-events/constants.js
- scripts/voyage-events/defaults.js
- scripts/voyage-events/contracts.js
- data/stations/core-stations.js

GOAL

Build the pure-data validation and catalog-registry foundation required before reward, danger, Hazard, and bundled-event content is authored.

This task must also correct one contract mismatch discovered after V3-004: each round must support one or two actions for each of the five active Voyage Event stations. The current JSDoc shape incorrectly represents only one action per station.

REQUIRED DELIVERABLES

Create or update only the small set of files needed for:

- a complete declarative event-package validator;
- a pure catalog-registry builder and lookup API;
- corrected round station-action contracts;
- validation documentation.

Expected new files may include:

- `scripts/voyage-events/validation.js`
- `scripts/voyage-events/catalog-registry.js`
- `docs/voyage-event-validation.md`

Update existing Voyage Event contract or documentation files only where required by this task.

A. CORRECT ROUND STATION-ACTION SHAPE

Change the round contract so `stationActions` is an object keyed by the five active station keys, where each value is an array containing one or two station action definitions:

```js
stationActions: {
  captain: [/* 1 or 2 actions */],
  engineer: [/* 1 or 2 actions */],
  navigator: [/* 1 or 2 actions */],
  watchmaster: [/* 1 or 2 actions */],
  veilwarden: [/* 1 or 2 actions */]
}
```

Requirements:

- all five active station keys are required;
- unknown station keys are invalid for an alpha event round;
- each station has at least one and at most two actions;
- each action's `stationKey` must match the station bucket containing it;
- do not modify or delete the broader shared station registry.

B. VALIDATION REPORT CONTRACT

Define a plain serializable validation result:

```js
{
  valid: true,
  errors: [],
  warnings: []
}
```

Each issue must include stable fields:

```js
{
  severity: "error" | "warning",
  code: "stable.machine.code",
  path: "rounds[0].stationActions.navigator[1].bids.plus5.rewardId",
  message: "Human-readable explanation.",
  referenceId: "optional-related-stable-id"
}
```

Validation must collect useful issues rather than throw for ordinary invalid package data.

C. EVENT PACKAGE VALIDATION

Provide a pure function similar to:

```js
validateVoyageEventPackage(packageData, { catalogs } = {})
```

It must not mutate its input and must not use Foundry globals.

Validate at minimum:

1. Top-level package
- JSON-compatible plain data only;
- supported schema version;
- supported mechanics version;
- non-empty packageVersion, packageId, title, and category;
- tags are strings;
- minimumRounds and maximumRounds are integers from 3 through 11;
- minimumRounds is not greater than maximumRounds;
- actual round count is within the declared minimum and maximum;
- artwork-role values are strings when present.

2. Rounds
- unique non-empty round IDs;
- round numbers are unique, contiguous, and begin at 1;
- title and immediate goal are non-empty;
- all five station-action buckets exist;
- each bucket has one or two actions;
- no unknown station buckets;
- all five ship-result conclusion identifiers are represented;
- referenced advantages, consequences, dangers, transitions, and narrative components use stable non-empty IDs where required.

3. Station actions
- action IDs are non-empty and unique across the package;
- action stationKey matches its containing bucket;
- title and player-safe description are non-empty;
- exactly three skill references;
- the three skill keys are non-empty and unique within the action;
- base DC data contains a finite valid numeric value;
- all four bid keys exist: none, plus2, plus5, plus8;
- each bid object's `band` matches its containing bid key;
- No Bid has empty rewardId and dangerId;
- plus2, plus5, and plus8 have non-empty rewardId and dangerId;
- narrative component references are strings.

4. Catalog references
When catalogs are supplied, validate that referenced reward, danger, Hazard, prepared advantage, consequence, and related stable IDs exist in the appropriate registry.

When catalogs are omitted, structural package validation must still work. Missing external lookup context may produce warnings where appropriate, not crashes.

5. Narrative components
- component IDs are non-empty and unique;
- type is a supported narrative component type;
- text is non-empty;
- priority is finite;
- requiresFlags, excludesFlags, and compatibleWith are arrays of strings;
- source and target stations, when present, use active station keys;
- cascade bridges require valid source and target stations;
- referenced action, reward, danger, and Hazard IDs are validated when lookup context exists.

6. Safe declarative data
Reject or report unsupported executable or non-JSON-compatible values anywhere in imported package or catalog data, including functions, symbols, bigint values, class instances, and cyclic references. Do not execute any imported value.

D. CATALOG REGISTRY FOUNDATION

Create a pure catalog registry API that accepts plain arrays or objects for these groups:

- rewards;
- dangers;
- hazards;
- downstream effects;
- held effects/cards;
- prepared advantages;
- consequences.

Requirements:

- build stable ID lookup maps without retaining mutable source references;
- detect duplicate IDs within and across incompatible groups;
- validate each entry with the existing shared catalog contract and any group-specific requirements;
- provide lookup helpers by group and ID;
- provide a combined validation report;
- unknown IDs return null or an explicit safe result rather than throwing;
- no actual reward, danger, or Hazard content in this task;
- no mutable global singleton registry;
- no Foundry registration.

E. VALIDATION DOCUMENTATION

Document:

- the corrected per-station action-array shape;
- validation result and issue format;
- package validation rules;
- catalog registry groups and lookup behavior;
- distinction between errors and warnings;
- validation behavior when external catalogs are unavailable;
- safe rejection of executable or non-JSON-compatible input;
- representative invalid examples and expected issue codes.

OUT OF SCOPE

- no actual 20/20/20 reward catalogs;
- no danger or Hazard content;
- no bundled event content;
- no event manager or state-machine transitions;
- no persistence writes;
- no PF2e roll execution;
- no UI, templates, CSS, or localization;
- no socket handling;
- no module.json changes;
- no scripts/arcflight.js registration;
- no version bump;
- no branch operations;
- no pull request;
- do not run automated tests or Foundry.

ACCEPTANCE CRITERIA

1. Round contracts support one or two actions for every active station.
2. All five active station buckets are required and unknown buckets are rejected.
3. Package validation returns stable collected errors and warnings without mutating input.
4. Exactly three unique skills and all four correctly formed bid bands are enforced.
5. Package, round, action, and narrative IDs are checked for required presence and uniqueness.
6. Round length rules enforce the accepted 3-to-11 range.
7. Catalog references can be checked against supplied pure registries.
8. Catalog registries clone source data, detect duplicate IDs, validate group-specific entries, and provide safe lookup helpers.
9. Executable and non-JSON-compatible imported values are reported and never executed.
10. Existing Arcflight runtime behavior remains unchanged and no files are registered with Foundry.
11. `git diff --check` passes.

FINAL RESPONSE

Return:

- concise summary;
- complete changed-file list;
- final function/API names;
- exact corrected `stationActions` shape;
- representative validation result;
- assumptions;
- manual inspection steps;
- known limitations;
- `git diff --check` result;
- confirmation that no content catalogs, UI, persistence, rolls, sockets, module registration, tests, branch operations, or pull request were added.