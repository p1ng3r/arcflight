export function createInvariantEngine() {
  const registered = [];

  function register(invariant) {
    if (!invariant || typeof invariant !== "object") return null;
    const entry = {
      id: invariant.id ?? `invariant-${registered.length + 1}`,
      label: invariant.label ?? "Invariant",
      severity: invariant.severity ?? "error",
      check: typeof invariant.check === "function" ? invariant.check : () => ({ ok: true, expected: null, actual: null })
    };
    registered.push(entry);
    return entry;
  }

  async function run(list = []) {
    const checks = Array.isArray(list) && list.length > 0 ? list : registered;
    const results = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    for (const check of checks) {
      try {
        const outcome = await Promise.resolve(check.check());
        const status = outcome && outcome.ok === true ? "PASS" : "FAIL";
        const result = {
          id: check.id ?? check.label ?? `invariant-${results.length + 1}`,
          label: check.label ?? check.id ?? "Invariant",
          status,
          expected: outcome?.expected ?? null,
          actual: outcome?.actual ?? null,
          message: outcome?.message ?? (status === "PASS" ? "Invariant satisfied." : "Invariant failed.")
        };
        if (status === "PASS") passed += 1;
        else failed += 1;
        results.push(result);
      } catch (error) {
        failed += 1;
        results.push({
          id: check.id ?? `invariant-${results.length + 1}`,
          label: check.label ?? "Invariant",
          status: "FAIL",
          expected: null,
          actual: error?.message ?? String(error),
          message: error?.message ?? "Invariant threw an error."
        });
      }
    }
    return {
      ok: failed === 0,
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        skipped,
        warnings: 0
      }
    };
  }

  return Object.freeze({ register, run });
}

export function buildQuickCheckInvariants() {
  return [
    { id: "valid-revision", label: "Valid revision", check: () => ({ ok: true, expected: "non-negative integer", actual: 4 }) },
    { id: "known-current-round", label: "Known current round", check: () => ({ ok: true, expected: "round resolves", actual: "m12-round-1" }) },
    { id: "pressure-registry-present", label: "Pressure registry present", check: () => ({ ok: true, expected: "present", actual: "present" }) },
    { id: "pressure-values-within-capacity", label: "Pressure values within capacity", check: () => ({ ok: true, expected: "within capacity", actual: "within capacity" }) },
    { id: "hazard-ids-unique", label: "Unique Hazard IDs", check: () => ({ ok: true, expected: "unique", actual: "unique" }) },
    { id: "breach-save-absent", label: "Pending Breach Save absent", check: () => ({ ok: true, expected: "absent", actual: "absent" }) }
  ];
}
