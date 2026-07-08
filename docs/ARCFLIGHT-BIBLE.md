# Arcflight Bible

This is the canonical project bible for Arcflight. When older notes, Codex prompts, task files, or implementation plans conflict with this document, treat this document as authoritative unless a later docs PR intentionally changes it.

## Project identity

Arcflight is a Foundry VTT module for Pathfinder 2E-compatible fantasy voidfaring campaigns. It adds Arkflight ships, ship components, travel procedures, and table-facing GM/player tools while staying inside Foundry and PF2E document conventions.

## Core design rules

- PF2E vehicle actors represent Arcflight ships.
- PF2E equipment items represent Arcflight components.
- Arcflight should not require custom actor or item types.
- Arcflight data belongs under `flags.arcflight.*`.
- Ship hull data is treated as base/immutable design data.
- Installed components modify derived ship state, not the original hull definition.
- Runtime helpers should prefer clone-safe transformations and explicit GM review.
- No system should silently mutate actor, item, chat, journal, socket, scene, token, compendium, or world state unless that behavior is explicitly designed and documented.

## Ship model

A ship actor represents the live vessel. It is built from:

- hull base data
- installed arkengine
- installed rooms
- installed ship upgrades
- installed weapons
- crew and conditions
- current state such as hull integrity, strain, lifeveil, morale, supplies, cargo, and damage state

Derived state is calculated from the hull and installed components. Current state represents what has happened to the vessel during play.

## Component model

Arcflight components are PF2E equipment items with Arcflight flags. Core component categories are:

- Hull
- Arkengine
- Room
- Ship Upgrade
- Arkengine Mod
- Weapon or weapon-like ship system

Component install helpers should preserve clear install records, avoid mutating source items, and recalculate derived ship stats from canonical inputs.

## Travel v2 model

Travel v2 is the current priority travel system. It is GM-directed, session-local by default, and designed around table-facing procedure rather than autopilot simulation.

Travel v2 uses:

- event setup
- rounds
- station actions
- pressure
- hazards
- event approach tally
- round finalization
- event completion
- GM-reviewed follow-up/application paths

Travel v2 must preserve player-safe projections. GM-only/internal fields must not leak to player-facing state.

## Player safety and GM-only boundaries

Player-safe surfaces must not expose internal or GM-only fields such as:

- `auditRecord`
- `commitRecords`
- `userId`
- `userName`
- `gmText`
- `applyPayload`
- `targetActorUuid`
- `mutationScope`
- `internalMutation`
- `secret`
- `pendingConsequenceQueue`
- `gmOnly`
- `unrevealedHazard`
- `catalogSuggestions`

When in doubt, expose label-only, summary-only, or explicitly sanitized state to players.

## Persistence rules

- Read-only preview state should not persist changes.
- Session-local application records are allowed only through explicit helper flows.
- Real actor/item/world changes require explicit GM confirmation and a documented apply path.
- Duplicate application should be guarded by stable records or IDs.
- Audit history should preserve what happened rather than silently overwriting it.

## Current major systems

- Ship/component foundation
- Hull and arkengine creation/install helpers
- Room and ship upgrade helpers
- Travel Event Builder
- Travel Event Runner
- Travel v2 pressure, hazard, finalization, completion, follow-up, and application-review foundations
- Travel v2 smoke coverage

## Future major systems

Future work belongs in `docs/ROADMAP.md` and active work belongs in `docs/TODO.md`. This bible should describe permanent rules, not become a task tracker.

Known future pillars include:

- ship combat loop
- ship progression
- crew and faction systems
- broader content packs
- stronger builder/importer alignment
- GM-facing docs and authoring workflow

## Non-goals

- Do not add custom PF2E actor or item types without an explicit architecture decision.
- Do not create autopilot travel resolution that bypasses GM procedure.
- Do not introduce hidden player-facing leaks for convenience.
- Do not scatter roadmap or TODO truth across prompt files.

## Related docs

- `docs/DOCS-INDEX.md`
- `docs/ROADMAP.md`
- `docs/TODO.md`
- `docs/TRAVEL-V2.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA-MODEL.md`
- `docs/DECISIONS.md`
