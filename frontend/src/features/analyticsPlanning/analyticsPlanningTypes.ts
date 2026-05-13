import type { AnalyticsIntentGraphConfidence } from "../analyticsIntentGraph";
import type { FutureDialectRecommendationId } from "../dataIntelligence";

export type AnalyticsPlanStepCategory =
  | "data_preparation"
  | "relationship_validation"
  | "metric_selection"
  | "dimension_selection"
  | "grouping"
  | "aggregation"
  | "filtering"
  | "trend_analysis"
  | "forecasting"
  | "statistical_analysis"
  | "segmentation"
  | "dashboard_projection"
  | "explanation_generation"
  | "export_projection";

export type AnalyticsPlanStatus =
  | "blocked"
  | "incomplete"
  | "ready"
  | "relationship_pending"
  | "metadata_pending";

export type AnalyticsPlanComplexity = "simple" | "moderate" | "advanced" | "enterprise";

export type AnalyticsPlanOutputType =
  | "grouped_table"
  | "summary_table"
  | "dashboard_widget"
  | "forecasting_chart"
  | "trend_chart"
  | "executive_summary"
  | "statistical_output";

export type AnalyticsPlanDependency = {
  dependencyId: string;
  label: string;
  requiredByStepId: string;
  satisfied: boolean;
  reason: string;
};

export type AnalyticsPlanRequirement = {
  requirementId: string;
  label: string;
  satisfied: boolean;
  missingMetadata: string[];
};

export type AnalyticsPlanOutput = {
  outputId: string;
  label: string;
  outputType: AnalyticsPlanOutputType;
  projectedFromStepIds: string[];
};

export type AnalyticsPlanWarning = {
  warningId: string;
  message: string;
  severity: "info" | "warning" | "blocked";
};

export type AnalyticsPlanStep = {
  stepId: string;
  label: string;
  description: string;
  category: AnalyticsPlanStepCategory;
  status: AnalyticsPlanStatus;
  dependsOnStepIds: string[];
  futureEngines: FutureDialectRecommendationId[];
};

export type AnalyticsPlanSizing = {
  estimatedFutureStepCount: number;
  estimatedRelationshipComplexity: number;
  estimatedChartCount: number;
  estimatedKpiCount: number;
};

export type AnalyticsPlan = {
  planId: string;
  datasetId: string;
  status: AnalyticsPlanStatus;
  complexity: AnalyticsPlanComplexity;
  planningConfidence: AnalyticsIntentGraphConfidence;
  executionReadiness: AnalyticsPlanStatus;
  humanSummary: string;
  analystSummary: string;
  steps: AnalyticsPlanStep[];
  dependencies: AnalyticsPlanDependency[];
  requirements: AnalyticsPlanRequirement[];
  projectedOutputs: AnalyticsPlanOutput[];
  warnings: AnalyticsPlanWarning[];
  futureEngines: FutureDialectRecommendationId[];
  sizing: AnalyticsPlanSizing;
};

export type AnalyticsPlanValidationMessage = {
  severity: "warning" | "error";
  message: string;
};

export type AnalyticsPlanValidationResult = {
  valid: boolean;
  messages: AnalyticsPlanValidationMessage[];
};
