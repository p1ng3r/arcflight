# Travel v2 To-Do / Roadmap

This document tracks near-term Travel v2 work that should remain visible while the runner, station-action, and card-like table systems are being built.

## Current implemented foundation

- [x] Travel Event Runner v2 shell and local runner session flow.
- [x] Station action selection, player submission, GM lock/unlock, and explicit persistence.
- [x] Round finalization guard for selected and locked Travel Five station actions.
- [x] Support station-action effect capture and pending bonus records.
- [x] Support bonus consumption/status UI for pending/applied/consumed records.
- [x] Event Approach effect capture.
- [x] Event Approach contribution records.
- [x] Event Approach contribution tally.
- [x] Event Approach tally status preview.
- [x] Support and Event Approach feature slices rolled into `dev`.

## Immediate next work

- [ ] Live Foundry test current `dev` Travel v2 loop.
- [ ] Add Difficulty Bid / card reward system before Event Approach tally application.
- [ ] Add Event Approach tally application preview after Difficulty Bid card rewards are represented.
- [ ] Add Event Approach tally application after the preview/apply/correct pattern is safe.
- [ ] Add event progress display and completion readiness later.

## Difficulty Bid system

Difficulty Bid is the main high-risk/high-reward station-action enhancement. It should feel like a card-game table mechanic: cards are created, sit visibly in play, trigger or get played at specific times, and then become consumed/dismissed records.

Design goals:

- Keep all five Travel Five stations rolling when possible.
- Let stations help each other without giving up their own station roll.
- Keep Support as a fallback, NPC, low-confidence, or safe assist action rather than the primary exciting help-another-station mechanic.
- Keep consequences explicit and GM-controlled.
- Preserve the repo pattern of preview/read-only records first, explicit GM apply second.
- Do not mutate actors, items, chat, journals, scenes, tokens, sockets, or combat state from bid creation.

### Bid bands

- [ ] No Bid: no DC modifier and no bid reward.
- [ ] Minor Bid: station DC +2.
- [ ] Greater Bid: station DC +5.
- [ ] Extreme Bid: station DC +8.

Bid rules:

- [ ] Bid is declared before the station roll.
- [ ] Bid modifies only the acting station's effective DC.
- [ ] Bidder still makes their own station roll.
- [ ] Bidder still counts toward round result / Event Approach contribution when applicable.
- [ ] Failure creates no bid reward.
- [ ] Critical failure creates no bid reward and only an optional GM-facing backlash preview.
- [ ] No automatic pressure, hazard, resource, progress, combat, actor, item, chat, journal, scene, token, or socket mutation.

### Critical success reward ladder

Critical success upgrades the earned card by one tier.

- [ ] DC +2 success creates Minor Opening.
- [ ] DC +2 critical success creates Greater Opening.
- [ ] DC +5 success creates Greater Opening.
- [ ] DC +5 critical success creates Heroic Event.
- [ ] DC +8 success creates Heroic Event.
- [ ] DC +8 critical success creates Legendary Event.

## Card reward tiers

### Minor Opening Card

- [ ] Created by success on DC +2 Difficulty Bid.
- [ ] Created as a visible active card record.
- [ ] Played after station actions are locked and before the target station roll.
- [ ] Grants +1 circumstance bonus to one target station roll.
- [ ] Consumed after the target station roll resolves.
- [ ] Player-safe display.
- [ ] GM can dismiss/expire if unused.

### Greater Opening Card

- [ ] Created by critical success on DC +2 or success on DC +5 Difficulty Bid.
- [ ] Created as a visible active card record.
- [ ] Played after station actions are locked and before the target station roll.
- [ ] Grants +3 circumstance bonus to one target station roll.
- [ ] Consumed after the target station roll resolves.
- [ ] Player-safe display.
- [ ] GM can dismiss/expire if unused.

### Heroic Event Card

- [ ] Created by critical success on DC +5 or success on DC +8 Difficulty Bid.
- [ ] Created as a visible active card record.
- [ ] Sits in an Active Heroic Cards / Active Travel Cards zone.
- [ ] Has source station, target station, round created, status, label, and player-safe flavor text.
- [ ] Waits for the target station to roll failure or critical failure.
- [ ] When the target station fails or critically fails, the card becomes triggered.
- [ ] Triggered card creates a GM apply preview.
- [ ] Applying the card improves the target station result by one degree:
  - criticalFailure -> failure
  - failure -> success
- [ ] Card is consumed after apply.
- [ ] GM may dismiss/expire if unused.
- [ ] Player-safe display.

### Legendary Event Card

- [ ] Created by critical success on DC +8 Difficulty Bid.
- [ ] Created as a visible active card record.
- [ ] Played after station actions are locked but before the target station rolls.
- [ ] Sets a minimum result floor of success for the target station roll:
  - criticalFailure -> success
  - failure -> success
  - success remains success
  - criticalSuccess remains criticalSuccess
- [ ] Still lets the target station roll so critical success remains possible.
- [ ] Consumed after the target station roll resolves.
- [ ] Player-safe display.
- [ ] GM can dismiss/expire if unused.

## Support action follow-up

Support is not removed. It remains useful as a conservative assist, NPC action, low-confidence action, absent-player action, or fallback when a station cannot reasonably push the main objective.

- [ ] Keep existing Support effect/bonus pipeline unless live testing proves it should be hidden or renamed.
- [ ] Do not delete Support code while Difficulty Bid cards are being built.
- [ ] Re-evaluate Support after Difficulty Bid cards are live.
- [ ] If Support becomes redundant, prefer de-emphasizing it in UI before removing code.
- [ ] If later cleanup is needed, preserve reusable pending bonus record helpers, consumed/applied state helpers, player-safe rendering patterns, and smoke-test patterns.

## Clean-remove checklist if a system is later axed

Use this only if live testing shows Support or an older card/bonus path should be removed.

- [ ] Identify what the replacement system owns.
- [ ] Preserve shared helpers that card rewards, Momentum, or future station actions can reuse.
- [ ] Preserve player-safe sanitize/render patterns.
- [ ] Preserve pending/applied/consumed record patterns.
- [ ] Preserve smoke-test fixtures that prove no actor/item/chat/journal/combat/socket mutation.
- [ ] Remove only UI options and obsolete action entry points first.
- [ ] Keep migration/normalization tolerant of old saved sessions.
- [ ] Add smoke tests proving old saved sessions do not crash.
- [ ] Remove dead constants/helpers only after saved-session compatibility is handled.
