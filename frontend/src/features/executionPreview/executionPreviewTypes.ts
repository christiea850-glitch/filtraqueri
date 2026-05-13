import type { BusinessIntentSupportedEngine } from "../businessIntent";
import type { PlanningReadinessReport } from "../planningReadiness";

export type ExecutionPreviewStageType =
  | "guided_input"
  | "validation"
  | "aggregation"
  | "grouping"
  | "relationship_resolution"
  | "engine_routing"
  | "forecasting"
  | "statistical_analysis"
  | "result_projection"
  | "explanation";

export type ExecutionPreviewStage = {
  stageId: string;
  label: string;
  description: string;
  stageType: ExecutionPreviewStageType;
};

export type ExecutionPreviewConfidence = "low" | "moderate" | "high";

export type ExecutionPreviewResultShape =
  | "summary_table"
  | "grouped_table"
  | "ranked_output"
  | "comparison_output"
  | "trend_output"
  | "statistical_output"
  | "forecast_output";

export type ExecutionPreviewReport = {
  taskId: string;
  workflowSummary: string;
  plannedStages: ExecutionPreviewStage[];
  confidence: ExecutionPreviewConfidence;
  readinessStatus: PlanningReadinessReport["status"];
  expectedFutureResultShape: ExecutionPreviewResultShape;
  supportedFutureEngines: BusinessIntentSupportedEngine[];
  safetyNotes: string[];
  analystNotes: string[];
};

export type ExecutionPreviewValidationSeverity = "warning" | "error";

export type ExecutionPreviewValidationMessage = {
  message: string;
  severity: ExecutionPreviewValidationSeverity;
};

export type ExecutionPreviewValidationResult = {
  valid: boolean;
  messages: ExecutionPreviewValidationMessage[];
};
