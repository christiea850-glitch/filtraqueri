import type {
  BusinessIntentResultType,
  BusinessIntentSupportedEngine,
} from "../businessIntent";
import type { AnalysisExecutionStepType, AnalysisPlan } from "../analysisPlan";
import type { AnalyticsTask, AnalyticsTaskCategory } from "../tasks";

export type EngineType =
  | "duckdb_sql"
  | "excel_workbook"
  | "python_analysis"
  | "r_analysis";

export type EngineReadinessLevel =
  | "metadata_only"
  | "planning_ready"
  | "future_execution_ready";

export type EngineCapabilitySummary = {
  supportsWorkbookRelationships: boolean;
  supportsForecasting: boolean;
  supportsCorrelation: boolean;
  supportsAnomalyDetection: boolean;
  supportsStatisticalAnalysis: boolean;
  supportsVisualization: boolean;
};

export type EngineAdapter = EngineCapabilitySummary & {
  id: BusinessIntentSupportedEngine;
  label: string;
  description: string;
  engineType: EngineType;
  supportedTasks: AnalyticsTaskCategory[];
  supportedExecutionSteps: AnalysisExecutionStepType[];
  supportedResultTypes: BusinessIntentResultType[];
  readinessLevel: EngineReadinessLevel;
};

export type EngineCompatibilityInput = {
  task: AnalyticsTask;
  analysisPlan: AnalysisPlan | null;
};

export type EngineCompatibilityResult = {
  engine: EngineAdapter;
  compatible: boolean;
  supportedReasons: string[];
  unsupportedReasons: string[];
  recommendedEngine: boolean;
};

export type EngineCompatibilitySummary = {
  recommendedEngine: EngineAdapter | null;
  compatibleEngines: EngineCompatibilityResult[];
  incompatibleEngines: EngineCompatibilityResult[];
};
