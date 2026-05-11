import { useMemo, useState } from "react";
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
  onSelectedColumnsChange: (columns: string[]) => void;
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
  onSelectedColumnsChange,
  onGroupByChange,
  onAddAggregation,
  onUpdateAggregation,
  onRemoveAggregation,
  onSortColumnChange,
  onSortDirectionChange,
  onRowLimitChange,
  onRunQuery,
}: VisualQueryBuilderPanelProps) {
  const [columnSearch, setColumnSearch] = useState("");
  const [isGroupByCollapsed, setIsGroupByCollapsed] = useState(false);
  const [isAnalysisCollapsed, setIsAnalysisCollapsed] = useState(false);
  const normalizedSearch = columnSearch.trim().toLowerCase();
  const visibleSchema = useMemo(
    () =>
      normalizedSearch
        ? schema.filter(
            (column) =>
              column.name.toLowerCase().includes(normalizedSearch) ||
              column.inferred_type.toLowerCase().includes(normalizedSearch),
          )
        : schema,
    [normalizedSearch, schema],
  );
  const numericColumns = schema
    .filter((column) => column.inferred_type === "numeric")
    .map((column) => column.name);
  const categoricalColumns = schema
    .filter((column) => column.inferred_type === "categorical" || column.inferred_type === "text")
    .map((column) => column.name);
  const recommendedColumns = useMemo(() => {
    const meaningfulMix = [
      ...schema.filter((column) => column.inferred_type === "date").slice(0, 2),
      ...schema.filter((column) => column.inferred_type === "categorical").slice(0, 3),
      ...schema.filter((column) => column.inferred_type === "numeric").slice(0, 3),
      ...schema.filter((column) => column.inferred_type === "text").slice(0, 2),
    ].map((column) => column.name);

    return Array.from(
      new Set(meaningfulMix.length > 0 ? meaningfulMix : schema.map((column) => column.name)),
    ).slice(0, 8);
  }, [schema]);

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

      <div
        className={[
          "builder-grid",
          isGroupByCollapsed ? "is-group-collapsed" : "",
          isAnalysisCollapsed ? "is-analysis-collapsed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="builder-block query-column-block">
          <div className="builder-block-header">
            <span>Visible columns</span>
            <small>
              {selectedColumns.length} selected, {schema.length} available
            </small>
          </div>

          <div className="query-column-controls">
            <label className="query-column-search">
              <span>Search columns</span>
              <input
                type="search"
                value={columnSearch}
                onChange={(event) => setColumnSearch(event.target.value)}
                placeholder="Column name or type"
              />
            </label>

            <div className="query-bulk-actions" aria-label="Visible column bulk actions">
              <button
                type="button"
                className="text-button"
                onClick={() => onSelectedColumnsChange(schema.map((column) => column.name))}
              >
                Select All
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onSelectedColumnsChange([])}
              >
                Clear All
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onSelectedColumnsChange(numericColumns)}
              >
                Numeric Only
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onSelectedColumnsChange(categoricalColumns)}
              >
                Categorical Only
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onSelectedColumnsChange(recommendedColumns)}
              >
                Recommended
              </button>
            </div>
          </div>

          <div className="field-chip-scroll">
            <div className="field-chip-grid">
              {visibleSchema.map((column) => (
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

            {visibleSchema.length === 0 && (
              <p className="query-column-empty">No columns match your search.</p>
            )}
          </div>
        </div>

        <div className="builder-block query-group-block">
          <div className="builder-block-header">
            <span>Group by</span>
            <small>{groupBy.length} grouped</small>
            <button
              type="button"
              className="text-button compact-toggle"
              onClick={() => setIsGroupByCollapsed((currentValue) => !currentValue)}
            >
              {isGroupByCollapsed ? "Show" : "Hide"}
            </button>
          </div>
          {isGroupByCollapsed ? (
            <button
              type="button"
              className="collapsed-panel-bar"
              onClick={() => setIsGroupByCollapsed(false)}
            >
              Group By hidden - {groupBy.length} grouped
            </button>
          ) : (
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
          )}
        </div>

        <div className="builder-block wide-block">
          <div className="builder-block-header">
            <span>Aggregations</span>
            <small>{aggregations.length} configured</small>
            <div className="builder-header-actions">
              <button
                type="button"
                className="text-button compact-toggle"
                onClick={() => setIsAnalysisCollapsed((currentValue) => !currentValue)}
              >
                {isAnalysisCollapsed ? "Show" : "Hide"}
              </button>
              {!isAnalysisCollapsed && (
                <button type="button" className="text-button" onClick={onAddAggregation}>
                  Add
                </button>
              )}
            </div>
          </div>
          {isAnalysisCollapsed ? (
            <button
              type="button"
              className="collapsed-panel-bar"
              onClick={() => setIsAnalysisCollapsed(false)}
            >
              Aggregations, sort, and row limit hidden
            </button>
          ) : (
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
          )}
        </div>

        {!isAnalysisCollapsed && (
          <div className="builder-block">
            <div className="builder-block-header">
              <span>Sort</span>
              <small>{sortDirection}</small>
            </div>
            <div className="sort-controls">
              <select
                value={sortColumn}
                onChange={(event) => onSortColumnChange(event.target.value)}
              >
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
        )}

        {!isAnalysisCollapsed && (
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
        )}
      </div>

      {running && <p className="status-message">Running query in DuckDB...</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </section>
  );
}

export default VisualQueryBuilderPanel;
