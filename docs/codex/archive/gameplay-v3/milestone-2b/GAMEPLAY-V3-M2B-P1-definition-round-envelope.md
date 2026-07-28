# Gameplay V3 Milestone 2B — Pass 1 of 4
## Event-definition and round envelope

**Codex mode:** Code
**Repository:** `p1ng3r/arcflight`
**Working branch:** `codex/gameplay-v3-2b-round-action-authoring`
**Expected starting commit:** `b46d8c35caabb9c312d1e1cc6183e6de9c7725a9`

Read `AGENTS.md`, the M2B master specification, canonical rules, milestone map, archived M2A plans, current constants/defaults, existing analysis validators, and related tests.

The master specification controls. `CURRENT-GAMEPLAY-V3.md` is stale at this commit; do not follow or edit its old pointer.

Do not commit, push, merge, rebase, reset, delete branches, open a PR, launch Foundry, or use browser automation.

## Scope

Create `scripts/voyage/domain/round-action-authoring.js` and focused tests.

Add:

```js
analyzeVoyageEventDefinitionRoundActionAuthoring
validateVoyageEventDefinitionRoundActionAuthoring
```

Implement only:

- safe Event Definition object validation;
- required own `rounds`;
- dense own-entry round arrays;
- allowed counts `3`, `5`, `7`, `9`, `11`;
- plain round records;
- non-empty exact, safe, unique round IDs;
- hostile getter containment;
- recursively plain, acyclic, nonexecuting boundary;
- isolated normalized round-envelope output;
- validator delegation to analyzer.

For this pass, `availableStations: []` may remain a temporary placeholder. Do not enforce stations, actions, or approaches.

A valid normalized round may be:

```js
{ roundIndex, roundId, stationCount: 0, stations: [] }
```

On any error, normalized `rounds` is empty.

A shared immutable allowed-round-count constant may be added if consistent with repository conventions.

## Required tests

Cover valid 3/5/7/9/11 counts; invalid other counts; malformed definitions; missing/inherited/non-array/sparse rounds; malformed rounds; blank/unsafe/duplicate IDs; exact ID preservation; hostile getters; cycles/executable data; non-mutation; isolation; invalid no-round output; deterministic issues; validator delegation; Foundry-free import.

## Files

Expected:

```text
scripts/voyage/domain/round-action-authoring.js
tests/voyage/domain/round-action-authoring.test.mjs
```

Possible: `scripts/voyage/domain/constants.js`.

Do not modify session state, activation, planning, Resolution, PF2e, APIs, or snapshots.

## Verify

```bash
node --check scripts/voyage/domain/round-action-authoring.js
node --check tests/voyage/domain/round-action-authoring.test.mjs
node --test tests/voyage/domain/round-action-authoring.test.mjs
git diff --check
```

Inspect status, diff stats, actual diffs, and untracked files.

Return summary, files, commands, totals, assumptions, limitations, and incomplete work. Stop after Pass 1.
