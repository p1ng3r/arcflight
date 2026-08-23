export function isActiveTestLabGm(gameValue = globalThis.game) {
  try {
    const users = Array.isArray(gameValue?.users)
      ? gameValue.users
      : Array.isArray(gameValue?.users?.contents)
        ? gameValue.users.contents
        : typeof gameValue?.users?.values === "function"
          ? [...gameValue.users.values()]
          : [];
    const activeGm = gameValue?.users?.activeGM ?? users.find((entry) => entry?.isGM === true && entry?.active === true);
    return gameValue?.user?.isGM === true
      && typeof gameValue.user.id === "string"
      && gameValue.user.id === activeGm?.id;
  } catch {
    return false;
  }
}

export function createTestLabControl({ gameValue = globalThis.game, open = null, order = 0 } = {}) {
  if (!isActiveTestLabGm(gameValue)) return null;
  const openTestLab = typeof open === "function" ? open : () => gameValue?.arcflight?.testLab?.open?.();
  return {
    name: "arcflight-test-lab",
    title: "ARCFLIGHT.TestLab.Title",
    icon: "fa-solid fa-flask",
    order,
    button: true,
    visible: true,
    onChange: () => openTestLab()
  };
}

export function registerTestLabSceneControl(controls, options = {}) {
  const source = Array.isArray(controls) ? controls : Array.isArray(controls?.controls) ? controls.controls : controls;
  const isArrayContract = Array.isArray(source);
  const control = isArrayContract
    ? source.find((entry) => ["tokens", "token", "measure", "environment"].includes(entry?.name)) ?? source[0]
    : source && typeof source === "object"
      ? source.tokens ?? source.token ?? Object.values(source).find((entry) => ["tokens", "token"].includes(entry?.name))
      : null;
  if (!control) return false;

  if (isArrayContract) {
    if (!Array.isArray(control.tools)) control.tools = [];
    if (control.tools.some((entry) => entry?.name === "arcflight-test-lab")) return true;
    const tool = createTestLabControl({ ...options, order: control.tools.length });
    if (!tool) return false;
    control.tools.push(tool);
    return true;
  }

  if (!control.tools || typeof control.tools !== "object" || Array.isArray(control.tools)) control.tools = {};
  if (Object.hasOwn(control.tools, "arcflight-test-lab")) return true;
  const tool = createTestLabControl({ ...options, order: Object.keys(control.tools).length });
  if (!tool) return false;
  control.tools[tool.name] = tool;
  return true;
}
