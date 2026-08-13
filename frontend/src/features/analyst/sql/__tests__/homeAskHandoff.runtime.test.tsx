import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../../App";
import UploadPanel from "../../../../components/upload/UploadPanel";
import type { DatasetMetadata, SchemaColumn, UploadResponse } from "../../../dataset/datasetTypes";
import { createSqlWorkspaceMetadataSnapshot } from "../../../sqlWorkspacePersistence";
import type { SqlQuestionHandoff } from "../sqlTypes";
import SqlWorkspace from "../SqlWorkspace";

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      aria-label="SQL query text"
      value={value || ""}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  ),
}));

const textColumn = (name: string): SchemaColumn => ({
  name,
  type: "VARCHAR",
  inferred_type: "categorical",
  null_count: 0,
  unique_count: 3,
  sample_values: ["Open", "Closed"],
});

const numberColumn = (name: string): SchemaColumn => ({
  name,
  type: "DOUBLE",
  inferred_type: "numeric",
  null_count: 0,
  unique_count: 5,
  sample_values: [10, 20],
  min: 10,
  max: 50,
});

const baseSchema = [textColumn("status"), numberColumn("amount")];

const createDataset = (id: string, worksheetId = "worksheet-orders"): DatasetMetadata => ({
  dataset_id: id,
  filename: `${id}.xlsx`,
  original_filename: `${id}.xlsx`,
  table_name: "ws_1_orders",
  uploaded_at: "2026-08-13T12:00:00.000Z",
  row_count: 4,
  column_count: baseSchema.length,
  schema: baseSchema,
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
    worksheetIds: [worksheetId],
    activeWorksheetId: worksheetId,
    activeAnalysisSource: {
      type: "original",
      worksheetId,
      tableName: "ws_1_orders",
      originalTableName: "ws_1_orders",
      activatedAt: "2026-08-13T12:00:00.000Z",
    },
    cleanedWorkingCopies: [],
    worksheets: [
      {
        worksheetId,
        workbookId: `workbook-${id}`,
        sheetName: "Orders",
        displayName: "Orders",
        tableName: "ws_1_orders",
        originalIndex: 0,
        status: "ready",
        schema: baseSchema,
        rowCount: 4,
        columnCount: baseSchema.length,
        visibleColumns: baseSchema.map((column) => column.name),
        hiddenColumns: [],
        normalization: {
          version: 1,
          normalizedAt: "2026-08-13T12:00:00.000Z",
          headerRowIndex: 0,
          skippedLeadingRows: 0,
          headerDetectionStrategy: "first_non_empty_row",
          headerDetectionConfidence: null,
          headerDetectionWarning: null,
          originalFirstRowPreview: ["status", "amount"],
          selectedHeaderRowPreview: ["status", "amount"],
          structuralColumnCandidates: [],
          structuralColumnDetectionWarning: null,
          structuralColumnDetectionConfidence: null,
          structuralColumnSampleSize: null,
          recommendedHiddenColumns: [],
          duplicateColumnCount: 0,
          emptyColumnCount: 0,
          warnings: [],
          templateStructureCandidate: false,
          templateStructureConfidence: "low",
          templateStructureEvidence: [],
        },
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
});

const createTwoWorksheetDataset = (
  id: string,
  activeWorksheetId: "worksheet-a" | "worksheet-b",
): DatasetMetadata => {
  const firstWorksheet = createDataset(id, "worksheet-a").workbook_metadata!.worksheets[0];
  const secondWorksheet = {
    ...firstWorksheet,
    worksheetId: "worksheet-b",
    sheetName: "Returns",
    displayName: "Returns",
    tableName: "ws_2_returns",
    originalIndex: 1,
  };
  const activeWorksheet =
    activeWorksheetId === "worksheet-a" ? firstWorksheet : secondWorksheet;

  return {
    ...createDataset(id, activeWorksheetId),
    table_name: activeWorksheet.tableName,
    workbook_metadata: {
      ...createDataset(id, activeWorksheetId).workbook_metadata!,
      worksheetIds: ["worksheet-a", "worksheet-b"],
      activeWorksheetId,
      activeAnalysisSource: {
        type: "original",
        worksheetId: activeWorksheetId,
        tableName: activeWorksheet.tableName,
        originalTableName: activeWorksheet.tableName,
        activatedAt: "2026-08-13T12:00:00.000Z",
      },
      worksheets: [firstWorksheet, secondWorksheet],
      tableMappings: [
        { sheetName: "Orders", tableName: "ws_1_orders", originalIndex: 0 },
        { sheetName: "Returns", tableName: "ws_2_returns", originalIndex: 1 },
      ],
    },
  };
};

const createUploadResponse = (dataset: DatasetMetadata): UploadResponse => ({
  dataset,
  preview: [{ status: "Open", amount: 10 }],
  workspace_manifest: {
    version: 1,
    workspace_id: `workspace-${dataset.dataset_id}`,
    workspace_name: dataset.original_filename,
    active_dataset_id: dataset.dataset_id,
    active_result_id: "preview",
    active_execution_id: null,
    current_mode: "human",
    current_result_tab: "preview",
    datasets: [],
    created_at: "2026-08-13T12:00:00.000Z",
    updated_at: "2026-08-13T12:00:00.000Z",
    filter_metadata: {},
    query_builder_metadata: {},
    sql_workspace_metadata: createSqlWorkspaceMetadataSnapshot(),
    last_opened_at: "2026-08-13T12:00:00.000Z",
  },
  workbook_metadata: dataset.workbook_metadata,
});

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const installTestStorage = () => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
};

const getSqlAskInput = () =>
  screen
    .getAllByLabelText("Ask FiltraQueri")
    .find((element): element is HTMLInputElement => element instanceof HTMLInputElement);

describe("Home Ask to Analyst handoff runtime behavior", () => {
  beforeEach(() => {
    installTestStorage();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("carries a Home question into Analyst Ask without inserting SQL or running DuckDB", async () => {
    const dataset = createDataset("dataset-a");
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/datasets/upload")) return jsonResponse(createUploadResponse(dataset));
      if (url.includes("/datasets/") && url.endsWith("/query")) {
        return jsonResponse({ dataset_id: dataset.dataset_id, columns: [], rows: [], row_count: 0 });
      }
      if (url.includes("/workspaces")) return jsonResponse({ workspaces: [], workspace: {} });
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(<App />);
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["status,amount\nOpen,10"], "orders.xlsx")],
      },
    });

    await screen.findAllByText("dataset-a.xlsx");
    fireEvent.click(screen.getByRole("button", { name: "Home" }));

    const homeAskInput = await screen.findByLabelText("Ask FiltraQueri anything about your data");
    fireEvent.change(homeAskInput, {
      target: { value: " Which statuses have the highest total amount? " },
    });
    fireEvent.submit(homeAskInput.closest("form")!);

    await screen.findAllByText("Inspect SQL");
    const analystAskInput = getSqlAskInput();
    expect(analystAskInput).toBeDefined();
    expect(analystAskInput).toHaveValue("Which statuses have the highest total amount?");
    expect(screen.getAllByText("Inspect SQL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Orders").length).toBeGreaterThan(0);
    expect((screen.getByLabelText("SQL query text") as HTMLTextAreaElement).value).toContain(
      "SELECT *",
    );
    expect(screen.queryByLabelText("Ask FiltraQueri suggestions")).not.toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([url]) => String(url).endsWith("/query"))).toBe(false);
  });

  it("initializes the Analyst question once and preserves later user edits", async () => {
    const dataset = createDataset("dataset-once");
    const handoff: SqlQuestionHandoff = {
      id: "handoff-once",
      source: "home",
      question: "Count orders by status",
      datasetId: dataset.dataset_id,
      worksheetId: "worksheet-orders",
      createdAt: "2026-08-13T12:00:00.000Z",
    };
    const onConsumed = vi.fn();
    const { rerender } = render(
      <SqlWorkspace
        dataset={dataset}
        questionHandoff={handoff}
        onQuestionHandoffConsumed={onConsumed}
      />,
    );

    await waitFor(() => expect(getSqlAskInput()).toHaveValue("Count orders by status"));
    expect(onConsumed).toHaveBeenCalledWith("handoff-once");

    fireEvent.change(getSqlAskInput()!, { target: { value: "Edited Analyst question" } });
    rerender(
      <SqlWorkspace
        dataset={dataset}
        questionHandoff={handoff}
        onQuestionHandoffConsumed={onConsumed}
      />,
    );

    await waitFor(() => expect(getSqlAskInput()).toHaveValue("Edited Analyst question"));
  });

  it("rejects a stale handoff scoped to another dataset", async () => {
    const datasetB = createDataset("dataset-b", "worksheet-b");
    const staleHandoff: SqlQuestionHandoff = {
      id: "handoff-stale",
      source: "home",
      question: "Count orders by status",
      datasetId: "dataset-a",
      worksheetId: "worksheet-orders",
      createdAt: "2026-08-13T12:00:00.000Z",
    };
    const onConsumed = vi.fn();

    render(
      <SqlWorkspace
        dataset={datasetB}
        questionHandoff={staleHandoff}
        onQuestionHandoffConsumed={onConsumed}
      />,
    );

    await screen.findAllByText("Inspect SQL");
    const askInput = getSqlAskInput();
    expect(askInput).toBeDefined();
    expect(askInput).toHaveValue("");
    expect(onConsumed).toHaveBeenCalledWith("handoff-stale");
  });

  it("rejects a worksheet-scoped handoff after another worksheet becomes active", async () => {
    const worksheetAQuestion = "Count orders by status";
    const worksheetBActiveDataset = createTwoWorksheetDataset("dataset-worksheet-mismatch", "worksheet-b");
    const worksheetAActiveDataset = createTwoWorksheetDataset("dataset-worksheet-mismatch", "worksheet-a");
    const handoff: SqlQuestionHandoff = {
      id: "handoff-worksheet-a",
      source: "home",
      question: worksheetAQuestion,
      datasetId: worksheetBActiveDataset.dataset_id,
      worksheetId: "worksheet-a",
      createdAt: "2026-08-13T12:00:00.000Z",
    };
    const immutableInputs = JSON.stringify({
      datasetId: worksheetBActiveDataset.dataset_id,
      workbookId: worksheetBActiveDataset.workbook_metadata?.workbookId,
      activeWorksheetId: worksheetBActiveDataset.workbook_metadata?.activeWorksheetId,
      handoff,
    });

    const HandoffConsumer = () => {
      const [activeDataset, setActiveDataset] = useState(worksheetBActiveDataset);
      const [activeHandoff, setActiveHandoff] = useState<SqlQuestionHandoff | null>(handoff);

      return (
        <>
          <button type="button" onClick={() => setActiveDataset(worksheetAActiveDataset)}>
            Switch to worksheet A
          </button>
          <SqlWorkspace
            key={activeDataset.workbook_metadata?.activeWorksheetId}
            dataset={activeDataset}
            questionHandoff={activeHandoff}
            onQuestionHandoffConsumed={() => setActiveHandoff(null)}
          />
        </>
      );
    };

    render(<HandoffConsumer />);

    await screen.findAllByText("Inspect SQL");
    await waitFor(() => expect(getSqlAskInput()).toHaveValue(""));
    expect(getSqlAskInput()).not.toHaveValue(worksheetAQuestion);
    expect((screen.getByLabelText("SQL query text") as HTMLTextAreaElement).value).toContain(
      "SELECT *",
    );
    expect(screen.queryByLabelText("Ask FiltraQueri suggestions")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Switch to worksheet A" }));

    await screen.findAllByText(/current executable source is Orders/);
    expect(getSqlAskInput()).toHaveValue("");
    expect(getSqlAskInput()).not.toHaveValue(worksheetAQuestion);
    expect(
      JSON.stringify({
        datasetId: worksheetBActiveDataset.dataset_id,
        workbookId: worksheetBActiveDataset.workbook_metadata?.workbookId,
        activeWorksheetId: worksheetBActiveDataset.workbook_metadata?.activeWorksheetId,
        handoff,
      }),
    ).toBe(immutableInputs);
  });

  it("keeps direct Analyst question entry working without a Home handoff", async () => {
    render(<SqlWorkspace dataset={createDataset("dataset-direct")} />);

    await screen.findAllByText("Inspect SQL");
    const askInput = getSqlAskInput();
    expect(askInput).toBeDefined();
    fireEvent.change(askInput!, { target: { value: "Show top statuses" } });

    expect(askInput).toHaveValue("Show top statuses");
  });

  it("does not duplicate or replay a consumed handoff under Strict Mode and remount", async () => {
    const dataset = createDataset("dataset-strict-remount");
    const handoff: SqlQuestionHandoff = {
      id: "handoff-strict-remount",
      source: "home",
      question: "Summarize status by amount",
      datasetId: dataset.dataset_id,
      worksheetId: "worksheet-orders",
      createdAt: "2026-08-13T12:00:00.000Z",
    };
    const onConsumed = vi.fn();

    const StrictModeHandoffConsumer = () => {
      const [activeHandoff, setActiveHandoff] = useState<SqlQuestionHandoff | null>(handoff);
      const [mounted, setMounted] = useState(true);

      return (
        <>
          <button type="button" onClick={() => setMounted((current) => !current)}>
            Toggle workspace
          </button>
          {mounted && (
            <SqlWorkspace
              dataset={dataset}
              questionHandoff={activeHandoff}
              onQuestionHandoffConsumed={(handoffId) => {
                onConsumed(handoffId);
                setActiveHandoff(null);
              }}
            />
          )}
        </>
      );
    };

    render(
      <StrictMode>
        <StrictModeHandoffConsumer />
      </StrictMode>,
    );

    await waitFor(() => expect(getSqlAskInput()).toHaveValue("Summarize status by amount"));
    expect(onConsumed).toHaveBeenCalledTimes(1);

    fireEvent.change(getSqlAskInput()!, { target: { value: "Edited after consumption" } });
    expect(getSqlAskInput()).toHaveValue("Edited after consumption");

    fireEvent.click(screen.getByRole("button", { name: "Toggle workspace" }));
    await waitFor(() => expect(screen.queryByLabelText("SQL workspace")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Toggle workspace" }));

    await screen.findAllByText("Inspect SQL");
    expect(getSqlAskInput()).toHaveValue("Edited after consumption");
    expect(getSqlAskInput()).not.toHaveValue("Summarize status by amount");
    expect(onConsumed).toHaveBeenCalledTimes(1);
  });

  it("does not create a Home handoff for a blank question", () => {
    const onAskQuestion = vi.fn();

    render(
      <UploadPanel
        uploading={false}
        errorMessage=""
        buttonLabel="Upload"
        context="Test"
        dataset={createDataset("dataset-a")}
        onFileChange={vi.fn()}
        onContinue={vi.fn()}
        onAskQuestion={onAskQuestion}
      />,
    );

    const homeAskInput = screen.getByLabelText("Ask FiltraQueri anything about your data");
    fireEvent.change(homeAskInput, { target: { value: "   " } });
    fireEvent.submit(homeAskInput.closest("form")!);

    expect(onAskQuestion).not.toHaveBeenCalled();
  });
});
