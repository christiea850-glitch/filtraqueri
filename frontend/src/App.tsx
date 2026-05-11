import { type ReactNode, useEffect, useRef, useState } from "react";
import DatasetSummaryPanel, {
  DatasetSessionPanel,
  type HumanIntent,
} from "./components/dataset/DatasetSummaryPanel";
import DynamicFiltersPanel from "./components/filters/DynamicFiltersPanel";
import QueryHistoryPanel from "./components/history/QueryHistoryPanel";
import WorkspaceShell from "./components/layout/WorkspaceShell";
import VisualQueryBuilderPanel from "./components/query-builder/VisualQueryBuilderPanel";
import ResultTabs from "./components/results/ResultTabs";
import ResultsGrid from "./components/results/ResultsGrid";
import UploadPanel from "./components/upload/UploadPanel";
import {
  createAnalystNavItems,
  createAnalystWorkspaceRenderers,
} from "./features/analyst/analystWorkspaceHelpers";
import { analystWorkspaceRegistry } from "./features/analyst/analystWorkspaceRegistry";
import type {
  ActiveView,
} from "./features/dataset/datasetTypes";
import useWorkspaceDatasetController from "./features/dataset/useWorkspaceDatasetController";
import useExportController from "./features/export/useExportController";
import useFilterController from "./features/filters/useFilterController";
import useQueryHistory from "./features/history/useQueryHistory";
import useQueryBuilderController from "./features/query-builder/useQueryBuilderController";
import type { ResultState, ResultTabKey } from "./features/results/resultTypes";
import useResults, { createEmptyResultState } from "./features/results/useResults";
import {
  filterDataset,
  runQueryBuilder,
} from "./services/api";
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
    label: "Summarize this dataset",
    route: "results",
    nextStep: "Review the preview rows and column list to get oriented.",
    detail:
      "Start with the row count, columns, and sample records. Use sorting or the result tabs to inspect the dataset without writing SQL.",
  },
  missing_values: {
    label: "Find missing values",
    route: "queryBuilder",
    nextStep: "Choose the columns you want to check, then run analysis.",
    detail:
      "Use the visible column choices to focus the table. Columns with null counts in the dataset profile are good places to start.",
  },
  top_categories: {
    label: "Show top categories",
    route: "queryBuilder",
    nextStep: "Choose a category column in Group by, keep COUNT selected, then run the query.",
    detail:
      "This creates a beginner-friendly count by category using the existing query builder controls.",
  },
  compare_columns: {
    label: "Compare two columns",
    route: "queryBuilder",
    nextStep: "Select two visible columns, then run the query to compare their values side by side.",
    detail:
      "Pick columns that answer the same question from two angles, such as region and sales or status and owner.",
  },
  trends: {
    label: "Find trends",
    route: "queryBuilder",
    nextStep: "Group by a date or time-like column, choose a useful aggregation, then run the query.",
    detail:
      "Trends work best when the dataset has a date column and a numeric measure to summarize.",
  },
  unusual_values: {
    label: "Find unusual values",
    route: "results",
    nextStep: "Sort numeric or date columns to bring very high, very low, or unexpected values into view.",
    detail:
      "Use the column headers in the results grid to sort. Filtering can narrow the rows after something stands out.",
  },
  simple_chart: {
    label: "Create simple chart",
    route: "queryBuilder",
    nextStep: "Build a small grouped result first, such as category plus COUNT.",
    detail:
      "Charts are not automated yet, but a grouped query gives you the clean summary table a chart will use later.",
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
    resultRows,
    resultColumns,
    resultPage,
    resultRowsPerPage,
    resultTotalCount,
    resultTotalPages,
    hasFilteredResults,
    resetResults,
  } = useResults();
  const [isFiltering, setIsFiltering] = useState(false);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const { queryHistory, setQueryHistory, addHistory, clearHistory } = useQueryHistory();
  const [errorMessage, setErrorMessage] = useState("");
  const [humanIntent, setHumanIntent] = useState<HumanIntent | null>(null);
  const [isResultsContextCollapsed, setIsResultsContextCollapsed] = useState(false);
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
    shouldOpenFilePicker,
    setShouldOpenFilePicker,
    selectedFileName,
    isUploading,
    updateDatasetSessionView,
    updateDatasetSessionResultTab,
    activateRecentDataset,
    openDatasetPicker,
    handleFileUpload,
    clearCurrentDatasetSession,
    removeRecentDatasetWithConfirmation,
    confirmFutureDatasetDelete,
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
  });
  const activeFilters = buildBackendFilters(dataset);
  const activeFilterLabels = createFilterLabels(activeFilters);
  const buildActiveBackendFilters = () => buildBackendFilters(dataset);
  const { isExporting, exportCurrentResults: runExportCurrentResults } = useExportController({
    dataset,
    activeResultTab,
    hasRunQuery,
    queryLimit,
    queryGroupBy,
    querySelectedColumns,
    activeAggregations,
    querySortColumn,
    querySortDirection,
    activeResult,
    resultTotalCount,
    buildBackendFilters: buildActiveBackendFilters,
    addHistory,
  });

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

  const applyFilters = async () => {
    if (!dataset) return;

    setIsFiltering(true);
    setErrorMessage("");

    try {
      const filterResult = await filterDataset(dataset.dataset_id, {
        filters: buildActiveBackendFilters(),
        limit: filteredResult.rowsPerPage,
        page: 1,
        order_by: filteredResult.sortColumn
          ? {
              column: filteredResult.sortColumn,
              direction: filteredResult.sortDirection,
            }
          : null,
      });
      updateFilteredResult(
        {
          ...filteredResult,
          columns: filterResult.columns,
          rows: filterResult.rows,
          totalCount: filterResult.total_count,
          page: 1,
          rowsPerPage: filterResult.limit,
        },
        true,
      );
      addHistory(
        "Filters",
        activeFilterLabels.length > 0 ? activeFilterLabels.join("; ") : "No filters",
        filterResult.filtered_count,
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
      const filterResult = await filterDataset(dataset.dataset_id, {
        filters: [],
        limit: previewResult.rowsPerPage,
        page: 1,
      });
      updatePreviewResult(
        {
          ...previewResult,
          columns: filterResult.columns,
          rows: filterResult.rows,
          totalCount: filterResult.total_count,
          page: 1,
          rowsPerPage: filterResult.limit,
        },
        true,
      );
      setFilteredResult(createEmptyResultState());
      addHistory("Reset", "Cleared all filters", filterResult.total_count);
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
      const filterResult = await filterDataset(dataset.dataset_id, {
        filters: activeResultTab === "filtered" ? buildActiveBackendFilters() : [],
        limit: rowsPerPage,
        page,
        order_by: sortColumn
          ? {
              column: sortColumn,
              direction: sortDirection,
            }
          : null,
      });
      const nextResult = {
        columns: filterResult.columns,
        rows: filterResult.rows,
        totalCount: filterResult.total_count,
        page: filterResult.page,
        rowsPerPage: filterResult.limit,
        sortColumn,
        sortDirection,
      };

      if (activeResultTab === "filtered") {
        updateFilteredResult(nextResult);
      } else {
        updatePreviewResult(nextResult);
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
      const queryResult = await runQueryBuilder(dataset.dataset_id, {
        selected_columns: activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns,
        group_by: queryGroupBy,
        aggregations: activeAggregations.map((aggregation) => ({
          function: aggregation.function,
          column: aggregation.column || null,
        })),
        filters: buildActiveBackendFilters(),
        order_by: querySortColumn
          ? {
              column: querySortColumn,
              direction: querySortDirection,
            }
          : null,
        limit: Number(queryLimit) || queriedResult.rowsPerPage,
        page: 1,
      });
      updateQueriedResult(
        {
          ...queriedResult,
          columns: queryResult.columns,
          rows: queryResult.rows,
          totalCount: queryResult.total_count,
          page: 1,
          rowsPerPage: queryResult.limit,
          sortColumn: querySortColumn,
          sortDirection: querySortDirection,
        },
        true,
      );
      addHistory(
        "Query builder",
        activeAggregations.length > 0
          ? `${activeAggregations.length} aggregation${activeAggregations.length === 1 ? "" : "s"}`
          : `${querySelectedColumns.length} visible columns`,
        queryResult.total_count,
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
    sortColumn = querySortColumn,
    sortDirection = querySortDirection,
  ) => {
    if (!dataset) return;

    setIsRunningQuery(true);
    setErrorMessage("");
    setHasRunQuery(true);

    try {
      const queryResult = await runQueryBuilder(dataset.dataset_id, {
        selected_columns: activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns,
        group_by: queryGroupBy,
        aggregations: activeAggregations.map((aggregation) => ({
          function: aggregation.function,
          column: aggregation.column || null,
        })),
        filters: buildActiveBackendFilters(),
        order_by: sortColumn
          ? {
              column: sortColumn,
              direction: sortDirection,
            }
          : null,
        limit: rowsPerPage,
        page,
      });
      updateQueriedResult({
        columns: queryResult.columns,
        rows: queryResult.rows,
        totalCount: queryResult.total_count,
        page: queryResult.page,
        rowsPerPage: queryResult.limit,
        sortColumn,
        sortDirection,
      });
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
    const nextPage = Math.min(Math.max(page, 1), resultTotalPages);
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
    setWorkspaceMode("human");
    configureForHumanIntent(intent, dataset);

    if (intent === "summary" || intent === "unusual_values") {
      handleResultTabChange("preview");
    }

    updateDatasetSessionView(guidance.route);
  };

  const navigateHumanInsightAction = (view: ActiveView, tab?: ResultTabKey) => {
    if (tab) handleResultTabChange(tab);
    updateDatasetSessionView(view);
  };

  const createHumanInsight = (intent: HumanIntent) => {
    const guidance = humanIntentGuidance[intent];

    if (!dataset) {
      return {
        title: guidance.label,
        explanation: "Open a CSV dataset first, then FiltraQueri can turn this guided question into a useful workspace path.",
        canCheck: ["Dataset shape", "Column types", "Preview rows"],
        signals: ["No dataset is currently open."],
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
    const activeResultCount = resultTotalCount || activeResult.totalCount || dataset.row_count;

    const baseSignals = [
      `${dataset.row_count.toLocaleString()} rows and ${dataset.column_count.toLocaleString()} columns are available.`,
      `${previewRowsCount.toLocaleString()} preview rows are loaded for a quick first look.`,
      activeFilterLabels.length > 0
        ? `${activeFilterLabels.length} active filter${activeFilterLabels.length === 1 ? "" : "s"} may shape the next result.`
        : "No filters are currently applied.",
    ];

    if (intent === "summary") {
      return {
        title: guidance.label,
        explanation:
          "This gives you a plain overview before you choose a deeper analysis path. Start by checking size, column types, and a few preview rows.",
        canCheck: [
          "Dataset size and table name",
          "Column type mix",
          "Preview rows and active result count",
        ],
        signals: [
          ...baseSignals,
          `${numericColumns.length} numeric, ${categoricalColumns.length} category/text, and ${dateColumns.length} date columns were detected.`,
          `The active result currently represents ${activeResultCount.toLocaleString()} rows.`,
        ],
        actions: [
          { label: "View preview rows", view: "results" as ActiveView, tab: "preview" as ResultTabKey },
          { label: "Review dataset details", view: "dataset" as ActiveView },
        ],
      };
    }

    if (intent === "missing_values") {
      return {
        title: guidance.label,
        explanation:
          "Missing values can explain strange totals, blank categories, or rows that disappear during analysis.",
        canCheck: [
          "Columns with null counts",
          "Rows affected by filters",
          "Which columns are worth inspecting first",
        ],
        signals: [
          columnsWithMissingValues.length > 0
            ? `${columnsWithMissingValues.length} column${columnsWithMissingValues.length === 1 ? "" : "s"} report missing values.`
            : "No missing-value counts are reported in the current schema profile.",
          ...columnsWithMissingValues.slice(0, 4).map((column) =>
            `${column.name}: ${column.null_count.toLocaleString()} missing value${column.null_count === 1 ? "" : "s"}`,
          ),
        ],
        actions: [
          { label: "Choose columns to check", view: "queryBuilder" as ActiveView },
          { label: "Open filters", view: "filters" as ActiveView },
        ],
      };
    }

    if (intent === "top_categories") {
      const firstCategory = categoricalColumns[0];
      return {
        title: guidance.label,
        explanation:
          "Top categories help you see the biggest groups in the dataset without reading every row.",
        canCheck: ["Category/text columns", "Group counts", "Most common values"],
        signals: [
          firstCategory
            ? `${firstCategory.name} is a good first grouping candidate.`
            : "No clear category column was detected yet.",
          `${categoricalColumns.length} category/text column${categoricalColumns.length === 1 ? "" : "s"} are available.`,
          queryGroupBy.length > 0
            ? `Current grouping: ${queryGroupBy.join(", ")}.`
            : "No grouped query is active yet.",
        ],
        actions: [
          { label: "Build category summary", view: "queryBuilder" as ActiveView },
          { label: "See results", view: "results" as ActiveView, tab: "queried" as ResultTabKey },
        ],
      };
    }

    if (intent === "compare_columns") {
      const comparisonColumns = dataset.schema.slice(0, 2).map((column) => column.name);
      return {
        title: guidance.label,
        explanation:
          "Comparing columns side by side is useful when you want to understand how two fields relate row by row.",
        canCheck: ["Two visible columns", "Preview rows", "Sort order"],
        signals: [
          comparisonColumns.length >= 2
            ? `Suggested starting pair: ${comparisonColumns.join(" and ")}.`
            : "This dataset needs at least two columns for a useful comparison.",
          `${querySelectedColumns.length} visible column${querySelectedColumns.length === 1 ? "" : "s"} are currently selected in Query Builder.`,
        ],
        actions: [
          { label: "Select comparison columns", view: "queryBuilder" as ActiveView },
          { label: "Preview rows first", view: "results" as ActiveView, tab: "preview" as ResultTabKey },
        ],
      };
    }

    if (intent === "trends") {
      return {
        title: guidance.label,
        explanation:
          "Trends work best when there is a date column plus a numeric value to summarize over time.",
        canCheck: ["Date columns", "Numeric measures", "Grouped query results"],
        signals: [
          dateColumns.length > 0
            ? `${dateColumns[0].name} looks like a good time column.`
            : "No date column was detected, so trend analysis may need a manually chosen time-like field.",
          numericColumns.length > 0
            ? `${numericColumns[0].name} can be used as a numeric measure.`
            : "No numeric measure was detected yet.",
        ],
        actions: [
          { label: "Build trend query", view: "queryBuilder" as ActiveView },
          { label: "Filter date range", view: "filters" as ActiveView },
        ],
      };
    }

    if (intent === "unusual_values") {
      return {
        title: guidance.label,
        explanation:
          "Unusual values usually appear at the high or low end of numeric/date columns, or as unexpected categories.",
        canCheck: ["Sortable numeric/date columns", "Preview rows", "Filtered result count"],
        signals: [
          `${numericColumns.length + dateColumns.length} numeric/date column${numericColumns.length + dateColumns.length === 1 ? "" : "s"} can be sorted for extremes.`,
          `Current result count: ${activeResultCount.toLocaleString()} rows.`,
          activeResult.sortColumn
            ? `Current sort: ${activeResult.sortColumn} ${activeResult.sortDirection}.`
            : "No result sort is active yet.",
        ],
        actions: [
          { label: "Sort preview rows", view: "results" as ActiveView, tab: "preview" as ResultTabKey },
          { label: "Narrow with filters", view: "filters" as ActiveView },
        ],
      };
    }

    return {
      title: guidance.label,
      explanation:
        "A chart starts with a clean summary table. Build a small grouped result first, then it will be ready for future chart tooling.",
      canCheck: ["Category column", "Count or numeric summary", "Small grouped result"],
      signals: [
        categoricalColumns[0]
          ? `${categoricalColumns[0].name} can be used as the chart category.`
          : "No category column was detected yet.",
        numericColumns[0]
          ? `${numericColumns[0].name} can be used as a chart value.`
          : "COUNT can be used when there is no numeric value.",
      ],
      actions: [
        { label: "Prepare chart data", view: "queryBuilder" as ActiveView },
        { label: "Review query result", view: "results" as ActiveView, tab: "queried" as ResultTabKey },
      ],
    };
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
          <strong>Next step:</strong> {guidance.nextStep}
        </p>
        <p>{insight.explanation}</p>
        <div className="human-insight-grid">
          <div>
            <strong>What FiltraQueri can check next</strong>
            <ul>
              {insight.canCheck.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>What we can see now</strong>
            <ul>
              {insight.signals.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="human-insight-actions">
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

  const renderNoDatasetView = () => (
    <section className="empty-state">
      <p className="section-label">No dataset</p>
      <h2>Open a CSV file to activate this workspace view</h2>
      <p>Use the sidebar Open File action or return to Welcome to upload a dataset.</p>
    </section>
  );

  const humanViewRegistry: Partial<Record<ActiveView, () => ReactNode>> = {
    welcome: () => (
      <UploadPanel
        ref={sidebarFileInputRef}
        uploading={isUploading}
        errorMessage={errorMessage}
        selectedFileName={selectedFileName}
        buttonLabel="Upload CSV to start"
        context="Ask your data naturally"
        onFileChange={handleFileUpload}
      />
    ),
    dataset: () =>
      (
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
        />
      ),
    filters: () =>
      dataset ? (
        <DynamicFiltersPanel
          schema={dataset.schema}
          filterValues={filterValues}
          applying={isFiltering}
          errorMessage={errorMessage}
          onFilterChange={updateFilter}
          onApplyFilters={applyFilters}
          onResetFilters={resetFilters}
        />
      ) : null,
    queryBuilder: () =>
      dataset ? (
        <>
          {renderHumanIntentGuidance()}
          <VisualQueryBuilderPanel
            schema={dataset.schema}
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
          {renderHumanIntentGuidance()}
          <section className="results-workspace" aria-label="Data exploration workspace">
            <div className="results-workspace-header">
              <button
                type="button"
                className="text-button"
                onClick={() => setIsResultsContextCollapsed((currentValue) => !currentValue)}
              >
                {isResultsContextCollapsed ? "Show context" : "Hide context"}
              </button>
            </div>
            {isResultsContextCollapsed ? (
              <button
                type="button"
                className="collapsed-panel-bar"
                onClick={() => setIsResultsContextCollapsed(false)}
              >
                Results context hidden - {activeFilterLabels.length} active filters -{" "}
                {queryHistory.length} history items
              </button>
            ) : (
              <div className="results-context-strip" aria-label="Results context">
                <DatasetSessionPanel
                  dataset={dataset}
                  schemaTypeSummary={schemaTypeSummary}
                  activeFilterLabels={activeFilterLabels}
                  queryGroupBy={queryGroupBy}
                />

                <QueryHistoryPanel history={queryHistory} />
              </div>
            )}

            <ResultsGrid
              title={
                activeResultTab === "queried"
                  ? "Query results"
                  : activeResultTab === "filtered"
                    ? "Filtered results"
                    : "Preview results"
              }
              label="Data grid"
              columns={resultColumns}
              rows={resultRows}
              totalCount={resultTotalCount}
              loading={isFiltering || isRunningQuery}
              activeFilterLabels={activeFilterLabels}
              activeSortColumn={activeResult.sortColumn}
              activeSortDirection={activeResult.sortDirection}
              page={resultPage}
              totalPages={resultTotalPages}
              rowsPerPage={resultRowsPerPage}
              emptyTitle="No rows returned"
              emptyDescription="Adjust filters, sorting, or query builder settings and try again."
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
            <h2>Export current results</h2>
            <p>
              Export the active {activeResultTab === "queried" ? "query" : activeResultTab}{" "}
              result as CSV.
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
          <h2>Workspace settings</h2>
          <p>Settings will live here as the workspace grows.</p>
        </div>
      </section>
    ),
  };

  const analystViewRegistry = createAnalystWorkspaceRenderers(analystWorkspaceRegistry, {
    dataset,
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
      onOpenFile={() => {
        openDatasetPicker();
      }}
      onViewChange={updateDatasetSessionView}
      onModeChange={(mode) => {
        setWorkspaceMode(mode);
        updateDatasetSessionView(mode === "human" ? (dataset ? "results" : "welcome") : "sqlWorkspace");
      }}
      onRecentDatasetClick={activateRecentDataset}
    >
      {renderWorkspaceView()}
    </WorkspaceShell>
  );
}

export default App;
