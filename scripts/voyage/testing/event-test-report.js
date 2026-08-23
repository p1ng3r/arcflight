export function createTestReportModel({
  runId = null,
  startedAt = null,
  completedAt = null,
  durationMs = 0,
  environment = {},
  profile = {},
  summary = {},
  steps = [],
  coverage = {},
  retainedSessionId = null,
} = {}) {
  return Object.freeze({
    runId,
    startedAt,
    completedAt,
    durationMs,
    environment: { ...environment },
    profile: { ...profile },
    summary: { ...summary },
    steps: structuredClone(steps),
    coverage: { ...coverage },
    retainedSessionId
  });
}
