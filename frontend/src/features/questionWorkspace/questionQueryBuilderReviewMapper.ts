import type { QueryBuilderRequest } from "../query-builder/queryBuilderTypes";
import type { SortDirection } from "../results/resultTypes";

export function mapQueryBuilderRequestToReviewState(request: QueryBuilderRequest) {
  return {
    querySelectedColumns: request.selected_columns,
    queryGroupBy: request.group_by,
    queryAggregations: request.aggregations.map((aggregation, index) => ({
      id: index + 1,
      function: aggregation.function,
      column: aggregation.column || "",
    })),
    querySortColumn: request.order_by?.column || "",
    querySortDirection: (request.order_by?.direction || "ASC") as SortDirection,
    queryLimit: String(request.limit || 100),
    hasRunQuery: false,
  };
}
