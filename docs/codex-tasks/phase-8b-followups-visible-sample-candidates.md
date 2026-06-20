# Codex Task: Phase 8B — Follow-up visibility and sample candidates fix

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-8b-followups-visible-sample-candidates`

## Why this fix exists

After Phase 8 merged, Foundry testing showed the GM could not find the expected follow-up workflow:

- No visible **End-of-Event Follow-Ups** section.
- No follow-up cards.
- No GM note field.
- No clear reward/negative candidates after completing `The Lantern in the Static`.

Phase 8 added the structure, but the actual table result is not usable yet. This phase must make the feature visible and testable in Foundry.

## Expected user-facing behavior

After a Travel v2 event is completed, the runner must clearly show an **End-of-Event Follow-Ups** section near the outcome/GM application area.

The section should be visible even when no follow-up records are persisted yet.

If follow-ups are not available yet, the UI must explain why, for example:

```text
No follow-up records have been saved yet. Apply Approved Changes to Ship to save reward and consequence follow-ups, or review the outcome package for manual follow-up candidates.
```

If the selected event/outcome has follow-up candidates, the section should show cards.

For `The Lantern in the Static`, completing the event should produce visible follow-up candidates such as:

- Ship Scar Candidate: Echoes in the Rigging
- Fortune Candidate: True Bearing Remembered
- Reward Candidate: Rescued Lantern Flame
- Consequence Candidate: Static Fingerprints

These should appear as cards in the **End-of-Event Follow-Ups** section after the event is completed and should persist after **Apply Approved Changes to Ship**.

## Required fixes

### 1. Make the panel visible

The **End-of-Event Follow-Ups** UI must be visible in the runner when Travel v2 preview/completion state is visible.

Do not hide the whole section merely because `hasRecords` is false.

Show an empty/help state when there are no follow-ups.

### 2. Add real sample follow-up candidates

If `The Lantern in the Static` does not currently define final outcome reward/consequence/scar/fortune candidates, add them.

At minimum, the sample event should include candidate data that can flow into Phase 8 follow-up cards:

```text
Ship Scar Candidate: Echoes in the Rigging
Fortune Candidate: True Bearing Remembered
Reward Candidate: Rescued Lantern Flame
Consequence Candidate: Static Fingerprints
```

Use good short narrative text for each.

These are candidates/follow-ups only. Do not auto-create items/effects/journals/chat.

### 3. Feed follow-up state from completed outcome package

The follow-up state should be able to read candidates from the completed outcome package / final outcome, even before actor application has persisted records.

Expected behavior:

- Before Apply Approved Changes to Ship: show available candidates as preview cards or clearly staged candidates.
- After Apply Approved Changes to Ship: persist those candidates under the ship actor follow-up flags.
- After persistence: Keep/Resolve/Dismiss/GM Note should work against actor-stored records.

If status actions are not available until persistence, disable them or show text saying:

```text
Apply Approved Changes to Ship before updating follow-up status.
```

Do not show clickable status buttons that simply fail because the record was not found.

### 4. Improve empty state wording

Replace any silent absence with clear text.

Bad:

```text
[section not present]
```

Good:

```text
End-of-Event Follow-Ups
No end-of-event follow-ups are pending for this outcome.
```

Better when candidates are staged but not persisted:

```text
End-of-Event Follow-Ups
These candidates are ready to save to the ship. Apply Approved Changes to Ship to persist them, then add GM notes or mark them kept/resolved/dismissed.
```

## Boundaries

Do not:

- create items.
- create active effects.
- create journals.
- send chat messages.
- emit sockets.
- auto-apply reward/scar/consequence results without GM approval.
- change pressure math.
- change Travel v2 scoring.
- change event completion rules unless required to expose selected outcome candidates.

Do:

- keep everything GM-reviewed.
- keep candidates visible.
- keep status actions safe.
- keep follow-up records deduped.
- keep smoke tests deterministic.

## Smoke tests

Add or update smoke tests to prove:

1. The preview panel state includes a follow-ups section/state even when there are no persisted records.
2. The empty/help text is present when no follow-ups exist.
3. `The Lantern in the Static` sample includes meaningful follow-up candidates for at least one final outcome.
4. Completed `The Lantern in the Static` produces follow-up candidates in preview state.
5. Staged candidates are visible before persistence.
6. Status buttons/actions are disabled or blocked with a useful reason before persistence.
7. After Apply Approved Changes to Ship, follow-up records persist to actor flags.
8. After persistence, Keep for Later / Mark Resolved / Dismiss / GM Note updates work.
9. Re-rendering does not duplicate follow-up records.
10. No item/effect/journal/chat/socket side effects occur.

Update aggregate smoke:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
```

## Acceptance checks

Run:

```bash
node --check data/travel-events/sample-travel-v2-events.js
node --check scripts/helpers/travel-v2-followups.js
node --check scripts/helpers/travel-v2-actor-application-bridge.js
node --check scripts/apps/travel-event-runner-v2-preview-panel.js
node --check scripts/apps/travel-event-runner.js
node scripts/dev/run-travel-v2-followups-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Add node checks for any new/changed smoke or helper files.

## Expected Foundry result

A GM completes `The Lantern in the Static` and can visibly find:

```text
End-of-Event Follow-Ups
```

The section includes follow-up cards for the sample event’s reward/negative candidates, or a clear empty/help state explaining what must happen next.

After **Apply Approved Changes to Ship**, those cards persist to the ship actor. The GM can add notes and mark cards kept, resolved, or dismissed.
