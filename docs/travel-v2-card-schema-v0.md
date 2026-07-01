# Travel v2 Card Schema v0

## Purpose

Travel v2 Card Schema v0 defines permanent authored card shapes for future importer, exporter, validation, fixture, and content-authoring work while preserving current Travel v2 runner behavior. v0 is a data-only contract: no runner, builder, importer UI, compendium, migration, sanitizer, or gameplay behavior consumes these definitions in play yet.

## Shared Card Principles

- Every card has a stable `id` that can be referenced by future packs, imports, and runtime records.
- Every card has a `schemaVersion`; v0 uses `travel-v2-card-schema-v0`.
- Every card has a `type` and `title`.
- Player-safe fields are explicit and separate from GM-only fields.
- GM-only fields are explicit and must not be sent raw to player UI.
- Authored cards never perform automatic persistent mutation.
- Unknown schema versions fail safely during validation.
- Authored definitions are separate from runtime records.
- Imports and validators normalize card definitions before any future runtime use.
- Player UI must never receive raw GM-only card data; future sanitizers choose player-safe fields intentionally.

## Shared Text Fields

- `title`: Short card display name.
- `subtitle`: Optional supporting label or flavorful subheading.
- `publicText`: Player-facing rules or fiction text safe for HUD, chat summaries, and visible stakes.
- `gmText`: GM-only guidance, hidden mechanics, adjudication notes, secrets, or follow-up hooks.
- `playerSafeSummary`: Compact public summary safe for pending decisions, player HUD, and public recap.
- `gmSummary`: Compact GM-only summary for queues, prep, and apply review.
- `narration`: Authored deterministic narration hook fragments.

## Narration Hook Shape

```js
{
  onDeclare,
  onSuccess,
  onCriticalSuccess,
  onFailure,
  onCriticalFailure,
  onBenefitCreated,
  onBenefitUsed,
  onConsequenceCreated,
  onHazardCleared,
  onHazardIgnored
}
```

Narration hook values are authored deterministic text fragments. They are not live AI generation, do not call external services, and do not execute logic.

## Hazard Card v0

Fields:

- `id`
- `schemaVersion`
- `type`: `"hazard"`
- `title`
- `category`
- `severity`
- `triggerSources`
- `publicText`
- `gmText`
- `immediateEffects`
- `stationImpacts`
- `responseActions`
- `clearCondition`
- `suppressionCondition`
- `unresolvedConsequenceRefs`
- `escalationRefs`
- `narration`
- `tags`

Allowed `category` values: `navigation`, `engine`, `hull`, `lifeveil`, `crew`, `cargo`, `supplies`, `occult`, `threat`, `route`.

Allowed `severity` values: `minor`, `major`, `severe`.

Hazards must physically change gameplay by changing station choices, pressure, available actions, clear progress, or consequence risk. A hazard that only says `+1 Strain` is invalid as a gold-standard hazard because it does not create a meaningful travel problem. Player-facing text must not contain GM-only handling notes.

## Consequence Card v0

Fields:

- `id`
- `schemaVersion`
- `type`: `"consequence"`
- `title`
- `severity`
- `source`
- `affectedTrack`
- `publicText`
- `gmText`
- `playerSafeSummary`
- `applyEffectSummary`
- `sessionLocalEffect`
- `explicitGmApplyEffect`
- `narration`
- `tags`

Authored consequence cards are not runtime pending candidates. Persistent payloads are descriptions only until future explicit GM Apply flows consume them. Runtime status such as pending, applied, dismissed, or deferred belongs to runtime candidate records, not the authored card definition.

## Station Action Card v0

Fields:

- `id`
- `schemaVersion`
- `type`: `"stationAction"`
- `stationKey`
- `title`
- `actionMode`
- `skillOptions`
- `baseDcPolicy`
- `publicText`
- `gmText`
- `success`
- `criticalSuccess`
- `failure`
- `criticalFailure`
- `createsBenefitRefs`
- `createsConsequenceRefs`
- `riskBidRefs`
- `narration`
- `tags`

Allowed `stationKey` values: `captain`, `navigator`, `engineer`, `veilwarden`, `watchmaster`.

Allowed `actionMode` values: `objective`, `stabilize`, `repair`, `support`, `focus`, `hazardResponse`, `combo`, `momentum`, `aftermath`.

Support rules:

- Support does not count as main objective progress.
- Support does not award Momentum.
- Support assists do not automatically mutate rolls.
- Failed Support creates GM-controlled candidates only.

## Risk Bid Card v0

Fields:

- `id`
- `schemaVersion`
- `type`: `"riskBid"`
- `title`
- `dcIncrease`
- `declareBeforeRoll`
- `eligibleStationActions`
- `successBenefits`
- `criticalSuccessBenefits`
- `failureConsequenceRefs`
- `criticalFailureConsequenceRefs`
- `publicText`
- `gmText`
- `narration`
- `tags`

Rules:

- `dcIncrease` must be one of `2`, `5`, or `10` as a number, not a `"+2"` string.
- `declareBeforeRoll` must be `true`.
- No freeform DC bidding.
- One risk bid per action unless explicitly allowed later.
- Benefits should affect station DCs, hazard progress, pressure relief, Momentum, final outcome, consequence prevention, or station openings.
- Avoid same-track pressure treadmill effects.

## Station Benefit Card v0

Fields:

- `id`
- `schemaVersion`
- `type`: `"stationBenefit"`
- `title`
- `sourceStation`
- `targetStation`
- `benefitKind`
- `magnitude`
- `expires`
- `stackingPolicy`
- `publicText`
- `gmText`
- `narration`
- `tags`

Allowed `benefitKind` values: `dcReduction`, `hazardIgnore`, `riskBidDiscount`, `backlashShield`, `unlockAction`, `momentumOption`, `clearProgress`.

Allowed `expires` values: `afterUse`, `endOfRound`, `endOfEvent`.

Rules:

- Benefits are session-local only.
- Benefits usually expire after use or at end of round.
- Only one pending station benefit should affect a single station roll unless explicitly allowed.
- DC reductions usually cap at `-3`.
- Benefits must eventually be visible in one Pending Decisions queue.

## Encounter Template v0

Fields:

- `id`
- `schemaVersion`
- `type`: `"travelEncounter"`
- `title`
- `category`
- `openingVignette`
- `visibleStakes`
- `roundCount`
- `activeStations`
- `stationActionRefs`
- `startingHazardRefs`
- `hazardDeckPolicy`
- `pressureTracks`
- `successOutcome`
- `failureOutcome`
- `finalOutcomeBranches`
- `aftermath`
- `rewardRefs`
- `followUpRefs`
- `narration`
- `tags`

Visible stakes should include event goal, round count, current pressure, danger thresholds, known hazards, success result, failure result, escalation risk, and current pending decisions.

## Runtime Record Separation

- Hazard card definition vs. active hazard record: the definition describes authored hazard content; the active record owns session progress, suppression state, and encounter-specific timing.
- Consequence card definition vs. pending consequence candidate: the definition describes possible fallout; the runtime candidate owns status, selected targets, source roll, and GM decision state.
- Station action card definition vs. station roll result: the definition describes available action and outcomes; the roll result owns dice, actor, station, selected risk bid, support links, and final adjudication.
- Station benefit card definition vs. pending station benefit: the definition describes the benefit shape; the runtime record owns creator, target roll, expiry timer, and whether it was used.
- Encounter template vs. active runner session: the template describes reusable content; the runner session owns current round, pressure, active hazards, pending decisions, and finalization state.

## v0 Validation Rules

The v0 validator must check targeted contract safety without making the schema overly strict:

- Card input is an object.
- `id` is a required string.
- `schemaVersion` is required and known.
- `type` is required and known.
- `title` is a required string.
- Player-safe text fields are strings when present.
- GM-only text fields are strings when present.
- Enum fields use allowed values.
- Reference fields are arrays of strings when present.
- `narration` is an object when present and hook values are strings when present.
- Unknown schema versions fail safely.
- Unknown card types fail safely.
- Risk bid `dcIncrease` is `2`, `5`, or `10`.
- Risk bid `declareBeforeRoll` is `true`.
- Station Action Support guardrails are warned when expressible.
- Encounter `activeStations` use Travel Five station keys only.
- Encounter `visibleStakes` is an object when present.
- `explicitGmApplyEffect` is allowed as descriptive data but must not execute anything.

## Non-Goals

This PR does not implement gameplay changes, runtime card consumption, builder UI changes, card pack import UI, compendia, migrations, actor/item/chat/journal/world mutation, or Player2 sanitizer changes.

## Gold-Standard Hazard Authoring Examples

The data-only pack in `data/travel-events/travel-v2-gold-standard-hazard-cards.js` provides the first 12 polished Travel v2 hazard examples using this schema version. Use those cards as authoring references for public premise, GM notes, player-safe summaries, response paths, narration hooks, tags, and consequence catalog references.
