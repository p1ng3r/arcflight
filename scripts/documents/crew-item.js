import { ARCFLIGHT_ITEM_DOCUMENT_TYPES, ARCFLIGHT_ITEM_TYPES } from "../config/constants.js";
import { ArcflightItem } from "./arcflight-item.js";

/** Future-safe crew asset item skeleton. */
export class CrewAssetItem extends ArcflightItem {
  static arcflightSubtype = ARCFLIGHT_ITEM_TYPES.CREW_ASSET;
  static arcflightType = ARCFLIGHT_ITEM_DOCUMENT_TYPES.CREW_ASSET;

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

export { CrewAssetItem as CrewItem };
