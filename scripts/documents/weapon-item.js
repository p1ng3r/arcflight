import { ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_WEAPON_ARCS, ARCFLIGHT_WEAPON_SIZES } from "../config/constants.js";
import { ArcflightItem } from "./arcflight-item.js";

/** Future-safe ship weapon item skeleton. */
export class WeaponItem extends ArcflightItem {
  static arcflightType = ARCFLIGHT_ITEM_TYPES.WEAPON;

  /** @override */
  static defaultSystemData() {
    return {
      ...super.defaultSystemData(),
      size: ARCFLIGHT_WEAPON_SIZES.LIGHT,
      arc: ARCFLIGHT_WEAPON_ARCS.FORE,
      installSlot: "",
      range: "",
      mounts: {
        required: 0
      },
      payload: {
        dice: "",
        damageType: ""
      }
    };
  }
}
