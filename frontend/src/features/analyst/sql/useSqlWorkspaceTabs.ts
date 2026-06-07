import { useCallback, useState } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type { SqlDraftSnapshot } from "../../sqlWorkspacePersistence";
import type { SqlExecutionStatus, SqlPreviewResult } from "./sqlTypes";
import type {
  SqlWorkspaceSourceType,
  SqlWorkspaceTab,
  SqlWorkspaceTabsState,
} from "./sqlTabsTypes";

type SqlWorkspaceTabSeed = {
  dataset: DatasetMetadata | null;
  restoredActiveDraft: SqlDraftSnapshot | null;
  initialSql: string;
  initialDialect: SqlDialectId;
  initialPreviewResult: SqlPreviewResult;
  initialEditorStatus: SqlExecutionStatus;
};

type ActiveSourceSnapshot = {
  worksheetId?: string;
  sourceType: SqlWorkspaceSourceType;
  tableName: string;
  originalTableName?: string;
  cleanedTableName?: string;
  title: string;
};

const getActiveSourceSnapshot = (dataset: DatasetMetadata | null): ActiveSourceSnapshot => {
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
    sqlDraft: restoredActiveDraft?.sql ?? initialSql,
    dialect: restoredActiveDraft?.selectedDialect || initialDialect,
    previewResult: initialPreviewResult,
    editorStatus: initialEditorStatus,
    isDirty: false,
    createdFrom: restoredActiveDraft ? "manual" : "starter",
  };
};

function useSqlWorkspaceTabs(seed: SqlWorkspaceTabSeed) {
  const [tabsState, setTabsState] = useState<SqlWorkspaceTabsState>(() => {
    const tab = createSeedTab(seed);
    return {
      activeTabId: tab.id,
      tabs: [tab],
    };
  });

  const activeTab =
    tabsState.tabs.find((tab) => tab.id === tabsState.activeTabId) || tabsState.tabs[0];
  if (!activeTab) {
    throw new Error("SQL workspace tabs require at least one tab.");
  }

  const updateActiveTab = useCallback((updater: (tab: SqlWorkspaceTab) => SqlWorkspaceTab) => {
    setTabsState((currentState) => ({
      ...currentState,
      tabs: currentState.tabs.map((tab) =>
        tab.id === currentState.activeTabId ? updater(tab) : tab,
      ),
    }));
  }, []);

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

  const replaceActiveTabDraft = useCallback((draft: SqlDraftSnapshot) => {
    const source = getActiveSourceSnapshot(seed.dataset);
    setTabsState((currentState) => {
      const currentTab =
        currentState.tabs.find((tab) => tab.id === draft.id) || currentState.tabs[0];
      if (!currentTab) return currentState;

      return {
        activeTabId: draft.id,
        tabs: [
          {
            ...currentTab,
            id: draft.id,
            title: draft.label || source.title,
            worksheetId: source.worksheetId,
            sourceType: source.sourceType,
            tableName: source.tableName,
            originalTableName: source.originalTableName,
            cleanedTableName: source.cleanedTableName,
            sqlDraft: draft.sql,
            dialect: draft.selectedDialect,
            isDirty: false,
          },
          ...currentState.tabs.filter((tab) => tab.id !== draft.id),
        ],
      };
    });
  }, [seed.dataset]);

  return {
    tabsState,
    activeTab,
    setActiveSqlDraft,
    setActiveDialect,
    syncActiveDialect,
    setActiveEditorStatus,
    setActivePreviewResult,
    replaceActiveTabDraft,
  };
}

export default useSqlWorkspaceTabs;
