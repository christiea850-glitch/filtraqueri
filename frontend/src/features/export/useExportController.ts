import { useState } from "react";
import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { FilterDefinition } from "../filters/filterTypes";
import type { AggregationState } from "../query-builder/queryBuilderTypes";
import type { ActiveResultModel } from "../results/activeResultModel";
import { getExportPayload, getQuerySourceType } from "../results/activeResultModel";
import { exportDataset } from "../../services/api";

const MAX_QUERY_LIMIT = 1000;

function useExportController({
  dataset,
  activeResultModel,
  hasRunQuery,
  queryLimit,
  queryGroupBy,
  querySelectedColumns,
  activeAggregations,
  querySortColumn,
  querySortDirection,
  buildBackendFilters,
  addHistory,
}: {
  dataset: DatasetMetadata | null;
  activeResultModel: ActiveResultModel | null;
  hasRunQuery: boolean;
  queryLimit: string;
  queryGroupBy: string[];
  querySelectedColumns: string[];
  activeAggregations: AggregationState[];
  querySortColumn: string;
  querySortDirection: "ASC" | "DESC";
  buildBackendFilters: () => FilterDefinition[];
  addHistory: (action: string, detail: string, resultCount: number) => void;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const exportCurrentResults = async () => {
    if (!dataset || !activeResultModel) return;

    setIsExporting(true);

    try {
      const exportPayload = getExportPayload(activeResultModel);
      const sourceType = getQuerySourceType(activeResultModel);
      const isQueryExport = sourceType === "query" && hasRunQuery;
      const isFilteredExport = sourceType === "filtered";
      const blob = await exportDataset(
        dataset.dataset_id,
        isQueryExport
          ? {
              source: "query_builder",
              limit: Math.min(Number(queryLimit) || MAX_QUERY_LIMIT, MAX_QUERY_LIMIT),
              query_builder: {
                selected_columns:
                  activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns,
                group_by: queryGroupBy,
                aggregations: activeAggregations.map((aggregation) => ({
                  function: aggregation.function,
                  column: aggregation.column || null,
                })),
                filters: buildBackendFilters(),
                order_by: querySortColumn
                  ? {
                      column: querySortColumn,
                      direction: querySortDirection,
                    }
                  : null,
                limit: Math.min(Number(queryLimit) || MAX_QUERY_LIMIT, MAX_QUERY_LIMIT),
                page: 1,
              },
            }
          : {
              source: "filter",
              filters: isFilteredExport ? buildBackendFilters() : [],
              order_by: activeResultModel.sorting.column
                ? {
                    column: activeResultModel.sorting.column,
                    direction: activeResultModel.sorting.direction,
                  }
                : null,
              limit: MAX_QUERY_LIMIT,
            },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${dataset.filename.replace(/\.csv$/i, "")}_export.csv`;
      link.click();
      URL.revokeObjectURL(url);
      addHistory(
        "Export",
        isQueryExport ? "Exported query result" : "Exported filtered result",
        exportPayload?.rowCount || activeResultModel.totalCount,
      );
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "We could not export the current results.";
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    exportCurrentResults,
  };
}

export default useExportController;
