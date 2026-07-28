# Current Gameplay V3 Task Authority

## Authority order

1. [`docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`](../gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md) — authoritative gameplay contract.
2. [`docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`](../gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md) — authoritative implementation dependency order.
3. [`docs/gameplay-v3/reconciliation-and-continuation-roadmap.md`](../gameplay-v3/reconciliation-and-continuation-roadmap.md) — historical reconciliation and preserved architecture.
4. This file — concise current pointer.

## Authoritative branch

`rebuild/arcflight-gameplay-v3`

## Accepted checkpoint

Gameplay V3 Milestones 2A and 2B are complete, merged, and archived.

Accepted authoritative head:

`a09c8c35e3193b6a2322f76d1d5454eabdf4d325`

Completed work:

- Milestone 2A implementation: PR #568 — fixed operator assignments and occupied stations.
- Milestone 2A archive: PR #569.
- Milestone 2B implementation: PR #570 — round action authoring validation.
- Milestone 2B archive: PR #571.

Accepted behavior includes:

- canonical fixed station-operator assignments;
- occupied stations derived from valid assignments;
- unoccupied stations allowed and skipped;
- Crew Planning action selections required only for occupied stations;
- authored round counts of 3, 5, 7, 9, or 11;
- round-owned canonical station subsets;
- exactly three authored actions per available station;
- one to three approaches per action;
- explicit third-approach distinction metadata;
- exact statistic-or-ability and no-roll execution identities;
- recursively plain, hostile-data-safe Event Definition validation.

## Current task

**Milestone 2C — Approach selection and editing**

Milestone 2C extends the existing Crew Planning station selection with a committed authored approach. It adds select, change, and clear operations; couples approach clearing to action changes; and requires every occupied station to have both a valid action and approach before Crew Planning can lock.

## Next implementation task

**Milestone 2D — Player-committed station order**

Do not begin canonical Risk Bids, execution-request alignment, Focus, Pressure, Hazards, Void Scars, rewards, or player/GM UI before the preceding Crew Planning contracts are complete.

## Crossover warning

The branch `rebuild/arcflight-voyage-events-alpha` and its V3-007 issues belong to a separate diverged workstream. They are reference and salvage material, not the sequential continuation of Gameplay V3. Do not merge or cherry-pick that branch wholesale. Reuse must occur through narrow contract audits and reviewed PRs on the authoritative Gameplay V3 branch.
