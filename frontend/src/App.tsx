import { type ReactNode, useEffect, useRef, useState } from "react";
import { humanIntentGuidance } from "./app/appCompositionConfig";
import DatasetSummaryPanel, {
  type HumanIntent,
} from "./components/dataset/DatasetSummaryPanel";
import DynamicFiltersPanel from "./components/filters/DynamicFiltersPanel";
import QueryHistoryPanel from "./components/history/QueryHistoryPanel";
import WorkspaceShell from "./components/layout/WorkspaceShell";
import VisualQueryBuilderPanel from "./components/query-builder/VisualQueryBuilderPanel";
import ResultTabs from "./components/results/ResultTabs";
import ResultsGrid from "./components/results/ResultsGrid";
import ResultsInvestigationSurface from "./components/results/ResultsInvestigationSurface";
import UploadPanel from "./components/upload/UploadPanel";
import {
  createAnalystNavItems,
  createAnalystWorkspaceRenderers,
} from "./features/analyst/analystWorkspaceHelpers";
import { analystWorkspaceRegistry } from "./features/analyst/analystWorkspaceRegistry";
import type {
  ActiveView,
} from "./features/dataset/datasetTypes";
import useExecutionRegistry from "./features/execution/executionRegistry";
import useWorkspaceDatasetController from "./features/dataset/useWorkspaceDatasetController";
import useExportController from "./features/export/useExportController";
import useFilterController from "./features/filters/useFilterController";
import useQueryHistory from "./features/history/useQueryHistory";
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

const analystNavItems = createAnalystNavItems(analystWorkspaceRegistry);

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
  const [humanIntent, setHumanIntent] = useState<HumanIntent | null>(null);
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
  }, [activeView, setShouldOpenFilePicker, shouldOpenFilePicker]);

  const renderNoDatasetView = () => (
    <section className="empty-state">
      <p className="section-label">No dataset</p>
      <h2>No dataset open. Choose CSV.</h2>
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
      />
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
              </>
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
          </div>
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
      onRuntimePanelToggle={onRuntimePanelToggle}
      onRuntimeTrailSelect={onRuntimeTrailSelect}
    >
      {renderWorkspaceView()}
    </WorkspaceShell>
  );
}

export default App;
