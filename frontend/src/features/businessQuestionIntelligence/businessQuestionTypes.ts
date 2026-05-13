import type { BusinessSemanticEntityCategory } from "../businessSemantics";
import type { FutureDialectRecommendationId } from "../dataIntelligence";
import type { KpiChartRecommendationType, KpiOpportunityCategory } from "../kpiIntelligence";
import type { WorkflowRecommendationCategory } from "../workflowRecommendations";

export type BusinessQuestionIntentCategory =
  | "revenue_question"
  | "growth_question"
  | "forecasting_question"
  | "customer_question"
  | "product_question"
  | "operational_question"
  | "comparison_question"
  | "trend_question"
  | "anomaly_question"
  | "segmentation_question"
  | "profitability_question"
  | "inventory_question"
  | "regional_question"
  | "workforce_question"
  | "executive_summary_question";

export type BusinessQuestionConfidence = "low" | "moderate" | "high";

export type BusinessQuestionSignal = {
  id: string;
  label: string;
  description: string;
  source:
    | "keyword_rule"
    | "business_semantics"
    | "kpi_intelligence"
    | "workflow_recommendation"
    | "execution_preview"
    | "guided_input"
    | "planning_readiness";
};

export type BusinessQuestionInterpretation = {
  id: string;
  questionText: string;
  detectedIntentCategory: BusinessQuestionIntentCategory;
  confidence: BusinessQuestionConfidence;
  humanSummary: string;
  supportingSignals: BusinessQuestionSignal[];
  supportingSemanticEntities: BusinessSemanticEntityCategory[];
  likelyWorkflowPath: WorkflowRecommendationCategory[];
  likelyKpiConnections: KpiOpportunityCategory[];
  recommendedChartTypes: KpiChartRecommendationType[];
  recommendedFutureEngines: FutureDialectRecommendationId[];
  requiredMissingMetadata: string[];
  followUpSuggestions: string[];
};

export type BusinessQuestionIntelligenceReport = {
  datasetId: string;
  interpretedQuestions: BusinessQuestionInterpretation[];
  topInterpretation: BusinessQuestionInterpretation | null;
  humanSummary: string;
  analystSummary: string;
  safetyNotes: string[];
};

export type BusinessQuestionValidationMessage = {
  severity: "warning" | "error";
  message: string;
};

export type BusinessQuestionValidationResult = {
  valid: boolean;
  messages: BusinessQuestionValidationMessage[];
};
