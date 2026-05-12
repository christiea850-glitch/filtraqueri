import { type ChangeEvent, useEffect, useState } from "react";
import type { HumanIntent } from "../../components/dataset/DatasetSummaryPanel";
import { uploadDataset } from "../../services/api";
import { wrapWorkspaceExecutionOutput } from "../execution/executeWorkspaceQuery";
import type { WorkspaceExecutionResult } from "../execution/workspaceExecutionTypes";
import type { FilterState } from "../filters/filterTypes";
import type { HistoryItem } from "../history/historyTypes";
import type { AggregationState } from "../query-builder/queryBuilderTypes";
import type { ResultState, ResultTabKey, SortDirection } from "../results/resultTypes";
import { createEmptyResultState } from "../results/useResults";
import {
  resetWorkspaceForDatasetChange,
  restoreWorkspaceStateSafely,
} from "../workspace/workspaceOrchestration";
import type { DatasetMetadata, DatasetSession } from "./datasetTypes";
import useDatasetSessions from "./useDatasetSessions";

function useWorkspaceDatasetController({
  activeResultTab,
  setActiveResultTab,
  previewResult,
  setPreviewResult,
  filteredResult,
  setFilteredResult,
  queriedResult,
  setQueriedResult,
  resetResults,
  filterValues,
  setFilterValues,
  querySelectedColumns,
  queryGroupBy,
  queryAggregations,
  querySortColumn,
  querySortDirection,
  queryLimit,
  hasRunQuery,
  restoreQueryBuilder,
  resetQueryBuilder,
  queryHistory,
  setQueryHistory,
  clearHistory,
  setErrorMessage,
  setHumanIntent,
  onExecutionResult,
  onDatasetContextChange,
}: {
  activeResultTab: ResultTabKey;
  setActiveResultTab: (tab: ResultTabKey) => void;
  previewResult: ResultState;
  setPreviewResult: (result: ResultState) => void;
  filteredResult: ResultState;
  setFilteredResult: (result: ResultState) => void;
  queriedResult: ResultState;
  setQueriedResult: (result: ResultState) => void;
  resetResults: () => void;
  filterValues: Record<string, FilterState>;
  setFilterValues: (values: Record<string, FilterState>) => void;
  querySelectedColumns: string[];
  queryGroupBy: string[];
  queryAggregations: AggregationState[];
  querySortColumn: string;
  querySortDirection: SortDirection;
  queryLimit: string;
  hasRunQuery: boolean;
  restoreQueryBuilder: (state: {
    querySelectedColumns: string[];
    queryGroupBy: string[];
    queryAggregations: AggregationState[];
    querySortColumn: string;
    querySortDirection: SortDirection;
    queryLimit: string;
    hasRunQuery: boolean;
  }) => void;
  resetQueryBuilder: () => void;
  queryHistory: HistoryItem[];
  setQueryHistory: (history: HistoryItem[]) => void;
  clearHistory: () => void;
  setErrorMessage: (message: string) => void;
  setHumanIntent: (intent: HumanIntent | null) => void;
  onExecutionResult?: (result: WorkspaceExecutionResult) => void;
  onDatasetContextChange?: () => void;
}) {
  const {
    dataset,
    setDataset,
    restoreDataset,
    datasetRegistry,
    attachExecutionToActiveDataset,
    attachActiveResultToActiveDataset,
    recentDatasets,
    activeView,
    setActiveView,
    addRecentDataset,
    updateDatasetSessionView,
    updateDatasetSessionResultTab,
    activateRecentDataset: activateRecentDatasetSession,
    removeRecentDataset,
  } = useDatasetSessions();
  const [workspaceMode, setWorkspaceMode] = useState<"human" | "analyst">("human");
  const [shouldOpenFilePicker, setShouldOpenFilePicker] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const createDatasetSession = (datasetMetadata: DatasetMetadata): DatasetSession => ({
    dataset: datasetMetadata,
    lastActiveView: activeView,
    lastActiveResultTab: activeResultTab,
    previewResult,
    filteredResult,
    queriedResult,
    filterValues,
    querySelectedColumns,
    queryGroupBy,
    queryAggregations,
    querySortColumn,
    querySortDirection,
    queryLimit,
    hasRunQuery,
    activeResultTab,
    queryHistory,
  });

  const restoreDatasetSession = (session: DatasetSession) => {
    const restoredWorkspace = restoreWorkspaceStateSafely(session);
    onDatasetContextChange?.();
    restoreDataset(restoredWorkspace.dataset, restoredWorkspace.dataset.dataset_id);
    setPreviewResult(restoredWorkspace.previewResult);
    setFilteredResult(restoredWorkspace.filteredResult);
    setQueriedResult(restoredWorkspace.queriedResult);
    setFilterValues(session.filterValues);
    restoreQueryBuilder({
      querySelectedColumns: session.querySelectedColumns,
      queryGroupBy: session.queryGroupBy,
      queryAggregations: session.queryAggregations,
      querySortColumn: session.querySortColumn,
      querySortDirection: session.querySortDirection,
      queryLimit: session.queryLimit,
      hasRunQuery: session.hasRunQuery,
    });
    setActiveResultTab(restoredWorkspace.activeResultTab);
    setQueryHistory(session.queryHistory);
    setSelectedFileName(session.dataset.original_filename);
    setActiveView(session.lastActiveView || "results");
  };

  const activateRecentDataset = (datasetId: string) => {
    activateRecentDatasetSession(datasetId, restoreDatasetSession);
  };

  const openDatasetPicker = () => {
    updateDatasetSessionView("welcome");
    setShouldOpenFilePicker(true);
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setSelectedFileName(file.name);
    setIsUploading(true);
    setErrorMessage("");
    setDataset(null);
    onDatasetContextChange?.();
    const resetWorkspace = resetWorkspaceForDatasetChange();
    setActiveResultTab(resetWorkspace.activeResultTab);
    updateDatasetSessionResultTab(resetWorkspace.activeResultTab);
    resetResults();
    setFilterValues({});
    resetQueryBuilder();
    setHumanIntent(null);
    clearHistory();

    try {
      const uploadResult = await uploadDataset(file);
      const uploadColumns = uploadResult.dataset.schema.map((column) => column.name);
      const previewExecution = wrapWorkspaceExecutionOutput({
        source: "preview",
        dataset: uploadResult.dataset,
        inputRows: uploadResult.preview,
        inputColumns: uploadColumns,
        filters: [],
        sorting: null,
        pagination: {
          page: 1,
          rowsPerPage: 25,
        },
      });
      setDataset(uploadResult.dataset);
      setPreviewResult({
        ...previewExecution.activeResult,
        totalCount: uploadResult.dataset.row_count,
      });
      onExecutionResult?.({
        ...previewExecution,
        pagination: {
          ...previewExecution.pagination,
          totalCount: uploadResult.dataset.row_count,
        },
        activeResult: {
          ...previewExecution.activeResult,
          totalCount: uploadResult.dataset.row_count,
        },
      });
      setFilteredResult(createEmptyResultState());
      setQueriedResult(createEmptyResultState());
      restoreQueryBuilder({
        querySelectedColumns: uploadResult.dataset.schema.slice(0, 4).map((column) => column.name),
        queryGroupBy: [],
        queryAggregations: [{ id: 1, function: "COUNT", column: "" }],
        querySortColumn: "",
        querySortDirection: "ASC",
        queryLimit: "100",
        hasRunQuery: false,
      });
      updateDatasetSessionView("dataset");
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Upload failed. Please try again.";
      const message = rawMessage.toLowerCase().includes("csv")
        ? rawMessage
        : rawMessage.toLowerCase().includes("backend is not running")
          ? rawMessage
          : "Upload failed. Please check the file and try again.";

      setErrorMessage(message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const clearCurrentDatasetSession = () => {
    if (!dataset) return;

    const shouldClear = window.confirm(
      `Clear the current workspace session for "${dataset.original_filename}"? Recent dataset history will remain available.`,
    );

    if (!shouldClear) return;

    setDataset(null);
    onDatasetContextChange?.();
    setSelectedFileName("");
    const resetWorkspace = resetWorkspaceForDatasetChange();
    setActiveResultTab(resetWorkspace.activeResultTab);
    resetResults();
    setFilterValues({});
    resetQueryBuilder();
    setHumanIntent(null);
    clearHistory();
    setErrorMessage("");
    setActiveView("dataset");
  };

  const removeRecentDatasetWithConfirmation = (datasetId: string) => {
    const recentDataset = recentDatasets.find((session) => session.dataset.dataset_id === datasetId);
    const datasetName = recentDataset?.dataset.original_filename || "this dataset";
    const shouldRemove = window.confirm(
      `Remove "${datasetName}" from recent datasets? This will not delete the uploaded data.`,
    );

    if (shouldRemove) removeRecentDataset(datasetId);
  };

  const confirmFutureDatasetDelete = (datasetId: string) => {
    const targetDataset =
      dataset?.dataset_id === datasetId
        ? dataset
        : recentDatasets.find((session) => session.dataset.dataset_id === datasetId)?.dataset;
    const datasetName = targetDataset?.original_filename || "this dataset";
    const shouldContinue = window.confirm(
      `Delete "${datasetName}"? Backend dataset deletion is not connected yet, so no data will be deleted in this phase.`,
    );

    if (shouldContinue) {
      window.alert("Dataset deletion is future-ready, but backend deletion is not connected yet.");
    }
  };

  useEffect(() => {
    if (dataset) {
      addRecentDataset(createDatasetSession(dataset));
    }
  }, [
    dataset,
    previewResult,
    filteredResult,
    queriedResult,
    filterValues,
    querySelectedColumns,
    queryGroupBy,
    queryAggregations,
    querySortColumn,
    querySortDirection,
    queryLimit,
    hasRunQuery,
    activeResultTab,
    activeView,
    queryHistory,
  ]);

  return {
    dataset,
    datasetRegistry,
    attachExecutionToActiveDataset,
    attachActiveResultToActiveDataset,
    recentDatasets,
    activeView,
    setActiveView,
    workspaceMode,
    setWorkspaceMode,
    shouldOpenFilePicker,
    setShouldOpenFilePicker,
    selectedFileName,
    isUploading,
    updateDatasetSessionView,
    updateDatasetSessionResultTab,
    activateRecentDataset,
    openDatasetPicker,
    handleFileUpload,
    clearCurrentDatasetSession,
    removeRecentDatasetWithConfirmation,
    confirmFutureDatasetDelete,
  };
}

export default useWorkspaceDatasetController;
