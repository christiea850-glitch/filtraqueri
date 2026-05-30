import type { FilterState } from "../filters/filterTypes";
import type { HistoryItem } from "../history/historyTypes";
import type { AggregationState } from "../query-builder/queryBuilderTypes";
import type { ResultState, ResultTabKey, SortDirection } from "../results/resultTypes";
import type { WorkspaceManifest } from "../workspace/workspaceManifestTypes";
import type { WorkbookMetadata } from "../workbook";

export type HistogramBucket = {
  bucket_min: number;
  bucket_max: number;
  count: number;
};

export type NumericStats = {
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
};

export type TopValue = {
  value: string;
  count: number;
};

export type DateRange = {
  min: string;
  max: string;
};

export type TextLengthStats = {
  min_length: number;
  max_length: number;
  avg_length: number;
};

export type SchemaColumn = {
  name: string;
  type: string;
  inferred_type: "text" | "numeric" | "date" | "boolean" | "categorical";
  null_count: number;
  unique_count: number;
  sample_values: unknown[];
  min?: number | string;
  max?: number | string;
  histogram_buckets?: HistogramBucket[];
  numeric_stats?: NumericStats;
  top_values?: TopValue[];
  date_range?: DateRange;
  text_length_stats?: TextLengthStats;
};

export type DatasetMetadata = {
  dataset_id: string;
  filename: string;
  original_filename: string;
  table_name: string;
  uploaded_at: string;
  row_count: number;
  column_count: number;
  schema: SchemaColumn[];
  workbook_metadata?: WorkbookMetadata;
};

export type UploadResponse = {
  dataset: DatasetMetadata;
  preview: Record<string, unknown>[];
  workspace_manifest: WorkspaceManifest;
  workbook_metadata?: unknown;
};

export type ActiveView =
  | "welcome"
  | "dataset"
  | "filters"
  | "queryBuilder"
  | "results"
  | "history"
  | "export"
  | "settings"
  | "sqlWorkspace"
  | "savedQueries"
  | "queryExplain"
  | "dataCleaning"
  | "diagnostics"
  | "normalization";

export type WorkspaceMode = "human" | "analyst";

export type DatasetSession = {
  dataset: DatasetMetadata;
  lastActiveView: ActiveView;
  lastActiveResultTab: ResultTabKey;
  previewResult: ResultState;
  filteredResult: ResultState;
  queriedResult: ResultState;
  filterValues: Record<string, FilterState>;
  querySelectedColumns: string[];
  queryGroupBy: string[];
  queryAggregations: AggregationState[];
  querySortColumn: string;
  querySortDirection: SortDirection;
  queryLimit: string;
  hasRunQuery: boolean;
  activeResultTab: ResultTabKey;
  queryHistory: HistoryItem[];
};
