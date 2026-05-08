import { ARCFLIGHT_INSTALL_SLOTS, ARCFLIGHT_ITEM_DOCUMENT_TYPES, ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { ArcflightItem } from "./arcflight-item.js";

/** Future-safe hull item skeleton. */
export class HullItem extends ArcflightItem {
  static arcflightSubtype = ARCFLIGHT_ITEM_TYPES.HULL;
  static arcflightType = ARCFLIGHT_ITEM_DOCUMENT_TYPES.HULL;

  /** @override */
  static defaultSystemData() {
    return {
      ...super.defaultSystemData(),
      category: "",
      installSlot: ARCFLIGHT_INSTALL_SLOTS.HULL,
      resources: {
        hull: {
          max: 0
        },
        lifeveil: {
          max: 0
        },
        strain: {
          max: 0
        }
      },
      crew: {
        minimum: 0,
        recommended: 0,
        maximum: 0
      },
      slots: {
        weapons: 0,
        rooms: 0,
        upgrades: 0
      }
    };
  }
}
