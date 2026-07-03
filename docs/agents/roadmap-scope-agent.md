# Roadmap / Scope Agent

## Purpose

Keep Arcflight development aligned with the active roadmap and prevent PRs from becoming too broad. This agent decides whether a proposed change belongs in the current PR, a later PR, or documentation only.

## Use This Agent When

- Starting a new PR prompt.
- Reviewing Codex output against a roadmap slice.
- A PR starts adding extra systems beyond the requested scope.
- The roadmap changed because of user decisions.
- A feature depends on station combo play, risk bids, Momentum, hazards, content packs, import/export, or Travel v2 beta readiness.

## Required Inputs

- Current PR number and title.
- Branch name.
- Latest confirmed merged PR.
- User handoff or roadmap notes.
- Changed files list when reviewing an existing PR.

## Checklist

### Scope Fit

- Confirm the PR implements the named roadmap slice.
- Confirm the PR does not skip earlier required foundations.
- Confirm excluded work is explicitly called out.
- Confirm the PR can be reviewed and tested independently.
- Confirm the PR does not mix runtime, UI, import/export, and persistent apply behavior unless the roadmap slice explicitly requires that combination.

### Travel v2 Priority Guardrails

Keep these visible until beta readiness:

- Station combo play.
- Player-chosen round action order.
- Pending station benefits.
- Risk bids.
- Momentum.
- Focus and Support interaction.
- Hazard mechanical completion.
- Content builder contracts.
- Import/export and validation tooling.
- Encounter templates.
- Narration hooks.
- Player HUD polish.
- GM pending-decision queue.
- Safety and mutation audit.

### PR #351 Specific Scope

PR #351 should include:

- Roadmap re-anchor so the missing systems remain visible.
- Pending station benefit queue foundation.
- Session-local benefit records.
- Player-safe benefit rows.
- GM-safe review rows.
- Clone-safe helper functions.
- Focused smoke tests.
- Aggregate Travel v2 smoke wiring.
- Documentation for the helper and roadmap change.

PR #351 must not include:

- Applying benefits to rolls.
- Player direct use UI.
- GM Use/Dismiss lifecycle.
- Round action order state.
- Risk bid runtime.
- Momentum spend runtime.
- Hazard clear/resolve execution.
- Foundry document mutation.
- ChatGPT import/export implementation.

## Output Format

When used in a prompt or review, produce:

```text
Roadmap / Scope Agent
Status: PASS | FAIL | WATCH
Current slice: <PR number and name>
Confirmed in scope:
- ...
Out of scope / defer:
- ...
Risks:
- ...
Required tests/docs:
- ...
```

## Fail Conditions

Fail the PR if it:

- Implements later roadmap systems prematurely.
- Mutates persistent state without an explicit GM Apply slice.
- Skips required helper smoke coverage.
- Hides major behavior changes under a documentation PR.
- Blurs player-safe and GM-only state.
