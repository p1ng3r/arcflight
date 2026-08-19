import { analyzeVoyageEncounterOverallResult } from "../domain/event-result.js";
import { analyzeVoyageEventDefinitionRoundActionAuthoring } from "../domain/round-action-authoring.js";

export const M12_EVENT_ID = "m12-glassback-cinderwake";
export const M12_DEFINITION_SNAPSHOT_ID = "m12-glassback-cinderwake-v3";
export const M12_STATION_IDS = Object.freeze(["captain", "engineer", "navigator", "watchmaster", "veilwarden"]);
// Task 4's first reaction is deliberately event-authored rather than a
// universal Focus action.  It is supplied to the trusted runtime context and
// copied into the durable encounter metadata when Resolution begins.
export const M12_FOCUS_ABILITIES = Object.freeze([
  Object.freeze({
    focusAbilityId: "m12-focus-captain-assist",
    name: "Captain's Clear Line",
    description: "The captain sights a safe passage and guides the current station through it.",
    trigger: "before-current-station-check",
    timing: "before-roll",
    cost: 1,
    stationId: "captain",
    targetStationId: "captain",
    eligibleSource: Object.freeze({ kind: "station", stationId: "captain" }),
    targetRule: Object.freeze({ kind: "current-station", stationId: "captain" }),
    check: Object.freeze({ kind: "pf2e-check", statisticSlugOrAbilityId: "perception" }),
    dcSource: Object.freeze({ kind: "fixed", value: 18 }),
    statisticSlugOrAbilityId: "perception",
    dc: 18,
    secrecy: "public",
    outcomes: Object.freeze({ criticalSuccess: 3, success: 1, failure: -1, criticalFailure: -3 }),
    outcomeNarration: Object.freeze({
      criticalSuccess: "The captain finds the safe line and gives the current check +3.",
      success: "The captain opens a clear line and gives the current check +1.",
      failure: "The captain's call is costly; the current check takes -1.",
      criticalFailure: "The captain's warning misleads the crew; the current check takes -3."
    }),
    visibility: "public",
    narration: "The captain sights a safe passage through the Glassback's wake."
  })
]);

const stationIds = ["captain", "engineer", "navigator", "watchmaster", "veilwarden"];

// The first-round actions deliberately use ordinary PF2e statistics.  The
// runtime binds the authored character source to the durable station operator
// UUID before a check is prepared; the definition itself remains declarative.
const stationStatistics = {
  captain: ["diplomacy", "intimidation", "society"],
  engineer: ["crafting", "athletics", "arcana"],
  navigator: ["survival", "nature", "society"],
  watchmaster: ["perception", "stealth", "survival"],
  veilwarden: ["occultism", "religion", "medicine"]
};

const ROUND_STORIES = Object.freeze([
  Object.freeze({
    title: "The Wreck's Ember Wake",
    vignette: "The Glassback turns through the broken wreck, dragging a ribbon of ember-lit debris behind it.",
    situation: "The ship is caught between collapsing spars and the creature's first sweep.",
    objective: "Clear a survivable lane before the wake folds back over the crew.",
    knownStakes: "A clean opening preserves the ship's momentum; a bad opening exposes the nearest station to the wreck.",
    actionThemes: ["Rally the deck", "Brace the engine", "Read the wake"]
  }),
  Object.freeze({
    title: "Through the Cinderwake",
    vignette: "The wreck's furnace-heart cracks open and a red current races toward the ship's veil.",
    situation: "Heat, ash, and shifting gravity split the crew's attention across three hazards.",
    objective: "Thread the ship through the cinderwake while keeping the veil and engine aligned.",
    knownStakes: "Speed gains ground, but every aggressive bid leaves less margin for the next station.",
    actionThemes: ["Cut a hot angle", "Rebuild the watch", "Anchor the veil"]
  }),
  Object.freeze({
    title: "The Glassback's Turn",
    vignette: "The leviathan rolls beneath the wreck and reveals a narrow blue seam in the storm.",
    situation: "The final passage is visible for only a few breaths and the ship must commit to a line.",
    objective: "Take the seam and emerge from the wreck's shadow before it closes.",
    knownStakes: "The safest line is slower; the highest bid can create the decisive escape or a violent backlash.",
    actionThemes: ["Command the escape", "Drive the break", "Sing the seam"]
  })
]);

// The source table is deliberately round-owned.  The normalizer below only
// supplies stable IDs and the declarative shape consumed by the existing
// outcome interpreter; it does not invent action names, approaches, or stakes.
const ROUND_ACTION_AUTHORING = Object.freeze([
  {
    captain: [
      { key: "command-the-opening", name: "Command the Opening", description: "Set a single order through the breaking wreck before the ember spars collapse.", approaches: [["Diplomacy", "diplomacy"], ["Intimidation", "intimidation"]], bids: [[2, "The crew gains a measured lane through the first spar field.", "The helm clears a safe lane and the next station gains room.", "The ship holds its line through the opening.", "The order exposes the helm to a cross-current.", "The wreck closes the lane around the helm."] , [5, "Force a sharp turn before the wreck folds.", "The turn puts the next station on the clean side of the wake.", "The ship cuts across the opening.", "The turn scrapes the outer rail.", "The sharp turn throws the helm off the safe line."] , [8, "Commit the whole ship to the decisive escape line.", "The escape line opens the round's best route.", "The ship surges beyond the collapsing spars.", "The escape line leaves the helm exposed.", "The wreck's turn catches the ship broadside."] ] },
      { key: "steady-the-crew", name: "Steady the Crew", description: "Turn panic into a deliberate response while the wreck groans across the bow.", approaches: [["Diplomacy", "diplomacy"], ["Society", "society"]], bids: [[2, "Keep the crew together through the first shock.", "A steady crew protects the next station from panic.", "The deck answers as one.", "A shouted order is lost in the ash.", "The crew breaks formation at the worst moment."] , [5, "Make the crew's rhythm carry the ship through the shock.", "The rhythm gives the next station a clear opening.", "The crew moves before the spar falls.", "The rhythm falters and costs time.", "The panic spreads into the engine watch."] ] },
        { key: "mark-the-beast", name: "Mark the Beast", description: "Read the Glassback's first turn and call where its wake will break.", approaches: [["Society", "society"], ["Diplomacy", "diplomacy"]], bids: [[2, "Predict the leviathan's first turn.", "The prediction gives the next station a clean approach.", "The wake bends away from the ship.", "The mark arrives a breath late.", "The beast turns toward the marked escape lane."] , [5, "Predict the leviathan's first turn with a firm call.", "The prediction gives the next station a clean approach.", "The wake bends away from the ship.", "The mark arrives a breath late.", "The beast turns toward the marked escape lane."] , [8, "Stake the opening on the creature's movement.", "The call reveals the round's decisive seam.", "The ship rides the beast's blind side.", "The call forces a dangerous correction.", "The Glassback's turn traps the ship in the wreck."] ] }
    ],
    engineer: [
      { key: "brace-the-arkengine", name: "Brace the Arkengine", description: "Keep the engine from tearing loose as the wreck's first shock reaches the drive coils.", approaches: [["Crafting", "crafting"], ["Athletics", "athletics"]], bids: [[2, "Hold the drive steady through the opening shock.", "The next station receives a stable engine beat.", "The coils stay aligned.", "A brace slips and costs a breath.", "The drive tears against its mounts."] , [5, "Overbrace the engine for a hard turn.", "The reinforced drive gives the next station extra room.", "The Arkengine answers the helm immediately.", "Heat builds in the drive housing.", "The brace locks at the wrong angle."] ] },
      { key: "bleed-the-furnace", name: "Bleed the Furnace", description: "Vent the furnace surge before it reaches the drive coils under the collapsing spars.", approaches: [["Crafting", "crafting"], ["Arcana", "arcana"]], bids: [[5, "Trade stored heat for a clean opening.", "The vented heat clears the next station's approach.", "The furnace settles into a quiet burn.", "The vent leaves the drive briefly weak.", "The surge bursts through the vent manifold."] , [8, "Dump the whole surge and trust the engine to recover.", "The violent vent opens the fastest route.", "The ship clears the furnace wake in one burst.", "The engine loses its reserve.", "The furnace backfires through the drive coils."] ] },
      { key: "reroute-the-drive", name: "Reroute the Drive", description: "Trade heat for a precise burst through the first moving debris field.", approaches: [["Arcana", "arcana"], ["Athletics", "athletics"]], bids: [[2, "Redirect a small surge around the damaged coil.", "The next station receives a controlled burst.", "The reroute holds.", "The bypass runs hot.", "The bypass feeds the wrong coil."] , [8, "Put the remaining drive power behind one exact line.", "The burst carries the ship past the worst debris.", "The Arkengine punches through the field.", "The burst leaves the drive strained.", "The reroute fractures the drive path."] ] }
    ],
    navigator: [
      { key: "plot-the-wake", name: "Plot the Wake", description: "Find the current that will carry the ship around the first wrecked spar.", approaches: [["Survival", "survival"], ["Nature", "nature"]], bids: [[2, "Choose a current with a forgiving exit.", "The next station can follow the plotted lane.", "The ship catches the current cleanly.", "The current shears at the edge.", "The wake dumps the ship into the spar field."] , [5, "Plot across the wake before it folds.", "The crossing opens the round's safest route.", "The ship clears the first wreck.", "The route narrows unexpectedly.", "The plotted current reverses under the hull."] ] },
      { key: "read-the-embers", name: "Read the Embers", description: "Interpret the cinderwake's first eddies before they become a wall.", approaches: [["Nature", "nature"], ["Society", "society"]], bids: [[5, "Read the ember drift for a clean seam.", "The next station sees the seam before it closes.", "The ember wall parts.", "The reading is incomplete.", "The embers conceal a false seam."] ] },
      { key: "take-the-short-line", name: "Take the Short Line", description: "Commit to the narrowest route through the first moving field.", approaches: [["Survival", "survival"], ["Society", "society"]], bids: [[2, "Cut distance without losing the exit.", "The shortened route gives the next station time.", "The ship takes the short line.", "The line tightens around the bow.", "The short line ends inside the wreck."] , [8, "Bet the opening on a single precise heading.", "The heading reveals the round's decisive gap.", "The ship slips through the field.", "The heading requires a costly correction.", "The gap closes around the ship."] ] }
    ],
    watchmaster: [
      { key: "spot-the-fall", name: "Spot the Fall", description: "Call out the spar and ash that will cross the deck in the opening surge.", approaches: [["Perception", "perception"], ["Survival", "survival"]], bids: [[2, "Give the deck one clear warning.", "The next station has time to act.", "The falling spar misses the working deck.", "The warning arrives late.", "The spar lands across the active station."] , [5, "Track every falling piece through the ash.", "The warning opens a clean deck for the next station.", "The watch calls the whole pattern.", "One fragment slips past the watch.", "The ash hides the largest fall."] ] },
      { key: "lash-the-deck", name: "Lash the Deck", description: "Secure exposed rigging before the first ember gust catches it.", approaches: [["Perception", "perception"], ["Survival", "survival"]], bids: [[5, "Secure the line that will move the crew next.", "The next station works from a firm deck.", "The rigging holds.", "A lash must be reset.", "The line tears free across the deck."] ] },
      { key: "shadow-the-beast", name: "Shadow the Beast", description: "Track the leviathan's first turn and warn the crew before impact.", approaches: [["Perception", "perception"], ["Stealth", "stealth"]], bids: [[2, "Follow the beast without drawing its eye.", "The next station can move under its blind side.", "The watch stays unseen.", "The beast notices a wake ripple.", "The beast turns directly toward the watch."] , [8, "Stake the watch on the creature's blind side.", "The call exposes the decisive route.", "The watchmaster reads the turn perfectly.", "The watch loses the beast for a breath.", "The Glassback sweeps the watch's position."] ] }
    ],
    veilwarden: [
      { key: "seal-the-veil", name: "Seal the Veil", description: "Hold the lifeveil closed against ember and vacuum in the opening pass.", approaches: [["Occultism", "occultism"], ["Religion", "religion"]], bids: [[2, "Seal the nearest leak before the wake arrives.", "The next station works behind a stable veil.", "The lifeveil closes cleanly.", "A seam remains warm.", "The leak opens across the active station."] , [5, "Layer the veil before the ship enters the ash.", "The layered veil opens the next station's route.", "The lifeveil turns the ash aside.", "The layers consume reserve.", "The veil folds inward under the pressure."] ] },
      { key: "sing-the-pressure", name: "Sing the Pressure", description: "Tune the veil to the wreck's unstable resonance before the first pressure wave.", approaches: [["Occultism", "occultism"], ["Medicine", "medicine"]], bids: [[5, "Match the resonance and hold it through the wave.", "The tuned veil steadies the next station.", "The resonance settles.", "The harmony slips at the edge.", "The pressure answers with a violent pulse."] ] },
      { key: "tend-the-breaches", name: "Tend the Breaches", description: "Keep the crew protected while the hull shudders through the first break.", approaches: [["Medicine", "medicine"], ["Religion", "religion"]], bids: [[2, "Close the breach nearest the working crew.", "The next station gains a protected footing.", "The breach seals.", "The seal needs another hand.", "The breach spreads beneath the crew."] , [8, "Spend the veil's reserve to protect the whole deck.", "The protected deck opens the best route.", "The lifeveil shelters every station.", "The reserve drops dangerously low.", "The reserve fails at the moment of impact."] ] }
    ]
  },
  {
    captain: [
      { key: "cut-the-hot-angle", name: "Cut the Hot Angle", description: "Turn across the red current while the cinderwake races toward the veil.", approaches: [["Diplomacy", "diplomacy"], ["Society", "society"]], bids: [[2, "Take a controlled angle through the heat.", "The next station gets a cooler approach.", "The bow clears the red current.", "The angle costs speed.", "The current catches the ship's side."] , [8, "Cut across the current before it seals.", "The decisive turn opens the route beyond the wake.", "The ship crosses the cinderwake.", "The turn leaves the helm exposed.", "The current rolls the ship toward the furnace."] ] },
      { key: "rebuild-the-watch", name: "Rebuild the Watch", description: "Reassign the shaken watch while ash blinds the forward windows.", approaches: [["Diplomacy", "diplomacy"], ["Intimidation", "intimidation"]], bids: [[5, "Rebuild a watch that can see through the ash.", "The next station receives a clear warning.", "The watch reforms in time.", "One post remains empty.", "The ash scatters the watch again."] ] },
      { key: "anchor-the-helm", name: "Anchor the Helm", description: "Fix the ship's heading while the cinderwake pulls at the rudder line.", approaches: [["Society", "society"], ["Diplomacy", "diplomacy"]], bids: [[2, "Keep one heading through the pull.", "The next station can commit without correction.", "The heading holds.", "The rudder drifts.", "The cinderwake turns the ship around."] , [5, "Anchor the helm against the whole current.", "The anchored heading reveals a cleaner route.", "The ship holds through the pull.", "The anchor strains.", "The rudder line snaps under the wake."] ] }
    ],
    engineer: [
      { key: "rebalance-the-coils", name: "Rebalance the Coils", description: "Spread the furnace heat across the drive while the cinderwake climbs the hull.", approaches: [["Crafting", "crafting"], ["Arcana", "arcana"]], bids: [[2, "Keep the coils inside their safe band.", "The next station receives a reliable drive.", "The coils balance.", "One coil runs hot.", "The drive dumps power into the wake."] , [5, "Shift heat before it reaches the veil.", "The shift gives the next station a clean window.", "The Arkengine rebalances.", "Heat lingers in the housing.", "The shift overloads a coil."] ] },
      { key: "cool-the-drive", name: "Cool the Drive", description: "Draw heat out of the drive before the red current reaches the engine room.", approaches: [["Crafting", "crafting"], ["Medicine", "medicine"]], bids: [[5, "Cool the housing without losing thrust.", "The next station works behind a cooler engine.", "The drive cools without slowing.", "The cooling line clogs.", "The cold shock cracks the housing."] ] },
      { key: "force-the-burst", name: "Force the Burst", description: "Push the Arkengine through the narrow center of the cinderwake.", approaches: [["Athletics", "athletics"], ["Arcana", "arcana"]], bids: [[2, "Use one clean burst to cross the current.", "The burst gives the next station room.", "The engine punches through.", "The burst fades early.", "The drive surge drags the ship sideways."] , [8, "Overdrive the coils for the only open line.", "The overdrive creates the escape window.", "The ship clears the red current.", "The engine runs on reserve.", "The overdrive fractures the drive path."] ] }
    ],
    navigator: [
      { key: "thread-the-cinderwake", name: "Thread the Cinderwake", description: "Thread the ship between the red current and the wreck's falling furnace plates.", approaches: [["Nature", "nature"], ["Survival", "survival"]], bids: [[2, "Choose the seam with the widest exit.", "The next station inherits a stable seam.", "The ship threads the wake.", "The seam narrows.", "The wake folds over the chosen route."] , [5, "Cross the seam while the furnace plates fall.", "The crossing reveals the route onward.", "The ship passes between the plates.", "A plate clips the wake.", "The plates close the seam."] ] },
      { key: "chart-the-red-current", name: "Chart the Red Current", description: "Chart the current's bend before it reaches the ship's veil.", approaches: [["Nature", "nature"], ["Society", "society"]], bids: [[5, "Map the bend for the next station.", "The map gives the next station a clear line.", "The current's bend is exposed.", "The map loses one turn.", "The current doubles back through the route."] ] },
      { key: "cross-the-furnace-line", name: "Cross the Furnace Line", description: "Commit to the shortest crossing before the cinderwake becomes impassable.", approaches: [["Survival", "survival"], ["Nature", "nature"]], bids: [[2, "Cross before the line hardens.", "The next station reaches the far side in time.", "The crossing is clean.", "The line tightens.", "The furnace line seals around the ship."] , [8, "Bet everything on the final opening.", "The crossing creates the round's decisive route.", "The ship outruns the cinderwake.", "The crossing burns the outer margin.", "The ship is carried into the furnace heart."] ] }
    ],
    watchmaster: [
      { key: "rebuild-the-lookout", name: "Rebuild the Lookout", description: "Restore a clear lookout while ash and heat split the watch stations.", approaches: [["Perception", "perception"], ["Stealth", "stealth"]], bids: [[2, "Reopen one clear sightline.", "The next station receives a warning before the heat front.", "The lookout sees the gap.", "The ash closes the sightline.", "The lookout calls the wrong gap."] , [5, "Coordinate every lookout through the ash.", "The coordinated watch opens a safer route.", "The watch tracks the whole front.", "One signal is delayed.", "The watch loses the current entirely."] ] },
      { key: "secure-the-rail", name: "Secure the Rail", description: "Keep the outer rail intact while the cinderwake hammers the side of the ship.", approaches: [["Perception", "perception"], ["Athletics", "athletics"]], bids: [[5, "Secure the rail before the next impact.", "The next station works behind a firm rail.", "The rail holds.", "A brace bends.", "The rail tears open under the wave."] ] },
      { key: "follow-the-shadow", name: "Follow the Shadow", description: "Use the Glassback's shadow to hide the ship from the hottest current.", approaches: [["Stealth", "stealth"], ["Perception", "perception"]], bids: [[2, "Stay inside the beast's shadow.", "The next station crosses unseen.", "The shadow covers the ship.", "The shadow slips.", "The beast's shadow throws the ship into heat."] , [8, "Ride the shadow through the furnace bend.", "The shadow opens the decisive escape.", "The ship vanishes behind the beast.", "The shadow breaks at the turn.", "The beast's wake exposes the ship."] ] }
    ],
    veilwarden: [
      { key: "anchor-the-veil", name: "Anchor the Veil", description: "Anchor the lifeveil while red pressure climbs through the cinderwake.", approaches: [["Occultism", "occultism"], ["Religion", "religion"]], bids: [[2, "Hold the veil at one stable pressure.", "The next station receives a protected window.", "The veil anchors.", "Pressure leaks at the edge.", "The veil snaps against the current."] , [5, "Drive the veil into the current and hold it.", "The anchored veil opens the next route.", "The veil turns the heat aside.", "The veil strains.", "The current tears a hole in the field."] ] },
      { key: "translate-the-ash", name: "Translate the Ash", description: "Read the ash's resonance and tune the veil before the next pressure wave.", approaches: [["Occultism", "occultism"], ["Medicine", "medicine"]], bids: [[5, "Tune the field to the ash's rhythm.", "The next station sees a calm pressure pocket.", "The ash passes harmlessly.", "The rhythm slips.", "The ash locks the veil in a false rhythm."] ] },
      { key: "protect-the-engine", name: "Protect the Engine", description: "Wrap the drive coils in a temporary veil as the cinderwake surges.", approaches: [["Medicine", "medicine"], ["Religion", "religion"]], bids: [[2, "Shield the drive's nearest breach.", "The next station gains a stable engine window.", "The shield holds.", "The shield thins.", "The surge reaches the drive."] , [8, "Spend the veil's reserve to cover the whole engine.", "The protected engine creates the escape route.", "The drive emerges untouched.", "The reserve falls to its limit.", "The reserve collapses across the engine room."] ] }
    ]
  },
  {
    captain: [
      { key: "command-the-escape", name: "Command the Escape", description: "Call the final escape line as the Glassback rolls beneath the wreck.", approaches: [["Diplomacy", "diplomacy"], ["Intimidation", "intimidation"]], bids: [[2, "Choose the safe seam and keep the crew moving.", "The next station reaches the blue seam cleanly.", "The escape line opens.", "The line slows.", "The wreck closes the safe seam."] , [5, "Commit the helm before the seam vanishes.", "The commitment gives the next station the decisive opening.", "The ship reaches the seam.", "The helm scrapes the last spar.", "The Glassback's roll catches the hull."] ] },
      { key: "drive-the-break", name: "Drive the Break", description: "Push the crew through the final opening before the leviathan's wake closes.", approaches: [["Intimidation", "intimidation"], ["Diplomacy", "diplomacy"]], bids: [[5, "Make the crew move as the opening breaks.", "The next station acts before the seam closes.", "The crew crosses the break.", "One station hesitates.", "The break seals around the crew."] ] },
      { key: "sing-the-seam", name: "Sing the Seam", description: "Name the blue seam beneath the rolling beast and make it the ship's destination.", approaches: [["Society", "society"], ["Diplomacy", "diplomacy"]], bids: [[2, "Hold the seam in every voice.", "The next station can follow the shared line.", "The seam stays visible.", "The voices split.", "The seam disappears under the wake."] , [8, "Stake the final escape on the seam.", "The seam reveals the route out of the wreck.", "The ship follows the blue line.", "The call arrives at the edge.", "The Glassback rolls across the chosen seam."] ] }
    ],
    engineer: [
      { key: "ignite-the-last-coil", name: "Ignite the Last Coil", description: "Light the last reserve coil for the final climb through the blue seam.", approaches: [["Arcana", "arcana"], ["Athletics", "athletics"]], bids: [[2, "Feed one reserve coil into the climb.", "The next station gets a steady ascent.", "The coil lights cleanly.", "The reserve sputters.", "The coil flashes back through the drive."] , [8, "Spend every remaining spark on the escape.", "The burst creates the final route out.", "The ship climbs through the seam.", "The drive loses its margin.", "The last coil detonates in the wake."] ] },
      { key: "break-the-hull-drag", name: "Break the Hull Drag", description: "Free the hull from the wreck's grip before the final turn closes.", approaches: [["Athletics", "athletics"], ["Crafting", "crafting"]], bids: [[5, "Cut the drag without tearing the hull.", "The next station moves before the wreck turns.", "The hull comes free.", "A brace twists.", "The hull locks into the wreck."] ] },
      { key: "fire-the-escape", name: "Fire the Escape", description: "Aim the Arkengine through the last blue opening under the Glassback.", approaches: [["Arcana", "arcana"], ["Crafting", "crafting"]], bids: [[2, "Fire a measured final thrust.", "The next station reaches the seam with room to spare.", "The thrust finds the seam.", "The thrust arrives late.", "The engine fires into the beast's wake."] , [5, "Put the full drive behind the final line.", "The drive opens the decisive escape.", "The ship clears the wreck.", "Heat scorches the coils.", "The final thrust folds the drive path."] ] }
    ],
    navigator: [
      { key: "find-the-blue-seam", name: "Find the Blue Seam", description: "Locate the narrow blue seam revealed beneath the Glassback's final roll.", approaches: [["Nature", "nature"], ["Survival", "survival"]], bids: [[2, "Mark the seam before it flickers.", "The next station gets the clean route.", "The seam brightens.", "The mark fades.", "The seam is a false opening."] , [8, "Commit to the seam's exact timing.", "The timing opens the final escape.", "The ship meets the seam.", "The timing leaves the ship clipped by the wake.", "The seam collapses around the ship."] ] },
      { key: "thread-the-fall", name: "Thread the Fall", description: "Thread between the falling wreck and the beast's wake during the final turn.", approaches: [["Survival", "survival"], ["Nature", "nature"]], bids: [[5, "Choose the falling gap with the widest exit.", "The next station follows the clean gap.", "The ship threads the fall.", "The gap narrows.", "The wreck falls across the route."] ] },
      { key: "plot-the-exit", name: "Plot the Exit", description: "Plot the final exit before the blue seam closes beneath the leviathan.", approaches: [["Nature", "nature"], ["Society", "society"]], bids: [[2, "Plot the safe exit and preserve the return line.", "The next station reaches open space.", "The exit holds.", "The return line drifts.", "The exit folds into the wreck."] , [5, "Plot the fastest exit through the closing seam.", "The plot reveals the final clean route.", "The ship reaches open sky.", "The route scrapes the wake.", "The fast exit ends inside the storm."] ] }
    ],
    watchmaster: [
      { key: "call-the-final-fall", name: "Call the Final Fall", description: "Call the last falling spar as the ship reaches the blue seam.", approaches: [["Perception", "perception"], ["Survival", "survival"]], bids: [[2, "Give the crew one final warning.", "The next station crosses before the spar falls.", "The spar misses the deck.", "The warning is late.", "The spar blocks the seam."] , [5, "Track the entire fall through the storm.", "The complete call opens the last route.", "The watch sees every break.", "One fragment is missed.", "The falling wreck hides the exit."] ] },
      { key: "guard-the-seam", name: "Guard the Seam", description: "Keep the blue seam clear while the beast's wake breaks behind the ship.", approaches: [["Perception", "perception"], ["Athletics", "athletics"]], bids: [[5, "Hold the seam's edge for the final crossing.", "The next station crosses behind the guard.", "The seam remains clear.", "A fragment crosses the edge.", "The wake closes the guarded seam."] ] },
      { key: "watch-the-roll", name: "Watch the Roll", description: "Read the Glassback's final roll and signal the instant to leave.", approaches: [["Perception", "perception"], ["Stealth", "stealth"]], bids: [[2, "Stay unseen until the roll exposes the seam.", "The next station moves at the perfect instant.", "The roll opens the seam.", "The signal comes just after the turn.", "The beast rolls across the escape line."] , [8, "Stake the escape on the exact roll.", "The signal creates the decisive exit.", "The ship leaves under the beast.", "The watch loses the timing.", "The roll crushes the final line."] ] }
    ],
    veilwarden: [
      { key: "hold-the-blue-veil", name: "Hold the Blue Veil", description: "Hold the lifeveil in the blue seam while the wreck collapses behind the ship.", approaches: [["Occultism", "occultism"], ["Religion", "religion"]], bids: [[2, "Keep one stable veil through the crossing.", "The next station crosses protected.", "The blue veil holds.", "The veil thins.", "The seam tears through the lifeveil."] , [5, "Extend the veil across the whole escape line.", "The extended veil opens the last route.", "The crew crosses under blue light.", "The extension strains the reserve.", "The veil collapses behind the ship."] ] },
      { key: "close-the-wake", name: "Close the Wake", description: "Fold the lifeveil behind the ship to keep the Glassback's wake from following.", approaches: [["Religion", "religion"], ["Occultism", "occultism"]], bids: [[5, "Close the wake without trapping the ship.", "The next station leaves a clean trail.", "The wake folds shut.", "The fold lags behind the hull.", "The wake tears back through the seam."] ] },
      { key: "shelter-the-crew", name: "Shelter the Crew", description: "Shelter every station during the last violent transition into open sky.", approaches: [["Medicine", "medicine"], ["Religion", "religion"]], bids: [[2, "Shelter the nearest crew through the transition.", "The next station reaches safety.", "The shelter holds.", "One crew member remains exposed.", "The transition breaks the shelter."] , [8, "Spend the final reserve to shelter the entire ship.", "The full shelter makes the escape possible.", "Every station reaches open sky.", "The reserve empties.", "The shelter fails beneath the beast's wake."] ] }
    ]
  }
]);

const BRANCHES = ["criticalSuccess", "success", "failure", "criticalFailure"];
const RISK_BID_ACTION_KEYS = Object.freeze({
  1: new Set(["command-the-opening", "mark-the-beast", "brace-the-arkengine", "plot-the-wake"]),
  2: new Set(["cut-the-hot-angle", "force-the-burst", "thread-the-cinderwake", "anchor-the-veil"]),
  3: new Set(["command-the-escape", "fire-the-escape", "find-the-blue-seam", "watch-the-roll"])
});
const RISK_BID_EFFECT_AUTHORING = Object.freeze({
  "command-the-opening": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["navigator"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["navigator"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["navigator"] }] },
  "mark-the-beast": {
    2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["navigator"] }],
    5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["navigator"] }, { effectKind: "roll-bonus", value: 1, targetStationIds: ["watchmaster"] }],
    8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["navigator"] }]
  },
  "brace-the-arkengine": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["captain"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["captain"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["captain"] }] },
  "plot-the-wake": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["watchmaster"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["watchmaster"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["watchmaster"] }] },
  "spot-the-fall": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["engineer"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["engineer"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["engineer"] }] },
  "cut-the-hot-angle": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["navigator"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["navigator"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["navigator"] }] },
  "force-the-burst": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["captain"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["captain"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["captain"] }] },
  "thread-the-cinderwake": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["watchmaster"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["watchmaster"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["watchmaster"] }] },
  "anchor-the-veil": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["engineer"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["engineer"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["engineer"] }] },
  "command-the-escape": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["navigator"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["navigator"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["navigator"] }] },
  "fire-the-escape": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["watchmaster"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["watchmaster"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["watchmaster"] }] },
  "find-the-blue-seam": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["engineer"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["engineer"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["engineer"] }] },
  "watch-the-roll": { 2: [{ effectKind: "roll-bonus", value: 1, targetStationIds: ["veilwarden"] }], 5: [{ effectKind: "roll-bonus", value: 2, targetStationIds: ["veilwarden"] }], 8: [{ effectKind: "degree-shift", value: 1, targetStationIds: ["veilwarden"] }] }
});

function authoredAction(stationId, roundNumber, actionNumber) {
  const actionId = `${stationId}-round-${roundNumber}-action-${actionNumber}`;
  const source = ROUND_ACTION_AUTHORING[roundNumber - 1][stationId][actionNumber - 1];
  const story = ROUND_STORIES[roundNumber - 1];
  const statistics = stationStatistics[stationId];
  const approachSources = source.approaches;
  const effectRules = [];
  const riskBidCapable = RISK_BID_ACTION_KEYS[roundNumber].has(source.key);
  const authoredBids = riskBidCapable ? source.bids : [];
  const riskBidOptions = authoredBids.map(([dcAdjustment, intendedBenefit, criticalSuccess, success], bidIndex) => {
    const riskBidId = `${actionId}-risk-${dcAdjustment}`;
    const outcomes = {};
    for (const [branchIndex, branch] of [[0, "criticalSuccess"], [1, "success"]]) {
      const effectId = `${riskBidId}-${branch.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
      outcomes[branch] = [effectId];
      effectRules.push({
        effectId,
        intentType: "temporary-consequence",
        timing: "consequences",
        visibility: "public",
        target: { kind: "station", targetId: stationId },
        payload: { actionId, riskBidId, branch, text: [criticalSuccess, success][branchIndex] }
      });
    }
    outcomes.failure = [];
    outcomes.criticalFailure = [];
    return { riskBidId, dcAdjustment, outcomes };
  });
  const riskBidPresentation = Object.fromEntries(authoredBids.map(([dcAdjustment, intendedBenefit, criticalSuccess, success]) => [String(dcAdjustment), {
    label: `+${dcAdjustment} Risk Bid`,
    intendedBenefit,
    target: `${source.name} at the ${stationId} station`,
    mechanicalEffect: Object.freeze({
      effects: (RISK_BID_EFFECT_AUTHORING[source.key]?.[dcAdjustment] ?? []).map((effect) => ({ ...effect, activationTiming: "next-unresolved-check", consumptionTiming: "on-target-resolution", requiresSourceBeforeTarget: true })),
      sourceBeforeTarget: true
    }),
    outcome: { criticalSuccess, success, failure: "Failure: no Risk Bid payoff; no additional Risk Bid penalty.", criticalFailure: "Critical Failure: no Risk Bid payoff; no additional Risk Bid penalty." }
  }]));
  return {
    actionId,
    name: source.name,
    description: `${source.description} ${story.situation}`,
    objective: story.objective,
    riskBidPresentation,
    check: { source: { kind: "character" }, statisticOptions: [...statistics], dcSource: { kind: "fixed", value: 18 }, secrecy: "public", metadata: {} },
    approaches: approachSources.map(([name, statisticSlugOrAbilityId], index) => ({
      approachId: `${actionId}-${index === 0 ? "approach" : "alternate"}`,
      name,
      description: `${name} directly addresses ${source.name.toLowerCase()}.`,
      statisticSlugOrAbilityId
    })),
    outcomeDefinition: { effectRules, branches: { "critical-success": [], success: [], failure: [], "critical-failure": [] } },
    riskBidOptions
  };
}

function authoredRound(roundNumber) {
  const story = ROUND_STORIES[roundNumber - 1];
  return { roundId: `m12-round-${roundNumber}`, roundNumber, title: story.title, vignette: story.vignette, situation: story.situation, objective: story.objective, knownStakes: story.knownStakes, availableStations: stationIds.map((stationId) => ({ stationId, actions: [1, 2, 3].map((actionNumber) => authoredAction(stationId, roundNumber, actionNumber)) })) };
}

const definition = {
  schemaVersion: 1,
  eventId: M12_EVENT_ID,
  definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID,
  roundCount: 3,
  rounds: [1, 2, 3].map(authoredRound),
  rewards: [],
  enhancements: [],
  misfortuneEnhancements: [],
  misfortunes: [],
  nextSituations: [{ nextSituationId: "m12-next-situation", title: "Into the Cinderwake", summary: "The wreck's wake opens a dangerous route onward.", transitionKind: "authored" }]
};

export const M12_EVENT_PRESENTATION = Object.freeze({
  eventId: M12_EVENT_ID,
  definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID,
  title: "The Glassback at Cinderwake Wreck",
  description: "A glassback leviathan circles a broken Arkflight wreck while its ember wake tears at the vessel's veil.",
  roundCount: 3,
  stationIds: M12_STATION_IDS,
  rounds: ROUND_STORIES
});

export function getM12EventDefinition() {
  return structuredClone(definition);
}

export function validateM12EventDefinition(value) {
  try {
    const captured = structuredClone(value);
    const authoring = analyzeVoyageEventDefinitionRoundActionAuthoring(captured);
    if (!authoring.structurallyValid || !authoring.authoringValid) return { valid: false, errors: authoring.errors, warnings: authoring.warnings };
    if (JSON.stringify(captured) !== JSON.stringify(definition)) return { valid: false, errors: [{ code: "m12-event-definition-mismatch", path: "eventDefinition", message: "The Milestone 12 event definition is not the registered immutable snapshot.", severity: "error" }], warnings: [] };
    const history = {
      schemaVersion: 1, eventId: M12_EVENT_ID, sessionId: "m12-definition-check", definitionSnapshotId: M12_DEFINITION_SNAPSHOT_ID,
      roundCount: 3, rounds: definition.rounds.map((round, index) => ({ roundId: round.roundId, roundNumber: index + 1, roundResult: "round-success" }))
    };
    const overallDefinition = { ...captured, rounds: captured.rounds.map((round, index) => ({ roundId: round.roundId, roundNumber: index + 1 })) };
    const result = analyzeVoyageEncounterOverallResult({ kind: "m8-overall-result", sessionId: history.sessionId, eventDefinition: overallDefinition, completedRoundHistory: history });
    return result.ok ? { valid: true, errors: [], warnings: [] } : { valid: false, errors: result.errors, warnings: result.warnings };
  } catch {
    return { valid: false, errors: [{ code: "m12-event-definition-invalid", path: "eventDefinition", message: "The Milestone 12 event definition could not be validated safely.", severity: "error" }], warnings: [] };
  }
}
