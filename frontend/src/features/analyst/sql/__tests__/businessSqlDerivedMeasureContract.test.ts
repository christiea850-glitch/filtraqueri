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
    name: "one valid derived measure is structurally ready but renderer incapable",
    assert: () => {
      const plan = planWith();
      const readiness = readinessFor(plan);
      const capability = evaluateBusinessSqlRendererCapability(plan);
      return [
        ...(readiness.status === "ready" ? [] : ["Expected structurally ready derived plan."]),
        ...(capability.status === "incapable" &&
        capability.reasonCodes.includes("derived_measure_rendering_not_supported") &&
        !capability.reasonCodes.includes("multiple_measures_not_supported")
          ? []
          : ["Expected derived rendering incapability with multiple-measure reason suppressed."]),
      ];
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
    name: "direct rendering and preview of derived measure plan produce no SQL or actions",
    assert: () => {
      const plan = planWith();
      const rendered = renderBusinessSqlQueryPlan(plan);
      const preview = createBusinessSqlRenderPreview(plan);
      return [
        ...(!rendered.rendered && rendered.sql === null
          ? []
          : ["Derived measure plan must not render SQL in PS-3a."]),
        ...(rendered.inserted === false && rendered.ranQuery === false
          ? []
          : ["Derived render refusal must not insert or run."]),
        ...(preview.sql === null &&
        !preview.actions.canCopySql &&
        !preview.actions.canInsertSql &&
        !preview.actions.canRunSql
          ? []
          : ["Derived measure preview must expose no SQL copy insert or run action."]),
      ];
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
