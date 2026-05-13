import type { BusinessIntentResultType } from "../businessIntent";
import type { AnalysisExecutionStepType } from "../analysisPlan";

export type ExplanationType =
  | "workflow_summary"
  | "business_meaning"
  | "expected_output"
  | "future_insight"
  | "readiness_status";

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
};
