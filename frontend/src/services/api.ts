import type { UploadResponse } from "../features/dataset/datasetTypes";
import type {
  FilterDefinition,
  FilterRequest,
  FilterResponse,
  SortDefinition,
} from "../features/filters/filterTypes";
import type {
  QueryBuilderRequest,
  QueryBuilderResponse,
} from "../features/query-builder/queryBuilderTypes";
import type { PreviewOptions } from "../features/results/resultTypes";

const API_BASE_URL = "http://127.0.0.1:8000";

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
