import { ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { ArcflightItem } from "./arcflight-item.js";

/** Future-safe cargo item skeleton. */
export class CargoItem extends ArcflightItem {
  static arcflightType = ARCFLIGHT_ITEM_TYPES.CARGO;

  /** @override */
  static defaultSystemData() {
    return {
      ...super.defaultSystemData(),
      category: "",
      quantity: 0,
      bulk: 0,
      value: {
        amount: 0,
        currency: ""
      },
      storage: {
        location: "",
        container: ""
      }
    };
  }
}
