import type { BusinessIntentResultType } from "../businessIntent";
import type { AnalysisExecutionStepType } from "../analysisPlan";

export type ExplanationType =
  | "workflow_summary"
  | "business_meaning"
  | "expected_output"
  | "future_insight"
  | "readiness_status";

export type ExplanationMode =
  | "static_template"
  | "metadata_aware"
  | "result_aware"
  | "ai_assisted"
  | "analyst_inspection";

export type ExplanationDynamicReadiness =
  | "static_only"
  | "metadata_ready"
  | "result_summary_required"
  | "ai_validation_required";

export type ExplanationDataDependencyLevel =
  | "none"
  | "metadata"
  | "result_summary"
  | "active_result"
  | "business_context";

export type ExplanationTemplate = {
  templateKey: string;
  title: string;
  summary: string;
  businessMeaning: string;
  expectedOutputs: string[];
  potentialInsights: string[];
};

export type BusinessExplanation = {
  id: string;
  taskId: string;
  explanationType: ExplanationType;
  title: string;
  summary: string;
  businessMeaning: string;
  expectedOutputs: string[];
  potentialInsights: string[];
  supportedResultTypes: BusinessIntentResultType[];
  relatedExecutionSteps: AnalysisExecutionStepType[];
  explanationTemplateKey: string;
  explanationMode: ExplanationMode;
  dynamicReadiness: ExplanationDynamicReadiness;
  dataDependencyLevel: ExplanationDataDependencyLevel;
  futureResultDependencies: string[];
  interpretationInputs: string[];
  metadataAwareSummary: string | null;
};
