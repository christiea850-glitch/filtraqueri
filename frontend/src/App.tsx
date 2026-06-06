import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { humanIntentGuidance } from "./app/appCompositionConfig";
import DatasetSummaryPanel, {
  type HumanIntent,
} from "./components/dataset/DatasetSummaryPanel";
import DynamicFiltersPanel from "./components/filters/DynamicFiltersPanel";
import QueryHistoryPanel from "./components/history/QueryHistoryPanel";
import WorkspaceShell, { type CommandLauncherItem } from "./components/layout/WorkspaceShell";
import VisualQueryBuilderPanel from "./components/query-builder/VisualQueryBuilderPanel";
import ResultTabs from "./components/results/ResultTabs";
import ResultsGrid from "./components/results/ResultsGrid";
import ResultsInvestigationSurface from "./components/results/ResultsInvestigationSurface";
import UploadPanel from "./components/upload/UploadPanel";
import QuestionWorkspacePanel from "./components/workspace/QuestionWorkspacePanel";
import {
  createAnalystNavItems,
  createAnalystWorkspaceRenderers,
} from "./features/analyst/analystWorkspaceHelpers";
import { analystWorkspaceRegistry } from "./features/analyst/analystWorkspaceRegistry";
import type { SqlAssistantMode } from "./features/analyst/sql/SqlAssistantPanel";
import type {
  ActiveView,
} from "./features/dataset/datasetTypes";
import type { DataQualityAlertAction } from "./features/dataQuality/dataQualityAlerts";
import useExecutionRegistry from "./features/execution/executionRegistry";
import useWorkspaceDatasetController from "./features/dataset/useWorkspaceDatasetController";
import useExportController from "./features/export/useExportController";
import useExploreRoom from "./features/explore/useExploreRoom";
import ExploreComposeRoom, {
  type ExploreComposeStarterPrompt,
} from "./features/explore/ExploreComposeRoom";
import ExploreRefineRoom, {
  type ExploreRefineSetupRow,
} from "./features/explore/ExploreRefineRoom";
import useFilterController from "./features/filters/useFilterController";
import useQueryHistory from "./features/history/useQueryHistory";
import type { GovernedQueryBuilderRequestDraft } from "./features/questionWorkspace/questionQueryBuilderRequestTypes";
import { mapQueryBuilderRequestToReviewState } from "./features/questionWorkspace/questionQueryBuilderReviewMapper";
import useQueryBuilderController from "./features/query-builder/useQueryBuilderController";
import type { ResultTabKey } from "./features/results/resultTypes";
import {
  coordinateExecutionResult,
} from "./features/workspace/workspaceOrchestration";
import useWorkspaceIntelligenceReports from "./features/workspace/useWorkspaceIntelligenceReports";
import {
  createRuntimeNavigationSelection,
  getContextualObjectIdForView,
} from "./features/workspaceRuntime";
import useWorkspaceRuntimeCoordinator from "./features/workspaceRuntime/useWorkspaceRuntimeCoordinator";
import useActiveResultModel, {
  getCurrentRowCount,
} from "./features/results/activeResultModel";
import useResultExecutionCoordinator from "./features/results/useResultExecutionCoordinator";
import useResults from "./features/results/useResults";
import "./App.css";
import "./styles/explore.css";

const analystNavItems = createAnalystNavItems(analystWorkspaceRegistry);

type PreparedQuestionContext = {
  questionText: string;
  sourceLabel: "Query Builder review";
  status: "applied_for_review" | "executed";
};

type HumanAnalyzeStage = "investigate" | "review";

type CleanPrepareRestoreContext = {
  worksheetId: string;
  scrollY: number;
  requestId: number;
};

// S5-P3: App.tsx remains the current composition root. The S5 navigation
// skeleton is intentionally inactive here; routing, mode switching, dataset
// restore, SQL, results, export, and runtime wiring stay behaviorally unchanged.
function App() {
  const sidebarFileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    activeResultTab,
    setActiveResultTab,
    previewResult,
    setPreviewResult,
    filteredResult,
    setFilteredResult,
    queriedResult,
    setQueriedResult,
    activeResult,
    hasFilteredResults,
    resetResults,
  } = useResults();
  const { queryHistory, setQueryHistory, addHistory, clearHistory } = useQueryHistory();
  const [errorMessage, setErrorMessage] = useState("");
  const [queryBuilderReviewNotice, setQueryBuilderReviewNotice] = useState("");
  const [humanAnalyzeStage, setHumanAnalyzeStage] =
    useState<HumanAnalyzeStage>("investigate");
  const [isInvestigateHistoryOpen, setIsInvestigateHistoryOpen] = useState(false);
  const [preparedQuestionContext, setPreparedQuestionContext] =
    useState<PreparedQuestionContext | null>(null);
  const [executedPreparedQuestionContext, setExecutedPreparedQuestionContext] =
    useState<PreparedQuestionContext | null>(null);
  const [humanIntent, setHumanIntent] = useState<HumanIntent | null>(null);
  const [cleanPrepareRestoreContext, setCleanPrepareRestoreContext] =
    useState<CleanPrepareRestoreContext | null>(null);
  const [requestedSqlAssistantMode, setRequestedSqlAssistantMode] =
    useState<SqlAssistantMode | null>(null);
  const consumeCleanPrepareRestoreContext = useCallback(
    () => setCleanPrepareRestoreContext(null),
    [],
  );
  const [humanInsightBackTarget, setHumanInsightBackTarget] = useState<{
    view: ActiveView;
    tab: ResultTabKey;
  } | null>(null);
  const {
    registry: executionRegistry,
    recordExecutionResult,
    clearActiveExecution,
  } = useExecutionRegistry();
  const {
    querySelectedColumns,
    setQuerySelectedColumns,
    queryGroupBy,
    setQueryGroupBy,
    queryAggregations,
    querySortColumn,
    setQuerySortColumn,
    querySortDirection,
    setQuerySortDirection,
    queryLimit,
    setQueryLimit,
    hasRunQuery,
    setHasRunQuery,
    activeAggregations,
    querySortOptions,
    toggleListValue,
    resetQueryBuilder,
    restoreQueryBuilder,
    addAggregation,
    updateAggregation,
    removeAggregation,
    configureForHumanIntent,
  } = useQueryBuilderController();
  const {
    filterValues,
    setFilterValues,
    updateFilter,
    buildBackendFilters,
    createFilterLabels,
  } = useFilterController();
  const {
    dataset,
    recentDatasets,
    activeView,
    workspaceMode,
    setWorkspaceMode,
    sqlWorkspaceMetadata,
    setSqlWorkspaceMetadata,
    shouldOpenFilePicker,
    setShouldOpenFilePicker,
    selectedFileName,
    isUploading,
    isSwitchingWorksheet,
    updateDatasetSessionView,
    updateDatasetSessionResultTab,
    activateRecentDataset,
    openDatasetPicker,
    handleFileUpload,
    handleWorksheetSelect,
    handleAnalysisSourceSelect,
    clearCurrentDatasetSession,
    removeRecentDatasetWithConfirmation,
    confirmFutureDatasetDelete,
    datasetRegistry,
    attachExecutionToActiveDataset,
    attachActiveResultToActiveDataset,
  } = useWorkspaceDatasetController({
    activeResultTab,
    setActiveResultTab,
    previewResult,
    setPreviewResult,
    filteredResult,
    setFilteredResult,
    queriedResult,
    setQueriedResult,
    resetResults,
    filterValues,
    setFilterValues,
    querySelectedColumns,
    queryGroupBy,
    queryAggregations,
    querySortColumn,
    querySortDirection,
    queryLimit,
    hasRunQuery,
    restoreQueryBuilder,
    resetQueryBuilder,
    queryHistory,
    setQueryHistory,
    clearHistory,
    setErrorMessage,
    setHumanIntent,
    onExecutionResult: (executionResult) => {
      const coordinationResult = coordinateExecutionResult({
        executionResult,
        resultTab: "preview",
        hiddenColumns: [],
        recordExecutionResult,
      });
      attachExecutionToActiveDataset(
        coordinationResult.record.executionId,
        coordinationResult.record.datasetId,
      );
      attachActiveResultToActiveDataset("preview", coordinationResult.record.datasetId);
    },
    onDatasetContextChange: clearActiveExecution,
  });
  const draftFilters = buildBackendFilters(dataset);
  const activeFilters =
    activeResultTab === "preview" ? [] : activeResult.source?.filters || draftFilters;
  const activeFilterLabels = createFilterLabels(activeFilters);
  const activeWorkbookWorksheet = dataset?.workbook_metadata?.worksheets.find(
    (worksheet) => worksheet.worksheetId === dataset.workbook_metadata?.activeWorksheetId,
  );
  const {
    activeResultModel,
    hiddenColumns: resultHiddenColumns,
    setHiddenColumns: setResultHiddenColumns,
  } = useActiveResultModel({
    dataset,
    activeResultTab,
    activeResult,
    previewResult,
    activeFilterLabels,
    activeFilters,
    queryGroupBy,
    querySelectedColumns,
    activeAggregations,
    queryLimit,
    hasRunQuery,
  });
  const { isExporting, exportCurrentResults: runExportCurrentResults } = useExportController({
    dataset,
    activeResultModel,
    addHistory,
  });
  const {
    investigationReport,
    narrativeReport,
    analysisPackagePlan,
    investigationWorkspacePlan,
  } = useWorkspaceIntelligenceReports({
    dataset,
    activeResultModel,
    queryHistory,
    workspaceMode,
  });
  const {
    runtimePersistence,
    setRuntimePersistence,
    workspaceRuntimeContext,
    onRuntimePanelToggle,
    onRuntimeTrailSelect,
  } = useWorkspaceRuntimeCoordinator({
    dataset,
    recentDatasets,
    activeView,
    activeResultTab,
    activeResult,
    activeResultModel,
    executionRegistry,
    datasetRegistry,
    workspaceMode,
    activeFilters,
    querySelectedColumns,
    queryGroupBy,
    queryAggregations,
    querySortColumn,
    querySortDirection,
    queryLimit,
    hasRunQuery,
    sqlWorkspaceMetadata,
    humanIntentLabel: humanIntent ? humanIntentGuidance[humanIntent].label : null,
    setWorkspaceMode,
    updateDatasetSessionView,
  });

  const hasQueryResults = queriedResult.columns.length > 0 || hasRunQuery;

  // E-1: Explore Three-Room state machine (compose / refine / answer).
  // Infrastructure only — read-only state today, used for the future
  // E-2/E-3/E-4 redesign. No UI is gated on these values yet.
  const {
    currentRoom: currentExploreRoom,
    isComposeRoom: isExploreComposeRoom,
    isRefineRoom: isExploreRefineRoom,
    isAnswerRoom: isExploreAnswerRoom,
    goToCompose: goToExploreComposeRoom,
    goToRefine: goToExploreRefineRoom,
    goToAnswer: goToExploreAnswerRoom,
    resetExploreRoom,
  } = useExploreRoom();

  useEffect(() => {
    setPreparedQuestionContext(null);
    setExecutedPreparedQuestionContext(null);
    setQueryBuilderReviewNotice("");
    setHumanAnalyzeStage("investigate");
  }, [dataset?.dataset_id]);

  // E-1 observational sync: derive room from existing events. These effects
  // only forward-transition Compose → Refine → Answer; reverse transitions
  // are deferred to E-2+ (which will wire explicit room navigation UI).
  useEffect(() => {
    if (humanAnalyzeStage === "review" && isExploreComposeRoom) {
      goToExploreRefineRoom();
    }
  }, [humanAnalyzeStage, isExploreComposeRoom, goToExploreRefineRoom]);

  useEffect(() => {
    if (hasQueryResults && !isExploreAnswerRoom) {
      goToExploreAnswerRoom();
    }
  }, [hasQueryResults, isExploreAnswerRoom, goToExploreAnswerRoom]);

  useEffect(() => {
    if (!dataset) {
      resetExploreRoom();
    }
  }, [dataset, resetExploreRoom]);

  // E-2: Compose room state. The question text is held at the App level so it
  // survives if the room is hidden/shown (the Compose room uses controlled
  // input). It is NOT shared with QuestionWorkspacePanel's internal rawQuestion
  // by design — E-3 will lift state into a shared composer when the Refine
  // room redesign lands.
  const [exploreComposeQuestion, setExploreComposeQuestion] = useState("");

  // Reset the Compose question when the dataset changes so a new workbook
  // starts with a calm empty state.
  useEffect(() => {
    setExploreComposeQuestion("");
  }, [dataset?.dataset_id]);

  // E-2: Static starter prompts. Frontend-only, no backend lookup; these are
  // illustrative business-question prompts that populate the textarea — they
  // do NOT auto-run, generate SQL, or call any provider.
  const exploreComposeStarterPrompts = useMemo<ExploreComposeStarterPrompt[]>(
    () => [
      {
        id: "rent-trend",
        title: "Rent payment trend by property",
        description: "Look at how rent collection changes month-by-month across properties.",
        prompt: "What was the rent payment trend by property in 2025?",
      },
      {
        id: "lease-expirations",
        title: "Lease expirations in the next 90 days",
        description: "List leases ending soon with tenant and property context.",
        prompt: "Which leases expire in the next 90 days?",
      },
      {
        id: "maintenance-backlog",
        title: "Maintenance backlog by property",
        description: "Count open maintenance requests grouped by property and type.",
        prompt: "How many open maintenance requests does each property have?",
      },
      {
        id: "top-tenants",
        title: "Top tenants by payment volume",
        description: "Rank tenants by total payments — high earners first.",
        prompt: "Which tenants paid the most in 2025?",
      },
    ],
    [],
  );

  // Active scope chip label for the Compose room. Falls back through
  // displayName → sheetName → table_name, then null if none are available.
  const exploreComposeActiveScopeLabel = useMemo<string | null>(() => {
    if (!dataset) return null;
    return (
      activeWorkbookWorksheet?.displayName ||
      activeWorkbookWorksheet?.sheetName ||
      dataset.table_name ||
      null
    );
  }, [dataset, activeWorkbookWorksheet]);

  const exploreComposeCanAsk = Boolean(dataset && exploreComposeQuestion.trim());
  const exploreComposeAskDisabledReason = !dataset
    ? "Open a dataset first"
    : !exploreComposeQuestion.trim()
      ? "Type a question to continue"
      : undefined;

  // E-2 Ask handler: flip the existing humanAnalyzeStage to "review". The
  // E-1 observational effect catches that flip and forwards the room from
  // compose → refine. No query runs here — Run query in the existing builder
  // is still the only execution trigger.
  const handleExploreComposeAsk = useCallback(() => {
    if (!dataset || !exploreComposeQuestion.trim()) return;
    setHumanAnalyzeStage("review");
  }, [dataset, exploreComposeQuestion]);

  // E-3 (corrected): Continue-in-Analyst handoff. Used from both the Compose
  // room's escape hatch and the Refine room's primary action. Explore is the
  // dataset understanding workspace; Analyst is the only execution surface.
  // This handler routes the user to the existing Analyst SQL workspace,
  // where Run Query already lives. No execution path is created here.
  const handleContinueInAnalyst = useCallback(() => {
    if (!dataset) return;
    setWorkspaceMode("analyst");
    updateDatasetSessionView("sqlWorkspace");
  }, [dataset, setWorkspaceMode, updateDatasetSessionView]);

  const {
    isFiltering,
    isRunningQuery,
    handleResultTabChange,
    applyFilters,
    resetFilters,
    runVisualQuery,
    sortWorkspaceColumn,
    changeWorkspacePage,
    changeWorkspaceRowsPerPage,
  } = useResultExecutionCoordinator({
    dataset,
    activeResultTab,
    setActiveResultTab,
    activeResult,
    activeResultModel,
    previewResult,
    setPreviewResult,
    filteredResult,
    setFilteredResult,
    queriedResult,
    setQueriedResult,
    resultHiddenColumns,
    updateDatasetSessionView,
    updateDatasetSessionResultTab,
    buildBackendFilters,
    createFilterLabels,
    setFilterValues,
    querySelectedColumns,
    queryGroupBy,
    activeAggregations,
    querySortColumn,
    setQuerySortColumn,
    querySortDirection,
    setQuerySortDirection,
    queryLimit,
    setQueryLimit,
    setHasRunQuery,
    recordExecutionResult,
    attachExecutionToActiveDataset,
    attachActiveResultToActiveDataset,
    addHistory,
    setErrorMessage,
  });

  const exportCurrentResults = async () => {
    setErrorMessage("");
    const exportError = await runExportCurrentResults();
    if (exportError) setErrorMessage(exportError);
  };

  const dispatchDeferredWorkspaceCommand = (eventName: string, detail: Record<string, unknown>) => {
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(eventName, { detail })), 0);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(eventName, { detail })), 80);
  };

  const openHumanView = (view: ActiveView) => {
    setWorkspaceMode("human");
    if (view === "queryBuilder") setHumanAnalyzeStage("investigate");
    updateDatasetSessionView(view);
  };

  const handleWorkspaceViewChange = (view: ActiveView) => {
    if (view === "queryBuilder") setHumanAnalyzeStage("investigate");
    updateDatasetSessionView(view);
  };

  const handleRuntimeTrailSelect = (
    trailItemId: string,
    targetView: ActiveView,
    targetMode: "human" | "analyst",
  ) => {
    if (targetView === "queryBuilder") setHumanAnalyzeStage("investigate");
    onRuntimeTrailSelect(trailItemId, targetView, targetMode);
  };

  const applyGovernedQueryBuilderRequestForReview = (
    draft: GovernedQueryBuilderRequestDraft,
  ) => {
    if (draft.status !== "created_for_review" || !draft.request) return;
    if (draft.request.filters.length > 0) return;

    restoreQueryBuilder(mapQueryBuilderRequestToReviewState(draft.request));
    setPreparedQuestionContext({
      questionText: draft.sourceDraft.rawQuestion,
      sourceLabel: "Query Builder review",
      status: "applied_for_review",
    });
    setExecutedPreparedQuestionContext(null);
    setWorkspaceMode("human");
    setHumanAnalyzeStage("review");
    updateDatasetSessionView("queryBuilder");
    setQueryBuilderReviewNotice(
      "Request draft applied for review. Nothing has run yet. Review the Query Builder setup before running.",
    );
  };

  const runReviewedQueryBuilder = async () => {
    const activePreparedQuestionContext = preparedQuestionContext;
    const didRun = await runVisualQuery();

    if (!didRun) return;

    if (activePreparedQuestionContext) {
      setExecutedPreparedQuestionContext({
        ...activePreparedQuestionContext,
        status: "executed",
      });
      setPreparedQuestionContext(null);
      setQueryBuilderReviewNotice(
        "Request draft ran through the existing Query Builder path. Review the result before taking the next step.",
      );
      return;
    }

    setExecutedPreparedQuestionContext(null);
  };

  // E-3: Refine room — deterministic, frontend-only summaries of state that
  // already lives in App.tsx. No analysis runs here; we read the same query
  // builder state the legacy VisualQueryBuilderPanel reads from. Row edit
  // icons route to the advanced builder rather than inline-editing in E-3.
  const refineFieldChoicesSummary = useMemo<string>(() => {
    const parts: string[] = [];
    if (querySelectedColumns.length > 0) {
      parts.push(
        `${querySelectedColumns.length} field${querySelectedColumns.length === 1 ? "" : "s"} selected`,
      );
    }
    if (queryGroupBy.length > 0) {
      const groupNames = queryGroupBy.slice(0, 2).join(", ");
      const remainder = queryGroupBy.length > 2 ? ` + ${queryGroupBy.length - 2}` : "";
      parts.push(`grouped by ${groupNames}${remainder}`);
    }
    if (queryAggregations.length > 0) {
      parts.push(
        `${queryAggregations.length} aggregation${queryAggregations.length === 1 ? "" : "s"}`,
      );
    }
    if (parts.length === 0) {
      return "Choose fields in the advanced builder.";
    }
    return parts.join(" · ");
  }, [querySelectedColumns, queryGroupBy, queryAggregations]);

  const refineFiltersSummary = useMemo<string>(() => {
    if (activeFilterLabels.length === 0) {
      return "No filters yet — covers the whole scope.";
    }
    const head = activeFilterLabels.slice(0, 2).join(" · ");
    const remainder =
      activeFilterLabels.length > 2 ? ` + ${activeFilterLabels.length - 2} more` : "";
    return `${head}${remainder}`;
  }, [activeFilterLabels]);

  const refineSortLimitSummary = useMemo<string>(() => {
    const parts: string[] = [];
    if (querySortColumn) {
      parts.push(`Sorted by ${querySortColumn} (${querySortDirection})`);
    } else {
      parts.push("Default order");
    }
    if (queryLimit) {
      parts.push(`Limit ${queryLimit}`);
    }
    return parts.join(" · ");
  }, [querySortColumn, querySortDirection, queryLimit]);

  const exploreRefineSetupRows = useMemo<ExploreRefineSetupRow[]>(
    () => [
      {
        id: "interpretation",
        label: "Interpretation",
        summary: "A focused answer based on your question and active scope.",
        detail:
          "FiltraQueri prepares a preview from the existing builder. Nothing runs until you click Run query.",
      },
      {
        id: "fields",
        label: "Field choices",
        summary: refineFieldChoicesSummary,
        detail: "Edit in the advanced builder if you want to change them.",
      },
      {
        id: "filters",
        label: "Filters",
        summary: refineFiltersSummary,
      },
      {
        id: "sort-limit",
        label: "Sort / limit",
        summary: refineSortLimitSummary,
      },
    ],
    [refineFieldChoicesSummary, refineFiltersSummary, refineSortLimitSummary],
  );

  // E-3 (corrected): The Refine room is read-only — no execution. The only
  // primary action is Continue in Analyst.
  const exploreRefineCanContinueInAnalyst = Boolean(dataset);
  const exploreRefineContinueDisabledReason = !dataset
    ? "Open a dataset first"
    : undefined;

  // E-3 Edit question handler: reverse the legacy stage flip and route the
  // room back to Compose. The Compose question text is preserved at the App
  // level so the user lands on their prior wording.
  const handleExploreRefineEditQuestion = useCallback(() => {
    setHumanAnalyzeStage("investigate");
    goToExploreComposeRoom();
  }, [goToExploreComposeRoom]);

  const openDataCommand = (target?: string) => {
    openHumanView("dataset");
    if (target) {
      dispatchDeferredWorkspaceCommand("filtraqueri:data-workspace-command", { target });
    }
  };

  const openDatasetPreview = (worksheetId: string) => {
    openHumanView("dataset");
    dispatchDeferredWorkspaceCommand("filtraqueri:data-workspace-command", {
      target: "worksheetPreview",
      worksheetId,
      origin: "cleanPrepare",
      scrollY: window.scrollY,
    });
  };

  const returnToCleanPrepare = (worksheetId: string, scrollY: number) => {
    setCleanPrepareRestoreContext({
      worksheetId,
      scrollY,
      requestId: Date.now(),
    });
    openHumanView("queryBuilder");
  };

  const handleDataQualityNavigate = (action: DataQualityAlertAction) => {
    if (action === "preview") {
      openDataCommand("preview");
      return;
    }

    if (action === "clean-prepare") {
      openHumanView("queryBuilder");
      return;
    }

    openDataCommand(
      action === "data-missing-values"
        ? "missingValues"
        : action === "data-columns"
          ? "columns"
          : "overview",
    );
  };

  const openAnalystCommand = (target: "editor" | "result" | "drafts" = "editor") => {
    setWorkspaceMode("analyst");
    setRequestedSqlAssistantMode(null);
    updateDatasetSessionView("sqlWorkspace");
    dispatchDeferredWorkspaceCommand("filtraqueri:sql-workspace-command", { target });
  };

  const selectHumanIntent = (intent: HumanIntent) => {
    const guidance = humanIntentGuidance[intent];
    setHumanIntent(intent);
    setHumanInsightBackTarget(null);
    setWorkspaceMode("human");
    configureForHumanIntent(intent, dataset);

    if (intent === "summary" || intent === "unusual_values") {
      handleResultTabChange("preview");
    }

    if (guidance.route === "queryBuilder") setHumanAnalyzeStage("investigate");
    updateDatasetSessionView(guidance.route);
  };

  const navigateHumanInsightAction = (view: ActiveView, tab?: ResultTabKey) => {
    if (view !== activeView) {
      setHumanInsightBackTarget({ view: activeView, tab: activeResultTab });
    }
    if (tab) handleResultTabChange(tab);
    if (view === "queryBuilder") setHumanAnalyzeStage("investigate");
    setRuntimePersistence((currentState) =>
      createRuntimeNavigationSelection({
        runtimeContext: workspaceRuntimeContext,
        currentPersistence: currentState,
        request: {
          id: `continue:human:${view}`,
          targetView: view,
          targetMode: "human",
        },
      }).persistence,
    );
    updateDatasetSessionView(view);
  };

  const returnToHumanInsight = () => {
    if (!humanInsightBackTarget) return;

    handleResultTabChange(humanInsightBackTarget.tab);
    setRuntimePersistence((currentState) => ({
      ...currentState,
      selectedTrailItemId:
        workspaceRuntimeContext.trail.find(
          (item) => item.view === humanInsightBackTarget.view && item.mode === "human",
        )?.id || currentState.selectedTrailItemId,
      selectedContextualObjectId: getContextualObjectIdForView(humanInsightBackTarget.view),
      returnContinuationId: null,
    }));
    updateDatasetSessionView(humanInsightBackTarget.view);
    setHumanInsightBackTarget(null);
  };

  const createHumanInsight = (intent: HumanIntent) => {
    const guidance = humanIntentGuidance[intent];

    if (!dataset) {
      return {
        title: guidance.label,
        explanation: "Choose a file to start shaping the first business question.",
        metrics: [
          { label: "Rows", value: "0" },
          { label: "Columns", value: "0" },
          { label: "Preview loaded", value: "0" },
        ],
        actions: [{ label: "Open a dataset", view: "dataset" as ActiveView }],
      };
    }

    const numericColumns = dataset.schema.filter((column) => column.inferred_type === "numeric");
    const categoricalColumns = dataset.schema.filter(
      (column) => column.inferred_type === "categorical" || column.inferred_type === "text",
    );
    const dateColumns = dataset.schema.filter((column) => column.inferred_type === "date");
    const columnsWithMissingValues = dataset.schema.filter((column) => column.null_count > 0);
    const previewRowsCount = previewResult.rows.length;
    const activeResultCount = getCurrentRowCount(activeResultModel) || activeResult.totalCount || dataset.row_count;

    const baseMetrics = [
      { label: "Rows", value: dataset.row_count.toLocaleString() },
      { label: "Columns", value: dataset.column_count.toLocaleString() },
      { label: "Preview loaded", value: previewRowsCount.toLocaleString() },
    ];

    if (intent === "summary") {
      return {
        title: guidance.label,
        explanation: "Start with rows, columns, and preview.",
        metrics: [
          ...baseMetrics,
          { label: "Active rows", value: activeResultCount.toLocaleString() },
        ],
        actions: [
          { label: "View results", view: "results" as ActiveView, tab: "preview" as ResultTabKey },
          { label: "Open data", view: "dataset" as ActiveView },
        ],
      };
    }

    if (intent === "missing_values") {
      return {
        title: guidance.label,
        explanation: "Review missing values before totals change.",
        metrics: [
          { label: "Missing-value columns", value: columnsWithMissingValues.length.toLocaleString() },
          {
            label: columnsWithMissingValues[0]?.name || "Highest missing",
            value: columnsWithMissingValues[0]?.null_count.toLocaleString() || "0",
          },
        ],
        actions: [
          { label: "Choose columns", view: "queryBuilder" as ActiveView },
          { label: "Open filters", view: "filters" as ActiveView },
        ],
      };
    }

    if (intent === "top_categories") {
      const firstCategory = categoricalColumns[0];
      return {
        title: guidance.label,
        explanation: "Count the biggest groups.",
        metrics: [
          { label: "Category columns", value: categoricalColumns.length.toLocaleString() },
          { label: "Suggested", value: firstCategory?.name || "None" },
          { label: "Grouped", value: queryGroupBy.length.toLocaleString() },
        ],
        actions: [
          { label: "Build summary", view: "queryBuilder" as ActiveView },
          { label: "View results", view: "results" as ActiveView, tab: "queried" as ResultTabKey },
        ],
      };
    }

    if (intent === "compare_columns") {
      const comparisonColumns = dataset.schema.slice(0, 2).map((column) => column.name);
      return {
        title: guidance.label,
        explanation: "Put two fields side by side.",
        metrics: [
          { label: "Selected", value: querySelectedColumns.length.toLocaleString() },
          { label: "First", value: comparisonColumns[0] || "None" },
          { label: "Second", value: comparisonColumns[1] || "None" },
        ],
        actions: [
          { label: "Choose columns", view: "queryBuilder" as ActiveView },
          { label: "Preview rows", view: "results" as ActiveView, tab: "preview" as ResultTabKey },
        ],
      };
    }

    if (intent === "trends") {
      return {
        title: guidance.label,
        explanation: "Use time plus a number.",
        metrics: [
          { label: "Date columns", value: dateColumns.length.toLocaleString() },
          { label: "Numeric columns", value: numericColumns.length.toLocaleString() },
          { label: "Suggested value", value: numericColumns[0]?.name || "None" },
        ],
        actions: [
          { label: "Build trend", view: "queryBuilder" as ActiveView },
          { label: "Open filters", view: "filters" as ActiveView },
        ],
      };
    }

    if (intent === "unusual_values") {
      return {
        title: guidance.label,
        explanation: "Sort to find highs, lows, and surprises.",
        metrics: [
          { label: "Sortable", value: (numericColumns.length + dateColumns.length).toLocaleString() },
          { label: "Rows", value: activeResultCount.toLocaleString() },
          { label: "Sort", value: activeResult.sortColumn || "None" },
        ],
        actions: [
          { label: "Sort rows", view: "results" as ActiveView, tab: "preview" as ResultTabKey },
          { label: "Open filters", view: "filters" as ActiveView },
        ],
      };
    }

    return {
      title: guidance.label,
      explanation: "Start with a small summary table.",
      metrics: [
        { label: "Category", value: categoricalColumns[0]?.name || "None" },
        { label: "Value", value: numericColumns[0]?.name || "COUNT" },
        { label: "Groups", value: queryGroupBy.length.toLocaleString() },
      ],
      actions: [
        { label: "Build visualization", view: "queryBuilder" as ActiveView },
        { label: "View results", view: "results" as ActiveView, tab: "queried" as ResultTabKey },
      ],
    };
  };

  const renderHumanInsightBackButton = () =>
    humanIntent && humanInsightBackTarget ? (
      <button type="button" className="human-insight-back-button" onClick={returnToHumanInsight}>
        Back to insight
      </button>
    ) : null;

  const renderHumanAnalyzeStageHeader = () => {
    if (humanAnalyzeStage !== "review") return null;

    return (
      <section className="human-analyze-stage-header" aria-label="Query Builder review stage">
        <div>
          <p className="section-label">Query Builder Review</p>
          <h2>Review query setup</h2>
          <p>Review the setup before running. Nothing runs until you click Run query.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setHumanAnalyzeStage("investigate")}
        >
          Back to question
        </button>
      </section>
    );
  };

  const renderHumanIntentGuidance = () => {
    if (!humanIntent) return null;

    const guidance = humanIntentGuidance[humanIntent];
    const insight = createHumanInsight(humanIntent);

    return (
      <section className="human-intent-panel human-insight-panel" aria-label="Human Mode insight output">
        <div className="human-insight-header">
          <div>
            <p className="section-label">Guided insight</p>
            <h2>You selected: {insight.title}</h2>
          </div>
          <span>{workspaceMode === "human" ? "Human Mode" : "Guidance"}</span>
        </div>
        <p>
          <strong>Next step</strong> {guidance.nextStep}
        </p>
        <p>{insight.explanation}</p>
        <div className="human-insight-metrics">
          {insight.metrics.slice(0, 4).map((metric) => (
            <div key={`${metric.label}-${metric.value}`}>
              <span>{metric.label}</span>
              <strong title={metric.value}>{metric.value}</strong>
            </div>
          ))}
        </div>
        <div className="human-insight-actions">
          <span>Go to</span>
          {insight.actions.map((action) => (
            <button
              type="button"
              className="secondary-button"
              key={`${action.view}-${action.label}`}
              onClick={() => navigateHumanInsightAction(action.view, action.tab)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    );
  };

  useEffect(() => {
    if (activeView === "welcome" && shouldOpenFilePicker) {
      sidebarFileInputRef.current?.click();
      setShouldOpenFilePicker(false);
    }
  }, [activeView, setShouldOpenFilePicker, shouldOpenFilePicker]);

  const renderNoDatasetView = () => (
    <section className="empty-state">
      <p className="section-label">Start investigation</p>
      <h2>Choose a file to look for business signals.</h2>
    </section>
  );

  const renderResultsInvestigationSurface = () => {
    if (!activeResultModel) return null;

    return (
      <ResultsInvestigationSurface
        activeResultModel={activeResultModel}
        activeResultTab={activeResultTab}
        workspaceMode={workspaceMode}
        investigationReport={investigationReport}
        analysisPackagePlan={analysisPackagePlan}
        investigationWorkspacePlan={investigationWorkspacePlan}
        narrativeReport={narrativeReport}
        preparedQuestionContext={
          activeResultTab === "queried" && activeResultModel.sourceType === "query"
            ? executedPreparedQuestionContext
            : null
        }
      />
    );
  };

  const renderActiveResultPanel = () => {
    if (!activeResultModel) return null;

    return (
      <>
        {renderResultsInvestigationSurface()}
        <ResultsGrid
          title={
            activeResultModel.sourceType === "query"
              ? "Query results"
              : activeResultModel.sourceType === "filtered"
                ? "Filtered results"
                : "Preview"
          }
          label="Results"
          activeResultModel={activeResultModel}
          loading={isFiltering || isRunningQuery}
          activeSortColumn={activeResultModel.sorting.column}
          activeSortDirection={activeResultModel.sorting.direction}
          hiddenColumns={resultHiddenColumns}
          emptyTitle="No findings yet."
          emptyDescription="Choose an investigation or shape a business question to create findings."
          onHiddenColumnsChange={setResultHiddenColumns}
          onSortColumn={sortWorkspaceColumn}
          onPageChange={changeWorkspacePage}
          onRowsPerPageChange={changeWorkspaceRowsPerPage}
          toolbarActions={
            <div className="workspace-actions">
              <ResultTabs
                activeTab={activeResultTab}
                hasFilteredResults={hasFilteredResults}
                hasQueryResults={hasQueryResults}
                onTabChange={handleResultTabChange}
              />
              <button type="button" className="secondary-button" onClick={exportCurrentResults}>
                {isExporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          }
        />
      </>
    );
  };

  const renderInlineInvestigateFilters = () => {
    if (!dataset) return null;

    return (
      <details className="investigate-inline-filters">
        <summary>
          <span>
            <strong>Filters</strong>
            <small>Narrow the answer before running the query.</small>
          </span>
          <em>{activeFilterLabels.length.toLocaleString()} active</em>
        </summary>
        <DynamicFiltersPanel
          schema={dataset.schema}
          filterValues={filterValues}
          applying={isFiltering}
          workspaceMode={workspaceMode}
          investigationReport={investigationReport}
          errorMessage={errorMessage}
          onFilterChange={updateFilter}
          onApplyFilters={applyFilters}
          onResetFilters={resetFilters}
        />
      </details>
    );
  };

  const renderInvestigateAnswerPanel = () => {
    if (!hasQueryResults || !activeResultModel) return null;

    return (
      <section className="investigate-answer-section" aria-label="Answer from this run">
        <div className="investigate-answer-header">
          <div>
            <p className="section-label">Answer</p>
            <h2>Answer from this run</h2>
            <p>Review the takeaway, evidence, and result table from the question you just ran.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsInvestigateHistoryOpen((currentValue) => !currentValue)}
            aria-expanded={isInvestigateHistoryOpen}
          >
            History
          </button>
        </div>
        {isInvestigateHistoryOpen && (
          <section className="investigate-history-panel" aria-label="Recent run history">
            <div className="investigate-history-copy">
              <p className="section-label">History</p>
              <h3>Recent runs</h3>
              <p>Review recent runs from this workspace.</p>
            </div>
            <QueryHistoryPanel history={queryHistory} />
          </section>
        )}
        <div className="results-workspace">
          {renderActiveResultPanel()}
        </div>
      </section>
    );
  };

  const humanViewRegistry: Partial<Record<ActiveView, () => ReactNode>> = {
    welcome: () => (
      <UploadPanel
        ref={sidebarFileInputRef}
        uploading={isUploading}
        errorMessage={errorMessage}
        selectedFileName={selectedFileName}
        buttonLabel="Choose file"
        context="Start with data"
        dataset={dataset}
        recentDatasets={recentDatasets}
        continueLabel={activeResultModel ? "Review results" : "Review data"}
        onFileChange={handleFileUpload}
        onContinue={() => updateDatasetSessionView(activeResultModel ? "results" : "dataset")}
        onRecentDatasetClick={activateRecentDataset}
      />
    ),
    dataset: () =>
      (
        <>
          {renderHumanInsightBackButton()}
          <DatasetSummaryPanel
            dataset={dataset}
            recentDatasets={recentDatasets}
            onOpenDataset={openDatasetPicker}
            onViewPreview={() => {
              handleResultTabChange("preview");
              updateDatasetSessionView("results");
            }}
            onHumanIntentSelect={selectHumanIntent}
            onActivateRecentDataset={activateRecentDataset}
            onRemoveRecentDataset={removeRecentDatasetWithConfirmation}
            onClearCurrentDataset={clearCurrentDatasetSession}
            onDeleteDataset={confirmFutureDatasetDelete}
            onWorksheetSelect={handleWorksheetSelect}
            isSwitchingWorksheet={isSwitchingWorksheet}
            onPreviewBackToCleanPrepare={returnToCleanPrepare}
            selectedTaskId={runtimePersistence.selectedTaskId}
            onSelectedTaskIdChange={(selectedTaskId) =>
              setRuntimePersistence((currentState) => ({
                ...currentState,
                selectedTaskId,
              }))
            }
          />
        </>
      ),
    filters: () =>
      dataset ? (
        <>
          {renderHumanInsightBackButton()}
          <DynamicFiltersPanel
            schema={dataset.schema}
            filterValues={filterValues}
            applying={isFiltering}
            workspaceMode={workspaceMode}
            investigationReport={investigationReport}
            errorMessage={errorMessage}
            onFilterChange={updateFilter}
            onApplyFilters={applyFilters}
            onResetFilters={resetFilters}
          />
        </>
      ) : null,
    queryBuilder: () =>
      dataset ? (
        <>
          {/*
            E-1: Three-Room state machine marker. No layout impact (hidden span).
            Future E-2/E-3/E-4 work will conditionally render Compose/Refine/Answer
            sections based on currentExploreRoom; for E-1 this is observational
            only and the existing humanAnalyzeStage gating below is unchanged.
          */}
          <span
            hidden
            aria-hidden="true"
            data-explore-room={currentExploreRoom}
            data-explore-room-active-compose={isExploreComposeRoom ? "true" : "false"}
            data-explore-room-active-refine={isExploreRefineRoom ? "true" : "false"}
            data-explore-room-active-answer={isExploreAnswerRoom ? "true" : "false"}
          />
          {renderHumanInsightBackButton()}
          {renderHumanIntentGuidance()}

          {/*
            E-2: Compose room visibility gate. When isExploreComposeRoom is
            true we show the calm composer. The legacy stacks below are kept
            mounted (via the hidden attribute) so their internal state
            survives the room flip — this is the same pattern the existing
            humanAnalyzeStage gating uses on QuestionWorkspacePanel and
            VisualQueryBuilderPanel. No existing component is deleted.
          */}
          <div hidden={!isExploreComposeRoom}>
            <ExploreComposeRoom
              question={exploreComposeQuestion}
              activeScopeLabel={exploreComposeActiveScopeLabel}
              starterPrompts={exploreComposeStarterPrompts}
              canAsk={exploreComposeCanAsk}
              isAskDisabledReason={exploreComposeAskDisabledReason}
              onQuestionChange={setExploreComposeQuestion}
              onAsk={handleExploreComposeAsk}
              onContinueInAnalyst={handleContinueInAnalyst}
            />
          </div>

          {/*
            E-3 (corrected): Refine room is the non-execution Recommended
            path preview. No Run Query here, no advanced-builder disclosure,
            no VisualQueryBuilderPanel on this canvas. The primary action is
            Continue in Analyst — which routes to the existing Analyst SQL
            workspace where Run Query already lives.
          */}
          <div hidden={!isExploreRefineRoom}>
            <ExploreRefineRoom
              question={exploreComposeQuestion}
              activeScopeLabel={exploreComposeActiveScopeLabel}
              setupRows={exploreRefineSetupRows}
              readinessLabel="Preview · build in Analyst"
              canContinueInAnalyst={exploreRefineCanContinueInAnalyst}
              continueDisabledReason={exploreRefineContinueDisabledReason}
              onEditQuestion={handleExploreRefineEditQuestion}
              onContinueInAnalyst={handleContinueInAnalyst}
            />
          </div>

          {/*
            Legacy review stack. Hidden when in compose or refine — Explore
            is no longer an execution surface. The stack remains mounted so
            answer-room state (after a Human Mode Run Query from anywhere
            else in the existing fallback views) keeps working without
            changes. Nothing inside the stack is reachable from Compose or
            Refine in the corrected flow.
          */}
          <div hidden={isExploreComposeRoom || isExploreRefineRoom}>
          <div hidden={humanAnalyzeStage !== "investigate"}>
            <QuestionWorkspacePanel
              dataset={dataset}
              sourceName={
                activeWorkbookWorksheet?.displayName ||
                activeWorkbookWorksheet?.sheetName ||
                dataset.table_name
              }
              onApplyQueryBuilderRequestDraft={applyGovernedQueryBuilderRequestForReview}
              onAnalysisSourceSelect={handleAnalysisSourceSelect}
              onPreviewDataset={openDatasetPreview}
              cleanPrepareRestoreContext={cleanPrepareRestoreContext}
              onCleanPrepareRestoreConsumed={consumeCleanPrepareRestoreContext}
            />
          </div>
          <div hidden={humanAnalyzeStage !== "review"}>
            {renderHumanAnalyzeStageHeader()}
            {renderInlineInvestigateFilters()}
            <VisualQueryBuilderPanel
              schema={dataset.schema}
              datasetName={dataset.original_filename}
              worksheetName={
                activeWorkbookWorksheet?.displayName ||
                activeWorkbookWorksheet?.sheetName ||
                dataset.table_name
              }
              activeFilterCount={activeFilterLabels.length}
              workspaceMode={workspaceMode}
              investigationReport={investigationReport}
              analysisPackagePlan={analysisPackagePlan}
              investigationWorkspacePlan={investigationWorkspacePlan}
              selectedColumns={querySelectedColumns}
              groupBy={queryGroupBy}
              aggregations={queryAggregations}
              sortOptions={querySortOptions}
              sortColumn={querySortColumn}
              sortDirection={querySortDirection}
              rowLimit={queryLimit}
              running={isRunningQuery}
              errorMessage={errorMessage}
              reviewNotice={queryBuilderReviewNotice}
              onToggleSelectedColumn={(column) =>
                setQuerySelectedColumns((currentColumns) => toggleListValue(currentColumns, column))
              }
              onSelectedColumnsChange={setQuerySelectedColumns}
              onGroupByChange={setQueryGroupBy}
              onAddAggregation={addAggregation}
              onUpdateAggregation={updateAggregation}
              onRemoveAggregation={removeAggregation}
              onSortColumnChange={setQuerySortColumn}
              onSortDirectionChange={setQuerySortDirection}
              onRowLimitChange={setQueryLimit}
              onRunQuery={runReviewedQueryBuilder}
            />
          </div>
          {renderInvestigateAnswerPanel()}
          </div>
        </>
      ) : null,
    results: () =>
      dataset ? (
        <>
          {renderHumanInsightBackButton()}
          {renderHumanIntentGuidance()}
          <section className="results-workspace" aria-label="Data exploration workspace">
            {renderActiveResultPanel()}
          </section>
        </>
      ) : null,
    history: () =>
      dataset ? <QueryHistoryPanel history={queryHistory} variant="standalone" /> : null,
    export: () =>
      dataset ? (
        <section className="export-panel standalone-panel">
          <div>
            <p className="section-label">Export</p>
            <h2>Export</h2>
            <p>
              {activeResultTab === "queried" ? "Query result" : activeResultTab} CSV.
            </p>
          </div>
          <button type="button" className="primary-button" onClick={exportCurrentResults}>
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </section>
      ) : null,
    settings: () => (
      <section className="settings-panel standalone-panel">
        <div>
          <p className="section-label">System</p>
          <h2>Settings</h2>
          <p>Preferences and system choices live here, separate from the active investigation.</p>
          <div className="settings-section-list" aria-label="Settings sections">
            <span>
              <strong>Workspace preferences</strong>
              <small>Default mode, navigation, and display choices.</small>
            </span>
            <span>
              <strong>Data handling</strong>
              <small>Session cleanup and dataset history controls.</small>
            </span>
            <span>
              <strong>Exports</strong>
              <small>Download defaults and result delivery options.</small>
            </span>
            <span>
              <strong>Analyst workspace</strong>
              <small>SQL inspection, schema display, and saved draft preferences.</small>
            </span>
            <span>
              <strong>Help and governance</strong>
              <small>Product guidance, review posture, and audit visibility.</small>
            </span>
          </div>
        </div>
      </section>
    ),
  };

  const analystViewRegistry = createAnalystWorkspaceRenderers(analystWorkspaceRegistry, {
    dataset,
    sqlWorkspaceMetadata,
    onSqlWorkspaceMetadataChange: setSqlWorkspaceMetadata,
    onWorksheetSelect: handleWorksheetSelect,
    isSwitchingWorksheet,
    onAnalystViewChange: (view) => {
      setWorkspaceMode("analyst");
      updateDatasetSessionView(view);
    },
    requestedSqlAssistantMode,
    onSqlAssistantModeChange: setRequestedSqlAssistantMode,

    onExecutionResult: (executionResult) => {
      const coordinationResult = coordinateExecutionResult({
        executionResult,
        resultTab: "sql",
        hiddenColumns: [],
        recordExecutionResult,
      });
      attachExecutionToActiveDataset(
        coordinationResult.record.executionId,
        coordinationResult.record.datasetId,
      );
    },
  });

  const workspaceViewRegistry: Partial<Record<ActiveView, () => ReactNode>> = {
    ...humanViewRegistry,
    ...analystViewRegistry,
  };

  const renderWorkspaceView = () => {
    const renderActiveView = workspaceViewRegistry[activeView];

    return (
      <>
        {!dataset && activeView !== "welcome" && activeView !== "dataset" && renderNoDatasetView()}
        {renderActiveView?.()}
      </>
    );
  };

  const hasWorkbookMetadata = Boolean(dataset?.workbook_metadata);
  const hasSqlResult =
    activeView === "sqlWorkspace" &&
    executionRegistry.records.some(
      (record) =>
        record.datasetId === dataset?.dataset_id &&
        record.source === "sql" &&
        record.status === "success" &&
        record.visibleColumns.length > 0,
    );
  const canExportActiveResult = Boolean(
    dataset && activeResultModel && activeResultModel.export.rowCount > 0,
  );
  const commandItems = useMemo<CommandLauncherItem[]>(() => {
    const commands: CommandLauncherItem[] = [
      {
        id: "nav:data",
        title: "Open Data",
        description: dataset ? "Review the active dataset workspace." : "Open the Data workspace.",
        category: "Navigation",
        keywords: ["dataset", "table", "workbook"],
        onRun: () => openDataCommand(),
      },
      {
        id: "nav:analyze",
        title: "Open Explore",
        description: "Ask questions, refine setup, and review answers in one workspace.",
        category: "Navigation",
        keywords: ["explore", "investigate", "questions", "guided"],
        onRun: () => openHumanView("queryBuilder"),
      },
      {
        id: "nav:insights",
        title: "Open Insights",
        description: "Review the current result and investigation surface.",
        category: "Navigation",
        keywords: ["results", "preview", "investigation"],
        onRun: () => openHumanView("results"),
      },
      {
        id: "nav:analyst",
        title: "Open Analyst",
        description: "Open the Analyst SQL workspace.",
        category: "Navigation",
        keywords: ["sql", "monaco", "analyst"],
        onRun: () => openAnalystCommand("editor"),
      },
    ];

    if (dataset) {
      commands.push(
        {
          id: "data:preview",
          title: "Preview Dataset",
          description: "Open the focused Data Preview surface.",
          category: "Data",
          keywords: ["sample", "rows", "table"],
          onRun: () => openDataCommand("preview"),
        },
        {
          id: "data:intelligence",
          title: "What the Data Suggests",
          description: "Review business signals in the active dataset.",
          category: "Data",
          keywords: ["noticed", "understanding", "fields"],
          onRun: () => openDataCommand("intelligenceDetail"),
        },
        {
          id: "data:semantics",
          title: "Open Business Meaning",
          description: "Review what the active dataset may represent.",
          category: "Data",
          keywords: ["business fields", "meaning", "kpi"],
          onRun: () => openDataCommand("semantics"),
        },
      );

      if (hasWorkbookMetadata) {
        commands.push(
          {
            id: "data:worksheet-preview",
            title: "Preview Source Areas",
            description: "Review the available business areas in the Data Preview surface.",
            category: "Data",
            keywords: ["sheet", "excel", "workbook"],
            onRun: () => openDataCommand("worksheetPreview"),
          },
          {
            id: "data:connections",
            title: "Review Connected Operations",
            description: "See how business areas may interact operationally.",
            category: "Data",
            keywords: ["relationships", "joins", "workbook"],
            onRun: () => openDataCommand("connections"),
          },
        );
      }
    }

    commands.push(
      {
        id: "analyst:sql",
        title: "Open Inspect SQL",
        description: "Write and run SELECT-only SQL against the active dataset.",
        category: "Analyst",
        keywords: ["sql", "duckdb", "monaco"],
        onRun: () => openAnalystCommand("editor"),
      },
      {
        id: "analyst:templates",
        title: "Browse SQL Templates",
        description: "Open deterministic SQL templates and Complex SQL Assist.",
        category: "Analyst",
        keywords: ["template", "pattern", "complex sql assist"],
        onRun: () => {
          setWorkspaceMode("analyst");
          setRequestedSqlAssistantMode("templates");
          updateDatasetSessionView("sqlTemplates");
        },
      },
      {
        id: "analyst:reports",
        title: "Browse Report Recipes",
        description: "Open deterministic report recipes and local AI preview suggestions.",
        category: "Analyst",
        keywords: ["reports", "recipes", "ai preview"],
        onRun: () => {
          setWorkspaceMode("analyst");
          setRequestedSqlAssistantMode("recipes");
          updateDatasetSessionView("sqlReports");
        },
      },
      {
        id: "analyst:drafts",
        title: "Open Saved Drafts",
        description: "Manage saved SQL queries.",
        category: "Analyst",
        keywords: ["saved queries", "snippets", "drafts"],
        onRun: () => openAnalystCommand("drafts"),
      },
    );

    if (hasSqlResult) {
      commands.push({
        id: "analyst:result-preview",
        title: "Open Result Preview",
        description: "Open the latest SQL result preview.",
        category: "Analyst",
        keywords: ["sql result", "preview", "rows"],
        onRun: () => openAnalystCommand("result"),
      });
    }

    commands.push(
      {
        id: "workflow:query-builder",
        title: "Explore a Question",
        description: "Shape a business question with fields, groups, and filters.",
        category: "Explore",
        keywords: ["explore", "investigate", "question", "builder"],
        disabled: !dataset,
        disabledReason: "Open data first",
        onRun: () => openHumanView("queryBuilder"),
      },
      {
        id: "workflow:guided-analysis",
        title: "Start Suggested Exploration",
        description: "Review a suggested business direction for the active dataset.",
        category: "Explore",
        keywords: ["human mode", "opportunity", "guided"],
        disabled: !dataset,
        disabledReason: "Open data first",
        onRun: () => selectHumanIntent("summary"),
      },
      {
        id: "workflow:export-active-result",
        title: "Export Active Result",
        description: "Export the current Human Mode result when export is supported.",
        category: "Actions",
        keywords: ["csv", "download", "results"],
        disabled: !canExportActiveResult || isExporting,
        disabledReason: isExporting ? "Exporting" : "No exportable result",
        onRun: exportCurrentResults,
      },
    );

    return commands;
  }, [
    activeView,
    activeResultModel,
    canExportActiveResult,
    dataset,
    executionRegistry.records,
    hasSqlResult,
    hasWorkbookMetadata,
    isExporting,
  ]);

  return (
    <WorkspaceShell
      activeView={activeView}
      workspaceMode={workspaceMode}
      dataset={dataset}
      recentDatasets={recentDatasets}
      analystViews={analystNavItems}
      errorMessage={errorMessage}
      runtimeContext={workspaceRuntimeContext}
      isRuntimePanelCollapsed={runtimePersistence.isRuntimePanelCollapsed}
      commandItems={commandItems}
      onOpenFile={() => {
        openDatasetPicker();
      }}
      onViewChange={handleWorkspaceViewChange}
      onDataQualityNavigate={handleDataQualityNavigate}
      onModeChange={(mode) => {
        setWorkspaceMode(mode);
        if (mode === "human") setHumanAnalyzeStage("investigate");
        updateDatasetSessionView(mode === "human" ? (dataset ? "results" : "welcome") : "sqlWorkspace");
      }}
      onRecentDatasetClick={activateRecentDataset}
      onRuntimePanelToggle={onRuntimePanelToggle}
      onRuntimeTrailSelect={handleRuntimeTrailSelect}
    >
      {renderWorkspaceView()}
    </WorkspaceShell>
  );
}

export default App;
