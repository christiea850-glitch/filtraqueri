/** PS-5a - row-level filter contract and premature-rendering safety fixtures. */

import {
  attachBusinessSqlJoinResolutionToPlan,
} from "../businessSqlQueryPlanJoinResolution";
import {
  createBusinessSqlAggregateResultConditionId,
  createBusinessSqlDerivedMeasureId,
  createBusinessSqlFilterId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlSortId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlAggregateResultCondition,
  type BusinessSqlDerivedMeasure,
  type BusinessSqlFilter,
  type BusinessSqlFilterOperator,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import {
  evaluateBusinessSqlFilterCompatibility,
  type BusinessSqlFilterAvailableField,
} from "../businessSqlFilterCompatibility";
import { evaluateBusinessSqlPlanReadiness } from "../businessSqlPlanReadiness";
import { evaluateBusinessSqlRendererCapability } from "../businessSqlRendererCapability";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import { renderBusinessSqlQueryPlan } from "../businessSqlRenderer";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

export type BusinessSqlRowFilterContractFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const sourceEntity = {
  entity: "operations",
  table: "operations",
  required: true,
  role: "source" as const,
};

const grouping = {
  entity: "operations",
  table: "operations",
  field: "region",
  label: "region",
};

const measure = ({
  table = "operations",
  field,
  label,
  kind = "sum" as const,
}: {
  table?: string;
  field: string;
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
    fieldInferredType: "numeric",
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
};

const amountMeasure = measure({ field: "amount", label: "Total amount" });
const costMeasure = measure({ field: "cost", label: "Total cost" });

const availableFields: BusinessSqlFilterAvailableField[] = [
  { entity: "operations", table: "operations", field: "status", fieldInferredType: "categorical" },
  { entity: "operations", table: "operations", field: "age", fieldInferredType: "numeric" },
  { entity: "operations", table: "operations", field: "amount", fieldInferredType: "numeric" },
  { entity: "operations", table: "operations", field: "discontinued", fieldInferredType: "boolean" },
  { entity: "operations", table: "operations", field: "priority", fieldInferredType: "text" },
];

const filterFor = (options: Partial<BusinessSqlFilter> & {
  field?: string;
  fieldInferredType?: BusinessSqlFilter["fieldInferredType"];
} = {}): BusinessSqlFilter => {
  const field = options.field || "status";
  const fieldInferredType = options.fieldInferredType || "categorical";
  const operator = options.operator || "equals";
  const comparisonValue = Object.prototype.hasOwnProperty.call(options, "comparisonValue")
    ? options.comparisonValue
    : { kind: "string" as const, value: "active" };
  const label = options.label || "Status is active";
  const filter: BusinessSqlFilter = {
    kind: "custom",
    target: options.target || {
      kind: "field",
      entity: "operations",
      table: "operations",
      field,
      fieldInferredType,
      resolved: true,
    },
    entity: "operations",
    table: "operations",
    field,
    fieldInferredType,
    operator,
    comparisonValue,
    label,
  };
  return {
    ...filter,
    filterId: createBusinessSqlFilterId(filter),
  };
};

const basePlan = (): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:row-filter-contract",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [sourceEntity],
  metric: null,
  measures: [amountMeasure],
  groupings: [grouping],
});

const derivedMeasure = (): BusinessSqlDerivedMeasure => {
  const seed = {
    operator: "subtract" as const,
    leftMeasureId: amountMeasure.measureId,
    rightMeasureId: costMeasure.measureId,
  };
  return {
    ...seed,
    derivedMeasureId: createBusinessSqlDerivedMeasureId(seed),
    sqlAlias: "amount_minus_cost",
  };
};

const derivedPlan = (): BusinessSqlQueryPlan => ({
  ...basePlan(),
  measures: [amountMeasure, costMeasure],
  derivedMeasures: [derivedMeasure()],
});

const conditionFor = (target: BusinessSqlAggregateResultCondition["target"] = {
  kind: "measure",
  measureId: amountMeasure.measureId,
}): BusinessSqlAggregateResultCondition => {
  const seed = {
    target,
    operator: "greater_than" as const,
    comparisonValue: { kind: "number" as const, value: 10 },
  };
  return {
    ...seed,
    conditionId: createBusinessSqlAggregateResultConditionId(seed),
    label: "Above 10",
  };
};

const planWithFilters = (
  filters: BusinessSqlFilter[],
  overrides: Partial<BusinessSqlQueryPlan> = {},
): BusinessSqlQueryPlan => ({
  ...basePlan(),
  ...overrides,
  filters,
});

const readinessFor = (plan: BusinessSqlQueryPlan) =>
  evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

const expectedNoFilterSql = [
  "SELECT",
  '  "operations"."region" AS "region",',
  '  SUM("operations"."amount") AS "total_amount"',
  'FROM "operations"',
  'GROUP BY "operations"."region"',
  'ORDER BY "total_amount" DESC;',
].join("\n");

const fixtures: Fixture[] = [
  {
    name: "canonical row filter contract is representable with stable semantic identity",
    assert: () => {
      const first = filterFor();
      const relabeled = { ...first, label: "Other label", evidence: "Other evidence" };
      const second = filterFor();
      const differentField = filterFor({
        field: "priority",
        fieldInferredType: "text",
        comparisonValue: { kind: "string", value: "active" },
      });
      return [
        ...(first.target?.kind === "field" &&
        first.target.table === "operations" &&
        first.target.field === "status" &&
        first.filterId
          ? []
          : ["Expected grounded field target and filterId."]),
        ...(first.filterId === second.filterId ? [] : ["Expected deterministic filter ID."]),
        ...(first.filterId === createBusinessSqlFilterId(relabeled)
          ? []
          : ["Filter ID must ignore label and evidence."]),
        ...(first.filterId !== differentField.filterId
          ? []
          : ["Different stable fields must not collide even with similar labels."]),
      ];
    },
  },
  {
    name: "closed operators and typed values validate generically",
    assert: () => {
      const validOperators: BusinessSqlFilterOperator[] = [
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
      const validResults = validOperators.map((operator) => {
        const filter = operator === "is_null" || operator === "is_not_null"
          ? filterFor({ operator, comparisonValue: undefined })
          : operator === "contains" || operator === "starts_with" || operator === "ends_with"
          ? filterFor({ field: "priority", fieldInferredType: "text", operator, comparisonValue: { kind: "string", value: "high" } })
          : operator === "greater_than" ||
            operator === "greater_than_or_equal" ||
            operator === "less_than" ||
            operator === "less_than_or_equal"
          ? filterFor({ field: "amount", fieldInferredType: "numeric", operator, comparisonValue: { kind: "number", value: 1000 } })
          : filterFor({ operator });
        return evaluateBusinessSqlFilterCompatibility({ filter, availableFields }).compatible;
      });
      const invalids = [
        evaluateBusinessSqlFilterCompatibility({
          filter: filterFor({ operator: "matches_regex" as BusinessSqlFilterOperator }),
          availableFields,
        }).reasonCodes,
        evaluateBusinessSqlFilterCompatibility({
          filter: filterFor({ field: "amount", fieldInferredType: "numeric", operator: "greater_than", comparisonValue: { kind: "number", value: Number.NaN } }),
          availableFields,
        }).reasonCodes,
        evaluateBusinessSqlFilterCompatibility({
          filter: filterFor({ field: "amount", fieldInferredType: "numeric", operator: "greater_than", comparisonValue: { kind: "number", value: Number.POSITIVE_INFINITY } }),
          availableFields,
        }).reasonCodes,
        evaluateBusinessSqlFilterCompatibility({
          filter: filterFor({ field: "amount", fieldInferredType: "numeric", operator: "greater_than", comparisonValue: { kind: "string", value: "100" } }),
          availableFields,
        }).reasonCodes,
        evaluateBusinessSqlFilterCompatibility({
          filter: filterFor({ field: "priority", fieldInferredType: "text", operator: "contains", comparisonValue: { kind: "number", value: 1 } }),
          availableFields,
        }).reasonCodes,
        evaluateBusinessSqlFilterCompatibility({
          filter: filterFor({ field: "discontinued", fieldInferredType: "boolean", operator: "equals", comparisonValue: { kind: "boolean", value: false } }),
          availableFields,
        }).reasonCodes,
        evaluateBusinessSqlFilterCompatibility({
          filter: filterFor({ operator: "equals", comparisonValue: undefined }),
          availableFields,
        }).reasonCodes,
        evaluateBusinessSqlFilterCompatibility({
          filter: filterFor({ operator: "is_null", comparisonValue: { kind: "string", value: "unexpected" } }),
          availableFields,
        }).reasonCodes,
      ];
      return [
        ...(validResults.every(Boolean) ? [] : ["Expected all supported operators to be representable."]),
        ...(invalids[0].includes("row_filter_operator_unsupported") ? [] : ["Expected arbitrary operator rejection."]),
        ...(invalids[1].includes("row_filter_value_invalid") ? [] : ["Expected NaN rejection."]),
        ...(invalids[2].includes("row_filter_value_invalid") ? [] : ["Expected Infinity rejection."]),
        ...(invalids[3].includes("row_filter_type_incompatible") ? [] : ["Expected string value rejected for numeric comparison."]),
        ...(invalids[4].includes("row_filter_type_incompatible") ? [] : ["Expected numeric value rejected for text operator."]),
        ...(invalids[5].length === 0 ? [] : ["Expected boolean equality to be compatible with boolean fields."]),
        ...(invalids[6].includes("row_filter_value_missing") ? [] : ["Expected missing required value rejection."]),
        ...(invalids[7].includes("row_filter_value_not_allowed") ? [] : ["Expected unexpected nullary value rejection."]),
      ];
    },
  },
  {
    name: "unresolved ambiguous invalid and scope-blocked filters are structurally rejected",
    assert: () => {
      const unresolved = evaluateBusinessSqlFilterCompatibility({
        filter: filterFor({ target: { kind: "field", table: "operations", field: "", resolved: false } }),
        availableFields,
      });
      const ambiguous = evaluateBusinessSqlFilterCompatibility({
        filter: filterFor(),
        availableFields: [
          ...availableFields,
          { entity: "operations", table: "operations", field: "status", fieldInferredType: "text" },
        ],
      });
      const aggregateTarget = evaluateBusinessSqlFilterCompatibility({
        filter: {
          ...filterFor(),
          target: { kind: "aggregate_result", measureId: amountMeasure.measureId } as unknown as BusinessSqlFilter["target"],
        },
      });
      const derivedTarget = evaluateBusinessSqlFilterCompatibility({
        filter: {
          ...filterFor(),
          target: { kind: "derived_measure", derivedMeasureId: "derived" } as unknown as BusinessSqlFilter["target"],
        },
      });
      const scope = evaluateBusinessSqlFilterCompatibility({
        filter: filterFor(),
        availableFields,
        scopeResolved: false,
      });
      const invalidPlanReadiness = readinessFor(planWithFilters([filterFor({ operator: "equals", comparisonValue: undefined })]));
      return [
        ...(unresolved.reasonCodes.includes("row_filter_target_unresolved") ? [] : ["Expected unresolved target reason."]),
        ...(ambiguous.reasonCodes.includes("row_filter_target_ambiguous") ? [] : ["Expected ambiguous target reason."]),
        ...(aggregateTarget.reasonCodes.includes("row_filter_target_invalid") ? [] : ["Expected aggregate row-filter target rejection."]),
        ...(derivedTarget.reasonCodes.includes("row_filter_target_invalid") ? [] : ["Expected derived row-filter target rejection."]),
        ...(scope.reasonCodes.includes("row_filter_scope_unresolved") ? [] : ["Expected unresolved scope reason."]),
        ...(invalidPlanReadiness.status === "blocked" &&
        invalidPlanReadiness.reasonCodes.includes("row_filter_value_missing")
          ? []
          : ["Expected invalid row filter to block structural readiness."]),
      ];
    },
  },
  {
    name: "one valid row filter is structurally ready but renderer-incapable",
    assert: () => {
      const plan = planWithFilters([filterFor()]);
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      const rendered = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      return [
        ...(readiness.status === "ready" ? [] : ["Expected valid row filter to be structurally ready."]),
        ...(capability.status === "incapable" &&
        capability.reasonCodes.includes("row_filter_rendering_not_supported")
          ? []
          : ["Expected row filter rendering capability guard."]),
        ...(!rendered.rendered && rendered.sql === null ? [] : ["Filtered plan must not render SQL."]),
        ...(rendered.inserted === false && rendered.ranQuery === false ? [] : ["Filtered plan must remain manual."]),
        ...(preview.sql === null &&
        !preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Filtered preview must expose no SQL actions."]),
      ];
    },
  },
  {
    name: "multiple filters are renderer-incapable without assuming logical composition",
    assert: () => {
      const plan = planWithFilters([
        filterFor(),
        filterFor({ field: "priority", fieldInferredType: "text", operator: "not_equals", comparisonValue: { kind: "string", value: "low" } }),
      ]);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      const rendered = renderBusinessSqlQueryPlan(plan);
      return [
        ...(capability.reasonCodes.includes("multiple_row_filters_not_supported")
          ? []
          : ["Expected multiple-row-filter renderer reason."]),
        ...(!rendered.rendered && rendered.sql === null ? [] : ["Multiple filters must produce no SQL."]),
      ];
    },
  },
  {
    name: "row filters never allow partial HAVING or ORDER BY fallback SQL",
    assert: () => {
      const filter = filterFor();
      const baseHavingPlan = planWithFilters([filter], {
        aggregateResultConditions: [conditionFor()],
      });
      const derived = derivedPlan();
      const derivedHavingPlan = planWithFilters([filter], {
        ...derived,
        aggregateResultConditions: [conditionFor({
          kind: "derived_measure",
          derivedMeasureId: derived.derivedMeasures[0].derivedMeasureId,
        })],
      });
      const sort = {
        target: {
          kind: "derived_measure" as const,
          derivedMeasureId: derived.derivedMeasures[0].derivedMeasureId,
          resolved: true,
        },
        direction: "desc" as const,
      };
      const derivedOrderPlan = planWithFilters([filter], {
        ...derived,
        orderBy: [{ ...sort, sortId: createBusinessSqlSortId(sort) }],
      });
      const results = [
        renderBusinessSqlQueryPlan(baseHavingPlan),
        renderBusinessSqlQueryPlan(derivedHavingPlan),
        renderBusinessSqlQueryPlan(derivedOrderPlan),
      ];
      return results.every((result) => !result.rendered && result.sql === null)
        ? []
        : ["Filtered plans with HAVING or ORDER BY must not render partial filter-free SQL."];
    },
  },
  {
    name: "filters empty preserves existing SQL byte identity",
    assert: () => {
      const result = renderBusinessSqlQueryPlan(basePlan());
      return result.sql === expectedNoFilterSql
        ? []
        : ["Expected filters: [] SQL to remain byte-identical."];
    },
  },
];

export function runBusinessSqlRowFilterContractFixtures(): BusinessSqlRowFilterContractFixtureReport {
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

export const businessSqlRowFilterContractFixturesPass =
  runBusinessSqlRowFilterContractFixtures().failed.length === 0;
