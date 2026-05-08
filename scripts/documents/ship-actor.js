import { ARCFLIGHT_ACTOR_TYPES } from "../config/constants.js";
import { ArcflightActor } from "./arcflight-actor.js";

/**
 * Foundational ship actor document for Arcflight.
 *
 * The structure below creates stable containers for future systems only. It does
 * not implement travel, combat, AP/RAP spending, station actions, automation, or
 * derived gameplay math.
 */
export class ShipActor extends ArcflightActor {
  static arcflightType = ARCFLIGHT_ACTOR_TYPES.SHIP;

  /** @override */
  static defaultSystemData() {
    return {
      resources: {
        hull: {
          value: 0,
          max: 0
        },
        lifeveil: {
          value: 0,
          max: 0
        },
        strain: {
          value: 0,
          max: 0
        }
      },
      crew: {
        minimum: 0,
        recommended: 0,
        maximum: 0
      },
      mobility: {
        combatSpeed: 0,
        maneuverability: 0
      },
      actions: {
        baseAP: 0,
        baseRAP: 0
      },
      installed: {
        hull: null,
        arkengine: null,
        weapons: [],
        rooms: [],
        upgrades: []
      },
      conditions: []
    };
  }
}
