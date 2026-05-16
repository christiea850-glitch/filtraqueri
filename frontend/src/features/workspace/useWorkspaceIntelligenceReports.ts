import { useMemo } from "react";
import { buildAnalysisPackagePlan } from "../analysisPackages";
import { useBusinessSemantics } from "../businessSemantics";
import { useDataIntelligence } from "../dataIntelligence";
import type { DatasetMetadata, WorkspaceMode } from "../dataset/datasetTypes";
import type { HistoryItem } from "../history/historyTypes";
import { buildInvestigationReport } from "../investigationIntelligence";
import { buildInvestigationWorkspacePlan } from "../investigationWorkspace";
import { scanNarrativeIntelligence } from "../narrativeIntelligence";
import type { ActiveResultModel } from "../results/activeResultModel";
import { useWorkflowRecommendations } from "../workflowRecommendations";

type UseWorkspaceIntelligenceReportsOptions = {
  dataset: DatasetMetadata | null;
  activeResultModel: ActiveResultModel | null;
  queryHistory: HistoryItem[];
  workspaceMode: WorkspaceMode;
};

export function useWorkspaceIntelligenceReports({
  dataset,
  activeResultModel,
  queryHistory,
  workspaceMode,
}: UseWorkspaceIntelligenceReportsOptions) {
  const { dataProfile, dialectRecommendation } = useDataIntelligence(dataset);
  const { workflowRecommendationReport } = useWorkflowRecommendations({
    dataProfile,
    dialectRecommendation,
  });
  const { businessSemanticReport } = useBusinessSemantics({
    dataset,
    dataProfile,
    workflowRecommendationReport,
  });
  const investigationReport = useMemo(
    () => buildInvestigationReport({ dataset, activeResultModel }),
    [activeResultModel, dataset],
  );
  const narrativeReport = useMemo(
    () =>
      scanNarrativeIntelligence({
        dataset,
        activeResultModel,
        businessSemanticReport,
        investigationReport,
      }),
    [activeResultModel, businessSemanticReport, dataset, investigationReport],
  );
  const analysisPackagePlan = useMemo(
    () =>
      buildAnalysisPackagePlan({
        dataset,
        activeResultModel,
        investigationReport,
        queryHistory,
        sourceMode: workspaceMode,
      }),
    [activeResultModel, dataset, investigationReport, queryHistory, workspaceMode],
  );
  const investigationWorkspacePlan = useMemo(
    () =>
      buildInvestigationWorkspacePlan({
        dataset,
        activeResultModel,
        investigationReport,
        analysisPackagePlan,
        narrativeReport,
        queryHistory,
        sourceMode: workspaceMode,
      }),
    [
      activeResultModel,
      analysisPackagePlan,
      dataset,
      investigationReport,
      narrativeReport,
      queryHistory,
      workspaceMode,
    ],
  );

  return {
    dataProfile,
    dialectRecommendation,
    workflowRecommendationReport,
    businessSemanticReport,
    investigationReport,
    narrativeReport,
    analysisPackagePlan,
    investigationWorkspacePlan,
  };
}

export default useWorkspaceIntelligenceReports;
