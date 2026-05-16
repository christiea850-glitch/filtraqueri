import type { AnalysisPackageManifest, AnalysisPackagePlan } from "../analysisPackages";
import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { WorkspaceMode } from "../dataset/datasetTypes";
import type { HistoryItem } from "../history/historyTypes";
import type { InvestigationReport, InvestigationStage } from "../investigationIntelligence";
import type { NarrativeReport } from "../narrativeIntelligence";
import type { ActiveResultModel } from "../results/activeResultModel";

export type InvestigationSessionStatus = "new" | "in_progress" | "review_ready" | "packaging_ready";

export type InvestigationSessionReadiness = "needs_data" | "ready_to_investigate" | "result_ready" | "deliverable_ready";

export type DeliverableHubItemType =
  | "report"
  | "export"
  | "chart_snapshot"
  | "workbook_snapshot"
  | "sql_draft"
  | "python_script"
  | "r_script"
  | "optimization_output"
  | "audit_note"
  | "investigation_explanation"
  | "timeline"
  | "future_generated_file";

export type DeliverableHubItem = {
  itemId: string;
  label: string;
  description: string;
  type: DeliverableHubItemType;
  readiness: "available_metadata" | "needs_result" | "future_generation";
  relatedPackageId: string | null;
  futureLocationRef: string | null;
};

export type DeliverableHub = {
  hubId: string;
  title: string;
  itemCount: number;
  readyItemCount: number;
  futureItemCount: number;
  items: DeliverableHubItem[];
  futureFolderReferences: WorkspaceStorageReference[];
};

export type InvestigationTimelineEventType =
  | "investigation_stage"
  | "query_stage"
  | "filter_milestone"
  | "grouping_milestone"
  | "result_checkpoint"
  | "narrative_checkpoint"
  | "workbook_transition"
  | "mode_transition";

export type InvestigationTimelineEvent = {
  eventId: string;
  type: InvestigationTimelineEventType;
  label: string;
  description: string;
  stage: InvestigationStage | null;
  createdAt: string;
  relatedDatasetId: string | null;
  relatedResultSource: string | null;
};

export type WorkspaceStorageReference = {
  storageId: string;
  label: string;
  targetType: "local_folder" | "cloud_storage" | "artifact_location" | "workspace_bundle";
  placeholderPath: string | null;
  configured: boolean;
};

export type InvestigationSessionAuditEntry = {
  auditId: string;
  label: string;
  description: string;
  relatedDatasetId: string | null;
  relatedPackageId: string | null;
  createdAt: string;
};

export type InvestigationWorkspaceSession = {
  sessionId: string;
  sessionTitle: string;
  createdAt: string;
  updatedAt: string;
  sourceMode: WorkspaceMode;
  status: InvestigationSessionStatus;
  readiness: InvestigationSessionReadiness;
  datasetReference: {
    datasetId: string;
    datasetName: string;
    rowCount: number;
    columnCount: number;
  } | null;
  workbookReference: {
    workbookId: string;
    workbookName: string;
    activeWorksheetId: string | null;
    worksheetReferences: Array<{
      worksheetId: string;
      worksheetName: string;
      rowCount: number;
    }>;
  } | null;
  activeResultReference: {
    sourceType: ActiveResultModel["sourceType"];
    sourceTab: ActiveResultModel["sourceTab"];
    rowCount: number;
    grouping: string[];
    filters: string[];
  } | null;
  narrativeReferences: Array<{
    insightId: string;
    category: string;
    severity: string;
    label: string;
    relatedColumns: string[];
  }>;
  analysisPackageReferences: Array<{
    packageId: string;
    title: string;
    status: AnalysisPackageManifest["status"];
  }>;
  investigationTrailReferences: Array<{
    stage: InvestigationStage;
    label: string;
    guidance: string;
  }>;
  futureArtifactFolderReferences: WorkspaceStorageReference[];
  deliverableHub: DeliverableHub;
  timeline: InvestigationTimelineEvent[];
  auditMetadata: InvestigationSessionAuditEntry[];
};

export type InvestigationWorkspaceBuildInput = {
  dataset: DatasetMetadata | null;
  activeResultModel: ActiveResultModel | null;
  investigationReport: InvestigationReport | null;
  analysisPackagePlan: AnalysisPackagePlan | null;
  narrativeReport?: NarrativeReport | null;
  queryHistory: HistoryItem[];
  sourceMode: WorkspaceMode;
};

export type InvestigationWorkspaceRecommendation = {
  recommendationId: string;
  label: string;
  description: string;
  priority: "primary" | "supporting" | "future";
  readiness: InvestigationSessionReadiness;
};

export type InvestigationWorkspacePlan = {
  session: InvestigationWorkspaceSession;
  recommendations: InvestigationWorkspaceRecommendation[];
  readinessSummary: {
    label: string;
    packageCount: number;
    stageCount: number;
    deliverableCount: number;
    readyDeliverableCount: number;
  };
  humanSummary: string;
};
