# Codex Task: Phase 7 — GM-approved actor/item application bridge

## Repository

`p1ng3r/arcflight`

## Base branch

`codex/phase-7-gm-approved-application-bridge`

## Purpose

Build the first safe bridge from completed Travel v2 event outcome packages to real Foundry actor/item updates.

This must be **GM-reviewed and GM-approved**. Nothing should mutate actors/items automatically just because an event completed.

Phase 6 created completed-event outcome packages and a session-local apply record. Phase 7 should add a preview-and-confirm application bridge that can apply a small, controlled subset of outcomes to a selected Arcflight ship / PF2E vehicle.

## Current foundation

Existing flow:

1. GM runs a Travel v2 event.
2. GM finalizes rounds.
3. GM completes the event.
4. Runner prepares an Event Outcome Package.
5. GM can apply the outcome package session-locally.
6. That currently records application state on the runner session only and does not mutate actors/items.

This task adds the next step: a GM-approved, explicit application bridge for real ship-facing changes.

## High-level goal

Add a review panel/action that converts a completed event outcome package into a clear list of proposed ship updates, then lets the GM approve and apply them to the chosen ship actor.

The first version should be conservative and reversible in design.

## Required UX

After a completed Travel v2 event has an outcome package available, the GM should see something like:

```text
GM Application Preview
```

The preview should clearly list:

- target ship actor
- proposed Hull changes, if any
- proposed Strain changes, if any
- proposed Lifeveil changes, if any
- proposed Morale changes, if any
- proposed Supplies changes, if supported by current state
- proposed Cargo changes, if supported by current state
- proposed Ship Scar candidates
- proposed Fortune candidates
- proposed Reward candidates
- proposed Consequence candidates
- anything not yet automatically supported, listed as GM manual follow-up

Then the GM should have an explicit action:

```text
Apply Approved Changes to Ship
```

This action must require an explicit click and must be blocked unless:

- event is completed
- outcome package exists
- a valid ship/PF2E vehicle actor is selected or bound to the session
- user is GM
- package has not already been applied to the actor bridge

## Absolutely required safety behavior

Do not automatically apply when:

- round is finalized
- event is completed
- package is prepared
- package is applied session-locally
- app renders
- app reloads

Real actor/item updates happen only after explicit GM confirmation.

## Scope for first implementation

Keep the first bridge narrow. Apply only safe current-state deltas that already exist in the actor flags/state model.

Preferred first supported applications:

- current strain delta
- current lifeveil delta
- current morale delta
- current supplies delta if the ship state already supports it clearly
- current cargo delta if the ship state already supports it clearly

If Hull/Hull Integrity application is already clearly represented in the ship current state, it may be included. If it is not clear, leave Hull as a GM manual follow-up in this phase.

Ship Scars / Fortune / Rewards / Consequences should initially be staged as review records or manual follow-up unless there is already a clear, safe flag location for them.

## Required helper design

Add pure helper(s) before wiring UI, for example:

```text
prepareTravelV2ActorApplicationPreview(packageRecord, actor, options)
applyTravelV2ActorApplicationPreview(actor, preview, options)
```

Names may vary, but the design should separate:

1. preview preparation
2. validation/block reasons
3. actual actor update execution

Preview helper should be pure or mostly pure and smoke-testable without Foundry runtime where possible.

Apply helper may need Foundry actor update behavior but should be wrapped so tests can inject a fake actor/update function.

## Data recording

When changes are applied to an actor, record a bridge application marker so duplicate application is blocked.

Record enough information to audit:

- event key/name
- session id/key if available
- outcome package version
- applied at timestamp
- applied by user id/name if available
- target actor id/name
- deltas applied
- manual follow-ups generated

Prefer storing this under existing Arcflight flags, e.g. `flags.arcflight.system.travelV2...`, consistent with current module flag style.

Do not create a new Actor type or Item type.

## Duplicate protection

The bridge must block applying the same package to the same actor twice.

It should return a clear blocked reason such as:

```text
This Travel v2 outcome package has already been applied to this ship.
```

If applying to a different actor, behavior should be conservative. Prefer blocking unless explicitly designed otherwise.

## UI integration

Wire into the Travel Event Runner preview/completion/outcome area.

The UI should show:

- preview status
- target ship status
- proposed changes
- unsupported/manual follow-ups
- blocked reasons
- Apply Approved Changes to Ship button
- applied status after success

If no valid actor target is available, explain that a PF2E vehicle / Arcflight ship actor is required.

## Boundaries

Do not:

- mutate actors before explicit GM approval.
- create/delete actors.
- create/delete items.
- create chat messages.
- create journals.
- emit sockets.
- change Travel v2 pressure math.
- change station outcome calculation.
- change event completion logic.
- change sample event prose.
- implement a full reward/scar item system yet.

Do:

- keep all real application choices visible to the GM.
- include blocked reasons.
- keep unsupported results as manual follow-up text.
- keep tests deterministic.

## Suggested manual follow-up handling

For any outcome package fields not safely supported yet, show them in a section like:

```text
Manual GM Follow-Up
```

Examples:

- Ship Scar Candidate: Echoes in the Rigging
- Fortune Candidate: True Bearing Remembered
- Consequence Candidate: Static Fingerprints
- Reward Candidate: Rescued Lantern Flame

These should not mutate actors/items in this phase unless there is an already-approved data location.

## Smoke tests

Add smoke coverage for:

1. Preview blocks when package is missing.
2. Preview blocks when actor is missing.
3. Preview blocks when actor is not an Arcflight/PF2E vehicle if such validation exists.
4. Preview lists supported deltas.
5. Preview lists unsupported fields as manual follow-up.
6. Apply blocks without GM permission if user context is available.
7. Apply updates only the expected actor flags/current state.
8. Apply records an audit/application marker.
9. Duplicate apply is blocked.
10. Session-local package application remains separate from actor application.
11. No chat/journal/socket/item side effects.
12. Aggregate Travel v2 smoke includes the new bridge tests.

Recommended runner:

```bash
node scripts/dev/run-travel-v2-actor-application-bridge-smoke.mjs
```

Update aggregate:

```bash
node scripts/dev/run-travel-v2-smoke.mjs
```

## Acceptance checks

Run:

```bash
node --check scripts/helpers/travel-v2-event-outcome-package.js
node --check scripts/helpers/travel-v2-session-event-outcome-application.js
node --check scripts/apps/travel-event-runner.js
node scripts/dev/run-travel-v2-actor-application-bridge-smoke.mjs
node scripts/dev/run-travel-v2-smoke.mjs
```

Add `node --check` for any new helper or smoke files.

## Expected Foundry result

A GM can complete a Travel v2 event, review the Event Outcome Package, see a GM Application Preview for the selected ship, and click Apply Approved Changes to Ship.

The ship actor is updated only after that explicit click.

The runner then shows that the package has been applied to the actor bridge and blocks duplicate application.

Any unsupported scars/fortunes/rewards/consequences remain visible as manual GM follow-up rather than silently disappearing or mutating unapproved data.
