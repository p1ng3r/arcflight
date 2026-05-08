# Arcflight Agent Guardrails

## Phase 0 Scope

- Do not implement Travel, Combat, Ship Progression, Crew/Faction, or GM tooling during Phase 0.
- Do not hardcode content into UI logic.
- Future architecture should be compendium/data-driven.
- Keep code Foundry v13-safe.
- Prefer small, reviewable commits.
- Avoid building automation before data architecture exists.

## Planned Core Entities for Future Phases

- Ship actor type
- Hull items
- Arkengine items
- Arkengine mod items
- Weapon items
- Room items
- Cargo items
- Crew asset items

## Architectural Direction

- Core defines reusable systems.
- Pillars consume Core.
- GM tools consume Core and pillars later.
