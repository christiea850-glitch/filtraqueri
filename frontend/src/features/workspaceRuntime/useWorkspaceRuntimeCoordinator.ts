import { useEffect, useMemo, useState } from "react";
import type { ActiveView, DatasetMetadata, DatasetSession, WorkspaceMode } from "../dataset/datasetTypes";
import type { DatasetRegistryState } from "../dataset/datasetRegistryTypes";
import type { ExecutionRegistryState } from "../execution/executionRegistryTypes";
import type { FilterDefinition } from "../filters/filterTypes";
import type { AggregationState } from "../query-builder/queryBuilderTypes";
import type { ActiveResultModel } from "../results/activeResultModel";
import type { ResultState, ResultTabKey } from "../results/resultTypes";
import type { SqlWorkspaceMetadataSnapshot } from "../sqlWorkspacePersistence";
import {
  createQueryBuilderSnapshot,
} from "../workspace/workspaceOrchestration";
import useWorkspaceOrchestrationSnapshot from "../workspace/useWorkspaceOrchestrationSnapshot";
import {
  buildWorkspaceRuntimeContext,
} from "./runtimeContext";
import { createRuntimeNavigationSelection } from "./runtimeNavigationAdapter";
import {
  loadRuntimePersistenceState,
  saveRuntimePersistenceState,
} from "./runtimePersistence";

type UseWorkspaceRuntimeCoordinatorOptions = {
  dataset: DatasetMetadata | null;
  recentDatasets: DatasetSession[];
  activeView: ActiveView;
  activeResultTab: ResultTabKey;
  activeResult: ResultState;
  activeResultModel: ActiveResultModel | null;
  executionRegistry: ExecutionRegistryState;
  datasetRegistry: DatasetRegistryState;
  workspaceMode: WorkspaceMode;
  activeFilters: FilterDefinition[];
  querySelectedColumns: string[];
  queryGroupBy: string[];
  queryAggregations: AggregationState[];
  querySortColumn: string;
  querySortDirection: ResultState["sortDirection"];
  queryLimit: string;
  hasRunQuery: boolean;
  sqlWorkspaceMetadata: SqlWorkspaceMetadataSnapshot;
  humanIntentLabel: string | null;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  updateDatasetSessionView: (view: ActiveView) => void;
};

export function useWorkspaceRuntimeCoordinator({
  dataset,
  recentDatasets,
  activeView,
  activeResultTab,
  activeResult,
  activeResultModel,
  executionRegistry,
  datasetRegistry,
  workspaceMode,
  activeFilters,
  querySelectedColumns,
  queryGroupBy,
  queryAggregations,
  querySortColumn,
  querySortDirection,
  queryLimit,
  hasRunQuery,
  sqlWorkspaceMetadata,
  humanIntentLabel,
  setWorkspaceMode,
  updateDatasetSessionView,
}: UseWorkspaceRuntimeCoordinatorOptions) {
  const [runtimePersistence, setRuntimePersistence] = useState(loadRuntimePersistenceState);
  const queryBuilderRuntimeSnapshot = useMemo(
    () =>
      createQueryBuilderSnapshot({
        selectedColumns: querySelectedColumns,
        groupBy: queryGroupBy,
        aggregations: queryAggregations,
        sortColumn: querySortColumn,
        sortDirection: querySortDirection,
        limit: queryLimit,
        hasRunQuery,
        latestRequest: activeResult.source?.queryBuilder || null,
      }),
    [
      activeResult.source?.queryBuilder,
      hasRunQuery,
      queryAggregations,
      queryGroupBy,
      queryLimit,
      querySelectedColumns,
      querySortColumn,
      querySortDirection,
    ],
  );

  useWorkspaceOrchestrationSnapshot({
    dataset,
    recentDatasets,
    activeResultTab,
    activeResult,
    activeResultModel,
    executionRegistry,
    datasetRegistry,
    mode: workspaceMode,
    activeFilters,
    sorting: activeResult.sortColumn
      ? {
          column: activeResult.sortColumn,
          direction: activeResult.sortDirection,
        }
      : null,
    grouping: activeResultModel?.grouping.columns || queryGroupBy,
    querySelectedColumns,
    queryGroupBy,
    queryAggregations,
    querySortColumn,
    querySortDirection,
    queryLimit,
    hasRunQuery,
    latestQueryRequest: activeResult.source?.queryBuilder || null,
  });

  const workspaceRuntimeContext = useMemo(
    () =>
      buildWorkspaceRuntimeContext({
        dataset,
        mode: workspaceMode,
        activeView,
        activeResultTab,
        activeResultModel,
        queryBuilder: queryBuilderRuntimeSnapshot,
        sqlWorkspaceMetadata,
        executionRegistry,
        humanIntentLabel,
        selectedTrailItemId: runtimePersistence.selectedTrailItemId,
        selectedContextualObjectId: runtimePersistence.selectedContextualObjectId,
        returnContinuationId: runtimePersistence.returnContinuationId,
      }),
    [
      activeResultModel,
      activeResultTab,
      activeView,
      dataset,
      executionRegistry,
      humanIntentLabel,
      queryBuilderRuntimeSnapshot,
      runtimePersistence.selectedTrailItemId,
      runtimePersistence.selectedContextualObjectId,
      runtimePersistence.returnContinuationId,
      sqlWorkspaceMetadata,
      workspaceMode,
    ],
  );

  useEffect(() => {
    saveRuntimePersistenceState(runtimePersistence);
  }, [runtimePersistence]);

  const onRuntimePanelToggle = () =>
    setRuntimePersistence((currentState) => ({
      ...currentState,
      isRuntimePanelCollapsed: !currentState.isRuntimePanelCollapsed,
    }));

  const onRuntimeTrailSelect = (
    trailItemId: string,
    targetView: ActiveView,
    targetMode: WorkspaceMode,
  ) => {
    setRuntimePersistence((currentState) =>
      createRuntimeNavigationSelection({
        runtimeContext: workspaceRuntimeContext,
        currentPersistence: currentState,
        request: {
          id: trailItemId,
          targetView,
          targetMode,
        },
      }).persistence,
    );
    if (targetMode !== workspaceMode) setWorkspaceMode(targetMode);
    updateDatasetSessionView(targetView);
  };

  return {
    runtimePersistence,
    setRuntimePersistence,
    workspaceRuntimeContext,
    onRuntimePanelToggle,
    onRuntimeTrailSelect,
  };
}

export default useWorkspaceRuntimeCoordinator;
