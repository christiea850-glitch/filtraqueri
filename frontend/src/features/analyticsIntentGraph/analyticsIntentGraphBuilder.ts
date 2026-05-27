import type { BusinessQuestionIntelligenceReport } from "../businessQuestionIntelligence";
import type { BusinessSemanticEntityCategory, BusinessSemanticReport } from "../businessSemantics";
import type { DataProfileReport, DialectRecommendationReport, FutureDialectRecommendationId } from "../dataIntelligence";
import type { ExecutionPreviewReport, ExecutionPreviewStageType } from "../executionPreview";
import type { KpiChartRecommendationType, KpiIntelligenceReport, KpiOpportunityCategory } from "../kpiIntelligence";
import type { PlanningReadinessReport } from "../planningReadiness";
import type { WorkflowRecommendationCategory, WorkflowRecommendationReport } from "../workflowRecommendations";
import type {
  AnalyticsIntentGraphConfidence,
  AnalyticsIntentGraphEdge,
  AnalyticsIntentGraphEdgeType,
  AnalyticsIntentGraphNode,
  AnalyticsIntentGraphReport,
} from "./analyticsIntentGraphTypes";
import { validateAnalyticsIntentGraph } from "./analyticsIntentGraphValidation";

type BuildArgs = {
  datasetId: string | null;
  dataProfile: DataProfileReport | null;
  dialectRecommendation: DialectRecommendationReport | null;
  workflowRecommendationReport: WorkflowRecommendationReport | null;
  businessSemanticReport: BusinessSemanticReport | null;
  kpiIntelligenceReport: KpiIntelligenceReport | null;
  businessQuestionReport: BusinessQuestionIntelligenceReport | null;
  executionPreview?: ExecutionPreviewReport | null;
  planningReadiness?: PlanningReadinessReport | null;
};

const confidenceRank = { high: 3, moderate: 2, low: 1 };

const normalizeConfidence = (confidence?: string): AnalyticsIntentGraphConfidence => {
  if (confidence === "high") return "high";
  if (confidence === "moderate" || confidence === "medium") return "moderate";
  return "low";
};

const graphConfidence = (nodes: AnalyticsIntentGraphNode[], edges: AnalyticsIntentGraphEdge[]) => {
  if (nodes.length === 0 || edges.length === 0) return "low";
  const score =
    nodes.reduce((total, node) => total + confidenceRank[node.confidence], 0) /
    Math.max(1, nodes.length);
  if (score >= 2.45) return "high";
  if (score >= 1.7) return "moderate";
  return "low";
};

const isWorkflowCategory = (
  value: AnalyticsIntentGraphNode["metadata"]["workflowCategory"],
): value is WorkflowRecommendationCategory => Boolean(value);

const isKpiCategory = (
  value: AnalyticsIntentGraphNode["metadata"]["kpiCategory"],
): value is KpiOpportunityCategory => Boolean(value);

const isSemanticCategory = (
  value: AnalyticsIntentGraphNode["metadata"]["semanticCategory"],
): value is BusinessSemanticEntityCategory => Boolean(value);

const isExecutionStageType = (
  value: AnalyticsIntentGraphNode["metadata"]["executionStageType"],
): value is ExecutionPreviewStageType => Boolean(value);

const isEngineId = (
  value: AnalyticsIntentGraphNode["metadata"]["engineId"],
): value is FutureDialectRecommendationId => Boolean(value);

const isChartType = (
  value: AnalyticsIntentGraphNode["metadata"]["chartType"],
): value is KpiChartRecommendationType => Boolean(value);

const addNode = (
  nodes: AnalyticsIntentGraphNode[],
  node: AnalyticsIntentGraphNode,
) => {
  if (!nodes.some((existing) => existing.id === node.id)) nodes.push(node);
};

const addEdge = (
  edges: AnalyticsIntentGraphEdge[],
  sourceNodeId: string,
  targetNodeId: string,
  edgeType: AnalyticsIntentGraphEdgeType,
  confidence: AnalyticsIntentGraphConfidence,
  reason: string,
) => {
  const id = `${sourceNodeId}:${edgeType}:${targetNodeId}`;
  if (!edges.some((edge) => edge.id === id)) {
    edges.push({ id, sourceNodeId, targetNodeId, edgeType, confidence, reason });
  }
};

const buildHumanSummary = (args: {
  hasForecasting: boolean;
  hasRevenue: boolean;
  hasRelationships: boolean;
}) => {
  if (args.hasForecasting) return "Forecasting opportunities are connected with date-based metrics.";
  if (args.hasRevenue) return "Revenue KPIs were linked to product and regional workflows.";
  if (args.hasRelationships) return "Workbook relationships may support connected analysis paths.";
  return "Available metadata is connected into an analytics intent graph.";
};

export const buildAnalyticsIntentGraph = ({
  datasetId,
  dataProfile,
  dialectRecommendation,
  workflowRecommendationReport,
  businessSemanticReport,
  kpiIntelligenceReport,
  businessQuestionReport,
  executionPreview = null,
  planningReadiness = null,
}: BuildArgs): AnalyticsIntentGraphReport | null => {
  const resolvedDatasetId =
    datasetId ||
    dataProfile?.datasetId ||
    businessSemanticReport?.datasetId ||
    kpiIntelligenceReport?.datasetId ||
    businessQuestionReport?.datasetId ||
    null;
  if (!resolvedDatasetId) return null;

  const nodes: AnalyticsIntentGraphNode[] = [];
  const edges: AnalyticsIntentGraphEdge[] = [];

  workflowRecommendationReport?.recommendations.slice(0, 8).forEach((workflow) =>
    addNode(nodes, {
      id: `workflow:${workflow.category}`,
      label: workflow.label,
      category: "workflow",
      confidence: normalizeConfidence(workflow.confidence),
      metadata: { workflowCategory: workflow.category },
    }),
  );
  kpiIntelligenceReport?.opportunities.slice(0, 8).forEach((kpi) =>
    addNode(nodes, {
      id: `kpi:${kpi.category}`,
      label: kpi.label,
      category: "kpi",
      confidence: normalizeConfidence(kpi.confidence),
      metadata: { kpiCategory: kpi.category },
    }),
  );
  businessSemanticReport?.detectedSemanticEntities.slice(0, 10).forEach((entity) =>
    addNode(nodes, {
      id: `semantic:${entity.category}`,
      label: entity.label,
      category: "semantic_entity",
      confidence: normalizeConfidence(entity.confidence),
      metadata: { semanticCategory: entity.category },
    }),
  );
  businessQuestionReport?.interpretedQuestions.slice(0, 6).forEach((question) =>
    addNode(nodes, {
      id: `question:${question.detectedIntentCategory}`,
      label: question.questionText,
      category: "business_question",
      confidence: normalizeConfidence(question.confidence),
      metadata: { questionIntent: question.detectedIntentCategory },
    }),
  );
  executionPreview?.plannedStages.forEach((stage) =>
    addNode(nodes, {
      id: `execution:${stage.stageType}`,
      label: stage.label,
      category: "execution_stage",
      confidence: normalizeConfidence(executionPreview.confidence),
      metadata: { executionStageType: stage.stageType },
    }),
  );
  dialectRecommendation?.recommendations.slice(0, 5).forEach((engine) =>
    addNode(nodes, {
      id: `engine:${engine.id}`,
      label: engine.label,
      category: "engine",
      confidence: normalizeConfidence(engine.confidence),
      metadata: { engineId: engine.id },
    }),
  );
  if (executionPreview) {
    addNode(nodes, {
      id: `result:${executionPreview.expectedFutureResultShape}`,
      label: executionPreview.expectedFutureResultShape.replace(/_/g, " "),
      category: "result_shape",
      confidence: normalizeConfidence(executionPreview.confidence),
      metadata: { resultShape: executionPreview.expectedFutureResultShape },
    });
  }
  if (planningReadiness) {
    addNode(nodes, {
      id: `planning:${planningReadiness.status}`,
      label: planningReadiness.status.replace(/_/g, " "),
      category: "planning_signal",
      confidence: normalizeConfidence(planningReadiness.confidenceLevel),
      metadata: { planningStatus: planningReadiness.status },
    });
  }
  if (dataProfile?.workbookRelationshipContext.hasWorkbookContext) {
    addNode(nodes, {
      id: "relationship:workbook",
      label: dataProfile.workbookRelationshipContext.summary,
      category: "relationship_signal",
      confidence:
        dataProfile.workbookRelationshipContext.acceptedRelationshipCount > 0 ? "high" : "moderate",
      metadata: {},
    });
  }
  kpiIntelligenceReport?.opportunities.slice(0, 6).flatMap((kpi) => kpi.possibleChartTypes).forEach((chart) =>
    addNode(nodes, {
      id: `chart:${chart}`,
      label: chart.replace(/_/g, " "),
      category: "chart_recommendation",
      confidence: "moderate",
      metadata: { chartType: chart },
    }),
  );

  businessQuestionReport?.interpretedQuestions.forEach((question) => {
    question.likelyWorkflowPath.forEach((workflow) =>
      addEdge(edges, `question:${question.detectedIntentCategory}`, `workflow:${workflow}`, "suggests", normalizeConfidence(question.confidence), "Question suggests workflow path."),
    );
    question.likelyKpiConnections.forEach((kpi) =>
      addEdge(edges, `question:${question.detectedIntentCategory}`, `kpi:${kpi}`, "connects_to", normalizeConfidence(question.confidence), "Question connects to KPI opportunity."),
    );
  });
  kpiIntelligenceReport?.opportunities.forEach((kpi) => {
    kpi.recommendedWorkflowPaths.forEach((workflow) =>
      addEdge(edges, `kpi:${kpi.category}`, `workflow:${workflow}`, "supports", normalizeConfidence(kpi.confidence), "KPI supports workflow path."),
    );
    kpi.recommendedFutureEngines.forEach((engine) =>
      addEdge(edges, `kpi:${kpi.category}`, `engine:${engine}`, "analyzed_by", normalizeConfidence(kpi.confidence), "KPI can be analyzed by future engine."),
    );
    kpi.possibleChartTypes.forEach((chart) =>
      addEdge(edges, `kpi:${kpi.category}`, `chart:${chart}`, "visualizes", normalizeConfidence(kpi.confidence), "KPI can be visualized by chart type."),
    );
  });
  businessSemanticReport?.possibleWorkflowConnections.forEach((workflow) => {
    businessSemanticReport.detectedSemanticEntities.slice(0, 8).forEach((entity) =>
      addEdge(edges, `semantic:${entity.category}`, `workflow:${workflow}`, "supports", normalizeConfidence(entity.confidence), "Semantic entity supports workflow."),
    );
  });
  executionPreview?.plannedStages.forEach((stage) => {
    if (executionPreview.expectedFutureResultShape) {
      addEdge(edges, `execution:${stage.stageType}`, `result:${executionPreview.expectedFutureResultShape}`, "depends_on", normalizeConfidence(executionPreview.confidence), "Execution stage contributes to future result shape.");
    }
    executionPreview.supportedFutureEngines.forEach((engine) =>
      addEdge(edges, `execution:${stage.stageType}`, `engine:${engine}`, stage.stageType === "forecasting" ? "forecasted_by" : "analyzed_by", normalizeConfidence(executionPreview.confidence), "Execution stage maps to future engine."),
    );
  });
  if (planningReadiness) {
    nodes
      .filter((node) => node.category === "workflow" || node.category === "execution_stage")
      .forEach((node) =>
        addEdge(edges, node.id, `planning:${planningReadiness.status}`, "depends_on", normalizeConfidence(planningReadiness.confidenceLevel), "Node depends on planning readiness."),
      );
  }
  if (dataProfile?.workbookRelationshipContext.hasWorkbookContext) {
    nodes
      .filter((node) => node.category === "workflow" || node.category === "semantic_entity")
      .forEach((node) =>
        addEdge(edges, node.id, "relationship:workbook", "connects_to", "moderate", "Workbook relationship metadata may connect analysis paths."),
      );
  }

  const connectedNodeIds = new Set(edges.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]));
  const missingDimensions = dataProfile && dataProfile.possibleDimensions.length === 0 ? ["No dimension fields detected."] : [];
  const missingMetrics = dataProfile && dataProfile.possibleMetrics.length === 0 ? ["No metric fields detected."] : [];
  const missingDateFields = dataProfile && dataProfile.dateTimeFields.length === 0 ? ["No date fields detected."] : [];
  const missingRelationshipConfirmations =
    dataProfile?.workbookRelationshipContext.hasWorkbookContext &&
    dataProfile.workbookRelationshipContext.acceptedRelationshipCount === 0
      ? ["Workbook relationships still require confirmation."]
      : [];
  const unresolvedDependencies = [
    ...missingDimensions,
    ...missingMetrics,
    ...missingDateFields,
    ...missingRelationshipConfirmations,
    ...(planningReadiness?.futureExecutionBlockers || []),
  ];
  const confidence = graphConfidence(nodes, edges);
  const report: AnalyticsIntentGraphReport = {
    datasetId: resolvedDatasetId,
    nodes,
    edges,
    confidence,
    humanSummary: buildHumanSummary({
      hasForecasting: nodes.some((node) => node.id.includes("forecast")),
      hasRevenue: nodes.some((node) => node.id.includes("revenue")),
      hasRelationships: Boolean(dataProfile?.workbookRelationshipContext.hasWorkbookContext),
    }),
    analystSummary: `${nodes.length} graph nodes and ${edges.length} graph edges connected with ${confidence} confidence.`,
    connectedWorkflows: Array.from(new Set(nodes.map((node) => node.metadata.workflowCategory).filter(isWorkflowCategory))),
    connectedKpis: Array.from(new Set(nodes.map((node) => node.metadata.kpiCategory).filter(isKpiCategory))),
    connectedSemanticEntities: Array.from(new Set(nodes.map((node) => node.metadata.semanticCategory).filter(isSemanticCategory))),
    executionStageDependencies: Array.from(new Set(nodes.map((node) => node.metadata.executionStageType).filter(isExecutionStageType))),
    recommendedFutureEngines: Array.from(new Set(nodes.map((node) => node.metadata.engineId).filter(isEngineId))),
    recommendedChartPaths: Array.from(new Set(nodes.map((node) => node.metadata.chartType).filter(isChartType))),
    unresolvedBlockers: planningReadiness?.futureExecutionBlockers || [],
    missingMetadataDependencies: unresolvedDependencies,
    health: {
      disconnectedNodeIds: nodes.filter((node) => !connectedNodeIds.has(node.id)).map((node) => node.id),
      unresolvedDependencies,
      missingDimensions,
      missingMetrics,
      missingDateFields,
      missingRelationshipConfirmations,
    },
    safetyNotes: ["Analytics intent graph is metadata only; it does not execute or generate code."],
  };
  const validation = validateAnalyticsIntentGraph(report);

  if (validation.messages.length === 0) return report;

  return {
    ...report,
    safetyNotes: Array.from(new Set([...report.safetyNotes, ...validation.messages.map((message) => message.message)])),
  };
};
