# Codex Task: Phase 8 — Reward and consequence follow-up workflow

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-8-reward-consequence-followups`

## Purpose

Build the next layer after the Phase 7 GM-approved actor application bridge: a semi-automated, GM-approved workflow for end-of-event rewards, negatives, scars, fortunes, consequences, and other manual follow-up results.

Phase 7 applies only safe ship current-state deltas and stages unsupported results as manual follow-up. Phase 8 should turn those manual follow-ups into structured, selectable GM-reviewed actions without blindly mutating actors/items.

## Design goal

At the end of a Travel v2 event, the GM should not be left with a vague list of rewards/negatives. The system should present organized follow-up cards and let the GM choose what to keep, dismiss, mark resolved, or eventually apply.

This is **semi-automation**, not full automation.

## Current foundation

Phase 7 stores manual follow-ups in the actor application preview/audit record, including things like:

- Ship Scar Candidate
- Fortune Candidate
- Reward Candidate
- Consequence Candidate
- Hazard Candidate
- unsupported pressure/cargo/supply results

Phase 8 should provide a GM-facing management layer for those follow-ups.

## Required UX

After completing an event and preparing/applying the GM Application Preview, show a section like:

```text
End-of-Event Follow-Ups
```

It should group follow-ups by type:

```text
Ship Scars
Fortunes
Rewards
Consequences
Hazards / Lingering Threats
Unsupported Resource Changes
GM Notes
```

Each follow-up card should show:

- type
- title/name
- short narrative text
- source event/session
- source outcome
- current status
- supported actions

Supported first-version actions:

```text
Keep for Later
Mark Resolved
Dismiss
Add GM Note
```

Optional if already safe in current data model:

```text
Stage on Ship Record
```

Do not create items/effects/journal/chat unless explicitly designed and separately approved.

## Important boundaries

Do not:

- automatically create items.
- automatically create effects.
- automatically create journals.
- automatically send chat messages.
- automatically apply scars or rewards to actors without explicit GM approval.
- change Travel v2 scoring.
- change pressure math.
- change event completion logic.
- create custom Actor or Item types.

Do:

- structure follow-ups clearly.
- keep status records auditable.
- let the GM mark each follow-up as kept/resolved/dismissed.
- preserve source context.
- keep this deterministic and smoke-testable.

## Data model

Add or extend a safe flag record, preferably under existing Arcflight system flags:

```text
flags.arcflight.system.travelV2.followUps
```

Suggested shape:

```js
{
  version: 1,
  records: [
    {
      id,
      type,
      title,
      text,
      sourceEventKey,
      sourceEventName,
      sourceSessionKey,
      sourceOutcomeKey,
      sourceOutcomeLabel,
      sourcePackageKey,
      createdAt,
      updatedAt,
      status,
      note,
      originalValue
    }
  ]
}
```

Statuses:

```text
pending
kept
resolved
dismissed
```

Use stable IDs so re-rendering or repeated preview generation does not duplicate records.

## Helper design

Add pure helpers before UI wiring, for example:

```text
prepareTravelV2FollowUpRecordsFromActorApplication(previewOrApplicationRecord, options)
prepareTravelV2FollowUpState(actor, packageRecordOrApplicationRecord, options)
updateTravelV2FollowUpStatus(actor, followUpId, status, options)
```

Names can vary, but the design should separate:

1. extracting follow-up candidates
2. normalizing/deduplicating records
3. preparing UI state
4. applying explicit GM status updates

Application helper should support injectable actor update function for smoke tests.

## Duplicate protection

If a follow-up record already exists for the same event/session/package/type/title, do not create a duplicate.

Repeated render should not duplicate follow-ups.

Repeated Apply Approved Changes should not duplicate follow-ups.

## UI integration

Wire this into the Travel Event Runner completion/outcome area, near the GM Application Preview.

The GM should be able to:

- see grouped follow-up cards.
- mark a card kept/resolved/dismissed.
- add or edit a short GM note if easy and safe.
- see feedback after a status change.

If no follow-ups exist, display a clean empty state:

```text
No end-of-event follow-ups are pending for this outcome.
```

## Sample event improvement allowed

If `The Lantern in the Static` has no meaningful reward/consequence/scar/fortune candidates on its final outcome, add a small set so this workflow has something to show.

Examples:

- Ship Scar Candidate: Echoes in the Rigging
- Fortune Candidate: True Bearing Remembered
- Reward Candidate: Rescued Lantern Flame
- Consequence Candidate: Static Fingerprints

These should remain candidates/follow-ups unless explicitly applied by GM.

## Smoke tests

Add tests for:

1. Extracts follow-up candidates from a Phase 7 actor application preview/application record.
2. Groups by type.
3. Creates stable IDs.
4. Does not duplicate existing follow-ups.
5. Status update requires GM when user context exists.
6. Status update changes only expected follow-up flag data.
7. Dismiss/keep/resolve each work.
8. Missing actor blocks clearly.
9. Missing follow-up id blocks clearly.
10. Unsupported reward/consequence values are preserved as originalValue/manual data.
11. No actor/item/journal/chat/socket side effects.
12. Aggregate Travel v2 smoke includes the new follow-up suite.

Recommended runner:

```bash
node scripts/dev/run-travel-v2-followups-smoke.mjs
```

Update aggregate:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
```

## Acceptance checks

Run:

```bash
node --check scripts/helpers/travel-v2-actor-application-bridge.js
node --check scripts/apps/travel-event-runner.js
node scripts/dev/run-travel-v2-followups-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Add `node --check` for any new helper/smoke/app files.

## Expected Foundry result

After a Travel v2 event is completed and the GM reviews/applies approved ship deltas, the runner shows structured end-of-event follow-up cards for rewards and negatives.

The GM can keep, resolve, or dismiss each candidate. The system records the decision on the ship actor under Arcflight flags.

No items, effects, journals, chats, or sockets are created in this phase unless explicitly and safely implemented behind a separate GM-approved action.
