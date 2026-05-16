import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import type { ActiveResultModel } from "../results/activeResultModel";
import type { WorkbookRelationshipIntelligence } from "../workbookIntelligence";

export type InvestigationIntentId =
  | "compare_entities"
  | "identify_top_performers"
  | "identify_underperformers"
  | "detect_change"
  | "explore_distribution"
  | "summarize_activity"
  | "investigate_trend"
  | "investigate_anomaly"
  | "understand_relationships"
  | "evaluate_workload"
  | "review_operations"
  | "review_financials"
  | "review_customer_activity";

export type InvestigationConfidence = "high" | "medium" | "low";

export type InvestigationChartFamily =
  | "bar"
  | "line"
  | "table"
  | "distribution"
  | "comparison"
  | "scorecard";

export type InvestigationStage =
  | "question"
  | "scope"
  | "compare"
  | "summarize"
  | "validate"
  | "review_result"
  | "next_investigation";

export type InvestigationIntent = {
  id: InvestigationIntentId;
  businessLabel: string;
  explanation: string;
  suggestedDimensions: string[];
  suggestedMeasures: string[];
  suggestedGroupingStyles: string[];
  suggestedNextActions: string[];
  recommendedChartFamilies: InvestigationChartFamily[];
  confidence: InvestigationConfidence;
  confidenceScore: number;
};

export type InvestigationFlowStep = {
  stage: InvestigationStage;
  label: string;
  guidance: string;
  recommendedAction: string;
};

export type InvestigationFlow = {
  id: string;
  title: string;
  steps: InvestigationFlowStep[];
  activeStage: InvestigationStage;
};

export type InvestigationContext = {
  dataset: DatasetMetadata | null;
  activeResultModel?: ActiveResultModel | null;
  workbookIntelligence?: WorkbookRelationshipIntelligence | null;
  columns: SchemaColumn[];
  dimensions: SchemaColumn[];
  measures: SchemaColumn[];
  dateFields: SchemaColumn[];
  customerFields: SchemaColumn[];
  financialFields: SchemaColumn[];
  operationalFields: SchemaColumn[];
  relationshipHints: string[];
  contexts: {
    customer: boolean;
    financial: boolean;
    operational: boolean;
    workforce: boolean;
    workbook: boolean;
    temporal: boolean;
  };
};

export type InvestigationSuggestion = {
  id: string;
  intentId: InvestigationIntentId;
  title: string;
  question: string;
  explanation: string;
  compareBy: string[];
  measures: string[];
  nextSteps: string[];
  chartFamilies: InvestigationChartFamily[];
  confidence: InvestigationConfidence;
  confidenceScore: number;
};

export type InvestigationReport = {
  context: InvestigationContext;
  intents: InvestigationIntent[];
  suggestions: InvestigationSuggestion[];
  flow: InvestigationFlow;
  nextSteps: InvestigationSuggestion[];
  humanSummary: string;
};
