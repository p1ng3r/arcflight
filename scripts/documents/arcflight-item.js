/**
 * Stable Foundry Item base for Arcflight item documents.
 *
 * PF2E replaces CONFIG.Item.documentClass with a type-dispatching proxy. Arcflight
 * item classes must not inherit from that proxy: PF2E may route construction for
 * Arcflight item types back to these subclasses, causing recursive construction.
 * Extending the global Foundry Item document keeps Arcflight item instances valid
 * without entering the active system's proxy inheritance chain.
 */
const ArcflightBaseItem = globalThis.Item;

/**
 * Lightweight base item for Arcflight document architecture.
 *
 * Item subclasses should define future-safe data containers only. Rules,
 * calculations, automation, and UI behavior belong to later gameplay pillars.
 */
export class ArcflightItem extends ArcflightBaseItem {
  /** @returns {object} Future-safe default system containers for this item. */
  static defaultSystemData() {
    return {
      tags: [],
      traits: [],
      source: "",
      notes: ""
    };
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    this._ensureSystemContainers(this.constructor.defaultSystemData());
  }

  /**
   * Ensure expected system containers exist while preserving existing values.
   *
   * @param {object} defaults
   * @protected
   */
  _ensureSystemContainers(defaults) {
    const utils = foundry.utils;
    const visit = (value, path) => {
      const current = path ? utils.getProperty(this.system, path) : this.system;

      if (current === undefined) {
        utils.setProperty(this.system, path, utils.deepClone(value));
        return;
      }

      if (!value || Array.isArray(value) || typeof value !== "object") return;

      for (const [key, child] of Object.entries(value)) {
        visit(child, path ? `${path}.${key}` : key);
      }
    };

    visit(defaults, "");
  }
}
