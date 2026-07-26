import {
  normalizeMetricAndMeasures,
  type BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";

export type BusinessSqlRendererCapabilityStatus = "capable" | "incapable";

export type BusinessSqlRendererIncapabilityReason =
  | "multiple_measures_not_supported"
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

  if (normalized.measures.length > 1) {
    reasonCodes.push("multiple_measures_not_supported");
  }

  if (!normalized.metric && normalized.measures.length > 0) {
    reasonCodes.push("unrecognized_plan_shape");
  }

  return {
    status: reasonCodes.length === 0 ? "capable" : "incapable",
    capable: reasonCodes.length === 0,
    reasonCodes,
    metadataOnly: true,
  };
}

