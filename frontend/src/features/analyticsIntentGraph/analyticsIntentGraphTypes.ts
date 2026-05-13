import type { BusinessQuestionIntentCategory } from "../businessQuestionIntelligence";
import type { BusinessSemanticEntityCategory } from "../businessSemantics";
import type { FutureDialectRecommendationId } from "../dataIntelligence";
import type { ExecutionPreviewResultShape, ExecutionPreviewStageType } from "../executionPreview";
import type { KpiChartRecommendationType, KpiOpportunityCategory } from "../kpiIntelligence";
import type { PlanningReadinessStatus } from "../planningReadiness";
import type { WorkflowRecommendationCategory } from "../workflowRecommendations";

export type AnalyticsIntentGraphNodeCategory =
  | "business_question"
  | "workflow"
  | "kpi"
  | "semantic_entity"
  | "execution_stage"
  | "engine"
  | "result_shape"
  | "planning_signal"
  | "relationship_signal"
  | "chart_recommendation";

export type AnalyticsIntentGraphEdgeType =
  | "suggests"
  | "supports"
  | "requires"
  | "connects_to"
  | "depends_on"
  | "visualizes"
  | "grouped_by"
  | "forecasted_by"
  | "analyzed_by";

export type AnalyticsIntentGraphConfidence = "low" | "moderate" | "high";

export type AnalyticsIntentGraphNode = {
  id: string;
  label: string;
  category: AnalyticsIntentGraphNodeCategory;
  confidence: AnalyticsIntentGraphConfidence;
  metadata: {
    questionIntent?: BusinessQuestionIntentCategory;
    workflowCategory?: WorkflowRecommendationCategory;
    kpiCategory?: KpiOpportunityCategory;
    semanticCategory?: BusinessSemanticEntityCategory;
    executionStageType?: ExecutionPreviewStageType;
    engineId?: FutureDialectRecommendationId;
    resultShape?: ExecutionPreviewResultShape;
    planningStatus?: PlanningReadinessStatus | "missing";
    chartType?: KpiChartRecommendationType;
  };
};

export type AnalyticsIntentGraphEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: AnalyticsIntentGraphEdgeType;
  confidence: AnalyticsIntentGraphConfidence;
  reason: string;
};

export type AnalyticsIntentGraphHealth = {
  disconnectedNodeIds: string[];
  unresolvedDependencies: string[];
  missingDimensions: string[];
  missingMetrics: string[];
  missingDateFields: string[];
  missingRelationshipConfirmations: string[];
};

export type AnalyticsIntentGraphReport = {
  datasetId: string;
  nodes: AnalyticsIntentGraphNode[];
  edges: AnalyticsIntentGraphEdge[];
  confidence: AnalyticsIntentGraphConfidence;
  humanSummary: string;
  analystSummary: string;
  connectedWorkflows: WorkflowRecommendationCategory[];
  connectedKpis: KpiOpportunityCategory[];
  connectedSemanticEntities: BusinessSemanticEntityCategory[];
  executionStageDependencies: ExecutionPreviewStageType[];
  recommendedFutureEngines: FutureDialectRecommendationId[];
  recommendedChartPaths: KpiChartRecommendationType[];
  unresolvedBlockers: string[];
  missingMetadataDependencies: string[];
  health: AnalyticsIntentGraphHealth;
  safetyNotes: string[];
};

export type AnalyticsIntentGraphValidationMessage = {
  severity: "warning" | "error";
  message: string;
};

export type AnalyticsIntentGraphValidationResult = {
  valid: boolean;
  messages: AnalyticsIntentGraphValidationMessage[];
};
