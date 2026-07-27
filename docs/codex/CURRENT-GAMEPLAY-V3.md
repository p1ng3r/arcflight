# Current Gameplay V3 Task Authority

## Authority order

1. [`docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`](../gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md) — authoritative gameplay contract.
2. [`docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`](../gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md) — authoritative implementation dependency order.
3. [`docs/gameplay-v3/reconciliation-and-continuation-roadmap.md`](../gameplay-v3/reconciliation-and-continuation-roadmap.md) — historical reconciliation and preserved architecture.
4. This file — concise current pointer.

## Authoritative branch

```text
rebuild/arcflight-gameplay-v3
```

## Accepted checkpoint

Gameplay V3-005B-1 was merged through PR #566.

```text
Accepted head: 2963763ee99566fb5736415dd5a9ca636c81f223
Merge commit: 9799fdaa8c14d18ecafca8372bf97e936fabce1b
```

Accepted behavior includes deterministic normal action branch interpretation with Active, Consequences, and complete-resolution gates; atomic safe failure; deterministic intent IDs; hostile-data safety; and focused regression coverage.

## Current task

```text
Milestone 1A — Canonical rules documentation PR
```

This task is documentation only. It places the canonical Event Runner authority in the repository and aligns the older planning documents with the accepted checkpoint.

## Next implementation task

```text
Milestone 2A — Fixed operator assignments and occupied stations
```

Do not begin Pressure, Hazards, Void Scars, rewards, or player/GM UI before canonical Crew Planning alignment.

## Crossover warning

The branch `rebuild/arcflight-voyage-events-alpha` and its open V3-007 issues belong to a separate diverged workstream. They are reference and salvage material, not the sequential continuation of Gameplay V3. Do not merge or cherry-pick that branch wholesale. Reuse must occur through narrow contract audits and reviewed PRs on the authoritative Gameplay V3 branch.
