import { ARCFLIGHT_INSTALL_SLOTS, ARCFLIGHT_ITEM_DOCUMENT_TYPES, ARCFLIGHT_ITEM_TYPES, ARCFLIGHT_ROOM_CATEGORIES } from "../config/constants.js";
import { ArcflightItem } from "./arcflight-item.js";

/** Future-safe ship room item skeleton. */
export class RoomItem extends ArcflightItem {
  static arcflightSubtype = ARCFLIGHT_ITEM_TYPES.ROOM;
  static arcflightType = ARCFLIGHT_ITEM_DOCUMENT_TYPES.ROOM;

  /** @override */
  static defaultSystemData() {
    return {
      ...super.defaultSystemData(),
      category: ARCFLIGHT_ROOM_CATEGORIES.UTILITY,
      installSlot: ARCFLIGHT_INSTALL_SLOTS.ROOM,
      capacity: 0,
      requirements: [],
      provides: []
    };
  }
}
