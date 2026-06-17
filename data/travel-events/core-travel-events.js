function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}


const QA_STATIONS = Object.freeze([
  ["captain", "Captain", "Hold crew focus while contradictory portents spread across the decks.", [["diplomacy", "Rally the Deck Crews"], ["intimidation", "Demand Battle-Ready Silence"]]],
  ["navigator", "Navigator", "Plot a bearing through a current that keeps rewriting the visible stars.", [["survival", "Read the Living Current"], ["society", "Recall Proven Crossings"], ["sailing-lore", "Name the Old Starlane"]]],
  ["engineer", "Engineer", "Keep the arkengine stable while the starlane pulls against its rhythm.", [["crafting", "Rebalance the Engine Housing"], ["arcana", "Tune the Harmonic Wake"]]],
  ["veilwarden", "Veilwarden", "Hold the Lifeveil steady as cold sparks gather along the ward-lines.", [["occultism", "Bind the Hungry Echoes"], ["arcana", "Thicken the Lifeveil Pattern"]]],
  ["watchmaster", "Watchmaster", "Separate real threats from false silhouettes pacing the ship.", [["perception", "Track the True Shadow"], ["survival", "Read Predator Drift"]]]
]);

function qaFeedback(stationName, label) {
  return {
    criticalSuccess: `${stationName} turns ${label} into a clean advantage for the crew.`,
    success: `${stationName} makes ${label} hold well enough for the ship to keep moving.`,
    failure: `${stationName} gets only part of ${label} before pressure returns.`,
    criticalFailure: `${stationName} misreads ${label}, giving the voyage a sharp complication.`
  };
}

function qaApproach(stationName, problem, skill, label, index) {
  return {
    skill,
    label,
    helpText: `${label} addresses the station problem by giving the ${stationName} a concrete, player-facing way to respond: ${problem}`,
    boardResultFeedback: qaFeedback(stationName, label),
    gmNarrationFeedback: qaFeedback(stationName, label),
    gmOnlyConsequence: index === 0 ? `${stationName} hidden QA complication for ${label}.` : ""
  };
}

function qaStationCard([stationKey, stationName, problem, approaches]) {
  return {
    stationKey,
    stationName,
    problem,
    skillApproaches: approaches.map(([skill, label], index) => qaApproach(stationName, problem, skill, label, index)),
    rollFeedback: qaFeedback(stationName, "the fallback station response")
  };
}

function qaRound(round, title, openingVignette) {
  return {
    round,
    title,
    openingVignette,
    activeStations: QA_STATIONS.map(([stationKey]) => stationKey),
    stationCards: QA_STATIONS.map(qaStationCard),
    roundEndNarration: {
      criticalRoundSuccess: `${title}: the crew seizes the starlane cleanly.`,
      roundSuccess: `${title}: the ship pushes through with confidence.`,
      narrowRoundSuccess: `${title}: the line holds, but only just.`,
      roundFailure: `${title}: the voyage leaves bruises and unfinished threats.`,
      criticalRoundFailure: `${title}: the starlane punishes every mistake at once.`
    },
    outcomeBranches: {
      dominantSuccess: { vignette: `${title} ends in clear control.`, proposedEffects: [] },
      mixed: { vignette: `${title} ends with a manageable cost.`, proposedEffects: [] },
      dominantFailure: { vignette: `${title} ends under pressure.`, proposedEffects: [] },
      catastrophicFailure: { vignette: `${title} ends in dangerous disorder.`, proposedEffects: [] }
    }
  };
}

export const CORE_TRAVEL_EVENTS = deepFreeze({
  "travel-runner-qa-crossing": {
    key: "travel-runner-qa-crossing",
    name: "Travel Runner QA Crossing",
    category: "testing",
    tags: ["travel", "qa", "missionBoard", "structuredStations"],
    roundCount: 2,
    baseDC: 20,
    activeResources: ["hull", "strain", "lifeveil", "morale", "supplies"],
    travelStations: QA_STATIONS.map(([stationKey]) => stationKey),
    openingVignette: "A compact structured crossing for Travel Player Mission Board and runner QA.",
    description: "A focused fixture with all five Travel Five stations, structured approaches, player-facing feedback, GM narration, and GM-only consequences for leakage checks.",
    gmSummary: "Use this fixture to smoke-test mission board approach display, roll readiness, round summaries, and GM/player text separation.",
    rounds: [
      qaRound(1, "QA Current Opens", "The first QA current bends the route and asks every station to show its chosen method."),
      qaRound(2, "QA Current Tightens", "The second QA current changes pressure so stale station text is easy to notice.")
    ],
    finalOutcomes: {
      criticalSuccess: { label: "Critical Success", vignette: "The QA crossing proves clean and decisive.", proposedEffects: [], rewards: [], losses: [] },
      success: { label: "Success", vignette: "The QA crossing validates the travel runner flow.", proposedEffects: [], rewards: [], losses: [] },
      mixed: { label: "Mixed", vignette: "The QA crossing passes with visible costs to review.", proposedEffects: [], rewards: [], losses: [] },
      failure: { label: "Failure", vignette: "The QA crossing exposes problems the GM can inspect.", proposedEffects: [], rewards: [], losses: [] },
      criticalFailure: { label: "Critical Failure", vignette: "The QA crossing collapses into clear failure signals.", proposedEffects: [], rewards: [], losses: [] }
    }
  },
  "black-tide-crossing": {
    "key": "black-tide-crossing",
    "name": "Black Tide Crossing",
    "category": "environmental",
    "tags": [
      "storm",
      "navigation",
      "strain",
      "lifeveil",
      "threat",
      "combatHandoff"
    ],
    "roundCount": 5,
    "baseDC": 20,
    "activeResources": [
      "strain",
      "lifeveil",
      "morale",
      "hull",
      "supplies"
    ],
    "travelStations": [
      "navigator",
      "engineer",
      "veilwarden",
      "watchmaster",
      "captain"
    ],
    "openingVignette": "The Star Sea ahead stains black before the ship reaches it, and every lantern aboard seems to dim in sympathy. The crossing announces itself as a cinematic voyage problem before any station takes action: choose a line, protect the vessel, keep watch, and hold the crew together while the Black Tide decides whether to let you pass.",
    "description": "The ship must cross a lightless current where black rain, living tide, and distant predators turn navigation into a haunted trial. The passage is beautiful in the way a blade is beautiful: all sheen, silence, and danger. Every station has a way to keep the vessel moving, but the crossing asks a price from hull, Lifeveil, supplies, and nerve.",
    "gmSummary": "Run this as a five-round environmental ordeal in which the Travel Five keep the ship together under unnatural void-pressure. Keep the Black Tide strange but readable: false lights, hungry aether, arkengine resonance, and pursuing shapes in the dark between stars should all give the players choices to make. Proposed effects remain staged for explicit GM review, and combatHandoff notes are only future threat context.",
    "rounds": [
      {
        "round": 1,
        "title": "The Tide Goes Black",
        "openingVignette": "The Star Sea folds into an oil-dark void-swell, and the arkengine wake vanishes behind the ship as if swallowed. Stars wink out one by one until the rigging hangs beneath a blind sky. Black rain begins to fall upward from the aether current, tapping the hull like impatient fingers. Old sailor-prayers go quiet on every deck because everyone knows the name of this crossing. Ahead, the Black Tide opens a path through the Void Between Fires, less a channel than a door into starless night.",
        "stationCards": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "problem": "Find a bearing through a sky with no stars and a Black Tide with no honest current.",
            "skillApproaches": [
              {
                "skill": "survival",
                "label": "Hold the original course",
                "helpText": "Read pressure, drift, vibration, and false wake to keep the vessel aligned when the Black Tide hides every honest bearing."
              },
              {
                "skill": "society",
                "label": "Recall past crossings",
                "helpText": "Remember route marks, port records, warning songs, and reports from crews who survived starless water like this."
              },
              {
                "skill": "sailing-lore",
                "label": "Chart the old tide",
                "helpText": "Use voidsailor tidecraft to identify the Black Tide's older current pattern and plot a safe line through it."
              }
            ],
            "rollFeedback": {
              "criticalSuccess": "The Navigator names the hidden seam before the Tide can close it.",
              "success": "The ship holds a workable bearing through the blind current.",
              "failure": "The bearing wanders, and the Black Tide takes a visible price.",
              "criticalFailure": "The chosen line is a lie, and the crossing surges around the ship."
            },
            "hooks": {
              "rooms": [],
              "shipUpgrades": [],
              "arkengineMods": [],
              "crewAssets": [],
              "factions": []
            }
          }
        ],
        "activeStations": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "society",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to spend time sounding the current or risk a narrower but calmer channel, then make the Navigator check for The Tide Goes Black. Tell the table how the crew addresses this problem: Find a bearing through a sky with no stars and a Black Tide with no honest current.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during The Tide Goes Black turns \"Find a bearing through a sky with no stars and a Black Tide with no honest current\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Find a bearing through a sky with no stars and a Black Tide with no honest current\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Navigator cannot fully resolve \"Find a bearing through a sky with no stars and a Black Tide with no honest current\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Find a bearing through a sky with no stars and a Black Tide with no honest current\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Spend time sounding the current",
              "Risk a narrower but calmer channel"
            ],
            "vignette": "Find a bearing through a sky with no stars and a Black Tide with no honest current.",
            "dcModifier": 0
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "arcana"
            ],
            "playerAction": "Choose whether to vent pressure safely or accept heat buildup to preserve speed, then make the Engineer check for The Tide Goes Black. Tell the table how the crew addresses this problem: Keep the arkengine from fighting the tide until its housings scream.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during The Tide Goes Black turns \"Keep the arkengine from fighting the tide until its housings scream\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Keep the arkengine from fighting the tide until its housings scream\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Engineer cannot fully resolve \"Keep the arkengine from fighting the tide until its housings scream\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Keep the arkengine from fighting the tide until its housings scream\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Vent pressure safely",
              "Accept heat buildup to preserve speed"
            ],
            "vignette": "Keep the arkengine from fighting the tide until its housings scream."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "arcana"
            ],
            "playerAction": "Choose whether to thicken the veil or open small breathing gaps for visibility, then make the Veilwarden check for The Tide Goes Black. Tell the table how the crew addresses this problem: Reinforce the Lifeveil as black rain beads against the wards.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during The Tide Goes Black turns \"Reinforce the Lifeveil as black rain beads against the wards\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Reinforce the Lifeveil as black rain beads against the wards\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Veilwarden cannot fully resolve \"Reinforce the Lifeveil as black rain beads against the wards\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Reinforce the Lifeveil as black rain beads against the wards\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Thicken the veil",
              "Open small breathing gaps for visibility"
            ],
            "vignette": "Reinforce the Lifeveil as black rain beads against the wards."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to post extra lookouts or run quiet to reduce attention, then make the Watchmaster check for The Tide Goes Black. Tell the table how the crew addresses this problem: Mark shapes moving beneath the tide before they decide the ship is prey.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during The Tide Goes Black turns \"Mark shapes moving beneath the tide before they decide the ship is prey\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Mark shapes moving beneath the tide before they decide the ship is prey\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Watchmaster cannot fully resolve \"Mark shapes moving beneath the tide before they decide the ship is prey\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Mark shapes moving beneath the tide before they decide the ship is prey\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Post extra lookouts",
              "Run quiet to reduce attention"
            ],
            "vignette": "Mark shapes moving beneath the tide before they decide the ship is prey."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to rally the deck crews or order strict silence and discipline, then make the Captain check for The Tide Goes Black. Tell the table how the crew addresses this problem: Hold the crew steady as the ship enters a crossing every sailor has heard in ghost stories.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during The Tide Goes Black turns \"Hold the crew steady as the ship enters a crossing every sailor has heard in ghost stories\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Hold the crew steady as the ship enters a crossing every sailor has heard in ghost stories\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Captain cannot fully resolve \"Hold the crew steady as the ship enters a crossing every sailor has heard in ghost stories\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Hold the crew steady as the ship enters a crossing every sailor has heard in ghost stories\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Rally the deck crews",
              "Order strict silence and discipline"
            ],
            "vignette": "Hold the crew steady as the ship enters a crossing every sailor has heard in ghost stories."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The ship enters cleanly, cutting a pale seam through the black tide. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.navigator.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Navigator DC -1"
              }
            ],
            "nextRoundNotes": "The opening line is strong; reward confident routing."
          },
          "mixed": {
            "vignette": "The ship holds course, but the black rain leaves every rope slick and every breath sour. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ],
            "nextRoundNotes": "The crossing begins under strain, but not panic."
          },
          "dominantFailure": {
            "vignette": "The tide catches the hull broadside and the first watch staggers across the deck. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ],
            "nextRoundNotes": "Make the next round feel less forgiving."
          },
          "catastrophicFailure": {
            "vignette": "Something beneath the ship's gravity shadow answers the arkengine wake with a hollow knock against the keel. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -1,
                "label": "Hull -1"
              },
              {
                "type": "modifier",
                "target": "nextRound.watchmaster.dc",
                "mode": "add",
                "value": 2,
                "label": "Next Watchmaster DC +2"
              }
            ],
            "nextRoundNotes": "Foreshadow a pursuing threat.",
            "combatHandoff": true
          }
        }
      },
      {
        "round": 2,
        "title": "Rain That Drinks Lanternlight",
        "openingVignette": "Lanterns dim to bruised halos as rain falls upward from the tide and patters against the underside of the rigging. Each drop drinks a little warmth and leaves a black bead that refuses to run. Shapes appear in the glow, then flatten into reflections when watched directly. The ship has entered the part of the crossing where sight is useful only after doubt has sharpened it.",
        "activeStations": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "occultism",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to follow the coldest wind or trust the charts despite the lights, then make the Navigator check for Rain That Drinks Lanternlight. Tell the table how the crew addresses this problem: Read the negative space between false lights.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Rain That Drinks Lanternlight turns \"Read the negative space between false lights\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Read the negative space between false lights\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Navigator cannot fully resolve \"Read the negative space between false lights\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Read the negative space between false lights\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Follow the coldest wind",
              "Trust the charts despite the lights"
            ],
            "vignette": "Read the negative space between false lights."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "arcana"
            ],
            "playerAction": "Choose whether to cycle filters or push through before the grit settles, then make the Engineer check for Rain That Drinks Lanternlight. Tell the table how the crew addresses this problem: Keep damp-black grit out of intakes, valves, and warded seams.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Rain That Drinks Lanternlight turns \"Keep damp-black grit out of intakes, valves, and warded seams\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Keep damp-black grit out of intakes, valves, and warded seams\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Engineer cannot fully resolve \"Keep damp-black grit out of intakes, valves, and warded seams\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Keep damp-black grit out of intakes, valves, and warded seams\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Cycle filters",
              "Push through before the grit settles"
            ],
            "vignette": "Keep damp-black grit out of intakes, valves, and warded seams.",
            "dcModifier": 1
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "arcana"
            ],
            "playerAction": "Choose whether to draw power from stored wards or let the crew endure a cold watch, then make the Veilwarden check for Rain That Drinks Lanternlight. Tell the table how the crew addresses this problem: Stop the rain from leeching warmth through the Lifeveil.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Rain That Drinks Lanternlight turns \"Stop the rain from leeching warmth through the Lifeveil\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Stop the rain from leeching warmth through the Lifeveil\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Veilwarden cannot fully resolve \"Stop the rain from leeching warmth through the Lifeveil\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Stop the rain from leeching warmth through the Lifeveil\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Draw power from stored wards",
              "Let the crew endure a cold watch"
            ],
            "vignette": "Stop the rain from leeching warmth through the Lifeveil."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival"
            ],
            "playerAction": "Choose whether to use hooded signal lamps or listen instead of looking, then make the Watchmaster check for Rain That Drinks Lanternlight. Tell the table how the crew addresses this problem: Separate reflections from real silhouettes pacing the ship.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Rain That Drinks Lanternlight turns \"Separate reflections from real silhouettes pacing the ship\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Separate reflections from real silhouettes pacing the ship\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Watchmaster cannot fully resolve \"Separate reflections from real silhouettes pacing the ship\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Separate reflections from real silhouettes pacing the ship\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Use hooded signal lamps",
              "Listen instead of looking"
            ],
            "vignette": "Separate reflections from real silhouettes pacing the ship."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to name practical tasks or address the omen directly, then make the Captain check for Rain That Drinks Lanternlight. Tell the table how the crew addresses this problem: Prevent rumors from becoming certainty as sailors see faces in the rain.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Rain That Drinks Lanternlight turns \"Prevent rumors from becoming certainty as sailors see faces in the rain\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Prevent rumors from becoming certainty as sailors see faces in the rain\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Captain cannot fully resolve \"Prevent rumors from becoming certainty as sailors see faces in the rain\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Prevent rumors from becoming certainty as sailors see faces in the rain\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Name practical tasks",
              "Address the omen directly"
            ],
            "vignette": "Prevent rumors from becoming certainty as sailors see faces in the rain."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The crew learns the rain's rhythm and moves between its hungry curtains. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": 1,
                "label": "Lifeveil +1"
              }
            ],
            "nextRoundNotes": "Recovered veil stability can matter in later rounds."
          },
          "mixed": {
            "vignette": "The ship stays whole, but the dark rain steals warmth, sleep, and patience. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "A false constellation pulls the bow off course before the crew claws it back. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.navigator.dc",
                "mode": "add",
                "value": 2,
                "label": "Next Navigator DC +2"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "The ship sails under its own reflection, and the reflection is not alone. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -2,
                "label": "Lifeveil -2"
              }
            ],
            "nextRoundNotes": "Use mirror imagery to escalate the omen.",
            "combatHandoff": true
          }
        }
      },
      {
        "round": 3,
        "title": "The Engine Hears a Song",
        "openingVignette": "The arkengine begins to answer a melody no one aboard is playing. Its housings thrum in phrases, and the Black Tide replies through the keel with a deeper note. Loose tools creep across worktables toward the sound. Beneath the arkengine wake, something vast seems to listen from the ship's gravity shadow for the vessel to complete the song.",
        "activeStations": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "society",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to change headings abruptly or commit to one hard line, then make the Navigator check for The Engine Hears a Song. Tell the table how the crew addresses this problem: Plot against a current that now anticipates correction.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during The Engine Hears a Song turns \"Plot against a current that now anticipates correction\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Plot against a current that now anticipates correction\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Navigator cannot fully resolve \"Plot against a current that now anticipates correction\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Plot against a current that now anticipates correction\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Change headings abruptly",
              "Commit to one hard line"
            ],
            "vignette": "Plot against a current that now anticipates correction."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "arcana",
              "occultism"
            ],
            "playerAction": "Choose whether to bleed resonance into spare conduits or dampen the core and lose speed, then make the Engineer check for The Engine Hears a Song. Tell the table how the crew addresses this problem: Tune the arkengine away from the tide-song before resonance becomes damage.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during The Engine Hears a Song turns \"Tune the arkengine away from the tide-song before resonance becomes damage\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Tune the arkengine away from the tide-song before resonance becomes damage\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Engineer cannot fully resolve \"Tune the arkengine away from the tide-song before resonance becomes damage\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Tune the arkengine away from the tide-song before resonance becomes damage\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Bleed resonance into spare conduits",
              "Dampen the core and lose speed"
            ],
            "vignette": "Tune the arkengine away from the tide-song before resonance becomes damage.",
            "successContribution": {
              "successes": 1,
              "failures": 0,
              "criticalFailures": 0
            }
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "arcana"
            ],
            "playerAction": "Choose whether to mute the outer veil or counter-harmonize with ward tones, then make the Veilwarden check for The Engine Hears a Song. Tell the table how the crew addresses this problem: Keep the Lifeveil from repeating the engine's song back into the Black Tide.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during The Engine Hears a Song turns \"Keep the Lifeveil from repeating the engine's song back into the Black Tide\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Keep the Lifeveil from repeating the engine's song back into the Black Tide\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Veilwarden cannot fully resolve \"Keep the Lifeveil from repeating the engine's song back into the Black Tide\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Keep the Lifeveil from repeating the engine's song back into the Black Tide\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Mute the outer veil",
              "Counter-harmonize with ward tones"
            ],
            "vignette": "Keep the Lifeveil from repeating the engine's song back into the Black Tide."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival"
            ],
            "playerAction": "Choose whether to triangulate echoes or hide the ship's rhythm, then make the Watchmaster check for The Engine Hears a Song. Tell the table how the crew addresses this problem: Track the void-hidden source answering each engine note.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during The Engine Hears a Song turns \"Track the void-hidden source answering each engine note\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Track the void-hidden source answering each engine note\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Watchmaster cannot fully resolve \"Track the void-hidden source answering each engine note\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Track the void-hidden source answering each engine note\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Triangulate echoes",
              "Hide the ship's rhythm"
            ],
            "vignette": "Track the void-hidden source answering each engine note."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to order a controlled slowdown or demand a clean hard burn without extra mechanics, then make the Captain check for The Engine Hears a Song. Tell the table how the crew addresses this problem: Decide whether speed, safety, or silence matters most this hour.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during The Engine Hears a Song turns \"Decide whether speed, safety, or silence matters most this hour\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Decide whether speed, safety, or silence matters most this hour\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Captain cannot fully resolve \"Decide whether speed, safety, or silence matters most this hour\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Decide whether speed, safety, or silence matters most this hour\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Order a controlled slowdown",
              "Demand a clean hard burn without extra mechanics"
            ],
            "vignette": "Decide whether speed, safety, or silence matters most this hour."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The engine falls out of tune with the tide, and the dark between stars loses interest for a precious mile. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": -1,
                "label": "Strain -1"
              }
            ],
            "nextRoundNotes": "A strong engineering beat can relieve pressure."
          },
          "mixed": {
            "vignette": "The melody fades, but it leaves the hull thrumming like a struck bell. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The arkengine coughs black sparks and the crew smells void-rain in sealed compartments. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 2,
                "label": "Strain +2"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "The engine completes the tide's melody, and something enormous changes direction beneath the ship's gravity shadow. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 2,
                "label": "Strain +2"
              },
              {
                "type": "modifier",
                "target": "nextRound.watchmaster.dc",
                "mode": "add",
                "value": 2,
                "label": "Next Watchmaster DC +2"
              }
            ],
            "nextRoundNotes": "Prepare combat handoff metadata if the GM wants a later encounter.",
            "combatHandoff": true
          }
        }
      },
      {
        "round": 4,
        "title": "Shapes Beneath the Wake",
        "openingVignette": "Long pale shapes roll beneath the arkengine wake, never crossing fully into the Lifeveil's light, always matching the ship's speed. Their movement is too patient for beasts and too hungry for simple driftwood. The black current rises in gravity swells around the hull, trying to herd the vessel where it wants. Every order now sounds louder than it should.",
        "activeStations": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "society",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to take a jagged route or stay steady and avoid gravity shears, then make the Navigator check for Shapes Beneath the Wake. Tell the table how the crew addresses this problem: Use asteroid shoals, crosscurrents, or darkness to break the pursuit line.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Shapes Beneath the Wake turns \"Use asteroid shoals, crosscurrents, or darkness to break the pursuit line\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Use asteroid shoals, crosscurrents, or darkness to break the pursuit line\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Navigator cannot fully resolve \"Use asteroid shoals, crosscurrents, or darkness to break the pursuit line\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Use asteroid shoals, crosscurrents, or darkness to break the pursuit line\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Take a jagged route",
              "Stay steady and avoid gravity shears"
            ],
            "vignette": "Use asteroid shoals, crosscurrents, or darkness to break the pursuit line."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "arcana"
            ],
            "playerAction": "Choose whether to cycle power irregularly or run hot and hope to outrun them, then make the Engineer check for Shapes Beneath the Wake. Tell the table how the crew addresses this problem: Mask engine rhythm without losing all momentum.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Shapes Beneath the Wake turns \"Mask engine rhythm without losing all momentum\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Mask engine rhythm without losing all momentum\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Engineer cannot fully resolve \"Mask engine rhythm without losing all momentum\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Mask engine rhythm without losing all momentum\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Cycle power irregularly",
              "Run hot and hope to outrun them"
            ],
            "vignette": "Mask engine rhythm without losing all momentum."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "arcana"
            ],
            "playerAction": "Choose whether to draw the veil close or pulse a decoy ward, then make the Veilwarden check for Shapes Beneath the Wake. Tell the table how the crew addresses this problem: Keep the Lifeveil quiet enough that hunters cannot taste the crew's fear.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Shapes Beneath the Wake turns \"Keep the Lifeveil quiet enough that hunters cannot taste the crew's fear\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Keep the Lifeveil quiet enough that hunters cannot taste the crew's fear\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Veilwarden cannot fully resolve \"Keep the Lifeveil quiet enough that hunters cannot taste the crew's fear\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Keep the Lifeveil quiet enough that hunters cannot taste the crew's fear\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Draw the veil close",
              "Pulse a decoy ward"
            ],
            "vignette": "Keep the Lifeveil quiet enough that hunters cannot taste the crew's fear."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival"
            ],
            "playerAction": "Choose whether to track lead shapes or watch for the unseen one behind, then make the Watchmaster check for Shapes Beneath the Wake. Tell the table how the crew addresses this problem: Call maneuvers before the shapes ram or herd the vessel.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Shapes Beneath the Wake turns \"Call maneuvers before the shapes ram or herd the vessel\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Call maneuvers before the shapes ram or herd the vessel\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Watchmaster cannot fully resolve \"Call maneuvers before the shapes ram or herd the vessel\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Call maneuvers before the shapes ram or herd the vessel\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Track lead shapes",
              "Watch for the unseen one behind"
            ],
            "vignette": "Call maneuvers before the shapes ram or herd the vessel.",
            "dcModifier": 1
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to assign clear response crews or prepare a threat handoff for later, then make the Captain check for Shapes Beneath the Wake. Tell the table how the crew addresses this problem: Coordinate evasive work without turning the deck into chaos.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Shapes Beneath the Wake turns \"Coordinate evasive work without turning the deck into chaos\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Coordinate evasive work without turning the deck into chaos\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Captain cannot fully resolve \"Coordinate evasive work without turning the deck into chaos\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Coordinate evasive work without turning the deck into chaos\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Assign clear response crews",
              "Prepare a threat handoff for later"
            ],
            "vignette": "Coordinate evasive work without turning the deck into chaos."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The hunters lose the ship's scent in a churn of false wakes. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.all.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Round All DC -1"
              }
            ]
          },
          "mixed": {
            "vignette": "The shapes fall back, but only after testing the hull with a glancing strike. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -1,
                "label": "Hull -1"
              }
            ],
            "nextRoundNotes": "The final round should feel earned."
          },
          "dominantFailure": {
            "vignette": "The ship is herded into a narrower lane of black current. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.navigator.dc",
                "mode": "add",
                "value": 2,
                "label": "Next Navigator DC +2"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ],
            "combatHandoff": true
          },
          "catastrophicFailure": {
            "vignette": "A pale shape breaches close enough for the crew to see old harpoons in its hide. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -2,
                "label": "Hull -2"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              }
            ],
            "nextRoundNotes": "If the GM wants combat later, this branch identifies a wounded tide-beast threat.",
            "combatHandoff": true
          }
        }
      },
      {
        "round": 5,
        "title": "Dawn at the Far Edge",
        "openingVignette": "A gray seam of dawn opens ahead, thin as a knife cut in the dark. Behind the ship, the Black Tide rises like a gate deciding whether to close. The pale shapes keep pace for one last stretch, and the rain tastes of cold iron. The crew can see daylight, but the crossing has one more claim to press.",
        "activeStations": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "society",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to spend the last safe bearing or trust instinct over instruments, then make the Navigator check for Dawn at the Far Edge. Tell the table how the crew addresses this problem: Commit to the final line through breaking currents.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Dawn at the Far Edge turns \"Commit to the final line through breaking currents\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Commit to the final line through breaking currents\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Navigator cannot fully resolve \"Commit to the final line through breaking currents\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Commit to the final line through breaking currents\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Spend the last safe bearing",
              "Trust instinct over instruments"
            ],
            "vignette": "Commit to the final line through breaking currents."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "arcana"
            ],
            "playerAction": "Choose whether to use a cautious surge or risk extra strain for distance, then make the Engineer check for Dawn at the Far Edge. Tell the table how the crew addresses this problem: Give the arkengine one final controlled surge without invoking combat action economy.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Dawn at the Far Edge turns \"Give the arkengine one final controlled surge without invoking combat action economy\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Give the arkengine one final controlled surge without invoking combat action economy\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Engineer cannot fully resolve \"Give the arkengine one final controlled surge without invoking combat action economy\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Give the arkengine one final controlled surge without invoking combat action economy\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Use a cautious surge",
              "Risk extra strain for distance"
            ],
            "vignette": "Give the arkengine one final controlled surge without invoking combat action economy."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "arcana"
            ],
            "playerAction": "Choose whether to anchor the veil to the hull or anchor the veil to crew focus, then make the Veilwarden check for Dawn at the Far Edge. Tell the table how the crew addresses this problem: Brace the Lifeveil for the crossing's final pressure wave.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Dawn at the Far Edge turns \"Brace the Lifeveil for the crossing's final pressure wave\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Brace the Lifeveil for the crossing's final pressure wave\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Veilwarden cannot fully resolve \"Brace the Lifeveil for the crossing's final pressure wave\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Brace the Lifeveil for the crossing's final pressure wave\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Anchor the veil to the hull",
              "Anchor the veil to crew focus"
            ],
            "vignette": "Brace the Lifeveil for the crossing's final pressure wave."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival"
            ],
            "playerAction": "Choose whether to call the closing gate or track pursuing shapes, then make the Watchmaster check for Dawn at the Far Edge. Tell the table how the crew addresses this problem: Watch the rear tide for the last strike or false opening.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Dawn at the Far Edge turns \"Watch the rear tide for the last strike or false opening\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Watch the rear tide for the last strike or false opening\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Watchmaster cannot fully resolve \"Watch the rear tide for the last strike or false opening\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Watch the rear tide for the last strike or false opening\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Call the closing gate",
              "Track pursuing shapes"
            ],
            "vignette": "Watch the rear tide for the last strike or false opening."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to count the ship through or let each station act on signal, then make the Captain check for Dawn at the Far Edge. Tell the table how the crew addresses this problem: Choose the moment every station commits together.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Dawn at the Far Edge turns \"Choose the moment every station commits together\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Choose the moment every station commits together\" well enough for the ship to keep its line through Black Tide Crossing.",
              "failure": "Captain cannot fully resolve \"Choose the moment every station commits together\", and Black Tide Crossing leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Choose the moment every station commits together\", giving Black Tide Crossing a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Count the ship through",
              "Let each station act on signal"
            ],
            "vignette": "Choose the moment every station commits together."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The ship bursts into gray daylight with the black tide collapsing harmlessly astern. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              }
            ]
          },
          "mixed": {
            "vignette": "The ship escapes, battered and silent, with daylight finding every new crack and bruise. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The tide spits the ship out sideways, alive but wounded by the crossing. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -1,
                "label": "Hull -1"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "The ship escapes only because the thing behind it chooses to remember the vessel for later. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -2,
                "label": "Hull -2"
              },
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -2,
                "label": "Lifeveil -2"
              }
            ],
            "combatHandoff": true
          }
        }
      }
    ],
    "finalOutcomes": {
      "majorVictory": {
        "label": "Major Victory",
        "vignette": "The crew masters the crossing and leaves the Black Tide with a route others might one day follow. The crew carries away more than survival: they carry a story that can steady future watches. Let this outcome feel like earned mastery rather than simple escape.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": 2,
            "label": "Morale +2"
          },
          {
            "type": "modifier",
            "target": "future.blackTide.navigation.dc",
            "mode": "add",
            "value": -2,
            "label": "Future Black Tide navigation DC -2"
          }
        ],
        "rewards": [
          "Safe crossing",
          "Black Tide route notes"
        ],
        "losses": []
      },
      "victory": {
        "label": "Victory",
        "vignette": "The ship clears the Black Tide with scars, stories, and a usable bearing. The voyage continues with the crew tired, alert, and proud enough to keep moving. Any scars become useful lessons instead of open wounds.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": 1,
            "label": "Morale +1"
          }
        ],
        "rewards": [
          "Safe crossing"
        ],
        "losses": []
      },
      "costlySuccess": {
        "label": "Costly Success",
        "vignette": "The crossing is complete, but the ship pays in repairs, supplies, and shaken nerves. The ship is safe enough to continue, but the cost should be visible in stores, watches, or repair lists. Give the players a moment to name what they sacrificed to pass through Black Tide.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": -1,
            "label": "Supplies -1"
          },
          {
            "type": "resource",
            "resource": "strain",
            "mode": "add",
            "value": 1,
            "label": "Strain +1"
          }
        ],
        "rewards": [
          "Safe crossing"
        ],
        "losses": [
          "Consumed supplies",
          "Engine wear"
        ]
      },
      "failure": {
        "label": "Failure",
        "vignette": "The ship emerges off course and damaged, the Black Tide still clinging to its wake. The ship moves on, but Black Tide leaves a hook the GM can show later if useful. Keep the consequence concrete without forcing an immediate encounter.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "hull",
            "mode": "add",
            "value": -1,
            "label": "Hull -1"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -1,
            "label": "Morale -1"
          }
        ],
        "rewards": [],
        "losses": [
          "Lost time",
          "Hull damage"
        ],
        "combatHandoff": true,
        "handoffNotes": "A pursuing tide-beast, occult remora, or rival vessel may be introduced later at GM discretion. No combat starts automatically."
      },
      "catastrophicFailure": {
        "label": "Catastrophic Failure",
        "vignette": "The Black Tide lets the ship go only after taking a lasting bite from hull, veil, and reputation. Survival is real, but nobody aboard mistakes it for victory. The GM can turn the handoff notes into future pressure while keeping this event complete.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "hull",
            "mode": "add",
            "value": -2,
            "label": "Hull -2"
          },
          {
            "type": "resource",
            "resource": "lifeveil",
            "mode": "add",
            "value": -2,
            "label": "Lifeveil -2"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -2,
            "label": "Morale -2"
          }
        ],
        "rewards": [],
        "losses": [
          "Severe damage",
          "Crew trauma",
          "Hostile attention"
        ],
        "combatHandoff": true,
        "handoffNotes": "Use this metadata only if the GM chooses to frame a later threat encounter; this event never launches combat."
      }
    },
    "rewards": [
      "Narrative route knowledge",
      "Potential future Black Tide crossing advantage"
    ],
    "futureAutomationNotes": [
      "Attach active event state to one ship actor later.",
      "Track per-round and total successes/failures later without action-economy costs.",
      "Stage proposed effects for explicit GM review before applying.",
      "Use combatHandoff metadata only as GM-facing context; never auto-launch combat."
    ]
  },
  "derelict-lantern-wreck": {
    "key": "derelict-lantern-wreck",
    "name": "Derelict Lantern Wreck",
    "category": "discovery",
    "tags": [
      "discovery",
      "derelict",
      "salvage",
      "occult",
      "lifeveil",
      "threat",
      "resourcePressure"
    ],
    "roundCount": 4,
    "baseDC": 19,
    "activeResources": [
      "strain",
      "lifeveil",
      "morale",
      "supplies"
    ],
    "travelStations": [
      "navigator",
      "engineer",
      "veilwarden",
      "watchmaster",
      "captain"
    ],
    "description": "A dead arkship drifts through the void with a green-white lantern still burning in its bow, too steady to be accident and too inviting to ignore. The wreck promises salvage, frozen cargo tags, and old names scratched into cold brass. It also carries occult Lifeveil residue that can stain the airskin and turn curiosity into a later threat.",
    "gmSummary": "Run this as a four-round discovery event about a dead arkship in a cold orbit: decide how close to come, what to risk, and when to cut the salvage line. Let the lantern be uncanny but practical at the table: it reveals void hazards, tempts greed, and marks careless choices. Bad branches stage resource pressure and GM-facing handoff notes only; no fight begins by itself.",
    "rounds": [
      {
        "round": 1,
        "title": "Spotting the Dead Light",
        "openingVignette": "A green-white lantern burns in the bow of a silent arkship, too steady for wreckage and too bright for a corpse. The derelict drifts bow-first through the void like it still remembers a destination. Its sails hang in black ribbons, and frost glitters along rails where no breath should remain. No distress bell rings, yet the lantern flashes a rhythm almost like welcome. Every sailor aboard understands that salvage and warning often wear the same light.",
        "activeStations": [
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to post glass on the bow lantern or sweep the shadows beneath the hull, then make the Watchmaster check for Spotting the Dead Light. Tell the table how the crew addresses this problem: Identify the wreck's silhouette, broken rigging, and any danger signs moving against the drift.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Spotting the Dead Light turns \"Identify the wreck's silhouette, broken rigging, and any danger signs moving against the drift\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Identify the wreck's silhouette, broken rigging, and any danger signs moving against the drift\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Watchmaster cannot fully resolve \"Identify the wreck's silhouette, broken rigging, and any danger signs moving against the drift\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Identify the wreck's silhouette, broken rigging, and any danger signs moving against the drift\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Post glass on the bow lantern",
              "Sweep the shadows beneath the hull"
            ],
            "vignette": "Identify the wreck's silhouette, broken rigging, and any danger signs moving against the drift."
          },
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "society",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to circle wide first or close quickly before the drift worsens, then make the Navigator check for Spotting the Dead Light. Tell the table how the crew addresses this problem: Plot a cautious approach that avoids dead cables, spilled cargo, and the wreck's slow roll.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Spotting the Dead Light turns \"Plot a cautious approach that avoids dead cables, spilled cargo, and the wreck's slow roll\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Plot a cautious approach that avoids dead cables, spilled cargo, and the wreck's slow roll\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Navigator cannot fully resolve \"Plot a cautious approach that avoids dead cables, spilled cargo, and the wreck's slow roll\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Plot a cautious approach that avoids dead cables, spilled cargo, and the wreck's slow roll\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Circle wide first",
              "Close quickly before the drift worsens"
            ],
            "vignette": "Plot a cautious approach that avoids dead cables, spilled cargo, and the wreck's slow roll."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to limit the boarding party or promise salvage shares for discipline, then make the Captain check for Spotting the Dead Light. Tell the table how the crew addresses this problem: Decide whether the chance at salvage is worth contact with a ship that should be dark.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Spotting the Dead Light turns \"Decide whether the chance at salvage is worth contact with a ship that should be dark\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Decide whether the chance at salvage is worth contact with a ship that should be dark\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Captain cannot fully resolve \"Decide whether the chance at salvage is worth contact with a ship that should be dark\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Decide whether the chance at salvage is worth contact with a ship that should be dark\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Limit the boarding party",
              "Promise salvage shares for discipline"
            ],
            "vignette": "Decide whether the chance at salvage is worth contact with a ship that should be dark."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "religion",
              "arcana"
            ],
            "playerAction": "Choose whether to thicken the Lifeveil or take a clean reading before warding, then make the Veilwarden check for Spotting the Dead Light. Tell the table how the crew addresses this problem: Feel for occult residue in the lanternlight before the Lifeveil brushes the wreck.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Spotting the Dead Light turns \"Feel for occult residue in the lanternlight before the Lifeveil brushes the wreck\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Feel for occult residue in the lanternlight before the Lifeveil brushes the wreck\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Veilwarden cannot fully resolve \"Feel for occult residue in the lanternlight before the Lifeveil brushes the wreck\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Feel for occult residue in the lanternlight before the Lifeveil brushes the wreck\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Thicken the Lifeveil",
              "Take a clean reading before warding"
            ],
            "vignette": "Feel for occult residue in the lanternlight before the Lifeveil brushes the wreck."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The crew reads the wreck's dangers before committing, turning rumor into a workable approach. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.navigator.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Navigator DC -1"
              }
            ],
            "nextRoundNotes": "The approach begins with accurate wreck-readings."
          },
          "mixed": {
            "vignette": "The lantern stays fixed in every spyglass, and the crew grows quiet around it. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The dead ship rolls unexpectedly, forcing a hard correction before contact. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "A false survivor signals from the bow beneath the lantern, though no living breath fogs the glass. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              },
              {
                "type": "modifier",
                "target": "nextRound.watchmaster.dc",
                "mode": "add",
                "value": 2,
                "label": "Next Watchmaster DC +2"
              }
            ],
            "nextRoundNotes": "Treat the signal as a lure or trapped echo.",
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: false survivor, corpse-light lure, or hidden scavenger. No combat starts automatically."
          }
        }
      },
      {
        "round": 2,
        "title": "Matching Drift",
        "openingVignette": "The two ships slide closer through the starless drift, hull to hull, while the witchlight paints every rope with a sickly shine. Broken plates turn slowly along the derelict's side, opening and closing like failed Lifeveil shutters. The lantern never sways, though everything else in the wreck rolls through dead orbit. Matching speed now means trusting the dead ship not to wake beneath the touch.",
        "activeStations": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "society",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to use a patient parallel drift or take a tighter salvage line, then make the Navigator check for Matching Drift. Tell the table how the crew addresses this problem: Match the wreck's tumbling vector without scraping the ship along its torn plates.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Matching Drift turns \"Match the wreck's tumbling vector without scraping the ship along its torn plates\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Match the wreck's tumbling vector without scraping the ship along its torn plates\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Navigator cannot fully resolve \"Match the wreck's tumbling vector without scraping the ship along its torn plates\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Match the wreck's tumbling vector without scraping the ship along its torn plates\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Use a patient parallel drift",
              "Take a tighter salvage line"
            ],
            "vignette": "Match the wreck's tumbling vector without scraping the ship along its torn plates."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "arcana"
            ],
            "playerAction": "Choose whether to dampen the engine mounts or hold reserve power for retreat, then make the Engineer check for Matching Drift. Tell the table how the crew addresses this problem: Keep the arkengine quiet and stable so vibration does not wake whatever the wreck remembers.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Matching Drift turns \"Keep the arkengine quiet and stable so vibration does not wake whatever the wreck remembers\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Keep the arkengine quiet and stable so vibration does not wake whatever the wreck remembers\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Engineer cannot fully resolve \"Keep the arkengine quiet and stable so vibration does not wake whatever the wreck remembers\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Keep the arkengine quiet and stable so vibration does not wake whatever the wreck remembers\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Dampen the engine mounts",
              "Hold reserve power for retreat"
            ],
            "vignette": "Keep the arkengine quiet and stable so vibration does not wake whatever the wreck remembers."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "stealth",
              "survival"
            ],
            "playerAction": "Choose whether to mark every shadow or keep weapons low but ready, then make the Watchmaster check for Matching Drift. Tell the table how the crew addresses this problem: Scan ports, cargo gaps, and shattered decks for movement or ambush.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Matching Drift turns \"Scan ports, cargo gaps, and shattered decks for movement or ambush\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Scan ports, cargo gaps, and shattered decks for movement or ambush\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Watchmaster cannot fully resolve \"Scan ports, cargo gaps, and shattered decks for movement or ambush\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Scan ports, cargo gaps, and shattered decks for movement or ambush\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Mark every shadow",
              "Keep weapons low but ready"
            ],
            "vignette": "Scan ports, cargo gaps, and shattered decks for movement or ambush."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "nature",
              "religion"
            ],
            "playerAction": "Choose whether to seal the veil edge or let a thread sample the residue, then make the Veilwarden check for Matching Drift. Tell the table how the crew addresses this problem: Test how the Lifeveil reacts when the ships' atmospheres almost touch.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Matching Drift turns \"Test how the Lifeveil reacts when the ships' atmospheres almost touch\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Test how the Lifeveil reacts when the ships' atmospheres almost touch\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Veilwarden cannot fully resolve \"Test how the Lifeveil reacts when the ships' atmospheres almost touch\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Test how the Lifeveil reacts when the ships' atmospheres almost touch\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Seal the veil edge",
              "Let a thread sample the residue"
            ],
            "vignette": "Test how the Lifeveil reacts when the ships' atmospheres almost touch."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The ships come together gently, with clean lines for retreat and boarding alike. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.engineer.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Engineer DC -1"
              }
            ]
          },
          "mixed": {
            "vignette": "Contact is safe enough, but cold lanternlight seeps through the Lifeveil seams. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "A hidden spar grinds across the hull and ruins the clean approach. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              },
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "The wreck knocks once from within, and the boarding lines pull taut by themselves. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -2,
                "label": "Lifeveil -2"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: animated boarding lines, lantern-haunt, or concealed boarders. No combat starts automatically."
          }
        }
      },
      {
        "round": 3,
        "title": "Salvage or Signal",
        "openingVignette": "The boarding lines go taut, and the derelict receives them without a sound. Air from its seams smells of old wax, star-frost, and papers kept too long in a grave. The lantern's glow reaches across the gap in a narrow path, bright enough to guide boots and hide stains. Somewhere inside, a loose bell taps once and then remembers silence.",
        "activeStations": [
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to take only marked necessities or authorize one risky prize, then make the Captain check for Salvage or Signal. Tell the table how the crew addresses this problem: Set salvage priorities before curiosity turns the boarding party greedy or slow.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Salvage or Signal turns \"Set salvage priorities before curiosity turns the boarding party greedy or slow\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Set salvage priorities before curiosity turns the boarding party greedy or slow\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Captain cannot fully resolve \"Set salvage priorities before curiosity turns the boarding party greedy or slow\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Set salvage priorities before curiosity turns the boarding party greedy or slow\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Take only marked necessities",
              "Authorize one risky prize"
            ],
            "vignette": "Set salvage priorities before curiosity turns the boarding party greedy or slow."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "engineering-lore",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to strip useful fittings or leave unstable assemblies alone, then make the Engineer check for Salvage or Signal. Tell the table how the crew addresses this problem: Identify parts that can be cut free without collapsing the wreck's remaining structure.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Salvage or Signal turns \"Identify parts that can be cut free without collapsing the wreck's remaining structure\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Identify parts that can be cut free without collapsing the wreck's remaining structure\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Engineer cannot fully resolve \"Identify parts that can be cut free without collapsing the wreck's remaining structure\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Identify parts that can be cut free without collapsing the wreck's remaining structure\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Strip useful fittings",
              "Leave unstable assemblies alone"
            ],
            "vignette": "Identify parts that can be cut free without collapsing the wreck's remaining structure."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "arcana",
              "religion"
            ],
            "playerAction": "Choose whether to quench it under warding or bottle a harmless ember sample, then make the Veilwarden check for Salvage or Signal. Tell the table how the crew addresses this problem: Handle the witchlight lantern without letting its residue nest in the Lifeveil.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Salvage or Signal turns \"Handle the witchlight lantern without letting its residue nest in the Lifeveil\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Handle the witchlight lantern without letting its residue nest in the Lifeveil\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Veilwarden cannot fully resolve \"Handle the witchlight lantern without letting its residue nest in the Lifeveil\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Handle the witchlight lantern without letting its residue nest in the Lifeveil\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Quench it under warding",
              "Bottle a harmless ember sample"
            ],
            "vignette": "Handle the witchlight lantern without letting its residue nest in the Lifeveil."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival"
            ],
            "playerAction": "Choose whether to keep a hard perimeter or answer no voices alone, then make the Watchmaster check for Salvage or Signal. Tell the table how the crew addresses this problem: Guard the boarding party against false survivors, scavengers, or echoes wearing familiar voices.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Salvage or Signal turns \"Guard the boarding party against false survivors, scavengers, or echoes wearing familiar voices\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Guard the boarding party against false survivors, scavengers, or echoes wearing familiar voices\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Watchmaster cannot fully resolve \"Guard the boarding party against false survivors, scavengers, or echoes wearing familiar voices\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Guard the boarding party against false survivors, scavengers, or echoes wearing familiar voices\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Keep a hard perimeter",
              "Answer no voices alone"
            ],
            "vignette": "Guard the boarding party against false survivors, scavengers, or echoes wearing familiar voices."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The crew takes clean salvage and leaves the lantern's worst hunger sealed behind glass. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": 1,
                "label": "Recovered Supplies +1"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              }
            ]
          },
          "mixed": {
            "vignette": "Useful stores come aboard with a smell of cold wax and a few frightened stories. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": 1,
                "label": "Recovered Supplies +1"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The lantern flares during cutting, spoiling stores and sending the boarding party scrambling. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              },
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "A voice from the lantern names the ship and asks permission to come aboard. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              },
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: occult remnant invited by fear or misstep. No combat starts automatically."
          }
        }
      },
      {
        "round": 4,
        "title": "The Wreck Answers",
        "openingVignette": "The salvage comes away heavier than it should, as if the wreck dislikes being lighter. Lanternlight clings to crates, gloves, and breath in thin green threads. The derelict begins to roll away, but its bow remains pointed at the ship. This is the moment to leave with prizes, or learn why the dead light kept burning.",
        "activeStations": [
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to leave with what is secured or risk one last ordered pull, then make the Captain check for The Wreck Answers. Tell the table how the crew addresses this problem: Call the breakaway, final salvage grab, or hard retreat before the wreck decides for everyone.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during The Wreck Answers turns \"Call the breakaway, final salvage grab, or hard retreat before the wreck decides for everyone\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Call the breakaway, final salvage grab, or hard retreat before the wreck decides for everyone\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Captain cannot fully resolve \"Call the breakaway, final salvage grab, or hard retreat before the wreck decides for everyone\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Call the breakaway, final salvage grab, or hard retreat before the wreck decides for everyone\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Leave with what is secured",
              "Risk one last ordered pull"
            ],
            "vignette": "Call the breakaway, final salvage grab, or hard retreat before the wreck decides for everyone."
          },
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "society",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to back away cleanly or use the wreck as cover, then make the Navigator check for The Wreck Answers. Tell the table how the crew addresses this problem: Plot the escape vector through debris now drifting against natural current.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during The Wreck Answers turns \"Plot the escape vector through debris now drifting against natural current\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Plot the escape vector through debris now drifting against natural current\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Navigator cannot fully resolve \"Plot the escape vector through debris now drifting against natural current\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Plot the escape vector through debris now drifting against natural current\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Back away cleanly",
              "Use the wreck as cover"
            ],
            "vignette": "Plot the escape vector through debris now drifting against natural current."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "arcana"
            ],
            "playerAction": "Choose whether to controlled reverse thrust or emergency power through cold lines, then make the Engineer check for The Wreck Answers. Tell the table how the crew addresses this problem: Give the arkengine enough immediate response to tear free without overstraining it.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during The Wreck Answers turns \"Give the arkengine enough immediate response to tear free without overstraining it\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Give the arkengine enough immediate response to tear free without overstraining it\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Engineer cannot fully resolve \"Give the arkengine enough immediate response to tear free without overstraining it\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Give the arkengine enough immediate response to tear free without overstraining it\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Controlled reverse thrust",
              "Emergency power through cold lines"
            ],
            "vignette": "Give the arkengine enough immediate response to tear free without overstraining it."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "religion",
              "arcana"
            ],
            "playerAction": "Choose whether to sever the lantern echo or seal contaminated breath outside, then make the Veilwarden check for The Wreck Answers. Tell the table how the crew addresses this problem: Cut occult threads between ship, lantern, and crew memories.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during The Wreck Answers turns \"Cut occult threads between ship, lantern, and crew memories\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Cut occult threads between ship, lantern, and crew memories\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Veilwarden cannot fully resolve \"Cut occult threads between ship, lantern, and crew memories\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Cut occult threads between ship, lantern, and crew memories\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Sever the lantern echo",
              "Seal contaminated breath outside"
            ],
            "vignette": "Cut occult threads between ship, lantern, and crew memories."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival"
            ],
            "playerAction": "Choose whether to count all hands twice or watch the lantern until distance wins, then make the Watchmaster check for The Wreck Answers. Tell the table how the crew addresses this problem: Confirm nothing living, dead, or pretending crosses the lines unnoticed.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during The Wreck Answers turns \"Confirm nothing living, dead, or pretending crosses the lines unnoticed\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Confirm nothing living, dead, or pretending crosses the lines unnoticed\" well enough for the ship to keep its line through Derelict Lantern Wreck.",
              "failure": "Watchmaster cannot fully resolve \"Confirm nothing living, dead, or pretending crosses the lines unnoticed\", and Derelict Lantern Wreck leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Confirm nothing living, dead, or pretending crosses the lines unnoticed\", giving Derelict Lantern Wreck a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Count all hands twice",
              "Watch the lantern until distance wins"
            ],
            "vignette": "Confirm nothing living, dead, or pretending crosses the lines unnoticed."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The ship breaks away with salvage secured and the witchlight shrinking harmlessly astern. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": 1,
                "label": "Recovered Supplies +1"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              }
            ]
          },
          "mixed": {
            "vignette": "The crew escapes with useful salvage, but the lantern burns in too many dreams that night. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": 1,
                "label": "Recovered Supplies +1"
              },
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The wreck keeps part of the prize and leaves the crew with contaminated rope, shaken hands, and fewer answers. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: something marked the ship during departure. No combat starts automatically."
          },
          "catastrophicFailure": {
            "vignette": "The lantern goes out only after a second light appears somewhere inside the living ship. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -2,
                "label": "Lifeveil -2"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: lantern-haunt, hidden stowaway, or possessed salvage. No combat starts automatically."
          }
        }
      }
    ],
    "finalOutcomes": {
      "majorVictory": {
        "label": "Major Victory",
        "vignette": "The wreck becomes a clean discovery: salvage aboard, lantern mystery contained, and a haunted coordinate marked for future stories. The crew carries away more than survival: they carry a story that can steady future watches. Let this outcome feel like earned mastery rather than simple escape.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": 2,
            "label": "Recovered Supplies +2"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": 1,
            "label": "Morale +1"
          }
        ],
        "rewards": [
          "Clean salvage",
          "Witchlight notes",
          "Derelict route marker"
        ],
        "losses": []
      },
      "victory": {
        "label": "Victory",
        "vignette": "The crew leaves richer in supplies and caution, with the lantern's echo fading behind them. The voyage continues with the crew tired, alert, and proud enough to keep moving. Any scars become useful lessons instead of open wounds.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": 1,
            "label": "Recovered Supplies +1"
          }
        ],
        "rewards": [
          "Useful salvage",
          "Occult clue"
        ],
        "losses": []
      },
      "costlySuccess": {
        "label": "Costly Success",
        "vignette": "The salvage is real, but so is the contamination riding home in wax-smoke and nervous glances. The ship is safe enough to continue, but the cost should be visible in stores, watches, or repair lists. Give the players a moment to name what they sacrificed to pass through Lantern Wreck.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": 1,
            "label": "Recovered Supplies +1"
          },
          {
            "type": "resource",
            "resource": "lifeveil",
            "mode": "add",
            "value": -1,
            "label": "Lifeveil -1"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -1,
            "label": "Morale -1"
          }
        ],
        "rewards": [
          "Risky salvage"
        ],
        "losses": [
          "Lifeveil contamination",
          "Crew unease"
        ]
      },
      "failure": {
        "label": "Failure",
        "vignette": "The wreck gives up little and leaves the ship marked by a lantern that remembers its name. The ship moves on, but Lantern Wreck leaves a hook the GM can show later if useful. Keep the consequence concrete without forcing an immediate encounter.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "lifeveil",
            "mode": "add",
            "value": -1,
            "label": "Lifeveil -1"
          },
          {
            "type": "resource",
            "resource": "strain",
            "mode": "add",
            "value": 1,
            "label": "Strain +1"
          }
        ],
        "rewards": [],
        "losses": [
          "Lost salvage",
          "Occult attention"
        ],
        "combatHandoff": true,
        "handoffNotes": "Possible later threat handoff from marked salvage or a lantern echo. No combat starts automatically."
      },
      "catastrophicFailure": {
        "label": "Catastrophic Failure",
        "vignette": "The derelict keeps its best secrets and sends a worse one aboard in the Lifeveil's shadow. Survival is real, but nobody aboard mistakes it for victory. The GM can turn the handoff notes into future pressure while keeping this event complete.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "lifeveil",
            "mode": "add",
            "value": -2,
            "label": "Lifeveil -2"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -2,
            "label": "Morale -2"
          },
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": -1,
            "label": "Supplies -1"
          }
        ],
        "rewards": [],
        "losses": [
          "Severe contamination",
          "Spoiled salvage",
          "Haunted crew"
        ],
        "combatHandoff": true,
        "handoffNotes": "Possible later threat handoff: lantern-haunt, false survivor, or possessed salvage. No combat starts automatically."
      }
    },
    "rewards": [
      "Salvage",
      "Occult clues",
      "Discovery marker"
    ],
    "futureAutomationNotes": [
      "Keep salvage and threat results data-only until later content architecture exists.",
      "Use combatHandoff metadata only as GM-facing context; never auto-launch combat."
    ]
  },
  "crew-fever-in-the-lifeveil": {
    "key": "crew-fever-in-the-lifeveil",
    "name": "Crew Fever in the Lifeveil",
    "category": "shipboard",
    "tags": [
      "shipboard",
      "lifeveil",
      "morale",
      "supplies",
      "crewPressure",
      "occult",
      "resourcePressure"
    ],
    "roundCount": 4,
    "baseDC": 18,
    "activeResources": [
      "lifeveil",
      "morale",
      "supplies",
      "strain"
    ],
    "travelStations": [
      "navigator",
      "engineer",
      "veilwarden",
      "watchmaster",
      "captain"
    ],
    "description": "A strange fever moves through the voidship by way of breath, rumor, and Lifeveil echo. The sickness carries shared dreams, stale air, and emotional static from bunk to bunk until ordinary fatigue feels like haunting. The crew can survive it, but only if discipline, care, and warding hold together while the airskin keeps flowing.",
    "gmSummary": "Run this as a four-round shipboard crisis using only the Travel Five; do not add a new medical station or new resource rules. Frame checks around recognition, quarantine, fever-dreams, and the final purge. Proposed effects represent morale, supplies, strain, and Lifeveil pressure for later GM review.",
    "rounds": [
      {
        "round": 1,
        "title": "First Coughs",
        "openingVignette": "The first cough sounds ordinary until three decks answer it in the same exhausted rhythm. A cook drops a ladle, whispers a name no one has spoken in years, and cannot remember saying it. The Lifeveil exhales warm and stale through vents that were clean at dawn. Hammocks creak as crew sit up with the same dream fading from their eyes. The ship is not under attack from outside, which somehow makes the danger feel closer.",
        "activeStations": [
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "medicine",
              "society"
            ],
            "playerAction": "Choose whether to map the sick bunks or quiet the rumor chain, then make the Watchmaster check for First Coughs. Tell the table how the crew addresses this problem: Notice symptoms, rumor spread, and which crew are hiding weakness from their watches.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during First Coughs turns \"Notice symptoms, rumor spread, and which crew are hiding weakness from their watches\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Notice symptoms, rumor spread, and which crew are hiding weakness from their watches\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Watchmaster cannot fully resolve \"Notice symptoms, rumor spread, and which crew are hiding weakness from their watches\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Notice symptoms, rumor spread, and which crew are hiding weakness from their watches\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Map the sick bunks",
              "Quiet the rumor chain"
            ],
            "vignette": "Notice symptoms, rumor spread, and which crew are hiding weakness from their watches."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "medicine",
              "religion"
            ],
            "playerAction": "Choose whether to listen to the veil's echoes or seal the worst draft, then make the Veilwarden check for First Coughs. Tell the table how the crew addresses this problem: Sense psychic static and stale breath cycling through the Lifeveil.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during First Coughs turns \"Sense psychic static and stale breath cycling through the Lifeveil\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Sense psychic static and stale breath cycling through the Lifeveil\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Veilwarden cannot fully resolve \"Sense psychic static and stale breath cycling through the Lifeveil\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Sense psychic static and stale breath cycling through the Lifeveil\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Listen to the veil's echoes",
              "Seal the worst draft"
            ],
            "vignette": "Sense psychic static and stale breath cycling through the Lifeveil."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to address the crew plainly or restrict unnecessary movement, then make the Captain check for First Coughs. Tell the table how the crew addresses this problem: Keep order before fear turns every cough into accusation.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during First Coughs turns \"Keep order before fear turns every cough into accusation\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Keep order before fear turns every cough into accusation\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Captain cannot fully resolve \"Keep order before fear turns every cough into accusation\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Keep order before fear turns every cough into accusation\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Address the crew plainly",
              "Restrict unnecessary movement"
            ],
            "vignette": "Keep order before fear turns every cough into accusation."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "engineering-lore",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to open inspection panels or keep airflow conservative, then make the Engineer check for First Coughs. Tell the table how the crew addresses this problem: Check circulation, vents, and Lifeveil interfaces for stagnant loops.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during First Coughs turns \"Check circulation, vents, and Lifeveil interfaces for stagnant loops\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Check circulation, vents, and Lifeveil interfaces for stagnant loops\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Engineer cannot fully resolve \"Check circulation, vents, and Lifeveil interfaces for stagnant loops\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Check circulation, vents, and Lifeveil interfaces for stagnant loops\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Open inspection panels",
              "Keep airflow conservative"
            ],
            "vignette": "Check circulation, vents, and Lifeveil interfaces for stagnant loops."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The fever is identified early, before panic can become another symptom. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.veilwarden.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Veilwarden DC -1"
              }
            ]
          },
          "mixed": {
            "vignette": "The crew understands the danger, but fear moves faster than the orders. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "Stale Lifeveil flow carries fever-dream whispers into crowded bunks. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "A dozen crew wake from the same dream and accuse the ship of breathing with someone else's lungs. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              },
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              }
            ],
            "nextRoundNotes": "The crisis now includes panic and shared hallucination."
          }
        }
      },
      {
        "round": 2,
        "title": "Quarantine Lines",
        "openingVignette": "Hammocks become borders, mess tables become infirmary benches, and every closed hatch sounds too final. Chalk marks, ward knots, and strips of clean cloth divide the ship into smaller, frightened countries. The healthy move carefully around the sick, afraid of seeming cruel and afraid of breathing too near. The fever presses hardest where discipline must look like mercy.",
        "activeStations": [
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to rotate rested hands or make strict lines public, then make the Captain check for Quarantine Lines. Tell the table how the crew addresses this problem: Assign watches, isolate bunks, and make quarantine feel like duty rather than punishment.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Quarantine Lines turns \"Assign watches, isolate bunks, and make quarantine feel like duty rather than punishment\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Assign watches, isolate bunks, and make quarantine feel like duty rather than punishment\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Captain cannot fully resolve \"Assign watches, isolate bunks, and make quarantine feel like duty rather than punishment\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Assign watches, isolate bunks, and make quarantine feel like duty rather than punishment\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Rotate rested hands",
              "Make strict lines public"
            ],
            "vignette": "Assign watches, isolate bunks, and make quarantine feel like duty rather than punishment."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "arcana"
            ],
            "playerAction": "Choose whether to build a slow clean loop or attempt a faster bypass, then make the Engineer check for Quarantine Lines. Tell the table how the crew addresses this problem: Reroute airskin and Lifeveil flow around sick compartments without starving the rest of the ship.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Quarantine Lines turns \"Reroute airskin and Lifeveil flow around sick compartments without starving the rest of the ship\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Reroute airskin and Lifeveil flow around sick compartments without starving the rest of the ship\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Engineer cannot fully resolve \"Reroute airskin and Lifeveil flow around sick compartments without starving the rest of the ship\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Reroute airskin and Lifeveil flow around sick compartments without starving the rest of the ship\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Build a slow clean loop",
              "Attempt a faster bypass"
            ],
            "vignette": "Reroute airskin and Lifeveil flow around sick compartments without starving the rest of the ship."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "medicine",
              "arcana"
            ],
            "playerAction": "Choose whether to burn clean incense through wards or draw residue into a sealed charm, then make the Veilwarden check for Quarantine Lines. Tell the table how the crew addresses this problem: Purge occult residue from the quarantine boundary.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Quarantine Lines turns \"Purge occult residue from the quarantine boundary\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Purge occult residue from the quarantine boundary\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Veilwarden cannot fully resolve \"Purge occult residue from the quarantine boundary\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Purge occult residue from the quarantine boundary\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Burn clean incense through wards",
              "Draw residue into a sealed charm"
            ],
            "vignette": "Purge occult residue from the quarantine boundary."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival"
            ],
            "playerAction": "Choose whether to check watches personally or pair sickbay runners, then make the Watchmaster check for Quarantine Lines. Tell the table how the crew addresses this problem: Find who is worsening, who is hiding symptoms, and who is using fear as cover for disobedience.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Quarantine Lines turns \"Find who is worsening, who is hiding symptoms, and who is using fear as cover for disobedience\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Find who is worsening, who is hiding symptoms, and who is using fear as cover for disobedience\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Watchmaster cannot fully resolve \"Find who is worsening, who is hiding symptoms, and who is using fear as cover for disobedience\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Find who is worsening, who is hiding symptoms, and who is using fear as cover for disobedience\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Check watches personally",
              "Pair sickbay runners"
            ],
            "vignette": "Find who is worsening, who is hiding symptoms, and who is using fear as cover for disobedience."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The quarantine holds as a shared discipline, not a sentence. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              }
            ]
          },
          "mixed": {
            "vignette": "The lines hold, but clean wraps, broth, and warding supplies disappear quickly. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "A rerouted loop backwashes fever-dream breath through the lower deck. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "Quarantine breaks for one frightened minute, long enough for the fever to learn new voices. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              },
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ],
            "nextRoundNotes": "Fever dreams should feel more personal and harder to dismiss."
          }
        }
      },
      {
        "round": 3,
        "title": "Fever Dreams",
        "openingVignette": "Crew on different decks describe the same impossible starfield and the same child calling from beneath the gravity plane. The Lifeveil carries the dream in pulses, turning familiar corridors briefly strange. Sleep becomes dangerous, but exhaustion makes cowards of the strongest hands. The ship must stay on course through the void while its people doubt the evidence of their own senses.",
        "activeStations": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "occultism",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to anchor to instruments or anchor to repeated call-and-response, then make the Navigator check for Fever Dreams. Tell the table how the crew addresses this problem: Keep the ship oriented while shared hallucinations make course, horizon, and memory unreliable.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Fever Dreams turns \"Keep the ship oriented while shared hallucinations make course, horizon, and memory unreliable\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Keep the ship oriented while shared hallucinations make course, horizon, and memory unreliable\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Navigator cannot fully resolve \"Keep the ship oriented while shared hallucinations make course, horizon, and memory unreliable\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Keep the ship oriented while shared hallucinations make course, horizon, and memory unreliable\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Anchor to instruments",
              "Anchor to repeated call-and-response"
            ],
            "vignette": "Keep the ship oriented while shared hallucinations make course, horizon, and memory unreliable."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "religion",
              "medicine"
            ],
            "playerAction": "Choose whether to name the echo or draw it into a warded circuit, then make the Veilwarden check for Fever Dreams. Tell the table how the crew addresses this problem: Confront the psychic fever where it knots inside the Lifeveil.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Fever Dreams turns \"Confront the psychic fever where it knots inside the Lifeveil\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Confront the psychic fever where it knots inside the Lifeveil\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Veilwarden cannot fully resolve \"Confront the psychic fever where it knots inside the Lifeveil\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Confront the psychic fever where it knots inside the Lifeveil\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Name the echo",
              "Draw it into a warded circuit"
            ],
            "vignette": "Confront the psychic fever where it knots inside the Lifeveil."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to offer a steady speech or separate the loudest panic, then make the Captain check for Fever Dreams. Tell the table how the crew addresses this problem: Calm or discipline crew who are seeing ghosts in officers, friends, and empty corners.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Fever Dreams turns \"Calm or discipline crew who are seeing ghosts in officers, friends, and empty corners\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Calm or discipline crew who are seeing ghosts in officers, friends, and empty corners\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Captain cannot fully resolve \"Calm or discipline crew who are seeing ghosts in officers, friends, and empty corners\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Calm or discipline crew who are seeing ghosts in officers, friends, and empty corners\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Offer a steady speech",
              "Separate the loudest panic"
            ],
            "vignette": "Calm or discipline crew who are seeing ghosts in officers, friends, and empty corners."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival"
            ],
            "playerAction": "Choose whether to double critical watches or remove dangerous tools from sick bunks, then make the Watchmaster check for Fever Dreams. Tell the table how the crew addresses this problem: Prevent fever-drunk mistakes around hatches, lines, stores, and tools.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Fever Dreams turns \"Prevent fever-drunk mistakes around hatches, lines, stores, and tools\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Prevent fever-drunk mistakes around hatches, lines, stores, and tools\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Watchmaster cannot fully resolve \"Prevent fever-drunk mistakes around hatches, lines, stores, and tools\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Prevent fever-drunk mistakes around hatches, lines, stores, and tools\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Double critical watches",
              "Remove dangerous tools from sick bunks"
            ],
            "vignette": "Prevent fever-drunk mistakes around hatches, lines, stores, and tools."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The crew names the dreams as fever, and naming them takes away much of their teeth. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              },
              {
                "type": "modifier",
                "target": "nextRound.all.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Round All DC -1"
              }
            ]
          },
          "mixed": {
            "vignette": "The ship stays on course, though sleep becomes rationed and bitter. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The fever bends familiar voices into commands, and not every hand resists at once. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              },
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "For a breathless span, the crew sees the same officer wearing a dead stranger's face. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -2,
                "label": "Lifeveil -2"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ],
            "handoffNotes": "Possible later threat note: hallucination-driven violence or possessed crew suspicion if the GM wants to escalate later. No combat starts automatically."
          }
        }
      },
      {
        "round": 4,
        "title": "Break the Fever",
        "openingVignette": "The Lifeveil exhales in ragged pulses, and the whole ship waits to learn whether the next breath will be clean. Warding bowls steam at hatchways, and sick crew clutch cups of broth like anchors. The fever has grown quiet enough to sound thoughtful. Breaking it now means choosing care over panic while the ship itself seems to shiver.",
        "activeStations": [
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "medicine",
              "religion"
            ],
            "playerAction": "Choose whether to slow cleansing rite or dangerous emergency venting, then make the Veilwarden check for Break the Fever. Tell the table how the crew addresses this problem: Perform the final purge without tearing healthy breath away with the fever.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Break the Fever turns \"Perform the final purge without tearing healthy breath away with the fever\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Perform the final purge without tearing healthy breath away with the fever\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Veilwarden cannot fully resolve \"Perform the final purge without tearing healthy breath away with the fever\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Perform the final purge without tearing healthy breath away with the fever\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Slow cleansing rite",
              "Dangerous emergency venting"
            ],
            "vignette": "Perform the final purge without tearing healthy breath away with the fever."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "arcana"
            ],
            "playerAction": "Choose whether to protect the engine from backwash or shunt pressure through reserve lines, then make the Engineer check for Break the Fever. Tell the table how the crew addresses this problem: Support the purge with controlled rerouting, pressure relief, and emergency cutoffs.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Break the Fever turns \"Support the purge with controlled rerouting, pressure relief, and emergency cutoffs\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Support the purge with controlled rerouting, pressure relief, and emergency cutoffs\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Engineer cannot fully resolve \"Support the purge with controlled rerouting, pressure relief, and emergency cutoffs\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Support the purge with controlled rerouting, pressure relief, and emergency cutoffs\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Protect the engine from backwash",
              "Shunt pressure through reserve lines"
            ],
            "vignette": "Support the purge with controlled rerouting, pressure relief, and emergency cutoffs."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to promise rest after purge or command silence during venting, then make the Captain check for Break the Fever. Tell the table how the crew addresses this problem: Hold the crew together with rest orders, reassurance, or hard discipline at the final crisis point.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Break the Fever turns \"Hold the crew together with rest orders, reassurance, or hard discipline at the final crisis point\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Hold the crew together with rest orders, reassurance, or hard discipline at the final crisis point\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Captain cannot fully resolve \"Hold the crew together with rest orders, reassurance, or hard discipline at the final crisis point\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Hold the crew together with rest orders, reassurance, or hard discipline at the final crisis point\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Promise rest after purge",
              "Command silence during venting"
            ],
            "vignette": "Hold the crew together with rest orders, reassurance, or hard discipline at the final crisis point."
          },
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "society",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to maintain a simple heading or steer by instrument alone, then make the Navigator check for Break the Fever. Tell the table how the crew addresses this problem: Keep the ship steady through disorienting breath, pressure, and dream-static.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Break the Fever turns \"Keep the ship steady through disorienting breath, pressure, and dream-static\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Keep the ship steady through disorienting breath, pressure, and dream-static\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Navigator cannot fully resolve \"Keep the ship steady through disorienting breath, pressure, and dream-static\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Keep the ship steady through disorienting breath, pressure, and dream-static\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Maintain a simple heading",
              "Steer by instrument alone"
            ],
            "vignette": "Keep the ship steady through disorienting breath, pressure, and dream-static."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival"
            ],
            "playerAction": "Choose whether to post sober pairs or guard stores and hatches, then make the Watchmaster check for Break the Fever. Tell the table how the crew addresses this problem: Catch the last dangerous mistakes before fever, exhaustion, or panic turns them costly.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Break the Fever turns \"Catch the last dangerous mistakes before fever, exhaustion, or panic turns them costly\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Catch the last dangerous mistakes before fever, exhaustion, or panic turns them costly\" well enough for the ship to keep its line through Crew Fever in the Lifeveil.",
              "failure": "Watchmaster cannot fully resolve \"Catch the last dangerous mistakes before fever, exhaustion, or panic turns them costly\", and Crew Fever in the Lifeveil leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Catch the last dangerous mistakes before fever, exhaustion, or panic turns them costly\", giving Crew Fever in the Lifeveil a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Post sober pairs",
              "Guard stores and hatches"
            ],
            "vignette": "Catch the last dangerous mistakes before fever, exhaustion, or panic turns them costly."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The fever breaks in one long, foul exhale, leaving the crew weak but grateful. The crew can feel the ship answer with cleaner motion.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": 1,
                "label": "Lifeveil +1"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              }
            ]
          },
          "mixed": {
            "vignette": "The fever breaks, but the cure consumes stores and leaves everyone hollow-eyed. The ship remains in the event, but the price is plain enough for every deck to notice.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The fever retreats into corners of the Lifeveil that will need days of careful cleaning. Orders still work, but they arrive under pressure and with less room for mercy.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "Emergency venting saves breath but tears through morale, stores, and the ship's trust in its own air. The moment should land like a bell through the whole vessel.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -2,
                "label": "Lifeveil -2"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ],
            "handoffNotes": "Possible later threat note: a fever echo may linger in one crew member. No combat starts automatically."
          }
        }
      }
    ],
    "finalOutcomes": {
      "majorVictory": {
        "label": "Major Victory",
        "vignette": "The fever is purged cleanly, and the crew turns a shared crisis into confidence in ship and Lifeveil. The crew carries away more than survival: they carry a story that can steady future watches. Let this outcome feel like earned mastery rather than simple escape.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "lifeveil",
            "mode": "add",
            "value": 1,
            "label": "Lifeveil +1"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": 2,
            "label": "Morale +2"
          }
        ],
        "rewards": [
          "Crew confidence",
          "Clean Lifeveil flow"
        ],
        "losses": []
      },
      "victory": {
        "label": "Victory",
        "vignette": "The fever breaks with manageable costs, leaving the crew tired but steady. The voyage continues with the crew tired, alert, and proud enough to keep moving. Any scars become useful lessons instead of open wounds.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": 1,
            "label": "Morale +1"
          }
        ],
        "rewards": [
          "Stabilized crew",
          "Contained Lifeveil fever"
        ],
        "losses": []
      },
      "costlySuccess": {
        "label": "Costly Success",
        "vignette": "The crew recovers, but clean wraps, broth, warding salts, and emergency shifts are spent getting there. The ship is safe enough to continue, but the cost should be visible in stores, watches, or repair lists. Give the players a moment to name what they sacrificed to pass through Lifeveil Fever.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": -1,
            "label": "Supplies -1"
          },
          {
            "type": "resource",
            "resource": "strain",
            "mode": "add",
            "value": 1,
            "label": "Strain +1"
          }
        ],
        "rewards": [
          "Fever broken"
        ],
        "losses": [
          "Consumed supplies",
          "Engine rerouting wear"
        ]
      },
      "failure": {
        "label": "Failure",
        "vignette": "The fever passes unevenly, leaving stale dreams in the Lifeveil and distrust in crowded compartments. The ship moves on, but Lifeveil Fever leaves a hook the GM can show later if useful. Keep the consequence concrete without forcing an immediate encounter.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "lifeveil",
            "mode": "add",
            "value": -1,
            "label": "Lifeveil -1"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -1,
            "label": "Morale -1"
          },
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": -1,
            "label": "Supplies -1"
          }
        ],
        "rewards": [],
        "losses": [
          "Lingering Lifeveil sickness",
          "Crew distrust",
          "Consumed supplies"
        ]
      },
      "catastrophicFailure": {
        "label": "Catastrophic Failure",
        "vignette": "The fever is survived rather than cured, and one last shared dream watches the crew from behind their own eyes. Survival is real, but nobody aboard mistakes it for victory. The GM can turn the handoff notes into future pressure while keeping this event complete.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "lifeveil",
            "mode": "add",
            "value": -2,
            "label": "Lifeveil -2"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -2,
            "label": "Morale -2"
          },
          {
            "type": "resource",
            "resource": "strain",
            "mode": "add",
            "value": 1,
            "label": "Strain +1"
          },
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": -1,
            "label": "Supplies -1"
          }
        ],
        "rewards": [],
        "losses": [
          "Damaged Lifeveil",
          "Exhausted crew",
          "Emergency supplies consumed"
        ],
        "handoffNotes": "Possible later threat note: hallucination-driven violence or a possessed-crew scare at GM discretion. No combat starts automatically."
      }
    },
    "rewards": [
      "Stabilized crew",
      "Lifeveil crisis lessons"
    ],
    "futureAutomationNotes": [
      "Represent shipboard medical/occult pressure with existing Travel Five stations only.",
      "Keep all resource changes staged for explicit GM review."
    ]
  },
  "false-beacon-ambush": {
    "key": "false-beacon-ambush",
    "name": "False Beacon Ambush",
    "category": "threat",
    "tags": [
      "threat",
      "navigation",
      "ambush",
      "pursuit",
      "stealth",
      "combatHandoff",
      "resourcePressure",
      "environmental"
    ],
    "roundCount": 4,
    "baseDC": 20,
    "activeResources": [
      "strain",
      "lifeveil",
      "morale",
      "supplies",
      "hull"
    ],
    "travelStations": [
      "navigator",
      "engineer",
      "veilwarden",
      "watchmaster",
      "captain"
    ],
    "description": "A kind rescue-light blooms in the void, promising safe mooring, help, or a marked channel through danger. Its signal-magic cadence is almost right, but the shadows around it move with patient intent. The ship is being coaxed toward a kill lane of drifting wreckage, hidden raider vectors, and ward-hungry dark.",
    "gmSummary": "Run this as quiet tactical dread, not an automatic fight. The beacon may be raiders, an occult lure, a debris trap, or all three depending on what best fits the voyage. Severe results provide combatHandoff metadata only, leaving any later encounter fully at GM discretion.",
    "rounds": [
      {
        "round": 1,
        "title": "The Beacon Calls",
        "openingVignette": "A pale blue rescue flare opens ahead like a saint's eye in the dark. It repeats a lawful voidport cadence, then stutters once on a note no dock-ring bell should know. The void around it is too still, and even loose chains seem to listen. Far beyond the light, broken spars drift in a pattern that might be chance or teeth. The crew wants the signal to be true because a friendly light in the black is a hard mercy to refuse.",
        "activeStations": [
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival",
              "warfare-lore"
            ],
            "playerAction": "Choose whether to post silent lookouts or challenge the signal openly, then make the Watchmaster check for The Beacon Calls. Tell the table how the crew addresses this problem: Spyglasses catch glints moving where no honest escort should be. The beacon hides more darkness than it reveals.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during The Beacon Calls turns \"Spyglasses catch glints moving where no honest escort should be. The beacon hides more darkness than it reveals\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Spyglasses catch glints moving where no honest escort should be. The beacon hides more darkness than it reveals\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Watchmaster cannot fully resolve \"Spyglasses catch glints moving where no honest escort should be. The beacon hides more darkness than it reveals\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Spyglasses catch glints moving where no honest escort should be. The beacon hides more darkness than it reveals\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Post silent lookouts",
              "Challenge the signal openly"
            ],
            "vignette": "Spyglasses catch glints moving where no honest escort should be. The beacon hides more darkness than it reveals."
          },
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "sailing-lore",
              "deception"
            ],
            "playerAction": "Choose whether to hold a wide spiral or feign a trusting approach, then make the Navigator check for The Beacon Calls. Tell the table how the crew addresses this problem: The beacon's bearing tugs at compass, chart, and instinct in three different directions.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during The Beacon Calls turns \"The beacon's bearing tugs at compass, chart, and instinct in three different directions\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"The beacon's bearing tugs at compass, chart, and instinct in three different directions\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Navigator cannot fully resolve \"The beacon's bearing tugs at compass, chart, and instinct in three different directions\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"The beacon's bearing tugs at compass, chart, and instinct in three different directions\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Hold a wide spiral",
              "Feign a trusting approach"
            ],
            "vignette": "The beacon's bearing tugs at compass, chart, and instinct in three different directions."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "religion",
              "arcana"
            ],
            "playerAction": "Choose whether to thicken the veil or let a thin thread taste the lure, then make the Veilwarden check for The Beacon Calls. Tell the table how the crew addresses this problem: The Lifeveil tastes ozone, warm iron, and a prayer repeated by no living throat.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during The Beacon Calls turns \"The Lifeveil tastes ozone, warm iron, and a prayer repeated by no living throat\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"The Lifeveil tastes ozone, warm iron, and a prayer repeated by no living throat\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Veilwarden cannot fully resolve \"The Lifeveil tastes ozone, warm iron, and a prayer repeated by no living throat\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"The Lifeveil tastes ozone, warm iron, and a prayer repeated by no living throat\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Thicken the veil",
              "Let a thin thread taste the lure"
            ],
            "vignette": "The Lifeveil tastes ozone, warm iron, and a prayer repeated by no living throat."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to rally disciplined caution or keep weapons and ropes hidden, then make the Captain check for The Beacon Calls. Tell the table how the crew addresses this problem: Hope and suspicion divide the deck, and both can make sailors careless.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during The Beacon Calls turns \"Hope and suspicion divide the deck, and both can make sailors careless\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Hope and suspicion divide the deck, and both can make sailors careless\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Captain cannot fully resolve \"Hope and suspicion divide the deck, and both can make sailors careless\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Hope and suspicion divide the deck, and both can make sailors careless\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Rally disciplined caution",
              "Keep weapons and ropes hidden"
            ],
            "vignette": "Hope and suspicion divide the deck, and both can make sailors careless."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The ship answers the beacon without obeying it. Lookouts mark two hidden angles of approach, and the helm keeps enough room to refuse the trap. The false light burns a little harsher, as if irritated by caution.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.watchmaster.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Watchmaster DC -1"
              }
            ],
            "nextRoundNotes": "The crew has identified the trap's first edge."
          },
          "mixed": {
            "vignette": "The ship stays wary, but the beacon wins a few precious lengths of distance. Crew whisper about survivors while officers quietly count blind spots. The trap is not sprung yet, but it knows the ship is listening.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The beacon's cadence catches the helm at the wrong moment. The ship drifts closer to a lane of cold wreckage and tethered stone. Somewhere beyond the light, something shutters a lantern.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ],
            "nextRoundNotes": "Begin narrowing the ship's safe choices."
          },
          "catastrophicFailure": {
            "vignette": "A desperate voice breaks across the signal using the ship's own name. Hands move before orders catch them, and the bow swings toward the waiting dark. The ambushers, whatever they are, have learned the crew's kindness.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              },
              {
                "type": "modifier",
                "target": "nextRound.navigator.dc",
                "mode": "add",
                "value": 2,
                "label": "Next Navigator DC +2"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: hidden raiders or a beacon-haunt using the ship's name. No combat starts automatically."
          }
        }
      },
      {
        "round": 2,
        "title": "Course Correction",
        "openingVignette": "The beacon slides sideways without crossing the void between. Debris that seemed scattered now shows lanes, gaps, and murder-holes. A red spark winks behind a ruined mast and vanishes when watched directly. The ship can still break away, but doing so will scrape pride, speed, or steel.",
        "activeStations": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "sailing-lore",
              "occultism"
            ],
            "playerAction": "Choose whether to cut across the current or backtrack through debris, then make the Navigator check for Course Correction. Tell the table how the crew addresses this problem: Every safe route bends back toward the beacon unless someone names the trick.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Course Correction turns \"Every safe route bends back toward the beacon unless someone names the trick\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Every safe route bends back toward the beacon unless someone names the trick\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Navigator cannot fully resolve \"Every safe route bends back toward the beacon unless someone names the trick\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Every safe route bends back toward the beacon unless someone names the trick\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Cut across the current",
              "Backtrack through debris"
            ],
            "vignette": "Every safe route bends back toward the beacon unless someone names the trick."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "engineering-lore",
              "sailing-lore"
            ],
            "playerAction": "Choose whether to bleed pressure carefully or force a quick turn, then make the Engineer check for Course Correction. Tell the table how the crew addresses this problem: The arkengine shudders as the ship asks for a hard turn through fouled current.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Course Correction turns \"The arkengine shudders as the ship asks for a hard turn through fouled current\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"The arkengine shudders as the ship asks for a hard turn through fouled current\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Engineer cannot fully resolve \"The arkengine shudders as the ship asks for a hard turn through fouled current\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"The arkengine shudders as the ship asks for a hard turn through fouled current\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Bleed pressure carefully",
              "Force a quick turn"
            ],
            "vignette": "The arkengine shudders as the ship asks for a hard turn through fouled current.",
            "dcModifier": 1
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "stealth",
              "warfare-lore"
            ],
            "playerAction": "Choose whether to mark fire lanes or keep all lamps shuttered, then make the Watchmaster check for Course Correction. Tell the table how the crew addresses this problem: Wreckage forms screens where patient enemies could wait with hooks, bolts, or worse.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Course Correction turns \"Wreckage forms screens where patient enemies could wait with hooks, bolts, or worse\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Wreckage forms screens where patient enemies could wait with hooks, bolts, or worse\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Watchmaster cannot fully resolve \"Wreckage forms screens where patient enemies could wait with hooks, bolts, or worse\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Wreckage forms screens where patient enemies could wait with hooks, bolts, or worse\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Mark fire lanes",
              "Keep all lamps shuttered"
            ],
            "vignette": "Wreckage forms screens where patient enemies could wait with hooks, bolts, or worse."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "warfare-lore"
            ],
            "playerAction": "Choose whether to order battle readiness or keep rescue pretense alive, then make the Captain check for Course Correction. Tell the table how the crew addresses this problem: The deck needs one will now, not five frightened guesses.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Course Correction turns \"The deck needs one will now, not five frightened guesses\" into a clear advantage for the crew.",
              "success": "Captain resolves \"The deck needs one will now, not five frightened guesses\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Captain cannot fully resolve \"The deck needs one will now, not five frightened guesses\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"The deck needs one will now, not five frightened guesses\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Order battle readiness",
              "Keep rescue pretense alive"
            ],
            "vignette": "The deck needs one will now, not five frightened guesses."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The ship shears away from the beacon's preferred path. A concealed anchor-chain snaps taut behind the stern and misses by a blessed span. The crew sees the trap clearly now, and fear sharpens into purpose.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              }
            ]
          },
          "mixed": {
            "vignette": "The turn succeeds, but not cleanly. Debris scrapes along the hull, and the arkengine coughs sparks into its housings. The beacon follows with a softer, uglier pulse.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -1,
                "label": "Hull -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The correction comes late, and the trap adjusts with it. Dark shapes move behind wreckage in disciplined silence. The ship is not captured, but its escape lane is narrowing fast.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.all.dc",
                "mode": "add",
                "value": 1,
                "label": "Next Round All DC +1"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: disciplined raider pursuit or occult debris net. No combat starts automatically."
          },
          "catastrophicFailure": {
            "vignette": "The ship turns directly into a ghost-net of cable, bone-white buoys, and dead lanterns. Hooks bite and tear free, leaving the hull ringing like a struck bell. Behind the beacon, several hidden lights open at once.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -2,
                "label": "Hull -2"
              },
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: boarding attempt, pursuit, or a snare-spirit clinging to the hull. No combat starts automatically."
          }
        }
      },
      {
        "round": 3,
        "title": "The Net Tightens",
        "openingVignette": "The false beacon falls behind, yet its light reflects ahead on shards of spellglass and frozen dust. The ship is inside the prepared debris lane now. Soft impacts tap the hull from beneath the gravity plane as if unseen hands are counting ribs. Far astern, masked lamps begin to follow along hidden raider vectors.",
        "activeStations": [
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "engineering-lore",
              "stealth"
            ],
            "playerAction": "Choose whether to run quiet and cool or burn hard through the lane, then make the Engineer check for The Net Tightens. Tell the table how the crew addresses this problem: The arkengine must answer without roaring loudly enough to guide pursuit.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during The Net Tightens turns \"The arkengine must answer without roaring loudly enough to guide pursuit\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"The arkengine must answer without roaring loudly enough to guide pursuit\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Engineer cannot fully resolve \"The arkengine must answer without roaring loudly enough to guide pursuit\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"The arkengine must answer without roaring loudly enough to guide pursuit\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Run quiet and cool",
              "Burn hard through the lane"
            ],
            "vignette": "The arkengine must answer without roaring loudly enough to guide pursuit."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "religion",
              "arcana"
            ],
            "playerAction": "Choose whether to mask the veil or throw a false echo, then make the Veilwarden check for The Net Tightens. Tell the table how the crew addresses this problem: The Lifeveil catches little hooked prayers cast from the dark.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during The Net Tightens turns \"The Lifeveil catches little hooked prayers cast from the dark\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"The Lifeveil catches little hooked prayers cast from the dark\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Veilwarden cannot fully resolve \"The Lifeveil catches little hooked prayers cast from the dark\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"The Lifeveil catches little hooked prayers cast from the dark\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Mask the veil",
              "Throw a false echo"
            ],
            "vignette": "The Lifeveil catches little hooked prayers cast from the dark."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "survival",
              "warfare-lore"
            ],
            "playerAction": "Choose whether to track the lead lamp or watch for the silent flanker, then make the Watchmaster check for The Net Tightens. Tell the table how the crew addresses this problem: Pursuers move without haste because they believe the lane has already won.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during The Net Tightens turns \"Pursuers move without haste because they believe the lane has already won\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Pursuers move without haste because they believe the lane has already won\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Watchmaster cannot fully resolve \"Pursuers move without haste because they believe the lane has already won\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Pursuers move without haste because they believe the lane has already won\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Track the lead lamp",
              "Watch for the silent flanker"
            ],
            "vignette": "Pursuers move without haste because they believe the lane has already won.",
            "dcModifier": 1
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "performance"
            ],
            "playerAction": "Choose whether to promise clean escape or make every station report, then make the Captain check for The Net Tightens. Tell the table how the crew addresses this problem: The crew needs permission to be afraid without permission to break.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during The Net Tightens turns \"The crew needs permission to be afraid without permission to break\" into a clear advantage for the crew.",
              "success": "Captain resolves \"The crew needs permission to be afraid without permission to break\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Captain cannot fully resolve \"The crew needs permission to be afraid without permission to break\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"The crew needs permission to be afraid without permission to break\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Promise clean escape",
              "Make every station report"
            ],
            "vignette": "The crew needs permission to be afraid without permission to break."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The ship slips through the tightening lane like a blade through silk. A false wake blooms behind it, drawing pursuit into the wrong channel. For one round of heartbeats, the crew hears the ambushers curse the dark.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.all.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Round All DC -1"
              }
            ]
          },
          "mixed": {
            "vignette": "The ship stays ahead, but the effort eats fuel, rope, and careful stores. Crew move with grim efficiency while quartermasters wince at every emergency cut. The beacon's glow thins but does not die.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The net tightens across the ship's stern and drags at the Lifeveil like hooked wool. Pursuers gain enough ground for the crew to see painted masks and hungry steel. Escape remains possible, but clean escape does not.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -1,
                "label": "Lifeveil -1"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ],
            "combatHandoff": true
          },
          "catastrophicFailure": {
            "vignette": "A hidden strike lands from the blind side and throws the deck into a storm of splinters. The false beacon flares in triumph, painting every face corpse-blue. Whatever waits beyond the lane now knows the ship can bleed.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -2,
                "label": "Hull -2"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: raider broadside, boarding crew, or predatory void thing. No combat starts automatically."
          }
        }
      },
      {
        "round": 4,
        "title": "Break the Kill Lane",
        "openingVignette": "A gap opens ahead where the debris thins and real stars return. The beacon screams behind the ship now, all kindness burned away. Pursuit, gravity shear, and wreckage converge in one final geometry of harm. The next decision decides whether the ship leaves as prey, quarry, or legend.",
        "activeStations": [
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "survival",
              "sailing-lore",
              "acrobatics"
            ],
            "playerAction": "Choose whether to thread the bright gap or cut through broken spars, then make the Navigator check for Break the Kill Lane. Tell the table how the crew addresses this problem: The last safe vector is narrow, bright, and vanishing.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Break the Kill Lane turns \"The last safe vector is narrow, bright, and vanishing\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"The last safe vector is narrow, bright, and vanishing\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Navigator cannot fully resolve \"The last safe vector is narrow, bright, and vanishing\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"The last safe vector is narrow, bright, and vanishing\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Thread the bright gap",
              "Cut through broken spars"
            ],
            "vignette": "The last safe vector is narrow, bright, and vanishing."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "engineering-lore",
              "athletics"
            ],
            "playerAction": "Choose whether to controlled surge or redline the housings, then make the Engineer check for Break the Kill Lane. Tell the table how the crew addresses this problem: The arkengine can give one more answer before heat and pressure demand payment.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Break the Kill Lane turns \"The arkengine can give one more answer before heat and pressure demand payment\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"The arkengine can give one more answer before heat and pressure demand payment\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Engineer cannot fully resolve \"The arkengine can give one more answer before heat and pressure demand payment\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"The arkengine can give one more answer before heat and pressure demand payment\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Controlled surge",
              "Redline the housings"
            ],
            "vignette": "The arkengine can give one more answer before heat and pressure demand payment."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "religion",
              "arcana"
            ],
            "playerAction": "Choose whether to ward the stern or burn the beacon's echo, then make the Veilwarden check for Break the Kill Lane. Tell the table how the crew addresses this problem: The false beacon hurls its last invitation like a hook at the ship's breath.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during Break the Kill Lane turns \"The false beacon hurls its last invitation like a hook at the ship's breath\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"The false beacon hurls its last invitation like a hook at the ship's breath\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Veilwarden cannot fully resolve \"The false beacon hurls its last invitation like a hook at the ship's breath\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"The false beacon hurls its last invitation like a hook at the ship's breath\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Ward the stern",
              "Burn the beacon's echo"
            ],
            "vignette": "The false beacon hurls its last invitation like a hook at the ship's breath."
          },
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "warfare-lore"
            ],
            "playerAction": "Choose whether to count the stations through or demand full commitment, then make the Captain check for Break the Kill Lane. Tell the table how the crew addresses this problem: Every station waits for a single word to become motion.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Break the Kill Lane turns \"Every station waits for a single word to become motion\" into a clear advantage for the crew.",
              "success": "Captain resolves \"Every station waits for a single word to become motion\" well enough for the ship to keep its line through False Beacon Ambush.",
              "failure": "Captain cannot fully resolve \"Every station waits for a single word to become motion\", and False Beacon Ambush leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"Every station waits for a single word to become motion\", giving False Beacon Ambush a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Count the stations through",
              "Demand full commitment"
            ],
            "vignette": "Every station waits for a single word to become motion."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The ship breaks the kill lane before the trap can close its fist. The false beacon gutters out behind them, briefly revealing the shape of a watching intelligence. By the time pursuit finds the true wake, the crew has already claimed the stars.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              }
            ]
          },
          "mixed": {
            "vignette": "The ship escapes the lane, but splinters, cut lines, and empty stores tell the price. The beacon fades to a sullen coal astern. No one mistakes mercy for safety now.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The ship claws free only after the lane marks it with damage and direction. A final lamp follows at the edge of sight for longer than comfort allows. The crew escapes, but the ambushers may not be finished with them.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -1,
                "label": "Hull -1"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: surviving pursuers with the ship's heading. No combat starts automatically."
          },
          "catastrophicFailure": {
            "vignette": "The kill lane closes across the stern like a jaw. The ship tears free, but only by leaving broken timber, spilled stores, and a bright piece of its Lifeveil behind. The false beacon goes dark as if satisfied.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "hull",
                "mode": "add",
                "value": -2,
                "label": "Hull -2"
              },
              {
                "type": "resource",
                "resource": "lifeveil",
                "mode": "add",
                "value": -2,
                "label": "Lifeveil -2"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ],
            "combatHandoff": true,
            "handoffNotes": "Possible later threat: an enemy that owns a fragment of the ship's wake or veil. No combat starts automatically."
          }
        }
      }
    ],
    "finalOutcomes": {
      "majorVictory": {
        "label": "Major Victory",
        "vignette": "The ship exposes the false beacon and escapes with its wake hidden. The crew learns the shape of the trap well enough to warn others or turn the knowledge into leverage. What tried to make them prey must now reckon with sailors who survived its favorite trick. The stars ahead feel colder, but honestly earned.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": 2,
            "label": "Morale +2"
          }
        ],
        "rewards": [
          "Ambush route intelligence",
          "Crew confidence"
        ],
        "losses": []
      },
      "victory": {
        "label": "Victory",
        "vignette": "The ship breaks free of the beacon's trap with discipline and a few new scars. The crew knows the light was false, and that knowledge steadies them when real signals call later. Pursuit falls away behind wreckage and dark current. The voyage continues with sharper watches.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": 1,
            "label": "Morale +1"
          }
        ],
        "rewards": [
          "Safe escape"
        ],
        "losses": []
      },
      "costlySuccess": {
        "label": "Costly Success",
        "vignette": "The ship escapes, but the trap takes its tithe in cracked fittings, spoiled stores, and sleepless nerves. The false beacon fades without apology. Crew argue over which moment almost doomed them, then return to work because the void is not finished. Survival is real, if not clean.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": -1,
            "label": "Supplies -1"
          },
          {
            "type": "resource",
            "resource": "strain",
            "mode": "add",
            "value": 1,
            "label": "Strain +1"
          }
        ],
        "rewards": [
          "Escape from the kill lane"
        ],
        "losses": [
          "Consumed supplies",
          "Engine wear"
        ]
      },
      "failure": {
        "label": "Failure",
        "vignette": "The ship gets out, but not before the ambush marks its hull and heading. A final hidden lamp watches until distance swallows it. The crew knows something out there has measured them and may remember the measure. Any later threat remains a GM choice, not an automatic battle.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "hull",
            "mode": "add",
            "value": -1,
            "label": "Hull -1"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -1,
            "label": "Morale -1"
          }
        ],
        "rewards": [],
        "losses": [
          "Hull damage",
          "Hostile attention"
        ],
        "combatHandoff": true,
        "handoffNotes": "Potential later pursuer or raider complication. No combat starts automatically."
      },
      "catastrophicFailure": {
        "label": "Catastrophic Failure",
        "vignette": "The ship survives the kill lane as a wounded thing dragging sparks through the dark. The false beacon steals a fragment of wake, route, or veil before it dies. Crew remember the kindness in the signal and hate it for being a weapon. The GM may use the handoff as future pressure, but this event starts no combat.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "hull",
            "mode": "add",
            "value": -2,
            "label": "Hull -2"
          },
          {
            "type": "resource",
            "resource": "lifeveil",
            "mode": "add",
            "value": -2,
            "label": "Lifeveil -2"
          },
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -2,
            "label": "Morale -2"
          }
        ],
        "rewards": [],
        "losses": [
          "Severe damage",
          "Marked wake",
          "Crew dread"
        ],
        "combatHandoff": true,
        "handoffNotes": "Potential later threat using the stolen wake, surviving raiders, or an occult beacon remnant. No combat starts automatically."
      }
    },
    "rewards": [
      "Ambush intelligence",
      "Survival reputation"
    ],
    "futureAutomationNotes": [
      "Keep combatHandoff metadata GM-facing only.",
      "Stage resource effects for explicit GM review before applying."
    ]
  },
  "portside-diplomatic-snare": {
    "key": "portside-diplomatic-snare",
    "name": "Portside Diplomatic Snare",
    "category": "social",
    "tags": [
      "social",
      "morale",
      "supplies",
      "crewPressure",
      "resourcePressure",
      "shipboard"
    ],
    "roundCount": 4,
    "baseDC": 18,
    "activeResources": [
      "morale",
      "supplies",
      "strain"
    ],
    "travelStations": [
      "navigator",
      "engineer",
      "veilwarden",
      "watchmaster",
      "captain"
    ],
    "description": "A bright voidport, relay station, or free-floating trade platform welcomes the ship with banners, music, and too many ledgers. Every smile carries a fee, every inspection hides a favor, and every delay gives someone leverage. The danger is polite, perfumed, and written in triplicate beneath the dock-ring's lanternlight.",
    "gmSummary": "Run this as a social travel event about pressure, etiquette, debt, and crew patience. Dock officials, guild factors, envoys, creditors, or customs clerks can fill the opposing roles. Catastrophic results may point to faction trouble or a later social handoff, but no combat is assumed.",
    "rounds": [
      {
        "round": 1,
        "title": "The Welcome That Costs Money",
        "openingVignette": "The voidport unfolds around the ship in dock-ring tiers of colored glass, hanging gardens, brass cranes, and prayer flags stitched with tariff seals. A delegation waits beneath a silk awning while clerks release glittering receipt-doves into the Lifeveil. Musicians play a welcome march just loud enough to hide the argument at the customs desk. Every rope thrown to the mooring spur is measured, stamped, and admired by someone holding a fee schedule. The orbital anchorage smells of spice, hot ink, and opportunity with a hook inside it.",
        "activeStations": [
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "society",
              "deception"
            ],
            "playerAction": "Choose whether to accept limited honors or insist on plain docking terms, then make the Captain check for The Welcome That Costs Money. Tell the table how the crew addresses this problem: The greeting party offers honors that become obligations if accepted too eagerly.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during The Welcome That Costs Money turns \"The greeting party offers honors that become obligations if accepted too eagerly\" into a clear advantage for the crew.",
              "success": "Captain resolves \"The greeting party offers honors that become obligations if accepted too eagerly\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Captain cannot fully resolve \"The greeting party offers honors that become obligations if accepted too eagerly\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"The greeting party offers honors that become obligations if accepted too eagerly\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Accept limited honors",
              "Insist on plain docking terms"
            ],
            "vignette": "The greeting party offers honors that become obligations if accepted too eagerly."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "society",
              "stealth"
            ],
            "playerAction": "Choose whether to post deck sentries or let rumors flow as bait, then make the Watchmaster check for The Welcome That Costs Money. Tell the table how the crew addresses this problem: Porters, clerks, and charming strangers all drift close enough to overhear the wrong thing.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during The Welcome That Costs Money turns \"Porters, clerks, and charming strangers all drift close enough to overhear the wrong thing\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Porters, clerks, and charming strangers all drift close enough to overhear the wrong thing\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Watchmaster cannot fully resolve \"Porters, clerks, and charming strangers all drift close enough to overhear the wrong thing\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Porters, clerks, and charming strangers all drift close enough to overhear the wrong thing\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Post deck sentries",
              "Let rumors flow as bait"
            ],
            "vignette": "Porters, clerks, and charming strangers all drift close enough to overhear the wrong thing."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "engineering-lore",
              "diplomacy"
            ],
            "playerAction": "Choose whether to offer a safe demonstration or delay with technical jargon, then make the Engineer check for The Welcome That Costs Money. Tell the table how the crew addresses this problem: Dock inspectors admire the arkengine with professional hunger and an alarming number of forms.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during The Welcome That Costs Money turns \"Dock inspectors admire the arkengine with professional hunger and an alarming number of forms\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Dock inspectors admire the arkengine with professional hunger and an alarming number of forms\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Engineer cannot fully resolve \"Dock inspectors admire the arkengine with professional hunger and an alarming number of forms\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Dock inspectors admire the arkengine with professional hunger and an alarming number of forms\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Offer a safe demonstration",
              "Delay with technical jargon"
            ],
            "vignette": "Dock inspectors admire the arkengine with professional hunger and an alarming number of forms."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "religion",
              "society"
            ],
            "playerAction": "Choose whether to accept harmless blessings or countermark the threshold, then make the Veilwarden check for The Welcome That Costs Money. Tell the table how the crew addresses this problem: Courtesy charms and oath-ribbons brush the Lifeveil like soft fingers seeking a knot.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during The Welcome That Costs Money turns \"Courtesy charms and oath-ribbons brush the Lifeveil like soft fingers seeking a knot\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Courtesy charms and oath-ribbons brush the Lifeveil like soft fingers seeking a knot\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Veilwarden cannot fully resolve \"Courtesy charms and oath-ribbons brush the Lifeveil like soft fingers seeking a knot\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Courtesy charms and oath-ribbons brush the Lifeveil like soft fingers seeking a knot\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Accept harmless blessings",
              "Countermark the threshold"
            ],
            "vignette": "Courtesy charms and oath-ribbons brush the Lifeveil like soft fingers seeking a knot."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The crew receives the welcome without stepping into its hidden debt. Dock officials smile a little more carefully after that. A junior clerk quietly adjusts the first fee downward, impressed by the ship's poise.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.captain.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Captain DC -1"
              }
            ]
          },
          "mixed": {
            "vignette": "The welcome remains cordial, but small charges begin attaching themselves to every kindness. Crew grumble as receipt-doves perch on coils of rope. The port has not trapped the ship, but it has found purchase.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "A ceremonial courtesy becomes an implied contract before anyone can object. The delegation's smiles brighten with practiced innocence. The crew feels the first tug of delay and embarrassment.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ],
            "nextRoundNotes": "Make the port's paperwork feel like velvet rope."
          },
          "catastrophicFailure": {
            "vignette": "The ship is welcomed as honored guests, debtors, and inspection subjects in the same breath. Three officials produce matching seals, each claiming precedence. Leaving quickly is still possible, but leaving cleanly is not.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              },
              {
                "type": "modifier",
                "target": "nextRound.all.dc",
                "mode": "add",
                "value": 1,
                "label": "Next Round All DC +1"
              }
            ],
            "handoffNotes": "Potential later social complication: disputed docking obligation or offended local factor. No combat starts automatically."
          }
        }
      },
      {
        "round": 2,
        "title": "Inspection and Delay",
        "openingVignette": "Morning finds the ship surrounded by rope barriers, polite signs, and clerks carrying lacquered tablets. An inspector with pearl spectacles requests access to spaces no visitor needs to see. A guild factor offers to hasten matters for a favor phrased as a friendship. Around the dock-ring, other crews pretend not to watch and fail beautifully.",
        "activeStations": [
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to offer a narrow concession or demand charter rights, then make the Captain check for Inspection and Delay. Tell the table how the crew addresses this problem: The official schedule grows longer whenever challenged directly.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Inspection and Delay turns \"The official schedule grows longer whenever challenged directly\" into a clear advantage for the crew.",
              "success": "Captain resolves \"The official schedule grows longer whenever challenged directly\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Captain cannot fully resolve \"The official schedule grows longer whenever challenged directly\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"The official schedule grows longer whenever challenged directly\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Offer a narrow concession",
              "Demand charter rights"
            ],
            "vignette": "The official schedule grows longer whenever challenged directly."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "engineering-lore",
              "deception"
            ],
            "playerAction": "Choose whether to prepare a clean route or hide repairs behind procedure, then make the Engineer check for Inspection and Delay. Tell the table how the crew addresses this problem: Inspection seals threaten to slow maintenance and foul honest work.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Inspection and Delay turns \"Inspection seals threaten to slow maintenance and foul honest work\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Inspection seals threaten to slow maintenance and foul honest work\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Engineer cannot fully resolve \"Inspection seals threaten to slow maintenance and foul honest work\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Inspection seals threaten to slow maintenance and foul honest work\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Prepare a clean route",
              "Hide repairs behind procedure"
            ],
            "vignette": "Inspection seals threaten to slow maintenance and foul honest work."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "society",
              "deception"
            ],
            "playerAction": "Choose whether to question dockhands or seed a counter-rumor, then make the Watchmaster check for Inspection and Delay. Tell the table how the crew addresses this problem: A dockside rumor says the ship carries contraband, curses, or unpaid promises.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Inspection and Delay turns \"A dockside rumor says the ship carries contraband, curses, or unpaid promises\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"A dockside rumor says the ship carries contraband, curses, or unpaid promises\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Watchmaster cannot fully resolve \"A dockside rumor says the ship carries contraband, curses, or unpaid promises\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"A dockside rumor says the ship carries contraband, curses, or unpaid promises\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Question dockhands",
              "Seed a counter-rumor"
            ],
            "vignette": "A dockside rumor says the ship carries contraband, curses, or unpaid promises."
          },
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "society",
              "sailing-lore",
              "survival"
            ],
            "playerAction": "Choose whether to reserve a narrow window or wait for a cleaner tide, then make the Navigator check for Inspection and Delay. Tell the table how the crew addresses this problem: Departure windows, tide permits, and berth rotations are being rearranged with exquisite inconvenience.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Inspection and Delay turns \"Departure windows, tide permits, and berth rotations are being rearranged with exquisite inconvenience\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Departure windows, tide permits, and berth rotations are being rearranged with exquisite inconvenience\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Navigator cannot fully resolve \"Departure windows, tide permits, and berth rotations are being rearranged with exquisite inconvenience\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Departure windows, tide permits, and berth rotations are being rearranged with exquisite inconvenience\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Reserve a narrow window",
              "Wait for a cleaner tide"
            ],
            "vignette": "Departure windows, tide permits, and berth rotations are being rearranged with exquisite inconvenience."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The inspection completes with fewer seals than expected and no meaningful hold on the ship. A clerk stamps the papers as if granting a favor, but the favor is mostly yours. Crew begin believing the snare can be slipped.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              }
            ]
          },
          "mixed": {
            "vignette": "The inspection ends, but only after the ship spends stores, favors, and half a day of patience. The paperwork is clean enough to continue and dirty enough to annoy everyone. Dockside smiles remain sharp.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The inspectors find nothing dangerous and still discover three reasons to delay departure. Each reason wears a different seal. The crew starts muttering that the port is eating the voyage one hour at a time.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              },
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "A planted irregularity becomes a formal concern before witnesses. The officials remain unbearably courteous while tightening every schedule around the ship. Somewhere nearby, the person who arranged it is already drafting the next favor.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -2,
                "label": "Supplies -2"
              },
              {
                "type": "modifier",
                "target": "nextRound.captain.dc",
                "mode": "add",
                "value": 2,
                "label": "Next Captain DC +2"
              }
            ],
            "handoffNotes": "Potential later social complication: planted customs irregularity or guild leverage. No combat starts automatically."
          }
        }
      },
      {
        "round": 3,
        "title": "The Favor Beneath the Fee",
        "openingVignette": "By afternoon, the true price arrives wearing perfume, rank, or impeccable handwriting. A guild factor can erase the fees for one private delivery. An envoy can smooth the inspection for a letter carried unopened. A creditor can forgive a delay if the captain agrees to be seen at the right table. None of them raise their voices; none of them need to.",
        "activeStations": [
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "society",
              "deception"
            ],
            "playerAction": "Choose whether to counteroffer openly or refuse with ceremony, then make the Captain check for The Favor Beneath the Fee. Tell the table how the crew addresses this problem: The offer sounds generous until its shadow reaches the next port.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during The Favor Beneath the Fee turns \"The offer sounds generous until its shadow reaches the next port\" into a clear advantage for the crew.",
              "success": "Captain resolves \"The offer sounds generous until its shadow reaches the next port\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Captain cannot fully resolve \"The offer sounds generous until its shadow reaches the next port\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"The offer sounds generous until its shadow reaches the next port\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Counteroffer openly",
              "Refuse with ceremony"
            ],
            "vignette": "The offer sounds generous until its shadow reaches the next port."
          },
          {
            "stationKey": "veilwarden",
            "stationName": "Veilwarden",
            "suggestedSkills": [
              "occultism",
              "religion",
              "society"
            ],
            "playerAction": "Choose whether to test the seal or offer a nonbinding blessing, then make the Veilwarden check for The Favor Beneath the Fee. Tell the table how the crew addresses this problem: Some contracts glitter with harmless ink, while others hum like little cages.",
            "rollFeedback": {
              "criticalSuccess": "Veilwarden's work during The Favor Beneath the Fee turns \"Some contracts glitter with harmless ink, while others hum like little cages\" into a clear advantage for the crew.",
              "success": "Veilwarden resolves \"Some contracts glitter with harmless ink, while others hum like little cages\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Veilwarden cannot fully resolve \"Some contracts glitter with harmless ink, while others hum like little cages\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Veilwarden misjudges \"Some contracts glitter with harmless ink, while others hum like little cages\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Test the seal",
              "Offer a nonbinding blessing"
            ],
            "vignette": "Some contracts glitter with harmless ink, while others hum like little cages."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "stealth",
              "society"
            ],
            "playerAction": "Choose whether to shadow the factor's aide or keep crew together, then make the Watchmaster check for The Favor Beneath the Fee. Tell the table how the crew addresses this problem: Someone is watching who accepts which cup, which coin, and which invitation.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during The Favor Beneath the Fee turns \"Someone is watching who accepts which cup, which coin, and which invitation\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Someone is watching who accepts which cup, which coin, and which invitation\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Watchmaster cannot fully resolve \"Someone is watching who accepts which cup, which coin, and which invitation\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Someone is watching who accepts which cup, which coin, and which invitation\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Shadow the factor's aide",
              "Keep crew together"
            ],
            "vignette": "Someone is watching who accepts which cup, which coin, and which invitation."
          },
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "society",
              "sailing-lore",
              "survival"
            ],
            "playerAction": "Choose whether to map clean alternatives or accept a risky shortcut, then make the Navigator check for The Favor Beneath the Fee. Tell the table how the crew addresses this problem: Every offered favor changes the map by adding ports best avoided or debts best paid early.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during The Favor Beneath the Fee turns \"Every offered favor changes the map by adding ports best avoided or debts best paid early\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"Every offered favor changes the map by adding ports best avoided or debts best paid early\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Navigator cannot fully resolve \"Every offered favor changes the map by adding ports best avoided or debts best paid early\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"Every offered favor changes the map by adding ports best avoided or debts best paid early\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Map clean alternatives",
              "Accept a risky shortcut"
            ],
            "vignette": "Every offered favor changes the map by adding ports best avoided or debts best paid early."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The crew turns the favor into a minor courtesy instead of a chain. The factor leaves smiling, but not as broadly as planned. The ship gains a little local respect for knowing the worth of its own name.",
            "proposedEffects": [
              {
                "type": "modifier",
                "target": "nextRound.all.dc",
                "mode": "add",
                "value": -1,
                "label": "Next Round All DC -1"
              }
            ]
          },
          "mixed": {
            "vignette": "The favor is softened, not escaped. The ship owes a letter, a public toast, or a harmless-looking introduction. It is manageable, but everyone aboard can feel the hook under the ribbon.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The negotiation slips, and the fee becomes a favor with witnesses. Refusal now costs reputation, coin, or delay. The crew sees officers calculating which wound heals fastest.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ]
          },
          "catastrophicFailure": {
            "vignette": "The ship is maneuvered into public agreement before the cost is fully named. Applause covers the snap of the snare. The obligation may be social rather than violent, but it can still bleed the voyage later.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              },
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ],
            "handoffNotes": "Potential later social handoff: faction debt, guild favor, or public promise. No combat starts automatically."
          }
        }
      },
      {
        "round": 4,
        "title": "Depart Clean or Owing",
        "openingVignette": "Departure bells ring across the dock-ring while clerks hurry like bright beetles under paper shells. The ship's lines are ready, but three signatures, two blessings, and one final invoice stand between deck and open void. The voidport offers farewell gifts that may be gifts, tracking marks, or insults wrapped in silk. The crew can taste free airskin and star-cold beyond the cranes.",
        "activeStations": [
          {
            "stationKey": "captain",
            "stationName": "Captain",
            "suggestedSkills": [
              "diplomacy",
              "intimidation",
              "society"
            ],
            "playerAction": "Choose whether to pay only what is owed or trade a courtesy for release, then make the Captain check for Depart Clean or Owing. Tell the table how the crew addresses this problem: The final handshake decides whether the ship leaves respected, indebted, or mocked.",
            "rollFeedback": {
              "criticalSuccess": "Captain's work during Depart Clean or Owing turns \"The final handshake decides whether the ship leaves respected, indebted, or mocked\" into a clear advantage for the crew.",
              "success": "Captain resolves \"The final handshake decides whether the ship leaves respected, indebted, or mocked\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Captain cannot fully resolve \"The final handshake decides whether the ship leaves respected, indebted, or mocked\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Captain misjudges \"The final handshake decides whether the ship leaves respected, indebted, or mocked\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Pay only what is owed",
              "Trade a courtesy for release"
            ],
            "vignette": "The final handshake decides whether the ship leaves respected, indebted, or mocked."
          },
          {
            "stationKey": "navigator",
            "stationName": "Navigator",
            "suggestedSkills": [
              "sailing-lore",
              "society",
              "survival"
            ],
            "playerAction": "Choose whether to take the busy lane or wait for a quiet bell, then make the Navigator check for Depart Clean or Owing. Tell the table how the crew addresses this problem: The dock-ring lanes are crowded exactly where delay would be most embarrassing.",
            "rollFeedback": {
              "criticalSuccess": "Navigator's work during Depart Clean or Owing turns \"The dock-ring lanes are crowded exactly where delay would be most embarrassing\" into a clear advantage for the crew.",
              "success": "Navigator resolves \"The dock-ring lanes are crowded exactly where delay would be most embarrassing\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Navigator cannot fully resolve \"The dock-ring lanes are crowded exactly where delay would be most embarrassing\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Navigator misjudges \"The dock-ring lanes are crowded exactly where delay would be most embarrassing\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Take the busy lane",
              "Wait for a quiet bell"
            ],
            "vignette": "The dock-ring lanes are crowded exactly where delay would be most embarrassing."
          },
          {
            "stationKey": "engineer",
            "stationName": "Engineer",
            "suggestedSkills": [
              "crafting",
              "engineering-lore",
              "perception"
            ],
            "playerAction": "Choose whether to remove excess seals or verify every adjustment, then make the Engineer check for Depart Clean or Owing. Tell the table how the crew addresses this problem: Dockside service crews left tags, seals, and helpful adjustments everywhere.",
            "rollFeedback": {
              "criticalSuccess": "Engineer's work during Depart Clean or Owing turns \"Dockside service crews left tags, seals, and helpful adjustments everywhere\" into a clear advantage for the crew.",
              "success": "Engineer resolves \"Dockside service crews left tags, seals, and helpful adjustments everywhere\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Engineer cannot fully resolve \"Dockside service crews left tags, seals, and helpful adjustments everywhere\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Engineer misjudges \"Dockside service crews left tags, seals, and helpful adjustments everywhere\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Remove excess seals",
              "Verify every adjustment"
            ],
            "vignette": "Dockside service crews left tags, seals, and helpful adjustments everywhere."
          },
          {
            "stationKey": "watchmaster",
            "stationName": "Watchmaster",
            "suggestedSkills": [
              "perception",
              "society",
              "intimidation"
            ],
            "playerAction": "Choose whether to search departing cargo or refuse late visitors, then make the Watchmaster check for Depart Clean or Owing. Tell the table how the crew addresses this problem: Farewell crowds wave scarves, contracts, rumors, and perhaps one last planted problem.",
            "rollFeedback": {
              "criticalSuccess": "Watchmaster's work during Depart Clean or Owing turns \"Farewell crowds wave scarves, contracts, rumors, and perhaps one last planted problem\" into a clear advantage for the crew.",
              "success": "Watchmaster resolves \"Farewell crowds wave scarves, contracts, rumors, and perhaps one last planted problem\" well enough for the ship to keep its line through Portside Diplomatic Snare.",
              "failure": "Watchmaster cannot fully resolve \"Farewell crowds wave scarves, contracts, rumors, and perhaps one last planted problem\", and Portside Diplomatic Snare leaves a visible cost behind.",
              "criticalFailure": "Watchmaster misjudges \"Farewell crowds wave scarves, contracts, rumors, and perhaps one last planted problem\", giving Portside Diplomatic Snare a hard opening before the crew can recover."
            },
            "resourceOptions": [
              "Search departing cargo",
              "Refuse late visitors"
            ],
            "vignette": "Farewell crowds wave scarves, contracts, rumors, and perhaps one last planted problem."
          }
        ],
        "outcomeBranches": {
          "dominantSuccess": {
            "vignette": "The ship departs under its own name and no one else's claim. The port's banners shrink behind the stern while the crew laughs at fees that failed to land. Even the customs clerks seem to admire the clean exit.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": 1,
                "label": "Morale +1"
              }
            ]
          },
          "mixed": {
            "vignette": "The ship leaves with papers in order and tempers frayed. A few stores remain behind as the price of speed. The crew is glad to be gone and wiser about beautiful voidports.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -1,
                "label": "Supplies -1"
              }
            ]
          },
          "dominantFailure": {
            "vignette": "The ship leaves owing someone a favor, apology, or explanation. The debt is not fatal, but it has a name and a witness. Crew morale sours as the port recedes in expensive sunlight.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -1,
                "label": "Morale -1"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ],
            "handoffNotes": "Potential later social handoff: creditor, guild factor, or offended envoy. No combat starts automatically."
          },
          "catastrophicFailure": {
            "vignette": "The ship departs only after accepting a public obligation or humiliating delay. The voidport signals farewell as if it has purchased a piece of the voyage. Nobody draws a blade, but the crew feels the cut all the same.",
            "proposedEffects": [
              {
                "type": "resource",
                "resource": "morale",
                "mode": "add",
                "value": -2,
                "label": "Morale -2"
              },
              {
                "type": "resource",
                "resource": "supplies",
                "mode": "add",
                "value": -2,
                "label": "Supplies -2"
              },
              {
                "type": "resource",
                "resource": "strain",
                "mode": "add",
                "value": 1,
                "label": "Strain +1"
              }
            ],
            "handoffNotes": "Potential later social trouble from debt, insult, legal delay, or faction pressure. No combat starts automatically."
          }
        }
      }
    ],
    "finalOutcomes": {
      "majorVictory": {
        "label": "Major Victory",
        "vignette": "The ship leaves port with clean papers, intact pride, and a reputation for graceful refusal. The crew turns the whole affair into jokes before the dock lights fade. A contact or clerk may even owe them a small courtesy later. The snare closes on empty air behind them.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": 2,
            "label": "Morale +2"
          }
        ],
        "rewards": [
          "Clean departure",
          "Useful port reputation"
        ],
        "losses": []
      },
      "victory": {
        "label": "Victory",
        "vignette": "The ship departs with only minor fees and bruised patience. Officials wave from the pier as if everything was friendship all along. The crew knows better, but knowing better is its own form of profit. The voyage resumes under clear authority.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": 1,
            "label": "Morale +1"
          }
        ],
        "rewards": [
          "Clean enough departure"
        ],
        "losses": []
      },
      "costlySuccess": {
        "label": "Costly Success",
        "vignette": "The ship escapes the paperwork maze, but coin, stores, and patience stay behind in the port's ledgers. No single concession is ruinous; together they sting. The crew learns which smiles to distrust next time. Departure feels good because remaining would have cost more.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": -1,
            "label": "Supplies -1"
          },
          {
            "type": "resource",
            "resource": "strain",
            "mode": "add",
            "value": 1,
            "label": "Strain +1"
          }
        ],
        "rewards": [
          "Departure secured"
        ],
        "losses": [
          "Fees and stores",
          "Administrative fatigue"
        ]
      },
      "failure": {
        "label": "Failure",
        "vignette": "The ship leaves with an obligation tucked into its wake. The port's officials remain polite, which makes the debt more irritating rather than less real. Crew mutter about favors, fees, and names to avoid. The GM may turn the loose thread into later social pressure if useful.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -1,
            "label": "Morale -1"
          },
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": -1,
            "label": "Supplies -1"
          }
        ],
        "rewards": [],
        "losses": [
          "Social debt",
          "Crew frustration"
        ],
        "handoffNotes": "Potential later social pressure from a guild, creditor, clerk, or envoy. No combat starts automatically."
      },
      "catastrophicFailure": {
        "label": "Catastrophic Failure",
        "vignette": "The ship departs late, lighter, and publicly entangled. The port keeps a piece of its reputation in a ledger stamped with beautiful seals. Crew morale sinks under the knowledge that no sword was drawn and still they were wounded. Any future faction trouble remains a GM-facing handoff, not an automatic encounter.",
        "proposedEffects": [
          {
            "type": "resource",
            "resource": "morale",
            "mode": "add",
            "value": -2,
            "label": "Morale -2"
          },
          {
            "type": "resource",
            "resource": "supplies",
            "mode": "add",
            "value": -2,
            "label": "Supplies -2"
          },
          {
            "type": "resource",
            "resource": "strain",
            "mode": "add",
            "value": 1,
            "label": "Strain +1"
          }
        ],
        "rewards": [],
        "losses": [
          "Faction pressure",
          "Public embarrassment",
          "Costly delay"
        ],
        "handoffNotes": "Potential later social handoff from debt, customs penalties, faction insult, or legal delay. No combat starts automatically."
      }
    },
    "rewards": [
      "Port contacts",
      "Hard-won docking lessons"
    ],
    "futureAutomationNotes": [
      "Keep obligations and handoffs GM-facing until data architecture grows.",
      "Stage resource effects for explicit GM review before applying."
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
