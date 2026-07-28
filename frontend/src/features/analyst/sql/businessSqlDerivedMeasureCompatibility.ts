import type {
  BusinessSqlDerivedMeasure,
  BusinessSqlDerivedMeasureOperator,
  BusinessSqlMeasure,
} from "./businessSqlQueryPlan";

export type BusinessSqlDerivedMeasureCompatibilityReason =
  | "derived_measure_left_unresolved"
  | "derived_measure_right_unresolved"
  | "derived_measure_self_reference"
  | "derived_measure_dependency_not_supported"
  | "derived_measure_operator_unsupported"
  | "derived_measure_division_policy_missing"
  | "derived_measure_operand_type_incompatible";

export type BusinessSqlDerivedMeasureCompatibility = {
  compatible: boolean;
  reasonCodes: BusinessSqlDerivedMeasureCompatibilityReason[];
};

type DerivedMeasureLike = {
  derivedMeasureId?: string;
  operator?: string;
  leftMeasureId?: string;
  rightMeasureId?: string;
  divisionPolicy?: {
    zeroDenominator?: string;
  } | null;
};

const SUPPORTED_DERIVED_MEASURE_OPERATORS: readonly BusinessSqlDerivedMeasureOperator[] = [
  "add",
  "subtract",
  "multiply",
  "divide",
];

const NUMERIC_OUTPUT_MEASURE_KINDS = new Set([
  "count_rows",
  "count_entities",
  "count_distinct",
  "sum",
  "average",
]);

export const isBusinessSqlDerivedMeasureOperator = (
  value: string | undefined,
): value is BusinessSqlDerivedMeasureOperator =>
  SUPPORTED_DERIVED_MEASURE_OPERATORS.includes(
    value as BusinessSqlDerivedMeasureOperator,
  );

const isNumericOutputMeasure = (
  measure: Pick<BusinessSqlMeasure, "kind" | "fieldInferredType">,
): boolean => {
  if (NUMERIC_OUTPUT_MEASURE_KINDS.has(measure.kind)) return true;
  if (measure.kind === "minimum" || measure.kind === "maximum") {
    return measure.fieldInferredType === "numeric";
  }
  return false;
};

export function evaluateBusinessSqlDerivedMeasureCompatibility({
  derivedMeasure,
  measures,
  derivedMeasures = [],
}: {
  derivedMeasure: DerivedMeasureLike | BusinessSqlDerivedMeasure;
  measures: readonly Pick<BusinessSqlMeasure, "measureId" | "kind" | "fieldInferredType">[];
  derivedMeasures?: readonly Pick<BusinessSqlDerivedMeasure, "derivedMeasureId">[];
}): BusinessSqlDerivedMeasureCompatibility {
  const reasonCodes: BusinessSqlDerivedMeasureCompatibilityReason[] = [];
  const leftMeasureId = derivedMeasure.leftMeasureId || "";
  const rightMeasureId = derivedMeasure.rightMeasureId || "";
  const derivedMeasureId = derivedMeasure.derivedMeasureId || "";

  if (
    derivedMeasureId &&
    (leftMeasureId === derivedMeasureId || rightMeasureId === derivedMeasureId)
  ) {
    reasonCodes.push("derived_measure_self_reference");
  }

  const leftDerived = derivedMeasures.some(
    (candidate) => candidate.derivedMeasureId === leftMeasureId,
  );
  const rightDerived = derivedMeasures.some(
    (candidate) => candidate.derivedMeasureId === rightMeasureId,
  );

  if (leftDerived || rightDerived) {
    reasonCodes.push("derived_measure_dependency_not_supported");
  }

  const leftMeasure = measures.find((candidate) => candidate.measureId === leftMeasureId);
  const rightMeasure = measures.find((candidate) => candidate.measureId === rightMeasureId);

  if (!leftMeasure && !leftDerived) {
    reasonCodes.push("derived_measure_left_unresolved");
  }
  if (!rightMeasure && !rightDerived) {
    reasonCodes.push("derived_measure_right_unresolved");
  }

  if (!isBusinessSqlDerivedMeasureOperator(derivedMeasure.operator)) {
    reasonCodes.push("derived_measure_operator_unsupported");
  }

  if (
    derivedMeasure.operator === "divide" &&
    derivedMeasure.divisionPolicy?.zeroDenominator !== "null"
  ) {
    reasonCodes.push("derived_measure_division_policy_missing");
  }

  if (
    leftMeasure &&
    rightMeasure &&
    (!isNumericOutputMeasure(leftMeasure) || !isNumericOutputMeasure(rightMeasure))
  ) {
    reasonCodes.push("derived_measure_operand_type_incompatible");
  }

  return {
    compatible: reasonCodes.length === 0,
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
}
