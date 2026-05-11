import type { SchemaColumn } from "../../features/dataset/datasetTypes";
import type { AggregationState } from "../../features/query-builder/queryBuilderTypes";
import type { SortDirection } from "../../features/results/resultTypes";

type VisualQueryBuilderPanelProps = {
  schema: SchemaColumn[];
  selectedColumns: string[];
  groupBy: string[];
  aggregations: AggregationState[];
  sortOptions: string[];
  sortColumn: string;
  sortDirection: SortDirection;
  rowLimit: string;
  running: boolean;
  errorMessage?: string;
  onToggleSelectedColumn: (column: string) => void;
  onGroupByChange: (columns: string[]) => void;
  onAddAggregation: () => void;
  onUpdateAggregation: (id: number, value: Partial<AggregationState>) => void;
  onRemoveAggregation: (id: number) => void;
  onSortColumnChange: (column: string) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  onRowLimitChange: (limit: string) => void;
  onRunQuery: () => void;
};

function VisualQueryBuilderPanel({
  schema,
  selectedColumns,
  groupBy,
  aggregations,
  sortOptions,
  sortColumn,
  sortDirection,
  rowLimit,
  running,
  errorMessage,
  onToggleSelectedColumn,
  onGroupByChange,
  onAddAggregation,
  onUpdateAggregation,
  onRemoveAggregation,
  onSortColumnChange,
  onSortDirectionChange,
  onRowLimitChange,
  onRunQuery,
}: VisualQueryBuilderPanelProps) {
  return (
    <section className="query-builder-panel" aria-label="Visual query builder">
      <div className="query-builder-header">
        <div>
          <p className="section-label">Query builder</p>
          <h2>Build an analytical result</h2>
        </div>
        <button type="button" className="primary-button" onClick={onRunQuery}>
          {running ? "Running..." : "Run query"}
        </button>
      </div>

      <div className="builder-grid">
        <div className="builder-block">
          <div className="builder-block-header">
            <span>Visible columns</span>
            <small>{selectedColumns.length} selected</small>
          </div>
          <div className="field-chip-grid">
            {schema.map((column) => (
              <label className="field-chip" key={column.name}>
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(column.name)}
                  onChange={() => onToggleSelectedColumn(column.name)}
                />
                {column.name}
              </label>
            ))}
          </div>
        </div>

        <div className="builder-block">
          <div className="builder-block-header">
            <span>Group by</span>
            <small>{groupBy.length} grouped</small>
          </div>
          <select
            multiple
            value={groupBy}
            onChange={(event) =>
              onGroupByChange(Array.from(event.target.selectedOptions, (option) => option.value))
            }
          >
            {schema.map((column) => (
              <option key={column.name} value={column.name}>
                {column.name}
              </option>
            ))}
          </select>
        </div>

        <div className="builder-block wide-block">
          <div className="builder-block-header">
            <span>Aggregations</span>
            <button type="button" className="text-button" onClick={onAddAggregation}>
              Add
            </button>
          </div>
          <div className="aggregation-list">
            {aggregations.map((aggregation) => (
              <div className="aggregation-row" key={aggregation.id}>
                <select
                  value={aggregation.function}
                  onChange={(event) =>
                    onUpdateAggregation(aggregation.id, {
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
                    onUpdateAggregation(aggregation.id, { column: event.target.value })
                  }
                >
                  {aggregation.function === "COUNT" && <option value="">All rows</option>}
                  {schema
                    .filter(
                      (column) =>
                        aggregation.function === "COUNT" || column.inferred_type === "numeric",
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
                  onClick={() => onRemoveAggregation(aggregation.id)}
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
            <small>{sortDirection}</small>
          </div>
          <div className="sort-controls">
            <select value={sortColumn} onChange={(event) => onSortColumnChange(event.target.value)}>
              <option value="">No sorting</option>
              {Array.from(new Set(sortOptions)).map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <select
              value={sortDirection}
              onChange={(event) => onSortDirectionChange(event.target.value as SortDirection)}
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
            value={rowLimit}
            onChange={(event) => onRowLimitChange(event.target.value)}
          />
        </div>
      </div>

      {running && <p className="status-message">Running query in DuckDB...</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </section>
  );
}

export default VisualQueryBuilderPanel;
