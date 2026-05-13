import type {
  BusinessIntentResultType,
  BusinessIntentSupportedEngine,
} from "../businessIntent";

export type TaskValidationState = "incomplete" | "valid" | "invalid" | "unsupported";

export type TaskConfiguredInputSourceType =
  | "user"
  | "suggested"
  | "default"
  | "unconfigured";

export type TaskConfiguredInputValidationStatus =
  | "pending"
  | "valid"
  | "invalid"
  | "missing";

export type TaskConfiguredInput = {
  inputId: string;
  value: string | string[] | number | boolean | null;
  sourceType: TaskConfiguredInputSourceType;
  validationStatus: TaskConfiguredInputValidationStatus;
};

export type TaskInputValidationResult = {
  inputId: string;
  valid: boolean;
  message: string;
  severity: "info" | "warning" | "error";
};

export type TaskConfiguration = {
  taskId: string;
  configuredInputs: TaskConfiguredInput[];
  missingRequiredInputs: string[];
  validationState: TaskValidationState;
  supportedEngines: BusinessIntentSupportedEngine[];
  expectedResultTypes: BusinessIntentResultType[];
  validationResults: TaskInputValidationResult[];
  lastUpdated: string;
};
