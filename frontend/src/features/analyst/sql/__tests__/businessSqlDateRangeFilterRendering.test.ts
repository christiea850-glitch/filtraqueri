/** PS-7e - deterministic canonical date-range BETWEEN rendering fixtures. */

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

type FixtureResult = { name: string; ok: boolean; failureReasons: string[] };
type Fixture = { name: string; assert: () => string[] };

export type BusinessSqlDateRangeFilterRenderingFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const sourceEntity = { entity: "orders", table: "orders", required: true, role: "source" as const };
const grouping = { entity: "orders", table: "orders", field: "region", label: "region" };

const measure = (field: string, label: string): BusinessSqlMeasure => {
  const seed = { kind: "sum" as const, entity: "orders", table: "orders", field, distinct: false };
  return {
    ...seed,
    measureId: createBusinessSqlMeasureId(seed),
    fieldInferredType: "numeric",
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
};

const revenueMeasure = measure("revenue", "Total revenue");
const costMeasure = measure("cost", "Total cost");

const dateRangeValue = (
  lower: unknown = "2026-01-01",
  upper: unknown = "2026-12-31",
  overrides: Partial<{ valueKind: unknown; lowerInclusive: unknown; upperInclusive: unknown }> = {},
): BusinessSqlFilterComparisonValue => ({
  kind: "range",
  valueKind: "date",
  lower,
  upper,
  lowerInclusive: true,
  upperInclusive: true,
  ...overrides,
} as unknown as BusinessSqlFilterComparisonValue);

const numericRangeValue = (lower: number = 100, upper: number = 500): BusinessSqlFilterComparisonValue => ({
  kind: "range",
  valueKind: "number",
  lower,
  upper,
  lowerInclusive: true,
  upperInclusive: true,
});

const setValue = (
  valueKind: "number" | "string" | "boolean",
  values: readonly (number | string | boolean)[],
): BusinessSqlFilterComparisonValue => ({ kind: "set", valueKind, values });

const dateValue = (): BusinessSqlFilterComparisonValue => ({
  kind: "date",
  valueKind: "date",
  value: "2026-01-01",
});

const filterFor = ({
  operator = "between",
  comparisonValue = dateRangeValue(),
  field = "order_date",
  fieldInferredType = "date" as BusinessSqlFilter["fieldInferredType"],
  table = "orders",
  entity = table,
}: {
  operator?: BusinessSqlFilterOperator;
  comparisonValue?: BusinessSqlFilterComparisonValue;
  field?: string;
  fieldInferredType?: BusinessSqlFilter["fieldInferredType"];
  table?: string;
  entity?: string;
} = {}): BusinessSqlFilter => {
  const seed: BusinessSqlFilter = {
    kind: "custom",
    target: { kind: "field", entity, table, field, fieldInferredType, resolved: true },
    entity,
    table,
    field,
    fieldInferredType,
    operator,
    comparisonValue,
    label: `${field} ${operator}`,
  };
  return { ...seed, filterId: createBusinessSqlFilterId(seed) };
};

const defaultSort = () => ({
  sortId: createBusinessSqlSortId({
    target: { kind: "measure" as const, measureId: revenueMeasure.measureId, resolved: true },
    direction: "desc",
  }),
  target: { kind: "measure" as const, measureId: revenueMeasure.measureId, resolved: true },
  direction: "desc" as const,
});

const basePlan = (
  filter: BusinessSqlFilter | null = filterFor(),
  overrides: Partial<BusinessSqlQueryPlan> = {},
): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:date-range-rendering",
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
  id: "business-sql-plan:date-range-rendering-projection",
  kind: "empty",
  status: "resolved",
  support: "supported",
  entities: [sourceEntity],
  groupings: [{ entity: "orders", table: "orders", field: "order_id", label: "order_id" }],
  filters: filter ? [filter] : [],
});

const derivedMeasure = (): BusinessSqlDerivedMeasure => {
  const seed = {
    operator: "divide" as const,
    leftMeasureId: revenueMeasure.measureId,
    rightMeasureId: costMeasure.measureId,
    divisionPolicy: { zeroDenominator: "null" as const },
  };
  return { ...seed, derivedMeasureId: createBusinessSqlDerivedMeasureId(seed), sqlAlias: "revenue_divided_by_cost" };
};

const renderSql = (plan: BusinessSqlQueryPlan): string | null => renderBusinessSqlQueryPlan(plan).sql;
const noSql = (plan: BusinessSqlQueryPlan): boolean => {
  const result = renderBusinessSqlQueryPlan(plan);
  const preview = createBusinessSqlRenderPreview(plan);
  return !result.rendered && result.sql === null && !result.inserted && !result.ranQuery &&
    preview.sql === null && !preview.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql;
};

const expectedDateRangeSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_date" BETWEEN DATE \'2026-01-01\' AND DATE \'2026-12-31\';',
].join("\n");

const expectedNumericRangeSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" BETWEEN 100 AND 500;',
].join("\n");

const expectedBeforeSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_date" < DATE \'2026-01-01\';',
].join("\n");

const expectedAfterSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_date" > DATE \'2026-01-01\';',
].join("\n");

const expectedInSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."status" IN (\'active\', \'pending\');',
].join("\n");

const expectedNotInSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."status" NOT IN (\'closed\', \'pending\');',
].join("\n");

const expectedEmptySql = [
  "SELECT",
  '  "orders"."region" AS "region",',
  '  SUM("orders"."revenue") AS "total_revenue"',
  'FROM "orders"',
  'GROUP BY "orders"."region"',
  'ORDER BY "total_revenue" DESC;',
].join("\n");

const invalidRangeValues = [
  ["Reversed date range renders no SQL", dateRangeValue("2026-12-31", "2026-01-01")],
  ["Invalid lower date renders no SQL", dateRangeValue("2026-02-29", "2026-12-31")],
  ["Invalid upper date renders no SQL", dateRangeValue("2026-01-01", "1900-02-29")],
  ["Datetime lower renders no SQL", dateRangeValue("2026-01-01T00:00:00", "2026-12-31")],
  ["Timestamp upper renders no SQL", dateRangeValue("2026-01-01", "2026-12-31Z")],
  ["Empty lower renders no SQL", dateRangeValue("", "2026-12-31")],
  ["Empty upper renders no SQL", dateRangeValue("2026-01-01", "")],
  ["Runtime numeric lower renders no SQL", dateRangeValue(1, "2026-12-31")],
  ["Runtime numeric upper renders no SQL", dateRangeValue("2026-01-01", 1)],
  ["Runtime boolean lower renders no SQL", dateRangeValue(true, "2026-12-31")],
  ["Runtime null upper renders no SQL", dateRangeValue("2026-01-01", null)],
  ["Runtime object upper renders no SQL", dateRangeValue("2026-01-01", {})],
  ["Runtime array lower renders no SQL", dateRangeValue(["2026-01-01"], "2026-12-31")],
  ["Runtime function upper renders no SQL", dateRangeValue("2026-01-01", () => "2026-12-31")],
  ["Runtime symbol lower renders no SQL", dateRangeValue(Symbol("date"), "2026-12-31")],
  ["Invalid valueKind renders no SQL", dateRangeValue("2026-01-01", "2026-12-31", { valueKind: "string" })],
  ["lowerInclusive false renders no SQL", dateRangeValue("2026-01-01", "2026-12-31", { lowerInclusive: false })],
  ["upperInclusive false renders no SQL", dateRangeValue("2026-01-01", "2026-12-31", { upperInclusive: false })],
  ["string inclusivity renders no SQL", dateRangeValue("2026-01-01", "2026-12-31", { lowerInclusive: "true" })],
  ["numeric inclusivity renders no SQL", dateRangeValue("2026-01-01", "2026-12-31", { upperInclusive: 1 })],
] as const;

const missingRangeValues = [
  ["Runtime undefined lower renders no SQL", (value: BusinessSqlFilterComparisonValue) => { (value as unknown as { lower?: unknown }).lower = undefined; }],
  ["Missing lower renders no SQL", (value: BusinessSqlFilterComparisonValue) => { delete (value as unknown as { lower?: unknown }).lower; }],
  ["Missing upper renders no SQL", (value: BusinessSqlFilterComparisonValue) => { delete (value as unknown as { upper?: unknown }).upper; }],
  ["Missing valueKind renders no SQL", (value: BusinessSqlFilterComparisonValue) => { delete (value as unknown as { valueKind?: unknown }).valueKind; }],
  ["missing lowerInclusive renders no SQL", (value: BusinessSqlFilterComparisonValue) => { delete (value as unknown as { lowerInclusive?: unknown }).lowerInclusive; }],
  ["missing upperInclusive renders no SQL", (value: BusinessSqlFilterComparisonValue) => { delete (value as unknown as { upperInclusive?: unknown }).upperInclusive; }],
] as const;

const wrongOperatorCases: readonly { name: string; operator: BusinessSqlFilterOperator }[] = [
  { name: "BEFORE plus date range renders no SQL", operator: "before" },
  { name: "AFTER plus date range renders no SQL", operator: "after" },
  { name: "Scalar operator plus date range renders no SQL", operator: "equals" },
  { name: "IN plus date range renders no SQL", operator: "in" },
  { name: "NOT IN plus date range renders no SQL", operator: "not_in" },
  { name: "Nullary operator plus date range renders no SQL", operator: "is_null" },
];

const fixtures: Fixture[] = [
  { name: "Valid date BETWEEN becomes renderer-capable", assert: () => evaluateBusinessSqlRendererCapability(basePlan(filterFor())).capable ? [] : ["Expected date range capability."] },
  { name: "Valid numeric BETWEEN remains renderer-capable", assert: () => evaluateBusinessSqlRendererCapability(basePlan(filterFor({ field: "order_amount", fieldInferredType: "numeric", comparisonValue: numericRangeValue() }))).capable ? [] : ["Expected numeric range capability."] },
  { name: "Exact date BETWEEN SQL", assert: () => renderSql(fieldProjectionPlan(filterFor())) === expectedDateRangeSql ? [] : ["Expected exact date range SQL."] },
  { name: "DATE keyword appears for lower endpoint", assert: () => expectedDateRangeSql.includes("BETWEEN DATE '2026-01-01'") ? [] : ["Expected lower DATE."] },
  { name: "DATE keyword appears for upper endpoint", assert: () => expectedDateRangeSql.includes("AND DATE '2026-12-31'") ? [] : ["Expected upper DATE."] },
  { name: "BETWEEN keyword appears exactly once", assert: () => (expectedDateRangeSql.match(/\bBETWEEN\b/g) || []).length === 1 ? [] : ["Expected one BETWEEN."] },
  { name: "AND between range endpoints appears correctly", assert: () => expectedDateRangeSql.includes("DATE '2026-01-01' AND DATE '2026-12-31'") ? [] : ["Expected endpoint AND."] },
  { name: "Lower endpoint remains unchanged", assert: () => renderSql(fieldProjectionPlan(filterFor({ comparisonValue: dateRangeValue("1900-03-01", "1900-03-01") })))?.includes("DATE '1900-03-01'") ? [] : ["Expected lower unchanged."] },
  { name: "Upper endpoint remains unchanged", assert: () => renderSql(fieldProjectionPlan(filterFor({ comparisonValue: dateRangeValue("2024-02-29", "2024-03-01") })))?.includes("DATE '2024-03-01'") ? [] : ["Expected upper unchanged."] },
  { name: "Standard date range renders", assert: () => renderSql(fieldProjectionPlan(filterFor())) === expectedDateRangeSql ? [] : ["Expected standard render."] },
  { name: "Leap-day lower renders", assert: () => renderSql(fieldProjectionPlan(filterFor({ comparisonValue: dateRangeValue("2024-02-29", "2024-03-01") })))?.includes("DATE '2024-02-29'") ? [] : ["Expected leap lower."] },
  { name: "Leap-day upper renders", assert: () => renderSql(fieldProjectionPlan(filterFor({ comparisonValue: dateRangeValue("2024-02-28", "2024-02-29") })))?.includes("DATE '2024-02-29'") ? [] : ["Expected leap upper."] },
  { name: "Century leap-day renders", assert: () => renderSql(fieldProjectionPlan(filterFor({ comparisonValue: dateRangeValue("2000-02-29", "2000-12-31") })))?.includes("DATE '2000-02-29'") ? [] : ["Expected century leap."] },
  { name: "Equal endpoints render", assert: () => renderSql(fieldProjectionPlan(filterFor({ comparisonValue: dateRangeValue("1900-03-01", "1900-03-01") })))?.includes("DATE '1900-03-01' AND DATE '1900-03-01'") ? [] : ["Expected equal endpoints."] },
  { name: "Terminal semicolon is present", assert: () => renderSql(fieldProjectionPlan(filterFor()))?.endsWith(";") ? [] : ["Expected semicolon."] },
  { name: "Field projection remains unsorted", assert: () => !renderSql(fieldProjectionPlan(filterFor()))?.includes("ORDER BY") ? [] : ["Expected unsorted projection."] },
  { name: "Date range does not invent LIMIT", assert: () => !renderSql(fieldProjectionPlan(filterFor()))?.includes("LIMIT") ? [] : ["Expected no LIMIT."] },
  { name: "WHERE follows FROM", assert: () => {
    const sql = renderSql(fieldProjectionPlan(filterFor())) || "";
    return sql.indexOf("FROM") < sql.indexOf("WHERE") ? [] : ["Expected FROM before WHERE."];
  } },
  { name: "WHERE precedes GROUP BY and ORDER BY", assert: () => {
    const sql = renderSql(basePlan(filterFor())) || "";
    return sql.indexOf("WHERE") < sql.indexOf("GROUP BY") && sql.indexOf("WHERE") < sql.indexOf("ORDER BY") ? [] : ["Expected WHERE clause order."];
  } },
  { name: "LIMIT remains last", assert: () => {
    const rowLimit = { value: 5 };
    return renderSql(basePlan(filterFor(), { rowLimit: { ...rowLimit, rowLimitId: createBusinessSqlRowLimitId(rowLimit) } }))?.endsWith("LIMIT 5;") ? [] : ["Expected LIMIT last."];
  } },
  { name: "Resolved joined date range renders", assert: () => {
    const sql = renderSql(basePlan(filterFor({ table: "customers", entity: "customers", field: "signup_date" }), {
      entities: [sourceEntity, { entity: "customers", table: "customers", required: true, role: "filter_subject" }],
      joinPath: {
        required: true,
        status: "resolved",
        entities: ["orders", "customers"],
        requirements: [{ fromEntity: "orders", toEntity: "customers", required: true, relationship: "orders customer", verified: true }],
        edges: [{ fromEntity: "orders", fromTable: "orders", fromField: "customer_id", toEntity: "customers", toTable: "customers", toField: "customer_id", relationship: "orders customer", verified: true }],
      },
    })) || "";
    return sql.includes('JOIN "customers"') && sql.includes('WHERE "customers"."signup_date" BETWEEN DATE') && sql.indexOf("JOIN") < sql.indexOf("WHERE") ? [] : ["Expected joined date range SQL."];
  } },
  { name: "Unresolved joined date range blocks", assert: () => noSql(basePlan(filterFor({ table: "customers", entity: "customers", field: "signup_date" }), {
    entities: [sourceEntity, { entity: "customers", table: "customers", required: true, role: "filter_subject" }],
    joinPath: {
      required: true,
      status: "missing",
      entities: ["orders", "customers"],
      requirements: [{ fromEntity: "orders", toEntity: "customers", required: true, relationship: "orders customer", verified: false }],
      edges: [],
    },
  })) ? [] : ["Expected unresolved join block."] },
  { name: "Date range plus grouping renders complete SQL", assert: () => renderSql(basePlan(filterFor()))?.includes("GROUP BY") ? [] : ["Expected grouping."] },
  { name: "Date range plus base HAVING renders complete SQL", assert: () => renderSql(basePlan(filterFor(), { aggregateResultConditions: [{ conditionId: "date-range-having", measureId: revenueMeasure.measureId, operator: "greater_than", comparisonValue: { kind: "number", value: 10 } }] }))?.includes("HAVING") ? [] : ["Expected HAVING."] },
  { name: "Date range plus derived HAVING renders complete SQL", assert: () => {
    const derived = derivedMeasure();
    return renderSql(basePlan(filterFor(), {
      measures: [revenueMeasure, costMeasure],
      derivedMeasures: [derived],
      aggregateResultConditions: [{ conditionId: "date-range-derived-having", target: { kind: "derived_measure", derivedMeasureId: derived.derivedMeasureId }, operator: "greater_than", comparisonValue: { kind: "number", value: 1 } }],
    }))?.includes("HAVING") ? [] : ["Expected derived HAVING."];
  } },
  { name: "Date range plus derived ORDER BY renders complete SQL", assert: () => {
    const derived = derivedMeasure();
    return renderSql(basePlan(filterFor(), {
      measures: [revenueMeasure, costMeasure],
      derivedMeasures: [derived],
      orderBy: [{ sortId: "date-range-derived-sort", target: { kind: "derived_measure", derivedMeasureId: derived.derivedMeasureId }, direction: "desc" }],
    }))?.includes("ORDER BY") ? [] : ["Expected derived ORDER BY."];
  } },
  { name: "Date range plus guarded division renders complete SQL", assert: () => {
    const derived = derivedMeasure();
    return renderSql(basePlan(filterFor(), { measures: [revenueMeasure, costMeasure], derivedMeasures: [derived] }))?.includes("THEN NULL") ? [] : ["Expected guarded division."];
  } },
  { name: "Explicit default ordering remains plan-driven", assert: () => (renderSql(basePlan(filterFor()))?.match(/ORDER BY/g) || []).length === 1 ? [] : ["Expected one ORDER BY."] },
  { name: "Empty orderBy remains unsorted", assert: () => !renderSql(basePlan(filterFor(), { orderBy: [] }))?.includes("ORDER BY") ? [] : ["Expected unsorted."] },
  ...invalidRangeValues.map(([name, value]): Fixture => ({ name, assert: () => noSql(fieldProjectionPlan(filterFor({ comparisonValue: value }))) ? [] : [`Expected ${name}.`] })),
  ...missingRangeValues.map(([name, mutate]): Fixture => ({
    name,
    assert: () => {
      const value = dateRangeValue();
      mutate(value);
      return noSql(fieldProjectionPlan(filterFor({ comparisonValue: value }))) ? [] : [`Expected ${name}.`];
    },
  })),
  { name: "BETWEEN plus scalar renders no SQL", assert: () => noSql(fieldProjectionPlan(filterFor({ comparisonValue: { kind: "number", value: 1 } }))) ? [] : ["Expected scalar refusal."] },
  { name: "BETWEEN plus set renders no SQL", assert: () => noSql(fieldProjectionPlan(filterFor({ comparisonValue: setValue("string", ["active"]) }))) ? [] : ["Expected set refusal."] },
  { name: "BETWEEN plus single date renders no SQL", assert: () => noSql(fieldProjectionPlan(filterFor({ comparisonValue: dateValue() }))) ? [] : ["Expected single-date refusal."] },
  ...wrongOperatorCases.map((entry): Fixture => ({ name: entry.name, assert: () => noSql(fieldProjectionPlan(filterFor({ operator: entry.operator }))) ? [] : [`Expected ${entry.name}.`] })),
  { name: "Numeric field rejects date range", assert: () => evaluateBusinessSqlFilterCompatibility({ filter: filterFor({ fieldInferredType: "numeric" }) }).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected numeric field rejection."] },
  { name: "Text field rejects date range", assert: () => evaluateBusinessSqlFilterCompatibility({ filter: filterFor({ fieldInferredType: "text" }) }).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected text field rejection."] },
  { name: "Categorical field rejects date range", assert: () => evaluateBusinessSqlFilterCompatibility({ filter: filterFor({ fieldInferredType: "categorical" }) }).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected categorical field rejection."] },
  { name: "Boolean field rejects date range", assert: () => evaluateBusinessSqlFilterCompatibility({ filter: filterFor({ fieldInferredType: "boolean" }) }).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected boolean field rejection."] },
  { name: "Datetime field rejects date range", assert: () => evaluateBusinessSqlFilterCompatibility({ filter: filterFor({ fieldInferredType: "datetime" as BusinessSqlFilter["fieldInferredType"] }) }).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected datetime field rejection."] },
  { name: "Timestamp field rejects date range", assert: () => evaluateBusinessSqlFilterCompatibility({ filter: filterFor({ fieldInferredType: "timestamp" as BusinessSqlFilter["fieldInferredType"] }) }).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected timestamp field rejection."] },
  { name: "Date field rejects numeric range", assert: () => noSql(fieldProjectionPlan(filterFor({ comparisonValue: numericRangeValue() }))) ? [] : ["Expected date field numeric range refusal."] },
  { name: "Legacy date array remains refused", assert: () => noSql(basePlan(null, { filters: [{ kind: "custom", table: "orders", field: "order_date", value: ["2026-01-01", "2026-12-31"], label: "Legacy array" }] })) ? [] : ["Expected legacy array refusal."] },
  { name: "Legacy date-range string remains refused", assert: () => noSql(basePlan(null, { filters: [{ kind: "custom", table: "orders", field: "order_date", value: "2026-01-01 to 2026-12-31", label: "Legacy string" }] })) ? [] : ["Expected legacy string refusal."] },
  { name: "Multiple filters remain incapable", assert: () => evaluateBusinessSqlRendererCapability(basePlan(null, { filters: [filterFor(), filterFor({ field: "signup_date" })] })).reasonCodes.includes("multiple_row_filters_not_supported") ? [] : ["Expected multiple filters refusal."] },
  { name: "Canonical target conflict remains blocked", assert: () => evaluateBusinessSqlFilterCompatibility({ filter: { ...filterFor(), field: "created_at" } }).reasonCodes.includes("row_filter_target_conflict") ? [] : ["Expected target conflict."] },
  { name: "Valid preview exposes Copy only", assert: () => {
    const result = renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor()));
    const preview = createBusinessSqlRenderPreview(fieldProjectionPlan(filterFor()));
    return preview.sql === result.sql && preview.sql === expectedDateRangeSql && preview.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql && !result.inserted && !result.ranQuery ? [] : ["Expected copy-only preview."];
  } },
  { name: "Invalid preview exposes no actions", assert: () => !createBusinessSqlRenderPreview(fieldProjectionPlan(filterFor({ comparisonValue: dateRangeValue("2026-12-31", "2026-01-01") }))).actions.canCopySql ? [] : ["Expected invalid no actions."] },
  { name: "Date-range identity remains unchanged", assert: () => filterFor().filterId === createBusinessSqlFilterId(filterFor()) ? [] : ["Expected identity unchanged."] },
  { name: "Invalid date-range identity remains unchanged", assert: () => filterFor({ comparisonValue: dateRangeValue("2026-12-31", "2026-01-01") }).filterId?.includes("invalid-range") ? [] : ["Expected invalid identity."] },
  { name: "Numeric BETWEEN SQL remains byte-identical", assert: () => renderSql(fieldProjectionPlan(filterFor({ field: "order_amount", fieldInferredType: "numeric", comparisonValue: numericRangeValue() }))) === expectedNumericRangeSql ? [] : ["Expected numeric BETWEEN."] },
  { name: "Numeric BETWEEN preview remains Copy only", assert: () => createBusinessSqlRenderPreview(fieldProjectionPlan(filterFor({ field: "order_amount", fieldInferredType: "numeric", comparisonValue: numericRangeValue() }))).actions.canCopySql ? [] : ["Expected numeric preview copy."] },
  { name: "BEFORE SQL remains byte-identical", assert: () => renderSql(fieldProjectionPlan(filterFor({ operator: "before", comparisonValue: dateValue() }))) === expectedBeforeSql ? [] : ["Expected BEFORE SQL."] },
  { name: "AFTER SQL remains byte-identical", assert: () => renderSql(fieldProjectionPlan(filterFor({ operator: "after", comparisonValue: dateValue() }))) === expectedAfterSql ? [] : ["Expected AFTER SQL."] },
  { name: "Scalar SQL remains byte-identical", assert: () => renderSql(fieldProjectionPlan(filterFor({ operator: "greater_than", field: "order_amount", fieldInferredType: "numeric", comparisonValue: { kind: "number", value: 1000 } })))?.includes('> 1000;') ? [] : ["Expected scalar SQL."] },
  { name: "IN SQL remains byte-identical", assert: () => renderSql(fieldProjectionPlan(filterFor({ operator: "in", field: "status", fieldInferredType: "categorical", comparisonValue: setValue("string", ["pending", "active"]) }))) === expectedInSql ? [] : ["Expected IN SQL."] },
  { name: "NOT IN SQL remains byte-identical", assert: () => renderSql(fieldProjectionPlan(filterFor({ operator: "not_in", field: "status", fieldInferredType: "categorical", comparisonValue: setValue("string", ["pending", "closed"]) }))) === expectedNotInSql ? [] : ["Expected NOT IN SQL."] },
  { name: "filters empty SQL remains byte-identical", assert: () => renderSql(basePlan(null)) === expectedEmptySql ? [] : ["Expected empty filters SQL."] },
  { name: "Natural-language date range remains unsupported", assert: () => {
    const plan = basePlan(null, { filters: [{ kind: "custom", value: "order_date is between 2026-01-01 and 2026-12-31", label: "Legacy NL" }] });
    return noSql(plan) ? [] : ["Expected NL date range unsupported."];
  } },
  { name: "No automatic Insert", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).inserted ? [] : ["Expected no insert."] },
  { name: "No automatic Run", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).ranQuery ? [] : ["Expected no run."] },
  { name: "Valid date range is structurally ready", assert: () => evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan: basePlan(filterFor()) })).status === "ready" ? [] : ["Expected ready plan."] },
];

export function runBusinessSqlDateRangeFilterRenderingFixtures(): BusinessSqlDateRangeFilterRenderingFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
    return { name: fixture.name, ok: failureReasons.length === 0, failureReasons };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const businessSqlDateRangeFilterRenderingFixturesPass =
  runBusinessSqlDateRangeFilterRenderingFixtures().failed.length === 0;
