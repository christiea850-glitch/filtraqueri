import { useEffect, useState } from "react";
import type { AnalyticsTask } from "../tasks";
import {
  createTaskConfiguration,
  updateTaskConfiguredInput,
} from "./taskConfigurationState";
import type { TaskConfiguredInput } from "./taskConfigurationTypes";

function useTaskConfiguration(task: AnalyticsTask | null) {
  const [configuration, setConfiguration] = useState(() =>
    task ? createTaskConfiguration(task) : null,
  );

  useEffect(() => {
    setConfiguration(task ? createTaskConfiguration(task) : null);
  }, [task?.id]);

  const updateInput = (input: TaskConfiguredInput) => {
    if (!task || !configuration) return;

    setConfiguration(updateTaskConfiguredInput(task, configuration, input));
  };

  return {
    configuration,
    updateInput,
  };
}

export default useTaskConfiguration;
