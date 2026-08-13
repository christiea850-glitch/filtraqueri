import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { analyzeSqlReadiness } from "./sqlReadinessGuard";
import {
  resolveSqlTabSourceContext,
  type SqlTabSourceContext,
} from "./resolveSqlTabSourceContext";
import { getDialectDraftConversion } from "./sqlDialectDraftConversion";
import { formatRowLimitClause } from "./sqlTemplateLibrary";
import {
  createExecutedQuestionSnapshot,
  createSqlErrorPreviewResult,
  createSqlSuccessPreviewResult,
} from "./sqlPreviewResultAdapter";
import { createSqlExecutionIdentity } from "./sqlExecutionIdentity";
import type {
  SqlEditorInterface,
  SqlExecutionStatus,
  SqlPreviewResult,
  SqlQuestionHandoff,
  SqlQueryDraft,
  SqlWorkspaceTabsInterface,
} from "./sqlTypes";
import type { BusinessSqlPreviewInsertProvenance } from "./businessSqlPreviewProvenance";
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

const getTabSourceTableLabel = (tab: {
  sourceType: "original" | "cleaned_working_copy";
  tableName: string;
  originalTableName?: string;
  cleanedTableName?: string;
}) =>
  tab.sourceType === "cleaned_working_copy"
    ? tab.cleanedTableName || tab.tableName || "cleaned copy"
    : tab.originalTableName || tab.tableName || null;

let sqlExecutionRequestSequence = 0;

const createLiveSqlExecutionRequestId = () => {
  sqlExecutionRequestSequence += 1;
  const randomSegment =
    globalThis.crypto?.randomUUID?.() ||
    Math.random().toString(36).slice(2);
  return `sql-run:${sqlExecutionRequestSequence}:${randomSegment}`;
};

function useSqlWorkspace(
  dataset: DatasetMetadata | null,
  onExecutionResult?: (result: WorkspaceExecutionResult) => void,
  metadata?: SqlWorkspaceMetadataSnapshot,
  onMetadataChange?: (metadata: SqlWorkspaceMetadataSnapshot) => void,
  runtimeContext: {
    businessSqlPreviewInsertProvenance?: BusinessSqlPreviewInsertProvenance | null;
    questionHandoff?: SqlQuestionHandoff | null;
    onQuestionHandoffConsumed?: (handoffId: string) => void;
  } = {},
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
      errorInsight: null,
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
    setTabEditorStatus,
    setTabPreviewResult,
    setActiveTabSelectedScope,
    applyActiveTabScope,
    setActiveTabTaskPrompt,
    markActiveTabTemplate,
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
  const latestRunByTabRef = useRef(new Map<string, string>());
  const mountedRef = useRef(true);
  const activeTabIdRef = useRef(tabsState.activeTabId);
  const tabsStateRef = useRef(tabsState);
  const consumedQuestionHandoffIdsRef = useRef(new Set<string>());
  const questionHandoff = runtimeContext.questionHandoff;
  const onQuestionHandoffConsumed = runtimeContext.onQuestionHandoffConsumed;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestRunByTabRef.current.clear();
  }, [dataset?.dataset_id, dataset?.workbook_metadata?.workbookId]);

  useEffect(() => {
    activeTabIdRef.current = tabsState.activeTabId;
    tabsStateRef.current = tabsState;
  }, [tabsState]);

  const isLatestRunForTab = (requestId: string, tabId: string) =>
    mountedRef.current &&
    tabsStateRef.current.tabs.some((tab) => tab.id === tabId) &&
    latestRunByTabRef.current.get(tabId) === requestId;

  // Option C — Resolve the active tab's source context once and reuse it for
  // every UI / intelligence surface (schema rail, command bar, templates,
  // reports, query explanation, suggestions). Execution is unchanged.
  const activeTabSourceContext = useMemo<SqlTabSourceContext>(
    () => resolveSqlTabSourceContext(dataset, activeTab),
    [dataset, activeTab],
  );

  // Synthesize a tab-scoped DatasetMetadata so existing helpers
  // (createSqlTemplates, createColumnSuggestions, explainSqlQuery) see the
  // active tab's schema + table_name. Execution still uses the unaltered
  // global dataset prop — this synthesized object is for intelligence /
  // display only and is never passed to executeWorkspaceQuery.
  const scopedDatasetForTab = useMemo(() => {
    if (!dataset) return null;
    return {
      ...dataset,
      schema:
        activeTabSourceContext.schema.length > 0
          ? activeTabSourceContext.schema
          : dataset.schema,
      table_name: activeTabSourceContext.tableName || dataset.table_name,
      row_count: activeTabSourceContext.rowCount || dataset.row_count,
      column_count: activeTabSourceContext.columnCount || dataset.column_count,
    };
  }, [dataset, activeTabSourceContext]);

  const templates = useMemo(
    () => (scopedDatasetForTab ? createSqlTemplates(scopedDatasetForTab) : []),
    [scopedDatasetForTab],
  );
  const suggestions = useMemo(
    () => (scopedDatasetForTab ? createColumnSuggestions(scopedDatasetForTab) : []),
    [scopedDatasetForTab],
  );
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
  // Option C — Drive the displayed active-source label from the resolved tab
  // context. Falls back to null when no dataset is open.
  const activeSourceLabel = dataset ? activeTabSourceContext.sourceLabel : null;
  const queryExplanation = useMemo(
    () =>
      explainSqlQuery(sqlDraft, {
        dataset: scopedDatasetForTab,
        activeSourceLabel,
        selectedDialect,
      }),
    [activeSourceLabel, scopedDatasetForTab, selectedDialect, sqlDraft],
  );
  const readinessReport = useMemo(
    () =>
      analyzeSqlReadiness({
        sqlDraft,
        dataset,
        appliedScopeSelections: activeTab.appliedScopeSelections || [],
        activeTabSourceContext,
      }),
    [activeTab.appliedScopeSelections, activeTabSourceContext, dataset, sqlDraft],
  );
  const draftConversionPreview = useMemo(() => {
    const preview = getDialectDraftConversion({
      sql: sqlDraft,
      fromDialect: selectedDialect,
      toDialect: selectedDialect,
    });

    return preview.canConvert ? preview : null;
  }, [selectedDialect, sqlDraft]);
  const characterCount = sqlDraft.trim().length;
  const closeSqlTab = useCallback((tabId: string) => {
    latestRunByTabRef.current.delete(tabId);
    closeTab(tabId);
  }, [closeTab]);
  const sqlTabs = useMemo<SqlWorkspaceTabsInterface>(() => {
    const canCloseTabs = tabsState.tabs.length > 1;

    return {
      activeTabId: tabsState.activeTabId,
      activeTabTitle: activeTab.title,
      activeTabSourceBadge: getTabSourceTableLabel(activeTab),
      activeTabSourceKind: activeTab.sourceType === "cleaned_working_copy" ? "Cleaned" : "Original",
      activeTabCreatedFrom: activeTab.createdFrom || null,
      selectedScopeSelections: activeTab.selectedScopeSelections || [],
      appliedScopeSelections: activeTab.appliedScopeSelections || [],
      taskPrompt: activeTab.taskPrompt || "",
      selectedTemplateLabel: activeTab.selectedTemplateLabel || null,
      onSelectedScopeChange: setActiveTabSelectedScope,
      onApplyScope: applyActiveTabScope,
      onTaskPromptChange: setActiveTabTaskPrompt,
      onMarkTemplate: markActiveTabTemplate,
      tabs: tabsState.tabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        sourceBadge: getTabSourceTableLabel(tab),
        isActive: tab.id === tabsState.activeTabId,
        isDirty: tab.isDirty,
        canClose: canCloseTabs,
      })),
      onNewTab: createTab,
      onSwitchTab: switchTab,
      onCloseTab: closeSqlTab,
    };
  }, [
    activeTab,
    applyActiveTabScope,
    closeSqlTab,
    createTab,
    markActiveTabTemplate,
    setActiveTabSelectedScope,
    setActiveTabTaskPrompt,
    switchTab,
    tabsState.activeTabId,
    tabsState.tabs,
  ]);

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
      errorInsight: null,
    });
  };

  const handleEditorChange = (nextSql: string) => {
    setActiveSqlDraft(nextSql);
  };

  useEffect(() => {
    const handoff = questionHandoff;
    if (!handoff || consumedQuestionHandoffIdsRef.current.has(handoff.id)) return;

    const consume = () => {
      consumedQuestionHandoffIdsRef.current.add(handoff.id);
      onQuestionHandoffConsumed?.(handoff.id);
    };
    const activeWorksheetId =
      activeTabSourceContext.worksheetId ||
      dataset?.workbook_metadata?.activeAnalysisSource?.worksheetId ||
      dataset?.workbook_metadata?.activeWorksheetId ||
      null;

    if (
      !dataset ||
      handoff.datasetId !== dataset.dataset_id ||
      (handoff.worksheetId && activeWorksheetId !== handoff.worksheetId)
    ) {
      consume();
      return;
    }

    const question = handoff.question.trim();
    if (!question) {
      consume();
      return;
    }

    if (!activeTab.taskPrompt?.trim()) {
      setActiveTabTaskPrompt(question);
    }
    consume();
  }, [
    activeTab.taskPrompt,
    activeTabSourceContext.worksheetId,
    dataset,
    onQuestionHandoffConsumed,
    questionHandoff,
    setActiveTabTaskPrompt,
  ]);

  const applyDraftConversion = () => {
    if (!draftConversionPreview?.canConvert) return;

    handleEditorChange(draftConversionPreview.convertedSql);
  };

  const insertSql = (
    sql: string,
    templateMetadata?: { id?: string; label?: string; createdFrom?: "template" | "report" },
  ) => {
    const trimmedCurrentSql = sqlDraft.trimEnd();
    const separator = trimmedCurrentSql ? "\n\n" : "";
    const nextSql = `${trimmedCurrentSql}${separator}${sql}`;

    setActiveSqlDraft(nextSql);
    if (templateMetadata) {
      markActiveTabTemplate(templateMetadata);
    }
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
        errorInsight: null,
      });
      return;
    }

    if (!trimmedSql) {
      setActiveEditorStatus("idle");
      setActivePreviewResult({
        columns: [],
        rows: [],
        message: "Write a SELECT query before running SQL.",
        errorInsight: null,
      });
      return;
    }

    const requestId = createLiveSqlExecutionRequestId();
    const activeTabIdAtRun = tabsState.activeTabId;
    const executionIdentity = createSqlExecutionIdentity({
      requestId,
      exactSql: trimmedSql,
      datasetId: dataset.dataset_id,
      worksheetId: activeTabSourceContext.worksheetId,
    });
    const executedQuestion = createExecutedQuestionSnapshot({
      taskPrompt: activeTab.taskPrompt || "",
      sqlAtRun: trimmedSql,
      ranAt: new Date().toISOString(),
      sourceLabel: activeTabSourceContext.sourceLabel,
      sourceTableName: activeTabSourceContext.sourceTableName || activeTabSourceContext.tableName,
      dataset: scopedDatasetForTab,
      clarificationDecision:
        runtimeContext.businessSqlPreviewInsertProvenance?.insertedSqlSnapshot === trimmedSql
          ? runtimeContext.businessSqlPreviewInsertProvenance.clarificationDecision
          : undefined,
    });

    latestRunByTabRef.current.set(activeTabIdAtRun, requestId);
    setTabEditorStatus(activeTabIdAtRun, "running");
    setTabPreviewResult(activeTabIdAtRun, {
      columns: [],
      rows: [],
      message: createPreviewMessage("running"),
      errorInsight: null,
      executionIdentity,
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

      if (!isLatestRunForTab(requestId, activeTabIdAtRun)) return;

      setTabEditorStatus(activeTabIdAtRun, "success");
      setTabPreviewResult(
        activeTabIdAtRun,
        createSqlSuccessPreviewResult(executionResult, executedQuestion, executionIdentity),
      );
      if (activeTabIdRef.current === activeTabIdAtRun) {
        onExecutionResult?.(executionResult);
      }
    } catch (error) {
      if (!isLatestRunForTab(requestId, activeTabIdAtRun)) return;

      setTabEditorStatus(activeTabIdAtRun, "error");
      setTabPreviewResult(
        activeTabIdAtRun,
        createSqlErrorPreviewResult({
          error,
          sqlText: trimmedSql,
          selectedDialect,
          dataset,
          activeTabSourceContext,
          appliedScopeSelections: activeTab.appliedScopeSelections || [],
          executedQuestion,
          executionIdentity,
        }),
      );
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
    onChange: handleEditorChange,
    onRun: runDraft,
    onExplain: explainDraft,
    onSaveDraft: saveDraft,
    onClear: clearDraft,
    // Option C — editor.schema mirrors the active tab's source schema so
    // Monaco column suggestions stay in sync with the tab.
    schema: activeTabSourceContext.schema.length > 0
      ? activeTabSourceContext.schema
      : dataset?.schema || [],
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
    readinessReport,
    selectedDialect,
    selectedDialectProfile,
    dialectOptions,
    draftConversionPreview,
    sqlTabs,
    setSelectedDialect: updateSelectedDialect,
    editor,
    applyDraftConversion,
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
    // Option C exports — consumers (SqlWorkspace, SqlSchemaPanel,
    // SqlAssistantRoutePage) read the active tab's source context from here
    // instead of recomputing it from the global dataset.
    activeTabSourceContext,
    scopedDatasetForTab,
  };
}

export default useSqlWorkspace;
