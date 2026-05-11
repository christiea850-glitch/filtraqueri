import type { DatasetMetadata } from "../../features/dataset/datasetTypes";

type DatasetSummaryPanelProps = {
  dataset: DatasetMetadata;
};

type DatasetSessionPanelProps = {
  dataset: DatasetMetadata;
  schemaTypeSummary: Record<string, number>;
  activeFilterLabels: string[];
  queryGroupBy: string[];
};

export function DatasetSessionPanel({
  dataset,
  schemaTypeSummary,
  activeFilterLabels,
  queryGroupBy,
}: DatasetSessionPanelProps) {
  return (
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
  );
}

function DatasetSummaryPanel({ dataset }: DatasetSummaryPanelProps) {
  return (
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
  );
}

export default DatasetSummaryPanel;
