import { filterDataset, runQueryBuilder } from "../../services/api";
import type { FilterResponse } from "../filters/filterTypes";
import type {
  WorkspaceDatasetIdentity,
  WorkspaceExecutionRequest,
  WorkspaceExecutionResult,
  WorkspaceExecutionSource,
  WorkspaceExecutionStatus,
} from "./workspaceExecutionTypes";

const createDatasetIdentity = ({
  dataset_id,
  original_filename,
  table_name,
}: WorkspaceExecutionRequest["dataset"]): WorkspaceDatasetIdentity => ({
  datasetId: dataset_id,
  datasetName: original_filename,
  tableName: table_name,
});

function createExecutionResult({
  request,
  columns,
  rows,
  totalCount,
  status = "success",
  error = null,
}: {
  request: WorkspaceExecutionRequest;
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
  status?: WorkspaceExecutionStatus;
  error?: string | null;
}): WorkspaceExecutionResult {
  const sortColumn = request.sorting?.column || "";
  const sortDirection = request.sorting?.direction || "ASC";
  const rowsPerPage = request.pagination.rowsPerPage;
  const page = request.pagination.page;

  return {
    source: request.source,
    dataset: createDatasetIdentity(request.dataset),
    inputRows: request.inputRows || [],
    filters: request.filters || [],
    queryBuilder: request.queryBuilder || null,
    sql: request.sql || null,
    sorting: request.sorting || null,
    grouping: request.grouping || request.queryBuilder?.group_by || [],
    pagination: {
      page,
      rowsPerPage,
      totalCount,
    },
    status,
    error,
    executedAt: new Date().toISOString(),
    outputRows: rows,
    outputVisibleColumns: columns,
    activeResult: {
      columns,
      rows,
      totalCount,
      page,
      rowsPerPage,
      sortColumn,
      sortDirection,
      source: {
        filters: request.filters || [],
        queryBuilder: request.queryBuilder || undefined,
        orderBy: request.sorting || null,
      },
    },
  };
}

function getResponseTotalCount(response: FilterResponse, source: WorkspaceExecutionSource) {
  if (source === "filtered") return response.filtered_count;
  return response.total_count;
}

export async function executeWorkspaceQuery(
  request: WorkspaceExecutionRequest,
): Promise<WorkspaceExecutionResult> {
  if (request.source === "preview" && request.inputRows && request.inputColumns) {
    return wrapWorkspaceExecutionOutput(request);
  }

  if (request.source === "query-builder" && request.queryBuilder) {
    const response = await runQueryBuilder(request.dataset.dataset_id, request.queryBuilder);

    return createExecutionResult({
      request,
      columns: response.columns,
      rows: response.rows,
      totalCount: response.total_count,
    });
  }

  if (request.source === "filtered" || request.source === "preview") {
    const response = await filterDataset(request.dataset.dataset_id, {
      filters: request.source === "filtered" ? request.filters || [] : [],
      limit: request.pagination.rowsPerPage,
      page: request.pagination.page,
      order_by: request.sorting,
    });

    return createExecutionResult({
      request,
      columns: response.columns,
      rows: response.rows,
      totalCount: getResponseTotalCount(response, request.source),
    });
  }

  return createExecutionResult({
    request,
    columns: request.inputColumns || [],
    rows: request.inputRows || [],
    totalCount: request.inputRows?.length || 0,
  });
}

export function wrapWorkspaceExecutionOutput(
  request: WorkspaceExecutionRequest,
): WorkspaceExecutionResult {
  return createExecutionResult({
    request,
    columns: request.inputColumns || [],
    rows: request.inputRows || [],
    totalCount: request.inputRows?.length || 0,
  });
}
