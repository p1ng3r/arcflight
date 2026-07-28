# Gameplay V3 Milestone 2A — Pass 2 of 5
## Event state schema and atomic pre-activation assignment setting

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

Pass 1 must already be complete and passing. Inspect its exported constants, validators, normalizers, and occupied-station helper before editing.

## Scope

Integrate the fixed assignment contract into Voyage event state.

Replace the ambiguous field:

`temporaryStationAssignments`

with the canonical field:

`stationAssignments`

Remove `temporaryStationAssignments` from new Voyage defaults, state normalization, general validation expectations, and tests touched by this pass. Do not maintain two competing state fields.

Implement one pure-domain operation that replaces the complete assignment set atomically while configuration is permitted by the existing lifecycle.

The operation must:

- use the established pre-activation lifecycle rather than inventing a new phase;
- reject calls after activation;
- validate the complete requested assignment set before changing state;
- reject malformed assignments, duplicate stations, duplicate operators, and noncanonical station IDs;
- clone request data and returned state;
- leave source state unchanged on success and failure;
- leave request data unchanged;
- increment revision exactly once on success;
- not increment revision on failure;
- emit one deterministic domain event following existing event conventions;
- avoid partial mutation;
- preserve exact identifiers without trimming or repair.

Assignments are event-wide and fixed after activation. Do not implement an Active-phase reassignment helper or GM override.

## Files likely in scope

- `scripts/voyage/domain/defaults.js`
- `scripts/voyage/domain/state.js`
- `scripts/voyage/domain/validation.js`
- `scripts/voyage/domain/station-assignments.js`
- focused tests under `tests/voyage/domain/`

Do not edit Crew Planning completeness, station selection, boundary snapshots, or activation readiness in this pass unless a tiny compile-safe import adjustment is unavoidable. Explain any such adjustment.

## Required tests

At minimum cover:

1. new default state contains `stationAssignments`;
2. new default state omits `temporaryStationAssignments`;
3. valid assignment collections normalize without source mutation;
4. atomic replacement succeeds in the permitted pre-activation lifecycle;
5. one successful replacement increments revision once;
6. one deterministic domain event is emitted;
7. malformed input fails atomically;
8. duplicate station/operator input fails atomically;
9. failure does not change revision;
10. source state and request data remain unchanged;
11. assignment changes are rejected after activation;
12. empty assignment replacement is permitted when canonical rules allow unoccupied stations.

Run focused tests and `node --check` for every changed JavaScript file.
