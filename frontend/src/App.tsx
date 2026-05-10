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

function App() {
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, FilterState>>({});
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
