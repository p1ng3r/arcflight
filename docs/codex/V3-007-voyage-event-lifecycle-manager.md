# V3-007 — Voyage Event Lifecycle Manager Slice Plan

**Repository:** `p1ng3r/arcflight`  
**Integration branch:** `rebuild/arcflight-voyage-events-alpha`  
**Status:** Parent tracking plan; do not give this parent file to Codex as an implementation task.

## PURPOSE

V3-007 is implemented as six narrow, sequential Codex slices. Each slice gets its own temporary Codex branch, review, pull request, manual validation when required, and merge into the integration branch before the next slice starts.

Do not run the slices in parallel. Later slices intentionally build on files introduced by earlier slices.

## SLICE ORDER

1. **V3-007A — Pure lifecycle transition policy and state-manager error contract**  
   `docs/codex/V3-007A-lifecycle-policy.md`
2. **V3-007B — Validated active-event start**  
   `docs/codex/V3-007B-start-active-event.md`
3. **V3-007C — Guarded pause and resume**  
   `docs/codex/V3-007C-pause-resume.md`
4. **V3-007D — Strict normal phase advancement**  
   `docs/codex/V3-007D-phase-advancement.md`
5. **V3-007E — Round-boundary advancement and reset**  
   `docs/codex/V3-007E-round-boundary.md`
6. **V3-007F — Audited GM override and lifecycle documentation**  
   `docs/codex/V3-007F-gm-override-and-docs.md`

## SHARED REQUIREMENTS

Every slice must:

- read `AGENTS.md` and the named slice file;
- start from the latest merged `rebuild/arcflight-voyage-events-alpha`;
- reuse the accepted Voyage Event constants, defaults, validation, and persistence helpers;
- preserve `flags.arcflight.system.voyageEvents` as the only runtime storage location;
- use the persistence layer for all Actor writes;
- preserve exact expected-revision protection and GM authority;
- perform at most one persistence-layer Actor update per successful operation;
- keep errors and returned data plain and serializable;
- avoid unrelated files and speculative abstractions;
- run `git diff --check` only; do not run Foundry or automated tests in Codex;
- not merge, rebase, reset, delete branches, push, or open a pull request during implementation.

## V3-007 BOUNDARY

V3-007 covers lifecycle state only:

- pure legal-transition policy;
- start one validated active runtime;
- pause and resume;
- normal legal phase advancement;
- the explicit new-round boundary reset;
- a reasoned, audited GM override path.

V3-007 does not add:

- archive/container transfer or abort workflow;
- package library registration;
- station choice, station order, action, or result enforcement;
- PF2e rolls;
- bids, scoring, rewards, dangers, downstream effects, Pressure, or Hazard execution;
- narrative composition or chat posting;
- sockets or player requests;
- UI, templates, CSS, localization, hooks, or module registration;
- catalogs or bundled event content;
- build tooling, package management, or a version bump.

## COMPLETION

V3-007 is complete only after slices A through F are individually reviewed, manually validated where specified, merged into the integration branch, and their issues are closed. The parent tracking issue remains open until all six slices are complete.
