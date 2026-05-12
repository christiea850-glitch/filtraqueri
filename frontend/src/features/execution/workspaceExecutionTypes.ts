import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { FilterDefinition, SortDefinition } from "../filters/filterTypes";
import type { QueryBuilderRequest } from "../query-builder/queryBuilderTypes";
import type { ResultState } from "../results/resultTypes";

export type WorkspaceExecutionSource = "preview" | "filtered" | "query-builder" | "sql";

export type WorkspaceExecutionStatus = "idle" | "running" | "success" | "error";

export type WorkspaceDatasetIdentity = {
  datasetId: string;
  datasetName: string;
  tableName: string;
};

export type WorkspacePaginationMetadata = {
  page: number;
  rowsPerPage: number;
  totalCount: number;
};

export type WorkspaceSqlMetadata = {
  sql: string;
  message?: string;
};

export type WorkspaceExecutionRequest = {
  source: WorkspaceExecutionSource;
  dataset: DatasetMetadata;
  inputRows?: Record<string, unknown>[];
  inputColumns?: string[];
  filters?: FilterDefinition[];
  queryBuilder?: QueryBuilderRequest;
  sql?: WorkspaceSqlMetadata;
  sorting?: SortDefinition | null;
  grouping?: string[];
  pagination: {
    page: number;
    rowsPerPage: number;
  };
};

export type WorkspaceActiveResultAdapterPayload = ResultState;

export type WorkspaceExecutionResult = {
  source: WorkspaceExecutionSource;
  dataset: WorkspaceDatasetIdentity;
  inputRows: Record<string, unknown>[];
  filters: FilterDefinition[];
  queryBuilder: QueryBuilderRequest | null;
  sql: WorkspaceSqlMetadata | null;
  sorting: SortDefinition | null;
  grouping: string[];
  pagination: WorkspacePaginationMetadata;
  status: WorkspaceExecutionStatus;
  error: string | null;
  executedAt: string;
  outputRows: Record<string, unknown>[];
  outputVisibleColumns: string[];
  activeResult: WorkspaceActiveResultAdapterPayload;
};
