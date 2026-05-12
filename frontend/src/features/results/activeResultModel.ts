import { useEffect, useMemo, useState } from "react";
import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import type { FilterDefinition } from "../filters/filterTypes";
import type { AggregationState } from "../query-builder/queryBuilderTypes";
import type { ResultState, ResultTabKey, SortDirection } from "./resultTypes";

export type ActiveResultSourceType = "preview" | "filtered" | "query";

export type ActiveResultModel = {
  datasetId: string;
  datasetName: string;
  sourceType: ActiveResultSourceType;
  sourceTab: ResultTabKey;
  rows: Record<string, unknown>[];
  visibleRows: Record<string, unknown>[];
  columns: string[];
  visibleColumns: string[];
  hiddenColumns: string[];
  totalCount: number;
  filteredCount: number;
  page: number;
  totalPages: number;
  rowsPerPage: number;
  filters: {
    activeLabels: string[];
    backendFilters: FilterDefinition[];
  };
  grouping: {
    columns: string[];
    hasGrouping: boolean;
  };
  sorting: {
    column: string;
    direction: SortDirection;
  };
  query: {
    hasRun: boolean;
    selectedColumns: string[];
    aggregations: AggregationState[];
    limit: string;
  };
  export: {
    sourceType: ActiveResultSourceType;
    rowCount: number;
    columns: string[];
    rows: Record<string, unknown>[];
  };
  chartReady: {
    numericColumns: SchemaColumn[];
    categoricalColumns: SchemaColumn[];
    groupingCandidates: SchemaColumn[];
    isLargeResult: boolean;
  };
  insightReady: {
    missingValueCount: number;
    missingValueColumns: SchemaColumn[];
    numericRanges: Array<{
      column: string;
      min?: number | string;
      max?: number | string;
    }>;
    topCandidateColumns: SchemaColumn[];
    distinctCounts: Array<{
      column: string;
      uniqueCount: number;
    }>;
    previewRowCount: number;
  };
};

type ActiveResultModelOptions = {
  dataset: DatasetMetadata | null;
  activeResultTab: ResultTabKey;
  activeResult: ResultState;
  previewResult: ResultState;
  activeFilterLabels: string[];
  activeFilters: FilterDefinition[];
  queryGroupBy: string[];
  querySelectedColumns: string[];
  activeAggregations: AggregationState[];
  queryLimit: string;
  hasRunQuery: boolean;
  hiddenColumns: string[];
};

type UseActiveResultModelOptions = Omit<ActiveResultModelOptions, "hiddenColumns">;

export const getActiveResultSourceType = (tab: ResultTabKey): ActiveResultSourceType =>
  tab === "queried" ? "query" : tab;

export const getActiveRows = (model: ActiveResultModel | null) => model?.rows || [];

export const getActiveVisibleColumns = (model: ActiveResultModel | null) =>
  model?.visibleColumns || [];

export const getCurrentRowCount = (model: ActiveResultModel | null) => model?.totalCount || 0;

export const getFilteredCount = (model: ActiveResultModel | null) => model?.filteredCount || 0;

export const getQuerySourceType = (model: ActiveResultModel | null) =>
  model?.sourceType || "preview";

export const getExportPayload = (model: ActiveResultModel | null) => model?.export || null;

export const getVisiblePageRows = (model: ActiveResultModel | null) => model?.visibleRows || [];

export const getCurrentPageMetadata = (model: ActiveResultModel | null) => ({
  page: model?.page || 1,
  totalPages: model?.totalPages || 1,
  rowsPerPage: model?.rowsPerPage || 25,
  totalCount: model?.totalCount || 0,
});

export function createActiveResultModel({
  dataset,
  activeResultTab,
  activeResult,
  previewResult,
  activeFilterLabels,
  activeFilters,
  queryGroupBy,
  querySelectedColumns,
  activeAggregations,
  queryLimit,
  hasRunQuery,
  hiddenColumns,
}: ActiveResultModelOptions): ActiveResultModel | null {
  if (!dataset) return null;

  const sourceType = getActiveResultSourceType(activeResultTab);
  const sourceColumns = activeResult.columns;
  const visibleColumns = sourceColumns.filter((column) => !hiddenColumns.includes(column));
  const totalCount = activeResult.totalCount;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / activeResult.rowsPerPage));
  const numericColumns = dataset.schema.filter((column) => column.inferred_type === "numeric");
  const categoricalColumns = dataset.schema.filter(
    (column) => column.inferred_type === "categorical" || column.inferred_type === "text",
  );
  const groupingCandidates = dataset.schema.filter(
    (column) =>
      column.inferred_type === "categorical" ||
      column.inferred_type === "text" ||
      column.inferred_type === "date",
  );
  const missingValueColumns = dataset.schema.filter((column) => column.null_count > 0);

  return {
    datasetId: dataset.dataset_id,
    datasetName: dataset.original_filename,
    sourceType,
    sourceTab: activeResultTab,
    rows: activeResult.rows,
    visibleRows: activeResult.rows,
    columns: sourceColumns,
    visibleColumns,
    hiddenColumns,
    totalCount,
    filteredCount: sourceType === "filtered" ? totalCount : activeFilterLabels.length > 0 ? totalCount : 0,
    page: activeResult.page,
    totalPages,
    rowsPerPage: activeResult.rowsPerPage,
    filters: {
      activeLabels: activeFilterLabels,
      backendFilters: activeFilters,
    },
    grouping: {
      columns: queryGroupBy,
      hasGrouping: queryGroupBy.length > 0,
    },
    sorting: {
      column: activeResult.sortColumn,
      direction: activeResult.sortDirection,
    },
    query: {
      hasRun: hasRunQuery,
      selectedColumns: querySelectedColumns,
      aggregations: activeAggregations,
      limit: queryLimit,
    },
    export: {
      sourceType,
      rowCount: totalCount,
      columns: sourceColumns,
      rows: activeResult.rows,
    },
    chartReady: {
      numericColumns,
      categoricalColumns,
      groupingCandidates,
      isLargeResult: totalCount > 5000,
    },
    insightReady: {
      missingValueCount: missingValueColumns.reduce(
        (sum, column) => sum + column.null_count,
        0,
      ),
      missingValueColumns,
      numericRanges: numericColumns.map((column) => ({
        column: column.name,
        min: column.min,
        max: column.max,
      })),
      topCandidateColumns: [...categoricalColumns, ...numericColumns].slice(0, 8),
      distinctCounts: dataset.schema.map((column) => ({
        column: column.name,
        uniqueCount: column.unique_count,
      })),
      previewRowCount: previewResult.rows.length,
    },
  };
}

function useActiveResultModel(options: UseActiveResultModelOptions) {
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const activeColumns = options.activeResult.columns;

  useEffect(() => {
    setHiddenColumns((currentColumns) =>
      currentColumns.filter((column) => activeColumns.includes(column)),
    );
  }, [activeColumns]);

  const activeResultModel = useMemo(
    () => createActiveResultModel({ ...options, hiddenColumns }),
    [options, hiddenColumns],
  );

  return {
    activeResultModel,
    hiddenColumns,
    setHiddenColumns,
  };
}

export default useActiveResultModel;
