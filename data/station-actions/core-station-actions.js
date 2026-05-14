function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }

  return value;
}

function stationAction({
  key,
  name,
  stationKey,
  phase = "both",
  apCost = 1,
  rapCost = 0,
  requiredCrewRole,
  description,
  trigger = "Future station-action UI or backend chooses when this data-only action is offered.",
  requirements = [],
  effectsPreview = [],
  tags = [],
  rollOptions = [],
  criticalSuccess,
  success,
  failure,
  criticalFailure,
  futureAutomationNotes = "Data-only station action definition. No action execution, AP/RAP spend, actor mutation, combat round, travel automation, or weapon firing is implemented."
}) {
  return deepFreeze({
    key,
    name,
    stationKey,
    phase,
    actionType: "stationAction",
    apCost,
    rapCost,
    requiredCrewRole,
    description,
    trigger,
    requirements,
    effectsPreview,
    rollOptions,
    criticalSuccess,
    success,
    failure,
    criticalFailure,
    tags,
    futureAutomationNotes
  });
}

export const CORE_STATION_ACTIONS = Object.freeze({
  "rally-crew": stationAction({
    key: "rally-crew",
    rollOptions: [
      { key: "diplomacy", label: "Diplomacy", statisticKey: "diplomacy" },
      { key: "intimidation", label: "Intimidation", statisticKey: "intimidation" }
    ],
    criticalSuccess: "Crew morale surges; the order spreads cleanly across the ship.",
    success: "The crew steadies and responds to command.",
    failure: "The order lands unevenly; hesitation remains.",
    criticalFailure: "Confusion spreads and discipline falters.",
    name: "Rally Crew",
    stationKey: "captain",
    phase: "both",
    requiredCrewRole: "Captain",
    description: "The Captain steadies morale and focuses shipboard crew on the next immediate priority.",
    requirements: ["An assigned Captain station crew member."],
    effectsPreview: ["Future morale or crew-condition support hook."],
    tags: ["captain", "morale", "crew", "support"]
  }),
  "coordinate-orders": stationAction({
    key: "coordinate-orders",
    rollOptions: [
      { key: "society", label: "Society", statisticKey: "society" },
      { key: "diplomacy", label: "Diplomacy", statisticKey: "diplomacy" }
    ],
    criticalSuccess: "Stations align quickly and priorities are clearly understood.",
    success: "The command plan is understood and ready for use.",
    failure: "Orders compete for attention; coordination remains loose.",
    criticalFailure: "Mixed signals disrupt the shipwide command rhythm.",
    name: "Coordinate Orders",
    stationKey: "captain",
    phase: "both",
    requiredCrewRole: "Captain",
    description: "The Captain aligns station priorities so a future ship action can be resolved with clearer command intent.",
    requirements: ["An assigned Captain station crew member."],
    effectsPreview: ["Future command coordination or station-assist hook."],
    tags: ["captain", "command", "coordination", "support"]
  }),
  "adjust-facing": stationAction({
    key: "adjust-facing",
    rollOptions: [
      { key: "piloting-lore", label: "Piloting Lore", statisticKey: "piloting-lore" },
      { key: "acrobatics", label: "Acrobatics", statisticKey: "acrobatics" },
      { key: "reflex", label: "Reflex", statisticKey: "reflex" }
    ],
    criticalSuccess: "The ship comes about cleanly into the intended posture.",
    success: "The ship adjusts toward the chosen facing.",
    failure: "The adjustment is slow or awkward.",
    criticalFailure: "The maneuver overcorrects and leaves the ship poorly aligned.",
    name: "Adjust Facing",
    stationKey: "pilot",
    phase: "combat",
    requiredCrewRole: "Pilot / Helm",
    description: "The Pilot adjusts the ship's facing for future tactical movement, arcs, or positioning systems.",
    requirements: ["An assigned Pilot / Helm station crew member."],
    effectsPreview: ["Future heading, facing, or weapon-arc positioning hook."],
    tags: ["pilot", "helm", "movement", "facing", "combat"]
  }),
  "evasive-maneuver": stationAction({
    key: "evasive-maneuver",
    rollOptions: [
      { key: "acrobatics", label: "Acrobatics", statisticKey: "acrobatics" },
      { key: "piloting-lore", label: "Piloting Lore", statisticKey: "piloting-lore" }
    ],
    criticalSuccess: "The ship settles into a sharp defensive rhythm.",
    success: "The pilot establishes a steadier defensive posture.",
    failure: "The maneuver is uneven and hard to sustain.",
    criticalFailure: "The evasive pattern breaks down at a critical moment.",
    name: "Evasive Maneuver",
    stationKey: "pilot",
    phase: "combat",
    requiredCrewRole: "Pilot / Helm",
    description: "The Pilot sets a defensive handling posture for future ship combat resolution.",
    requirements: ["An assigned Pilot / Helm station crew member."],
    effectsPreview: ["Future defense, handling, or incoming-attack modifier hook."],
    tags: ["pilot", "helm", "movement", "defense", "combat"]
  }),
  "stabilize-strain": stationAction({
    key: "stabilize-strain",
    rollOptions: [
      { key: "crafting", label: "Crafting", statisticKey: "crafting" },
      { key: "arcana", label: "Arcana", statisticKey: "arcana" }
    ],
    criticalSuccess: "Systems settle and unstable pressure is cleanly contained.",
    success: "The engineer steadies the strained systems.",
    failure: "Pressure remains difficult to control.",
    criticalFailure: "A surge of instability runs through the affected systems.",
    name: "Stabilize Strain",
    stationKey: "engineer",
    phase: "both",
    requiredCrewRole: "Engineer",
    description: "The Engineer monitors unstable pressure and prepares future strain stabilization work.",
    requirements: ["An assigned Engineer station crew member."],
    effectsPreview: ["Future strain recovery, mitigation, or repair hook."],
    tags: ["engineer", "strain", "repair", "support"]
  }),
  "hard-burn-prep": stationAction({
    key: "hard-burn-prep",
    rollOptions: [
      { key: "arcana", label: "Arcana", statisticKey: "arcana" },
      { key: "crafting", label: "Crafting", statisticKey: "crafting" }
    ],
    criticalSuccess: "The arkengine is primed for a clean high-output push.",
    success: "The arkengine is prepared for harder running.",
    failure: "Preparation is incomplete and the engine remains temperamental.",
    criticalFailure: "The prep introduces new instability into the engine cadence.",
    name: "Hard Burn Prep",
    stationKey: "engineer",
    phase: "travel",
    requiredCrewRole: "Engineer",
    description: "The Engineer prepares arkengine systems for a future hard burn or high-output travel maneuver.",
    requirements: ["An assigned Engineer station crew member.", "Installed arkengine data available on the ship."],
    effectsPreview: ["Future hard burn setup, fuel, or strain-risk hook."],
    tags: ["engineer", "arkengine", "hard-burn", "travel"]
  }),
  "ready-broadside": stationAction({
    key: "ready-broadside",
    rollOptions: [
      { key: "warfare-lore", label: "Warfare Lore", statisticKey: "warfare-lore" },
      { key: "perception", label: "Perception", statisticKey: "perception" }
    ],
    criticalSuccess: "The crew readies the volley with crisp timing and clear lanes.",
    success: "The broadside is brought into a ready posture.",
    failure: "Readiness is uneven across the weapon teams.",
    criticalFailure: "The volley drill tangles and timing breaks down.",
    name: "Ready Broadside",
    stationKey: "gunnery",
    phase: "combat",
    requiredCrewRole: "Gunnery Officer",
    description: "The Gunnery station readies a coordinated volley for future weapon combat systems.",
    requirements: ["An assigned Gunnery station crew member.", "Installed ship weapon data available on the ship."],
    effectsPreview: ["Future multi-weapon readiness or volley coordination hook."],
    tags: ["gunnery", "weapons", "broadside", "combat"]
  }),
  "aim-weapon": stationAction({
    key: "aim-weapon",
    rollOptions: [
      { key: "perception", label: "Perception", statisticKey: "perception" },
      { key: "warfare-lore", label: "Warfare Lore", statisticKey: "warfare-lore" }
    ],
    criticalSuccess: "The target picture snaps into focus.",
    success: "The weapon crew establishes a workable aim.",
    failure: "The aim is uncertain and needs correction.",
    criticalFailure: "The weapon is misaligned at a crucial moment.",
    name: "Aim Weapon",
    stationKey: "gunnery",
    phase: "combat",
    requiredCrewRole: "Gunnery Officer",
    description: "The Gunnery station focuses a selected weapon or arc for future targeting systems.",
    requirements: ["An assigned Gunnery station crew member.", "A future selected installed weapon or firing arc."],
    effectsPreview: ["Future aim, targeting, or attack-support hook."],
    tags: ["gunnery", "weapons", "aim", "targeting", "combat"]
  }),
  "reinforce-lifeveil": stationAction({
    key: "reinforce-lifeveil",
    rollOptions: [
      { key: "occultism", label: "Occultism", statisticKey: "occultism" },
      { key: "arcana", label: "Arcana", statisticKey: "arcana" },
      { key: "religion", label: "Religion", statisticKey: "religion" }
    ],
    criticalSuccess: "The Lifeveil firms with reassuring clarity.",
    success: "The Lifeveil is reinforced against immediate pressure.",
    failure: "The reinforcement is thin and uneven.",
    criticalFailure: "The Lifeveil shudders and its stability falters.",
    name: "Reinforce Lifeveil",
    stationKey: "veilwarden",
    phase: "both",
    requiredCrewRole: "Veilwarden",
    description: "The Veilwarden shores up Lifeveil stability against future hazards, occult pressure, or hostile effects.",
    requirements: ["An assigned Veilwarden station crew member."],
    effectsPreview: ["Future Lifeveil defense, recovery, or mitigation hook."],
    tags: ["veilwarden", "lifeveil", "defense", "occult"]
  }),
  "damp-occult-surge": stationAction({
    key: "damp-occult-surge",
    rollOptions: [
      { key: "occultism", label: "Occultism", statisticKey: "occultism" },
      { key: "religion", label: "Religion", statisticKey: "religion" }
    ],
    criticalSuccess: "The surge is cleanly smothered before it spreads.",
    success: "The surge is damped to a manageable level.",
    failure: "The surge resists containment.",
    criticalFailure: "The occult pressure rebounds through the ship.",
    name: "Damp Occult Surge",
    stationKey: "veilwarden",
    phase: "both",
    requiredCrewRole: "Veilwarden",
    description: "The Veilwarden counters an unstable occult surge before future automation resolves its consequences.",
    requirements: ["An assigned Veilwarden station crew member.", "A future occult surge, anomaly, or hazard trigger."],
    effectsPreview: ["Future occult-hazard suppression or consequence-reduction hook."],
    tags: ["veilwarden", "occult", "hazard", "support"]
  }),
  "scan-threats": stationAction({
    key: "scan-threats",
    rollOptions: [
      { key: "perception", label: "Perception", statisticKey: "perception" },
      { key: "survival", label: "Survival", statisticKey: "survival" }
    ],
    criticalSuccess: "Threat signs stand out clearly to the watch.",
    success: "The watch identifies useful signs of danger.",
    failure: "The scan returns uncertain or incomplete reads.",
    criticalFailure: "The watch misreads the situation and misses key cues.",
    name: "Scan Threats",
    stationKey: "watchmaster",
    phase: "both",
    requiredCrewRole: "Watchmaster",
    description: "The Watchmaster surveys nearby danger for future detection, scouting, or encounter-state systems.",
    requirements: ["An assigned Watchmaster station crew member."],
    effectsPreview: ["Future detection, sensor, or threat-awareness hook."],
    tags: ["watchmaster", "detection", "scouting", "threats"]
  }),
  "call-target": stationAction({
    key: "call-target",
    rollOptions: [
      { key: "perception", label: "Perception", statisticKey: "perception" },
      { key: "warfare-lore", label: "Warfare Lore", statisticKey: "warfare-lore" }
    ],
    criticalSuccess: "The priority target is called with decisive clarity.",
    success: "The target call gives the crew a clear focus.",
    failure: "The call is muddled or slow to take hold.",
    criticalFailure: "The call points the crew toward the wrong opening.",
    name: "Call Target",
    stationKey: "watchmaster",
    phase: "combat",
    requiredCrewRole: "Watchmaster",
    description: "The Watchmaster identifies a priority target for future tactical coordination.",
    requirements: ["An assigned Watchmaster station crew member.", "A future target or threat context."],
    effectsPreview: ["Future target marking or ally coordination hook."],
    tags: ["watchmaster", "targeting", "coordination", "combat"]
  }),
  "secure-cargo": stationAction({
    key: "secure-cargo",
    rollOptions: [
      { key: "crafting", label: "Crafting", statisticKey: "crafting" },
      { key: "athletics", label: "Athletics", statisticKey: "athletics" }
    ],
    criticalSuccess: "Cargo is braced with excellent coverage and access.",
    success: "Cargo is secured well enough for current conditions.",
    failure: "Some cargo remains poorly placed or vulnerable.",
    criticalFailure: "The securing effort creates clutter and weak points.",
    name: "Secure Cargo",
    stationKey: "quartermaster",
    phase: "both",
    requiredCrewRole: "Quartermaster",
    description: "The Quartermaster secures stores and cargo before future hazards, maneuvers, or boarding pressure are resolved.",
    requirements: ["An assigned Quartermaster station crew member."],
    effectsPreview: ["Future cargo-loss prevention or logistics hazard hook."],
    tags: ["quartermaster", "cargo", "logistics", "support"]
  }),
  "manage-supplies": stationAction({
    key: "manage-supplies",
    rollOptions: [
      { key: "society", label: "Society", statisticKey: "society" },
      { key: "survival", label: "Survival", statisticKey: "survival" }
    ],
    criticalSuccess: "Stores are organized with a clear surplus path.",
    success: "Supplies are accounted for and ready to manage.",
    failure: "The audit leaves gaps and uncertain counts.",
    criticalFailure: "The supply picture becomes confused and unreliable.",
    name: "Manage Supplies",
    stationKey: "quartermaster",
    phase: "travel",
    requiredCrewRole: "Quartermaster",
    description: "The Quartermaster audits stores for future supply, recovery, or travel attrition systems.",
    requirements: ["An assigned Quartermaster station crew member."],
    effectsPreview: ["Future supply consumption, recovery, or attrition hook."],
    tags: ["quartermaster", "supplies", "logistics", "travel"]
  })
});

export const CORE_STATION_ACTION_KEYS = Object.freeze(Object.keys(CORE_STATION_ACTIONS));

const STATION_ACTION_OUTCOME_DEGREES = Object.freeze({
  3: { key: "criticalSuccess", label: "Critical Success" },
  2: { key: "success", label: "Success" },
  1: { key: "failure", label: "Failure" },
  0: { key: "criticalFailure", label: "Critical Failure" }
});

const STATION_ACTION_OUTCOME_ALIASES = Object.freeze({
  criticalsuccess: 3,
  critical_success: 3,
  "critical-success": 3,
  critsuccess: 3,
  "crit-success": 3,
  success: 2,
  failure: 1,
  criticalfailure: 0,
  critical_failure: 0,
  "critical-failure": 0,
  critfailure: 0,
  "crit-failure": 0
});

function normalizeDegreeOfSuccess(degreeOfSuccess) {
  if (degreeOfSuccess === null || degreeOfSuccess === undefined) return null;
  if (typeof degreeOfSuccess === "string" && degreeOfSuccess.trim() === "") return null;
  if (Number.isInteger(degreeOfSuccess) && STATION_ACTION_OUTCOME_DEGREES[degreeOfSuccess]) return degreeOfSuccess;

  const numericDegree = Number(degreeOfSuccess);
  if (Number.isInteger(numericDegree) && STATION_ACTION_OUTCOME_DEGREES[numericDegree]) return numericDegree;

  const alias = String(degreeOfSuccess).trim().replace(/\s+/g, "-").toLowerCase();
  return STATION_ACTION_OUTCOME_ALIASES[alias] ?? null;
}

function getRollResultDegreeOfSuccess(rollResult) {
  const candidates = [
    rollResult?.degreeOfSuccess,
    rollResult?.degree,
    rollResult?.outcome,
    rollResult?.roll?.degreeOfSuccess,
    rollResult?.roll?.degree,
    rollResult?.roll?.outcome
  ];

  for (const candidate of candidates) {
    const normalizedDegree = normalizeDegreeOfSuccess(candidate);
    if (normalizedDegree !== null) return normalizedDegree;
  }

  return null;
}

export function getStationActionOutcome(actionKey, degreeOfSuccess) {
  const action = getCoreStationAction(actionKey);
  const normalizedDegree = normalizeDegreeOfSuccess(degreeOfSuccess);
  const outcomeDefinition = normalizedDegree === null ? null : STATION_ACTION_OUTCOME_DEGREES[normalizedDegree];

  if (!action || !outcomeDefinition) {
    return {
      actionKey,
      degreeOfSuccess: normalizedDegree,
      outcomeKey: "unresolved",
      label: "Unresolved",
      text: "Unresolved"
    };
  }

  return {
    actionKey: action.key,
    degreeOfSuccess: normalizedDegree,
    outcomeKey: outcomeDefinition.key,
    label: outcomeDefinition.label,
    text: action[outcomeDefinition.key] || "Unresolved"
  };
}

export function previewStationActionOutcome(actionKey, rollResult) {
  return getStationActionOutcome(actionKey, getRollResultDegreeOfSuccess(rollResult));
}

export function getCoreStationAction(key) {
  return CORE_STATION_ACTIONS[key] ?? null;
}

export function getCoreStationActionKeys() {
  return CORE_STATION_ACTION_KEYS;
}

export function getCoreStationActions() {
  return CORE_STATION_ACTIONS;
}

export function getCoreStationActionsForStation(stationKey) {
  return CORE_STATION_ACTION_KEYS
    .map((key) => CORE_STATION_ACTIONS[key])
    .filter((action) => action.stationKey === stationKey);
}

export function getStationActionRollOptions(actionKey) {
  const action = getCoreStationAction(actionKey);
  return Array.isArray(action?.rollOptions) ? action.rollOptions : [];
}
