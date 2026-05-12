import type { DatasetMetadata, DatasetSession, WorkspaceMode } from "../dataset/datasetTypes";
import type { ExecutionRegistryState } from "../execution/executionRegistryTypes";
import type { WorkspaceExecutionResult } from "../execution/workspaceExecutionTypes";
import type { FilterDefinition, SortDefinition } from "../filters/filterTypes";
import type { AggregationState, QueryBuilderRequest } from "../query-builder/queryBuilderTypes";
import type { ActiveResultModel } from "../results/activeResultModel";
import type { ResultState, ResultTabKey } from "../results/resultTypes";
import type {
  FilterSortGroupSnapshot,
  QueryBuilderSnapshot,
  SqlWorkspaceSnapshot,
  WorkspaceExecutionCoordinationResult,
  WorkspaceExecutionCoordinatorOptions,
  WorkspaceLinkValidationResult,
  WorkspaceOrchestrationSnapshot,
  WorkspaceRestorationStatus,
} from "./workspaceOrchestrationTypes";

export const getResultTabForExecutionSource = (
  result: WorkspaceExecutionResult,
): ResultTabKey | "sql" => {
  if (result.source === "query-builder") return "queried";
  if (result.source === "filtered") return "filtered";
  if (result.source === "sql") return "sql";
  return "preview";
};

export const createWorkspaceSessionId = (dataset: DatasetMetadata | null) =>
  dataset ? `${dataset.dataset_id}:${dataset.uploaded_at}` : "no-dataset";

export const createWorkspaceId = (dataset: DatasetMetadata | null) =>
  dataset?.dataset_id || "workspace-empty";

export const createPaginationSnapshot = (
  activeResult: ResultState,
): WorkspaceOrchestrationSnapshot["pagination"] => ({
  page: activeResult.page,
  rowsPerPage: activeResult.rowsPerPage,
  totalCount: activeResult.totalCount,
});

export const createFilterSortGroupSnapshot = ({
  filters,
  sorting,
  grouping,
}: {
  filters: FilterDefinition[];
  sorting: SortDefinition | null;
  grouping: string[];
}): FilterSortGroupSnapshot => ({
  filters,
  sorting,
  grouping,
});

export const createQueryBuilderSnapshot = ({
  selectedColumns,
  groupBy,
  aggregations,
  sortColumn,
  sortDirection,
  limit,
  hasRunQuery,
  latestRequest,
}: {
  selectedColumns: string[];
  groupBy: string[];
  aggregations: AggregationState[];
  sortColumn: string;
  sortDirection: ResultState["sortDirection"];
  limit: string;
  hasRunQuery: boolean;
  latestRequest?: QueryBuilderRequest | null;
}): QueryBuilderSnapshot => ({
  selectedColumns,
  groupBy,
  aggregations,
  sortColumn,
  sortDirection,
  limit,
  hasRunQuery,
  latestRequest: latestRequest || null,
});

export const createSqlWorkspaceSnapshot = ({
  sql,
  message,
  hasOutput,
}: SqlWorkspaceSnapshot): SqlWorkspaceSnapshot => ({
  sql,
  message,
  hasOutput,
});

export const buildWorkspaceStateSnapshot = ({
  dataset,
  recentDatasets,
  activeResultTab,
  activeResult,
  activeResultModel,
  executionRegistry,
  mode,
  activeFilters,
  sorting,
  grouping,
  queryBuilder,
  sqlWorkspace = null,
  restorationStatus = "idle",
}: {
  dataset: DatasetMetadata | null;
  recentDatasets: DatasetSession[];
  activeResultTab: ResultTabKey;
  activeResult: ResultState;
  activeResultModel: ActiveResultModel | null;
  executionRegistry: ExecutionRegistryState;
  mode: WorkspaceMode;
  activeFilters: FilterDefinition[];
  sorting: SortDefinition | null;
  grouping: string[];
  queryBuilder: QueryBuilderSnapshot;
  sqlWorkspace?: SqlWorkspaceSnapshot | null;
  restorationStatus?: WorkspaceRestorationStatus;
}): WorkspaceOrchestrationSnapshot => ({
  workspaceId: createWorkspaceId(dataset),
  sessionId: createWorkspaceSessionId(dataset),
  activeDatasetId: dataset?.dataset_id || null,
  activeResultId: activeResultTab,
  activeExecutionId: executionRegistry.activeExecutionId,
  mode,
  datasetRegistry: {
    activeDataset: dataset,
    recentDatasetIds: recentDatasets.map((session) => session.dataset.dataset_id),
  },
  activeResult: {
    resultTab: activeResultTab,
    result: activeResult,
    model: activeResultModel,
  },
  executionRegistry,
  sqlWorkspace,
  queryBuilder,
  pagination: createPaginationSnapshot(activeResult),
  filters: createFilterSortGroupSnapshot({
    filters: activeFilters,
    sorting,
    grouping,
  }),
  restorationStatus,
});

export const coordinateExecutionResult = ({
  executionResult,
  resultTab,
  hiddenColumns,
  recordExecutionResult,
  updateActiveResult,
  shouldActivate = false,
}: WorkspaceExecutionCoordinatorOptions): WorkspaceExecutionCoordinationResult => {
  const record = recordExecutionResult(executionResult, {
    activeResultTab: resultTab,
    hiddenColumns,
  });

  if (resultTab !== "sql") {
    updateActiveResult?.(executionResult.activeResult, shouldActivate);
  }

  return {
    record,
    activeResult: executionResult.activeResult,
    event: {
      eventType: "execution-recorded",
      timestamp: record.timestamp,
      datasetId: record.datasetId,
      executionId: record.executionId,
      resultTab,
    },
  };
};

export const validateWorkspaceLinks = (
  snapshot: WorkspaceOrchestrationSnapshot,
): WorkspaceLinkValidationResult => {
  const messages: string[] = [];
  const activeDatasetId = snapshot.activeDatasetId;
  const activeExecution = snapshot.executionRegistry.records.find(
    (record) => record.executionId === snapshot.activeExecutionId,
  );
  const staleActiveExecution = Boolean(
    activeExecution && activeDatasetId && activeExecution.datasetId !== activeDatasetId,
  );
  const staleActiveResult = Boolean(
    activeDatasetId &&
      snapshot.activeResult.result.rows.length > 0 &&
      snapshot.activeResult.model &&
      snapshot.activeResult.model?.datasetId !== activeDatasetId,
  );

  if (staleActiveExecution) messages.push("Active execution belongs to another dataset.");
  if (staleActiveResult) messages.push("Active result model belongs to another dataset.");

  return {
    isValid: !staleActiveExecution && !staleActiveResult,
    staleActiveResult,
    staleActiveExecution,
    messages,
  };
};

export const preventStaleActiveResultReference = (
  snapshot: WorkspaceOrchestrationSnapshot,
  fallbackResult: ResultState,
) => {
  const validation = validateWorkspaceLinks(snapshot);
  return validation.staleActiveResult ? fallbackResult : snapshot.activeResult.result;
};

export const resetWorkspaceForDatasetChange = () => ({
  activeResultTab: "preview" as ResultTabKey,
  restorationStatus: "reset" as WorkspaceRestorationStatus,
});

export const restoreWorkspaceStateSafely = (
  session: DatasetSession,
  fallbackTab: ResultTabKey = "preview",
) => ({
  dataset: session.dataset,
  activeResultTab: session.lastActiveResultTab || session.activeResultTab || fallbackTab,
  previewResult: session.previewResult,
  filteredResult: session.filteredResult,
  queriedResult: session.queriedResult,
  restorationStatus: "restored" as WorkspaceRestorationStatus,
});
