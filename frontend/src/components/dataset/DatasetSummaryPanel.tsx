import type { DatasetMetadata, DatasetSession } from "../../features/dataset/datasetTypes";

export type HumanIntent =
  | "summary"
  | "missing_values"
  | "top_categories"
  | "compare_columns"
  | "trends"
  | "unusual_values"
  | "simple_chart";

export type HumanGuidanceCard = {
  intent: HumanIntent;
  label: string;
};

type DatasetSummaryPanelProps = {
  dataset: DatasetMetadata | null;
  recentDatasets: DatasetSession[];
  onViewPreview: () => void;
  onHumanIntentSelect: (intent: HumanIntent) => void;
  onOpenDataset: () => void;
  onActivateRecentDataset: (datasetId: string) => void;
  onRemoveRecentDataset: (datasetId: string) => void;
  onClearCurrentDataset: () => void;
  onDeleteDataset: (datasetId: string) => void;
};

export const humanGuidanceCards: HumanGuidanceCard[] = [
  { intent: "summary", label: "Summarize this dataset" },
  { intent: "missing_values", label: "Find missing values" },
  { intent: "top_categories", label: "Show top categories" },
  { intent: "compare_columns", label: "Compare two columns" },
  { intent: "trends", label: "Find trends" },
  { intent: "unusual_values", label: "Find unusual values" },
  { intent: "simple_chart", label: "Create simple chart" },
];

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
        <h2 title={dataset.original_filename}>{dataset.original_filename}</h2>
      </div>
      <div className="session-stat-list">
        <span title={dataset.table_name}>{dataset.table_name}</span>
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
          activeFilterLabels.map((label) => (
            <span key={label} title={label}>
              {label}
            </span>
          ))
        ) : (
          <small>No filters applied</small>
        )}
      </div>
      <div className="active-context">
        <p>Active groupings</p>
        {queryGroupBy.length > 0 ? (
          queryGroupBy.map((column) => (
            <span key={column} title={column}>
              {column}
            </span>
          ))
        ) : (
          <small>No grouped query active</small>
        )}
      </div>
    </aside>
  );
}

function DatasetSummaryPanel({
  dataset,
  recentDatasets,
  onViewPreview,
  onHumanIntentSelect,
  onOpenDataset,
  onActivateRecentDataset,
  onRemoveRecentDataset,
  onClearCurrentDataset,
  onDeleteDataset,
}: DatasetSummaryPanelProps) {
  const createSchemaTypeSummary = (metadata: DatasetMetadata) =>
    metadata.schema.reduce<Record<string, number>>((summary, column) => {
      summary[column.inferred_type] = (summary[column.inferred_type] || 0) + 1;
      return summary;
    }, {});

  return (
    <div className="human-dataset-workspace">
      <section className="dataset-hub-panel" aria-label="Dataset management hub">
        <div className="summary-header">
          <div>
            <p className="section-label">Dataset Hub</p>
            <h2>{dataset ? "Manage your current dataset" : "Open a dataset to begin"}</h2>
          </div>
          <div className="dataset-summary-actions dataset-hub-actions">
            <button type="button" className="primary-button" onClick={onOpenDataset}>
              Open or upload CSV
            </button>
            {dataset && (
              <button type="button" className="secondary-button" onClick={onClearCurrentDataset}>
                Clear current session
              </button>
            )}
          </div>
        </div>

        {dataset ? (
          <div className="dataset-current-card">
            <div className="dataset-card-main">
              <span className="dataset-id">ID: {dataset.dataset_id.slice(0, 8)}</span>
              <h3 title={dataset.original_filename}>{dataset.original_filename}</h3>
              <p title={dataset.table_name}>{dataset.table_name}</p>
            </div>
            <div className="summary-grid dataset-hub-stats">
              <div>
                <span>Rows</span>
                <strong>{dataset.row_count.toLocaleString()}</strong>
              </div>
              <div>
                <span>Columns</span>
                <strong>{dataset.column_count.toLocaleString()}</strong>
              </div>
              {Object.entries(createSchemaTypeSummary(dataset)).map(([type, count]) => (
                <div key={type}>
                  <span>{type}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
            <div className="dataset-card-actions">
              <button type="button" className="secondary-button" onClick={onViewPreview}>
                View data preview
              </button>
              <button
                type="button"
                className="text-button danger-text-button"
                onClick={() => onDeleteDataset(dataset.dataset_id)}
              >
                Delete dataset
              </button>
            </div>
          </div>
        ) : (
          <div className="dataset-empty-guidance">
            <p>
              Upload a CSV to activate filters, query builder, results, and guided Human Mode
              workflows.
            </p>
            <button type="button" className="primary-button" onClick={onOpenDataset}>
              Choose a CSV file
            </button>
          </div>
        )}
      </section>

      <section className="dataset-hub-panel" aria-label="Recent datasets">
        <div className="summary-header">
          <div>
            <p className="section-label">Recent datasets</p>
            <h2>Session library</h2>
          </div>
          <span className="dataset-count-pill">{recentDatasets.length} saved</span>
        </div>

        {recentDatasets.length === 0 ? (
          <div className="dataset-empty-guidance compact-dataset-empty">
            <p>No recent datasets yet. Upload a CSV and it will appear here for quick access.</p>
          </div>
        ) : (
          <div className="recent-dataset-list">
            {recentDatasets.map((session) => {
              const metadata = session.dataset;
              const typeSummary = createSchemaTypeSummary(metadata);

              return (
                <article className="recent-dataset-card" key={metadata.dataset_id}>
                  <div className="dataset-card-main">
                    <h3 title={metadata.original_filename}>{metadata.original_filename}</h3>
                    <p title={metadata.table_name}>{metadata.table_name}</p>
                  </div>
                  <div className="recent-dataset-meta">
                    <span>{metadata.row_count.toLocaleString()} rows</span>
                    <span>{metadata.column_count.toLocaleString()} columns</span>
                    {Object.entries(typeSummary)
                      .slice(0, 4)
                      .map(([type, count]) => (
                        <span key={type}>
                          {type}: {count}
                        </span>
                      ))}
                  </div>
                  <div className="dataset-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onActivateRecentDataset(metadata.dataset_id)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onRemoveRecentDataset(metadata.dataset_id)}
                    >
                      Remove recent
                    </button>
                    <button
                      type="button"
                      className="text-button danger-text-button"
                      onClick={() => onDeleteDataset(metadata.dataset_id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {dataset && (
        <section className="human-guidance-panel" aria-label="Human mode data guidance">
          <div>
            <p className="section-label">Guided analysis</p>
            <h2>What do you want to understand?</h2>
            <p>
              Start with a no-code question. FiltraQueri will keep heavy dataset work on the
              backend as the guidance layer grows.
            </p>
          </div>
          <div className="human-suggestion-grid">
            {humanGuidanceCards.map((suggestion) => (
              <button
                type="button"
                key={suggestion.intent}
                onClick={() => onHumanIntentSelect(suggestion.intent)}
              >
                <strong>{suggestion.label}</strong>
                <span>Human Mode</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default DatasetSummaryPanel;
