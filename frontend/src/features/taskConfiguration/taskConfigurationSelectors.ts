import type { AnalyticsTask } from "../tasks";
import type { TaskConfiguration } from "./taskConfigurationTypes";

export const getConfiguredInput = (configuration: TaskConfiguration, inputId: string) =>
  configuration.configuredInputs.find((input) => input.inputId === inputId) || null;

export const listMissingRequiredTaskInputs = (
  task: AnalyticsTask,
  configuration: TaskConfiguration,
) =>
  task.requiredInputs.filter((input) => configuration.missingRequiredInputs.includes(input.id));

export const getTaskConfigurationReadinessLabel = (configuration: TaskConfiguration) => {
  if (configuration.validationState === "valid") return "Task ready for future planning";
  if (configuration.validationState === "unsupported") return "Task unsupported";
  if (configuration.validationState === "invalid") return "Task metadata needs review";
  return "Task not ready";
};
