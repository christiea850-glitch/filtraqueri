import { useState } from "react";
import type { ActiveView, DatasetMetadata, DatasetSession } from "./datasetTypes";
import type { ResultTabKey } from "../results/resultTypes";

type UseDatasetSessionsOptions = {
  initialView?: ActiveView;
};

function useDatasetSessions({ initialView = "welcome" }: UseDatasetSessionsOptions = {}) {
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const [recentDatasets, setRecentDatasets] = useState<DatasetSession[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>(initialView);

  const addRecentDataset = (session: DatasetSession) => {
    setRecentDatasets((currentSessions) => [
      session,
      ...currentSessions
        .filter((recentSession) => recentSession.dataset.dataset_id !== session.dataset.dataset_id)
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
      restoreDatasetSession(session);
    }
  };

  const removeRecentDataset = (datasetId: string) => {
    setRecentDatasets((currentSessions) =>
      currentSessions.filter((session) => session.dataset.dataset_id !== datasetId),
    );
  };

  return {
    dataset,
    setDataset,
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
