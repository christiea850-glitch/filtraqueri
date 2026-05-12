import type { SchemaColumn } from "./datasetTypes";
import type { DatasetMetadata } from "./datasetTypes";
import type { ResultTabKey } from "../results/resultTypes";

export type DatasetId = string;

export type DatasetRegistrySourceType =
  | "uploaded"
  | "preview"
  | "execution-input"
  | "session-restored";

export type DatasetRegistryStatus = "ready" | "loading" | "error" | "restored";

export type DatasetRestorationMetadata = {
  restoredAt: string;
  sourceSessionId?: string;
};

export type DatasetLineageMetadata = {
  parentDatasetId?: DatasetId;
  sourceExecutionId?: string;
  reason?: string;
};

export type DatasetRegistryRecord = {
  datasetId: DatasetId;
  metadata: DatasetMetadata;
  name: string;
  sourceType: DatasetRegistrySourceType;
  schema: SchemaColumn[];
  rowCount: number;
  columnCount: number;
  visibleColumns: string[];
  hiddenColumns: string[];
  status: DatasetRegistryStatus;
  isActive: boolean;
  createdAt: string;
  restoration: DatasetRestorationMetadata | null;
  lineage: DatasetLineageMetadata | null;
  activeResultId: ResultTabKey | null;
  executionIds: string[];
};

export type DatasetRegistryState = {
  records: DatasetRegistryRecord[];
  activeDatasetId: DatasetId | null;
};

export type RegisterDatasetOptions = {
  sourceType: DatasetRegistrySourceType;
  visibleColumns?: string[];
  hiddenColumns?: string[];
  status?: DatasetRegistryStatus;
  isActive?: boolean;
  createdAt?: string;
  restoration?: DatasetRestorationMetadata | null;
  lineage?: DatasetLineageMetadata | null;
  activeResultId?: ResultTabKey | null;
  executionIds?: string[];
};
