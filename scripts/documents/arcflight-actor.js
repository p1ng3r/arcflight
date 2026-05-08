/**
 * Lightweight base actor for Arcflight document architecture.
 *
 * This class is intentionally small: it provides a common inheritance point and
 * a default-container hook for future Arcflight actor types without introducing
 * gameplay behavior during the data-architecture phase.
 */
export class ArcflightActor extends Actor {
  /** @returns {object} Future-safe default system containers for this actor. */
  static defaultSystemData() {
    return {};
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    this._ensureSystemContainers(this.constructor.defaultSystemData());
  }

  /**
   * Ensure expected system containers exist so future code can rely on stable
   * paths. Existing values are preserved.
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
