export type BusinessIntentCategory =
  | "sales_analysis"
  | "customer_analytics"
  | "financial_insights"
  | "inventory_intelligence"
  | "workforce_analytics"
  | "forecasting"
  | "trend_analysis"
  | "correlation_analysis"
  | "anomaly_detection"
  | "operational_intelligence";

export type BusinessIntentInputType =
  | "metric"
  | "dimension"
  | "dateField"
  | "timeRange"
  | "groupingField"
  | "comparisonField"
  | "entityField"
  | "threshold"
  | "filterCondition";

export type BusinessIntentSupportedEngine =
  | "duckdb_sql"
  | "excel_workbook"
  | "python_preview"
  | "r_preview";

export type BusinessIntentResultType =
  | "table"
  | "summary"
  | "chart_preview"
  | "diagnostic"
  | "explanation";

export type BusinessIntentSafetyLevel =
  | "metadata_only"
  | "read_only_plan"
  | "validated_execution_required";

export type BusinessIntentInput = {
  id: string;
  type: BusinessIntentInputType;
  label: string;
  description: string;
  required: boolean;
  acceptsMultiple?: boolean;
  exampleValues?: string[];
};

export type BusinessIntent = {
  id: string;
  label: string;
  description: string;
  category: BusinessIntentCategory;
  userQuestionExamples: string[];
  requiredInputs: BusinessIntentInput[];
  optionalInputs: BusinessIntentInput[];
  supportedResultTypes: BusinessIntentResultType[];
  supportedEngines: BusinessIntentSupportedEngine[];
  safetyLevel: BusinessIntentSafetyLevel;
};
