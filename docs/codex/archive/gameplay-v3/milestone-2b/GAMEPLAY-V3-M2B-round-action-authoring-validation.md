# Gameplay V3 Milestone 2B — Round Action Authoring Validation

**Codex mode:** Code
**Repository:** `p1ng3r/arcflight`
**Authoritative base branch:** `rebuild/arcflight-gameplay-v3`
**Expected starting commit:** `b46d8c35caabb9c312d1e1cc6183e6de9c7725a9`
**Working branch:** `codex/gameplay-v3-2b-round-action-authoring`

---

TASK ID: GAMEPLAY-V3-M2B
TITLE: Implement canonical round action authoring validation

## Authority

Read first:

- `AGENTS.md`
- this master specification
- `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`
- `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`
- `docs/gameplay-v3/reconciliation-and-continuation-roadmap.md`
- `docs/codex/CURRENT-GAMEPLAY-V3.md`
- archived Milestone 2A documents under `docs/codex/archive/gameplay-v3/milestone-2a/`
- current Voyage-domain validators and tests

The canonical rules and milestone map control whenever an older document conflicts.

At starting commit `b46d8c3`, `docs/codex/CURRENT-GAMEPLAY-V3.md` and portions of the historical reconciliation roadmap still identify Milestones 1A or 2A as pending. That status text is stale because PRs #567, #568, and #569 have merged. Do not follow the stale pointer over this specification or the canonical milestone map. Do not edit that pointer on this runtime branch unless separately authorized.

## Goal

Implement only Milestone 2B:

- validate the canonical authored event-round envelope;
- allow exactly `3`, `5`, `7`, `9`, or `11` authored rounds;
- make each round own its exact station-action lists;
- require exactly three actions for every station made available in a round;
- require one or two authored approaches normally;
- allow a third approach only through explicit canonical distinction metadata;
- keep imported definitions declarative, recursively plain, acyclic, serializable, and nonexecuting;
- provide deterministic, isolated pure-domain validation and analysis.

This milestone validates authored definitions. It does not select an action or approach and does not mutate an Event Session.

## Existing implementation facts

Preserve the accepted foundations:

- pure serializable Voyage Event Session state;
- lifecycle, phase, snapshot, readiness, planning, PF2e, pending-check, and consequence foundations;
- Milestone 2A fixed operator assignments and canonical station constants;
- encounter-local `availableStations` and selection by `actionId`;
- legacy action execution definitions using `action.check.statisticOptions`.

The current branch does not yet provide a canonical event-definition round validator, exact action-count validation, authored approach objects, or third-approach distinction metadata.

## Pure-domain module and exports

Create:

```text
scripts/voyage/domain/round-action-authoring.js
```

Export:

```js
analyzeVoyageEventDefinitionRoundActionAuthoring
validateVoyageEventDefinitionRoundActionAuthoring
```

The validator must delegate to the analyzer. Do not create two independent implementations.

Do not expose these helpers through `game.arcflight`, `CONFIG.arcflight`, `devTools`, sockets, or a Foundry application in this milestone.

## Input boundary

Accept one authored Event Definition plain object with an own `rounds` field:

```js
{
  rounds: [/* authored round records */]
}
```

Other own plain-data fields may exist and remain outside this validator's responsibility. Do not require or invent a top-level definition ID. Do not perform catalog lookup, compendium lookup, UUID resolution, file loading, or Foundry document resolution.

## Canonical round contract

`rounds` must be a dense own-entry array containing exactly `3`, `5`, `7`, `9`, or `11` records.

Each round is shaped compatibly with:

```js
{
  roundId: "round-1",
  availableStations: [
    {
      stationId: "captain",
      actions: [/* exactly three action records */]
    }
  ]
}
```

Requirements:

- non-empty exact `roundId`;
- unique round IDs across the definition;
- unsafe identifier values rejected;
- no trimming, case conversion, repair, or fallback IDs;
- non-empty round-owned `availableStations`;
- any non-empty subset of the five canonical Event Runner stations;
- station availability may differ by round;
- action IDs unique only within their station in that round;
- approach IDs unique only within their action;
- IDs may repeat in another round;
- authored arrays are dense own-entry arrays;
- inherited numeric entries do not count.

Reuse the immutable canonical Event Runner station list from Milestone 2A. Do not create a second station list.

## Station contract

Each station:

```js
{
  stationId: "engineer",
  actions: [/* exactly three actions */]
}
```

Requirements:

- non-empty dense `availableStations`;
- canonical `stationId`;
- station IDs unique within the round;
- own dense `actions`;
- exactly three action entries;
- occupancy is not consulted;
- partial station subsets are valid;
- no generic penalty for unavailable or unoccupied stations.

The validator can enforce three structurally distinct records and IDs but cannot prove that prose or tactics are genuinely meaningful. Do not add text-similarity heuristics.

## Action contract

Each action:

```js
{
  actionId: "hold-the-line",
  approaches: [
    {
      approachId: "diplomacy",
      statisticSlugOrAbilityId: "diplomacy"
    }
  ]
}
```

Requirements:

- non-empty exact `actionId`;
- unique action IDs within the station;
- unsafe IDs rejected;
- own dense `approaches`;
- one, two, or three approaches;
- recursively plain declarative metadata only;
- functions, symbols, bigint, cycles, class instances, Foundry documents, PF2e objects, and executable callbacks invalid.

Do not validate later outcome, Risk Bid, Focus, Hazard, reward, or closeout systems here.

## Approach contract

Statistic or ability approach:

```js
{
  approachId: "crafting",
  statisticSlugOrAbilityId: "crafting"
}
```

Explicit no-roll approach:

```js
{
  approachId: "automatic",
  noRoll: true
}
```

Requirements:

- non-empty exact unique `approachId`;
- unsafe IDs rejected;
- exactly one execution identity:
  - non-empty exact `statisticSlugOrAbilityId`; or
  - own `noRoll: true`;
- both identities invalid;
- `noRoll: false`, missing identity, or blank identity invalid;
- no selected approach is stored in Event Session state;
- no Actor, Statistic, Roll, Item, or Foundry resolution occurs.

## Third-approach exception

An action with exactly three approaches must own:

```js
{
  thirdApproachException: {
    approachId: "risky-lore",
    distinctions: ["failure-risk"]
  }
}
```

The exception approach ID must match exactly one authored approach.

Allowed distinction values:

```text
result-narration
critical-success-benefit
failure-risk
upgrade-interaction
risk-bid-availability
target
affected-system
```

`distinctions` must be a non-empty dense array of unique canonical strings.

Reject:

- three approaches without the exception;
- mismatched or ambiguous exception references;
- blank, duplicate, unsupported, sparse, or inherited distinction entries;
- exception metadata on one- or two-approach actions.

The validator proves the declaration exists; human review determines whether the authored distinction is actually meaningful.

## Analysis result

Return a deterministic isolated report shaped compatibly with:

```js
{
  structurallyValid: true,
  authoringValid: true,
  roundCount: 3,
  rounds: [
    {
      roundIndex: 0,
      roundId: "round-1",
      stationCount: 1,
      stations: [
        {
          stationIndex: 0,
          stationId: "captain",
          actionCount: 3,
          actions: [
            {
              actionIndex: 0,
              actionId: "hold-the-line",
              approachCount: 1,
              approaches: [
                {
                  approachIndex: 0,
                  approachId: "diplomacy",
                  executionKind: "statistic-or-ability",
                  statisticSlugOrAbilityId: "diplomacy"
                }
              ],
              thirdApproachException: null
            }
          ]
        }
      ]
    }
  ],
  errors: [],
  warnings: []
}
```

Rules:

- all returned data fresh and recursively isolated;
- source indexes and exact identifiers preserved;
- source-order issue ordering;
- normalized `rounds` returned only if the complete contract is valid;
- on any error: `rounds: []`, `authoringValid: false`;
- `roundCount` may report own authored entries even when invalid;
- no source mutation.

The validator returns:

```js
{ valid, errors, warnings }
```

and delegates to the analyzer.

## Safety requirements

Follow existing Voyage conventions:

- plain objects only;
- own properties only;
- safe getter reads;
- recursively plain and acyclic data;
- dense authored arrays;
- unsafe identifiers rejected;
- duplicate IDs rejected at local scope;
- exact strings preserved;
- deterministic issues;
- no JSON cloning;
- no input mutation;
- no Foundry/PF2e globals;
- hostile reads become structured errors;
- invalid reports expose no partially trusted normalized rounds.

A narrow shared helper extraction is allowed only if it reduces genuine duplication without altering unrelated accepted behavior.

## Required issue families

Tests must cover:

- invalid definition;
- missing/invalid/sparse rounds;
- invalid round count;
- invalid/unsafe/duplicate round IDs;
- missing/invalid/empty/sparse station collections;
- malformed/unsupported/unsafe/duplicate stations;
- missing/invalid/sparse/non-three action collections;
- malformed/unsafe/duplicate action IDs;
- missing/invalid/sparse/empty/over-limit approaches;
- malformed/unsafe/duplicate approach IDs;
- missing or ambiguous execution identity;
- missing/malformed/mismatched third-approach exception;
- invalid/sparse/inherited/duplicate/unsupported distinctions;
- unexpected exception on fewer than three approaches;
- unreadable, cyclic, executable, or non-plain data.

Paths must be precise, such as:

```text
rounds[0].availableStations[1].actions[2].approaches[0]
```

## Integration boundary

Keep 2B standalone.

Do not:

- resolve `definitionId`;
- require a catalog;
- modify Event Session schema;
- copy rounds into live state;
- alter `currentStage` or `availableStations`;
- select actions or approaches;
- alter Crew Planning readiness;
- alter Resolution, pending checks, or PF2e adapters;
- add public API registration.

Existing modules may change only if a focused regression proves direct reuse is required to avoid a competing authoring contract. Such a change must not implement 2C or 2F.

## Alpha crossover

The diverged alpha validator may be inspected only as reference. Do not copy it wholesale, merge, rebase, or cherry-pick it. Its action, approach, bid, and round-limit rules conflict with canonical 2B.

## Likely files

Expected:

```text
scripts/voyage/domain/round-action-authoring.js
tests/voyage/domain/round-action-authoring.test.mjs
```

Possible:

```text
scripts/voyage/domain/constants.js
```

Avoid modifying state, defaults, activation, planning, Resolution, PF2e, snapshots, or APIs unless a reviewed integration need is discovered.

## Required tests

At minimum cover:

1. valid 3/5/7/9/11-round definitions;
2. invalid round counts;
3. malformed, sparse, inherited, or hostile rounds;
4. exact, unsafe, blank, and duplicate round IDs;
5. non-empty canonical station subsets;
6. station availability changes by round;
7. duplicate or unsupported station IDs;
8. exactly three dense actions per station;
9. duplicate, blank, or unsafe action IDs;
10. action IDs repeated in another round;
11. one/two normal approaches;
12. zero or more-than-three approaches;
13. three approaches requiring exception metadata;
14. every canonical distinction value;
15. exception reference matching;
16. exception forbidden on fewer than three approaches;
17. statistic/ability and explicit no-roll identities;
18. missing or dual identities;
19. sparse/inherited approaches and distinctions;
20. hostile getters, cycles, functions, symbols, bigint, class instances, and Foundry-like objects;
21. source non-mutation;
22. report isolation;
23. invalid reports returning no rounds;
24. deterministic issue order and paths;
25. validator delegation;
26. Foundry-free import;
27. full Voyage and PF2e regressions.

## Verification

For each pass inspect status, diff stats, actual diff, and untracked files. Run focused tests, `node --check` on every changed JS/MJS file, and `git diff --check`.

Final commands:

```bash
git diff --check
node --test tests/voyage/domain/round-action-authoring.test.mjs
node --test tests/voyage/domain/*.test.mjs
node --test tests/voyage/domain/*.test.mjs tests/voyage/pf2e/*.test.mjs
git status --short
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard
```

Report exact totals. No Foundry runtime validation is expected or may be claimed.

## Pass sequence

1. definition and round envelope;
2. stations and exact actions;
3. approaches and exception metadata;
4. integration and regression audit.

Do not begin a later pass before review.

## Out of scope

No Event Session changes, round activation, catalog resolution, action/approach selection, readiness changes, station order, canonical Risk Bids, final DCs, execution changes, pending checks, PF2e changes, Focus, Momentum, Pressure, Hazards, Scars, rewards, closeout, persistence, sockets, UI, imported content, localization, version changes, unrelated refactors, commits, pushes, PRs, merges, rebases, resets, branch deletion, Foundry launch, or browser automation.

## Acceptance criteria

Complete only when:

- one analyzer is source of truth;
- validator delegates;
- only 3/5/7/9/11 rounds accepted;
- each round owns non-empty canonical stations;
- every station has exactly three actions;
- each action has 1–3 approaches;
- each approach has exactly one execution identity;
- three approaches require valid distinction metadata;
- fewer approaches reject dormant exception metadata;
- authored arrays are dense;
- hostile/non-plain/executable data rejected deterministically;
- valid reports isolated;
- invalid reports expose no rounds;
- no Event Session mutation or runtime dependency;
- focused, full domain, and combined PF2e suites pass;
- no 2C-or-later behavior added.

## Return

Return summary, changed files, final data shapes, exports/constants, issue rules, commands, totals, assumptions, limitations, explicit no-Foundry-validation statement, unmet criteria, and incomplete work.

Do not commit, push, merge, rebase, reset, delete branches, or open a pull request.
