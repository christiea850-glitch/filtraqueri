import { useState } from "react";
import type { ActiveView, DatasetMetadata } from "../dataset/datasetTypes";
import type { DatasetId } from "../dataset/datasetRegistryTypes";
import { executeWorkspaceQuery } from "../execution/executeWorkspaceQuery";
import type { WorkspaceExecutionResult } from "../execution/workspaceExecutionTypes";
import type { FilterDefinition, FilterState } from "../filters/filterTypes";
import type { AggregationState } from "../query-builder/queryBuilderTypes";
import { coordinateExecutionResult } from "../workspace/workspaceOrchestration";
import type { WorkspaceExecutionCoordinatorOptions } from "../workspace/workspaceOrchestrationTypes";
import { getCurrentPageMetadata, type ActiveResultModel } from "./activeResultModel";
import type { ResultState, ResultTabKey } from "./resultTypes";
import { createEmptyResultState } from "./useResults";

type UseResultExecutionCoordinatorOptions = {
  dataset: DatasetMetadata | null;
  activeResultTab: ResultTabKey;
  setActiveResultTab: (tab: ResultTabKey) => void;
  activeResult: ResultState;
  activeResultModel: ActiveResultModel | null;
  previewResult: ResultState;
  setPreviewResult: (result: ResultState) => void;
  filteredResult: ResultState;
  setFilteredResult: (result: ResultState) => void;
  queriedResult: ResultState;
  setQueriedResult: (result: ResultState) => void;
  resultHiddenColumns: string[];
  updateDatasetSessionView: (view: ActiveView) => void;
  updateDatasetSessionResultTab: (tab: ResultTabKey) => void;
  buildBackendFilters: (dataset: DatasetMetadata | null) => FilterDefinition[];
  createFilterLabels: (filters: FilterDefinition[]) => string[];
  setFilterValues: (values: Record<string, FilterState>) => void;
  querySelectedColumns: string[];
  queryGroupBy: string[];
  activeAggregations: AggregationState[];
  querySortColumn: string;
  setQuerySortColumn: (column: string) => void;
  querySortDirection: ResultState["sortDirection"];
  setQuerySortDirection: (direction: ResultState["sortDirection"]) => void;
  queryLimit: string;
  setQueryLimit: (limit: string) => void;
  setHasRunQuery: (hasRunQuery: boolean) => void;
  recordExecutionResult: WorkspaceExecutionCoordinatorOptions["recordExecutionResult"];
  attachExecutionToActiveDataset: (executionId: string, datasetId?: DatasetId) => void;
  attachActiveResultToActiveDataset: (activeResultId: ResultTabKey, datasetId?: DatasetId) => void;
  addHistory: (action: string, detail: string, resultCount: number) => void;
  setErrorMessage: (message: string) => void;
};

const createOrderBy = (column: string, direction: ResultState["sortDirection"]) =>
  column ? { column, direction } : null;

function useResultExecutionCoordinator({
  dataset,
  activeResultTab,
  setActiveResultTab,
  activeResult,
  activeResultModel,
  previewResult,
  setPreviewResult,
  filteredResult,
  setFilteredResult,
  queriedResult,
  setQueriedResult,
  resultHiddenColumns,
  updateDatasetSessionView,
  updateDatasetSessionResultTab,
  buildBackendFilters,
  createFilterLabels,
  setFilterValues,
  querySelectedColumns,
  queryGroupBy,
  activeAggregations,
  querySortColumn,
  setQuerySortColumn,
  querySortDirection,
  setQuerySortDirection,
  queryLimit,
  setQueryLimit,
  setHasRunQuery,
  recordExecutionResult,
  attachExecutionToActiveDataset,
  attachActiveResultToActiveDataset,
  addHistory,
  setErrorMessage,
}: UseResultExecutionCoordinatorOptions) {
  const [isFiltering, setIsFiltering] = useState(false);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const buildActiveBackendFilters = () => buildBackendFilters(dataset);

  const handleResultTabChange = (tab: ResultTabKey) => {
    setActiveResultTab(tab);
    updateDatasetSessionResultTab(tab);
  };

  const activateResultTab = (tab: ResultTabKey) => {
    handleResultTabChange(tab);
    updateDatasetSessionView("results");
  };

  const updatePreviewResult = (nextResult: ResultState, shouldActivate = false) => {
    setPreviewResult(nextResult);
    if (shouldActivate) activateResultTab("preview");
  };

  const updateFilteredResult = (nextResult: ResultState, shouldActivate = false) => {
    setFilteredResult(nextResult);
    if (shouldActivate) activateResultTab("filtered");
  };

  const updateQueriedResult = (nextResult: ResultState, shouldActivate = false) => {
    setQueriedResult(nextResult);
    if (shouldActivate) activateResultTab("queried");
  };

  const coordinateActiveExecution = (
    executionResult: WorkspaceExecutionResult,
    resultTab: ResultTabKey,
    updateActiveResult: (nextResult: ResultState, shouldActivate?: boolean) => void,
    shouldActivate = false,
  ) => {
    const coordinationResult = coordinateExecutionResult({
      executionResult,
      resultTab,
      hiddenColumns: resultHiddenColumns,
      recordExecutionResult,
      updateActiveResult,
      shouldActivate,
    });
    attachExecutionToActiveDataset(
      coordinationResult.record.executionId,
      coordinationResult.record.datasetId,
    );
    attachActiveResultToActiveDataset(resultTab, coordinationResult.record.datasetId);
    return coordinationResult;
  };

  const applyFilters = async () => {
    if (!dataset) return;

    setIsFiltering(true);
    setErrorMessage("");

    try {
      const filters = buildActiveBackendFilters();
      const filterLabels = createFilterLabels(filters);
      const orderBy = createOrderBy(filteredResult.sortColumn, filteredResult.sortDirection);
      const executionResult = await executeWorkspaceQuery({
        source: "filtered",
        dataset,
        filters,
        sorting: orderBy,
        pagination: {
          page: 1,
          rowsPerPage: filteredResult.rowsPerPage,
        },
      });
      coordinateActiveExecution(executionResult, "filtered", updateFilteredResult, true);
      addHistory(
        "Filters",
        filterLabels.length > 0 ? filterLabels.join("; ") : "No filters",
        executionResult.pagination.totalCount,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not apply those filters. Please try again.";

      setErrorMessage(message);
    } finally {
      setIsFiltering(false);
    }
  };

  const resetFilters = async () => {
    setFilterValues({});

    if (!dataset) return;

    setIsFiltering(true);
    setErrorMessage("");

    try {
      const executionResult = await executeWorkspaceQuery({
        source: "preview",
        dataset,
        filters: [],
        sorting: null,
        pagination: {
          page: 1,
          rowsPerPage: previewResult.rowsPerPage,
        },
      });
      coordinateActiveExecution(executionResult, "preview", updatePreviewResult, true);
      setFilteredResult(createEmptyResultState());
      addHistory("Reset", "Cleared all filters", executionResult.pagination.totalCount);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not reset the filters. Please try again.";

      setErrorMessage(message);
    } finally {
      setIsFiltering(false);
    }
  };

  const loadPreviewPage = async (
    page: number,
    rowsPerPage = activeResult.rowsPerPage,
    sortColumn = activeResult.sortColumn,
    sortDirection = activeResult.sortDirection,
  ) => {
    if (!dataset) return;

    setIsFiltering(true);
    setErrorMessage("");

    try {
      const filters =
        activeResultTab === "filtered"
          ? activeResult.source?.filters || buildActiveBackendFilters()
          : [];
      const orderBy = createOrderBy(sortColumn, sortDirection);
      const executionResult = await executeWorkspaceQuery({
        source: activeResultTab === "filtered" ? "filtered" : "preview",
        dataset,
        filters,
        sorting: orderBy,
        pagination: {
          page,
          rowsPerPage,
        },
      });
      if (activeResultTab === "filtered") {
        coordinateActiveExecution(executionResult, "filtered", updateFilteredResult);
      } else {
        coordinateActiveExecution(executionResult, "preview", updatePreviewResult);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not load that page. Please try again.";

      setErrorMessage(message);
    } finally {
      setIsFiltering(false);
    }
  };

  const runVisualQuery = async () => {
    if (!dataset) return false;

    setIsRunningQuery(true);
    setErrorMessage("");
    setHasRunQuery(true);

    try {
      const filters = buildActiveBackendFilters();
      const orderBy = createOrderBy(querySortColumn, querySortDirection);
      const queryBuilderRequest = {
        selected_columns: activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns,
        group_by: queryGroupBy,
        aggregations: activeAggregations.map((aggregation) => ({
          function: aggregation.function,
          column: aggregation.column || null,
        })),
        filters,
        order_by: orderBy,
        limit: Number(queryLimit) || queriedResult.rowsPerPage,
        page: 1,
      };
      const executionResult = await executeWorkspaceQuery({
        source: "query-builder",
        dataset,
        filters,
        queryBuilder: queryBuilderRequest,
        sorting: orderBy,
        grouping: queryGroupBy,
        pagination: {
          page: 1,
          rowsPerPage: queryBuilderRequest.limit,
        },
      });
      coordinateActiveExecution(executionResult, "queried", updateQueriedResult, true);
      addHistory(
        "Query builder",
        activeAggregations.length > 0
          ? `${activeAggregations.length} aggregation${activeAggregations.length === 1 ? "" : "s"}`
          : `${querySelectedColumns.length} visible columns`,
        executionResult.pagination.totalCount,
      );
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not run that query. Please adjust the builder and try again.";

      setErrorMessage(message);
      return false;
    } finally {
      setIsRunningQuery(false);
    }
  };

  const loadQueryPage = async (
    page: number,
    rowsPerPage = queriedResult.rowsPerPage,
    sortColumn = queriedResult.sortColumn,
    sortDirection = queriedResult.sortDirection,
  ) => {
    if (!dataset) return;

    setIsRunningQuery(true);
    setErrorMessage("");
    setHasRunQuery(true);

    try {
      const sourceQuery = queriedResult.source?.queryBuilder;
      const filters = queriedResult.source?.filters || buildActiveBackendFilters();
      const orderBy = createOrderBy(sortColumn, sortDirection);
      const queryBuilderRequest = {
        selected_columns:
          sourceQuery?.selected_columns ||
          (activeAggregations.length > 0 ? queryGroupBy : querySelectedColumns),
        group_by: sourceQuery?.group_by || queryGroupBy,
        aggregations:
          sourceQuery?.aggregations ||
          activeAggregations.map((aggregation) => ({
            function: aggregation.function,
            column: aggregation.column || null,
          })),
        filters,
        order_by: orderBy,
        limit: rowsPerPage,
        page,
      };
      const executionResult = await executeWorkspaceQuery({
        source: "query-builder",
        dataset,
        filters,
        queryBuilder: queryBuilderRequest,
        sorting: orderBy,
        grouping: queryBuilderRequest.group_by,
        pagination: {
          page,
          rowsPerPage,
        },
      });
      coordinateActiveExecution(executionResult, "queried", updateQueriedResult);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We could not load that query page. Please try again.";

      setErrorMessage(message);
    } finally {
      setIsRunningQuery(false);
    }
  };

  const sortWorkspaceColumn = (column: string) => {
    if (activeResultTab === "queried") {
      const nextDirection =
        queriedResult.sortColumn === column && queriedResult.sortDirection === "ASC" ? "DESC" : "ASC";
      setQuerySortColumn(column);
      setQuerySortDirection(nextDirection);
      loadQueryPage(1, queriedResult.rowsPerPage, column, nextDirection);
      return;
    }

    const nextDirection =
      activeResult.sortColumn === column && activeResult.sortDirection === "ASC" ? "DESC" : "ASC";
    loadPreviewPage(1, activeResult.rowsPerPage, column, nextDirection);
  };

  const changeWorkspacePage = (page: number) => {
    const { totalPages } = getCurrentPageMetadata(activeResultModel);
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (activeResultTab === "queried") {
      loadQueryPage(nextPage);
      return;
    }

    loadPreviewPage(nextPage);
  };

  const changeWorkspaceRowsPerPage = (rowsPerPage: number) => {
    if (activeResultTab === "queried") {
      setQueryLimit(String(rowsPerPage));
      loadQueryPage(1, rowsPerPage);
      return;
    }

    loadPreviewPage(1, rowsPerPage);
  };

  return {
    isFiltering,
    isRunningQuery,
    handleResultTabChange,
    activateResultTab,
    applyFilters,
    resetFilters,
    loadPreviewPage,
    runVisualQuery,
    loadQueryPage,
    sortWorkspaceColumn,
    changeWorkspacePage,
    changeWorkspaceRowsPerPage,
  };
}

export default useResultExecutionCoordinator;
