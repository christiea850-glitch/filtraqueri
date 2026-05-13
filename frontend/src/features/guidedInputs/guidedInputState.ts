import type { AnalyticsTaskInput } from "../tasks";
import type { TaskConfiguredInput } from "../taskConfiguration";
import { listGuidedInputOptions } from "./guidedInputOptions";
import { validateGuidedInputSelections } from "./guidedInputValidation";
import type {
  GuidedInputBuilderArgs,
  GuidedInputOption,
  GuidedInputSelection,
  GuidedInputState,
} from "./guidedInputTypes";

export const createTaskConfiguredInputFromGuidedValue = (
  input: AnalyticsTaskInput,
  value: string | null,
): TaskConfiguredInput => ({
  inputId: input.id,
  value,
  sourceType: value ? "user" : "unconfigured",
  validationStatus: value ? "valid" : input.required ? "missing" : "pending",
});

export const createGuidedInputState = ({
  taskInputs,
  datasetSchema,
  configuration,
  taskId,
}: GuidedInputBuilderArgs): GuidedInputState => {
  const inputOptions = taskInputs.reduce<Record<string, GuidedInputOption[]>>((options, input) => {
    options[input.id] = listGuidedInputOptions(input, datasetSchema);
    return options;
  }, {});
  const selections: GuidedInputSelection[] = taskInputs.map((input) => {
    const configuredInput = configuration?.configuredInputs.find(
      (current) => current.inputId === input.id,
    );
    const value =
      typeof configuredInput?.value === "string" && configuredInput.value.trim()
        ? configuredInput.value
        : null;
    const option = value
      ? inputOptions[input.id]?.find((current) => current.value === value)
      : null;

    return {
      inputId: input.id,
      value,
      label: option?.label || value,
    };
  });
  const validation = validateGuidedInputSelections(taskInputs, selections);

  return {
    taskId,
    inputOptions,
    selections,
    validationMessages: validation.messages,
    missingRequiredInputIds: validation.missingRequiredInputIds,
    readyForPlanning: validation.readyForPlanning,
  };
};
