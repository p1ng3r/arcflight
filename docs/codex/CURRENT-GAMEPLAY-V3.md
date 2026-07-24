# Current Gameplay V3 Task Authority

## Authoritative branch

```text
rebuild/arcflight-gameplay-v3
```

## Required planning document

Read before creating or running another Gameplay V3 task:

```text
docs/gameplay-v3/reconciliation-and-continuation-roadmap.md
```

## Current checkpoint

Gameplay V3-004F was merged through PR #561. The current pure Voyage engine has entered Consequences but does not yet interpret or apply consequences or advance through Cleanup.

## Next planned task

```text
Gameplay V3-005A — Consequence rule and effect-intent contracts
```

A self-contained Codex task file for Gameplay V3-005A must be written and reviewed before implementation begins.

## Crossover warning

The branch `rebuild/arcflight-voyage-events-alpha` and its open V3-007 issues belong to a separate diverged workstream. They are reference and salvage material, not the sequential continuation of Gameplay V3-004F.

Do not start V3-007A as the next Gameplay V3 task. Do not merge or cherry-pick that branch wholesale. Reuse must occur through narrow contract audits and reviewed PRs on the authoritative Gameplay V3 branch.
