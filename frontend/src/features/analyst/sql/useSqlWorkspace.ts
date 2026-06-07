import { useEffect, useMemo, useRef, useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import { executeWorkspaceQuery } from "../../execution/executeWorkspaceQuery";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import {
  deleteSqlSnippet,
  getActiveSqlDraftSnapshot,
  normalizeSqlWorkspaceMetadataSnapshot,
  updateSqlWorkspaceDialect,
  updateSqlWorkspaceDraftMetadata,
  upsertSqlSnippet,
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
import { explainSqlQuery } from "./sqlQueryExplainer";
import { formatRowLimitClause } from "./sqlTemplateLibrary";
import type {
  SqlEditorInterface,
  SqlExecutionStatus,
  SqlPreviewResult,
  SqlQueryDraft,
  SqlWorkspaceTabsInterface,
} from "./sqlTypes";
import useSqlWorkspaceTabs from "./useSqlWorkspaceTabs";

const createInitialSql = (tableName: string | undefined, dialect: SqlDialectId) => `SELECT *
FROM ${tableName || "uploaded_dataset"}
${formatRowLimitClause(dialect, 100)};`;

const createPreviewMessage = (status: SqlExecutionStatus) => {
  if (status === "running") {
    return "Running query...";
  }

  if (status === "success") {
    return "Query completed.";
  }

  if (status === "error") {
    return "Query failed.";
  }

  if (status === "explain-ready") {
    return "Diagnostics ready.";
  }

  if (status === "draft-saved") {
    return "Query saved to Saved Drafts.";
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
  const hasAppliedRestoredDraftRef = useRef(Boolean(restoredActiveDraft));
  const [savedDrafts, setSavedDrafts] = useState<SqlQueryDraft[]>(() =>
    normalizedMetadata.snippets.map((snippet) => ({
      id: snippet.id,
      name: snippet.name,
      sql: snippet.sql,
      savedAt: snippet.updatedAt,
      dialect: snippet.dialect,
    })),
  );
  const initialPreviewResult = useMemo<SqlPreviewResult>(
    () => ({
      columns: [],
      rows: [],
      message: createPreviewMessage("idle"),
    }),
    [],
  );

  const {
    activeTab,
    tabsState,
    createTab,
    openSourceTab,
    switchTab,
    closeTab,
    setActiveSqlDraft,
    setActiveDialect,
    syncActiveDialect,
    setActiveEditorStatus,
    setActivePreviewResult,
    replaceActiveTabDraft,
  } = useSqlWorkspaceTabs({
    dataset,
    restoredActiveDraft,
    initialSql: createInitialSql(dataset?.table_name, normalizedMetadata.selectedDialect),
    initialDialect: normalizedMetadata.selectedDialect,
    initialPreviewResult,
    initialEditorStatus: "idle",
    createStarterSql: createInitialSql,
  });
  const sqlDraft = activeTab.sqlDraft;
  const selectedDialect = activeTab.dialect;
  const editorStatus = activeTab.editorStatus;
  const previewResult = activeTab.previewResult;

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
  const activeWorkbookWorksheet = dataset?.workbook_metadata?.worksheets.find(
    (worksheet) => worksheet.worksheetId === dataset.workbook_metadata?.activeWorksheetId,
  );
  const activeSourceLabel = dataset
    ? activeTab.title ||
      activeWorkbookWorksheet?.displayName ||
      activeWorkbookWorksheet?.sheetName ||
      dataset.table_name ||
      null
    : null;
  const queryExplanation = useMemo(
    () =>
      explainSqlQuery(sqlDraft, {
        dataset,
        activeSourceLabel,
        selectedDialect,
      }),
    [activeSourceLabel, dataset, selectedDialect, sqlDraft],
  );
  const characterCount = sqlDraft.trim().length;
  const sqlTabs = useMemo<SqlWorkspaceTabsInterface>(() => {
    const canCloseTabs = tabsState.tabs.length > 1;

    return {
      activeTabId: tabsState.activeTabId,
      tabs: tabsState.tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        sourceBadge: tab.sourceType === "cleaned_working_copy" ? "cleaned copy" : tab.tableName || null,
        isActive: tab.id === tabsState.activeTabId,
        isDirty: tab.isDirty,
        canClose: canCloseTabs,
      })),
      onNewTab: createTab,
      onSwitchTab: switchTab,
      onCloseTab: closeTab,
    };
  }, [closeTab, createTab, switchTab, tabsState.activeTabId, tabsState.tabs]);

  useEffect(() => {
    syncActiveDialect(normalizedMetadata.selectedDialect);
  }, [normalizedMetadata.selectedDialect, syncActiveDialect]);

  useEffect(() => {
    if (!restoredActiveDraft) return;
    if (hasAppliedRestoredDraftRef.current) return;

    const initialTab = tabsState.tabs[0];
    const canHydrateInitialTab =
      tabsState.tabs.length === 1 &&
      initialTab &&
      !initialTab.isDirty &&
      tabsState.activeTabId === initialTab.id;

    if (!canHydrateInitialTab) {
      hasAppliedRestoredDraftRef.current = true;
      return;
    }

    replaceActiveTabDraft(restoredActiveDraft, { activate: true });
    hasAppliedRestoredDraftRef.current = true;
  }, [
    replaceActiveTabDraft,
    restoredActiveDraft,
    restoredActiveDraft?.id,
    restoredActiveDraft?.sql,
    restoredActiveDraft?.selectedDialect,
    tabsState.activeTabId,
    tabsState.tabs,
  ]);

  useEffect(() => {
    setSavedDrafts(
      normalizedMetadata.snippets.map((snippet) => ({
        id: snippet.id,
        name: snippet.name,
        sql: snippet.sql,
        savedAt: snippet.updatedAt,
        dialect: snippet.dialect,
      })),
    );
  }, [normalizedMetadata.snippets]);

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
    setActiveDialect(dialect);
    onMetadataChange?.(updateSqlWorkspaceDialect(normalizedMetadata, dialect));
  };

  const updateStatus = (status: SqlExecutionStatus) => {
    const message = createPreviewMessage(status);
    setActiveEditorStatus(status);
    setActivePreviewResult({
      columns: [],
      rows: [],
      message,
    });
  };

  const insertSql = (sql: string) => {
    const trimmedCurrentSql = sqlDraft.trimEnd();
    const separator = trimmedCurrentSql ? "\n\n" : "";
    const nextSql = `${trimmedCurrentSql}${separator}${sql}`;

    setActiveSqlDraft(nextSql);
    onMetadataChange?.(
      upsertActiveSqlDraftSnapshot(normalizedMetadata, {
        sql: nextSql,
        selectedDialect,
        id: normalizedMetadata.activeDraftId || restoredActiveDraft?.id || "active-draft",
        label: restoredActiveDraft?.label || "Query draft",
      }),
    );
    updateStatus("idle");
  };

  const saveDraft = () => {
    const trimmedSql = sqlDraft.trim();
    if (!trimmedSql) return;

    const fallbackName = `Draft ${savedDrafts.length + 1}`;
    const requestedName = window.prompt("Name this query for Saved Drafts", fallbackName);
    if (requestedName === null) return;
    const draftName = requestedName.trim() || fallbackName;
    const timestamp = new Date().toISOString();
    const draft: SqlQueryDraft = {
      id: `${Date.now()}`,
      name: draftName,
      sql: trimmedSql,
      savedAt: timestamp,
      dialect: selectedDialect,
    };

    setSavedDrafts((currentDrafts) => [
      draft,
      ...currentDrafts.filter((currentDraft) => currentDraft.id !== draft.id),
    ]);
    onMetadataChange?.(
      updateSqlWorkspaceDraftMetadata(
        upsertSqlSnippet(
          upsertActiveSqlDraftSnapshot(normalizedMetadata, {
            id: draft.id,
            label: draft.name,
            sql: draft.sql,
            selectedDialect,
          }),
          {
            id: draft.id,
            name: draft.name,
            sql: draft.sql,
            dialect: selectedDialect,
            tags: ["draft"],
            description: "Saved from the SQL Workspace Save Query action.",
          },
        ),
        {
          draftCount: savedDrafts.length + 1,
          lastDraftSavedAt: draft.savedAt,
        },
      ),
    );
    updateStatus("draft-saved");
  };

  const renameDraft = (draftId: string, nextName: string) => {
    const draft = savedDrafts.find((currentDraft) => currentDraft.id === draftId);
    const trimmedName = nextName.trim();
    if (!draft || !trimmedName) return;

    const timestamp = new Date().toISOString();
    setSavedDrafts((currentDrafts) =>
      currentDrafts.map((currentDraft) =>
        currentDraft.id === draftId
          ? { ...currentDraft, name: trimmedName, savedAt: timestamp }
          : currentDraft,
      ),
    );
    onMetadataChange?.(
      upsertSqlSnippet(normalizedMetadata, {
        id: draft.id,
        name: trimmedName,
        sql: draft.sql,
        dialect: draft.dialect,
        tags: ["draft"],
        description: "Saved from the SQL Workspace Save Query action.",
      }),
    );
  };

  const deleteDraft = (draftId: string) => {
    setSavedDrafts((currentDrafts) =>
      currentDrafts.filter((currentDraft) => currentDraft.id !== draftId),
    );
    onMetadataChange?.(deleteSqlSnippet(normalizedMetadata, draftId));
  };

  const deleteDrafts = (draftIds: string[]) => {
    const draftIdSet = new Set(draftIds);
    if (draftIdSet.size === 0) return;

    setSavedDrafts((currentDrafts) =>
      currentDrafts.filter((currentDraft) => !draftIdSet.has(currentDraft.id)),
    );
    const nextMetadata = draftIds.reduce(
      (currentMetadata, draftId) => deleteSqlSnippet(currentMetadata, draftId),
      normalizedMetadata,
    );
    onMetadataChange?.(nextMetadata);
  };

  const clearDraft = () => {
    setActiveSqlDraft("");
    updateStatus("idle");
  };

  const explainDraft = () => {
    updateStatus("explain-ready");
  };

  const runDraft = async () => {
    const trimmedSql = sqlDraft.trim();

    if (!dataset) {
      setActiveEditorStatus("idle");
      setActivePreviewResult({
        columns: [],
        rows: [],
        message: "Open a dataset before running SQL.",
      });
      return;
    }

    if (!trimmedSql) {
      setActiveEditorStatus("idle");
      setActivePreviewResult({
        columns: [],
        rows: [],
        message: "Write a SELECT query before running SQL.",
      });
      return;
    }

    setActiveEditorStatus("running");
    setActivePreviewResult({
      columns: [],
      rows: [],
      message: createPreviewMessage("running"),
    });

    try {
      const executionResult = await executeWorkspaceQuery({
        source: "sql",
        dataset,
        sql: {
          sql: trimmedSql,
          message: createPreviewMessage("running"),
        },
        pagination: {
          page: 1,
          rowsPerPage: 100,
        },
      });

      setActiveEditorStatus("success");
      setActivePreviewResult({
        columns: executionResult.outputVisibleColumns,
        rows: executionResult.outputRows,
        message: executionResult.sql?.message || createPreviewMessage("success"),
      });
      onExecutionResult?.(executionResult);
    } catch (error) {
      setActiveEditorStatus("error");
      setActivePreviewResult({
        columns: [],
        rows: [],
        message: error instanceof Error ? error.message : createPreviewMessage("error"),
      });
    }
  };

  const loadDraft = (draft: SqlQueryDraft) => {
    setActiveSqlDraft(draft.sql);
    onMetadataChange?.(
      upsertActiveSqlDraftSnapshot(normalizedMetadata, {
        id: draft.id,
        label: draft.name,
        sql: draft.sql,
        selectedDialect: draft.dialect,
      }),
    );
    setActiveDialect(draft.dialect);
    updateStatus("idle");
  };

  const editor: SqlEditorInterface = {
    value: sqlDraft,
    onChange: setActiveSqlDraft,
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
    queryExplanation,
    selectedDialect,
    selectedDialectProfile,
    dialectOptions,
    sqlTabs,
    setSelectedDialect: updateSelectedDialect,
    editor,
    insertSql,
    saveDraft,
    clearDraft,
    explainDraft,
    runDraft,
    loadDraft,
    renameDraft,
    deleteDraft,
    deleteDrafts,
    openSqlSourceTab: openSourceTab,
  };
}

export default useSqlWorkspace;
