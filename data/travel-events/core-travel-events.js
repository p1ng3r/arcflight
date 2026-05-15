import { ARCFLIGHT_TRAVEL_EVENT_CATEGORIES, ARCFLIGHT_TRAVEL_EVENT_OUTCOMES, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES, ARCFLIGHT_TRAVEL_STATIONS, ARCFLIGHT_TRAVEL_TAGS } from "../../scripts/config/constants.js";
import { getStation } from "../stations/core-stations.js";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function createRollFeedback(stationName, context = "the moment") {
  return {
    criticalSuccess: `${stationName} turns ${context} into a clean advantage.`,
    success: `${stationName} keeps ${context} under control.`,
    failure: `${stationName} holds on, but ${context} leaves a cost behind.`,
    criticalFailure: `${stationName} is overwhelmed as ${context} breaks badly.`
  };
}

function stationPrompt(stationKey, data = {}) {
  const stationName = getStation(stationKey)?.displayName ?? stationKey;
  const { feedbackContext, ...promptData } = data;
  return {
    stationKey,
    stationName,
    suggestedSkills: getStation(stationKey)?.primarySkills ?? [],
    playerAction: `Describe how ${stationName} confronts this travel pressure, then make the prompted station check.`,
    rollFeedback: createRollFeedback(stationName, feedbackContext ?? data.vignette ?? "the station challenge"),
    resourceOptions: [],
    ...promptData
  };
}

function outcomeBranch(vignette, proposedEffects = [], extra = {}) {
  return { vignette, proposedEffects, ...extra };
}

const TRAVEL_FIVE = Object.freeze(Object.values(ARCFLIGHT_TRAVEL_STATIONS));

export const CORE_TRAVEL_EVENTS = deepFreeze({
  "black-tide-crossing": {
    key: "black-tide-crossing",
    name: "Black Tide Crossing",
    category: ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.ENVIRONMENTAL,
    tags: [
      ARCFLIGHT_TRAVEL_TAGS.STORM,
      ARCFLIGHT_TRAVEL_TAGS.NAVIGATION,
      ARCFLIGHT_TRAVEL_TAGS.STRAIN,
      ARCFLIGHT_TRAVEL_TAGS.LIFEVEIL,
      ARCFLIGHT_TRAVEL_TAGS.THREAT,
      ARCFLIGHT_TRAVEL_TAGS.COMBAT_HANDOFF
    ],
    roundCount: 5,
    baseDC: 20,
    activeResources: [
      ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
      ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
      ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
      ARCFLIGHT_TRAVEL_RESOURCES.HULL,
      ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES
    ],
    travelStations: [...TRAVEL_FIVE],
    description: "A five-round voyage event through a lightless current where black rain, living tide, and distant predators pressure the ship and crew.",
    gmSummary: "Run as a cooperative narrative travel vignette. Each active Travel Five station contributes one primary roll per round by default. Apply proposed effects only if the GM chooses to do so later; this data foundation never mutates a ship.",
    rounds: [
      {
        round: 1,
        title: "The Tide Goes Black",
        openingVignette: "The horizon folds into an oil-dark swell, and the arkengine wake vanishes behind the ship as if swallowed.",
        activeStations: [
          stationPrompt("navigator", {
            vignette: "Find a bearing through a sky with no stars and a sea with no honest current.",
            resourceOptions: ["Spend time sounding the current", "Risk a narrower but calmer channel"],
            dcModifier: 0
          }),
          stationPrompt("engineer", {
            vignette: "Keep the arkengine from fighting the tide until its housings scream.",
            resourceOptions: ["Vent pressure safely", "Accept heat buildup to preserve speed"]
          }),
          stationPrompt("veilwarden", {
            vignette: "Reinforce the Lifeveil as black rain beads against the wards.",
            resourceOptions: ["Thicken the veil", "Open small breathing gaps for visibility"]
          }),
          stationPrompt("watchmaster", {
            vignette: "Mark shapes moving beneath the tide before they decide the ship is prey.",
            suggestedSkills: ["perception", "survival", "sailing-lore"],
            resourceOptions: ["Post extra lookouts", "Run quiet to reduce attention"]
          }),
          stationPrompt("captain", {
            vignette: "Hold the crew steady as the ship enters a crossing every sailor has heard in ghost stories.",
            resourceOptions: ["Rally the deck crews", "Order strict silence and discipline"]
          })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The ship enters cleanly, cutting a pale seam through the black tide.", [
            { type: "modifier", target: "nextRound.navigator.dc", mode: "add", value: -1, label: "Next Navigator DC -1" }
          ], { nextRoundNotes: "The opening line is strong; reward confident routing." }),
          mixed: outcomeBranch("The ship holds course, but the black rain leaves every rope slick and every breath sour.", [
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ], { nextRoundNotes: "The crossing begins under strain, but not panic." }),
          dominantFailure: outcomeBranch("The tide catches the hull broadside and the first watch staggers across the deck.", [
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ], { nextRoundNotes: "Make the next round feel less forgiving." }),
          catastrophicFailure: outcomeBranch("Something below answers the ship's wake with a hollow knock against the keel.", [
            { type: "resource", resource: "hull", mode: "add", value: -1, label: "Hull -1" },
            { type: "modifier", target: "nextRound.watchmaster.dc", mode: "add", value: 2, label: "Next Watchmaster DC +2" }
          ], { nextRoundNotes: "Foreshadow a pursuing threat.", combatHandoff: true })
        }
      },
      {
        round: 2,
        title: "Rain That Drinks Lanternlight",
        openingVignette: "Lanterns dim to bruised halos as rain falls upward from the tide and patters against the underside of the rigging.",
        activeStations: [
          stationPrompt("navigator", { vignette: "Read the negative space between false lights.", suggestedSkills: ["survival", "occultism", "sailing-lore"], resourceOptions: ["Follow the coldest wind", "Trust the charts despite the lights"] }),
          stationPrompt("engineer", { vignette: "Keep damp-black grit out of intakes, valves, and warded seams.", resourceOptions: ["Cycle filters", "Push through before the grit settles"], dcModifier: 1 }),
          stationPrompt("veilwarden", { vignette: "Stop the rain from leeching warmth through the Lifeveil.", resourceOptions: ["Draw power from stored wards", "Let the crew endure a cold watch"] }),
          stationPrompt("watchmaster", { vignette: "Separate reflections from real silhouettes pacing the ship.", resourceOptions: ["Use hooded signal lamps", "Listen instead of looking"] }),
          stationPrompt("captain", { vignette: "Prevent rumors from becoming certainty as sailors see faces in the rain.", resourceOptions: ["Name practical tasks", "Address the omen directly"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The crew learns the rain's rhythm and moves between its hungry curtains.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: 1, label: "Lifeveil +1" }
          ], { nextRoundNotes: "Recovered veil stability can matter in later rounds." }),
          mixed: outcomeBranch("The ship stays whole, but the dark rain steals warmth, sleep, and patience.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          dominantFailure: outcomeBranch("A false constellation pulls the bow off course before the crew claws it back.", [
            { type: "modifier", target: "nextRound.navigator.dc", mode: "add", value: 2, label: "Next Navigator DC +2" },
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ]),
          catastrophicFailure: outcomeBranch("The ship sails under its own reflection, and the reflection is not alone.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" }
          ], { nextRoundNotes: "Use mirror imagery to escalate the omen.", combatHandoff: true })
        }
      },
      {
        round: 3,
        title: "The Engine Hears a Song",
        openingVignette: "The arkengine begins to hum a melody no crew member admits to knowing, matching the pulse of the black tide.",
        activeStations: [
          stationPrompt("navigator", { vignette: "Plot against a current that now anticipates correction.", resourceOptions: ["Change headings abruptly", "Commit to one hard line"] }),
          stationPrompt("engineer", { vignette: "Tune the arkengine away from the tide-song before resonance becomes damage.", suggestedSkills: ["crafting", "arcana", "occultism"], resourceOptions: ["Bleed resonance into spare conduits", "Dampen the core and lose speed"], successContribution: { successes: 1, failures: 0, criticalFailures: 0 } }),
          stationPrompt("veilwarden", { vignette: "Keep the Lifeveil from repeating the engine's song back to the sea.", resourceOptions: ["Mute the outer veil", "Counter-harmonize with ward tones"] }),
          stationPrompt("watchmaster", { vignette: "Track the submerged source answering each engine note.", resourceOptions: ["Triangulate echoes", "Hide the ship's rhythm"] }),
          stationPrompt("captain", { vignette: "Decide whether speed, safety, or silence matters most this hour.", resourceOptions: ["Order a controlled slowdown", "Demand a clean hard burn without extra mechanics"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The engine falls out of tune with the tide and the sea loses interest for a precious mile.", [
            { type: "resource", resource: "strain", mode: "add", value: -1, label: "Strain -1" }
          ], { nextRoundNotes: "A strong engineering beat can relieve pressure." }),
          mixed: outcomeBranch("The melody fades, but it leaves the hull thrumming like a struck bell.", [
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ]),
          dominantFailure: outcomeBranch("The arkengine coughs black sparks and the crew smells rainwater in sealed compartments.", [
            { type: "resource", resource: "strain", mode: "add", value: 2, label: "Strain +2" }
          ]),
          catastrophicFailure: outcomeBranch("The engine completes the tide's melody, and something enormous changes direction below.", [
            { type: "resource", resource: "strain", mode: "add", value: 2, label: "Strain +2" },
            { type: "modifier", target: "nextRound.watchmaster.dc", mode: "add", value: 2, label: "Next Watchmaster DC +2" }
          ], { nextRoundNotes: "Prepare combat handoff metadata if the GM wants a later encounter.", combatHandoff: true })
        }
      },
      {
        round: 4,
        title: "Shapes Beneath the Wake",
        openingVignette: "Long pale backs roll under the wake, never surfacing, always matching the ship's speed.",
        activeStations: [
          stationPrompt("navigator", { vignette: "Use shoals, crosscurrents, or darkness to break the pursuit line.", resourceOptions: ["Take a jagged route", "Stay steady and avoid reefs"] }),
          stationPrompt("engineer", { vignette: "Mask engine rhythm without losing all momentum.", resourceOptions: ["Cycle power irregularly", "Run hot and hope to outrun them"] }),
          stationPrompt("veilwarden", { vignette: "Keep the Lifeveil quiet enough that hunters cannot taste the crew's fear.", resourceOptions: ["Draw the veil close", "Pulse a decoy ward"] }),
          stationPrompt("watchmaster", { vignette: "Call maneuvers before the shapes ram or herd the vessel.", resourceOptions: ["Track lead shapes", "Watch for the unseen one behind"], dcModifier: 1 }),
          stationPrompt("captain", { vignette: "Coordinate evasive work without turning the deck into chaos.", resourceOptions: ["Assign clear response crews", "Prepare a threat handoff for later"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The hunters lose the ship's scent in a churn of false wakes.", [
            { type: "modifier", target: "nextRound.all.dc", mode: "add", value: -1, label: "Next Round All DC -1" }
          ]),
          mixed: outcomeBranch("The shapes fall back, but only after testing the hull with a glancing strike.", [
            { type: "resource", resource: "hull", mode: "add", value: -1, label: "Hull -1" }
          ], { nextRoundNotes: "The final round should feel earned." }),
          dominantFailure: outcomeBranch("The ship is herded into a narrower lane of black water.", [
            { type: "modifier", target: "nextRound.navigator.dc", mode: "add", value: 2, label: "Next Navigator DC +2" },
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ], { combatHandoff: true }),
          catastrophicFailure: outcomeBranch("A pale shape breaches close enough for the crew to see old harpoons in its hide.", [
            { type: "resource", resource: "hull", mode: "add", value: -2, label: "Hull -2" },
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" }
          ], { nextRoundNotes: "If the GM wants combat later, this branch identifies a wounded tide-beast threat.", combatHandoff: true })
        }
      },
      {
        round: 5,
        title: "Dawn at the Far Edge",
        openingVignette: "A gray seam of dawn opens ahead, but the black tide rises behind the ship like a closing gate.",
        activeStations: [
          stationPrompt("navigator", { vignette: "Commit to the final line through breaking currents.", resourceOptions: ["Spend the last safe bearing", "Trust instinct over instruments"] }),
          stationPrompt("engineer", { vignette: "Give the arkengine one final controlled surge without invoking combat action economy.", resourceOptions: ["Use a cautious surge", "Risk extra strain for distance"] }),
          stationPrompt("veilwarden", { vignette: "Brace the Lifeveil for the crossing's final pressure wave.", resourceOptions: ["Anchor the veil to the hull", "Anchor the veil to crew focus"] }),
          stationPrompt("watchmaster", { vignette: "Watch the rear tide for the last strike or false opening.", resourceOptions: ["Call the closing gate", "Track pursuing shapes"] }),
          stationPrompt("captain", { vignette: "Choose the moment every station commits together.", resourceOptions: ["Count the ship through", "Let each station act on signal"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The ship bursts into gray daylight with the black tide collapsing harmlessly astern.", [
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
          ]),
          mixed: outcomeBranch("The ship escapes, battered and silent, with daylight finding every new crack and bruise.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          dominantFailure: outcomeBranch("The tide spits the ship out sideways, alive but wounded by the crossing.", [
            { type: "resource", resource: "hull", mode: "add", value: -1, label: "Hull -1" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ]),
          catastrophicFailure: outcomeBranch("The ship escapes only because the thing behind it chooses to remember the vessel for later.", [
            { type: "resource", resource: "hull", mode: "add", value: -2, label: "Hull -2" },
            { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" }
          ], { combatHandoff: true })
        }
      }
    ],
    finalOutcomes: {
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.MAJOR_VICTORY]: {
        label: "Major Victory",
        vignette: "The crew masters the crossing and leaves the Black Tide with a route others might one day follow.",
        proposedEffects: [
          { type: "resource", resource: "morale", mode: "add", value: 2, label: "Morale +2" },
          { type: "modifier", target: "future.blackTide.navigation.dc", mode: "add", value: -2, label: "Future Black Tide navigation DC -2" }
        ],
        rewards: ["Safe crossing", "Black Tide route notes"],
        losses: []
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.VICTORY]: {
        label: "Victory",
        vignette: "The ship clears the Black Tide with scars, stories, and a usable bearing.",
        proposedEffects: [
          { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
        ],
        rewards: ["Safe crossing"],
        losses: []
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.COSTLY_SUCCESS]: {
        label: "Costly Success",
        vignette: "The crossing is complete, but the ship pays in repairs, supplies, and shaken nerves.",
        proposedEffects: [
          { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" },
          { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
        ],
        rewards: ["Safe crossing"],
        losses: ["Consumed supplies", "Engine wear"]
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.FAILURE]: {
        label: "Failure",
        vignette: "The ship emerges off course and damaged, the Black Tide still clinging to its wake.",
        proposedEffects: [
          { type: "resource", resource: "hull", mode: "add", value: -1, label: "Hull -1" },
          { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
        ],
        rewards: [],
        losses: ["Lost time", "Hull damage"],
        combatHandoff: true,
        handoffNotes: "A pursuing tide-beast, occult remora, or rival vessel may be introduced later at GM discretion. No combat starts automatically."
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.CATASTROPHIC_FAILURE]: {
        label: "Catastrophic Failure",
        vignette: "The Black Tide lets the ship go only after taking a lasting bite from hull, veil, and reputation.",
        proposedEffects: [
          { type: "resource", resource: "hull", mode: "add", value: -2, label: "Hull -2" },
          { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" },
          { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" }
        ],
        rewards: [],
        losses: ["Severe damage", "Crew trauma", "Hostile attention"],
        combatHandoff: true,
        handoffNotes: "Use this metadata only if the GM chooses to frame a later threat encounter; this event never launches combat."
      }
    },
    rewards: ["Narrative route knowledge", "Potential future Black Tide crossing advantage"],
    futureAutomationNotes: [
      "Attach active event state to one ship actor later.",
      "Track per-round and total successes/failures later without action-economy costs.",
      "Stage proposed effects for explicit GM review before applying.",
      "Use combatHandoff metadata only as GM-facing context; never auto-launch combat."
    ]
  },
  "derelict-lantern-wreck": {
    key: "derelict-lantern-wreck",
    name: "Derelict Lantern Wreck",
    category: ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.DISCOVERY,
    tags: [
      ARCFLIGHT_TRAVEL_TAGS.DISCOVERY,
      ARCFLIGHT_TRAVEL_TAGS.DERELICT,
      ARCFLIGHT_TRAVEL_TAGS.SALVAGE,
      ARCFLIGHT_TRAVEL_TAGS.OCCULT,
      ARCFLIGHT_TRAVEL_TAGS.LIFEVEIL,
      ARCFLIGHT_TRAVEL_TAGS.THREAT,
      ARCFLIGHT_TRAVEL_TAGS.RESOURCE_PRESSURE
    ],
    roundCount: 4,
    baseDC: 19,
    activeResources: [
      ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
      ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
      ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
      ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES
    ],
    travelStations: [...TRAVEL_FIVE],
    description: "A dead arkship drifts with a still-burning witchlight lantern in its bow, inviting investigation, salvage, and occult caution.",
    gmSummary: "Run as a four-round discovery event. The wreck can yield supplies and salvage notes, but bad branches stage resource pressure and GM-facing threat handoff metadata only.",
    rounds: [
      {
        round: 1,
        title: "Spotting the Dead Light",
        openingVignette: "A green-white lantern burns in the bow of a silent arkship, too steady for wreckage and too bright for a corpse.",
        activeStations: [
          stationPrompt("watchmaster", { vignette: "Identify the wreck's silhouette, broken rigging, and any danger signs moving against the drift.", suggestedSkills: ["perception", "survival", "sailing-lore"], resourceOptions: ["Post glass on the bow lantern", "Sweep the shadows beneath the hull"] }),
          stationPrompt("navigator", { vignette: "Plot a cautious approach that avoids dead cables, spilled cargo, and the wreck's slow roll.", resourceOptions: ["Circle wide first", "Close quickly before the drift worsens"] }),
          stationPrompt("captain", { vignette: "Decide whether the chance at salvage is worth contact with a ship that should be dark.", resourceOptions: ["Limit the boarding party", "Promise salvage shares for discipline"] }),
          stationPrompt("veilwarden", { vignette: "Feel for occult residue in the lanternlight before the Lifeveil brushes the wreck.", suggestedSkills: ["occultism", "religion", "arcana"], resourceOptions: ["Thicken the Lifeveil", "Take a clean reading before warding"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The crew reads the wreck's dangers before committing, turning rumor into a workable approach.", [
            { type: "modifier", target: "nextRound.navigator.dc", mode: "add", value: -1, label: "Next Navigator DC -1" }
          ], { nextRoundNotes: "The approach begins with accurate wreck-readings." }),
          mixed: outcomeBranch("The lantern stays fixed in every spyglass, and the crew grows quiet around it.", [
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ]),
          dominantFailure: outcomeBranch("The dead ship rolls unexpectedly, forcing a hard correction before contact.", [
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ]),
          catastrophicFailure: outcomeBranch("A false survivor waves from the bow beneath the lantern, though no living breath fogs the glass.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" },
            { type: "modifier", target: "nextRound.watchmaster.dc", mode: "add", value: 2, label: "Next Watchmaster DC +2" }
          ], { nextRoundNotes: "Treat the signal as a lure or trapped echo.", combatHandoff: true, handoffNotes: "Possible later threat: false survivor, corpse-light lure, or hidden scavenger. No combat starts automatically." })
        }
      },
      {
        round: 2,
        title: "Matching Drift",
        openingVignette: "The two ships slide closer, hull to hull, while the witchlight paints every rope with a sickly dawn.",
        activeStations: [
          stationPrompt("navigator", { vignette: "Match the wreck's tumbling vector without scraping the ship along its torn plates.", resourceOptions: ["Use a patient parallel drift", "Take a tighter salvage line"] }),
          stationPrompt("engineer", { vignette: "Keep the arkengine quiet and stable so vibration does not wake whatever the wreck remembers.", resourceOptions: ["Dampen the engine mounts", "Hold reserve power for retreat"] }),
          stationPrompt("watchmaster", { vignette: "Scan ports, cargo gaps, and shattered decks for movement or ambush.", suggestedSkills: ["perception", "stealth", "survival"], resourceOptions: ["Mark every shadow", "Keep weapons low but ready"] }),
          stationPrompt("veilwarden", { vignette: "Test how the Lifeveil reacts when the ships' atmospheres almost touch.", suggestedSkills: ["occultism", "nature", "religion"], resourceOptions: ["Seal the veil edge", "Let a thread sample the residue"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The ships come together gently, with clean lines for retreat and boarding alike.", [
            { type: "modifier", target: "nextRound.engineer.dc", mode: "add", value: -1, label: "Next Engineer DC -1" }
          ]),
          mixed: outcomeBranch("Contact is safe enough, but cold lanternlight seeps through the Lifeveil seams.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" }
          ]),
          dominantFailure: outcomeBranch("A hidden spar grinds across the hull and ruins the clean approach.", [
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" },
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          catastrophicFailure: outcomeBranch("The wreck knocks once from within, and the boarding lines pull taut by themselves.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: animated boarding lines, lantern-haunt, or concealed boarders. No combat starts automatically." })
        }
      },
      {
        round: 3,
        title: "Salvage or Signal",
        openingVignette: "Inside the dead bow, cargo tags flutter without wind and the lantern burns over a deck polished by old panic.",
        activeStations: [
          stationPrompt("captain", { vignette: "Set salvage priorities before curiosity turns the boarding party greedy or slow.", resourceOptions: ["Take only marked necessities", "Authorize one risky prize"] }),
          stationPrompt("engineer", { vignette: "Identify parts that can be cut free without collapsing the wreck's remaining structure.", suggestedSkills: ["crafting", "engineering-lore", "sailing-lore"], resourceOptions: ["Strip useful fittings", "Leave unstable assemblies alone"] }),
          stationPrompt("veilwarden", { vignette: "Handle the witchlight lantern without letting its residue nest in the Lifeveil.", suggestedSkills: ["occultism", "arcana", "religion"], resourceOptions: ["Quench it under warding", "Bottle a harmless ember sample"] }),
          stationPrompt("watchmaster", { vignette: "Guard the boarding party against false survivors, scavengers, or echoes wearing familiar voices.", resourceOptions: ["Keep a hard perimeter", "Answer no voices alone"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The crew takes clean salvage and leaves the lantern's worst hunger sealed behind glass.", [
            { type: "resource", resource: "supplies", mode: "add", value: 1, label: "Recovered Supplies +1" },
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
          ]),
          mixed: outcomeBranch("Useful stores come aboard with a smell of cold wax and a few frightened stories.", [
            { type: "resource", resource: "supplies", mode: "add", value: 1, label: "Recovered Supplies +1" },
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ]),
          dominantFailure: outcomeBranch("The lantern flares during cutting, spoiling stores and sending the boarding party scrambling.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" },
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" }
          ]),
          catastrophicFailure: outcomeBranch("A voice from the lantern names the ship and asks permission to come aboard.", [
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: occult remnant invited by fear or misstep. No combat starts automatically." })
        }
      },
      {
        round: 4,
        title: "The Wreck Answers",
        openingVignette: "The dead arkship groans around the boarding lines, and the bow lantern swings toward the living ship like an eye.",
        activeStations: [
          stationPrompt("captain", { vignette: "Call the breakaway, final salvage grab, or hard retreat before the wreck decides for everyone.", resourceOptions: ["Leave with what is secured", "Risk one last ordered pull"] }),
          stationPrompt("navigator", { vignette: "Plot the escape vector through debris now drifting against natural current.", resourceOptions: ["Back away cleanly", "Use the wreck as cover"] }),
          stationPrompt("engineer", { vignette: "Give the arkengine enough immediate response to tear free without overstraining it.", resourceOptions: ["Controlled reverse thrust", "Emergency power through cold lines"] }),
          stationPrompt("veilwarden", { vignette: "Cut occult threads between ship, lantern, and crew memories.", suggestedSkills: ["occultism", "religion", "arcana"], resourceOptions: ["Sever the lantern echo", "Seal contaminated breath outside"] }),
          stationPrompt("watchmaster", { vignette: "Confirm nothing living, dead, or pretending crosses the lines unnoticed.", resourceOptions: ["Count all hands twice", "Watch the lantern until distance wins"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The ship breaks away with salvage secured and the witchlight shrinking harmlessly astern.", [
            { type: "resource", resource: "supplies", mode: "add", value: 1, label: "Recovered Supplies +1" },
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
          ]),
          mixed: outcomeBranch("The crew escapes with useful salvage, but the lantern burns in too many dreams that night.", [
            { type: "resource", resource: "supplies", mode: "add", value: 1, label: "Recovered Supplies +1" },
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" }
          ]),
          dominantFailure: outcomeBranch("The wreck keeps part of the prize and leaves the crew with contaminated rope, shaken hands, and fewer answers.", [
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: something marked the ship during departure. No combat starts automatically." }),
          catastrophicFailure: outcomeBranch("The lantern goes out only after a second light appears somewhere inside the living ship.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" },
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: lantern-haunt, hidden stowaway, or possessed salvage. No combat starts automatically." })
        }
      }
    ],
    finalOutcomes: {
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.MAJOR_VICTORY]: {
        label: "Major Victory",
        vignette: "The wreck becomes a clean discovery: salvage aboard, lantern mystery contained, and a haunted coordinate marked for future stories.",
        proposedEffects: [
          { type: "resource", resource: "supplies", mode: "add", value: 2, label: "Recovered Supplies +2" },
          { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
        ],
        rewards: ["Clean salvage", "Witchlight notes", "Derelict route marker"],
        losses: []
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.VICTORY]: {
        label: "Victory",
        vignette: "The crew leaves richer in supplies and caution, with the lantern's echo fading behind them.",
        proposedEffects: [
          { type: "resource", resource: "supplies", mode: "add", value: 1, label: "Recovered Supplies +1" }
        ],
        rewards: ["Useful salvage", "Occult clue"],
        losses: []
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.COSTLY_SUCCESS]: {
        label: "Costly Success",
        vignette: "The salvage is real, but so is the contamination riding home in wax-smoke and nervous glances.",
        proposedEffects: [
          { type: "resource", resource: "supplies", mode: "add", value: 1, label: "Recovered Supplies +1" },
          { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" },
          { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
        ],
        rewards: ["Risky salvage"],
        losses: ["Lifeveil contamination", "Crew unease"]
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.FAILURE]: {
        label: "Failure",
        vignette: "The wreck gives up little and leaves the ship marked by a lantern that remembers its name.",
        proposedEffects: [
          { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" },
          { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
        ],
        rewards: [],
        losses: ["Lost salvage", "Occult attention"],
        combatHandoff: true,
        handoffNotes: "Possible later threat handoff from marked salvage or a lantern echo. No combat starts automatically."
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.CATASTROPHIC_FAILURE]: {
        label: "Catastrophic Failure",
        vignette: "The derelict keeps its best secrets and sends a worse one aboard in the Lifeveil's shadow.",
        proposedEffects: [
          { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" },
          { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
          { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
        ],
        rewards: [],
        losses: ["Severe contamination", "Spoiled salvage", "Haunted crew"],
        combatHandoff: true,
        handoffNotes: "Possible later threat handoff: lantern-haunt, false survivor, or possessed salvage. No combat starts automatically."
      }
    },
    rewards: ["Salvage", "Occult clues", "Discovery marker"],
    futureAutomationNotes: [
      "Keep salvage and threat results data-only until later content architecture exists.",
      "Use combatHandoff metadata only as GM-facing context; never auto-launch combat."
    ]
  },
  "crew-fever-in-the-lifeveil": {
    key: "crew-fever-in-the-lifeveil",
    name: "Crew Fever in the Lifeveil",
    category: ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.SHIPBOARD,
    tags: [
      ARCFLIGHT_TRAVEL_TAGS.SHIPBOARD,
      ARCFLIGHT_TRAVEL_TAGS.LIFEVEIL,
      ARCFLIGHT_TRAVEL_TAGS.MORALE,
      ARCFLIGHT_TRAVEL_TAGS.SUPPLIES,
      ARCFLIGHT_TRAVEL_TAGS.CREW_PRESSURE,
      ARCFLIGHT_TRAVEL_TAGS.OCCULT,
      ARCFLIGHT_TRAVEL_TAGS.RESOURCE_PRESSURE
    ],
    roundCount: 4,
    baseDC: 18,
    activeResources: [
      ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
      ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
      ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
      ARCFLIGHT_TRAVEL_RESOURCES.STRAIN
    ],
    travelStations: [...TRAVEL_FIVE],
    description: "A strange shipboard fever spreads through the Lifeveil, carrying emotional echoes, stale breath, and dreamlike hallucinations through the crew.",
    gmSummary: "Run as a four-round shipboard crisis. Existing Travel Five stations cover order, systems, Lifeveil purging, watchfulness, and orientation without adding a Medic station or new resource mechanics.",
    rounds: [
      {
        round: 1,
        title: "First Coughs",
        openingVignette: "The first cough sounds ordinary until three decks answer it in the same exhausted rhythm.",
        activeStations: [
          stationPrompt("watchmaster", { vignette: "Notice symptoms, rumor spread, and which crew are hiding weakness from their watches.", suggestedSkills: ["perception", "medicine", "society"], resourceOptions: ["Map the sick bunks", "Quiet the rumor chain"] }),
          stationPrompt("veilwarden", { vignette: "Sense psychic static and stale breath cycling through the Lifeveil.", suggestedSkills: ["occultism", "medicine", "religion"], resourceOptions: ["Listen to the veil's echoes", "Seal the worst draft"] }),
          stationPrompt("captain", { vignette: "Keep order before fear turns every cough into accusation.", resourceOptions: ["Address the crew plainly", "Restrict unnecessary movement"] }),
          stationPrompt("engineer", { vignette: "Check circulation, vents, and Lifeveil interfaces for stagnant loops.", suggestedSkills: ["crafting", "engineering-lore", "sailing-lore"], resourceOptions: ["Open inspection panels", "Keep airflow conservative"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The fever is identified early, before panic can become another symptom.", [
            { type: "modifier", target: "nextRound.veilwarden.dc", mode: "add", value: -1, label: "Next Veilwarden DC -1" }
          ]),
          mixed: outcomeBranch("The crew understands the danger, but fear moves faster than the orders.", [
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ]),
          dominantFailure: outcomeBranch("Stale Lifeveil flow carries fever-dream whispers into crowded bunks.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" }
          ]),
          catastrophicFailure: outcomeBranch("A dozen crew wake from the same dream and accuse the ship of breathing with someone else's lungs.", [
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" }
          ], { nextRoundNotes: "The crisis now includes panic and shared hallucination." })
        }
      },
      {
        round: 2,
        title: "Quarantine Lines",
        openingVignette: "Hammocks become borders, mess tables become infirmary benches, and every closed hatch sounds too final.",
        activeStations: [
          stationPrompt("captain", { vignette: "Assign watches, isolate bunks, and make quarantine feel like duty rather than punishment.", resourceOptions: ["Rotate rested hands", "Make strict lines public"] }),
          stationPrompt("engineer", { vignette: "Reroute airskin and Lifeveil flow around sick compartments without starving the rest of the ship.", resourceOptions: ["Build a slow clean loop", "Attempt a faster bypass"] }),
          stationPrompt("veilwarden", { vignette: "Purge occult residue from the quarantine boundary.", suggestedSkills: ["occultism", "medicine", "arcana"], resourceOptions: ["Burn clean incense through wards", "Draw residue into a sealed charm"] }),
          stationPrompt("watchmaster", { vignette: "Find who is worsening, who is hiding symptoms, and who is using fear as cover for disobedience.", resourceOptions: ["Check watches personally", "Pair sickbay runners"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The quarantine holds as a shared discipline, not a sentence.", [
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
          ]),
          mixed: outcomeBranch("The lines hold, but clean wraps, broth, and warding supplies disappear quickly.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          dominantFailure: outcomeBranch("A rerouted loop backwashes fever-dream breath through the lower deck.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ]),
          catastrophicFailure: outcomeBranch("Quarantine breaks for one frightened minute, long enough for the fever to learn new voices.", [
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ], { nextRoundNotes: "Fever dreams should feel more personal and harder to dismiss." })
        }
      },
      {
        round: 3,
        title: "Fever Dreams",
        openingVignette: "Crew on different decks describe the same impossible shoreline and the same child calling from beneath the floorboards.",
        activeStations: [
          stationPrompt("navigator", { vignette: "Keep the ship oriented while shared hallucinations make course, horizon, and memory unreliable.", suggestedSkills: ["survival", "occultism", "sailing-lore"], resourceOptions: ["Anchor to instruments", "Anchor to repeated call-and-response"] }),
          stationPrompt("veilwarden", { vignette: "Confront the psychic fever where it knots inside the Lifeveil.", suggestedSkills: ["occultism", "religion", "medicine"], resourceOptions: ["Name the echo", "Draw it into a warded circuit"] }),
          stationPrompt("captain", { vignette: "Calm or discipline crew who are seeing ghosts in officers, friends, and empty corners.", resourceOptions: ["Offer a steady speech", "Separate the loudest panic"] }),
          stationPrompt("watchmaster", { vignette: "Prevent fever-drunk mistakes around hatches, lines, stores, and tools.", resourceOptions: ["Double critical watches", "Remove dangerous tools from sick bunks"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The crew names the dreams as fever, and naming them takes away much of their teeth.", [
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" },
            { type: "modifier", target: "nextRound.all.dc", mode: "add", value: -1, label: "Next Round All DC -1" }
          ]),
          mixed: outcomeBranch("The ship stays on course, though sleep becomes rationed and bitter.", [
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ]),
          dominantFailure: outcomeBranch("The fever bends familiar voices into commands, and not every hand resists at once.", [
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" },
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          catastrophicFailure: outcomeBranch("For a breathless span, the crew sees the same officer wearing a dead stranger's face.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" },
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ], { handoffNotes: "Possible later threat note: hallucination-driven violence or possessed crew suspicion if the GM wants to escalate later. No combat starts automatically." })
        }
      },
      {
        round: 4,
        title: "Break the Fever",
        openingVignette: "The Lifeveil exhales in ragged pulses, and the whole ship waits to learn whether the next breath will be clean.",
        activeStations: [
          stationPrompt("veilwarden", { vignette: "Perform the final purge without tearing healthy breath away with the fever.", suggestedSkills: ["occultism", "medicine", "religion"], resourceOptions: ["Slow cleansing rite", "Dangerous emergency venting"] }),
          stationPrompt("engineer", { vignette: "Support the purge with controlled rerouting, pressure relief, and emergency cutoffs.", resourceOptions: ["Protect the engine from backwash", "Shunt pressure through reserve lines"] }),
          stationPrompt("captain", { vignette: "Hold the crew together with rest orders, reassurance, or hard discipline at the final crisis point.", resourceOptions: ["Promise rest after purge", "Command silence during venting"] }),
          stationPrompt("navigator", { vignette: "Keep the ship steady through disorienting breath, pressure, and dream-static.", resourceOptions: ["Maintain a simple heading", "Steer by instrument alone"] }),
          stationPrompt("watchmaster", { vignette: "Catch the last dangerous mistakes before fever, exhaustion, or panic turns them costly.", resourceOptions: ["Post sober pairs", "Guard stores and hatches"] })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The fever breaks in one long, foul exhale, leaving the crew weak but grateful.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: 1, label: "Lifeveil +1" },
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
          ]),
          mixed: outcomeBranch("The fever breaks, but the cure consumes stores and leaves everyone hollow-eyed.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          dominantFailure: outcomeBranch("The fever retreats into corners of the Lifeveil that will need days of careful cleaning.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ]),
          catastrophicFailure: outcomeBranch("Emergency venting saves breath but tears through morale, stores, and the ship's trust in its own air.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" },
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ], { handoffNotes: "Possible later threat note: a fever echo may linger in one crew member. No combat starts automatically." })
        }
      }
    ],
    finalOutcomes: {
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.MAJOR_VICTORY]: {
        label: "Major Victory",
        vignette: "The fever is purged cleanly, and the crew turns a shared crisis into confidence in ship and Lifeveil.",
        proposedEffects: [
          { type: "resource", resource: "lifeveil", mode: "add", value: 1, label: "Lifeveil +1" },
          { type: "resource", resource: "morale", mode: "add", value: 2, label: "Morale +2" }
        ],
        rewards: ["Crew confidence", "Clean Lifeveil flow"],
        losses: []
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.VICTORY]: {
        label: "Victory",
        vignette: "The fever breaks with manageable costs, leaving the crew tired but steady.",
        proposedEffects: [
          { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
        ],
        rewards: ["Stabilized crew", "Contained Lifeveil fever"],
        losses: []
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.COSTLY_SUCCESS]: {
        label: "Costly Success",
        vignette: "The crew recovers, but clean wraps, broth, warding salts, and emergency shifts are spent getting there.",
        proposedEffects: [
          { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" },
          { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
        ],
        rewards: ["Fever broken"],
        losses: ["Consumed supplies", "Engine rerouting wear"]
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.FAILURE]: {
        label: "Failure",
        vignette: "The fever passes unevenly, leaving stale dreams in the Lifeveil and distrust in crowded compartments.",
        proposedEffects: [
          { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" },
          { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" },
          { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
        ],
        rewards: [],
        losses: ["Lingering Lifeveil sickness", "Crew distrust", "Consumed supplies"]
      },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.CATASTROPHIC_FAILURE]: {
        label: "Catastrophic Failure",
        vignette: "The fever is survived rather than cured, and one last shared dream watches the crew from behind their own eyes.",
        proposedEffects: [
          { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" },
          { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
          { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" },
          { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
        ],
        rewards: [],
        losses: ["Damaged Lifeveil", "Exhausted crew", "Emergency supplies consumed"],
        handoffNotes: "Possible later threat note: hallucination-driven violence or a possessed-crew scare at GM discretion. No combat starts automatically."
      }
    },
    rewards: ["Stabilized crew", "Lifeveil crisis lessons"],
    futureAutomationNotes: [
      "Represent shipboard medical/occult pressure with existing Travel Five stations only.",
      "Keep all resource changes staged for explicit GM review."
    ]
  },
  "false-beacon-ambush": {
    key: "false-beacon-ambush",
    name: "False Beacon Ambush",
    category: ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.THREAT,
    tags: [
      ARCFLIGHT_TRAVEL_TAGS.THREAT,
      ARCFLIGHT_TRAVEL_TAGS.NAVIGATION,
      ARCFLIGHT_TRAVEL_TAGS.AMBUSH,
      ARCFLIGHT_TRAVEL_TAGS.PURSUIT,
      ARCFLIGHT_TRAVEL_TAGS.STEALTH,
      ARCFLIGHT_TRAVEL_TAGS.COMBAT_HANDOFF,
      ARCFLIGHT_TRAVEL_TAGS.RESOURCE_PRESSURE,
      ARCFLIGHT_TRAVEL_TAGS.ENVIRONMENTAL
    ],
    roundCount: 4,
    baseDC: 20,
    activeResources: [
      ARCFLIGHT_TRAVEL_RESOURCES.STRAIN,
      ARCFLIGHT_TRAVEL_RESOURCES.LIFEVEIL,
      ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
      ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
      ARCFLIGHT_TRAVEL_RESOURCES.HULL
    ],
    travelStations: [...TRAVEL_FIVE],
    description: "A kind rescue-light blooms in the void, promising harbor, help, or a marked channel through danger. Its cadence is almost right, but the shadows around it move with patient intent. The ship is being coaxed toward a kill lane of drifting wreckage, hidden raider vectors, and ward-hungry dark.",
    gmSummary: "Run this as quiet tactical dread, not an automatic fight. The beacon may be raiders, an occult lure, a debris trap, or all three depending on what best fits the voyage. Severe results provide combatHandoff metadata only, leaving any later encounter fully at GM discretion.",
    rounds: [
      {
        round: 1,
        title: "The Beacon Calls",
        openingVignette: "A pale blue rescue flare opens ahead like a saint's eye in the dark. It repeats a lawful port cadence, then stutters once on a note no harbor bell should know. The void around it is too still, and even loose chains seem to listen. Far beyond the light, broken spars drift in a pattern that might be chance or teeth. The crew wants the signal to be true because a friendly light in the black is a hard mercy to refuse.",
        activeStations: [
          stationPrompt("watchmaster", { vignette: "Spyglasses catch glints moving where no honest escort should be. The beacon hides more darkness than it reveals.", playerAction: "Study the rescue-light, debris shadows, and blind arcs around the ship. Tell the GM what sign proves whether this is aid or bait.", suggestedSkills: ["perception", "survival", "warfare-lore"], resourceOptions: ["Post silent lookouts", "Challenge the signal openly"], feedbackContext: "the false beacon's first lie" }),
          stationPrompt("navigator", { vignette: "The beacon's bearing tugs at compass, chart, and instinct in three different directions.", playerAction: "Plot an approach that tests the signal without surrendering the ship's line. Choose whether to circle, slow, or feint toward the light.", suggestedSkills: ["survival", "sailing-lore", "deception"], resourceOptions: ["Hold a wide spiral", "Feign a trusting approach"], feedbackContext: "the suspect bearing" }),
          stationPrompt("veilwarden", { vignette: "The Lifeveil tastes brine, warm iron, and a prayer repeated by no living throat.", playerAction: "Read the beacon through the Lifeveil and ward the crew against invitation magic. Describe what the false warmth feels like when it touches the veil.", suggestedSkills: ["occultism", "religion", "arcana"], resourceOptions: ["Thicken the veil", "Let a thin thread taste the lure"], feedbackContext: "the occult lure" }),
          stationPrompt("captain", { vignette: "Hope and suspicion divide the deck, and both can make sailors careless.", playerAction: "Give the crew orders that preserve readiness without crushing compassion. Decide who prepares rescue gear and who prepares for treachery.", suggestedSkills: ["diplomacy", "intimidation", "society"], resourceOptions: ["Rally disciplined caution", "Keep weapons and ropes hidden"], feedbackContext: "the crew's tense hope" })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The ship answers the beacon without obeying it. Lookouts mark two hidden angles of approach, and the helm keeps enough room to refuse the trap. The false light burns a little harsher, as if irritated by caution.", [
            { type: "modifier", target: "nextRound.watchmaster.dc", mode: "add", value: -1, label: "Next Watchmaster DC -1" }
          ], { nextRoundNotes: "The crew has identified the trap's first edge." }),
          mixed: outcomeBranch("The ship stays wary, but the beacon wins a few precious lengths of distance. Crew whisper about survivors while officers quietly count blind spots. The trap is not sprung yet, but it knows the ship is listening.", [
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ]),
          dominantFailure: outcomeBranch("The beacon's cadence catches the helm at the wrong moment. The ship drifts closer to a lane of cold wreckage and tethered stone. Somewhere beyond the light, something shutters a lantern.", [
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ], { nextRoundNotes: "Begin narrowing the ship's safe choices." }),
          catastrophicFailure: outcomeBranch("A desperate voice breaks across the signal using the ship's own name. Hands move before orders catch them, and the bow swings toward the waiting dark. The ambushers, whatever they are, have learned the crew's kindness.", [
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
            { type: "modifier", target: "nextRound.navigator.dc", mode: "add", value: 2, label: "Next Navigator DC +2" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: hidden raiders or a beacon-haunt using the ship's name. No combat starts automatically." })
        }
      },
      {
        round: 2,
        title: "Course Correction",
        openingVignette: "The beacon slides sideways without crossing the void between. Debris that seemed scattered now shows lanes, gaps, and murder-holes. A red spark winks behind a ruined mast and vanishes when watched directly. The ship can still break away, but doing so will scrape pride, speed, or steel.",
        activeStations: [
          stationPrompt("navigator", { vignette: "Every safe route bends back toward the beacon unless someone names the trick.", playerAction: "Correct course against the lure and explain which false landmark you reject. Make the station check to keep a usable escape line.", suggestedSkills: ["survival", "sailing-lore", "occultism"], resourceOptions: ["Cut across the current", "Backtrack through debris"], feedbackContext: "the warped route" }),
          stationPrompt("engineer", { vignette: "The arkengine shudders as the ship asks for a hard turn through fouled current.", playerAction: "Balance heat, pressure, and response while the helm demands sharp correction. Describe what you vent, brace, or risk.", suggestedSkills: ["crafting", "engineering-lore", "sailing-lore"], resourceOptions: ["Bleed pressure carefully", "Force a quick turn"], dcModifier: 1, feedbackContext: "the emergency correction" }),
          stationPrompt("watchmaster", { vignette: "Wreckage forms screens where patient enemies could wait with hooks, bolts, or worse.", playerAction: "Call out concealed vectors and mark which shadows are bait. Decide whether the crew watches raiders, debris, or the beacon itself.", suggestedSkills: ["perception", "stealth", "warfare-lore"], resourceOptions: ["Mark fire lanes", "Keep all lamps shuttered"], feedbackContext: "the hidden ambush line" }),
          stationPrompt("captain", { vignette: "The deck needs one will now, not five frightened guesses.", playerAction: "Coordinate the turn so every station commits at once. State the order that prevents rescue instinct from becoming panic.", suggestedSkills: ["diplomacy", "intimidation", "warfare-lore"], resourceOptions: ["Order battle readiness", "Keep rescue pretense alive"], feedbackContext: "the shipwide correction" })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The ship shears away from the beacon's preferred path. A concealed anchor-chain snaps taut behind the stern and misses by a blessed span. The crew sees the trap clearly now, and fear sharpens into purpose.", [
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
          ]),
          mixed: outcomeBranch("The turn succeeds, but not cleanly. Debris scrapes along the hull, and the arkengine coughs sparks into its housings. The beacon follows with a softer, uglier pulse.", [
            { type: "resource", resource: "hull", mode: "add", value: -1, label: "Hull -1" }
          ]),
          dominantFailure: outcomeBranch("The correction comes late, and the trap adjusts with it. Dark shapes move behind wreckage in disciplined silence. The ship is not captured, but its escape lane is narrowing fast.", [
            { type: "modifier", target: "nextRound.all.dc", mode: "add", value: 1, label: "Next Round All DC +1" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: disciplined raider pursuit or occult debris net. No combat starts automatically." }),
          catastrophicFailure: outcomeBranch("The ship turns directly into a ghost-net of cable, bone-white buoys, and dead lanterns. Hooks bite and tear free, leaving the hull ringing like a struck bell. Behind the beacon, several hidden lights open at once.", [
            { type: "resource", resource: "hull", mode: "add", value: -2, label: "Hull -2" },
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: boarding attempt, pursuit, or a snare-spirit clinging to the hull. No combat starts automatically." })
        }
      },
      {
        round: 3,
        title: "The Net Tightens",
        openingVignette: "The false beacon falls behind, yet its light reflects ahead on shards of glass and frozen spray. The ship is inside the prepared lane now. Soft impacts tap the hull from below as if unseen hands are counting ribs. Far astern, masked lamps begin to follow.",
        activeStations: [
          stationPrompt("engineer", { vignette: "The arkengine must answer without roaring loudly enough to guide pursuit.", playerAction: "Tune the engine for speed, silence, or a dangerous compromise. Explain what system takes the strain for the ship to keep moving.", suggestedSkills: ["crafting", "engineering-lore", "stealth"], resourceOptions: ["Run quiet and cool", "Burn hard through the lane"], feedbackContext: "the hunted engine run" }),
          stationPrompt("veilwarden", { vignette: "The Lifeveil catches little hooked prayers cast from the dark.", playerAction: "Cut away occult traces and shield the crew from fear that is not their own. Choose whether to hide the ship's soul or flare a decoy.", suggestedSkills: ["occultism", "religion", "arcana"], resourceOptions: ["Mask the veil", "Throw a false echo"], feedbackContext: "the hooked prayers" }),
          stationPrompt("watchmaster", { vignette: "Pursuers move without haste because they believe the lane has already won.", playerAction: "Track the nearest threat and call maneuvers before it becomes a boarding vector. Decide what sign reveals the leader.", suggestedSkills: ["perception", "survival", "warfare-lore"], resourceOptions: ["Track the lead lamp", "Watch for the silent flanker"], dcModifier: 1, feedbackContext: "the closing pursuit" }),
          stationPrompt("captain", { vignette: "The crew needs permission to be afraid without permission to break.", playerAction: "Hold command while the ship runs a gauntlet of unseen hands. Name the promise, threat, or plan that keeps everyone working.", suggestedSkills: ["diplomacy", "intimidation", "performance"], resourceOptions: ["Promise clean escape", "Make every station report"], feedbackContext: "the pressure of pursuit" })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The ship slips through the tightening lane like a blade through silk. A false wake blooms behind it, drawing pursuit into the wrong channel. For one round of heartbeats, the crew hears the ambushers curse the dark.", [
            { type: "modifier", target: "nextRound.all.dc", mode: "add", value: -1, label: "Next Round All DC -1" }
          ]),
          mixed: outcomeBranch("The ship stays ahead, but the effort eats fuel, rope, and careful stores. Crew move with grim efficiency while quartermasters wince at every emergency cut. The beacon's glow thins but does not die.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          dominantFailure: outcomeBranch("The net tightens across the ship's stern and drags at the Lifeveil like hooked wool. Pursuers gain enough ground for the crew to see painted masks and hungry steel. Escape remains possible, but clean escape does not.", [
            { type: "resource", resource: "lifeveil", mode: "add", value: -1, label: "Lifeveil -1" },
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ], { combatHandoff: true }),
          catastrophicFailure: outcomeBranch("A hidden strike lands from the blind side and throws the deck into a storm of splinters. The false beacon flares in triumph, painting every face corpse-blue. Whatever waits beyond the lane now knows the ship can bleed.", [
            { type: "resource", resource: "hull", mode: "add", value: -2, label: "Hull -2" },
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: raider broadside, boarding crew, or predatory void thing. No combat starts automatically." })
        }
      },
      {
        round: 4,
        title: "Break the Kill Lane",
        openingVignette: "A gap opens ahead where the debris thins and real stars return. The beacon screams behind the ship now, all kindness burned away. Pursuit, current, and wreckage converge in one final geometry of harm. The next decision decides whether the ship leaves as prey, quarry, or legend.",
        activeStations: [
          stationPrompt("navigator", { vignette: "The last safe vector is narrow, bright, and vanishing.", playerAction: "Commit to the escape line and tell the table what landmark guides it. Make the check that breaks the kill lane.", suggestedSkills: ["survival", "sailing-lore", "acrobatics"], resourceOptions: ["Thread the bright gap", "Cut through broken spars"], feedbackContext: "the final escape vector" }),
          stationPrompt("engineer", { vignette: "The arkengine can give one more answer before heat and pressure demand payment.", playerAction: "Choose how hard the engine surges and what safeguard you refuse to abandon. Make the check to turn power into distance.", suggestedSkills: ["crafting", "engineering-lore", "athletics"], resourceOptions: ["Controlled surge", "Redline the housings"], feedbackContext: "the last engine surge" }),
          stationPrompt("veilwarden", { vignette: "The false beacon hurls its last invitation like a hook at the ship's breath.", playerAction: "Seal the Lifeveil against the departing lure. Describe the ward, hymn, or sign that says the ship belongs to itself.", suggestedSkills: ["occultism", "religion", "arcana"], resourceOptions: ["Ward the stern", "Burn the beacon's echo"], feedbackContext: "the beacon's final hook" }),
          stationPrompt("captain", { vignette: "Every station waits for a single word to become motion.", playerAction: "Give the order that times helm, engine, veil, and deck into one escape. Say what the crew remembers about this command afterward.", suggestedSkills: ["diplomacy", "intimidation", "warfare-lore"], resourceOptions: ["Count the stations through", "Demand full commitment"], feedbackContext: "the decisive command" })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The ship breaks the kill lane before the trap can close its fist. The false beacon gutters out behind them, briefly revealing the shape of a watching intelligence. By the time pursuit finds the true wake, the crew has already claimed the stars.", [
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
          ]),
          mixed: outcomeBranch("The ship escapes the lane, but splinters, cut lines, and empty stores tell the price. The beacon fades to a sullen coal astern. No one mistakes mercy for safety now.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          dominantFailure: outcomeBranch("The ship claws free only after the lane marks it with damage and direction. A final lamp follows at the edge of sight for longer than comfort allows. The crew escapes, but the ambushers may not be finished with them.", [
            { type: "resource", resource: "hull", mode: "add", value: -1, label: "Hull -1" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: surviving pursuers with the ship's heading. No combat starts automatically." }),
          catastrophicFailure: outcomeBranch("The kill lane closes across the stern like a jaw. The ship tears free, but only by leaving broken timber, spilled stores, and a bright piece of its Lifeveil behind. The false beacon goes dark as if satisfied.", [
            { type: "resource", resource: "hull", mode: "add", value: -2, label: "Hull -2" },
            { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" },
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ], { combatHandoff: true, handoffNotes: "Possible later threat: an enemy that owns a fragment of the ship's wake or veil. No combat starts automatically." })
        }
      }
    ],
    finalOutcomes: {
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.MAJOR_VICTORY]: { label: "Major Victory", vignette: "The ship exposes the false beacon and escapes with its wake hidden. The crew learns the shape of the trap well enough to warn others or turn the knowledge into leverage. What tried to make them prey must now reckon with sailors who survived its favorite trick. The stars ahead feel colder, but honestly earned.", proposedEffects: [{ type: "resource", resource: "morale", mode: "add", value: 2, label: "Morale +2" }], rewards: ["Ambush route intelligence", "Crew confidence"], losses: [] },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.VICTORY]: { label: "Victory", vignette: "The ship breaks free of the beacon's trap with discipline and a few new scars. The crew knows the light was false, and that knowledge steadies them when real signals call later. Pursuit falls away behind wreckage and dark current. The voyage continues with sharper watches.", proposedEffects: [{ type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }], rewards: ["Safe escape"], losses: [] },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.COSTLY_SUCCESS]: { label: "Costly Success", vignette: "The ship escapes, but the trap takes its tithe in cracked fittings, spoiled stores, and sleepless nerves. The false beacon fades without apology. Crew argue over which moment almost doomed them, then return to work because the void is not finished. Survival is real, if not clean.", proposedEffects: [{ type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }, { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }], rewards: ["Escape from the kill lane"], losses: ["Consumed supplies", "Engine wear"] },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.FAILURE]: { label: "Failure", vignette: "The ship gets out, but not before the ambush marks its hull and heading. A final hidden lamp watches until distance swallows it. The crew knows something out there has measured them and may remember the measure. Any later threat remains a GM choice, not an automatic battle.", proposedEffects: [{ type: "resource", resource: "hull", mode: "add", value: -1, label: "Hull -1" }, { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }], rewards: [], losses: ["Hull damage", "Hostile attention"], combatHandoff: true, handoffNotes: "Potential later pursuer or raider complication. No combat starts automatically." },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.CATASTROPHIC_FAILURE]: { label: "Catastrophic Failure", vignette: "The ship survives the kill lane as a wounded thing dragging sparks through the dark. The false beacon steals a fragment of wake, route, or veil before it dies. Crew remember the kindness in the signal and hate it for being a weapon. The GM may use the handoff as future pressure, but this event starts no combat.", proposedEffects: [{ type: "resource", resource: "hull", mode: "add", value: -2, label: "Hull -2" }, { type: "resource", resource: "lifeveil", mode: "add", value: -2, label: "Lifeveil -2" }, { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" }], rewards: [], losses: ["Severe damage", "Marked wake", "Crew dread"], combatHandoff: true, handoffNotes: "Potential later threat using the stolen wake, surviving raiders, or an occult beacon remnant. No combat starts automatically." }
    },
    rewards: ["Ambush intelligence", "Survival reputation"],
    futureAutomationNotes: ["Keep combatHandoff metadata GM-facing only.", "Stage resource effects for explicit GM review before applying."]
  },
  "portside-diplomatic-snare": {
    key: "portside-diplomatic-snare",
    name: "Portside Diplomatic Snare",
    category: ARCFLIGHT_TRAVEL_EVENT_CATEGORIES.SOCIAL,
    tags: [
      ARCFLIGHT_TRAVEL_TAGS.SOCIAL,
      ARCFLIGHT_TRAVEL_TAGS.MORALE,
      ARCFLIGHT_TRAVEL_TAGS.SUPPLIES,
      ARCFLIGHT_TRAVEL_TAGS.CREW_PRESSURE,
      ARCFLIGHT_TRAVEL_TAGS.RESOURCE_PRESSURE,
      ARCFLIGHT_TRAVEL_TAGS.SHIPBOARD
    ],
    roundCount: 4,
    baseDC: 18,
    activeResources: [
      ARCFLIGHT_TRAVEL_RESOURCES.MORALE,
      ARCFLIGHT_TRAVEL_RESOURCES.SUPPLIES,
      ARCFLIGHT_TRAVEL_RESOURCES.STRAIN
    ],
    travelStations: [...TRAVEL_FIVE],
    description: "A bright port, relay station, or free-floating trade platform welcomes the ship with banners, music, and too many ledgers. Every smile carries a fee, every inspection hides a favor, and every delay gives someone leverage. The danger is polite, perfumed, and written in triplicate.",
    gmSummary: "Run this as a social travel event about pressure, etiquette, debt, and crew patience. Dock officials, guild factors, envoys, creditors, or customs clerks can fill the opposing roles. Catastrophic results may point to faction trouble or a later social handoff, but no combat is assumed.",
    rounds: [
      {
        round: 1,
        title: "The Welcome That Costs Money",
        openingVignette: "The port unfolds around the ship in tiers of colored glass, hanging gardens, brass cranes, and prayer flags stitched with tariff seals. A delegation waits beneath a silk awning while clerks release glittering receipt-doves into the air. Musicians play a welcome march just loud enough to hide the argument at the customs desk. Every rope thrown to the dock is measured, stamped, and admired by someone holding a fee schedule. The harbor smells of spice, hot ink, and opportunity with a hook inside it.",
        activeStations: [
          stationPrompt("captain", { vignette: "The greeting party offers honors that become obligations if accepted too eagerly.", playerAction: "Answer the welcome without surrendering the ship's independence. Decide which courtesy you accept and which costly compliment you sidestep.", suggestedSkills: ["diplomacy", "society", "deception"], resourceOptions: ["Accept limited honors", "Insist on plain docking terms"], feedbackContext: "the expensive welcome" }),
          stationPrompt("watchmaster", { vignette: "Porters, clerks, and charming strangers all drift close enough to overhear the wrong thing.", playerAction: "Watch the crowd for spies, pickpockets, rumor-brokers, and planted witnesses. Tell the GM what detail marks the first snare.", suggestedSkills: ["perception", "society", "stealth"], resourceOptions: ["Post deck sentries", "Let rumors flow as bait"], feedbackContext: "the dockside crowd" }),
          stationPrompt("engineer", { vignette: "Dock inspectors admire the arkengine with professional hunger and an alarming number of forms.", playerAction: "Keep inspectors away from sensitive systems while satisfying enough procedure to avoid insult. Choose what you demonstrate and what remains covered.", suggestedSkills: ["crafting", "engineering-lore", "diplomacy"], resourceOptions: ["Offer a safe demonstration", "Delay with technical jargon"], feedbackContext: "the inspection overture" }),
          stationPrompt("veilwarden", { vignette: "Courtesy charms and oath-ribbons brush the Lifeveil like soft fingers seeking a knot.", playerAction: "Test which blessings are hospitality and which are binding custom. Describe how you keep the ship spiritually polite but unclaimed.", suggestedSkills: ["occultism", "religion", "society"], resourceOptions: ["Accept harmless blessings", "Countermark the threshold"], feedbackContext: "the oath-ribbon welcome" })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The crew receives the welcome without stepping into its hidden debt. Dock officials smile a little more carefully after that. A junior clerk quietly adjusts the first fee downward, impressed by the ship's poise.", [
            { type: "modifier", target: "nextRound.captain.dc", mode: "add", value: -1, label: "Next Captain DC -1" }
          ]),
          mixed: outcomeBranch("The welcome remains cordial, but small charges begin attaching themselves to every kindness. Crew grumble as receipt-doves perch on coils of rope. The port has not trapped the ship, but it has found purchase.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          dominantFailure: outcomeBranch("A ceremonial courtesy becomes an implied contract before anyone can object. The delegation's smiles brighten with practiced innocence. The crew feels the first tug of delay and embarrassment.", [
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ], { nextRoundNotes: "Make the port's paperwork feel like velvet rope." }),
          catastrophicFailure: outcomeBranch("The ship is welcomed as honored guests, debtors, and inspection subjects in the same breath. Three officials produce matching seals, each claiming precedence. Leaving quickly is still possible, but leaving cleanly is not.", [
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
            { type: "modifier", target: "nextRound.all.dc", mode: "add", value: 1, label: "Next Round All DC +1" }
          ], { handoffNotes: "Potential later social complication: disputed docking obligation or offended local factor. No combat starts automatically." })
        }
      },
      {
        round: 2,
        title: "Inspection and Delay",
        openingVignette: "Morning finds the ship surrounded by rope barriers, polite signs, and clerks carrying lacquered tablets. An inspector with pearl spectacles requests access to spaces no visitor needs to see. A guild factor offers to hasten matters for a favor phrased as a friendship. Around the docks, other crews pretend not to watch and fail beautifully.",
        activeStations: [
          stationPrompt("captain", { vignette: "The official schedule grows longer whenever challenged directly.", playerAction: "Negotiate the inspection boundaries and keep tempers from giving the port an excuse. State what concession, if any, you offer.", suggestedSkills: ["diplomacy", "intimidation", "society"], resourceOptions: ["Offer a narrow concession", "Demand charter rights"], feedbackContext: "the inspection argument" }),
          stationPrompt("engineer", { vignette: "Inspection seals threaten to slow maintenance and foul honest work.", playerAction: "Guide inspectors through harmless systems while keeping the ship functional. Explain how you prevent delay from becoming mechanical strain.", suggestedSkills: ["crafting", "engineering-lore", "deception"], resourceOptions: ["Prepare a clean route", "Hide repairs behind procedure"], feedbackContext: "the technical inspection" }),
          stationPrompt("watchmaster", { vignette: "A dockside rumor says the ship carries contraband, curses, or unpaid promises.", playerAction: "Trace the rumor before it hardens into official fact. Decide whether you expose the source or drown it in better gossip.", suggestedSkills: ["perception", "society", "deception"], resourceOptions: ["Question dockhands", "Seed a counter-rumor"], feedbackContext: "the damaging rumor" }),
          stationPrompt("navigator", { vignette: "Departure windows, tide permits, and berth rotations are being rearranged with exquisite inconvenience.", playerAction: "Find a legal departure path through the port's schedules and harbor lanes. Choose whether to press for speed or preserve goodwill.", suggestedSkills: ["society", "sailing-lore", "survival"], resourceOptions: ["Reserve a narrow window", "Wait for a cleaner tide"], feedbackContext: "the delayed departure window" })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The inspection completes with fewer seals than expected and no meaningful hold on the ship. A clerk stamps the papers as if granting a favor, but the favor is mostly yours. Crew begin believing the snare can be slipped.", [
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
          ]),
          mixed: outcomeBranch("The inspection ends, but only after the ship spends stores, favors, and half a day of patience. The paperwork is clean enough to continue and dirty enough to annoy everyone. Dockside smiles remain sharp.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          dominantFailure: outcomeBranch("The inspectors find nothing dangerous and still discover three reasons to delay departure. Each reason wears a different seal. The crew starts muttering that the port is eating the voyage one hour at a time.", [
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" },
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ]),
          catastrophicFailure: outcomeBranch("A planted irregularity becomes a formal concern before witnesses. The officials remain unbearably courteous while tightening every schedule around the ship. Somewhere nearby, the person who arranged it is already drafting the next favor.", [
            { type: "resource", resource: "supplies", mode: "add", value: -2, label: "Supplies -2" },
            { type: "modifier", target: "nextRound.captain.dc", mode: "add", value: 2, label: "Next Captain DC +2" }
          ], { handoffNotes: "Potential later social complication: planted customs irregularity or guild leverage. No combat starts automatically." })
        }
      },
      {
        round: 3,
        title: "The Favor Beneath the Fee",
        openingVignette: "By afternoon, the true price arrives wearing perfume, rank, or impeccable handwriting. A guild factor can erase the fees for one private delivery. An envoy can smooth the inspection for a letter carried unopened. A creditor can forgive a delay if the captain agrees to be seen at the right table. None of them raise their voices; none of them need to.",
        activeStations: [
          stationPrompt("captain", { vignette: "The offer sounds generous until its shadow reaches the next port.", playerAction: "Decide whether to refuse, bargain, or reshape the favor into something survivable. Make clear what promise the ship will not make.", suggestedSkills: ["diplomacy", "society", "deception"], resourceOptions: ["Counteroffer openly", "Refuse with ceremony"], feedbackContext: "the hidden favor" }),
          stationPrompt("veilwarden", { vignette: "Some contracts glitter with harmless ink, while others hum like little cages.", playerAction: "Read the oaths, seals, and courtesy rites for binding force. Describe how the ship avoids spiritual debt.", suggestedSkills: ["occultism", "religion", "society"], resourceOptions: ["Test the seal", "Offer a nonbinding blessing"], feedbackContext: "the binding fine print" }),
          stationPrompt("watchmaster", { vignette: "Someone is watching who accepts which cup, which coin, and which invitation.", playerAction: "Identify observers and protect the crew from being used as witnesses against themselves. Decide who you shadow or distract.", suggestedSkills: ["perception", "stealth", "society"], resourceOptions: ["Shadow the factor's aide", "Keep crew together"], feedbackContext: "the watching witnesses" }),
          stationPrompt("navigator", { vignette: "Every offered favor changes the map by adding ports best avoided or debts best paid early.", playerAction: "Assess how each obligation could alter the voyage ahead. Mark the route that leaves the fewest hooks in the ship.", suggestedSkills: ["society", "sailing-lore", "survival"], resourceOptions: ["Map clean alternatives", "Accept a risky shortcut"], feedbackContext: "the debt-shaped route" })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The crew turns the favor into a minor courtesy instead of a chain. The factor leaves smiling, but not as broadly as planned. The ship gains a little local respect for knowing the worth of its own name.", [
            { type: "modifier", target: "nextRound.all.dc", mode: "add", value: -1, label: "Next Round All DC -1" }
          ]),
          mixed: outcomeBranch("The favor is softened, not escaped. The ship owes a letter, a public toast, or a harmless-looking introduction. It is manageable, but everyone aboard can feel the hook under the ribbon.", [
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }
          ]),
          dominantFailure: outcomeBranch("The negotiation slips, and the fee becomes a favor with witnesses. Refusal now costs reputation, coin, or delay. The crew sees officers calculating which wound heals fastest.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ]),
          catastrophicFailure: outcomeBranch("The ship is maneuvered into public agreement before the cost is fully named. Applause covers the snap of the snare. The obligation may be social rather than violent, but it can still bleed the voyage later.", [
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ], { handoffNotes: "Potential later social handoff: faction debt, guild favor, or public promise. No combat starts automatically." })
        }
      },
      {
        round: 4,
        title: "Depart Clean or Owing",
        openingVignette: "Departure bells ring across the harbor while clerks hurry like bright beetles under paper shells. The ship's lines are ready, but three signatures, two blessings, and one final invoice stand between deck and open void. The port offers farewell gifts that may be gifts, tracking marks, or insults wrapped in silk. The crew can smell free air beyond the cranes.",
        activeStations: [
          stationPrompt("captain", { vignette: "The final handshake decides whether the ship leaves respected, indebted, or mocked.", playerAction: "Close the matter with dignity and firmness. Declare what name the port will use for the ship after departure.", suggestedSkills: ["diplomacy", "intimidation", "society"], resourceOptions: ["Pay only what is owed", "Trade a courtesy for release"], feedbackContext: "the final handshake" }),
          stationPrompt("navigator", { vignette: "The harbor lanes are crowded exactly where delay would be most embarrassing.", playerAction: "Guide the ship out through legal traffic without giving officials another excuse. Choose the cleanest departure window.", suggestedSkills: ["sailing-lore", "society", "survival"], resourceOptions: ["Take the busy lane", "Wait for a quiet bell"], feedbackContext: "the crowded harbor exit" }),
          stationPrompt("engineer", { vignette: "Dockside service crews left tags, seals, and helpful adjustments everywhere.", playerAction: "Clear the ship for departure without accepting hidden maintenance costs. Explain what you inspect before the engine takes load.", suggestedSkills: ["crafting", "engineering-lore", "perception"], resourceOptions: ["Remove excess seals", "Verify every adjustment"], feedbackContext: "the final systems check" }),
          stationPrompt("watchmaster", { vignette: "Farewell crowds wave scarves, contracts, rumors, and perhaps one last planted problem.", playerAction: "Keep eyes on the pier until the last line falls away. Name the person, package, or rumor you refuse to let aboard.", suggestedSkills: ["perception", "society", "intimidation"], resourceOptions: ["Search departing cargo", "Refuse late visitors"], feedbackContext: "the farewell crowd" })
        ],
        outcomeBranches: {
          dominantSuccess: outcomeBranch("The ship departs under its own name and no one else's claim. The port's banners shrink behind the stern while the crew laughs at fees that failed to land. Even the harbor clerks seem to admire the clean exit.", [
            { type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }
          ]),
          mixed: outcomeBranch("The ship leaves with papers in order and tempers frayed. A few stores remain behind as the price of speed. The crew is glad to be gone and wiser about beautiful harbors.", [
            { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }
          ]),
          dominantFailure: outcomeBranch("The ship leaves owing someone a favor, apology, or explanation. The debt is not fatal, but it has a name and a witness. Crew morale sours as the port recedes in expensive sunlight.", [
            { type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ], { handoffNotes: "Potential later social handoff: creditor, guild factor, or offended envoy. No combat starts automatically." }),
          catastrophicFailure: outcomeBranch("The ship departs only after accepting a public obligation or humiliating delay. The port waves farewell as if it has purchased a piece of the voyage. Nobody draws a blade, but the crew feels the cut all the same.", [
            { type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" },
            { type: "resource", resource: "supplies", mode: "add", value: -2, label: "Supplies -2" },
            { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }
          ], { handoffNotes: "Potential later social trouble from debt, insult, legal delay, or faction pressure. No combat starts automatically." })
        }
      }
    ],
    finalOutcomes: {
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.MAJOR_VICTORY]: { label: "Major Victory", vignette: "The ship leaves port with clean papers, intact pride, and a reputation for graceful refusal. The crew turns the whole affair into jokes before the dock lights fade. A contact or clerk may even owe them a small courtesy later. The snare closes on empty air behind them.", proposedEffects: [{ type: "resource", resource: "morale", mode: "add", value: 2, label: "Morale +2" }], rewards: ["Clean departure", "Useful port reputation"], losses: [] },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.VICTORY]: { label: "Victory", vignette: "The ship departs with only minor fees and bruised patience. Officials wave from the pier as if everything was friendship all along. The crew knows better, but knowing better is its own form of profit. The voyage resumes under clear authority.", proposedEffects: [{ type: "resource", resource: "morale", mode: "add", value: 1, label: "Morale +1" }], rewards: ["Clean enough departure"], losses: [] },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.COSTLY_SUCCESS]: { label: "Costly Success", vignette: "The ship escapes the paperwork maze, but coin, stores, and patience stay behind in the port's ledgers. No single concession is ruinous; together they sting. The crew learns which smiles to distrust next time. Departure feels good because remaining would have cost more.", proposedEffects: [{ type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }, { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }], rewards: ["Departure secured"], losses: ["Fees and stores", "Administrative fatigue"] },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.FAILURE]: { label: "Failure", vignette: "The ship leaves with an obligation tucked into its wake. The port's officials remain polite, which makes the debt more irritating rather than less real. Crew mutter about favors, fees, and names to avoid. The GM may turn the loose thread into later social pressure if useful.", proposedEffects: [{ type: "resource", resource: "morale", mode: "add", value: -1, label: "Morale -1" }, { type: "resource", resource: "supplies", mode: "add", value: -1, label: "Supplies -1" }], rewards: [], losses: ["Social debt", "Crew frustration"], handoffNotes: "Potential later social pressure from a guild, creditor, clerk, or envoy. No combat starts automatically." },
      [ARCFLIGHT_TRAVEL_EVENT_OUTCOMES.CATASTROPHIC_FAILURE]: { label: "Catastrophic Failure", vignette: "The ship departs late, lighter, and publicly entangled. The port keeps a piece of its reputation in a ledger stamped with beautiful seals. Crew morale sinks under the knowledge that no sword was drawn and still they were wounded. Any future faction trouble remains a GM-facing handoff, not an automatic encounter.", proposedEffects: [{ type: "resource", resource: "morale", mode: "add", value: -2, label: "Morale -2" }, { type: "resource", resource: "supplies", mode: "add", value: -2, label: "Supplies -2" }, { type: "resource", resource: "strain", mode: "add", value: 1, label: "Strain +1" }], rewards: [], losses: ["Faction pressure", "Public embarrassment", "Costly delay"], handoffNotes: "Potential later social handoff from debt, customs penalties, faction insult, or legal delay. No combat starts automatically." }
    },
    rewards: ["Port contacts", "Hard-won docking lessons"],
    futureAutomationNotes: ["Keep obligations and handoffs GM-facing until data architecture grows.", "Stage resource effects for explicit GM review before applying."]
  }


});

export const CORE_TRAVEL_EVENT_KEYS = Object.freeze(Object.keys(CORE_TRAVEL_EVENTS));

export function getCoreTravelEvent(key) {
  return CORE_TRAVEL_EVENTS[key] ?? null;
}

export function getCoreTravelEventKeys() {
  return CORE_TRAVEL_EVENT_KEYS;
}

export function getCoreTravelEvents() {
  return CORE_TRAVEL_EVENTS;
}

export function getCoreTravelEventsByCategory(category) {
  return CORE_TRAVEL_EVENT_KEYS
    .map((key) => CORE_TRAVEL_EVENTS[key])
    .filter((event) => event.category === category);
}

export function getTravelStationPrompt(eventKey, roundNumber, stationKey) {
  const event = getCoreTravelEvent(eventKey);
  const round = event?.rounds?.find((entry) => entry.round === Number(roundNumber));
  return round?.activeStations?.find((station) => station.stationKey === stationKey) ?? null;
}
