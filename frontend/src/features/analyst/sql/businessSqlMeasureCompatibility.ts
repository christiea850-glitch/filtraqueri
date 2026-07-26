import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { BusinessSqlMeasure, BusinessSqlMeasureKind } from "./businessSqlQueryPlan";

export type BusinessSqlMeasureCompatibilityReason =
  | "field_required"
  | "numeric_field_required"
  | "numeric_or_date_field_required";

export type BusinessSqlMeasureCompatibility = {
  compatible: boolean;
  reason: BusinessSqlMeasureCompatibilityReason | null;
  measureKind: BusinessSqlMeasureKind;
  fieldInferredType: SchemaColumn["inferred_type"] | null;
};

const numericMeasureKinds = new Set<BusinessSqlMeasureKind>(["sum", "average"]);
const numericOrDateMeasureKinds = new Set<BusinessSqlMeasureKind>(["minimum", "maximum"]);

export const isBusinessSqlCountMeasureKind = (kind: BusinessSqlMeasureKind): boolean =>
  kind === "count_rows" || kind === "count_entities" || kind === "count_distinct";

export function evaluateBusinessSqlMeasureCompatibility({
  measure,
  fieldInferredType = measure.fieldInferredType || null,
}: {
  measure: Pick<BusinessSqlMeasure, "kind" | "field" | "fieldInferredType">;
  fieldInferredType?: SchemaColumn["inferred_type"] | null;
}): BusinessSqlMeasureCompatibility {
  if (isBusinessSqlCountMeasureKind(measure.kind)) {
    return {
      compatible: true,
      reason: null,
      measureKind: measure.kind,
      fieldInferredType,
    };
  }

  if (!measure.field) {
    return {
      compatible: false,
      reason: "field_required",
      measureKind: measure.kind,
      fieldInferredType,
    };
  }

  if (numericMeasureKinds.has(measure.kind)) {
    return {
      compatible: fieldInferredType === "numeric",
      reason: fieldInferredType === "numeric" ? null : "numeric_field_required",
      measureKind: measure.kind,
      fieldInferredType,
    };
  }

  if (numericOrDateMeasureKinds.has(measure.kind)) {
    const compatible = fieldInferredType === "numeric" || fieldInferredType === "date";

    return {
      compatible,
      reason: compatible ? null : "numeric_or_date_field_required",
      measureKind: measure.kind,
      fieldInferredType,
    };
  }

  return {
    compatible: false,
    reason: "field_required",
    measureKind: measure.kind,
    fieldInferredType,
  };
}

