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

## Hazard Cards: Correct Design

**Current PR scope — Final Focus + Support Polish:** this pass aligns Focus backlash, Support assist, and Support backlash wording across GM panels, player-safe summaries, narration, sanitizer smoke coverage, and docs. It is wording/display/sanitization/docs polish only and does not change Focus, Support, Support assist math, Support failure/backlash, Momentum, objective progress, or mutation behavior.

**Completed Focus + Support stack summary:** Support targeting is complete; Support assist records are complete; Support display/narration is complete; Support backlash candidates are complete; Focus backlash review remains GM-controlled; and no automatic actor/item/chat/journal/combat/socket/scene/token mutation is part of this stack. Broad runner file splitting and larger refactors are reserved for alpha cleanup, not this polish PR.

**Previous PR scope — Support Backlash / Failed Support Consequences:** this pass created session-local, GM-controlled consequence candidates for failed Support and stronger backlash candidates for critical failed Support. Apply/Dismiss only marks the candidate lifecycle in runner session state; it does not automatically apply consequences, change pressure, or mutate Foundry actors, items, chat, journals, combat, sockets, scenes, tokens, or persisted world data.

**Previous PR scope — Support Player Display / Narration:** this pass improved player-safe Support assist display and GM-readable Support narration. It shows source station, target station, assist value, status, and short public assist text while keeping GM notes private. This scope was display/narration only: it did not implement automatic assist application, new Momentum spends, or actor/item/chat/journal/combat/socket mutation.

**Previous PR scope — Support Assist Records:** this pass created session-local pending Support assist records from successful Support actions, added GM Use/Dismiss controls, and kept Support assists separate from main objective progress, Momentum awards, and Support backlash.

**Previous PR scope — Support Action Targeting Foundation:** this pass made Support a formal station action, added target validation and minimal GM target UI, and kept Support contributors separate from main-objective success counting.

**Previous PR scope — Focus Backlash Records:** this pass creates session-local Focus backlash records from failed Focus-backed station results, adds GM Apply/Dismiss controls, keeps pressure/consequence changes session-local, and exposes only public-safe Focus backlash summaries.

**Previous PR scope — Momentum Pass:** this pass added a session-local Travel v2 Momentum pool, awards Momentum from strong play such as critical main-objective station results and critical hazard clears, adds an explicit GM-auditable failure downgrade spend, surfaces player-safe Momentum state, and folds earned/spent Momentum into narration. It does not add live AI/API generation or automatic actor/item/chat/journal/combat mutation. Later PRs should deepen additional Momentum spends and explicit GM Apply handoffs for persistent fallout.

**Previous PR scope — Focus Risk / Suppression Foundation:** this pass added Focus option public help text, public risk/backlash preview text, hazard-based Focus suppression, player-safe Focus display sanitization, and GM Focus risk summaries without making backlash persistent or automatic.

**Previous PR scope — Stabilize / Repair Action Pass:** this pass formalized Stabilize / Repair as a tradeoff action: stabilizing stations do not count toward main objective progress, their critical success / success / failure / critical failure results create session-local pressure deltas, and GM-facing apply/dismiss controls keep persistent changes under explicit GM control.

**Previous PR scope — Narration Engine Pass:** the runner now provides session-local station result vignettes, combined round summaries, and player-safe narration sanitization for already-authored Travel v2 encounter text and resolved station data.

**Previous PR scope — Hazard Encounter Mechanics:** the shared hazard deck now supports session-local gameplay modifiers: active hazards can change station DCs, suppress options or Focus, inject response actions, track clear progress, and record unresolved consequences without mutating actors/items/chat/journals/combat.

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

## Implementation Roadmap

### Current PR #271: Hazard Deck UI Foundation

Keep PR #271 focused on the safe card lifecycle foundation:

- Draw/stage hazard.
- Hold hazard.
- Reveal hazard to players.
- Activate hazard.
- Clear hazard.
- Hide GM-only text from player HUD.
- Preserve session-local state.

Do not call this the finished mechanical hazard system.

### Next PR: Hazard Encounter Mechanics

Build the actual gameplay layer:

- Add hazard effect payloads for encounter modifiers, not pressure-only effects.
- Add active hazard modifiers to runner state.
- Show active hazard modifiers in GM and player UI.
- Inject hazard response actions into affected station cards.
- Modify station DCs/options/focus access based on active hazards.
- Track clear conditions and unresolved consequences.
- Add one meaningful GM button: Apply Hazard to Round / Reveal and Apply.
- Prevent double application.
- Add smoke tests for modifier application, response-action injection, clear conditions, player-safe visibility, and no actor mutation.

### Later PRs

1. **Narration Engine Pass**
   - Build individual station result vignettes.
   - Build combined round narration from station outcomes.
   - Keep text GM-readable and optional to post.

2. **Stabilize / Repair Action Pass**
   - Formalize the non-help action tradeoff.
   - Reduce main objective participant count when a station stabilizes instead.
   - Add critical success/success/failure/critical failure pressure changes.

3. **Momentum Pass**
   - Earn momentum from strong play.
   - Spend momentum to assist rolls, reduce hazard countdowns, downgrade failures, or improve outcome.

4. **Focus / Support Backlash Pass**
   - Focus spend with backlash by station.
   - Clear player-facing risk text before commitment.

5. **Ship Scar Escalation Pass**
   - Severe unresolved hazards and pressure overflow create ship scar candidates.
   - Actor mutation remains explicit GM Apply only.

6. **Final Outcome / Follow-up Polish**
   - Convert pressure, unresolved hazards, and round results into clean final outcomes and follow-ups.

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
