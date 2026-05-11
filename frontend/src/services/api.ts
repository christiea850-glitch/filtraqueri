const API_BASE_URL = "http://127.0.0.1:8000";

export type SortDirection = "ASC" | "DESC";

export type SchemaColumn = {
  name: string;
  type: string;
  inferred_type: "text" | "numeric" | "date" | "boolean" | "categorical";
  null_count: number;
  unique_count: number;
  sample_values: unknown[];
  min?: number | string;
  max?: number | string;
};

export type DatasetMetadata = {
  dataset_id: string;
  filename: string;
  original_filename: string;
  table_name: string;
  uploaded_at: string;
  row_count: number;
  column_count: number;
  schema: SchemaColumn[];
};

export type UploadResponse = {
  dataset: DatasetMetadata;
  preview: Record<string, unknown>[];
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

export type AggregationDefinition = {
  function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
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

export type PreviewOptions = {
  limit?: number;
  page?: number;
  sort_by?: string;
  sort_direction?: SortDirection;
};

export type ExportRequest = {
  source: "filter" | "preview" | "query_builder";
  filters?: FilterDefinition[];
  order_by?: SortDefinition | null;
  limit: number;
  query_builder?: QueryBuilderRequest;
};

async function parseError(response: Response, fallbackMessage: string) {
  try {
    const payload = await response.json();
    return payload.detail || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function requestJson<T>(url: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(await parseError(response, fallbackMessage));
  }

  return response.json() as Promise<T>;
}

export async function uploadDataset(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return requestJson<UploadResponse>(
    `${API_BASE_URL}/datasets/upload`,
    {
      method: "POST",
      body: formData,
    },
    "Upload failed. Please try another CSV file.",
  );
}

export async function getPreview(datasetId: string, options: PreviewOptions = {}) {
  const params = new URLSearchParams();

  if (options.limit) params.set("limit", String(options.limit));
  if (options.page) params.set("page", String(options.page));
  if (options.sort_by) params.set("sort_by", options.sort_by);
  if (options.sort_direction) params.set("sort_direction", options.sort_direction);

  const queryString = params.toString();

  return requestJson<FilterResponse>(
    `${API_BASE_URL}/datasets/${datasetId}/preview${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
    },
    "Preview could not be loaded.",
  );
}

export async function filterDataset(datasetId: string, request: FilterRequest) {
  return requestJson<FilterResponse>(
    `${API_BASE_URL}/datasets/${datasetId}/filter`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "Filters could not be applied.",
  );
}

export async function runQueryBuilder(datasetId: string, request: QueryBuilderRequest) {
  return requestJson<QueryBuilderResponse>(
    `${API_BASE_URL}/datasets/${datasetId}/query-builder`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "The visual query could not be run.",
  );
}

export async function exportDataset(datasetId: string, request: ExportRequest) {
  const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Export could not be created."));
  }

  return response.blob();
}
