export type SqlTemplateKind =
  | "syntax_helper"
  | "business_answer"
  | "diagnostic"
  | "report_recipe"
  | "generated_strategy";

export type SqlTemplateOutputShape =
  | "grouped_count"
  | "status_breakdown"
  | "metric_by_dimension"
  | "detail_list"
  | "filtered_count"
  | "coverage_percent"
  | "gap_detection"
  | "ranked_summary"
  | "single_metric"
  | "data_quality_summary"
  | "trend"
  | "join_template"
  | "unknown";

export type SqlTemplateSemanticRoleName =
  | "entity"
  | "metric"
  | "grouping"
  | "filter"
  | "status"
  | "date"
  | "identifier";

export type SqlTemplateSemanticRole = {
  role: SqlTemplateSemanticRoleName;
  fieldHint?: string;
  required: boolean;
  source?: "schema_detection" | "recipe_role" | "opportunity_metadata" | "generated";
};

export type SqlTemplateRelationshipMode =
  | "single_table"
  | "requires_relationships"
  | "optional_relationships"
  | "unknown";

export type SqlTemplateAdaptationSupport =
  | "none"
  | "label_only"
  | "field_binding"
  | "single_table_sql"
  | "relationship_blocked";

export type SqlTemplateAdaptiveMetadata = {
  templateKind: SqlTemplateKind;
  outputShape: SqlTemplateOutputShape;
  semanticRoles: SqlTemplateSemanticRole[];
  relationshipMode: SqlTemplateRelationshipMode;
  adaptationSupport: SqlTemplateAdaptationSupport;
  safety: {
    canInsertExistingSql: boolean;
    canAdaptSql: boolean;
    requiresGrounding: boolean;
    requiresAcceptedRelationships: boolean;
    manualInsertOnly: true;
  };
};
