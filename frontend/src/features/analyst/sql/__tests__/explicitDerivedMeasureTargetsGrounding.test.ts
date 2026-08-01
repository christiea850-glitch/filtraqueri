/** PS-4d - explicit natural-language derived ORDER BY and HAVING target grounding fixtures. */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type {
  AnalysisScopeSelection,
  WorksheetMetadata,
} from "../../../workbook";
import {
  detectDerivedRankingShell,
  detectDerivedThresholdShell,
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
  type AdaptiveReportProposalRequest,
} from "../adaptiveReportProposal";
import {
  createBusinessSqlPlanFromAdaptiveProposal,
  type AdaptiveProposalBusinessSqlBridgeResult,
} from "../adaptiveProposalBusinessSqlBridge";
import { detectBusinessIntent } from "../businessIntentGrounding";
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

export type ExplicitDerivedMeasureTargetsGroundingFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"] = "text",
): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "DOUBLE" : "VARCHAR",
  inferred_type,
  null_count: 0,
  unique_count: 10,
  sample_values: [],
});

const worksheet = (
  tableName: string,
  schema: SchemaColumn[],
): Pick<WorksheetMetadata, "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema"> => ({
  worksheetId: `worksheet:${tableName}`,
  displayName: tableName,
  sheetName: tableName,
  tableName,
  schema,
});

const scope = (...tableNames: string[]): AnalysisScopeSelection[] =>
  tableNames.map((tableName) => ({
    worksheetId: `worksheet:${tableName}`,
    sourceType: "original",
    tableName,
    originalTableName: tableName,
  }));

const request = (
  prompt: string,
  tableName: string,
  schema: SchemaColumn[],
): AdaptiveReportProposalRequest => ({
  prompt,
  detectedIntent: detectBusinessIntent(prompt),
  appliedScopeSelections: scope(tableName),
  worksheets: [worksheet(tableName, schema)],
});

const financeSchema = [
  column("region", "categorical"),
  column("revenue", "numeric"),
  column("cost", "numeric"),
];

const ratesSchema = [
  column("category", "categorical"),
  column("rate", "numeric"),
  column("units", "numeric"),
];

const hoursSchema = [
  column("department", "categorical"),
  column("regular_hours", "numeric"),
  column("overtime_hours", "numeric"),
];

const channelSchema = [
  column("channel", "categorical"),
  column("sales", "numeric"),
  column("orders", "numeric"),
];

const warehouseSchema = [
  column("warehouse", "categorical"),
  column("received_units", "numeric"),
  column("shipped_units", "numeric"),
];

const pipeline = (input: AdaptiveReportProposalRequest) => {
  const proposal = proposeAdaptiveReport(input);
  const bridge = createBusinessSqlPlanFromAdaptiveProposal({ proposal });
  const renderResult = bridge.plan ? renderBusinessSqlQueryPlan(bridge.plan) : null;
  const preview = bridge.plan ? createBusinessSqlRenderPreview(bridge.plan) : null;
  return { proposal, bridge, renderResult, preview };
};

const expectManualPreview = ({
  proposal,
  preview,
}: {
  proposal: AdaptiveReportProposal;
  preview: ReturnType<typeof createBusinessSqlRenderPreview> | null;
}): string[] => [
  ...(proposal.sql === null &&
  !proposal.canRenderSql &&
  !proposal.canInsertSql &&
  !proposal.canRunSql
    ? []
    : ["Proposal must remain planning-only."]),
  ...(preview?.sql &&
  preview.actions.canCopySql &&
  !preview.actions.canInsertSql &&
  !preview.actions.canRunSql
    ? []
    : ["Preview must expose SQL copy only, with no automatic insert or run."]),
];

const expectNoSql = ({
  proposal,
  bridge,
}: {
  proposal: AdaptiveReportProposal;
  bridge: AdaptiveProposalBusinessSqlBridgeResult;
}): string[] => {
  const preview = bridge.plan ? createBusinessSqlRenderPreview(bridge.plan) : null;
  const rendered = bridge.plan ? renderBusinessSqlQueryPlan(bridge.plan) : null;
  return [
    ...(proposal.derivedMeasures.length === 0 &&
    proposal.aggregateResultConditions.length === 0 &&
    (proposal.sorts || []).length === 0
      ? []
      : ["Unsupported prompt must not create derived targets."]),
    ...(!rendered?.rendered && rendered?.sql !== ""
      ? []
      : ["Unsupported prompt must not render SQL."]),
    ...(preview === null ||
    (preview.sql === null &&
      !preview.actions.canCopySql &&
      !preview.actions.canInsertSql &&
      !preview.actions.canRunSql)
      ? []
      : ["Unsupported prompt must expose no SQL actions."]),
  ];
};

const expectedRankingSql = [
  "SELECT",
  '  "finance"."region" AS "region",',
  '  SUM("finance"."revenue") AS "total_revenue",',
  '  SUM("finance"."cost") AS "total_cost",',
  '  (SUM("finance"."revenue")) - (SUM("finance"."cost")) AS "total_revenue_minus_total_cost"',
  'FROM "finance"',
  'GROUP BY "finance"."region"',
  'ORDER BY "total_revenue_minus_total_cost" DESC;',
].join("\n");

const expectedThresholdSql = [
  "SELECT",
  '  "finance"."region" AS "region",',
  '  SUM("finance"."revenue") AS "total_revenue",',
  '  SUM("finance"."cost") AS "total_cost",',
  '  (SUM("finance"."revenue")) - (SUM("finance"."cost")) AS "total_revenue_minus_total_cost"',
  'FROM "finance"',
  'GROUP BY "finance"."region"',
  'HAVING (SUM("finance"."revenue")) - (SUM("finance"."cost")) > 100000;',
].join("\n");

const fixtures: Fixture[] = [
  {
    name: "explicit derived ranking shell preserves grouping formula and direction boundaries",
    assert: () => {
      const prompt = "Rank regions by total revenue minus total cost descending.";
      const detected = detectDerivedRankingShell(prompt);
      const { proposal, bridge, renderResult, preview } = pipeline(request(prompt, "finance", financeSchema));
      const derived = proposal.derivedMeasures[0];
      const sort = proposal.sorts?.[0];
      const planSort = bridge.plan?.orderBy[0];
      return [
        ...(detected.status === "detected" &&
        detected.groupingPhrase === "regions" &&
        detected.formula.leftPhrase === "total revenue" &&
        detected.formula.rightPhrase === "total cost" &&
        detected.direction === "desc"
          ? []
          : ["Expected bounded derived ranking shell detection."]),
        ...(proposal.groupings[0]?.columnName === "region" ? [] : ["Expected ranking grouping to bind independently."]),
        ...(proposal.rowLimit === null ? [] : ["Derived ranking must not add an implicit row limit."]),
        ...(derived && sort?.target === "derived_measure" && sort.targetId === derived.id
          ? []
          : ["Expected proposed sort to target the proposed derived-measure ID."]),
        ...(planSort?.target.kind === "derived_measure" &&
        planSort.target.derivedMeasureId === bridge.plan?.derivedMeasures[0]?.derivedMeasureId
          ? []
          : ["Expected bridge to map proposed derived sort target to final derivedMeasureId."]),
        ...(renderResult?.sql === expectedRankingSql ? [] : ["Expected exact primary derived ranking SQL."]),
        ...(renderResult?.sql && !renderResult.sql.split("ORDER BY")[1]?.includes("SUM(")
          ? []
          : ["Derived ranking ORDER BY must not repeat the derived expression."]),
        ...expectManualPreview({ proposal, preview }),
      ];
    },
  },
  {
    name: "explicit derived threshold shell preserves grouping formula operator and value boundaries",
    assert: () => {
      const prompt = "Show regions where total revenue minus total cost is above 100000.";
      const detected = detectDerivedThresholdShell(prompt);
      const { proposal, bridge, renderResult, preview } = pipeline(request(prompt, "finance", financeSchema));
      const derived = proposal.derivedMeasures[0];
      const condition = proposal.aggregateResultConditions[0];
      const planCondition = bridge.plan?.aggregateResultConditions[0];
      return [
        ...(detected.status === "detected" &&
        detected.groupingPhrase === "regions" &&
        detected.formula.leftPhrase === "total revenue" &&
        detected.formula.rightPhrase === "total cost" &&
        detected.threshold.operator === "greater_than" &&
        detected.threshold.comparisonValue.value === 100000
          ? []
          : ["Expected bounded derived threshold shell detection."]),
        ...(condition?.target?.kind === "derived_measure" &&
        condition.target.derivedMeasureId === derived?.id
          ? []
          : ["Expected proposed aggregate condition to target proposed derived-measure ID."]),
        ...(planCondition?.target?.kind === "derived_measure" &&
        planCondition.target.derivedMeasureId === bridge.plan?.derivedMeasures[0]?.derivedMeasureId
          ? []
          : ["Expected bridge to map proposed derived condition target to final derivedMeasureId."]),
        ...(proposal.sorts?.length === 0 && proposal.rowLimit === null
          ? []
          : ["Derived threshold must not add implicit ORDER BY or LIMIT."]),
        ...(renderResult?.sql === expectedThresholdSql ? [] : ["Expected exact primary derived threshold SQL."]),
        ...(renderResult?.sql && !renderResult.sql.includes('HAVING "total_revenue_minus_total_cost"')
          ? []
          : ["Derived HAVING must not use the derived alias."]),
        ...expectManualPreview({ proposal, preview }),
      ];
    },
  },
  {
    name: "derived ranking renders all four operators through one proposal bridge path",
    assert: () => {
      const cases = [
        {
          prompt: "Show departments ranked by total regular hours plus total overtime hours ascending.",
          table: "hours",
          schema: hoursSchema,
          expected: [
            "SELECT",
            '  "hours"."department" AS "department",',
            '  SUM("hours"."regular_hours") AS "total_regular_hours",',
            '  SUM("hours"."overtime_hours") AS "total_overtime_hours",',
            '  (SUM("hours"."regular_hours")) + (SUM("hours"."overtime_hours")) AS "total_regular_hours_plus_total_overtime_hours"',
            'FROM "hours"',
            'GROUP BY "hours"."department"',
            'ORDER BY "total_regular_hours_plus_total_overtime_hours" ASC;',
          ].join("\n"),
        },
        {
          prompt: "Rank warehouses by total received units minus total shipped units descending.",
          table: "warehouses",
          schema: warehouseSchema,
          expected: [
            "SELECT",
            '  "warehouses"."warehouse" AS "warehouse",',
            '  SUM("warehouses"."received_units") AS "total_received_units",',
            '  SUM("warehouses"."shipped_units") AS "total_shipped_units",',
            '  (SUM("warehouses"."received_units")) - (SUM("warehouses"."shipped_units")) AS "total_received_units_minus_total_shipped_units"',
            'FROM "warehouses"',
            'GROUP BY "warehouses"."warehouse"',
            'ORDER BY "total_received_units_minus_total_shipped_units" DESC;',
          ].join("\n"),
        },
        {
          prompt: "Show categories ranked by average rate multiplied by total units descending.",
          table: "rates",
          schema: ratesSchema,
          expected: [
            "SELECT",
            '  "rates"."category" AS "category",',
            '  AVG("rates"."rate") AS "average_rate",',
            '  SUM("rates"."units") AS "total_units",',
            '  (AVG("rates"."rate")) * (SUM("rates"."units")) AS "average_rate_multiplied_by_total_units"',
            'FROM "rates"',
            'GROUP BY "rates"."category"',
            'ORDER BY "average_rate_multiplied_by_total_units" DESC;',
          ].join("\n"),
        },
        {
          prompt: "Rank channels by total sales divided by total orders descending.",
          table: "channels",
          schema: channelSchema,
          expectedIncludes: 'ORDER BY "total_sales_divided_by_total_orders" DESC;',
        },
      ];
      return cases.flatMap(({ prompt, table, schema, expected, expectedIncludes }) => {
        const { proposal, renderResult } = pipeline(request(prompt, table, schema));
        return [
          ...(proposal.derivedMeasures.length === 1 && proposal.sorts?.[0]?.target === "derived_measure"
            ? []
            : [`Expected derived ranking target for ${prompt}.`]),
          ...((expected ? renderResult?.sql === expected : renderResult?.sql?.includes(expectedIncludes || ""))
            ? []
            : [`Expected derived ranking SQL for ${prompt}.`]),
          ...(renderResult?.sql && !renderResult.sql.split("ORDER BY")[1]?.includes("SUM(")
            ? []
            : [`Expected derived ranking ORDER BY alias only for ${prompt}.`]),
        ];
      });
    },
  },
  {
    name: "derived thresholds render operators numeric grammar and guarded divide",
    assert: () => {
      const cases = [
        {
          prompt: "Show departments where total regular hours plus total overtime hours is at least 500000.25.",
          table: "hours",
          schema: hoursSchema,
          expectedHaving: 'HAVING (SUM("hours"."regular_hours")) + (SUM("hours"."overtime_hours")) >= 500000.25;',
        },
        {
          prompt: "Show regions where total revenue minus total cost is more than 500,000.",
          table: "finance",
          schema: financeSchema,
          expectedHaving: 'HAVING (SUM("finance"."revenue")) - (SUM("finance"."cost")) > 500000;',
        },
        {
          prompt: "Show categories where average rate multiplied by total units is below 10000.",
          table: "rates",
          schema: ratesSchema,
          expectedHaving: 'HAVING (AVG("rates"."rate")) * (SUM("rates"."units")) < 10000;',
        },
        {
          prompt: "Show channels where total sales divided by total orders is at most 10.5.",
          table: "channels",
          schema: channelSchema,
          expectedHaving: "END <= 10.5;",
          divide: true,
        },
      ];
      return cases.flatMap(({ prompt, table, schema, expectedHaving, divide }) => {
        const { proposal, renderResult } = pipeline(request(prompt, table, schema));
        return [
          ...(proposal.aggregateResultConditions[0]?.target?.kind === "derived_measure"
            ? []
            : [`Expected derived threshold target for ${prompt}.`]),
          ...(renderResult?.sql?.includes(expectedHaving)
            ? []
            : [`Expected derived HAVING SQL for ${prompt}.`]),
          ...(!divide || (renderResult?.sql?.match(/\bCASE\b/g) || []).length === 2
            ? []
            : ["Expected divide CASE guard in SELECT and HAVING."]),
          ...(!divide || !renderResult?.sql?.includes("HAVING (SUM")
            ? []
            : ["Expected no unguarded divide HAVING SQL."]),
        ];
      });
    },
  },
  {
    name: "all comparison operators remain available for derived thresholds",
    assert: () => {
      const phrases = [
        { phrase: "above 1", operator: "greater_than", sql: "> 1" },
        { phrase: "at least 2.5", operator: "greater_than_or_equal", sql: ">= 2.5" },
        { phrase: "below 3", operator: "less_than", sql: "< 3" },
        { phrase: "at most 4.25", operator: "less_than_or_equal", sql: "<= 4.25" },
        { phrase: "equal to 5", operator: "equals", sql: "= 5" },
        { phrase: "not equal to 6.75", operator: "not_equals", sql: "<> 6.75" },
      ];
      return phrases.flatMap(({ phrase, operator, sql }) => {
        const prompt = `Show regions where total revenue minus total cost is ${phrase}.`;
        const { proposal, renderResult } = pipeline(request(prompt, "finance", financeSchema));
        return [
          ...(proposal.aggregateResultConditions[0]?.operator === operator
            ? []
            : [`Expected operator ${operator}.`]),
          ...(renderResult?.sql?.includes(`${sql};`) ? [] : [`Expected SQL operator ${sql}.`]),
        ];
      });
    },
  },
  {
    name: "proposal target IDs are stable and ignore presentation metadata",
    assert: () => {
      const first = proposeAdaptiveReport(request(
        "Rank regions by total revenue minus total cost descending.",
        "finance",
        financeSchema,
      ));
      const second = proposeAdaptiveReport(request(
        "Rank regions by total revenue minus total cost descending.",
        "finance",
        financeSchema,
      ));
      const threshold = proposeAdaptiveReport(request(
        "Show regions where total revenue minus total cost is above 100000.",
        "finance",
        financeSchema,
      ));
      const relabeledCondition = {
        ...threshold.aggregateResultConditions[0],
        label: "Other label",
        evidence: "Other evidence",
      };
      const originalCondition = threshold.aggregateResultConditions[0];
      return [
        ...(first.derivedMeasures[0]?.id === second.derivedMeasures[0]?.id
          ? []
          : ["Expected stable proposed derived measure ID."]),
        ...(first.sorts?.[0]?.id === second.sorts?.[0]?.id
          ? []
          : ["Expected stable proposed derived sort ID."]),
        ...(originalCondition?.id === relabeledCondition.id
          ? []
          : ["Expected proposed derived condition ID to ignore label and evidence."]),
      ];
    },
  },
  {
    name: "unresolved derived target references block bridge conversion",
    assert: () => {
      const sortProposal = proposeAdaptiveReport(request(
        "Rank regions by total revenue minus total cost descending.",
        "finance",
        financeSchema,
      ));
      const conditionProposal = proposeAdaptiveReport(request(
        "Show regions where total revenue minus total cost is above 100000.",
        "finance",
        financeSchema,
      ));
      const sortBridge = createBusinessSqlPlanFromAdaptiveProposal({
        proposal: {
          ...sortProposal,
          sorts: sortProposal.sorts?.map((sort) => ({ ...sort, targetId: "derived-measure:missing" })),
        },
      });
      const conditionBridge = createBusinessSqlPlanFromAdaptiveProposal({
        proposal: {
          ...conditionProposal,
          aggregateResultConditions: conditionProposal.aggregateResultConditions.map((condition) => ({
            ...condition,
            target: { kind: "derived_measure", derivedMeasureId: "derived-measure:missing" },
          })),
        },
      });
      return [
        ...(sortBridge.issues.some((item) => item.code === "unresolved_derived_measure_reference")
          ? []
          : ["Expected unresolved derived sort reference issue."]),
        ...(conditionBridge.issues.some((item) => item.code === "unresolved_derived_measure_reference")
          ? []
          : ["Expected unresolved derived condition reference issue."]),
        ...(!renderBusinessSqlQueryPlan(sortBridge.plan!).rendered &&
        !renderBusinessSqlQueryPlan(conditionBridge.plan!).rendered
          ? []
          : ["Unresolved derived references must not render partial SQL."]),
      ];
    },
  },
  {
    name: "unsupported prompts do not create derived targets or SQL",
    assert: () => {
      const prompts = [
        "Rank regions by total revenue minus total cost.",
        "Rank regions by total revenue minus total cost ascending descending.",
        "Show regions where total revenue minus total cost.",
        "Show regions where total revenue minus total cost is above 100,00.",
        "Show regions where total revenue minus total cost is above 100000 and below 200000.",
        "Show regions where revenue minus cost is above 100000 ranked by revenue minus cost descending.",
        "Rank regions by profit descending.",
        "Show regions where profit is above 100000.",
        "Rank products by margin descending.",
      ];
      return prompts.flatMap((prompt) => {
        const result = pipeline(request(prompt, "finance", financeSchema));
        return expectNoSql(result).map((failure) => `${prompt}: ${failure}`);
      });
    },
  },
  {
    name: "base sorting and base HAVING remain base-targeted",
    assert: () => {
      const baseSort = pipeline(request("Show regions by total revenue descending.", "finance", financeSchema));
      const baseHaving = pipeline(request("Show regions where total revenue is above 100000.", "finance", financeSchema));
      return [
        ...(baseSort.proposal.derivedMeasures.length === 0 &&
        baseSort.bridge.plan?.orderBy[0]?.target.kind === "measure"
          ? []
          : ["Expected base sort to remain measure-targeted."]),
        ...(baseHaving.proposal.derivedMeasures.length === 0 &&
        baseHaving.bridge.plan?.aggregateResultConditions[0]?.target?.kind !== "derived_measure"
          ? []
          : ["Expected base HAVING to remain measure-targeted."]),
      ];
    },
  },
];

export function runExplicitDerivedMeasureTargetsGroundingFixtures(): ExplicitDerivedMeasureTargetsGroundingFixtureReport {
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

export const explicitDerivedMeasureTargetsGroundingFixturesPass =
  runExplicitDerivedMeasureTargetsGroundingFixtures().failed.length === 0;
