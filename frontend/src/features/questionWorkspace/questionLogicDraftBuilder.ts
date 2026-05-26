import type { SchemaColumn } from "../dataset/datasetTypes";
import type { MissingRequirement, SchemaAwareQuestionDraftPlan } from "./questionTranslatorTypes";
import type {
  BuildControlledLogicDraftInput,
  ControlledAggregationIdea,
  ControlledAggregationPlan,
  ControlledDateBucket,
  ControlledGroupingIdea,
  ControlledLimitIdea,
  ControlledLogicDraft,
  ControlledLogicDraftStatus,
  ControlledLogicDraftValidationInput,
  ControlledSelectedFields,
  ControlledSortIdea,
} from "./questionLogicDraftTypes";

const clearRequirements = (requirements: MissingRequirement[]) => Array.from(new Set(requirements));

const normalizeQuestionText = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_./\\-]+/g, " ")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const includesAny = (rawQuestion: string, terms: string[]) => {
  const normalizedQuestion = normalizeQuestionText(rawQuestion);
  return terms.some((term) => normalizedQuestion.includes(normalizeQuestionText(term)));
};

const findSchemaColumn = (schema: SchemaColumn[], field: string | null) =>
  field ? schema.find((column) => column.name === field) || null : null;

const selectedFieldNames = (selectedFields: ControlledSelectedFields) =>
  [selectedFields.dimension, selectedFields.measure, selectedFields.dateField].filter(
    (field): field is string => Boolean(field),
  );

const hasUnresolvedHighConfidenceAmbiguity = (
  draftPlan: SchemaAwareQuestionDraftPlan,
  selectedFields: ControlledSelectedFields,
) => {
  const selectedNames = selectedFieldNames(selectedFields);

  return draftPlan.ambiguousTerms.some((term) => {
    const highConfidenceCandidates = term.candidates.filter((candidate) => candidate.confidence === "high");
    if (highConfidenceCandidates.length <= 1) return false;
    return !highConfidenceCandidates.some((candidate) => selectedNames.includes(candidate.columnName));
  });
};

const isNumericColumn = (column: SchemaColumn | null) => column?.inferred_type === "numeric";

const isDateColumn = (column: SchemaColumn | null) => column?.inferred_type === "date";

const isGroupingColumn = (column: SchemaColumn | null) =>
  column?.inferred_type === "categorical" ||
  column?.inferred_type === "text" ||
  column?.inferred_type === "boolean";

const wantsCount = (rawQuestion: string) =>
  includesAny(rawQuestion, ["count", "how many", "number of", "total records", "frequency"]);

const wantsDistinct = (rawQuestion: string) =>
  includesAny(rawQuestion, ["distinct", "unique", "different"]);

const wantsAverage = (rawQuestion: string) =>
  includesAny(rawQuestion, ["average", "avg", "mean"]);

const wantsMinimum = (rawQuestion: string) =>
  includesAny(rawQuestion, ["minimum", "min", "lowest", "least", "smallest"]);

const wantsMaximum = (rawQuestion: string) =>
  includesAny(rawQuestion, ["maximum", "max", "highest", "most", "largest"]);

const wantsAscendingSort = (rawQuestion: string) =>
  includesAny(rawQuestion, ["least", "bottom", "lowest", "worst", "underperforming", "smallest"]);

const wantsDescendingSort = (rawQuestion: string) =>
  includesAny(rawQuestion, ["most", "top", "highest", "best", "largest", "maximum"]);

const deriveDateBucket = (rawQuestion: string): ControlledDateBucket => {
  if (includesAny(rawQuestion, ["daily", "day"])) return "day";
  if (includesAny(rawQuestion, ["weekly", "week"])) return "week";
  if (includesAny(rawQuestion, ["yearly", "annual", "year"])) return "year";
  return "month";
};

export function deriveGroupingIdea(
  draftPlan: SchemaAwareQuestionDraftPlan,
  selectedFields: ControlledSelectedFields,
): ControlledGroupingIdea {
  if (draftPlan.detectedIntent === "unknown") {
    return {
      fields: [],
      dateBucket: null,
      summary: "No grouping is prepared until the question intent is clearer.",
    };
  }

  if (draftPlan.detectedIntent === "trend" || draftPlan.detectedIntent === "timeline_review") {
    if (!selectedFields.dateField) {
      return {
        fields: [],
        dateBucket: null,
        summary: "Choose a date field before trend grouping can be prepared.",
      };
    }

    const dateBucket = deriveDateBucket(draftPlan.rawQuestion);
    return {
      fields: [selectedFields.dateField],
      dateBucket,
      summary: `Group records by ${dateBucket} using ${selectedFields.dateField}.`,
    };
  }

  if (
    ["ranking", "comparison", "distribution", "segmentation"].includes(draftPlan.detectedIntent) &&
    selectedFields.dimension
  ) {
    return {
      fields: [selectedFields.dimension],
      dateBucket: null,
      summary: `Group records by ${selectedFields.dimension}.`,
    };
  }

  if (draftPlan.detectedIntent === "aggregation" && selectedFields.dimension) {
    return {
      fields: [selectedFields.dimension],
      dateBucket: null,
      summary: `Summarize values within each ${selectedFields.dimension} group.`,
    };
  }

  return {
    fields: [],
    dateBucket: null,
    summary: "No grouping is needed for the current draft idea.",
  };
}

export function deriveAggregationIdea(
  draftPlan: SchemaAwareQuestionDraftPlan,
  selectedFields: ControlledSelectedFields,
  schema: SchemaColumn[],
): ControlledAggregationPlan {
  const selectedMeasure = findSchemaColumn(schema, selectedFields.measure);
  const canUseNumericMeasure = isNumericColumn(selectedMeasure);
  const rawQuestion = draftPlan.rawQuestion;

  if (draftPlan.detectedIntent === "unknown") {
    return {
      idea: "none",
      field: null,
      summary: "No aggregation is prepared until the question intent is clearer.",
    };
  }

  if (wantsCount(rawQuestion) || (!canUseNumericMeasure && draftPlan.detectedIntent !== "anomaly_review")) {
    const idea: ControlledAggregationIdea =
      wantsDistinct(rawQuestion) && selectedFields.dimension ? "count_distinct" : "count_records";
    return {
      idea,
      field: idea === "count_distinct" ? selectedFields.dimension : null,
      summary:
        idea === "count_distinct"
          ? `Count distinct ${selectedFields.dimension} values.`
          : "Count matching records.",
    };
  }

  if (!selectedFields.measure) {
    return {
      idea: "none",
      field: null,
      summary: "Choose a measure before metric aggregation can be prepared.",
    };
  }

  if (!canUseNumericMeasure) {
    return {
      idea: "none",
      field: selectedFields.measure,
      summary: `${selectedFields.measure} is not numeric, so metric aggregation is not prepared.`,
    };
  }

  if (wantsAverage(rawQuestion)) {
    return {
      idea: "average",
      field: selectedFields.measure,
      summary: `Average ${selectedFields.measure}.`,
    };
  }

  if (wantsMinimum(rawQuestion) && draftPlan.detectedIntent === "aggregation") {
    return {
      idea: "min",
      field: selectedFields.measure,
      summary: `Find the minimum ${selectedFields.measure}.`,
    };
  }

  if (wantsMaximum(rawQuestion) && draftPlan.detectedIntent === "aggregation") {
    return {
      idea: "max",
      field: selectedFields.measure,
      summary: `Find the maximum ${selectedFields.measure}.`,
    };
  }

  return {
    idea: "sum",
    field: selectedFields.measure,
    summary: `Sum ${selectedFields.measure}.`,
  };
}

export function deriveSortingIdea(
  draftPlan: SchemaAwareQuestionDraftPlan,
  grouping: ControlledGroupingIdea,
  aggregation: ControlledAggregationPlan,
): ControlledSortIdea | null {
  if (draftPlan.detectedIntent === "unknown") return null;

  if (draftPlan.detectedIntent === "trend" || draftPlan.detectedIntent === "timeline_review") {
    return {
      field: grouping.fields[0] || null,
      direction: grouping.fields[0] ? "asc" : null,
      reason: "Trend review should read from earliest to latest once a date field is selected.",
    };
  }

  if (draftPlan.detectedIntent === "ranking") {
    return {
      field: aggregation.field,
      direction: wantsAscendingSort(draftPlan.rawQuestion) ? "asc" : "desc",
      reason: wantsAscendingSort(draftPlan.rawQuestion)
        ? "Ranking wording asks for the lowest or least values first."
        : "Ranking wording asks for the highest or most values first.",
    };
  }

  if (
    ["comparison", "segmentation"].includes(draftPlan.detectedIntent) &&
    grouping.fields.length > 0 &&
    (wantsAscendingSort(draftPlan.rawQuestion) || wantsDescendingSort(draftPlan.rawQuestion))
  ) {
    return {
      field: aggregation.field,
      direction: wantsAscendingSort(draftPlan.rawQuestion) ? "asc" : "desc",
      reason: "Comparison wording implies ordering groups by the drafted aggregate value.",
    };
  }

  if (draftPlan.detectedIntent === "aggregation" && grouping.fields.length > 0) {
    return {
      field: aggregation.field,
      direction: "desc",
      reason: "Grouped summaries can be reviewed from largest drafted value to smallest.",
    };
  }

  return null;
}

export function deriveLimitIdea(draftPlan: SchemaAwareQuestionDraftPlan): ControlledLimitIdea {
  if (draftPlan.detectedIntent === "ranking") {
    return {
      value: 10,
      reason: "Ranking drafts use a top 10 limit idea for review only.",
    };
  }

  return {
    value: null,
    reason: "No limit idea is needed for this draft.",
  };
}

export function validateControlledLogicDraft({
  draftPlan,
  schema,
  selectedFields,
  grouping,
  aggregation,
}: ControlledLogicDraftValidationInput) {
  const validationWarnings: string[] = [];
  const blockingRequirements: MissingRequirement[] = [...draftPlan.missingRequirements];
  const dimensionColumn = findSchemaColumn(schema, selectedFields.dimension);
  const measureColumn = findSchemaColumn(schema, selectedFields.measure);
  const dateColumn = findSchemaColumn(schema, selectedFields.dateField);
  const addRequirement = (requirement: MissingRequirement) => {
    if (!blockingRequirements.includes(requirement)) blockingRequirements.push(requirement);
  };

  if (selectedFields.dimension && !dimensionColumn) {
    validationWarnings.push(`Selected dimension ${selectedFields.dimension} does not exist in the active schema.`);
    addRequirement("dimension");
  }

  if (selectedFields.measure && !measureColumn) {
    validationWarnings.push(`Selected measure ${selectedFields.measure} does not exist in the active schema.`);
    addRequirement("measure");
  }

  if (selectedFields.dateField && !dateColumn) {
    validationWarnings.push(`Selected date field ${selectedFields.dateField} does not exist in the active schema.`);
    addRequirement("date_field");
  }

  for (const candidateFilter of draftPlan.candidateFilters) {
    if (!findSchemaColumn(schema, candidateFilter.columnName)) {
      validationWarnings.push(`Potential filter field ${candidateFilter.columnName} does not exist in the active schema.`);
      addRequirement("filter_value");
    }
  }

  if (
    ["ranking", "comparison", "distribution", "segmentation"].includes(draftPlan.detectedIntent) &&
    !selectedFields.dimension
  ) {
    validationWarnings.push("Choose a dimension before group-based draft logic can be prepared.");
    addRequirement("dimension");
  }

  if (
    ["trend", "timeline_review"].includes(draftPlan.detectedIntent) &&
    (!selectedFields.dateField || !isDateColumn(dateColumn))
  ) {
    validationWarnings.push("Choose a date field before trend logic can be prepared.");
    addRequirement("date_field");
  }

  if (aggregation.idea !== "count_records" && aggregation.idea !== "count_distinct" && aggregation.idea !== "none") {
    if (!selectedFields.measure || !isNumericColumn(measureColumn)) {
      validationWarnings.push("The selected measure must be numeric unless the draft uses record count.");
      addRequirement("measure");
    }
  }

  if (grouping.fields.length > 0 && grouping.dateBucket === null) {
    const incompatibleGroupingFields = grouping.fields.filter((field) => !isGroupingColumn(findSchemaColumn(schema, field)));
    if (incompatibleGroupingFields.length > 0) {
      validationWarnings.push(
        `Grouping works best with categorical, text, boolean, or entity-like fields. Review ${incompatibleGroupingFields.join(
          ", ",
        )}.`,
      );
    }
  }

  if (draftPlan.detectedIntent === "distribution" && !isGroupingColumn(dimensionColumn)) {
    validationWarnings.push("Distribution drafts require a categorical, text, or boolean dimension.");
    addRequirement("dimension");
  }

  if (grouping.dateBucket && !isDateColumn(dateColumn)) {
    validationWarnings.push("Date buckets require a date-like field.");
    addRequirement("date_field");
  }

  if (draftPlan.detectedIntent === "anomaly_review") {
    validationWarnings.push(
      "Anomaly review needs explicit metric, date, dimension, or threshold logic before executable logic can be prepared.",
    );
  }

  if (draftPlan.detectedIntent === "unknown") {
    validationWarnings.push("Clarify the business intent before draft logic can be completed.");
    addRequirement("clear_intent");
  }

  if (hasUnresolvedHighConfidenceAmbiguity(draftPlan, selectedFields)) {
    validationWarnings.push("Ambiguous high-confidence field matches should be resolved before request generation.");
  }

  if (draftPlan.missingRequirements.includes("filter_value")) {
    validationWarnings.push("Filter values must be chosen before filter preparation can be completed.");
  }

  return {
    validationWarnings: Array.from(new Set(validationWarnings)),
    blockingRequirements: clearRequirements(blockingRequirements),
  };
}

const deriveDraftStatus = (
  draftPlan: SchemaAwareQuestionDraftPlan,
  selectedFields: ControlledSelectedFields,
  blockingRequirements: MissingRequirement[],
): ControlledLogicDraftStatus => {
  if (hasUnresolvedHighConfidenceAmbiguity(draftPlan, selectedFields)) {
    return "blocked_by_ambiguity";
  }

  if (blockingRequirements.length > 0) return "blocked_by_missing_requirements";
  return "draft_only";
};

export function buildControlledLogicDraft({
  draftPlan,
  schema,
  selectedFields,
}: BuildControlledLogicDraftInput): ControlledLogicDraft {
  const grouping = deriveGroupingIdea(draftPlan, selectedFields);
  const aggregation = deriveAggregationIdea(draftPlan, selectedFields, schema);
  const sorting = deriveSortingIdea(draftPlan, grouping, aggregation);
  const limit = deriveLimitIdea(draftPlan);
  const validation = validateControlledLogicDraft({
    draftPlan,
    schema,
    selectedFields,
    grouping,
    aggregation,
  });

  return {
    draftKind: "query_builder_plan",
    draftStatus: deriveDraftStatus(draftPlan, selectedFields, validation.blockingRequirements),
    rawQuestion: draftPlan.rawQuestion,
    detectedIntent: draftPlan.detectedIntent,
    selectedFields,
    grouping,
    aggregation,
    sorting,
    limit,
    filters: draftPlan.candidateFilters.map((candidate) => ({
      field: candidate.columnName,
      operator: "unknown",
      value: null,
      summary: `Potential filter field ${candidate.columnName} requires a reviewed operator and value.`,
    })),
    plannedOutputType: draftPlan.plannedOutputType,
    validationWarnings: validation.validationWarnings,
    blockingRequirements: validation.blockingRequirements,
    executionStatus: "draft_only",
    generatedQueryBuilderRequest: null,
    generatedSql: null,
  };
}
