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
