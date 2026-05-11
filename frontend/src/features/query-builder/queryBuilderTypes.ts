import type { FilterDefinition, SortDefinition } from "../filters/filterTypes";

export type AggregationState = {
  id: number;
  function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
  column: string;
};

export type AggregationDefinition = {
  function: AggregationState["function"];
  column: string | null;
};

export type QueryBuilderRequest = {
  selected_columns: string[];
  group_by: string[];
  aggregations: AggregationDefinition[];
  filters: FilterDefinition[];
  order_by?: SortDefinition | null;
  limit: number;
  page: number;
};

export type QueryBuilderResponse = {
  columns: string[];
  rows: Record<string, unknown>[];
  total_count: number;
  page: number;
  limit: number;
};
