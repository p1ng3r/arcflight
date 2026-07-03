# Foundry / PF2E System Compatibility Agent

## Purpose

Use this agent to keep Arcflight compatible with Foundry VTT and the PF2E system while preventing accidental reliance on private, unavailable, or version-fragile APIs.

This agent checks API shape, runtime layer, PF2E assumptions, and compatibility boundaries. It does not replace the Safety / Leak Audit Agent. Safety asks whether something is allowed to mutate or leak. This agent asks whether the code is using Foundry and PF2E APIs correctly for the current Arcflight target.

## Use This Agent When

Use this agent whenever a PR touches any of these areas:

- `scripts/apps/**`
- `scripts/arcflight.js`
- `scripts/dev/dev-tools.js`
- templates, application state, or UI render state
- Foundry runtime globals such as `game`, `ui`, `canvas`, `Hooks`, `socket`, `ChatMessage`, `JournalEntry`, `Actor`, or `Item`
- actor or item data paths
- PF2E actor assumptions
- PF2E item assumptions
- vehicle actor behavior
- equipment item behavior
- roll/check/DC integration
- settings, sockets, chat messages, journals, scenes, tokens, combats, compendia, world data, or persistent flags

For pure helper-only PRs that do not touch app/runtime surfaces, this agent can be `WATCH` or `NOT APPLICABLE`, but the PR should say why.

## Arcflight Compatibility Baseline

Arcflight currently treats:

- PF2E vehicle actors as Arcflight ships.
- PF2E equipment items as Arcflight components.
- Arcflight-specific data as `flags.arcflight.*`.
- Helper modules as Node-smoke-safe pure logic unless explicitly documented otherwise.
- App/runtime modules as the correct layer for Foundry globals, UI state, and future document operations.

Do not replace these assumptions without an explicit roadmap PR.

## Foundry Core Checks

Ask:

1. Does this PR introduce Foundry globals into helper files that are expected to run under Node smoke tests?
2. Are runtime global references guarded to Foundry app/runtime layers?
3. Does app state preparation remain safe when `game`, `canvas`, or `ui` are unavailable?
4. Does the code avoid automatic document writes unless the current PR explicitly allows a GM Apply flow?
5. If document writes are allowed in a future PR, are they isolated behind explicit user action and correct Foundry document APIs?
6. Are settings, sockets, chat, journal, scene, token, combat, and compendium operations absent unless explicitly scoped?
7. Are exported module APIs read-only unless the PR is explicitly an apply/mutation PR?
8. Are templates or UI rows consuming fields that actually exist in render state?
9. Are Foundry version assumptions documented when a new API is introduced?
10. Do smoke tests cover missing Foundry globals when the code is intended to run in Node?

## PF2E System Checks

Ask:

1. Does the PR preserve the PF2E vehicle actor = Arcflight ship model?
2. Does the PR preserve the PF2E equipment item = Arcflight component model?
3. Are PF2E-specific data paths optional/guarded instead of assumed blindly?
4. Are PF2E actor/item reads tolerant of missing `system` data?
5. Are flags written or read under `flags.arcflight.*`, not mixed into PF2E-owned system data?
6. Does the PR avoid importing PF2E private internals unless there is an existing safe repo pattern?
7. If roll/check/DC behavior is touched, does the PR use public/stable interfaces or keep changes review-only until verified?
8. Are compendium/content assumptions separated from runtime logic?
9. Does player-safe state avoid exposing PF2E internal data that is not meant for players?
10. Is any PF2E API or data model assumption covered by smoke or documented as `WATCH`?

## Public Reference Rule

When a PR touches PF2E actor/item/roll/check assumptions and the correct pattern is uncertain, inspect the public `foundryvtt/pf2e` repository as an API and structure reference.

Use it to understand patterns, not to copy licensed game content or pack data into Arcflight.

Important rule: do not blindly copy the PF2E repository's active development branch if Arcflight is targeting a different Foundry/PF2E version. Mark version-sensitive findings as `WATCH` until confirmed.

## Version-Sensitivity Labels

Use these labels in the agent output:

- `PASS`: compatible with Arcflight's current supported target and safe layer boundaries.
- `WATCH`: appears compatible but depends on a version-sensitive Foundry/PF2E behavior or future PR scope.
- `FAIL`: uses an unavailable, private, unsafe, or wrong-layer Foundry/PF2E API.

## Red Flags

Fail the PR if it:

- Imports Foundry/PF2E runtime objects into pure helper modules without guards.
- Adds automatic actor/item/chat/journal/scene/token/combat/settings/socket/compendium/world mutation outside an explicit apply PR.
- Writes Arcflight state into PF2E-owned `system` paths instead of `flags.arcflight.*`.
- Assumes a PF2E actor/item shape without null guards.
- Adds UI controls that call nonexistent actions or imply a mutation that does not exist.
- Uses a PF2E private/internal module path without justification.
- Breaks Node smoke tests by requiring Foundry globals.
- Copies PF2E content/pack data instead of referencing API patterns.

## Output Format

```md
### Foundry / PF2E System Compatibility Agent

Status: PASS / FAIL / WATCH

Scope checked:
- Foundry runtime layer:
- PF2E actor/item assumptions:
- Node smoke safety:
- Version-sensitive APIs:

Findings:
- ...

Required fixes:
- ...

Deferred WATCH items:
- ...
```

## PR #352 Expectations

For PR #352, this agent is required because the PR may touch player-facing app/render state.

Expected PASS conditions:

- The display/use-review helper remains pure and Node-smoke-safe.
- Any Foundry globals remain in app/runtime files only.
- Player-facing state consumes #351 queue data without relying on PF2E private internals.
- No roll/check/DC/PF2E document mutation is introduced.
- Any visible control is request/review-only and wired to existing app-state patterns.
- Smoke tests prove missing/empty state is safe.
