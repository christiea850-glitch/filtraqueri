import { type ChangeEvent, useEffect, useRef, useState } from "react";
import DynamicFiltersPanel from "./components/filters/DynamicFiltersPanel";
import VisualQueryBuilderPanel from "./components/query-builder/VisualQueryBuilderPanel";
import ResultTabs, { type ResultTabKey } from "./components/results/ResultTabs";
import ResultsGrid from "./components/results/ResultsGrid";
import UploadPanel from "./components/upload/UploadPanel";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";
const MAX_QUERY_LIMIT = 1000;

type SchemaColumn = {
  name: string;
  type: string;
  inferred_type: "text" | "numeric" | "date" | "boolean" | "categorical";
  null_count: number;
  unique_count: number;
  sample_values: unknown[];
  min?: number | string;
  max?: number | string;
};

type DatasetMetadata = {
  dataset_id: string;
  filename: string;
  original_filename: string;
  table_name: string;
  uploaded_at: string;
  row_count: number;
  column_count: number;
  schema: SchemaColumn[];
};

type UploadResponse = {
  dataset: DatasetMetadata;
  preview: Record<string, unknown>[];
};

type FilterState = {
  min?: string;
  max?: string;
  values?: string[];
  value?: string;
  start?: string;
  end?: string;
};

type FilterResponse = {
  columns: string[];
  rows: Record<string, unknown>[];
  filtered_count: number;
  total_count: number;
  page: number;
  limit: number;
};

type AggregationState = {
  id: number;
  function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
  column: string;
};

type QueryBuilderResponse = {
  columns: string[];
  rows: Record<string, unknown>[];
  total_count: number;
  page: number;
  limit: number;
};

type SortDirection = "ASC" | "DESC";

type HistoryItem = {
  id: number;
  timestamp: string;
  action: string;
  detail: string;
  resultCount: number;
};

type ResultState = {
  columns: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  rowsPerPage: number;
  sortColumn: string;
  sortDirection: SortDirection;
};

type ActiveView =
  | "welcome"
  | "dataset"
  | "filters"
  | "queryBuilder"
  | "results"
  | "history"
  | "export"
  | "settings";

const createEmptyResultState = (): ResultState => ({
  columns: [],
  rows: [],
  totalCount: 0,
  page: 1,
  rowsPerPage: 25,
  sortColumn: "",
  sortDirection: "ASC",
});

function App() {
  const sidebarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("welcome");
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
    setActiveResultTab("preview");
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

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE_URL}/datasets/upload`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "Upload failed. Please try another CSV file.");
      }

      const uploadResult = payload as UploadResponse;
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
    setActiveResultTab(tab);
    setActiveView("results");
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
      const response = await fetch(`${API_BASE_URL}/datasets/${dataset.dataset_id}/filter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: buildBackendFilters(),
          limit: filteredResult.rowsPerPage,
          page: 1,
          order_by: filteredResult.sortColumn
            ? {
                column: filteredResult.sortColumn,
                direction: filteredResult.sortDirection,
              }
            : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "Filters could not be applied.");
      }

      const filterResult = payload as FilterResponse;
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
      const response = await fetch(`${API_BASE_URL}/datasets/${dataset.dataset_id}/filter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: [],
          limit: previewResult.rowsPerPage,
          page: 1,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "Filters could not be reset.");
      }

      const filterResult = payload as FilterResponse;
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
      const response = await fetch(`${API_BASE_URL}/datasets/${dataset.dataset_id}/filter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: activeResultTab === "filtered" ? buildBackendFilters() : [],
          limit: rowsPerPage,
          page,
          order_by: sortColumn
            ? {
                column: sortColumn,
                direction: sortDirection,
              }
            : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "Preview could not be loaded.");
      }

      const filterResult = payload as FilterResponse;
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
      const response = await fetch(`${API_BASE_URL}/datasets/${dataset.dataset_id}/query-builder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "The visual query could not be run.");
      }

      const queryResult = payload as QueryBuilderResponse;
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
      const response = await fetch(`${API_BASE_URL}/datasets/${dataset.dataset_id}/query-builder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "Query page could not be loaded.");
      }

      const queryResult = payload as QueryBuilderResponse;
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
      const response = await fetch(`${API_BASE_URL}/datasets/${dataset.dataset_id}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
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
        ),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.detail || "Export could not be created.");
      }

      const blob = await response.blob();
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

  return (
    <div className="app">
      <header className="top-menu-bar">
        <div className="workspace-brand">
          <div className="brand-mark compact-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="img">
              <path
                className="mark-funnel"
                d="M9 11h30L28 24.5v8.7l-8 4.3v-13L9 11Z"
              />
              <path className="mark-search" d="M30 29.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
              <path className="mark-handle" d="m34.5 34.5 5 5" />
            </svg>
          </div>
          <strong>FiltraQueri</strong>
        </div>
        <nav className="menu-items" aria-label="Application menu">
          {["File", "Edit", "View", "Dataset", "Tools", "Help"].map((item) => (
            <button type="button" key={item}>
              {item}
            </button>
          ))}
        </nav>
        <span className="workspace-status">
          {dataset ? dataset.original_filename : "No dataset open"}
        </span>
      </header>

      <div className="workspace-shell">
        <aside className="left-sidebar" aria-label="Workspace navigation">
          <button
            type="button"
            className="sidebar-primary"
            onClick={() => {
              setActiveView("welcome");
              setShouldOpenFilePicker(true);
            }}
          >
            Open File
          </button>
          <nav>
            {[
              ["welcome", "Welcome"],
              ["dataset", "Dataset"],
              ["filters", "Filters"],
              ["queryBuilder", "Query Builder"],
              ["results", "Results"],
              ["history", "History"],
              ["export", "Export"],
              ["settings", "Settings"],
            ].map(([view, label]) => (
              <button
                type="button"
                key={view}
                className={activeView === view ? "is-active" : ""}
                onClick={() => setActiveView(view as ActiveView)}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="workspace-canvas">
          {errorMessage && activeView !== "welcome" && (
            <p className="error-message workspace-error">{errorMessage}</p>
          )}

          {activeView === "welcome" && (
            <UploadPanel
              ref={sidebarFileInputRef}
              uploading={isUploading}
              errorMessage={errorMessage}
              selectedFileName={selectedFileName}
              buttonLabel="Upload CSV to start"
              context="Ask your data naturally"
              onFileChange={handleFileUpload}
            />
          )}

        {dataset && activeView === "dataset" && (
          <section className="dataset-summary" aria-label="Dataset metadata">
            <div className="summary-header">
              <div>
                <p className="section-label">Dataset ready</p>
                <h2>{dataset.original_filename}</h2>
              </div>
              <span className="dataset-id">ID: {dataset.dataset_id.slice(0, 8)}</span>
            </div>

            <div className="summary-grid">
              <div>
                <span>Rows</span>
                <strong>{dataset.row_count.toLocaleString()}</strong>
              </div>
              <div>
                <span>Columns</span>
                <strong>{dataset.column_count.toLocaleString()}</strong>
              </div>
              <div>
                <span>Table</span>
                <strong>{dataset.table_name}</strong>
              </div>
            </div>

            <div className="schema-list" aria-label="Detected schema">
              {dataset.schema.map((column) => (
                <span className="schema-pill" key={column.name}>
                  {column.name}
                  <small>{column.inferred_type}</small>
                </span>
              ))}
            </div>
          </section>
        )}

        {dataset && activeView === "filters" && (
          <DynamicFiltersPanel
            schema={dataset.schema}
            filterValues={filterValues}
            applying={isFiltering}
            errorMessage={errorMessage}
            onFilterChange={updateFilter}
            onApplyFilters={applyFilters}
            onResetFilters={resetFilters}
          />
        )}

        {dataset && activeView === "queryBuilder" && (
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
        )}

        {dataset && activeView === "results" && (
          <section className="workspace-grid" aria-label="Data exploration workspace">
            <aside className="session-panel">
              <div>
                <p className="section-label">Session</p>
                <h2>{dataset.original_filename}</h2>
              </div>
              <div className="session-stat-list">
                <span>{dataset.table_name}</span>
                <strong>{dataset.row_count.toLocaleString()} rows</strong>
                <strong>{dataset.column_count.toLocaleString()} columns</strong>
              </div>
              <div className="schema-type-list">
                {Object.entries(schemaTypeSummary).map(([type, count]) => (
                  <span key={type}>
                    {type}
                    <strong>{count}</strong>
                  </span>
                ))}
              </div>
              <div className="active-context">
                <p>Active filters</p>
                {activeFilterLabels.length > 0 ? (
                  activeFilterLabels.map((label) => <span key={label}>{label}</span>)
                ) : (
                  <small>No filters applied</small>
                )}
              </div>
              <div className="active-context">
                <p>Active groupings</p>
                {queryGroupBy.length > 0 ? (
                  queryGroupBy.map((column) => <span key={column}>{column}</span>)
                ) : (
                  <small>No grouped query active</small>
                )}
              </div>
            </aside>

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
                    onTabChange={setActiveResultTab}
                  />
                  <button type="button" className="secondary-button" onClick={exportCurrentResults}>
                    {isExporting ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              }
            />

            <aside className="history-panel">
              <div>
                <p className="section-label">History</p>
                <h2>Query activity</h2>
              </div>
              {queryHistory.length === 0 ? (
                <p className="history-empty">Run filters or queries to build a session trail.</p>
              ) : (
                <div className="history-list">
                  {queryHistory.map((item) => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.action}</strong>
                        <time>{item.timestamp}</time>
                      </div>
                      <p>{item.detail}</p>
                      <span>{item.resultCount.toLocaleString()} rows</span>
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </section>
        )}

          {!dataset && activeView !== "welcome" && (
            <section className="empty-state">
              <p className="section-label">No dataset</p>
              <h2>Open a CSV file to activate this workspace view</h2>
              <p>Use the sidebar Open File action or return to Welcome to upload a dataset.</p>
            </section>
          )}

          {dataset && activeView === "history" && (
            <section className="history-panel standalone-panel">
              <div>
                <p className="section-label">History</p>
                <h2>Query activity</h2>
              </div>
              {queryHistory.length === 0 ? (
                <p className="history-empty">Run filters or queries to build a session trail.</p>
              ) : (
                <div className="history-list">
                  {queryHistory.map((item) => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.action}</strong>
                        <time>{item.timestamp}</time>
                      </div>
                      <p>{item.detail}</p>
                      <span>{item.resultCount.toLocaleString()} rows</span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {dataset && activeView === "export" && (
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
          )}

          {activeView === "settings" && (
            <section className="settings-panel standalone-panel">
              <div>
                <p className="section-label">Settings</p>
                <h2>Workspace settings</h2>
                <p>Settings will live here as the workspace grows.</p>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
