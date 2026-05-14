import {
  getDatasetActiveWorksheet,
  listWorkbookWorksheets,
} from "../workbook";
import type {
  BuildWorkspaceRuntimeContextOptions,
  InvestigationContinuation,
  RuntimePanelSlot,
  RuntimeContextSnapshot,
  WorkspaceTrailItem,
  WorkspaceRuntimeContext,
} from "./runtimeTypes";

const emptyDatasetName = "No dataset open";

const createTrail = ({
  activeView,
  mode,
  hasDataset,
}: {
  activeView: RuntimeContextSnapshot["activeView"];
  mode: RuntimeContextSnapshot["mode"];
  hasDataset: boolean;
}): WorkspaceTrailItem[] => [
  {
    id: "trail:data",
    label: "Data",
    view: hasDataset ? "dataset" : "welcome",
    mode: "human",
    status: activeView === "dataset" || activeView === "welcome" ? "current" : "available",
    summary: hasDataset ? "Dataset context is available." : "Open data to begin.",
  },
  {
    id: "trail:build",
    label: "Build",
    view: "queryBuilder",
    mode: "human",
    status: activeView === "queryBuilder" ? "current" : hasDataset ? "available" : "metadata",
    summary: "Query Builder state remains schema-driven.",
  },
  {
    id: "trail:results",
    label: "Results",
    view: "results",
    mode: "human",
    status: activeView === "results" ? "current" : hasDataset ? "available" : "metadata",
    summary: "Results use the active result model.",
  },
  {
    id: "trail:analyst",
    label: "Analyst",
    view: "sqlWorkspace",
    mode: "analyst",
    status: mode === "analyst" ? "current" : "available",
    summary: "SQL Workspace remains Analyst Mode only.",
  },
];

const createContinuations = ({
  hasDataset,
  mode,
  activeView,
  humanIntentLabel,
}: {
  hasDataset: boolean;
  mode: RuntimeContextSnapshot["mode"];
  activeView: RuntimeContextSnapshot["activeView"];
  humanIntentLabel: string | null;
}): InvestigationContinuation[] => [
  {
    id: "continue:dataset",
    label: hasDataset ? "Review data" : "Open data",
    description: hasDataset ? "Inspect dataset and workbook metadata." : "Choose a CSV or workbook.",
    targetView: hasDataset ? "dataset" : "welcome",
    targetMode: "human",
    source: "dataset",
  },
  {
    id: "continue:results",
    label: "Inspect results",
    description: "Continue through the current active result model.",
    targetView: "results",
    targetMode: "human",
    source: "results",
    disabled: !hasDataset,
  },
  {
    id: "continue:query-builder",
    label: humanIntentLabel ? `Continue ${humanIntentLabel}` : "Build query",
    description: humanIntentLabel
      ? "Use the existing Human Mode guided query setup."
      : "Open the existing Query Builder.",
    targetView: "queryBuilder",
    targetMode: "human",
    source: humanIntentLabel ? "human-intent" : "query-builder",
    disabled: !hasDataset,
  },
  {
    id: "continue:sql",
    label: mode === "analyst" || activeView === "sqlWorkspace" ? "Inspect SQL" : "Open Analyst Mode",
    description: "Review SQL drafts and validation without running real SQL.",
    targetView: "sqlWorkspace",
    targetMode: "analyst",
    source: "analyst",
  },
];

const createPanelSlots = (snapshot: RuntimeContextSnapshot): RuntimePanelSlot[] => [
  {
    id: "slot:runtime-context",
    label: "Runtime",
    title: "Workspace context",
    summary: snapshot.dataset.datasetId
      ? `${snapshot.dataset.name} is active in ${snapshot.mode} mode.`
      : "No dataset is active.",
    status: snapshot.activeView,
    metadataOnly: true,
    items: [
      { label: "Dataset", value: snapshot.dataset.name },
      { label: "View", value: snapshot.activeView },
      { label: "Mode", value: snapshot.mode },
    ],
  },
  {
    id: "slot:result-context",
    label: "Results",
    title: "Active result",
    summary: `${snapshot.activeResult.rowCount.toLocaleString()} rows through ${snapshot.activeResult.sourceType}.`,
    status: snapshot.activeResult.tab || "none",
    metadataOnly: true,
    items: [
      { label: "Page", value: `${snapshot.activeResult.page} of ${snapshot.activeResult.totalPages}` },
      { label: "Source", value: snapshot.activeResult.sourceType },
      { label: "Execution records", value: String(snapshot.execution.recordCount) },
    ],
  },
  {
    id: "slot:intelligence-boundary",
    label: "Boundary",
    title: "Intelligence boundary",
    summary: "Planning, graph, KPI, semantic, and contract layers remain metadata only.",
    status: "read-only",
    metadataOnly: true,
    items: [
      { label: "Execution", value: "Not connected" },
      { label: "SQL", value: "Analyst isolated" },
      { label: "Task", value: snapshot.taskRecommendation.humanIntentLabel || "No active intent" },
    ],
  },
];

export const buildWorkspaceRuntimeContext = ({
  dataset,
  mode,
  activeView,
  activeResultTab,
  activeResultModel,
  queryBuilder,
  sqlWorkspaceMetadata,
  executionRegistry,
  humanIntentLabel,
  selectedTrailItemId,
}: BuildWorkspaceRuntimeContextOptions): WorkspaceRuntimeContext => {
  const worksheets = listWorkbookWorksheets(dataset);
  const activeWorksheet = getDatasetActiveWorksheet(dataset);
  const latestExecution = executionRegistry.records[0] || null;
  const snapshot: RuntimeContextSnapshot = {
    dataset: {
      datasetId: dataset?.dataset_id || null,
      name: dataset?.original_filename || emptyDatasetName,
      rowCount: dataset?.row_count || 0,
      columnCount: dataset?.column_count || 0,
    },
    workbook: {
      hasWorkbook: worksheets.length > 0,
      activeWorksheetName: activeWorksheet?.displayName || activeWorksheet?.sheetName || null,
      worksheetCount: worksheets.length,
    },
    mode,
    activeView,
    activeResult: {
      tab: activeResultTab,
      sourceType: activeResultModel?.sourceType || "none",
      rowCount: activeResultModel?.totalCount || 0,
      page: activeResultModel?.page || 1,
      totalPages: activeResultModel?.totalPages || 1,
    },
    queryBuilder,
    sql: {
      hasDrafts: sqlWorkspaceMetadata.drafts.length > 0,
      selectedDialect: sqlWorkspaceMetadata.selectedDialect,
      activeDraftId: sqlWorkspaceMetadata.activeDraftId,
    },
    execution: {
      activeExecutionId: executionRegistry.activeExecutionId,
      recordCount: executionRegistry.records.length,
      latestSource: latestExecution?.source || null,
    },
    taskRecommendation: {
      humanIntentLabel,
      metadataOnly: true,
    },
  };

  return {
    snapshot,
    trail: createTrail({ activeView, mode, hasDataset: Boolean(dataset) }),
    continuations: createContinuations({
      hasDataset: Boolean(dataset),
      mode,
      activeView,
      humanIntentLabel,
    }),
    panelSlots: createPanelSlots(snapshot),
    selectedTrailItemId,
  };
};
