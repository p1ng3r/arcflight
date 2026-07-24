# Gameplay V3 Reconciliation and Continuation Roadmap

## Status

**Proposed planning authority after Gameplay V3-004F.**

This document reconciles two independent Voyage Event workstreams that reused the same `V3-00x` numbering. It establishes the continuation path for the gameplay rebuild after PR #561 and prevents future tasks from implementing duplicate lifecycle systems on diverged branches.

This document is planning-only. It changes no runtime code, data contract, public API, Foundry behavior, PF2e behavior, package schema, persistence format, or issue state.

## 1. Authoritative continuation branch

The authoritative branch for the current gameplay rebuild is:

```text
rebuild/arcflight-gameplay-v3
```

The current accepted implementation checkpoint is the merge of PR #561:

```text
Gameplay V3-004F — Persist PF2e results and enter Consequences
Merge commit: 8586651ddceff00726509e6eb50e91ec99021d8b
```

All new Gameplay V3 implementation work must start from the latest accepted commit on `rebuild/arcflight-gameplay-v3` unless a reviewed task explicitly establishes a successor integration branch.

The branch `rebuild/arcflight-voyage-events-alpha` remains a reference and salvage source. It is not the continuation branch for Gameplay V3-004F, and its open V3-007 tracker must not be executed sequentially against the current rebuild without reconciliation.

## 2. Why reconciliation is required

Two separate workstreams used overlapping milestone names:

1. **Gameplay V3 rebuild** on `rebuild/arcflight-gameplay-v3`.
   - Began from the framework-foundation reset.
   - Produced the accepted Voyage Encounter architecture and decision log.
   - Implemented pure domain lifecycle, activation, phase, Crew Planning, Risk Bids, Resolution preparation, PF2e execution, result persistence, and entry into Consequences.

2. **Voyage Event alpha package/runtime work** on `rebuild/arcflight-voyage-events-alpha`.
   - Produced an alpha-specific package schema, catalog validation, ship-flag persistence helpers, and a separate V3-007 lifecycle tracker.
   - Uses overlapping identifiers such as V3-004, V3-005, V3-006, and V3-007A through V3-007F.

The branch histories have diverged. Milestone numbers alone are therefore not sufficient to identify a valid next task.

## 3. Crossover findings

### 3.1 Work already implemented on the Gameplay V3 branch

The following V3-007 tracker concepts already exist on `rebuild/arcflight-gameplay-v3`:

| Voyage Event alpha tracker item | Gameplay V3 implementation already present |
| --- | --- |
| V3-007A: pure lifecycle transition policy | Gameplay V3-003B lifecycle graph and validation helpers |
| V3-007B: validated active-event start | Gameplay V3-003F through V3-003H activation readiness, snapshots, and Ready-to-Active application |
| V3-007C: guarded pause and resume | Gameplay V3-003C context-preserving Active-to-Paused and Paused-to-Active application |
| V3-007D: strict normal phase advancement | Gameplay V3-003I phase policy plus specialized transitions through Resolution-to-Consequences |

These tracker slices must not be reimplemented as competing modules.

### 3.2 Work that remains relevant but is not yet integrated

| Voyage Event alpha work | Reconciliation decision |
| --- | --- |
| V3-005 package validation and catalog registries | Potentially reusable after a contract-by-contract audit against the accepted alpha scope and current Gameplay V3 action/check contracts. Do not copy wholesale. |
| V3-006 ship-flag persistence helpers | Potentially reusable as a Foundry adapter after confirming the authoritative encounter-storage decision, revision ownership, and compatibility with current pure-domain state. Do not adopt the storage model silently. |
| V3-007E round-boundary advancement | Still required conceptually, but it belongs after Consequences and Cleanup are implemented in the current engine. |
| V3-007F audited GM override | Still required conceptually. Reuse only the nonduplicated audit and override behavior after the normal transition path is complete. |

### 3.3 Work that must remain isolated

Do not merge, cherry-pick, or copy an entire diverged branch to reconcile these workstreams. Shared filenames, lifecycle concepts, constants, state fields, or public helpers may have different contracts even when their names are similar.

Any reuse must be introduced by a narrow reviewed PR that:

1. identifies the exact source files and commits;
2. compares their contracts with current Gameplay V3 contracts;
3. adapts rather than duplicates existing helpers;
4. preserves the pure-domain and Foundry-adapter boundary;
5. adds focused regression coverage;
6. receives local manual validation when Foundry-facing behavior changes.

## 4. Current Gameplay V3 checkpoint

Gameplay V3-004F leaves an Active encounter in the `consequences` phase with:

- normalized successful PF2e results persisted against exact pending checks;
- pending checks marked resolved;
- duplicate or mismatched result application rejected atomically;
- Resolution completion reported deterministically;
- a Consequences phase-start snapshot;
- selections, targets, Risk Bids, tracks, pending consequences, and resolved checks preserved;
- no interpretation or application of gameplay consequences yet.

The following remain explicitly deferred at this checkpoint:

- interpreting degrees of success and no-roll results;
- applying Risk Bid rewards or dangers;
- generating action effect intents;
- changing encounter tracks;
- detecting and queuing thresholds;
- creating temporary consequences;
- proposing permanent consequences;
- determining stage or encounter outcomes;
- transitioning from Consequences to Cleanup and Advance;
- clearing round-only state;
- advancing the round, stage, or lifecycle;
- Foundry persistence of the pure encounter state;
- multiplayer command authority and projections;
- player and GM applications;
- bundled event content and deterministic vignette composition.

## 5. Next pure-round implementation sequence

There are **seven planned slices remaining to complete the current pure Voyage round engine**. This count does not represent the complete table-playable alpha; Foundry integration, multiplayer, UI, content, recovery, and aftermath work follow later.

Use the full prefix **Gameplay V3** in issue titles, task documents, branches, commits, and PR titles. Do not refer to a future task only as `V3-005` because that identifier already exists in the other workstream.

### Gameplay V3-005A — Consequence rule and effect-intent contracts

Define and validate the pure-data contracts needed to interpret one resolved action without mutating encounter state.

Expected scope:

- authored result-mapping contracts;
- degree-of-success branches;
- no-roll outcome contracts;
- Risk Bid reward/danger references;
- effect-intent types and stable identifiers;
- target and timing validation;
- deterministic analysis report;
- no track mutation, consequence mutation, persistence, or UI.

### Gameplay V3-005B — Action outcome interpretation

Convert the locked Resolution plan and resolved checks into an ordered list of validated effect intents.

Expected scope:

- deterministic station/action order reuse;
- result and no-roll interpretation;
- Risk Bid reward/danger selection;
- public versus GM-secret result separation;
- atomic failure behavior;
- no track mutation or consequence application.

### Gameplay V3-005C — Track changes and threshold queue

Apply validated track-change intents and produce a deterministic threshold queue.

Expected scope:

- generic beneficial/harmful track movement;
- minimum, maximum, clamp, reject, overflow, and conversion behavior;
- threshold timing, priority, crossing order, and recurrence;
- threshold history;
- bounded conversion chains;
- hidden-information-safe events and reports.

### Gameplay V3-005D — Consequence assembly and proposal staging

Consume the ordered effect and threshold intents into explicit temporary consequences, pending effects, discoveries, setbacks, and permanent-consequence proposals.

Expected scope:

- temporary versus permanent classification;
- stable consequence identifiers;
- proposal status and commitment timing;
- stage and encounter outcome candidates;
- no durable ship or component write;
- no final lifecycle transition.

### Gameplay V3-005E — Consequences completion and Cleanup transition

Determine when Consequences is complete and atomically enter `cleanup-and-advance`.

Expected scope:

- readiness/completion report;
- unresolved GM-confirmed or pending consequence blockers;
- Consequences-to-Cleanup phase transition;
- Cleanup phase-start snapshot;
- preservation of audit and resolved outcome state;
- no round increment yet.

### Gameplay V3-005F — Normal Cleanup and round, stage, or terminal advance

Close the round and perform exactly one normal accepted advance path.

Expected scope:

- archive or clear round-only planning and pending-check state;
- preserve required history and committed/proposed consequence state;
- next round in the same stage;
- transition to another stage;
- completion candidate for success or failure;
- authorized pause when an authored or normal policy requires a GM decision;
- round-start and Situation phase-start snapshots for a new round;
- no bypass of readiness or transition policy.

### Gameplay V3-005G — Audited GM override

Add the explicit correction path only after normal Cleanup and advancement are complete.

Expected scope:

- GM-only authority contract at the pure-domain boundary;
- mandatory non-empty reason;
- exactly one audit entry containing the responsible user identifier, timestamp supplied by the adapter boundary, prior state reference, requested correction, and reason;
- preservation of prior audit history;
- explicit restrictions on which state may be corrected;
- no silent deletion of checks, consequences, snapshots, or permanent commitment records;
- no persistence, sockets, UI, or durable document mutation in the pure-domain slice.

The detailed scope of each slice must be reviewed immediately before its Codex task is written. This roadmap does not authorize implementing all seven slices in parallel.

## 6. Post-round integration workstreams

After Gameplay V3-005G, create later task files only one dependency at a time. The expected workstreams are:

1. **Package and catalog reconciliation**
   - audit the alpha-branch package validator and registries;
   - adapt compatible contracts to the current engine;
   - preserve declarative, nonexecutable imported content.

2. **Foundry persistence adapter**
   - select and document the authoritative storage host;
   - adapt expected-revision and GM-authority behavior;
   - preserve sibling Arcflight flags and PF2e-owned data;
   - support refresh, reconnect, and restart recovery.

3. **Command authority and multiplayer transport**
   - active-GM authority;
   - expected revision and unique request IDs;
   - stale and duplicate request rejection;
   - player request envelopes;
   - no gameplay logic in socket handlers.

4. **Filtered projections**
   - GM, crew, player, and observer projections;
   - hidden tracks, secret DCs, unrevealed outcomes, and GM notes excluded from unauthorized payloads.

5. **Foundry v14 applications**
   - GM event management;
   - Crew Planning and station ordering;
   - active station resolution;
   - ship status, round resolution, and aftermath;
   - stable IDs, CSS classes, localization keys, data paths, artwork roles, and empty states.

6. **Narrative and event history**
   - deterministic imported vignette composition;
   - exact posted-text preservation;
   - event history and export.

7. **Aftermath and permanent consequence commitment**
   - GM review and approval;
   - durable idempotency markers;
   - retry and reconciliation;
   - Voyage Benefits, Ship Scars, salvage, discoveries, and other approved long-term outcomes.

8. **Bundled alpha events and end-to-end acceptance**
   - one introductory three-round event;
   - one advanced five-round event;
   - complete opening-to-aftermath Foundry validation.

No exact final slice count is assigned to these integration workstreams until the preceding contracts are accepted. Artificially fixing the count now would encourage oversized tasks and hide dependencies.

## 7. Naming and tracking rules

To prevent another crossover:

- Prefix every future issue and PR title with `Gameplay V3-...`.
- Include the authoritative base branch in every Codex task.
- Include an expected starting commit in every implementation task.
- Use one task document and one focused PR per accepted slice.
- Do not infer task order from GitHub issue numbers alone.
- Do not execute tasks from `rebuild/arcflight-voyage-events-alpha` against the Gameplay V3 branch.
- Treat the open alpha V3-007 issues as unreconciled reference material until they are explicitly closed, retitled, or superseded.
- Do not mutate or close those issues as part of this documentation slice.

## 8. Immediate next action

After this roadmap is reviewed and merged, create one self-contained Codex task for:

```text
Gameplay V3-005A — Consequence rule and effect-intent contracts
```

That task must begin from the latest accepted `rebuild/arcflight-gameplay-v3` commit, inspect V3-004F and the accepted architecture completely, and remain pure JavaScript and Foundry-free.

Do not start V3-007A on `rebuild/arcflight-voyage-events-alpha` as the next Gameplay V3 task.
