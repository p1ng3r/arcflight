import { ARCFLIGHT_INSTALL_SLOTS, ARCFLIGHT_ITEM_DOCUMENT_TYPES, ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { ArcflightItem } from "./arcflight-item.js";

/** Future-safe ship upgrade item skeleton. */
export class ShipUpgradeItem extends ArcflightItem {
  static arcflightSubtype = ARCFLIGHT_ITEM_TYPES.SHIP_UPGRADE;
  static arcflightType = ARCFLIGHT_ITEM_DOCUMENT_TYPES.SHIP_UPGRADE;

  /** @override */
  static defaultSystemData() {
    return {
      ...super.defaultSystemData(),
      installSlot: ARCFLIGHT_INSTALL_SLOTS.UPGRADE,
      category: "",
      requirements: [],
      provides: []
    };
  }
}
