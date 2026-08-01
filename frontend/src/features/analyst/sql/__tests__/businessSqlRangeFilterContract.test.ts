/** PS-6c - canonical numeric BETWEEN row-filter contract fixtures. */

import {
  createBusinessSqlDerivedMeasureId,
  createBusinessSqlFilterId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlRowLimitId,
  createBusinessSqlSortId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlDerivedMeasure,
  type BusinessSqlFilter,
  type BusinessSqlFilterComparisonValue,
  type BusinessSqlFilterOperator,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import { evaluateBusinessSqlFilterCompatibility } from "../businessSqlFilterCompatibility";
import { evaluateBusinessSqlPlanReadiness } from "../businessSqlPlanReadiness";
import { evaluateBusinessSqlRendererCapability } from "../businessSqlRendererCapability";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import { renderBusinessSqlQueryPlan } from "../businessSqlRenderer";
import { attachBusinessSqlJoinResolutionToPlan } from "../businessSqlQueryPlanJoinResolution";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

export type BusinessSqlRangeFilterContractFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const sourceEntity = {
  entity: "orders",
  table: "orders",
  required: true,
  role: "source" as const,
};

const grouping = {
  entity: "orders",
  table: "orders",
  field: "region",
  label: "region",
};

const measure = ({
  table = "orders",
  field,
  label,
  kind = "sum" as const,
}: {
  table?: string;
  field?: string;
  label: string;
  kind?: BusinessSqlMeasure["kind"];
}): BusinessSqlMeasure => {
  const seed = {
    kind,
    entity: table,
    table,
    field,
    distinct: false,
  };
  return {
    ...seed,
    measureId: createBusinessSqlMeasureId(seed),
    fieldInferredType: field ? "numeric" : undefined,
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
};

const revenueMeasure = measure({ field: "revenue", label: "Total revenue" });
const costMeasure = measure({ field: "cost", label: "Total cost" });

const defaultSort = () => ({
  sortId: createBusinessSqlSortId({
    target: { kind: "measure" as const, measureId: revenueMeasure.measureId, resolved: true },
    direction: "desc",
  }),
  target: { kind: "measure" as const, measureId: revenueMeasure.measureId, resolved: true },
  direction: "desc" as const,
});

const rangeValue = (lower: unknown, upper: unknown): BusinessSqlFilterComparisonValue => ({
  kind: "range",
  valueKind: "number",
  lower,
  upper,
  lowerInclusive: true,
  upperInclusive: true,
} as unknown as BusinessSqlFilterComparisonValue);

const setValue = (
  valueKind: "number" | "string" | "boolean",
  values: readonly (number | string | boolean)[],
): BusinessSqlFilterComparisonValue => ({
  kind: "set",
  valueKind,
  values,
});

const filterFor = ({
  operator = "between",
  field = "order_amount",
  fieldInferredType = "numeric" as BusinessSqlFilter["fieldInferredType"],
  comparisonValue = rangeValue(100, 500),
  table = "orders",
  entity = table,
}: {
  operator?: BusinessSqlFilterOperator;
  field?: string;
  fieldInferredType?: BusinessSqlFilter["fieldInferredType"];
  comparisonValue?: BusinessSqlFilterComparisonValue;
  table?: string;
  entity?: string;
} = {}): BusinessSqlFilter => {
  const seed: BusinessSqlFilter = {
    kind: "custom",
    target: {
      kind: "field",
      entity,
      table,
      field,
      fieldInferredType,
      resolved: true,
    },
    entity,
    table,
    field,
    fieldInferredType,
    operator,
    comparisonValue,
    label: `${field} ${operator}`,
  };
  return {
    ...seed,
    filterId: createBusinessSqlFilterId(seed),
  };
};

const basePlan = (
  filter: BusinessSqlFilter | null = filterFor(),
  overrides: Partial<BusinessSqlQueryPlan> = {},
): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:range-filter-contract",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [sourceEntity],
  metric: null,
  measures: [revenueMeasure],
  groupings: [grouping],
  filters: filter ? [filter] : [],
  orderBy: [defaultSort()],
  ...overrides,
});

const fieldProjectionPlan = (filter: BusinessSqlFilter | null): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:range-filter-field-projection",
  kind: "empty",
  status: "resolved",
  support: "supported",
  entities: [sourceEntity],
  groupings: [{ entity: "orders", table: "orders", field: "order_id", label: "order_id" }],
  filters: filter ? [filter] : [],
});

const derivedMeasure = (): BusinessSqlDerivedMeasure => {
  const seed = {
    operator: "subtract" as const,
    leftMeasureId: revenueMeasure.measureId,
    rightMeasureId: costMeasure.measureId,
  };
  return {
    ...seed,
    derivedMeasureId: createBusinessSqlDerivedMeasureId(seed),
    sqlAlias: "revenue_minus_cost",
  };
};

const derivedConditionPlan = (filter: BusinessSqlFilter): BusinessSqlQueryPlan => {
  const derived = derivedMeasure();
  return basePlan(filter, {
    measures: [revenueMeasure, costMeasure],
    derivedMeasures: [derived],
    aggregateResultConditions: [{
      conditionId: "business-sql-aggregate-condition:range-derived",
      target: { kind: "derived_measure", derivedMeasureId: derived.derivedMeasureId },
      operator: "greater_than",
      comparisonValue: { kind: "number", value: 10 },
    }],
    orderBy: [{
      sortId: createBusinessSqlSortId({
        target: { kind: "derived_measure", derivedMeasureId: derived.derivedMeasureId },
        direction: "desc",
      }),
      target: { kind: "derived_measure", derivedMeasureId: derived.derivedMeasureId },
      direction: "desc",
    }],
  });
};

const readinessFor = (plan: BusinessSqlQueryPlan) =>
  evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

const compatibilityFor = (filter: BusinessSqlFilter) =>
  evaluateBusinessSqlFilterCompatibility({ filter });

const noSqlAndNoActions = (plan: BusinessSqlQueryPlan): boolean => {
  const rendered = renderBusinessSqlQueryPlan(plan);
  const preview = createBusinessSqlRenderPreview(plan);
  return !rendered.rendered &&
    rendered.sql === null &&
    rendered.inserted === false &&
    rendered.ranQuery === false &&
    preview.sql === null &&
    !preview.actions.canCopySql &&
    !preview.actions.canInsertSql &&
    !preview.actions.canRunSql;
};

const expectedScalarSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" > 1000;',
].join("\n");

const expectedTextInSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."status" IN (\'active\', \'pending\');',
].join("\n");

const expectedTextNotInSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."priority" NOT IN (\'cancelled\', \'closed\');',
].join("\n");

const expectedEmptySql = [
  "SELECT",
  '  "orders"."region" AS "region",',
  '  SUM("orders"."revenue") AS "total_revenue"',
  'FROM "orders"',
  'GROUP BY "orders"."region"',
  'ORDER BY "total_revenue" DESC;',
].join("\n");

const expectedEmptyUnsortedSql = [
  "SELECT",
  '  "orders"."region" AS "region",',
  '  SUM("orders"."revenue") AS "total_revenue"',
  'FROM "orders"',
  'GROUP BY "orders"."region";',
].join("\n");

const validRangeFilter = () => filterFor();

const withoutFieldType = (): BusinessSqlFilter => {
  const filter = filterFor();
  const target = filter.target?.kind === "field"
    ? { ...filter.target, fieldInferredType: undefined }
    : filter.target;
  return {
    ...filter,
    target,
    fieldInferredType: undefined,
  };
};

const fixtures: Fixture[] = [
  { name: "numeric range contract is representable", assert: () => rangeValue(1, 10).kind === "range" ? [] : ["Expected range value."] },
  { name: "lower less than upper is valid", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(1, 10) })).compatible ? [] : ["Expected lower < upper range."] },
  { name: "equal endpoints are valid", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(10, 10) })).compatible ? [] : ["Expected equal endpoints."] },
  { name: "negative endpoints are valid", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(-10, -1) })).compatible ? [] : ["Expected negative endpoints."] },
  { name: "decimal endpoints are valid", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(1.5, 10.25) })).compatible ? [] : ["Expected decimal endpoints."] },
  { name: "lower greater than upper is invalid", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(500, 100) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected reversed range invalid."] },
  { name: "NaN lower is invalid", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(Number.NaN, 10) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected NaN lower invalid."] },
  { name: "NaN upper is invalid", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(1, Number.NaN) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected NaN upper invalid."] },
  { name: "positive Infinity is invalid", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(1, Number.POSITIVE_INFINITY) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected positive infinity invalid."] },
  { name: "negative Infinity is invalid", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(Number.NEGATIVE_INFINITY, 10) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected negative infinity invalid."] },
  { name: "string endpoint is invalid at runtime", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue("1", 10) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected string endpoint invalid."] },
  { name: "boolean endpoint is invalid at runtime", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(true, 10) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected boolean endpoint invalid."] },
  { name: "null endpoint is invalid at runtime", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(null, 10) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected null endpoint invalid."] },
  { name: "undefined endpoint is invalid at runtime", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue(undefined, 10) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected undefined endpoint invalid."] },
  { name: "object endpoint is invalid at runtime", assert: () => compatibilityFor(filterFor({ comparisonValue: rangeValue({}, 10) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected object endpoint invalid."] },
  { name: "BETWEEN requires a range value", assert: () => compatibilityFor({ ...filterFor(), comparisonValue: undefined }).reasonCodes.includes("row_filter_value_missing") ? [] : ["Expected missing range."] },
  { name: "BETWEEN rejects scalar value", assert: () => compatibilityFor(filterFor({ comparisonValue: { kind: "number", value: 100 } })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected scalar rejection."] },
  { name: "BETWEEN rejects set value", assert: () => compatibilityFor(filterFor({ comparisonValue: setValue("number", [1, 10]) })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected set rejection."] },
  { name: "scalar operator rejects range value", assert: () => compatibilityFor(filterFor({ operator: "greater_than" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected scalar operator range rejection."] },
  { name: "IN rejects range value", assert: () => compatibilityFor(filterFor({ operator: "in" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected IN range rejection."] },
  { name: "NOT IN rejects range value", assert: () => compatibilityFor(filterFor({ operator: "not_in" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected NOT IN range rejection."] },
  { name: "nullary operator rejects range value", assert: () => compatibilityFor(filterFor({ operator: "is_null" })).reasonCodes.includes("row_filter_value_not_allowed") ? [] : ["Expected nullary range rejection."] },
  { name: "numeric field accepts numeric range", assert: () => compatibilityFor(filterFor({ fieldInferredType: "numeric" })).compatible ? [] : ["Expected numeric field acceptance."] },
  { name: "text field rejects numeric range", assert: () => compatibilityFor(filterFor({ field: "description", fieldInferredType: "text" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected text rejection."] },
  { name: "categorical field rejects numeric range", assert: () => compatibilityFor(filterFor({ field: "status", fieldInferredType: "categorical" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected categorical rejection."] },
  { name: "boolean field rejects numeric range", assert: () => compatibilityFor(filterFor({ field: "enabled", fieldInferredType: "boolean" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected boolean rejection."] },
  { name: "date field rejects numeric range", assert: () => compatibilityFor(filterFor({ field: "created_at", fieldInferredType: "date" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected date rejection."] },
  { name: "unknown field type rejects numeric range", assert: () => compatibilityFor(withoutFieldType()).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected unknown rejection."] },
  { name: "valid BETWEEN is structurally ready", assert: () => readinessFor(basePlan(validRangeFilter())).status === "ready" ? [] : ["Expected ready range plan."] },
  { name: "valid BETWEEN is renderer-incapable with precise reason", assert: () => evaluateBusinessSqlRendererCapability(basePlan(validRangeFilter())).reasonCodes.includes("row_filter_range_rendering_not_supported") ? [] : ["Expected range rendering limitation."] },
  { name: "invalid range is structurally blocked", assert: () => readinessFor(basePlan(filterFor({ comparisonValue: rangeValue(10, 1) }))).status === "blocked" ? [] : ["Expected invalid range blocked."] },
  { name: "multiple filters remain incapable", assert: () => evaluateBusinessSqlRendererCapability(basePlan(validRangeFilter(), { filters: [validRangeFilter(), filterFor({ field: "discount" })] })).reasonCodes.includes("multiple_row_filters_not_supported") ? [] : ["Expected multiple filter refusal."] },
  { name: "renderer emits no BETWEEN SQL", assert: () => {
    const result = renderBusinessSqlQueryPlan(fieldProjectionPlan(validRangeFilter()));
    return !result.sql && !String(result.sql || "").includes("BETWEEN") ? [] : ["Expected no BETWEEN SQL."];
  } },
  { name: "preview exposes no actions", assert: () => {
    const preview = createBusinessSqlRenderPreview(fieldProjectionPlan(validRangeFilter()));
    return !preview.sql && !preview.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql ? [] : ["Expected preview no actions."];
  } },
  { name: "BETWEEN plus grouping emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(validRangeFilter())) ? [] : ["Expected grouping no SQL."] },
  { name: "BETWEEN plus HAVING emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(validRangeFilter(), { aggregateResultConditions: [{ conditionId: "range-having", measureId: revenueMeasure.measureId, operator: "greater_than", comparisonValue: { kind: "number", value: 10 } }] })) ? [] : ["Expected HAVING no SQL."] },
  { name: "BETWEEN plus derived HAVING emits no partial SQL", assert: () => noSqlAndNoActions(derivedConditionPlan(validRangeFilter())) ? [] : ["Expected derived HAVING no SQL."] },
  { name: "BETWEEN plus ORDER BY emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(validRangeFilter(), { orderBy: [defaultSort()] })) ? [] : ["Expected ORDER BY no SQL."] },
  { name: "BETWEEN plus rowLimit emits no partial SQL", assert: () => {
    const rowLimit = { value: 5 };
    return noSqlAndNoActions(basePlan(validRangeFilter(), { rowLimit: { ...rowLimit, rowLimitId: createBusinessSqlRowLimitId(rowLimit) } })) ? [] : ["Expected row limit no SQL."];
  } },
  { name: "BETWEEN plus resolved join emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(filterFor({ table: "customers", entity: "customers" }), {
    entities: [sourceEntity, { entity: "customers", table: "customers", required: true, role: "filter_subject" }],
    joinPath: {
      required: true,
      status: "resolved",
      entities: ["orders", "customers"],
      requirements: [{ fromEntity: "orders", toEntity: "customers", required: true, relationship: "orders customer", verified: true }],
      edges: [{ fromEntity: "orders", fromTable: "orders", fromField: "customer_id", toEntity: "customers", toTable: "customers", toField: "customer_id", relationship: "orders customer", verified: true }],
    },
  })) ? [] : ["Expected joined range no SQL."] },
  { name: "identical ranges share filterId", assert: () => filterFor({ comparisonValue: rangeValue(1, 10) }).filterId === filterFor({ comparisonValue: rangeValue(1, 10) }).filterId ? [] : ["Expected identical range IDs."] },
  { name: "changing lower changes filterId", assert: () => filterFor({ comparisonValue: rangeValue(1, 10) }).filterId !== filterFor({ comparisonValue: rangeValue(2, 10) }).filterId ? [] : ["Expected lower to change ID."] },
  { name: "changing upper changes filterId", assert: () => filterFor({ comparisonValue: rangeValue(1, 10) }).filterId !== filterFor({ comparisonValue: rangeValue(1, 11) }).filterId ? [] : ["Expected upper to change ID."] },
  { name: "changing field changes filterId", assert: () => filterFor({ field: "order_amount" }).filterId !== filterFor({ field: "discount" }).filterId ? [] : ["Expected field to change ID."] },
  { name: "relabeling does not change filterId", assert: () => {
    const first = filterFor();
    const relabeled: BusinessSqlFilter = { ...first, label: "Other", evidence: "Other" };
    return first.filterId === createBusinessSqlFilterId(relabeled) ? [] : ["Expected relabel identity neutrality."];
  } },
  { name: "malformed range ID differs from valid range ID", assert: () => filterFor({ comparisonValue: rangeValue(1, 10) }).filterId !== filterFor({ comparisonValue: rangeValue(1, Number.NaN) }).filterId ? [] : ["Expected malformed ID hardening."] },
  { name: "reversed range gets invalid-range identity", assert: () => filterFor({ comparisonValue: rangeValue(1, 10) }).filterId !== filterFor({ comparisonValue: rangeValue(20, 10) }).filterId ? [] : ["Expected reversed invalid identity."] },
  { name: "range identity differs from set identity", assert: () => filterFor({ comparisonValue: rangeValue(1, 10) }).filterId !== filterFor({ operator: "in", comparisonValue: setValue("number", [1, 10]) }).filterId ? [] : ["Expected range/set identity distinction."] },
  { name: "range identity differs from scalar identity", assert: () => filterFor({ comparisonValue: rangeValue(1, 10) }).filterId !== filterFor({ operator: "greater_than", comparisonValue: { kind: "number", value: 1 } }).filterId ? [] : ["Expected range/scalar identity distinction."] },
  { name: "legacy text and array values remain non-canonical", assert: () => {
    const text: BusinessSqlFilter = { kind: "custom", table: "orders", field: "order_amount", value: "100 to 500", label: "Legacy text" };
    const array: BusinessSqlFilter = { kind: "custom", table: "orders", field: "order_amount", value: ["100", "500"], label: "Legacy array" };
    return !renderBusinessSqlQueryPlan(basePlan(null, { filters: [text] })).rendered &&
      !renderBusinessSqlQueryPlan(basePlan(null, { filters: [array] })).rendered
      ? []
      : ["Expected legacy filters non-renderable."];
  } },
  { name: "canonical legacy target conflict remains blocked", assert: () => compatibilityFor({ ...validRangeFilter(), field: "discount" }).reasonCodes.includes("row_filter_target_conflict") ? [] : ["Expected target conflict."] },
  { name: "existing scalar WHERE SQL remains byte-identical", assert: () => {
    const scalar = filterFor({ operator: "greater_than", comparisonValue: { kind: "number", value: 1000 } });
    const contains = renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ field: "status", fieldInferredType: "categorical", operator: "contains", comparisonValue: { kind: "string", value: "active" } }))).sql;
    const starts = renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ field: "status", fieldInferredType: "categorical", operator: "starts_with", comparisonValue: { kind: "string", value: "act" } }))).sql;
    const ends = renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ field: "status", fieldInferredType: "categorical", operator: "ends_with", comparisonValue: { kind: "string", value: "ive" } }))).sql;
    const nullSql = renderBusinessSqlQueryPlan(fieldProjectionPlan({ ...filterFor({ operator: "is_null" }), comparisonValue: undefined })).sql;
    const notNullSql = renderBusinessSqlQueryPlan(fieldProjectionPlan({ ...filterFor({ operator: "is_not_null" }), comparisonValue: undefined })).sql;
    return [
      ...(renderBusinessSqlQueryPlan(fieldProjectionPlan(scalar)).sql === expectedScalarSql ? [] : ["Expected numeric scalar SQL."]),
      ...(contains?.includes('WHERE contains("orders"."status", \'active\');') ? [] : ["Expected contains SQL."]),
      ...(starts?.includes('WHERE starts_with("orders"."status", \'act\');') ? [] : ["Expected starts_with SQL."]),
      ...(ends?.includes('WHERE ends_with("orders"."status", \'ive\');') ? [] : ["Expected ends_with SQL."]),
      ...(nullSql?.includes('WHERE "orders"."order_amount" IS NULL;') ? [] : ["Expected IS NULL SQL."]),
      ...(notNullSql?.includes('WHERE "orders"."order_amount" IS NOT NULL;') ? [] : ["Expected IS NOT NULL SQL."]),
    ];
  } },
  { name: "existing IN and NOT IN SQL remains byte-identical", assert: () => {
    const textIn = filterFor({ field: "status", fieldInferredType: "categorical", operator: "in", comparisonValue: setValue("string", ["pending", "active"]) });
    const textNotIn = filterFor({ field: "priority", fieldInferredType: "categorical", operator: "not_in", comparisonValue: setValue("string", ["closed", "cancelled"]) });
    const numberIn = renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "in", comparisonValue: setValue("number", [10, 1]) }))).sql;
    const boolNotIn = renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ field: "enabled", fieldInferredType: "boolean", operator: "not_in", comparisonValue: setValue("boolean", [true, false]) }))).sql;
    return [
      ...(renderBusinessSqlQueryPlan(fieldProjectionPlan(textIn)).sql === expectedTextInSql ? [] : ["Expected text IN SQL."]),
      ...(renderBusinessSqlQueryPlan(fieldProjectionPlan(textNotIn)).sql === expectedTextNotInSql ? [] : ["Expected text NOT IN SQL."]),
      ...(numberIn?.includes('WHERE "orders"."order_amount" IN (1, 10);') ? [] : ["Expected numeric IN SQL."]),
      ...(boolNotIn?.includes('WHERE "orders"."enabled" NOT IN (FALSE, TRUE);') ? [] : ["Expected boolean NOT IN SQL."]),
    ];
  } },
  { name: "filters empty SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(basePlan(null)).sql === expectedEmptySql ? [] : ["Expected filters empty SQL."] },
  { name: "explicit default aggregate ordering remains plan-driven", assert: () => {
    const plan = basePlan(null);
    return plan.orderBy.length === 1 && plan.assumptions.length === 0 && renderBusinessSqlQueryPlan(plan).sql === expectedEmptySql ? [] : ["Expected explicit order metadata."]; 
  } },
  { name: "empty orderBy remains unsorted", assert: () => renderBusinessSqlQueryPlan(basePlan(null, { orderBy: [] })).sql === expectedEmptyUnsortedSql ? [] : ["Expected no ORDER BY."] },
  { name: "no automatic Insert", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(validRangeFilter())).inserted ? [] : ["Expected no insert."] },
  { name: "no automatic Run", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(validRangeFilter())).ranQuery ? [] : ["Expected no run."] },
];

export function runBusinessSqlRangeFilterContractFixtures(): BusinessSqlRangeFilterContractFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const businessSqlRangeFilterContractFixturesPass =
  runBusinessSqlRangeFilterContractFixtures().failed.length === 0;
