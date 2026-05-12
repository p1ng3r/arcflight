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
    tags,
    futureAutomationNotes
  });
}

export const CORE_STATION_ACTIONS = Object.freeze({
  "rally-crew": stationAction({
    key: "rally-crew",
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
