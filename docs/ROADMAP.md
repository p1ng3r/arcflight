# Arcflight Roadmap

This is the canonical Arcflight development roadmap. It describes major sequencing only. Active tasks belong in `docs/TODO.md`; permanent design rules belong in `docs/ARCFLIGHT-BIBLE.md`.

## Roadmap rules

- One playable pillar at a time.
- Keep PRs narrow and reviewable.
- Prefer docs-only clarification before code when direction is unclear.
- Do not revive old Codex prompt plans wholesale.
- Do not skip safety, player-safe projection, or GM review boundaries for speed.
- Do not add a second roadmap in another folder.

## Phase 1 — Documentation spine and source of truth

Status: active.

Goal: make the docs navigable and prevent stale plans from overriding current work.

Done when:

- `docs/DOCS-INDEX.md` identifies authoritative docs.
- `docs/ARCFLIGHT-BIBLE.md` defines locked project rules.
- `docs/ROADMAP.md` defines the single roadmap.
- `docs/TODO.md` defines active work.
- historical docs are either linked, updated, marked superseded, or archived.

Next slices:

- Review and land the source-of-truth docs spine.
- Update README to point to the docs spine.
- Audit stale Travel v2 docs and archive or mark superseded material.

## Phase 2 — Travel v2 stabilization and documentation

Status: underway.

Goal: make Travel v2 understandable, testable, and safe for actual table use.

Done when:

- Travel v2 lifecycle is documented in `docs/TRAVEL-V2.md`.
- Current implemented systems are separated from future work.
- GM-only and player-safe state boundaries are documented.
- Testing commands are documented in `docs/TESTING.md`.
- Builder/importer compatibility gaps are documented and prioritized.

Likely next work:

- Travel v2 docs cleanup.
- Builder/importer schema alignment audit.
- Focus reaction/current-dev closeout.
- Table-use walkthrough for running a Travel v2 event.

## Phase 3 — Ship component and actor workflow

Status: planned.

Goal: make ship creation, hull installation, arkengine installation, rooms, upgrades, and recalculation reliable and GM-usable.

Done when:

- Component categories are documented.
- Install records are consistent.
- Derived/current ship state is clear.
- GM-facing ship workflows are documented.
- PF2E actor/item constraints are preserved.

## Phase 4 — Ship combat foundation

Status: planned.

Goal: create a playable alpha ship combat loop.

Likely systems:

- combat speed and maneuverability
- ship initiative
- shared AP/RAP
- stations
- weapon arcs
- reload and range bands
- ship damage states
- crew/undermanned effects

## Phase 5 — Ship progression, crew, and faction systems

Status: planned.

Goal: make ships and crews develop over campaign time.

Likely systems:

- ship upgrades
- crew roles and quality
- morale and faction pressure
- reputation
- content hooks for ports, factions, and routes

## Phase 6 — Content packs and GM authoring

Status: planned.

Goal: support reusable Travel v2 events, hazards, components, and GM-authored content.

Likely systems:

- content pack schemas
- import/export rules
- validation and compatibility checks
- sample events
- authoring guide

## Phase 7 — Beta hardening

Status: future.

Goal: prepare Arcflight for broader use after the alpha pillars are playable.

Likely work:

- UI polish
- migration checks
- docs pass
- broader smoke coverage
- compatibility checks for supported Foundry/PF2E versions

## Current active pointer

For active work, use `docs/TODO.md`.
