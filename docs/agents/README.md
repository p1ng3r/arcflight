# Arcflight Agent Stack

Status: workflow guidance for assisted development.

These agent documents define reusable review and build roles for Arcflight PR work. They are workflow instructions for ChatGPT/Codex-assisted development, not runtime Foundry code, not autonomous background services, and not source-of-truth roadmap documents.

When agent instructions conflict with the canonical docs spine, follow the canonical docs spine:

1. `../DOCS-INDEX.md` — documentation entry point and source-of-truth order.
2. `../ARCFLIGHT-BIBLE.md` — canonical project design, locked rules, and system overview.
3. `../ROADMAP.md` — canonical development roadmap and phase order.
4. `../TODO.md` — canonical active task list.
5. `../TRAVEL-V2.md` — canonical Travel v2 design and implementation reference.

## Agents

1. [Roadmap / Scope Agent](roadmap-scope-agent.md)
2. [Safety / Leak Audit Agent](safety-leak-audit-agent.md)
3. [Helper / Runtime Agent](helper-runtime-agent.md)
4. [UI / Player Flow Agent](ui-player-flow-agent.md)
5. [Foundry / PF2E System Compatibility Agent](foundry-pf2e-api-agent.md)
6. [Smoke Test Agent](smoke-test-agent.md)
7. [Content Builder Agent](content-builder-agent.md)

## Default PR Use

For each narrow PR:

1. Roadmap / Scope Agent confirms the PR target and excluded work.
2. Helper / Runtime Agent defines the smallest safe helper or state shape.
3. Foundry / PF2E System Compatibility Agent checks Foundry runtime layering, PF2E actor/item assumptions, Node smoke safety, and version-sensitive API usage when runtime or system-facing code is touched.
4. Safety / Leak Audit Agent checks player-safe output and mutation boundaries.
5. Smoke Test Agent defines focused smoke coverage and aggregate wiring.
6. UI / Player Flow Agent joins when the PR touches player HUD, GM runner, or table-facing workflow.
7. Content Builder Agent joins when the PR touches authored packs, story design contracts, JSON conversion, import/export, validators, or encounter templates.

## Non-Negotiable Global Rules

- Work one narrow PR at a time.
- Prefer session-local records and render-state review objects.
- Do not automatically mutate Foundry actors, items, chat, journals, scenes, tokens, combats, settings, sockets, compendia, world data, or persistent flags unless a documented GM Apply flow explicitly allows it.
- Player-safe state must never expose GM-only fields or internal apply payloads.
- Keep pure helpers Node-smoke-safe and free of unguarded Foundry globals.
- Preserve the Arcflight model: PF2E vehicle actors are ships, PF2E equipment items are components, and Arcflight data lives under `flags.arcflight.*`.
- Every runtime helper needs focused smoke coverage when practical.
- Imported or authored content must be validated before runtime consumption.
- ChatGPT can help author content packs, but live AI generation during Foundry play is out of scope.
