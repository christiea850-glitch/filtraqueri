import type { ExecutionPreviewResultShape, ExecutionPreviewStageType } from "../executionPreview";
import type { FutureDialectRecommendationId } from "../dataIntelligence";
import type { PlanningReadinessReport } from "../planningReadiness";

export type WorkflowRecommendationCategory =
  | "summarization"
  | "product_analysis"
  | "customer_segmentation"
  | "churn_analysis"
  | "dashboard_reporting"
  | "executive_summary"
  | "ab_testing"
  | "location_analysis"
  | "time_series_forecasting"
  | "recommendation_analysis"
  | "correlation_analysis"
  | "statistical_testing"
  | "trend_analysis"
  | "operational_monitoring";

export type WorkflowRecommendationConfidence = "low" | "moderate" | "high";

export type WorkflowRecommendationSignal = {
  id: string;
  label: string;
  description: string;
};

export type WorkflowRecommendation = {
  id: string;
  category: WorkflowRecommendationCategory;
  label: string;
  rank: number;
  confidence: WorkflowRecommendationConfidence;
  humanSummary: string;
  whyRecommended: string[];
  supportingMetadataSignals: WorkflowRecommendationSignal[];
  missingMetadataBlockers: string[];
  recommendedFutureEnginePath: FutureDialectRecommendationId[];
  possibleFutureResultShapes: ExecutionPreviewResultShape[];
};

export type WorkflowRecommendationReport = {
  datasetId: string;
  recommendations: WorkflowRecommendation[];
  topRecommendation: WorkflowRecommendation | null;
  humanSummary: string;
  analystSummary: string;
  sourceMetadata: {
    planningReadinessStatus: PlanningReadinessReport["status"] | "missing";
    executionPreviewStages: ExecutionPreviewStageType[];
    guidedInputReady: boolean | null;
  };
};

export type WorkflowRecommendationValidationMessage = {
  severity: "warning" | "error";
  message: string;
};

export type WorkflowRecommendationValidationResult = {
  valid: boolean;
  messages: WorkflowRecommendationValidationMessage[];
};
