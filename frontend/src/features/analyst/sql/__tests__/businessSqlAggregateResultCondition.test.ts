/** PS-2a - aggregate-result condition contract fixtures. */

import { evaluateBusinessSqlAggregateResultConditionCompatibility } from "../businessSqlAggregateResultConditionCompatibility";
import { evaluateBusinessSqlPlanReadiness } from "../businessSqlPlanReadiness";
import { evaluateBusinessSqlRendererCapability } from "../businessSqlRendererCapability";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import { renderBusinessSqlQueryPlan } from "../businessSqlRenderer";
import { attachBusinessSqlJoinResolutionToPlan } from "../businessSqlQueryPlanJoinResolution";
import {
  createBusinessSqlAggregateResultConditionId,
  createBlockedBusinessSqlQueryPlan,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlAggregateComparisonOperator,
  type BusinessSqlAggregateResultCondition,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";

type Fixture = {
  name: string;
  assert: () => string[];
};

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

const operators: readonly BusinessSqlAggregateComparisonOperator[] = [
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "equals",
  "not_equals",
];

const salaryMeasureSeed = {
  kind: "sum" as const,
  entity: "employees",
  table: "employees",
  field: "salary",
  distinct: false,
};

const salaryMeasure: BusinessSqlMeasure = {
  ...salaryMeasureSeed,
  measureId: createBusinessSqlMeasureId(salaryMeasureSeed),
  fieldInferredType: "numeric",
  label: "Total salary expenditure",
  sqlAlias: createBusinessSqlMeasureAlias("Total salary expenditure"),
};

const conditionFor = (
  overrides: Partial<BusinessSqlAggregateResultCondition> = {},
): BusinessSqlAggregateResultCondition => {
  const seed = {
    measureId: salaryMeasure.measureId,
    operator: "greater_than" as const,
    comparisonValue: { kind: "number" as const, value: 500000 },
  };
  const merged = {
    ...seed,
    label: "Total salary expenditure above 500000",
    ...overrides,
  };

  return {
    ...merged,
    conditionId:
      overrides.conditionId || createBusinessSqlAggregateResultConditionId(merged),
  };
};

const aggregatePlan = (
  overrides: Partial<BusinessSqlQueryPlan> = {},
): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:salary-threshold-contract",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [{ entity: "employees", table: "employees", required: true, role: "source" }],
  metric: null,
  measures: [salaryMeasure],
  groupings: [
    { entity: "employees", table: "employees", field: "department", label: "department" },
  ],
  aggregateResultConditions: [],
  ...overrides,
});

const readinessFor = (plan: BusinessSqlQueryPlan) =>
  evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

const aggregateReasonCodesFor = (plan: BusinessSqlQueryPlan): string[] =>
  readinessFor(plan).reasonCodes.filter((reasonCode) =>
    reasonCode.startsWith("aggregate_condition_"),
  );

const sqlFor = (plan: BusinessSqlQueryPlan): string | null => {
  const result = renderBusinessSqlQueryPlan(plan);
  return result.rendered ? result.sql : null;
};

const fixtures: Fixture[] = [
  {
    name: "empty and blocked plans default aggregate-result conditions to an empty array",
    assert: () => {
      const empty = createEmptyBusinessSqlQueryPlan();
      const blocked = createBlockedBusinessSqlQueryPlan("No safe aggregate-result condition.");
      return Array.isArray(empty.aggregateResultConditions) &&
        empty.aggregateResultConditions.length === 0 &&
        Array.isArray(blocked.aggregateResultConditions) &&
        blocked.aggregateResultConditions.length === 0
        ? []
        : ["Expected aggregateResultConditions to default to []."];
    },
  },
  {
    name: "existing aggregate-free PS-1 plans remain structurally valid and renderer-capable",
    assert: () => {
      const plan = aggregatePlan();
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      return [
        ...(readiness.status === "ready" ? [] : ["Expected PS-1-style plan readiness."]),
        ...(capability.capable ? [] : ["Expected PS-1-style renderer capability."]),
        ...(aggregateReasonCodesFor(plan).length === 0
          ? []
          : ["Expected no aggregate-result condition readiness reasons."]),
      ];
    },
  },
  {
    name: "all first-slice aggregate comparison operators are representable",
    assert: () =>
      operators.flatMap((operator) => {
        const condition = conditionFor({ operator });
        const compatibility = evaluateBusinessSqlAggregateResultConditionCompatibility({
          condition,
          measures: [salaryMeasure],
        });
        return compatibility.compatible ? [] : [`Expected ${operator} to be supported.`];
      }),
  },
  {
    name: "valid conditions resolve referenced measures by stable measureId",
    assert: () => {
      const plan = aggregatePlan({ aggregateResultConditions: [conditionFor()] });
      return aggregateReasonCodesFor(plan).length === 0
        ? []
        : ["Expected a valid measureId reference to be structurally valid."];
    },
  },
  {
    name: "condition IDs are deterministic and independent of labels or array position",
    assert: () => {
      const first = conditionFor({ label: "Above threshold" });
      const second = conditionFor({ label: "Friendly display copy" });
      const reordered = [conditionFor({ operator: "less_than" }), second, first];
      return [
        ...(first.conditionId === second.conditionId
          ? []
          : ["Expected labels not to change condition IDs."]),
        ...(reordered[2].conditionId === first.conditionId
          ? []
          : ["Expected array position not to change condition IDs."]),
      ];
    },
  },
  {
    name: "missing measure references produce aggregate_condition_measure_unresolved",
    assert: () => {
      const plan = aggregatePlan({
        aggregateResultConditions: [
          conditionFor({ measureId: "business-sql-measure:missing" }),
        ],
      });
      return aggregateReasonCodesFor(plan).includes("aggregate_condition_measure_unresolved")
        ? []
        : ["Expected unresolved aggregate condition measure reason."];
    },
  },
  {
    name: "non-aggregate measure references produce aggregate_condition_measure_not_aggregate",
    assert: () => {
      const unsupportedMeasure = {
        ...salaryMeasure,
        measureId: "business-sql-measure:unsupported",
        kind: "median" as BusinessSqlMeasure["kind"],
      };
      const plan = aggregatePlan({
        measures: [unsupportedMeasure],
        aggregateResultConditions: [
          conditionFor({ measureId: unsupportedMeasure.measureId }),
        ],
      });
      return aggregateReasonCodesFor(plan).includes(
        "aggregate_condition_measure_not_aggregate",
      )
        ? []
        : ["Expected non-aggregate measure reason."];
    },
  },
  {
    name: "unsupported operators produce aggregate_condition_operator_unsupported",
    assert: () => {
      const plan = aggregatePlan({
        aggregateResultConditions: [
          conditionFor({ operator: "contains" as BusinessSqlAggregateComparisonOperator }),
        ],
      });
      return aggregateReasonCodesFor(plan).includes(
        "aggregate_condition_operator_unsupported",
      )
        ? []
        : ["Expected unsupported operator reason."];
    },
  },
  {
    name: "NaN and infinities produce aggregate_condition_value_invalid",
    assert: () =>
      [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].flatMap((value) => {
        const plan = aggregatePlan({
          aggregateResultConditions: [conditionFor({ comparisonValue: { kind: "number", value } })],
        });
        return aggregateReasonCodesFor(plan).includes("aggregate_condition_value_invalid")
          ? []
          : [`Expected invalid numeric threshold reason for ${String(value)}.`];
      }),
  },
  {
    name: "finite numeric thresholds are structurally valid",
    assert: () => {
      const readiness = readinessFor(
        aggregatePlan({ aggregateResultConditions: [conditionFor()] }),
      );
      return readiness.status === "ready" ? [] : ["Expected finite threshold readiness."];
    },
  },
  {
    name: "one aggregate-result condition is structurally ready but renderer-incapable until HAVING rendering",
    assert: () => {
      const plan = aggregatePlan({ aggregateResultConditions: [conditionFor()] });
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      return [
        ...(readiness.status === "ready"
          ? []
          : ["Expected one aggregate condition to remain structurally ready."]),
        ...(!capability.capable &&
        capability.reasonCodes.includes("aggregate_condition_rendering_not_supported")
          ? []
          : ["Expected one aggregate condition to be renderer-incapable until HAVING rendering."]),
      ];
    },
  },
  {
    name: "one aggregate-result condition cannot silently render incomplete SQL",
    assert: () => {
      const plan = aggregatePlan({ aggregateResultConditions: [conditionFor()] });
      const renderResult = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      return [
        ...(!renderResult.rendered && renderResult.sql === null
          ? []
          : ["Expected direct render to produce no SQL for aggregate conditions."]),
        ...(renderResult.reasonCode === "renderer_capability_incapable" &&
        renderResult.reasons.some((reason) =>
          reason.includes("aggregate_condition_rendering_not_supported"),
        )
          ? []
          : ["Expected direct render to expose aggregate condition incapability."]),
        ...(preview.status !== "ready" &&
        preview.sql === null &&
        !preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Expected render preview to remain blocked without SQL or actions."]),
      ];
    },
  },
  {
    name: "multiple aggregate-result conditions are structurally valid but renderer-incapable",
    assert: () => {
      const plan = aggregatePlan({
        aggregateResultConditions: [
          conditionFor(),
          conditionFor({ operator: "less_than", comparisonValue: { kind: "number", value: 900000 } }),
        ],
      });
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      return [
        ...(readiness.status === "ready"
          ? []
          : ["Expected multiple aggregate conditions to be structurally valid."]),
        ...(capability.reasonCodes.includes("aggregate_condition_multiple_not_supported")
          ? []
          : ["Expected renderer capability to reject multiple aggregate conditions."]),
        ...(!capability.reasonCodes.includes("aggregate_condition_rendering_not_supported")
          ? []
          : ["Expected multiple-condition reason to take precedence."]),
        ...((readiness.reasonCodes as string[]).includes(
          "aggregate_condition_multiple_not_supported",
        )
          ? ["Structural readiness must not include renderer capability reason."]
          : []),
      ];
    },
  },
  {
    name: "empty aggregate-result condition arrays leave existing SQL byte-identical",
    assert: () => {
      const baseline = aggregatePlan();
      const explicitEmpty = aggregatePlan({ aggregateResultConditions: [] });
      return sqlFor(baseline) === sqlFor(explicitEmpty)
        ? []
        : ["Expected empty aggregate conditions not to change rendered SQL."];
    },
  },
];

export function runBusinessSqlAggregateResultConditionFixtures() {
  const results: FixtureResult[] = fixtures.map((fixture) => {
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
