# Travel v2 Pending Station Benefit Queue

## Purpose

PR #351 adds the first session-local foundation for pending station benefits. The queue normalizes benefit-like records that already exist in supplied render/session input and exposes them as deterministic, player-safe rows for review.

This is intentionally inert. It does not create benefits, use benefits, dismiss benefits, apply modifiers, change check previews, roll dice, or write to Foundry documents.

## Why Station Combo Play Needs This

Station Combo Play will let one station create an opening that another station can use later. Before direct use can exist, Travel v2 needs a stable review shape that can show:

- which station created the benefit;
- which station can use it;
- what kind of benefit it appears to be;
- when it expires;
- whether it is pending, used, dismissed, expired, or blocked;
- why a malformed record is blocked instead of throwing.

This PR provides that queue shape so future PRs can add display and direct player-use review without skipping the player-safe and no-mutation foundation.

## Normalized Queue Item Shape

Player-safe rows use this shape:

```js
{
  pendingStationBenefitQueueVersion: 1,
  queueKey: "string",
  sourceId: "string-or-null",
  sourceCardId: "string-or-null",
  benefitCardId: "string-or-null",
  title: "string",
  sourceStation: "string-or-null",
  sourceStationLabel: "string",
  targetStation: "string-or-null",
  targetStationLabel: "string",
  benefitKind: "dcReduction | hazardIgnore | riskBidDiscount | backlashShield | unlockAction | momentumOption | clearProgress | supportOpening | stationOrderOpening | unknown",
  magnitude: "number-string-or-null",
  expires: "afterUse | endOfRound | endOfEvent | manual | unknown",
  status: "pending | used | dismissed | expired | blocked",
  publicText: "string-or-null",
  playerSafeSummary: "string-or-null",
  playerVisible: true,
  gmOnly: false,
  reviewOnly: true,
  applyAvailable: false,
  useAvailable: false,
  applied: false,
  used: false,
  dismissed: false,
  stationCheckMutated: false,
  rollMutated: false,
  checkPreviewMutated: false,
  persistentMutation: {
    available: false,
    reason: "Pending station benefit queue foundation does not mutate Foundry documents."
  }
}
```

Malformed rows are represented as `blocked` with safe `blockedReason` and `disabledReason` text. Unknown benefit kinds are retained as `unknown` rather than rejected.

## GM vs Player-Safe State

All users receive `travelV2PendingStationBenefitPlayerState`. It contains only redacted rows, inert flags, and counts.

GM-like users may also receive `travelV2PendingStationBenefitQueue`. GM review rows can include `gmReview` only when GM review is explicitly requested. This lets GM tooling inspect source context without exposing it to players.

## Forbidden Field Redaction

Player-facing state recursively strips these keys:

- `gmText`
- `gmSummary`
- `gmMechanicalNotes`
- `gmReview`
- `explicitGmApplyEffect`
- `sessionLocalEffect`
- `internalMutation`
- `targetActorId`
- `targetActorUuid`
- `applyPayload`
- `before`
- `after`
- `queueInternals`

## Explicit Non-Behavior in PR #351

This PR does not use, apply, dismiss, or expire benefits through UI actions or runtime automation. The queue is review-only and render-state/session-local only.

Pending station benefits do not mutate station checks, rolls, check previews, actors, items, chat, journals, sockets, settings, scenes, tokens, combats, compendia, world data, or persistent flags.

## Planned Next Step

PR #352 is planned as **Player-Facing Station Benefit Display / Direct Player Use Review**. It should build on this safe queue shape while continuing to preserve GM auditability and player-safe field separation.
