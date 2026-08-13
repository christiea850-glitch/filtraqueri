import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import { executeWorkspaceQuery } from "../../../execution/executeWorkspaceQuery";
import type {
  WorkspaceExecutionRequest,
  WorkspaceExecutionResult,
} from "../../../execution/workspaceExecutionTypes";
import useSqlWorkspace from "../useSqlWorkspace";

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
  sample_values: ["A", "B"],
});

const createDataset = (
  id = "dataset-run-guard",
  worksheetId: "worksheet-a" | "worksheet-b" = "worksheet-a",
): DatasetMetadata => {
  const schema = [textColumn("status")];
  const activeTableName = worksheetId === "worksheet-a" ? "ws_1_orders" : "ws_2_returns";
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
  const worksheetA = {
    worksheetId: "worksheet-a",
    workbookId: `workbook-${id}`,
    sheetName: "Orders",
    displayName: "Orders",
    tableName: "ws_1_orders",
    originalIndex: 0,
    status: "ready" as const,
    schema,
    rowCount: 2,
    columnCount: 1,
    visibleColumns: ["status"],
    hiddenColumns: [],
    normalization: worksheetNormalization,
  };
  const worksheetB = {
    ...worksheetA,
    worksheetId: "worksheet-b",
    sheetName: "Returns",
    displayName: "Returns",
    tableName: "ws_2_returns",
    originalIndex: 1,
  };

  return {
    dataset_id: id,
    filename: `${id}.xlsx`,
    original_filename: `${id}.xlsx`,
    table_name: activeTableName,
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
      worksheetIds: ["worksheet-a", "worksheet-b"],
      activeWorksheetId: worksheetId,
      activeAnalysisSource: {
        type: "original",
        worksheetId,
        tableName: activeTableName,
        originalTableName: activeTableName,
        activatedAt: "2026-08-13T12:00:00.000Z",
      },
      cleanedWorkingCopies: [],
      worksheets: [worksheetA, worksheetB],
      tableMappings: [
        { sheetName: "Orders", tableName: "ws_1_orders", originalIndex: 0 },
        { sheetName: "Returns", tableName: "ws_2_returns", originalIndex: 1 },
      ],
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
  value: string,
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
    message: `Query returned 1 row for ${value}.`,
  },
  sorting: null,
  grouping: [],
  pagination: {
    page: 1,
    rowsPerPage: 100,
    totalCount: 1,
  },
  status: "success",
  error: null,
  executedAt: "2026-08-13T12:00:00.000Z",
  outputRows: [{ status: value }],
  outputVisibleColumns: ["status"],
  activeResult: {
    columns: ["status"],
    rows: [{ status: value }],
    totalCount: 1,
    page: 1,
    rowsPerPage: 100,
    sortColumn: "",
    sortDirection: "ASC",
  },
});

const getExecutionMock = () => vi.mocked(executeWorkspaceQuery);

function SqlWorkspaceHookHarness({
  dataset,
  onExecutionResult,
}: {
  dataset: DatasetMetadata | null;
  onExecutionResult?: (result: WorkspaceExecutionResult) => void;
}) {
  const workspace = useSqlWorkspace(dataset, onExecutionResult);

  return (
    <section aria-label="SQL hook harness">
      <div data-testid="active-tab-id">{workspace.sqlTabs.activeTabId}</div>
      <div data-testid="open-tab-count">{workspace.sqlTabs.tabs.length}</div>
      <button type="button" onClick={workspace.sqlTabs.onNewTab}>
        New tab
      </button>
      {workspace.sqlTabs.tabs.map((tab, index) => (
        <div key={tab.id}>
          <button
            type="button"
            data-testid={`switch-tab-${index}`}
            onClick={() => workspace.sqlTabs.onSwitchTab(tab.id)}
          >
            Switch tab {index + 1}
          </button>
          {tab.canClose ? (
            <button
              type="button"
              data-testid={`close-tab-${index}`}
              onClick={() => workspace.sqlTabs.onCloseTab(tab.id)}
            >
              Close tab {index + 1}
            </button>
          ) : null}
        </div>
      ))}
      <textarea
        aria-label="SQL query text"
        value={workspace.editor.value}
        onChange={(event) => workspace.editor.onChange(event.currentTarget.value)}
      />
      <button type="button" onClick={workspace.editor.onRun}>
        Run query
      </button>
      <div data-testid="editor-status">{workspace.editorStatus}</div>
      <div data-testid="preview-message">{workspace.previewResult.message}</div>
      <div data-testid="preview-rows">{JSON.stringify(workspace.previewResult.rows)}</div>
      <div data-testid="execution-identity">
        {JSON.stringify(workspace.previewResult.executionIdentity ?? null)}
      </div>
    </section>
  );
}

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

const setSql = (sql: string) => {
  fireEvent.change(screen.getByLabelText("SQL query text"), {
    target: { value: sql },
  });
};

const runQuery = () => {
  fireEvent.click(screen.getByRole("button", { name: "Run query" }));
};

const createNewTab = () => {
  fireEvent.click(screen.getByRole("button", { name: "New tab" }));
};

const switchToTab = (index: number) => {
  fireEvent.click(screen.getByTestId(`switch-tab-${index}`));
};

const closeTab = (index: number) => {
  fireEvent.click(screen.getByTestId(`close-tab-${index}`));
};

const resolveRun = async (
  deferred: Deferred<WorkspaceExecutionResult>,
  request: WorkspaceExecutionRequest,
  value: string,
) => {
  await act(async () => {
    deferred.resolve(createExecutionResult(request, value));
    await Promise.resolve();
  });
};

const rejectRun = async (deferred: Deferred<WorkspaceExecutionResult>, message: string) => {
  await act(async () => {
    deferred.reject(new Error(message));
    await Promise.resolve();
  });
};

const getIdentity = () => JSON.parse(screen.getByTestId("execution-identity").textContent || "null");

describe("runDraft latest-run guard", () => {
  beforeEach(() => {
    getExecutionMock().mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the newer success when an older success resolves later", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    const onExecutionResult = vi.fn();
    render(<SqlWorkspaceHookHarness dataset={createDataset()} onExecutionResult={onExecutionResult} />);

    setSql("SELECT 'A' AS status;");
    runQuery();
    setSql("SELECT 'B' AS status;");
    runQuery();

    await waitFor(() => expect(deferreds).toHaveLength(2));
    await resolveRun(deferreds[1], requests[1], "B");

    await waitFor(() => expect(screen.getByTestId("editor-status")).toHaveTextContent("success"));
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("B");
    expect(onExecutionResult).toHaveBeenCalledTimes(1);
    expect(onExecutionResult).toHaveBeenLastCalledWith(expect.objectContaining({
      outputRows: [{ status: "B" }],
    }));

    await resolveRun(deferreds[0], requests[0], "A");

    expect(screen.getByTestId("preview-rows")).toHaveTextContent("B");
    expect(onExecutionResult).toHaveBeenCalledTimes(1);
  });

  it("ignores an older failure after a newer success", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    render(<SqlWorkspaceHookHarness dataset={createDataset()} />);

    setSql("SELECT 'A' AS status;");
    runQuery();
    setSql("SELECT 'B' AS status;");
    runQuery();

    await waitFor(() => expect(deferreds).toHaveLength(2));
    await resolveRun(deferreds[1], requests[1], "B");
    await rejectRun(deferreds[0], "Older failure");

    expect(screen.getByTestId("editor-status")).toHaveTextContent("success");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("B");
  });

  it("ignores an older success after a newer failure", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    const onExecutionResult = vi.fn();
    render(<SqlWorkspaceHookHarness dataset={createDataset()} onExecutionResult={onExecutionResult} />);

    setSql("SELECT 'A' AS status;");
    runQuery();
    setSql("SELECT missing_column FROM ws_1_orders;");
    runQuery();

    await waitFor(() => expect(deferreds).toHaveLength(2));
    await rejectRun(deferreds[1], "Binder Error: Referenced column missing_column not found");
    await waitFor(() => expect(screen.getByTestId("editor-status")).toHaveTextContent("error"));
    await resolveRun(deferreds[0], requests[0], "A");

    expect(screen.getByTestId("editor-status")).toHaveTextContent("error");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("[]");
    expect(onExecutionResult).not.toHaveBeenCalled();
  });

  it("displays the latest failure normally", async () => {
    const { deferreds } = setupDeferredExecution();
    render(<SqlWorkspaceHookHarness dataset={createDataset()} />);

    setSql("SELECT missing_column FROM ws_1_orders;");
    runQuery();

    await waitFor(() => expect(deferreds).toHaveLength(1));
    await rejectRun(deferreds[0], "Binder Error: Referenced column missing_column not found");

    await waitFor(() => expect(screen.getByTestId("editor-status")).toHaveTextContent("error"));
    expect(getIdentity().exactSql).toBe("SELECT missing_column FROM ws_1_orders;");
  });

  it("keeps captured SQL when the editor changes during a run", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    render(<SqlWorkspaceHookHarness dataset={createDataset()} />);

    setSql("  SELECT 'captured' AS status;  ");
    runQuery();
    setSql("SELECT 'edited later' AS status;");

    await waitFor(() => expect(deferreds).toHaveLength(1));
    await resolveRun(deferreds[0], requests[0], "captured");

    expect((screen.getByLabelText("SQL query text") as HTMLTextAreaElement).value).toBe(
      "SELECT 'edited later' AS status;",
    );
    expect(getIdentity().exactSql).toBe("SELECT 'captured' AS status;");
    expect(getExecutionMock()).toHaveBeenCalledTimes(1);
  });

  it("does not admit a response from a prior dataset lifecycle", async () => {
    const { deferreds, requests } = setupDeferredExecution();

    const SwitchingHarness = () => {
      const [dataset, setDataset] = useState(createDataset("dataset-a", "worksheet-a"));
      return (
        <>
          <button type="button" onClick={() => setDataset(createDataset("dataset-b", "worksheet-b"))}>
            Switch context
          </button>
          <SqlWorkspaceHookHarness dataset={dataset} />
        </>
      );
    };

    render(<SwitchingHarness />);

    setSql("SELECT 'A' AS status;");
    runQuery();
    fireEvent.click(screen.getByRole("button", { name: "Switch context" }));

    await waitFor(() => expect(deferreds).toHaveLength(1));
    await resolveRun(deferreds[0], requests[0], "A");

    expect(screen.getByTestId("preview-rows")).not.toHaveTextContent("A");
    expect(getIdentity()).toBeNull();
  });

  it("keeps captured dataset and worksheet identity when active worksheet changes in the same lifecycle", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    const runClickDataset = createDataset("dataset-same-lifecycle", "worksheet-a");
    const worksheetBContextDataset = createDataset("dataset-same-lifecycle", "worksheet-b");
    const immutableInputs = JSON.stringify({
      runDatasetId: runClickDataset.dataset_id,
      runWorkbookId: runClickDataset.workbook_metadata?.workbookId,
      runWorksheetId: runClickDataset.workbook_metadata?.activeWorksheetId,
      laterDatasetId: worksheetBContextDataset.dataset_id,
      laterWorkbookId: worksheetBContextDataset.workbook_metadata?.workbookId,
      laterWorksheetId: worksheetBContextDataset.workbook_metadata?.activeWorksheetId,
    });

    const SameLifecycleSwitchingHarness = () => {
      const [dataset, setDataset] = useState(runClickDataset);
      return (
        <>
          <button type="button" onClick={() => setDataset(worksheetBContextDataset)}>
            Switch worksheet context
          </button>
          <SqlWorkspaceHookHarness dataset={dataset} />
        </>
      );
    };

    render(<SameLifecycleSwitchingHarness />);

    setSql("  SELECT 'worksheet-a' AS status;  ");
    runQuery();
    fireEvent.click(screen.getByRole("button", { name: "Switch worksheet context" }));
    createNewTab();

    await waitFor(() => expect(deferreds).toHaveLength(1));
    await resolveRun(deferreds[0], requests[0], "worksheet-a");

    expect(getExecutionMock()).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("[]");
    expect(getIdentity()).toBeNull();

    switchToTab(0);
    const identity = getIdentity();
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("worksheet-a");
    expect(identity.exactSql).toBe("SELECT 'worksheet-a' AS status;");
    expect(identity.datasetId).toBe("dataset-same-lifecycle");
    expect(identity.worksheetId).toBe("worksheet-a");
    expect(identity.worksheetId).not.toBe("worksheet-b");
    expect(
      JSON.stringify({
        runDatasetId: runClickDataset.dataset_id,
        runWorkbookId: runClickDataset.workbook_metadata?.workbookId,
        runWorksheetId: runClickDataset.workbook_metadata?.activeWorksheetId,
        laterDatasetId: worksheetBContextDataset.dataset_id,
        laterWorkbookId: worksheetBContextDataset.workbook_metadata?.workbookId,
        laterWorksheetId: worksheetBContextDataset.workbook_metadata?.activeWorksheetId,
      }),
    ).toBe(immutableInputs);
  });

  it("makes an earlier context response ineligible after a newer run starts", async () => {
    const { deferreds, requests } = setupDeferredExecution();

    const SwitchingHarness = () => {
      const [dataset, setDataset] = useState(createDataset("dataset-a", "worksheet-a"));
      return (
        <>
          <button type="button" onClick={() => setDataset(createDataset("dataset-b", "worksheet-b"))}>
            Switch context
          </button>
          <SqlWorkspaceHookHarness dataset={dataset} />
        </>
      );
    };

    render(<SwitchingHarness />);

    setSql("SELECT 'A' AS status;");
    runQuery();
    fireEvent.click(screen.getByRole("button", { name: "Switch context" }));
    setSql("SELECT 'B' AS status;");
    runQuery();

    await waitFor(() => expect(deferreds).toHaveLength(2));
    await resolveRun(deferreds[1], requests[1], "B");
    await resolveRun(deferreds[0], requests[0], "A");

    expect(screen.getByTestId("preview-rows")).toHaveTextContent("B");
    expect(getIdentity().datasetId).toBe("dataset-b");
    expect(getIdentity().worksheetId).toBe("worksheet-b");
  });

  it("mints distinct request identities for rapid intentional runs", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    render(<SqlWorkspaceHookHarness dataset={createDataset()} />);

    setSql("SELECT 'A' AS status;");
    runQuery();
    const firstIdentity = getIdentity();
    setSql("SELECT 'B' AS status;");
    runQuery();
    const secondIdentity = getIdentity();

    expect(firstIdentity.requestId).not.toBe(secondIdentity.requestId);
    expect(firstIdentity.exactSql).toBe("SELECT 'A' AS status;");
    expect(secondIdentity.exactSql).toBe("SELECT 'B' AS status;");

    await waitFor(() => expect(deferreds).toHaveLength(2));
    await resolveRun(deferreds[1], requests[1], "B");
  });

  it("retains an inactive tab success after switching tabs without another run", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    const onExecutionResult = vi.fn();
    render(
      <SqlWorkspaceHookHarness
        dataset={createDataset("dataset-tab-switch")}
        onExecutionResult={onExecutionResult}
      />,
    );

    setSql("SELECT 'A' AS status;");
    runQuery();
    createNewTab();

    await waitFor(() => expect(deferreds).toHaveLength(1));
    await resolveRun(deferreds[0], requests[0], "A");

    expect(screen.getByTestId("editor-status")).toHaveTextContent("idle");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("[]");
    expect(onExecutionResult).not.toHaveBeenCalled();

    switchToTab(0);

    expect(screen.getByTestId("editor-status")).toHaveTextContent("success");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("A");
    expect(getIdentity().exactSql).toBe("SELECT 'A' AS status;");
  });

  it("keeps independent results for concurrent runs in two tabs", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    const onExecutionResult = vi.fn();
    render(
      <SqlWorkspaceHookHarness
        dataset={createDataset("dataset-independent-tabs")}
        onExecutionResult={onExecutionResult}
      />,
    );

    setSql("SELECT 'A' AS status;");
    runQuery();
    createNewTab();
    setSql("SELECT 'B' AS status;");
    runQuery();

    await waitFor(() => expect(deferreds).toHaveLength(2));
    await resolveRun(deferreds[1], requests[1], "B");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("B");
    expect(getIdentity().exactSql).toBe("SELECT 'B' AS status;");

    await resolveRun(deferreds[0], requests[0], "A");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("B");

    switchToTab(0);
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("A");
    expect(getIdentity().exactSql).toBe("SELECT 'A' AS status;");

    switchToTab(1);
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("B");
    expect(getIdentity().exactSql).toBe("SELECT 'B' AS status;");
    expect(onExecutionResult).toHaveBeenCalledTimes(1);
    expect(onExecutionResult).toHaveBeenLastCalledWith(expect.objectContaining({
      outputRows: [{ status: "B" }],
    }));
  });

  it("supersedes only same-tab runs while another tab is running", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    const onExecutionResult = vi.fn();
    render(
      <SqlWorkspaceHookHarness
        dataset={createDataset("dataset-same-tab-supersession")}
        onExecutionResult={onExecutionResult}
      />,
    );

    setSql("SELECT 'A1' AS status;");
    runQuery();
    createNewTab();
    setSql("SELECT 'B' AS status;");
    runQuery();
    switchToTab(0);
    setSql("SELECT 'A2' AS status;");
    runQuery();

    await waitFor(() => expect(deferreds).toHaveLength(3));
    await resolveRun(deferreds[0], requests[0], "A1");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("[]");
    expect(screen.getByTestId("editor-status")).toHaveTextContent("running");

    await resolveRun(deferreds[1], requests[1], "B");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("[]");

    await resolveRun(deferreds[2], requests[2], "A2");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("A2");
    expect(getIdentity().exactSql).toBe("SELECT 'A2' AS status;");

    switchToTab(1);
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("B");
    expect(getIdentity().exactSql).toBe("SELECT 'B' AS status;");
    expect(onExecutionResult).toHaveBeenCalledTimes(1);
    expect(onExecutionResult).toHaveBeenLastCalledWith(expect.objectContaining({
      outputRows: [{ status: "A2" }],
    }));
  });

  it("stores an inactive tab failure without changing the active tab", async () => {
    const { deferreds } = setupDeferredExecution();
    render(<SqlWorkspaceHookHarness dataset={createDataset("dataset-inactive-failure")} />);

    setSql("SELECT missing_column FROM ws_1_orders;");
    runQuery();
    createNewTab();

    await waitFor(() => expect(deferreds).toHaveLength(1));
    await rejectRun(deferreds[0], "Binder Error: Referenced column missing_column not found");

    expect(screen.getByTestId("editor-status")).toHaveTextContent("idle");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("[]");

    switchToTab(0);
    expect(screen.getByTestId("editor-status")).toHaveTextContent("error");
    expect(getIdentity().exactSql).toBe("SELECT missing_column FROM ws_1_orders;");
  });

  it("ignores a response after its originating tab closes", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    const onExecutionResult = vi.fn();
    render(
      <SqlWorkspaceHookHarness
        dataset={createDataset("dataset-close-running-tab")}
        onExecutionResult={onExecutionResult}
      />,
    );

    setSql("SELECT 'closed' AS status;");
    runQuery();
    createNewTab();
    closeTab(0);

    await waitFor(() => expect(screen.getByTestId("open-tab-count")).toHaveTextContent("1"));
    await resolveRun(deferreds[0], requests[0], "closed");

    expect(screen.getByTestId("open-tab-count")).toHaveTextContent("1");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("[]");
    expect(getIdentity()).toBeNull();
    expect(onExecutionResult).not.toHaveBeenCalled();

    createNewTab();
    expect(screen.getByTestId("open-tab-count")).toHaveTextContent("2");
    expect(screen.getByTestId("preview-rows")).toHaveTextContent("[]");
    expect(getIdentity()).toBeNull();
  });

  it("does not run automatically for editor or context changes", () => {
    const { rerender } = render(<SqlWorkspaceHookHarness dataset={createDataset("dataset-a")} />);

    setSql("SELECT 'manual only' AS status;");
    rerender(<SqlWorkspaceHookHarness dataset={createDataset("dataset-b", "worksheet-b")} />);

    expect(getExecutionMock()).not.toHaveBeenCalled();
  });

  it("does not apply a response after unmount", async () => {
    const { deferreds, requests } = setupDeferredExecution();
    const onExecutionResult = vi.fn();
    const rendered = render(
      <SqlWorkspaceHookHarness dataset={createDataset()} onExecutionResult={onExecutionResult} />,
    );

    setSql("SELECT 'A' AS status;");
    runQuery();
    await waitFor(() => expect(deferreds).toHaveLength(1));

    rendered.unmount();
    await resolveRun(deferreds[0], requests[0], "A");

    expect(onExecutionResult).not.toHaveBeenCalled();
  });
});
