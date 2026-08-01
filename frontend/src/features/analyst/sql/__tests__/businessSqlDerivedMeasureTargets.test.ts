/** PS-4c - derived-measure ORDER BY and HAVING rendering fixtures. */

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
  type BusinessSqlDerivedMeasure,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
  type BusinessSqlSort,
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

const derivedFor = ({
  operator,
  sqlAlias,
  left = leftMeasure,
  right = rightMeasure,
}: {
  operator: BusinessSqlDerivedMeasure["operator"];
  sqlAlias: string;
  left?: BusinessSqlMeasure;
  right?: BusinessSqlMeasure;
}): BusinessSqlDerivedMeasure => {
  const seed = {
    operator,
    leftMeasureId: left.measureId,
    rightMeasureId: right.measureId,
    ...(operator === "divide"
      ? { divisionPolicy: { zeroDenominator: "null" as const } }
      : {}),
  };
  return {
    ...seed,
    derivedMeasureId: createBusinessSqlDerivedMeasureId(seed),
    sqlAlias,
    label: sqlAlias,
  };
};

const primaryDerivedSortMeasure = derivedFor({
  operator: "subtract",
  sqlAlias: "revenue_minus_cost",
});

const derivedConditionFor = (
  overrides: Partial<BusinessSqlAggregateResultCondition> = {},
  derived: BusinessSqlDerivedMeasure = derivedMeasure,
): BusinessSqlAggregateResultCondition => {
  const seed = {
    target: { kind: "derived_measure" as const, derivedMeasureId: derived.derivedMeasureId },
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

const withSort = (
  target: BusinessSqlSortTarget,
  direction: BusinessSqlSort["direction"] = "desc",
): BusinessSqlQueryPlan => {
  const sort = {
    target,
    direction,
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

const withDerivedSort = ({
  derived = primaryDerivedSortMeasure,
  direction = "desc",
  target = {
    kind: "derived_measure" as const,
    derivedMeasureId: derived.derivedMeasureId,
    resolved: true,
  },
  plan = basePlan(),
}: {
  derived?: BusinessSqlDerivedMeasure;
  direction?: BusinessSqlSort["direction"];
  target?: BusinessSqlSortTarget;
  plan?: BusinessSqlQueryPlan;
} = {}): BusinessSqlQueryPlan => {
  const sort = { target, direction };
  return {
    ...plan,
    derivedMeasures: [derived],
    orderBy: [{ ...sort, sortId: createBusinessSqlSortId(sort) }],
  };
};

const withDerivedHaving = ({
  derived = primaryDerivedSortMeasure,
  condition = derivedConditionFor({
    comparisonValue: { kind: "number", value: 100000 },
  }, derived),
  plan = basePlan(),
}: {
  derived?: BusinessSqlDerivedMeasure;
  condition?: BusinessSqlAggregateResultCondition;
  plan?: BusinessSqlQueryPlan;
} = {}): BusinessSqlQueryPlan => ({
  ...plan,
  derivedMeasures: [derived],
  aggregateResultConditions: [condition],
});

const derivedExpressionSql = (
  operator: BusinessSqlDerivedMeasure["operator"] = "subtract",
): string =>
  operator === "add"
    ? '(SUM("finance"."revenue")) + (SUM("finance"."cost"))'
    : operator === "multiply"
      ? '(SUM("finance"."revenue")) * (SUM("finance"."cost"))'
      : operator === "divide"
        ? [
            "CASE",
            '    WHEN (SUM("finance"."cost")) = 0 THEN NULL',
            '    ELSE (SUM("finance"."revenue")) / (SUM("finance"."cost"))',
            "  END",
          ].join("\n")
        : '(SUM("finance"."revenue")) - (SUM("finance"."cost"))';

const expectedDerivedSql = ({
  operator = "subtract",
  alias = "revenue_minus_cost",
  direction = "DESC",
}: {
  operator?: BusinessSqlDerivedMeasure["operator"];
  alias?: string;
  direction?: "ASC" | "DESC";
} = {}): string => {
  const expression = derivedExpressionSql(operator);
  return [
    "SELECT",
    '  "finance"."region" AS "region",',
    '  SUM("finance"."revenue") AS "total_revenue",',
    '  SUM("finance"."cost") AS "total_cost",',
    `  ${expression} AS "${alias}"`,
    'FROM "finance"',
    'GROUP BY "finance"."region"',
    `ORDER BY "${alias}" ${direction};`,
  ].join("\n");
};

const expectedDerivedHavingSql = ({
  operator = "subtract",
  alias = "revenue_minus_cost",
  comparisonOperator = ">",
  comparisonValue = "100000",
  orderBy = false,
  limit,
}: {
  operator?: BusinessSqlDerivedMeasure["operator"];
  alias?: string;
  comparisonOperator?: string;
  comparisonValue?: string;
  orderBy?: boolean;
  limit?: number;
} = {}): string => {
  const clauses = [
    "SELECT",
    '  "finance"."region" AS "region",',
    '  SUM("finance"."revenue") AS "total_revenue",',
    '  SUM("finance"."cost") AS "total_cost",',
    `  ${derivedExpressionSql(operator)} AS "${alias}"`,
    'FROM "finance"',
    'GROUP BY "finance"."region"',
    `HAVING ${derivedExpressionSql(operator)} ${comparisonOperator} ${comparisonValue}`,
    ...(orderBy ? [`ORDER BY "${alias}" DESC`] : []),
    ...(limit ? [`LIMIT ${limit}`] : []),
  ];
  return [
    ...clauses.slice(0, -1),
    `${clauses[clauses.length - 1]};`,
  ].join("\n");
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
    name: "valid derived sort target is structurally ready, renderer-capable, and preview-safe",
    assert: () => {
      const plan = withDerivedSort();
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      const rendered = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      return [
        ...(readiness.status === "ready" ? [] : ["Expected valid derived sort to be structurally ready."]),
        ...(capability.status === "capable" &&
        !capability.reasonCodes.includes("derived_measure_order_by_rendering_not_supported")
          ? []
          : ["Expected valid derived sort renderer capability."]),
        ...(rendered.sql === expectedDerivedSql() ? [] : ["Expected descending derived ORDER BY SQL."]),
        ...(rendered.inserted === false && rendered.ranQuery === false
          ? []
          : ["Derived sort render must remain manual."]),
        ...(preview.sql === expectedDerivedSql() &&
        preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Valid derived sort preview must expose only copy action."]),
      ];
    },
  },
  {
    name: "derived ORDER BY renders through the same generic path across operators",
    assert: () => {
      const add = derivedFor({ operator: "add", sqlAlias: "revenue_plus_cost" });
      const subtract = derivedFor({ operator: "subtract", sqlAlias: "revenue_minus_cost" });
      const multiply = derivedFor({ operator: "multiply", sqlAlias: "revenue_times_cost" });
      const divide = derivedFor({ operator: "divide", sqlAlias: "revenue_divided_by_cost" });
      const cases = [
        { derived: add, direction: "asc" as const, sqlDirection: "ASC" as const, operator: "add" as const },
        { derived: subtract, direction: "desc" as const, sqlDirection: "DESC" as const, operator: "subtract" as const },
        { derived: multiply, direction: "desc" as const, sqlDirection: "DESC" as const, operator: "multiply" as const },
        { derived: divide, direction: "desc" as const, sqlDirection: "DESC" as const, operator: "divide" as const },
      ];
      return cases.flatMap(({ derived, direction, sqlDirection, operator }) => {
        const plan = withDerivedSort({ derived, direction });
        const capability = evaluateBusinessSqlRendererCapability(plan);
        const rendered = renderBusinessSqlQueryPlan(plan);
        const expected = expectedDerivedSql({
          operator,
          alias: derived.sqlAlias,
          direction: sqlDirection,
        });
        const orderBy = `ORDER BY "${derived.sqlAlias}" ${sqlDirection};`;
        return [
          ...(capability.capable ? [] : [`Expected ${operator} derived sort to be renderer-capable.`]),
          ...(rendered.sql === expected ? [] : [`Expected exact ${operator} derived sort SQL.`]),
          ...(rendered.sql?.includes(orderBy) ? [] : [`Expected ${operator} ORDER BY projected alias.`]),
          ...(rendered.sql && !rendered.sql.split("ORDER BY")[1]?.includes("SUM(")
            ? []
            : [`Expected ${operator} ORDER BY not to duplicate expression.`]),
        ];
      });
    },
  },
  {
    name: "derived sort target metadata is ignored in favor of stable derivedMeasureId",
    assert: () => {
      const target: BusinessSqlSortTarget = {
        kind: "derived_measure",
        derivedMeasureId: primaryDerivedSortMeasure.derivedMeasureId,
        resolved: true,
        sqlAlias: "stale_alias_must_not_render",
        label: "Unrelated display label",
      };
      const relabeledTarget = {
        ...target,
        sqlAlias: "another_stale_alias",
        label: "Another unrelated label",
      };
      const rendered = renderBusinessSqlQueryPlan(withDerivedSort({ target }));
      const relabeled = renderBusinessSqlQueryPlan(withDerivedSort({ target: relabeledTarget }));
      return [
        ...(rendered.sql?.includes('ORDER BY "revenue_minus_cost" DESC;')
          ? []
          : ["Expected ORDER BY to use resolved derivedMeasure.sqlAlias."]),
        ...(!rendered.sql?.includes("stale_alias_must_not_render") &&
        !rendered.sql?.includes("Unrelated display label")
          ? []
          : ["Sort target alias and label must be ignored."]),
        ...(rendered.sql === relabeled.sql
          ? []
          : ["Changing sort target label or optional alias must not change SQL."]),
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
      const missingRendered = renderBusinessSqlQueryPlan(withSort({
        kind: "derived_measure",
        derivedMeasureId: "business-sql-derived-measure:missing",
        resolved: true,
      }));
      const ambiguousRendered = renderBusinessSqlQueryPlan(ambiguousPlan);
      return [
        ...(missing.status !== "ready" &&
        missing.reasonCodes.includes("derived_sort_target_unresolved")
          ? []
          : ["Expected missing derived sort target to block readiness."]),
        ...(ambiguous.status !== "ready" &&
        ambiguous.reasonCodes.includes("derived_sort_target_ambiguous")
          ? []
          : ["Expected ambiguous derived sort target to block readiness."]),
        ...(!missingRendered.rendered && missingRendered.sql === null
          ? []
          : ["Missing derived sort target must produce no SQL."]),
        ...(!ambiguousRendered.rendered && ambiguousRendered.sql === null
          ? []
          : ["Ambiguous derived sort target must produce no SQL."]),
      ];
    },
  },
  {
    name: "valid derived aggregate condition is structurally ready, renderer-capable, and preview-safe",
    assert: () => {
      const plan = withDerivedHaving();
      const compatibility = evaluateBusinessSqlAggregateResultConditionCompatibility({
        condition: plan.aggregateResultConditions[0],
        measures: plan.measures,
        derivedMeasures: plan.derivedMeasures,
      });
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      const rendered = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      const expectedSql = expectedDerivedHavingSql();
      return [
        ...(compatibility.compatible ? [] : ["Expected derived aggregate condition compatibility."]),
        ...(readiness.status === "ready" ? [] : ["Expected valid derived aggregate condition to be structurally ready."]),
        ...(capability.status === "capable" &&
        !capability.reasonCodes.includes("derived_measure_aggregate_condition_rendering_not_supported")
          ? []
          : ["Expected valid derived aggregate condition renderer capability."]),
        ...(rendered.sql === expectedSql ? [] : ["Expected exact subtract-derived HAVING SQL."]),
        ...(rendered.sql?.includes('HAVING (SUM("finance"."revenue")) - (SUM("finance"."cost")) > 100000')
          ? []
          : ["Expected derived HAVING to regenerate arithmetic expression."]),
        ...(rendered.sql && !rendered.sql.includes('HAVING "revenue_minus_cost"')
          ? []
          : ["Derived HAVING must not use the derived sqlAlias."]),
        ...(rendered.inserted === false && rendered.ranQuery === false
          ? []
          : ["Derived HAVING render must remain manual."]),
        ...(preview.sql === expectedSql &&
        preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Valid derived HAVING preview must expose only copy action."]),
      ];
    },
  },
  {
    name: "derived HAVING renders through the same generic path across operators",
    assert: () => {
      const cases = [
        {
          derived: derivedFor({ operator: "add", sqlAlias: "revenue_plus_cost" }),
          operator: "add" as const,
          comparisonOperator: ">=",
          conditionOperator: "greater_than_or_equal" as const,
          value: 500,
        },
        {
          derived: derivedFor({ operator: "subtract", sqlAlias: "revenue_minus_cost" }),
          operator: "subtract" as const,
          comparisonOperator: ">",
          conditionOperator: "greater_than" as const,
          value: 100000,
        },
        {
          derived: derivedFor({ operator: "multiply", sqlAlias: "revenue_times_cost" }),
          operator: "multiply" as const,
          comparisonOperator: "<",
          conditionOperator: "less_than" as const,
          value: 10000,
        },
        {
          derived: derivedFor({ operator: "divide", sqlAlias: "revenue_divided_by_cost" }),
          operator: "divide" as const,
          comparisonOperator: ">",
          conditionOperator: "greater_than" as const,
          value: 100,
        },
      ];
      return cases.flatMap(({ derived, operator, comparisonOperator, conditionOperator, value }) => {
        const condition = derivedConditionFor({
          operator: conditionOperator,
          comparisonValue: { kind: "number", value },
        }, derived);
        const plan = withDerivedHaving({ derived, condition });
        const capability = evaluateBusinessSqlRendererCapability(plan);
        const rendered = renderBusinessSqlQueryPlan(plan);
        const expected = expectedDerivedHavingSql({
          operator,
          alias: derived.sqlAlias,
          comparisonOperator,
          comparisonValue: String(value),
        });
        return [
          ...(capability.capable ? [] : [`Expected ${operator} derived HAVING to be renderer-capable.`]),
          ...(rendered.sql === expected ? [] : [`Expected exact ${operator} derived HAVING SQL.`]),
          ...(rendered.sql?.includes(`HAVING ${derivedExpressionSql(operator)} ${comparisonOperator} ${value}`)
            ? []
            : [`Expected ${operator} HAVING expression rendering.`]),
          ...(operator !== "divide" || (rendered.sql?.match(/\bCASE\b/g) || []).length === 2
            ? []
            : ["Expected guarded divide CASE in SELECT and HAVING."]),
          ...(operator !== "divide" || !rendered.sql?.includes("HAVING (SUM")
            ? []
            : ["Expected no unguarded divide HAVING SQL."]),
        ];
      });
    },
  },
  {
    name: "derived aggregate condition metadata is ignored in favor of stable derivedMeasureId",
    assert: () => {
      const condition = derivedConditionFor({
        label: "Misleading condition label",
      }, primaryDerivedSortMeasure);
      const relabeledCondition = derivedConditionFor({
        label: "Another misleading label",
        conditionId: undefined,
      }, primaryDerivedSortMeasure);
      const rendered = renderBusinessSqlQueryPlan(withDerivedHaving({ condition }));
      const relabeled = renderBusinessSqlQueryPlan(withDerivedHaving({ condition: relabeledCondition }));
      return [
        ...(condition.conditionId === relabeledCondition.conditionId
          ? []
          : ["Derived condition identity must ignore label changes."]),
        ...(rendered.sql?.includes('HAVING (SUM("finance"."revenue")) - (SUM("finance"."cost")) > 10')
          ? []
          : ["Expected derivedMeasureId to control HAVING expression resolution."]),
        ...(!rendered.sql?.includes("Misleading condition label")
          ? []
          : ["Derived HAVING must ignore condition label."]),
        ...(rendered.sql === relabeled.sql
          ? []
          : ["Changing condition label must not change SQL semantics."]),
      ];
    },
  },
  {
    name: "all derived HAVING comparison operators and finite thresholds render safely",
    assert: () => {
      const operators = [
        { conditionOperator: "greater_than" as const, sqlOperator: ">", value: 1 },
        { conditionOperator: "greater_than_or_equal" as const, sqlOperator: ">=", value: 2.5 },
        { conditionOperator: "less_than" as const, sqlOperator: "<", value: 3 },
        { conditionOperator: "less_than_or_equal" as const, sqlOperator: "<=", value: 4.75 },
        { conditionOperator: "equals" as const, sqlOperator: "=", value: 5 },
        { conditionOperator: "not_equals" as const, sqlOperator: "<>", value: 6.25 },
      ];
      return operators.flatMap(({ conditionOperator, sqlOperator, value }) => {
        const condition = derivedConditionFor({
          operator: conditionOperator,
          comparisonValue: { kind: "number", value },
        }, primaryDerivedSortMeasure);
        const rendered = renderBusinessSqlQueryPlan(withDerivedHaving({ condition }));
        return rendered.sql?.includes(`HAVING ${derivedExpressionSql("subtract")} ${sqlOperator} ${value};`)
          ? []
          : [`Expected derived HAVING operator ${conditionOperator} to render as ${sqlOperator}.`];
      });
    },
  },
  {
    name: "valid derived HAVING plus derived ORDER BY and limit renders all clauses",
    assert: () => {
      const condition = derivedConditionFor({
        comparisonValue: { kind: "number", value: 100000 },
      }, primaryDerivedSortMeasure);
      const plan = withDerivedSort({
        derived: primaryDerivedSortMeasure,
        plan: {
          ...basePlan(),
          derivedMeasures: [primaryDerivedSortMeasure],
          aggregateResultConditions: [condition],
          rowLimit: { rowLimitId: "business-sql-row-limit:25", value: 25 },
        },
      });
      const capability = evaluateBusinessSqlRendererCapability(plan);
      const rendered = renderBusinessSqlQueryPlan(plan);
      const expectedSql = expectedDerivedHavingSql({
        orderBy: true,
        limit: 25,
      });
      return [
        ...(capability.capable ? [] : ["Expected combined derived HAVING and ORDER BY to be renderer-capable."]),
        ...(rendered.sql === expectedSql ? [] : ["Expected combined derived HAVING, ORDER BY, and LIMIT SQL."]),
        ...(Boolean(rendered.sql?.includes(`GROUP BY "finance"."region"\nHAVING ${derivedExpressionSql("subtract")} > 100000\nORDER BY "revenue_minus_cost" DESC\nLIMIT 25;`))
          ? []
          : ["Expected HAVING before ORDER BY and ORDER BY before LIMIT."]),
        ...(rendered.sql && !rendered.sql.split("ORDER BY")[1]?.includes("SUM(")
          ? []
          : ["Combined ORDER BY must use only the derived alias."]),
      ];
    },
  },
  {
    name: "invalid derived aggregate condition targets and values block readiness",
    assert: () => {
      const missingPlan = {
        ...basePlan(),
        aggregateResultConditions: [
          derivedConditionFor({
            target: {
              kind: "derived_measure",
              derivedMeasureId: "business-sql-derived-measure:missing",
            },
          }),
        ],
      };
      const invalidValuePlan = {
        ...basePlan(),
        aggregateResultConditions: [
          derivedConditionFor({
            comparisonValue: { kind: "number", value: Number.POSITIVE_INFINITY },
          }),
        ],
      };
      const invalidOperatorPlan = {
        ...basePlan(),
        aggregateResultConditions: [
          derivedConditionFor({
            operator: "contains" as BusinessSqlAggregateResultCondition["operator"],
          }),
        ],
      };
      const bothTargetsPlan = {
        ...basePlan(),
        aggregateResultConditions: [
          {
            ...derivedConditionFor(),
            measureId: leftMeasure.measureId,
          } as BusinessSqlAggregateResultCondition,
        ],
      };
      const neitherTargetPlan = {
        ...basePlan(),
        aggregateResultConditions: [
          {
            conditionId: "business-sql-aggregate-condition:invalid",
            operator: "greater_than",
            comparisonValue: { kind: "number", value: 10 },
          } as BusinessSqlAggregateResultCondition,
        ],
      };
      const duplicatePlan = {
        ...basePlan(),
        derivedMeasures: [derivedMeasure, { ...derivedMeasure }],
        aggregateResultConditions: [derivedConditionFor()],
      };
      const multipleConditionsPlan = {
        ...basePlan(),
        aggregateResultConditions: [
          conditionFor(),
          derivedConditionFor({}, primaryDerivedSortMeasure),
        ],
      };
      const missing = readinessFor(missingPlan);
      const invalidValue = readinessFor(invalidValuePlan);
      const invalidOperator = readinessFor(invalidOperatorPlan);
      const bothTargets = readinessFor(bothTargetsPlan);
      const neitherTarget = readinessFor(neitherTargetPlan);
      const duplicate = readinessFor(duplicatePlan);
      const multipleCapability = evaluateBusinessSqlRendererCapability(multipleConditionsPlan);
      const invalidRenderResults = [
        renderBusinessSqlQueryPlan(missingPlan),
        renderBusinessSqlQueryPlan(invalidValuePlan),
        renderBusinessSqlQueryPlan(invalidOperatorPlan),
        renderBusinessSqlQueryPlan(bothTargetsPlan),
        renderBusinessSqlQueryPlan(neitherTargetPlan),
        renderBusinessSqlQueryPlan(duplicatePlan),
        renderBusinessSqlQueryPlan(multipleConditionsPlan),
      ];
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
        ...(duplicate.reasonCodes.includes("aggregate_condition_derived_measure_unresolved")
          ? []
          : ["Expected duplicate derived aggregate condition target to block readiness."]),
        ...(multipleCapability.reasonCodes.includes("aggregate_condition_multiple_not_supported")
          ? []
          : ["Expected multiple aggregate conditions to remain renderer-incapable."]),
        ...(invalidRenderResults.every((result) => !result.rendered && result.sql === null)
          ? []
          : ["Invalid derived aggregate condition plans must produce no SQL."]),
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
    name: "grouping ORDER BY and base HAVING plus derived ORDER BY keep clause order",
    assert: () => {
      const groupingSort = {
        target: {
          kind: "grouping" as const,
          entity: "finance",
          table: "finance",
          field: "region",
          resolved: true,
        },
        direction: "asc" as const,
      };
      const groupingPlan = {
        ...createEmptyBusinessSqlQueryPlan(),
        id: "business-sql-plan:grouping-order",
        kind: "single_table_count_grouping" as const,
        status: "resolved" as const,
        support: "supported" as const,
        entities: [sourceEntity],
        metric: null,
        measures: [leftMeasure],
        groupings: [grouping],
        orderBy: [{ ...groupingSort, sortId: createBusinessSqlSortId(groupingSort) }],
      };
      const havingPlan = withDerivedSort({
        plan: {
          ...basePlan(),
          aggregateResultConditions: [conditionFor()],
          rowLimit: { rowLimitId: "business-sql-row-limit:25", value: 25 },
        },
      });
      const groupingSql = [
        "SELECT",
        '  "finance"."region" AS "region",',
        '  SUM("finance"."revenue") AS "total_revenue"',
        'FROM "finance"',
        'GROUP BY "finance"."region"',
        'ORDER BY "region" ASC;',
      ].join("\n");
      const havingSql = renderBusinessSqlQueryPlan(havingPlan).sql;
      return [
        ...(renderBusinessSqlQueryPlan(groupingPlan).sql === groupingSql
          ? []
          : ["Expected grouping ORDER BY SQL byte identity."]),
        ...(Boolean(havingSql?.includes('\nHAVING SUM("finance"."revenue") > 10\nORDER BY "revenue_minus_cost" DESC\nLIMIT 25;'))
          ? []
          : ["Expected HAVING before derived ORDER BY and LIMIT after ORDER BY."]),
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
    name: "invalid derived sort and HAVING rendering never fall back to partial SQL",
    assert: () => {
      const invalidOperandPlan = withDerivedSort({
        derived: {
          ...derivedMeasure,
          leftMeasureId: "business-sql-measure:missing:left",
          derivedMeasureId: "business-sql-derived-measure:invalid-operand",
        },
      });
      const unsupportedOperatorPlan = withDerivedSort({
        derived: {
          ...derivedMeasure,
          operator: "modulo" as BusinessSqlDerivedMeasure["operator"],
          derivedMeasureId: "business-sql-derived-measure:unsupported-operator",
        },
      });
      const invalidHavingOperandPlan = withDerivedHaving({
        derived: {
          ...primaryDerivedSortMeasure,
          leftMeasureId: "business-sql-measure:missing:left",
          derivedMeasureId: "business-sql-derived-measure:invalid-having-operand",
        },
      });
      const unsupportedHavingOperatorPlan = withDerivedHaving({
        derived: {
          ...primaryDerivedSortMeasure,
          operator: "modulo" as BusinessSqlDerivedMeasure["operator"],
          derivedMeasureId: "business-sql-derived-measure:unsupported-having-operator",
        },
      });
      const invalidOperand = renderBusinessSqlQueryPlan(invalidOperandPlan);
      const unsupportedOperator = renderBusinessSqlQueryPlan(unsupportedOperatorPlan);
      const invalidHavingOperand = renderBusinessSqlQueryPlan(invalidHavingOperandPlan);
      const unsupportedHavingOperator = renderBusinessSqlQueryPlan(unsupportedHavingOperatorPlan);
      return [
        ...(!invalidOperand.rendered && invalidOperand.sql === null
          ? []
          : ["Invalid derived operand composition must produce no SQL."]),
        ...(!unsupportedOperator.rendered && unsupportedOperator.sql === null
          ? []
          : ["Unsupported derived operator must produce no SQL."]),
        ...(!invalidHavingOperand.rendered && invalidHavingOperand.sql === null
          ? []
          : ["Invalid derived HAVING operand composition must produce no SQL."]),
        ...(!unsupportedHavingOperator.rendered && unsupportedHavingOperator.sql === null
          ? []
          : ["Unsupported derived HAVING operator must produce no SQL."]),
      ];
    },
  },
  {
    name: "joins and grouping remain unchanged with derived HAVING and ORDER BY",
    assert: () => {
      const condition = derivedConditionFor({
        comparisonValue: { kind: "number", value: 100000 },
      }, primaryDerivedSortMeasure);
      const joinedPlan = withDerivedSort({
        derived: primaryDerivedSortMeasure,
        plan: {
          ...basePlan(),
          id: "business-sql-plan:joined-derived-sort",
          aggregateResultConditions: [condition],
          entities: [
            sourceEntity,
            {
              entity: "regions",
              table: "regions",
              required: false,
              role: "join_subject" as const,
            },
          ],
          joinPath: {
            required: true,
            status: "resolved",
            entities: ["finance", "regions"],
            requirements: [
              {
                fromEntity: "finance",
                toEntity: "regions",
                required: true,
                verified: true,
              },
            ],
            edges: [
              {
                fromEntity: "finance",
                fromTable: "finance",
                fromField: "region_id",
                toEntity: "regions",
                toTable: "regions",
                toField: "id",
                verified: true,
              },
            ],
          },
        },
      });
      const sql = renderBusinessSqlQueryPlan(joinedPlan).sql;
      return [
        ...(Boolean(sql?.includes(`FROM "finance"\nJOIN "regions" ON "finance"."region_id" = "regions"."id"\nGROUP BY "finance"."region"\nHAVING ${derivedExpressionSql("subtract")} > 100000\nORDER BY "revenue_minus_cost" DESC;`))
          ? []
          : ["Expected joins and grouping to remain unchanged before derived HAVING and ORDER BY."]),
      ];
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
