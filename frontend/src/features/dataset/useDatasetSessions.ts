import { useState } from "react";
import type { ActiveView, DatasetMetadata, DatasetSession } from "./datasetTypes";
import type { ResultTabKey } from "../results/resultTypes";
import { normalizeUnknownWorkbookMetadata } from "../workbook";
import {
  attachActiveResultToDataset,
  attachExecutionToDataset,
  clearActiveDatasetSafely,
  createEmptyDatasetRegistry,
  getActiveDataset,
  registerDataset,
  restoreDatasetState,
  setActiveDataset,
  trimStaleDatasetReferences,
} from "./datasetRegistry";
import type { DatasetId, DatasetRegistryState } from "./datasetRegistryTypes";

type UseDatasetSessionsOptions = {
  initialView?: ActiveView;
};

function useDatasetSessions({ initialView = "welcome" }: UseDatasetSessionsOptions = {}) {
  const [datasetRegistry, setDatasetRegistry] = useState<DatasetRegistryState>(
    createEmptyDatasetRegistry,
  );
  const [recentDatasets, setRecentDatasets] = useState<DatasetSession[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>(initialView);
  const activeDatasetRecord = getActiveDataset(datasetRegistry);
  const dataset = activeDatasetRecord?.metadata || null;
  const normalizeDatasetMetadata = (metadata: DatasetMetadata): DatasetMetadata => {
    const workbookMetadata = normalizeUnknownWorkbookMetadata(metadata.workbook_metadata);
    if (!workbookMetadata) {
      const { workbook_metadata: _workbookMetadata, ...legacyMetadata } = metadata;
      return legacyMetadata;
    }

    return {
      ...metadata,
      table_name: metadata.table_name || "data",
      workbook_metadata: workbookMetadata,
    };
  };

  const setDataset = (nextDataset: DatasetMetadata | null) => {
    setDatasetRegistry((currentRegistry) =>
      nextDataset
        ? registerDataset(currentRegistry, normalizeDatasetMetadata(nextDataset), {
            sourceType: "uploaded",
            isActive: true,
          })
        : clearActiveDatasetSafely(currentRegistry),
    );
  };

  const restoreDataset = (nextDataset: DatasetMetadata, sourceSessionId?: string) => {
    setDatasetRegistry((currentRegistry) =>
      restoreDatasetState(currentRegistry, normalizeDatasetMetadata(nextDataset), sourceSessionId),
    );
  };

  const addRecentDataset = (session: DatasetSession) => {
    const normalizedSession = {
      ...session,
      dataset: normalizeDatasetMetadata(session.dataset),
    };
    setRecentDatasets((currentSessions) => [
      normalizedSession,
      ...currentSessions
        .filter((recentSession) => recentSession.dataset.dataset_id !== normalizedSession.dataset.dataset_id)
        .slice(0, 5),
    ]);
  };

  const updateDatasetSessionView = (view: ActiveView) => {
    setActiveView(view);
    if (!dataset) return;

    setRecentDatasets((currentSessions) =>
      currentSessions.map((session) =>
        session.dataset.dataset_id === dataset.dataset_id
          ? { ...session, lastActiveView: view }
          : session,
      ),
    );
  };

  const updateDatasetSessionResultTab = (tab: ResultTabKey) => {
    if (!dataset) return;

    setDatasetRegistry((currentRegistry) =>
      attachActiveResultToDataset(currentRegistry, dataset.dataset_id, tab),
    );

    setRecentDatasets((currentSessions) =>
      currentSessions.map((session) =>
        session.dataset.dataset_id === dataset.dataset_id
          ? { ...session, lastActiveResultTab: tab }
          : session,
      ),
    );
  };

  const activateRecentDataset = (
    datasetId: string,
    restoreDatasetSession: (session: DatasetSession) => void,
  ) => {
    const session = recentDatasets.find(
      (recentSession) => recentSession.dataset.dataset_id === datasetId,
    );

    if (session) {
      setDatasetRegistry((currentRegistry) => setActiveDataset(currentRegistry, datasetId));
      restoreDatasetSession(session);
    }
  };

  const removeRecentDataset = (datasetId: string) => {
    setDatasetRegistry((currentRegistry) =>
      trimStaleDatasetReferences({
        ...currentRegistry,
        records: currentRegistry.records.filter((record) => record.datasetId !== datasetId),
      }),
    );
    setRecentDatasets((currentSessions) =>
      currentSessions.filter((session) => session.dataset.dataset_id !== datasetId),
    );
  };

  const attachExecutionToActiveDataset = (executionId: string, datasetId?: DatasetId) => {
    const targetDatasetId = datasetId || dataset?.dataset_id;
    if (!targetDatasetId) return;

    setDatasetRegistry((currentRegistry) =>
      attachExecutionToDataset(currentRegistry, targetDatasetId, executionId),
    );
  };

  const attachActiveResultToActiveDataset = (activeResultId: ResultTabKey, datasetId?: DatasetId) => {
    const targetDatasetId = datasetId || dataset?.dataset_id;
    if (!targetDatasetId) return;

    setDatasetRegistry((currentRegistry) =>
      attachActiveResultToDataset(currentRegistry, targetDatasetId, activeResultId),
    );
  };

  return {
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
    activateRecentDataset,
    removeRecentDataset,
  };
}

export default useDatasetSessions;
