/**
 * PS-3a - Business SQL derived-measure contract fixtures.
 *
 * Contract and safety fixtures only. No natural-language formula grounding,
 * SQL arithmetic rendering, editor insertion, Run Query calls, backend/API
 * calls, provider calls, persistence, or workbook mutation.
 */

import {
  createBlockedBusinessSqlQueryPlan,
  createBusinessSqlDerivedMeasureId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlRowLimitId,
  createEmptyBusinessSqlQueryPlan,
  createBusinessSqlSortId,
  type BusinessSqlDerivedMeasure,
  type BusinessSqlDerivedMeasureOperator,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import { evaluateBusinessSqlDerivedMeasureCompatibility } from "../businessSqlDerivedMeasureCompatibility";
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

export type BusinessSqlDerivedMeasureContractFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

const sourceEntity = {
  entity: "source",
  table: "source",
  required: true,
  role: "source" as const,
};

const grouping = {
  entity: "source",
  table: "source",
  field: "group_key",
  label: "group_key",
};

const measure = ({
  kind = "sum",
  field,
  label,
  fieldInferredType = "numeric",
}: {
  kind?: BusinessSqlMeasure["kind"];
  field?: string;
  label: string;
  fieldInferredType?: BusinessSqlMeasure["fieldInferredType"];
}): BusinessSqlMeasure => {
  const seed = {
    kind,
    entity: "source",
    table: "source",
    field,
    distinct: false,
  };
  return {
    ...seed,
    measureId: createBusinessSqlMeasureId(seed),
    fieldInferredType,
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
};

const leftMeasure = measure({ field: "amount_a", label: "Total amount a" });
const rightMeasure = measure({ field: "amount_b", label: "Total amount b" });
const extraMeasure = measure({ field: "amount_c", label: "Total amount c" });
const dateMeasure = measure({
  kind: "minimum",
  field: "event_date",
  fieldInferredType: "date",
  label: "Earliest event date",
});
const countMeasure = measure({
  kind: "count_entities",
  field: "record_id",
  fieldInferredType: "text",
  label: "Count records",
});

const derived = (
  overrides: Partial<BusinessSqlDerivedMeasure> = {},
): BusinessSqlDerivedMeasure => {
  const seed = {
    operator: "subtract" as BusinessSqlDerivedMeasureOperator,
    leftMeasureId: leftMeasure.measureId,
    rightMeasureId: rightMeasure.measureId,
    divisionPolicy: undefined,
  };
  const derivedMeasureId = createBusinessSqlDerivedMeasureId({
    ...seed,
    ...overrides,
  });
  return {
    derivedMeasureId,
    ...seed,
    sqlAlias: "derived_measure",
    label: "Derived measure",
    ...overrides,
  };
};

const planWith = ({
  measures = [leftMeasure, rightMeasure],
  derivedMeasures = [derived()],
  orderByMeasure = measures[0],
}: {
  measures?: BusinessSqlMeasure[];
  derivedMeasures?: BusinessSqlDerivedMeasure[];
  orderByMeasure?: BusinessSqlMeasure | null;
} = {}): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:derived-measure-contract",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [sourceEntity],
  metric: null,
  measures,
  derivedMeasures,
  groupings: [grouping],
  orderBy: orderByMeasure
    ? [
        {
          sortId: createBusinessSqlSortId({
            target: { kind: "measure", measureId: orderByMeasure.measureId, resolved: true },
            direction: "desc",
          }),
          target: { kind: "measure", measureId: orderByMeasure.measureId, resolved: true },
          direction: "desc",
        },
      ]
    : [],
});

const readinessFor = (plan: BusinessSqlQueryPlan) =>
  evaluateBusinessSqlPlanReadiness(attachBusinessSqlJoinResolutionToPlan({ plan }));

const existingRenderablePlan = (): BusinessSqlQueryPlan => {
  const baseMeasure = measure({
    kind: "count_entities",
    field: undefined,
    label: "count leases",
    fieldInferredType: "text",
  });
  return {
    ...createEmptyBusinessSqlQueryPlan(),
    id: "business-sql-plan:leases-by-status-derived-empty",
    kind: "single_table_count_grouping",
    status: "resolved",
    support: "supported",
    entities: [{ entity: "leases", table: "leases", required: true, role: "source" }],
    metric: null,
    measures: [
      {
        ...baseMeasure,
        measureId: "business-sql-measure:count_entities:leases:leases::false",
        entity: "leases",
        table: "leases",
      },
    ],
    derivedMeasures: [],
    groupings: [
      { entity: "leases", table: "leases", field: "lease_status", label: "lease_status" },
    ],
  };
};

const tableMeasure = ({
  table,
  field,
  label,
  kind = "sum",
  fieldInferredType = "numeric",
}: {
  table: string;
  field?: string;
  label: string;
  kind?: BusinessSqlMeasure["kind"];
  fieldInferredType?: BusinessSqlMeasure["fieldInferredType"];
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
    fieldInferredType,
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
};

const subtractPlan = ({
  table = "finance",
  groupingField = "region",
  left = tableMeasure({ table, field: "revenue", label: "Total revenue" }),
  right = tableMeasure({ table, field: "cost", label: "Total cost" }),
  derivedAlias = "revenue_minus_cost",
  derivedLabel = "Revenue minus cost",
  orderByMeasure = null,
  rowLimit = null,
  havingMeasure = null,
  join = false,
}: {
  table?: string;
  groupingField?: string;
  left?: BusinessSqlMeasure;
  right?: BusinessSqlMeasure;
  derivedAlias?: string;
  derivedLabel?: string;
  orderByMeasure?: BusinessSqlMeasure | null;
  rowLimit?: number | null;
  havingMeasure?: BusinessSqlMeasure | null;
  join?: boolean;
} = {}): BusinessSqlQueryPlan => {
  const derivedMeasure = derived({
    leftMeasureId: left.measureId,
    rightMeasureId: right.measureId,
    sqlAlias: derivedAlias,
    label: derivedLabel,
  });
  const sortTarget = orderByMeasure
    ? { kind: "measure" as const, measureId: orderByMeasure.measureId, resolved: true }
    : null;
  const rowLimitValue = rowLimit ? { value: rowLimit } : null;
  return {
    ...createEmptyBusinessSqlQueryPlan(),
    id: `business-sql-plan:${table}:${derivedAlias}`,
    kind: "single_table_count_grouping",
    status: "resolved",
    support: "supported",
    prompt: `derived fixture for ${table}`,
    entities: [
      { entity: table, table, required: true, role: "source" },
      ...(join
        ? [{ entity: "lookup", table: "lookup", required: true, role: "context" as const }]
        : []),
    ],
    metric: null,
    measures: [left, right],
    derivedMeasures: [derivedMeasure],
    groupings: [{ entity: table, table, field: groupingField, label: groupingField }],
    orderBy: sortTarget
      ? [
          {
            sortId: createBusinessSqlSortId({ target: sortTarget, direction: "asc" }),
            target: sortTarget,
            direction: "asc",
          },
        ]
      : [],
    rowLimit: rowLimitValue
      ? { ...rowLimitValue, rowLimitId: createBusinessSqlRowLimitId(rowLimitValue) }
      : null,
    aggregateResultConditions: havingMeasure
      ? [
          {
            conditionId: "business-sql-aggregate-condition:fixture",
            measureId: havingMeasure.measureId,
            operator: "greater_than",
            comparisonValue: { kind: "number", value: 10 },
            label: "base measure above 10",
          },
        ]
      : [],
    joinPath: join
      ? {
          required: true,
          status: "resolved",
          entities: [table, "lookup"],
          requirements: [
            {
              fromEntity: table,
              toEntity: "lookup",
              required: true,
              relationship: "source has lookup",
              verified: true,
            },
          ],
          edges: [
            {
              fromEntity: table,
              fromTable: table,
              fromField: "lookup_id",
              toEntity: "lookup",
              toTable: "lookup",
              toField: "lookup_id",
              relationship: "source has lookup",
              verified: true,
            },
          ],
        }
      : createEmptyBusinessSqlQueryPlan().joinPath,
  };
};

const fixtures: Fixture[] = [
  {
    name: "empty and blocked plans default to no derived measures",
    assert: () => [
      ...(Array.isArray(createEmptyBusinessSqlQueryPlan().derivedMeasures) &&
      createEmptyBusinessSqlQueryPlan().derivedMeasures.length === 0
        ? []
        : ["Expected empty plan derivedMeasures default."  ]),
      ...(Array.isArray(createBlockedBusinessSqlQueryPlan("blocked").derivedMeasures) &&
      createBlockedBusinessSqlQueryPlan("blocked").derivedMeasures.length === 0
        ? []
        : ["Expected blocked plan derivedMeasures default."]),
    ],
  },
  {
    name: "all four binary operators are contract representable",
    assert: () => {
      const operators: BusinessSqlDerivedMeasureOperator[] = ["add", "subtract", "multiply", "divide"];
      return operators.flatMap((operator) => {
        const item = derived({
          operator,
          divisionPolicy: operator === "divide" ? { zeroDenominator: "null" } : undefined,
        });
        return item.operator === operator && item.leftMeasureId && item.rightMeasureId
          ? []
          : [`Expected ${operator} to be representable.`];
      });
    },
  },
  {
    name: "derived IDs are deterministic and independent of label alias and array position",
    assert: () => {
      const first = derived({ label: "First label", sqlAlias: "first_alias" });
      const second = derived({ label: "Second label", sqlAlias: "second_alias" });
      const reorderedPlan = planWith({
        measures: [rightMeasure, leftMeasure],
        derivedMeasures: [second],
      });
      return [
        ...(first.derivedMeasureId === second.derivedMeasureId
          ? []
          : ["Derived ID must ignore label and SQL alias."]),
        ...(reorderedPlan.derivedMeasures[0]?.derivedMeasureId === first.derivedMeasureId
          ? []
          : ["Derived ID must not depend on array position."]),
      ];
    },
  },
  {
    name: "operand order affects subtract and divide identity",
    assert: () => {
      const subtractForward = derived({ operator: "subtract" });
      const subtractReverse = derived({
        operator: "subtract",
        leftMeasureId: rightMeasure.measureId,
        rightMeasureId: leftMeasure.measureId,
      });
      const divideForward = derived({
        operator: "divide",
        divisionPolicy: { zeroDenominator: "null" },
      });
      const divideReverse = derived({
        operator: "divide",
        leftMeasureId: rightMeasure.measureId,
        rightMeasureId: leftMeasure.measureId,
        divisionPolicy: { zeroDenominator: "null" },
      });
      return [
        ...(subtractForward.derivedMeasureId !== subtractReverse.derivedMeasureId
          ? []
          : ["Subtract identity must preserve operand order."]),
        ...(divideForward.derivedMeasureId !== divideReverse.derivedMeasureId
          ? []
          : ["Divide identity must preserve operand order."]),
      ];
    },
  },
  {
    name: "missing left and right operands produce deterministic compatibility reasons",
    assert: () => {
      const missingLeft = evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure: derived({ leftMeasureId: "business-sql-measure:missing:left" }),
        measures: [rightMeasure],
      });
      const missingRight = evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure: derived({ rightMeasureId: "business-sql-measure:missing:right" }),
        measures: [leftMeasure],
      });
      return [
        ...(missingLeft.reasonCodes.includes("derived_measure_left_unresolved")
          ? []
          : ["Expected missing left operand reason."]),
        ...(missingRight.reasonCodes.includes("derived_measure_right_unresolved")
          ? []
          : ["Expected missing right operand reason."]),
      ];
    },
  },
  {
    name: "derived dependency and self-reference are rejected",
    assert: () => {
      const base = derived();
      const dependency = evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure: derived({ leftMeasureId: base.derivedMeasureId }),
        measures: [rightMeasure],
        derivedMeasures: [base],
      });
      const self = evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure: derived({
          derivedMeasureId: "business-sql-derived-measure:self",
          leftMeasureId: "business-sql-derived-measure:self",
        }),
        measures: [leftMeasure, rightMeasure],
      });
      const unsupportedOperator = evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure: {
          ...derived(),
          operator: "modulo" as BusinessSqlDerivedMeasureOperator,
        },
        measures: [leftMeasure, rightMeasure],
      });
      return [
        ...(dependency.reasonCodes.includes("derived_measure_dependency_not_supported")
          ? []
          : ["Expected unsupported derived dependency reason."]),
        ...(self.reasonCodes.includes("derived_measure_self_reference")
          ? []
          : ["Expected self-reference reason."]),
        ...(unsupportedOperator.reasonCodes.includes("derived_measure_operator_unsupported")
          ? []
          : ["Expected unsupported operator reason."]),
      ];
    },
  },
  {
    name: "incompatible operand type is rejected",
    assert: () => {
      const compatibility = evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure: derived({ rightMeasureId: dateMeasure.measureId }),
        measures: [leftMeasure, dateMeasure],
      });
      return compatibility.reasonCodes.includes("derived_measure_operand_type_incompatible")
        ? []
        : ["Expected operand type incompatibility for date minimum."];
    },
  },
  {
    name: "divide requires explicit null on zero denominator policy",
    assert: () => {
      const missingPolicy = evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure: derived({ operator: "divide", divisionPolicy: undefined }),
        measures: [leftMeasure, countMeasure],
      });
      const withPolicy = evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure: derived({
          operator: "divide",
          rightMeasureId: countMeasure.measureId,
          divisionPolicy: { zeroDenominator: "null" },
        }),
        measures: [leftMeasure, countMeasure],
      });
      const missingPolicyReadiness = readinessFor(
        planWith({
          measures: [leftMeasure, countMeasure],
          derivedMeasures: [derived({
            operator: "divide",
            rightMeasureId: countMeasure.measureId,
            divisionPolicy: undefined,
          })],
        }),
      );
      return [
        ...(missingPolicy.reasonCodes.includes("derived_measure_division_policy_missing")
          ? []
          : ["Expected missing division policy reason."]),
        ...(missingPolicyReadiness.status === "blocked" &&
        missingPolicyReadiness.reasonCodes.includes("derived_measure_division_policy_missing")
          ? []
          : ["Expected missing division policy to block structural readiness."]),
        ...(withPolicy.compatible ? [] : ["Expected explicit null-on-zero division policy to be valid."]),
      ];
    },
  },
  {
    name: "valid derived measures are structurally ready including multiple derived contracts",
    assert: () => {
      const first = derived({ operator: "subtract" });
      const second = derived({ operator: "add", sqlAlias: "derived_add" });
      const readiness = readinessFor(planWith({ derivedMeasures: [first, second] }));
      return readiness.status === "ready" &&
        !readiness.reasonCodes.some((reason) => String(reason).startsWith("derived_measure_"))
        ? []
        : ["Expected multiple valid derived measures to remain structurally ready."];
    },
  },
  {
    name: "invalid derived measures block structural readiness",
    assert: () => {
      const readiness = readinessFor(
        planWith({
          derivedMeasures: [derived({ leftMeasureId: "business-sql-measure:missing:left" })],
        }),
      );
      return readiness.status === "blocked" &&
        readiness.reasonCodes.includes("derived_measure_left_unresolved")
        ? []
        : ["Expected unresolved derived operand to block structural readiness."];
    },
  },
  {
    name: "more than one derived measure is renderer incapable",
    assert: () => {
      const capability = evaluateBusinessSqlRendererCapability(
        planWith({
          derivedMeasures: [derived(), derived({ operator: "add", sqlAlias: "derived_add" })],
        }),
      );
      return capability.status === "incapable" &&
        capability.reasonCodes.includes("derived_measures_multiple_not_supported")
        ? []
        : ["Expected multiple derived measures renderer incapability."];
    },
  },
  {
    name: "one valid subtract derived measure is structurally ready and renderer capable",
    assert: () => {
      const plan = planWith();
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      return [
        ...(readiness.status === "ready" ? [] : ["Expected structurally ready derived plan."]),
        ...(capability.status === "capable" &&
        !capability.reasonCodes.includes("multiple_measures_not_supported")
          ? []
          : ["Expected subtract derived measure to be renderer capable."]),
      ];
    },
  },
  {
    name: "non-subtract derived operators remain renderer incapable",
    assert: () => {
      const operators: BusinessSqlDerivedMeasureOperator[] = ["add", "multiply", "divide"];
      return operators.flatMap((operator) => {
        const capability = evaluateBusinessSqlRendererCapability(
          planWith({
            derivedMeasures: [
              derived({
                operator,
                divisionPolicy: operator === "divide" ? { zeroDenominator: "null" } : undefined,
              }),
            ],
          }),
        );
        return capability.status === "incapable" &&
          capability.reasonCodes.includes("derived_measure_operator_rendering_not_supported")
          ? []
          : [`Expected ${operator} derived measure to remain renderer incapable.`];
      });
    },
  },
  {
    name: "mismatched derived operands are renderer incapable",
    assert: () => {
      const capability = evaluateBusinessSqlRendererCapability(
        planWith({
          measures: [leftMeasure, rightMeasure, extraMeasure],
          derivedMeasures: [derived()],
        }),
      );
      return capability.status === "incapable" &&
        capability.reasonCodes.includes("derived_measure_operand_mismatch")
        ? []
        : ["Expected derived operand mismatch incapability."];
    },
  },
  {
    name: "normal multi-measure plan without derived measure preserves old capability reason",
    assert: () => {
      const capability = evaluateBusinessSqlRendererCapability(
        planWith({ derivedMeasures: [] }),
      );
      return capability.status === "incapable" &&
        capability.reasonCodes.includes("multiple_measures_not_supported") &&
        !capability.reasonCodes.some((reason) => reason.startsWith("derived_measure"))
        ? []
        : ["Expected ordinary multiple-measure renderer incapability to be preserved."];
    },
  },
  {
    name: "direct rendering and preview of valid subtract derived measure plan produce SQL without insert or run",
    assert: () => {
      const plan = planWith();
      const rendered = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      return [
        ...(rendered.rendered && rendered.sql?.includes('AS "derived_measure"')
          ? []
          : ["Subtract derived measure plan must render SQL in PS-3b."]),
        ...(rendered.inserted === false && rendered.ranQuery === false
          ? []
          : ["Derived render must not insert or run."]),
        ...(preview.sql &&
        preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Derived measure preview must expose copy-only SQL review actions."]),
      ];
    },
  },
  {
    name: "unsupported derived operators produce no SQL and no preview actions",
    assert: () => {
      const plan = planWith({
        derivedMeasures: [derived({ operator: "add", sqlAlias: "add_measure" })],
      });
      const rendered = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      return [
        ...(!rendered.rendered && rendered.sql === null
          ? []
          : ["Unsupported derived operator must not render SQL."]),
        ...(preview.sql === null &&
        !preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Unsupported derived operator preview must expose no SQL actions."]),
      ];
    },
  },
  {
    name: "invalid operand and multiple derived requests produce no base-only SQL fallback",
    assert: () => {
      const invalidOperandPlan = planWith({
        derivedMeasures: [derived({ leftMeasureId: "business-sql-measure:missing:left" })],
      });
      const multipleDerivedPlan = planWith({
        derivedMeasures: [derived(), derived({ operator: "subtract", sqlAlias: "other_subtract" })],
      });
      const invalidResult = renderBusinessSqlQueryPlan(invalidOperandPlan);
      const multipleResult = renderBusinessSqlQueryPlan(multipleDerivedPlan);
      return [
        ...(!invalidResult.rendered && invalidResult.sql === null
          ? []
          : ["Invalid operand derived request must not render base-only SQL."]),
        ...(!multipleResult.rendered && multipleResult.sql === null
          ? []
          : ["Multiple derived request must not render base-only SQL."]),
      ];
    },
  },
  {
    name: "deterministic SUM minus SUM derived SQL projects grouping operands and derived measure in order",
    assert: () => {
      const result = renderBusinessSqlQueryPlan(subtractPlan());
      const expectedSql = [
        "SELECT",
        '  "finance"."region" AS "region",',
        '  SUM("finance"."revenue") AS "total_revenue",',
        '  SUM("finance"."cost") AS "total_cost",',
        '  (SUM("finance"."revenue")) - (SUM("finance"."cost")) AS "revenue_minus_cost"',
        'FROM "finance"',
        'GROUP BY "finance"."region";',
      ].join("\n");
      return [
        ...(result.sql === expectedSql ? [] : ["Expected exact deterministic SUM minus SUM SQL."]),
        ...(result.sql && result.sql.indexOf('"region"') < result.sql.indexOf('"total_revenue"') &&
        result.sql.indexOf('"total_revenue"') < result.sql.indexOf('"total_cost"') &&
        result.sql.indexOf('"total_cost"') < result.sql.indexOf('"revenue_minus_cost"')
          ? []
          : ["Expected grouping left operand right operand derived projection order."]),
        ...(result.sql?.includes('("total_revenue")') || result.sql?.includes("Revenue minus cost")
          ? ["Derived expression must not use aliases or labels."]
          : []),
      ];
    },
  },
  {
    name: "deterministic AVG minus AVG and COUNT minus COUNT derived SQL use aggregate metadata expressions",
    assert: () => {
      const avgLeft = tableMeasure({
        table: "quality",
        field: "target_score",
        label: "Average target score",
        kind: "average",
      });
      const avgRight = tableMeasure({
        table: "quality",
        field: "actual_score",
        label: "Average actual score",
        kind: "average",
      });
      const countLeft = tableMeasure({
        table: "tickets",
        field: "opened_ticket_id",
        label: "Opened tickets",
        kind: "count_entities",
        fieldInferredType: "text",
      });
      const countRight = tableMeasure({
        table: "tickets",
        field: "closed_ticket_id",
        label: "Closed tickets",
        kind: "count_entities",
        fieldInferredType: "text",
      });
      const avgSql = renderBusinessSqlQueryPlan(
        subtractPlan({
          table: "quality",
          groupingField: "team",
          left: avgLeft,
          right: avgRight,
          derivedAlias: "score_gap",
        }),
      ).sql;
      const countSql = renderBusinessSqlQueryPlan(
        subtractPlan({
          table: "tickets",
          groupingField: "queue",
          left: countLeft,
          right: countRight,
          derivedAlias: "opened_minus_closed",
        }),
      ).sql;
      return [
        ...(avgSql?.includes('(AVG("quality"."target_score")) - (AVG("quality"."actual_score")) AS "score_gap"')
          ? []
          : ["Expected AVG minus AVG expression from measure metadata."]),
        ...(countSql?.includes('(COUNT("tickets"."opened_ticket_id")) - (COUNT("tickets"."closed_ticket_id")) AS "opened_minus_closed"')
          ? []
          : ["Expected COUNT minus COUNT expression from measure metadata."]),
      ];
    },
  },
  {
    name: "subtract derived plans preserve joins base HAVING base ORDER BY and row limit",
    assert: () => {
      const left = tableMeasure({ table: "finance", field: "revenue", label: "Total revenue" });
      const right = tableMeasure({ table: "finance", field: "cost", label: "Total cost" });
      const plan = subtractPlan({
        left,
        right,
        orderByMeasure: left,
        rowLimit: 25,
        havingMeasure: right,
        join: true,
      });
      const result = renderBusinessSqlQueryPlan(plan);
      return [
        ...(result.sql?.includes('JOIN "lookup" ON "finance"."lookup_id" = "lookup"."lookup_id"')
          ? []
          : ["Expected resolved join to render."]),
        ...(result.sql?.includes('HAVING SUM("finance"."cost") > 10')
          ? []
          : ["Expected base-measure HAVING to remain positioned after GROUP BY."]),
        ...(result.sql?.includes('ORDER BY "total_revenue" ASC')
          ? []
          : ["Expected base-measure ORDER BY to remain unchanged."]),
        ...(result.sql?.endsWith("LIMIT 25;") ? [] : ["Expected row limit to remain unchanged."]),
      ];
    },
  },
  {
    name: "cross-domain subtract proof fixtures use the same renderer path",
    assert: () => {
      const cases = [
        subtractPlan({
          table: "programs",
          groupingField: "program",
          left: tableMeasure({ table: "programs", field: "budget", label: "Total budget" }),
          right: tableMeasure({ table: "programs", field: "spending", label: "Total spending" }),
          derivedAlias: "budget_minus_spending",
        }),
        subtractPlan({
          table: "manufacturing",
          groupingField: "production_line",
          left: tableMeasure({ table: "manufacturing", field: "units_produced", label: "Total units produced" }),
          right: tableMeasure({ table: "manufacturing", field: "defective_units", label: "Total defective units" }),
          derivedAlias: "units_minus_defects",
        }),
        subtractPlan({
          table: "inventory",
          groupingField: "warehouse",
          left: tableMeasure({ table: "inventory", field: "units_received", label: "Total units received" }),
          right: tableMeasure({ table: "inventory", field: "units_shipped", label: "Total units shipped" }),
          derivedAlias: "received_minus_shipped",
        }),
      ];
      return cases.flatMap((plan) => {
        const result = renderBusinessSqlQueryPlan(plan);
        return result.rendered && result.sql?.includes(` AS "${plan.derivedMeasures[0].sqlAlias}"`)
          ? []
          : [`Expected subtract rendering for ${plan.id}.`];
      });
    },
  },
  {
    name: "existing SQL with empty derived measures remains byte identical",
    assert: () => {
      const result = renderBusinessSqlQueryPlan(existingRenderablePlan());
      const expectedSql = [
        "SELECT",
        '  "leases"."lease_status" AS "lease_status",',
        '  COUNT(*) AS "count_leases"',
        'FROM "leases"',
        'GROUP BY "leases"."lease_status"',
        'ORDER BY "count_leases" DESC;',
      ].join("\n");
      return result.sql === expectedSql &&
        result.inserted === false &&
        result.ranQuery === false
        ? []
        : ["Expected existing render path to remain byte-identical and manual-only."];
    },
  },
];

export function runBusinessSqlDerivedMeasureContractFixtures(): BusinessSqlDerivedMeasureContractFixtureReport {
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

export const businessSqlDerivedMeasureContractFixturesPass =
  runBusinessSqlDerivedMeasureContractFixtures().failed.length === 0;
