# Gameplay V3 Milestone 2A — Pass 4 of 5
## Occupied-station Crew Planning completeness and selection rules

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

Passes 1 through 3 must already be complete and passing. Use the established helper that derives occupied station IDs from valid `stationAssignments`.

## Scope

Align Crew Planning with canonical occupied-station behavior.

Crew Planning completeness must:

- require one valid action selection for each occupied station;
- not require selections for unoccupied available stations;
- reject selections for unoccupied stations;
- stop using `selectionRequired` to determine canonical completeness;
- retain deterministic station/action validation and hostile-data safety.

An authored `selectionRequired` property may remain present on imported objects, but it must no longer control completeness.

Readiness/completeness reports must expose fresh isolated arrays named consistently as:

- `occupiedStationIds`
- `selectedStationIds`
- `missingOccupiedStationIds`

Remove or consistently replace the legacy report names:

- `requiredStationIds`
- `missingRequiredStationIds`

Do not leave both result contracts active.

Station-selection validation and mutation must reject a station that is not occupied.

Existing behavior must remain available for occupied stations:

- create a valid selection;
- change an existing selection during Crew Planning;
- clear an existing selection during Crew Planning.

Do not implement action approaches, exactly-three-actions authoring, committed station order, Risk Bids, Focus, reactions, or Pressure.

## Files likely in scope

- `scripts/voyage/domain/crew-planning-completeness.js`
- `scripts/voyage/domain/crew-planning-readiness.js`
- `scripts/voyage/domain/station-selection.js`
- directly dependent focused modules only when required for consistent result names
- focused tests under `tests/voyage/domain/`

## Required tests

At minimum cover:

1. occupied station without a selection is incomplete;
2. every occupied station selected is complete;
3. unoccupied available station requires no selection;
4. selection for an unoccupied station is rejected;
5. `selectionRequired: true` does not require an unoccupied station;
6. `selectionRequired: false` does not excuse an occupied station;
7. report arrays use the new names;
8. report arrays are fresh and isolated;
9. legacy result names are absent from the canonical report;
10. occupied-station selection creation succeeds;
11. occupied-station selection change succeeds;
12. occupied-station selection clear succeeds;
13. hostile selections remain deterministic and safe;
14. related existing Crew Planning tests are updated rather than bypassed.

Run focused tests and `node --check` for every changed JavaScript file.
