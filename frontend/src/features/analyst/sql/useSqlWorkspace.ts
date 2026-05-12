import { useEffect, useMemo, useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import { wrapWorkspaceExecutionOutput } from "../../execution/executeWorkspaceQuery";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import {
  MAX_SQL_DRAFT_SNAPSHOTS,
  getActiveSqlDraftSnapshot,
  normalizeSqlWorkspaceMetadataSnapshot,
  updateSqlWorkspaceDialect,
  updateSqlWorkspaceDraftMetadata,
  upsertActiveSqlDraftSnapshot,
  type SqlWorkspaceMetadataSnapshot,
} from "../../sqlWorkspacePersistence";
import {
  analyzeSqlWorkspaceDraft,
  getDialectProfile,
  listSupportedDialects,
  type SqlDialectId,
} from "../../sqlIntelligence";
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
    return "Execution not connected yet.";
  }

  if (status === "explain-ready") {
    return "Explain query ready.";
  }

  if (status === "draft-saved") {
    return "Draft saved.";
  }

  return "No results yet.";
};

function useSqlWorkspace(
  dataset: DatasetMetadata | null,
  onExecutionResult?: (result: WorkspaceExecutionResult) => void,
  metadata?: SqlWorkspaceMetadataSnapshot,
  onMetadataChange?: (metadata: SqlWorkspaceMetadataSnapshot) => void,
) {
  const normalizedMetadata = useMemo(
    () => normalizeSqlWorkspaceMetadataSnapshot(metadata),
    [metadata],
  );
  const restoredActiveDraft = useMemo(
    () => getActiveSqlDraftSnapshot(normalizedMetadata),
    [normalizedMetadata],
  );
  const [sqlDraft, setSqlDraft] = useState(
    () => restoredActiveDraft?.sql ?? createInitialSql(dataset?.table_name),
  );
  const [savedDrafts, setSavedDrafts] = useState<SqlQueryDraft[]>(() =>
    normalizedMetadata.drafts.map((draft) => ({
      id: draft.id,
      name: draft.label,
      sql: draft.sql,
      savedAt: draft.updatedAt,
    })),
  );
  const [editorStatus, setEditorStatus] = useState<SqlExecutionStatus>("idle");
  const [selectedDialect, setSelectedDialect] = useState<SqlDialectId>(
    normalizedMetadata.selectedDialect,
  );
  const [previewResult, setPreviewResult] = useState<SqlPreviewResult>({
    columns: [],
    rows: [],
    message: createPreviewMessage("idle"),
  });

  const templates = useMemo(() => (dataset ? createSqlTemplates(dataset) : []), [dataset]);
  const suggestions = useMemo(() => (dataset ? createColumnSuggestions(dataset) : []), [dataset]);
  const dialectOptions = useMemo(
    () =>
      listSupportedDialects().map((dialect) => ({
        id: dialect.id,
        displayName: dialect.displayName,
      })),
    [],
  );
  const selectedDialectProfile = useMemo(
    () => getDialectProfile(selectedDialect),
    [selectedDialect],
  );
  const sqlAnalysis = useMemo(
    () => analyzeSqlWorkspaceDraft(sqlDraft, selectedDialect),
    [selectedDialect, sqlDraft],
  );
  const characterCount = sqlDraft.trim().length;

  useEffect(() => {
    setSelectedDialect(normalizedMetadata.selectedDialect);
  }, [normalizedMetadata.selectedDialect]);

  useEffect(() => {
    if (!restoredActiveDraft) return;

    setSqlDraft(restoredActiveDraft.sql);
    setSelectedDialect(restoredActiveDraft.selectedDialect);
  }, [restoredActiveDraft?.id, restoredActiveDraft?.sql, restoredActiveDraft?.selectedDialect]);

  useEffect(() => {
    setSavedDrafts(
      normalizedMetadata.drafts.map((draft) => ({
        id: draft.id,
        name: draft.label,
        sql: draft.sql,
        savedAt: draft.updatedAt,
      })),
    );
  }, [normalizedMetadata.drafts]);

  useEffect(() => {
    const persistTimer = window.setTimeout(() => {
      const activeDraft = getActiveSqlDraftSnapshot(normalizedMetadata);
      if (
        activeDraft &&
        activeDraft.sql === sqlDraft &&
        activeDraft.selectedDialect === selectedDialect
      ) {
        return;
      }

      onMetadataChange?.(
        upsertActiveSqlDraftSnapshot(normalizedMetadata, {
          sql: sqlDraft,
          selectedDialect,
          id: normalizedMetadata.activeDraftId || restoredActiveDraft?.id || "active-draft",
          label: restoredActiveDraft?.label || "Query draft",
        }),
      );
    }, 700);

    return () => window.clearTimeout(persistTimer);
  }, [
    normalizedMetadata,
    onMetadataChange,
    restoredActiveDraft?.id,
    restoredActiveDraft?.label,
    selectedDialect,
    sqlDraft,
  ]);

  const updateSelectedDialect = (dialect: SqlDialectId) => {
    setSelectedDialect(dialect);
    onMetadataChange?.(updateSqlWorkspaceDialect(normalizedMetadata, dialect));
  };

  const updateStatus = (status: SqlExecutionStatus) => {
    const message = createPreviewMessage(status);
    setEditorStatus(status);

    if (dataset) {
      const executionResult = wrapWorkspaceExecutionOutput({
        source: "sql",
        dataset,
        inputRows: [],
        inputColumns: [],
        sql: {
          sql: sqlDraft,
          message,
        },
        pagination: {
          page: 1,
          rowsPerPage: 100,
        },
      });

      setPreviewResult({
        columns: executionResult.outputVisibleColumns,
        rows: executionResult.outputRows,
        message: executionResult.sql?.message || message,
      });
      if (status === "execution-pending") {
        onExecutionResult?.(executionResult);
      }
      return;
    }

    setPreviewResult({
      columns: [],
      rows: [],
      message,
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

    setSavedDrafts((currentDrafts) => [
      draft,
      ...currentDrafts.filter((currentDraft) => currentDraft.id !== draft.id).slice(0, 5),
    ]);
    onMetadataChange?.(
      updateSqlWorkspaceDraftMetadata(
        upsertActiveSqlDraftSnapshot(normalizedMetadata, {
          id: draft.id,
          label: draft.name,
          sql: draft.sql,
          selectedDialect,
        }),
        {
          draftCount: Math.min(savedDrafts.length + 1, MAX_SQL_DRAFT_SNAPSHOTS),
          lastDraftSavedAt: draft.savedAt,
        },
      ),
    );
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
    onMetadataChange?.(
      upsertActiveSqlDraftSnapshot(normalizedMetadata, {
        id: draft.id,
        label: draft.name,
        sql: draft.sql,
        selectedDialect,
      }),
    );
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
    diagnostics: sqlAnalysis.diagnostics,
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
    sqlAnalysis,
    selectedDialect,
    selectedDialectProfile,
    dialectOptions,
    setSelectedDialect: updateSelectedDialect,
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
