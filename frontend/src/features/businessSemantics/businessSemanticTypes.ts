import type { WorkflowRecommendationCategory } from "../workflowRecommendations";

export type BusinessSemanticEntityCategory =
  | "customer"
  | "product"
  | "sales"
  | "revenue"
  | "expense"
  | "invoice"
  | "transaction"
  | "employee"
  | "supplier"
  | "booking"
  | "inventory"
  | "payment"
  | "region"
  | "department"
  | "operational_event"
  | "date_dimension"
  | "metric_field"
  | "dimension_field";

export type BusinessSemanticConfidence = "low" | "moderate" | "high";

export type BusinessSemanticSignal = {
  id: string;
  label: string;
  description: string;
  source: "column_name" | "worksheet_name" | "field_pattern" | "data_profile" | "workflow" | "planning";
};

export type BusinessSemanticEntity = {
  id: string;
  category: BusinessSemanticEntityCategory;
  label: string;
  confidence: BusinessSemanticConfidence;
  supportingMetadataSignals: BusinessSemanticSignal[];
  relatedWorksheets: string[];
};

export type BusinessKpiSuggestionId =
  | "total_revenue"
  | "average_transaction_value"
  | "top_products"
  | "customer_growth"
  | "regional_performance"
  | "operational_throughput"
  | "inventory_movement";

export type BusinessKpiSuggestion = {
  id: BusinessKpiSuggestionId;
  label: string;
  confidence: BusinessSemanticConfidence;
  requiredSemanticEntities: BusinessSemanticEntityCategory[];
  supportingMetadataSignals: BusinessSemanticSignal[];
  possibleWorkflowConnections: WorkflowRecommendationCategory[];
};

export type BusinessSemanticReport = {
  datasetId: string;
  humanSummary: string;
  analystSummary: string;
  detectedSemanticEntities: BusinessSemanticEntity[];
  possibleBusinessKpis: BusinessKpiSuggestion[];
  possibleWorkflowConnections: WorkflowRecommendationCategory[];
  recommendedFutureAnalyticsPaths: WorkflowRecommendationCategory[];
  relatedWorksheets: string[];
  safetyNotes: string[];
};

export type BusinessSemanticValidationMessage = {
  severity: "warning" | "error";
  message: string;
};

export type BusinessSemanticValidationResult = {
  valid: boolean;
  messages: BusinessSemanticValidationMessage[];
};
