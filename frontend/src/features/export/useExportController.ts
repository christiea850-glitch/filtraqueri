import { useState } from "react";
import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { ActiveResultModel } from "../results/activeResultModel";
import { getExportPayload, getQuerySourceType } from "../results/activeResultModel";
import { exportDataset } from "../../services/api";

const MAX_QUERY_LIMIT = 1000;

function useExportController({
  dataset,
  activeResultModel,
  addHistory,
}: {
  dataset: DatasetMetadata | null;
  activeResultModel: ActiveResultModel | null;
  addHistory: (action: string, detail: string, resultCount: number) => void;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const exportCurrentResults = async () => {
    if (!dataset || !activeResultModel) return;

    setIsExporting(true);

    try {
      const exportPayload = getExportPayload(activeResultModel);
      const sourceType = getQuerySourceType(activeResultModel);
      if (!exportPayload) return "We could not export the current results.";

      const isQueryExport = sourceType === "query" && Boolean(exportPayload?.queryBuilder);
      const isFilteredExport = sourceType === "filtered";
      const queryExportLimit = Math.min(
        exportPayload?.queryBuilder?.limit || MAX_QUERY_LIMIT,
        MAX_QUERY_LIMIT,
      );
      const blob = await exportDataset(
        dataset.dataset_id,
        isQueryExport
          ? {
              source: "query_builder",
              limit: queryExportLimit,
              query_builder: {
                ...exportPayload.queryBuilder!,
                limit: queryExportLimit,
                page: 1,
              },
            }
          : {
              source: isFilteredExport ? "filter" : "preview",
              filters: isFilteredExport ? exportPayload?.filters || [] : [],
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
        isQueryExport
          ? "Exported query result"
          : isFilteredExport
            ? "Exported filtered result"
            : "Exported preview result",
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
