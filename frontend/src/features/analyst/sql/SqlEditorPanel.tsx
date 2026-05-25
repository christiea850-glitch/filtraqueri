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
  dialectContext: SqlDialectContext;
};

const statusLabels: Record<SqlExecutionStatus, string> = {
  idle: "Ready",
  "draft-saved": "Draft saved",
  "explain-ready": "Explain placeholder ready",
  running: "Running query",
  success: "Query complete",
  error: "Query failed",
};

function SqlEditorPanel({
  editor,
  executionStatus,
  characterCount,
  canRunQuery,
  canOpenResultPreview,
  onOpenResultPreview,
  onOpenSavedDrafts,
  dialectContext,
}: SqlEditorPanelProps) {
  return (
    <section className="sql-editor-panel" aria-label="SQL editor">
      <div className="sql-editor-toolbar">
        <div>
          <p className="section-label">SQL workspace</p>
          <h2>Query draft</h2>
        </div>
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
          <button type="button" className="secondary-button" onClick={editor.onExplain}>
            Explain query
          </button>
          <button type="button" className="secondary-button" onClick={editor.onSaveDraft}>
            Save draft
          </button>
          <button type="button" className="secondary-button" onClick={onOpenSavedDrafts}>
            Saved Drafts
          </button>
          <button type="button" className="text-button" onClick={editor.onClear}>
            Clear
          </button>
        </div>
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
