import { type ChangeEvent, useRef, useState } from "react";
import ResultsGrid from "./components/results/ResultsGrid";
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

type ActiveView =
  | "welcome"
  | "dataset"
  | "filters"
  | "queryBuilder"
  | "results"
  | "history"
  | "export"
  | "settings";

function App() {
  const sidebarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("welcome");
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, FilterState>>({});
  const [previewPage, setPreviewPage] = useState(1);
  const [previewRowsPerPage, setPreviewRowsPerPage] = useState(25);
  const [previewSortColumn, setPreviewSortColumn] = useState("");
  const [previewSortDirection, setPreviewSortDirection] = useState<SortDirection>("ASC");
  const [previewTotalCount, setPreviewTotalCount] = useState(0);
  const [querySelectedColumns, setQuerySelectedColumns] = useState<string[]>([]);
  const [queryGroupBy, setQueryGroupBy] = useState<string[]>([]);
  const [queryAggregations, setQueryAggregations] = useState<AggregationState[]>([
    { id: 1, function: "COUNT", column: "" },
  ]);
  const [querySortColumn, setQuerySortColumn] = useState("");
  const [querySortDirection, setQuerySortDirection] = useState<SortDirection>("ASC");
  const [queryLimit, setQueryLimit] = useState("100");
  const [queryResultColumns, setQueryResultColumns] = useState<string[]>([]);
  const [queryResultRows, setQueryResultRows] = useState<Record<string, unknown>[]>([]);
  const [queryPage, setQueryPage] = useState(1);
  const [queryRowsPerPage, setQueryRowsPerPage] = useState(25);
  const [queryTotalCount, setQueryTotalCount] = useState(0);
  const [hasRunQuery, setHasRunQuery] = useState(false);
  const [activeResultSource, setActiveResultSource] = useState<"preview" | "query">("preview");
  const [queryHistory, setQueryHistory] = useState<HistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsUploading(true);
    setErrorMessage("");
    setDataset(null);
    setData([]);
    setColumns([]);
    setFilterValues({});
    setFilteredCount(null);
    setPreviewPage(1);
    setPreviewRowsPerPage(25);
    setPreviewSortColumn("");
    setPreviewSortDirection("ASC");
    setPreviewTotalCount(0);
    setQuerySelectedColumns([]);
    setQueryGroupBy([]);
    setQueryAggregations([{ id: 1, function: "COUNT", column: "" }]);
    setQuerySortColumn("");
    setQuerySortDirection("ASC");
    setQueryResultColumns([]);
    setQueryResultRows([]);
    setQueryPage(1);
    setQueryRowsPerPage(25);
    setQueryTotalCount(0);
    setHasRunQuery(false);
    setActiveResultSource("preview");
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
      setDataset(uploadResult.dataset);
      setData(uploadResult.preview);
      setColumns(uploadResult.dataset.schema.map((column) => column.name));
      setQuerySelectedColumns(uploadResult.dataset.schema.slice(0, 4).map((column) => column.name));
      setPreviewTotalCount(uploadResult.dataset.row_count);
      setFilteredCount(null);
      setActiveView("results");
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

  const formatDateValue = (value: unknown) => {
    if (!value) return "";
    return String(value).slice(0, 10);
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

  const resultRows = activeResultSource === "query" ? queryResultRows : data;
  const resultColumns = activeResultSource === "query" ? queryResultColumns : columns;
  const resultPage = activeResultSource === "query" ? queryPage : previewPage;
  const resultRowsPerPage =
    activeResultSource === "query" ? queryRowsPerPage : previewRowsPerPage;
  const resultTotalCount =
    activeResultSource === "query" ? queryTotalCount : filteredCount ?? previewTotalCount;
  const resultTotalPages = Math.max(1, Math.ceil((resultTotalCount || 0) / resultRowsPerPage));

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
          limit: previewRowsPerPage,
          page: 1,
          order_by: previewSortColumn
            ? {
                column: previewSortColumn,
                direction: previewSortDirection,
              }
            : null,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "Filters could not be applied.");
      }

      const filterResult = payload as FilterResponse;
      setData(filterResult.rows);
      setColumns(filterResult.columns);
      setFilteredCount(filterResult.filtered_count);
      setPreviewTotalCount(filterResult.total_count);
      setPreviewPage(1);
      setActiveResultSource("preview");
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
          limit: previewRowsPerPage,
          page: 1,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "Filters could not be reset.");
      }

      const filterResult = payload as FilterResponse;
      setData(filterResult.rows);
      setColumns(filterResult.columns);
      setFilteredCount(null);
      setPreviewTotalCount(filterResult.total_count);
      setPreviewPage(1);
      setActiveResultSource("preview");
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
    rowsPerPage = previewRowsPerPage,
    sortColumn = previewSortColumn,
    sortDirection = previewSortDirection,
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
          filters: buildBackendFilters(),
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
      setData(filterResult.rows);
      setColumns(filterResult.columns);
      setFilteredCount(filterResult.filtered_count);
      setPreviewTotalCount(filterResult.total_count);
      setPreviewPage(filterResult.page);
      setPreviewRowsPerPage(filterResult.limit);
      setActiveResultSource("preview");
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
          limit: Number(queryLimit) || queryRowsPerPage,
          page: 1,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "The visual query could not be run.");
      }

      const queryResult = payload as QueryBuilderResponse;
      setQueryResultColumns(queryResult.columns);
      setQueryResultRows(queryResult.rows);
      setQueryTotalCount(queryResult.total_count);
      setQueryPage(1);
      setQueryRowsPerPage(queryResult.limit);
      setActiveResultSource("query");
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
    rowsPerPage = queryRowsPerPage,
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
      setQueryResultColumns(queryResult.columns);
      setQueryResultRows(queryResult.rows);
      setQueryTotalCount(queryResult.total_count);
      setQueryPage(queryResult.page);
      setQueryRowsPerPage(queryResult.limit);
      setActiveResultSource("query");
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
      const isQueryExport = activeResultSource === "query" && hasRunQuery;
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
                filters: buildBackendFilters(),
                order_by: previewSortColumn
                  ? {
                      column: previewSortColumn,
                      direction: previewSortDirection,
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
    if (activeResultSource === "query") {
      const nextDirection =
        querySortColumn === column && querySortDirection === "ASC" ? "DESC" : "ASC";
      setQuerySortColumn(column);
      setQuerySortDirection(nextDirection);
      loadQueryPage(1, queryRowsPerPage, column, nextDirection);
      return;
    }

    const nextDirection =
      previewSortColumn === column && previewSortDirection === "ASC" ? "DESC" : "ASC";
    setPreviewSortColumn(column);
    setPreviewSortDirection(nextDirection);
    loadPreviewPage(1, previewRowsPerPage, column, nextDirection);
  };

  const changeWorkspacePage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), resultTotalPages);
    if (activeResultSource === "query") {
      loadQueryPage(nextPage);
      return;
    }

    loadPreviewPage(nextPage);
  };

  const changeWorkspaceRowsPerPage = (rowsPerPage: number) => {
    if (activeResultSource === "query") {
      setQueryRowsPerPage(rowsPerPage);
      setQueryLimit(String(rowsPerPage));
      loadQueryPage(1, rowsPerPage);
      return;
    }

    setPreviewRowsPerPage(rowsPerPage);
    loadPreviewPage(1, rowsPerPage);
  };

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
              sidebarFileInputRef.current?.click();
            }}
          >
            Open File
          </button>
          <input
            ref={sidebarFileInputRef}
            className="sidebar-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
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
            <section className="welcome-screen">
              <div className="welcome-copy">
                <p className="section-label">Workspace</p>
                <h2>Welcome to FiltraQueri</h2>
                <p>Simple Data Intelligence for Everyone</p>
                <div className="welcome-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => sidebarFileInputRef.current?.click()}
                  >
                    Upload CSV to start
                  </button>
                  <button type="button" className="secondary-button">
                    Open recent dataset
                  </button>
                  <button type="button" className="secondary-button">
                    Try sample dataset
                  </button>
                </div>
                <p className="welcome-note">Ask your data naturally</p>
                {isUploading && <p className="status-message">Uploading and profiling your dataset...</p>}
                {errorMessage && <p className="error-message">{errorMessage}</p>}
              </div>
            </section>
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
          <section className="filters-panel" aria-label="Dynamic filters">
            <div className="filters-header">
              <div>
                <p className="section-label">Smart filters</p>
                <h2>Refine the preview</h2>
              </div>
              <div className="filter-actions">
                <button type="button" className="secondary-button" onClick={resetFilters}>
                  Reset
                </button>
                <button type="button" className="primary-button" onClick={applyFilters}>
                  {isFiltering ? "Applying..." : "Apply filters"}
                </button>
              </div>
            </div>

            <div className="filters-grid">
              {dataset.schema.map((column) => {
                const currentFilter = filterValues[column.name] || {};
                const sampleValues = column.sample_values
                  .filter((value) => value !== null && value !== undefined)
                  .map((value) => String(value));

                return (
                  <div className="filter-card" key={column.name}>
                    <div className="filter-card-header">
                      <span>{column.name}</span>
                      <small>{column.inferred_type}</small>
                    </div>

                    {column.inferred_type === "numeric" && (
                      <div className="range-inputs">
                        <input
                          type="number"
                          placeholder={column.min !== undefined ? String(column.min) : "Min"}
                          value={currentFilter.min || ""}
                          onChange={(event) => updateFilter(column.name, { min: event.target.value })}
                        />
                        <input
                          type="number"
                          placeholder={column.max !== undefined ? String(column.max) : "Max"}
                          value={currentFilter.max || ""}
                          onChange={(event) => updateFilter(column.name, { max: event.target.value })}
                        />
                      </div>
                    )}

                    {column.inferred_type === "date" && (
                      <div className="range-inputs">
                        <input
                          type="date"
                          min={formatDateValue(column.min)}
                          max={formatDateValue(column.max)}
                          value={currentFilter.start || ""}
                          onChange={(event) => updateFilter(column.name, { start: event.target.value })}
                        />
                        <input
                          type="date"
                          min={formatDateValue(column.min)}
                          max={formatDateValue(column.max)}
                          value={currentFilter.end || ""}
                          onChange={(event) => updateFilter(column.name, { end: event.target.value })}
                        />
                      </div>
                    )}

                    {column.inferred_type === "boolean" && (
                      <select
                        value={currentFilter.value || ""}
                        onChange={(event) => updateFilter(column.name, { value: event.target.value })}
                      >
                        <option value="">Any value</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    )}

                    {(column.inferred_type === "categorical" || column.inferred_type === "text") && (
                      <select
                        multiple
                        value={currentFilter.values || []}
                        onChange={(event) =>
                          updateFilter(column.name, {
                            values: Array.from(event.target.selectedOptions, (option) => option.value),
                          })
                        }
                      >
                        {sampleValues.length === 0 && <option disabled>No sample values</option>}
                        {sampleValues.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    )}

                    <p>
                      {column.unique_count.toLocaleString()} unique,{" "}
                      {column.null_count.toLocaleString()} empty
                    </p>
                  </div>
                );
              })}
            </div>

            {isFiltering && <p className="status-message">Filtering rows in DuckDB...</p>}
          </section>
        )}

        {dataset && activeView === "queryBuilder" && (
          <section className="query-builder-panel" aria-label="Visual query builder">
            <div className="query-builder-header">
              <div>
                <p className="section-label">Query builder</p>
                <h2>Build an analytical result</h2>
              </div>
              <button type="button" className="primary-button" onClick={runVisualQuery}>
                {isRunningQuery ? "Running..." : "Run query"}
              </button>
            </div>

            <div className="builder-grid">
              <div className="builder-block">
                <div className="builder-block-header">
                  <span>Visible columns</span>
                  <small>{querySelectedColumns.length} selected</small>
                </div>
                <div className="field-chip-grid">
                  {dataset.schema.map((column) => (
                    <label className="field-chip" key={column.name}>
                      <input
                        type="checkbox"
                        checked={querySelectedColumns.includes(column.name)}
                        onChange={() =>
                          setQuerySelectedColumns((currentColumns) =>
                            toggleListValue(currentColumns, column.name),
                          )
                        }
                      />
                      {column.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="builder-block">
                <div className="builder-block-header">
                  <span>Group by</span>
                  <small>{queryGroupBy.length} grouped</small>
                </div>
                <select
                  multiple
                  value={queryGroupBy}
                  onChange={(event) =>
                    setQueryGroupBy(
                      Array.from(event.target.selectedOptions, (option) => option.value),
                    )
                  }
                >
                  {dataset.schema.map((column) => (
                    <option key={column.name} value={column.name}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="builder-block wide-block">
                <div className="builder-block-header">
                  <span>Aggregations</span>
                  <button type="button" className="text-button" onClick={addAggregation}>
                    Add
                  </button>
                </div>
                <div className="aggregation-list">
                  {queryAggregations.map((aggregation) => (
                    <div className="aggregation-row" key={aggregation.id}>
                      <select
                        value={aggregation.function}
                        onChange={(event) =>
                          updateAggregation(aggregation.id, {
                            function: event.target.value as AggregationState["function"],
                            column:
                              event.target.value === "COUNT" && !aggregation.column
                                ? ""
                                : aggregation.column,
                          })
                        }
                      >
                        <option value="COUNT">COUNT</option>
                        <option value="SUM">SUM</option>
                        <option value="AVG">AVG</option>
                        <option value="MIN">MIN</option>
                        <option value="MAX">MAX</option>
                      </select>
                      <select
                        value={aggregation.column}
                        onChange={(event) =>
                          updateAggregation(aggregation.id, { column: event.target.value })
                        }
                      >
                        {aggregation.function === "COUNT" && <option value="">All rows</option>}
                        {dataset.schema
                          .filter(
                            (column) =>
                              aggregation.function === "COUNT" ||
                              column.inferred_type === "numeric",
                          )
                          .map((column) => (
                            <option key={column.name} value={column.name}>
                              {column.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => removeAggregation(aggregation.id)}
                        aria-label="Remove aggregation"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="builder-block">
                <div className="builder-block-header">
                  <span>Sort</span>
                  <small>{querySortDirection}</small>
                </div>
                <div className="sort-controls">
                  <select
                    value={querySortColumn}
                    onChange={(event) => setQuerySortColumn(event.target.value)}
                  >
                    <option value="">No sorting</option>
                    {Array.from(new Set(querySortOptions)).map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                  <select
                    value={querySortDirection}
                    onChange={(event) =>
                      setQuerySortDirection(event.target.value as "ASC" | "DESC")
                    }
                  >
                    <option value="ASC">ASC</option>
                    <option value="DESC">DESC</option>
                  </select>
                </div>
              </div>

              <div className="builder-block">
                <div className="builder-block-header">
                  <span>Row limit</span>
                  <small>Max 1000</small>
                </div>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={queryLimit}
                  onChange={(event) => setQueryLimit(event.target.value)}
                />
              </div>
            </div>

            {isRunningQuery && <p className="status-message">Running query in DuckDB...</p>}
          </section>
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
              title={activeResultSource === "query" ? "Query results" : "Dataset preview"}
              label="Data grid"
              columns={resultColumns}
              rows={resultRows}
              totalCount={resultTotalCount}
              loading={isFiltering || isRunningQuery}
              activeFilterLabels={activeFilterLabels}
              activeSortColumn={
                activeResultSource === "query" ? querySortColumn : previewSortColumn
              }
              activeSortDirection={
                activeResultSource === "query" ? querySortDirection : previewSortDirection
              }
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
                  <div className="result-toggle" aria-label="Result source">
                    <button
                      type="button"
                      className={activeResultSource === "preview" ? "is-active" : ""}
                      onClick={() => setActiveResultSource("preview")}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className={activeResultSource === "query" ? "is-active" : ""}
                      onClick={() => setActiveResultSource("query")}
                      disabled={!hasRunQuery}
                    >
                      Query
                    </button>
                  </div>
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
                  Export the active {activeResultSource === "query" ? "query" : "filtered preview"}{" "}
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
