# Gameplay V3 Milestone 2A — Pass 5 of 5
## Integration audit, regression repair, and acceptance verification

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

Passes 1 through 4 must already be complete. This pass adds no new feature scope.

## Scope

Perform a repository-wide Milestone 2A integration audit and fix only defects required to satisfy the master specification.

Search for and reconcile all remaining Voyage-domain references to:

- `temporaryStationAssignments`
- `selectionRequired` as a completeness rule
- `requiredStationIds`
- `missingRequiredStationIds`
- station selection that ignores occupancy
- lifecycle cleanup that clears fixed assignments
- snapshots that omit or shallow-copy fixed assignments
- activation checks that skip assignment validation

Do not delete unrelated historical documentation references merely because search finds them. Change runtime code and tests only where the canonical Milestone 2A contract requires it.

Confirm that there is one assignment contract, one occupied-station derivation path, and one completeness-report contract.

Run syntax checks for every changed JavaScript file.

Run the full Voyage domain suite:

```bash
node --test tests/voyage/domain/*.test.mjs
```

Also run any repository-wide Node suite that is clearly established and safe. Do not invent a package-script command when none exists.

Fix only failures caused by or directly exposing Milestone 2A integration defects. Do not expand into later milestones.

## Final acceptance audit

Verify all of the following:

1. immutable canonical five-station metadata exists;
2. immutable Pressure ownership metadata exists;
3. state uses `stationAssignments`;
4. new defaults and snapshots omit `temporaryStationAssignments`;
5. assignments validate actor and crew-asset references;
6. PCs and NPCs share actor behavior;
7. duplicate stations are rejected;
8. duplicate operators are rejected;
9. occupied stations are derived, not independently persisted;
10. assignment replacement is atomic and pre-activation only;
11. successful replacement increments revision once;
12. failed replacement changes nothing;
13. fixed assignments survive lifecycle and snapshot boundaries;
14. malformed assignments block activation readiness;
15. occupied stations require selections;
16. unoccupied stations do not;
17. selections for unoccupied stations are invalid;
18. `selectionRequired` no longer controls completeness;
19. canonical report arrays use the new names and are fresh;
20. no out-of-scope gameplay system was implemented.

## Final return

Return the normal completion report plus:

- exact total tests passed, failed, skipped, and cancelled;
- all commands actually run;
- complete final changed-file list across all five passes;
- final assignment data shape;
- final exports added;
- exact manual Foundry validation steps;
- an explicit statement that Foundry runtime validation was not performed;
- any acceptance criterion not fully satisfied.

Do not commit, push, merge, rebase, reset, delete branches, or open a pull request.
