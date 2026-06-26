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


## Applyable Consequence System

Travel v2 should not require the GM to constantly invent consequences in the middle of play. When the table takes risks, misses rolls, ignores hazards, overflows pressure, or reaches a bad ending, the system should create premade consequence candidates that are fast to review and safe to apply only when the GM chooses.

Consequence triggers should include:

- Failed station action.
- Critical failure.
- Unresolved hazard.
- Hazard escalation.
- Pressure threshold or overflow.
- Failed Focus.
- Failed Support.
- Bad final outcome.

System response:

- Create one or more session-local premade consequence candidates.
- Show all pending consequences in one GM-facing pending consequence queue.
- Allow the GM to **Apply**, **Dismiss**, or **Defer** each candidate.
- Expose only player-safe public summaries to players.
- Never automatically mutate actors, items, chat messages, journals, combats, sockets, scenes, tokens, or persisted world data. Any persistent handoff remains explicit GM Apply only.

The intended loop is simple: the runner identifies the consequence source, offers authored candidates, the GM chooses what is table-appropriate, and the player HUD only receives safe summaries. This keeps consequences premade, fast to apply, and meaningful without turning Travel v2 into a hidden automation layer.

## Consequence Card Shape

Future consequence cards should be authored data records rather than freeform runtime inventions. This PR only documents the intended shape; it does not add runtime consequence schemas or behavior.

A consequence card should eventually include fields such as:

- `id`
- `title`
- `severity`: `minor`, `major`, or `severe`
- `source`: `hazard`, `focus`, `support`, `pressure`, `finalOutcome`, `shipScar`, or another stable source key
- `affectedTrack`: `Hull`, `Strain`, `Lifeveil`, `Morale`, `Supplies`, `Route`, `Cargo`, `Crew`, `Hazard`, `Ship Scar`, `Follow-up`, or `Threat`
- `publicText`
- `gmText`
- `applyEffectSummary`
- Optional session-local effect payload
- Optional explicit GM Apply persistent payload
- `playerSafeSummary`
- `status`: `pending`, `applied`, `dismissed`, or `deferred`

Roadmap example consequence cards:

- **Arkengine Surge:** Strain or engine instability candidate from Engineer failure, Focus backlash, or an unresolved engine hazard.
- **Lifeveil Flicker:** Lifeveil instability candidate from Veilwarden failure, occult hazard escalation, or weird void fallout.
- **Route Drift:** Route complication candidate from Navigator failure, Void Shear, or a poor final outcome.
- **Hull Stress:** Hull consequence candidate from pressure overflow, missed Watchmaster warning, or a physical hazard.
- **Crew Panic:** Morale/Crew consequence candidate from Captain failure, failed Support, or frightening event narration.
- **Cargo Shift:** Cargo consequence candidate from hard maneuvers, hull shocks, or neglected holds.
- **Supplies Delay:** Supplies consequence candidate from low stores, blocked access, or off-course travel.
- **Threat Attracted:** Follow-up/Threat consequence candidate from loud arkengine signatures, Lifeveil flare, or failed stealth.
- **Hazard Escalation:** Existing hazard worsens, locks an option, advances a countdown, or creates a stronger candidate.
- **Ship Scar Candidate:** Severe or repeated damage creates a GM-reviewed scar handoff candidate, never automatic actor/item mutation.

These examples are roadmap examples only. They are not runtime implementations in this documentation PR.

## Permanent Travel v2 Card Schema / Import System

Travel v2 content should become data-driven through stable, versioned schemas so future hazards, consequences, station actions, risk bids, encounter templates, and narration hooks can be authored, validated, imported, exported, and expanded without changing runner code.

Future schema/import targets include:

- Hazard cards.
- Consequence cards.
- Station action cards.
- Station action risk-bid options.
- Station combo benefit cards.
- Encounter templates.
- Narration/vignette hooks.
- Validation/dev tools.
- Import/export tools.

This PR does not implement schemas, importers, exporters, validators, compendia, or runtime data migrations. It only records that stable card schemas should come before broad runner cleanup so content and behavior targets are locked first.

## Visible Stakes Card

Every Travel v2 event should eventually show a clean player/GM-facing stakes summary so the table understands what they are trying to accomplish and why their choices matter.

A visible stakes card should summarize:

- Event goal.
- Round count.
- Current round.
- Current pressure.
- Danger thresholds.
- Known hazards.
- Success result.
- Failure result.
- Escalation risk.
- Current pending decisions.

The goal is not to expose GM secrets. The goal is to make the playable encounter legible: what the crisis is, what success looks like, what failure threatens, and which immediate decisions need attention.

## Momentum Identity

Momentum should feel exciting, not like a small generic bonus pool. It should represent the crew seizing control of the crisis and turning strong play into visible options.

Potential future Momentum spends:

- Upgrade a pending station benefit.
- Cancel or dismiss one minor consequence candidate.
- Suppress or clear a hazard.
- Take an extra emergency response action.
- Protect a station from minor backlash.
- Improve final outcome by one step.
- Convert a critical success into a cross-station opening.

The exact implementation should remain narrow, explicit, and GM-auditable. Momentum should not stack infinitely with station benefits, bypass player choice, or become invisible automation.

## Veilwarden Identity

The Veilwarden needs a clearer Travel v2 role: the Veilwarden is the ship's magical immune system.

Future Veilwarden actions should focus on:

- Suppressing occult/environmental hazards.
- Shielding another station from backlash.
- Stabilizing Lifeveil pressure.
- Absorbing or redirecting weird void fallout.
- Protecting the ship from threat attraction.
- Converting Lifeveil instability into a controlled opening or Momentum.

This identity should help Veilwarden choices feel distinct from Engineer repairs or Captain coordination while still fitting the same station-card and consequence-candidate framework.

## Final Outcome / Aftermath

The final event output should feed the campaign, not merely end the minigame. A completed Travel v2 event should answer:

- Where did the ship end up?
- What changed on the ship?
- What consequence candidates remain?
- Which hazards were cleared or ignored?
- What reward, clue, route advantage, or opportunity opened?
- What follow-up event or threat might happen?

Final outcome text should give the GM a clear aftermath summary, safe public text for players, and explicit GM Apply choices for any persistent effect. Bad outcomes should create authored fallout candidates instead of forcing the GM to improvise consequences from scratch.

## UI Simplicity and Balance Guardrails

Travel v2 should not ask the GM to manage ten separate piles of records. Future UI should aim for:

- One **Current Round** panel.
- One **Pending Decisions** queue.
- One clear **Final Outcome / Aftermath** summary.

Balance guardrails:

- Only one pending station benefit should affect a single station roll unless explicitly allowed.
- DC reductions usually cap at -3.
- Risk bid DC increases are fixed, not custom.
- Most benefits expire after one use or at end of round.
- Momentum should not stack infinitely with station benefits.
- Critical success may improve a benefit but should not double every effect.
- Same-track pressure treadmill hazards should be avoided.

## Implementation Roadmap

This PR is documentation-only. The next roadmap work should lock the clean gameplay arc before broad runner cleanup. Keep scopes narrow, reviewable, and one subsystem per PR. Broad runner splitting belongs to alpha cleanup after the core Travel v2 content, consequence, schema, and stakes targets are clear.

### Recommended Next Sequence

1. **Consequence/schema roadmap pillars**
   - This PR.
   - Docs only.

2. **Permanent card schema planning**
   - Define stable schemas for hazards, consequences, station actions, risk bids, station benefits, and encounter templates.
   - No broad runtime changes yet.

3. **Applyable consequence catalog foundation**
   - Add authored consequence definitions.
   - Keep candidates session-local only.
   - Do not add automatic mutation.

4. **Pending consequence queue**
   - Provide one GM-facing queue for Focus backlash, Support backlash, unresolved hazards, pressure overflow, final outcome fallout, and ship scar candidates.
   - Support **Apply / Dismiss / Defer** lifecycle.
   - Preserve player-safe sanitizer coverage.

5. **First 12 gold-standard hazards**
   - Use the permanent hazard/consequence schema.
   - Avoid same-track pressure treadmill hazards.
   - Ensure each hazard changes player choices.

6. **Gold-standard Travel v2 encounter sample**
   - Demonstrate visible stakes, station choices, hazards, risk bids, station combo benefits, Momentum, consequences, and final aftermath.

7. **Then alpha cleanup extraction**
   - Support record helper extraction.
   - Focus backlash extraction.
   - Momentum extraction.
   - Player sanitizer extraction.
   - Runner library/session extraction.
   - Station row/action handling extraction.

### Later Gameplay Polish

After the schema, consequence, hazard, and sample encounter direction is validated, revisit gameplay polish in narrow PRs:

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
- Actor/item/chat/journal/combat/socket/scene/token mutation must remain explicit GM Apply only.
- Pressure is the consequence layer, not the whole gameplay loop.
- The system should generate or assemble narration from player action results so the GM can read it at the table.
- Support does not count as main objective progress.
- Support does not award Momentum.
- Support assists do not automatically mutate rolls.
- Failed Support creates GM-controlled candidates only.
- Consequences should be premade, fast to apply, and meaningful.
- Card content should be data-driven and importable long-term.
