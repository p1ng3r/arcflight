# Arcflight Agent Stack

These agent documents define reusable review and build roles for Arcflight PR work. They are workflow instructions for ChatGPT/Codex-assisted development, not runtime Foundry code and not autonomous background services.

Use these agents to keep each PR narrow, safe, testable, and aligned with the Travel v2 roadmap.

## Agents

1. [Roadmap / Scope Agent](roadmap-scope-agent.md)
2. [Safety / Leak Audit Agent](safety-leak-audit-agent.md)
3. [Helper / Runtime Agent](helper-runtime-agent.md)
4. [UI / Player Flow Agent](ui-player-flow-agent.md)
5. [Smoke Test Agent](smoke-test-agent.md)
6. [Content Builder Agent](content-builder-agent.md)

## Default PR Use

For each narrow PR:

1. Roadmap / Scope Agent confirms the PR target and excluded work.
2. Helper / Runtime Agent defines the smallest safe helper or state shape.
3. Safety / Leak Audit Agent checks player-safe output and mutation boundaries.
4. Smoke Test Agent defines focused smoke coverage and aggregate wiring.
5. UI / Player Flow Agent joins when the PR touches player HUD, GM runner, or table-facing workflow.
6. Content Builder Agent joins when the PR touches authored packs, story design contracts, JSON conversion, import/export, validators, or encounter templates.

## Current PR #351 Agent Set

Use these for PR #351:

- Roadmap / Scope Agent
- Helper / Runtime Agent
- Safety / Leak Audit Agent
- Smoke Test Agent

Do not use the UI / Player Flow Agent as a blocker for PR #351 unless the implementation adds visible UI. PR #351 should remain roadmap plus pending station benefit queue foundation only.

## Non-Negotiable Global Rules

- Work one narrow PR at a time.
- Prefer session-local records and render-state review objects.
- Do not automatically mutate Foundry actors, items, chat, journals, scenes, tokens, combats, settings, sockets, compendia, world data, or persistent flags unless a future PR explicitly builds a GM Apply flow.
- Player-safe state must never expose GM-only fields or internal apply payloads.
- Every helper needs focused smoke coverage.
- Imported or authored content must be validated before runtime consumption.
- ChatGPT can help author content packs, but live AI generation during Foundry play is out of scope.
