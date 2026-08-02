/** PS-7a - canonical date-only row-filter contract fixtures. */

import {
  createBusinessSqlFilterId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createEmptyBusinessSqlQueryPlan,
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

export type BusinessSqlDateFilterContractFixtureReport = {
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
  field = "order_date",
  fieldInferredType = "date" as BusinessSqlFilter["fieldInferredType"],
  comparisonValue = dateValue("2026-01-31"),
  table = "orders",
  entity = table,
  targetResolved = true,
}: {
  operator?: BusinessSqlFilterOperator;
  field?: string;
  fieldInferredType?: BusinessSqlFilter["fieldInferredType"];
  comparisonValue?: BusinessSqlFilterComparisonValue;
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

const basePlan = (
  filter: BusinessSqlFilter | null = filterFor(),
  overrides: Partial<BusinessSqlQueryPlan> = {},
): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:date-filter-contract",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [sourceEntity],
  metric: null,
  measures: [revenueMeasure],
  groupings: [grouping],
  filters: filter ? [filter] : [],
  ...overrides,
});

const fieldProjectionPlan = (filter: BusinessSqlFilter | null): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:date-filter-field-projection",
  kind: "empty",
  status: "resolved",
  support: "supported",
  entities: [sourceEntity],
  groupings: [{ entity: "orders", table: "orders", field: "order_id", label: "order_id" }],
  filters: filter ? [filter] : [],
});

const readinessFor = (plan: BusinessSqlQueryPlan) =>
  evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

const compatibilityFor = (filter: BusinessSqlFilter) =>
  evaluateBusinessSqlFilterCompatibility({ filter });

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

const expectedRangeSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" BETWEEN 100 AND 500;',
].join("\n");

const expectedInSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."status" IN (\'active\', \'pending\');',
].join("\n");

const validDateCases = [
  "2026-01-01",
  "2026-02-28",
  "2026-12-31",
  "2024-02-29",
  "2000-02-29",
  "1900-02-28",
  "1900-03-01",
  "9999-12-31",
] as const;

const invalidDateCases = [
  "2026-1-01",
  "2026-01-1",
  "2026/01/01",
  "01-01-2026",
  "2026-00-01",
  "2026-13-01",
  "2026-01-00",
  "2026-01-32",
  "2026-04-31",
  "2026-06-31",
  "2026-09-31",
  "2026-11-31",
  "2026-02-29",
  "1900-02-29",
  "2026-02-30",
  "2026-01-01T00:00:00Z",
  "2026-01-01 00:00:00",
  " 2026-01-01",
  "2026-01-01 ",
  "   ",
  "2026-01-01\n",
  "",
] as const;

const malformedRuntimeCases = [
  { name: "number", value: 20260101 },
  { name: "boolean", value: true },
  { name: "null", value: null },
  { name: "undefined", value: undefined },
  { name: "object", value: { date: "2026-01-01" } },
  { name: "array", value: ["2026-01-01"] },
  { name: "function", value: () => "2026-01-01" },
  { name: "symbol", value: Symbol("date") },
] as const;

const fieldTypeCases: readonly {
  name: string;
  fieldInferredType: BusinessSqlFilter["fieldInferredType"];
}[] = [
  { name: "numeric", fieldInferredType: "numeric" },
  { name: "text", fieldInferredType: "text" },
  { name: "categorical", fieldInferredType: "categorical" },
  { name: "boolean", fieldInferredType: "boolean" },
  { name: "datetime", fieldInferredType: "datetime" as unknown as BusinessSqlFilter["fieldInferredType"] },
  { name: "timestamp", fieldInferredType: "timestamp" as unknown as BusinessSqlFilter["fieldInferredType"] },
] as const;

const scalarOperators: BusinessSqlFilterOperator[] = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
  "starts_with",
  "ends_with",
];

const fixtures: Fixture[] = [
  ...validDateCases.flatMap((value): Fixture[] => [
    {
      name: `valid date ${value} is compatible before`,
      assert: () => compatibilityFor(filterFor({ operator: "before", comparisonValue: dateValue(value) })).compatible
        ? []
        : [`Expected ${value} before compatible.`],
    },
    {
      name: `valid date ${value} is compatible after`,
      assert: () => compatibilityFor(filterFor({ operator: "after", comparisonValue: dateValue(value) })).compatible
        ? []
        : [`Expected ${value} after compatible.`],
    },
  ]),
  ...invalidDateCases.map((value): Fixture => ({
    name: `invalid date string ${JSON.stringify(value)} is rejected`,
    assert: () => compatibilityFor(filterFor({ comparisonValue: dateValue(value) })).reasonCodes.includes("row_filter_value_invalid")
      ? []
      : [`Expected ${JSON.stringify(value)} invalid.`],
  })),
  ...malformedRuntimeCases.map((entry): Fixture => ({
    name: `runtime malformed date ${entry.name} is rejected`,
    assert: () => compatibilityFor(filterFor({ comparisonValue: dateValue(entry.value) })).reasonCodes.includes("row_filter_value_invalid")
      ? []
      : [`Expected malformed ${entry.name} invalid.`],
  })),
  ...fieldTypeCases.map((entry): Fixture => ({
    name: `date filter rejects ${entry.name} field`,
    assert: () => compatibilityFor(filterFor({
      field: `${entry.name}_field`,
      fieldInferredType: entry.fieldInferredType as BusinessSqlFilter["fieldInferredType"],
    })).reasonCodes.includes("row_filter_type_incompatible")
      ? []
      : [`Expected ${entry.name} field incompatible.`],
  })),
  ...scalarOperators.map((operator): Fixture => ({
    name: `scalar operator ${operator} rejects date value`,
    assert: () => compatibilityFor(filterFor({ operator })).reasonCodes.includes("row_filter_type_incompatible")
      ? []
      : [`Expected ${operator} to reject date value.`],
  })),
  { name: "date comparison value carries date kind", assert: () => dateValue("2026-01-01").kind === "date" ? [] : ["Expected date kind."] },
  { name: "before operator is supported", assert: () => compatibilityFor(filterFor({ operator: "before" })).reasonCodes.includes("row_filter_operator_unsupported") ? ["Expected before supported."] : [] },
  { name: "after operator is supported", assert: () => compatibilityFor(filterFor({ operator: "after" })).reasonCodes.includes("row_filter_operator_unsupported") ? ["Expected after supported."] : [] },
  { name: "missing before value is invalid", assert: () => compatibilityFor({ ...filterFor({ operator: "before" }), comparisonValue: undefined }).reasonCodes.includes("row_filter_value_missing") ? [] : ["Expected missing before value."] },
  { name: "missing after value is invalid", assert: () => compatibilityFor({ ...filterFor({ operator: "after" }), comparisonValue: undefined }).reasonCodes.includes("row_filter_value_missing") ? [] : ["Expected missing after value."] },
  { name: "before rejects string scalar", assert: () => compatibilityFor(filterFor({ comparisonValue: { kind: "string", value: "2026-01-01" } })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected string scalar rejection."] },
  { name: "after rejects numeric scalar", assert: () => compatibilityFor(filterFor({ operator: "after", comparisonValue: { kind: "number", value: 20260101 } })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected numeric scalar rejection."] },
  { name: "before rejects boolean scalar", assert: () => compatibilityFor(filterFor({ comparisonValue: { kind: "boolean", value: true } })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected boolean scalar rejection."] },
  { name: "before rejects set value", assert: () => compatibilityFor(filterFor({ comparisonValue: setValue("string", ["2026-01-01"]) })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected set rejection."] },
  { name: "after rejects range value", assert: () => compatibilityFor(filterFor({ operator: "after", comparisonValue: rangeValue(1, 10) })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected range rejection."] },
  { name: "IN rejects date value", assert: () => compatibilityFor(filterFor({ operator: "in" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected IN date rejection."] },
  { name: "NOT IN rejects date value", assert: () => compatibilityFor(filterFor({ operator: "not_in" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected NOT IN date rejection."] },
  { name: "BETWEEN rejects date value", assert: () => compatibilityFor(filterFor({ operator: "between" })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected BETWEEN date rejection."] },
  { name: "nullary rejects date value", assert: () => compatibilityFor(filterFor({ operator: "is_null" })).reasonCodes.includes("row_filter_value_not_allowed") ? [] : ["Expected nullary date rejection."] },
  { name: "unknown field type rejects date filter", assert: () => {
    const filter = filterFor();
    const target = filter.target?.kind === "field" ? { ...filter.target, fieldInferredType: undefined } : filter.target;
    return compatibilityFor({ ...filter, target, fieldInferredType: undefined }).reasonCodes.includes("row_filter_type_incompatible")
      ? []
      : ["Expected unknown field type rejection."];
  } },
  { name: "target unresolved blocks date filter", assert: () => compatibilityFor(filterFor({ targetResolved: false })).reasonCodes.includes("row_filter_target_unresolved") ? [] : ["Expected unresolved target."] },
  { name: "canonical target conflict blocks date filter", assert: () => compatibilityFor({ ...filterFor(), field: "created_at" }).reasonCodes.includes("row_filter_target_conflict") ? [] : ["Expected target conflict."] },
  { name: "valid date filter is structurally ready", assert: () => readinessFor(basePlan(filterFor())).status === "ready" ? [] : ["Expected date filter structurally ready."] },
  { name: "valid date field projection is structurally ready", assert: () => readinessFor(fieldProjectionPlan(filterFor())).status === "ready" ? [] : ["Expected date field projection ready."] },
  { name: "invalid date filter is structurally blocked", assert: () => readinessFor(basePlan(filterFor({ comparisonValue: dateValue("2026-02-29") }))).status === "blocked" ? [] : ["Expected invalid date structurally blocked."] },
  { name: "valid before is renderer-incapable", assert: () => {
    const capability = evaluateBusinessSqlRendererCapability(basePlan(filterFor({ operator: "before" })));
    return !capability.capable && capability.reasonCodes.includes("row_filter_rendering_not_supported") ? [] : ["Expected before renderer refusal."];
  } },
  { name: "valid after is renderer-incapable", assert: () => {
    const capability = evaluateBusinessSqlRendererCapability(basePlan(filterFor({ operator: "after" })));
    return !capability.capable && capability.reasonCodes.includes("row_filter_rendering_not_supported") ? [] : ["Expected after renderer refusal."];
  } },
  { name: "valid date does not emit date-specific rendering reason", assert: () => {
    const reasons = evaluateBusinessSqlRendererCapability(basePlan(filterFor())).reasonCodes as readonly string[];
    return !reasons.includes("row_filter_date_rendering_not_supported") &&
      !reasons.includes("row_filter_range_rendering_not_supported")
      ? []
      : ["Expected generic rendering reason only."];
  } },
  { name: "valid date emits no SQL and no actions", assert: () => noSqlAndNoActions(fieldProjectionPlan(filterFor())) ? [] : ["Expected no SQL/actions for date."] },
  { name: "invalid date emits no SQL and no actions", assert: () => noSqlAndNoActions(fieldProjectionPlan(filterFor({ comparisonValue: dateValue("2026-02-29") }))) ? [] : ["Expected invalid date no SQL/actions."] },
  { name: "before never renders DATE SQL", assert: () => {
    const result = renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "before" })));
    return result.sql === null ? [] : ["Expected before SQL null."];
  } },
  { name: "after never renders DATE SQL", assert: () => {
    const result = renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "after" })));
    return result.sql === null ? [] : ["Expected after SQL null."];
  } },
  { name: "before plus grouping emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(filterFor({ operator: "before" }))) ? [] : ["Expected before grouping no partial SQL."] },
  { name: "before plus HAVING emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(filterFor({ operator: "before" }), {
    aggregateResultConditions: [{
      conditionId: "business-sql-aggregate-condition:date-base-having",
      measureId: revenueMeasure.measureId,
      operator: "greater_than",
      comparisonValue: { kind: "number", value: 10 },
    }],
  })) ? [] : ["Expected before HAVING no partial SQL."] },
  { name: "after plus aggregate condition emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(filterFor({ operator: "after" }), {
    aggregateResultConditions: [{
      conditionId: "business-sql-aggregate-condition:date-after-having",
      measureId: revenueMeasure.measureId,
      operator: "less_than",
      comparisonValue: { kind: "number", value: 1000 },
    }],
  })) ? [] : ["Expected after aggregate condition no partial SQL."] },
  { name: "before plus ORDER BY emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(filterFor({ operator: "before" }), {
    orderBy: [{
      sortId: "business-sql-sort:date-revenue",
      target: { kind: "measure", measureId: revenueMeasure.measureId, resolved: true },
      direction: "desc",
    }],
  })) ? [] : ["Expected before ORDER BY no partial SQL."] },
  { name: "after plus rowLimit emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(filterFor({ operator: "after" }), {
    rowLimit: { rowLimitId: "business-sql-row-limit:5", value: 5 },
  })) ? [] : ["Expected after rowLimit no partial SQL."] },
  { name: "before plus resolved join emits no partial SQL", assert: () => noSqlAndNoActions(basePlan(filterFor({ table: "customers", entity: "customers" }), {
    entities: [sourceEntity, { entity: "customers", table: "customers", required: true, role: "filter_subject" }],
    joinPath: {
      required: true,
      status: "resolved",
      entities: ["orders", "customers"],
      requirements: [{ fromEntity: "orders", toEntity: "customers", required: true, relationship: "orders customer", verified: true }],
      edges: [{ fromEntity: "orders", fromTable: "orders", fromField: "customer_id", toEntity: "customers", toTable: "customers", toField: "customer_id", relationship: "orders customer", verified: true }],
    },
  })) ? [] : ["Expected before resolved join no partial SQL."] },
  { name: "manual insert gate remains closed for date", assert: () => !createBusinessSqlRenderPreview(fieldProjectionPlan(filterFor())).actions.canInsertSql ? [] : ["Expected insert gate closed."] },
  { name: "manual run gate remains closed for date", assert: () => !createBusinessSqlRenderPreview(fieldProjectionPlan(filterFor())).actions.canRunSql ? [] : ["Expected run gate closed."] },
  { name: "legacy ISO date semantic filter remains legacy", assert: () => {
    const legacyPlan = basePlan(null, { filters: [{ kind: "custom", table: "orders", field: "order_date", value: "2026-01-01", label: "Legacy date" }] });
    const capability = evaluateBusinessSqlRendererCapability(legacyPlan);
    return !renderBusinessSqlQueryPlan(legacyPlan).rendered &&
      capability.reasonCodes.includes("row_filter_legacy_semantics_not_renderable")
      ? []
      : ["Expected legacy ISO date blocked as legacy."];
  } },
  { name: "legacy natural-language date filter remains legacy", assert: () => {
    const legacyPlan = basePlan(null, { filters: [{ kind: "custom", table: "orders", field: "order_date", value: "January 1, 2026", label: "Legacy date" }] });
    return evaluateBusinessSqlRendererCapability(legacyPlan).reasonCodes.includes("row_filter_legacy_semantics_not_renderable")
      ? []
      : ["Expected natural-language date legacy reason."];
  } },
  { name: "multiple date filters remain unsupported", assert: () => {
    const capability = evaluateBusinessSqlRendererCapability(basePlan(null, { filters: [filterFor(), filterFor({ operator: "after" })] }));
    return capability.reasonCodes.includes("multiple_row_filters_not_supported") ? [] : ["Expected multiple-filter reason."];
  } },
  { name: "identical date filters share filterId", assert: () => filterFor({ comparisonValue: dateValue("2026-01-01") }).filterId === filterFor({ comparisonValue: dateValue("2026-01-01") }).filterId ? [] : ["Expected stable date ID."] },
  { name: "changing date changes filterId", assert: () => filterFor({ comparisonValue: dateValue("2026-01-01") }).filterId !== filterFor({ comparisonValue: dateValue("2026-01-02") }).filterId ? [] : ["Expected date ID change."] },
  { name: "changing operator changes filterId", assert: () => filterFor({ operator: "before" }).filterId !== filterFor({ operator: "after" }).filterId ? [] : ["Expected operator ID change."] },
  { name: "changing field changes filterId", assert: () => filterFor({ field: "order_date" }).filterId !== filterFor({ field: "created_at" }).filterId ? [] : ["Expected field ID change."] },
  { name: "relabeling does not change date filterId", assert: () => {
    const first = filterFor();
    const relabeled: BusinessSqlFilter = { ...first, label: "Other label", evidence: "Other evidence" };
    return first.filterId === createBusinessSqlFilterId(relabeled)
      ? []
      : ["Expected label-neutral ID."];
  } },
  { name: "date identity differs from string scalar", assert: () => filterFor().filterId !== filterFor({ operator: "equals", fieldInferredType: "text", comparisonValue: { kind: "string", value: "2026-01-31" } }).filterId ? [] : ["Expected date/string distinction."] },
  { name: "date identity differs from numeric scalar", assert: () => filterFor().filterId !== filterFor({ operator: "equals", fieldInferredType: "numeric", comparisonValue: { kind: "number", value: 20260131 } }).filterId ? [] : ["Expected date/numeric distinction."] },
  { name: "date identity differs from set", assert: () => filterFor().filterId !== filterFor({ operator: "in", fieldInferredType: "categorical", comparisonValue: setValue("string", ["2026-01-31"]) }).filterId ? [] : ["Expected date/set distinction."] },
  { name: "date identity differs from range", assert: () => filterFor().filterId !== filterFor({ operator: "between", field: "order_amount", fieldInferredType: "numeric", comparisonValue: rangeValue(1, 10) }).filterId ? [] : ["Expected date/range distinction."] },
  { name: "malformed date identity includes invalid-date", assert: () => filterFor({ comparisonValue: dateValue("2026-02-29") }).filterId?.includes("invalid-date") ? [] : ["Expected invalid-date identity."] },
  { name: "non-string date identity includes invalid-date", assert: () => filterFor({ comparisonValue: dateValue(20260101) }).filterId?.includes("invalid-date") ? [] : ["Expected non-string invalid-date identity."] },
  { name: "valid date identity includes valid-date", assert: () => filterFor({ comparisonValue: dateValue("2024-02-29") }).filterId?.includes("valid-date") ? [] : ["Expected valid-date identity."] },
  { name: "malformed date IDs differ by value", assert: () => filterFor({ comparisonValue: dateValue("2026-02-29") }).filterId !== filterFor({ comparisonValue: dateValue("2026-02-30") }).filterId ? [] : ["Expected malformed value distinction."] },
  { name: "date valueKind must be date", assert: () => compatibilityFor(filterFor({ comparisonValue: dateValue("2026-01-01", "string") })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected valueKind rejection."] },
  { name: "malformed date valueKind identity differs", assert: () => filterFor({ comparisonValue: dateValue("2026-01-01") }).filterId !== filterFor({ comparisonValue: dateValue("2026-01-01", "string") }).filterId ? [] : ["Expected valueKind identity distinction."] },
  { name: "existing scalar WHERE remains renderable", assert: () => {
    const scalar = filterFor({ operator: "greater_than", field: "order_amount", fieldInferredType: "numeric", comparisonValue: { kind: "number", value: 1000 } });
    return renderBusinessSqlQueryPlan(fieldProjectionPlan(scalar)).sql?.includes('WHERE "orders"."order_amount" > 1000;') ? [] : ["Expected scalar SQL."]; 
  } },
  { name: "existing IN WHERE remains byte-identical", assert: () => {
    const filter = filterFor({ operator: "in", field: "status", fieldInferredType: "categorical", comparisonValue: setValue("string", ["pending", "active"]) });
    return renderBusinessSqlQueryPlan(fieldProjectionPlan(filter)).sql === expectedInSql ? [] : ["Expected IN SQL unchanged."];
  } },
  { name: "existing BETWEEN WHERE remains byte-identical", assert: () => {
    const filter = filterFor({ operator: "between", field: "order_amount", fieldInferredType: "numeric", comparisonValue: rangeValue(100, 500) });
    return renderBusinessSqlQueryPlan(fieldProjectionPlan(filter)).sql === expectedRangeSql ? [] : ["Expected BETWEEN SQL unchanged."];
  } },
  { name: "empty filters remain renderer-capable", assert: () => evaluateBusinessSqlRendererCapability(basePlan(null)).capable ? [] : ["Expected empty filters capable."] },
  { name: "date contract does not add natural-language grounding", assert: () => {
    const legacy: BusinessSqlFilter = { kind: "custom", table: "orders", field: "order_date", value: "before 2026-01-01", label: "Legacy before date" };
    return !("comparisonValue" in legacy) && !renderBusinessSqlQueryPlan(basePlan(null, { filters: [legacy] })).rendered
      ? []
      : ["Expected no natural-language date grounding."];
  } },
];

export function runBusinessSqlDateFilterContractFixtures(): BusinessSqlDateFilterContractFixtureReport {
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

export const businessSqlDateFilterContractFixturesPass =
  runBusinessSqlDateFilterContractFixtures().failed.length === 0;
