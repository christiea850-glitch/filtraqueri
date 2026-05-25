import { useMemo, useState } from "react";
import SqlEditorHost from "./SqlEditorHost";
import type {
  SqlEditorInterface,
  SqlDialectContext,
  SqlExecutionStatus,
  SqlGuidanceCard,
  SqlValidationSummary,
} from "./sqlTypes";

type SqlEditorPanelProps = {
  editor: SqlEditorInterface;
  executionStatus: SqlExecutionStatus;
  characterCount: number;
  canRunQuery: boolean;
  canOpenResultPreview: boolean;
  onOpenResultPreview: () => void;
  onOpenSavedDrafts: () => void;
  onInsertSql: (sql: string) => void;
  dialectContext: SqlDialectContext;
};

const statusLabels: Record<SqlExecutionStatus, string> = {
  idle: "Ready",
  "draft-saved": "Query saved to Saved Drafts",
  "explain-ready": "Explain placeholder ready",
  running: "Running query",
  success: "Query complete",
  error: "Query failed",
};

function SqlHelpersPopup({
  editor,
  onInsertSql,
  onClose,
}: {
  editor: SqlEditorInterface;
  onInsertSql: (sql: string) => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTemplates = useMemo(
    () =>
      editor.templates.filter((template) =>
        [template.label, template.description, template.category, template.sql]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [editor.templates, normalizedQuery],
  );
  const filteredKeywords = useMemo(
    () =>
      editor.keywordSuggestions.filter((keyword) =>
        keyword.toLowerCase().includes(normalizedQuery),
      ),
    [editor.keywordSuggestions, normalizedQuery],
  );
  const insertSql = (sql: string) => {
    onInsertSql(sql);
    onClose();
  };

  return (
    <div className="sql-helper-popover" role="dialog" aria-label="SQL helpers">
      <div className="sql-helper-popover-head">
        <div>
          <span>SQL helpers</span>
          <strong>Templates and keywords</strong>
        </div>
        <button type="button" className="sqlw-dock-x" onClick={onClose} aria-label="Close SQL helpers">
          Close
        </button>
      </div>
      <label className="sql-helper-search">
        <span>Search helpers</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Template, keyword, or SQL pattern"
          autoFocus
        />
      </label>
      <div className="sql-helper-popover-body">
        <section className="sql-helper-picker-section">
          <div className="builder-block-header">
            <span>Templates</span>
            <small>{filteredTemplates.length} shown</small>
          </div>
          <div className="sql-template-list sql-helper-picker-list">
            {filteredTemplates.map((template) => (
              <button type="button" key={template.id} onClick={() => insertSql(template.sql)}>
                <strong>{template.label}</strong>
                <span>{template.description}</span>
                <small>{template.category}</small>
              </button>
            ))}
            {filteredTemplates.length === 0 && (
              <p className="sql-helper-empty">No templates match your search.</p>
            )}
          </div>
        </section>
        <section className="sql-helper-picker-section">
          <div className="builder-block-header">
            <span>Keywords</span>
            <small>{filteredKeywords.length} shown</small>
          </div>
          <div className="sql-keyword-list sql-helper-keyword-list">
            {filteredKeywords.map((keyword) => (
              <button type="button" key={keyword} onClick={() => insertSql(keyword)}>
                {keyword}
              </button>
            ))}
            {filteredKeywords.length === 0 && (
              <p className="sql-helper-empty">No keywords match your search.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SqlEditorPanel({
  editor,
  executionStatus,
  characterCount,
  canRunQuery,
  canOpenResultPreview,
  onOpenResultPreview,
  onOpenSavedDrafts,
  onInsertSql,
  dialectContext,
}: SqlEditorPanelProps) {
  const [isHelperOpen, setIsHelperOpen] = useState(false);

  return (
    <section className="sql-editor-panel" aria-label="SQL editor">
      <div className="sql-editor-toolbar">
        <div className="sql-actions">
          <label className="sql-dialect-selector">
            <span>Dialect</span>
            <select
              value={dialectContext.selectedDialect}
              onChange={(event) =>
                dialectContext.onDialectChange(event.target.value as SqlDialectContext["selectedDialect"])
              }
              aria-label="SQL dialect context"
            >
              {dialectContext.dialectOptions.map((dialect) => (
                <option key={dialect.id} value={dialect.id}>
                  {dialect.displayName}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primary-button" onClick={editor.onRun} disabled={!canRunQuery}>
            Run query
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onOpenResultPreview}
            disabled={!canOpenResultPreview}
          >
            Result Preview
          </button>
          <button type="button" className="secondary-button" onClick={editor.onSaveDraft}>
            Save Query
          </button>
          <button type="button" className="secondary-button" onClick={onOpenSavedDrafts}>
            Saved Drafts
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsHelperOpen((currentValue) => !currentValue)}
            aria-expanded={isHelperOpen}
          >
            SQL helpers
          </button>
          <button type="button" className="text-button" onClick={editor.onClear}>
            Clear
          </button>
        </div>
        {isHelperOpen && (
          <SqlHelpersPopup
            editor={editor}
            onInsertSql={onInsertSql}
            onClose={() => setIsHelperOpen(false)}
          />
        )}
      </div>

      <SqlEditorHost editor={editor} />

      <div className="sql-editor-footer">
        <span>{statusLabels[executionStatus]}</span>
        <span>{characterCount.toLocaleString()} characters</span>
      </div>
    </section>
  );
}

type SqlGuidancePanelProps = {
  diagnostics: SqlEditorInterface["diagnostics"];
  guidanceCards: SqlGuidanceCard[];
  dialectContext: Pick<SqlDialectContext, "selectedDialectProfile">;
  validation: SqlValidationSummary;
};

export function SqlGuidancePanel({
  diagnostics,
  guidanceCards,
  dialectContext,
  validation,
}: SqlGuidancePanelProps) {
  const visibleDiagnostics = diagnostics.slice(0, 4);
  const functionCount = diagnostics.filter((diagnostic) => diagnostic.source === "function").length;
  const conceptCount = diagnostics.filter((diagnostic) => diagnostic.source === "concept").length;
  const safetyCount = validation.diagnostics.filter(
    (diagnostic) => diagnostic.category === "safety",
  ).length;

  return (
    <section className="sql-draft-panel" aria-label="SQL guidance">
      <div className="sql-draft-list" aria-label="SQL guidance notes">
        <div className="builder-block-header">
          <span>SQL guidance</span>
          <small>{diagnostics.length} notes</small>
        </div>
        <div className="sql-guidance-context">
          <strong>{dialectContext.selectedDialectProfile.displayName}</strong>
          <span>
            {functionCount} functions | {conceptCount} concepts | {safetyCount} safety
          </span>
        </div>
        {visibleDiagnostics.length === 0 && guidanceCards.length === 0 ? (
          <p>No SQL guidance yet.</p>
        ) : (
          <>
            {visibleDiagnostics.map((diagnostic) => (
              <article key={diagnostic.id}>
                <strong>{diagnostic.title}</strong>
                <span>{diagnostic.message}</span>
              </article>
            ))}
            {guidanceCards.map((card) => (
              <article key={card.id}>
                <strong>{card.title}</strong>
                <span>{card.detail || card.summary}</span>
              </article>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

export default SqlEditorPanel;
