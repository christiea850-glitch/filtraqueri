import type { AnalyticsTaskInput } from "../tasks";
import { guidedInputPrompts } from "./guidedInputOptions";
import type { GuidedInputState } from "./guidedInputTypes";

export const getGuidedInputPrompt = (input: AnalyticsTaskInput) =>
  guidedInputPrompts[input.type] || input.description;

export const listGuidedInputSelections = (state: GuidedInputState) => state.selections;

export const getGuidedInputSelection = (state: GuidedInputState, inputId: string) =>
  state.selections.find((selection) => selection.inputId === inputId) || null;

export const getGuidedInputOptions = (state: GuidedInputState, inputId: string) =>
  state.inputOptions[inputId] || [];

export const getGuidedInputValidationMessage = (state: GuidedInputState, inputId: string) =>
  state.validationMessages.find((message) => message.inputId === inputId) || null;
