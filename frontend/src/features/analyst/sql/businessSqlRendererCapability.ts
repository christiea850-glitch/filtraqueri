import {
  normalizeMetricAndMeasures,
  type BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";
import { evaluateBusinessSqlDerivedMeasureCompatibility } from "./businessSqlDerivedMeasureCompatibility";

export type BusinessSqlRendererCapabilityStatus = "capable" | "incapable";

export type BusinessSqlRendererIncapabilityReason =
  | "multiple_measures_not_supported"
  | "aggregate_condition_multiple_not_supported"
  | "derived_measure_rendering_not_supported"
  | "derived_measures_multiple_not_supported"
  | "derived_measure_operand_mismatch"
  | "unrecognized_plan_shape";

export type BusinessSqlRendererCapability = {
  status: BusinessSqlRendererCapabilityStatus;
  capable: boolean;
  reasonCodes: BusinessSqlRendererIncapabilityReason[];
  metadataOnly: true;
};

export function evaluateBusinessSqlRendererCapability(
  plan: BusinessSqlQueryPlan,
): BusinessSqlRendererCapability {
  const normalized = normalizeMetricAndMeasures(plan);
  const reasonCodes: BusinessSqlRendererIncapabilityReason[] = [];
  const derivedMeasures = normalized.derivedMeasures || [];

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

    if (compatibility.compatible && operandsExactlyMatchBaseMeasures) {
      reasonCodes.push("derived_measure_rendering_not_supported");
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

  if (normalized.measures.length === 0 && !normalized.metric) {
    reasonCodes.push("unrecognized_plan_shape");
  }

  return {
    status: reasonCodes.length === 0 ? "capable" : "incapable",
    capable: reasonCodes.length === 0,
    reasonCodes,
    metadataOnly: true,
  };
}
