import type { AnalyticsPlanComplexity } from "../analyticsPlanning";
import type { FutureDialectRecommendationId } from "../dataIntelligence";

export type ExecutionLifecycleState =
  | "planned"
  | "blocked"
  | "pending_validation"
  | "ready_for_execution"
  | "execution_locked"
  | "relationship_pending"
  | "metadata_pending";

export type ExecutionStageCategory =
  | "dataset_resolution"
  | "relationship_resolution"
  | "metric_resolution"
  | "dimension_resolution"
  | "filter_resolution"
  | "aggregation_resolution"
  | "forecasting_resolution"
  | "statistical_resolution"
  | "visualization_resolution"
  | "explanation_resolution"
  | "export_resolution";

export type ExecutionProjectedOutputType =
  | "summary_table"
  | "grouped_table"
  | "ranked_output"
  | "trend_output"
  | "forecast_output"
  | "dashboard_widget"
  | "executive_summary"
  | "statistical_report";

export type ExecutionInputContract = {
  inputId: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  metadataSource: string;
};

export type ExecutionOutputContract = {
  outputId: string;
  label: string;
  outputType: ExecutionProjectedOutputType;
  sourceStageIds: string[];
};

export type ExecutionDependencyContract = {
  dependencyId: string;
  label: string;
  sourceStageId: string;
  targetStageId: string;
  satisfied: boolean;
  reason: string;
};

export type ExecutionStageContract = {
  stageId: string;
  label: string;
  category: ExecutionStageCategory;
  lifecycleState: ExecutionLifecycleState;
  dependencyIds: string[];
  missingMetadata: string[];
};

export type ExecutionSafetyContract = {
  contractId: string;
  metadataOnly: true;
  executionLocked: true;
  sqlExecutionAllowed: false;
  codeGenerationAllowed: false;
  activeResultMutationAllowed: false;
  notes: string[];
};

export type ExecutionEngineContract = {
  engineId: FutureDialectRecommendationId;
  label: string;
  compatible: boolean;
  readinessState: ExecutionLifecycleState;
  reasons: string[];
};

export type ExecutionContractSizing = {
  estimatedExecutionStages: number;
  estimatedRelationshipCount: number;
  estimatedProjectedOutputs: number;
  estimatedKpiProjections: number;
};

export type ExecutionContract = {
  contractId: string;
  datasetId: string;
  lifecycleState: ExecutionLifecycleState;
  complexity: AnalyticsPlanComplexity;
  readinessScore: number;
  humanSummary: string;
  analystSummary: string;
  stages: ExecutionStageContract[];
  inputs: ExecutionInputContract[];
  outputs: ExecutionOutputContract[];
  dependencies: ExecutionDependencyContract[];
  safety: ExecutionSafetyContract;
  engines: ExecutionEngineContract[];
  blockedReasons: string[];
  missingMetadata: string[];
  relationshipDependencyChains: string[];
  sizing: ExecutionContractSizing;
};

export type ExecutionContractValidationMessage = {
  severity: "warning" | "error";
  message: string;
};

export type ExecutionContractValidationResult = {
  valid: boolean;
  messages: ExecutionContractValidationMessage[];
};
