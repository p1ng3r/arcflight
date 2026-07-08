# Arcflight Decisions

This is the canonical decision log for Arcflight. Use it to record locked design choices and prevent settled questions from being reopened accidentally.

## Decision format

Each decision should include:

- date
- decision
- reason
- affected docs or systems

## 2026-07-08 — Docs source-of-truth spine

Decision: Arcflight documentation will use a single source-of-truth spine.

Reason: roadmap, TODO, and Travel v2 notes had become scattered across agents, Codex prompts, task files, phase plans, and historical notes. A clear docs spine prevents stale implementation plans from overriding current direction.

Affected docs:

- `docs/DOCS-INDEX.md`
- `docs/ARCFLIGHT-BIBLE.md`
- `docs/ROADMAP.md`
- `docs/TODO.md`
- `docs/TRAVEL-V2.md`

## 2026-07-08 — PF2E document model remains canonical

Decision: Arcflight ships use PF2E vehicle actors, Arcflight components use PF2E equipment items, and Arcflight data lives under `flags.arcflight.*`.

Reason: this preserves PF2E compatibility and avoids unnecessary custom actor/item types.

Affected systems:

- ship actors
- hulls
- arkengines
- rooms
- upgrades
- install helpers

## 2026-07-08 — Travel v2 remains GM-directed and session-local first

Decision: Travel v2 should not silently mutate actor/item/world state. Real application requires explicit GM review and apply paths.

Reason: Travel v2 needs safe table procedure, auditability, and clear separation between preview/review/session-local state and real Foundry document mutation.

Affected systems:

- Travel Event Runner
- pressure application
- hazards
- round finalization
- event completion
- outcome packages

## 2026-07-08 — Player-safe projection is mandatory

Decision: Player-facing Travel v2 state must be sanitized and must not expose GM-only/internal data.

Reason: hazards, audit records, apply payloads, secret text, and internal mutation targets can leak table information or implementation details.

Affected systems:

- Travel v2 player HUD
- mission board
- runner projections
- hazards
- follow-ups
- outcome review
