# TV2-003 Foundry Verification

Status: superseded pending corrective implementation.

## Why this checklist was superseded

The previous TV2-003 checklist tested an obsolete station-order workflow.

That implementation:

- treated station ordering primarily as a GM control;
- selected one order before Round 1;
- normally kept that order for the entire event;
- placed the controls inside Advanced Runner Details;
- rerendered the complete Travel Event Runner after each order movement;
- collapsed open controls;
- reset the user's location in the interface;
- did not provide the intended shared player Crew Planning phase.

That workflow does not match the corrected Travel Alpha design.

Do not use the former checklist to mark TV2-003 complete.

## Canonical references

Use these documents for the corrected requirements:

- `docs/ARCFLIGHT_ALPHA_PILLAR_ROADMAP.md`
- `docs/TRAVEL_V2_ALPHA_GOAL.md`
- `docs/TRAVEL_V2_SHARED_ROUND_PLANNING_AND_RISK_BIDS.md`

## Corrected gameplay requirement

Every round begins with a shared player-facing Crew Planning phase.

During Crew Planning:

- every connected player sees every active station;
- every player sees every current player-safe station action;
- every action displays its authored `+2 DC`, `+5 DC`, and `+8 DC` Risk Bids;
- every Risk Bid displays its player-safe reward, target, timing, and danger;
- players openly discuss actions, bids, combinations, and station order;
- players arrange the order for the current round together;
- all players see the same synchronized proposed order;
- the Captain has final say when the crew cannot agree;
- the Captain confirms the crew's final order;
- the GM retains override and unlock controls;
- station action lock-in remains blocked until the order is confirmed;
- the committed order applies only to the current round;
- the next round begins with a fresh Crew Planning phase.

## Risk Bid requirement

Risk Bids belong directly to station actions.

Every station action has three authored tiers:

- `+2 DC`
- `+5 DC`
- `+8 DC`

Each tier defines its own:

- reward;
- target;
- timing;
- duration;
- expiration;
- player-safe danger;
- failure result;
- critical-failure result.

A Risk Bid reward may benefit:

- the acting station during the current action;
- the acting station's next roll;
- the acting station during the next round;
- the next station in the committed order;
- another chosen station;
- a specific named station;
- the whole crew;
- the ship;
- an eligible hazard response;
- an eligible backlash response;
- an eligible consequence response;
- rewards, salvage, discoveries, clues, or route advantages.

Helping another station is one possible authored Risk Bid reward. It is not a separate universal action category.

## Required UI behavior

The Crew Planning interface must be a primary player-facing interface.

It must not be hidden inside:

- Advanced Runner Details;
- GM-only development controls;
- debug tools;
- an optional review drawer.

The interface must support:

- synchronized station-card ordering;
- drag-and-drop ordering;
- accessible Move Up controls;
- accessible Move Down controls;
- keyboard operation;
- visible focus indicators;
- Captain confirmation;
- GM override;
- GM unlock;
- player-safe action and Risk Bid review.

Reordering must not:

- rebuild the entire Travel Event Runner;
- close an open panel;
- collapse a details element;
- return the user to the top;
- reset scroll position;
- lose keyboard focus;
- interrupt player discussion;
- replace the application window;
- send unintended socket messages;
- commit the order automatically.

## Implementation prerequisites

Do not begin final Foundry acceptance testing until all of these exist:

- [ ] A `crewPlanning` round phase.
- [ ] Round-specific station-order state.
- [ ] Player-safe shared station-action presentation.
- [ ] Player-safe authored Risk Bid presentation.
- [ ] Synchronized multiplayer proposed-order state.
- [ ] Captain confirmation.
- [ ] GM override.
- [ ] GM unlock.
- [ ] Action lock-in blocked until order confirmation.
- [ ] Targeted order-panel updates without complete runner rerenders.
- [ ] Authored Risk Bid reward targeting.
- [ ] Authored Risk Bid timing and expiration.
- [ ] Player-facing bonus-card support.
- [ ] Failure-danger staging.
- [ ] Updated focused smoke coverage.
- [ ] Multiplayer synchronization smoke coverage.

## Replacement Foundry acceptance checklist

Complete this checklist only after the corrective implementation exists.

### Environment record

- [ ] Verifier name recorded.
- [ ] Verification date recorded.
- [ ] Arcflight commit SHA recorded.
- [ ] Foundry version recorded.
- [ ] PF2e system version recorded.
- [ ] Browser and version recorded.
- [ ] Operating system recorded.
- [ ] Relevant enabled modules recorded.
- [ ] Test world recorded.
- [ ] GM account available.
- [ ] Separate non-GM player accounts available.
- [ ] Browser console open during verification.
- [ ] Runner tested at normal desktop dimensions.
- [ ] Player interface tested at a narrower usable dimension.

### Scenario A — Round enters Crew Planning

- [ ] Starting Round 1 automatically enters Crew Planning.
- [ ] Advancing to Round 2 automatically enters a new Crew Planning phase.
- [ ] Advancing to Round 3 automatically enters a new Crew Planning phase.
- [ ] The current round number is visible.
- [ ] Player-safe round stakes are visible.
- [ ] Station actions cannot lock before order confirmation.
- [ ] Stations cannot resolve before order confirmation.

### Scenario B — Shared player visibility

Verify using the GM and at least one separate player browser session.

- [ ] Every connected player sees every active station.
- [ ] Every connected player sees every current player-safe station action.
- [ ] Every action displays a `+2 DC` Risk Bid.
- [ ] Every action displays a `+5 DC` Risk Bid.
- [ ] Every action displays a `+8 DC` Risk Bid.
- [ ] Each bid displays its player-safe reward.
- [ ] Each bid displays its target.
- [ ] Each bid displays its timing.
- [ ] Each bid displays its player-safe danger.
- [ ] Hidden hazards remain hidden.
- [ ] Unrevealed backlash remains hidden.
- [ ] GM consequence candidates remain hidden.
- [ ] Internal scoring remains hidden.
- [ ] Secret branches remain hidden.
- [ ] GM notes remain hidden.
- [ ] Debug state remains hidden.

### Scenario C — Strategic order information

Verify that the visible bid descriptions provide enough information for meaningful planning.

- [ ] A self-targeted reward clearly identifies the acting station.
- [ ] A next-station reward clearly identifies the next station in order.
- [ ] A chosen-station reward clearly identifies valid targets.
- [ ] A later-station reward explains that the target must act later.
- [ ] A next-round reward clearly identifies its future timing.
- [ ] A hazard-response reward clearly identifies the eligible hazard timing.
- [ ] A consequence-response reward clearly identifies when it may be used.
- [ ] Bonus-card rewards show their duration and expiration.
- [ ] Players can understand why station order affects available combinations.

### Scenario D — Synchronized player ordering

- [ ] Every player initially sees the same proposed order.
- [ ] A player can move a station upward.
- [ ] A player can move a station downward.
- [ ] A player can drag a station to an earlier position.
- [ ] A player can drag a station to a later position.
- [ ] The GM sees player-made proposed-order changes.
- [ ] Other connected players see the same changes.
- [ ] Changes appear without manually refreshing the interface.
- [ ] Simultaneous or conflicting changes resolve predictably.
- [ ] An unauthorized or stale update is rejected safely.
- [ ] Reordering does not commit automatically.

### Scenario E — Stable reorder interface

- [ ] Move Up updates only the order-related interface.
- [ ] Move Down updates only the order-related interface.
- [ ] Drag-and-drop updates only the order-related interface.
- [ ] The Travel Event Runner does not completely rerender after each movement.
- [ ] The user remains at the same interface location.
- [ ] Scroll position remains stable.
- [ ] Keyboard focus remains on an appropriate order control.
- [ ] No open panel collapses.
- [ ] No application window is replaced.
- [ ] Player discussion can continue without repeatedly relocating the controls.
- [ ] No Arcflight exception appears in the console.

### Scenario F — Accessible ordering

- [ ] Every station has a usable Move Up control when movement is allowed.
- [ ] Every station has a usable Move Down control when movement is allowed.
- [ ] Disabled movement controls expose the correct disabled state.
- [ ] Controls have understandable accessible labels.
- [ ] Keyboard focus is visible.
- [ ] Keyboard-only ordering is possible.
- [ ] Focus follows the moved station or remains in a predictable location.
- [ ] Screen-reader text identifies current position where supported.
- [ ] Dragging is not the only available reorder method.

### Scenario G — Captain confirmation

- [ ] The Captain player can see the proposed order.
- [ ] The Captain player can confirm the proposed order.
- [ ] Captain confirmation commits the order for the current round.
- [ ] Other players immediately see the committed order.
- [ ] Station action lock-in becomes available after confirmation.
- [ ] Confirmation does not reveal hidden GM information.
- [ ] A non-Captain player cannot improperly claim Captain authority when role ownership is enforced.
- [ ] Captain authority remains understandable table guidance when no automated assignment exists.

### Scenario H — GM override and unlock

- [ ] The GM can view the proposed order.
- [ ] The GM can override the proposed order.
- [ ] The GM can confirm an order when table management requires it.
- [ ] The GM can unlock a committed order.
- [ ] Unlocking returns the current round to Crew Planning.
- [ ] Unlocking does not alter resolved station results.
- [ ] Unlocking does not alter unrelated session state.
- [ ] Unlocking is visible to connected players.
- [ ] GM controls do not become the ordinary player workflow.

### Scenario I — Round-specific order

- [ ] Round 1 order is stored for Round 1.
- [ ] Completing Round 1 preserves its historical order.
- [ ] Round 2 opens with a new editable proposed order.
- [ ] Round 1's committed order does not remain automatically committed for Round 2.
- [ ] Round 1's order may appear as a starting suggestion.
- [ ] Round 2 can commit a different order.
- [ ] Round 3 can commit another different order.
- [ ] Reloading the world preserves each completed round's historical order.
- [ ] Loading the session preserves the current round's planning state.

### Scenario J — Action and Risk Bid lock-in

- [ ] Actions cannot lock before the round order is confirmed.
- [ ] Risk Bids cannot lock before the round order is confirmed.
- [ ] Each station can select one current action.
- [ ] Each station can select one of that action's authored bids.
- [ ] Selecting `+2 DC` increases the correct DC by 2.
- [ ] Selecting `+5 DC` increases the correct DC by 5.
- [ ] Selecting `+8 DC` increases the correct DC by 8.
- [ ] Locked choices cannot change because an earlier station rolled well or badly.
- [ ] Explicit GM unlock behavior is safe and visible.
- [ ] Hidden consequences are not exposed during lock-in.

### Scenario K — Self-targeted rewards

- [ ] A reward can affect the acting station's current action.
- [ ] A reward can affect the acting station's next roll.
- [ ] A reward can reduce the acting station's future DC.
- [ ] A reward can apply during the next round.
- [ ] The reward expires at the authored time.
- [ ] The reward cannot be used by an invalid station.

### Scenario L — Cross-station rewards

- [ ] A reward can affect the next station.
- [ ] A reward can affect another chosen station.
- [ ] A reward can affect a specific named station.
- [ ] A reward restricted to a later station rejects earlier stations.
- [ ] The committed order determines the correct next or later station.
- [ ] The receiving player sees the earned benefit.
- [ ] Other players see only appropriate player-safe information.

### Scenario M — Bonus mechanics

- [ ] An authored `+2` roll bonus works.
- [ ] An authored `+3` roll bonus works.
- [ ] An authored `+5` roll bonus works.
- [ ] An authored `2d20, keep highest` effect works.
- [ ] An authored future-DC reduction works.
- [ ] An authored one-degree failure improvement works:
  - [ ] Critical Failure becomes Failure.
  - [ ] Failure becomes Success.
  - [ ] Success remains Success unless otherwise authored.
  - [ ] Critical Success remains Critical Success unless otherwise authored.
- [ ] A bonus cannot apply twice unless explicitly authored.
- [ ] Used bonuses are marked consumed when appropriate.
- [ ] Expired bonuses no longer affect mechanics.

### Scenario N — Consequence, hazard, and backlash protection

- [ ] An authored consequence-prevention effect works.
- [ ] An authored consequence-downgrade effect works.
- [ ] An authored hazard-suppression effect works.
- [ ] An authored hazard-weakening effect works.
- [ ] An authored backlash-protection effect works.
- [ ] Invalid targets are rejected.
- [ ] Persistent changes still require GM review.
- [ ] No player gains access to the hidden consequence queue.

### Scenario O — Risk Bid failure danger

- [ ] A failed `+2 DC` bid stages its authored danger.
- [ ] A failed `+5 DC` bid stages its authored danger.
- [ ] A failed `+8 DC` bid stages appropriately severe danger.
- [ ] Critical failure stages the authored critical danger.
- [ ] Failure danger may create pressure where authored.
- [ ] Failure danger may create or escalate a hazard where authored.
- [ ] Failure danger may create backlash where authored.
- [ ] Failure danger may create a consequence candidate where authored.
- [ ] Failure danger may create a scar candidate where authored.
- [ ] Persistent changes do not apply automatically.

### Scenario P — Round and event resolution

- [ ] Stations resolve in the committed current-round order.
- [ ] Rewards use their authored targets and timing.
- [ ] Round Resolution includes earned benefits.
- [ ] Round Resolution includes staged dangers.
- [ ] The official transition vignette reflects actual results.
- [ ] Mechanical callouts appear directly beneath the vignette.
- [ ] The next round opens a new Crew Planning phase.
- [ ] End-of-Event Resolution includes rewards, consequences, scars, pressure, discoveries, and follow-ups.
- [ ] Persistent ship changes require explicit GM confirmation.
- [ ] Applied changes create an audit record.

### Scenario Q — Reload and persistence

- [ ] Proposed current-round order survives the intended local/session persistence boundary.
- [ ] Committed current-round order survives reload.
- [ ] Historical round orders survive reload.
- [ ] Selected station actions survive reload.
- [ ] Selected Risk Bids survive reload.
- [ ] Earned bonus cards survive reload when still active.
- [ ] Used or expired cards remain correctly used or expired.
- [ ] Loading another session does not leak candidate order state.
- [ ] Returning to the original session restores the correct state.

### Scenario R — Side-effect and security watch

- [ ] No unintended actor mutation occurs.
- [ ] No unintended item mutation occurs.
- [ ] No unintended effect mutation occurs.
- [ ] No unintended journal mutation occurs.
- [ ] No unintended chat message occurs.
- [ ] No unintended socket message occurs.
- [ ] No unintended scene mutation occurs.
- [ ] No unintended token mutation occurs.
- [ ] No unintended compendium mutation occurs.
- [ ] No unintended world-setting mutation occurs.
- [ ] Player messages cannot alter hidden GM-only state.
- [ ] Stale or malformed player messages are rejected safely.
- [ ] Player-safe state contains no hidden hazards.
- [ ] Player-safe state contains no unrevealed backlash.
- [ ] Player-safe state contains no secret branches.
- [ ] Player-safe state contains no internal scoring.
- [ ] Player-safe state contains no GM notes or debug reports.

## Completion gate

TV2-003 may be marked complete only when:

- the corrected implementation exists;
- all focused automated smoke tests pass;
- multiplayer synchronization tests pass;
- the complete Foundry checklist passes;
- every blocker is fixed or explicitly tracked;
- the verification environment and exact commit SHA are recorded;
- no obsolete GM-only, once-per-event assumptions remain in the implementation or documentation;
- no whole-runner reorder reset remains;
- no player-facing information leak is observed;
- no unintended persistent mutation is observed.

Until then, TV2-003 remains:

`design correction required / highest-priority Travel Alpha blocker`