const PRESSURE_BREACH_HAZARD_DEFINITION_MISSING =
  "pressure-breach-hazard-definition-missing";

const NONE_ESCALATION = {
  mode: "none",
  currentStageId: null,
  stages: [],
  countdown: null,
  maximumEscalationReached: false,
  escalationConsequence: null
};

const NONE_DURATION = {
  mode: "none",
  remaining: null,
  initial: null,
  decrementTiming: null
};

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function clonePlainData(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => clonePlainData(entry));
  const clone = {};
  for (const key of Object.keys(value)) clone[key] = clonePlainData(value[key]);
  return clone;
}

function issue(path, message) {
  return {
    code: PRESSURE_BREACH_HAZARD_DEFINITION_MISSING,
    path,
    message,
    severity: "error"
  };
}

function definition({
  effectId,
  effectName,
  effectDescription,
  ignoredConsequenceId,
  ignoredConsequenceName,
  ignoredConsequenceDescription,
  collisionConsequenceId,
  collisionConsequenceName,
  collisionConsequenceDescription
}) {
  return {
    currentEffect: {
      effectId,
      name: effectName,
      description: effectDescription
    },
    activationTiming: {
      kind: "start-of-next-round",
      stationId: null,
      resultId: null
    },
    removalMethod: {
      methodId: "address-hazard",
      name: "Address Hazard"
    },
    ignoredConsequence: {
      consequenceId: ignoredConsequenceId,
      name: ignoredConsequenceName,
      description: ignoredConsequenceDescription
    },
    escalation: clonePlainData(NONE_ESCALATION),
    collisionPolicy: "trigger-existing-consequence",
    duration: clonePlainData(NONE_DURATION),
    metadata: {
      collision: {
        consequence: {
          consequenceId: collisionConsequenceId,
          name: collisionConsequenceName,
          description: collisionConsequenceDescription
        }
      }
    }
  };
}

export const VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS = deepFreeze({
  "crew-morale": definition({
    effectId: "crew-morale-fracture",
    effectName: "Crew Morale Fracture",
    effectDescription: "The crew remains shaken and under mounting morale strain until the Hazard is addressed.",
    ignoredConsequenceId: "crew-morale-fracture-ignored",
    ignoredConsequenceName: "Crew Morale Fracture Ignored",
    ignoredConsequenceDescription: "The unresolved morale fracture applies its authored closeout consequence.",
    collisionConsequenceId: "crew-morale-repeat-breach",
    collisionConsequenceName: "Crew Morale Repeated Breach",
    collisionConsequenceDescription: "A repeated Crew Morale breach triggers the existing Hazard's authored consequence."
  }),
  arkengine: definition({
    effectId: "arkengine-instability",
    effectName: "Arkengine Instability",
    effectDescription: "The Arkengine remains dangerously unstable until the Hazard is addressed.",
    ignoredConsequenceId: "arkengine-instability-ignored",
    ignoredConsequenceName: "Arkengine Instability Ignored",
    ignoredConsequenceDescription: "The unresolved Arkengine instability applies its authored closeout consequence.",
    collisionConsequenceId: "arkengine-repeat-breach",
    collisionConsequenceName: "Arkengine Repeated Breach",
    collisionConsequenceDescription: "A repeated Arkengine breach triggers the existing Hazard's authored consequence."
  }),
  "levstone-array": definition({
    effectId: "levstone-gravity-shear",
    effectName: "Levstone Gravity Shear",
    effectDescription: "The levstone array remains trapped in dangerous gravitational shear until the Hazard is addressed.",
    ignoredConsequenceId: "levstone-gravity-shear-ignored",
    ignoredConsequenceName: "Levstone Gravity Shear Ignored",
    ignoredConsequenceDescription: "The unresolved gravity shear applies its authored closeout consequence.",
    collisionConsequenceId: "levstone-array-repeat-breach",
    collisionConsequenceName: "Levstone Array Repeated Breach",
    collisionConsequenceDescription: "A repeated Levstone Array breach triggers the existing Hazard's authored consequence."
  }),
  "solar-sail-rig": definition({
    effectId: "solar-sail-desynchronization",
    effectName: "Solar-Sail Desynchronization",
    effectDescription: "The solar-sail rig remains dangerously desynchronized until the Hazard is addressed.",
    ignoredConsequenceId: "solar-sail-desynchronization-ignored",
    ignoredConsequenceName: "Solar-Sail Desynchronization Ignored",
    ignoredConsequenceDescription: "The unresolved sail desynchronization applies its authored closeout consequence.",
    collisionConsequenceId: "solar-sail-rig-repeat-breach",
    collisionConsequenceName: "Solar-Sail Rig Repeated Breach",
    collisionConsequenceDescription: "A repeated Solar-Sail Rig breach triggers the existing Hazard's authored consequence."
  }),
  lifeveil: definition({
    effectId: "lifeveil-collapse",
    effectName: "Lifeveil Collapse",
    effectDescription: "The Lifeveil remains critically unstable until the Hazard is addressed.",
    ignoredConsequenceId: "lifeveil-collapse-ignored",
    ignoredConsequenceName: "Lifeveil Collapse Ignored",
    ignoredConsequenceDescription: "The unresolved Lifeveil collapse applies its authored closeout consequence.",
    collisionConsequenceId: "lifeveil-repeat-breach",
    collisionConsequenceName: "Lifeveil Repeated Breach",
    collisionConsequenceDescription: "A repeated Lifeveil breach triggers the existing Hazard's authored consequence."
  })
});

export function getVoyagePressureBreachHazardDefinition(pressureSystemId) {
  if (
    typeof pressureSystemId !== "string"
    || pressureSystemId.trim().length === 0
    || !Object.hasOwn(VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS, pressureSystemId)
  ) {
    return {
      ok: false,
      definition: null,
      errors: [issue(
        "$.pressureSystemId",
        "No authored Pressure-system Hazard definition exists for this pressureSystemId."
      )],
      warnings: []
    };
  }

  return {
    ok: true,
    definition: clonePlainData(VOYAGE_PRESSURE_BREACH_HAZARD_DEFINITIONS[pressureSystemId]),
    errors: [],
    warnings: []
  };
}
