export type SchemaAwareQuestionIntent =
  | "ranking"
  | "comparison"
  | "trend"
  | "distribution"
  | "aggregation"
  | "anomaly_review"
  | "segmentation"
  | "timeline_review"
  | "unknown";

export type SchemaAwareConfidence = "high" | "medium" | "low";

export type CandidateFieldRole = "dimension" | "measure" | "date" | "filter" | "unknown";

export type CandidateFieldMatch = {
  columnName: string;
  displayName: string;
  role: CandidateFieldRole;
  inferredType: string;
  matchReason:
    | "exact_column_match"
    | "normalized_column_match"
    | "singular_plural_match"
    | "business_synonym_match"
    | "type_based_candidate"
    | "sample_value_hint";
  confidence: SchemaAwareConfidence;
};

export type MissingRequirement =
  | "measure"
  | "dimension"
  | "date_field"
  | "filter_value"
  | "clear_intent";

export type PlannedOutputType =
  | "table"
  | "ranking_list"
  | "kpi_card"
  | "trend_chart"
  | "distribution_view"
  | "comparison_table"
  | "unknown";

export type AmbiguousFieldTerm = {
  term: string;
  candidates: CandidateFieldMatch[];
};

export type SchemaAwareQuestionDraftPlan = {
  rawQuestion: string;
  activeDatasetId: string;
  activeDatasetName: string;
  activeSourceName: string | null;
  detectedIntent: SchemaAwareQuestionIntent;
  confidence: SchemaAwareConfidence;
  candidateDimensions: CandidateFieldMatch[];
  candidateMeasures: CandidateFieldMatch[];
  candidateDateFields: CandidateFieldMatch[];
  candidateFilters: CandidateFieldMatch[];
  ambiguousTerms: AmbiguousFieldTerm[];
  missingRequirements: MissingRequirement[];
  suggestedClarifyingQuestions: string[];
  plannedOutputType: PlannedOutputType;
  executionStatus: "not_generated";
  generatedSql: null;
  generatedQueryBuilderRequest: null;
};
