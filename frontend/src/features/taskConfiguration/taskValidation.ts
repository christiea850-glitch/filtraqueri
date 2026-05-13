import type { AnalyticsTask } from "../tasks";
import type {
  TaskConfiguration,
  TaskConfiguredInput,
  TaskInputValidationResult,
  TaskValidationState,
} from "./taskConfigurationTypes";

const hasConfiguredValue = (input: TaskConfiguredInput | undefined) => {
  if (!input) return false;
  if (Array.isArray(input.value)) return input.value.length > 0;
  return input.value !== null && input.value !== "";
};

export function validateTaskConfiguration(
  task: AnalyticsTask | null,
  configuredInputs: TaskConfiguredInput[],
): {
  missingRequiredInputs: string[];
  validationState: TaskValidationState;
  validationResults: TaskInputValidationResult[];
} {
  if (!task) {
    return {
      missingRequiredInputs: [],
      validationState: "invalid",
      validationResults: [
        {
          inputId: "task",
          valid: false,
          message: "Task metadata is unavailable.",
          severity: "error",
        },
      ],
    };
  }

  const results: TaskInputValidationResult[] = [];
  const missingRequiredInputs = task.requiredInputs
    .filter((input) => !hasConfiguredValue(configuredInputs.find((current) => current.inputId === input.id)))
    .map((input) => input.id);

  for (const input of task.requiredInputs) {
    if (missingRequiredInputs.includes(input.id)) {
      results.push({
        inputId: input.id,
        valid: false,
        message: `${input.label} is required before this task can become a future analysis plan.`,
        severity: "warning",
      });
    } else {
      results.push({
        inputId: input.id,
        valid: true,
        message: `${input.label} is configured.`,
        severity: "info",
      });
    }
  }

  if (task.supportedEngines.length === 0) {
    results.push({
      inputId: "supportedEngines",
      valid: false,
      message: "Task does not declare a future supported engine.",
      severity: "error",
    });
  }

  if (task.supportedResultTypes.length === 0) {
    results.push({
      inputId: "supportedResultTypes",
      valid: false,
      message: "Task does not declare an expected result type.",
      severity: "error",
    });
  }

  const hasErrors = results.some((result) => result.severity === "error");
  const validationState: TaskValidationState = hasErrors
    ? "invalid"
    : missingRequiredInputs.length > 0
      ? "incomplete"
      : "valid";

  return {
    missingRequiredInputs,
    validationState,
    validationResults: results,
  };
}

export const isTaskConfigurationReadyForPlanning = (configuration: TaskConfiguration) =>
  configuration.validationState === "valid";
