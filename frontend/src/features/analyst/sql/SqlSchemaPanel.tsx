import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlTemplate } from "./sqlTypes";

type SqlSchemaPanelProps = {
  dataset: DatasetMetadata | null;
  templates: SqlTemplate[];
  keywordSuggestions: string[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onInsertSql: (sql: string) => void;
};

function SqlSchemaPanel({
  dataset,
  templates,
  keywordSuggestions,
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

        <div className="sql-helper-section">
          <div className="builder-block-header">
            <span>Keywords</span>
            <small>Autocomplete</small>
          </div>
          <div className="sql-keyword-list">
            {keywordSuggestions.map((keyword) => (
              <button type="button" key={keyword} onClick={() => onInsertSql(keyword)}>
                {keyword}
              </button>
            ))}
          </div>
        </div>

        <div className="sql-helper-section">
          <div className="builder-block-header">
            <span>Templates</span>
            <small>{templates.length} ready</small>
          </div>
          <div className="sql-template-list">
            {templates.map((template) => (
              <button type="button" key={template.id} onClick={() => onInsertSql(template.sql)}>
                <strong>{template.label}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default SqlSchemaPanel;
