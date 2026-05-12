export type SortDirection = "ASC" | "DESC";

export type ResultTabKey = "preview" | "filtered" | "queried";

export type ResultSourceFilterSnapshot = {
  column: string;
  type: string;
  min?: string | number | null;
  max?: string | number | null;
  values?: string[];
  value?: boolean | null;
  start?: string | null;
  end?: string | null;
};

export type ResultSourceAggregationSnapshot = {
  function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
  column: string | null;
};

export type ResultSourceSortSnapshot = {
  column: string;
  direction: SortDirection;
};

export type ResultSourceQueryBuilderSnapshot = {
  selected_columns: string[];
  group_by: string[];
  aggregations: ResultSourceAggregationSnapshot[];
  filters: ResultSourceFilterSnapshot[];
  order_by?: ResultSourceSortSnapshot | null;
  limit: number;
  page: number;
};

export type ResultSourceSnapshot = {
  filters?: ResultSourceFilterSnapshot[];
  queryBuilder?: ResultSourceQueryBuilderSnapshot;
  orderBy?: ResultSourceSortSnapshot | null;
};

export type ResultState = {
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  rowsPerPage: number;
  sortColumn: string;
  sortDirection: SortDirection;
  source?: ResultSourceSnapshot;
};

export type PreviewOptions = {
  limit?: number;
  page?: number;
  sort_by?: string;
  sort_direction?: SortDirection;
};
