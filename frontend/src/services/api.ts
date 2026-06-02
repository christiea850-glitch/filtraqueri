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

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

export type ExportRequest = {
  source: "filter" | "preview" | "query_builder";
  filters?: FilterDefinition[];
  order_by?: SortDefinition | null;
  limit: number;
  query_builder?: QueryBuilderRequest;
};

export type SqlQueryRequest = {
  sql: string;
  limit: number;
};

export type SqlQueryResponse = {
  dataset_id: string;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  limit: number;
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

export type OriginalWorkbookBorderSide = {
  style: string | null;
  color: string | null;
};

export type OriginalWorkbookCellStyle = {
  fill_color: string | null;
  font: {
    bold: boolean;
    italic: boolean;
    size: number | null;
    color: string | null;
  };
  border: {
    top: OriginalWorkbookBorderSide;
    right: OriginalWorkbookBorderSide;
    bottom: OriginalWorkbookBorderSide;
    left: OriginalWorkbookBorderSide;
  };
  alignment: {
    horizontal: string | null;
    vertical: string | null;
    wrap_text: boolean;
  };
};

export type OriginalWorkbookLayout = {
  worksheet_id: string;
  worksheet_name: string;
  row_start: number;
  row_end: number;
  column_start: number;
  column_end: number;
  total_rows: number;
  total_columns: number;
  is_empty: boolean;
  is_bounded: boolean;
  cells: {
    row: number;
    column: number;
    coordinate: string;
    display_value: string;
    is_formula: boolean;
    style: OriginalWorkbookCellStyle;
  }[];
  merged_ranges: {
    range: string;
    start_row: number;
    end_row: number;
    start_column: number;
    end_column: number;
  }[];
  rows: {
    index: number;
    height: number | null;
    hidden: boolean;
  }[];
  columns: {
    index: number;
    letter: string;
    width: number | null;
    hidden: boolean;
  }[];
};

export type CleaningRecipePreview = {
  status: "preview_only";
  worksheet_id: string;
  worksheet_name: string;
  before: {
    row_count: number;
    column_count: number;
  };
  after_preview: {
    row_count: number;
    column_count: number;
    columns: string[];
    rows: Record<string, unknown>[];
    row_provenance: {
      preview_row_index: number;
      original_row_index: number;
    }[];
  };
  recipe: {
    type: string;
    original_row_indexes?: number[];
    original_column_indexes?: number[];
    added_columns?: string[];
    explanation: string;
  }[];
  excluded: {
    repeated_headers: number;
    section_banners: number;
    date_title_rows: number;
    layout_rows: number;
    placeholder_rows: number;
    side_note_columns: number;
  };
  preview_row_limit: number;
  message: string;
};

export type CleaningRecipeApplyResponse = {
  status: "applied_to_working_copy" | "no_recipe_needed";
  dataset_id: string;
  worksheet_id: string;
  worksheet_name: string;
  cleaned_table_name: string | null;
  before: {
    row_count: number;
    column_count: number;
  };
  after: {
    row_count: number;
    column_count: number;
    columns: string[];
  };
  recipe_applied: {
    type: string;
    original_row_indexes?: number[];
    original_column_indexes?: number[];
    added_columns?: string[];
    explanation: string;
  }[];
  excluded: {
    repeated_headers: number;
    section_banners: number;
    date_title_rows: number;
    layout_rows: number;
    placeholder_rows: number;
    side_note_columns: number;
  };
  preview_rows: Record<string, unknown>[];
  preview_row_limit: number;
  message: string;
};

async function parseError(response: Response, fallbackMessage: string) {
  try {
    const payload = await response.json();
    return payload.detail || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function backendReachabilityMessage() {
  return `Could not reach FiltraQueri backend at ${API_BASE_URL}. Confirm the backend is running and reachable.`;
}

async function requestJson<T>(url: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(backendReachabilityMessage());
  }

  if (!response.ok) {
    throw new Error(await parseError(response, fallbackMessage));
  }

  return response.json() as Promise<T>;
}

export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
    });

    return response.ok;
  } catch {
    return false;
  }
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

type WorksheetPreviewOptions = PreviewOptions & {
  worksheet_id?: string;
};

export async function getPreview(datasetId: string, options: WorksheetPreviewOptions = {}) {
  const params = new URLSearchParams();

  if (options.limit) params.set("limit", String(options.limit));
  if (options.page) params.set("page", String(options.page));
  if (options.sort_by) params.set("sort_by", options.sort_by);
  if (options.sort_direction) params.set("sort_direction", options.sort_direction);
  if (options.worksheet_id) params.set("worksheet_id", options.worksheet_id);

  const queryString = params.toString();

  return requestJson<FilterResponse>(
    `${API_BASE_URL}/datasets/${datasetId}/preview${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
    },
    "Preview could not be loaded.",
  );
}

export async function getOriginalWorkbookLayout(datasetId: string, worksheetId: string) {
  try {
    return await requestJson<OriginalWorkbookLayout>(
      `${API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/original-layout?row_start=1&row_limit=200&column_start=1&column_limit=50`,
      {
        method: "GET",
      },
      "Original workbook layout could not be loaded.",
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Not Found") {
      throw new Error(
        "Original workbook view is not available from the running backend. Restart the backend and try again.",
        { cause: error },
      );
    }

    throw error;
  }
}

export async function getCleaningRecipePreview(
  datasetId: string,
  worksheetId: string,
  rowLimit = 10,
) {
  const params = new URLSearchParams({ row_limit: String(rowLimit) });

  return requestJson<CleaningRecipePreview>(
    `${API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/cleaning-recipe-preview?${params.toString()}`,
    {
      method: "GET",
    },
    "Cleaning recipe preview could not be loaded.",
  );
}

export async function applyCleaningRecipe(
  datasetId: string,
  worksheetId: string,
  rowLimitPreview = 25,
) {
  return requestJson<CleaningRecipeApplyResponse>(
    `${API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/apply-cleaning-recipe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row_limit_preview: rowLimitPreview }),
    },
    "Cleaned working copy could not be created.",
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

export async function deleteDataset(datasetId: string) {
  return requestJson<{
    deleted: boolean;
    dataset_id: string;
    removed_artifacts: string[];
  }>(
    `${API_BASE_URL}/datasets/${datasetId}`,
    {
      method: "DELETE",
    },
    "Dataset could not be deleted.",
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

export async function queryDataset(datasetId: string, request: SqlQueryRequest) {
  return requestJson<SqlQueryResponse>(
    `${API_BASE_URL}/datasets/${datasetId}/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    "The SQL query could not be run.",
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
    throw new Error(backendReachabilityMessage());
  }

  if (!response.ok) {
    throw new Error(await parseError(response, "Export could not be created."));
  }

  return response.blob();
}
