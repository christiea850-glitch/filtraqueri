import type { FutureDialectRecommendationId } from "../dataIntelligence";
import type { WorkflowRecommendationCategory } from "../workflowRecommendations";

export type KpiOpportunityCategory =
  | "revenue_tracking"
  | "growth_monitoring"
  | "customer_behavior"
  | "operational_efficiency"
  | "inventory_monitoring"
  | "sales_performance"
  | "regional_performance"
  | "workforce_monitoring"
  | "forecasting_opportunity"
  | "anomaly_detection"
  | "profitability_analysis"
  | "churn_risk"
  | "product_performance"
  | "transaction_monitoring"
  | "executive_reporting";

export type KpiOpportunityConfidence = "low" | "moderate" | "high";

export type KpiChartRecommendationType =
  | "kpi_card"
  | "bar_chart"
  | "line_chart"
  | "trend_chart"
  | "grouped_comparison"
  | "heatmap"
  | "scatter_plot"
  | "forecasting_chart";

export type KpiIntelligenceSignal = {
  id: string;
  label: string;
  description: string;
  source:
    | "business_semantics"
    | "workflow_recommendation"
    | "data_profile"
    | "execution_preview"
    | "guided_input"
    | "planning_readiness";
};

export type KpiOpportunity = {
  id: string;
  category: KpiOpportunityCategory;
  label: string;
  rank: number;
  confidence: KpiOpportunityConfidence;
  humanSummary: string;
  supportingSignals: KpiIntelligenceSignal[];
  missingMetadataBlockers: string[];
  possibleKpiFormulas: string[];
  possibleChartTypes: KpiChartRecommendationType[];
  possibleDashboardWidgets: string[];
  likelyBusinessQuestions: string[];
  recommendedWorkflowPaths: WorkflowRecommendationCategory[];
  recommendedFutureEngines: FutureDialectRecommendationId[];
};

export type KpiIntelligenceReport = {
  datasetId: string;
  opportunities: KpiOpportunity[];
  topOpportunity: KpiOpportunity | null;
  humanSummary: string;
  analystSummary: string;
  safetyNotes: string[];
};

export type KpiIntelligenceValidationMessage = {
  severity: "warning" | "error";
  message: string;
};

export type KpiIntelligenceValidationResult = {
  valid: boolean;
  messages: KpiIntelligenceValidationMessage[];
};
