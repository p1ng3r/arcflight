import { ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { ArcflightItem } from "./arcflight-item.js";

/** Future-safe crew asset item skeleton. */
export class CrewItem extends ArcflightItem {
  static arcflightType = ARCFLIGHT_ITEM_TYPES.CREW_ASSET;

  /** @override */
  static defaultSystemData() {
    return {
      ...super.defaultSystemData(),
      role: "",
      station: "",
      rank: "",
      affiliations: [],
      capabilities: [],
      availability: {
        status: "",
        notes: ""
      }
    };
  }
}
