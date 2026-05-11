import { useMemo, useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import { createColumnSuggestions, createSqlTemplates, sqlKeywordSuggestions } from "./sqlSuggestions";
import type {
  SqlEditorInterface,
  SqlExecutionStatus,
  SqlPreviewResult,
  SqlQueryDraft,
} from "./sqlTypes";

const createInitialSql = (tableName?: string) => `SELECT *
FROM ${tableName || "uploaded_dataset"}
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

function useSqlWorkspace(dataset: DatasetMetadata | null) {
  const [sqlDraft, setSqlDraft] = useState(() => createInitialSql(dataset?.table_name));
  const [savedDrafts, setSavedDrafts] = useState<SqlQueryDraft[]>([]);
  const [editorStatus, setEditorStatus] = useState<SqlExecutionStatus>("idle");
  const [previewResult, setPreviewResult] = useState<SqlPreviewResult>({
    columns: [],
    rows: [],
    message: createPreviewMessage("idle"),
  });

  const templates = useMemo(() => (dataset ? createSqlTemplates(dataset) : []), [dataset]);
  const suggestions = useMemo(() => (dataset ? createColumnSuggestions(dataset) : []), [dataset]);
  const characterCount = sqlDraft.trim().length;

  const updateStatus = (status: SqlExecutionStatus) => {
    setEditorStatus(status);
    setPreviewResult({
      columns: [],
      rows: [],
      message: createPreviewMessage(status),
    });
  };

  const insertSql = (sql: string) => {
    setSqlDraft((currentSql) => {
      const trimmedCurrentSql = currentSql.trimEnd();
      const separator = trimmedCurrentSql ? "\n\n" : "";
      return `${trimmedCurrentSql}${separator}${sql}`;
    });
    updateStatus("idle");
  };

  const saveDraft = () => {
    const trimmedSql = sqlDraft.trim();
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

  const clearDraft = () => {
    setSqlDraft("");
    updateStatus("idle");
  };

  const explainDraft = () => {
    updateStatus("explain-ready");
  };

  const runDraft = () => {
    updateStatus("execution-pending");
  };

  const loadDraft = (draft: SqlQueryDraft) => {
    setSqlDraft(draft.sql);
    updateStatus("idle");
  };

  const editor: SqlEditorInterface = {
    value: sqlDraft,
    onChange: setSqlDraft,
    onRun: runDraft,
    onExplain: explainDraft,
    onSaveDraft: saveDraft,
    onClear: clearDraft,
    schema: dataset?.schema || [],
    suggestions,
    templates,
    keywordSuggestions: sqlKeywordSuggestions,
  };

  return {
    sqlDraft,
    savedDrafts,
    characterCount,
    editorStatus,
    previewResult,
    templates,
    suggestions,
    keywordSuggestions: sqlKeywordSuggestions,
    editor,
    insertSql,
    saveDraft,
    clearDraft,
    explainDraft,
    runDraft,
    loadDraft,
  };
}

export default useSqlWorkspace;
