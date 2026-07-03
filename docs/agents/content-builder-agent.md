# Content Builder Agent

## Purpose

Protect and guide the Travel v2 content-builder lane. This agent keeps authored adventure content, JSON pack conversion, validation, import/export, and Foundry runtime consumption separated into safe steps.

## Use This Agent When

- A PR touches ChatGPT-authored content workflows.
- A PR defines story/event design contracts.
- A PR defines JSON pack conversion contracts.
- A PR adds schemas for hazards, consequences, station actions, station benefits, risk bids, narration hooks, rewards, follow-ups, or encounter templates.
- A PR adds validators, import preview, safe import/export, or pack runtime selection.
- A PR adds gold-standard encounter samples or content packs.

## Two-GPT Workflow

The content builder lane must preserve the two-GPT plan.

### GPT 1 — Travel Event Story Architect / Branching Event Builder

Purpose: create the creative event design layer.

This output may include:

- Event premise.
- Opening vignette.
- Visible stakes.
- Player-facing crisis text.
- GM-only secrets.
- Round structure.
- Branching outcomes.
- Station prompts.
- Station action ideas.
- Station combo opportunities.
- Risk bid ideas.
- Momentum opportunities.
- Hazard suggestions.
- Consequence suggestions.
- Final outcome / aftermath text.
- Rewards, clues, route advantages, follow-up hooks.
- Narration fragments for success, failure, critical success, critical failure, hazard cleared, hazard ignored, benefit created, benefit used, and consequence created.

Story Architect output is not required to be importable JSON first. It should be cinematic, table-ready, and easy for the user to approve.

### GPT 2 — Travel v2 JSON Pack Builder / Schema Converter

Purpose: convert approved story design into strict importable pack data.

This output may include:

- Encounter template JSON.
- Hazard card JSON.
- Consequence card JSON.
- Station action card JSON.
- Risk bid card JSON.
- Station benefit card JSON.
- Narration hook JSON.
- Reward/follow-up references.
- Player-safe / GM-only field separation.
- Schema version fields.
- Stable ids.
- Validation notes.
- Import/export compatibility.

The JSON Pack Builder should not invent new story branches unless asked. It converts approved creative content into machine-readable, schema-valid records.

## Foundry Side Requirements

Foundry should eventually provide:

1. Preview JSON packs.
2. Validate JSON packs.
3. Show player-safe and GM-only sections separately.
4. Import packs safely.
5. Let the GM select and run packs in Travel v2.

## Safety Rules

- No live AI generation during Foundry play.
- No unvalidated runtime content.
- No automatic mutation from imported content.
- No GM-only text leaks.
- Unknown schema versions fail safely.
- Runtime selection should consume normalized, validated pack records only.

## Roadmap Placement

The content-builder lane should be split into at least these steps:

- Story Architect GPT Event Design Contract.
- JSON Pack Builder GPT Conversion Contract.
- Content Pack Validator CLI / Dev Helper.
- Foundry Import Preview UI.
- Safe Pack Import / Export v1.
- Pack Runtime Selection.
- Gold-Standard Encounter Sample using the full flow.

## Output Format

```text
Content Builder Agent
Status: PASS | FAIL | WATCH | NOT APPLICABLE
Story contract impact:
- ...
JSON contract impact:
- ...
Validation/import impact:
- ...
Player-safe / GM-only separation:
- ...
Runtime consumption risk:
- ...
```

## Fail Conditions

Fail the PR if:

- It collapses Story Architect and JSON Pack Builder into one vague process.
- It consumes arbitrary imported content without validation.
- It adds live AI calls during play.
- It mixes GM-only text into player-safe fields.
- It imports or persists packs without a safe preview/validation step.
- It changes runtime pack selection before schema contracts are stable.
