import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import { executeWorkspaceQuery } from "../../../execution/executeWorkspaceQuery";
import type {
  WorkspaceExecutionRequest,
  WorkspaceExecutionResult,
} from "../../../execution/workspaceExecutionTypes";
import SqlWorkspace from "../SqlWorkspace";
import type { SqlQuestionHandoff } from "../sqlTypes";

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      aria-label="SQL query text"
      value={value || ""}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  ),
}));

vi.mock("../../../execution/executeWorkspaceQuery", () => ({
  executeWorkspaceQuery: vi.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const textColumn = (name: string): SchemaColumn => ({
  name,
  type: "VARCHAR",
  inferred_type: "categorical",
  null_count: 0,
  unique_count: 2,
  sample_values: ["Open", "Closed"],
});

const createDataset = (id = "dataset-truthfulness"): DatasetMetadata => {
  const schema = [textColumn("status")];
  const worksheetNormalization = {
    version: 1,
    normalizedAt: "2026-08-13T12:00:00.000Z",
    headerRowIndex: 0,
    skippedLeadingRows: 0,
    headerDetectionStrategy: "first_non_empty_row" as const,
    headerDetectionConfidence: null,
    headerDetectionWarning: null,
    originalFirstRowPreview: ["status"],
    selectedHeaderRowPreview: ["status"],
    structuralColumnCandidates: [],
    structuralColumnDetectionWarning: null,
    structuralColumnDetectionConfidence: null,
    structuralColumnSampleSize: null,
    recommendedHiddenColumns: [],
    duplicateColumnCount: 0,
    emptyColumnCount: 0,
    warnings: [],
    templateStructureCandidate: false,
    templateStructureConfidence: "low" as const,
    templateStructureEvidence: [],
  };

  return {
    dataset_id: id,
    filename: `${id}.xlsx`,
    original_filename: `${id}.xlsx`,
    table_name: "ws_1_orders",
    uploaded_at: "2026-08-13T12:00:00.000Z",
    row_count: 2,
    column_count: 1,
    schema,
    workbook_metadata: {
      workbookId: `workbook-${id}`,
      workspaceId: `workspace-${id}`,
      name: `${id}.xlsx`,
      status: "ready",
      sourceFile: {
        originalFilename: `${id}.xlsx`,
        storedPath: null,
        mimeType: null,
        byteSize: null,
        uploadedAt: "2026-08-13T12:00:00.000Z",
      },
      worksheetIds: ["worksheet-a"],
      activeWorksheetId: "worksheet-a",
      activeAnalysisSource: {
        type: "original",
        worksheetId: "worksheet-a",
        tableName: "ws_1_orders",
        originalTableName: "ws_1_orders",
        activatedAt: "2026-08-13T12:00:00.000Z",
      },
      cleanedWorkingCopies: [],
      worksheets: [
        {
          worksheetId: "worksheet-a",
          workbookId: `workbook-${id}`,
          sheetName: "Orders",
          displayName: "Orders",
          tableName: "ws_1_orders",
          originalIndex: 0,
          status: "ready",
          schema,
          rowCount: 2,
          columnCount: 1,
          visibleColumns: ["status"],
          hiddenColumns: [],
          normalization: worksheetNormalization,
        },
      ],
      tableMappings: [{ sheetName: "Orders", tableName: "ws_1_orders", originalIndex: 0 }],
      relationshipCandidates: [],
      acceptedRelationshipContracts: [],
      ingestionProfile: {
        maxWorksheets: 30,
        maxRowsPerWorksheetProfile: 50000,
        maxColumnsPerWorksheet: 250,
        maxRelationshipSampleRows: 1000,
        maxPreviewRows: 25,
        profilingStrategy: "sampled",
      },
      normalization: {
        version: 1,
        normalizedAt: "2026-08-13T12:00:00.000Z",
        status: "normalized",
        warnings: [],
      },
      createdAt: "2026-08-13T12:00:00.000Z",
      updatedAt: "2026-08-13T12:00:00.000Z",
    },
  };
};

const createExecutionResult = (
  request: WorkspaceExecutionRequest,
  rows: Record<string, unknown>[] = [{ status: "Open" }],
): WorkspaceExecutionResult => ({
  source: "sql",
  dataset: {
    datasetId: request.dataset.dataset_id,
    datasetName: request.dataset.original_filename,
    tableName: request.dataset.table_name,
  },
  inputRows: [],
  filters: [],
  queryBuilder: null,
  sql: {
    sql: request.sql?.sql || "",
    message: `Query returned ${rows.length} ${rows.length === 1 ? "row" : "rows"}.`,
  },
  sorting: null,
  grouping: [],
  pagination: {
    page: 1,
    rowsPerPage: 100,
    totalCount: rows.length,
  },
  status: "success",
  error: null,
  executedAt: "2026-08-13T12:00:00.000Z",
  outputRows: rows,
  outputVisibleColumns: ["status"],
  activeResult: {
    columns: ["status"],
    rows,
    totalCount: rows.length,
    page: 1,
    rowsPerPage: 100,
    sortColumn: "",
    sortDirection: "ASC",
  },
});

const getExecutionMock = () => vi.mocked(executeWorkspaceQuery);

const setupDeferredExecution = () => {
  const deferreds: Array<Deferred<WorkspaceExecutionResult>> = [];
  const requests: WorkspaceExecutionRequest[] = [];

  getExecutionMock().mockImplementation((request) => {
    const deferred = createDeferred<WorkspaceExecutionResult>();
    deferreds.push(deferred);
    requests.push(request);
    return deferred.promise;
  });

  return { deferreds, requests };
};

const renderWorkspace = () => render(<SqlWorkspace dataset={createDataset()} />);

const setSql = (sql: string) => {
  fireEvent.change(screen.getByLabelText("SQL query text"), {
    target: { value: sql },
  });
};

const runQuery = () => {
  fireEvent.click(screen.getByRole("button", { name: "Run query" }));
};

const createNewTab = () => {
  fireEvent.click(screen.getByRole("button", { name: "+ New tab" }));
};

const switchToTab = (index: number) => {
  fireEvent.click(screen.getAllByRole("tab")[index]);
};

const getExecutionStatus = () => screen.getByLabelText("SQL execution status");

const resolveRun = async (
  deferred: Deferred<WorkspaceExecutionResult>,
  request: WorkspaceExecutionRequest,
  rows: Record<string, unknown>[] = [{ status: "Open" }],
) => {
  await act(async () => {
    deferred.resolve(createExecutionResult(request, rows));
    await Promise.resolve();
  });
};

const rejectRun = async (deferred: Deferred<WorkspaceExecutionResult>, message: string) => {
  await act(async () => {
    deferred.reject(new Error(message));
    await Promise.resolve();
  });
};

describe("SQL execution truthfulness UI", () => {
  beforeEach(() => {
    getExecutionMock().mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows not run before execution and running after explicit Run", async () => {
    const { deferreds } = setupDeferredExecution();
    renderWorkspace();

    expect(getExecutionStatus()).toHaveTextContent("Not run");
    expect(getExecutionStatus()).toHaveTextContent("Select Run Query to execute this SQL in DuckDB.");

    setSql("SELECT status FROM ws_1_orders;");
    expect(getExecutionMock()).not.toHaveBeenCalled();

    runQuery();
    await waitFor(() => expect(deferreds).toHaveLength(1));
    expect(getExecutionStatus()).toHaveTextContent("Running");
    expect(getExecutionStatus()).toHaveTextContent("Executing this SQL in DuckDB.");
  });

  it("shows current after success, stale after SQL edit, and current after boundary whitespace edit", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    renderWorkspace();

    setSql("SELECT status FROM ws_1_orders;");
    runQuery();
    await waitFor(() => expect(deferreds).toHaveLength(1));
    await resolveRun(deferreds[0], requests[0]);

    await waitFor(() => expect(getExecutionStatus()).toHaveTextContent("Current"));
    expect(getExecutionStatus()).toHaveTextContent("Results match the current SQL and data source.");

    setSql("SELECT status  FROM ws_1_orders;");
    expect(getExecutionStatus()).toHaveTextContent("Stale");
    expect(getExecutionStatus()).toHaveTextContent("Run again to refresh.");

    setSql("\n SELECT status FROM ws_1_orders;  ");
    expect(getExecutionStatus()).toHaveTextContent("Current");
    expect(getExecutionMock()).toHaveBeenCalledTimes(1);
  });

  it("states that a successful zero-row query ran and returned 0 rows", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    renderWorkspace();

    setSql("SELECT status FROM ws_1_orders WHERE status = 'Missing';");
    runQuery();
    await waitFor(() => expect(deferreds).toHaveLength(1));
    await resolveRun(deferreds[0], requests[0], []);

    await waitFor(() => expect(getExecutionStatus()).toHaveTextContent("Current"));
    fireEvent.click(screen.getByRole("button", { name: "Result Preview" }));

    expect(screen.getByText("Query ran successfully and returned 0 rows.")).toBeInTheDocument();
  });

  it("shows failed for the latest matching failure and stale after editing the failed SQL", async () => {
    const { deferreds } = setupDeferredExecution();
    renderWorkspace();

    setSql("SELECT missing_column FROM ws_1_orders;");
    runQuery();
    await waitFor(() => expect(deferreds).toHaveLength(1));
    await rejectRun(deferreds[0], "Binder Error: Referenced column missing_column not found");

    await waitFor(() => expect(getExecutionStatus()).toHaveTextContent("Failed"));
    expect(getExecutionStatus()).toHaveTextContent("The latest run failed.");

    setSql("SELECT another_missing_column FROM ws_1_orders;");
    expect(getExecutionStatus()).toHaveTextContent("Stale");
    expect(getExecutionMock()).toHaveBeenCalledTimes(1);
  });

  it("keeps independent visible state across tabs and background completion", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    renderWorkspace();

    setSql("SELECT 'A' AS status;");
    runQuery();
    createNewTab();

    expect(getExecutionStatus()).toHaveTextContent("Not run");

    await waitFor(() => expect(deferreds).toHaveLength(1));
    await resolveRun(deferreds[0], requests[0], [{ status: "A" }]);

    expect(getExecutionStatus()).toHaveTextContent("Not run");
    switchToTab(0);

    await waitFor(() => expect(getExecutionStatus()).toHaveTextContent("Current"));
    expect(screen.getByDisplayValue("SELECT 'A' AS status;")).toBeInTheDocument();

    switchToTab(1);
    expect(getExecutionStatus()).toHaveTextContent("Not run");
    expect(getExecutionMock()).toHaveBeenCalledTimes(1);
  });

  it("keeps handed-off questions visibly unexecuted until Run", async () => {
    setupDeferredExecution();
    const dataset = createDataset("dataset-handoff-not-run");
    const handoff: SqlQuestionHandoff = {
      id: "handoff-truthfulness",
      source: "home",
      question: "Count orders by status",
      datasetId: dataset.dataset_id,
      worksheetId: "worksheet-a",
      createdAt: "2026-08-13T12:00:00.000Z",
    };
    const onConsumed = vi.fn();

    render(
      <SqlWorkspace
        dataset={dataset}
        questionHandoff={handoff}
        onQuestionHandoffConsumed={onConsumed}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getAllByLabelText("Ask FiltraQueri").find(
          (element): element is HTMLInputElement => element instanceof HTMLInputElement,
        ),
      ).toHaveValue("Count orders by status"),
    );
    expect(getExecutionStatus()).toHaveTextContent("Not run");
    expect(getExecutionStatus()).toHaveTextContent("Select Run Query to execute this SQL in DuckDB.");
    expect(getExecutionMock()).not.toHaveBeenCalled();
    expect(onConsumed).toHaveBeenCalledWith("handoff-truthfulness");
  });
});
