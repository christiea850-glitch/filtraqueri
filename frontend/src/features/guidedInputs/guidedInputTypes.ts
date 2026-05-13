import type { BusinessIntentInputType } from "../businessIntent";
import type { SchemaColumn } from "../dataset/datasetTypes";
import type { AnalyticsTaskInput } from "../tasks";
import type { TaskConfiguration } from "../taskConfiguration";

export type GuidedInputOptionSource =
  | "dataset_schema"
  | "task_example"
  | "static_choice"
  | "manual_placeholder";

export type GuidedInputOption = {
  id: string;
  inputId: string;
  label: string;
  value: string;
  source: GuidedInputOptionSource;
  inputType: BusinessIntentInputType;
  column?: SchemaColumn;
  helperText: string;
};

export type GuidedInputSelection = {
  inputId: string;
  value: string | null;
  label: string | null;
};

export type GuidedInputValidationMessage = {
  inputId: string;
  valid: boolean;
  message: string;
  severity: "info" | "warning" | "error";
};

export type GuidedInputState = {
  taskId: string;
  inputOptions: Record<string, GuidedInputOption[]>;
  selections: GuidedInputSelection[];
  validationMessages: GuidedInputValidationMessage[];
  missingRequiredInputIds: string[];
  readyForPlanning: boolean;
};

export type GuidedInputDefinition = AnalyticsTaskInput & {
  helperPrompt: string;
};

export type GuidedInputController = {
  state: GuidedInputState;
  getOptionsForInput: (inputId: string) => GuidedInputOption[];
  getSelectionForInput: (inputId: string) => GuidedInputSelection | null;
  selectInputValue: (input: AnalyticsTaskInput, value: string) => void;
  clearInputValue: (input: AnalyticsTaskInput) => void;
};

export type GuidedInputBuilderArgs = {
  taskInputs: AnalyticsTaskInput[];
  datasetSchema: SchemaColumn[];
  configuration: TaskConfiguration | null;
  taskId: string;
};
