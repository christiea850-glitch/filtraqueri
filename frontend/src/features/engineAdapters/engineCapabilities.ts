import type { EngineAdapter } from "./engineAdapterTypes";

export const engineCapabilityLabels: Record<
  keyof Pick<
    EngineAdapter,
    | "supportsWorkbookRelationships"
    | "supportsForecasting"
    | "supportsCorrelation"
    | "supportsAnomalyDetection"
    | "supportsStatisticalAnalysis"
    | "supportsVisualization"
  >,
  string
> = {
  supportsWorkbookRelationships: "Workbook relationships",
  supportsForecasting: "Forecasting",
  supportsCorrelation: "Correlation",
  supportsAnomalyDetection: "Anomaly detection",
  supportsStatisticalAnalysis: "Statistical analysis",
  supportsVisualization: "Visualization",
};

export const listEngineCapabilities = (engine: EngineAdapter) =>
  Object.entries(engineCapabilityLabels)
    .filter(([capabilityKey]) => engine[capabilityKey as keyof typeof engineCapabilityLabels])
    .map(([, label]) => label);

export const getEngineReadinessLabel = (engine: EngineAdapter) => {
  if (engine.readinessLevel === "future_execution_ready") {
    return "Future execution ready";
  }
  if (engine.readinessLevel === "planning_ready") {
    return "Planning ready";
  }
  return "Metadata only";
};
