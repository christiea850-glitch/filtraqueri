import {
  getWorkbookMetadata,
  getDatasetActiveWorksheet,
  listWorkbookWorksheets,
} from "../workbook";
import { normalizeRuntimeModeContext } from "./runtimeAdapters";
import { buildInvestigationGuidance } from "./runtimeGuidanceAdapter";
import {
  groupGuidanceRecommendations,
  rankInvestigationGuidance,
} from "./runtimeGuidanceRankingAdapter";
import type {
  BuildWorkspaceRuntimeContextOptions,
  ContextualInvestigationObject,
  InvestigationContinuation,
  RuntimePanelSlot,
  RuntimeContextReference,
  RuntimeContextSnapshot,
  WorkspaceTrailItem,
  WorkspaceRuntimeContext,
} from "./runtimeTypes";

const emptyDatasetName = "No dataset open";

const formatViewLabel = (view: RuntimeContextReference["view"]) =>
  view.replace(/([A-Z])/g, " $1").toLowerCase();

const createRuntimeReference = (
  snapshot: RuntimeContextSnapshot,
  overrides: Partial<RuntimeContextReference> = {},
): RuntimeContextReference => ({
  datasetId: snapshot.dataset.datasetId,
  datasetName: snapshot.dataset.name,
  workbookActiveWorksheetName: snapshot.workbook.activeWorksheetName,
  workbookWorksheetCount: snapshot.workbook.worksheetCount,
  resultTab: snapshot.activeResult.tab,
  mode: snapshot.mode,
  view: snapshot.activeView,
  activeExecutionId: snapshot.execution.activeExecutionId,
  ...overrides,
});

export const getStableTrailItemId = ({
  semanticKey,
  view,
  mode,
}: {
  semanticKey?: WorkspaceTrailItem["semanticKey"];
  view: RuntimeContextReference["view"];
  mode: RuntimeContextReference["mode"];
}) => `trail:${mode}:${semanticKey || view}`;

export const getContextualObjectIdForView = (view: RuntimeContextReference["view"]) => {
  if (view === "results" || view === "history" || view === "export") return "context:result";
  if (view === "queryBuilder" || view === "filters") return "context:query-builder";
  if (view === "sqlWorkspace") return "context:sql-workspace";
  return "context:dataset";
};

const createTrail = ({
  activeView,
  mode,
  hasDataset,
  snapshot,
}: {
  activeView: RuntimeContextSnapshot["activeView"];
  mode: RuntimeContextSnapshot["mode"];
  hasDataset: boolean;
  snapshot: RuntimeContextSnapshot;
}): WorkspaceTrailItem[] => {
  const createItem = ({
    label,
    semanticKey,
    view,
    itemMode,
    summary,
    status,
  }: {
    label: string;
    semanticKey: WorkspaceTrailItem["semanticKey"];
    view: RuntimeContextReference["view"];
    itemMode: RuntimeContextReference["mode"];
    summary: string;
    status: WorkspaceTrailItem["status"];
  }): WorkspaceTrailItem => {
    const id = getStableTrailItemId({ semanticKey, view, mode: itemMode });
    const contextReference = createRuntimeReference(snapshot, { view, mode: itemMode });
    return {
      id,
      stableKey: id,
      label,
      semanticKey,
      view,
      mode: itemMode,
      status,
      summary,
      contextReference,
      derivedContinuationContext: {
        origin: "workspace-trail",
        originatingDatasetId: contextReference.datasetId,
        originatingWorkbookWorksheetName: contextReference.workbookActiveWorksheetName,
        originatingResultTab: contextReference.resultTab,
        originatingMode: contextReference.mode,
        originatingView: contextReference.view,
      },
      continuationId: `continue:${itemMode}:${view}`,
    };
  };

  return [
    createItem({
      label: hasDataset ? "Data context" : "Start here",
      semanticKey: "data",
      view: hasDataset ? "dataset" : "welcome",
      itemMode: "human",
      status: activeView === "dataset" || activeView === "welcome" ? "current" : "available",
      summary: hasDataset ? "Review dataset and workbook context." : "Open a dataset to begin.",
    }),
    createItem({
      label: "Build query",
      semanticKey: "build",
      view: "queryBuilder",
      itemMode: "human",
      status: activeView === "queryBuilder" ? "current" : hasDataset ? "available" : "metadata",
      summary: "Shape a guided query from the current schema.",
    }),
    createItem({
      label: "Review results",
      semanticKey: "results",
      view: "results",
      itemMode: "human",
      status: activeView === "results" ? "current" : hasDataset ? "available" : "metadata",
      summary: "Inspect the active result without changing it.",
    }),
    createItem({
      label: "Analyst SQL",
      semanticKey: "analyst",
      view: "sqlWorkspace",
      itemMode: "analyst",
      status: mode === "analyst" ? "current" : "available",
      summary: "SQL Workspace remains Analyst Mode only.",
    }),
  ];
};

const createContinuations = ({
  hasDataset,
  mode,
  activeView,
  humanIntentLabel,
  snapshot,
}: {
  hasDataset: boolean;
  mode: RuntimeContextSnapshot["mode"];
  activeView: RuntimeContextSnapshot["activeView"];
  humanIntentLabel: string | null;
  snapshot: RuntimeContextSnapshot;
}): InvestigationContinuation[] => {
  const originReference = createRuntimeReference(snapshot);
  const createContinuation = ({
    id,
    label,
    description,
    targetView,
    targetMode,
    source,
    origin,
    disabled = false,
  }: Omit<
    InvestigationContinuation,
    "originReference" | "continuationContext" | "relatedReferences" | "returnLabel"
  >): InvestigationContinuation => {
    const targetReference = createRuntimeReference(snapshot, { view: targetView, mode: targetMode });
    return {
      id,
      label,
      description,
      origin,
      originReference,
      continuationContext: {
        origin,
        originatingDatasetId: originReference.datasetId,
        originatingWorkbookWorksheetName: originReference.workbookActiveWorksheetName,
        originatingResultTab: originReference.resultTab,
        originatingMode: originReference.mode,
        originatingView: originReference.view,
      },
      relatedReferences: [
        targetReference,
        createRuntimeReference(snapshot, { view: "results", mode: "human" }),
        createRuntimeReference(snapshot, { view: "sqlWorkspace", mode: "analyst" }),
      ],
      returnLabel: `Return to ${formatViewLabel(activeView)}`,
      targetView,
      targetMode,
      source,
      disabled,
    };
  };

  return [
    createContinuation({
      id: "continue:human:dataset",
      label: hasDataset ? "Return to data context" : "Open data",
      description: hasDataset ? "Go back to the dataset and workbook summary." : "Choose a CSV or workbook.",
      targetView: hasDataset ? "dataset" : "welcome",
      targetMode: "human",
      source: "dataset",
      origin: "workspace-trail",
    }),
    createContinuation({
      id: "continue:human:results",
      label: "Review current result",
      description: "Open the existing result view without rerunning anything.",
      targetView: "results",
      targetMode: "human",
      source: "results",
      origin: "runtime-panel",
      disabled: !hasDataset,
    }),
    createContinuation({
      id: "continue:human:queryBuilder",
      label: humanIntentLabel ? `Continue ${humanIntentLabel}` : "Open Query Builder",
      description: humanIntentLabel
        ? "Resume the guided Human Mode setup."
        : "Continue with the current schema-driven builder.",
      targetView: "queryBuilder",
      targetMode: "human",
      source: humanIntentLabel ? "human-intent" : "query-builder",
      origin: humanIntentLabel ? "human-intent" : "workspace-trail",
      disabled: !hasDataset,
    }),
    createContinuation({
      id: "continue:analyst:sqlWorkspace",
      label: mode === "analyst" || activeView === "sqlWorkspace" ? "Stay in Analyst SQL" : "Open Analyst SQL",
      description: "Review drafts and validation metadata only.",
      targetView: "sqlWorkspace",
      targetMode: "analyst",
      source: "analyst",
      origin: "analyst-context",
    }),
  ];
};

const createContextualObjects = (snapshot: RuntimeContextSnapshot): ContextualInvestigationObject[] => [
  {
    id: "context:dataset",
    label: snapshot.dataset.name,
    objectType: "dataset",
    summary: snapshot.dataset.datasetId
      ? `${snapshot.dataset.rowCount.toLocaleString()} rows and ${snapshot.dataset.columnCount.toLocaleString()} columns.`
      : "No dataset is open yet.",
    reference: createRuntimeReference(snapshot, { view: "dataset", mode: "human" }),
  },
  {
    id: "context:result",
    label: snapshot.activeResult.tab || "No active result",
    objectType: "result",
    summary:
      snapshot.activeResult.sourceType === "none"
        ? "No active result has been selected."
        : `${snapshot.activeResult.sourceType} result, page ${snapshot.activeResult.page} of ${snapshot.activeResult.totalPages}.`,
    reference: createRuntimeReference(snapshot, { view: "results", mode: "human" }),
  },
  {
    id: "context:query-builder",
    label: "Query Builder",
    objectType: "query-builder",
    summary:
      snapshot.queryBuilder.selectedColumns.length === 0 && snapshot.queryBuilder.groupBy.length === 0
        ? "No builder selections yet."
        : `${snapshot.queryBuilder.selectedColumns.length} selected columns, ${snapshot.queryBuilder.groupBy.length} groups.`,
    reference: createRuntimeReference(snapshot, { view: "queryBuilder", mode: "human" }),
  },
  {
    id: "context:sql-workspace",
    label: "SQL Workspace",
    objectType: "sql-workspace",
    summary: `${snapshot.sql.selectedDialect} dialect, ${snapshot.sql.hasDrafts ? "drafts available" : "no saved drafts"}. Metadata only.`,
    reference: createRuntimeReference(snapshot, { view: "sqlWorkspace", mode: "analyst" }),
  },
];

const createPanelSlots = (snapshot: RuntimeContextSnapshot): RuntimePanelSlot[] => [
  {
    id: "slot:runtime-context",
    label: "Runtime",
    title: "Current workspace",
    summary: snapshot.dataset.datasetId
      ? `${snapshot.dataset.name} is open in ${snapshot.mode === "human" ? "Human" : "Analyst"} Mode.`
      : "Open a dataset to connect this investigation trail.",
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
    title: "Result position",
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
    title: "Safety boundary",
    summary: "Context, planning, KPI, semantic, and contract layers are read-only metadata here.",
    status: "read-only",
    metadataOnly: true,
    items: [
      { label: "Execution", value: "Not connected" },
      { label: "SQL", value: "Analyst isolated" },
      { label: "Task", value: snapshot.taskRecommendation.humanIntentLabel || "No active intent" },
      {
        label: "Mode context",
        value: normalizeRuntimeModeContext(snapshot.mode, snapshot.activeView).surface,
      },
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
  selectedContextualObjectId,
  returnContinuationId,
}: BuildWorkspaceRuntimeContextOptions): WorkspaceRuntimeContext => {
  const workbook = getWorkbookMetadata(dataset);
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
      relationshipCandidateCount: workbook?.relationshipCandidates.length || 0,
      acceptedRelationshipCount: workbook?.acceptedRelationshipContracts.length || 0,
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

  const contextualObjects = createContextualObjects(snapshot);
  const continuations = createContinuations({
    hasDataset: Boolean(dataset),
    mode,
    activeView,
    humanIntentLabel,
    snapshot,
  });
  const guidance = rankInvestigationGuidance({
    snapshot,
    guidance: buildInvestigationGuidance({ snapshot, continuations }),
  });
  const trail = createTrail({ activeView, mode, hasDataset: Boolean(dataset), snapshot });
  const selectedTrailItem = trail.find((item) => item.id === selectedTrailItemId);

  return {
    snapshot,
    trail,
    continuations,
    guidance,
    recommendationGroups: groupGuidanceRecommendations({ snapshot, guidance }),
    panelSlots: createPanelSlots(snapshot),
    contextualObjects,
    selectedContextualObject:
      contextualObjects.find((item) => item.id === selectedContextualObjectId) || null,
    returnContinuation:
      continuations.find((continuation) => continuation.id === returnContinuationId) || null,
    selectedTrailItemId: selectedTrailItem?.id || null,
    modeContexts: {
      human: createRuntimeReference(snapshot, {
        mode: "human",
        view: activeView === "sqlWorkspace" ? "results" : activeView,
      }),
      analyst: createRuntimeReference(snapshot, {
        mode: "analyst",
        view: "sqlWorkspace",
      }),
    },
  };
};
