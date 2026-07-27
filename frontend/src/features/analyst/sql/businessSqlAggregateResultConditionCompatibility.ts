import type {
  BusinessSqlAggregateComparisonOperator,
  BusinessSqlAggregateResultCondition,
  BusinessSqlMeasure,
  BusinessSqlMeasureKind,
} from "./businessSqlQueryPlan";

export type BusinessSqlAggregateResultConditionCompatibilityReason =
  | "aggregate_condition_measure_unresolved"
  | "aggregate_condition_measure_not_aggregate"
  | "aggregate_condition_operator_unsupported"
  | "aggregate_condition_value_invalid";

export type BusinessSqlAggregateResultConditionCompatibility = {
  compatible: boolean;
  reasonCodes: BusinessSqlAggregateResultConditionCompatibilityReason[];
};

type AggregateResultConditionLike = {
  measureId?: string;
  operator?: string;
  comparisonValue?: {
    kind?: string;
    value?: unknown;
  } | null;
};

const SUPPORTED_AGGREGATE_COMPARISON_OPERATORS: readonly BusinessSqlAggregateComparisonOperator[] = [
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "equals",
  "not_equals",
];

const AGGREGATE_COMPATIBLE_MEASURE_KINDS: readonly BusinessSqlMeasureKind[] = [
  "count_rows",
  "count_entities",
  "count_distinct",
  "sum",
  "average",
  "minimum",
  "maximum",
];

export const isBusinessSqlAggregateComparisonOperator = (
  value: string | undefined,
): value is BusinessSqlAggregateComparisonOperator =>
  SUPPORTED_AGGREGATE_COMPARISON_OPERATORS.includes(
    value as BusinessSqlAggregateComparisonOperator,
  );

export const isBusinessSqlAggregateCompatibleMeasureKind = (
  value: BusinessSqlMeasureKind | string | undefined,
): value is BusinessSqlMeasureKind =>
  AGGREGATE_COMPATIBLE_MEASURE_KINDS.includes(value as BusinessSqlMeasureKind);

const isSupportedComparisonValue = (
  value: AggregateResultConditionLike["comparisonValue"],
): boolean => value?.kind === "number" && typeof value.value === "number" && Number.isFinite(value.value);

export function evaluateBusinessSqlAggregateResultConditionCompatibility({
  condition,
  measures,
}: {
  condition: AggregateResultConditionLike | BusinessSqlAggregateResultCondition;
  measures: readonly Pick<BusinessSqlMeasure, "measureId" | "kind">[];
}): BusinessSqlAggregateResultConditionCompatibility {
  const reasonCodes: BusinessSqlAggregateResultConditionCompatibilityReason[] = [];
  const measure = measures.find((candidate) => candidate.measureId === condition.measureId);

  if (!measure) {
    reasonCodes.push("aggregate_condition_measure_unresolved");
  } else if (!isBusinessSqlAggregateCompatibleMeasureKind(measure.kind)) {
    reasonCodes.push("aggregate_condition_measure_not_aggregate");
  }

  if (!isBusinessSqlAggregateComparisonOperator(condition.operator)) {
    reasonCodes.push("aggregate_condition_operator_unsupported");
  }

  if (!isSupportedComparisonValue(condition.comparisonValue)) {
    reasonCodes.push("aggregate_condition_value_invalid");
  }

  return {
    compatible: reasonCodes.length === 0,
    reasonCodes,
  };
}
