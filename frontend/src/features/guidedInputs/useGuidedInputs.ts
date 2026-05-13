import { useMemo } from "react";
import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { AnalyticsTask, AnalyticsTaskInput } from "../tasks";
import type { TaskConfiguration, TaskConfiguredInput } from "../taskConfiguration";
import { createTaskConfiguredInputFromGuidedValue, createGuidedInputState } from "./guidedInputState";
import {
  getGuidedInputOptions,
  getGuidedInputSelection,
} from "./guidedInputSelectors";

export function useGuidedInputs({
  task,
  dataset,
  configuration,
  onInputChange,
}: {
  task: AnalyticsTask;
  dataset: DatasetMetadata | null;
  configuration: TaskConfiguration | null;
  onInputChange: (input: TaskConfiguredInput) => void;
}) {
  const taskInputs = useMemo(
    () => [...task.requiredInputs, ...task.optionalInputs],
    [task.optionalInputs, task.requiredInputs],
  );
  const state = useMemo(
    () =>
      createGuidedInputState({
        taskInputs,
        datasetSchema: dataset?.schema || [],
        configuration,
        taskId: task.id,
      }),
    [configuration, dataset?.schema, task.id, taskInputs],
  );

  return {
    state,
    getOptionsForInput: (inputId: string) => getGuidedInputOptions(state, inputId),
    getSelectionForInput: (inputId: string) => getGuidedInputSelection(state, inputId),
    selectInputValue: (input: AnalyticsTaskInput, value: string) => {
      onInputChange(createTaskConfiguredInputFromGuidedValue(input, value || null));
    },
    clearInputValue: (input: AnalyticsTaskInput) => {
      onInputChange(createTaskConfiguredInputFromGuidedValue(input, null));
    },
  };
}
