# Gameplay V3 Milestone 2A — Pass 1 of 5
## Canonical station constants and pure assignment contract

# Shared authority and guardrails

**Codex mode:** Code
**Repository:** `p1ng3r/arcflight`
**Working branch:** `codex/gameplay-v3-2a-fixed-operators`

Read first:

- `AGENTS.md`
- `docs/codex/CURRENT-GAMEPLAY-V3.md`
- `docs/codex/GAMEPLAY-V3-M2A-fixed-operator-assignments.md`
- `docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`
- `docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`
- `docs/gameplay-v3/reconciliation-and-continuation-roadmap.md`

The master Milestone 2A specification is authoritative. Implement only the pass defined in this file. Do not begin later passes early.

Do not commit, push, merge, rebase, reset, delete branches, open a pull request, launch Foundry, or use browser automation.

Keep the Voyage domain pure and serializable. Do not import Foundry documents into it. Do not mutate PF2e Actor data, source crew-asset Items, persistent ship station assignments, or compendium content.

At completion, return:

1. concise implementation summary;
2. every changed file;
3. exact commands run;
4. exact test totals;
5. assumptions;
6. limitations and anything not completed.


## Scope

Implement only the pure-domain foundation for fixed Event Runner station assignments.

Create immutable canonical metadata for exactly these Event Runner station IDs:

- `captain`
- `engineer`
- `navigator`
- `watchmaster`
- `veilwarden`

Add immutable station-to-Pressure-system ownership metadata:

- `captain` → `crew-morale`
- `engineer` → `arkengine`
- `navigator` → `levstone-array`
- `watchmaster` → `solar-sail-rig`
- `veilwarden` → `lifeveil`

Do not remove or repurpose the broader ship-framework stations `pilot`, `gunnery`, or `quartermaster`.

Implement a focused pure-domain assignment module, preferably:

`script/voyage/domain/station-assignments.js`

Use the repository's actual directory name if the existing path is `scripts/voyage/domain`.

The module must define and validate a serializable assignment collection shaped compatibly with:

```js
[
  {
    stationId: "engineer",
    operator: {
      kind: "actor",
      id: "actor-id",
      uuid: "Actor.actor-id",
      name: "Chief Engineer"
    }
  }
]
```

Crew assets use `kind: "crewAsset"`. Named PCs and named NPCs use the same `kind: "actor"` contract.

Requirements:

- an operator has at least one non-empty stable identity: UUID preferred, ID accepted;
- operator uniqueness uses kind plus stable identity;
- duplicate station IDs are invalid;
- one operator assigned to two stations is invalid;
- noncanonical Event Runner station IDs are invalid;
- malformed entries are invalid;
- unsafe keys and hostile data follow existing Voyage-domain conventions;
- inherited array entries do not become assignments;
- sparse arrays are handled deliberately;
- validation is deterministic;
- inputs are not mutated;
- returned arrays and records are fresh clones;
- occupied station IDs are derived from valid assignments, never separately persisted.

## Files likely in scope

- `scripts/voyage/domain/constants.js`
- new `scripts/voyage/domain/station-assignments.js`
- focused tests under `tests/voyage/domain/`

Do not modify defaults, lifecycle, snapshots, activation readiness, Crew Planning completeness, or station-selection mutation in this pass.

## Required tests

At minimum cover:

1. canonical station constants are immutable;
2. Pressure ownership metadata is immutable;
3. empty assignments are valid;
4. actor assignment is valid;
5. crew-asset assignment is valid;
6. PC and NPC names do not create separate behavior;
7. duplicate stations are rejected;
8. duplicate operators are rejected;
9. malformed identities are rejected;
10. unsupported station IDs are rejected;
11. inherited and sparse array behavior is safe;
12. occupied station IDs are derived and returned as fresh arrays;
13. source inputs remain unchanged.

Run focused tests and `node --check` for every changed JavaScript file. Do not run later-pass implementation.
