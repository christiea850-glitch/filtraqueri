import { useMemo } from "react";
import type { DatasetMetadata, DatasetSession, WorkspaceMode } from "../dataset/datasetTypes";
import type { ExecutionRegistryState } from "../execution/executionRegistryTypes";
import type { FilterDefinition, SortDefinition } from "../filters/filterTypes";
import type { AggregationState, QueryBuilderRequest } from "../query-builder/queryBuilderTypes";
import type { ActiveResultModel } from "../results/activeResultModel";
import type { ResultState, ResultTabKey } from "../results/resultTypes";
import {
  buildWorkspaceStateSnapshot,
  createQueryBuilderSnapshot,
  validateWorkspaceLinks,
} from "./workspaceOrchestration";

function useWorkspaceOrchestrationSnapshot({
  dataset,
  recentDatasets,
  activeResultTab,
  activeResult,
  activeResultModel,
  executionRegistry,
  mode,
  activeFilters,
  sorting,
  grouping,
  querySelectedColumns,
  queryGroupBy,
  queryAggregations,
  querySortColumn,
  querySortDirection,
  queryLimit,
  hasRunQuery,
  latestQueryRequest,
}: {
  dataset: DatasetMetadata | null;
  recentDatasets: DatasetSession[];
  activeResultTab: ResultTabKey;
  activeResult: ResultState;
  activeResultModel: ActiveResultModel | null;
  executionRegistry: ExecutionRegistryState;
  mode: WorkspaceMode;
  activeFilters: FilterDefinition[];
  sorting: SortDefinition | null;
  grouping: string[];
  querySelectedColumns: string[];
  queryGroupBy: string[];
  queryAggregations: AggregationState[];
  querySortColumn: string;
  querySortDirection: ResultState["sortDirection"];
  queryLimit: string;
  hasRunQuery: boolean;
  latestQueryRequest: QueryBuilderRequest | null;
}) {
  const snapshot = useMemo(
    () =>
      buildWorkspaceStateSnapshot({
        dataset,
        recentDatasets,
        activeResultTab,
        activeResult,
        activeResultModel,
        executionRegistry,
        mode,
        activeFilters,
        sorting,
        grouping,
        queryBuilder: createQueryBuilderSnapshot({
          selectedColumns: querySelectedColumns,
          groupBy: queryGroupBy,
          aggregations: queryAggregations,
          sortColumn: querySortColumn,
          sortDirection: querySortDirection,
          limit: queryLimit,
          hasRunQuery,
          latestRequest: latestQueryRequest,
        }),
      }),
    [
      dataset,
      recentDatasets,
      activeResultTab,
      activeResult,
      activeResultModel,
      executionRegistry,
      mode,
      activeFilters,
      sorting,
      grouping,
      querySelectedColumns,
      queryGroupBy,
      queryAggregations,
      querySortColumn,
      querySortDirection,
      queryLimit,
      hasRunQuery,
      latestQueryRequest,
    ],
  );

  return {
    snapshot,
    linkValidation: validateWorkspaceLinks(snapshot),
  };
}

export default useWorkspaceOrchestrationSnapshot;
