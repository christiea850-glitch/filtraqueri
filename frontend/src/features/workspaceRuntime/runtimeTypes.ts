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
  | "metadata-summary";

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
