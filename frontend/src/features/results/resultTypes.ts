export type SortDirection = "ASC" | "DESC";

export type ResultTabKey = "preview" | "filtered" | "queried";

export type ResultState = {
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  rowsPerPage: number;
  sortColumn: string;
  sortDirection: SortDirection;
};

export type PreviewOptions = {
  limit?: number;
  page?: number;
  sort_by?: string;
  sort_direction?: SortDirection;
};
