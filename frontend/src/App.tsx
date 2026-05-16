import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import DatasetSummaryPanel, {
  DatasetSessionPanel,
  type HumanIntent,
} from "./components/dataset/DatasetSummaryPanel";
import DynamicFiltersPanel from "./components/filters/DynamicFiltersPanel";
import QueryHistoryPanel from "./components/history/QueryHistoryPanel";
import WorkspaceShell from "./components/layout/WorkspaceShell";
import WorkspaceSplitPane from "./components/layout/WorkspaceSplitPane";
import VisualQueryBuilderPanel from "./components/query-builder/VisualQueryBuilderPanel";
import ResultTabs from "./components/results/ResultTabs";
import ResultsGrid from "./components/results/ResultsGrid";
import UploadPanel from "./components/upload/UploadPanel";
import {
  createAnalystNavItems,
  createAnalystWorkspaceRenderers,
} from "./features/analyst/analystWorkspaceHelpers";
import { analystWorkspaceRegistry } from "./features/analyst/analystWorkspaceRegistry";
import { buildAnalysisPackagePlan } from "./features/analysisPackages";
import type {
  ActiveView,
} from "./features/dataset/datasetTypes";
import { executeWorkspaceQuery } from "./features/execution/executeWorkspaceQuery";
import useExecutionRegistry from "./features/execution/executionRegistry";
import useWorkspaceDatasetController from "./features/dataset/useWorkspaceDatasetController";
import useExportController from "./features/export/useExportController";
import useFilterController from "./features/filters/useFilterController";
import useQueryHistory from "./features/history/useQueryHistory";
import { buildInvestigationReport } from "./features/investigationIntelligence";
import useQueryBuilderController from "./features/query-builder/useQueryBuilderController";
import type { ResultState, ResultTabKey } from "./features/results/resultTypes";
import {
  createQueryBuilderSnapshot,
  coordinateExecutionResult,
} from "./features/workspace/workspaceOrchestration";
import useWorkspaceOrchestrationSnapshot from "./features/workspace/useWorkspaceOrchestrationSnapshot";
import {
  buildWorkspaceRuntimeContext,
  createRuntimeNavigationSelection,
  getContextualObjectIdForView,
  loadRuntimePersistenceState,
  saveRuntimePersistenceState,
} from "./features/workspaceRuntime";
import type { WorkspaceExecutionResult } from "./features/execution/workspaceExecutionTypes";
import useActiveResultModel, {
  getCurrentPageMetadata,
  getCurrentRowCount,
} from "./features/results/activeResultModel";
import useResults, { createEmptyResultState } from "./features/results/useResults";
import "./App.css";

const analystNavItems = createAnalystNavItems(analystWorkspaceRegistry);

const humanIntentGuidance: Record<
  HumanIntent,
  {
    label: string;
    route: ActiveView;
    nextStep: string;
    detail: string;
  }
> = {
  summary: {
    label: "Summarize",
    route: "results",
    nextStep: "Review rows, columns, and preview.",
    detail: "Start with rows, columns, and preview.",
  },
  missing_values: {
    label: "Missing values",
    route: "queryBuilder",
    nextStep: "Choose columns.",
    detail: "Check columns with empty values.",
  },
  top_categories: {
    label: "Top categories",
    route: "queryBuilder",
    nextStep: "Group a category.",
    detail: "Count the biggest groups.",
  },
  compare_columns: {
    label: "Compare fields",
    route: "queryBuilder",
    nextStep: "Choose two columns.",
    detail: "View fields side by side.",
  },
  trends: {
    label: "Trend analysis",
    route: "queryBuilder",
    nextStep: "Choose time and value.",
    detail: "Summarize change over time.",
  },
  unusual_values: {
    label: "Unusual values",
    route: "results",
    nextStep: "Sort rows.",
    detail: "Look for highs, lows, and surprises.",
  },
  simple_chart: {
    label: "Visualize data",
    route: "queryBuilder",
    nextStep: "Build a small summary.",
    detail: "Prepare grouped chart data.",
  },
};

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
  const [isFiltering, setIsFiltering] = useState(false);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const { queryHistory, setQueryHistory, addHistory, clearHistory } = useQueryHistory();
  const [errorMessage, setErrorMessage] = useState("");
  const [humanIntent, setHumanIntent] = useState<HumanIntent | null>(null);
  const [humanInsightBackTarget, setHumanInsightBackTarget] = useState<{
    view: ActiveView;
    tab: ResultTabKey;
  } | null>(null);
  const [isResultsContextCollapsed, setIsResultsContextCollapsed] = useState(true);
  const [runtimePersistence, setRuntimePersistence] = useState(loadRuntimePersistenceState);
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
  const createOrderBy = (column: string, direction: ResultState["sortDirection"]) =>
    column ? { column, direction } : null;
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
    handleRelationshipReview,
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
  const buildActiveBackendFilters = () => buildBackendFilters(dataset);
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
  const investigationReport = useMemo(
    () => buildInvestigationReport({ dataset, activeResultModel }),
    [activeResultModel, dataset],
  );
  const analysisPackagePlan = useMemo(
    () =>
      buildAnalysisPackagePlan({
        dataset,
        activeResultModel,
        investigationReport,
        queryHistory,
        sourceMode: workspaceMode,
      }),
    [activeResultModel, dataset, investigationReport, queryHistory, workspaceMode],
  );
  const queryBuilderRuntimeSnapshot = useMemo(
    () =>
      createQueryBuilderSnapshot({
        selectedColumns: querySelectedColumns,
        groupBy: queryGroupBy,
        aggregations: queryAggregations,
        sortColumn: querySortColumn,
        sortDirection: querySortDirection,
        limit: queryLimit,
        hasRunQuery,
        latestRequest: activeResult.source?.queryBuilder || null,
      }),
    [
      activeResult.source?.queryBuilder,
      hasRunQuery,
      queryAggregations,
      queryGroupBy,
      queryLimit,
      querySelectedColumns,
      querySortColumn,
      querySortDirection,
    ],
  );
  useWorkspaceOrchestrationSnapshot({
    dataset,
    recentDatasets,
    activeResultTab,
    activeResult,
    activeResultModel,
    executionRegistry,
    datasetRegistry,
    mode: workspaceMode,
    activeFilters,
    sorting: activeResult.sortColumn
      ? {
          column: activeResult.sortColumn,
          direction: activeResult.sortDirection,
        }
      : null,
    grouping: activeResultModel?.grouping.columns || queryGroupBy,
    querySelectedColumns,
    queryGroupBy,
    queryAggregations,
    querySortColumn,
    querySortDirection,
    queryLimit,
    hasRunQuery,
    latestQueryRequest: activeResult.source?.queryBuilder || null,
  });
  const workspaceRuntimeContext = useMemo(
    () =>
      buildWorkspaceRuntimeContext({
        dataset,
        mode: workspaceMode,
        activeView,
        activeResultTab,
        activeResultModel,
        queryBuilder: queryBuilderRuntimeSnapshot,
        sqlWorkspaceMetadata,
        executionRegistry,
        humanIntentLabel: humanIntent ? humanIntentGuidance[humanIntent].label : null,
        selectedTrailItemId: runtimePersistence.selectedTrailItemId,
        selectedContextualObjectId: runtimePersistence.selectedContextualObjectId,
        returnContinuationId: runtimePersistence.returnContinuationId,
      }),
    [
      activeResultModel,
      activeResultTab,
      activeView,
      dataset,
      executionRegistry,
      humanIntent,
      queryBuilderRuntimeSnapshot,
      runtimePersistence.selectedTrailItemId,
      runtimePersistence.selectedContextualObjectId,
      runtimePersistence.returnContinuationId,
      sqlWorkspaceMetadata,
      workspaceMode,
    ],
  );

  const schemaTypeSummary = dataset
    ? dataset.schema.reduce<Record<string, number>>((summary, column) => {
        summary[column.inferred_type] = (summary[column.inferred_type] || 0) + 1;
        return summary;
      }, {})
    : {};

  const hasQueryResults = queriedResult.columns.length > 0 || hasRunQuery;

  const handleResultTabChange = (tab: ResultTabKey) => {
    setActiveResultTab(tab);
    updateDatasetSessionResultTab(tab);
  };

  const activateResultTab = (tab: ResultTabKey) => {
    handleResultTabChange(tab);
    updateDatasetSessionView("results");
  };

  const updatePreviewResult = (nextResult: ResultState, shouldActivate = false) => {
    setPreviewResult(nextResult);
    if (shouldActivate) activateResultTab("preview");
  };

  const updateFilteredResult = (nextResult: ResultState, shouldActivate = false) => {
    setFilteredResult(nextResult);
    if (shouldActivate) activateResultTab("filtered");
  };

  const updateQueriedResult = (nextResult: ResultState, shouldActivate = false) => {
    setQueriedResult(nextResult);
    if (shouldActivate) activateResultTab("queried");
  };

  const coordinateActiveExecution = (
    executionResult: WorkspaceExecutionResult,
    resultTab: ResultTabKey,
    updateActiveResult: (nextResult: ResultState, shouldActivate?: boolean) => void,
    shouldActivate = false,
  ) =>
    {
      const coordinationResult = coordinateExecutionResult({
      executionResult,
      resultTab,
      hiddenColumns: resultHiddenColumns,
      recordExecutionResult,
      updateActiveResult,
      shouldActivate,
      });
      attachExecutionToActiveDataset(
        coordinationResult.record.executionId,
        coordinationResult.record.datasetId,
      );
      attachActiveResultToActiveDataset(resultTab, coordinationResult.record.datasetId);
      return coordinationResult;
    };

  const applyFilters = async () => {
    if (!dataset) return;

    setIsFiltering(true);
    setErrorMessage("");

    try {
      const filters = buildActiveBackendFilters();
      const filterLabels = createFilterLabels(filters);
      const orderBy = createOrderBy(filteredResult.sortColumn, filteredResult.sortDirection);
      const executionResult = await executeWorkspaceQuery({
        source: "filtered",
        dataset,
        filters,
        sorting: orderBy,
        pagination: {
          page: 1,
          rowsPerPage: filteredResult.rowsPerPage,
        },
      });
      coordinateActiveExecution(executionResult, "filtered", updateFilteredResult, true);
      addHistory(
        "Filters",
        filterLabels.length > 0 ? filterLabels.join("; ") : "No filters",
        executionResult.pagination.totalCount,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not apply those filters. Please try again.";

      setErrorMessage(message);
    } finally {
      setIsFiltering(false);
    }
  };

  const resetFilters = async () => {
    setFilterValues({});

    if (!dataset) return;

    setIsFiltering(true);
    setErrorMessage("");

    try {
      const executionResult = await executeWorkspaceQuery({
        source: "preview",
        dataset,
        filters: [],
        sorting: null,
        pagination: {
          page: 1,
          rowsPerPage: previewResult.rowsPerPage,
        },
      });
      coordinateActiveExecution(executionResult, "preview", updatePreviewResult, true);
      setFilteredResult(createEmptyResultState());
      addHistory("Reset", "Cleared all filters", executionResult.pagination.totalCount);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not reset the filters. Please try again.";

      setErrorMessage(message);
    } finally {
      setIsFiltering(false);
    }
  };

  const loadPreviewPage = async (
    page: number,
    rowsPerPage = activeResult.rowsPerPage,
    sortColumn = activeResult.sortColumn,
    sortDirection = activeResult.sortDirection,
  ) => {
    if (!dataset) return;

    setIsFiltering(true);
    setErrorMessage("");

    try {
      const filters =
        activeResultTab === "filtered"
          ? activeResult.source?.filters || buildActiveBackendFilters()
          : [];
      const orderBy = createOrderBy(sortColumn, sortDirection);
      const executionResult = await executeWorkspaceQuery({
        source: activeResultTab === "filtered" ? "filtered" : "preview",
        dataset,
        filters,
        sorting: orderBy,
        pagination: {
          page,
          rowsPerPage,
        },
      });
      if (activeResultTab === "filtered") {
        coordinateActiveExecution(executionResult, "filtered", updateFilteredResult);
      } else {
        coordinateActiveExecution(executionResult, "preview", updatePreviewResult);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not load that page. Please try again.";

      setErrorMessage(message);
    } finally {
      setIsFiltering(false);
    }
  };

  const runVisualQuery = async () => {
    if (!dataset) return;

    setIsRunningQuery(true);
    setErrorMessage("");
    setHasRunQuery(true);

    try {
      const filters = buildActiveBackendFilters();
      const orderBy = createOrderBy(querySortColumn, querySortDirection);
      const queryBuilderRequest = {
        selected_columns: activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns,
        group_by: queryGroupBy,
        aggregations: activeAggregations.map((aggregation) => ({
          function: aggregation.function,
          column: aggregation.column || null,
        })),
        filters,
        order_by: orderBy,
        limit: Number(queryLimit) || queriedResult.rowsPerPage,
        page: 1,
      };
      const executionResult = await executeWorkspaceQuery({
        source: "query-builder",
        dataset,
        filters,
        queryBuilder: queryBuilderRequest,
        sorting: orderBy,
        grouping: queryGroupBy,
        pagination: {
          page: 1,
          rowsPerPage: queryBuilderRequest.limit,
        },
      });
      coordinateActiveExecution(executionResult, "queried", updateQueriedResult, true);
      addHistory(
        "Query builder",
        activeAggregations.length > 0
          ? `${activeAggregations.length} aggregation${activeAggregations.length === 1 ? "" : "s"}`
          : `${querySelectedColumns.length} visible columns`,
        executionResult.pagination.totalCount,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not run that query. Please adjust the builder and try again.";

      setErrorMessage(message);
    } finally {
      setIsRunningQuery(false);
    }
  };

  const loadQueryPage = async (
    page: number,
    rowsPerPage = queriedResult.rowsPerPage,
    sortColumn = queriedResult.sortColumn,
    sortDirection = queriedResult.sortDirection,
  ) => {
    if (!dataset) return;

    setIsRunningQuery(true);
    setErrorMessage("");
    setHasRunQuery(true);

    try {
      const sourceQuery = queriedResult.source?.queryBuilder;
      const filters = queriedResult.source?.filters || buildActiveBackendFilters();
      const orderBy = createOrderBy(sortColumn, sortDirection);
      const queryBuilderRequest = {
        selected_columns:
          sourceQuery?.selected_columns ||
          (activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns),
        group_by: sourceQuery?.group_by || queryGroupBy,
        aggregations:
          sourceQuery?.aggregations ||
          activeAggregations.map((aggregation) => ({
            function: aggregation.function,
            column: aggregation.column || null,
          })),
        filters,
        order_by: orderBy,
        limit: rowsPerPage,
        page,
      };
      const executionResult = await executeWorkspaceQuery({
        source: "query-builder",
        dataset,
        filters,
        queryBuilder: queryBuilderRequest,
        sorting: orderBy,
        grouping: queryBuilderRequest.group_by,
        pagination: {
          page,
          rowsPerPage,
        },
      });
      coordinateActiveExecution(executionResult, "queried", updateQueriedResult);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not load that query page. Please try again.";

      setErrorMessage(message);
    } finally {
      setIsRunningQuery(false);
    }
  };

  const exportCurrentResults = async () => {
    setErrorMessage("");
    const exportError = await runExportCurrentResults();
    if (exportError) setErrorMessage(exportError);
  };

  const sortWorkspaceColumn = (column: string) => {
    if (activeResultTab === "queried") {
      const nextDirection =
        queriedResult.sortColumn === column && queriedResult.sortDirection === "ASC" ? "DESC" : "ASC";
      setQuerySortColumn(column);
      setQuerySortDirection(nextDirection);
      loadQueryPage(1, queriedResult.rowsPerPage, column, nextDirection);
      return;
    }

    const nextDirection =
      activeResult.sortColumn === column && activeResult.sortDirection === "ASC" ? "DESC" : "ASC";
    loadPreviewPage(1, activeResult.rowsPerPage, column, nextDirection);
  };

  const changeWorkspacePage = (page: number) => {
    const { totalPages } = getCurrentPageMetadata(activeResultModel);
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (activeResultTab === "queried") {
      loadQueryPage(nextPage);
      return;
    }

    loadPreviewPage(nextPage);
  };

  const changeWorkspaceRowsPerPage = (rowsPerPage: number) => {
    if (activeResultTab === "queried") {
      setQueryLimit(String(rowsPerPage));
      loadQueryPage(1, rowsPerPage);
      return;
    }

    loadPreviewPage(1, rowsPerPage);
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

    updateDatasetSessionView(guidance.route);
  };

  const navigateHumanInsightAction = (view: ActiveView, tab?: ResultTabKey) => {
    if (view !== activeView) {
      setHumanInsightBackTarget({ view: activeView, tab: activeResultTab });
    }
    if (tab) handleResultTabChange(tab);
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
        explanation: "No dataset open. Choose CSV.",
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
  }, [activeView, shouldOpenFilePicker]);

  useEffect(() => {
    saveRuntimePersistenceState(runtimePersistence);
  }, [runtimePersistence]);

  const renderNoDatasetView = () => (
    <section className="empty-state">
      <p className="section-label">No dataset</p>
      <h2>No dataset open. Choose CSV.</h2>
    </section>
  );

  const renderResultsInvestigationSurface = () => {
    if (!activeResultModel) return null;

    const isAnalystMode = workspaceMode === "analyst";
    const sourceLabel =
      activeResultModel.sourceType === "query"
        ? "Query result"
        : activeResultModel.sourceType === "filtered"
          ? "Filtered result"
          : "Preview result";
    const takeaway =
      activeResultModel.sourceType === "query"
        ? activeResultModel.grouping.hasGrouping
          ? `Grouped result is ready. Compare ${activeResultModel.grouping.columns.join(", ")} before refining or exporting.`
          : "Query output is ready. Review the selected fields before refining or exporting."
        : activeResultModel.sourceType === "filtered"
          ? "Filtered rows are ready. Review what changed before refining or exporting."
          : "Preview rows are ready. Use this pass to understand structure before filtering or grouping.";
    const continuationSuggestion = isAnalystMode
      ? activeResultModel.sourceType === "query"
        ? "Check query context"
        : "Inspect result model"
      : activeResultModel.sourceType === "query"
        ? "Compare groups"
        : activeResultModel.sourceType === "filtered"
          ? "Refine question"
          : "Review what changed";
    const activeSortLabel = activeResultModel.sorting.column
      ? `${activeResultModel.sorting.column} ${activeResultModel.sorting.direction}`
      : "No sort";
    const activeFilterCount = activeResultModel.filters.activeLabels.length;
    const hiddenColumnCount = activeResultModel.columns.length - activeResultModel.visibleColumns.length;
    const topContributorLabel = activeResultModel.grouping.hasGrouping
      ? `Compare by ${activeResultModel.grouping.columns[0]}`
      : activeResultModel.chartReady.groupingCandidates[0]
        ? `Segment by ${activeResultModel.chartReady.groupingCandidates[0].name}`
        : "Choose a category to compare";
    const highlightLabel =
      activeResultModel.insightReady.missingValueCount > 0
        ? `${activeResultModel.insightReady.missingValueColumns.length.toLocaleString()} columns contain empty values`
        : activeResultModel.chartReady.isLargeResult
          ? "Large result; review filters before exporting"
          : activeResultModel.sorting.column
            ? `Sorted by ${activeResultModel.sorting.column}`
            : "No obvious quality flags in this result";
    const chartSupportLabel =
      activeResultModel.chartReady.categoricalColumns.length > 0 &&
      activeResultModel.chartReady.numericColumns.length > 0
        ? "Chart support available"
        : "Table review recommended";
    const resultFollowUps = investigationReport.nextSteps.slice(0, 3);
    const packageArtifacts = analysisPackagePlan.packageManifest.artifactManifest;
    const readyPackageArtifacts = packageArtifacts.filter((artifact) => artifact.readiness === "ready_now");
    const packageRecommendations = analysisPackagePlan.recommendations.slice(0, 4);

    return (
      <section
        className={[
          "results-review-strip",
          isAnalystMode ? "is-analyst-results" : "is-human-results",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Results review context"
      >
        <div className="results-business-takeaway">
          <span>{isAnalystMode ? "Result inspection" : "Business takeaway"}</span>
          <strong>{takeaway}</strong>
          <small>{chartSupportLabel}</small>
        </div>

        <div className="results-insight-row" aria-label="Lightweight result insights">
          <span>
            <small>Top contributor</small>
            <strong>{topContributorLabel}</strong>
          </span>
          <span>
            <small>Highlight</small>
            <strong>{highlightLabel}</strong>
          </span>
          <span>
            <small>Supporting view</small>
            <strong>{chartSupportLabel}</strong>
          </span>
          <span>
            <small>{isAnalystMode ? "Payload" : "Continuation"}</small>
            <strong>{continuationSuggestion}</strong>
          </span>
        </div>

        <div className="results-review-facts" aria-label="Supporting result context">
          <span>
            <small>Source</small>
            <strong>{sourceLabel}</strong>
          </span>
          <span>
            <small>Result rows</small>
            <strong>{activeResultModel.totalCount.toLocaleString()}</strong>
          </span>
          <span>
            <small>Filters / sort</small>
            <strong>
              {activeFilterCount.toLocaleString()} filters / {activeSortLabel}
            </strong>
          </span>
          <span>
            <small>{isAnalystMode ? "Payload" : "Export"}</small>
            <strong>{activeResultModel.export.rowCount > 0 ? "Ready" : "No rows yet"}</strong>
          </span>
        </div>

        {!isAnalystMode && resultFollowUps.length > 0 && (
          <div className="investigation-prompt-row results-follow-up-row" aria-label="Follow-up investigations">
            <span>Follow up</span>
            {resultFollowUps.map((suggestion) => (
              <small key={suggestion.id}>{suggestion.question}</small>
            ))}
          </div>
        )}

        {!isAnalystMode && (
          <div className="analysis-package-panel results-package-panel" aria-label="Analysis package planner">
            <div>
              <span>Analysis package</span>
              <strong>{analysisPackagePlan.readinessSummary.label}</strong>
              <small>{analysisPackagePlan.humanSummary}</small>
            </div>
            <div className="analysis-package-artifacts" aria-label="Suggested package contents">
              <span>
                Ready artifacts
                <strong>{readyPackageArtifacts.length.toLocaleString()}</strong>
              </span>
              {packageRecommendations.slice(0, 3).map((recommendation) => (
                <span key={recommendation.recommendationId}>
                  {recommendation.label}
                  <strong>{recommendation.readiness.replace(/_/g, " ")}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        <details className="results-technical-disclosure">
          <summary>
            <span>{isAnalystMode ? "Technical result details" : "Result details"}</span>
            <small>
              {activeResultTab} / {activeResultModel.sourceType} / {hiddenColumnCount.toLocaleString()} hidden columns
            </small>
          </summary>
          <div>
            <span>
              Source tab
              <strong>{activeResultModel.sourceTab}</strong>
            </span>
            <span>
              Page
              <strong>
                {activeResultModel.page} of {activeResultModel.totalPages}
              </strong>
            </span>
            <span>
              Rows per page
              <strong>{activeResultModel.rowsPerPage.toLocaleString()}</strong>
            </span>
            <span>
              Export columns
              <strong>{activeResultModel.export.columns.length.toLocaleString()}</strong>
            </span>
          </div>
        </details>
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
        buttonLabel="Choose CSV"
        context="Open data"
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
          {renderHumanInsightBackButton()}
          {renderHumanIntentGuidance()}
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
            selectedColumns={querySelectedColumns}
            groupBy={queryGroupBy}
            aggregations={queryAggregations}
            sortOptions={querySortOptions}
            sortColumn={querySortColumn}
            sortDirection={querySortDirection}
            rowLimit={queryLimit}
            running={isRunningQuery}
            errorMessage={errorMessage}
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
            onRunQuery={runVisualQuery}
          />
        </>
      ) : null,
    results: () =>
      dataset ? (
        <>
          {renderHumanInsightBackButton()}
          {renderHumanIntentGuidance()}
          <section className="results-workspace" aria-label="Data exploration workspace">
            {activeResultModel && (
              <WorkspaceSplitPane
                secondaryLabel="Results metadata"
                primary={
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
                    emptyTitle="No results yet."
                    emptyDescription="Run a query or apply filters."
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
                }
                secondary={
                  <div
                    className={[
                      "results-side-context",
                      isResultsContextCollapsed ? "is-collapsed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setIsResultsContextCollapsed((currentValue) => !currentValue)}
                    >
                      {isResultsContextCollapsed ? "Show context" : "Hide context"}
                    </button>
                    {isResultsContextCollapsed ? (
                      <button
                        type="button"
                        className="collapsed-panel-bar"
                        onClick={() => setIsResultsContextCollapsed(false)}
                      >
                        Context hidden | {activeFilterLabels.length} filters | {queryHistory.length} history
                      </button>
                    ) : (
                      <>
                        {renderResultsInvestigationSurface()}
                        <div className="results-context-strip" aria-label="Results context">
                          <DatasetSessionPanel
                            dataset={dataset}
                            schemaTypeSummary={schemaTypeSummary}
                            activeFilterLabels={activeFilterLabels}
                            queryGroupBy={activeResultModel.grouping.columns || queryGroupBy}
                            onRelationshipReview={handleRelationshipReview}
                          />

                          <QueryHistoryPanel history={queryHistory} />
                        </div>
                      </>
                    )}
                  </div>
                }
              />
            )}
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
          <p className="section-label">Settings</p>
          <h2>Settings</h2>
          <p>Preferences.</p>
        </div>
      </section>
    ),
  };

  const analystViewRegistry = createAnalystWorkspaceRenderers(analystWorkspaceRegistry, {
    dataset,
    sqlWorkspaceMetadata,
    onSqlWorkspaceMetadataChange: setSqlWorkspaceMetadata,
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
      onOpenFile={() => {
        openDatasetPicker();
      }}
      onViewChange={updateDatasetSessionView}
      onModeChange={(mode) => {
        setWorkspaceMode(mode);
        updateDatasetSessionView(mode === "human" ? (dataset ? "results" : "welcome") : "sqlWorkspace");
      }}
      onRecentDatasetClick={activateRecentDataset}
      onRuntimePanelToggle={() =>
        setRuntimePersistence((currentState) => ({
          ...currentState,
          isRuntimePanelCollapsed: !currentState.isRuntimePanelCollapsed,
        }))
      }
      onRuntimeTrailSelect={(trailItemId, targetView, targetMode) => {
        setRuntimePersistence((currentState) =>
          createRuntimeNavigationSelection({
            runtimeContext: workspaceRuntimeContext,
            currentPersistence: currentState,
            request: {
              id: trailItemId,
              targetView,
              targetMode,
            },
          }).persistence,
        );
        if (targetMode !== workspaceMode) setWorkspaceMode(targetMode);
        updateDatasetSessionView(targetView);
      }}
    >
      {renderWorkspaceView()}
    </WorkspaceShell>
  );
}

export default App;
