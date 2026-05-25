import type { DatasetMetadata } from "../../dataset/datasetTypes";

type SqlSchemaPanelProps = {
  dataset: DatasetMetadata | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onInsertSql: (sql: string) => void;
};

function SqlSchemaPanel({
  dataset,
  collapsed,
  onToggleCollapsed,
  onInsertSql,
}: SqlSchemaPanelProps) {
  return (
    <aside className="sql-context-panel" aria-label="SQL schema intelligence">
      <button
        type="button"
        className="panel-collapse-button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand SQL schema tools" : "Collapse SQL schema tools"}
      >
        {collapsed ? "Schema" : "Hide schema"}
      </button>

      <div className="sql-context-body">
        <div className="sql-helper-section">
          <div className="builder-block-header">
            <span>Columns</span>
            <small>{dataset ? `${dataset.schema.length}` : "0"}</small>
          </div>
          <div className="schema-list sql-schema-list" aria-label="SQL available columns">
            {dataset ? (
              dataset.schema.map((column) => (
                <button
                  type="button"
                  className="schema-pill sql-schema-chip"
                  key={column.name}
                  onClick={() => onInsertSql(`"${column.name.replace(/"/g, '""')}"`)}
                >
                  {column.name}
                  <small>{column.inferred_type}</small>
                </button>
              ))
            ) : (
              <p className="sql-helper-empty">No dataset open.</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default SqlSchemaPanel;
