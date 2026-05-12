import { useCallback, useState } from "react";
import type { WorkspaceExecutionResult } from "./workspaceExecutionTypes";
import type {
  CreateExecutionRecordOptions,
  ExecutionId,
  ExecutionRegistryRecord,
  ExecutionRegistryState,
} from "./executionRegistryTypes";

const DEFAULT_HISTORY_LIMIT = 100;

const createExecutionId = (result: WorkspaceExecutionResult) =>
  [
    result.dataset.datasetId,
    result.source,
    Date.parse(result.executedAt),
    result.pagination.page,
    result.outputRows.length,
    result.outputVisibleColumns.length,
  ].join("-");

export const createExecutionRecord = (
  result: WorkspaceExecutionResult,
  options: CreateExecutionRecordOptions = {},
): ExecutionRegistryRecord => {
  const hiddenColumns = options.hiddenColumns || [];
  const visibleColumns = result.outputVisibleColumns.filter(
    (column) => !hiddenColumns.includes(column),
  );

  return {
    executionId: createExecutionId(result),
    datasetId: result.dataset.datasetId,
    source: result.source,
    timestamp: result.executedAt,
    status: result.status,
    rowCount: result.pagination.totalCount,
    visibleRowCount: result.outputRows.length,
    visibleColumns,
    hiddenColumns,
    filters: result.filters,
    sorting: result.sorting,
    grouping: result.grouping,
    queryBuilder: result.queryBuilder,
    sql: result.sql,
    pagination: result.pagination,
    activeResult: {
      resultTab: options.activeResultTab || (result.source === "query-builder" ? "queried" : result.source),
      rowCount: result.activeResult.totalCount,
      page: result.activeResult.page,
    },
    error: result.error ? { message: result.error } : null,
  };
};

export const trimExecutionHistory = (
  records: ExecutionRegistryRecord[],
  limit = DEFAULT_HISTORY_LIMIT,
) => records.slice(0, limit);

export const appendExecutionRecord = (
  state: ExecutionRegistryState,
  record: ExecutionRegistryRecord,
  limit = DEFAULT_HISTORY_LIMIT,
): ExecutionRegistryState => ({
  records: trimExecutionHistory([record, ...state.records], limit),
  activeExecutionId: record.executionId,
});

export const getLatestExecution = (state: ExecutionRegistryState) => state.records[0] || null;

export const getActiveExecution = (state: ExecutionRegistryState) =>
  state.records.find((record) => record.executionId === state.activeExecutionId) || null;

export const getExecutionById = (state: ExecutionRegistryState, executionId: ExecutionId) =>
  state.records.find((record) => record.executionId === executionId) || null;

export const getExecutionsByDatasetId = (
  state: ExecutionRegistryState,
  datasetId: string,
) => state.records.filter((record) => record.datasetId === datasetId);

export const getExecutionsBySourceType = (
  state: ExecutionRegistryState,
  source: ExecutionRegistryRecord["source"],
) => state.records.filter((record) => record.source === source);

export const getRecentExecutions = (
  state: ExecutionRegistryState,
  limit = 10,
) => state.records.slice(0, limit);

function useExecutionRegistry(limit = DEFAULT_HISTORY_LIMIT) {
  const [registry, setRegistry] = useState<ExecutionRegistryState>({
    records: [],
    activeExecutionId: null,
  });

  const recordExecutionResult = useCallback(
    (result: WorkspaceExecutionResult, options?: CreateExecutionRecordOptions) => {
      const record = createExecutionRecord(result, options);
      setRegistry((currentRegistry) => appendExecutionRecord(currentRegistry, record, limit));
      return record;
    },
    [limit],
  );

  return {
    registry,
    recordExecutionResult,
    latestExecution: getLatestExecution(registry),
    activeExecution: getActiveExecution(registry),
    getExecutionById: (executionId: ExecutionId) => getExecutionById(registry, executionId),
    getExecutionsByDatasetId: (datasetId: string) =>
      getExecutionsByDatasetId(registry, datasetId),
    getExecutionsBySourceType: (source: ExecutionRegistryRecord["source"]) =>
      getExecutionsBySourceType(registry, source),
    getRecentExecutions: (recentLimit?: number) => getRecentExecutions(registry, recentLimit),
  };
}

export default useExecutionRegistry;
