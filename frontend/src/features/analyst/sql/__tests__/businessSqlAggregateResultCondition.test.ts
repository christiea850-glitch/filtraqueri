/** PS-2a/PS-2b - aggregate-result condition contract and renderer fixtures. */

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
  createBusinessSqlRowLimitId,
  createBusinessSqlSortId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlAggregateComparisonOperator,
  type BusinessSqlAggregateResultCondition,
  type BusinessSqlMeasure,
  type BusinessSqlMeasureKind,
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

const measureFor = ({
  kind,
  table,
  field,
  label,
}: {
  kind: BusinessSqlMeasureKind;
  table: string;
  field?: string;
  label: string;
}): BusinessSqlMeasure => {
  const seed = {
    kind,
    entity: table,
    table,
    field,
    distinct: kind === "count_distinct",
  };
  return {
    ...seed,
    measureId: createBusinessSqlMeasureId(seed),
    fieldInferredType: kind === "count_rows" || kind === "count_entities" ? undefined : "numeric",
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
};

const conditionForMeasure = (
  measure: BusinessSqlMeasure,
  overrides: Partial<BusinessSqlAggregateResultCondition> = {},
): BusinessSqlAggregateResultCondition => {
  const seed = {
    measureId: measure.measureId,
    operator: "greater_than" as const,
    comparisonValue: { kind: "number" as const, value: 500000 },
  };
  const merged = {
    ...seed,
    label: `${measure.label} threshold`,
    ...overrides,
  };
  return {
    ...merged,
    conditionId:
      overrides.conditionId || createBusinessSqlAggregateResultConditionId(merged),
  };
};

const genericAggregatePlan = ({
  planId,
  table,
  groupingField,
  groupingLabel = groupingField,
  measure,
  threshold,
  operator = "greater_than",
  rowLimit,
  prompt,
}: {
  planId: string;
  table: string;
  groupingField: string;
  groupingLabel?: string;
  measure: BusinessSqlMeasure;
  threshold: number;
  operator?: BusinessSqlAggregateComparisonOperator;
  rowLimit?: number;
  prompt?: string;
}): BusinessSqlQueryPlan => {
  const sortTarget = { kind: "measure" as const, measureId: measure.measureId, resolved: true };
  return {
    ...createEmptyBusinessSqlQueryPlan(),
    id: planId,
    kind: "single_table_count_grouping",
    status: "resolved",
    support: "supported",
    prompt,
    entities: [{ entity: table, table, required: true, role: "source" }],
    metric: null,
    measures: [measure],
    groupings: [{ entity: table, table, field: groupingField, label: groupingLabel }],
    orderBy: [
      {
        sortId: createBusinessSqlSortId({ target: sortTarget, direction: "desc" }),
        target: sortTarget,
        direction: "desc",
      },
    ],
    rowLimit:
      rowLimit === undefined
        ? null
        : {
            value: rowLimit,
            rowLimitId: createBusinessSqlRowLimitId({ value: rowLimit }),
          },
    aggregateResultConditions: [
      conditionForMeasure(measure, {
        operator,
        comparisonValue: { kind: "number", value: threshold },
      }),
    ],
  };
};

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
    name: "one aggregate-result condition is structurally ready and renderer-capable",
    assert: () => {
      const plan = aggregatePlan({ aggregateResultConditions: [conditionFor()] });
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      return [
        ...(readiness.status === "ready"
          ? []
          : ["Expected one aggregate condition to remain structurally ready."]),
        ...(capability.capable &&
        !capability.reasonCodes.includes("aggregate_condition_multiple_not_supported")
          ? []
          : ["Expected one aggregate condition to be renderer-capable."]),
      ];
    },
  },
  {
    name: "one aggregate-result condition renders HAVING and preview SQL safely",
    assert: () => {
      const plan = aggregatePlan({ aggregateResultConditions: [conditionFor()] });
      const renderResult = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      return [
        ...(renderResult.rendered && renderResult.sql?.includes('HAVING SUM("employees"."salary") > 500000')
          ? []
          : ["Expected direct render to include the HAVING aggregate expression."]),
        ...(renderResult.sql?.includes("aggregate_condition_rendering_not_supported")
          ? ["Rendered SQL must not include renderer reason text."]
          : []),
        ...(preview.status === "ready" &&
        preview.sql?.includes('HAVING SUM("employees"."salary") > 500000') &&
        preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Expected render preview to expose SQL without insert or run actions."]),
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
  {
    name: "six operators render fixed deterministic SQL tokens",
    assert: () => {
      const tokens: Record<BusinessSqlAggregateComparisonOperator, string> = {
        greater_than: ">",
        greater_than_or_equal: ">=",
        less_than: "<",
        less_than_or_equal: "<=",
        equals: "=",
        not_equals: "<>",
      };
      return operators.flatMap((operator) => {
        const plan = aggregatePlan({
          aggregateResultConditions: [conditionFor({ operator })],
        });
        const sql = sqlFor(plan) || "";
        const expected = `HAVING SUM("employees"."salary") ${tokens[operator]} 500000`;
        return sql.includes(expected)
          ? []
          : [`Expected ${operator} to render ${tokens[operator]}.`];
      });
    },
  },
  {
    name: "HAVING uses measure metadata instead of alias label array index or prompt text",
    assert: () => {
      const measure = {
        ...measureFor({
          kind: "sum",
          table: "finance",
          field: "revenue",
          label: "Friendly Alias That Must Not Be In Having",
        }),
        sqlAlias: "friendly_alias_that_must_not_be_in_having",
      };
      const plan = genericAggregatePlan({
        planId: "business-sql-plan:revenue-by-region-threshold",
        table: "finance",
        groupingField: "region",
        measure,
        threshold: 500000,
        prompt: "show regions above my secret prompt threshold",
      });
      const sql = sqlFor(plan) || "";
      return [
        ...(sql.includes('HAVING SUM("finance"."revenue") > 500000')
          ? []
          : ["Expected HAVING to be derived from measure table and field metadata."]),
        ...(sql.includes("Friendly Alias That Must Not Be In Having") ||
        sql.includes('HAVING "friendly_alias_that_must_not_be_in_having"') ||
        sql.includes("secret prompt threshold")
          ? ["HAVING must not use labels, aliases, or prompt text."]
          : []),
      ];
    },
  },
  {
    name: "SUM AVG and COUNT threshold plans render deterministic HAVING SQL",
    assert: () => {
      const revenuePlan = genericAggregatePlan({
        planId: "business-sql-plan:revenue-by-region-threshold",
        table: "finance",
        groupingField: "region",
        measure: measureFor({
          kind: "sum",
          table: "finance",
          field: "revenue",
          label: "Total revenue",
        }),
        threshold: 500000,
      });
      const stayPlan = genericAggregatePlan({
        planId: "business-sql-plan:length-of-stay-by-unit-threshold",
        table: "stays",
        groupingField: "hospital_unit",
        measure: measureFor({
          kind: "average",
          table: "stays",
          field: "length_of_stay",
          label: "Average length of stay",
        }),
        threshold: 5,
      });
      const countPlan = genericAggregatePlan({
        planId: "business-sql-plan:shipments-by-warehouse-threshold",
        table: "shipments",
        groupingField: "warehouse",
        measure: measureFor({
          kind: "count_entities",
          table: "shipments",
          field: "shipment_id",
          label: "Shipment count",
        }),
        threshold: 100,
      });
      const expectedRevenueSql = [
        "SELECT",
        '  "finance"."region" AS "region",',
        '  SUM("finance"."revenue") AS "total_revenue"',
        'FROM "finance"',
        'GROUP BY "finance"."region"',
        'HAVING SUM("finance"."revenue") > 500000',
        'ORDER BY "total_revenue" DESC;',
      ].join("\n");
      const expectedStaySql = [
        "SELECT",
        '  "stays"."hospital_unit" AS "hospital_unit",',
        '  AVG("stays"."length_of_stay") AS "average_length_of_stay"',
        'FROM "stays"',
        'GROUP BY "stays"."hospital_unit"',
        'HAVING AVG("stays"."length_of_stay") > 5',
        'ORDER BY "average_length_of_stay" DESC;',
      ].join("\n");
      const expectedCountSql = [
        "SELECT",
        '  "shipments"."warehouse" AS "warehouse",',
        '  COUNT("shipments"."shipment_id") AS "shipment_count"',
        'FROM "shipments"',
        'GROUP BY "shipments"."warehouse"',
        'HAVING COUNT("shipments"."shipment_id") > 100',
        'ORDER BY "shipment_count" DESC;',
      ].join("\n");
      return [
        ...(sqlFor(revenuePlan) === expectedRevenueSql
          ? []
          : ["Expected deterministic SUM HAVING SQL."]),
        ...(sqlFor(stayPlan) === expectedStaySql
          ? []
          : ["Expected deterministic AVG HAVING SQL."]),
        ...(sqlFor(countPlan) === expectedCountSql
          ? []
          : ["Expected deterministic COUNT HAVING SQL."]),
      ];
    },
  },
  {
    name: "HAVING renders after GROUP BY and before ORDER BY and LIMIT",
    assert: () => {
      const plan = genericAggregatePlan({
        planId: "business-sql-plan:salary-by-department-threshold-limit",
        table: "employees",
        groupingField: "department",
        measure: salaryMeasure,
        threshold: 500000,
        rowLimit: 5,
      });
      const sql = sqlFor(plan) || "";
      const groupByIndex = sql.indexOf("GROUP BY");
      const havingIndex = sql.indexOf("HAVING");
      const orderByIndex = sql.indexOf("ORDER BY");
      const limitIndex = sql.indexOf("LIMIT");
      return groupByIndex < havingIndex &&
        havingIndex < orderByIndex &&
        orderByIndex < limitIndex
        ? []
        : ["Expected GROUP BY, HAVING, ORDER BY, LIMIT clause order."];
    },
  },
  {
    name: "invalid or unresolved aggregate-result conditions produce no SQL",
    assert: () => {
      const unresolved = renderBusinessSqlQueryPlan(
        aggregatePlan({
          aggregateResultConditions: [
            conditionFor({ measureId: "business-sql-measure:missing" }),
          ],
        }),
      );
      const invalidValue = renderBusinessSqlQueryPlan(
        aggregatePlan({
          aggregateResultConditions: [
            conditionFor({ comparisonValue: { kind: "number", value: Number.POSITIVE_INFINITY } }),
          ],
        }),
      );
      return [
        ...(!unresolved.rendered && unresolved.sql === null
          ? []
          : ["Expected unresolved condition to produce no SQL."]),
        ...(!invalidValue.rendered && invalidValue.sql === null
          ? []
          : ["Expected invalid condition value to produce no SQL."]),
      ];
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
