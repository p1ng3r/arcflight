import { ARCFLIGHT_ARKENGINE_CLASSES, ARCFLIGHT_INSTALL_SLOTS, ARCFLIGHT_ITEM_DOCUMENT_TYPES, ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { ArcflightItem } from "./arcflight-item.js";

/** Future-safe arkengine item skeleton. */
export class ArkengineItem extends ArcflightItem {
  static arcflightSubtype = ARCFLIGHT_ITEM_TYPES.ARKENGINE;
  static arcflightType = ARCFLIGHT_ITEM_DOCUMENT_TYPES.ARKENGINE;

  /** @override */
  static defaultSystemData() {
    return {
      ...super.defaultSystemData(),
      class: ARCFLIGHT_ARKENGINE_CLASSES.PLACEHOLDER,
      installSlot: ARCFLIGHT_INSTALL_SLOTS.ARKENGINE,
      rating: 0,
      capacity: {
        upgrades: 0,
        strain: 0
      },
      modifiers: []
    };
  }
}
