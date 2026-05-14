import { useMemo, useState } from "react";
import { getAnalyticsTaskById, type AnalyticsTask } from "../tasks";
import { groupTasksByCategory } from "./taskLauncherSelectors";

function useTaskLauncher({
  selectedTaskId: controlledSelectedTaskId,
  onSelectedTaskIdChange,
}: {
  selectedTaskId?: string | null;
  onSelectedTaskIdChange?: (taskId: string | null) => void;
} = {}) {
  const taskGroups = useMemo(() => groupTasksByCategory(), []);
  const [uncontrolledSelectedTaskId, setUncontrolledSelectedTaskId] = useState<string | null>(null);
  const selectedTaskId = controlledSelectedTaskId ?? uncontrolledSelectedTaskId;
  const selectedTask = selectedTaskId ? getAnalyticsTaskById(selectedTaskId) : null;
  const updateSelectedTaskId = (taskId: string | null) => {
    if (controlledSelectedTaskId === undefined) setUncontrolledSelectedTaskId(taskId);
    onSelectedTaskIdChange?.(taskId);
  };

  const selectTask = (task: AnalyticsTask) => {
    updateSelectedTaskId(task.id);
  };

  const clearSelectedTask = () => {
    updateSelectedTaskId(null);
  };

  return {
    taskGroups,
    selectedTask,
    selectTask,
    clearSelectedTask,
  };
}

export default useTaskLauncher;
