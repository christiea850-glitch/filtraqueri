import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../execution/workspaceExecutionTypes";
import type { HistoryItem } from "../history/historyTypes";
import type { InvestigationReport, InvestigationStage } from "../investigationIntelligence";
import type { ActiveResultModel } from "../results/activeResultModel";

export type AnalysisPackageStatus = "planned" | "ready" | "partial" | "blocked";

export type AnalysisPackageSourceMode = "human" | "analyst" | "mixed";

export type AnalysisPackageArtifactType =
  | "report_summary"
  | "result_export"
  | "sql_script"
  | "python_script"
  | "r_script"
  | "chart_image"
  | "dashboard_snapshot"
  | "workbook_snapshot"
  | "optimization_model"
  | "audit_log"
  | "explanation_note"
  | "investigation_timeline";

export type AnalysisPackageArtifactStatus = "recommended" | "ready" | "future" | "not_available";

export type AnalysisPackageReadiness = "ready_now" | "needs_result" | "future_generation" | "not_applicable";

export type AnalysisPackageExportTarget =
  | "pdf_report"
  | "word_summary"
  | "csv_export"
  | "excel_export"
  | "chart_images"
  | "script_bundle"
  | "zip_package"
  | "audit_archive";

export type AnalysisPackageGenerationEngine =
  | "report_writer"
  | "csv_exporter"
  | "excel_writer"
  | "chart_renderer"
  | "script_writer"
  | "optimizer"
  | "audit_writer"
  | "package_zipper"
  | "not_configured";

export type AnalysisPackageArtifact = {
  artifactId: string;
  label: string;
  description: string;
  type: AnalysisPackageArtifactType;
  status: AnalysisPackageArtifactStatus;
  readiness: AnalysisPackageReadiness;
  relatedInvestigationStep: InvestigationStage | null;
  relatedDatasetId: string | null;
  futureFilePath: string | null;
  generationEngine: {
    engine: AnalysisPackageGenerationEngine;
    configured: boolean;
    notes: string[];
  };
};

export type AnalysisPackageDatasetReference = {
  datasetId: string;
  datasetName: string;
  rowCount: number;
  columnCount: number;
};

export type AnalysisPackageWorkbookReference = {
  workbookId: string;
  workbookName: string;
  activeWorksheetId: string | null;
  worksheetReferences: Array<{
    worksheetId: string;
    worksheetName: string;
    rowCount: number;
  }>;
};

export type AnalysisPackageResultReference = {
  sourceType: ActiveResultModel["sourceType"];
  sourceTab: ActiveResultModel["sourceTab"];
  rowCount: number;
  columnCount: number;
  grouping: string[];
  filters: string[];
};

export type AnalysisPackageTrailReference = {
  stage: InvestigationStage;
  label: string;
  guidance: string;
};

export type AnalysisPackageAuditEntry = {
  auditId: string;
  label: string;
  description: string;
  relatedDatasetId: string | null;
  relatedResultSource: string | null;
  createdAt: string;
};

export type AnalysisPackageManifest = {
  manifestVersion: 1;
  packageId: string;
  title: string;
  status: AnalysisPackageStatus;
  generatedAt: string;
  sourceMode: AnalysisPackageSourceMode;
  datasetReference: AnalysisPackageDatasetReference | null;
  workbookReference: AnalysisPackageWorkbookReference | null;
  investigationIntentReferences: string[];
  generatedQueryReferences: string[];
  resultReference: AnalysisPackageResultReference | null;
  trailReferences: AnalysisPackageTrailReference[];
  artifactManifest: AnalysisPackageArtifact[];
  futureExportTargets: AnalysisPackageExportTarget[];
  auditTrail: AnalysisPackageAuditEntry[];
};

export type AnalysisPackageRecommendation = {
  recommendationId: string;
  label: string;
  description: string;
  artifactType: AnalysisPackageArtifactType;
  priority: "primary" | "supporting" | "future";
  readiness: AnalysisPackageReadiness;
};

export type AnalysisPackagePlan = {
  packageManifest: AnalysisPackageManifest;
  recommendations: AnalysisPackageRecommendation[];
  readinessSummary: {
    label: string;
    readyArtifactCount: number;
    recommendedArtifactCount: number;
    futureArtifactCount: number;
  };
  humanSummary: string;
};

export type AnalysisPackageBuildInput = {
  dataset: DatasetMetadata | null;
  activeResultModel: ActiveResultModel | null;
  investigationReport: InvestigationReport | null;
  queryHistory: HistoryItem[];
  executionResults?: WorkspaceExecutionResult[];
  sourceMode: AnalysisPackageSourceMode;
};
