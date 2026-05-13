import type { AnalyticsTask } from "../tasks";
import type {
  TaskConfiguration,
  TaskConfiguredInput,
} from "./taskConfigurationTypes";
import { validateTaskConfiguration } from "./taskValidation";

const nowIso = () => new Date().toISOString();

export const createUnconfiguredTaskInputs = (task: AnalyticsTask): TaskConfiguredInput[] =>
  [...task.requiredInputs, ...task.optionalInputs].map((input) => ({
    inputId: input.id,
    value: null,
    sourceType: "unconfigured",
    validationStatus: input.required ? "missing" : "pending",
  }));

export function createTaskConfiguration(
  task: AnalyticsTask,
  configuredInputs = createUnconfiguredTaskInputs(task),
): TaskConfiguration {
  const validation = validateTaskConfiguration(task, configuredInputs);

  return {
    taskId: task.id,
    configuredInputs: configuredInputs.map((input) => ({
      ...input,
      validationStatus: validation.missingRequiredInputs.includes(input.inputId)
        ? "missing"
        : input.value === null || input.value === ""
          ? "pending"
          : "valid",
    })),
    missingRequiredInputs: validation.missingRequiredInputs,
    validationState: validation.validationState,
    supportedEngines: task.supportedEngines,
    expectedResultTypes: task.supportedResultTypes,
    validationResults: validation.validationResults,
    lastUpdated: nowIso(),
  };
}

export function updateTaskConfiguredInput(
  task: AnalyticsTask,
  configuration: TaskConfiguration,
  nextInput: TaskConfiguredInput,
): TaskConfiguration {
  const nextInputs = configuration.configuredInputs.map((input) =>
    input.inputId === nextInput.inputId ? nextInput : input,
  );
  const hasExistingInput = nextInputs.some((input) => input.inputId === nextInput.inputId);

  return createTaskConfiguration(task, hasExistingInput ? nextInputs : [...nextInputs, nextInput]);
}
