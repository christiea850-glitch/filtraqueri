import { useCallback, useEffect, useRef, useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type { SqlDraftSnapshot } from "../../sqlWorkspacePersistence";
import type { AnalysisScopeSelection } from "../../workbook";
import type { SqlExecutionStatus, SqlPreviewResult } from "./sqlTypes";
import type {
  SqlWorkspaceTab,
  SqlWorkspaceTabSource,
  SqlWorkspaceTabsState,
} from "./sqlTabsTypes";

type SqlWorkspaceTabSeed = {
  dataset: DatasetMetadata | null;
  restoredActiveDraft: SqlDraftSnapshot | null;
  initialSql: string;
  initialDialect: SqlDialectId;
  initialPreviewResult: SqlPreviewResult;
  initialEditorStatus: SqlExecutionStatus;
  createStarterSql: (tableName: string | undefined, dialect: SqlDialectId) => string;
};

const getActiveSourceSnapshot = (dataset: DatasetMetadata | null): SqlWorkspaceTabSource => {
  const workbook = dataset?.workbook_metadata;
  const activeWorksheet = workbook?.worksheets.find(
    (worksheet) => worksheet.worksheetId === workbook.activeWorksheetId,
  );
  const activeAnalysisSource = workbook?.activeAnalysisSource;
  const cleanedCopy = workbook?.cleanedWorkingCopies.find(
    (copy) => copy.sourceWorksheetId === activeWorksheet?.worksheetId,
  );
  const sourceType =
    activeAnalysisSource?.type === "cleaned_working_copy"
      ? "cleaned_working_copy"
      : "original";
  const tableName = activeAnalysisSource?.tableName || dataset?.table_name || "uploaded_dataset";
  const title =
    activeWorksheet?.displayName ||
    activeWorksheet?.sheetName ||
    dataset?.table_name ||
    "Query draft";

  return {
    worksheetId: activeWorksheet?.worksheetId,
    sourceType,
    tableName,
    originalTableName: activeAnalysisSource?.originalTableName || activeWorksheet?.tableName,
    cleanedTableName: cleanedCopy?.cleanedTableName,
    title,
  };
};

const createSeedTab = ({
  dataset,
  restoredActiveDraft,
  initialSql,
  initialDialect,
  initialPreviewResult,
  initialEditorStatus,
}: SqlWorkspaceTabSeed): SqlWorkspaceTab => {
  const source = getActiveSourceSnapshot(dataset);

  return {
    id: restoredActiveDraft?.id || "active-draft",
    title: restoredActiveDraft?.label || source.title,
    worksheetId: source.worksheetId,
    sourceType: source.sourceType,
    tableName: source.tableName,
    originalTableName: source.originalTableName,
    cleanedTableName: source.cleanedTableName,
    selectedScopeSelections: [],
    appliedScopeSelections: [],
    sqlDraft: restoredActiveDraft?.sql ?? initialSql,
    dialect: restoredActiveDraft?.selectedDialect || initialDialect,
    previewResult: initialPreviewResult,
    editorStatus: initialEditorStatus,
    isDirty: false,
    createdFrom: restoredActiveDraft ? "manual" : "starter",
  };
};

const createNewTabId = () => `sql-tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const sqlWorkspaceTabsMemory = new Map<string, SqlWorkspaceTabsState>();

const getTabsMemoryKey = (dataset: DatasetMetadata | null) =>
  dataset
    ? `${dataset.dataset_id}:${dataset.workbook_metadata?.workbookId || "flat"}`
    : "no-dataset";

const createSourceTab = ({
  source,
  dialect,
  previewResult,
  editorStatus,
  createStarterSql,
}: {
  source: SqlWorkspaceTabSource;
  dialect: SqlDialectId;
  previewResult: SqlPreviewResult;
  editorStatus: SqlExecutionStatus;
  createStarterSql: SqlWorkspaceTabSeed["createStarterSql"];
}): SqlWorkspaceTab => ({
  id: createNewTabId(),
  title: source.title,
  worksheetId: source.worksheetId,
  sourceType: source.sourceType,
  tableName: source.tableName,
  originalTableName: source.originalTableName,
  cleanedTableName: source.cleanedTableName,
  selectedScopeSelections: [],
  appliedScopeSelections: [],
  sqlDraft: createStarterSql(source.tableName, dialect),
  dialect,
  previewResult,
  editorStatus,
  isDirty: false,
  createdFrom: "starter",
});

const isSameTabSource = (tab: SqlWorkspaceTab, source: SqlWorkspaceTabSource) =>
  tab.sourceType === source.sourceType &&
  (source.worksheetId
    ? tab.worksheetId === source.worksheetId
    : tab.tableName === source.tableName);

function useSqlWorkspaceTabs(seed: SqlWorkspaceTabSeed) {
  const memoryKey = getTabsMemoryKey(seed.dataset);
  const createInitialTabsState = (): SqlWorkspaceTabsState => {
    const tab = createSeedTab(seed);
    return {
      activeTabId: tab.id,
      tabs: [tab],
    };
  };
  const [tabsState, setTabsState] = useState<SqlWorkspaceTabsState>(() => {
    const restoredState = sqlWorkspaceTabsMemory.get(memoryKey);
    return restoredState || createInitialTabsState();
  });
  const tabsStateRef = useRef(tabsState);

  const commitTabsState = useCallback((updater: (currentState: SqlWorkspaceTabsState) => SqlWorkspaceTabsState) => {
    const nextState = updater(tabsStateRef.current);
    tabsStateRef.current = nextState;
    sqlWorkspaceTabsMemory.set(memoryKey, nextState);
    setTabsState(nextState);
  }, [memoryKey]);

  useEffect(() => {
    const restoredState = sqlWorkspaceTabsMemory.get(memoryKey);
    const nextState = restoredState || createInitialTabsState();

    tabsStateRef.current = nextState;
    sqlWorkspaceTabsMemory.set(memoryKey, nextState);
    setTabsState(nextState);
  }, [memoryKey]);

  const activeTab =
    tabsState.tabs.find((tab) => tab.id === tabsState.activeTabId) || tabsState.tabs[0];
  if (!activeTab) {
    throw new Error("SQL workspace tabs require at least one tab.");
  }

  const updateActiveTab = useCallback((updater: (tab: SqlWorkspaceTab) => SqlWorkspaceTab) => {
    commitTabsState((currentState) => ({
      ...currentState,
      tabs: currentState.tabs.map((tab) =>
        tab.id === currentState.activeTabId ? updater(tab) : tab,
      ),
    }));
  }, [commitTabsState]);

  const setActiveSqlDraft = useCallback((sqlDraft: string) => {
    updateActiveTab((tab) => ({
      ...tab,
      sqlDraft,
      isDirty: true,
    }));
  }, [updateActiveTab]);

  const setActiveDialect = useCallback((dialect: SqlDialectId) => {
    updateActiveTab((tab) => ({
      ...tab,
      dialect,
      isDirty: true,
    }));
  }, [updateActiveTab]);

  const syncActiveDialect = useCallback((dialect: SqlDialectId) => {
    updateActiveTab((tab) => (tab.dialect === dialect ? tab : { ...tab, dialect }));
  }, [updateActiveTab]);

  const setActiveEditorStatus = useCallback((editorStatus: SqlExecutionStatus) => {
    updateActiveTab((tab) => ({
      ...tab,
      editorStatus,
    }));
  }, [updateActiveTab]);

  const setActivePreviewResult = useCallback((previewResult: SqlPreviewResult) => {
    updateActiveTab((tab) => ({
      ...tab,
      previewResult,
    }));
  }, [updateActiveTab]);

  const setActiveTabSelectedScope = useCallback((selections: AnalysisScopeSelection[]) => {
    updateActiveTab((tab) => ({
      ...tab,
      selectedScopeSelections: selections,
      isDirty: true,
    }));
  }, [updateActiveTab]);

  const applyActiveTabScope = useCallback(() => {
    updateActiveTab((tab) => ({
      ...tab,
      appliedScopeSelections: tab.selectedScopeSelections || [],
      isDirty: true,
    }));
  }, [updateActiveTab]);

  const setActiveTabTaskPrompt = useCallback((taskPrompt: string) => {
    updateActiveTab((tab) => ({
      ...tab,
      taskPrompt,
      isDirty: true,
    }));
  }, [updateActiveTab]);

  const markActiveTabTemplate = useCallback((template: {
    id?: string;
    label?: string;
    createdFrom?: "template" | "report";
  }) => {
    updateActiveTab((tab) => ({
      ...tab,
      selectedTemplateId: template.id,
      selectedTemplateLabel: template.label,
      createdFrom: template.createdFrom || tab.createdFrom,
      isDirty: true,
    }));
  }, [updateActiveTab]);

  const replaceActiveTabDraft = useCallback((draft: SqlDraftSnapshot, options?: { activate?: boolean }) => {
    commitTabsState((currentState) => {
      const shouldActivate = Boolean(options?.activate);
      const currentTab =
        currentState.tabs.find((tab) =>
          shouldActivate ? tab.id === draft.id : tab.id === currentState.activeTabId,
        ) || currentState.tabs[0];
      if (!currentTab) return currentState;

      const nextTab = {
        ...currentTab,
        id: shouldActivate ? draft.id : currentTab.id,
        title: draft.label || currentTab.title,
        sqlDraft: draft.sql,
        dialect: draft.selectedDialect,
        isDirty: false,
      };

      return {
        activeTabId: shouldActivate ? nextTab.id : currentState.activeTabId,
        tabs: [
          nextTab,
          ...currentState.tabs.filter((tab) => tab.id !== nextTab.id),
        ],
      };
    });
  }, [commitTabsState]);

  const createTab = useCallback(() => {
    const source = getActiveSourceSnapshot(seed.dataset);
    const tab = createSourceTab({
      source,
      dialect: activeTab.dialect,
      previewResult: seed.initialPreviewResult,
      editorStatus: seed.initialEditorStatus,
      createStarterSql: seed.createStarterSql,
    });

    commitTabsState((currentState) => ({
      activeTabId: tab.id,
      tabs: [...currentState.tabs, tab],
    }));
  }, [
    activeTab.dialect,
    commitTabsState,
    seed,
    seed.createStarterSql,
    seed.dataset,
    seed.initialEditorStatus,
    seed.initialPreviewResult,
  ]);

  const openSourceTab = useCallback((source: SqlWorkspaceTabSource) => {
    commitTabsState((currentState) => {
      const existingTab = currentState.tabs.find((tab) => isSameTabSource(tab, source));
      if (existingTab) {
        return {
          ...currentState,
          activeTabId: existingTab.id,
        };
      }

      const tab = createSourceTab({
        source,
        dialect: activeTab.dialect,
        previewResult: seed.initialPreviewResult,
        editorStatus: seed.initialEditorStatus,
        createStarterSql: seed.createStarterSql,
      });

      return {
        activeTabId: tab.id,
        tabs: [...currentState.tabs, tab],
      };
    });
  }, [
    activeTab.dialect,
    commitTabsState,
    seed.createStarterSql,
    seed.initialEditorStatus,
    seed.initialPreviewResult,
  ]);

  const switchTab = useCallback((tabId: string) => {
    commitTabsState((currentState) =>
      currentState.tabs.some((tab) => tab.id === tabId)
        ? { ...currentState, activeTabId: tabId }
        : currentState,
    );
  }, [commitTabsState]);

  const closeTab = useCallback((tabId: string) => {
    commitTabsState((currentState) => {
      if (currentState.tabs.length <= 1) return currentState;

      const closingIndex = currentState.tabs.findIndex((tab) => tab.id === tabId);
      if (closingIndex === -1) return currentState;

      const nextTabs = currentState.tabs.filter((tab) => tab.id !== tabId);
      const nextActiveTabId =
        currentState.activeTabId === tabId
          ? nextTabs[Math.min(closingIndex, nextTabs.length - 1)]?.id || nextTabs[0].id
          : currentState.activeTabId;

      return {
        activeTabId: nextActiveTabId,
        tabs: nextTabs,
      };
    });
  }, [commitTabsState]);

  return {
    tabsState,
    activeTab,
    createTab,
    openSourceTab,
    switchTab,
    closeTab,
    setActiveSqlDraft,
    setActiveDialect,
    syncActiveDialect,
    setActiveEditorStatus,
    setActivePreviewResult,
    setActiveTabSelectedScope,
    applyActiveTabScope,
    setActiveTabTaskPrompt,
    markActiveTabTemplate,
    replaceActiveTabDraft,
  };
}

export default useSqlWorkspaceTabs;
