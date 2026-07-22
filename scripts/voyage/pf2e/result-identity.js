const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
/** Capture only safe pending-check identity fields without letting hostile input escape. */
export function captureVoyagePf2eResultIdentity(value) {
  const result = {};
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return result;
  for (const key of ["pendingCheckId", "sequence"]) {
    let present, read;
    try { present = Object.hasOwn(value, key); } catch { continue; }
    if (!present) continue;
    try { read = value[key]; } catch { continue; }
    if (key === "pendingCheckId" && typeof read === "string" && read.trim() && !UNSAFE.has(read)) result.pendingCheckId = read;
    if (key === "sequence" && Number.isSafeInteger(read) && read >= 0) result.sequence = read;
  }
  return result;
}
