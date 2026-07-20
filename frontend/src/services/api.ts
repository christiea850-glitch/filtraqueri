import type { UploadResponse } from "../features/dataset/datasetTypes";
import type {
  WorksheetMissingValuePlan,
  WorksheetRelationshipCandidate,
  WorksheetStructuralDecisionPlan,
  WorkbookTransformationPlan,
} from "../features/workbook";
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
  excluded_details?: {
    layout_rows?: {
      count: number;
      row_indexes: number[];
      reasons: {
        row_index: number;
        reason: string;
      }[];
    };
  };
  structural_decision_summary?: {
    accepted: Record<string, unknown>[];
    preserved: Record<string, unknown>[];
    deferred: Record<string, unknown>[];
  };
  missing_value_summary?: {
    worksheet_strategy: string | null;
    decisions_applied: Record<string, unknown>[];
    columns_changed: string[];
    columns_changed_count?: number;
    cells_filled?: number;
    rows_removed: number;
    operations?: Record<string, unknown>[];
    has_changes?: boolean;
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
  structural_decision_summary?: {
    accepted: Record<string, unknown>[];
    preserved: Record<string, unknown>[];
    deferred: Record<string, unknown>[];
  };
  missing_value_summary?: {
    worksheet_strategy: string | null;
    decisions_applied: Record<string, unknown>[];
    columns_changed: string[];
    rows_removed: number;
  };
  preview_rows: Record<string, unknown>[];
  preview_row_limit: number;
  message: string;
};

export type ApplyCleaningRecipeOptions = {
  rowLimitPreview?: number;
  confirmPreviewVersion?: string | null;
  structuralDecisionPlan?: WorksheetStructuralDecisionPlan | null;
  missingValuePlan?: WorksheetMissingValuePlan | null;
  transformationPlan?: WorkbookTransformationPlan | null;
};

export type CleaningRecipePreviewOptions = {
  rowLimit?: number;
  rowLimitPreview?: number;
  structuralDecisionPlan?: WorksheetStructuralDecisionPlan | null;
  missingValuePlan?: WorksheetMissingValuePlan | null;
  transformationPlan?: WorkbookTransformationPlan | null;
};

export type MissingValueDecisionApplyRequest = {
  worksheet_strategy: string;
  column_decisions: {
    column_name: string;
    strategy: string;
    custom_value?: string;
  }[];
};

export type MissingValueDecisionApplyResponse = {
  status: "applied_to_cleaned_working_copy";
  worksheet_name: string;
  cleaned_table_name: string;
  decisions_applied: {
    column_name?: string;
    strategy: string;
    rows_changed?: number;
    scope?: string;
    explanation: string;
  }[];
  columns_changed: string[];
  rows_removed: number;
  skipped_decisions: {
    column_name: string;
    strategy: string;
    explanation: string;
  }[];
  row_count: number;
  preview_rows: Record<string, unknown>[];
  message: string;
};

export function formatApiErrorPayload(payload: unknown, fallbackMessage: string): string {
  if (typeof payload === "string") return payload || fallbackMessage;
  if (payload instanceof Error) return payload.message || fallbackMessage;
  if (!payload || typeof payload !== "object") return fallbackMessage;

  const record = payload as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail || fallbackMessage;
  if (Array.isArray(record.detail)) {
    const messages = record.detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return "";
        const issue = item as Record<string, unknown>;
        const location = Array.isArray(issue.loc)
          ? issue.loc.map((part) => String(part)).join(".")
          : "";
        const message = typeof issue.msg === "string" ? issue.msg : "";
        return [location, message].filter(Boolean).join(": ");
      })
      .filter(Boolean);
    return messages.length ? messages.join("; ") : fallbackMessage;
  }
  if (record.detail && typeof record.detail === "object") {
    return formatApiErrorPayload(record.detail, fallbackMessage);
  }
  if (typeof record.message === "string") return record.message || fallbackMessage;
  if (Array.isArray(record.errors)) {
    return formatApiErrorPayload({ detail: record.errors }, fallbackMessage);
  }

  try {
    const serialized = JSON.stringify(record);
    return serialized && serialized !== "{}" ? serialized : fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function parseError(response: Response, fallbackMessage: string) {
  try {
    const payload = await response.json();
    return formatApiErrorPayload(payload, fallbackMessage);
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

const serializeStructuralDecisionPlan = (plan: WorksheetStructuralDecisionPlan) => ({
  worksheet_id: plan.worksheetId,
  decisions: plan.decisions.map((decision) => ({
    recommendation_id: decision.recommendationId,
    evidence_type: decision.evidenceType,
    decision: decision.decision,
    ...(decision.evidenceSignalId ? { evidence_signal_id: decision.evidenceSignalId } : {}),
    ...(decision.evidenceIds ? { evidence_ids: decision.evidenceIds } : {}),
    ...(decision.affectedColumns ? { affected_columns: decision.affectedColumns } : {}),
  })),
});

const serializeMissingValuePlan = (plan: WorksheetMissingValuePlan) => ({
  worksheet_id: plan.worksheetId,
  worksheet_strategy: plan.worksheetStrategy,
  column_decisions: plan.columnDecisions.map((decision) => ({
    column_name: decision.columnName,
    strategy: decision.strategy,
    ...(decision.customValue !== undefined ? { custom_value: decision.customValue } : {}),
  })),
});

const serializeTransformationParameters = (
  parameters: WorkbookTransformationPlan["steps"][number]["parameters"],
) => {
  if (!parameters) return undefined;
  if (parameters.kind === "cap_outliers_percentile") {
    return {
      lower_percentile: parameters.lowerPercentile,
      upper_percentile: parameters.upperPercentile,
    };
  }
  if (parameters.kind === "ordinal_encode") {
    return { order: parameters.order };
  }
  if (parameters.kind === "days_since") {
    return { anchor_date: parameters.anchorDate };
  }
  return undefined;
};

const serializeTransformationPlan = (plan: WorkbookTransformationPlan) => ({
  worksheet_id: plan.worksheetId,
  pipeline_id: plan.pipelineId,
  steps: plan.steps.map((step) => {
    const parameters = serializeTransformationParameters(step.parameters);
    return {
      step_id: step.stepId,
      order: step.order,
      kind: step.kind,
      target_column: step.targetColumn,
      ...(step.outputColumn !== undefined ? { output_column: step.outputColumn } : {}),
      ...(parameters !== undefined ? { parameters } : {}),
    };
  }),
});

export async function getCleaningRecipePreview(
  datasetId: string,
  worksheetId: string,
  rowLimit?: number,
): Promise<CleaningRecipePreview>;
export async function getCleaningRecipePreview(
  datasetId: string,
  worksheetId: string,
  options: CleaningRecipePreviewOptions,
): Promise<CleaningRecipePreview>;
export async function getCleaningRecipePreview(
  datasetId: string,
  worksheetId: string,
  optionsOrRowLimit: CleaningRecipePreviewOptions | number = 10,
) {
  const options =
    typeof optionsOrRowLimit === "number" ? { rowLimit: optionsOrRowLimit } : optionsOrRowLimit;
  const rowLimit = options.rowLimitPreview ?? options.rowLimit ?? 10;
  const params = new URLSearchParams({ row_limit: String(rowLimit) });
  const url = `${API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/cleaning-recipe-preview`;

  if (options.structuralDecisionPlan || options.missingValuePlan || options.transformationPlan) {
    const body: {
      row_limit_preview: number;
      structural_decision_plan?: ReturnType<typeof serializeStructuralDecisionPlan>;
      missing_value_plan?: ReturnType<typeof serializeMissingValuePlan>;
      transformation_plan?: ReturnType<typeof serializeTransformationPlan>;
    } = {
      row_limit_preview: rowLimit,
    };
    if (options.structuralDecisionPlan) {
      body.structural_decision_plan = serializeStructuralDecisionPlan(options.structuralDecisionPlan);
    }
    if (options.missingValuePlan) {
      body.missing_value_plan = serializeMissingValuePlan(options.missingValuePlan);
    }
    if (options.transformationPlan) {
      body.transformation_plan = serializeTransformationPlan(options.transformationPlan);
    }
    return requestJson<CleaningRecipePreview>(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "Cleaning recipe preview could not be loaded.",
    );
  }

  return requestJson<CleaningRecipePreview>(
    `${url}?${params.toString()}`,
    {
      method: "GET",
    },
    "Cleaning recipe preview could not be loaded.",
  );
}

export async function applyCleaningRecipe(
  datasetId: string,
  worksheetId: string,
): Promise<CleaningRecipeApplyResponse>;
export async function applyCleaningRecipe(
  datasetId: string,
  worksheetId: string,
  rowLimitPreview: number,
): Promise<CleaningRecipeApplyResponse>;
export async function applyCleaningRecipe(
  datasetId: string,
  worksheetId: string,
  options: ApplyCleaningRecipeOptions,
): Promise<CleaningRecipeApplyResponse>;
export async function applyCleaningRecipe(
  datasetId: string,
  worksheetId: string,
  optionsOrRowLimit: ApplyCleaningRecipeOptions | number = {},
): Promise<CleaningRecipeApplyResponse> {
  const options =
    typeof optionsOrRowLimit === "number" ? { rowLimitPreview: optionsOrRowLimit } : optionsOrRowLimit;
  const body: {
    row_limit_preview: number;
    confirm_preview_version?: string | null;
    structural_decision_plan?: {
      worksheet_id: string;
      decisions: Record<string, unknown>[];
    };
    missing_value_plan?: {
      worksheet_id: string;
      worksheet_strategy: string;
      column_decisions: Record<string, unknown>[];
    };
    transformation_plan?: ReturnType<typeof serializeTransformationPlan>;
  } = {
    row_limit_preview: options.rowLimitPreview ?? 25,
  };

  if (options.confirmPreviewVersion !== undefined) {
    body.confirm_preview_version = options.confirmPreviewVersion;
  }

  if (options.structuralDecisionPlan) {
    body.structural_decision_plan = serializeStructuralDecisionPlan(options.structuralDecisionPlan);
  }

  if (options.missingValuePlan) {
    body.missing_value_plan = serializeMissingValuePlan(options.missingValuePlan);
  }

  if (options.transformationPlan) {
    body.transformation_plan = serializeTransformationPlan(options.transformationPlan);
  }

  return requestJson<CleaningRecipeApplyResponse>(
    `${API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/apply-cleaning-recipe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "Cleaned working copy could not be created.",
  );
}

export async function applyMissingValueDecisions(
  datasetId: string,
  worksheetId: string,
  request: MissingValueDecisionApplyRequest,
) {
  return requestJson<MissingValueDecisionApplyResponse>(
    `${API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/apply-missing-value-decisions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    "Missing-value decisions could not be applied.",
  );
}

export async function activateCleanedWorkingCopy(datasetId: string, worksheetId: string) {
  return requestJson<Pick<UploadResponse, "dataset" | "preview" | "workbook_metadata">>(
    `${API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/activate-cleaned-copy`,
    {
      method: "POST",
    },
    "Cleaned working copy could not be activated.",
  );
}

export async function activateOriginalAnalysisTable(datasetId: string, worksheetId: string) {
  return requestJson<Pick<UploadResponse, "dataset" | "preview" | "workbook_metadata">>(
    `${API_BASE_URL}/datasets/${encodeURIComponent(datasetId)}/workbook/worksheets/${encodeURIComponent(worksheetId)}/activate-original-copy`,
    {
      method: "POST",
    },
    "Original analysis table could not be activated.",
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
