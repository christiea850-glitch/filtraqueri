import type { SchemaColumn } from "../../dataset/datasetTypes";
import type {
  BusinessSqlFilter,
  BusinessSqlFilterComparisonValue,
  BusinessSqlFilterOperator,
  BusinessSqlFilterTarget,
} from "./businessSqlQueryPlan";

export type BusinessSqlFilterCompatibilityReason =
  | "row_filter_target_unresolved"
  | "row_filter_target_ambiguous"
  | "row_filter_target_invalid"
  | "row_filter_operator_unsupported"
  | "row_filter_value_invalid"
  | "row_filter_value_missing"
  | "row_filter_value_not_allowed"
  | "row_filter_type_incompatible"
  | "row_filter_scope_unresolved";

export type BusinessSqlFilterCompatibility = {
  compatible: boolean;
  reasonCodes: BusinessSqlFilterCompatibilityReason[];
};

export type BusinessSqlFilterAvailableField = {
  entity?: string;
  table?: string;
  field?: string;
  fieldInferredType?: SchemaColumn["inferred_type"];
};

const SUPPORTED_ROW_FILTER_OPERATORS: readonly BusinessSqlFilterOperator[] = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
  "starts_with",
  "ends_with",
  "is_null",
  "is_not_null",
];

const NULLARY_OPERATORS = new Set<BusinessSqlFilterOperator>([
  "is_null",
  "is_not_null",
]);

const ORDERED_OPERATORS = new Set<BusinessSqlFilterOperator>([
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
]);

const TEXT_OPERATORS = new Set<BusinessSqlFilterOperator>([
  "contains",
  "starts_with",
  "ends_with",
]);

export const isBusinessSqlRowFilterOperator = (
  value: string | undefined,
): value is BusinessSqlFilterOperator =>
  SUPPORTED_ROW_FILTER_OPERATORS.includes(value as BusinessSqlFilterOperator);

const hasText = (value: string | undefined): value is string =>
  Boolean(value && value.trim().length > 0);

const sameText = (left: string | undefined, right: string | undefined): boolean =>
  hasText(left) && hasText(right) && left.trim().toLowerCase() === right.trim().toLowerCase();

const targetFor = (filter: BusinessSqlFilter): BusinessSqlFilterTarget | null => {
  if (filter.target) return filter.target;
  if (filter.table || filter.field || filter.entity || filter.fieldInferredType) {
    return {
      kind: "field",
      entity: filter.entity,
      table: filter.table,
      field: filter.field,
      fieldInferredType: filter.fieldInferredType,
      resolved: filter.field && filter.table ? true : undefined,
    };
  }
  return null;
};

const matchingAvailableFields = (
  target: BusinessSqlFilterTarget,
  availableFields: readonly BusinessSqlFilterAvailableField[],
): BusinessSqlFilterAvailableField[] =>
  availableFields.filter(
    (field) =>
      sameText(field.table, target.table) &&
      sameText(field.field, target.field) &&
      (!target.entity || !field.entity || sameText(field.entity, target.entity)),
  );

const fieldTypeFor = (
  target: BusinessSqlFilterTarget,
  availableFields: readonly BusinessSqlFilterAvailableField[],
): SchemaColumn["inferred_type"] | undefined => {
  if (target.fieldInferredType) return target.fieldInferredType;
  const matches = matchingAvailableFields(target, availableFields);
  return matches.length === 1 ? matches[0].fieldInferredType : undefined;
};

const isNumericField = (type: SchemaColumn["inferred_type"] | undefined): boolean =>
  type === "numeric";

const isTextField = (type: SchemaColumn["inferred_type"] | undefined): boolean =>
  type === "text" || type === "categorical";

const isBooleanField = (type: SchemaColumn["inferred_type"] | undefined): boolean =>
  type === "boolean";

const valueKindForLegacy = (
  value: BusinessSqlFilter["value"],
): BusinessSqlFilterComparisonValue | undefined => {
  if (typeof value === "string") return { kind: "string", value };
  return undefined;
};

const comparisonValueFor = (
  filter: BusinessSqlFilter,
): BusinessSqlFilterComparisonValue | undefined =>
  filter.comparisonValue || valueKindForLegacy(filter.value);

const valueIsValid = (value: BusinessSqlFilterComparisonValue | undefined): boolean => {
  if (!value) return false;
  if (value.kind === "number") return Number.isFinite(value.value);
  if (value.kind === "string") return hasText(value.value) && !/[\u0000-\u001f\u007f]/.test(value.value);
  if (value.kind === "boolean") return typeof value.value === "boolean";
  return false;
};

const valueCompatibleWithType = ({
  operator,
  value,
  fieldType,
}: {
  operator: BusinessSqlFilterOperator;
  value: BusinessSqlFilterComparisonValue;
  fieldType: SchemaColumn["inferred_type"] | undefined;
}): boolean => {
  if (ORDERED_OPERATORS.has(operator)) {
    return isNumericField(fieldType) && value.kind === "number";
  }
  if (TEXT_OPERATORS.has(operator)) {
    return isTextField(fieldType) && value.kind === "string";
  }
  if (operator === "equals" || operator === "not_equals") {
    if (value.kind === "number") return isNumericField(fieldType);
    if (value.kind === "boolean") return isBooleanField(fieldType);
    if (value.kind === "string") return isTextField(fieldType);
  }
  return false;
};

export function evaluateBusinessSqlFilterCompatibility({
  filter,
  availableFields = [],
  scopeResolved = true,
}: {
  filter: BusinessSqlFilter;
  availableFields?: readonly BusinessSqlFilterAvailableField[];
  scopeResolved?: boolean;
}): BusinessSqlFilterCompatibility {
  const reasonCodes: BusinessSqlFilterCompatibilityReason[] = [];
  const legacySemanticFilter =
    !filter.filterId &&
    !filter.target &&
    !filter.operator &&
    !filter.comparisonValue;
  if (legacySemanticFilter) {
    return { compatible: true, reasonCodes };
  }

  const target = targetFor(filter);

  if (!scopeResolved) {
    reasonCodes.push("row_filter_scope_unresolved");
  }

  if (!target || target.kind !== "field") {
    reasonCodes.push("row_filter_target_invalid");
  } else if (target.resolved === false || !hasText(target.table) || !hasText(target.field)) {
    reasonCodes.push("row_filter_target_unresolved");
  } else if (availableFields.length > 0) {
    const matches = matchingAvailableFields(target, availableFields);
    if (matches.length === 0) {
      reasonCodes.push("row_filter_target_unresolved");
    } else if (matches.length > 1) {
      reasonCodes.push("row_filter_target_ambiguous");
    }
  }

  if (!isBusinessSqlRowFilterOperator(filter.operator)) {
    reasonCodes.push("row_filter_operator_unsupported");
  }

  if (isBusinessSqlRowFilterOperator(filter.operator)) {
    const value = comparisonValueFor(filter);
    if (NULLARY_OPERATORS.has(filter.operator)) {
      if (value) reasonCodes.push("row_filter_value_not_allowed");
    } else if (!value) {
      reasonCodes.push("row_filter_value_missing");
    } else {
      if (!valueIsValid(value)) {
        reasonCodes.push("row_filter_value_invalid");
      }
      if (target?.kind === "field" && valueIsValid(value)) {
        const fieldType = fieldTypeFor(target, availableFields);
        if (!valueCompatibleWithType({ operator: filter.operator, value, fieldType })) {
          reasonCodes.push("row_filter_type_incompatible");
        }
      }
    }
  }

  return {
    compatible: reasonCodes.length === 0,
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
}
