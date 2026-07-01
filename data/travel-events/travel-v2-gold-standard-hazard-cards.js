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
        "publicText": "Navigator has a clear reason to respond to Void Shear.",
        "gmText": "Invite the navigator to describe a table-facing response; this is guidance only."
      },
      "watchmaster": {
        "publicText": "Watchmaster has a clear reason to respond to Void Shear.",
        "gmText": "Invite the watchmaster to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The navigator identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The watchmaster buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Void Shear.",
      "onSuccess": "Void Shear loosens its grip.",
      "onFailure": "Void Shear presses harder.",
      "onHazardCleared": "Void Shear is brought under control."
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
        "publicText": "Engineer has a clear reason to respond to Arkengine Cough.",
        "gmText": "Invite the engineer to describe a table-facing response; this is guidance only."
      },
      "captain": {
        "publicText": "Captain has a clear reason to respond to Arkengine Cough.",
        "gmText": "Invite the captain to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The engineer identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "captain"
        ],
        "publicText": "The captain buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Arkengine Cough.",
      "onSuccess": "Arkengine Cough loosens its grip.",
      "onFailure": "Arkengine Cough presses harder.",
      "onHazardCleared": "Arkengine Cough is brought under control."
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
        "publicText": "Veilwarden has a clear reason to respond to Lifeveil Thinspot.",
        "gmText": "Invite the veilwarden to describe a table-facing response; this is guidance only."
      },
      "engineer": {
        "publicText": "Engineer has a clear reason to respond to Lifeveil Thinspot.",
        "gmText": "Invite the engineer to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "veilwarden"
        ],
        "publicText": "The veilwarden identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The engineer buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Lifeveil Thinspot.",
      "onSuccess": "Lifeveil Thinspot loosens its grip.",
      "onFailure": "Lifeveil Thinspot presses harder.",
      "onHazardCleared": "Lifeveil Thinspot is brought under control."
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
        "publicText": "Watchmaster has a clear reason to respond to Hull-Song Stress.",
        "gmText": "Invite the watchmaster to describe a table-facing response; this is guidance only."
      },
      "engineer": {
        "publicText": "Engineer has a clear reason to respond to Hull-Song Stress.",
        "gmText": "Invite the engineer to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The watchmaster identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The engineer buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Hull-Song Stress.",
      "onSuccess": "Hull-Song Stress loosens its grip.",
      "onFailure": "Hull-Song Stress presses harder.",
      "onHazardCleared": "Hull-Song Stress is brought under control."
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
        "publicText": "Captain has a clear reason to respond to Crew on Edge.",
        "gmText": "Invite the captain to describe a table-facing response; this is guidance only."
      },
      "watchmaster": {
        "publicText": "Watchmaster has a clear reason to respond to Crew on Edge.",
        "gmText": "Invite the watchmaster to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "captain"
        ],
        "publicText": "The captain identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The watchmaster buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Crew on Edge.",
      "onSuccess": "Crew on Edge loosens its grip.",
      "onFailure": "Crew on Edge presses harder.",
      "onHazardCleared": "Crew on Edge is brought under control."
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
        "publicText": "Watchmaster has a clear reason to respond to Cargo Break-Loose.",
        "gmText": "Invite the watchmaster to describe a table-facing response; this is guidance only."
      },
      "engineer": {
        "publicText": "Engineer has a clear reason to respond to Cargo Break-Loose.",
        "gmText": "Invite the engineer to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The watchmaster identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The engineer buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Cargo Break-Loose.",
      "onSuccess": "Cargo Break-Loose loosens its grip.",
      "onFailure": "Cargo Break-Loose presses harder.",
      "onHazardCleared": "Cargo Break-Loose is brought under control."
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
        "publicText": "Captain has a clear reason to respond to Stores Jam.",
        "gmText": "Invite the captain to describe a table-facing response; this is guidance only."
      },
      "watchmaster": {
        "publicText": "Watchmaster has a clear reason to respond to Stores Jam.",
        "gmText": "Invite the watchmaster to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "captain"
        ],
        "publicText": "The captain identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The watchmaster buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Stores Jam.",
      "onSuccess": "Stores Jam loosens its grip.",
      "onFailure": "Stores Jam presses harder.",
      "onHazardCleared": "Stores Jam is brought under control."
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
        "publicText": "Navigator has a clear reason to respond to Phantom Beacon.",
        "gmText": "Invite the navigator to describe a table-facing response; this is guidance only."
      },
      "watchmaster": {
        "publicText": "Watchmaster has a clear reason to respond to Phantom Beacon.",
        "gmText": "Invite the watchmaster to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The navigator identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The watchmaster buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Phantom Beacon.",
      "onSuccess": "Phantom Beacon loosens its grip.",
      "onFailure": "Phantom Beacon presses harder.",
      "onHazardCleared": "Phantom Beacon is brought under control."
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
        "publicText": "Navigator has a clear reason to respond to Aether Current Snare.",
        "gmText": "Invite the navigator to describe a table-facing response; this is guidance only."
      },
      "engineer": {
        "publicText": "Engineer has a clear reason to respond to Aether Current Snare.",
        "gmText": "Invite the engineer to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The navigator identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "engineer"
        ],
        "publicText": "The engineer buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Aether Current Snare.",
      "onSuccess": "Aether Current Snare loosens its grip.",
      "onFailure": "Aether Current Snare presses harder.",
      "onHazardCleared": "Aether Current Snare is brought under control."
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
        "publicText": "Veilwarden has a clear reason to respond to Starlit Static.",
        "gmText": "Invite the veilwarden to describe a table-facing response; this is guidance only."
      },
      "captain": {
        "publicText": "Captain has a clear reason to respond to Starlit Static.",
        "gmText": "Invite the captain to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "veilwarden"
        ],
        "publicText": "The veilwarden identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "captain"
        ],
        "publicText": "The captain buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Starlit Static.",
      "onSuccess": "Starlit Static loosens its grip.",
      "onFailure": "Starlit Static presses harder.",
      "onHazardCleared": "Starlit Static is brought under control."
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
        "publicText": "Watchmaster has a clear reason to respond to Predator Wake.",
        "gmText": "Invite the watchmaster to describe a table-facing response; this is guidance only."
      },
      "navigator": {
        "publicText": "Navigator has a clear reason to respond to Predator Wake.",
        "gmText": "Invite the navigator to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "watchmaster"
        ],
        "publicText": "The watchmaster identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The navigator buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Predator Wake.",
      "onSuccess": "Predator Wake loosens its grip.",
      "onFailure": "Predator Wake presses harder.",
      "onHazardCleared": "Predator Wake is brought under control."
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
        "publicText": "Navigator has a clear reason to respond to Dead-Air Pocket.",
        "gmText": "Invite the navigator to describe a table-facing response; this is guidance only."
      },
      "veilwarden": {
        "publicText": "Veilwarden has a clear reason to respond to Dead-Air Pocket.",
        "gmText": "Invite the veilwarden to describe a table-facing response; this is guidance only."
      }
    },
    "responseActions": [
      {
        "id": "read-the-danger",
        "label": "Read the Danger",
        "stationKeys": [
          "navigator"
        ],
        "publicText": "The navigator identifies what must be handled first.",
        "gmText": "Use to reveal practical handling details without exposing hidden notes.",
        "suggestedSkills": [
          "Survey",
          "Sense",
          "Command"
        ],
        "clearProgress": 1,
        "risk": "A weak read leaves the hazard active."
      },
      {
        "id": "steady-the-ship",
        "label": "Steady the Ship",
        "stationKeys": [
          "veilwarden"
        ],
        "publicText": "The veilwarden buys time or stability for the response.",
        "gmText": "Support a clear attempt or reduce fictional pressure; do not apply mechanics automatically.",
        "suggestedSkills": [
          "Repair",
          "Coordinate",
          "Endure"
        ],
        "clearProgress": 1,
        "risk": "Delay may point to an unresolved consequence."
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
      "onDeclare": "The crew turns toward Dead-Air Pocket.",
      "onSuccess": "Dead-Air Pocket loosens its grip.",
      "onFailure": "Dead-Air Pocket presses harder.",
      "onHazardCleared": "Dead-Air Pocket is brought under control."
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
