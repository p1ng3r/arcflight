import { ARCFLIGHT_TRAVEL_EVENT_CATEGORIES, ARCFLIGHT_TRAVEL_EVENT_OUTCOMES, ARCFLIGHT_TRAVEL_RESOURCES, ARCFLIGHT_TRAVEL_ROUND_OUTCOMES, ARCFLIGHT_TRAVEL_STATIONS, ARCFLIGHT_TRAVEL_TAGS } from "../../scripts/config/constants.js";
import { getStation } from "../stations/core-stations.js";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function stationPrompt(stationKey, data = {}) {
  return {
    stationKey,
    stationName: getStation(stationKey)?.displayName ?? stationKey,
    suggestedSkills: getStation(stationKey)?.primarySkills ?? [],
    resourceOptions: [],
    ...data
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
          stationPrompt("captain", { vignette: "Decide whether speed, safety, or silence matters most this hour.", resourceOptions: ["Order a controlled slowdown", "Demand a clean hard burn without AP/RAP mechanics"] })
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
      "Track per-round and total successes/failures later without AP/RAP.",
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
