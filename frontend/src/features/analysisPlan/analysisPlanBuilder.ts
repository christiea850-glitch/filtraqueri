import type { AnalyticsTask } from "../tasks";
import type { TaskConfiguration } from "../taskConfiguration";
import type {
  AnalysisExecutionStep,
  AnalysisExecutionStepType,
  AnalysisPlan,
} from "./analysisPlanTypes";
import { validateAnalysisPlanInputs } from "./analysisPlanValidation";

const nowIso = () => new Date().toISOString();

const stepDefinitions: Record<AnalysisExecutionStepType, Omit<AnalysisExecutionStep, "id" | "dependsOn">> = {
  prepare_metric: {
    type: "prepare_metric",
    label: "Prepare metric",
    description: "Identify the business metric that a future engine will analyze.",
  },
  prepare_dimension: {
    type: "prepare_dimension",
    label: "Prepare dimension",
    description: "Identify the business segment or entity used to organize results.",
  },
  prepare_date_field: {
    type: "prepare_date_field",
    label: "Prepare date field",
    description: "Identify the date field used for time-aware analysis.",
  },
  aggregate: {
    type: "aggregate",
    label: "Aggregate",
    description: "Future engine step for grouping and summarizing values.",
  },
  compare: {
    type: "compare",
    label: "Compare",
    description: "Future engine step for comparing groups or periods.",
  },
  forecast: {
    type: "forecast",
    label: "Forecast",
    description: "Future engine step for projecting values forward.",
  },
  correlate: {
    type: "correlate",
    label: "Correlate",
    description: "Future engine step for checking relationships between measures.",
  },
  detect_anomaly: {
    type: "detect_anomaly",
    label: "Detect anomaly",
    description: "Future engine step for identifying unusual behavior.",
  },
  summarize: {
    type: "summarize",
    label: "Summarize",
    description: "Future explanation step for translating results into business language.",
  },
};

const stepsForTask = (task: AnalyticsTask): AnalysisExecutionStepType[] => {
  if (task.id.includes("forecast")) {
    return ["prepare_metric", "prepare_date_field", "aggregate", "forecast", "summarize"];
  }
  if (task.id.includes("correlation")) {
    return ["prepare_metric", "correlate", "summarize"];
  }
  if (task.id.includes("unusual")) {
    return ["prepare_metric", "prepare_dimension", "detect_anomaly", "summarize"];
  }
  if (task.id.includes("compare") || task.id.includes("profit_drop")) {
    return ["prepare_metric", "prepare_dimension", "compare", "summarize"];
  }
  if (task.id.includes("trend")) {
    return ["prepare_metric", "prepare_date_field", "aggregate", "compare", "summarize"];
  }
  return ["prepare_metric", "prepare_dimension", "aggregate", "compare", "summarize"];
};

const createExecutionSteps = (task: AnalyticsTask): AnalysisExecutionStep[] =>
  stepsForTask(task).map((stepType, index, steps) => ({
    id: `${task.id}:${stepType}:${index + 1}`,
    ...stepDefinitions[stepType],
    dependsOn: index === 0 ? [] : [`${task.id}:${steps[index - 1]}:${index}`],
  }));

export function buildAnalysisPlan(
  task: AnalyticsTask,
  configuration: TaskConfiguration | null,
): AnalysisPlan {
  const executionSteps = createExecutionSteps(task);
  const validation = validateAnalysisPlanInputs({
    configuration,
    executionSteps,
    supportedEngines: task.supportedEngines,
  });
  const timestamp = nowIso();

  return {
    id: `analysis-plan:${task.id}`,
    taskId: task.id,
    intentIds: task.supportedIntents,
    configuredInputs: configuration?.configuredInputs || [],
    validationState: validation.validationState,
    supportedEngines: task.supportedEngines,
    preferredEngine: task.supportedEngines[0] || null,
    expectedResultTypes: task.supportedResultTypes,
    executionSteps,
    explanationTemplateKey: task.explanationTemplateKey,
    validation: validation.validation,
    createdAt: timestamp,
    lastUpdated: timestamp,
  };
}
