# Arcflight

Arcflight is a Foundry VTT module for PF2E-compatible fantasy voidfaring campaigns.

## Documentation

Arcflight now uses a docs source-of-truth spine. Start here:

- [Docs Index](docs/DOCS-INDEX.md) — entry point and authority order for all Arcflight docs.
- [Arcflight Bible](docs/ARCFLIGHT-BIBLE.md) — canonical project design, locked rules, and system overview.
- [Roadmap](docs/ROADMAP.md) — canonical development roadmap and phase order.
- [TODO](docs/TODO.md) — canonical active task list.
- [Travel v2](docs/TRAVEL-V2.md) — canonical Travel v2 design and implementation reference.
- [Architecture](docs/ARCHITECTURE.md) — codebase map and placement rules.
- [Data Model](docs/DATA-MODEL.md) — Arcflight flags, actor/item usage, and state-shape reference.
- [Testing](docs/TESTING.md) — official testing notes and smoke command guidance.
- [Glossary](docs/GLOSSARY.md) — Arcflight terminology.
- [Decisions](docs/DECISIONS.md) — locked decisions and why they were made.

Older planning notes, Codex prompts, phase plans, and task files may still be useful as historical reference, but they should not override the docs listed above.

## Foundry VTT Compatibility

Arcflight targets Foundry VTT v13 first, with future v14 compatibility in mind.

## Current development status

Use the canonical docs instead of this README for current implementation status:

- Current project rules: [Arcflight Bible](docs/ARCFLIGHT-BIBLE.md)
- Current phase order: [Roadmap](docs/ROADMAP.md)
- Active work: [TODO](docs/TODO.md)
- Travel v2 status and boundaries: [Travel v2](docs/TRAVEL-V2.md)

## Core architecture summary

Arcflight deliberately builds on normal PF2E documents instead of registering custom document subtypes:

- PF2E vehicle actors are Arcflight ships.
- PF2E equipment items are Arcflight components.
- Arcflight data lives under `flags.arcflight.*`.
- Source items should remain immutable during installation.
- Runtime ship state belongs to the ship actor.
- Travel v2 should remain GM-directed and session-local first until an explicit GM Apply flow is used.

For details, see [Architecture](docs/ARCHITECTURE.md) and [Data Model](docs/DATA-MODEL.md).

## Runtime and testing notes

Testing guidance belongs in [Testing](docs/TESTING.md).

For docs-only PRs, use:

```text
Docs-only change; no smoke tests run.
```

For Travel v2 runtime changes, the aggregate smoke runner is:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
```

## Documentation rule

Do not use this README as the project bible. This file is a doorway into the canonical docs.

When docs conflict, follow [Docs Index](docs/DOCS-INDEX.md).
