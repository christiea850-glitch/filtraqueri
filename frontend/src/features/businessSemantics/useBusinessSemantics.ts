import { useMemo } from "react";
import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { DataProfileReport } from "../dataIntelligence";
import type { WorkflowRecommendationReport } from "../workflowRecommendations";
import { buildBusinessSemanticReport } from "./businessSemanticBuilder";

export function useBusinessSemantics({
  dataset,
  dataProfile,
  workflowRecommendationReport = null,
}: {
  dataset: DatasetMetadata | null;
  dataProfile: DataProfileReport | null;
  workflowRecommendationReport?: WorkflowRecommendationReport | null;
}) {
  const businessSemanticReport = useMemo(
    () =>
      buildBusinessSemanticReport({
        dataset,
        dataProfile,
        workflowRecommendationReport,
      }),
    [dataset, dataProfile, workflowRecommendationReport],
  );

  return {
    businessSemanticReport,
    detectedSemanticEntities: businessSemanticReport?.detectedSemanticEntities || [],
    possibleBusinessKpis: businessSemanticReport?.possibleBusinessKpis || [],
    humanSummary:
      businessSemanticReport?.humanSummary ||
      "No business semantic summary is available yet.",
    analystSummary:
      businessSemanticReport?.analystSummary ||
      "No business semantic metadata is available yet.",
  };
}
