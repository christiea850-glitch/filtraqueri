import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlSuggestion, SqlTemplate } from "./sqlTypes";

type SqlSchemaPanelProps = {
  dataset: DatasetMetadata;
  columnSuggestions: SqlSuggestion[];
  templates: SqlTemplate[];
  keywordSuggestions: string[];
  onInsertSql: (sql: string) => void;
};

function SqlSchemaPanel({
  dataset,
  columnSuggestions,
  templates,
  keywordSuggestions,
  onInsertSql,
}: SqlSchemaPanelProps) {
  return (
    <aside className="sql-context-panel" aria-label="SQL schema intelligence">
      <div>
        <p className="section-label">Active dataset</p>
        <h2>{dataset.original_filename}</h2>
      </div>
      <div className="session-stat-list">
        <span>{dataset.table_name}</span>
        <strong>{dataset.row_count.toLocaleString()} rows</strong>
        <strong>{dataset.column_count.toLocaleString()} columns</strong>
      </div>

      <div className="sql-helper-section">
        <div className="builder-block-header">
          <span>Columns</span>
          <small>{dataset.schema.length} detected</small>
        </div>
        <div className="schema-list sql-schema-list" aria-label="SQL available columns">
          {dataset.schema.map((column) => (
            <button
              type="button"
              className="schema-pill sql-schema-chip"
              key={column.name}
              onClick={() => onInsertSql(`"${column.name.replace(/"/g, '""')}"`)}
            >
              {column.name}
              <small>{column.inferred_type}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="sql-helper-section">
        <div className="builder-block-header">
          <span>Suggestions</span>
          <small>Insert chips</small>
        </div>
        <div className="sql-suggestion-grid">
          {columnSuggestions.map((suggestion) => (
            <button type="button" key={suggestion.id} onClick={() => onInsertSql(suggestion.sql)}>
              <strong>{suggestion.label}</strong>
              <span>{suggestion.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sql-helper-section">
        <div className="builder-block-header">
          <span>Keywords</span>
          <small>Autocomplete base</small>
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
    </aside>
  );
}

export default SqlSchemaPanel;
