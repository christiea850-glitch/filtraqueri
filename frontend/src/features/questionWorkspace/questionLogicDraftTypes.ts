import type { SchemaColumn } from "../dataset/datasetTypes";
import type {
  MissingRequirement,
  PlannedOutputType,
  SchemaAwareQuestionDraftPlan,
  SchemaAwareQuestionIntent,
} from "./questionTranslatorTypes";

export type ControlledLogicDraftKind = "query_builder_plan";

export type ControlledLogicDraftStatus =
  | "draft_only"
  | "blocked_by_missing_requirements"
  | "blocked_by_ambiguity";

export type ControlledAggregationIdea =
  | "count_records"
  | "count_distinct"
  | "sum"
  | "average"
  | "min"
  | "max"
  | "none";

export type ControlledDateBucket = "day" | "week" | "month" | "year" | null;

export type ControlledSortDirection = "asc" | "desc" | null;

export type ControlledFilterOperator =
  | "equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "between"
  | "unknown";

export type ControlledSelectedFields = {
  dimension: string | null;
  measure: string | null;
  dateField: string | null;
};

export type ControlledGroupingIdea = {
  fields: string[];
  dateBucket: ControlledDateBucket;
  summary: string;
};

export type ControlledAggregationPlan = {
  idea: ControlledAggregationIdea;
  field: string | null;
  summary: string;
};

export type ControlledSortIdea = {
  field: string | null;
  direction: ControlledSortDirection;
  reason: string;
};

export type ControlledLimitIdea = {
  value: number | null;
  reason: string;
};

export type ControlledFilterIdea = {
  field: string;
  operator: ControlledFilterOperator;
  value: string | number | null;
  summary: string;
};

export type ControlledLogicDraft = {
  draftKind: ControlledLogicDraftKind;
  draftStatus: ControlledLogicDraftStatus;
  rawQuestion: string;
  detectedIntent: SchemaAwareQuestionIntent;
  selectedFields: ControlledSelectedFields;
  grouping: ControlledGroupingIdea;
  aggregation: ControlledAggregationPlan;
  sorting: ControlledSortIdea | null;
  limit: ControlledLimitIdea;
  filters: ControlledFilterIdea[];
  plannedOutputType: PlannedOutputType;
  validationWarnings: string[];
  blockingRequirements: MissingRequirement[];
  executionStatus: "draft_only";
  generatedQueryBuilderRequest: null;
  generatedSql: null;
};

export type BuildControlledLogicDraftInput = {
  draftPlan: SchemaAwareQuestionDraftPlan;
  schema: SchemaColumn[];
  selectedFields: ControlledSelectedFields;
};

export type ControlledLogicDraftValidationInput = {
  draftPlan: SchemaAwareQuestionDraftPlan;
  schema: SchemaColumn[];
  selectedFields: ControlledSelectedFields;
  grouping: ControlledGroupingIdea;
  aggregation: ControlledAggregationPlan;
};
