import type { DatasetMetadata, WorkspaceMode } from "../dataset/datasetTypes";
import type { ExecutionRegistryRecord, ExecutionRegistryState } from "../execution/executionRegistryTypes";
import type { WorkspaceExecutionResult } from "../execution/workspaceExecutionTypes";
import type { FilterDefinition, SortDefinition } from "../filters/filterTypes";
import type { AggregationState, QueryBuilderRequest } from "../query-builder/queryBuilderTypes";
import type { ActiveResultModel } from "../results/activeResultModel";
import type { ResultState, ResultTabKey } from "../results/resultTypes";

export type WorkspaceId = string;
export type WorkspaceSessionId = string;
export type WorkspaceRestorationStatus = "idle" | "restoring" | "restored" | "reset";

export type WorkspacePaginationSnapshot = {
  page: number;
  rowsPerPage: number;
  totalCount: number;
};

export type FilterSortGroupSnapshot = {
  filters: FilterDefinition[];
  sorting: SortDefinition | null;
  grouping: string[];
};

export type QueryBuilderSnapshot = {
  selectedColumns: string[];
  groupBy: string[];
  aggregations: AggregationState[];
  sortColumn: string;
  sortDirection: ResultState["sortDirection"];
  limit: string;
  hasRunQuery: boolean;
  latestRequest: QueryBuilderRequest | null;
};

export type SqlWorkspaceSnapshot = {
  sql: string;
  message?: string;
  hasOutput: boolean;
};

export type ActiveResultSnapshot = {
  resultTab: ResultTabKey;
  result: ResultState;
  model: ActiveResultModel | null;
};

export type DatasetRegistrySnapshot = {
  activeDataset: DatasetMetadata | null;
  recentDatasetIds: string[];
};

export type WorkspaceOrchestrationSnapshot = {
  workspaceId: WorkspaceId;
  sessionId: WorkspaceSessionId;
  activeDatasetId: string | null;
  activeResultId: ResultTabKey | null;
  activeExecutionId: string | null;
  mode: WorkspaceMode;
  datasetRegistry: DatasetRegistrySnapshot;
  activeResult: ActiveResultSnapshot;
  executionRegistry: ExecutionRegistryState;
  sqlWorkspace: SqlWorkspaceSnapshot | null;
  queryBuilder: QueryBuilderSnapshot;
  pagination: WorkspacePaginationSnapshot;
  filters: FilterSortGroupSnapshot;
  restorationStatus: WorkspaceRestorationStatus;
};

export type WorkspaceOrchestrationEventMetadata = {
  eventType:
    | "execution-recorded"
    | "active-result-updated"
    | "dataset-reset"
    | "workspace-restored"
    | "links-validated";
  timestamp: string;
  datasetId: string | null;
  executionId?: string;
  resultTab?: ResultTabKey | "sql";
};

export type WorkspaceLinkValidationResult = {
  isValid: boolean;
  staleActiveResult: boolean;
  staleActiveExecution: boolean;
  messages: string[];
};

export type WorkspaceExecutionCoordinatorOptions = {
  executionResult: WorkspaceExecutionResult;
  resultTab: ResultTabKey | "sql";
  hiddenColumns: string[];
  recordExecutionResult: (
    result: WorkspaceExecutionResult,
    options: { activeResultTab: ResultTabKey | "sql"; hiddenColumns: string[] },
  ) => ExecutionRegistryRecord;
  updateActiveResult?: (result: ResultState, shouldActivate?: boolean) => void;
  shouldActivate?: boolean;
};

export type WorkspaceExecutionCoordinationResult = {
  record: ExecutionRegistryRecord;
  activeResult: ResultState;
  event: WorkspaceOrchestrationEventMetadata;
};
