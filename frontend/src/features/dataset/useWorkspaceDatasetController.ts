import { type ChangeEvent, useEffect, useState } from "react";
import type { HumanIntent } from "../../components/dataset/DatasetSummaryPanel";
import {
  getDataset,
  getPreview,
  getWorkspaceManifest,
  listWorkspaceManifests,
  reviewWorkbookRelationship,
  selectWorkbookWorksheet,
  updateWorkspaceManifest,
  uploadDataset,
} from "../../services/api";
import { wrapWorkspaceExecutionOutput } from "../execution/executeWorkspaceQuery";
import type { WorkspaceExecutionResult } from "../execution/workspaceExecutionTypes";
import type { FilterState } from "../filters/filterTypes";
import type { HistoryItem } from "../history/historyTypes";
import type { AggregationState } from "../query-builder/queryBuilderTypes";
import type { ResultState, ResultTabKey, SortDirection } from "../results/resultTypes";
import { createEmptyResultState } from "../results/useResults";
import {
  createSqlWorkspaceMetadataSnapshot,
  normalizeSqlWorkspaceMetadataSnapshot,
  type SqlWorkspaceMetadataSnapshot,
} from "../sqlWorkspacePersistence";
import {
  resetWorkspaceForDatasetChange,
  restoreWorkspaceStateSafely,
} from "../workspace/workspaceOrchestration";
import {
  clearActiveWorkspaceId,
  loadActiveWorkspaceId,
  saveActiveWorkspaceId,
} from "../workspace/workspacePersistence";
import {
  gracefullyResetBrokenReferences,
  listSavedWorkspaces,
  recoverWorkspaceSafely,
} from "../workspace/workspaceManager";
import type { DatasetMetadata, DatasetSession } from "./datasetTypes";
import useDatasetSessions from "./useDatasetSessions";

const GENERIC_UPLOAD_FAILURE_MESSAGE = "Upload failed. Please check the file and try again.";
const POST_UPLOAD_FAILURE_MESSAGE =
  "Dataset uploaded, but FiltraQueri could not finish opening it. Please refresh or reopen it from Recent work.";

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage;
}

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
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [isRestoringWorkspace, setIsRestoringWorkspace] = useState(false);
  const [shouldOpenFilePicker, setShouldOpenFilePicker] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSwitchingWorksheet, setIsSwitchingWorksheet] = useState(false);
  const [sqlWorkspaceMetadata, setSqlWorkspaceMetadata] =
    useState<SqlWorkspaceMetadataSnapshot>(() => createSqlWorkspaceMetadataSnapshot());

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

  const applyPreviewDatasetResult = (
    datasetMetadata: DatasetMetadata,
    previewRows: Record<string, unknown>[],
  ) => {
    const columns = datasetMetadata.schema.map((column) => column.name);
    const previewExecution = wrapWorkspaceExecutionOutput({
      source: "preview",
      dataset: datasetMetadata,
      inputRows: previewRows,
      inputColumns: columns,
      filters: [],
      sorting: null,
      pagination: {
        page: 1,
        rowsPerPage: 25,
      },
    });

    setPreviewResult({
      ...previewExecution.activeResult,
      totalCount: datasetMetadata.row_count,
    });
    onExecutionResult?.({
      ...previewExecution,
      pagination: {
        ...previewExecution.pagination,
        totalCount: datasetMetadata.row_count,
      },
      activeResult: {
        ...previewExecution.activeResult,
        totalCount: datasetMetadata.row_count,
      },
    });
  };

  const openDatasetPicker = () => {
    updateDatasetSessionView("welcome");
    setShouldOpenFilePicker(true);
  };

  const handleWorksheetSelect = async (worksheetId: string) => {
    if (!dataset || isSwitchingWorksheet) return;

    setIsSwitchingWorksheet(true);
    setErrorMessage("");

    try {
      const selectionResult = await selectWorkbookWorksheet(dataset.dataset_id, worksheetId);
      setDataset(selectionResult.dataset);
      onDatasetContextChange?.();
      applyPreviewDatasetResult(selectionResult.dataset, selectionResult.preview);
      setFilteredResult(createEmptyResultState());
      setQueriedResult(createEmptyResultState());
      setFilterValues({});
      resetQueryBuilder();
      restoreQueryBuilder({
        querySelectedColumns: selectionResult.dataset.schema
          .slice(0, 4)
          .map((column) => column.name),
        queryGroupBy: [],
        queryAggregations: [{ id: 1, function: "COUNT", column: "" }],
        querySortColumn: "",
        querySortDirection: "ASC",
        queryLimit: "100",
        hasRunQuery: false,
      });
      setActiveResultTab("preview");
      updateDatasetSessionResultTab("preview");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Worksheet could not be selected.",
      );
    } finally {
      setIsSwitchingWorksheet(false);
    }
  };

  const handleRelationshipReview = async (
    candidateId: string,
    reviewStatus: "pending" | "accepted" | "dismissed",
    notes?: string,
  ) => {
    if (!dataset) return;

    setErrorMessage("");

    try {
      const reviewResult = await reviewWorkbookRelationship(dataset.dataset_id, {
        candidate_id: candidateId,
        review_status: reviewStatus,
        notes,
      });
      setDataset(reviewResult.dataset);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Relationship review could not be saved.",
      );
    }
  };

  const restoreWorkspaceFromManifest = async (workspaceId: string) => {
    setIsRestoringWorkspace(true);
    setErrorMessage("");

    try {
      const response = await getWorkspaceManifest(workspaceId);
      const workspace = gracefullyResetBrokenReferences(response.workspace);
      const activeDatasetId = workspace.active_dataset_id;
      if (!activeDatasetId) return;

      const [{ dataset: restoredDataset }, previewResult] = await Promise.all([
        getDataset(activeDatasetId),
        getPreview(activeDatasetId, { limit: 25, page: 1 }),
      ]);
      const queryMetadata = workspace.query_builder_metadata || {};
      const restoredSqlWorkspaceMetadata = normalizeSqlWorkspaceMetadataSnapshot(
        workspace.sql_workspace_metadata,
      );
      const defaultSelectedColumns = restoredDataset.schema.slice(0, 4).map((column) => column.name);
      const restoredAggregations = Array.isArray(queryMetadata.aggregations)
        ? queryMetadata.aggregations
        : [{ id: 1, function: "COUNT" as const, column: "" }];
      const restoredColumns = restoredDataset.schema.map((column) => column.name);
      const previewExecution = wrapWorkspaceExecutionOutput({
        source: "preview",
        dataset: restoredDataset,
        inputRows: previewResult.rows,
        inputColumns: restoredColumns,
        filters: [],
        sorting: null,
        pagination: {
          page: previewResult.page,
          rowsPerPage: previewResult.limit,
        },
      });

      restoreDataset(restoredDataset, workspace.workspace_id);
      setPreviewResult({
        ...previewExecution.activeResult,
        totalCount: restoredDataset.row_count,
      });
      setFilteredResult(createEmptyResultState());
      setQueriedResult(createEmptyResultState());
      setFilterValues(
        workspace.filter_metadata && typeof workspace.filter_metadata === "object"
          ? (workspace.filter_metadata as Record<string, FilterState>)
          : {},
      );
      resetQueryBuilder();
      restoreQueryBuilder({
        querySelectedColumns: Array.isArray(queryMetadata.selected_columns)
          ? queryMetadata.selected_columns
          : defaultSelectedColumns,
        queryGroupBy: Array.isArray(queryMetadata.group_by) ? queryMetadata.group_by : [],
        queryAggregations: restoredAggregations as AggregationState[],
        querySortColumn:
          typeof queryMetadata.sort_column === "string" ? queryMetadata.sort_column : "",
        querySortDirection: queryMetadata.sort_direction === "DESC" ? "DESC" : "ASC",
        queryLimit: typeof queryMetadata.limit === "string" ? queryMetadata.limit : "100",
        hasRunQuery: false,
      });
      setActiveResultTab(workspace.current_result_tab === "preview" ? "preview" : "preview");
      setWorkspaceMode(workspace.current_mode === "analyst" ? "analyst" : "human");
      setSqlWorkspaceMetadata(restoredSqlWorkspaceMetadata);
      setSelectedFileName(restoredDataset.original_filename);
      setActiveWorkspaceId(workspace.workspace_id);
      saveActiveWorkspaceId(workspace.workspace_id);
      setActiveView(workspace.current_mode === "analyst" ? "sqlWorkspace" : "results");
      onExecutionResult?.({
        ...previewExecution,
        pagination: {
          ...previewExecution.pagination,
          totalCount: restoredDataset.row_count,
        },
        activeResult: {
          ...previewExecution.activeResult,
          totalCount: restoredDataset.row_count,
        },
      });
    } catch {
      clearActiveWorkspaceId();
      setActiveWorkspaceId("");
    } finally {
      setIsRestoringWorkspace(false);
    }
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
    setSqlWorkspaceMetadata(createSqlWorkspaceMetadataSnapshot());
    setHumanIntent(null);
    clearHistory();

    let uploadResult: Awaited<ReturnType<typeof uploadDataset>>;

    try {
      uploadResult = await uploadDataset(file);
    } catch (error) {
      console.error("Dataset upload request failed", error);
      setErrorMessage(getErrorMessage(error, GENERIC_UPLOAD_FAILURE_MESSAGE));
      setIsUploading(false);
      event.target.value = "";
      return;
    }

    try {
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
      setActiveWorkspaceId(uploadResult.workspace_manifest.workspace_id);
      saveActiveWorkspaceId(uploadResult.workspace_manifest.workspace_id);
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
      console.error("Dataset post-upload handling failed", error);
      setErrorMessage(POST_UPLOAD_FAILURE_MESSAGE);
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
    clearActiveWorkspaceId();
    setActiveWorkspaceId("");
    setSelectedFileName("");
    const resetWorkspace = resetWorkspaceForDatasetChange();
    setActiveResultTab(resetWorkspace.activeResultTab);
    resetResults();
    setFilterValues({});
    resetQueryBuilder();
    setSqlWorkspaceMetadata(createSqlWorkspaceMetadataSnapshot());
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
    const storedWorkspaceId = loadActiveWorkspaceId();
    if (!storedWorkspaceId) return;

    const recoverLastWorkspace = async () => {
      try {
        const { workspaces } = await listWorkspaceManifests();
        const savedWorkspaces = listSavedWorkspaces(workspaces, storedWorkspaceId);
        const recoveryDecision = recoverWorkspaceSafely(
          savedWorkspaces.find((workspace) => workspace.workspace_id === storedWorkspaceId) || null,
        );

        if (recoveryDecision.canRecover && recoveryDecision.workspaceId) {
          await restoreWorkspaceFromManifest(recoveryDecision.workspaceId);
          return;
        }

        clearActiveWorkspaceId();
        setActiveWorkspaceId("");
      } catch {
        await restoreWorkspaceFromManifest(storedWorkspaceId);
      }
    };

    recoverLastWorkspace();
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId || !dataset || isRestoringWorkspace) return;

    updateWorkspaceManifest(activeWorkspaceId, {
      active_dataset_id: dataset.dataset_id,
      active_result_id: activeResultTab,
      current_result_tab: activeResultTab,
      current_mode: workspaceMode,
      filter_metadata: filterValues,
      query_builder_metadata: {
        selected_columns: querySelectedColumns,
        group_by: queryGroupBy,
        aggregations: queryAggregations,
        sort_column: querySortColumn,
        sort_direction: querySortDirection,
        limit: queryLimit,
        has_run_query: hasRunQuery,
      },
      sql_workspace_metadata: sqlWorkspaceMetadata,
    }).catch(() => undefined);
  }, [
    activeWorkspaceId,
    dataset,
    activeResultTab,
    workspaceMode,
    querySelectedColumns,
    queryGroupBy,
    queryAggregations,
    querySortColumn,
    querySortDirection,
    queryLimit,
    hasRunQuery,
    filterValues,
    sqlWorkspaceMetadata,
    isRestoringWorkspace,
  ]);

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
    sqlWorkspaceMetadata,
    setSqlWorkspaceMetadata,
    shouldOpenFilePicker,
    setShouldOpenFilePicker,
    selectedFileName,
    isUploading: isUploading || isRestoringWorkspace,
    isSwitchingWorksheet,
    updateDatasetSessionView,
    updateDatasetSessionResultTab,
    activateRecentDataset,
    openDatasetPicker,
    handleFileUpload,
    handleWorksheetSelect,
    handleRelationshipReview,
    clearCurrentDatasetSession,
    removeRecentDatasetWithConfirmation,
    confirmFutureDatasetDelete,
  };
}

export default useWorkspaceDatasetController;
