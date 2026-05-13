import type { TaskConfiguration } from "../taskConfiguration";
import type {
  AnalysisExecutionStep,
  AnalysisPlanValidationResult,
  AnalysisPlanValidationState,
} from "./analysisPlanTypes";

export function validateAnalysisPlanInputs({
  configuration,
  executionSteps,
  supportedEngines,
}: {
  configuration: TaskConfiguration | null;
  executionSteps: AnalysisExecutionStep[];
  supportedEngines: string[];
}): {
  validationState: AnalysisPlanValidationState;
  validation: AnalysisPlanValidationResult;
} {
  const messages: string[] = [];
  const warnings: string[] = [];
  const unsupportedReasons: string[] = [];

  if (!configuration) {
    unsupportedReasons.push("Task configuration is unavailable.");
  } else if (configuration.validationState !== "valid") {
    warnings.push("Task configuration is not ready for future planning.");
  }

  if (supportedEngines.length === 0) {
    unsupportedReasons.push("No future engine support is declared.");
  }

  if (executionSteps.length === 0) {
    unsupportedReasons.push("No future execution steps are declared.");
  }

  if (unsupportedReasons.length === 0) {
    messages.push("Analysis plan contract is ready for future execution wiring.");
  }

  const validationState: AnalysisPlanValidationState =
    unsupportedReasons.length > 0
      ? "unsupported"
      : warnings.length > 0
        ? "draft"
        : "ready_for_future_execution";

  return {
    validationState,
    validation: {
      valid: validationState === "ready_for_future_execution",
      messages,
      warnings,
      unsupportedReasons,
    },
  };
}
