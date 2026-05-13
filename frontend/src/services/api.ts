import type { UploadResponse } from "../features/dataset/datasetTypes";
import type { WorksheetRelationshipCandidate } from "../features/workbook";
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
import type {
  WorkspaceManifest,
  WorkspaceManifestUpdate,
} from "../features/workspace/workspaceManifestTypes";
import type { WorkspaceManifestSummary } from "../features/workspace/workspaceManagerTypes";

const API_BASE_URL = "http://127.0.0.1:8000";

export type ExportRequest = {
  source: "filter" | "preview" | "query_builder";
  filters?: FilterDefinition[];
  order_by?: SortDefinition | null;
  limit: number;
  query_builder?: QueryBuilderRequest;
};

export type RelationshipReviewRequest = {
  candidate_id: string;
  review_status: "pending" | "accepted" | "dismissed";
  notes?: string;
};

export type RelationshipContractDiagnostic = {
  diagnostic_id: string;
  contract_id: string;
  severity: "healthy" | "warning" | "broken";
  issue_type: string;
  issue_summary: string;
  suggested_action: string;
  affected_source: string;
  affected_target: string;
  checked_at: string;
};

export type RelationshipContractDiagnosticsResponse = {
  dataset_id: string;
  workbook_id: string;
  diagnostics: RelationshipContractDiagnostic[];
  summary: {
    healthy: number;
    warning: number;
    broken: number;
    stale: number;
    total_contracts: number;
  };
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
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error("Backend is not running. Start it with: python -m uvicorn app.main:app --reload");
  }

  if (!response.ok) {
    throw new Error(await parseError(response, fallbackMessage));
  }

  return response.json() as Promise<T>;
}

export async function uploadDataset(file: File) {
  const isCsvFile =
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel";
  const isExcelWorkbook =
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.name.toLowerCase().endsWith(".xls") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (!isCsvFile && !isExcelWorkbook) {
    throw new Error("Please upload a CSV or Excel workbook file.");
  }

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

export async function getDataset(datasetId: string) {
  return requestJson<{ dataset: UploadResponse["dataset"] }>(
    `${API_BASE_URL}/datasets/${datasetId}`,
    {
      method: "GET",
    },
    "Dataset could not be loaded.",
  );
}

export async function selectWorkbookWorksheet(datasetId: string, worksheetId: string) {
  return requestJson<Pick<UploadResponse, "dataset" | "preview" | "workbook_metadata">>(
    `${API_BASE_URL}/datasets/${datasetId}/workbook/active-worksheet`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ worksheet_id: worksheetId }),
    },
    "Worksheet could not be selected.",
  );
}

export async function reviewWorkbookRelationship(
  datasetId: string,
  request: RelationshipReviewRequest,
) {
  return requestJson<{
    dataset: UploadResponse["dataset"];
    candidate: WorksheetRelationshipCandidate;
    summary: {
      total: number;
      pending: number;
      accepted: number;
      dismissed: number;
    };
    workbook_metadata: unknown;
  }>(
    `${API_BASE_URL}/datasets/${datasetId}/workbook/relationship-review`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "Relationship review could not be saved.",
  );
}

export async function getWorkbookContractDiagnostics(datasetId: string) {
  return requestJson<RelationshipContractDiagnosticsResponse>(
    `${API_BASE_URL}/datasets/${datasetId}/workbook/contract-diagnostics`,
    {
      method: "GET",
    },
    "Relationship contract diagnostics could not be loaded.",
  );
}

export async function getWorkspaceManifest(workspaceId: string) {
  return requestJson<{ workspace: WorkspaceManifest }>(
    `${API_BASE_URL}/workspaces/${workspaceId}`,
    {
      method: "GET",
    },
    "Workspace could not be restored.",
  );
}

export async function listWorkspaceManifests() {
  return requestJson<{ workspaces: WorkspaceManifestSummary[] }>(
    `${API_BASE_URL}/workspaces`,
    {
      method: "GET",
    },
    "Saved workspaces could not be loaded.",
  );
}

export async function updateWorkspaceManifest(
  workspaceId: string,
  request: WorkspaceManifestUpdate,
) {
  return requestJson<{ workspace: WorkspaceManifest }>(
    `${API_BASE_URL}/workspaces/${workspaceId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "Workspace could not be saved.",
  );
}

export async function removeWorkspaceManifest(workspaceId: string) {
  return requestJson<{ removed: boolean; workspace_id: string }>(
    `${API_BASE_URL}/workspaces/${workspaceId}/manifest`,
    {
      method: "DELETE",
    },
    "Workspace manifest could not be removed.",
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
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error("Backend is not running. Start it with: python -m uvicorn app.main:app --reload");
  }

  if (!response.ok) {
    throw new Error(await parseError(response, "Export could not be created."));
  }

  return response.blob();
}
