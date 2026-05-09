import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";

export const ARCFLIGHT_SHIP_ACTOR_TYPE = "arcflightShip";

export const arcflightShipDefaults = Object.freeze({
  identity: Object.freeze({
    vesselClass: "",
    registry: "",
    callsign: "",
    owner: "",
    origin: ""
  }),
  installedSystems: Object.freeze({
    hull: "",
    arkengine: "",
    weapons: "",
    arkengineMods: "",
    rooms: "",
    cargo: "",
    crewAssets: "",
    shipUpgrades: "",
    notes: ""
  }),
  resources: Object.freeze({
    hull: Object.freeze({
      value: 0,
      max: 0
    }),
    lifeveil: Object.freeze({
      value: 0,
      max: 0
    }),
    strain: Object.freeze({
      value: 0,
      max: 0
    }),
    supplies: 0,
    morale: 0,
    notes: ""
  }),
  derivedStats: Object.freeze({
    speed: 0,
    handling: 0,
    crewCapacity: 0,
    cargoCapacity: 0,
    weaponMounts: 0,
    roomSlots: 0,
    notes: ""
  }),
  crew: Object.freeze({
    minimum: 0,
    recommended: 0,
    maximum: 0,
    current: 0,
    roster: "",
    notes: ""
  }),
  cargo: Object.freeze({
    capacity: 0,
    used: 0,
    manifest: "",
    notes: ""
  }),
  conditions: Object.freeze({
    active: "",
    damage: "",
    notes: ""
  }),
  state: Object.freeze({
    active: false,
    docked: false,
    disabled: false,
    location: "",
    status: "",
    notes: ""
  }),
  history: Object.freeze({
    commissioned: "",
    notableEvents: "",
    previousOwners: "",
    notes: ""
  }),
  notes: ""
});

export function getDefaultArcflightShipData() {
  return foundry.utils.deepClone(arcflightShipDefaults);
}

export function getArcflightShipData(actor) {
  const flagData = actor?.getFlag?.(ARCFLIGHT_MODULE_ID, "system") ?? actor?.flags?.[ARCFLIGHT_MODULE_ID]?.system ?? {};

  return foundry.utils.mergeObject(getDefaultArcflightShipData(), foundry.utils.deepClone(flagData), { inplace: false });
}

export function getDefaultArcflightShipFlags(data = {}) {
  return {
    enabled: true,
    actorType: ARCFLIGHT_SHIP_ACTOR_TYPE,
    system: foundry.utils.mergeObject(getDefaultArcflightShipData(), data, { inplace: false })
  };
}
