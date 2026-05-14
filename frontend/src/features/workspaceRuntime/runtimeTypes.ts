import type { ReactNode } from "react";
import type { ActiveView, DatasetMetadata, WorkspaceMode } from "../dataset/datasetTypes";
import type { ExecutionRegistryState } from "../execution/executionRegistryTypes";
import type { QueryBuilderSnapshot } from "../workspace/workspaceOrchestrationTypes";
import type { ActiveResultModel } from "../results/activeResultModel";
import type { ResultTabKey } from "../results/resultTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../sqlWorkspacePersistence";

export type RuntimeContextReference = {
  datasetId: string | null;
  datasetName: string | null;
  workbookActiveWorksheetName: string | null;
  workbookWorksheetCount: number;
  resultTab: ResultTabKey | null;
  mode: WorkspaceMode;
  view: ActiveView;
  activeExecutionId: string | null;
};

export type InvestigationContinuationOrigin =
  | "workspace-trail"
  | "runtime-panel"
  | "human-intent"
  | "analyst-context"
  | "metadata-summary"
  | "guidance";

export type GuidanceCategory =
  | "data-readiness"
  | "result-review"
  | "query-refinement"
  | "workbook-relationships"
  | "human-guidance"
  | "analyst-review";

export type GuidancePriority = "high" | "medium" | "low";

export type GuidanceContextWeight = {
  id: string;
  label: string;
  value: number;
  reason: string;
};

export type GuidanceScore = {
  value: number;
  priority: GuidancePriority;
  explanation: string;
  weights: GuidanceContextWeight[];
};

export type GuidanceReason =
  | "dataset-open-no-query"
  | "results-ready-no-refinement"
  | "workbook-relationships-unreviewed"
  | "human-intent-without-analyst-context"
  | "analyst-draft-with-result-context"
  | "no-dataset-open";

export type GuidanceContinuationLink = {
  continuationId: string;
  label: string;
  targetView: ActiveView;
  targetMode: WorkspaceMode;
  disabled?: boolean;
};

export type InvestigationGuidanceItem = {
  id: string;
  title: string;
  summary: string;
  category: GuidanceCategory;
  reason: GuidanceReason;
  audience: WorkspaceMode;
  priority: GuidancePriority;
  score: GuidanceScore;
  metadataOnly: true;
  continuationLink: GuidanceContinuationLink;
};

export type GuidanceRecommendationGroup = {
  id:
    | "start-investigation"
    | "continue-analysis"
    | "inspect-relationships"
    | "review-sql-context"
    | "review-results";
  title: string;
  summary: string;
  audience: WorkspaceMode;
  items: InvestigationGuidanceItem[];
  topScore: number;
  metadataOnly: true;
};

export type NarrativeStage =
  | "not-started"
  | "data-opened"
  | "context-selected"
  | "analysis-forming"
  | "result-review"
  | "analyst-review";

export type NarrativeConfidence = "low" | "medium" | "high";

export type NarrativeEvent = {
  id: string;
  label: string;
  summary: string;
  stage: NarrativeStage;
  reference: RuntimeContextReference;
};

export type NarrativeSummary = {
  headline: string;
  body: string;
  nextStep: string;
};

export type InvestigationNarrative = {
  id: string;
  stage: NarrativeStage;
  confidence: NarrativeConfidence;
  summary: NarrativeSummary;
  events: NarrativeEvent[];
  mode: WorkspaceMode;
  metadataOnly: true;
};

export type ContextualInvestigationObject = {
  id: string;
  label: string;
  objectType:
    | "dataset"
    | "result"
    | "query-builder"
    | "sql-workspace"
    | "human-intent"
    | "task"
    | "metadata";
  summary: string;
  reference: RuntimeContextReference;
};

export type RuntimePanelSlot = {
  id: string;
  title: string;
  label: string;
  summary: string;
  status?: string;
  metadataOnly: boolean;
  items?: Array<{
    label: string;
    value: string;
  }>;
};

export type InvestigationContinuation = {
  id: string;
  label: string;
  description: string;
  origin: InvestigationContinuationOrigin;
  originReference: RuntimeContextReference;
  continuationContext: {
    origin: InvestigationContinuationOrigin;
    originatingDatasetId: string | null;
    originatingWorkbookWorksheetName: string | null;
    originatingResultTab: ResultTabKey | null;
    originatingMode: WorkspaceMode;
    originatingView: ActiveView;
  };
  relatedReferences: RuntimeContextReference[];
  returnLabel: string;
  targetView: ActiveView;
  targetMode: WorkspaceMode;
  source:
    | "dataset"
    | "results"
    | "query-builder"
    | "human-intent"
    | "analyst"
    | "metadata";
  disabled?: boolean;
};

export type WorkspaceTrailItem = {
  id: string;
  stableKey: string;
  label: string;
  semanticKey: "data" | "build" | "results" | "analyst";
  view: ActiveView;
  mode: WorkspaceMode;
  status: "current" | "available" | "metadata";
  summary: string;
  contextReference: RuntimeContextReference;
  derivedContinuationContext: InvestigationContinuation["continuationContext"];
  continuationId: string;
};

export type RuntimeContextSnapshot = {
  dataset: {
    datasetId: string | null;
    name: string;
    rowCount: number;
    columnCount: number;
  };
  workbook: {
    hasWorkbook: boolean;
    activeWorksheetName: string | null;
    worksheetCount: number;
    relationshipCandidateCount: number;
    acceptedRelationshipCount: number;
  };
  mode: WorkspaceMode;
  activeView: ActiveView;
  activeResult: {
    tab: ResultTabKey | null;
    sourceType: string;
    rowCount: number;
    page: number;
    totalPages: number;
  };
  queryBuilder: QueryBuilderSnapshot;
  sql: {
    hasDrafts: boolean;
    selectedDialect: string;
    activeDraftId: string | null;
  };
  execution: {
    activeExecutionId: string | null;
    recordCount: number;
    latestSource: string | null;
  };
  taskRecommendation: {
    humanIntentLabel: string | null;
    metadataOnly: boolean;
  };
};

export type WorkspaceRuntimeContext = {
  snapshot: RuntimeContextSnapshot;
  trail: WorkspaceTrailItem[];
  continuations: InvestigationContinuation[];
  guidance: InvestigationGuidanceItem[];
  recommendationGroups: GuidanceRecommendationGroup[];
  narrative: InvestigationNarrative;
  panelSlots: RuntimePanelSlot[];
  contextualObjects: ContextualInvestigationObject[];
  selectedContextualObject: ContextualInvestigationObject | null;
  returnContinuation: InvestigationContinuation | null;
  selectedTrailItemId: string | null;
  modeContexts: {
    human: RuntimeContextReference;
    analyst: RuntimeContextReference;
  };
};

export type WorkspaceRuntimePersistenceState = {
  selectedTrailItemId: string | null;
  isRuntimePanelCollapsed: boolean;
  selectedTaskId: string | null;
  selectedContextualObjectId: string | null;
  returnContinuationId: string | null;
  continuationMetadata: {
    id: string;
    origin: InvestigationContinuationOrigin;
    targetView: ActiveView;
    targetMode: WorkspaceMode;
    reference: RuntimeContextReference;
    relatedReferences: RuntimeContextReference[];
    continuationContext: InvestigationContinuation["continuationContext"];
  } | null;
};

export type RuntimeDisclosureSlotProps = {
  id: string;
  title: string;
  label: string;
  summary: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export type BuildWorkspaceRuntimeContextOptions = {
  dataset: DatasetMetadata | null;
  mode: WorkspaceMode;
  activeView: ActiveView;
  activeResultTab: ResultTabKey;
  activeResultModel: ActiveResultModel | null;
  queryBuilder: QueryBuilderSnapshot;
  sqlWorkspaceMetadata: SqlWorkspaceMetadataSnapshot;
  executionRegistry: ExecutionRegistryState;
  humanIntentLabel: string | null;
  selectedTrailItemId: string | null;
  selectedContextualObjectId: string | null;
  returnContinuationId: string | null;
};
