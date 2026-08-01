/** PS-4a - derived-measure sort and aggregate-condition target contract fixtures. */

import {
  attachBusinessSqlJoinResolutionToPlan,
} from "../businessSqlQueryPlanJoinResolution";
import {
  createBusinessSqlAggregateResultConditionId,
  createBusinessSqlDerivedMeasureId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlSortId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlAggregateResultCondition,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
  type BusinessSqlSortTarget,
} from "../businessSqlQueryPlan";
import { evaluateBusinessSqlAggregateResultConditionCompatibility } from "../businessSqlAggregateResultConditionCompatibility";
import { evaluateBusinessSqlPlanReadiness } from "../businessSqlPlanReadiness";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import { renderBusinessSqlQueryPlan } from "../businessSqlRenderer";
import { evaluateBusinessSqlRendererCapability } from "../businessSqlRendererCapability";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

export type BusinessSqlDerivedMeasureTargetsFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const sourceEntity = {
  entity: "finance",
  table: "finance",
  required: true,
  role: "source" as const,
};

const grouping = {
  entity: "finance",
  table: "finance",
  field: "region",
  label: "region",
};

const measure = ({
  table = "finance",
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
    fieldInferredType: kind === "count_entities" ? "text" : "numeric",
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
};

const leftMeasure = measure({ field: "revenue", label: "Total revenue" });
const rightMeasure = measure({ field: "cost", label: "Total cost" });

const derivedSeed = {
  operator: "subtract" as const,
  leftMeasureId: leftMeasure.measureId,
  rightMeasureId: rightMeasure.measureId,
};

const derivedMeasure = {
  ...derivedSeed,
  derivedMeasureId: createBusinessSqlDerivedMeasureId(derivedSeed),
  sqlAlias: "profit",
  label: "Profit",
};

const basePlan = (): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:derived-targets",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [sourceEntity],
  metric: null,
  measures: [leftMeasure, rightMeasure],
  derivedMeasures: [derivedMeasure],
  groupings: [grouping],
});

const readinessFor = (plan: BusinessSqlQueryPlan) =>
  evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

const conditionFor = (
  overrides: Partial<BusinessSqlAggregateResultCondition> = {},
): BusinessSqlAggregateResultCondition => {
  const seed = {
    target: { kind: "measure" as const, measureId: leftMeasure.measureId },
    operator: "greater_than" as const,
    comparisonValue: { kind: "number" as const, value: 10 },
    ...overrides,
  };
  return {
    ...seed,
    conditionId: overrides.conditionId || createBusinessSqlAggregateResultConditionId(seed),
    label: overrides.label || "Measure above 10",
  };
};

const derivedConditionFor = (
  overrides: Partial<BusinessSqlAggregateResultCondition> = {},
): BusinessSqlAggregateResultCondition => {
  const seed = {
    target: { kind: "derived_measure" as const, derivedMeasureId: derivedMeasure.derivedMeasureId },
    operator: "greater_than" as const,
    comparisonValue: { kind: "number" as const, value: 10 },
    ...overrides,
  };
  return {
    ...seed,
    conditionId: overrides.conditionId || createBusinessSqlAggregateResultConditionId(seed),
    label: overrides.label || "Derived measure above 10",
  };
};

const withSort = (target: BusinessSqlSortTarget): BusinessSqlQueryPlan => {
  const sort = {
    target,
    direction: "desc" as const,
  };
  return {
    ...basePlan(),
    orderBy: [
      {
        ...sort,
        sortId: createBusinessSqlSortId(sort),
      },
    ],
  };
};

const fixtures: Fixture[] = [
  {
    name: "base and derived targets are contract representable with stable distinct IDs",
    assert: () => {
      const baseTarget: BusinessSqlSortTarget = {
        kind: "measure",
        measureId: leftMeasure.measureId,
        resolved: true,
      };
      const derivedTarget: BusinessSqlSortTarget = {
        kind: "derived_measure",
        derivedMeasureId: derivedMeasure.derivedMeasureId,
        resolved: true,
        sqlAlias: "renamed_profit",
        label: "Renamed profit",
      };
      const baseSortId = createBusinessSqlSortId({ target: baseTarget, direction: "desc" });
      const derivedSortId = createBusinessSqlSortId({ target: derivedTarget, direction: "desc" });
      const relabeledDerivedSortId = createBusinessSqlSortId({
        target: { ...derivedTarget, sqlAlias: "other_alias", label: "Other label" },
        direction: "desc",
      });
      const derivedCondition = derivedConditionFor();
      const relabeledCondition = derivedConditionFor({
        label: "Other label",
        conditionId: undefined,
      });
      return [
        ...(baseSortId !== derivedSortId ? [] : ["Base and derived sort IDs must differ."]),
        ...(derivedSortId === relabeledDerivedSortId
          ? []
          : ["Derived sort ID must ignore alias and label."]),
        ...(derivedCondition.conditionId === relabeledCondition.conditionId
          ? []
          : ["Derived aggregate condition ID must ignore label."]),
        ...(derivedCondition.conditionId !== conditionFor().conditionId
          ? []
          : ["Base and derived aggregate condition IDs must differ."]),
      ];
    },
  },
  {
    name: "valid derived sort target is structurally ready but renderer-incapable",
    assert: () => {
      const plan = withSort({
        kind: "derived_measure",
        derivedMeasureId: derivedMeasure.derivedMeasureId,
        resolved: true,
      });
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      const rendered = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      return [
        ...(readiness.status === "ready" ? [] : ["Expected valid derived sort to be structurally ready."]),
        ...(capability.status === "incapable" &&
        capability.reasonCodes.includes("derived_measure_order_by_rendering_not_supported")
          ? []
          : ["Expected derived sort renderer incapability reason."]),
        ...(!rendered.rendered && rendered.sql === null ? [] : ["Derived sort must not render SQL."]),
        ...(preview.sql === null &&
        !preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Derived sort preview must expose no SQL actions."]),
      ];
    },
  },
  {
    name: "missing and ambiguous derived sort targets block structural readiness",
    assert: () => {
      const missing = readinessFor(withSort({
        kind: "derived_measure",
        derivedMeasureId: "business-sql-derived-measure:missing",
        resolved: true,
      }));
      const ambiguousPlan = withSort({
        kind: "derived_measure",
        derivedMeasureId: derivedMeasure.derivedMeasureId,
        resolved: true,
      });
      ambiguousPlan.derivedMeasures = [derivedMeasure, { ...derivedMeasure }];
      const ambiguous = readinessFor(ambiguousPlan);
      return [
        ...(missing.status !== "ready" &&
        missing.reasonCodes.includes("derived_sort_target_unresolved")
          ? []
          : ["Expected missing derived sort target to block readiness."]),
        ...(ambiguous.status !== "ready" &&
        ambiguous.reasonCodes.includes("derived_sort_target_ambiguous")
          ? []
          : ["Expected ambiguous derived sort target to block readiness."]),
      ];
    },
  },
  {
    name: "valid derived aggregate condition is structurally ready but renderer-incapable",
    assert: () => {
      const plan = {
        ...basePlan(),
        aggregateResultConditions: [derivedConditionFor()],
      };
      const compatibility = evaluateBusinessSqlAggregateResultConditionCompatibility({
        condition: plan.aggregateResultConditions[0],
        measures: plan.measures,
        derivedMeasures: plan.derivedMeasures,
      });
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      const rendered = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      return [
        ...(compatibility.compatible ? [] : ["Expected derived aggregate condition compatibility."]),
        ...(readiness.status === "ready" ? [] : ["Expected valid derived aggregate condition to be structurally ready."]),
        ...(capability.status === "incapable" &&
        capability.reasonCodes.includes("derived_measure_aggregate_condition_rendering_not_supported")
          ? []
          : ["Expected derived aggregate condition renderer incapability reason."]),
        ...(!rendered.rendered && rendered.sql === null
          ? []
          : ["Derived aggregate condition must not render SQL."]),
        ...(preview.sql === null &&
        !preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Derived aggregate condition preview must expose no SQL actions."]),
      ];
    },
  },
  {
    name: "invalid derived aggregate condition targets and values block readiness",
    assert: () => {
      const missing = readinessFor({
        ...basePlan(),
        aggregateResultConditions: [
          derivedConditionFor({
            target: {
              kind: "derived_measure",
              derivedMeasureId: "business-sql-derived-measure:missing",
            },
          }),
        ],
      });
      const invalidValue = readinessFor({
        ...basePlan(),
        aggregateResultConditions: [
          derivedConditionFor({
            comparisonValue: { kind: "number", value: Number.POSITIVE_INFINITY },
          }),
        ],
      });
      const invalidOperator = readinessFor({
        ...basePlan(),
        aggregateResultConditions: [
          derivedConditionFor({
            operator: "contains" as BusinessSqlAggregateResultCondition["operator"],
          }),
        ],
      });
      const bothTargets = readinessFor({
        ...basePlan(),
        aggregateResultConditions: [
          {
            ...derivedConditionFor(),
            measureId: leftMeasure.measureId,
          } as BusinessSqlAggregateResultCondition,
        ],
      });
      const neitherTarget = readinessFor({
        ...basePlan(),
        aggregateResultConditions: [
          {
            conditionId: "business-sql-aggregate-condition:invalid",
            operator: "greater_than",
            comparisonValue: { kind: "number", value: 10 },
          } as BusinessSqlAggregateResultCondition,
        ],
      });
      return [
        ...(missing.reasonCodes.includes("aggregate_condition_derived_measure_unresolved")
          ? []
          : ["Expected missing derived aggregate condition reason."]),
        ...(invalidValue.reasonCodes.includes("aggregate_condition_value_invalid")
          ? []
          : ["Expected invalid aggregate condition value reason."]),
        ...(invalidOperator.reasonCodes.includes("aggregate_condition_operator_unsupported")
          ? []
          : ["Expected unsupported aggregate condition operator reason."]),
        ...(bothTargets.reasonCodes.includes("aggregate_condition_target_invalid")
          ? []
          : ["Expected both-target malformed aggregate condition reason."]),
        ...(neitherTarget.reasonCodes.includes("aggregate_condition_target_invalid")
          ? []
          : ["Expected neither-target malformed aggregate condition reason."]),
      ];
    },
  },
  {
    name: "base measure ORDER BY and HAVING SQL remain byte-identical",
    assert: () => {
      const sortTarget: BusinessSqlSortTarget = {
        kind: "measure",
        measureId: leftMeasure.measureId,
        resolved: true,
      };
      const sort = {
        target: sortTarget,
        direction: "asc" as const,
      };
      const orderPlan = {
        ...createEmptyBusinessSqlQueryPlan(),
        id: "business-sql-plan:base-order",
        kind: "single_table_count_grouping" as const,
        status: "resolved" as const,
        support: "supported" as const,
        entities: [sourceEntity],
        metric: null,
        measures: [leftMeasure],
        groupings: [grouping],
        orderBy: [{ ...sort, sortId: createBusinessSqlSortId(sort) }],
      };
      const havingPlan = {
        ...orderPlan,
        id: "business-sql-plan:base-having",
        orderBy: [],
        aggregateResultConditions: [conditionFor()],
      };
      const expectedOrderSql = [
        "SELECT",
        '  "finance"."region" AS "region",',
        '  SUM("finance"."revenue") AS "total_revenue"',
        'FROM "finance"',
        'GROUP BY "finance"."region"',
        'ORDER BY "total_revenue" ASC;',
      ].join("\n");
      const expectedHavingSql = [
        "SELECT",
        '  "finance"."region" AS "region",',
        '  SUM("finance"."revenue") AS "total_revenue"',
        'FROM "finance"',
        'GROUP BY "finance"."region"',
        'HAVING SUM("finance"."revenue") > 10',
        'ORDER BY "total_revenue" DESC;',
      ].join("\n");
      return [
        ...(renderBusinessSqlQueryPlan(orderPlan).sql === expectedOrderSql
          ? []
          : ["Expected base ORDER BY SQL byte identity."]),
        ...(renderBusinessSqlQueryPlan(havingPlan).sql === expectedHavingSql
          ? []
          : ["Expected base HAVING SQL byte identity."]),
      ];
    },
  },
  {
    name: "existing derived SELECT SQL remains byte-identical without derived targeting",
    assert: () => {
      const result = renderBusinessSqlQueryPlan(basePlan());
      const expectedSql = [
        "SELECT",
        '  "finance"."region" AS "region",',
        '  SUM("finance"."revenue") AS "total_revenue",',
        '  SUM("finance"."cost") AS "total_cost",',
        '  (SUM("finance"."revenue")) - (SUM("finance"."cost")) AS "profit"',
        'FROM "finance"',
        'GROUP BY "finance"."region";',
      ].join("\n");
      return result.sql === expectedSql && result.inserted === false && result.ranQuery === false
        ? []
        : ["Expected existing derived SELECT SQL and manual workflow to remain unchanged."];
    },
  },
  {
    name: "divide without policy surfaces precise renderer capability reason",
    assert: () => {
      const seed = {
        operator: "divide" as const,
        leftMeasureId: leftMeasure.measureId,
        rightMeasureId: rightMeasure.measureId,
        divisionPolicy: undefined,
      };
      const plan = {
        ...basePlan(),
        derivedMeasures: [
          {
            ...seed,
            derivedMeasureId: createBusinessSqlDerivedMeasureId(seed),
            sqlAlias: "unsafe_divide",
          },
        ],
      };
      const capability = evaluateBusinessSqlRendererCapability(plan);
      return capability.status === "incapable" &&
        capability.reasonCodes.includes("derived_measure_division_policy_missing") &&
        !capability.reasonCodes.includes("derived_measure_operand_mismatch")
        ? []
        : ["Expected precise divide policy capability reason without operand mismatch."];
    },
  },
];

export function runBusinessSqlDerivedMeasureTargetsFixtures(): BusinessSqlDerivedMeasureTargetsFixtureReport {
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

export const businessSqlDerivedMeasureTargetsFixturesPass =
  runBusinessSqlDerivedMeasureTargetsFixtures().failed.length === 0;
