import { ARCFLIGHT_INSTALL_SLOTS, ARCFLIGHT_ITEM_DOCUMENT_TYPES, ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { ArcflightItem } from "./arcflight-item.js";

/** Future-safe arkengine modification item skeleton. */
export class ArkengineModItem extends ArcflightItem {
  static arcflightSubtype = ARCFLIGHT_ITEM_TYPES.ARKENGINE_MOD;
  static arcflightType = ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE_MOD;

  /** @override */
  static defaultSystemData() {
    return {
      ...super.defaultSystemData(),
      installSlot: ARCFLIGHT_INSTALL_SLOTS.UPGRADE,
      category: "",
      requirements: [],
      modifiers: []
    };
  }
}
