import type { ResultTabKey } from "../results/resultTypes";
import type {
  WorkspaceExecutionSource,
  WorkspaceExecutionStatus,
  WorkspacePaginationMetadata,
  WorkspaceSqlMetadata,
} from "./workspaceExecutionTypes";
import type { FilterDefinition, SortDefinition } from "../filters/filterTypes";
import type { QueryBuilderRequest } from "../query-builder/queryBuilderTypes";

export type ExecutionId = string;

export type ExecutionErrorMetadata = {
  message: string;
  code?: string;
};

export type ActiveResultLinkage = {
  resultTab: ResultTabKey | "sql";
  rowCount: number;
  page: number;
};

export type ExecutionRegistryRecord = {
  executionId: ExecutionId;
  datasetId: string;
  source: WorkspaceExecutionSource;
  timestamp: string;
  status: WorkspaceExecutionStatus;
  rowCount: number;
  visibleRowCount: number;
  visibleColumns: string[];
  hiddenColumns: string[];
  filters: FilterDefinition[];
  sorting: SortDefinition | null;
  grouping: string[];
  queryBuilder: QueryBuilderRequest | null;
  sql: WorkspaceSqlMetadata | null;
  pagination: WorkspacePaginationMetadata;
  activeResult: ActiveResultLinkage;
  error: ExecutionErrorMetadata | null;
};

export type ExecutionRegistryState = {
  records: ExecutionRegistryRecord[];
  activeExecutionId: ExecutionId | null;
};

export type CreateExecutionRecordOptions = {
  hiddenColumns?: string[];
  activeResultTab?: ResultTabKey | "sql";
};
