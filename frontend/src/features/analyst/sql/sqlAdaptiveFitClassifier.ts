import type { SqlAnalyticalStrategy } from "./sqlAnalyticalStrategies";
import type { SqlBusinessQuestionShape } from "./sqlBusinessQuestionShape";
import type { SqlRelationshipReviewPair } from "./sqlRelationshipReview";
import type { SqlTemplateAdaptiveMetadata } from "./sqlTemplateAdaptiveMetadata";
import type { SqlTemplateRecommendation } from "./sqlTemplateRecommender";

export type SqlAdaptiveFitCategory =
  | "exact_fit"
  | "adapted_fit"
  | "partial_fit"
  | "composed_solution"
  | "blocked_fit"
  | "poor_fit";

export type SqlAdaptiveInsertState =
  | "insertable_existing_sql"
  | "read_only"
  | "blocked_relationships"
  | "blocked_missing_fields"
  | "needs_confirmation";

export type SqlAdaptiveCandidateSource =
  | "template"
  | "recipe"
  | "opportunity"
  | "generated"
  | "strategy"
  | "blocked_plan";

export type SqlAdaptiveCandidateFit = {
  candidateId: string;
  source: SqlAdaptiveCandidateSource;
  title: string;
  category: SqlAdaptiveFitCategory;
  confidence: "high" | "medium" | "low";
  insertState: SqlAdaptiveInsertState;
  reasons: string[];
  requiredEntities: string[];
  requiredRelationships: string[];
  missingFields: string[];
  safety: {
    noBackendCall: true;
    noRunQuery: true;
    noEditorMutationUntilManualInsert: true;
    noUnconfirmedRelationshipSql: true;
  };
};

export type ClassifySqlAdaptiveFitsInput = {
  prompt: string;
  questionShape: SqlBusinessQuestionShape;
  recommendations: readonly SqlTemplateRecommendation[];
  strategies: readonly SqlAnalyticalStrategy[];
  relationshipReviewItems?: readonly SqlRelationshipReviewPair[];
};

const safety = {
  noBackendCall: true,
  noRunQuery: true,
  noEditorMutationUntilManualInsert: true,
  noUnconfirmedRelationshipSql: true,
} as const;

const genericSyntaxHelperPatterns = [
  /\bfilter equals\b/,
  /\bin list\b/,
  /\bcontains text\b/,
  /\bcte\b/,
  /\bcommon table expression\b/,
  /\bdialect (conversion )?note\b/,
  /\bconversion note\b/,
  /\bsyntax example\b/,
  /\bsimple syntax\b/,
];

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const includesAny = (text: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(text));

const relationshipLabelsFromReview = (
  relationshipReviewItems: readonly SqlRelationshipReviewPair[] = [],
): string[] =>
  relationshipReviewItems
    .filter((item) => item.status !== "accepted")
    .map((item) => `${item.fromTable} to ${item.toTable}`);

const relationshipLabelsFromShape = (shape: SqlBusinessQuestionShape): string[] =>
  shape.relationshipGaps.map((gap) => `${gap.fromTable} to ${gap.toTable}`);

const candidateText = (
  recommendation: Pick<
    SqlTemplateRecommendation,
    "id" | "title" | "description" | "sql" | "reasons" | "warnings" | "unsupportedReasons"
  >,
): string =>
  normalizeText(
    [
      recommendation.id,
      recommendation.title,
      recommendation.description,
      recommendation.sql,
      recommendation.reasons.join(" "),
      recommendation.warnings?.join(" ") || "",
      recommendation.unsupportedReasons?.join(" ") || "",
    ].join(" "),
  );

const strategyText = (strategy: SqlAnalyticalStrategy): string =>
  normalizeText(
    [
      strategy.id,
      strategy.title,
      strategy.description,
      strategy.outputShape.join(" "),
      strategy.strategyKind,
      strategy.disabledReason || "",
      strategy.sql || "",
    ].join(" "),
  );

const isGenericSyntaxHelper = (recommendation: SqlTemplateRecommendation): boolean => {
  if (recommendation.kind === "report") return false;
  return includesAny(candidateText(recommendation), genericSyntaxHelperPatterns);
};

const inferRecommendationSource = (
  recommendation: SqlTemplateRecommendation,
): SqlAdaptiveCandidateSource => {
  if (/^ask:/i.test(recommendation.id)) return "generated";
  if (recommendation.kind === "template") return "template";
  return /recipe/i.test(recommendation.id) ? "recipe" : "opportunity";
};

const detectMissingFields = (text: string): string[] => {
  const fields = new Set<string>();
  const patterns = [
    /\bmissing (?:field|fields|column|columns):?\s+([a-z0-9_,\s]+)/gi,
    /\brequires? unavailable (?:field|fields|column|columns):?\s+([a-z0-9_,\s]+)/gi,
    /\bunavailable (?:field|fields|column|columns):?\s+([a-z0-9_,\s]+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1] || "";
      value
        .split(/,|\band\b/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => fields.add(item));
    }
  }

  return Array.from(fields);
};

const shapeAlignedWithText = (
  text: string,
  questionShape: SqlBusinessQuestionShape,
): boolean => {
  if (questionShape.preferredOutputShape === "grouped_count") {
    return /\bcount\b/.test(text) && (/\bgroup by\b/.test(text) || /\bby\b/.test(text));
  }

  if (questionShape.preferredOutputShape === "status_breakdown") {
    return /\b(status|state|category|type)\b/.test(text) && /\b(count|summary|breakdown)\b/.test(text);
  }

  if (questionShape.preferredOutputShape === "metric_by_dimension") {
    return /\b(sum|total|average|avg|min|max)\b/.test(text) && (/\bgroup by\b/.test(text) || /\bby\b/.test(text));
  }

  if (questionShape.preferredOutputShape === "filtered_count") {
    return /\bcount\b/.test(text) && /\b(where|filter|with|active|inactive)\b/.test(text);
  }

  if (questionShape.preferredOutputShape === "detail_list") {
    return /\b(select|list|detail|show)\b/.test(text);
  }

  return false;
};

const partiallyAlignedWithText = (
  text: string,
  questionShape: SqlBusinessQuestionShape,
): boolean => {
  const entityTerms = questionShape.mentionedEntities.flatMap((entity) => [
    entity.label,
    entity.tableName,
    ...entity.matchedColumns,
  ]);
  const hasEntityMatch = entityTerms.some((term) => term && text.includes(normalizeText(term)));
  const hasMetricMatch =
    (questionShape.hasCountIntent && /\bcount\b/.test(text)) ||
    (questionShape.metricIntent === "sum" && /\b(sum|total)\b/.test(text)) ||
    (questionShape.metricIntent === "average" && /\b(avg|average)\b/.test(text));

  return hasEntityMatch || hasMetricMatch;
};

const needsFutureAdaptation = (
  recommendation: SqlTemplateRecommendation,
  text: string,
): boolean =>
  recommendation.support === "needs_review" ||
  /\badapt|assumption|verify|review before|needs review|placeholder\b/.test(text);

const isStatusSummaryText = (text: string): boolean =>
  /\b(status|state|category|type)\b/.test(text) && /\b(count|summary|breakdown)\b/.test(text);

const isSyntaxHelpPrompt = (prompt: string): boolean =>
  /\b(sql syntax|syntax|example query|where clause|how do i write|show me sql|sql helper)\b/i.test(prompt);

const metadataOutputMatchesShape = (
  metadata: SqlTemplateAdaptiveMetadata | undefined,
  questionShape: SqlBusinessQuestionShape,
): boolean => {
  if (!metadata) return false;
  if (metadata.outputShape === questionShape.preferredOutputShape) return true;

  if (
    questionShape.preferredOutputShape === "grouped_count" &&
    metadata.outputShape === "status_breakdown" &&
    questionShape.hasStatusBreakdownIntent
  ) {
    return true;
  }

  return false;
};

const metadataOutputPartiallyMatchesShape = (
  metadata: SqlTemplateAdaptiveMetadata | undefined,
  questionShape: SqlBusinessQuestionShape,
): boolean => {
  if (!metadata) return false;
  if (metadataOutputMatchesShape(metadata, questionShape)) return true;

  if (
    questionShape.hasCountIntent &&
    ["grouped_count", "filtered_count", "single_metric", "status_breakdown"].includes(metadata.outputShape)
  ) {
    return true;
  }

  if (
    questionShape.preferredOutputShape === "metric_by_dimension" &&
    ["ranked_summary", "grouped_count"].includes(metadata.outputShape)
  ) {
    return true;
  }

  if (
    questionShape.preferredOutputShape === "detail_list" &&
    ["detail_list", "ranked_summary"].includes(metadata.outputShape)
  ) {
    return true;
  }

  return false;
};

const metadataRequiresRelationshipBlock = (
  metadata: SqlTemplateAdaptiveMetadata | undefined,
  requiredRelationships: readonly string[],
  questionShape: SqlBusinessQuestionShape,
): boolean => {
  if (!metadata) return false;
  const metadataNeedsAcceptedRelationships =
    metadata.relationshipMode === "requires_relationships" ||
    metadata.adaptationSupport === "relationship_blocked" ||
    metadata.safety.requiresAcceptedRelationships;

  return metadataNeedsAcceptedRelationships && (
    requiredRelationships.length > 0 ||
    (questionShape.relationshipDependent && questionShape.relationshipGaps.length > 0)
  );
};

const metadataEvidenceReasons = (
  metadata: SqlTemplateAdaptiveMetadata | undefined,
): string[] => {
  if (!metadata) return [];

  const reasons = [
    `Adaptive metadata marks this as ${metadata.templateKind.replace(/_/g, " ")} with ${metadata.outputShape.replace(/_/g, " ")} output.`,
  ];

  if (metadata.relationshipMode === "single_table") {
    reasons.push("Adaptive metadata says this pattern is single-table and does not need worksheet relationships.");
  }

  if (metadata.relationshipMode === "requires_relationships" || metadata.safety.requiresAcceptedRelationships) {
    reasons.push("Adaptive metadata says accepted worksheet relationships are required before this pattern is safe.");
  }

  if (metadata.adaptationSupport === "field_binding") {
    reasons.push("Adaptive metadata says this pattern may need field binding before it becomes a business answer.");
  }

  if (metadata.adaptationSupport === "relationship_blocked") {
    reasons.push("Adaptive metadata marks this pattern as relationship-blocked.");
  }

  if (!metadata.safety.canAdaptSql) {
    reasons.push("Adaptive metadata does not allow SQL adaptation in this slice.");
  }

  return reasons;
};

const hasMissingRelationshipBlock = (
  requiredRelationships: readonly string[],
  questionShape: SqlBusinessQuestionShape,
): boolean =>
  requiredRelationships.length > 0 ||
  (questionShape.relationshipDependent && questionShape.relationshipGaps.length > 0);

const createFit = (
  fit: Omit<SqlAdaptiveCandidateFit, "safety" | "reasons"> & {
    reasons: readonly string[];
  },
): SqlAdaptiveCandidateFit => ({
  ...fit,
  reasons: uniqueStrings(fit.reasons),
  safety,
});

const classifyRecommendation = ({
  prompt,
  recommendation,
  questionShape,
  requiredRelationships,
}: {
  prompt: string;
  recommendation: SqlTemplateRecommendation;
  questionShape: SqlBusinessQuestionShape;
  requiredRelationships: readonly string[];
}): SqlAdaptiveCandidateFit => {
  const text = candidateText(recommendation);
  const metadata = recommendation.adaptiveMetadata;
  const source = inferRecommendationSource(recommendation);
  const missingFields = detectMissingFields(text);
  const insertableExistingSql =
    Boolean(recommendation.sql.trim()) &&
    recommendation.support !== "needs_review" &&
    missingFields.length === 0 &&
    requiredRelationships.length === 0;
  const metadataAligned = metadataOutputMatchesShape(metadata, questionShape);
  const metadataPartial = metadataOutputPartiallyMatchesShape(metadata, questionShape);
  const aligned = shapeAlignedWithText(text, questionShape) || metadataAligned;
  const mismatchedStatusSummary =
    isStatusSummaryText(text) && questionShape.preferredOutputShape !== "status_breakdown";
  const partial = partiallyAlignedWithText(text, questionShape) || metadataPartial;
  const metadataReasons = metadataEvidenceReasons(metadata);

  if (
    hasMissingRelationshipBlock(requiredRelationships, questionShape) ||
    metadataRequiresRelationshipBlock(metadata, requiredRelationships, questionShape)
  ) {
    return createFit({
      candidateId: recommendation.id,
      source,
      title: recommendation.title,
      category: "blocked_fit",
      confidence: "high",
      insertState: "blocked_relationships",
      requiredEntities: questionShape.mentionedEntities.map((entity) => entity.label),
      requiredRelationships: uniqueStrings([...requiredRelationships, ...relationshipLabelsFromShape(questionShape)]),
      missingFields,
      reasons: [
        "FiltraQueri understands the analysis, but cross-table SQL is blocked until worksheet relationships are confirmed.",
        ...metadataReasons,
      ],
    });
  }

  if (missingFields.length > 0) {
    return createFit({
      candidateId: recommendation.id,
      source,
      title: recommendation.title,
      category: "partial_fit",
      confidence: partial ? "medium" : "low",
      insertState: "blocked_missing_fields",
      requiredEntities: questionShape.mentionedEntities.map((entity) => entity.label),
      requiredRelationships: [],
      missingFields,
      reasons: [
        "This candidate needs fields that are not available in the current deterministic metadata.",
        ...metadataReasons,
      ],
    });
  }

  if (
    isGenericSyntaxHelper(recommendation) ||
    (metadata?.templateKind === "syntax_helper" && !isSyntaxHelpPrompt(prompt))
  ) {
    return createFit({
      candidateId: recommendation.id,
      source,
      title: recommendation.title,
      category: "poor_fit",
      confidence: "low",
      insertState: "read_only",
      requiredEntities: questionShape.mentionedEntities.map((entity) => entity.label),
      requiredRelationships: [],
      missingFields,
      reasons: [
        "This looks like a generic SQL syntax helper rather than a business answer for the question.",
        ...metadataReasons,
      ],
    });
  }

  if (insertableExistingSql && aligned && !mismatchedStatusSummary) {
    return createFit({
      candidateId: recommendation.id,
      source,
      title: recommendation.title,
      category: "exact_fit",
      confidence: "high",
      insertState: "insertable_existing_sql",
      requiredEntities: questionShape.mentionedEntities.map((entity) => entity.label),
      requiredRelationships: [],
      missingFields: [],
      reasons: [
        metadataAligned
          ? "Adaptive metadata confirms this existing SQL suggestion matches the detected question shape."
          : "This existing SQL suggestion directly matches the detected question shape.",
        ...metadataReasons,
      ],
    });
  }

  if (
    (needsFutureAdaptation(recommendation, text) ||
      metadata?.adaptationSupport === "field_binding" ||
      (metadataAligned && !insertableExistingSql)) &&
    (aligned || partial)
  ) {
    return createFit({
      candidateId: recommendation.id,
      source,
      title: recommendation.title,
      category: "adapted_fit",
      confidence: aligned ? "medium" : "low",
      insertState: "read_only",
      requiredEntities: questionShape.mentionedEntities.map((entity) => entity.label),
      requiredRelationships: [],
      missingFields: [],
      reasons: [
        "This matches the analysis pattern but would require future deterministic adaptation before insertion.",
        ...metadataReasons,
      ],
    });
  }

  if (partial) {
    return createFit({
      candidateId: recommendation.id,
      source,
      title: recommendation.title,
      category: "partial_fit",
      confidence: "medium",
      insertState: insertableExistingSql ? "needs_confirmation" : "read_only",
      requiredEntities: questionShape.mentionedEntities.map((entity) => entity.label),
      requiredRelationships: [],
      missingFields: [],
      reasons: [
        metadataPartial
          ? "Adaptive metadata matches part of the requested analysis shape."
          : "This matches part of the question but not the full requested output shape.",
        ...metadataReasons,
      ],
    });
  }

  return createFit({
    candidateId: recommendation.id,
    source,
    title: recommendation.title,
    category: "poor_fit",
    confidence: "low",
    insertState: "read_only",
    requiredEntities: questionShape.mentionedEntities.map((entity) => entity.label),
    requiredRelationships: [],
    missingFields: [],
    reasons: [
      "This is a weak deterministic match for the requested question shape.",
      ...metadataReasons,
    ],
  });
};

const classifyStrategy = ({
  strategy,
  questionShape,
  composedStrategyCount,
}: {
  strategy: SqlAnalyticalStrategy;
  questionShape: SqlBusinessQuestionShape;
  composedStrategyCount: number;
}): SqlAdaptiveCandidateFit => {
  const text = strategyText(strategy);
  const metadata = strategy.adaptiveMetadata;
  const missingFields = detectMissingFields(text);
  const requiredRelationships = strategy.requiredRelationships;
  const metadataAligned = metadataOutputMatchesShape(metadata, questionShape);
  const metadataPartial = metadataOutputPartiallyMatchesShape(metadata, questionShape);
  const metadataReasons = metadataEvidenceReasons(metadata);

  if (
    hasMissingRelationshipBlock(requiredRelationships, questionShape) ||
    metadataRequiresRelationshipBlock(metadata, requiredRelationships, questionShape)
  ) {
    return createFit({
      candidateId: strategy.id,
      source: strategy.strategyKind === "blocked_relationship_plan" ? "blocked_plan" : "strategy",
      title: strategy.title,
      category: "blocked_fit",
      confidence: "high",
      insertState: "blocked_relationships",
      requiredEntities: strategy.requiredEntities,
      requiredRelationships: uniqueStrings([...requiredRelationships, ...relationshipLabelsFromShape(questionShape)]),
      missingFields,
      reasons: [
        "FiltraQueri understands the analysis, but cross-table SQL is blocked until worksheet relationships are confirmed.",
        ...metadataReasons,
      ],
    });
  }

  if (missingFields.length > 0) {
    return createFit({
      candidateId: strategy.id,
      source: "strategy",
      title: strategy.title,
      category: "partial_fit",
      confidence: "medium",
      insertState: "blocked_missing_fields",
      requiredEntities: strategy.requiredEntities,
      requiredRelationships: [],
      missingFields,
      reasons: [
        "This strategy needs fields that are not available in the current deterministic metadata.",
        ...metadataReasons,
      ],
    });
  }

  if (composedStrategyCount > 1 && !strategy.isInsertable) {
    return createFit({
      candidateId: strategy.id,
      source: "strategy",
      title: strategy.title,
      category: "composed_solution",
      confidence: strategy.confidence,
      insertState: "read_only",
      requiredEntities: strategy.requiredEntities,
      requiredRelationships: [],
      missingFields: [],
      reasons: [
        "This strategy is part of a deterministic multi-step analytical path, but no single safe SQL insertion is ready yet.",
        ...metadataReasons,
      ],
    });
  }

  if (strategy.isInsertable && (shapeAlignedWithText(text, questionShape) || metadataAligned)) {
    return createFit({
      candidateId: strategy.id,
      source: "strategy",
      title: strategy.title,
      category: composedStrategyCount > 1 ? "composed_solution" : "exact_fit",
      confidence: strategy.confidence,
      insertState: "insertable_existing_sql",
      requiredEntities: strategy.requiredEntities,
      requiredRelationships: [],
      missingFields: [],
      reasons: [
        metadataAligned
          ? "Adaptive metadata confirms this insertable strategy matches the detected question shape."
          : "This strategy wraps existing deterministic SQL that matches the detected question shape.",
        ...metadataReasons,
      ],
    });
  }

  if (
    (metadata?.adaptationSupport === "field_binding" || metadataAligned) &&
    !strategy.isInsertable &&
    (metadataAligned || metadataPartial || partiallyAlignedWithText(text, questionShape))
  ) {
    return createFit({
      candidateId: strategy.id,
      source: "strategy",
      title: strategy.title,
      category: "adapted_fit",
      confidence: strategy.confidence,
      insertState: "read_only",
      requiredEntities: strategy.requiredEntities,
      requiredRelationships: [],
      missingFields: [],
      reasons: [
        "This strategy matches the analysis pattern but would require future deterministic adaptation before insertion.",
        ...metadataReasons,
      ],
    });
  }

  if (partiallyAlignedWithText(text, questionShape) || metadataPartial) {
    return createFit({
      candidateId: strategy.id,
      source: "strategy",
      title: strategy.title,
      category: "partial_fit",
      confidence: strategy.confidence,
      insertState: "read_only",
      requiredEntities: strategy.requiredEntities,
      requiredRelationships: [],
      missingFields: [],
      reasons: [
        metadataPartial
          ? "Adaptive metadata matches part of the requested analysis shape."
          : "This strategy matches part of the question but is not ready as an insertable SQL answer.",
        ...metadataReasons,
      ],
    });
  }

  return createFit({
    candidateId: strategy.id,
    source: "strategy",
    title: strategy.title,
    category: "poor_fit",
    confidence: "low",
    insertState: "read_only",
    requiredEntities: strategy.requiredEntities,
    requiredRelationships: [],
    missingFields: [],
    reasons: [
      "This strategy is a weak deterministic match for the requested question shape.",
      ...metadataReasons,
    ],
  });
};

export function classifySqlAdaptiveFits({
  prompt,
  questionShape,
  recommendations,
  strategies,
  relationshipReviewItems = [],
}: ClassifySqlAdaptiveFitsInput): SqlAdaptiveCandidateFit[] {
  const requiredRelationships = uniqueStrings([
    ...relationshipLabelsFromReview(relationshipReviewItems),
    ...relationshipLabelsFromShape(questionShape),
  ]);
  const composedStrategyCount = strategies.filter(
    (strategy) => strategy.requiredRelationships.length === 0,
  ).length;

  return [
    ...recommendations.map((recommendation) =>
      classifyRecommendation({
        prompt,
        recommendation,
        questionShape,
        requiredRelationships,
      }),
    ),
    ...strategies.map((strategy) =>
      classifyStrategy({
        strategy,
        questionShape,
        composedStrategyCount,
      }),
    ),
  ];
}
