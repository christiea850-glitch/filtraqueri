import { useMemo, useState } from "react";
import { getAnalyticsTaskById, type AnalyticsTask } from "../tasks";
import { groupTasksByCategory } from "./taskLauncherSelectors";

function useTaskLauncher() {
  const taskGroups = useMemo(() => groupTasksByCategory(), []);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = selectedTaskId ? getAnalyticsTaskById(selectedTaskId) : null;

  const selectTask = (task: AnalyticsTask) => {
    setSelectedTaskId(task.id);
  };

  const clearSelectedTask = () => {
    setSelectedTaskId(null);
  };

  return {
    taskGroups,
    selectedTask,
    selectTask,
    clearSelectedTask,
  };
}

export default useTaskLauncher;
