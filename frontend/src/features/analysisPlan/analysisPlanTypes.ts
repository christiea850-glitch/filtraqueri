import type {
  BusinessIntentResultType,
  BusinessIntentSupportedEngine,
} from "../businessIntent";
import type { TaskConfiguredInput } from "../taskConfiguration";

export type AnalysisExecutionStepType =
  | "prepare_metric"
  | "prepare_dimension"
  | "prepare_date_field"
  | "aggregate"
  | "compare"
  | "forecast"
  | "correlate"
  | "detect_anomaly"
  | "summarize";

export type AnalysisPlanValidationState =
  | "draft"
  | "ready_for_future_execution"
  | "invalid"
  | "unsupported";

export type AnalysisExecutionStep = {
  id: string;
  type: AnalysisExecutionStepType;
  label: string;
  description: string;
  dependsOn: string[];
};

export type AnalysisPlanValidationResult = {
  valid: boolean;
  messages: string[];
  warnings: string[];
  unsupportedReasons: string[];
};

export type AnalysisPlan = {
  id: string;
  taskId: string;
  intentIds: string[];
  configuredInputs: TaskConfiguredInput[];
  validationState: AnalysisPlanValidationState;
  supportedEngines: BusinessIntentSupportedEngine[];
  preferredEngine: BusinessIntentSupportedEngine | null;
  expectedResultTypes: BusinessIntentResultType[];
  executionSteps: AnalysisExecutionStep[];
  explanationTemplateKey: string;
  validation: AnalysisPlanValidationResult;
  createdAt: string;
  lastUpdated: string;
};
