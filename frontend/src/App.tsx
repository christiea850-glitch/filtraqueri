import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react";
import DatasetSummaryPanel, {
  DatasetSessionPanel,
} from "./components/dataset/DatasetSummaryPanel";
import DynamicFiltersPanel from "./components/filters/DynamicFiltersPanel";
import QueryHistoryPanel from "./components/history/QueryHistoryPanel";
import WorkspaceShell from "./components/layout/WorkspaceShell";
import VisualQueryBuilderPanel from "./components/query-builder/VisualQueryBuilderPanel";
import ResultTabs from "./components/results/ResultTabs";
import ResultsGrid from "./components/results/ResultsGrid";
import UploadPanel from "./components/upload/UploadPanel";
import type {
  ActiveView,
  DatasetMetadata,
  DatasetSession,
  WorkspaceMode,
} from "./features/dataset/datasetTypes";
import type { FilterState } from "./features/filters/filterTypes";
import type { HistoryItem } from "./features/history/historyTypes";
import type { AggregationState } from "./features/query-builder/queryBuilderTypes";
import type { ResultState, ResultTabKey, SortDirection } from "./features/results/resultTypes";
import {
  exportDataset,
  filterDataset,
  runQueryBuilder,
  uploadDataset,
} from "./services/api";
import "./App.css";

const MAX_QUERY_LIMIT = 1000;

const createEmptyResultState = (): ResultState => ({
  columns: [],
  rows: [],
  totalCount: 0,
  page: 1,
  rowsPerPage: 25,
  sortColumn: "",
  sortDirection: "ASC",
});

const analystViews: Array<{
  view: ActiveView;
  label: string;
  description: string;
  capabilities: string[];
}> = [
  {
    view: "sqlWorkspace",
    label: "SQL Workspace",
    description: "Write, organize, and review analyst-level SQL workflows in a future release.",
    capabilities: ["SELECT workflows", "CTEs and subqueries", "Window functions"],
  },
  {
    view: "savedQueries",
    label: "Saved Queries",
    description: "Save repeatable analysis steps and reuse query definitions across sessions.",
    capabilities: ["Query library", "Reusable definitions", "Session-aware history"],
  },
  {
    view: "queryExplain",
    label: "Query Explain",
    description: "Validate query structure and explain how a result is produced before execution.",
    capabilities: ["Validation checks", "Execution explanation", "Risk warnings"],
  },
  {
    view: "dataCleaning",
    label: "Data Cleaning",
    description: "Prepare datasets with controlled transformations and calculated fields.",
    capabilities: ["Type cleanup", "Calculated columns", "Missing value handling"],
  },
  {
    view: "diagnostics",
    label: "Diagnostics",
    description: "Inspect relational quality, table design, keys, dependencies, and anomalies.",
    capabilities: ["Functional dependencies", "Anomaly detection", "Table design checks"],
  },
  {
    view: "normalization",
    label: "Normalization",
    description: "Explore normalization guidance for 1NF, 2NF, and 3NF design improvements.",
    capabilities: ["1NF checks", "2NF checks", "3NF recommendations"],
  },
];

function App() {
  const sidebarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const [recentDatasets, setRecentDatasets] = useState<DatasetSession[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>("welcome");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("human");
  const [shouldOpenFilePicker, setShouldOpenFilePicker] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [activeResultTab, setActiveResultTab] = useState<ResultTabKey>("preview");
  const [previewResult, setPreviewResult] = useState<ResultState>(createEmptyResultState);
  const [filteredResult, setFilteredResult] = useState<ResultState>(createEmptyResultState);
  const [queriedResult, setQueriedResult] = useState<ResultState>(createEmptyResultState);
  const [isUploading, setIsUploading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, FilterState>>({});
  const [querySelectedColumns, setQuerySelectedColumns] = useState<string[]>([]);
  const [queryGroupBy, setQueryGroupBy] = useState<string[]>([]);
  const [queryAggregations, setQueryAggregations] = useState<AggregationState[]>([
    { id: 1, function: "COUNT", column: "" },
  ]);
  const [querySortColumn, setQuerySortColumn] = useState("");
  const [querySortDirection, setQuerySortDirection] = useState<SortDirection>("ASC");
  const [queryLimit, setQueryLimit] = useState("100");
  const [hasRunQuery, setHasRunQuery] = useState(false);
  const [queryHistory, setQueryHistory] = useState<HistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedFileName(file.name);
    setIsUploading(true);
    setErrorMessage("");
    setDataset(null);
    updateDatasetSessionResultTab("preview");
    setPreviewResult(createEmptyResultState());
    setFilteredResult(createEmptyResultState());
    setQueriedResult(createEmptyResultState());
    setFilterValues({});
    setQuerySelectedColumns([]);
    setQueryGroupBy([]);
    setQueryAggregations([{ id: 1, function: "COUNT", column: "" }]);
    setQuerySortColumn("");
    setQuerySortDirection("ASC");
    setHasRunQuery(false);
    setQueryHistory([]);

    try {
      const uploadResult = await uploadDataset(file);
      const uploadColumns = uploadResult.dataset.schema.map((column) => column.name);
      setDataset(uploadResult.dataset);
      updatePreviewResult(
        {
          columns: uploadColumns,
          rows: uploadResult.preview,
          totalCount: uploadResult.dataset.row_count,
          page: 1,
          rowsPerPage: 25,
          sortColumn: "",
          sortDirection: "ASC",
        },
        true,
      );
      setFilteredResult(createEmptyResultState());
      setQueriedResult(createEmptyResultState());
      setQuerySelectedColumns(uploadResult.dataset.schema.slice(0, 4).map((column) => column.name));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not upload that file. Please check the backend and try again.";

      setErrorMessage(message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const updateFilter = (columnName: string, value: FilterState) => {
    setFilterValues((currentValues) => ({
      ...currentValues,
      [columnName]: {
        ...currentValues[columnName],
        ...value,
      },
    }));
  };

  const toggleListValue = (values: string[], value: string) =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

  const aggregationAlias = (aggregation: AggregationState) => {
    if (aggregation.function === "COUNT" && !aggregation.column) return "count_rows";
    return `${aggregation.function.toLowerCase()}_${aggregation.column.replace(/[^A-Za-z0-9_]/g, "_").toLowerCase()}`;
  };

  const activeAggregations = queryAggregations.filter(
    (aggregation) => aggregation.function === "COUNT" || aggregation.column,
  );

  const querySortOptions = [
    ...(activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns),
    ...activeAggregations.map(aggregationAlias),
  ];

  const addHistory = (action: string, detail: string, resultCount: number) => {
    setQueryHistory((currentHistory) => [
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        action,
        detail,
        resultCount,
      },
      ...currentHistory.slice(0, 7),
    ]);
  };

  const createDatasetSession = (datasetMetadata: DatasetMetadata): DatasetSession => ({
    dataset: datasetMetadata,
    lastActiveView: activeView,
    lastActiveResultTab: activeResultTab,
    previewResult,
    filteredResult,
    queriedResult,
    filterValues,
    querySelectedColumns,
    queryGroupBy,
    queryAggregations,
    querySortColumn,
    querySortDirection,
    queryLimit,
    hasRunQuery,
    activeResultTab,
    queryHistory,
  });

  const addRecentDataset = (session: DatasetSession) => {
    setRecentDatasets((currentSessions) => [
      session,
      ...currentSessions
        .filter((recentSession) => recentSession.dataset.dataset_id !== session.dataset.dataset_id)
        .slice(0, 5),
    ]);
  };

  const restoreDatasetSession = (session: DatasetSession) => {
    setDataset(session.dataset);
    setPreviewResult(session.previewResult);
    setFilteredResult(session.filteredResult);
    setQueriedResult(session.queriedResult);
    setFilterValues(session.filterValues);
    setQuerySelectedColumns(session.querySelectedColumns);
    setQueryGroupBy(session.queryGroupBy);
    setQueryAggregations(session.queryAggregations);
    setQuerySortColumn(session.querySortColumn);
    setQuerySortDirection(session.querySortDirection);
    setQueryLimit(session.queryLimit);
    setHasRunQuery(session.hasRunQuery);
    setActiveResultTab(session.lastActiveResultTab || session.activeResultTab || "preview");
    setQueryHistory(session.queryHistory);
    setSelectedFileName(session.dataset.original_filename);
    setActiveView(session.lastActiveView || "results");
  };

  const activateRecentDataset = (datasetId: string) => {
    const session = recentDatasets.find(
      (recentSession) => recentSession.dataset.dataset_id === datasetId,
    );

    if (session) {
      restoreDatasetSession(session);
    }
  };

  const updateDatasetSessionView = (view: ActiveView) => {
    setActiveView(view);
    if (!dataset) return;

    setRecentDatasets((currentSessions) =>
      currentSessions.map((session) =>
        session.dataset.dataset_id === dataset.dataset_id
          ? { ...session, lastActiveView: view }
          : session,
      ),
    );
  };

  const updateDatasetSessionResultTab = (tab: ResultTabKey) => {
    setActiveResultTab(tab);
    if (!dataset) return;

    setRecentDatasets((currentSessions) =>
      currentSessions.map((session) =>
        session.dataset.dataset_id === dataset.dataset_id
          ? { ...session, lastActiveResultTab: tab }
          : session,
      ),
    );
  };

  useEffect(() => {
    if (dataset) {
      addRecentDataset(createDatasetSession(dataset));
    }
  }, [
    dataset,
    previewResult,
    filteredResult,
    queriedResult,
    filterValues,
    querySelectedColumns,
    queryGroupBy,
    queryAggregations,
    querySortColumn,
    querySortDirection,
    queryLimit,
    hasRunQuery,
    activeResultTab,
    activeView,
    queryHistory,
  ]);

  const buildBackendFilters = () => {
    if (!dataset) return [];

    return dataset.schema
      .map((column) => {
        const value = filterValues[column.name] || {};

        if (column.inferred_type === "numeric") {
          return {
            column: column.name,
            type: column.inferred_type,
            min: value.min || null,
            max: value.max || null,
          };
        }

        if (column.inferred_type === "date") {
          return {
            column: column.name,
            type: column.inferred_type,
            start: value.start || null,
            end: value.end || null,
          };
        }

        if (column.inferred_type === "boolean") {
          return {
            column: column.name,
            type: column.inferred_type,
            value: value.value === "" || value.value === undefined ? null : value.value === "true",
          };
        }

        return {
          column: column.name,
          type: column.inferred_type,
          values: value.values || [],
        };
      })
      .filter((filter) =>
        Object.entries(filter).some(
          ([key, value]) =>
            key !== "column" &&
            key !== "type" &&
            value !== null &&
            value !== "" &&
            (!Array.isArray(value) || value.length > 0),
        ),
      );
  };

  const activeFilters = buildBackendFilters();

  const activeFilterLabels = activeFilters.map((filter) => {
    if ("values" in filter && Array.isArray(filter.values) && filter.values.length > 0) {
      return `${filter.column}: ${filter.values.join(", ")}`;
    }
    if ("value" in filter && filter.value !== null) return `${filter.column}: ${filter.value}`;
    if ("start" in filter || "end" in filter) {
      return `${filter.column}: ${filter.start || "any"} to ${filter.end || "any"}`;
    }
    if ("min" in filter || "max" in filter) {
      return `${filter.column}: ${filter.min || "min"} to ${filter.max || "max"}`;
    }
    return filter.column;
  });

  const schemaTypeSummary = dataset
    ? dataset.schema.reduce<Record<string, number>>((summary, column) => {
        summary[column.inferred_type] = (summary[column.inferred_type] || 0) + 1;
        return summary;
      }, {})
    : {};

  const activeResult =
    activeResultTab === "queried"
      ? queriedResult
      : activeResultTab === "filtered"
        ? filteredResult
        : previewResult;
  const resultRows = activeResult.rows;
  const resultColumns = activeResult.columns;
  const resultPage = activeResult.page;
  const resultRowsPerPage = activeResult.rowsPerPage;
  const resultTotalCount = activeResult.totalCount;
  const resultTotalPages = Math.max(1, Math.ceil((resultTotalCount || 0) / resultRowsPerPage));
  const hasFilteredResults = filteredResult.columns.length > 0;
  const hasQueryResults = queriedResult.columns.length > 0 || hasRunQuery;

  const activateResultTab = (tab: ResultTabKey) => {
    updateDatasetSessionResultTab(tab);
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
        filters: buildBackendFilters(),
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
        filters: activeResultTab === "filtered" ? buildBackendFilters() : [],
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
        filters: buildBackendFilters(),
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

  const addAggregation = () => {
    setQueryAggregations((currentAggregations) => [
      ...currentAggregations,
      { id: Date.now(), function: "SUM", column: "" },
    ]);
  };

  const updateAggregation = (id: number, value: Partial<AggregationState>) => {
    setQueryAggregations((currentAggregations) =>
      currentAggregations.map((aggregation) =>
        aggregation.id === id ? { ...aggregation, ...value } : aggregation,
      ),
    );
  };

  const removeAggregation = (id: number) => {
    setQueryAggregations((currentAggregations) =>
      currentAggregations.filter((aggregation) => aggregation.id !== id),
    );
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
        filters: buildBackendFilters(),
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
    if (!dataset) return;

    setIsExporting(true);
    setErrorMessage("");

    try {
      const isQueryExport = activeResultTab === "queried" && hasRunQuery;
      const isFilteredExport = activeResultTab === "filtered";
      const blob = await exportDataset(
        dataset.dataset_id,
        isQueryExport
          ? {
              source: "query_builder",
              limit: Math.min(Number(queryLimit) || MAX_QUERY_LIMIT, MAX_QUERY_LIMIT),
              query_builder: {
                selected_columns:
                  activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns,
                group_by: queryGroupBy,
                aggregations: activeAggregations.map((aggregation) => ({
                  function: aggregation.function,
                  column: aggregation.column || null,
                })),
                filters: buildBackendFilters(),
                order_by: querySortColumn
                  ? {
                      column: querySortColumn,
                      direction: querySortDirection,
                    }
                  : null,
                limit: Math.min(Number(queryLimit) || MAX_QUERY_LIMIT, MAX_QUERY_LIMIT),
                page: 1,
              },
            }
          : {
              source: "filter",
              filters: isFilteredExport ? buildBackendFilters() : [],
              order_by: activeResult.sortColumn
                ? {
                    column: activeResult.sortColumn,
                    direction: activeResult.sortDirection,
                  }
                : null,
              limit: MAX_QUERY_LIMIT,
            },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${dataset.filename.replace(/\.csv$/i, "")}_export.csv`;
      link.click();
      URL.revokeObjectURL(url);
      addHistory("Export", isQueryExport ? "Exported query result" : "Exported filtered result", resultTotalCount);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We could not export the current results.";

      setErrorMessage(message);
    } finally {
      setIsExporting(false);
    }
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

  const renderAnalystView = (view: ActiveView) => {
    if (workspaceMode !== "analyst") return null;

    return (
      <section className="analyst-workspace-panel standalone-panel">
        {analystViews
          .filter((item) => item.view === view)
          .map((item) => (
            <div className="analyst-foundation" key={item.view}>
              <p className="section-label">Analyst mode</p>
              <h2>{item.label}</h2>
              <p>{item.description}</p>
              <div className="analyst-tool-grid">
                {item.capabilities.map((capability) => (
                  <article key={capability}>
                    <strong>{capability}</strong>
                    <span>Planned</span>
                  </article>
                ))}
              </div>
              <div className="analyst-empty-state">
                <strong>Frontend foundation ready</strong>
                <p>
                  This workspace will reuse the active dataset session, results grid,
                  result tabs, and query history when execution support is added.
                </p>
              </div>
            </div>
          ))}
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
        buttonLabel="Upload CSV to start"
        context="Ask your data naturally"
        onFileChange={handleFileUpload}
      />
    ),
    dataset: () => (dataset ? <DatasetSummaryPanel dataset={dataset} /> : null),
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
          onGroupByChange={setQueryGroupBy}
          onAddAggregation={addAggregation}
          onUpdateAggregation={updateAggregation}
          onRemoveAggregation={removeAggregation}
          onSortColumnChange={setQuerySortColumn}
          onSortDirectionChange={setQuerySortDirection}
          onRowLimitChange={setQueryLimit}
          onRunQuery={runVisualQuery}
        />
      ) : null,
    results: () =>
      dataset ? (
        <section className="workspace-grid" aria-label="Data exploration workspace">
          <DatasetSessionPanel
            dataset={dataset}
            schemaTypeSummary={schemaTypeSummary}
            activeFilterLabels={activeFilterLabels}
            queryGroupBy={queryGroupBy}
          />

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
                  onTabChange={updateDatasetSessionResultTab}
                />
                <button type="button" className="secondary-button" onClick={exportCurrentResults}>
                  {isExporting ? "Exporting..." : "Export CSV"}
                </button>
              </div>
            }
          />

          <QueryHistoryPanel history={queryHistory} />
        </section>
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

  const analystViewRegistry: Partial<Record<ActiveView, () => ReactNode>> =
    analystViews.reduce<Partial<Record<ActiveView, () => ReactNode>>>((registry, item) => {
      registry[item.view] = () => renderAnalystView(item.view);
      return registry;
    }, {});

  const workspaceViewRegistry: Partial<Record<ActiveView, () => ReactNode>> = {
    ...humanViewRegistry,
    ...analystViewRegistry,
  };

  const renderWorkspaceView = () => {
    const renderActiveView = workspaceViewRegistry[activeView];

    return (
      <>
        {!dataset && activeView !== "welcome" && renderNoDatasetView()}
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
      analystViews={analystViews}
      errorMessage={errorMessage}
      onOpenFile={() => {
        updateDatasetSessionView("welcome");
        setShouldOpenFilePicker(true);
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
