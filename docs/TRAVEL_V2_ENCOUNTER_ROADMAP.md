# Travel v2 Encounter Roadmap

## North Star

Travel v2 is a playable table encounter system, not a bookkeeping panel.

A travel event should feel like a short dramatic scene that interrupts days of void travel. The GM launches the event, reads the opening vignette, sends the player HUD, frames the immediate action sequence, then players use station cards to solve the crisis, stabilize the ship, spend focus, respond to hazards, and build momentum.

The system should reduce GM workload by turning player choices and roll results into clear station feedback, round narration, pressure changes, hazard escalation, and final outcomes.

## Core Table Flow

1. **GM launches a Travel v2 event.**
   - Event provides the scene, round count, active Travel Five stations, opening vignette, action sequence setup, station prompts, round outcome branches, and final outcomes.
   - The GM reads the opening vignette aloud.

2. **GM sends the Player HUD / station cards.**
   - Players see the current event, ship status, current round, public hazards, ship scars, and their available station actions.
   - Player-facing text must stay clean, table-ready, and free of GM-only notes.

3. **GM frames the round action sequence.**
   - Each round needs a clear crisis: what is happening right now, what must be fixed, what is at risk.
   - Example: the ship is being dragged out of the void current, the hull groans, the arkengine stutters, and the crew must right the vessel before it falls into dead space.

4. **Players choose station actions.**
   - Each active station gets meaningful action cards.
   - Each player chooses one of these broad modes:
     - Help solve the round objective.
     - Stabilize or repair a pressure track/subsystem.
     - Respond to an active hazard.
     - Spend focus/support/momentum when available.

5. **Players roll.**
   - Each station action has a skill/statistic, DC, success text, failure text, and mechanical purpose.
   - Player rolls should feed both mechanical resolution and narration.

6. **System produces station result vignettes.**
   - Each roll result should produce short GM-readable text explaining how that station helped, failed, complicated the crisis, repaired something, or changed the scene.
   - These are not chat spam by default; they are GM narration support.

7. **System produces a combined round narration.**
   - The round result should summarize the whole sequence using the station outcomes.
   - The GM reads one coherent beat: who failed, who saved the situation, what improved, what worsened, and what the ship feels like now.

8. **Round result applies progress, pressure, and momentum.**
   - Round success/failure is based on participating main-objective station results, not every player automatically contributing.
   - Stabilize/repair actions help the ship but usually remove that station from the main objective count for the round.

9. **Hazards change the encounter when triggered or drawn.**
   - Hazards are not just pressure increases.
   - Hazards are active encounter modifiers that change player choices, station cards, DCs, focus access, available response actions, countdowns, or consequences.

10. **Event continues for multiple rounds.**
    - Pressure, unresolved hazards, momentum, and prior station results should matter.
    - The event ends with a final outcome, follow-ups, rewards, possible ship scar candidates, and GM choice for any handoff.

## Stabilize / Repair Actions

A player can choose to spend their station turn stabilizing a pressure track or subsystem instead of helping the main round objective.

This should be a real tradeoff:

- If five players help the objective, the round may require 3 successes out of 5.
- If one player stabilizes Strain instead, the main objective may require 3 successes out of 4.
- The stabilizing player rolls separately against the chosen pressure/subsystem.

Suggested stabilize result ladder:

- **Critical Success:** reduce that pressure/status by 2.
- **Success:** reduce it by 1.
- **Failure:** no change.
- **Critical Failure:** increase it by 1 or trigger a related complication.

This gives players a meaningful decision: help win the round or peel off to keep the ship from accumulating damage.

## Focus / Support Backlash

Focus and support should be powerful but risky.

A player who spends focus/support to reroll, boost, or trigger a special station move can help swing the round. If they fail after spending it, the system may apply backlash appropriate to the station:

- Navigator backlash: route overcorrection, navigation hazard, or Strain.
- Engineer backlash: arkengine surge, Strain, or temporary engine complication.
- Veilwarden backlash: Lifeveil pressure or veil instability.
- Watchmaster backlash: missed warning, Hull pressure, or worsened countdown.
- Captain backlash: Morale pressure or crew hesitation.

Backlash should create drama, not punish players for trying. It should be clearly explained before the player commits.

## Momentum

Momentum represents the party gaining control of the travel crisis.

Momentum should be earned from strong round results, critical successes, cleared hazards, clever coordination, and decisive station play.

Possible momentum spends:

- Give a station +1 or +2 before a roll.
- Downgrade a failed station result after the roll.
- Allow a late assist.
- Reduce a hazard countdown.
- Prevent a minor pressure gain.
- Improve the final event outcome if held until completion.

Momentum should let players fight back against the travel event, not merely add another GM-admin resource.

## Completed Travel v2 Alpha Systems

This document reflects the roadmap state after the Focus + Support stack was completed. This documentation-only update does not change runtime behavior, player sanitization, objective math, Momentum awards, Support assist math, Focus backlash handling, or any Foundry document mutation rules.

Completed Travel v2 alpha systems:

- **Hazard deck foundation / mechanics:** shared hazard deck lifecycle, session-local active hazard modifiers, response-action injection, clear progress, unresolved consequences, player-safe hazard display, and no automatic actor/item/chat/journal/combat/socket/scene/token mutation.
- **Narration engine:** station result vignettes, combined round summaries, and player-safe narration sanitization for authored encounter text and resolved station data.
- **Stabilize / repair:** non-objective station action tradeoff, pressure/status deltas, and explicit GM Apply/Dismiss controls for any persistent handoff.
- **Momentum:** session-local Momentum pool, auditable GM spend flow, earned/spent narration, and player-safe state display. Support does not award Momentum.
- **Focus risk / suppression:** public Focus help text, public risk/backlash previews, hazard-based Focus suppression, and GM Focus risk summaries.
- **Focus backlash records:** session-local backlash records, GM Apply/Dismiss lifecycle controls, and public-safe summaries only.
- **Support targeting:** formal Support station action mode with target validation and GM target UI. Support does not count as main objective progress.
- **Support assist records:** session-local pending assist records with GM Use/Dismiss controls. Support assists do not automatically mutate rolls.
- **Support display / narration:** player-safe Support assist display and GM-readable Support narration that keep GM-only notes private.
- **Support backlash:** failed Support creates GM-controlled consequence candidates only; critical failed Support can create stronger candidates, but nothing is applied automatically.
- **Focus and Support completion polish:** wording, display, narration, sanitizer smoke coverage, and roadmap/doc alignment for the completed Focus + Support stack.

## Hazard Cards: Correct Design

Hazard cards are generic shared deck cards that work across Travel v2 events, but each card must create a real gameplay complication.

A hazard should not simply say `+1 Strain` or `+1 Lifeveil`. That is pressure, not a hazard.

A proper hazard card should include:

- **Fiction:** what the table sees/hears/feels.
- **Player reveal:** safe public text.
- **Immediate effect:** what changes mechanically right now.
- **Station impact:** which stations are affected.
- **Hazard response actions:** special actions unlocked while the hazard is active.
- **Clear condition:** how players remove/suppress it.
- **Unresolved consequence:** what happens if they ignore or fail to clear it.
- **Escalation:** whether it can become pressure, a worse outcome, or a ship scar candidate.

### Hazard Types

Use these generic hazard patterns:

1. **Station DC Modifier**
   - Example: Navigator actions are +2 DC until the hazard is cleared.

2. **Station Option Lockout**
   - Example: Engineer cannot use Overcharge / Hard Burn while Arkengine Cough is active.

3. **Focus Suppression**
   - Example: no player may spend Focus until Crew on Edge is cleared.

4. **Countdown Hazard**
   - Example: if not cleared by the end of the round, the ship drifts off-course or suffers a worse outcome.

5. **Emergency Response Action Unlock**
   - Example: Navigator, Engineer, and Watchmaster gain special hazard-response actions while Void Shear is active.

6. **Choice / Tradeoff Hazard**
   - Example: choose between protecting the hull or preserving speed; one consequence is avoided and another advances.

7. **Escalation Hazard**
   - Example: if ignored at high pressure, it creates a ship scar candidate.

### Should Hazards Be Clearable?

Yes, most hazards should be clearable or suppressible because the fun is in the players reacting to a crisis.

Recommended categories:

- **Clearable hazards:** remain until players clear them with response actions.
- **One-round hazards:** apply for the current round and expire.
- **Suppression hazards:** can be suppressed for one round by a partial success, but require a stronger result to fully clear.
- **Escalation hazards:** if not cleared, become pressure, final-outcome penalty, follow-up, or ship scar candidate.

## Example Hazard Card Designs

### Void Shear

- Type: Navigation hazard.
- Player reveal: The route shivers sideways, and the ship groans as the helm fights an unseen pull.
- Immediate effect: Navigator main-objective actions are +2 DC.
- Response actions:
  - Navigator: Counter the Shear.
  - Engineer: Counter-thrust the Arkengine.
  - Watchmaster: Spot the Shear Line.
- Clear condition: one hazard-response success clears it; a critical success clears it and grants 1 Momentum.
- If unresolved: Route Drift. Apply an off-course event consequence or worsen the final outcome.

### Arkengine Cough

- Type: Engineering hazard.
- Player reveal: A hard cough rolls through the engine room before the drive catches again.
- Immediate effect: Engineer cannot use Overcharge / Hard Burn while active.
- Response actions:
  - Engineer: Reharmonize the Core.
  - Captain: Steady the Engine Crew.
  - Veilwarden: Shield the Engine Pulse.
- Clear condition: Engineer success clears it; Captain or Veilwarden success suppresses it for one round.
- If unresolved: the next Engineer roll is +2 DC or the event gains engine instability consequence.

### Crew on Edge

- Type: Morale/focus hazard.
- Player reveal: The crew grows quiet, tense, and too quick to look toward the dark between stars.
- Immediate effect: Focus cannot be spent while active.
- Response actions:
  - Captain: Rally the Crew.
  - Watchmaster: Restore Deck Discipline.
  - Any station: Take a personal risk to steady the crew.
- Clear condition: Captain success clears it; two non-Captain successes clear it.
- If unresolved: Morale consequence or worse final outcome branch.

### Fading Lifeveil

- Type: Lifeveil hazard.
- Player reveal: The lifeveil dims in slow pulses, and distant cold presses close to the glass.
- Immediate effect: Veilwarden actions are +2 DC, and Focus backlash may affect Lifeveil.
- Response actions:
  - Veilwarden: Anchor the Veil.
  - Engineer: Stabilize the Veil Feed.
  - Captain: Order Emergency Seal Protocol.
- Clear condition: Veilwarden success clears it; Engineer success suppresses it.
- If unresolved: Lifeveil breach consequence or ship scar candidate at severe pressure.

### Low Stores Alarm

- Type: Supplies/cargo hazard.
- Player reveal: A stores alarm sounds; something essential is harder to reach than it should be.
- Immediate effect: Stabilize/repair actions requiring supplies are +2 DC.
- Response actions:
  - Watchmaster: Locate the Blocked Stores.
  - Captain: Reassign Crew to Supply Chain.
  - Engineer: Clear the Jammed Lift / Cargo Access.
- Clear condition: one response success clears it.
- If unresolved: supply shortage follow-up or final outcome penalty.

## Station Combo Play / Round Action Order

Travel v2 should support station actions that create temporary benefits for later stations in the same round. This requires a simple player-chosen round action order so station timing matters without becoming a full initiative subsystem.

At the start of each Travel v2 round, the table should be able to choose the order in which active stations resolve. The GM can arrange the station order in the runner. The chosen order matters because some station actions create benefits for later stations.

Default rule:

- Players choose station order each round.
- GM can adjust or override when an event or hazard requires it.
- Hazards may sometimes force or restrict order.
- No initiative roll is required by default.

Station combo actions may create pending station benefits such as:

- Target station DC -2.
- Target station ignores one hazard modifier.
- Target station gains improved hazard-clear progress.
- Target station may use a risk bid with reduced surcharge.
- Target station is protected from minor backlash.
- Target station unlocks a special response action.

Pending station benefits must be:

- Session-local.
- Player-safe.
- Tied to source station and target station.
- Visible in one clean GM/player-facing queue.
- Usable/dismissible by GM or by the appropriate flow.
- Expired after use or at end of round.
- Never automatic Foundry document mutation.

Initial station combo identities:

- **Engineer:** overcharge the arkengine to empower one chosen station.
- **Watchmaster:** call out threats, weak points, hazards, or ship danger before another station acts.
- **Captain:** convert callouts into coordinated crew action, redirect benefits, strengthen benefits, or protect stations from minor backlash.

### Example Engineer Action: Overcharge the Arkengine

Declare a target station: Navigator, Veilwarden, Watchmaster, Captain, or Engineer.

- **Success:** create a pending station benefit for the chosen target this round. Suggested easiest implementation: target station receives DC -2 on its next action this round.
- **Critical Success:** improve the benefit to DC -3, or grant the table 1 Momentum.
- **Failure:** no benefit. Create a Minor Arkengine Surge consequence candidate.
- **Critical Failure:** no benefit. Create a Major Arkengine Surge consequence candidate.

### Example Watchmaster Action: Call the Warning

- **Success:** create a pending callout benefit for one target station this round, such as DC -2, reveal a hidden hazard response, suppress a surprise penalty, or identify the safest station to act next.
- **Critical Success:** improve the benefit or also grant 1 Momentum.
- **Failure:** no benefit.
- **Critical Failure:** create a Missed Warning consequence candidate.

### Example Captain Action: Command the Response

Requirement: another station has created a callout, opening, assist, or pending benefit this round.

- **Success:** choose one:
  - Move one pending station benefit to a different valid station.
  - Increase one pending station benefit by 1.
  - Let one station act immediately after Captain.
  - Protect one station from minor backlash this round.
- **Critical Success:** also grant 1 Momentum or dismiss one minor consequence candidate.
- **Failure:** no change.
- **Critical Failure:** create a Crew Confusion consequence candidate.

## Risk Bids

Travel v2 station actions may define pre-authored risk bids.

A risk bid:

- Is selected before rolling.
- Increases the DC by a fixed amount, usually +2, +5, or +10.
- Grants a listed benefit on success or critical success.
- May create a premade consequence candidate on failure or critical failure.
- Must be written in card data, not improvised by the GM during play.

Example: **Navigator — Thread the Wake**

Base action: normal Navigator check to gain route progress.

Risk bid: +5 DC.

Success benefit: choose one:

- Reduce the next Engineer DC by 2.
- Remove 1 Strain.
- Suppress one navigation hazard for the round.

Critical success: gain the chosen benefit and 1 Momentum.

Critical failure: create a Route Overcorrection consequence candidate.

Guardrails:

- No freeform DC bidding.
- One risk bid per action unless the card explicitly supports more.
- Bids must be declared before rolling.
- Benefits should usually affect station DCs, hazard progress, pressure relief, Momentum, final outcome, or consequence prevention.
- Same-track pressure treadmill effects should be avoided.
- Failure should use premade consequence candidates instead of GM improvisation.

## Vignette / Narration Hooks for Combo Play

The existing Travel v2 narration system should eventually support authored vignette hooks from station actions, hazards, risk bids, pending benefits, and consequence candidates.

This should not be live AI generation and should not require GM improvisation. It should use card-authored text fragments that the runner can assemble into GM-readable narration.

Future card schemas should support narration fields such as:

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

Example: **Engineer Overcharge targeting Navigator**

- **Declare:** the Engineer opens the throttle and sends a dangerous surge through the arkengine lines.
- **Success:** the surge steadies into a bright wake-channel, giving the Navigator a cleaner line.
- **Critical Success:** the ship leaps forward as the wake opens perfectly, and the crew feels the whole vessel answer.
- **Failure:** the surge sputters and collapses before the target station can use it.
- **Critical Failure:** the engine flare rebounds through the deck plates, leaving the arkengine coughing hot.

The goal is that the GM can read a clean combined round vignette that reflects:

- Station order.
- Who helped whom.
- Which risks were taken.
- Which hazards changed the scene.
- Which consequences are now pending.
- What the ship feels like at the end of the round.

Do not implement this in code in the roadmap PR. This PR is docs-only.

## Implementation Roadmap

This PR is documentation-only. The next roadmap work should make the runner easier to understand before adding broader gameplay polish. Keep scopes narrow, reviewable, and one subsystem per PR. Broad runner splitting belongs to alpha cleanup and should happen incrementally, not as a single sweeping rewrite.

### Recommended Next 3 PRs

1. **Alpha roadmap cleanup / doc truth pass**
   - Keep Travel v2 docs aligned with completed Focus + Support behavior.
   - Remove stale PR-era labels and early hazard-planning language as implementation lands.
   - Confirm the docs still state that mutation is explicit GM Apply only and that player-facing text is sanitized.

2. **Travel v2 runner alpha cleanup split planning**
   - Map the current runner responsibilities into candidate extraction seams.
   - Identify subsystem boundaries, test coverage, and file ownership before moving code.
   - Explicitly sequence broad runner splitting as one subsystem per PR.

3. **Support record helper extraction**
   - Extract Support record creation, lifecycle, display helpers, and summary formatting behind focused helper functions/modules.
   - Preserve existing Support rules: Support does not count as main objective progress, does not award Momentum, does not automatically mutate rolls, and failed Support creates GM-controlled candidates only.

### Later Alpha Cleanup PRs

4. **Focus backlash extraction**
   - Move Focus backlash record creation, GM lifecycle controls, and player-safe summary shaping into a focused helper boundary.
   - Preserve session-local behavior and explicit GM Apply for any persistent consequence.

5. **Momentum extraction**
   - Move Momentum award/spend/session summary logic into a focused helper boundary.
   - Preserve current award rules, GM-auditable spend flow, and the rule that Support does not award Momentum.

6. **Player sanitizer extraction**
   - Extract player-facing sanitization helpers so GM-only notes stay private across HUD, narration, Support, Focus, hazards, and final summaries.
   - Do not change sanitizer behavior as part of the extraction; keep this as a behavior-preserving refactor.

7. **Runner library/session extraction**
   - Separate runner library helpers from session-state orchestration.
   - Keep persistent Foundry document mutation explicit and GM-initiated only.

8. **Station row/action handling extraction**
   - Move station row rendering/action handlers behind clearer helper boundaries.
   - Preserve existing station action semantics, including Stabilize/Repair tradeoffs and Support exclusions from objective progress.

### Revisit After Runner Cleanup

After the runner is easier to navigate, revisit gameplay polish in narrow PRs:

- Deepen hazard variety, clear conditions, and unresolved consequence presentation.
- Add ship scar candidate polish while keeping actor/item mutation explicit GM Apply only.
- Improve final outcome and follow-up summaries from pressure, unresolved hazards, Momentum, and station results.

## Non-Negotiables

- Travel v2 must feel like a playable encounter, not a bookkeeping screen.
- Hazards must physically change gameplay.
- Generic hazard deck, not event-generated custom decks by default.
- GM workload should go down, not up.
- Players should see fun, clear, public card text and meaningful choices.
- GM-only notes must not leak.
- Actor/item/chat/journal/combat mutation must remain explicit GM Apply.
- Pressure is the consequence layer, not the whole gameplay loop.
- The system should generate or assemble narration from player action results so the GM can read it at the table.
