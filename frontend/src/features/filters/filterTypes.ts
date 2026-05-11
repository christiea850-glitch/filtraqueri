import type { SortDirection } from "../results/resultTypes";

export type FilterState = {
  min?: string;
  max?: string;
  values?: string[];
  value?: string;
  start?: string;
  end?: string;
};

export type FilterDefinition = {
  column: string;
  type: string;
  min?: string | number | null;
  max?: string | number | null;
  values?: string[];
  value?: boolean | null;
  start?: string | null;
  end?: string | null;
};

export type SortDefinition = {
  column: string;
  direction: SortDirection;
};

export type FilterRequest = {
  filters: FilterDefinition[];
  limit: number;
  page: number;
  order_by?: SortDefinition | null;
};

export type FilterResponse = {
  columns: string[];
  rows: Record<string, unknown>[];
  filtered_count: number;
  total_count: number;
  page: number;
  limit: number;
};
