import type { ExecutionPreviewReport } from "./executionPreviewTypes";

export const selectExecutionPreviewWorkflowSummary = (preview: ExecutionPreviewReport) =>
  preview.workflowSummary;

export const selectExecutionPreviewConfidence = (preview: ExecutionPreviewReport) =>
  preview.confidence;

export const selectExecutionPreviewResultShape = (preview: ExecutionPreviewReport) =>
  preview.expectedFutureResultShape;

export const selectExecutionPreviewFutureEnginePath = (preview: ExecutionPreviewReport) =>
  preview.supportedFutureEngines;

export const selectExecutionPreviewRelationshipDependency = (preview: ExecutionPreviewReport) =>
  preview.plannedStages.some((stage) => stage.stageType === "relationship_resolution");

export const selectExecutionPreviewAnalystNotes = (preview: ExecutionPreviewReport) =>
  preview.analystNotes;

export const listExecutionPreviewSafetyNotes = (preview: ExecutionPreviewReport) =>
  preview.safetyNotes;

export const getExecutionPreviewConfidenceLabel = (preview: ExecutionPreviewReport) => {
  if (preview.confidence === "high") return "High workflow confidence";
  if (preview.confidence === "moderate") return "Moderate workflow confidence";
  return "Low workflow confidence";
};

export const getExecutionPreviewResultShapeLabel = (preview: ExecutionPreviewReport) =>
  preview.expectedFutureResultShape.replace(/_/g, " ");
