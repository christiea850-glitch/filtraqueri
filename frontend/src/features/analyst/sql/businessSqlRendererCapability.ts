import {
  getBusinessSqlAggregateResultConditionTarget,
  normalizeMetricAndMeasures,
  resolveBusinessSqlFilterCombinator,
  type BusinessSqlFilter,
  type BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";
import { evaluateBusinessSqlDerivedMeasureCompatibility } from "./businessSqlDerivedMeasureCompatibility";
import { evaluateBusinessSqlAggregateResultConditionCompatibility } from "./businessSqlAggregateResultConditionCompatibility";
import { evaluateBusinessSqlFilterCompatibility } from "./businessSqlFilterCompatibility";

export type BusinessSqlRendererCapabilityStatus = "capable" | "incapable";

export type BusinessSqlRendererIncapabilityReason =
  | "multiple_measures_not_supported"
  | "aggregate_condition_multiple_not_supported"
  | "derived_measure_order_by_rendering_not_supported"
  | "derived_measure_aggregate_condition_rendering_not_supported"
  | "derived_measure_operator_rendering_not_supported"
  | "derived_measures_multiple_not_supported"
  | "derived_measure_division_policy_missing"
  | "derived_measure_operand_mismatch"
  | "row_filter_rendering_not_supported"
  | "row_filter_legacy_semantics_not_renderable"
  | "multiple_row_filters_not_supported"
  | "unrecognized_plan_shape";

export type BusinessSqlRendererCapability = {
  status: BusinessSqlRendererCapabilityStatus;
  capable: boolean;
  reasonCodes: BusinessSqlRendererIncapabilityReason[];
  metadataOnly: true;
};

const RENDERABLE_DERIVED_MEASURE_OPERATORS = new Set([
  "add",
  "subtract",
  "multiply",
  "divide",
]);

const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });

const hasRenderableAlias = (value: string | undefined): value is string =>
  Boolean(value && value.trim().length > 0 && !hasControlCharacter(value));

const isBusinessSqlFilterRecord = (filter: unknown): filter is BusinessSqlFilter =>
  Boolean(filter && typeof filter === "object" && !Array.isArray(filter));

const isCanonicalRenderableFilter = (filter: unknown): boolean =>
  isBusinessSqlFilterRecord(filter) &&
  filter.target?.kind === "field" &&
  Boolean(filter.operator) &&
  (filter.operator === "is_null" ||
    filter.operator === "is_not_null" ||
    Boolean(filter.comparisonValue)) &&
  evaluateBusinessSqlFilterCompatibility({ filter }).compatible;

export function evaluateBusinessSqlRendererCapability(
  plan: BusinessSqlQueryPlan,
): BusinessSqlRendererCapability {
  const normalized = normalizeMetricAndMeasures(plan);
  const reasonCodes: BusinessSqlRendererIncapabilityReason[] = [];
  const derivedMeasures = normalized.derivedMeasures || [];
  const rowFilterCount = (normalized.filters || []).length;
  const fieldProjectionOnly =
    normalized.measures.length === 0 &&
    derivedMeasures.length === 0 &&
    normalized.aggregateResultConditions.length === 0 &&
    (normalized.orderBy || []).length === 0 &&
    normalized.groupings.length > 0;

  if (derivedMeasures.length > 1) {
    reasonCodes.push("derived_measures_multiple_not_supported");
  } else if (derivedMeasures.length === 1) {
    const derivedMeasure = derivedMeasures[0];
    const compatibility = evaluateBusinessSqlDerivedMeasureCompatibility({
      derivedMeasure,
      measures: normalized.measures,
      derivedMeasures,
    });
    const operandIds = new Set([
      derivedMeasure.leftMeasureId,
      derivedMeasure.rightMeasureId,
    ]);
    const baseMeasureIds = new Set(normalized.measures.map((measure) => measure.measureId));
    const operandsExactlyMatchBaseMeasures =
      normalized.measures.length === 2 &&
      operandIds.size === 2 &&
      baseMeasureIds.size === 2 &&
      Array.from(operandIds).every((measureId) => baseMeasureIds.has(measureId));

    if (!RENDERABLE_DERIVED_MEASURE_OPERATORS.has(derivedMeasure.operator)) {
      reasonCodes.push("derived_measure_operator_rendering_not_supported");
    } else if (compatibility.compatible && operandsExactlyMatchBaseMeasures) {
      // Supported in the deterministic renderer.
    } else if (compatibility.reasonCodes.includes("derived_measure_division_policy_missing")) {
      reasonCodes.push("derived_measure_division_policy_missing");
    } else {
      reasonCodes.push("derived_measure_operand_mismatch");
    }
  }

  if (derivedMeasures.length === 0 && normalized.measures.length > 1) {
    reasonCodes.push("multiple_measures_not_supported");
  }

  const aggregateResultConditionCount = (normalized.aggregateResultConditions || []).length;

  if (aggregateResultConditionCount > 1) {
    reasonCodes.push("aggregate_condition_multiple_not_supported");
  }

  if (rowFilterCount > 0 && resolveBusinessSqlFilterCombinator(normalized) !== "and") {
    reasonCodes.push("multiple_row_filters_not_supported");
  } else {
    for (const filter of normalized.filters || []) {
      if (!isCanonicalRenderableFilter(filter)) {
        reasonCodes.push(
          isBusinessSqlFilterRecord(filter) && filter.target?.kind === "field"
            ? "row_filter_rendering_not_supported"
            : "row_filter_legacy_semantics_not_renderable",
        );
      }
    }
  }

  for (const sort of normalized.orderBy || []) {
    if (sort.target.kind !== "derived_measure") continue;
    const target = sort.target;
    const matchingDerivedMeasures = derivedMeasures.filter(
      (derivedMeasure) => derivedMeasure.derivedMeasureId === target.derivedMeasureId,
    );
    const derivedMeasure = matchingDerivedMeasures.length === 1
      ? matchingDerivedMeasures[0]
      : null;
    if (!derivedMeasure || !hasRenderableAlias(derivedMeasure.sqlAlias)) {
      reasonCodes.push("derived_measure_order_by_rendering_not_supported");
    }
  }

  for (const condition of normalized.aggregateResultConditions || []) {
    const target = getBusinessSqlAggregateResultConditionTarget(condition);
    if (target?.kind !== "derived_measure") continue;
    const compatibility = evaluateBusinessSqlAggregateResultConditionCompatibility({
      condition,
      measures: normalized.measures,
      derivedMeasures,
    });
    if (!compatibility.compatible) {
      reasonCodes.push("derived_measure_aggregate_condition_rendering_not_supported");
    }
  }

  if (normalized.measures.length === 0 && !normalized.metric && !fieldProjectionOnly) {
    reasonCodes.push("unrecognized_plan_shape");
  }

  return {
    status: reasonCodes.length === 0 ? "capable" : "incapable",
    capable: reasonCodes.length === 0,
    reasonCodes,
    metadataOnly: true,
  };
}
