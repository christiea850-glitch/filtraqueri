import type { BusinessSemanticReport } from "../businessSemantics";
import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import type { InvestigationReport } from "../investigationIntelligence";
import type { ActiveResultModel } from "../results/activeResultModel";

export type NarrativeInsightCategory =
  | "trend"
  | "concentration"
  | "anomaly"
  | "quality"
  | "comparison"
  | "distribution"
  | "operational"
  | "financial"
  | "categorical"
  | "temporal"
  | "investigation"
  | "recommendation";

export type NarrativeSeverity = "low" | "medium" | "high" | "critical";

export type NarrativeRecommendationAction =
  | "investigate_further"
  | "group_by_category"
  | "filter_missing_values"
  | "compare_periods"
  | "segment_locations"
  | "inspect_duplicates"
  | "create_executive_summary_later"
  | "preserve_workbook_snapshot";

export type NarrativeRecommendation = {
  id: string;
  action: NarrativeRecommendationAction;
  label: string;
  rationale: string;
};

export type NarrativeMetricEvidence = {
  label: string;
  value: string;
  ratio?: number;
};

export type NarrativeInsight = {
  id: string;
  category: NarrativeInsightCategory;
  severity: NarrativeSeverity;
  title: string;
  narrative: string;
  evidence: NarrativeMetricEvidence[];
  recommendations: NarrativeRecommendation[];
  relatedColumns: string[];
  source: "metadata" | "visible_rows" | "sampled_rows" | "grouping" | "filter_state" | "workbook" | "investigation";
  deterministic: true;
};

export type NarrativeReadinessLevel = "not_ready" | "limited" | "ready" | "executive_ready";

export type NarrativeReadinessSummary = {
  level: NarrativeReadinessLevel;
  label: string;
  detail: string;
  insightCount: number;
  highPriorityCount: number;
};

export type NarrativeTimelineCheckpointType =
  | "anomaly_discovered"
  | "concentration_detected"
  | "grouping_opportunity_identified"
  | "workbook_quality_warning";

export type NarrativeTimelineCheckpoint = {
  checkpointId: string;
  type: NarrativeTimelineCheckpointType;
  label: string;
  description: string;
  severity: NarrativeSeverity;
  relatedInsightId: string;
  relatedColumns: string[];
};

export type NarrativeFutureContracts = {
  aiAssistedExplanationReady: boolean;
  executiveReportingReady: boolean;
  narrativeExportReady: boolean;
  scheduledSummaryReady: boolean;
  governanceAuditTrailReady: boolean;
  multilingualSummaryReady: boolean;
};

export type NarrativeReport = {
  reportId: string;
  datasetId: string | null;
  sourceResultId: string | null;
  summary: string;
  readiness: NarrativeReadinessSummary;
  insights: NarrativeInsight[];
  visibleInsights: NarrativeInsight[];
  timelineCheckpoints: NarrativeTimelineCheckpoint[];
  futureContracts: NarrativeFutureContracts;
  safetyNotes: string[];
};

export type NarrativeScannerInput = {
  dataset: DatasetMetadata | null;
  activeResultModel: ActiveResultModel | null;
  businessSemanticReport?: BusinessSemanticReport | null;
  investigationReport?: InvestigationReport | null;
};

export type NarrativeScanContext = {
  dataset: DatasetMetadata;
  activeResultModel: ActiveResultModel;
  rows: Record<string, unknown>[];
  visibleRows: Record<string, unknown>[];
  sampledRows: Record<string, unknown>[];
  columns: SchemaColumn[];
  businessSemanticReport: BusinessSemanticReport | null;
  investigationReport: InvestigationReport | null;
};
