import type { BusinessIntentSupportedEngine } from "../businessIntent";
import type { AnalyticsTask } from "../tasks";
import type {
  EngineAdapter,
  EngineCompatibilityInput,
  EngineCompatibilityResult,
  EngineCompatibilitySummary,
} from "./engineAdapterTypes";
import { listEngineAdapters } from "./engineAdapterRegistry";

const categoryPreferredEngines: Partial<Record<AnalyticsTask["category"], BusinessIntentSupportedEngine[]>> = {
  forecasting: ["python_preview", "r_preview", "duckdb_sql"],
  correlation_analysis: ["python_preview", "r_preview", "duckdb_sql"],
  anomaly_detection: ["python_preview", "duckdb_sql", "r_preview", "excel_workbook"],
  sales_analysis: ["duckdb_sql", "excel_workbook", "python_preview"],
  customer_analytics: ["duckdb_sql", "excel_workbook", "python_preview"],
  financial_analysis: ["duckdb_sql", "python_preview", "r_preview", "excel_workbook"],
  workforce_analytics: ["duckdb_sql", "excel_workbook", "python_preview", "r_preview"],
  operational_intelligence: ["duckdb_sql", "excel_workbook", "python_preview"],
};

const getPreferenceRank = (task: AnalyticsTask, engineId: BusinessIntentSupportedEngine) => {
  const preferences = categoryPreferredEngines[task.category] || task.supportedEngines;
  const index = preferences.indexOf(engineId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const scoreEngineCompatibility = ({ task, analysisPlan }: EngineCompatibilityInput, engine: EngineAdapter) => {
  const supportedReasons: string[] = [];
  const unsupportedReasons: string[] = [];

  if (task.supportedEngines.includes(engine.id)) {
    supportedReasons.push("Task metadata lists this future engine.");
  } else {
    unsupportedReasons.push("Task metadata does not list this engine yet.");
  }

  if (engine.supportedTasks.includes(task.category)) {
    supportedReasons.push("Engine supports this task category.");
  } else {
    unsupportedReasons.push("Engine does not declare support for this task category.");
  }

  const steps = analysisPlan?.executionSteps || [];
  const unsupportedSteps = steps.filter(
    (step) => !engine.supportedExecutionSteps.includes(step.type),
  );
  if (steps.length > 0 && unsupportedSteps.length === 0) {
    supportedReasons.push("Engine supports the current plan step placeholders.");
  }
  if (unsupportedSteps.length > 0) {
    unsupportedReasons.push(
      `Missing future step support: ${unsupportedSteps.map((step) => step.label).join(", ")}.`,
    );
  }

  const expectedResults = analysisPlan?.expectedResultTypes || task.supportedResultTypes;
  const unsupportedResults = expectedResults.filter(
    (resultType) => !engine.supportedResultTypes.includes(resultType),
  );
  if (expectedResults.length > 0 && unsupportedResults.length === 0) {
    supportedReasons.push("Engine supports the expected result metadata.");
  }
  if (unsupportedResults.length > 0) {
    unsupportedReasons.push(`Missing future result support: ${unsupportedResults.join(", ")}.`);
  }

  return {
    compatible: unsupportedReasons.length === 0,
    supportedReasons,
    unsupportedReasons,
  };
};

export const evaluateEngineCompatibility = (
  input: EngineCompatibilityInput,
  engine: EngineAdapter,
): EngineCompatibilityResult => {
  const compatibility = scoreEngineCompatibility(input, engine);
  const compatibleEngineIds = listRecommendedEngineIds(input.task);
  const recommendedEngine = compatibleEngineIds[0] === engine.id && compatibility.compatible;

  return {
    engine,
    ...compatibility,
    recommendedEngine,
  };
};

export const listRecommendedEngineIds = (task: AnalyticsTask): BusinessIntentSupportedEngine[] =>
  [...task.supportedEngines].sort(
    (left, right) => getPreferenceRank(task, left) - getPreferenceRank(task, right),
  );

export const getEngineCompatibilitySummary = (
  input: EngineCompatibilityInput,
): EngineCompatibilitySummary => {
  const results = listEngineAdapters().map((engine) => evaluateEngineCompatibility(input, engine));
  const compatibleEngines = results.filter((result) => result.compatible);
  const incompatibleEngines = results.filter((result) => !result.compatible);
  const recommendedEngine =
    compatibleEngines.find((result) => result.recommendedEngine)?.engine ||
    compatibleEngines[0]?.engine ||
    null;

  return {
    recommendedEngine,
    compatibleEngines,
    incompatibleEngines,
  };
};
