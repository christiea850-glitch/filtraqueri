import type { AnalyticsTaskInput } from "../tasks";
import type { GuidedInputSelection, GuidedInputValidationMessage } from "./guidedInputTypes";

export const validateGuidedInputSelections = (
  inputs: AnalyticsTaskInput[],
  selections: GuidedInputSelection[],
): {
  messages: GuidedInputValidationMessage[];
  missingRequiredInputIds: string[];
  readyForPlanning: boolean;
} => {
  const messages: GuidedInputValidationMessage[] = [];
  const missingRequiredInputIds: string[] = [];

  inputs.forEach((input) => {
    const selection = selections.find((current) => current.inputId === input.id);
    const hasValue = Boolean(selection?.value);

    if (input.required && !hasValue) {
      missingRequiredInputIds.push(input.id);
      messages.push({
        inputId: input.id,
        valid: false,
        message: `${input.label} is needed before this workflow can be planned.`,
        severity: "warning",
      });
      return;
    }

    messages.push({
      inputId: input.id,
      valid: true,
      message: hasValue
        ? `${input.label} is selected for planning.`
        : `${input.label} is optional for this workflow.`,
      severity: "info",
    });
  });

  return {
    messages,
    missingRequiredInputIds,
    readyForPlanning: missingRequiredInputIds.length === 0,
  };
};
