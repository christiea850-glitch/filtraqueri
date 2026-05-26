import type { SchemaColumn } from "../dataset/datasetTypes";
import type { FilterDefinition, SortDefinition } from "../filters/filterTypes";
import type { AggregationDefinition, QueryBuilderRequest } from "../query-builder/queryBuilderTypes";
import type {
  ControlledFilterIdea,
  ControlledLogicDraft,
} from "./questionLogicDraftTypes";
import type { GovernedQueryBuilderRequestDraft } from "./questionQueryBuilderRequestTypes";
import type { MissingRequirement } from "./questionTranslatorTypes";

const DEFAULT_QUERY_BUILDER_LIMIT = 100;

const unique = <T,>(items: T[]) => Array.from(new Set(items));

const findSchemaColumn = (schema: SchemaColumn[], field: string | null) =>
  field ? schema.find((column) => column.name === field) || null : null;

const isNumericColumn = (column: SchemaColumn | null) => column?.inferred_type === "numeric";

const isDateColumn = (column: SchemaColumn | null) => column?.inferred_type === "date";

const isGroupingColumn = (column: SchemaColumn | null) =>
  column?.inferred_type === "categorical" ||
  column?.inferred_type === "text" ||
  column?.inferred_type === "boolean" ||
  column?.inferred_type === "date";

const hasUnsupportedDraftWarning = (sourceDraft: ControlledLogicDraft) =>
  sourceDraft.validationWarnings.some((warning) => {
    const normalizedWarning = warning.toLowerCase();
    return (
      normalizedWarning.includes("ambiguous high-confidence") ||
      normalizedWarning.includes("anomaly review") ||
      normalizedWarning.includes("date buckets require") ||
      normalizedWarning.includes("does not exist in the active schema")
    );
  });

const toSortDirection = (direction: ControlledLogicDraft["sorting"] extends infer T
  ? T extends { direction: infer D }
    ? D
    : never
  : never) => (direction === "desc" ? "DESC" : "ASC");

const sanitizeAliasField = (field: string) => field.replace(/[^A-Za-z0-9_]/g, "_").toLowerCase();

export function createAggregateSortAlias(aggregation: AggregationDefinition) {
  if (aggregation.function === "COUNT" && !aggregation.column) return "count_rows";
  if (!aggregation.column) return aggregation.function.toLowerCase();
  return `${aggregation.function.toLowerCase()}_${sanitizeAliasField(aggregation.column)}`;
}

export function mapAggregationIdeaToQueryBuilderAggregation(
  sourceDraft: ControlledLogicDraft,
): AggregationDefinition | null {
  const { idea, field } = sourceDraft.aggregation;

  if (idea === "none") return null;
  if (idea === "count_records") return { function: "COUNT", column: null };
  if (idea === "count_distinct") return null;
  if (idea === "sum") return field ? { function: "SUM", column: field } : null;
  if (idea === "average") return field ? { function: "AVG", column: field } : null;
  if (idea === "min") return field ? { function: "MIN", column: field } : null;
  if (idea === "max") return field ? { function: "MAX", column: field } : null;

  return null;
}

export function deriveQueryBuilderGroupBy(sourceDraft: ControlledLogicDraft, schema: SchemaColumn[]) {
  return unique(
    sourceDraft.grouping.fields.filter((field) => {
      const column = findSchemaColumn(schema, field);
      return Boolean(column && isGroupingColumn(column));
    }),
  );
}

export function deriveQueryBuilderSelectedColumns(
  sourceDraft: ControlledLogicDraft,
  schema: SchemaColumn[],
) {
  const groupBy = deriveQueryBuilderGroupBy(sourceDraft, schema);
  if (groupBy.length > 0) return groupBy;
  if (sourceDraft.aggregation.idea !== "none") return [];

  return unique([
    sourceDraft.selectedFields.dimension,
    sourceDraft.selectedFields.measure,
    sourceDraft.selectedFields.dateField,
  ].filter((field): field is string => Boolean(findSchemaColumn(schema, field))));
}

export function deriveQueryBuilderOrderBy(
  sourceDraft: ControlledLogicDraft,
  schema: SchemaColumn[],
  aggregation: AggregationDefinition | null = mapAggregationIdeaToQueryBuilderAggregation(sourceDraft),
): SortDefinition | null {
  if (!sourceDraft.sorting?.direction) return null;

  const groupBy = deriveQueryBuilderGroupBy(sourceDraft, schema);
  const sortField = sourceDraft.sorting.field;
  const direction = toSortDirection(sourceDraft.sorting.direction);

  if (sortField && groupBy.includes(sortField)) {
    return { column: sortField, direction };
  }

  if (aggregation) {
    return {
      column: createAggregateSortAlias(aggregation),
      direction,
    };
  }

  if (sortField && findSchemaColumn(schema, sortField)) {
    return { column: sortField, direction };
  }

  return null;
}

export function deriveQueryBuilderLimit(sourceDraft: ControlledLogicDraft) {
  if (sourceDraft.limit.value && sourceDraft.limit.value > 0) return sourceDraft.limit.value;
  return DEFAULT_QUERY_BUILDER_LIMIT;
}

const mapFilterIdeaToFilterDefinition = (
  filter: ControlledFilterIdea,
  schema: SchemaColumn[],
): FilterDefinition | null => {
  const column = findSchemaColumn(schema, filter.field);
  if (!column || filter.operator === "unknown" || filter.value === null) return null;

  if (filter.operator === "equals" || filter.operator === "contains") {
    if (column.inferred_type === "boolean") {
      return {
        column: column.name,
        type: column.inferred_type,
        value: String(filter.value).toLowerCase() === "true",
      };
    }

    return {
      column: column.name,
      type: column.inferred_type,
      values: [String(filter.value)],
    };
  }

  if (filter.operator === "greater_than" && typeof filter.value === "number") {
    return {
      column: column.name,
      type: column.inferred_type,
      min: filter.value,
    };
  }

  if (filter.operator === "less_than" && typeof filter.value === "number") {
    return {
      column: column.name,
      type: column.inferred_type,
      max: filter.value,
    };
  }

  return null;
};

const deriveQueryBuilderFilters = (sourceDraft: ControlledLogicDraft, schema: SchemaColumn[]) =>
  sourceDraft.filters
    .map((filter) => mapFilterIdeaToFilterDefinition(filter, schema))
    .filter((filter): filter is FilterDefinition => Boolean(filter));

export function validateGovernedRequestEligibility(
  sourceDraft: ControlledLogicDraft,
  schema: SchemaColumn[],
) {
  const validationWarnings: string[] = [...sourceDraft.validationWarnings];
  const blockingRequirements: MissingRequirement[] = [...sourceDraft.blockingRequirements];
  const addWarning = (warning: string) => validationWarnings.push(warning);

  if (sourceDraft.draftKind !== "query_builder_plan") {
    addWarning("Only query-builder-shaped controlled drafts can create request candidates.");
  }

  if (sourceDraft.executionStatus !== "draft_only") {
    addWarning("Controlled draft execution status must remain draft_only.");
  }

  if (sourceDraft.generatedSql !== null || sourceDraft.generatedQueryBuilderRequest !== null) {
    addWarning("Controlled draft must not already contain generated SQL or a generated Query Builder request.");
  }

  if (sourceDraft.draftStatus !== "draft_only") {
    addWarning("Resolve missing requirements or ambiguity before creating a request candidate.");
  }

  if (sourceDraft.detectedIntent === "unknown") {
    addWarning("Clarify the business intent before creating a request candidate.");
  }

  if (sourceDraft.blockingRequirements.length > 0) {
    addWarning("Blocking requirements must be resolved before request candidate creation.");
  }

  if (hasUnsupportedDraftWarning(sourceDraft)) {
    addWarning("Resolve draft warnings that affect request correctness before creating a request candidate.");
  }

  for (const field of [
    sourceDraft.selectedFields.dimension,
    sourceDraft.selectedFields.measure,
    sourceDraft.selectedFields.dateField,
  ]) {
    if (field && !findSchemaColumn(schema, field)) {
      addWarning(`Selected field ${field} does not exist in the active schema.`);
    }
  }

  for (const field of sourceDraft.grouping.fields) {
    const column = findSchemaColumn(schema, field);
    if (!column) {
      addWarning(`Grouping field ${field} does not exist in the active schema.`);
    } else if (!isGroupingColumn(column)) {
      addWarning(`Grouping field ${field} is not compatible with Query Builder grouping.`);
    }
  }

  if (sourceDraft.grouping.dateBucket && sourceDraft.selectedFields.dateField) {
    addWarning("Date bucket previews are not yet represented in the Query Builder request contract.");
  }

  if (["trend", "timeline_review"].includes(sourceDraft.detectedIntent)) {
    const dateColumn = findSchemaColumn(schema, sourceDraft.selectedFields.dateField);
    if (!dateColumn || !isDateColumn(dateColumn)) {
      addWarning("Trend and timeline request candidates require a selected date field.");
    }
  }

  if (sourceDraft.aggregation.idea === "count_distinct") {
    addWarning("Count distinct is not supported by the current Query Builder request contract.");
  }

  const aggregation = mapAggregationIdeaToQueryBuilderAggregation(sourceDraft);
  if (sourceDraft.aggregation.idea !== "none" && !aggregation) {
    addWarning("The controlled aggregation idea cannot be represented by the current Query Builder contract.");
  }

  if (
    sourceDraft.aggregation.idea !== "none" &&
    sourceDraft.aggregation.idea !== "count_records" &&
    sourceDraft.aggregation.idea !== "count_distinct"
  ) {
    const measureColumn = findSchemaColumn(schema, sourceDraft.aggregation.field);
    if (!measureColumn || !isNumericColumn(measureColumn)) {
      addWarning("Numeric Query Builder aggregations require a selected numeric measure.");
    }
  }

  const orderBy = deriveQueryBuilderOrderBy(sourceDraft, schema, aggregation);
  if (sourceDraft.sorting?.direction && !orderBy) {
    addWarning("Sorting could not be represented by the current Query Builder request contract.");
  }

  if (sourceDraft.limit.value !== null && sourceDraft.limit.value <= 0) {
    addWarning("Query Builder request candidate limit must be a positive number.");
  }

  if (sourceDraft.filters.some((filter) => filter.operator === "between")) {
    addWarning("Between filters are not represented by the current controlled filter draft shape.");
  }

  return {
    eligible: validationWarnings.length === 0 && blockingRequirements.length === 0,
    validationWarnings: unique(validationWarnings),
    blockingRequirements: unique(blockingRequirements),
  };
}

export function buildGovernedQueryBuilderRequestDraft(
  sourceDraft: ControlledLogicDraft,
  schema: SchemaColumn[],
): GovernedQueryBuilderRequestDraft {
  const eligibility = validateGovernedRequestEligibility(sourceDraft, schema);

  if (!eligibility.eligible) {
    return {
      status: "blocked",
      sourceDraft,
      request: null,
      validationWarnings: eligibility.validationWarnings,
      blockingRequirements: eligibility.blockingRequirements,
      generatedSql: null,
      executionStatus: "not_executed",
    };
  }

  const aggregation = mapAggregationIdeaToQueryBuilderAggregation(sourceDraft);
  const aggregations = aggregation ? [aggregation] : [];
  const request: QueryBuilderRequest = {
    selected_columns: deriveQueryBuilderSelectedColumns(sourceDraft, schema),
    group_by: deriveQueryBuilderGroupBy(sourceDraft, schema),
    aggregations,
    filters: deriveQueryBuilderFilters(sourceDraft, schema),
    order_by: deriveQueryBuilderOrderBy(sourceDraft, schema, aggregation),
    limit: deriveQueryBuilderLimit(sourceDraft),
    page: 1,
  };

  return {
    status: "created_for_review",
    sourceDraft,
    request,
    validationWarnings: [],
    blockingRequirements: [],
    generatedSql: null,
    executionStatus: "not_executed",
  };
}
