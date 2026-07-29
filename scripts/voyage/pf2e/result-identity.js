const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
/** Capture only safe pending-check identity fields without letting hostile input escape. */
export function captureVoyagePf2eResultIdentity(value) {
  const result = {};
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return result;
  for (const key of ["pendingCheckId", "sequence"]) {
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch { continue; }
    if (!descriptor || !Object.hasOwn(descriptor, "value")) continue;
    const read = descriptor.value;
    if (key === "pendingCheckId" && typeof read === "string" && read.trim() && !UNSAFE.has(read)) result.pendingCheckId = read;
    if (key === "sequence" && Number.isSafeInteger(read) && read >= 0) result.sequence = read;
  }
  return result;
}
