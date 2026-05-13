import type {
  WorkflowRecommendation,
  WorkflowRecommendationCategory,
  WorkflowRecommendationReport,
} from "./workflowRecommendationTypes";

export const selectTopWorkflowRecommendation = (
  report: WorkflowRecommendationReport | null,
) => report?.topRecommendation || null;

export const listWorkflowRecommendations = (
  report: WorkflowRecommendationReport | null,
) => report?.recommendations || [];

export const selectWorkflowRecommendationHumanSummary = (
  report: WorkflowRecommendationReport | null,
) => report?.humanSummary || "No workflow recommendations are available yet.";

export const selectWorkflowRecommendationAnalystSummary = (
  report: WorkflowRecommendationReport | null,
) => report?.analystSummary || "No workflow recommendation metadata is available yet.";

export const listWorkflowRecommendationsByConfidence = (
  report: WorkflowRecommendationReport | null,
  confidence: WorkflowRecommendation["confidence"],
) => listWorkflowRecommendations(report).filter(
  (recommendation) => recommendation.confidence === confidence,
);

export const getWorkflowRecommendationByCategory = (
  report: WorkflowRecommendationReport | null,
  category: WorkflowRecommendationCategory,
) => listWorkflowRecommendations(report).find(
  (recommendation) => recommendation.category === category,
) || null;

export const listWorkflowRecommendationEnginePaths = (
  recommendation: WorkflowRecommendation | null,
) => recommendation?.recommendedFutureEnginePath || [];
