import runTravelV2StateSmokeChecks from "../helpers/travel-v2-state.smoke.js";
import runTravelV2PressureEngineSmokeChecks from "../helpers/travel-v2-pressure-engine.smoke.js";
import runTravelV2RoundPressureAdapterSmokeChecks from "../helpers/travel-v2-round-pressure-adapter.smoke.js";
import runTravelV2RunnerBridgeSmokeChecks from "../helpers/travel-v2-runner-bridge.smoke.js";
import runTravelV2PreviewStateSmokeChecks from "../helpers/travel-v2-preview-state.smoke.js";
import runTravelV2PressureApplicationStateSmokeChecks from "../helpers/travel-v2-pressure-application-state.smoke.js";
import runTravelV2SessionPressureApplicationSmokeChecks from "../helpers/travel-v2-session-pressure-application.smoke.js";
import runTravelV2PressureCorrectionSmokeChecks from "../helpers/travel-v2-pressure-correction.smoke.js";
import runTravelV2RoundFinalizationStateSmokeChecks from "../helpers/travel-v2-round-finalization-state.smoke.js";
import runTravelV2SessionRoundFinalizationSmokeChecks from "../helpers/travel-v2-session-round-finalization.smoke.js";
import runTravelV2EventCompletionReadinessSmokeChecks from "../helpers/travel-v2-event-completion-readiness.smoke.js";
import runTravelV2SessionEventCompletionSmokeChecks from "../helpers/travel-v2-session-event-completion.smoke.js";
import runTravelV2EventOutcomePackageSmokeChecks from "../helpers/travel-v2-event-outcome-package.smoke.js";
import runTravelV2SessionEventOutcomeApplicationSmokeChecks from "../helpers/travel-v2-session-event-outcome-application.smoke.js";
import runTravelV2ActorApplicationBridgeSmokeChecks from "../helpers/travel-v2-actor-application-bridge.smoke.js";
import runTravelEventRunnerV2PreviewSmokeChecks from "../helpers/travel-event-runner-v2-preview.smoke.js";
import runTravelEventRunnerV2PreviewConsumerSmokeChecks from "../apps/travel-event-runner-v2-preview-consumer.smoke.js";
import runTravelEventRunnerV2PreviewPanelSmokeChecks from "../apps/travel-event-runner-v2-preview-panel.smoke.js";
import runTravelEventRunnerV2PressureApplicationSmokeChecks from "../apps/travel-event-runner-v2-pressure-application.smoke.js";
import runTravelEventRunnerV2PressureCorrectionSmokeChecks from "../apps/travel-event-runner-v2-pressure-correction.smoke.js";
import runTravelEventRunnerV2RoundFinalizationSmokeChecks from "../apps/travel-event-runner-v2-round-finalization.smoke.js";
import runTravelEventRunnerV2EventCompletionSmokeChecks from "../apps/travel-event-runner-v2-event-completion.smoke.js";
import runTravelEventRunnerV2EventOutcomeApplicationSmokeChecks from "../apps/travel-event-runner-v2-event-outcome-application.smoke.js";
import runTravelEventRunnerStartupDiagnosticsSmokeChecks from "../apps/travel-event-runner-startup-diagnostics.smoke.js";
import runTravelV2SampleEventSmokeChecks from "./run-travel-v2-sample-event-smoke.mjs";

const SMOKE_SUITES = Object.freeze([
  ["Travel v2 state", runTravelV2StateSmokeChecks],
  ["Travel v2 pressure engine", runTravelV2PressureEngineSmokeChecks],
  ["Travel v2 round pressure adapter", runTravelV2RoundPressureAdapterSmokeChecks],
  ["Travel v2 runner bridge", runTravelV2RunnerBridgeSmokeChecks],
  ["Travel v2 preview state", runTravelV2PreviewStateSmokeChecks],
  ["Travel v2 pressure application state", runTravelV2PressureApplicationStateSmokeChecks],
  ["Travel v2 session pressure application", runTravelV2SessionPressureApplicationSmokeChecks],
  ["Travel v2 pressure correction", runTravelV2PressureCorrectionSmokeChecks],
  ["Travel v2 round finalization state", runTravelV2RoundFinalizationStateSmokeChecks],
  ["Travel v2 session round finalization", runTravelV2SessionRoundFinalizationSmokeChecks],
  ["Travel v2 event completion readiness", runTravelV2EventCompletionReadinessSmokeChecks],
  ["Travel v2 session event completion", runTravelV2SessionEventCompletionSmokeChecks],
  ["Travel v2 event outcome package", runTravelV2EventOutcomePackageSmokeChecks],
  ["Travel v2 session event outcome application", runTravelV2SessionEventOutcomeApplicationSmokeChecks],
  ["Travel v2 actor application bridge", runTravelV2ActorApplicationBridgeSmokeChecks],
  ["Travel event runner v2 preview", runTravelEventRunnerV2PreviewSmokeChecks],
  ["Travel event runner v2 preview consumer", runTravelEventRunnerV2PreviewConsumerSmokeChecks],
  ["Travel event runner v2 preview panel", runTravelEventRunnerV2PreviewPanelSmokeChecks],
  ["Travel event runner v2 pressure application", runTravelEventRunnerV2PressureApplicationSmokeChecks],
  ["Travel event runner v2 pressure correction", runTravelEventRunnerV2PressureCorrectionSmokeChecks],
  ["Travel event runner v2 round finalization", runTravelEventRunnerV2RoundFinalizationSmokeChecks],
  ["Travel event runner v2 event completion", runTravelEventRunnerV2EventCompletionSmokeChecks],
  ["Travel event runner v2 event outcome application", runTravelEventRunnerV2EventOutcomeApplicationSmokeChecks],
  ["Travel event runner startup diagnostics", runTravelEventRunnerStartupDiagnosticsSmokeChecks],
  ["Travel v2 sample event", runTravelV2SampleEventSmokeChecks]
]);

function printSuiteResult(label, result) {
  console.log(`${label} smoke checks passed.`);
  console.log(`Checked ${result.checked.length} groups:`);
  for (const checkName of result.checked) {
    console.log(`- ${checkName}`);
  }
  console.log("");
}

try {
  const results = [];
  for (const [label, runSuite] of SMOKE_SUITES) {
    const result = await runSuite();
    results.push({ label, result });
    printSuiteResult(label, result);
  }
  const groupCount = results.reduce((total, entry) => total + entry.result.checked.length, 0);
  console.log(`All Travel v2 smoke checks passed. ${results.length} suites, ${groupCount} groups.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
