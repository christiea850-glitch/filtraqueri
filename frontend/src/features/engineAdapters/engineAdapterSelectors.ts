import type { BusinessIntentSupportedEngine } from "../businessIntent";
import type { AnalysisPlan } from "../analysisPlan";
import type { AnalyticsTask } from "../tasks";
import type { EngineAdapter } from "./engineAdapterTypes";
import { getEngineAdapterById, listEngineAdapters } from "./engineAdapterRegistry";
import { getEngineCompatibilitySummary } from "./engineCompatibility";

export const listCompatibleEngineAdapters = (task: AnalyticsTask, analysisPlan: AnalysisPlan | null) =>
  getEngineCompatibilitySummary({ task, analysisPlan }).compatibleEngines.map((result) => result.engine);

export const getRecommendedEngineAdapter = (
  task: AnalyticsTask,
  analysisPlan: AnalysisPlan | null,
): EngineAdapter | null => getEngineCompatibilitySummary({ task, analysisPlan }).recommendedEngine;

export const listEngineAdaptersByIds = (engineIds: BusinessIntentSupportedEngine[]) =>
  engineIds
    .map((engineId) => getEngineAdapterById(engineId))
    .filter((engine): engine is EngineAdapter => Boolean(engine));

export const listPlanningReadyEngineAdapters = () =>
  listEngineAdapters().filter((engine) => engine.readinessLevel !== "metadata_only");
