import SqlEditorHost from "./SqlEditorHost";
import type { SqlEditorInterface, SqlExecutionStatus, SqlQueryDraft } from "./sqlTypes";

type SqlEditorPanelProps = {
  editor: SqlEditorInterface;
  executionStatus: SqlExecutionStatus;
  characterCount: number;
  canRunQuery: boolean;
};

const statusLabels: Record<SqlExecutionStatus, string> = {
  idle: "Ready",
  "draft-saved": "Draft saved",
  "explain-ready": "Explain placeholder ready",
  "execution-pending": "Execution not connected yet",
};

function SqlEditorPanel({
  editor,
  executionStatus,
  characterCount,
  canRunQuery,
}: SqlEditorPanelProps) {
  return (
    <section className="sql-editor-panel" aria-label="SQL editor">
      <div className="sql-editor-toolbar">
        <div>
          <p className="section-label">SQL workspace</p>
          <h2>Analyst query draft</h2>
        </div>
        <div className="sql-actions">
          <button type="button" className="primary-button" onClick={editor.onRun} disabled={!canRunQuery}>
            Run Query
          </button>
          <button type="button" className="secondary-button" onClick={editor.onExplain}>
            Explain
          </button>
          <button type="button" className="secondary-button" onClick={editor.onSaveDraft}>
            Save Draft
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

type SqlDraftPanelProps = {
  savedDrafts: SqlQueryDraft[];
  onLoadDraft: (draft: SqlQueryDraft) => void;
};

export function SqlDraftPanel({ savedDrafts, onLoadDraft }: SqlDraftPanelProps) {
  return (
    <section className="sql-draft-panel" aria-label="Saved SQL drafts">
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
