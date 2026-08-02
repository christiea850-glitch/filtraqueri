/** PS-7b - deterministic BEFORE/AFTER date row-filter rendering fixtures. */

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

export type BusinessSqlDateFilterRenderingFixtureReport = {
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

const dateValue = (
  value: unknown,
  valueKind: unknown = "date",
): BusinessSqlFilterComparisonValue => ({
  kind: "date",
  valueKind,
  value,
} as unknown as BusinessSqlFilterComparisonValue);

const setValue = (
  valueKind: "number" | "string" | "boolean",
  values: readonly (number | string | boolean)[],
): BusinessSqlFilterComparisonValue => ({
  kind: "set",
  valueKind,
  values,
});

const rangeValue = (lower: number, upper: number): BusinessSqlFilterComparisonValue => ({
  kind: "range",
  valueKind: "number",
  lower,
  upper,
  lowerInclusive: true,
  upperInclusive: true,
});

const filterFor = ({
  operator = "before",
  comparisonValue = dateValue("2026-01-01"),
  field = "order_date",
  fieldInferredType = "date" as BusinessSqlFilter["fieldInferredType"],
  table = "orders",
  entity = table,
  targetResolved = true,
}: {
  operator?: BusinessSqlFilterOperator;
  comparisonValue?: BusinessSqlFilterComparisonValue;
  field?: string;
  fieldInferredType?: BusinessSqlFilter["fieldInferredType"];
  table?: string;
  entity?: string;
  targetResolved?: boolean;
} = {}): BusinessSqlFilter => {
  const seed: BusinessSqlFilter = {
    kind: "custom",
    target: {
      kind: "field",
      entity,
      table,
      field,
      fieldInferredType,
      resolved: targetResolved,
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
  id: "business-sql-plan:date-filter-rendering",
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
  id: "business-sql-plan:date-filter-rendering-projection",
  kind: "empty",
  status: "resolved",
  support: "supported",
  entities: [sourceEntity],
  groupings: [{ entity: "orders", table: "orders", field: "order_id", label: "order_id" }],
  filters: filter ? [filter] : [],
});

const derivedMeasure = (divisionPolicy?: BusinessSqlDerivedMeasure["divisionPolicy"]): BusinessSqlDerivedMeasure => {
  const seed = {
    operator: "divide" as const,
    leftMeasureId: revenueMeasure.measureId,
    rightMeasureId: costMeasure.measureId,
    divisionPolicy,
  };
  return {
    ...seed,
    derivedMeasureId: createBusinessSqlDerivedMeasureId(seed),
    sqlAlias: "revenue_divided_by_cost",
  };
};

const noSqlAndNoActions = (plan: BusinessSqlQueryPlan): boolean => {
  const result = renderBusinessSqlQueryPlan(plan);
  const preview = createBusinessSqlRenderPreview(plan);
  return !result.rendered &&
    result.sql === null &&
    result.inserted === false &&
    result.ranQuery === false &&
    preview.sql === null &&
    !preview.actions.canCopySql &&
    !preview.actions.canInsertSql &&
    !preview.actions.canRunSql;
};

const readinessFor = (plan: BusinessSqlQueryPlan) =>
  evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

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

const expectedBetweenSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" BETWEEN 100 AND 500;',
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

const clauseOrder = (sql: string, left: string, right: string): boolean =>
  sql.indexOf(left) >= 0 && sql.indexOf(right) >= 0 && sql.indexOf(left) < sql.indexOf(right);

const malformedDates = [
  "2026-2-01",
  "2026-02-1",
  "2026/02/01",
  "02/01/2026",
  "2026-00-01",
  "2026-13-01",
  "2026-01-00",
  "2026-01-32",
  "2026-04-31",
  "2026-02-29",
  "1900-02-29",
  "2026-02-30",
  "2026-01-01T00:00:00",
  "2026-01-01Z",
  "2026-01-01 12:00",
  "",
  "   ",
  "2026-01-01\n",
  "2026-01-01' OR 1=1 --",
] as const;

const runtimeMalformedValues = [
  { name: "number", value: 20260101 },
  { name: "boolean", value: true },
  { name: "null", value: null },
  { name: "undefined", value: undefined },
  { name: "object", value: { value: "2026-01-01" } },
  { name: "array", value: ["2026-01-01"] },
  { name: "function", value: () => "2026-01-01" },
  { name: "symbol", value: Symbol("date") },
] as const;

const operatorValueDefenseCases: readonly { name: string; filter: BusinessSqlFilter }[] = [
  { name: "BEFORE plus scalar string renders no SQL", filter: filterFor({ operator: "before", comparisonValue: { kind: "string", value: "2026-01-01" } }) },
  { name: "BEFORE plus scalar number renders no SQL", filter: filterFor({ operator: "before", comparisonValue: { kind: "number", value: 1 } }) },
  { name: "BEFORE plus scalar boolean renders no SQL", filter: filterFor({ operator: "before", comparisonValue: { kind: "boolean", value: true } }) },
  { name: "BEFORE plus set renders no SQL", filter: filterFor({ operator: "before", comparisonValue: setValue("string", ["2026-01-01"]) }) },
  { name: "BEFORE plus range renders no SQL", filter: filterFor({ operator: "before", comparisonValue: rangeValue(1, 10) }) },
  { name: "AFTER plus scalar string renders no SQL", filter: filterFor({ operator: "after", comparisonValue: { kind: "string", value: "2026-01-01" } }) },
  { name: "AFTER plus scalar number renders no SQL", filter: filterFor({ operator: "after", comparisonValue: { kind: "number", value: 1 } }) },
  { name: "AFTER plus scalar boolean renders no SQL", filter: filterFor({ operator: "after", comparisonValue: { kind: "boolean", value: true } }) },
  { name: "AFTER plus set renders no SQL", filter: filterFor({ operator: "after", comparisonValue: setValue("string", ["2026-01-01"]) }) },
  { name: "AFTER plus range renders no SQL", filter: filterFor({ operator: "after", comparisonValue: rangeValue(1, 10) }) },
  { name: "Scalar operator plus date renders no SQL", filter: filterFor({ operator: "equals" }) },
  { name: "NOT EQUALS plus date renders no SQL", filter: filterFor({ operator: "not_equals" }) },
  { name: "GREATER THAN plus date renders no SQL", filter: filterFor({ operator: "greater_than" }) },
  { name: "LESS THAN plus date renders no SQL", filter: filterFor({ operator: "less_than" }) },
  { name: "CONTAINS plus date renders no SQL", filter: filterFor({ operator: "contains" }) },
  { name: "IN plus date renders no SQL", filter: filterFor({ operator: "in" }) },
  { name: "NOT IN plus date renders no SQL", filter: filterFor({ operator: "not_in" }) },
  { name: "BETWEEN plus date renders no SQL", filter: filterFor({ operator: "between" }) },
  { name: "IS NULL plus date renders no SQL", filter: filterFor({ operator: "is_null" }) },
  { name: "IS NOT NULL plus date renders no SQL", filter: filterFor({ operator: "is_not_null" }) },
];

const fieldTypeCases: readonly {
  name: string;
  fieldInferredType: BusinessSqlFilter["fieldInferredType"];
}[] = [
  { name: "Numeric field rejects date filter", fieldInferredType: "numeric" },
  { name: "Text field rejects date filter", fieldInferredType: "text" },
  { name: "Categorical field rejects date filter", fieldInferredType: "categorical" },
  { name: "Boolean field rejects date filter", fieldInferredType: "boolean" },
  { name: "Datetime field rejects date filter", fieldInferredType: "datetime" as unknown as BusinessSqlFilter["fieldInferredType"] },
  { name: "Timestamp field rejects date filter", fieldInferredType: "timestamp" as unknown as BusinessSqlFilter["fieldInferredType"] },
];

const fixtures: Fixture[] = [
  { name: "BEFORE becomes renderer-capable", assert: () => evaluateBusinessSqlRendererCapability(basePlan(filterFor({ operator: "before" }))).capable ? [] : ["Expected BEFORE capability."] },
  { name: "AFTER becomes renderer-capable", assert: () => evaluateBusinessSqlRendererCapability(basePlan(filterFor({ operator: "after" }))).capable ? [] : ["Expected AFTER capability."] },
  { name: "BEFORE exact SQL", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "before" }))).sql === expectedBeforeSql ? [] : ["Expected exact BEFORE SQL."] },
  { name: "AFTER exact SQL", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "after" }))).sql === expectedAfterSql ? [] : ["Expected exact AFTER SQL."] },
  { name: "BEFORE uses less-than", assert: () => expectedBeforeSql.includes(" < DATE ") && !expectedBeforeSql.includes("<=") ? [] : ["Expected strict less-than."] },
  { name: "AFTER uses greater-than", assert: () => expectedAfterSql.includes(" > DATE ") && !expectedAfterSql.includes(">=") ? [] : ["Expected strict greater-than."] },
  { name: "DATE keyword is present", assert: () => expectedBeforeSql.includes("DATE '2026-01-01'") && expectedAfterSql.includes("DATE '2026-01-01'") ? [] : ["Expected DATE literals."] },
  { name: "Canonical date remains unchanged", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ comparisonValue: dateValue("1900-03-01") }))).sql?.includes("DATE '1900-03-01'") ? [] : ["Expected date unchanged."] },
  { name: "Leap-day date renders", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ comparisonValue: dateValue("2024-02-29") }))).sql?.includes("DATE '2024-02-29'") ? [] : ["Expected leap day."] },
  { name: "Century leap-day date renders", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ comparisonValue: dateValue("2000-02-29") }))).sql?.includes("DATE '2000-02-29'") ? [] : ["Expected century leap day."] },
  { name: "End-of-year date renders", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ comparisonValue: dateValue("2026-12-31") }))).sql?.includes("DATE '2026-12-31'") ? [] : ["Expected end-of-year."] },
  { name: "Terminal semicolon is present", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).sql?.endsWith(";") ? [] : ["Expected semicolon."] },
  { name: "Field projection remains unsorted", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).sql?.includes("ORDER BY") ? [] : ["Expected no implicit ORDER BY."] },
  { name: "Date filter does not invent LIMIT", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).sql?.includes("LIMIT") ? [] : ["Expected no implicit LIMIT."] },
  { name: "WHERE follows FROM", assert: () => clauseOrder(renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).sql || "", "FROM", "WHERE") ? [] : ["Expected FROM before WHERE."] },
  { name: "WHERE precedes GROUP BY", assert: () => clauseOrder(renderBusinessSqlQueryPlan(basePlan(filterFor())).sql || "", "WHERE", "GROUP BY") ? [] : ["Expected WHERE before GROUP BY."] },
  { name: "WHERE precedes HAVING", assert: () => clauseOrder(renderBusinessSqlQueryPlan(basePlan(filterFor(), { aggregateResultConditions: [{ conditionId: "date-base-having", measureId: revenueMeasure.measureId, operator: "greater_than", comparisonValue: { kind: "number", value: 10 } }] })).sql || "", "WHERE", "HAVING") ? [] : ["Expected WHERE before HAVING."] },
  { name: "WHERE precedes ORDER BY", assert: () => clauseOrder(renderBusinessSqlQueryPlan(basePlan(filterFor())).sql || "", "WHERE", "ORDER BY") ? [] : ["Expected WHERE before ORDER BY."] },
  { name: "LIMIT remains last", assert: () => {
    const rowLimit = { value: 5 };
    const sql = renderBusinessSqlQueryPlan(basePlan(filterFor(), { rowLimit: { ...rowLimit, rowLimitId: createBusinessSqlRowLimitId(rowLimit) } })).sql || "";
    return sql.endsWith("LIMIT 5;") ? [] : ["Expected LIMIT last."];
  } },
  { name: "Resolved joined-table BEFORE renders", assert: () => {
    const sql = renderBusinessSqlQueryPlan(basePlan(filterFor({ table: "customers", entity: "customers", field: "signup_date" }), {
      entities: [sourceEntity, { entity: "customers", table: "customers", required: true, role: "filter_subject" }],
      joinPath: {
        required: true,
        status: "resolved",
        entities: ["orders", "customers"],
        requirements: [{ fromEntity: "orders", toEntity: "customers", required: true, relationship: "orders customer", verified: true }],
        edges: [{ fromEntity: "orders", fromTable: "orders", fromField: "customer_id", toEntity: "customers", toTable: "customers", toField: "customer_id", relationship: "orders customer", verified: true }],
      },
    })).sql || "";
    return sql.includes('JOIN "customers" ON "orders"."customer_id" = "customers"."customer_id"') &&
      sql.includes('WHERE "customers"."signup_date" < DATE \'2026-01-01\'') &&
      clauseOrder(sql, "JOIN", "WHERE")
      ? []
      : ["Expected joined BEFORE SQL."];
  } },
  { name: "Resolved joined-table AFTER renders", assert: () => {
    const sql = renderBusinessSqlQueryPlan(basePlan(filterFor({ operator: "after", table: "customers", entity: "customers", field: "signup_date" }), {
      entities: [sourceEntity, { entity: "customers", table: "customers", required: true, role: "filter_subject" }],
      joinPath: {
        required: true,
        status: "resolved",
        entities: ["orders", "customers"],
        requirements: [{ fromEntity: "orders", toEntity: "customers", required: true, relationship: "orders customer", verified: true }],
        edges: [{ fromEntity: "orders", fromTable: "orders", fromField: "customer_id", toEntity: "customers", toTable: "customers", toField: "customer_id", relationship: "orders customer", verified: true }],
      },
    })).sql || "";
    return sql.includes('WHERE "customers"."signup_date" > DATE \'2026-01-01\'') ? [] : ["Expected joined AFTER SQL."];
  } },
  { name: "Unresolved join blocks", assert: () => {
    const plan = basePlan(filterFor({ table: "customers", entity: "customers", field: "signup_date" }), {
      entities: [sourceEntity, { entity: "customers", table: "customers", required: true, role: "filter_subject" }],
      joinPath: {
        required: true,
        status: "missing",
        entities: ["orders", "customers"],
        requirements: [{ fromEntity: "orders", toEntity: "customers", required: true, relationship: "orders customer", verified: false }],
        edges: [],
      },
    });
    return readinessFor(plan).status !== "ready" && noSqlAndNoActions(plan) ? [] : ["Expected unresolved join refusal."];
  } },
  { name: "BEFORE plus grouping renders complete SQL", assert: () => renderBusinessSqlQueryPlan(basePlan(filterFor({ operator: "before" }))).sql?.includes("GROUP BY") ? [] : ["Expected grouping SQL."] },
  { name: "AFTER plus grouping renders complete SQL", assert: () => renderBusinessSqlQueryPlan(basePlan(filterFor({ operator: "after" }))).sql?.includes("GROUP BY") ? [] : ["Expected grouping SQL."] },
  { name: "BEFORE plus base HAVING renders complete SQL", assert: () => renderBusinessSqlQueryPlan(basePlan(filterFor(), { aggregateResultConditions: [{ conditionId: "date-base-having", measureId: revenueMeasure.measureId, operator: "greater_than", comparisonValue: { kind: "number", value: 10 } }] })).sql?.includes("HAVING") ? [] : ["Expected HAVING SQL."] },
  { name: "AFTER plus derived HAVING renders complete SQL", assert: () => {
    const derived = derivedMeasure({ zeroDenominator: "null" });
    const sql = renderBusinessSqlQueryPlan(basePlan(filterFor({ operator: "after" }), {
      measures: [revenueMeasure, costMeasure],
      derivedMeasures: [derived],
      aggregateResultConditions: [{ conditionId: "date-derived-having", target: { kind: "derived_measure", derivedMeasureId: derived.derivedMeasureId }, operator: "greater_than", comparisonValue: { kind: "number", value: 1 } }],
    })).sql || "";
    return sql.includes("HAVING") && sql.includes("DATE '2026-01-01'") ? [] : ["Expected derived HAVING SQL."];
  } },
  { name: "BEFORE plus base ORDER BY renders complete SQL", assert: () => renderBusinessSqlQueryPlan(basePlan(filterFor(), { orderBy: [defaultSort()] })).sql?.includes("ORDER BY") ? [] : ["Expected ORDER BY SQL."] },
  { name: "AFTER plus derived ORDER BY renders complete SQL", assert: () => {
    const derived = derivedMeasure({ zeroDenominator: "null" });
    const sql = renderBusinessSqlQueryPlan(basePlan(filterFor({ operator: "after" }), {
      measures: [revenueMeasure, costMeasure],
      derivedMeasures: [derived],
      orderBy: [{ sortId: "date-derived-sort", target: { kind: "derived_measure", derivedMeasureId: derived.derivedMeasureId }, direction: "desc" }],
    })).sql || "";
    return sql.includes("ORDER BY") && sql.includes("revenue_divided_by_cost") ? [] : ["Expected derived ORDER BY SQL."];
  } },
  { name: "BEFORE plus rowLimit renders complete SQL", assert: () => {
    const rowLimit = { value: 5 };
    return renderBusinessSqlQueryPlan(basePlan(filterFor(), { rowLimit: { ...rowLimit, rowLimitId: createBusinessSqlRowLimitId(rowLimit) } })).sql?.includes("LIMIT 5") ? [] : ["Expected rowLimit SQL."];
  } },
  { name: "AFTER plus guarded division renders complete SQL", assert: () => {
    const derived = derivedMeasure({ zeroDenominator: "null" });
    const sql = renderBusinessSqlQueryPlan(basePlan(filterFor({ operator: "after" }), { measures: [revenueMeasure, costMeasure], derivedMeasures: [derived] })).sql || "";
    return sql.includes("WHEN (SUM") && sql.includes("THEN NULL") && sql.includes("DATE '2026-01-01'") ? [] : ["Expected guarded division SQL."];
  } },
  { name: "Explicit default ordering remains plan-driven", assert: () => renderBusinessSqlQueryPlan(basePlan(filterFor())).sql?.match(/ORDER BY/g)?.length === 1 ? [] : ["Expected one explicit sort."] },
  { name: "Empty orderBy remains unsorted", assert: () => !renderBusinessSqlQueryPlan(basePlan(filterFor(), { orderBy: [] })).sql?.includes("ORDER BY") ? [] : ["Expected unsorted plan."] },
  ...malformedDates.map((value): Fixture => ({
    name: `Malformed date ${JSON.stringify(value)} renders no SQL`,
    assert: () => noSqlAndNoActions(fieldProjectionPlan(filterFor({ comparisonValue: dateValue(value) }))) ? [] : [`Expected no SQL for ${JSON.stringify(value)}.`],
  })),
  ...runtimeMalformedValues.map((entry): Fixture => ({
    name: `Runtime ${entry.name} renders no SQL`,
    assert: () => noSqlAndNoActions(fieldProjectionPlan(filterFor({ comparisonValue: dateValue(entry.value) }))) ? [] : [`Expected no SQL for ${entry.name}.`],
  })),
  ...operatorValueDefenseCases.map((entry): Fixture => ({
    name: entry.name,
    assert: () => noSqlAndNoActions(fieldProjectionPlan(entry.filter)) ? [] : [`Expected no SQL for ${entry.name}.`],
  })),
  ...fieldTypeCases.map((entry): Fixture => ({
    name: entry.name,
    assert: () => {
      const filter = filterFor({ field: "typed_date", fieldInferredType: entry.fieldInferredType });
      const compatibility = evaluateBusinessSqlFilterCompatibility({ filter });
      return compatibility.reasonCodes.includes("row_filter_type_incompatible") &&
        noSqlAndNoActions(fieldProjectionPlan(filter))
        ? []
        : [`Expected rejection for ${entry.name}.`];
    },
  })),
  { name: "Unknown field rejects date filter", assert: () => {
    const filter = filterFor();
    const target = filter.target?.kind === "field" ? { ...filter.target, fieldInferredType: undefined } : filter.target;
    const unknown = { ...filter, target, fieldInferredType: undefined };
    return evaluateBusinessSqlFilterCompatibility({ filter: unknown }).reasonCodes.includes("row_filter_type_incompatible") &&
      noSqlAndNoActions(fieldProjectionPlan(unknown))
      ? []
      : ["Expected unknown field rejection."];
  } },
  { name: "Legacy ISO-looking string remains refused", assert: () => noSqlAndNoActions(basePlan(null, { filters: [{ kind: "custom", table: "orders", field: "order_date", value: "2026-01-01", label: "Legacy ISO" }] })) ? [] : ["Expected legacy ISO refusal."] },
  { name: "Legacy predicate remains refused", assert: () => noSqlAndNoActions(basePlan(null, { filters: [{ kind: "custom", predicate: "order_date < '2026-01-01'", label: "Legacy predicate" }] })) ? [] : ["Expected legacy predicate refusal."] },
  { name: "Legacy before-looking string remains refused", assert: () => noSqlAndNoActions(basePlan(null, { filters: [{ kind: "custom", table: "orders", field: "order_date", value: "before 2026-01-01", label: "Legacy before" }] })) ? [] : ["Expected legacy before refusal."] },
  { name: "Multiple filters remain incapable", assert: () => evaluateBusinessSqlRendererCapability(basePlan(null, { filters: [filterFor(), filterFor({ operator: "after" })] })).reasonCodes.includes("multiple_row_filters_not_supported") ? [] : ["Expected multiple-filter reason."] },
  { name: "Canonical target conflict remains blocked", assert: () => evaluateBusinessSqlFilterCompatibility({ filter: { ...filterFor(), field: "created_at" } }).reasonCodes.includes("row_filter_target_conflict") ? [] : ["Expected target conflict."] },
  { name: "Valid date preview exposes Copy only", assert: () => {
    const preview = createBusinessSqlRenderPreview(fieldProjectionPlan(filterFor()));
    return preview.sql === expectedBeforeSql &&
      preview.actions.canCopySql &&
      !preview.actions.canInsertSql &&
      !preview.actions.canRunSql
      ? []
      : ["Expected Copy-only preview."];
  } },
  { name: "Invalid date preview exposes no actions", assert: () => {
    const preview = createBusinessSqlRenderPreview(fieldProjectionPlan(filterFor({ comparisonValue: dateValue("2026-02-29") })));
    return preview.sql === null && !preview.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql ? [] : ["Expected no preview actions."];
  } },
  { name: "No automatic Insert", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).inserted ? [] : ["Expected no insertion."] },
  { name: "No automatic Run", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).ranQuery ? [] : ["Expected no run."] },
  { name: "Date identity remains unchanged", assert: () => filterFor({ comparisonValue: dateValue("2026-01-01") }).filterId === filterFor({ comparisonValue: dateValue("2026-01-01") }).filterId ? [] : ["Expected stable valid date identity."] },
  { name: "Invalid-date identity remains unchanged", assert: () => filterFor({ comparisonValue: dateValue("2026-02-29") }).filterId?.includes("invalid-date") ? [] : ["Expected invalid-date identity."] },
  { name: "Before and after identities differ", assert: () => filterFor({ operator: "before" }).filterId !== filterFor({ operator: "after" }).filterId ? [] : ["Expected operator identity distinction."] },
  { name: "Target changes identity", assert: () => filterFor({ field: "order_date" }).filterId !== filterFor({ field: "created_at" }).filterId ? [] : ["Expected target identity distinction."] },
  { name: "Relabeling does not affect identity", assert: () => {
    const filter = filterFor();
    const relabeled: BusinessSqlFilter = { ...filter, label: "Other" };
    return filter.filterId === createBusinessSqlFilterId(relabeled) ? [] : ["Expected relabel neutrality."];
  } },
  { name: "Date differs from scalar identity", assert: () => filterFor().filterId !== filterFor({ operator: "equals", fieldInferredType: "text", comparisonValue: { kind: "string", value: "2026-01-01" } }).filterId ? [] : ["Expected scalar distinction."] },
  { name: "Date differs from set identity", assert: () => filterFor().filterId !== filterFor({ operator: "in", fieldInferredType: "categorical", comparisonValue: setValue("string", ["2026-01-01"]) }).filterId ? [] : ["Expected set distinction."] },
  { name: "Date differs from range identity", assert: () => filterFor().filterId !== filterFor({ operator: "between", field: "order_amount", fieldInferredType: "numeric", comparisonValue: rangeValue(1, 10) }).filterId ? [] : ["Expected range distinction."] },
  { name: "Scalar SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "greater_than", field: "order_amount", fieldInferredType: "numeric", comparisonValue: { kind: "number", value: 1000 } }))).sql?.includes('WHERE "orders"."order_amount" > 1000;') ? [] : ["Expected scalar SQL unchanged."] },
  { name: "IN SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "in", field: "status", fieldInferredType: "categorical", comparisonValue: setValue("string", ["pending", "active"]) }))).sql === expectedInSql ? [] : ["Expected IN SQL unchanged."] },
  { name: "NOT IN SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "not_in", field: "status", fieldInferredType: "categorical", comparisonValue: setValue("string", ["pending", "closed"]) }))).sql === expectedNotInSql ? [] : ["Expected NOT IN SQL unchanged."] },
  { name: "BETWEEN SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "between", field: "order_amount", fieldInferredType: "numeric", comparisonValue: rangeValue(100, 500) }))).sql === expectedBetweenSql ? [] : ["Expected BETWEEN SQL unchanged."] },
  { name: "filters empty SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(basePlan(null)).sql === expectedEmptySql ? [] : ["Expected empty filter SQL unchanged."] },
  { name: "filters empty orderBy remains unsorted", assert: () => renderBusinessSqlQueryPlan(basePlan(null, { orderBy: [] })).sql === expectedEmptyUnsortedSql ? [] : ["Expected empty unsorted SQL unchanged."] },
  { name: "Natural-language BEFORE remains unsupported", assert: () => noSqlAndNoActions(basePlan(null, { filters: [{ kind: "custom", value: "Show order_id where order_date is before 2026-01-01.", label: "NL before" }] })) ? [] : ["Expected NL BEFORE unsupported."] },
  { name: "Natural-language AFTER remains unsupported", assert: () => noSqlAndNoActions(basePlan(null, { filters: [{ kind: "custom", value: "Show order_id where order_date is after 2026-01-01.", label: "NL after" }] })) ? [] : ["Expected NL AFTER unsupported."] },
];

export function runBusinessSqlDateFilterRenderingFixtures(): BusinessSqlDateFilterRenderingFixtureReport {
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

export const businessSqlDateFilterRenderingFixturesPass =
  runBusinessSqlDateFilterRenderingFixtures().failed.length === 0;
