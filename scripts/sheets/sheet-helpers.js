import { ARCFLIGHT_MODULE_ID } from "../config/constants.js";

export const arcflightTemplatePath = (path) => `modules/${ARCFLIGHT_MODULE_ID}/templates/${path}`;

export function localizeDocumentType(document) {
  const documentName = document.documentName ?? document.constructor?.documentName ?? "Item";
  const labelKey = `TYPES.${documentName}.${document.type}`;
  const label = game.i18n.localize(labelKey);
  return label === labelKey ? document.type : label;
}

export function prepareInstalledContainers(installed = {}) {
  return {
    hull: formatInstalledValue(installed.hull),
    arkengine: formatInstalledValue(installed.arkengine),
    weapons: prepareInstalledList(installed.weapons),
    rooms: prepareInstalledList(installed.rooms),
    upgrades: prepareInstalledList(installed.upgrades)
  };
}

export function prepareSystemEntries(system = {}) {
  const source = system?.toObject?.() ?? system;

  return Object.entries(source).map(([key, value]) => ({
    key,
    value: formatSystemValue(value)
  }));
}

function prepareInstalledList(value) {
  return Array.isArray(value) ? value.map(formatInstalledValue).filter(Boolean) : [];
}

function formatInstalledValue(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.name ?? value.id ?? value.uuid ?? formatSystemValue(value);
}

function formatSystemValue(value) {
  if (value === null) return "Empty";
  if (Array.isArray(value)) return value.length > 0 ? stringifyValue(value) : "Empty list";
  if (typeof value === "object") return stringifyValue(value);
  return String(value);
}

function stringifyValue(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}
