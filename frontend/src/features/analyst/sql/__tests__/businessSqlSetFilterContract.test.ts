/** PS-6 - canonical IN/NOT IN row-filter contract and rendering fixtures. */

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

export type BusinessSqlSetFilterContractFixtureReport = {
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

const setValue = (
  valueKind: "number" | "string" | "boolean",
  values: readonly (number | string | boolean)[],
): BusinessSqlFilterComparisonValue => ({
  kind: "set",
  valueKind,
  values,
});

const filterFor = ({
  operator = "in",
  field = "status",
  fieldInferredType = "categorical" as BusinessSqlFilter["fieldInferredType"],
  comparisonValue = setValue("string", ["active", "pending"]),
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
  id: "business-sql-plan:set-filter-contract",
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

const readinessFor = (plan: BusinessSqlQueryPlan) =>
  evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

const compatibilityFor = (filter: BusinessSqlFilter) =>
  evaluateBusinessSqlFilterCompatibility({ filter });

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
      conditionId: "business-sql-aggregate-condition:derived",
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

const expectedScalarSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" > 1000;',
].join("\n");

const fieldProjectionPlan = (
  filter: BusinessSqlFilter | null,
  {
    table = "orders",
    field = "order_id",
  }: {
    table?: string;
    field?: string;
  } = {},
): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:set-filter-field-projection",
  kind: "empty",
  status: "resolved",
  support: "supported",
  entities: [{ entity: table, table, required: true, role: "source" }],
  groupings: [{ entity: table, table, field, label: field }],
  filters: filter ? [filter] : [],
});

const expectedTextInSql = [
  "SELECT",
  '  "customers"."customer_id" AS "customer_id"',
  'FROM "customers"',
  'WHERE "customers"."status" IN (\'active\', \'pending\');',
].join("\n");

const expectedTextNotInSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."priority" NOT IN (\'cancelled\', \'closed\');',
].join("\n");

const expectedNumberInSql = [
  "SELECT",
  '  "inventory"."sku" AS "sku"',
  'FROM "inventory"',
  'WHERE "inventory"."warehouse_id" IN (10, 20, 30);',
].join("\n");

const expectedBooleanInSql = [
  "SELECT",
  '  "accounts"."account_id" AS "account_id"',
  'FROM "accounts"',
  'WHERE "accounts"."enabled" IN (FALSE, TRUE);',
].join("\n");

const expectedEmptySql = [
  "SELECT",
  '  "orders"."region" AS "region",',
  '  SUM("orders"."revenue") AS "total_revenue"',
  'FROM "orders"',
  'GROUP BY "orders"."region"',
  'ORDER BY "total_revenue" DESC;',
].join("\n");

const fixtures: Fixture[] = [
  {
    name: "number string and boolean set contracts are representable",
    assert: () => [
      ...(setValue("number", [1, 2]).kind === "set" ? [] : ["Expected number set."]),
      ...(setValue("string", ["a", "b"]).kind === "set" ? [] : ["Expected string set."]),
      ...(setValue("boolean", [true, false]).kind === "set" ? [] : ["Expected boolean set."]),
    ],
  },
  {
    name: "empty mixed invalid and unsafe set members are rejected",
    assert: () => {
      const cases = [
        filterFor({ comparisonValue: setValue("string", []) }),
        filterFor({ comparisonValue: setValue("number", [1, "2"]) }),
        filterFor({ comparisonValue: setValue("string", ["active", true]) }),
        filterFor({ field: "amount", fieldInferredType: "numeric", comparisonValue: setValue("number", [Number.NaN]) }),
        filterFor({ field: "amount", fieldInferredType: "numeric", comparisonValue: setValue("number", [Number.POSITIVE_INFINITY]) }),
        filterFor({ comparisonValue: setValue("string", [" "]) }),
        filterFor({ comparisonValue: setValue("string", ["bad\u0001value"]) }),
        filterFor({ comparisonValue: { kind: "set", valueKind: "string", values: [{}] } as unknown as BusinessSqlFilterComparisonValue }),
        filterFor({ comparisonValue: { kind: "set", valueKind: "string", values: [["active"]] } as unknown as BusinessSqlFilterComparisonValue }),
      ];
      return cases.every((filter) => compatibilityFor(filter).reasonCodes.includes("row_filter_value_invalid"))
        ? []
        : ["Expected invalid set members to produce row_filter_value_invalid."];
    },
  },
  {
    name: "operator value arity is enforced",
    assert: () => {
      const missingIn = compatibilityFor({ ...filterFor(), comparisonValue: undefined });
      const missingNotIn = compatibilityFor({ ...filterFor({ operator: "not_in" }), comparisonValue: undefined });
      const scalarRejectsSet = compatibilityFor(filterFor({ operator: "equals" }));
      const nullaryRejectsSet = compatibilityFor(filterFor({ operator: "is_null" }));
      const inRejectsScalar = compatibilityFor(filterFor({ comparisonValue: { kind: "string", value: "active" } }));
      const notInRejectsScalar = compatibilityFor(filterFor({ operator: "not_in", comparisonValue: { kind: "string", value: "active" } }));
      return [
        ...(missingIn.reasonCodes.includes("row_filter_value_missing") ? [] : ["Expected IN missing set rejection."]),
        ...(missingNotIn.reasonCodes.includes("row_filter_value_missing") ? [] : ["Expected NOT IN missing set rejection."]),
        ...(scalarRejectsSet.reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected scalar operator to reject set."]),
        ...(nullaryRejectsSet.reasonCodes.includes("row_filter_value_not_allowed") ? [] : ["Expected nullary operator to reject set."]),
        ...(inRejectsScalar.reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected IN to reject scalar."]),
        ...(notInRejectsScalar.reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected NOT IN to reject scalar."]),
      ];
    },
  },
  {
    name: "field type compatibility is generic",
    assert: () => [
      ...(compatibilityFor(filterFor({ field: "amount", fieldInferredType: "numeric", comparisonValue: setValue("number", [1]) })).compatible ? [] : ["Expected numeric field number set."]),
      ...(compatibilityFor(filterFor({ field: "amount", fieldInferredType: "numeric", comparisonValue: setValue("string", ["1"]) })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected numeric field to reject string set."]),
      ...(compatibilityFor(filterFor({ field: "description", fieldInferredType: "text", comparisonValue: setValue("string", ["urgent"]) })).compatible ? [] : ["Expected text field string set."]),
      ...(compatibilityFor(filterFor({ field: "description", fieldInferredType: "text", comparisonValue: setValue("number", [1]) })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected text field to reject number set."]),
      ...(compatibilityFor(filterFor({ field: "discontinued", fieldInferredType: "boolean", comparisonValue: setValue("boolean", [true]) })).compatible ? [] : ["Expected boolean field boolean set."]),
      ...(compatibilityFor(filterFor({ field: "discontinued", fieldInferredType: "boolean", comparisonValue: setValue("string", ["true"]) })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected boolean field to reject string set."]),
      ...(compatibilityFor(filterFor({ field: "created_at", fieldInferredType: "date", comparisonValue: setValue("string", ["2026-01-01"]) })).reasonCodes.includes("row_filter_type_incompatible") ? [] : ["Expected unsupported field type to block."]),
    ],
  },
  {
    name: "IN and NOT IN are structurally ready and renderer-capable",
    assert: () => {
      const inPlan = basePlan(filterFor());
      const notInPlan = basePlan(filterFor({ operator: "not_in" }));
      const inCapability = evaluateBusinessSqlRendererCapability(inPlan);
      const notInCapability = evaluateBusinessSqlRendererCapability(notInPlan);
      return [
        ...(readinessFor(inPlan).status === "ready" ? [] : ["Expected IN structural readiness."]),
        ...(readinessFor(notInPlan).status === "ready" ? [] : ["Expected NOT IN structural readiness."]),
        ...(inCapability.capable ? [] : ["Expected IN set renderer capability."]),
        ...(notInCapability.capable ? [] : ["Expected NOT IN set renderer capability."]),
        ...(!(inCapability.reasonCodes as readonly string[]).includes("row_filter_set_rendering_not_supported") ? [] : ["Expected no IN set rendering refusal."]),
        ...(!(notInCapability.reasonCodes as readonly string[]).includes("row_filter_set_rendering_not_supported") ? [] : ["Expected no NOT IN set rendering refusal."]),
      ];
    },
  },
  {
    name: "multiple filters become capable",
    assert: () => {
      const plan = basePlan(filterFor(), { filters: [filterFor(), filterFor({ field: "priority" })] });
      return evaluateBusinessSqlRendererCapability(plan).capable
        ? []
        : ["Expected multiple filters capability."];
    },
  },
  {
    name: "renderer and preview emit deterministic IN and NOT IN SQL",
    assert: () => {
      const inFilter = filterFor({
        table: "customers",
        entity: "customers",
        field: "status",
        comparisonValue: setValue("string", ["pending", "active", "active"]),
      });
      const notInFilter = filterFor({
        field: "priority",
        operator: "not_in",
        comparisonValue: setValue("string", ["closed", "cancelled"]),
      });
      const inPlan = fieldProjectionPlan(inFilter, { table: "customers", field: "customer_id" });
      const notInPlan = fieldProjectionPlan(notInFilter);
      const preview = createBusinessSqlRenderPreview(inPlan);
      return [
        ...(renderBusinessSqlQueryPlan(inPlan).sql === expectedTextInSql ? [] : ["Expected canonical text IN SQL."]),
        ...(renderBusinessSqlQueryPlan(notInPlan).sql === expectedTextNotInSql ? [] : ["Expected canonical text NOT IN SQL."]),
        ...(preview.sql === expectedTextInSql ? [] : ["Expected preview SQL to match renderer SQL."]),
        ...(preview.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql ? [] : ["Expected rendered SQL to remain behind manual insert/run gates."]),
      ];
    },
  },
  {
    name: "number boolean and apostrophe set literals render safely",
    assert: () => {
      const numberFilter = filterFor({
        table: "inventory",
        entity: "inventory",
        field: "warehouse_id",
        fieldInferredType: "numeric",
        comparisonValue: setValue("number", [30, 10, 20, 10]),
      });
      const booleanFilter = filterFor({
        table: "accounts",
        entity: "accounts",
        field: "enabled",
        fieldInferredType: "boolean",
        comparisonValue: setValue("boolean", [true, false, true]),
      });
      const apostropheFilter = filterFor({
        table: "customers",
        entity: "customers",
        field: "status",
        comparisonValue: setValue("string", ["O'Brien", "active"]),
      });
      const apostropheSql = renderBusinessSqlQueryPlan(fieldProjectionPlan(apostropheFilter, { table: "customers", field: "customer_id" })).sql || "";
      return [
        ...(renderBusinessSqlQueryPlan(fieldProjectionPlan(numberFilter, { table: "inventory", field: "sku" })).sql === expectedNumberInSql ? [] : ["Expected numeric IN SQL."]),
        ...(renderBusinessSqlQueryPlan(fieldProjectionPlan(booleanFilter, { table: "accounts", field: "account_id" })).sql === expectedBooleanInSql ? [] : ["Expected boolean IN SQL."]),
        ...(apostropheSql.includes("'O''Brien'") ? [] : ["Expected apostrophe escaping."]),
        ...(!apostropheSql.includes("O'Brien)") ? [] : ["Expected no raw apostrophe literal."]),
      ];
    },
  },
  {
    name: "IN combinations render complete SQL without dropping membership intent",
    assert: () => {
      const filter = filterFor();
      const rowLimit = { value: 5 };
      const plans = [
        basePlan(filter, {
          aggregateResultConditions: [{
            conditionId: "business-sql-aggregate-condition:base",
            measureId: revenueMeasure.measureId,
            operator: "greater_than",
            comparisonValue: { kind: "number", value: 10 },
          }],
        }),
        derivedConditionPlan(filter),
        basePlan(filter, { orderBy: [defaultSort()] }),
        basePlan(filter, { rowLimit: { ...rowLimit, rowLimitId: createBusinessSqlRowLimitId(rowLimit) } }),
        basePlan(filterFor({ table: "customers", entity: "customers", field: "segment" }), {
          entities: [
            { entity: "orders", table: "orders", required: true, role: "source" },
            { entity: "customers", table: "customers", required: true, role: "filter_subject" },
          ],
          joinPath: {
            required: true,
            status: "resolved",
            entities: ["orders", "customers"],
            requirements: [{
              fromEntity: "orders",
              toEntity: "customers",
              required: true,
              relationship: "orders customer",
              verified: true,
            }],
            edges: [{
              fromEntity: "orders",
              fromTable: "orders",
              fromField: "customer_id",
              toEntity: "customers",
              toTable: "customers",
              toField: "customer_id",
              relationship: "orders customer",
              verified: true,
            }],
          },
        }),
      ];
      const rendered = plans.map(renderBusinessSqlQueryPlan);
      return rendered.every((result) => result.rendered && result.sql?.includes(" IN ('active', 'pending')"))
        ? []
        : ["Expected complete IN SQL for supported clause combinations."];
    },
  },
  {
    name: "set filter identity is normalized type-aware and hardened for malformed members",
    assert: () => {
      const first = filterFor({ comparisonValue: setValue("string", ["active", "pending"]) });
      const reordered = filterFor({ comparisonValue: setValue("string", ["pending", "active"]) });
      const duplicate = filterFor({ comparisonValue: setValue("string", ["active", "active", "pending"]) });
      const changed = filterFor({ comparisonValue: setValue("string", ["active", "closed"]) });
      const caseChanged = filterFor({ comparisonValue: setValue("string", ["Active", "pending"]) });
      const notIn = filterFor({ operator: "not_in", comparisonValue: setValue("string", ["active", "pending"]) });
      const stringOne = filterFor({ comparisonValue: setValue("string", ["1"]) });
      const numberOne = filterFor({ field: "amount", fieldInferredType: "numeric", comparisonValue: setValue("number", [1]) });
      const booleanTrue = filterFor({ field: "enabled", fieldInferredType: "boolean", comparisonValue: setValue("boolean", [true]) });
      const stringTrue = filterFor({ comparisonValue: setValue("string", ["true"]) });
      const validSubset = filterFor({ field: "amount", fieldInferredType: "numeric", comparisonValue: setValue("number", [1, 2]) });
      const malformedSuperset = filterFor({ field: "amount", fieldInferredType: "numeric", comparisonValue: setValue("number", [1, 2, Number.NaN]) });
      const malformedOnly = filterFor({ field: "amount", fieldInferredType: "numeric", comparisonValue: setValue("number", [Number.NaN]) });
      const relabeled = { ...first, label: "Other", evidence: "Other" };
      return [
        ...(first.filterId === reordered.filterId ? [] : ["Expected authored order to be identity-neutral."]),
        ...(first.filterId === duplicate.filterId ? [] : ["Expected duplicate members to be identity-neutral."]),
        ...(first.filterId !== changed.filterId ? [] : ["Expected changed member to change ID."]),
        ...(first.filterId !== caseChanged.filterId ? [] : ["Expected case-distinct strings to change ID."]),
        ...(first.filterId !== notIn.filterId ? [] : ["Expected IN and NOT IN IDs to differ."]),
        ...(stringOne.filterId !== numberOne.filterId ? [] : ["Expected string 1 and number 1 not to collide."]),
        ...(booleanTrue.filterId !== stringTrue.filterId ? [] : ["Expected boolean true and string true not to collide."]),
        ...(validSubset.filterId !== malformedSuperset.filterId ? [] : ["Expected malformed superset not to collide with valid subset."]),
        ...(validSubset.filterId !== malformedOnly.filterId ? [] : ["Expected malformed-only set not to collide with valid set."]),
        ...(first.filterId === createBusinessSqlFilterId(relabeled) ? [] : ["Expected label/evidence to be ignored."]),
      ];
    },
  },
  {
    name: "legacy arrays remain non-canonical and target conflicts remain blocked",
    assert: () => {
      const legacy: BusinessSqlFilter = {
        kind: "custom",
        table: "orders",
        field: "status",
        value: ["active", "pending"],
        label: "Legacy array",
      };
      const legacyPlan = basePlan(null, { filters: [legacy] });
      const conflict = filterFor({
        field: "status",
        comparisonValue: setValue("string", ["active"]),
      });
      const conflictResult = compatibilityFor({ ...conflict, field: "priority" });
      return [
        ...(!renderBusinessSqlQueryPlan(legacyPlan).rendered ? [] : ["Expected legacy array filter not to render."]),
        ...(evaluateBusinessSqlRendererCapability(legacyPlan).reasonCodes.includes("row_filter_legacy_semantics_not_renderable") ? [] : ["Expected legacy render refusal."]),
        ...(conflictResult.reasonCodes.includes("row_filter_target_conflict") ? [] : ["Expected canonical legacy target conflict."]),
      ];
    },
  },
  {
    name: "existing scalar WHERE SQL remains byte-identical",
    assert: () => {
      const scalar = filterFor({
        field: "order_amount",
        fieldInferredType: "numeric",
        operator: "greater_than",
        comparisonValue: { kind: "number", value: 1000 },
      });
      return renderBusinessSqlQueryPlan(fieldProjectionPlan(scalar)).sql === expectedScalarSql
        ? []
        : ["Expected scalar WHERE byte identity."];
    },
  },
  {
    name: "filters empty SQL and default ordering remain byte-identical and plan-driven",
    assert: () => {
      const plan = basePlan(null);
      return [
        ...(renderBusinessSqlQueryPlan(plan).sql === expectedEmptySql ? [] : ["Expected filters empty byte identity."]),
        ...(plan.orderBy.length === 1 && plan.assumptions.length === 0 ? [] : ["Expected explicit orderBy metadata on fixture plan."]),
      ];
    },
  },
  {
    name: "no automatic Insert or Run",
    assert: () => {
      const rendered = renderBusinessSqlQueryPlan(basePlan(filterFor()));
      return !rendered.inserted && !rendered.ranQuery ? [] : ["Expected no insert/run."];
    },
  },
];

export function runBusinessSqlSetFilterContractFixtures(): BusinessSqlSetFilterContractFixtureReport {
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

export const businessSqlSetFilterContractFixturesPass =
  runBusinessSqlSetFilterContractFixtures().failed.length === 0;
