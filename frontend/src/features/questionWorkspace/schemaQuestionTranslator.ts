import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import type {
  CandidateFieldMatch,
  CandidateFieldRole,
  MissingRequirement,
  PlannedOutputType,
  SchemaAwareConfidence,
  SchemaAwareQuestionDraftPlan,
  SchemaAwareQuestionIntent,
} from "./questionTranslatorTypes";

type CreateSchemaAwareDraftPlanInput = {
  rawQuestion: string;
  schema: SchemaColumn[];
  dataset: Pick<DatasetMetadata, "dataset_id" | "original_filename" | "table_name" | "row_count">;
  activeSourceName?: string | null;
};

type FieldScore = {
  score: number;
  matchReason: CandidateFieldMatch["matchReason"];
  matchedTerms: string[];
};

const rankingTerms = ["most", "least", "top", "bottom", "best", "worst", "highest", "lowest"];
const comparisonTerms = ["compare", "versus", "vs", "by", "between", "against", "best", "worst"];
const trendTerms = ["trend", "change", "changed", "over time", "monthly", "weekly", "yearly"];
const timelineTerms = ["recent", "recently", "latest", "date", "time", "month", "year", "timeline"];
const distributionTerms = ["distribution", "spread", "range", "mix", "share", "breakdown"];
const aggregationTerms = ["total", "sum", "average", "avg", "count", "how many", "how much"];
const anomalyTerms = ["unusual", "outlier", "anomaly", "unexpected", "spike", "drop", "underperforming"];
const segmentationTerms = ["segment", "cohort", "group", "type", "category", "department"];
const dateTerms = ["date", "time", "month", "year", "created", "updated", "transaction", "start", "end"];
const idLikeTerms = ["id", "uuid", "zip", "phone", "postal", "code"];

const businessSynonyms: Record<string, string[]> = {
  revenue: ["sales", "amount", "payment", "total", "income"],
  sales: ["revenue", "amount", "payment", "total"],
  customer: ["client", "buyer", "tenant", "account"],
  property: ["unit", "listing", "asset", "building"],
  realtor: ["agent", "broker", "manager"],
  date: ["time", "month", "year", "created", "updated", "transaction"],
  location: ["region", "city", "state", "market", "branch"],
  product: ["sku", "item", "category"],
};

const irregularSingulars: Record<string, string> = {
  properties: "property",
  categories: "category",
  companies: "company",
  cities: "city",
  statuses: "status",
};

const unique = <T,>(items: T[]) => Array.from(new Set(items));

// Normalization deliberately keeps this translator deterministic: it compares
// user wording and schema names without calling AI, backend APIs, or execution.
export function normalizeText(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_./\\-]+/g, " ")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const singularize = (value: string) => {
  if (irregularSingulars[value]) return irregularSingulars[value];
  if (value.endsWith("ies") && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
};

export function tokenizeText(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  return unique(
    normalized
      .split(" ")
      .map(singularize)
      .filter((token) => token.length > 1),
  );
}

export function normalizeColumnName(columnName: string) {
  return normalizeText(columnName);
}

const includesAny = (question: string, terms: string[]) =>
  terms.some((term) => question.includes(normalizeText(term)));

export function detectIntentFromQuestion(rawQuestion: string): SchemaAwareQuestionIntent {
  const normalizedQuestion = normalizeText(rawQuestion);

  if (!normalizedQuestion) return "unknown";
  if (includesAny(normalizedQuestion, anomalyTerms)) return "anomaly_review";
  if (includesAny(normalizedQuestion, trendTerms)) return "trend";
  if (includesAny(normalizedQuestion, timelineTerms)) return "timeline_review";
  if (includesAny(normalizedQuestion, rankingTerms)) return "ranking";
  if (includesAny(normalizedQuestion, comparisonTerms)) return "comparison";
  if (includesAny(normalizedQuestion, distributionTerms)) return "distribution";
  if (includesAny(normalizedQuestion, aggregationTerms)) return "aggregation";
  if (includesAny(normalizedQuestion, segmentationTerms)) return "segmentation";

  return "unknown";
}

const isIdLikeColumn = (column: SchemaColumn) => {
  const columnTokens = tokenizeText(column.name);
  return columnTokens.some((token) => idLikeTerms.includes(token));
};

const isDateLikeColumn = (column: SchemaColumn) => {
  if (column.inferred_type === "date") return true;
  const normalizedName = normalizeColumnName(column.name);
  return dateTerms.some((term) => normalizedName.includes(term));
};

const isDimensionLikeColumn = (column: SchemaColumn) =>
  column.inferred_type === "categorical" ||
  column.inferred_type === "text" ||
  column.inferred_type === "boolean";

const isMeasureLikeColumn = (column: SchemaColumn) =>
  column.inferred_type === "numeric" && !isIdLikeColumn(column);

export function detectFieldRole(column: SchemaColumn): CandidateFieldRole {
  if (isDateLikeColumn(column)) return "date";
  if (isMeasureLikeColumn(column)) return "measure";
  if (isDimensionLikeColumn(column)) return "dimension";
  return "unknown";
}

const createSynonymTokens = (tokens: string[]) =>
  unique(
    tokens.flatMap((token) => [
      token,
      ...(businessSynonyms[token] || []).map(normalizeText).map(singularize),
    ]),
  );

// Matching is intentionally a score, not a query plan. It can suggest fields
// for review, but it cannot create SQL, QueryBuilderRequest, or results.
export function scoreFieldMatch(rawQuestion: string, column: SchemaColumn): FieldScore {
  const normalizedQuestion = normalizeText(rawQuestion);
  const questionTokens = tokenizeText(rawQuestion);
  const questionSynonymTokens = createSynonymTokens(questionTokens);
  const normalizedColumn = normalizeColumnName(column.name);
  const columnTokens = tokenizeText(column.name);
  const matchedTerms = columnTokens.filter((token) => questionSynonymTokens.includes(token));

  if (normalizedColumn && normalizedQuestion.includes(normalizedColumn)) {
    return { score: 100, matchReason: "exact_column_match", matchedTerms: columnTokens };
  }

  if (matchedTerms.length > 0 && matchedTerms.length === columnTokens.length) {
    return { score: 82, matchReason: "normalized_column_match", matchedTerms };
  }

  if (matchedTerms.length > 0) {
    return { score: 68, matchReason: "singular_plural_match", matchedTerms };
  }

  const synonymMatches = columnTokens.filter((token) =>
    questionTokens.some((questionToken) => businessSynonyms[questionToken]?.includes(token)),
  );

  if (synonymMatches.length > 0) {
    return { score: 58, matchReason: "business_synonym_match", matchedTerms: synonymMatches };
  }

  const role = detectFieldRole(column);
  if (role === "measure" || role === "date") {
    return { score: 34, matchReason: "type_based_candidate", matchedTerms: [] };
  }

  if (role === "dimension") {
    return { score: 28, matchReason: "type_based_candidate", matchedTerms: [] };
  }

  return { score: 0, matchReason: "type_based_candidate", matchedTerms: [] };
}

const confidenceFromScore = (score: number): SchemaAwareConfidence => {
  if (score >= 75) return "high";
  if (score >= 40) return "medium";
  return "low";
};

const toCandidate = (
  column: SchemaColumn,
  role: CandidateFieldRole,
  fieldScore: FieldScore,
): CandidateFieldMatch => ({
  columnName: column.name,
  displayName: normalizeColumnName(column.name) || column.name,
  role,
  inferredType: column.inferred_type,
  matchReason: fieldScore.matchReason,
  confidence: confidenceFromScore(fieldScore.score),
});

const getCandidatesByRole = (
  rawQuestion: string,
  schema: SchemaColumn[],
  role: CandidateFieldRole,
) =>
  schema
    .map((column) => ({ column, fieldScore: scoreFieldMatch(rawQuestion, column) }))
    .filter(({ column, fieldScore }) => {
      const detectedRole = detectFieldRole(column);
      if (role === "measure" && detectedRole !== "measure") return false;
      if (role === "date" && detectedRole !== "date") return false;
      if (role === "dimension" && detectedRole !== "dimension") return false;
      return fieldScore.score > 0;
    })
    .sort((left, right) => right.fieldScore.score - left.fieldScore.score)
    .map(({ column, fieldScore }) => toCandidate(column, role, fieldScore));

export function detectCandidateDimensions(rawQuestion: string, schema: SchemaColumn[]) {
  return getCandidatesByRole(rawQuestion, schema, "dimension").slice(0, 8);
}

export function detectCandidateMeasures(rawQuestion: string, schema: SchemaColumn[]) {
  return getCandidatesByRole(rawQuestion, schema, "measure").slice(0, 8);
}

export function detectCandidateDateFields(rawQuestion: string, schema: SchemaColumn[]) {
  return getCandidatesByRole(rawQuestion, schema, "date").slice(0, 6);
}

export function detectMissingRequirements({
  detectedIntent,
  candidateDimensions,
  candidateMeasures,
  candidateDateFields,
}: {
  detectedIntent: SchemaAwareQuestionIntent;
  candidateDimensions: CandidateFieldMatch[];
  candidateMeasures: CandidateFieldMatch[];
  candidateDateFields: CandidateFieldMatch[];
}): MissingRequirement[] {
  const missingRequirements: MissingRequirement[] = [];

  if (detectedIntent === "unknown") missingRequirements.push("clear_intent");
  if (["ranking", "comparison", "segmentation"].includes(detectedIntent) && candidateDimensions.length === 0) {
    missingRequirements.push("dimension");
  }
  if (["ranking", "comparison", "aggregation", "trend"].includes(detectedIntent) && candidateMeasures.length === 0) {
    missingRequirements.push("measure");
  }
  if (["trend", "timeline_review"].includes(detectedIntent) && candidateDateFields.length === 0) {
    missingRequirements.push("date_field");
  }

  return unique(missingRequirements);
}

export function buildClarifyingQuestions({
  detectedIntent,
  missingRequirements,
  candidateDimensions,
  candidateMeasures,
  candidateDateFields,
}: {
  detectedIntent: SchemaAwareQuestionIntent;
  missingRequirements: MissingRequirement[];
  candidateDimensions: CandidateFieldMatch[];
  candidateMeasures: CandidateFieldMatch[];
  candidateDateFields: CandidateFieldMatch[];
}) {
  const questions: string[] = [];

  if (missingRequirements.includes("clear_intent")) {
    questions.push("What business outcome should FiltraQueri focus on?");
  }
  if (missingRequirements.includes("measure")) {
    questions.push("Which metric should define the result?");
  }
  if (missingRequirements.includes("dimension")) {
    questions.push("Which entity or group should FiltraQueri compare?");
  }
  if (missingRequirements.includes("date_field")) {
    questions.push("Which date or timeline field should be used?");
  }
  if (candidateDimensions.length > 1) {
    questions.push("Which matched dimension is the right grouping field?");
  }
  if (candidateMeasures.length > 1) {
    questions.push("Which matched measure should be calculated?");
  }
  if (candidateDateFields.length > 1 && ["trend", "timeline_review"].includes(detectedIntent)) {
    questions.push("Which date field should anchor the timeline?");
  }

  return unique(questions).slice(0, 5);
}

export function buildPlannedOutputType(
  detectedIntent: SchemaAwareQuestionIntent,
): PlannedOutputType {
  if (detectedIntent === "ranking") return "ranking_list";
  if (detectedIntent === "trend" || detectedIntent === "timeline_review") return "trend_chart";
  if (detectedIntent === "aggregation") return "kpi_card";
  if (detectedIntent === "distribution") return "distribution_view";
  if (detectedIntent === "comparison" || detectedIntent === "segmentation") {
    return "comparison_table";
  }
  if (detectedIntent === "anomaly_review") return "table";
  return "unknown";
}

const buildAmbiguousTerms = (candidates: CandidateFieldMatch[]) => {
  const grouped = candidates.reduce<Record<string, CandidateFieldMatch[]>>((groups, candidate) => {
    for (const token of tokenizeText(candidate.displayName)) {
      groups[token] = [...(groups[token] || []), candidate];
    }
    return groups;
  }, {});

  return Object.entries(grouped)
    .filter(([, fieldCandidates]) => fieldCandidates.length > 1)
    .map(([term, fieldCandidates]) => ({
      term,
      candidates: fieldCandidates.slice(0, 5),
    }))
    .slice(0, 5);
};

const confidenceFromPlan = ({
  detectedIntent,
  candidateDimensions,
  candidateMeasures,
  candidateDateFields,
  missingRequirements,
}: {
  detectedIntent: SchemaAwareQuestionIntent;
  candidateDimensions: CandidateFieldMatch[];
  candidateMeasures: CandidateFieldMatch[];
  candidateDateFields: CandidateFieldMatch[];
  missingRequirements: MissingRequirement[];
}): SchemaAwareConfidence => {
  const score = [
    detectedIntent !== "unknown",
    candidateDimensions.some((candidate) => candidate.confidence !== "low"),
    candidateMeasures.some((candidate) => candidate.confidence !== "low"),
    candidateDateFields.some((candidate) => candidate.confidence !== "low"),
    missingRequirements.length === 0,
  ].filter(Boolean).length;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
};

// This is the full advisory draft builder. It never creates SQL, never creates
// a QueryBuilderRequest, and never calls any backend/execution owner.
export function createSchemaAwareDraftPlan({
  rawQuestion,
  schema,
  dataset,
  activeSourceName = null,
}: CreateSchemaAwareDraftPlanInput): SchemaAwareQuestionDraftPlan {
  const detectedIntent = detectIntentFromQuestion(rawQuestion);
  const candidateDimensions = detectCandidateDimensions(rawQuestion, schema);
  const candidateMeasures = detectCandidateMeasures(rawQuestion, schema);
  const candidateDateFields = detectCandidateDateFields(rawQuestion, schema);
  const candidateFilters = [...candidateDimensions, ...candidateDateFields]
    .filter((candidate) => candidate.confidence !== "low")
    .slice(0, 6);
  const missingRequirements = detectMissingRequirements({
    detectedIntent,
    candidateDimensions,
    candidateMeasures,
    candidateDateFields,
  });
  const ambiguousTerms = buildAmbiguousTerms([
    ...candidateDimensions,
    ...candidateMeasures,
    ...candidateDateFields,
  ]);
  const suggestedClarifyingQuestions = buildClarifyingQuestions({
    detectedIntent,
    missingRequirements,
    candidateDimensions,
    candidateMeasures,
    candidateDateFields,
  });
  const plannedOutputType = buildPlannedOutputType(detectedIntent);
  const confidence = confidenceFromPlan({
    detectedIntent,
    candidateDimensions,
    candidateMeasures,
    candidateDateFields,
    missingRequirements,
  });

  return {
    rawQuestion,
    activeDatasetId: dataset.dataset_id,
    activeDatasetName: dataset.original_filename,
    activeSourceName: activeSourceName || dataset.table_name,
    detectedIntent,
    confidence,
    candidateDimensions,
    candidateMeasures,
    candidateDateFields,
    candidateFilters,
    ambiguousTerms,
    missingRequirements,
    suggestedClarifyingQuestions,
    plannedOutputType,
    executionStatus: "not_generated",
    generatedSql: null,
    generatedQueryBuilderRequest: null,
  };
}
