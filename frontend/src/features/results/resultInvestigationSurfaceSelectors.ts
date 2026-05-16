import type { ActiveResultModel } from "./activeResultModel";

export const getResultSourceLabel = (activeResultModel: ActiveResultModel) =>
  activeResultModel.sourceType === "query"
    ? "Query result"
    : activeResultModel.sourceType === "filtered"
      ? "Filtered result"
      : "Preview result";

export const getResultTakeaway = (activeResultModel: ActiveResultModel) =>
  activeResultModel.sourceType === "query"
    ? activeResultModel.grouping.hasGrouping
      ? `Grouped result is ready. Compare ${activeResultModel.grouping.columns.join(", ")} before refining or exporting.`
      : "Query output is ready. Review the selected fields before refining or exporting."
    : activeResultModel.sourceType === "filtered"
      ? "Filtered rows are ready. Review what changed before refining or exporting."
      : "Preview rows are ready. Use this pass to understand structure before filtering or grouping.";

export const getResultContinuationSuggestion = (
  activeResultModel: ActiveResultModel,
  isAnalystMode: boolean,
) =>
  isAnalystMode
    ? activeResultModel.sourceType === "query"
      ? "Check query context"
      : "Inspect result model"
    : activeResultModel.sourceType === "query"
      ? "Compare groups"
      : activeResultModel.sourceType === "filtered"
        ? "Refine question"
        : "Review what changed";

export const getActiveSortLabel = (activeResultModel: ActiveResultModel) =>
  activeResultModel.sorting.column
    ? `${activeResultModel.sorting.column} ${activeResultModel.sorting.direction}`
    : "No sort";

export const getTopContributorLabel = (activeResultModel: ActiveResultModel) =>
  activeResultModel.grouping.hasGrouping
    ? `Compare by ${activeResultModel.grouping.columns[0]}`
    : activeResultModel.chartReady.groupingCandidates[0]
      ? `Segment by ${activeResultModel.chartReady.groupingCandidates[0].name}`
      : "Choose a category to compare";

export const getHighlightLabel = (activeResultModel: ActiveResultModel) =>
  activeResultModel.insightReady.missingValueCount > 0
    ? `${activeResultModel.insightReady.missingValueColumns.length.toLocaleString()} columns contain empty values`
    : activeResultModel.chartReady.isLargeResult
      ? "Large result; review filters before exporting"
      : activeResultModel.sorting.column
        ? `Sorted by ${activeResultModel.sorting.column}`
        : "No obvious quality flags in this result";

export const getChartSupportLabel = (activeResultModel: ActiveResultModel) =>
  activeResultModel.chartReady.categoricalColumns.length > 0 &&
  activeResultModel.chartReady.numericColumns.length > 0
    ? "Chart support available"
    : "Table review recommended";

export const getHiddenColumnCount = (activeResultModel: ActiveResultModel) =>
  activeResultModel.columns.length - activeResultModel.visibleColumns.length;
