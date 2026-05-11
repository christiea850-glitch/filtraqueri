import { useState } from "react";
import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { AggregationState } from "./queryBuilderTypes";
import type { SortDirection } from "../results/resultTypes";

function useQueryBuilderController() {
  const [querySelectedColumns, setQuerySelectedColumns] = useState<string[]>([]);
  const [queryGroupBy, setQueryGroupBy] = useState<string[]>([]);
  const [queryAggregations, setQueryAggregations] = useState<AggregationState[]>([
    { id: 1, function: "COUNT", column: "" },
  ]);
  const [querySortColumn, setQuerySortColumn] = useState("");
  const [querySortDirection, setQuerySortDirection] = useState<SortDirection>("ASC");
  const [queryLimit, setQueryLimit] = useState("100");
  const [hasRunQuery, setHasRunQuery] = useState(false);

  const toggleListValue = (values: string[], value: string) =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

  const aggregationAlias = (aggregation: AggregationState) => {
    if (aggregation.function === "COUNT" && !aggregation.column) return "count_rows";
    return `${aggregation.function.toLowerCase()}_${aggregation.column.replace(/[^A-Za-z0-9_]/g, "_").toLowerCase()}`;
  };

  const activeAggregations = queryAggregations.filter(
    (aggregation) => aggregation.function === "COUNT" || aggregation.column,
  );

  const querySortOptions = [
    ...(activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns),
    ...activeAggregations.map(aggregationAlias),
  ];

  const resetQueryBuilder = () => {
    setQuerySelectedColumns([]);
    setQueryGroupBy([]);
    setQueryAggregations([{ id: 1, function: "COUNT", column: "" }]);
    setQuerySortColumn("");
    setQuerySortDirection("ASC");
    setQueryLimit("100");
    setHasRunQuery(false);
  };

  const restoreQueryBuilder = (state: {
    querySelectedColumns: string[];
    queryGroupBy: string[];
    queryAggregations: AggregationState[];
    querySortColumn: string;
    querySortDirection: SortDirection;
    queryLimit: string;
    hasRunQuery: boolean;
  }) => {
    setQuerySelectedColumns(state.querySelectedColumns);
    setQueryGroupBy(state.queryGroupBy);
    setQueryAggregations(state.queryAggregations);
    setQuerySortColumn(state.querySortColumn);
    setQuerySortDirection(state.querySortDirection);
    setQueryLimit(state.queryLimit);
    setHasRunQuery(state.hasRunQuery);
  };

  const addAggregation = () => {
    setQueryAggregations((currentAggregations) => [
      ...currentAggregations,
      { id: Date.now(), function: "SUM", column: "" },
    ]);
  };

  const updateAggregation = (id: number, value: Partial<AggregationState>) => {
    setQueryAggregations((currentAggregations) =>
      currentAggregations.map((aggregation) =>
        aggregation.id === id ? { ...aggregation, ...value } : aggregation,
      ),
    );
  };

  const removeAggregation = (id: number) => {
    setQueryAggregations((currentAggregations) =>
      currentAggregations.filter((aggregation) => aggregation.id !== id),
    );
  };

  const configureForHumanIntent = (
    intent: string,
    dataset: DatasetMetadata | null,
  ) => {
    if (!dataset) return;

    const categoryColumn =
      dataset.schema.find((column) => column.inferred_type === "categorical") ||
      dataset.schema.find((column) => column.inferred_type === "text");
    const dateColumn = dataset.schema.find((column) => column.inferred_type === "date");
    const numericColumn = dataset.schema.find((column) => column.inferred_type === "numeric");
    const columnsWithMissingValues = dataset.schema
      .filter((column) => column.null_count > 0)
      .map((column) => column.name);

    if (intent === "missing_values") {
      setQuerySelectedColumns(
        columnsWithMissingValues.length > 0
          ? columnsWithMissingValues.slice(0, 4)
          : dataset.schema.slice(0, 4).map((column) => column.name),
      );
      setQueryGroupBy([]);
      setQueryAggregations([]);
      setQuerySortColumn("");
      return;
    }

    if (intent === "top_categories" || intent === "simple_chart") {
      setQuerySelectedColumns(categoryColumn ? [categoryColumn.name] : []);
      setQueryGroupBy(categoryColumn ? [categoryColumn.name] : []);
      setQueryAggregations([{ id: Date.now(), function: "COUNT", column: "" }]);
      setQuerySortColumn("count_rows");
      setQuerySortDirection("DESC");
      return;
    }

    if (intent === "compare_columns") {
      setQuerySelectedColumns(dataset.schema.slice(0, 2).map((column) => column.name));
      setQueryGroupBy([]);
      setQueryAggregations([]);
      setQuerySortColumn("");
      return;
    }

    if (intent === "trends") {
      setQuerySelectedColumns(
        dateColumn ? [dateColumn.name] : dataset.schema.slice(0, 1).map((column) => column.name),
      );
      setQueryGroupBy(dateColumn ? [dateColumn.name] : []);
      setQueryAggregations([
        numericColumn
          ? { id: Date.now(), function: "AVG", column: numericColumn.name }
          : { id: Date.now(), function: "COUNT", column: "" },
      ]);
      setQuerySortColumn(dateColumn?.name || "");
      setQuerySortDirection("ASC");
    }
  };

  return {
    querySelectedColumns,
    setQuerySelectedColumns,
    queryGroupBy,
    setQueryGroupBy,
    queryAggregations,
    setQueryAggregations,
    querySortColumn,
    setQuerySortColumn,
    querySortDirection,
    setQuerySortDirection,
    queryLimit,
    setQueryLimit,
    hasRunQuery,
    setHasRunQuery,
    activeAggregations,
    querySortOptions,
    toggleListValue,
    resetQueryBuilder,
    restoreQueryBuilder,
    addAggregation,
    updateAggregation,
    removeAggregation,
    configureForHumanIntent,
  };
}

export default useQueryBuilderController;
