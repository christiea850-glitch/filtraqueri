import { type ChangeEvent, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

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
};

type AggregationState = {
  id: number;
  function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
  column: string;
};

type QueryBuilderResponse = {
  columns: string[];
  rows: Record<string, unknown>[];
};

function App() {
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, FilterState>>({});
  const [querySelectedColumns, setQuerySelectedColumns] = useState<string[]>([]);
  const [queryGroupBy, setQueryGroupBy] = useState<string[]>([]);
  const [queryAggregations, setQueryAggregations] = useState<AggregationState[]>([
    { id: 1, function: "COUNT", column: "" },
  ]);
  const [querySortColumn, setQuerySortColumn] = useState("");
  const [querySortDirection, setQuerySortDirection] = useState<"ASC" | "DESC">("ASC");
  const [queryLimit, setQueryLimit] = useState("100");
  const [queryResultColumns, setQueryResultColumns] = useState<string[]>([]);
  const [queryResultRows, setQueryResultRows] = useState<Record<string, unknown>[]>([]);
  const [hasRunQuery, setHasRunQuery] = useState(false);
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
    setQuerySelectedColumns([]);
    setQueryGroupBy([]);
    setQueryAggregations([{ id: 1, function: "COUNT", column: "" }]);
    setQuerySortColumn("");
    setQuerySortDirection("ASC");
    setQueryResultColumns([]);
    setQueryResultRows([]);
    setHasRunQuery(false);

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
      setFilteredCount(null);
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
          limit: 25,
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
          limit: 25,
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
          limit: Number(queryLimit) || 100,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail || "The visual query could not be run.");
      }

      const queryResult = payload as QueryBuilderResponse;
      setQueryResultColumns(queryResult.columns);
      setQueryResultRows(queryResult.rows);
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

  return (
    <div className="app">
      <div className="card">
        <header className="brand-header">
          <div className="brand-lockup" aria-label="FiltraQueri">
            <div className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" role="img">
                <path
                  className="mark-funnel"
                  d="M9 11h30L28 24.5v8.7l-8 4.3v-13L9 11Z"
                />
                <path className="mark-search" d="M30 29.5a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
                <path className="mark-handle" d="m34.5 34.5 5 5" />
              </svg>
            </div>
            <h1>
              <span>Filtra</span>
              <span>Queri</span>
            </h1>
          </div>
          <p className="tagline">Simple Data Intelligence for Everyone</p>
          <p className="subtitle">Ask Your Data Naturally</p>
        </header>

        <div className="upload-box">
          <div className="upload-icon" aria-hidden="true">
            CSV
          </div>
          <div>
            <p className="upload-title">Upload your dataset</p>
            <p className="upload-helper">Upload a CSV file to begin exploring your data.</p>
          </div>
          <input type="file" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
          {isUploading && <p className="status-message">Uploading and profiling your dataset...</p>}
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>

        {dataset && (
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

        {dataset && (
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

        {dataset && (
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

        {hasRunQuery && !isRunningQuery && queryResultRows.length === 0 && (
          <section className="empty-state" aria-label="No query results">
            <p className="section-label">Query results</p>
            <h2>No rows returned</h2>
            <p>Try selecting more columns, broadening filters, or increasing the row limit.</p>
          </section>
        )}

        {queryResultRows.length > 0 && (
          <section className="preview-section" aria-label="Query results">
            <div className="preview-heading">
              <p className="section-label">Query results</p>
              <p>Showing {queryResultRows.length.toLocaleString()} generated rows</p>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {queryResultColumns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {queryResultRows.map((row, index) => (
                    <tr key={index}>
                      {queryResultColumns.map((column) => (
                        <td key={column}>{String(row[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {dataset && data.length === 0 && !isFiltering && (
          <section className="empty-state" aria-label="No matching rows">
            <p className="section-label">Preview</p>
            <h2>No rows match the current filters</h2>
            <p>Reset the filters or broaden your selections to see preview rows.</p>
          </section>
        )}

        {data.length > 0 && (
          <section className="preview-section" aria-label="Dataset preview">
            <div className="preview-heading">
              <p className="section-label">Preview</p>
              <p>
                Showing {data.length.toLocaleString()} backend-generated rows
                {filteredCount !== null &&
                  ` from ${filteredCount.toLocaleString()} matching rows`}
              </p>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {data.map((row, index) => (
                    <tr key={index}>
                      {columns.map((column) => (
                        <td key={column}>{String(row[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
