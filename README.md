# Arcflight

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns. It focuses on persistent ships, arkengines/spell engines, Lifeveil systems, voyage events, naval combat, ship upgrades, and crew/faction play.

Phase 0 only creates the repository/module scaffold. No gameplay systems, actor types, item types, compendium packs, automation, or GM tooling are implemented yet.

## Foundry VTT Compatibility

Arcflight targets Foundry VTT v13 first, with future v14 compatibility in mind.

## Phase 0 Scope

This initial scaffold provides:

- A minimal Foundry module manifest.
- A single initialization hook that logs module startup.
- Placeholder folders for future scripts, styles, templates, packs, data, and assets.
- Project documentation and development guardrails.

## Current Module Behavior

When the module is enabled, the browser console should log:

```text
Arcflight | Initializing module
```

## Future Direction

Arcflight is PF2E-compatible in design philosophy, but it is not a replacement PF2E system. Future phases are expected to use compendium/data-driven architecture for ships, hulls, arkengines, Lifeveil systems, voyage events, naval combat, upgrades, crew, factions, and related GM tools.
