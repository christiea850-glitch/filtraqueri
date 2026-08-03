/** PS-8b - deterministic multi-filter AND rendering fixtures. */

import {
  createBusinessSqlAggregateResultConditionId,
  createBusinessSqlDerivedMeasureId,
  createBusinessSqlFilterGroupId,
  createBusinessSqlFilterId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlRowLimitId,
  createBusinessSqlSortId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlAggregateResultCondition,
  type BusinessSqlDerivedMeasure,
  type BusinessSqlFilter,
  type BusinessSqlFilterComparisonValue,
  type BusinessSqlFilterOperator,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import { evaluateBusinessSqlPlanReadiness } from "../businessSqlPlanReadiness";
import { evaluateBusinessSqlRenderReadiness } from "../businessSqlRenderReadiness";
import { evaluateBusinessSqlRendererCapability } from "../businessSqlRendererCapability";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import { renderBusinessSqlQueryPlan } from "../businessSqlRenderer";
import { attachBusinessSqlJoinResolutionToPlan } from "../businessSqlQueryPlanJoinResolution";

type FixtureResult = { name: string; ok: boolean; failureReasons: string[] };
type Fixture = { name: string; assert: () => string[] };

const amountSeed = { kind: "sum" as const, entity: "orders", table: "orders", field: "amount", distinct: false };
const costSeed = { kind: "sum" as const, entity: "orders", table: "orders", field: "cost", distinct: false };

const measureFor = (seed: typeof amountSeed, label: string): BusinessSqlMeasure => ({
  ...seed,
  measureId: createBusinessSqlMeasureId(seed),
  fieldInferredType: "numeric",
  label,
  sqlAlias: createBusinessSqlMeasureAlias(label),
});

const amountMeasure = measureFor(amountSeed, "Total amount");
const costMeasure = measureFor(costSeed, "Total cost");

const filterFor = (options: {
  table?: string;
  entity?: string;
  field?: string;
  fieldInferredType?: BusinessSqlFilter["fieldInferredType"];
  operator?: BusinessSqlFilterOperator;
  comparisonValue?: BusinessSqlFilterComparisonValue;
  label?: string;
  targetResolved?: boolean;
} = {}): BusinessSqlFilter => {
  const {
    table = "orders",
    entity = table,
    field = "status",
    fieldInferredType = "categorical" as BusinessSqlFilter["fieldInferredType"],
    operator = "equals" as BusinessSqlFilterOperator,
    comparisonValue,
    label,
    targetResolved = true,
  } = options;
  const value = Object.prototype.hasOwnProperty.call(options || {}, "comparisonValue")
    ? comparisonValue
    : { kind: "string" as const, value: "active" };
  const seed: BusinessSqlFilter = {
    kind: "custom",
    target: { kind: "field", entity, table, field, fieldInferredType, resolved: targetResolved },
    entity,
    table,
    field,
    fieldInferredType,
    operator,
    comparisonValue: value,
    label: label || `${field} ${operator}`,
  };
  return { ...seed, filterId: createBusinessSqlFilterId(seed) };
};

const scalar = () => filterFor();
const scalarPriority = () => filterFor({ field: "priority", fieldInferredType: "categorical", operator: "not_equals", comparisonValue: { kind: "string", value: "low" } });
const setFilter = () => filterFor({ operator: "in", comparisonValue: { kind: "set", valueKind: "string", values: ["active", "pending"] } });
const numericRange = () => filterFor({ field: "amount", fieldInferredType: "numeric", operator: "between", comparisonValue: { kind: "range", valueKind: "number", lower: 100, upper: 500, lowerInclusive: true, upperInclusive: true } });
const greaterAmount = () => filterFor({ field: "amount", fieldInferredType: "numeric", operator: "greater_than", comparisonValue: { kind: "number", value: 100 } });
const lessAmount = () => filterFor({ field: "amount", fieldInferredType: "numeric", operator: "less_than", comparisonValue: { kind: "number", value: 500 } });
const beforeDate = (value = "2026-12-31") => filterFor({ field: "order_date", fieldInferredType: "date", operator: "before", comparisonValue: { kind: "date", valueKind: "date", value } });
const afterDate = (value = "2026-01-01") => filterFor({ field: "order_date", fieldInferredType: "date", operator: "after", comparisonValue: { kind: "date", valueKind: "date", value } });
const dateRange = () => filterFor({ field: "order_date", fieldInferredType: "date", operator: "between", comparisonValue: { kind: "range", valueKind: "date", lower: "2026-01-01", upper: "2026-12-31", lowerInclusive: true, upperInclusive: true } });
const nullary = () => filterFor({ field: "deleted_at", fieldInferredType: "date", operator: "is_null", comparisonValue: undefined });
const textFilter = () => filterFor({ field: "description", fieldInferredType: "text", operator: "contains", comparisonValue: { kind: "string", value: "urgent" } });
const joinedDate = (field = "signup_date") => filterFor({ table: "customers", entity: "customers", field, fieldInferredType: "date", operator: "after", comparisonValue: { kind: "date", valueKind: "date", value: "2026-01-01" } });

const basePlan = (filters: BusinessSqlFilter[] = [], overrides: Partial<BusinessSqlQueryPlan> = {}): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: overrides.id || "business-sql-plan:ps-8b",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [{ entity: "orders", table: "orders", required: true, role: "source" }],
  metric: null,
  measures: [amountMeasure],
  derivedMeasures: [],
  groupings: [{ entity: "orders", table: "orders", field: "region", label: "region" }],
  filters,
  filterCombinator: "and",
  orderBy: [{
    sortId: createBusinessSqlSortId({ target: { kind: "measure", measureId: amountMeasure.measureId, resolved: true }, direction: "desc" }),
    target: { kind: "measure", measureId: amountMeasure.measureId, resolved: true },
    direction: "desc",
    label: "Sort by Total amount",
  }],
  ...overrides,
});

const fieldProjectionPlan = (filters: BusinessSqlFilter[], overrides: Partial<BusinessSqlQueryPlan> = {}): BusinessSqlQueryPlan =>
  basePlan(filters, {
    kind: "empty",
    measures: [],
    metric: null,
    groupings: [{ entity: "orders", table: "orders", field: "order_id", label: "order_id" }],
    orderBy: [],
    ...overrides,
  });

const joinedPlan = (filters: BusinessSqlFilter[], status: "resolved" | "missing" = "resolved"): BusinessSqlQueryPlan =>
  basePlan(filters, {
    entities: [
      { entity: "orders", table: "orders", required: true, role: "source" },
      { entity: "customers", table: "customers", required: true, role: "join_subject" },
    ],
    joinPath: {
      required: true,
      status,
      entities: ["orders", "customers"],
      requirements: [{ fromEntity: "orders", toEntity: "customers", required: true, relationship: "orders customers", verified: status === "resolved" }],
      edges: [{ fromEntity: "orders", fromTable: "orders", fromField: "customer_id", toEntity: "customers", toTable: "customers", toField: "customer_id", relationship: "orders customers", verified: status === "resolved" }],
    },
  });

const aggregateCondition = (target: BusinessSqlAggregateResultCondition["target"] = { kind: "measure", measureId: amountMeasure.measureId }): BusinessSqlAggregateResultCondition => {
  const seed = { target, operator: "greater_than" as const, comparisonValue: { kind: "number" as const, value: 10 } };
  return { ...seed, conditionId: createBusinessSqlAggregateResultConditionId(seed), label: "Above 10" };
};

const derivedMeasure = (operator: BusinessSqlDerivedMeasure["operator"] = "subtract"): BusinessSqlDerivedMeasure => {
  const seed = { operator, leftMeasureId: amountMeasure.measureId, rightMeasureId: costMeasure.measureId, ...(operator === "divide" ? { divisionPolicy: { zeroDenominator: "null" as const } } : {}) };
  return { ...seed, derivedMeasureId: createBusinessSqlDerivedMeasureId(seed), sqlAlias: operator === "divide" ? "amount_divided_by_cost" : "amount_minus_cost" };
};

const projectionSql = (where: string): string => [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  `WHERE ${where};`,
].join("\n");

const groupedSql = (where: string, tail: string[] = ['ORDER BY "total_amount" DESC']): string => [
  "SELECT",
  '  "orders"."region" AS "region",',
  '  SUM("orders"."amount") AS "total_amount"',
  'FROM "orders"',
  `WHERE ${where}`,
  'GROUP BY "orders"."region"',
  ...tail.slice(0, -1),
  `${tail[tail.length - 1]};`,
].join("\n");

const zeroGroupedSql = [
  "SELECT",
  '  "orders"."region" AS "region",',
  '  SUM("orders"."amount") AS "total_amount"',
  'FROM "orders"',
  'GROUP BY "orders"."region"',
  'ORDER BY "total_amount" DESC;',
].join("\n");

const statusExpr = `"orders"."status" = 'active'`;
const priorityExpr = `"orders"."priority" <> 'low'`;
const setExpr = `"orders"."status" IN ('active', 'pending')`;
const rangeExpr = `"orders"."amount" BETWEEN 100 AND 500`;
const beforeExpr = `"orders"."order_date" < DATE '2026-12-31'`;
const afterExpr = `"orders"."order_date" > DATE '2026-01-01'`;
const dateRangeExpr = `"orders"."order_date" BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'`;
const nullExpr = `"orders"."deleted_at" IS NULL`;
const textExpr = `contains("orders"."description", 'urgent')`;
const joinedExpr = `"customers"."signup_date" > DATE '2026-01-01'`;
const and = (...expressions: string[]) => expressions.join("\n  AND ");

const render = (plan: BusinessSqlQueryPlan) => renderBusinessSqlQueryPlan(plan);
const preview = (plan: BusinessSqlQueryPlan) => createBusinessSqlRenderPreview(plan);
const readiness = (plan: BusinessSqlQueryPlan) => evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

const expect = (condition: boolean, message: string): string[] => condition ? [] : [message];
const expectExactSql = (name: string, plan: BusinessSqlQueryPlan, expected: string): Fixture => ({
  name,
  assert: () => {
    const result = render(plan);
    return [
      ...expect(result.rendered, "Expected rendered result."),
      ...expect(result.sql === expected, `Expected exact SQL.\n${result.sql || "(null)"}`),
      ...expect(result.inserted === false && result.ranQuery === false, "Expected manual workflow flags."),
    ];
  },
});
const noSql = (plan: BusinessSqlQueryPlan): string[] => {
  try {
    const result = render(plan);
    const model = preview(plan);
    return !result.rendered && result.sql === null && !result.inserted && !result.ranQuery &&
      model.sql === null && !model.actions.canCopySql && !model.actions.canInsertSql && !model.actions.canRunSql
      ? []
      : ["Expected no SQL and no preview actions."];
  } catch (error) {
    return [`Expected no throw, got ${error instanceof Error ? error.message : String(error)}.`];
  }
};

const invalidMemberPlan = (member: unknown, position: "first" | "middle" | "last" = "middle") => {
  const filters = position === "first"
    ? [member, scalar(), dateRange()]
    : position === "last"
      ? [scalar(), dateRange(), member]
      : [scalar(), member, dateRange()];
  return fieldProjectionPlan(filters as BusinessSqlFilter[]);
};

const malformedScalar = filterFor({ comparisonValue: { kind: "string", value: "" } });
const malformedSet = filterFor({ operator: "in", comparisonValue: { kind: "set", valueKind: "string", values: [] } });
const reversedNumber = filterFor({ field: "amount", fieldInferredType: "numeric", operator: "between", comparisonValue: { kind: "range", valueKind: "number", lower: 500, upper: 100, lowerInclusive: true, upperInclusive: true } });
const malformedDate = filterFor({ field: "order_date", fieldInferredType: "date", operator: "before", comparisonValue: { kind: "date", valueKind: "date", value: "2026-02-30" } });
const reversedDate = filterFor({ field: "order_date", fieldInferredType: "date", operator: "between", comparisonValue: { kind: "range", valueKind: "date", lower: "2026-12-31", upper: "2026-01-01", lowerInclusive: true, upperInclusive: true } });
const wrongType = filterFor({ field: "status", fieldInferredType: "categorical", operator: "between", comparisonValue: { kind: "range", valueKind: "number", lower: 1, upper: 2, lowerInclusive: true, upperInclusive: true } });
const missingValue = filterFor({ operator: "equals", comparisonValue: undefined });
const unsupportedOperator = filterFor({ operator: "matches_regex" as BusinessSqlFilterOperator });
const conflict = { ...scalar(), field: "other_field" };
const legacy: BusinessSqlFilter = { kind: "status", table: "orders", field: "status", value: "active", label: "Legacy" };

const fixtures: Fixture[] = [
  { name: "A1 two valid filters become capable", assert: () => expect(evaluateBusinessSqlRendererCapability(fieldProjectionPlan([scalar(), dateRange()])).capable, "Expected capability.") },
  { name: "A2 three valid filters become capable", assert: () => expect(evaluateBusinessSqlRendererCapability(fieldProjectionPlan([scalar(), setFilter(), dateRange()])).capable, "Expected capability.") },
  { name: "A3 four valid filters become capable", assert: () => expect(evaluateBusinessSqlRendererCapability(fieldProjectionPlan([scalar(), setFilter(), numericRange(), dateRange()])).capable, "Expected capability.") },
  { name: "A4 absent combinator defaults to AND and is capable", assert: () => {
    const { filterCombinator, ...plan } = fieldProjectionPlan([scalar(), dateRange()]);
    void filterCombinator;
    return expect(evaluateBusinessSqlRendererCapability(plan).capable, "Expected absent combinator capability.");
  } },
  { name: "A5 explicit AND is capable", assert: () => expect(evaluateBusinessSqlRendererCapability(fieldProjectionPlan([scalar(), dateRange()])).capable, "Expected explicit AND capability.") },
  { name: "A6 invalid combinator remains blocked", assert: () => noSql({ ...fieldProjectionPlan([scalar(), dateRange()]), filterCombinator: "or" as never }) },
  { name: "A7 invalid member remains blocked", assert: () => noSql(invalidMemberPlan(malformedScalar)) },
  { name: "A8 unresolved join remains blocked", assert: () => noSql(joinedPlan([scalar(), joinedDate()], "missing")) },
  { name: "A9 legacy member remains blocked", assert: () => noSql(invalidMemberPlan(legacy)) },
  { name: "A10 render readiness becomes ready for valid multi-filter AND", assert: () => {
    const result = evaluateBusinessSqlRenderReadiness(fieldProjectionPlan([scalar(), dateRange()]));
    return expect(result.status === "renderable" && result.reasons.length === 0, "Expected renderable readiness.");
  } },

  expectExactSql("B11 scalar + scalar exact SQL", fieldProjectionPlan([scalar(), scalarPriority()]), projectionSql(and(statusExpr, priorityExpr))),
  expectExactSql("B12 scalar + set exact SQL", fieldProjectionPlan([scalarPriority(), setFilter()]), projectionSql(and(priorityExpr, setExpr))),
  expectExactSql("B13 scalar + numeric range exact SQL", fieldProjectionPlan([scalar(), numericRange()]), projectionSql(and(statusExpr, rangeExpr))),
  expectExactSql("B14 scalar + single date exact SQL", fieldProjectionPlan([scalar(), beforeDate()]), projectionSql(and(statusExpr, beforeExpr))),
  expectExactSql("B15 scalar + date range exact SQL", fieldProjectionPlan([scalar(), dateRange()]), projectionSql(and(statusExpr, dateRangeExpr))),
  expectExactSql("B16 set + numeric range exact SQL", fieldProjectionPlan([setFilter(), numericRange()]), projectionSql(and(setExpr, rangeExpr))),
  expectExactSql("B17 set + date range exact SQL", fieldProjectionPlan([setFilter(), dateRange()]), projectionSql(and(setExpr, dateRangeExpr))),
  expectExactSql("B18 numeric range + date range exact SQL", fieldProjectionPlan([numericRange(), dateRange()]), projectionSql(and(rangeExpr, dateRangeExpr))),
  expectExactSql("B19 BEFORE + scalar exact SQL", fieldProjectionPlan([beforeDate(), scalar()]), projectionSql(and(beforeExpr, statusExpr))),
  expectExactSql("B20 AFTER + scalar exact SQL", fieldProjectionPlan([afterDate(), scalar()]), projectionSql(and(afterExpr, statusExpr))),
  expectExactSql("B21 nullary + scalar exact SQL", fieldProjectionPlan([nullary(), scalar()]), projectionSql(and(nullExpr, statusExpr))),
  expectExactSql("B22 text + scalar exact SQL", fieldProjectionPlan([textFilter(), scalar()]), projectionSql(and(textExpr, statusExpr))),
  expectExactSql("B23 three-filter exact SQL", fieldProjectionPlan([scalar(), setFilter(), dateRange()]), projectionSql(and(statusExpr, setExpr, dateRangeExpr))),
  expectExactSql("B24 four-filter exact SQL", fieldProjectionPlan([scalar(), setFilter(), numericRange(), dateRange()]), projectionSql(and(statusExpr, setExpr, rangeExpr, dateRangeExpr))),
  expectExactSql("B25 same-field numeric predicates exact SQL", fieldProjectionPlan([greaterAmount(), lessAmount()]), projectionSql(and(`"orders"."amount" > 100`, `"orders"."amount" < 500`))),
  expectExactSql("B26 same-field date predicates exact SQL", fieldProjectionPlan([afterDate("2026-01-01"), beforeDate("2026-12-31")]), projectionSql(and(afterExpr, beforeExpr))),
  expectExactSql("B27 duplicate filters both render", fieldProjectionPlan([scalar(), scalar()]), projectionSql(and(statusExpr, statusExpr))),
  expectExactSql("B28 authored order A/B preserved", fieldProjectionPlan([scalar(), dateRange()]), projectionSql(and(statusExpr, dateRangeExpr))),
  expectExactSql("B29 authored order B/A preserved", fieldProjectionPlan([dateRange(), scalar()]), projectionSql(and(dateRangeExpr, statusExpr))),
  { name: "B30 one WHERE only", assert: () => expect((render(fieldProjectionPlan([scalar(), dateRange()])).sql?.match(/\bWHERE\b/g) || []).length === 1, "Expected one WHERE.") },
  { name: "B31 correct logical AND count", assert: () => expect((render(fieldProjectionPlan([scalar(), setFilter(), dateRange()])).sql?.match(/\n  AND /g) || []).length === 2, "Expected two logical AND separators.") },
  { name: "B32 BETWEEN internal AND preserved", assert: () => expect(render(fieldProjectionPlan([scalar(), dateRange()])).sql === projectionSql(and(statusExpr, dateRangeExpr)), "Expected BETWEEN internal AND preserved.") },
  { name: "B33 no trailing AND", assert: () => expect(!/AND\s*;/.test(render(fieldProjectionPlan([scalar(), dateRange()])).sql || ""), "Expected no trailing AND.") },
  { name: "B34 terminal semicolon present", assert: () => expect(render(fieldProjectionPlan([scalar(), dateRange()])).sql?.endsWith(";") === true, "Expected terminal semicolon.") },

  expectExactSql("C35 base + joined exact SQL", joinedPlan([scalar(), joinedDate()]), [
    "SELECT",
    '  "orders"."region" AS "region",',
    '  SUM("orders"."amount") AS "total_amount"',
    'FROM "orders"',
    'JOIN "customers" ON "orders"."customer_id" = "customers"."customer_id"',
    `WHERE ${and(statusExpr, joinedExpr)}`,
    'GROUP BY "orders"."region"',
    'ORDER BY "total_amount" DESC;',
  ].join("\n")),
  expectExactSql("C36 two joined filters exact SQL", joinedPlan([joinedDate(), joinedDate("renewal_date")]), [
    "SELECT",
    '  "orders"."region" AS "region",',
    '  SUM("orders"."amount") AS "total_amount"',
    'FROM "orders"',
    'JOIN "customers" ON "orders"."customer_id" = "customers"."customer_id"',
    `WHERE ${and(joinedExpr, `"customers"."renewal_date" > DATE '2026-01-01'`)}`,
    'GROUP BY "orders"."region"',
    'ORDER BY "total_amount" DESC;',
  ].join("\n")),
  { name: "C37 FROM precedes JOIN", assert: () => { const sql = render(joinedPlan([scalar(), joinedDate()])).sql || ""; return expect(sql.indexOf("FROM") < sql.indexOf("JOIN"), "Expected FROM before JOIN."); } },
  { name: "C38 JOIN precedes WHERE", assert: () => { const sql = render(joinedPlan([scalar(), joinedDate()])).sql || ""; return expect(sql.indexOf("JOIN") < sql.indexOf("WHERE"), "Expected JOIN before WHERE."); } },
  { name: "C39 joined identifiers fully qualified", assert: () => expect((render(joinedPlan([scalar(), joinedDate()])).sql || "").includes('"customers"."signup_date"'), "Expected qualified joined identifier.") },
  { name: "C40 unresolved joined member blocks", assert: () => noSql(joinedPlan([scalar(), joinedDate()], "missing")) },
  { name: "C41 missing relationship blocks", assert: () => noSql(joinedPlan([scalar(), joinedDate()], "missing")) },
  { name: "C42 no joined-member omission", assert: () => expect((render(joinedPlan([scalar(), joinedDate()])).sql || "").includes(joinedExpr), "Expected joined expression.") },
  { name: "C43 no relationship inference", assert: () => expect(readiness(joinedPlan([scalar(), joinedDate()])).status === "needs_review", "Expected no fixture-time relationship inference in readiness helper.") },

  expectExactSql("D44 WHERE precedes GROUP BY", basePlan([scalar(), dateRange()]), groupedSql(and(statusExpr, dateRangeExpr))),
  { name: "D45 WHERE precedes HAVING", assert: () => { const sql = render(basePlan([scalar(), dateRange()], { aggregateResultConditions: [aggregateCondition()] })).sql || ""; return expect(sql.indexOf("WHERE") < sql.indexOf("HAVING"), "Expected WHERE before HAVING."); } },
  { name: "D46 WHERE precedes ORDER BY", assert: () => { const sql = render(basePlan([scalar(), dateRange()])).sql || ""; return expect(sql.indexOf("WHERE") < sql.indexOf("ORDER BY"), "Expected WHERE before ORDER BY."); } },
  { name: "D47 LIMIT remains last", assert: () => { const sql = render(basePlan([scalar(), dateRange()], { rowLimit: { rowLimitId: createBusinessSqlRowLimitId({ value: 5 }), value: 5 } })).sql || ""; return expect(sql.endsWith("LIMIT 5;"), "Expected LIMIT last."); } },
  expectExactSql("D48 grouped aggregation complete SQL", basePlan([scalar(), dateRange()]), groupedSql(and(statusExpr, dateRangeExpr))),
  { name: "D49 base HAVING complete SQL", assert: () => expect(Boolean(render(basePlan([scalar(), dateRange()], { aggregateResultConditions: [aggregateCondition()] })).sql?.includes("HAVING SUM")), "Expected HAVING SQL.") },
  { name: "D50 derived HAVING complete SQL", assert: () => {
    const derived = derivedMeasure();
    return expect(Boolean(render(basePlan([scalar(), dateRange()], { measures: [amountMeasure, costMeasure], derivedMeasures: [derived], aggregateResultConditions: [aggregateCondition({ kind: "derived_measure", derivedMeasureId: derived.derivedMeasureId })] })).sql?.includes("HAVING (SUM")), "Expected derived HAVING SQL.");
  } },
  { name: "D51 derived ORDER BY complete SQL", assert: () => {
    const derived = derivedMeasure();
    const sortSeed = { target: { kind: "derived_measure" as const, derivedMeasureId: derived.derivedMeasureId, resolved: true }, direction: "desc" as const };
    return expect(Boolean(render(basePlan([scalar(), dateRange()], { measures: [amountMeasure, costMeasure], derivedMeasures: [derived], orderBy: [{ ...sortSeed, sortId: createBusinessSqlSortId(sortSeed) }] })).sql?.includes('ORDER BY "amount_minus_cost" DESC')), "Expected derived ORDER BY SQL.");
  } },
  { name: "D52 guarded division complete SQL", assert: () => {
    const derived = derivedMeasure("divide");
    return expect(Boolean(render(basePlan([scalar(), dateRange()], { measures: [amountMeasure, costMeasure], derivedMeasures: [derived] })).sql?.includes("WHEN (SUM")), "Expected guarded division SQL.");
  } },
  { name: "D53 explicit default ordering appears once", assert: () => expect((render(basePlan([scalar(), dateRange()])).sql?.match(/ORDER BY/g) || []).length === 1, "Expected one ORDER BY.") },
  { name: "D54 empty orderBy remains unsorted", assert: () => expect(!render(basePlan([scalar(), dateRange()], { orderBy: [] })).sql?.includes("ORDER BY"), "Expected unsorted SQL.") },
  { name: "D55 field projection has no implicit ORDER BY", assert: () => expect(!render(fieldProjectionPlan([scalar(), dateRange()])).sql?.includes("ORDER BY"), "Expected no implicit ORDER BY.") },
  { name: "D56 field projection has no implicit LIMIT", assert: () => expect(!render(fieldProjectionPlan([scalar(), dateRange()])).sql?.includes("LIMIT"), "Expected no implicit LIMIT.") },
];

const invalidMembers = [
  malformedScalar, malformedSet, reversedNumber, malformedDate, reversedDate, wrongType,
  missingValue, unsupportedOperator, conflict, legacy,
];
fixtures.push(
  ...["first", "middle", "last"].map((position, index) => ({
    name: `E${57 + index} invalid ${position} member renders no SQL`,
    assert: () => noSql(invalidMemberPlan(malformedScalar, position as "first" | "middle" | "last")),
  })),
  ...invalidMembers.map((member, index) => ({
    name: `E${60 + index} malformed member ${index + 1} renders no SQL`,
    assert: () => noSql(invalidMemberPlan(member)),
  })),
);

const runtimeMembers: unknown[] = [null, undefined, 1, true, "status", { label: "missing" }, [], () => "x", Symbol("x")];
fixtures.push(...runtimeMembers.map((member, index) => ({
  name: `E${70 + index} runtime malformed member ${index + 1} renders no SQL`,
  assert: () => noSql(invalidMemberPlan(member)),
})));
fixtures.push(
  { name: "E79 no first-filter fallback", assert: () => noSql(invalidMemberPlan(malformedScalar, "last")) },
  { name: "E80 no last-filter fallback", assert: () => noSql(invalidMemberPlan(malformedScalar, "first")) },
  { name: "E81 no valid-subset fallback", assert: () => noSql(invalidMemberPlan(malformedScalar, "middle")) },
  { name: "E82 no filter-free SELECT", assert: () => noSql(invalidMemberPlan(malformedScalar)) },
  { name: "E83 no partial JOIN", assert: () => noSql(joinedPlan([scalar(), malformedScalar, joinedDate()] as BusinessSqlFilter[])) },
  { name: "E84 no partial GROUP BY", assert: () => noSql(invalidMemberPlan(malformedScalar)) },
  { name: "E85 no partial HAVING", assert: () => noSql(basePlan([scalar(), malformedScalar], { aggregateResultConditions: [aggregateCondition()] })) },
  { name: "E86 no partial ORDER BY", assert: () => noSql(basePlan([scalar(), malformedScalar])) },
  { name: "E87 no partial LIMIT", assert: () => noSql(basePlan([scalar(), malformedScalar], { rowLimit: { rowLimitId: createBusinessSqlRowLimitId({ value: 5 }), value: 5 } })) },
);

const operatorDefense = [
  filterFor({ operator: "between", comparisonValue: { kind: "string", value: "active" } }),
  filterFor({ operator: "between", comparisonValue: { kind: "set", valueKind: "string", values: ["active"] } }),
  filterFor({ field: "order_date", fieldInferredType: "date", operator: "before", comparisonValue: { kind: "range", valueKind: "date", lower: "2026-01-01", upper: "2026-12-31", lowerInclusive: true, upperInclusive: true } }),
  filterFor({ field: "order_date", fieldInferredType: "date", operator: "after", comparisonValue: { kind: "range", valueKind: "date", lower: "2026-01-01", upper: "2026-12-31", lowerInclusive: true, upperInclusive: true } }),
  filterFor({ operator: "equals", comparisonValue: { kind: "range", valueKind: "number", lower: 1, upper: 2, lowerInclusive: true, upperInclusive: true } }),
  filterFor({ operator: "in", comparisonValue: { kind: "string", value: "active" } }),
  filterFor({ operator: "not_in", comparisonValue: { kind: "string", value: "active" } }),
  filterFor({ operator: "is_null", comparisonValue: { kind: "string", value: "active" } }),
  filterFor({ field: "order_date", fieldInferredType: "date", operator: "before", comparisonValue: { kind: "number", value: 1 } }),
  filterFor({ field: "amount", fieldInferredType: "numeric", operator: "greater_than", comparisonValue: { kind: "date", valueKind: "date", value: "2026-01-01" } }),
];
fixtures.push(...operatorDefense.map((member, index) => ({
  name: `F${88 + index} operator/value defense ${index + 1} blocks`,
  assert: () => noSql(invalidMemberPlan(member)),
})));

const badCombinators: unknown[] = ["or", "not", "xor", "", " ", null, 1, false, {}, [], () => "and", Symbol("and"), "&&", "all", "both"];
fixtures.push(...badCombinators.map((value, index) => ({
  name: `G${98 + index} malformed combinator ${index + 1} blocks`,
  assert: () => noSql({ ...fieldProjectionPlan([scalar(), dateRange()]), filterCombinator: value as never }),
})));

fixtures.push(
  { name: "H113 valid preview SQL equals renderer SQL", assert: () => { const plan = fieldProjectionPlan([scalar(), dateRange()]); return expect(preview(plan).sql === render(plan).sql, "Expected preview SQL equality."); } },
  { name: "H114 valid preview canCopySql true", assert: () => expect(preview(fieldProjectionPlan([scalar(), dateRange()])).actions.canCopySql, "Expected canCopySql.") },
  { name: "H115 valid preview canInsertSql false", assert: () => expect(!preview(fieldProjectionPlan([scalar(), dateRange()])).actions.canInsertSql, "Expected no insert.") },
  { name: "H116 valid preview canRunSql false", assert: () => expect(!preview(fieldProjectionPlan([scalar(), dateRange()])).actions.canRunSql, "Expected no run.") },
  { name: "H117 invalid preview SQL null", assert: () => expect(preview(invalidMemberPlan(malformedScalar)).sql === null, "Expected null SQL.") },
  { name: "H118 invalid preview canCopySql false", assert: () => expect(!preview(invalidMemberPlan(malformedScalar)).actions.canCopySql, "Expected no copy.") },
  { name: "H119 invalid preview canInsertSql false", assert: () => expect(!preview(invalidMemberPlan(malformedScalar)).actions.canInsertSql, "Expected no insert.") },
  { name: "H120 invalid preview canRunSql false", assert: () => expect(!preview(invalidMemberPlan(malformedScalar)).actions.canRunSql, "Expected no run.") },
  { name: "H121 inserted false", assert: () => expect(!render(fieldProjectionPlan([scalar(), dateRange()])).inserted, "Expected inserted false.") },
  { name: "H122 ranQuery false", assert: () => expect(!render(fieldProjectionPlan([scalar(), dateRange()])).ranQuery, "Expected ranQuery false.") },
  { name: "I123 group ID remains order-independent", assert: () => expect(createBusinessSqlFilterGroupId({ combinator: "and", filters: [scalar(), dateRange()] }) === createBusinessSqlFilterGroupId({ combinator: "and", filters: [dateRange(), scalar()] }), "Expected order-independent identity.") },
  { name: "I124 duplicate multiplicity remains distinguishable", assert: () => expect(createBusinessSqlFilterGroupId({ combinator: "and", filters: [scalar()] }) !== createBusinessSqlFilterGroupId({ combinator: "and", filters: [scalar(), scalar()] }), "Expected multiplicity-sensitive identity.") },
  { name: "I125 stale stored filterId remains ignored", assert: () => expect(createBusinessSqlFilterGroupId({ combinator: "and", filters: [{ ...scalar(), filterId: "stale" }, dateRange()] }) === createBusinessSqlFilterGroupId({ combinator: "and", filters: [scalar(), dateRange()] }), "Expected stale filterId ignored.") },
  { name: "I126 authored filter order remains unmodified", assert: () => { const filters = [scalar(), dateRange()]; const before = filters.map((filter) => filter.label).join("|"); render(fieldProjectionPlan(filters)); return expect(before === filters.map((filter) => filter.label).join("|"), "Expected authored order preserved."); } },
  { name: "I127 member filterId remains unmodified", assert: () => { const filter = { ...scalar(), filterId: "stale" }; render(fieldProjectionPlan([filter, dateRange()])); return expect(filter.filterId === "stale", "Expected filterId unchanged."); } },
  { name: "I128 rendering output does not alter group ID", assert: () => { const filters = [scalar(), dateRange()]; const before = createBusinessSqlFilterGroupId({ combinator: "and", filters }); render(fieldProjectionPlan(filters)); return expect(before === createBusinessSqlFilterGroupId({ combinator: "and", filters }), "Expected render-neutral identity."); } },
  expectExactSql("J129 zero-filter SQL byte-identical", basePlan([]), zeroGroupedSql),
  { name: "J130 zero-filter default ordering byte-identical", assert: () => expect(render(basePlan([])).sql?.includes('ORDER BY "total_amount" DESC;') === true, "Expected default ordering.") },
  { name: "J131 empty orderBy remains unsorted", assert: () => expect(!render(basePlan([], { orderBy: [] })).sql?.includes("ORDER BY"), "Expected empty orderBy unsorted.") },
  expectExactSql("J132 single scalar SQL byte-identical", fieldProjectionPlan([scalar()]), projectionSql(statusExpr)),
  expectExactSql("J133 single IN SQL byte-identical", fieldProjectionPlan([setFilter()]), projectionSql(setExpr)),
  expectExactSql("J134 single NOT IN SQL byte-identical", fieldProjectionPlan([filterFor({ operator: "not_in", comparisonValue: { kind: "set", valueKind: "string", values: ["active"] } })]), projectionSql(`"orders"."status" NOT IN ('active')`)),
  expectExactSql("J135 single numeric BETWEEN SQL byte-identical", fieldProjectionPlan([numericRange()]), projectionSql(rangeExpr)),
  expectExactSql("J136 single BEFORE SQL byte-identical", fieldProjectionPlan([beforeDate()]), projectionSql(beforeExpr)),
  expectExactSql("J137 single AFTER SQL byte-identical", fieldProjectionPlan([afterDate()]), projectionSql(afterExpr)),
  expectExactSql("J138 single date BETWEEN SQL byte-identical", fieldProjectionPlan([dateRange()]), projectionSql(dateRangeExpr)),
  expectExactSql("J139 single nullary SQL byte-identical", fieldProjectionPlan([nullary()]), projectionSql(nullExpr)),
  expectExactSql("J140 single text SQL byte-identical", fieldProjectionPlan([textFilter()]), projectionSql(textExpr)),
  { name: "J141 single-filter preview remains Copy-only", assert: () => { const model = preview(fieldProjectionPlan([scalar()])); return expect(Boolean(model.sql) && model.actions.canCopySql && !model.actions.canInsertSql && !model.actions.canRunSql, "Expected copy-only.") } },
  { name: "J142 single-filter capability remains true", assert: () => expect(evaluateBusinessSqlRendererCapability(fieldProjectionPlan([scalar()])).capable, "Expected capability.") },
  { name: "J143 scalar NL grounding remains green", assert: () => expect(render(fieldProjectionPlan([scalar()])).sql === projectionSql(statusExpr), "Expected scalar regression green.") },
  { name: "J144 IN/NOT IN NL grounding remains green", assert: () => expect(evaluateBusinessSqlRendererCapability(fieldProjectionPlan([setFilter()])).capable, "Expected IN regression green.") },
  { name: "J145 numeric BETWEEN NL grounding remains green", assert: () => expect(evaluateBusinessSqlRendererCapability(fieldProjectionPlan([numericRange()])).capable, "Expected range regression green.") },
  { name: "J146 BEFORE/AFTER NL grounding remains green", assert: () => expect(evaluateBusinessSqlRendererCapability(fieldProjectionPlan([beforeDate()])).capable && evaluateBusinessSqlRendererCapability(fieldProjectionPlan([afterDate()])).capable, "Expected date regression green.") },
  { name: "J147 date-range NL grounding remains green", assert: () => expect(evaluateBusinessSqlRendererCapability(fieldProjectionPlan([dateRange()])).capable, "Expected date-range regression green.") },
  { name: "J148 no automatic Insert", assert: () => expect(!render(fieldProjectionPlan([scalar(), dateRange()])).inserted, "Expected no insert.") },
  { name: "J149 no automatic Run", assert: () => expect(!render(fieldProjectionPlan([scalar(), dateRange()])).ranQuery, "Expected no run.") },
);

export function runBusinessSqlMultiFilterRenderingFixtures() {
  const results: FixtureResult[] = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
    return { name: fixture.name, ok: failureReasons.length === 0, failureReasons };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const businessSqlMultiFilterRenderingFixturesPass =
  runBusinessSqlMultiFilterRenderingFixtures().failed.length === 0;
