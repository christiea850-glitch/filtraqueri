import {
  resolveBusinessSqlFilterCombinator,
  type BusinessSqlFilter,
  type BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";
import {
  evaluateBusinessSqlFilterCompatibility,
  type BusinessSqlFilterCompatibilityReason,
} from "./businessSqlFilterCompatibility";

export type BusinessSqlFilterGroupContractReason =
  | "row_filter_combinator_unsupported"
  | BusinessSqlFilterCompatibilityReason;

const NULLARY_OPERATORS = new Set(["is_null", "is_not_null"]);

const isBusinessSqlFilterRecord = (filter: unknown): filter is BusinessSqlFilter =>
  Boolean(filter && typeof filter === "object" && !Array.isArray(filter));

const hasCanonicalFieldTarget = (filter: BusinessSqlFilter): boolean =>
  filter.target?.kind === "field";

const hasCanonicalValueContract = (filter: BusinessSqlFilter): boolean =>
  typeof filter.operator === "string" &&
  (NULLARY_OPERATORS.has(filter.operator) || Boolean(filter.comparisonValue));

export const evaluateBusinessSqlFilterGroupContract = (
  plan: Pick<BusinessSqlQueryPlan, "filterCombinator" | "filters">,
): {
  supportedCombinator: boolean;
  reasonCodes: BusinessSqlFilterGroupContractReason[];
} => {
  const reasonCodes: BusinessSqlFilterGroupContractReason[] = [];
  const combinator = resolveBusinessSqlFilterCombinator(plan);
  if (!combinator) {
    reasonCodes.push("row_filter_combinator_unsupported");
  }

  const filters = plan.filters || [];
  const multiFilterGroup = filters.length >= 2;

  for (const filter of filters) {
    if (!isBusinessSqlFilterRecord(filter)) {
      reasonCodes.push("row_filter_target_invalid");
      continue;
    }
    if (multiFilterGroup && !hasCanonicalFieldTarget(filter)) {
      reasonCodes.push("row_filter_target_invalid");
    }
    if (multiFilterGroup && !hasCanonicalValueContract(filter)) {
      reasonCodes.push("row_filter_value_missing");
    }
    reasonCodes.push(...evaluateBusinessSqlFilterCompatibility({ filter }).reasonCodes);
  }

  return {
    supportedCombinator: Boolean(combinator),
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
};
