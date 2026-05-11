import { useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import SqlEditorPanel from "./SqlEditorPanel";
import SqlPreviewGrid from "./SqlPreviewGrid";
import type { SqlExecutionStatus, SqlPreviewResult, SqlQueryDraft } from "./sqlTypes";

type SqlWorkspaceProps = {
  dataset: DatasetMetadata;
};

const createInitialSql = (tableName: string) => `SELECT *
FROM ${tableName}
LIMIT 100;`;

const createPreviewMessage = (status: SqlExecutionStatus) => {
  if (status === "execution-pending") {
    return "Run Query is wired as a frontend placeholder. Secure backend SQL execution will plug in here later.";
  }

  if (status === "explain-ready") {
    return "Explain is a placeholder for future validation and query plan feedback.";
  }

  if (status === "draft-saved") {
    return "Draft saved locally for this workspace session.";
  }

  return "No SQL has been executed in this frontend-only foundation.";
};

function SqlWorkspace({ dataset }: SqlWorkspaceProps) {
  const [sqlText, setSqlText] = useState(() => createInitialSql(dataset.table_name));
  const [savedDrafts, setSavedDrafts] = useState<SqlQueryDraft[]>([]);
  const [executionStatus, setExecutionStatus] = useState<SqlExecutionStatus>("idle");
  const [previewResult, setPreviewResult] = useState<SqlPreviewResult>({
    columns: [],
    rows: [],
    message: createPreviewMessage("idle"),
  });

  const updateStatus = (status: SqlExecutionStatus) => {
    setExecutionStatus(status);
    setPreviewResult({
      columns: [],
      rows: [],
      message: createPreviewMessage(status),
    });
  };

  const saveDraft = () => {
    const trimmedSql = sqlText.trim();
    if (!trimmedSql) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const draft: SqlQueryDraft = {
      id: `${Date.now()}`,
      name: `Draft ${savedDrafts.length + 1}`,
      sql: trimmedSql,
      savedAt: timestamp,
    };

    setSavedDrafts((currentDrafts) => [draft, ...currentDrafts.slice(0, 5)]);
    updateStatus("draft-saved");
  };

  return (
    <section className="sql-workspace" aria-label="SQL workspace">
      <aside className="sql-context-panel">
        <div>
          <p className="section-label">Active dataset</p>
          <h2>{dataset.original_filename}</h2>
        </div>
        <div className="session-stat-list">
          <span>{dataset.table_name}</span>
          <strong>{dataset.row_count.toLocaleString()} rows</strong>
          <strong>{dataset.column_count.toLocaleString()} columns</strong>
        </div>
        <div className="schema-list sql-schema-list" aria-label="SQL available columns">
          {dataset.schema.map((column) => (
            <span className="schema-pill" key={column.name}>
              {column.name}
              <small>{column.inferred_type}</small>
            </span>
          ))}
        </div>
      </aside>

      <div className="sql-main-panel">
        <SqlEditorPanel
          sqlText={sqlText}
          executionStatus={executionStatus}
          savedDrafts={savedDrafts}
          onSqlChange={setSqlText}
          onRunQuery={() => updateStatus("execution-pending")}
          onClear={() => {
            setSqlText("");
            updateStatus("idle");
          }}
          onSaveDraft={saveDraft}
          onExplain={() => updateStatus("explain-ready")}
          onLoadDraft={(draft) => {
            setSqlText(draft.sql);
            updateStatus("idle");
          }}
        />
        <SqlPreviewGrid previewResult={previewResult} />
      </div>
    </section>
  );
}

export default SqlWorkspace;
