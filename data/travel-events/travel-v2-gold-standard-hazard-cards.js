export const TRAVEL_V2_GOLD_STANDARD_HAZARD_CARD_PACK_VERSION = 1;

export const TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS = Object.freeze(
[
  {
    "id": "hazard-void-shear",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Void Shear",
    "category": "navigation",
    "severity": "major",
    "publicText": "A hard cross-current in the void pulls the plotted route sideways, making familiar bearings disagree with the Navigator’s instruments.",
    "playerSafeSummary": "The ship is being pushed off its clean line; the crew can correct course before Route pressure sets in.",
    "gmText": "Frame this as positional danger, not a surprise penalty. Ask where the Navigator is taking bearings from and who buys them time.",
    "triggerSources": [
      "bad bearing",
      "route pressure",
      "navigator failure"
    ],
    "stationImpacts": {
      "navigator": {
        "publicText": "The Navigator sees split bearings and must chart against lateral drift before the plotted route slides off-line.",
        "gmText": "Ask which fixed point or old bearing the Navigator trusts when the instruments disagree."
      },
      "watchmaster": {
        "publicText": "The Watchmaster needs fixed visual references so the helm can tell drift from real course change.",
        "gmText": "Offer external cues: star-pricks sliding sideways, hull shadow movement, or rigging tension."
      }
    },
    "responseActions": [
      {
        "id": "chart-countercurrent",
        "label": "Chart the Countercurrent",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The Navigator marks the shear line and plots a crossing angle that fights the sideways pull.",
        "gmText": "A success should make the route feel recoverable without revealing any hidden escalation choice.",
        "suggestedSkills": [
          "Navigation",
          "Survey",
          "Astronomy"
        ],
        "clearProgress": 1,
        "risk": "A bad chart points the ship deeper into the shear."
      },
      {
        "id": "lock-the-watchlines",
        "label": "Lock the Watchlines",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The Watchmaster calls fixed points and drift marks so every correction has a shared reference.",
        "gmText": "Use this to make the table picture concrete: who watches which point, and what counts as drift.",
        "suggestedSkills": [
          "Vigilance",
          "Perception",
          "Coordination"
        ],
        "clearProgress": 1,
        "risk": "Missed references let the ship mistake sideways motion for forward travel."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-route-drift"
    ],
    "escalationRefs": [
      "consequence-hazard-escalation"
    ],
    "narration": {
      "onDeclare": "The course line forks into two trembling bearings as the void shoves the ship sideways.",
      "onSuccess": "A clean counter-angle bites, and the false bearing peels away from the true route.",
      "onFailure": "The fixed points crawl across the glass; the shear is carrying the ship faster than the helm admits.",
      "onHazardCleared": "The last sideways pull snaps loose, leaving one honest route line ahead."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "navigation",
      "major",
      "navigator",
      "watchmaster"
    ]
  },
  {
    "id": "hazard-arkengine-cough",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Arkengine Cough",
    "category": "engine",
    "severity": "major",
    "publicText": "The arkengine misses a beat, coughs blue fire through its housings, and comes back louder than before.",
    "playerSafeSummary": "The engine is unstable and needs a careful response before Strain pressure or a louder signature follows.",
    "gmText": "Spotlight the Engineer without forcing damage. The hazard is a reviewable pressure source only; do not alter Strain or engine records.",
    "triggerSources": [
      "engine surge",
      "focus backlash",
      "overdrawn pace"
    ],
    "stationImpacts": {
      "engineer": {
        "publicText": "The Engineer hears the drivebeat skip and must vent heat before the cough becomes Strain pressure.",
        "gmText": "Keep this a Strain candidate only; describe heat, rhythm, and pressure without changing records."
      },
      "captain": {
        "publicText": "The Captain must hold crew timing steady while the engine lurches out of rhythm.",
        "gmText": "Give the Captain a leadership beat: who freezes, who needs an order, and what sound returns confidence."
      }
    },
    "responseActions": [
      {
        "id": "vent-the-surge",
        "label": "Vent the Surge",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The Engineer bleeds excess heat and pressure before the blue cough rolls back through the housings.",
        "gmText": "On success, the engine remains loud but controllable. Do not apply Strain automatically.",
        "suggestedSkills": [
          "Engineering",
          "Repair",
          "Endurance"
        ],
        "clearProgress": 1,
        "risk": "The vent comes late and leaves a stronger Strain candidate for review."
      },
      {
        "id": "dampen-the-drivebeat",
        "label": "Dampen the Drivebeat",
        "stationKeys": [
          "captain"
        ],
        "publicText": "The Captain sets a work rhythm the crew can follow until the arkengine finds its beat again.",
        "gmText": "Use shouted cadence, bell taps, or crew drills; this is coordination, not mechanical mutation.",
        "suggestedSkills": [
          "Command",
          "Performance",
          "Discipline"
        ],
        "clearProgress": 1,
        "risk": "Confused timing makes the next engine response riskier."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-arkengine-surge"
    ],
    "escalationRefs": [
      "consequence-threat-attracted"
    ],
    "narration": {
      "onDeclare": "The arkengine coughs blue-white heat, then comes back a half-beat too loud.",
      "onSuccess": "Pressure hisses through the vents, and the drivebeat settles into a bruised but usable rhythm.",
      "onFailure": "The cough rebounds through the deck plates, hotter and sharper than before.",
      "onHazardCleared": "The engine catches its cadence, leaving only the smell of hot metal behind."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "engine",
      "major",
      "engineer",
      "captain"
    ]
  },
  {
    "id": "hazard-lifeveil-thinspot",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Lifeveil Thinspot",
    "category": "lifeveil",
    "severity": "major",
    "publicText": "A pale seam opens in the Lifeveil, letting the outside cold press close enough for breath to fog.",
    "playerSafeSummary": "The Lifeveil has thinned; the Veilwarden can reinforce it before Lifeveil pressure takes hold.",
    "gmText": "Make the weakness visible and eerie. Keep the exact severity and any future pressure application for GM review.",
    "triggerSources": [
      "veil flicker",
      "void weather",
      "occult pressure"
    ],
    "stationImpacts": {
      "veilwarden": {
        "publicText": "The Veilwarden can see the Lifeveil shimmer thinning into a cold seam along the breathable envelope.",
        "gmText": "Invite ritual, craft, or sensory detail about reinforcing the veil; no Lifeveil value changes."
      },
      "engineer": {
        "publicText": "The Engineer can reduce vibration and heat bleed that keep tugging the seam open.",
        "gmText": "Tie machinery choices to the veil without making the engine solve everything alone."
      }
    },
    "responseActions": [
      {
        "id": "braid-the-veil",
        "label": "Braid the Veil",
        "stationKeys": [
          "veilwarden"
        ],
        "publicText": "The Veilwarden draws neighboring strands of Lifeveil across the thinspot until the shimmer overlaps.",
        "gmText": "A success should feel protective and visible, not like an automatic resource repair.",
        "suggestedSkills": [
          "Lifeveil",
          "Occult",
          "Focus"
        ],
        "clearProgress": 1,
        "risk": "The braid slips and leaves a Lifeveil pressure candidate."
      },
      {
        "id": "seal-the-cold-seam",
        "label": "Seal the Cold Seam",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The Engineer steadies the fittings nearest the seam so cold air stops finding a path inward.",
        "gmText": "Describe braces, shutters, and vibration control; keep any future pressure for GM review.",
        "suggestedSkills": [
          "Engineering",
          "Craft",
          "Repair"
        ],
        "clearProgress": 1,
        "risk": "A loose fitting keeps breathing cold into the ship."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-lifeveil-flicker"
    ],
    "escalationRefs": [
      "consequence-hazard-escalation"
    ],
    "narration": {
      "onDeclare": "Frost beads at the edge of a pale seam where the Lifeveil should be whole.",
      "onSuccess": "The shimmer braids over itself, and the breath of the void recedes from the deck.",
      "onFailure": "The seam opens by a finger-width of light, and every breath tastes thinner.",
      "onHazardCleared": "Warm air presses back against the cold as the Lifeveil closes cleanly."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "lifeveil",
      "major",
      "veilwarden",
      "engineer"
    ]
  },
  {
    "id": "hazard-hull-song-stress",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Hull-Song Stress",
    "category": "hull",
    "severity": "minor",
    "publicText": "The hull begins to sing in a tense, rising note as the ship’s frame carries too much vibration.",
    "playerSafeSummary": "The hull is under resonance stress; the crew can dampen the frame before it becomes Hull pressure.",
    "gmText": "Use sound and vibration. This is not automatic damage; it is a candidate for reviewed Hull pressure if ignored.",
    "triggerSources": [
      "hard maneuver",
      "rough current",
      "missed watch"
    ],
    "stationImpacts": {
      "watchmaster": {
        "publicText": "The Watchmaster must locate which frame is singing before the resonance spreads through the Hull.",
        "gmText": "Make listening and triangulation matter; this is Hull pressure only if unresolved."
      },
      "engineer": {
        "publicText": "The Engineer can dampen the resonant braces before the song turns into a hard flex.",
        "gmText": "Describe clamps, wedges, counter-vibration, or power redistribution without applying damage."
      }
    },
    "responseActions": [
      {
        "id": "find-the-singing-frame",
        "label": "Find the Singing Frame",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The Watchmaster follows the rising note through bulkheads to name the stressed frame.",
        "gmText": "Reward precise fictional positioning: deck, brace, cargo bay, or keel-line.",
        "suggestedSkills": [
          "Perception",
          "Vigilance",
          "Hullcraft"
        ],
        "clearProgress": 1,
        "risk": "The wrong frame is braced while the real note climbs."
      },
      {
        "id": "set-counterbraces",
        "label": "Set Counterbraces",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The Engineer wedges and tunes counterbraces to break the resonance before it peaks.",
        "gmText": "Keep the result descriptive; future ship scars remain reviewed candidates only.",
        "suggestedSkills": [
          "Engineering",
          "Repair",
          "Craft"
        ],
        "clearProgress": 1,
        "risk": "The brace holds briefly, then transfers stress elsewhere."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-hull-stress"
    ],
    "escalationRefs": [
      "consequence-ship-scar-candidate"
    ],
    "narration": {
      "onDeclare": "A thin note climbs through the Hull, making cups tremble and teeth ache.",
      "onSuccess": "A counterbrace bites down, and the song drops from a shriek to a tired hum.",
      "onFailure": "The note doubles back through the frame, louder and closer to pain.",
      "onHazardCleared": "The Hull falls quiet except for the ordinary creak of travel."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "hull",
      "minor",
      "watchmaster",
      "engineer"
    ]
  },
  {
    "id": "hazard-crew-on-edge",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Crew on Edge",
    "category": "crew",
    "severity": "minor",
    "publicText": "The crew hears too many bad omens in the ship’s noises, and routine orders start landing a heartbeat late.",
    "playerSafeSummary": "Morale is fraying; leadership or support can steady the watch before hesitation spreads.",
    "gmText": "Keep the premise public and humane. Do not change Morale, Focus, or Support automatically.",
    "triggerSources": [
      "frightening event",
      "long watch",
      "failed support"
    ],
    "stationImpacts": {
      "captain": {
        "publicText": "The Captain must turn fear into orders before hesitation spreads across the crew.",
        "gmText": "Ask what the Captain says publicly, and who visibly steadies because of it."
      },
      "watchmaster": {
        "publicText": "The Watchmaster can separate real warnings from rumor before anxious reports flood the deck.",
        "gmText": "Use this to filter signals and prevent panic from becoming the scene’s loudest fact."
      }
    },
    "responseActions": [
      {
        "id": "name-the-fear",
        "label": "Name the Fear",
        "stationKeys": [
          "captain"
        ],
        "publicText": "The Captain names the danger plainly and gives the crew one immediate job to trust.",
        "gmText": "A grounded speech or quiet command both work; do not adjust Morale automatically.",
        "suggestedSkills": [
          "Command",
          "Empathy",
          "Presence"
        ],
        "clearProgress": 1,
        "risk": "Vague reassurance sounds like denial and lets fear keep moving."
      },
      {
        "id": "sort-the-rumors",
        "label": "Sort the Rumors",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The Watchmaster checks reports against actual signs so the crew knows what is real.",
        "gmText": "Offer two rumors and one useful observation if the table wants texture.",
        "suggestedSkills": [
          "Insight",
          "Vigilance",
          "Investigation"
        ],
        "clearProgress": 1,
        "risk": "A false report becomes the thing everyone repeats."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-crew-panic"
    ],
    "escalationRefs": [
      "consequence-hazard-escalation"
    ],
    "narration": {
      "onDeclare": "Whispers outrun orders, and every ordinary knock sounds like an omen.",
      "onSuccess": "The crew exhales together as fear is given a name and a task.",
      "onFailure": "Someone repeats the wrong warning, and a dozen eyes turn from their posts.",
      "onHazardCleared": "The watch returns to work with pale faces but steady hands."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "crew",
      "minor",
      "captain",
      "watchmaster"
    ]
  },
  {
    "id": "hazard-cargo-break-loose",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Cargo Break-Loose",
    "category": "cargo",
    "severity": "minor",
    "publicText": "Something heavy tears free in the hold and starts hammering the deck with every correction.",
    "playerSafeSummary": "Loose Cargo threatens work below decks and may become a Cargo complication if not secured.",
    "gmText": "Treat this as immediate physical chaos and future review fodder, never as an inventory mutation.",
    "triggerSources": [
      "hard turn",
      "hull shock",
      "cargo straps fail"
    ],
    "stationImpacts": {
      "watchmaster": {
        "publicText": "The Watchmaster must track the loose weight before it crushes a passage or blocks a station.",
        "gmText": "Make the moving cargo a spatial hazard, not an inventory change."
      },
      "engineer": {
        "publicText": "The Engineer can rig restraints or alter motion so the loose Cargo stops hammering the Hull.",
        "gmText": "Tie the fix to straps, hoists, gravity, or ship motion without mutating items."
      }
    },
    "responseActions": [
      {
        "id": "call-the-roll",
        "label": "Call the Roll",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The Watchmaster tracks the cargo’s swing and calls when it is safe to move in.",
        "gmText": "Use timing and line of sight; a success creates an opening for securing work.",
        "suggestedSkills": [
          "Vigilance",
          "Athletics",
          "Tactics"
        ],
        "clearProgress": 1,
        "risk": "The next swing catches someone or blocks the wrong hatch."
      },
      {
        "id": "lash-the-weight",
        "label": "Lash the Weight",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The Engineer throws lines, clamps, or wedges into place to stop the loose mass.",
        "gmText": "A success secures the fictional hazard only; no cargo record changes.",
        "suggestedSkills": [
          "Repair",
          "Athletics",
          "Engineering"
        ],
        "clearProgress": 1,
        "risk": "A line parts and turns the cargo into a pendulum."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-cargo-shift"
    ],
    "escalationRefs": [
      "consequence-hull-stress"
    ],
    "narration": {
      "onDeclare": "A heavy crash rolls below decks, followed by the scrape of something too large moving free.",
      "onSuccess": "Lines snap taut around the weight, and the next impact becomes a dull shudder.",
      "onFailure": "The cargo slams the bulkhead hard enough to make the Hull answer.",
      "onHazardCleared": "The hold settles into strained silence around the newly lashed mass."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "cargo",
      "minor",
      "watchmaster",
      "engineer"
    ]
  },
  {
    "id": "hazard-stores-jam",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Stores Jam",
    "category": "supplies",
    "severity": "minor",
    "publicText": "The needed stores are aboard, but a jammed rack and tangled straps put them out of reach at the worst moment.",
    "playerSafeSummary": "Supplies access is delayed; the crew can clear the jam before it becomes supply pressure.",
    "gmText": "Emphasize delay and access, not loss. Do not mutate inventories or supplies.",
    "triggerSources": [
      "blocked access",
      "low stores",
      "support needed"
    ],
    "stationImpacts": {
      "captain": {
        "publicText": "The Captain must prioritize who gets delayed supplies first while the stores path is blocked.",
        "gmText": "Frame this as triage and timing, not a supplies loss."
      },
      "watchmaster": {
        "publicText": "The Watchmaster can clear a safe route through straps, crates, and bad footing.",
        "gmText": "Keep attention on access and crew movement; inventories remain untouched."
      }
    },
    "responseActions": [
      {
        "id": "triage-the-manifest",
        "label": "Triage the Manifest",
        "stationKeys": [
          "captain"
        ],
        "publicText": "The Captain names the one supply need that matters now and redirects hands to it.",
        "gmText": "A success reduces confusion and gives the clearing crew a precise target.",
        "suggestedSkills": [
          "Command",
          "Logistics",
          "Insight"
        ],
        "clearProgress": 1,
        "risk": "Two teams reach for different crates and block each other."
      },
      {
        "id": "clear-the-rack",
        "label": "Clear the Rack",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The Watchmaster cuts a safe path through jammed racks and tangled straps.",
        "gmText": "Describe noise, footing, and time pressure. Do not change supply totals.",
        "suggestedSkills": [
          "Athletics",
          "Vigilance",
          "Craft"
        ],
        "clearProgress": 1,
        "risk": "The rack shifts and buries the needed stores deeper."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-supplies-delay"
    ],
    "escalationRefs": [
      "consequence-cargo-shift"
    ],
    "narration": {
      "onDeclare": "The manifest says the stores are aboard; the jammed rack says they are not yet useful.",
      "onSuccess": "A clear path opens just wide enough for the right crate to come free.",
      "onFailure": "Straps snarl tighter, and the needed label vanishes behind shifting boxes.",
      "onHazardCleared": "The stores reach waiting hands late, but intact."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "supplies",
      "minor",
      "captain",
      "watchmaster"
    ]
  },
  {
    "id": "hazard-phantom-beacon",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Phantom Beacon",
    "category": "threat",
    "severity": "major",
    "publicText": "A clean beacon calls from just off the route, repeating a friendly cadence no one aboard recognizes.",
    "playerSafeSummary": "The signal may lure the ship or announce it; confirm before answering or following.",
    "gmText": "Keep the truth GM-facing. Players know the beacon is suspicious, not what waits behind it.",
    "triggerSources": [
      "unknown signal",
      "route lure",
      "failed stealth"
    ],
    "stationImpacts": {
      "navigator": {
        "publicText": "The Navigator must compare the beacon against the Route before its friendly cadence pulls the ship aside.",
        "gmText": "Keep the beacon’s truth hidden; the public issue is verification before commitment."
      },
      "watchmaster": {
        "publicText": "The Watchmaster listens for repeats, echoes, or predatory timing in the signal.",
        "gmText": "Give signal texture without confirming who or what sent it unless the table earns that reveal."
      }
    },
    "responseActions": [
      {
        "id": "triangulate-the-beacon",
        "label": "Triangulate the Beacon",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The Navigator fixes the beacon’s position against the route instead of following its cadence.",
        "gmText": "A success can show it is off-route, moving oddly, or too clean to trust.",
        "suggestedSkills": [
          "Navigation",
          "Astronomy",
          "Survey"
        ],
        "clearProgress": 1,
        "risk": "The plotted correction starts bending toward the lure."
      },
      {
        "id": "mask-the-reply",
        "label": "Mask the Reply",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The Watchmaster keeps the ship from answering plainly while the signal is tested.",
        "gmText": "No socket/chat/combat creation; this is fictional stealth and review only.",
        "suggestedSkills": [
          "Stealth",
          "Signals",
          "Vigilance"
        ],
        "clearProgress": 1,
        "risk": "A careless echo may become a Threat seed."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-threat-attracted"
    ],
    "escalationRefs": [
      "consequence-signal-echo"
    ],
    "narration": {
      "onDeclare": "The beacon repeats a welcome pattern with nobody aboard willing to call it familiar.",
      "onSuccess": "Its friendly rhythm falls out of step with the true route, exposed as something to refuse.",
      "onFailure": "The signal brightens when the ship listens, as if pleased to be noticed.",
      "onHazardCleared": "The beacon fades astern, still calling to the course the crew chose not to take."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "threat",
      "major",
      "navigator",
      "watchmaster"
    ]
  },
  {
    "id": "hazard-aether-current-snare",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Aether Current Snare",
    "category": "route",
    "severity": "major",
    "publicText": "A slow aether current curls around the ship, making every efficient path cost more time than it should.",
    "playerSafeSummary": "The Route is being delayed; coordinated helm and engine work can break free before the delay sticks.",
    "gmText": "Use as a timing complication. Do not alter encounter clocks or route state automatically.",
    "triggerSources": [
      "route delay",
      "void current",
      "bad approach"
    ],
    "stationImpacts": {
      "navigator": {
        "publicText": "The Navigator must find the current’s edge before every efficient course loops back into delay.",
        "gmText": "Make route geometry the problem: arcs, eddies, and false shortcuts."
      },
      "engineer": {
        "publicText": "The Engineer can pulse the arkengine at the right moments to break the current’s grip.",
        "gmText": "This changes fictional momentum only; do not alter clocks or route state."
      }
    },
    "responseActions": [
      {
        "id": "sound-the-eddy-edge",
        "label": "Sound the Eddy Edge",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The Navigator maps where the current curls back on itself and marks the exit angle.",
        "gmText": "On success, give a concrete route around the snare; on failure, show lost time pressure.",
        "suggestedSkills": [
          "Navigation",
          "Survey",
          "Mathematics"
        ],
        "clearProgress": 1,
        "risk": "The chosen line looks shorter because it is part of the loop."
      },
      {
        "id": "pulse-through-the-snare",
        "label": "Pulse Through the Snare",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The Engineer times short drive pulses to push the ship across the current instead of along it.",
        "gmText": "Keep the arkengine effort descriptive and consequence refs reviewable.",
        "suggestedSkills": [
          "Engineering",
          "Timing",
          "Endurance"
        ],
        "clearProgress": 1,
        "risk": "A mistimed pulse feeds the current and costs more time."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-course-slip"
    ],
    "escalationRefs": [
      "consequence-hazard-escalation"
    ],
    "narration": {
      "onDeclare": "The aether current curls around the hull like a slow hand closing.",
      "onSuccess": "A timed pulse catches the eddy’s edge, and the ship slides toward open flow.",
      "onFailure": "The route marker comes around again, proving the ship has been moving in a beautiful circle.",
      "onHazardCleared": "The current falls behind as a dark curl on the chart."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "route",
      "major",
      "navigator",
      "engineer"
    ]
  },
  {
    "id": "hazard-starlit-static",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Starlit Static",
    "category": "occult",
    "severity": "severe",
    "publicText": "Static like distant stars fills speaking tubes and thoughts alike, blurring orders into half-heard memories.",
    "playerSafeSummary": "Occult interference threatens coordination and may escalate into Lifeveil, Morale, or Threat pressure.",
    "gmText": "This is the severe example. Keep mental effects evocative and consent-safe; apply nothing automatically.",
    "triggerSources": [
      "occult signal",
      "veil interference",
      "failed watch"
    ],
    "stationImpacts": {
      "veilwarden": {
        "publicText": "The Veilwarden must ground the Lifeveil before star-like static turns sensation and memory unreliable.",
        "gmText": "Keep mental interference evocative and consent-safe; do not impose character thoughts as facts."
      },
      "captain": {
        "publicText": "The Captain must simplify orders so the crew can act through broken voices and half-heard echoes.",
        "gmText": "Use short commands, hand signs, or repeated calls. Avoid GM-only reveals in public text."
      }
    },
    "responseActions": [
      {
        "id": "ground-the-star-noise",
        "label": "Ground the Star-Noise",
        "stationKeys": [
          "veilwarden"
        ],
        "publicText": "The Veilwarden anchors the Lifeveil so the static has somewhere harmless to go.",
        "gmText": "Success can clear sensory distortion while leaving any consequence application reviewed.",
        "suggestedSkills": [
          "Occult",
          "Lifeveil",
          "Meditation"
        ],
        "clearProgress": 1,
        "risk": "The static finds a sharper path through the breathable envelope."
      },
      {
        "id": "cut-orders-to-signals",
        "label": "Cut Orders to Signals",
        "stationKeys": [
          "captain"
        ],
        "publicText": "The Captain reduces commands to gestures, bells, and repeated phrases the static cannot easily twist.",
        "gmText": "This is a coordination response; no Focus, Morale, or chat state changes.",
        "suggestedSkills": [
          "Command",
          "Discipline",
          "Performance"
        ],
        "clearProgress": 1,
        "risk": "A misunderstood order sends help to the wrong station."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-lifeveil-flicker",
      "consequence-crew-panic"
    ],
    "escalationRefs": [
      "consequence-ship-scar-candidate"
    ],
    "narration": {
      "onDeclare": "Starlight crackles through the speaking tubes, and familiar voices arrive wearing the wrong memories.",
      "onSuccess": "The static drains into the veil in silver threads, leaving orders plain again.",
      "onFailure": "A command returns in someone else’s voice, and the deck hesitates.",
      "onHazardCleared": "The last star-spark gutters out, and the ship’s own sounds become trustworthy."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "occult",
      "severe",
      "veilwarden",
      "captain"
    ]
  },
  {
    "id": "hazard-predator-wake",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Predator Wake",
    "category": "threat",
    "severity": "major",
    "publicText": "Something large crossed here recently, and its wake still bends dust, light, and every quiet instrument aboard.",
    "playerSafeSummary": "A Threat may be close or returning; the Watchmaster can read the wake before the ship is noticed.",
    "gmText": "Do not create an encounter. This card only seeds a reviewed threat consequence if unresolved.",
    "triggerSources": [
      "threat trail",
      "failed stealth",
      "watch warning"
    ],
    "stationImpacts": {
      "watchmaster": {
        "publicText": "The Watchmaster can read the wake to tell whether the predator is gone, circling, or following.",
        "gmText": "Do not create combat; this is threat assessment and possible future seed only."
      },
      "navigator": {
        "publicText": "The Navigator can choose a line that crosses the wake quietly instead of running along it.",
        "gmText": "Make route choice matter without spawning scenes, tokens, or encounters."
      }
    },
    "responseActions": [
      {
        "id": "read-the-wake",
        "label": "Read the Wake",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The Watchmaster studies bent dust, warped light, and instrument drag for the predator’s direction.",
        "gmText": "A success reveals behavior, not a stat block or combat start.",
        "suggestedSkills": [
          "Tracking",
          "Vigilance",
          "Survival"
        ],
        "clearProgress": 1,
        "risk": "The wake is misread as old when it is still being made."
      },
      {
        "id": "cut-the-signature",
        "label": "Cut the Signature",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The Navigator plots a quiet crossing that keeps the ship’s signature out of the wake’s strongest pull.",
        "gmText": "Use this to avoid being interesting; any Threat consequence remains a review candidate.",
        "suggestedSkills": [
          "Navigation",
          "Stealth",
          "Survey"
        ],
        "clearProgress": 1,
        "risk": "The ship travels exactly where a hunter expects noise."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-threat-attracted"
    ],
    "escalationRefs": [
      "consequence-hazard-escalation"
    ],
    "narration": {
      "onDeclare": "Dust and light bend in the shape of something huge that passed too recently.",
      "onSuccess": "The ship slips across the wake at an angle too quiet to follow easily.",
      "onFailure": "The wake trembles in answer, as if something ahead just turned its head.",
      "onHazardCleared": "The last distortion straightens behind the ship, leaving no obvious trail."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "threat",
      "major",
      "watchmaster",
      "navigator"
    ]
  },
  {
    "id": "hazard-dead-air-pocket",
    "schemaVersion": "travel-v2-card-schema-v0",
    "type": "hazard",
    "title": "Dead-Air Pocket",
    "category": "navigation",
    "severity": "minor",
    "publicText": "The ship slips into a dead-air pocket where helm feel, Lifeveil shimmer, and route signs all go dull.",
    "playerSafeSummary": "Navigation and veil readings are muted; careful station checks can find the edge before drift sets in.",
    "gmText": "Use quiet and absence. It can point to Route or Lifeveil pressure, but no values change here.",
    "triggerSources": [
      "dead zone",
      "void weather",
      "navigation silence"
    ],
    "stationImpacts": {
      "navigator": {
        "publicText": "The Navigator loses helm feel and must find the pocket’s edge without trusting dead instruments.",
        "gmText": "Make absence the signal: no pull, no drift, no reassuring response."
      },
      "veilwarden": {
        "publicText": "The Veilwarden can test the Lifeveil’s dull shimmer to keep the breathable envelope centered.",
        "gmText": "Frame the veil as muted rather than broken; pressure only follows if unresolved."
      }
    },
    "responseActions": [
      {
        "id": "feel-for-the-edge",
        "label": "Feel for the Edge",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The Navigator uses tiny course tests and delayed responses to feel where dead air gives way.",
        "gmText": "A success gives direction through absence; do not adjust route state automatically.",
        "suggestedSkills": [
          "Navigation",
          "Piloting",
          "Patience"
        ],
        "clearProgress": 1,
        "risk": "A correction vanishes into the pocket and returns too late."
      },
      {
        "id": "sound-the-muted-veil",
        "label": "Sound the Muted Veil",
        "stationKeys": [
          "veilwarden"
        ],
        "publicText": "The Veilwarden checks the Lifeveil by touch and breath when sight and instruments go dull.",
        "gmText": "Keep it sensory and safe: warmth, pressure, breath, and shimmer.",
        "suggestedSkills": [
          "Lifeveil",
          "Sense",
          "Occult"
        ],
        "clearProgress": 1,
        "risk": "The veil feels centered until the ship discovers it has drifted."
      }
    ],
    "clearCondition": {
      "type": "progress",
      "neededProgress": 2,
      "publicText": "Clear when the crew earns enough response progress to make the hazard safe.",
      "gmText": "Two meaningful successful responses are a suggested table threshold only."
    },
    "suppressionCondition": {
      "type": "temporary-control",
      "publicText": "Suppress for a round when one station contains the immediate danger while another prepares the clear.",
      "gmText": "Suppression is descriptive and should not mutate encounter state."
    },
    "unresolvedConsequenceRefs": [
      "consequence-course-slip",
      "consequence-veil-draft"
    ],
    "escalationRefs": [
      "consequence-hazard-escalation"
    ],
    "narration": {
      "onDeclare": "Sound falls flat, the helm goes numb, and the Lifeveil glow dulls to a tired blur.",
      "onSuccess": "A delayed tug answers from one side, enough to find the pocket’s edge.",
      "onFailure": "The ship moves, but nothing in the dead air admits which way.",
      "onHazardCleared": "Noise and helm-feel return together, startling in their warmth."
    },
    "tags": [
      "travel-v2",
      "hazard",
      "gold-standard",
      "navigation",
      "minor",
      "navigator",
      "veilwarden"
    ]
  }
]
);

function cloneTravelV2GoldStandardHazardCard(card) {
  if (card === undefined) return undefined;
  return JSON.parse(JSON.stringify(card));
}

export function getTravelV2GoldStandardHazardCards() {
  return TRAVEL_V2_GOLD_STANDARD_HAZARD_CARDS.map((card) => cloneTravelV2GoldStandardHazardCard(card));
}

export function getTravelV2GoldStandardHazardCardById(id) {
  return getTravelV2GoldStandardHazardCards().find((card) => card.id === id) ?? null;
}

export function getTravelV2GoldStandardHazardCardsByCategory(category) {
  return getTravelV2GoldStandardHazardCards().filter((card) => card.category === category);
}

export function getTravelV2GoldStandardHazardCardsBySeverity(severity) {
  return getTravelV2GoldStandardHazardCards().filter((card) => card.severity === severity);
}
