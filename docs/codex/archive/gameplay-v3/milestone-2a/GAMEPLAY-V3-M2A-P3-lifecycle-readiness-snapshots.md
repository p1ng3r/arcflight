# Gameplay V3 Milestone 2A — Pass 3 of 5
## Lifecycle preservation, activation readiness, and boundary snapshots

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


## Dependency

Passes 1 and 2 must already be complete and passing. Reuse their assignment validator and normalizer; do not create a second contract.

## Scope

Integrate fixed assignments with activation checks and lifecycle boundaries.

Activation readiness and activation-start readiness must reject malformed `stationAssignments`.

Assignments must remain event-wide and survive:

- Situation to Crew Planning;
- Crew Planning locking;
- Resolution;
- Consequences;
- round cleanup;
- boundary snapshot creation.

Update boundary snapshots so `stationAssignments` are deeply cloned. Snapshot mutation must not affect encounter state, and encounter-state mutation must not affect an existing snapshot.

Do not introduce or persist a separate `occupiedStations` collection. Occupied station IDs remain derived from assignments.

Do not require all five canonical stations to be occupied. An empty or partial valid assignment set remains structurally valid unless an existing authored rule outside this milestone explicitly requires otherwise. Do not add such authored rules here.

Do not implement Pressure behavior.

## Files likely in scope

- `scripts/voyage/domain/boundary-snapshots.js`
- `scripts/voyage/domain/activation-readiness.js`
- `scripts/voyage/domain/activation-start-readiness.js`
- narrowly relevant lifecycle or transition modules only when they currently clear the assignment field
- focused tests under `tests/voyage/domain/`

Do not change Crew Planning completeness or station selection in this pass.

## Required tests

At minimum cover:

1. activation readiness accepts a structurally valid empty or partial assignment set;
2. activation readiness rejects malformed assignments;
3. activation-start readiness rejects malformed assignments;
4. fixed assignments survive each relevant lifecycle transition;
5. round-local cleanup does not clear fixed assignments;
6. boundary snapshots include `stationAssignments`;
7. snapshots deeply clone assignment arrays, records, and nested operators;
8. snapshot mutation does not affect source state;
9. source-state mutation does not affect prior snapshots;
10. `temporaryStationAssignments` is absent from new snapshots.

Run focused tests and `node --check` for every changed JavaScript file.
