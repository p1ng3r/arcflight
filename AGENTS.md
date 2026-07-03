# Arcflight Agent Guardrails

This file is the root Codex entrypoint for Arcflight development. Codex and ChatGPT-assisted work should read this file first, then follow the detailed agent workflow in `docs/agents/README.md`.

## Current Travel v2 Workflow

For every narrow Travel v2 PR:

1. Read `docs/agents/README.md`.
2. Select the agents listed for the current PR.
3. Follow each selected agent checklist while implementing.
4. Add an `Agent Checks` section to the PR body.
5. Do not mark a PR complete unless all required agents are `PASS` or any `WATCH` item is clearly explained and deferred.

## PR #352 Required Agents

For `codex/pr352-player-station-benefit-display`, use:

- `docs/agents/roadmap-scope-agent.md`
- `docs/agents/helper-runtime-agent.md`
- `docs/agents/ui-player-flow-agent.md`
- `docs/agents/foundry-pf2e-api-agent.md`
- `docs/agents/safety-leak-audit-agent.md`
- `docs/agents/smoke-test-agent.md`

The Content Builder Agent is only required if content-builder, JSON pack, import/export, validator, or authored pack behavior is changed.

## Future PR Agent Rule

All future Codex prompts should consider whether `docs/agents/foundry-pf2e-api-agent.md` is required.

Require the Foundry / PF2E System Compatibility Agent when a PR touches app/runtime files, UI render state, templates, module exports, Foundry globals, PF2E actor/item assumptions, roll/check/DC behavior, settings, sockets, chat, journals, scenes, tokens, combats, compendia, world data, or persistent flags.

For pure helper-only PRs with no Foundry/PF2E runtime assumptions, mark it `WATCH` or `NOT APPLICABLE` and explain why.

## PR #351 Required Agents

For `codex/pr351-roadmap-benefit-queue`, use:

- `docs/agents/roadmap-scope-agent.md`
- `docs/agents/helper-runtime-agent.md`
- `docs/agents/safety-leak-audit-agent.md`
- `docs/agents/smoke-test-agent.md`

The UI / Player Flow Agent is only required if visible UI is added.

The Content Builder Agent is only required if content-builder, JSON pack, import/export, validator, or authored pack behavior is changed.

## Travel v2 Safety Reminder

Do not automatically mutate Foundry actors, items, chat, journals, scenes, tokens, combats, settings, sockets, compendia, world data, or persistent flags unless the current PR explicitly builds a GM Apply flow.

Player-safe state must not expose GM-only fields or internal apply payloads.

Pure helper files should remain Node-smoke-safe and should not import or require unguarded Foundry globals.

Preserve the Arcflight model: PF2E vehicle actors are ships, PF2E equipment items are components, and Arcflight data lives under `flags.arcflight.*`.

## Legacy Phase 0 Guardrails

These older project guardrails are kept for historical context and should still be respected when relevant, but the current active work is Travel v2.

- Do not hardcode content into UI logic.
- Future architecture should be compendium/data-driven.
- Keep code Foundry-safe for the current supported compatibility target.
- Prefer small, reviewable commits.
- Avoid broad automation before data architecture exists.

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
