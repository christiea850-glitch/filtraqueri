import type {
  BusinessSqlAggregateComparisonOperator,
  BusinessSqlAggregateResultCondition,
  BusinessSqlDerivedMeasure,
  BusinessSqlMeasure,
  BusinessSqlMeasureKind,
} from "./businessSqlQueryPlan";
import {
  getBusinessSqlAggregateResultConditionTarget,
} from "./businessSqlQueryPlan";
import { evaluateBusinessSqlDerivedMeasureCompatibility } from "./businessSqlDerivedMeasureCompatibility";

export type BusinessSqlAggregateResultConditionCompatibilityReason =
  | "aggregate_condition_measure_unresolved"
  | "aggregate_condition_derived_measure_unresolved"
  | "aggregate_condition_measure_not_aggregate"
  | "aggregate_condition_target_invalid"
  | "aggregate_condition_operator_unsupported"
  | "aggregate_condition_value_invalid";

export type BusinessSqlAggregateResultConditionCompatibility = {
  compatible: boolean;
  reasonCodes: BusinessSqlAggregateResultConditionCompatibilityReason[];
};

type AggregateResultConditionLike = {
  measureId?: string;
  target?: {
    kind?: string;
    measureId?: string;
    derivedMeasureId?: string;
  } | null;
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
  derivedMeasures = [],
}: {
  condition: AggregateResultConditionLike | BusinessSqlAggregateResultCondition;
  measures: readonly Pick<BusinessSqlMeasure, "measureId" | "kind" | "fieldInferredType">[];
  derivedMeasures?: readonly BusinessSqlDerivedMeasure[];
}): BusinessSqlAggregateResultConditionCompatibility {
  const reasonCodes: BusinessSqlAggregateResultConditionCompatibilityReason[] = [];
  const hasLegacyMeasureId = Boolean(condition.measureId);
  const hasTarget = Boolean(condition.target);
  const target = getBusinessSqlAggregateResultConditionTarget(condition);

  if (
    !target ||
    (hasLegacyMeasureId && hasTarget) ||
    (target.kind === "measure" && !target.measureId) ||
    (target.kind === "derived_measure" && !target.derivedMeasureId) ||
    (target.kind !== "measure" && target.kind !== "derived_measure")
  ) {
    reasonCodes.push("aggregate_condition_target_invalid");
  } else if (target.kind === "measure") {
    const measure = measures.find((candidate) => candidate.measureId === target.measureId);

    if (!measure) {
      reasonCodes.push("aggregate_condition_measure_unresolved");
    } else if (!isBusinessSqlAggregateCompatibleMeasureKind(measure.kind)) {
      reasonCodes.push("aggregate_condition_measure_not_aggregate");
    }
  } else {
    const matchingDerivedMeasures = derivedMeasures.filter(
      (candidate) => candidate.derivedMeasureId === target.derivedMeasureId,
    );
    if (matchingDerivedMeasures.length !== 1) {
      reasonCodes.push("aggregate_condition_derived_measure_unresolved");
    } else {
      const derivedCompatibility = evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure: matchingDerivedMeasures[0],
        measures,
        derivedMeasures,
      });
      if (!derivedCompatibility.compatible) {
        reasonCodes.push("aggregate_condition_derived_measure_unresolved");
      }
    }
  }

  if (!isBusinessSqlAggregateComparisonOperator(condition.operator)) {
    reasonCodes.push("aggregate_condition_operator_unsupported");
  }

  if (!isSupportedComparisonValue(condition.comparisonValue)) {
    reasonCodes.push("aggregate_condition_value_invalid");
  }

  return {
    compatible: reasonCodes.length === 0,
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
}
