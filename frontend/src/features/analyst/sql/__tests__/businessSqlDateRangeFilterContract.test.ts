/** PS-7d - canonical inclusive date-range row-filter contract fixtures. */

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
import { detectBusinessIntent } from "../businessIntentGrounding";
import { proposeAdaptiveReport } from "../adaptiveReportProposal";
import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type { WorksheetMetadata } from "../../../workbook";

type FixtureResult = { name: string; ok: boolean; failureReasons: string[] };
type Fixture = { name: string; assert: () => string[] };

export type BusinessSqlDateRangeFilterContractFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const sourceEntity = { entity: "orders", table: "orders", required: true, role: "source" as const };
const grouping = { entity: "orders", table: "orders", field: "region", label: "region" };

const measure = ({
  field,
  label,
  table = "orders",
  kind = "sum" as const,
}: {
  field?: string;
  label: string;
  table?: string;
  kind?: BusinessSqlMeasure["kind"];
}): BusinessSqlMeasure => {
  const seed = { kind, entity: table, table, field, distinct: false };
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

const numericRangeValue = (lower = 100, upper = 500): BusinessSqlFilterComparisonValue => ({
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

const dateValue = (value = "2026-01-01"): BusinessSqlFilterComparisonValue => ({
  kind: "date",
  valueKind: "date",
  value,
});

const filterFor = ({
  operator = "between",
  comparisonValue = dateRangeValue(),
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
    target: { kind: "field", entity, table, field, fieldInferredType, resolved: targetResolved },
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
  id: "business-sql-plan:date-range-filter-contract",
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
  id: "business-sql-plan:date-range-field-projection",
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
  return {
    ...seed,
    derivedMeasureId: createBusinessSqlDerivedMeasureId(seed),
    sqlAlias: "revenue_divided_by_cost",
  };
};

const compatibilityFor = (filter: BusinessSqlFilter) => evaluateBusinessSqlFilterCompatibility({ filter });
const readinessFor = (plan: BusinessSqlQueryPlan) =>
  evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

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

const expectedNumericBetweenSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" BETWEEN 100 AND 500;',
].join("\n");

const expectedScalarSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" > 1000;',
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

const invalidEndpointCases = [
  ["Invalid lower month blocks", dateRangeValue("2026-00-01", "2026-12-31")],
  ["Invalid upper month blocks", dateRangeValue("2026-01-01", "2026-13-31")],
  ["Invalid lower day blocks", dateRangeValue("2026-01-00", "2026-12-31")],
  ["Invalid upper day blocks", dateRangeValue("2026-01-01", "2026-12-32")],
  ["Impossible lower date blocks", dateRangeValue("2026-02-29", "2026-12-31")],
  ["Impossible upper date blocks", dateRangeValue("2026-01-01", "1900-02-29")],
  ["Non-padded lower date blocks", dateRangeValue("2026-2-01", "2026-12-31")],
  ["Non-padded upper date blocks", dateRangeValue("2026-01-01", "2026-2-01")],
  ["Slash lower date blocks", dateRangeValue("2026/01/01", "2026-12-31")],
  ["Slash upper date blocks", dateRangeValue("2026-01-01", "2026/12/31")],
  ["Datetime lower blocks", dateRangeValue("2026-01-01T00:00:00", "2026-12-31")],
  ["Datetime upper blocks", dateRangeValue("2026-01-01", "2026-12-31T00:00:00")],
  ["Timestamp lower blocks", dateRangeValue("2026-01-01Z", "2026-12-31")],
  ["Timestamp upper blocks", dateRangeValue("2026-01-01", "2026-12-31Z")],
  ["Empty lower blocks", dateRangeValue("", "2026-12-31")],
  ["Empty upper blocks", dateRangeValue("2026-01-01", "")],
  ["Whitespace lower blocks", dateRangeValue("   ", "2026-12-31")],
  ["Whitespace upper blocks", dateRangeValue("2026-01-01", "   ")],
  ["Raw SQL-like lower blocks", dateRangeValue("2026-01-01' OR 1=1 --", "2026-12-31")],
] as const;

const runtimeEndpointCases = [
  ["Runtime numeric lower blocks", dateRangeValue(1, "2026-12-31")],
  ["Runtime numeric upper blocks", dateRangeValue("2026-01-01", 1)],
  ["Runtime boolean lower blocks", dateRangeValue(true, "2026-12-31")],
  ["Runtime boolean upper blocks", dateRangeValue("2026-01-01", false)],
  ["Runtime null lower blocks", dateRangeValue(null, "2026-12-31")],
  ["Runtime null upper blocks", dateRangeValue("2026-01-01", null)],
  ["Runtime undefined lower blocks", (() => {
    const value = dateRangeValue();
    (value as unknown as { lower?: unknown }).lower = undefined;
    return value;
  })()],
  ["Runtime undefined upper blocks", (() => {
    const value = dateRangeValue();
    (value as unknown as { upper?: unknown }).upper = undefined;
    return value;
  })()],
  ["Runtime object lower blocks", dateRangeValue({}, "2026-12-31")],
  ["Runtime object upper blocks", dateRangeValue("2026-01-01", {})],
  ["Runtime array lower blocks", dateRangeValue(["2026-01-01"], "2026-12-31")],
  ["Runtime array upper blocks", dateRangeValue("2026-01-01", ["2026-12-31"])],
  ["Missing lower blocks", (() => {
    const value = dateRangeValue();
    delete (value as unknown as { lower?: unknown }).lower;
    return value;
  })()],
  ["Missing upper blocks", (() => {
    const value = dateRangeValue();
    delete (value as unknown as { upper?: unknown }).upper;
    return value;
  })()],
] as const;

const malformedKindCases = [
  ["Invalid valueKind blocks", dateRangeValue("2026-01-01", "2026-12-31", { valueKind: "string" })],
  ["Missing valueKind blocks", (() => {
    const value = dateRangeValue();
    delete (value as unknown as { valueKind?: unknown }).valueKind;
    return value;
  })()],
  ["lowerInclusive false blocks", dateRangeValue("2026-01-01", "2026-12-31", { lowerInclusive: false })],
  ["upperInclusive false blocks", dateRangeValue("2026-01-01", "2026-12-31", { upperInclusive: false })],
  ["missing lowerInclusive blocks", (() => {
    const value = dateRangeValue();
    delete (value as unknown as { lowerInclusive?: unknown }).lowerInclusive;
    return value;
  })()],
  ["missing upperInclusive blocks", (() => {
    const value = dateRangeValue();
    delete (value as unknown as { upperInclusive?: unknown }).upperInclusive;
    return value;
  })()],
  ["string lowerInclusive blocks", dateRangeValue("2026-01-01", "2026-12-31", { lowerInclusive: "true" })],
  ["numeric upperInclusive blocks", dateRangeValue("2026-01-01", "2026-12-31", { upperInclusive: 1 })],
] as const;

const fieldTypeCases: readonly {
  name: string;
  fieldInferredType: BusinessSqlFilter["fieldInferredType"];
}[] = [
  { name: "Numeric field rejects date range", fieldInferredType: "numeric" },
  { name: "Text field rejects date range", fieldInferredType: "text" },
  { name: "Categorical field rejects date range", fieldInferredType: "categorical" },
  { name: "Boolean field rejects date range", fieldInferredType: "boolean" },
  { name: "Datetime field rejects date range", fieldInferredType: "datetime" as unknown as BusinessSqlFilter["fieldInferredType"] },
  { name: "Timestamp field rejects date range", fieldInferredType: "timestamp" as unknown as BusinessSqlFilter["fieldInferredType"] },
];

const wrongOperatorCases: readonly { name: string; operator: BusinessSqlFilterOperator }[] = [
  { name: "BEFORE rejects date range", operator: "before" },
  { name: "AFTER rejects date range", operator: "after" },
  { name: "Scalar operator rejects date range", operator: "equals" },
  { name: "Greater-than rejects date range", operator: "greater_than" },
  { name: "IN rejects date range", operator: "in" },
  { name: "NOT IN rejects date range", operator: "not_in" },
  { name: "Nullary operator rejects date range", operator: "is_null" },
];

const nlSql = (prompt: string): string | null => {
  const ordersSheet: Pick<WorksheetMetadata, "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema"> = {
    worksheetId: "orders",
    displayName: "orders",
    sheetName: "orders",
    tableName: "orders",
    schema: [
      { name: "order_id", type: "VARCHAR", inferred_type: "categorical", null_count: 0, unique_count: 0, sample_values: [] },
      { name: "order_date", type: "DATE", inferred_type: "date", null_count: 0, unique_count: 0, sample_values: [] },
      { name: "order_amount", type: "DOUBLE", inferred_type: "numeric", null_count: 0, unique_count: 0, sample_values: [] },
      { name: "status", type: "VARCHAR", inferred_type: "categorical", null_count: 0, unique_count: 0, sample_values: [] },
    ] satisfies SchemaColumn[],
  };
  const proposal = proposeAdaptiveReport({
    prompt,
    detectedIntent: detectBusinessIntent(prompt),
    appliedScopeSelections: [{ worksheetId: "orders", tableName: "orders", sourceType: "original" }],
    worksheets: [ordersSheet],
  });
  const bridge = createBusinessSqlPlanFromAdaptiveProposal({ proposal });
  return bridge.plan ? createBusinessSqlRenderPreview(bridge.plan).sql : null;
};

const fixtures: Fixture[] = [
  { name: "Canonical date range is representable", assert: () => dateRangeValue().kind === "range" ? [] : ["Expected range kind."] },
  { name: "Date range uses kind range", assert: () => dateRangeValue().kind === "range" ? [] : ["Expected range."] },
  { name: "Date range uses valueKind date", assert: () => {
    const value = dateRangeValue();
    return value.kind === "range" && value.valueKind === "date" ? [] : ["Expected date valueKind."];
  } },
  { name: "Lower endpoint is preserved", assert: () => (dateRangeValue("2024-02-29", "2024-03-01") as Extract<BusinessSqlFilterComparisonValue, { kind: "range" }>).lower === "2024-02-29" ? [] : ["Expected lower."] },
  { name: "Upper endpoint is preserved", assert: () => (dateRangeValue("2024-02-29", "2024-03-01") as Extract<BusinessSqlFilterComparisonValue, { kind: "range" }>).upper === "2024-03-01" ? [] : ["Expected upper."] },
  { name: "Lower inclusive must be true", assert: () => compatibilityFor(filterFor({ comparisonValue: dateRangeValue("2026-01-01", "2026-12-31", { lowerInclusive: false }) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected lowerInclusive true."] },
  { name: "Upper inclusive must be true", assert: () => compatibilityFor(filterFor({ comparisonValue: dateRangeValue("2026-01-01", "2026-12-31", { upperInclusive: false }) })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected upperInclusive true."] },
  { name: "Standard date range is valid", assert: () => compatibilityFor(filterFor()).compatible ? [] : ["Expected valid range."] },
  { name: "Leap-day lower endpoint is valid", assert: () => compatibilityFor(filterFor({ comparisonValue: dateRangeValue("2024-02-29", "2024-03-01") })).compatible ? [] : ["Expected leap lower."] },
  { name: "Leap-day upper endpoint is valid", assert: () => compatibilityFor(filterFor({ comparisonValue: dateRangeValue("2024-02-28", "2024-02-29") })).compatible ? [] : ["Expected leap upper."] },
  { name: "Century leap-day endpoint is valid", assert: () => compatibilityFor(filterFor({ comparisonValue: dateRangeValue("2000-02-29", "2000-12-31") })).compatible ? [] : ["Expected century leap."] },
  { name: "Equal date endpoints are valid", assert: () => compatibilityFor(filterFor({ comparisonValue: dateRangeValue("1900-03-01", "1900-03-01") })).compatible ? [] : ["Expected equal endpoints."] },
  { name: "Reversed date endpoints are invalid", assert: () => compatibilityFor(filterFor({ comparisonValue: dateRangeValue("2026-12-31", "2026-01-01") })).reasonCodes.includes("row_filter_value_invalid") ? [] : ["Expected reversed invalid."] },
  ...invalidEndpointCases.map(([name, value]): Fixture => ({
    name,
    assert: () => compatibilityFor(filterFor({ comparisonValue: value })).reasonCodes.includes("row_filter_value_invalid") ? [] : [`Expected ${name}.`],
  })),
  ...runtimeEndpointCases.map(([name, value]): Fixture => ({
    name,
    assert: () => compatibilityFor(filterFor({ comparisonValue: value })).reasonCodes.includes("row_filter_value_invalid") ? [] : [`Expected ${name}.`],
  })),
  ...malformedKindCases.map(([name, value]): Fixture => ({
    name,
    assert: () => compatibilityFor(filterFor({ comparisonValue: value })).reasonCodes.includes("row_filter_value_invalid") ? [] : [`Expected ${name}.`],
  })),
  { name: "BETWEEN accepts valid date range", assert: () => compatibilityFor(filterFor()).compatible ? [] : ["Expected date BETWEEN compatible."] },
  { name: "BETWEEN accepts valid numeric range", assert: () => compatibilityFor(filterFor({ field: "order_amount", fieldInferredType: "numeric", comparisonValue: numericRangeValue() })).compatible ? [] : ["Expected numeric BETWEEN compatible."] },
  ...wrongOperatorCases.map((entry): Fixture => ({
    name: entry.name,
    assert: () => compatibilityFor(filterFor({ operator: entry.operator })).reasonCodes.some((reason) => reason === "row_filter_type_incompatible" || reason === "row_filter_value_not_allowed") ? [] : [`Expected ${entry.name}.`],
  })),
  { name: "Date field accepts date range", assert: () => compatibilityFor(filterFor({ fieldInferredType: "date" })).compatible ? [] : ["Expected date field."] },
  ...fieldTypeCases.map((entry): Fixture => ({
    name: entry.name,
    assert: () => compatibilityFor(filterFor({ fieldInferredType: entry.fieldInferredType })).reasonCodes.includes("row_filter_type_incompatible") ? [] : [`Expected ${entry.name}.`],
  })),
  { name: "Unknown field rejects date range", assert: () => {
    const filter = filterFor();
    const target = filter.target?.kind === "field" ? { ...filter.target, fieldInferredType: undefined } : filter.target;
    return compatibilityFor({ ...filter, target, fieldInferredType: undefined }).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected unknown field rejection."];
  } },
  { name: "Date field rejects numeric range", assert: () => compatibilityFor(filterFor({ comparisonValue: numericRangeValue() })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected date field numeric rejection."] },
  { name: "Valid date range is structurally ready", assert: () => readinessFor(basePlan(filterFor())).status === "ready" ? [] : ["Expected ready date range."] },
  { name: "Reversed date range structurally blocks", assert: () => readinessFor(basePlan(filterFor({ comparisonValue: dateRangeValue("2026-12-31", "2026-01-01") }))).status === "blocked" ? [] : ["Expected reversed blocked."] },
  { name: "Malformed date range structurally blocks", assert: () => readinessFor(basePlan(filterFor({ comparisonValue: dateRangeValue("2026-02-29", "2026-12-31") }))).status === "blocked" ? [] : ["Expected malformed blocked."] },
  { name: "Wrong field type structurally blocks", assert: () => readinessFor(basePlan(filterFor({ fieldInferredType: "numeric" }))).status === "blocked" ? [] : ["Expected wrong type blocked."] },
  { name: "Valid date range becomes renderer-capable", assert: () => {
    const capability = evaluateBusinessSqlRendererCapability(basePlan(filterFor()));
    return capability.capable && capability.reasonCodes.length === 0 ? [] : ["Expected date range renderer capability."];
  } },
  { name: "Renderer emits date BETWEEN SQL", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).sql?.includes('WHERE "orders"."order_date" BETWEEN DATE \'2026-01-01\' AND DATE \'2026-12-31\';') ? [] : ["Expected date range SQL."] },
  { name: "Preview exposes copy-only actions for date range", assert: () => {
    const preview = createBusinessSqlRenderPreview(fieldProjectionPlan(filterFor()));
    return preview.sql?.includes("BETWEEN DATE") && preview.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql ? [] : ["Expected preview copy-only actions."];
  } },
  { name: "Date range plus grouping renders complete SQL", assert: () => renderBusinessSqlQueryPlan(basePlan(filterFor())).sql?.includes("GROUP BY") ? [] : ["Expected grouping SQL."] },
  { name: "Date range plus HAVING renders complete SQL", assert: () => renderBusinessSqlQueryPlan(basePlan(filterFor(), { aggregateResultConditions: [{ conditionId: "date-range-having", measureId: revenueMeasure.measureId, operator: "greater_than", comparisonValue: { kind: "number", value: 10 } }] })).sql?.includes("HAVING") ? [] : ["Expected HAVING SQL."] },
  { name: "Date range plus derived HAVING renders complete SQL", assert: () => {
    const derived = derivedMeasure();
    return renderBusinessSqlQueryPlan(basePlan(filterFor(), {
      measures: [revenueMeasure, costMeasure],
      derivedMeasures: [derived],
      aggregateResultConditions: [{ conditionId: "date-range-derived-having", target: { kind: "derived_measure", derivedMeasureId: derived.derivedMeasureId }, operator: "greater_than", comparisonValue: { kind: "number", value: 1 } }],
    })).sql?.includes("HAVING") ? [] : ["Expected derived HAVING SQL."];
  } },
  { name: "Date range plus ORDER BY renders complete SQL", assert: () => renderBusinessSqlQueryPlan(basePlan(filterFor(), { orderBy: [defaultSort()] })).sql?.includes("ORDER BY") ? [] : ["Expected ORDER BY SQL."] },
  { name: "Date range plus rowLimit renders complete SQL", assert: () => {
    const rowLimit = { value: 5 };
    return renderBusinessSqlQueryPlan(basePlan(filterFor(), { rowLimit: { ...rowLimit, rowLimitId: createBusinessSqlRowLimitId(rowLimit) } })).sql?.endsWith("LIMIT 5;") ? [] : ["Expected rowLimit SQL."];
  } },
  { name: "Date range plus resolved join renders complete SQL", assert: () => renderBusinessSqlQueryPlan(basePlan(filterFor({ table: "customers", entity: "customers", field: "signup_date" }), {
    entities: [sourceEntity, { entity: "customers", table: "customers", required: true, role: "filter_subject" }],
    joinPath: {
      required: true,
      status: "resolved",
      entities: ["orders", "customers"],
      requirements: [{ fromEntity: "orders", toEntity: "customers", required: true, relationship: "orders customer", verified: true }],
      edges: [{ fromEntity: "orders", fromTable: "orders", fromField: "customer_id", toEntity: "customers", toTable: "customers", toField: "customer_id", relationship: "orders customer", verified: true }],
    },
  })).sql?.includes('WHERE "customers"."signup_date" BETWEEN DATE') ? [] : ["Expected joined SQL."] },
  { name: "Identical date ranges share filterId", assert: () => filterFor().filterId === filterFor().filterId ? [] : ["Expected stable ID."] },
  { name: "Changing lower date changes filterId", assert: () => filterFor().filterId !== filterFor({ comparisonValue: dateRangeValue("2026-02-01", "2026-12-31") }).filterId ? [] : ["Expected lower-sensitive ID."] },
  { name: "Changing upper date changes filterId", assert: () => filterFor().filterId !== filterFor({ comparisonValue: dateRangeValue("2026-01-01", "2026-11-30") }).filterId ? [] : ["Expected upper-sensitive ID."] },
  { name: "Changing field changes filterId", assert: () => filterFor({ field: "order_date" }).filterId !== filterFor({ field: "signup_date" }).filterId ? [] : ["Expected field-sensitive ID."] },
  { name: "Relabeling does not change filterId", assert: () => {
    const filter = filterFor();
    const relabeled: BusinessSqlFilter = { ...filter, label: "Other label" };
    return filter.filterId === createBusinessSqlFilterId(relabeled) ? [] : ["Expected label-neutral ID."];
  } },
  { name: "Evidence does not change filterId", assert: () => {
    const filter = filterFor();
    const changed: BusinessSqlFilter = { ...filter, evidence: "Other evidence" };
    return filter.filterId === createBusinessSqlFilterId(changed) ? [] : ["Expected evidence-neutral ID."];
  } },
  { name: "Date-range identity differs from numeric range", assert: () => filterFor().filterId !== filterFor({ field: "order_amount", fieldInferredType: "numeric", comparisonValue: numericRangeValue() }).filterId ? [] : ["Expected numeric range distinction."] },
  { name: "Date-range identity differs from single date", assert: () => filterFor().filterId !== filterFor({ operator: "before", comparisonValue: dateValue() }).filterId ? [] : ["Expected single date distinction."] },
  { name: "Date-range identity differs from scalar", assert: () => filterFor().filterId !== filterFor({ operator: "equals", fieldInferredType: "text", comparisonValue: { kind: "string", value: "2026-01-01" } }).filterId ? [] : ["Expected scalar distinction."] },
  { name: "Date-range identity differs from set", assert: () => filterFor().filterId !== filterFor({ operator: "in", fieldInferredType: "categorical", comparisonValue: setValue("string", ["2026-01-01"]) }).filterId ? [] : ["Expected set distinction."] },
  { name: "Malformed lower receives invalid-range identity", assert: () => filterFor({ comparisonValue: dateRangeValue("2026-02-29", "2026-12-31") }).filterId?.includes("invalid-range") ? [] : ["Expected invalid lower identity."] },
  { name: "Malformed upper receives invalid-range identity", assert: () => filterFor({ comparisonValue: dateRangeValue("2026-01-01", "2026-02-29") }).filterId?.includes("invalid-range") ? [] : ["Expected invalid upper identity."] },
  { name: "Reversed range receives invalid-range identity", assert: () => filterFor({ comparisonValue: dateRangeValue("2026-12-31", "2026-01-01") }).filterId?.includes("invalid-range") ? [] : ["Expected reversed identity."] },
  { name: "Runtime endpoint receives invalid-range identity", assert: () => filterFor({ comparisonValue: dateRangeValue(1, "2026-12-31") }).filterId?.includes("invalid-range") ? [] : ["Expected runtime invalid identity."] },
  { name: "Invalid inclusivity receives invalid-range identity", assert: () => filterFor({ comparisonValue: dateRangeValue("2026-01-01", "2026-12-31", { lowerInclusive: false }) }).filterId?.includes("invalid-range") ? [] : ["Expected inclusivity invalid identity."] },
  { name: "Legacy date array remains refused", assert: () => noSqlAndNoActions(basePlan(null, { filters: [{ kind: "custom", table: "orders", field: "order_date", value: ["2026-01-01", "2026-12-31"], label: "Legacy date array" }] })) ? [] : ["Expected legacy date array refusal."] },
  { name: "Legacy date-range string remains refused", assert: () => noSqlAndNoActions(basePlan(null, { filters: [{ kind: "custom", table: "orders", field: "order_date", value: "2026-01-01 to 2026-12-31", label: "Legacy range" }] })) ? [] : ["Expected legacy string refusal."] },
  { name: "Canonical/legacy target conflict remains blocked", assert: () => compatibilityFor({ ...filterFor(), field: "created_at" }).reasonCodes.includes("row_filter_target_conflict") ? [] : ["Expected target conflict."] },
  { name: "Existing numeric BETWEEN SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ field: "order_amount", fieldInferredType: "numeric", comparisonValue: numericRangeValue() }))).sql === expectedNumericBetweenSql ? [] : ["Expected numeric BETWEEN SQL."] },
  { name: "Existing scalar SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "greater_than", field: "order_amount", fieldInferredType: "numeric", comparisonValue: { kind: "number", value: 1000 } }))).sql === expectedScalarSql ? [] : ["Expected scalar SQL."] },
  { name: "Existing IN SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "in", field: "status", fieldInferredType: "categorical", comparisonValue: setValue("string", ["pending", "active"]) }))).sql === expectedInSql ? [] : ["Expected IN SQL."] },
  { name: "Existing NOT IN SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "not_in", field: "status", fieldInferredType: "categorical", comparisonValue: setValue("string", ["pending", "closed"]) }))).sql === expectedNotInSql ? [] : ["Expected NOT IN SQL."] },
  { name: "Existing BEFORE SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "before", comparisonValue: dateValue() }))).sql === expectedBeforeSql ? [] : ["Expected BEFORE SQL."] },
  { name: "Existing AFTER SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor({ operator: "after", comparisonValue: dateValue() }))).sql === expectedAfterSql ? [] : ["Expected AFTER SQL."] },
  { name: "Existing scalar NL grounding remains green", assert: () => nlSql("Show order_id where order_amount is above 1000.")?.includes("> 1000") ? [] : ["Expected scalar NL."] },
  { name: "Existing IN/NOT IN NL grounding remains green", assert: () => [
    ...(nlSql("Show order_id where status is one of active, pending.")?.includes(" IN ") ? [] : ["Expected IN NL."]),
    ...(nlSql("Show order_id where status is not one of closed, pending.")?.includes(" NOT IN ") ? [] : ["Expected NOT IN NL."]),
  ] },
  { name: "Existing numeric BETWEEN NL grounding remains green", assert: () => nlSql("Show order_id where order_amount is between 100 and 500.")?.includes("BETWEEN 100 AND 500") ? [] : ["Expected BETWEEN NL."] },
  { name: "Existing BEFORE/AFTER NL grounding remains green", assert: () => [
    ...(nlSql("Show order_id where order_date is before 2026-01-01.") === expectedBeforeSql ? [] : ["Expected BEFORE NL."]),
    ...(nlSql("Show order_id where order_date is after 2026-01-01.") === expectedAfterSql ? [] : ["Expected AFTER NL."]),
  ] },
  { name: "Date-range NL grounding remains unsupported", assert: () => !nlSql("Show order_id where order_date is between 2026-01-01 and 2026-12-31.") ? [] : ["Expected date-range NL unsupported."] },
  { name: "filters empty SQL remains byte-identical", assert: () => renderBusinessSqlQueryPlan(basePlan(null)).sql === expectedEmptySql ? [] : ["Expected empty SQL."] },
  { name: "Explicit default ordering remains plan-driven", assert: () => basePlan(null).orderBy.length === 1 && renderBusinessSqlQueryPlan(basePlan(null)).sql === expectedEmptySql ? [] : ["Expected plan-driven ordering."] },
  { name: "Empty orderBy remains unsorted", assert: () => renderBusinessSqlQueryPlan(basePlan(null, { orderBy: [] })).sql === expectedEmptyUnsortedSql ? [] : ["Expected unsorted."] },
  { name: "No automatic Insert", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).inserted ? [] : ["Expected no insert."] },
  { name: "No automatic Run", assert: () => !renderBusinessSqlQueryPlan(fieldProjectionPlan(filterFor())).ranQuery ? [] : ["Expected no run."] },
];

export function runBusinessSqlDateRangeFilterContractFixtures(): BusinessSqlDateRangeFilterContractFixtureReport {
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

export const businessSqlDateRangeFilterContractFixturesPass =
  runBusinessSqlDateRangeFilterContractFixtures().failed.length === 0;
