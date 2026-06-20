function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const STATIONS = Object.freeze({
  captain: "Captain",
  navigator: "Navigator",
  engineer: "Engineer",
  veilwarden: "Veilwarden",
  watchmaster: "Watchmaster"
});

const ROUND_OUTCOME_BRANCHES = Object.freeze([
  ["dominantSuccess", "Success"],
  ["mixed", "Mixed"],
  ["dominantFailure", "Failure"],
  ["catastrophicFailure", "Catastrophic Failure"]
]);

const APPROACH_FEEDBACK = Object.freeze({
  criticalSuccess: "The plan lands cleanly; the crew gains a clear read on the static and keeps the ship's intent private.",
  success: "The plan holds. The ship moves on with discipline, though the lantern keeps listening.",
  failure: "The plan only partly holds, leaving a bruise of silver noise where the crew expected certainty.",
  criticalFailure: "The static catches the attempt and answers in a trusted voice, forcing the crew to recover under pressure."
});

function feedback(noun) {
  return {
    criticalSuccess: `${noun} becomes a clean advantage; the false echoes lose their grip for a precious moment.`,
    success: `${noun} holds well enough for the ship to keep moving with purpose.`,
    failure: `${noun} frays under the static, and a small cost follows the ship forward.`,
    criticalFailure: `${noun} breaks at the worst moment, giving the lantern a sharper claim on the crossing.`
  };
}

function approach(skill, label, helpText) {
  return {
    skill,
    label,
    helpText,
    boardResultFeedback: APPROACH_FEEDBACK,
    gmNarrationFeedback: APPROACH_FEEDBACK,
    gmOnlyConsequence: "If this goes poorly, mark the fictional consequence in the next transition narration; no automatic ship change occurs."
  };
}

function card(stationKey, problem, approaches) {
  return {
    stationKey,
    stationName: STATIONS[stationKey],
    problem,
    skillApproaches: approaches,
    rollFeedback: feedback(`${STATIONS[stationKey]}'s answer`)
  };
}

function prompt(stationKey, playerAction, skills, vignette) {
  return {
    stationKey,
    stationName: STATIONS[stationKey],
    suggestedSkills: skills,
    playerAction,
    resourceOptions: [],
    vignette,
    rollFeedback: feedback(`${STATIONS[stationKey]}'s choice`)
  };
}

function branches(success, mixed, failure) {
  return {
    dominantSuccess: { vignette: success, proposedEffects: [] },
    mixed: { vignette: mixed, proposedEffects: [] },
    dominantFailure: { vignette: failure, proposedEffects: [] },
    catastrophicFailure: { vignette: `${failure} The pressure lands harder than expected, and the GM should carry that dread into the next beat.`, proposedEffects: [] }
  };
}

function roundEndNarration(success, mixed, failure) {
  return {
    criticalRoundSuccess: success,
    roundSuccess: success,
    narrowRoundSuccess: mixed,
    roundFailure: failure,
    criticalRoundFailure: `${failure} The mistake echoes long after the decks go quiet.`
  };
}

export const LANTERN_IN_THE_STATIC_SAMPLE_DRAFT_ID = "sample-lantern-in-the-static";
export const LANTERN_IN_THE_STATIC_SAMPLE_EVENT = deepFreeze({
  key: "lantern-in-the-static",
  name: "The Lantern in the Static",
  category: "occult",
  tags: ["sample", "travel-v2", "foundry-test", "occult", "void", "arkflight", "lifeveil", "morale", "strain"],
  roundCount: 3,
  baseDC: 18,
  activeResources: ["lifeveil", "morale", "strain"],
  travelStations: ["captain", "navigator", "engineer", "veilwarden", "watchmaster"],
  openingVignette: "The ship crosses a dead stretch of void where a lone lantern burns inside a cloud of silver static. It is not a ship, not a star, and not quite a ghost. As the crew approaches, the static repeats fragments of shouted orders before anyone has spoken them. Something inside the lantern wants to be rescued; something wrapped around it wants the crew to answer.",
  description: "A three-round occult void-sailing encounter for testing the Travel v2 builder-to-runner workflow. The crew must keep command of their own voices, sort truth from familiar bait, and escape or rescue the lantern without letting the thing around it claim the Lifeveil.",
  gmSummary: "Run this as eerie, adventurous Arkflight travel rather than combat. Let each station describe how the crew resists the static, then use the round transition text to braid those actions into table-ready narration. Consequences should remain fictional or staged for GM review; this sample creates no actors, items, chat messages, journals, sockets, sessions, or automatic effects.",
  rounds: [
    {
      round: 1,
      title: "The Lantern Answers Before You Speak",
      openingVignette: "A pinprick of amber light appears ahead, caged inside a cloud of silver static. The route curves toward it even when the helm insists on a straighter line. From the crackle come orders in the crew's own voices: brace, turn, answer, come closer. The worst part is timing. Each command arrives a heartbeat before anyone aboard thinks to say it.",
      activeStations: [
        prompt("navigator", "Choose whether to skirt the static or approach the lantern directly, then describe how the ship keeps its bearing from being overheard.", ["survival", "sailing-lore", "occultism"], "The route bends toward the lantern as if the void has already chosen for the ship."),
        prompt("engineer", "Keep the arkengine from synchronizing with the false echoes before the lantern learns the engine's rhythm.", ["crafting", "arcana", "occultism"], "Every pulse in the arkengine comes back from the static with a second, colder pulse tucked behind it."),
        prompt("veilwarden", "Prevent the Lifeveil from carrying voices that are not aboard, and tell the table what ward or rite makes the difference.", ["occultism", "religion", "arcana"], "Ward-lamps flicker as though something outside is testing which voices the ship will protect."),
        prompt("watchmaster", "Identify which echoes are useful predictions and which are bait meant to make the crew answer too quickly.", ["perception", "survival", "society"], "The echoes are not all lies, which makes the truthful ones more dangerous."),
        prompt("captain", "Stop the crew from answering the voices by instinct and set the discipline that carries the ship into the lantern's reach.", ["diplomacy", "intimidation", "performance"], "The deck wants to shout back before anyone can think better of it.")
      ],
      stationCards: [
        card("navigator", "The ship must decide whether to skirt the silver static or close on the lantern before the route becomes someone else's command.", [approach("survival", "Read the drift", "Study motion, cold, and void-current behavior to find the path least hungry for spoken orders."), approach("sailing-lore", "Trust old voidcraft", "Use remembered starlane habits and shiphandling maxims to choose a line the static cannot easily predict."), approach("occultism", "Name the lure", "Treat the bending route as a supernatural invitation and look for the rule behind it.")]),
        card("engineer", "The arkengine is beginning to echo itself, and a full synchronization would let the false commands ride the ship's pulse.", [approach("crafting", "Break the resonance", "Physically adjust housings, dampers, and timing wheels so the engine pulse no longer matches the static."), approach("arcana", "Retune the harmonics", "Use arcane theory to separate the engine's living rhythm from the repeating signal."), approach("occultism", "Salt the echo pattern", "Treat the resonance like a haunting and spoil the pattern before it can become a command.")]),
        card("veilwarden", "The Lifeveil is carrying syllables from outside the hull, and each borrowed voice makes the crew's own air feel less private.", [approach("occultism", "Seal the ward-lamps", "Close the Lifeveil's listening places with charms, names, or ritual silence."), approach("religion", "Invoke living breath", "Anchor the veil to the breath and faith of those aboard rather than the voices outside."), approach("arcana", "Reweave the boundary", "Use structured magic to keep sound, intent, and protection from bleeding together.")]),
        card("watchmaster", "Some echoes predict real hazards while others are bait, and the deck needs a lookout who can tell one from the other.", [approach("perception", "Catch the false timing", "Watch for echoes that arrive too cleanly, too early, or from the wrong direction."), approach("survival", "Track pressure changes", "Read the void around the lantern for physical signs that confirm or deny each warning."), approach("society", "Recognize command habits", "Compare the echoes to actual shipboard speech and spot voices that imitate rank without understanding it.")]),
        card("captain", "Crew reflex is the lantern's first hook; one frightened answer could teach the static how command works aboard this ship.", [approach("diplomacy", "Steady the deck", "Give calm, visible direction so nervous hands know what to do without answering the void."), approach("intimidation", "Demand silence", "Make the cost of answering clear enough that instinct gives way to discipline."), approach("performance", "Set a counter-call", "Lead a chant, cadence, or work-song that keeps real orders distinct from stolen ones.")])
      ],
      roundEndNarration: roundEndNarration(
        "The crew keeps their words their own. False commands die against disciplined decks, the arkengine steadies, and the lantern's static peels open just enough to reveal a voice that sounds frightened rather than hungry. As the ship closes the distance, that voice whispers a name someone aboard recognizes.",
        "The ship holds its line, but not cleanly. A few shouted orders come back wrong, a few ward-lamps burn blue, and the static learns enough of the crew's rhythm to imitate them. Ahead, the lantern brightens, and the next voices it throws across the deck sound painfully familiar.",
        "The first answer costs the ship. The static steals a handful of commands, twists them, and sends them running from deck to deck in voices the crew trusts. By the time discipline returns, the lantern is closer than it should be, and it has begun speaking with the dead."
      ),
      outcomeBranches: branches(
        "The crew keeps their words their own. False commands die against disciplined decks, the arkengine steadies, and the lantern's static peels open just enough to reveal a voice that sounds frightened rather than hungry. As the ship closes the distance, that voice whispers a name someone aboard recognizes.",
        "The ship holds its line, but not cleanly. A few shouted orders come back wrong, a few ward-lamps burn blue, and the static learns enough of the crew's rhythm to imitate them. Ahead, the lantern brightens, and the next voices it throws across the deck sound painfully familiar.",
        "The first answer costs the ship. The static steals a handful of commands, twists them, and sends them running from deck to deck in voices the crew trusts. By the time discipline returns, the lantern is closer than it should be, and it has begun speaking with the dead."
      )
    },
    {
      round: 2,
      title: "The Voices Know the Crew",
      openingVignette: "The lantern swells until every mote of static holds a mouth. Lost crew call from beyond the hull. Old captains give orders in voices polished by memory. Family, creditors, saints, and dead gods bargain over the same breath. Some voices beg for rescue, and some offer warnings too accurate to ignore.",
      activeStations: [
        prompt("navigator", "Follow the one voice that gives a true bearing, or reject all voices and trust the ship's instruments and instincts.", ["survival", "society", "sailing-lore"], "One voice knows a bearing no stranger should know."),
        prompt("engineer", "Dampen resonance before the arkengine records the familiar voices as valid commands.", ["crafting", "arcana", "occultism"], "The engine likes certainty, and the voices offer it in perfect command tones."),
        prompt("veilwarden", "Seal emotional echoes before grief, debt, or longing leak into the Lifeveil.", ["occultism", "religion", "medicine"], "The Lifeveil trembles with feelings that do not belong to the living crew."),
        prompt("watchmaster", "Spot the shape moving behind the lantern while everyone else is listening to voices they almost trust.", ["perception", "survival", "occultism"], "A shadow folds behind the light whenever a voice says please."),
        prompt("captain", "Decide whether to let one voice speak through the deck for information or order silence before the lantern learns too much.", ["diplomacy", "intimidation", "deception"], "The command deck must choose what kind of mercy is safest.")
      ],
      stationCards: [
        card("navigator", "A familiar voice offers a true bearing, but accepting it may teach the lantern what the ship is willing to trust.", [approach("survival", "Test the bearing", "Compare the offered course against drift, pressure, and void signs before committing."), approach("society", "Remember the speaker", "Use history and crew knowledge to decide whether the voice behaves like the person it imitates."), approach("sailing-lore", "Let the ship answer", "Put faith in shipcraft and instruments rather than letting grief take the helm.")]),
        card("engineer", "The arkengine is close to storing the projected voices as legitimate command memory.", [approach("crafting", "Fit hard dampers", "Use mechanical safeguards to keep recorded orders and echo-noise separated."), approach("arcana", "Partition the command tone", "Identify the magical signature of a true order and deny the imitation a place in the engine."), approach("occultism", "Exorcise the recording", "Treat the engine's memory as a haunted chamber and push the false speakers out.")]),
        card("veilwarden", "Old grief and longing are pressing against the Lifeveil, looking for a way to breathe aboard the ship.", [approach("occultism", "Bind borrowed grief", "Name the emotion as outside the crew and tie it off before it spreads."), approach("religion", "Offer a clean silence", "Give the dead or divine voices a respectful boundary that does not open the veil."), approach("medicine", "Ground the living", "Use breath, touch, and care to keep the crew's bodies anchored in the present.")]),
        card("watchmaster", "Behind the lantern, something huge moves only when attention turns toward the voices.", [approach("perception", "Watch the light's edge", "Ignore the words and study the places where the lantern fails to hide its passenger."), approach("survival", "Read predator patience", "Treat the hidden shape as a hunter and look for the moment it expects prey to relax."), approach("occultism", "Interpret the silhouette", "Use void folklore and omen signs to understand what kind of thing wears a lantern.")]),
        card("captain", "Letting one voice speak may reveal the path, but silence may be the only mercy the crew can afford.", [approach("diplomacy", "Set terms for one voice", "Allow a controlled exchange with clear limits, witnesses, and an end point."), approach("intimidation", "Order absolute quiet", "Shut down the temptation before the lantern can turn a conversation into consent."), approach("deception", "Feed it a false answer", "Offer a controlled lie to learn what the voices are really listening for.")])
      ],
      roundEndNarration: roundEndNarration(
        "The crew listens without surrendering. Truth is separated from bait, old grief is kept outside the Lifeveil, and the lantern's warning becomes a usable bearing. For one breath the static thins, and the thing coiled around the light can finally be seen.",
        "Some voices are answered, some are silenced, and some are carried too long in the air. The ship learns enough to continue, but the lantern learns the crew in return. A shadow folds around the light, patient and immense, and the static begins tightening like a noose.",
        "The voices get inside the rhythm of the ship. The arkengine catches half a command that no living officer gave, the Lifeveil trembles with borrowed grief, and the lantern stops pretending to be alone. Something behind it opens its eyes."
      ),
      outcomeBranches: branches(
        "The crew listens without surrendering. Truth is separated from bait, old grief is kept outside the Lifeveil, and the lantern's warning becomes a usable bearing. For one breath the static thins, and the thing coiled around the light can finally be seen.",
        "Some voices are answered, some are silenced, and some are carried too long in the air. The ship learns enough to continue, but the lantern learns the crew in return. A shadow folds around the light, patient and immense, and the static begins tightening like a noose.",
        "The voices get inside the rhythm of the ship. The arkengine catches half a command that no living officer gave, the Lifeveil trembles with borrowed grief, and the lantern stops pretending to be alone. Something behind it opens its eyes."
      )
    },
    {
      round: 3,
      title: "The Thing Wearing the Lantern",
      openingVignette: "The lantern cracks. Amber flame spills through silver static, and the shape around it unfolds like a predator made of echo, hunger, and patient wings. It is not attacking the ship with claws or cannon; it is pulling on every answered voice, every recorded command, every feeling the Lifeveil nearly accepted. The crew has one crossing left: break past it, bargain for the true flame, or sever the tether before the ship becomes the next lantern.",
      activeStations: [
        prompt("navigator", "Plot the final escape line through collapsing static before the tether closes around the ship.", ["survival", "sailing-lore", "acrobatics"], "The path out exists only while the static is collapsing."),
        prompt("engineer", "Surge the arkengine at the exact moment the tether slackens, without letting the parasite ride the surge.", ["crafting", "arcana", "athletics"], "The engine must strike like a bell and then fall silent."),
        prompt("veilwarden", "Keep the Lifeveil from becoming the parasite's new lantern glass.", ["occultism", "religion", "arcana"], "The thing wants a living vessel for its light."),
        prompt("watchmaster", "Call the true moment to run, fire a warning shot, hide in the static, or hold until the tether opens.", ["perception", "survival", "intimidation"], "The wrong second belongs to the parasite; the right one belongs to the crew."),
        prompt("captain", "Commit the ship to rescue, escape, or severance, and make the final order impossible to misunderstand.", ["diplomacy", "intimidation", "religion"], "The ship needs one final intent, spoken by someone willing to own the cost.")
      ],
      stationCards: [
        card("navigator", "The escape line snakes through collapsing static, and the crew must choose it before the void predator tightens the tether.", [approach("survival", "Ride the collapse", "Use pressure, motion, and instinct to pass through the gap as it forms."), approach("sailing-lore", "Cut a voidsailor's line", "Apply hard-earned shiphandling to take the path that looks impossible but moves true."), approach("acrobatics", "Throw the ship sideways", "Use daring helm work and coordinated motion to slip the closing snare.")]),
        card("engineer", "The arkengine must surge exactly when the tether slackens, or the parasite will turn the burst into a leash.", [approach("crafting", "Prime the surge", "Prepare the engine's physical systems for one clean burst and no lingering resonance."), approach("arcana", "Shape the release", "Guide magical force so the surge breaks the tether rather than feeding it."), approach("athletics", "Hold the line by hand", "Use raw effort at valves, wheels, and braces when timing leaves no room for elegance.")]),
        card("veilwarden", "The parasite is trying to make the Lifeveil into a new shell for the lantern's light.", [approach("occultism", "Close the glass", "Reject the parasite's claim with names, bindings, and warded refusal."), approach("religion", "Consecrate the flame", "Frame the lantern's true light as protected, not possessed, and deny the predator a vessel."), approach("arcana", "Harden the veil", "Reinforce the Lifeveil's structure so it reflects the static instead of holding it.")]),
        card("watchmaster", "Only one instant is safe for the final move, and the parasite is trying to make every other instant look urgent.", [approach("perception", "See the real opening", "Watch the tether, the flame, and the static together until the false moments fall away."), approach("survival", "Read the hunter", "Judge the predator's patience and call the move when its grip loosens."), approach("intimidation", "Force a flinch", "Use threat, noise, or bold defiance to make the thing reveal the timing it meant to hide.")]),
        card("captain", "The crew can rescue the true flame, flee with empty hands, or sever the tether; hesitation lets the parasite choose instead.", [approach("diplomacy", "Choose rescue", "Commit to saving what remains of the lantern while making clear what risks the crew will not take."), approach("intimidation", "Choose severance", "Order the crew to cut the tether and leave the predator no answer it can use."), approach("religion", "Choose release", "Frame the final command as rite, vow, or mercy so the crew can act with one heart.")])
      ],
      roundEndNarration: roundEndNarration(
        "The final order lands at the exact right moment. The arkengine surges, the wards bite shut, and the ship tears free of the static with the lantern's true flame flickering safely behind glass. Whatever wore the light is left shrieking in the wake, too late to follow.",
        "The ship escapes, but the static leaves fingerprints. A voice lingers in the rigging, one ward-lamp refuses to go dark, and the rescued lantern burns with an uneasy pulse. The crew has survived the thing in the void, but something about the crossing will need a GM's attention when the voyage ends.",
        "The ship breaks loose only by tearing through the parasite's grasp. The lantern gutters, the static screams through the Lifeveil, and the wake behind the vessel fills with voices calling after the crew in perfect imitation. The crossing is over, but the cost follows them."
      ),
      outcomeBranches: branches(
        "The final order lands at the exact right moment. The arkengine surges, the wards bite shut, and the ship tears free of the static with the lantern's true flame flickering safely behind glass. Whatever wore the light is left shrieking in the wake, too late to follow.",
        "The ship escapes, but the static leaves fingerprints. A voice lingers in the rigging, one ward-lamp refuses to go dark, and the rescued lantern burns with an uneasy pulse. The crew has survived the thing in the void, but something about the crossing will need a GM's attention when the voyage ends.",
        "The ship breaks loose only by tearing through the parasite's grasp. The lantern gutters, the static screams through the Lifeveil, and the wake behind the vessel fills with voices calling after the crew in perfect imitation. The crossing is over, but the cost follows them."
      )
    }
  ],
  finalOutcomes: {
    criticalSuccess: { label: "Lantern Rescued Cleanly", vignette: "The ship leaves the dead stretch with the lantern's true flame sheltered and quiet. Its light remembers the crew as rescuers, not prey, and the static cannot find their voices again. The crossing becomes a story told with relief and a little awe whenever ward-lamps burn steady in strange void.", proposedEffects: [], rewards: ["The true lantern flame as a narrative boon", "Clear bearing out of the dead stretch"], losses: [] },
    success: { label: "The Ship Tears Free", vignette: "The ship escapes with its voice, route, and Lifeveil intact. The lantern may be saved, released, or left behind according to the crew's final choice, but the thing wearing it loses the chase. A few silver sparks drift in the wake, then wink out like disappointed eyes.", proposedEffects: [], rewards: ["Safe passage through the static", "Crew confidence against occult void hazards"], losses: [] },
    mixed: { label: "Free With Fingerprints", vignette: "The crew wins the crossing, but the static leaves a signature behind. A familiar voice may echo once in a quiet corridor, or a ward-lamp may burn blue until the next port of call. Nothing resolves itself automatically; the GM has a living thread to pick up later if it suits the voyage.", proposedEffects: [], rewards: ["Passage secured"], losses: ["Lingering occult unease"] },
    failure: { label: "The Cost Follows", vignette: "The ship gets clear, but only after the parasite takes a keepsake: a copied order, a remembered voice, a sliver of route, or a bruise in the Lifeveil. The crew can breathe again, yet the silence afterward feels borrowed. Somewhere behind them, the lantern burns with a sound almost like laughter.", proposedEffects: [], rewards: ["Escape from the dead stretch"], losses: ["Copied voice or marked wake", "Crew morale shaken"] },
    criticalFailure: { label: "Marked by the Static", vignette: "The crossing ends in survival rather than victory. The static screams through the ship, the lantern gutters, and the parasite learns enough of the crew to imitate them perfectly once. It does not start a fight or claim the ship outright, but the GM now has an occult mark, debt, or future omen to bring back when the void grows quiet.", proposedEffects: [], rewards: [], losses: ["Occult mark in the wake", "Severe dread among the crew"] }
  },
  rewards: ["Playable Travel v2 sample", "Builder-to-runner workflow test event"],
  futureAutomationNotes: ["Sample must be loaded into the Event Builder draft library before publishing.", "Publish only through the normal Travel Event Builder publish path.", "No direct Published Travel Event Library seeding is the primary workflow."]
});

export const SAMPLE_TRAVEL_V2_EVENTS = deepFreeze({
  [LANTERN_IN_THE_STATIC_SAMPLE_EVENT.key]: LANTERN_IN_THE_STATIC_SAMPLE_EVENT
});

export function getSampleTravelV2Event(key) {
  return SAMPLE_TRAVEL_V2_EVENTS[key] ?? null;
}
