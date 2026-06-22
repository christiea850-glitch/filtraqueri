import type { SqlBusinessQuestionShape } from "./sqlBusinessQuestionShape";
import type { SqlTemplateRecommendation } from "./sqlTemplateRecommender";
import type { SqlTemplateAdaptiveMetadata } from "./sqlTemplateAdaptiveMetadata";

export type SqlAnalyticalStrategyKind =
  | "grouped_count"
  | "ranked_summary"
  | "coverage_percent"
  | "gap_detection"
  | "metric_by_dimension"
  | "detail_list"
  | "status_breakdown"
  | "blocked_relationship_plan";

export type SqlAnalyticalStrategy = {
  id: string;
  title: string;
  description: string;
  outputShape: string[];
  strategyKind: SqlAnalyticalStrategyKind;
  requiredEntities: string[];
  requiredRelationships: string[];
  isInsertable: boolean;
  disabledReason?: string;
  confidence: "high" | "medium";
  sql?: string;
  sourceRecommendationId?: string;
  adaptiveMetadata?: SqlTemplateAdaptiveMetadata;
};

type StrategyRecommendation = Pick<SqlTemplateRecommendation, "id" | "title" | "description" | "sql">;

const BLOCKED_RELATIONSHIP_REASON = "Confirm worksheet relationships before inserting SQL.";
const MAX_VISIBLE_STRATEGIES = 3;

const normalizeIdentifier = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const singularize = (value: string): string => {
  if (value.endsWith("ies") && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
};

const entityLabel = (entity: SqlBusinessQuestionShape["mentionedEntities"][number] | null | undefined): string =>
  entity?.label || entity?.tableName || "records";

const entityColumn = (entity: SqlBusinessQuestionShape["mentionedEntities"][number] | null | undefined): string => {
  const matchedColumn = entity?.matchedColumns[0];
  if (matchedColumn) return normalizeIdentifier(matchedColumn);
  const label = entityLabel(entity);
  const identifier = normalizeIdentifier(label);
  return identifier ? `${singularize(identifier)}_name` : "group";
};

const countColumn = (entityLabelValue: string, suffix = "count"): string =>
  `${singularize(normalizeIdentifier(entityLabelValue) || "record")}_${suffix}`;

const relationshipLabels = (shape: SqlBusinessQuestionShape): string[] =>
  shape.relationshipGaps.map((gap) => `${gap.fromTable} to ${gap.toTable}`);

const promptHasGapLanguage = (prompt: string): boolean =>
  /\b(with|without|has|have|having|missing|no|none)\b/i.test(prompt);

const findInsertableRecommendation = (
  recommendations: readonly unknown[] | undefined,
  titleNeedles: readonly string[],
): StrategyRecommendation | null => {
  const typed = (recommendations || []) as StrategyRecommendation[];
  return (
    typed.find((recommendation) => {
      const haystack = `${recommendation.title} ${recommendation.description} ${recommendation.sql}`.toLowerCase();
      return Boolean(recommendation.sql?.trim()) && titleNeedles.every((needle) => haystack.includes(needle));
    }) || null
  );
};

const withInsertState = (
  strategy: Omit<SqlAnalyticalStrategy, "isInsertable" | "disabledReason" | "sql" | "sourceRecommendationId">,
  recommendation: StrategyRecommendation | null,
  isBlocked: boolean,
): SqlAnalyticalStrategy => {
  if (isBlocked) {
    return {
      ...strategy,
      strategyKind: strategy.strategyKind === "blocked_relationship_plan" ? strategy.strategyKind : strategy.strategyKind,
      isInsertable: false,
      disabledReason: BLOCKED_RELATIONSHIP_REASON,
    };
  }

  if (!recommendation) {
    return {
      ...strategy,
      isInsertable: false,
      disabledReason: "Review this analysis option before inserting SQL.",
    };
  }

  return {
    ...strategy,
    isInsertable: true,
    sql: recommendation.sql,
    sourceRecommendationId: recommendation.id,
  };
};

export function recommendAnalyticalStrategies(args: {
  prompt: string;
  questionShape: SqlBusinessQuestionShape;
  relevantWorksheets: readonly unknown[];
  acceptedRelationships?: readonly unknown[];
  existingRecommendations?: readonly unknown[];
}): SqlAnalyticalStrategy[] {
  const { prompt, questionShape, existingRecommendations } = args;
  const counted = entityLabel(questionShape.countedEntity || questionShape.mentionedEntities[0]);
  const grouping = entityLabel(questionShape.groupingEntity || questionShape.mentionedEntities[1] || questionShape.mentionedEntities[0]);
  const metric = questionShape.metricIntent === "average" ? "average" : questionShape.metricIntent || "count";
  const relationships = relationshipLabels(questionShape);
  const isBlocked = questionShape.relationshipDependent && relationships.length > 0;
  const requiredEntities = questionShape.mentionedEntities.map((entity) => entity.label);
  const groupCol = entityColumn(questionShape.groupingEntity || questionShape.mentionedEntities[0]);
  const countedCountCol = countColumn(counted);
  const strategies: SqlAnalyticalStrategy[] = [];

  const add = (strategy: Omit<SqlAnalyticalStrategy, "isInsertable" | "disabledReason" | "sql" | "sourceRecommendationId">, needles: string[]) => {
    strategies.push(withInsertState(strategy, findInsertableRecommendation(existingRecommendations, needles), isBlocked));
  };

  if (questionShape.preferredOutputShape === "grouped_count" || (questionShape.hasCountIntent && questionShape.hasGroupingIntent)) {
    const hasGapLanguage = promptHasGapLanguage(prompt);
    add({ id: "grouped-count", title: `Count ${counted} by ${grouping}`, description: `Count ${counted} for each ${grouping}.`, outputShape: [groupCol, countedCountCol], strategyKind: "grouped_count", requiredEntities, requiredRelationships: relationships, confidence: "high" }, ["count"]);
    if (hasGapLanguage && questionShape.isCrossEntity) {
      add({ id: "coverage-percent", title: `${singularize(counted)} coverage percentage by ${grouping}`, description: `Calculate coverage percentage for ${counted} matching the requested condition per ${grouping}.`, outputShape: [groupCol, countedCountCol, `total_${normalizeIdentifier(counted) || "records"}`, `${singularize(normalizeIdentifier(counted) || "record")}_coverage_percent`], strategyKind: "coverage_percent", requiredEntities, requiredRelationships: relationships, confidence: "medium" }, ["percent"]);
    } else {
      add({ id: "ranked-count", title: `Rank ${grouping} by ${singularize(counted)} count`, description: `Show the highest ${grouping} by ${singularize(counted)} count.`, outputShape: [groupCol, countedCountCol, "rank"], strategyKind: "ranked_summary", requiredEntities, requiredRelationships: relationships, confidence: "high" }, ["count"]);
    }
    if (hasGapLanguage) {
      add({ id: "gap-detection", title: `${grouping} missing ${singularize(counted)} coverage`, description: `Find ${grouping} with missing or no matching ${counted}.`, outputShape: [groupCol, countColumn(counted, "without_coverage_count")], strategyKind: isBlocked ? "blocked_relationship_plan" : "gap_detection", requiredEntities, requiredRelationships: relationships, confidence: "medium" }, ["missing"]);
    }
  } else if (questionShape.preferredOutputShape === "metric_by_dimension") {
    const metricName = /\brevenue\b/i.test(prompt) ? "revenue" : "metric";
    add({ id: "metric-by-dimension", title: `${metric === "sum" ? "Total" : metric} ${metricName} by ${grouping}`, description: `Summarize ${metricName} for each ${grouping}.`, outputShape: [groupCol, `${metric}_${metricName}`], strategyKind: "metric_by_dimension", requiredEntities, requiredRelationships: relationships, confidence: "high" }, [metric === "sum" ? "total" : metric]);
    add({ id: "ranked-metric", title: `Rank ${grouping} by ${metricName}`, description: `Sort ${grouping} by summarized ${metricName}.`, outputShape: [groupCol, `${metric}_${metricName}`, "rank"], strategyKind: "ranked_summary", requiredEntities, requiredRelationships: relationships, confidence: "high" }, [metric === "sum" ? "total" : metric]);
    add({ id: "average-share", title: `Compare average ${metricName} by ${grouping}`, description: `Review average or share-style ${metricName} patterns by ${grouping} when the metric is numeric.`, outputShape: [groupCol, `average_${metricName}`], strategyKind: "coverage_percent", requiredEntities, requiredRelationships: relationships, confidence: "medium" }, ["average"]);
  } else if (questionShape.preferredOutputShape === "status_breakdown") {
    add({ id: "status-breakdown", title: `${counted} by status`, description: `Break ${counted} into status or category counts.`, outputShape: ["status", countedCountCol], strategyKind: "status_breakdown", requiredEntities, requiredRelationships: relationships, confidence: "high" }, ["status"]);
    add({ id: "ranked-status", title: `Rank statuses by ${singularize(counted)} count`, description: `Sort status or category values by count.`, outputShape: ["status", countedCountCol, "rank"], strategyKind: "ranked_summary", requiredEntities, requiredRelationships: relationships, confidence: "medium" }, ["status"]);
  } else if (questionShape.preferredOutputShape === "detail_list") {
    add({ id: "detail-list", title: `${counted} without requested values`, description: `List matching ${counted} records for review.`, outputShape: [groupCol], strategyKind: "detail_list", requiredEntities, requiredRelationships: relationships, confidence: "high" }, ["select"]);
    if (questionShape.groupingEntity || questionShape.mentionedEntities.length > 1) {
      add({ id: "detail-summary", title: `Count matching ${counted} by ${grouping}`, description: `Summarize the listed records by ${grouping}.`, outputShape: [groupCol, countedCountCol], strategyKind: isBlocked ? "blocked_relationship_plan" : "grouped_count", requiredEntities, requiredRelationships: relationships, confidence: "medium" }, ["count"]);
    }
  } else if (questionShape.preferredOutputShape === "filtered_count") {
    add({ id: "filtered-count", title: `Count filtered ${counted}`, description: `Count ${counted} matching the requested filters.`, outputShape: [countedCountCol], strategyKind: "grouped_count", requiredEntities, requiredRelationships: relationships, confidence: "high" }, ["count"]);
    if (questionShape.groupingEntity) {
      add({ id: "filtered-breakdown", title: `Break down filtered ${counted} by ${grouping}`, description: `Count filtered ${counted} for each ${grouping}.`, outputShape: [groupCol, countedCountCol], strategyKind: "grouped_count", requiredEntities, requiredRelationships: relationships, confidence: "medium" }, ["count"]);
    }
  }

  return strategies.slice(0, MAX_VISIBLE_STRATEGIES);
}

export const sqlAnalyticalStrategyStatusLabel = (
  strategy: Pick<SqlAnalyticalStrategy, "isInsertable" | "disabledReason" | "requiredRelationships">,
): "Insertable" | "Relationships needed" | "Needs review" => {
  if (strategy.isInsertable) return "Insertable";
  if (strategy.requiredRelationships.length > 0 && strategy.disabledReason === BLOCKED_RELATIONSHIP_REASON) {
    return "Relationships needed";
  }
  return "Needs review";
};
