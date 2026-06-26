# Travel v2 Card Schema Plan

Travel v2 card content should be data-driven, versioned, validated, importable, and safe to expose to players through explicit sanitizers. This document is a planning document only and does not implement runtime schemas.

This plan defines intended permanent data shapes for future Travel v2 content. It is documentation-only: no runtime schemas, imports, migrations, compendium packs, sanitizer changes, behavior changes, or automatic persistent mutation are introduced here.

## Shared Schema Principles

- All card records must have stable ids.
- All card records must have a `schemaVersion`.
- Player-facing text must be separate from GM-only text.
- Persistent Foundry mutation must never happen automatically.
- Session-local payloads are allowed.
- Explicit GM Apply payloads may be described, but only executed by future GM Apply flows.
- Card records should be importable/exportable later.
- Cards should support validation before import.
- Runtime code should consume normalized records rather than raw loose objects.
- Unknown schema versions should fail safely.
- Missing optional text should degrade gracefully.
- GM-only notes must not leak to player HUD or player narration.
- Card schema design should support future compendium/import tooling.

## Shared Text Field Conventions

Travel v2 cards should use consistent text fields so player-safe output can be sanitized without guessing which fields are secret.

Planned shared text fields:

- `title`: Short display name for the card.
- `subtitle`: Optional supporting label or flavorful subheading.
- `publicText`: Player-facing rules or fiction text safe for HUD, chat summaries, and visible stakes.
- `gmText`: GM-only guidance, hidden mechanics, adjudication notes, secrets, or follow-up hooks.
- `playerSafeSummary`: Compact summary safe to show in pending decisions, player HUD, or public recap.
- `gmSummary`: Compact GM-only summary for queues, prep, and apply review.

Planned narration hook fields:

- `onDeclare`
- `onSuccess`
- `onCriticalSuccess`
- `onFailure`
- `onCriticalFailure`
- `onBenefitCreated`
- `onBenefitUsed`
- `onConsequenceCreated`
- `onHazardCleared`
- `onHazardIgnored`

Narration hooks are authored text fragments. They are not live AI generation, do not call external services, and should remain safe, inspectable content that future UI or chat flows can select from deterministic card data.

## Planned Hazard Card Schema

Hazard cards represent active travel problems that change station choices, create pressure, require responses, or threaten future consequence candidates.

Planned fields:

- `id`: Stable card id.
- `schemaVersion`: Version for this hazard shape.
- `type`: `hazard`.
- `title`: Hazard name.
- `category`: One of `navigation`, `engine`, `hull`, `lifeveil`, `crew`, `cargo`, `supplies`, `occult`, `threat`, or `route`.
- `severity`: One of `minor`, `major`, or `severe`.
- `triggerSources`: Authored references to encounter starts, failed actions, unresolved hazards, pressure thresholds, or other triggers.
- `publicText`: Player-safe explanation of what the hazard visibly threatens.
- `gmText`: GM-only handling notes, hidden options, or escalation context.
- `immediateEffects`: Session-local effects or pressure changes created when the hazard appears.
- `stationImpacts`: Station-specific DC changes, locked options, required actions, or altered stakes.
- `responseActions`: Actions or station responses that can suppress, clear, or mitigate the hazard.
- `clearCondition`: What removes the hazard from the active encounter.
- `suppressionCondition`: What temporarily prevents the hazard from applying without fully clearing it.
- `unresolvedConsequenceRefs`: Consequence ids that may be offered if the hazard remains unresolved.
- `escalationRefs`: Hazard or consequence ids used if the hazard worsens.
- `narration`: Authored narration hook fragments.
- `tags`: Search, filtering, import, and balancing tags.

Existing hazard deck concepts should be preserved: a shared generic deck, active modifiers, response actions, clear progress, unresolved consequences, player-safe display, and no automatic mutation. Hazards should have real gameplay impact instead of only adding pressure to the same track that triggered them.

## Planned Consequence Card Schema

Consequence cards define authored fallout options. They are separate from runtime consequence candidate records.

Planned fields:

- `id`: Stable card id.
- `schemaVersion`: Version for this consequence shape.
- `type`: `consequence`.
- `title`: Consequence name.
- `severity`: One of `minor`, `major`, or `severe`.
- `source`: Authored source category such as hazard, pressure overflow, station failure, failed Support, Focus backlash, final outcome, or GM move.
- `affectedTrack`: Track, station, ship area, or campaign vector affected by the consequence.
- `publicText`: Player-safe consequence description.
- `gmText`: GM-only adjudication and follow-up notes.
- `playerSafeSummary`: Compact public queue text.
- `applyEffectSummary`: Human-readable summary of what applying the consequence would do.
- `sessionLocalEffect`: Optional temporary effect for the current encounter only.
- `explicitGmApplyEffect`: Optional persistent payload for future GM Apply flows only.
- `status`: Runtime status values are expected to be `pending`, `applied`, `dismissed`, or `deferred`.
- `narration`: Authored narration hook fragments.
- `tags`: Search, filtering, import, and balancing tags.

Authored consequence definitions are not runtime consequence candidates. Future runtime records should reference consequence card ids and hold session-specific status, source metadata, affected targets, and GM-only notes. Persistent changes must only occur through explicit future GM Apply flows.

## Planned Station Action Card Schema

Station action cards define actions available to Travel v2 stations and the possible outcomes of rolling them.

Planned fields:

- `id`: Stable card id.
- `schemaVersion`: Version for this station action shape.
- `type`: `stationAction`.
- `stationKey`: One of `captain`, `navigator`, `engineer`, `veilwarden`, or `watchmaster`.
- `title`: Action name.
- `actionMode`: One of `objective`, `stabilize`, `repair`, `support`, `focus`, `hazardResponse`, `combo`, `momentum`, or `aftermath`.
- `skillOptions`: Allowed skills or checks for this action.
- `baseDcPolicy`: Authored DC baseline, scaling rule, or encounter-provided DC policy.
- `publicText`: Player-safe description of the action.
- `gmText`: GM-only adjudication notes.
- `success`: Authored success outcome.
- `criticalSuccess`: Authored critical success outcome.
- `failure`: Authored failure outcome.
- `criticalFailure`: Authored critical failure outcome.
- `createsBenefitRefs`: Station benefit ids that this action may create.
- `createsConsequenceRefs`: Consequence ids that this action may create as candidates.
- `riskBidRefs`: Risk bid ids eligible for this action.
- `narration`: Authored narration hook fragments.
- `tags`: Search, filtering, import, and balancing tags.

Support remains special:

- Support does not count as main objective progress.
- Support does not award Momentum.
- Support assists do not automatically mutate rolls.
- Failed Support creates GM-controlled candidates only.

## Planned Risk Bid Schema

Risk bid cards define optional, pre-roll stakes increases with fixed DC adjustments and authored outcomes.

Planned fields:

- `id`: Stable card id.
- `schemaVersion`: Version for this risk bid shape.
- `type`: `riskBid`.
- `title`: Risk bid name.
- `dcIncrease`: Fixed increase only: `+2`, `+5`, or `+10`.
- `declareBeforeRoll`: `true`.
- `eligibleStationActions`: Station action ids, station keys, action modes, or tags allowed to use this bid.
- `successBenefits`: Benefits or outcome improvements on success.
- `criticalSuccessBenefits`: Benefits or outcome improvements on critical success.
- `failureConsequenceRefs`: Consequence ids offered on failure.
- `criticalFailureConsequenceRefs`: Consequence ids offered on critical failure.
- `publicText`: Player-safe bid description.
- `gmText`: GM-only adjudication notes.
- `narration`: Authored narration hook fragments.
- `tags`: Search, filtering, import, and balancing tags.

Guardrails:

- No freeform DC bidding.
- Fixed DC increases only.
- One risk bid per action unless explicitly allowed.
- Benefits should affect station DCs, hazard progress, pressure relief, Momentum, final outcome, or consequence prevention.
- Avoid same-track pressure treadmill effects.

## Planned Station Benefit Card Schema

Station benefit cards support Station Combo Play and Round Action Order by creating visible, session-local openings for later station rolls.

Planned fields:

- `id`: Stable card id.
- `schemaVersion`: Version for this station benefit shape.
- `type`: `stationBenefit`.
- `title`: Benefit name.
- `sourceStation`: Station that created the benefit.
- `targetStation`: Station intended to use the benefit.
- `benefitKind`: One of `dcReduction`, `hazardIgnore`, `riskBidDiscount`, `backlashShield`, `unlockAction`, `momentumOption`, or `clearProgress`.
- `magnitude`: Numeric or enumerated strength, where applicable.
- `expires`: One of `afterUse`, `endOfRound`, or `endOfEvent`.
- `stackingPolicy`: Explicit stacking rule.
- `publicText`: Player-safe benefit description.
- `gmText`: GM-only adjudication notes.
- `narration`: Authored narration hook fragments.
- `tags`: Search, filtering, import, and balancing tags.

Guardrails:

- Session-local only.
- Usually expires after use or end of round.
- Only one pending station benefit should affect a single station roll unless explicitly allowed.
- DC reductions usually cap at -3.
- Must be visible in one Pending Decisions queue.

## Planned Encounter Template Schema

Encounter templates define reusable Travel v2 event structures without hardcoding content into runner logic.

Planned fields:

- `id`: Stable template id.
- `schemaVersion`: Version for this encounter template shape.
- `type`: `travelEncounter`.
- `title`: Encounter name.
- `category`: Encounter family, route type, threat type, or pacing role.
- `openingVignette`: Authored public opening text and optional GM setup.
- `visibleStakes`: Player-safe stakes summary.
- `roundCount`: Expected number of rounds or countdown length.
- `activeStations`: Stations participating in the encounter.
- `stationActionRefs`: Station action ids available in this encounter.
- `startingHazardRefs`: Hazard ids active at encounter start.
- `hazardDeckPolicy`: Deck, draw, replacement, and escalation rules.
- `pressureTracks`: Encounter pressure tracks and danger thresholds.
- `successOutcome`: Player-safe and GM outcome text for success.
- `failureOutcome`: Player-safe and GM outcome text for failure.
- `finalOutcomeBranches`: Authored branches for mixed outcomes, critical outcomes, unresolved hazards, or pressure thresholds.
- `aftermath`: Follow-up text, consequence candidates, reward hooks, or GM Apply review notes.
- `rewardRefs`: Reward, clue, route advantage, or opportunity references.
- `followUpRefs`: Future encounter, threat, consequence, or campaign hook references.
- `narration`: Authored narration hook fragments.
- `tags`: Search, filtering, import, and balancing tags.

Visible stakes should include:

- Event goal.
- Round count.
- Current pressure.
- Danger thresholds.
- Known hazards.
- Success result.
- Failure result.
- Escalation risk.
- Current pending decisions.

## Planned Runtime Record Separation

Authored card definitions are not the same as runtime records. Definitions should remain reusable, versioned content. Runtime records should represent one active encounter session and may contain session-local state.

Examples of this separation:

- Hazard card definition versus active hazard record.
- Consequence card definition versus pending consequence candidate.
- Station action card definition versus station roll result.
- Station benefit card definition versus pending station benefit.
- Encounter template versus active encounter session.

Runtime records should hold:

- Source card id.
- Session id / encounter id.
- Current status.
- Source station or source trigger.
- Target station if any.
- Round number.
- Use/dismiss/apply lifecycle state.
- Player-safe summary.
- GM-only data.

Runtime records may hold temporary payloads for current encounter play. They must not automatically mutate Foundry actors, items, scenes, tokens, flags, or compendium content unless a future explicit GM Apply flow executes an authored persistent payload.

## Planned Folder/File Organization

Suggested future structure:

```text
data/travel-v2/hazards/
data/travel-v2/consequences/
data/travel-v2/station-actions/
data/travel-v2/risk-bids/
data/travel-v2/station-benefits/
data/travel-v2/encounters/
schemas/travel-v2/
scripts/dev/validate-travel-v2-cards.mjs
```

This PR should not create those runtime data folders unless they are purely docs examples. Prefer not to create runtime data files yet. Future folders should be introduced only when validation, import, and runtime consumption rules are ready.

## Validation and Import Planning

Future validation should check:

- Required fields are present.
- Allowed enum values are used.
- `schemaVersion` values are compatible with the current importer/normalizer.
- Player-safe text is separated from GM-only text.
- Referenced card ids exist.
- GM-only text does not appear in player fields.
- Automatic mutation payloads do not exist outside explicit GM Apply sections.
- Risk bids use fixed DC values.
- Station benefit stacking policies are explicit.
- Hazards include real gameplay impact, not just pressure gain.

Future import should normalize records before runtime consumption, reject unknown schema versions safely, report missing references clearly, and produce player-safe output through explicit sanitizers rather than by passing raw card data directly to player UI.

## Non-Implementation Notes

This document intentionally does not add:

- Runtime schemas.
- Imports or exports.
- Validation scripts.
- Migrations.
- Compendium packs.
- Runtime data folders.
- Helper refactors.
- Player sanitizer changes.
- Focus, Support, Momentum, Hazard, or consequence behavior changes.
- Automatic mutation.
