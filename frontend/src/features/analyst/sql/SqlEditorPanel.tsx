import type { SqlExecutionStatus, SqlQueryDraft } from "./sqlTypes";

type SqlEditorPanelProps = {
  sqlText: string;
  executionStatus: SqlExecutionStatus;
  savedDrafts: SqlQueryDraft[];
  canRunQuery: boolean;
  onSqlChange: (sqlText: string) => void;
  onRunQuery: () => void;
  onClear: () => void;
  onSaveDraft: () => void;
  onExplain: () => void;
  onLoadDraft: (draft: SqlQueryDraft) => void;
};

const statusLabels: Record<SqlExecutionStatus, string> = {
  idle: "Ready",
  "draft-saved": "Draft saved",
  "explain-ready": "Explain placeholder ready",
  "execution-pending": "Execution not connected yet",
};

function SqlEditorPanel({
  sqlText,
  executionStatus,
  savedDrafts,
  canRunQuery,
  onSqlChange,
  onRunQuery,
  onClear,
  onSaveDraft,
  onExplain,
  onLoadDraft,
}: SqlEditorPanelProps) {
  return (
    <section className="sql-editor-panel" aria-label="SQL editor">
      <div className="sql-editor-toolbar">
        <div>
          <p className="section-label">SQL workspace</p>
          <h2>Analyst query draft</h2>
        </div>
        <div className="sql-actions">
          <button type="button" className="primary-button" onClick={onRunQuery} disabled={!canRunQuery}>
            Run Query
          </button>
          <button type="button" className="secondary-button" onClick={onExplain}>
            Explain
          </button>
          <button type="button" className="secondary-button" onClick={onSaveDraft}>
            Save Draft
          </button>
          <button type="button" className="text-button" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>

      <textarea
        className="sql-editor-input"
        value={sqlText}
        onChange={(event) => onSqlChange(event.target.value)}
        spellCheck={false}
        aria-label="SQL query text"
      />

      <div className="sql-editor-footer">
        <span>{statusLabels[executionStatus]}</span>
        <span>{sqlText.trim().length.toLocaleString()} characters</span>
      </div>

      <div className="sql-draft-list" aria-label="Saved SQL drafts">
        <div className="builder-block-header">
          <span>Draft memory</span>
          <small>{savedDrafts.length} saved</small>
        </div>
        {savedDrafts.length === 0 ? (
          <p>No saved drafts in this workspace session.</p>
        ) : (
          savedDrafts.map((draft) => (
            <button type="button" key={draft.id} onClick={() => onLoadDraft(draft)}>
              <strong>{draft.name}</strong>
              <span>{draft.savedAt}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

export default SqlEditorPanel;
