# Gameplay V3 Reconciliation and Continuation Roadmap

## Status and authority

**Historical reconciliation authority after Gameplay V3-004F; superseded wherever it conflicts with the canonical Event Runner contract.**

The current gameplay contract is [`ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`](ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md). The current implementation dependency order is [`ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`](ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md). Those documents supersede conflicting portions of this older continuation sequence while preserving the accepted pure-domain architecture and crossover warnings.

This document remains useful as the historical reconciliation record for two independent Voyage Event workstreams that reused the same `V3-00x` numbering. It is planning-only and changes no runtime code, data contract, public API, Foundry behavior, PF2e behavior, package schema, persistence format, or issue state.

## 1. Authority order

1. [`ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md`](ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md) — authoritative gameplay contract.
2. [`ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md`](ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md) — authoritative implementation dependency order.
3. This reconciliation roadmap — historical architecture and workstream separation.
4. [`../codex/CURRENT-GAMEPLAY-V3.md`](../codex/CURRENT-GAMEPLAY-V3.md) — concise current-task pointer.

## 2. Authoritative continuation branch

The authoritative branch for the current gameplay rebuild is:

```text
rebuild/arcflight-gameplay-v3
```

The current accepted implementation checkpoint is merged PR #566:

```text
Gameplay V3-005B-1 — Interpret outcome branches
Accepted head: 2963763ee99566fb5736415dd5a9ca636c81f223
Merge commit: 9799fdaa8c14d18ecafca8372bf97e936fabce1b
```

Accepted behavior includes deterministic normal action-branch interpretation, Active/Consequences/complete-resolution gates, atomic safe failure, deterministic intent IDs, hostile-data-safe isolation, and focused regression coverage.

The current documentation milestone is:

```text
Milestone 1A — Canonical rules documentation PR
```

The next implementation task after that documentation milestone is:

```text
Milestone 2A — Fixed operator assignments and occupied stations
```

All new Gameplay V3 implementation work must start from the latest accepted commit on `rebuild/arcflight-gameplay-v3` unless a reviewed task explicitly establishes a successor integration branch.

## 3. Why reconciliation was required

Two separate workstreams used overlapping milestone names:

1. **Gameplay V3 rebuild** on `rebuild/arcflight-gameplay-v3`.
   - Began from the framework-foundation reset.
   - Produced the accepted Voyage Encounter architecture and decision log.
   - Implemented pure-domain lifecycle, activation, phase control, Crew Planning mutations, Risk Bid selection, Resolution preparation, PF2e execution, result persistence, and normal action outcome interpretation.

2. **Voyage Event alpha package/runtime work** on `rebuild/arcflight-voyage-events-alpha`.
   - Produced an alpha-specific package schema, catalog validation, ship-flag persistence helpers, and a separate V3-007 lifecycle tracker.
   - Uses overlapping identifiers such as V3-004, V3-005, V3-006, and V3-007A through V3-007F.

The branch histories diverged. Milestone numbers alone are therefore not sufficient to identify a valid next task.

## 4. Crossover findings

### 4.1 Work already implemented on the Gameplay V3 branch

The following alpha-tracker concepts already exist on `rebuild/arcflight-gameplay-v3`:

| Voyage Event alpha tracker item | Gameplay V3 implementation already present |
| --- | --- |
| V3-007A: pure lifecycle transition policy | Gameplay V3-003B lifecycle graph and validation helpers |
| V3-007B: validated active-event start | Gameplay V3-003F through V3-003H activation readiness, snapshots, and Ready-to-Active application |
| V3-007C: guarded pause and resume | Gameplay V3-003C context-preserving Active-to-Paused and Paused-to-Active application |
| V3-007D: strict normal phase advancement | Gameplay V3-003I phase policy plus specialized transitions through Resolution-to-Consequences |

These slices must not be reimplemented as competing modules.

### 4.2 Work that remains useful as salvage material

| Voyage Event alpha work | Reconciliation decision |
| --- | --- |
| V3-005 package validation and catalog registries | Potentially reusable after a contract-by-contract audit against the canonical authoring rules and current Gameplay V3 contracts. Do not copy wholesale. |
| V3-006 ship-flag persistence helpers | Potentially reusable as a Foundry adapter after confirming storage ownership, revision authority, and compatibility with current pure-domain state. Do not adopt the storage model silently. |
| V3-007E round-boundary advancement | Still relevant conceptually, but must be scheduled through the canonical milestone map after the planning and round contracts it depends on. |
| V3-007F audited GM override | Still relevant conceptually. Reuse only nonduplicated audit and override behavior after the normal path is complete. |

### 4.3 Work that must remain isolated

Do not merge, cherry-pick, or copy an entire diverged branch to reconcile these workstreams. Shared filenames, lifecycle concepts, constants, state fields, or public helpers may have different contracts even when their names are similar.

Any reuse must be introduced by a narrow reviewed PR that:

1. identifies the exact source files and commits;
2. compares their contracts with the canonical Gameplay V3 contracts;
3. adapts rather than duplicates existing helpers;
4. preserves the pure-domain and Foundry-adapter boundary;
5. adds focused regression coverage;
6. receives local manual validation when Foundry-facing behavior changes.

## 5. Preserved architecture

The following accepted foundations remain authoritative and should be extended rather than replaced:

- serializable plain-data encounter state;
- explicit lifecycle and phase policies;
- atomic operations and revision increments;
- boundary snapshots and recovery foundations;
- planning mutation patterns;
- structured issue objects and hostile-data defenses;
- PF2e preflight and one-live-roll execution boundary;
- pending-check identity and persistence;
- consequence rule and effect-intent concepts;
- separation between pure domain logic and Foundry adapters.

The hidden engine continues toward this shape:

```text
validated session state
→ locked cooperative plan
→ deterministic action order
→ PF2e resolution
→ isolated outcome intents
→ round mechanics
→ proposed persistent consequences
→ GM-confirmed application
```

## 6. Historical V3-005A through V3-005G sequence

The older seven-slice sequence is retained as historical planning context only. It is not the current execution order wherever it conflicts with the canonical milestone map.

Historically, that sequence proposed:

- V3-005A — consequence rule and effect-intent contracts;
- V3-005B — action outcome interpretation;
- V3-005C — track changes and threshold queue;
- V3-005D — consequence assembly and proposal staging;
- V3-005E — Consequences completion and Cleanup transition;
- V3-005F — normal Cleanup and round, stage, or terminal advance;
- V3-005G — audited GM override.

Milestone 0 was completed through merged PR #566. The canonical rules now require Crew Planning alignment before broader round, Pressure, Hazard, Scar, reward, closeout, persistence, or UI work.

Do not present Gameplay V3-005A as the current next task.

## 7. Current canonical continuation

After the documentation milestone, implement one dependency at a time in this order:

1. fixed operator assignments and occupied stations;
2. round action authoring validation;
3. committed approach selection;
4. player-committed station order;
5. canonical Risk Bid contract;
6. execution-request alignment;
7. complete action and Risk Bid outcome interpretation;
8. round scoring and Momentum;
9. Pressure and Pressure Breaches;
10. Hazards;
11. Void Scars and hull capacity;
12. rewards and Misfortunes;
13. Catastrophic Breakdown and Emergency Response;
14. closeout preview and controlled persistent application;
15. recoverable Event Session runtime;
16. first complete player-facing vertical slice;
17. upgrade hooks and broader ship integration.

The detailed scope of each slice must be reviewed immediately before its Codex task is written. This roadmap does not authorize parallel implementation of dependent slices.

## 8. Later integration workstreams

The following workstreams remain useful architectural categories, but their order is governed by the canonical milestone map:

1. **Package and catalog reconciliation**
   - audit alpha-branch validators and registries;
   - adapt compatible contracts;
   - preserve declarative, nonexecuting imported content.

2. **Foundry persistence adapter**
   - select and document the authoritative storage host;
   - enforce expected revision and GM authority;
   - preserve sibling Arcflight flags and PF2e-owned data;
   - support refresh, reconnect, and restart recovery.

3. **Command authority and multiplayer transport**
   - active-GM authority;
   - expected revision and unique request IDs;
   - stale and duplicate request rejection;
   - no gameplay logic in socket handlers.

4. **Filtered projections**
   - GM, crew, player, and observer projections;
   - prevent unauthorized disclosure of hidden tracks, secret DCs, unrevealed outcomes, and GM notes.

5. **Foundry v14 applications**
   - GM event management;
   - Crew Planning and station ordering;
   - active station resolution;
   - ship status, round resolution, and aftermath.

6. **Narrative and event history**
   - deterministic imported vignette composition;
   - exact posted-text preservation;
   - event history and export.

7. **Aftermath and persistent consequence commitment**
   - GM review and approval;
   - durable idempotency markers;
   - retry and reconciliation;
   - approved long-term ship outcomes.

8. **Bundled events and end-to-end acceptance**
   - one introductory three-round event;
   - one advanced five-round event;
   - complete opening-to-aftermath Foundry validation.

## 9. Naming and tracking rules

To prevent another crossover:

- Prefix every future issue and PR title with `Gameplay V3-...` or the exact canonical milestone identifier.
- Include the authoritative base branch in every Codex task.
- Include an expected starting commit in every implementation task.
- Use one task document and one focused PR per accepted slice.
- Do not infer task order from GitHub issue numbers alone.
- Do not execute tasks from `rebuild/arcflight-voyage-events-alpha` against the Gameplay V3 branch.
- Treat the alpha V3-007 issues as unreconciled reference material until explicitly superseded.
- Do not mutate or close those issues as part of this documentation slice.

## 10. Immediate next action

Complete and review the documentation-only Milestone 1A PR containing:

```text
docs/gameplay-v3/ARCFLIGHT_EVENT_RUNNER_CANONICAL_RULES.md
docs/gameplay-v3/ARCFLIGHT_GAMEPLAY_V3_CANONICAL_AUDIT_AND_MILESTONE_MAP.md
docs/gameplay-v3/reconciliation-and-continuation-roadmap.md
docs/codex/CURRENT-GAMEPLAY-V3.md
```

After that PR is merged, create one self-contained Codex task for:

```text
Milestone 2A — Fixed operator assignments and occupied stations
```

That task must begin from the latest accepted `rebuild/arcflight-gameplay-v3` commit, remain a narrow reviewed slice, preserve the pure-domain/Foundry-adapter boundary, and require selections only for occupied stations.

Do not start Pressure, Hazards, Void Scars, rewards, or player/GM UI before canonical Crew Planning alignment. Do not start V3-007A on `rebuild/arcflight-voyage-events-alpha` as the next Gameplay V3 task.
