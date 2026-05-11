import type { SchemaColumn } from "../../features/dataset/datasetTypes";
import type { FilterState } from "../../features/filters/filterTypes";

type DynamicFiltersPanelProps = {
  schema: SchemaColumn[];
  filterValues: Record<string, FilterState>;
  applying: boolean;
  errorMessage?: string;
  onFilterChange: (columnName: string, value: FilterState) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
};

function DynamicFiltersPanel({
  schema,
  filterValues,
  applying,
  errorMessage,
  onFilterChange,
  onApplyFilters,
  onResetFilters,
}: DynamicFiltersPanelProps) {
  const formatDateValue = (value: unknown) => {
    if (!value) return "";
    return String(value).slice(0, 10);
  };

  return (
    <section className="filters-panel" aria-label="Dynamic filters">
      <div className="filters-header">
        <div>
          <p className="section-label">Smart filters</p>
          <h2>Refine the preview</h2>
        </div>
        <div className="filter-actions">
          <button type="button" className="secondary-button" onClick={onResetFilters}>
            Reset
          </button>
          <button type="button" className="primary-button" onClick={onApplyFilters}>
            {applying ? "Applying..." : "Apply filters"}
          </button>
        </div>
      </div>

      <div className="filters-grid">
        {schema.map((column) => {
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
                    onChange={(event) => onFilterChange(column.name, { min: event.target.value })}
                  />
                  <input
                    type="number"
                    placeholder={column.max !== undefined ? String(column.max) : "Max"}
                    value={currentFilter.max || ""}
                    onChange={(event) => onFilterChange(column.name, { max: event.target.value })}
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
                    onChange={(event) => onFilterChange(column.name, { start: event.target.value })}
                  />
                  <input
                    type="date"
                    min={formatDateValue(column.min)}
                    max={formatDateValue(column.max)}
                    value={currentFilter.end || ""}
                    onChange={(event) => onFilterChange(column.name, { end: event.target.value })}
                  />
                </div>
              )}

              {column.inferred_type === "boolean" && (
                <select
                  value={currentFilter.value || ""}
                  onChange={(event) => onFilterChange(column.name, { value: event.target.value })}
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
                    onFilterChange(column.name, {
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
                {column.unique_count.toLocaleString()} unique, {column.null_count.toLocaleString()}{" "}
                empty
              </p>
            </div>
          );
        })}
      </div>

      {applying && <p className="status-message">Filtering rows in DuckDB...</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </section>
  );
}

export default DynamicFiltersPanel;
