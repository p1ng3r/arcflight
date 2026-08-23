function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function safeKeys(value) {
  if (Array.isArray(value)) return value.map((_, index) => String(index));
  if (isPlainObject(value)) return Object.keys(value).sort();
  return [];
}

function normalizePath(base, key) {
  if (base === "") return String(key);
  return `${base}.${String(key)}`;
}

export function buildStructuralDiff(before, after, path = "") {
  if (before === after) return [];
  if (before === null && after !== null) {
    return [{ path, kind: "added", before: null, after }];
  }
  if (before !== null && after === null) {
    return [{ path, kind: "removed", before, after: null }];
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    const left = Array.isArray(before) ? before : [];
    const right = Array.isArray(after) ? after : [];
    const maxLength = Math.max(left.length, right.length);
    const diff = [];
    for (let index = 0; index < maxLength; index += 1) {
      const key = String(index);
      const nextPath = normalizePath(path, key);
      if (index >= left.length) diff.push({ path: nextPath, kind: "added", before: null, after: right[index] });
      else if (index >= right.length) diff.push({ path: nextPath, kind: "removed", before: left[index], after: null });
      else diff.push(...buildStructuralDiff(left[index], right[index], nextPath));
    }
    return diff;
  }
  if (isPlainObject(before) || isPlainObject(after)) {
    const left = isPlainObject(before) ? before : {};
    const right = isPlainObject(after) ? after : {};
    const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
    const diff = [];
    for (const key of keys) {
      const nextPath = normalizePath(path, key);
      if (!Object.hasOwn(left, key)) diff.push({ path: nextPath, kind: "added", before: null, after: right[key] });
      else if (!Object.hasOwn(right, key)) diff.push({ path: nextPath, kind: "removed", before: left[key], after: null });
      else diff.push(...buildStructuralDiff(left[key], right[key], nextPath));
    }
    return diff;
  }
  return [{ path, kind: "changed", before, after }];
}

export function isSafeDiffTarget(value) {
  try {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
    if (typeof value === "undefined") return true;
    if (Array.isArray(value)) return value.every((entry) => isSafeDiffTarget(entry));
    if (isPlainObject(value)) return Object.values(value).every((entry) => isSafeDiffTarget(entry));
    return false;
  } catch {
    return false;
  }
}
