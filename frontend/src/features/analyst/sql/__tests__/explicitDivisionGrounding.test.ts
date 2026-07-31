/** PS-3e - explicit X divided by Y grounding fixtures. */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type {
  AnalysisScopeSelection,
  WorksheetMetadata,
} from "../../../workbook";
import {
  detectExplicitDivisionFormula,
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
  type AdaptiveReportProposalRequest,
} from "../adaptiveReportProposal";
import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import { detectBusinessIntent } from "../businessIntentGrounding";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import { renderBusinessSqlQueryPlan } from "../businessSqlRenderer";
import { evaluateBusinessSqlRendererCapability } from "../businessSqlRendererCapability";
import { createBusinessSqlDerivedMeasureId } from "../businessSqlQueryPlan";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

export type ExplicitDivisionGroundingFixtureReport = {
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

const ordersSchema = [
  column("channel", "categorical"),
  column("revenue", "numeric"),
  column("order_id", "text"),
];

const pipeline = (input: AdaptiveReportProposalRequest) => {
  const proposal = proposeAdaptiveReport(input);
  const bridge = createBusinessSqlPlanFromAdaptiveProposal({ proposal });
  const renderResult = bridge.plan ? renderBusinessSqlQueryPlan(bridge.plan) : null;
  const preview = bridge.plan ? createBusinessSqlRenderPreview(bridge.plan) : null;
  const capability = bridge.plan ? evaluateBusinessSqlRendererCapability(bridge.plan) : null;
  return { proposal, bridge, renderResult, preview, capability };
};

const primaryPrompt = "Show total revenue divided by order count by channel.";
const primaryRequest = () => request(primaryPrompt, "orders", ordersSchema);

const expectedPrimarySql = [
  "SELECT",
  '  "orders"."channel" AS "channel",',
  '  SUM("orders"."revenue") AS "total_revenue",',
  '  COUNT("orders"."order_id") AS "order_count",',
  "  CASE",
  '    WHEN (COUNT("orders"."order_id")) = 0 THEN NULL',
  '    ELSE (SUM("orders"."revenue")) / (COUNT("orders"."order_id"))',
  '  END AS "total_revenue_divided_by_order_count"',
  'FROM "orders"',
  'GROUP BY "orders"."channel";',
].join("\n");

const expectNoExecutionSurface = ({
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
  ...(preview && !preview.actions.canInsertSql && !preview.actions.canRunSql
    ? []
    : ["Preview must not enable Insert or Run automatically."]),
];

const expectBlocked = (
  prompt: string,
  tableName: string,
  schema: SchemaColumn[],
): string[] => {
  const { proposal, bridge, renderResult, preview } = pipeline(request(prompt, tableName, schema));
  return [
    ...(proposal.derivedMeasures.length === 0 ? [] : ["Unsupported prompt must not create a derived measure."]),
    ...(bridge.state !== "render_ready_plan" ? [] : ["Unsupported prompt must not become render-ready."]),
    ...(!renderResult?.rendered && (renderResult?.sql ?? null) === null
      ? []
      : ["Unsupported prompt must not render SQL."]),
    ...((preview?.sql ?? null) === null ? [] : ["Unsupported prompt must not produce preview SQL."]),
  ];
};

const expectNoDivisionDerivedMeasure = (
  prompt: string,
  tableName: string,
  schema: SchemaColumn[],
): string[] => {
  const { proposal, bridge } = pipeline(request(prompt, tableName, schema));
  return [
    ...(proposal.derivedMeasures.every((derived) => derived.operator !== "divide")
      ? []
      : ["Prompt must not create a division-derived measure."]),
    ...(bridge.plan?.derivedMeasures.every((derived) => derived.operator !== "divide") ?? true
      ? []
      : ["Prompt must not bridge a division-derived measure."]),
  ];
};

const fixtures: Fixture[] = [
  {
    name: "parser detects one X divided by Y formula and separates final grouping by clause",
    assert: () => {
      const parsed = detectExplicitDivisionFormula(primaryPrompt);
      if (parsed.status !== "detected") return ["Expected detected division formula."];
      return [
        ...(parsed.leftPhrase === "total revenue"
          ? []
          : [`Expected numerator total revenue, got ${parsed.leftPhrase}.`]),
        ...(parsed.rightPhrase === "order count"
          ? []
          : [`Expected denominator order count, got ${parsed.rightPhrase}.`]),
        ...(parsed.groupingPhrase === "channel"
          ? []
          : [`Expected grouping channel, got ${parsed.groupingPhrase}.`]),
        ...(parsed.evidence === "total revenue divided by order count"
          ? []
          : ["Expected evidence to exclude grouping clause."]),
      ];
    },
  },
  {
    name: "introductory words are removed from numerator and grouping is removed from denominator",
    assert: () => {
      const parsed = detectExplicitDivisionFormula(
        "Calculate total usage divided by account count by service region.",
      );
      if (parsed.status !== "detected") return ["Expected detected division formula."];
      return [
        ...(parsed.leftPhrase === "total usage" ? [] : ["Expected trimmed numerator."]),
        ...(parsed.rightPhrase === "account count" ? [] : ["Expected denominator without grouping."]),
        ...(parsed.groupingPhrase === "service region" ? [] : ["Expected final grouping phrase."]),
      ];
    },
  },
  {
    name: "primary proposal contains two base metrics one grouping and one divide derived measure",
    assert: () => {
      const proposal = proposeAdaptiveReport(primaryRequest());
      const derived = proposal.derivedMeasures[0];
      return [
        ...(proposal.metrics.length === 2 ? [] : ["Expected two proposed base metrics."]),
        ...(proposal.groupings.length === 1 ? [] : ["Expected one proposed grouping."]),
        ...(proposal.derivedMeasures.length === 1 ? [] : ["Expected one derived measure."]),
        ...(proposal.metrics[0]?.kind === "sum" && proposal.metrics[0]?.columnName === "revenue"
          ? []
          : ["Expected numerator SUM(revenue)."]),
        ...(proposal.metrics[1]?.kind === "count_entities" && proposal.metrics[1]?.columnName === "order_id"
          ? []
          : ["Expected denominator order-count metric."]),
        ...(derived?.operator === "divide" ? [] : ["Expected divide operator."]),
        ...(derived?.leftMetricId === proposal.metrics[0]?.id &&
        derived?.rightMetricId === proposal.metrics[1]?.id
          ? []
          : ["Expected derived measure to reference proposed metric IDs in operand order."]),
        ...(derived?.divisionPolicy?.zeroDenominator === "null"
          ? []
          : ["Expected null-on-zero proposal policy."]),
        ...(proposal.rowLimit === null ? [] : ["Expected no implicit row limit."]),
        ...((proposal.sorts || []).length === 0 ? [] : ["Expected no derived-target ORDER BY."]),
        ...(proposal.aggregateResultConditions.length === 0 ? [] : ["Expected no derived-target HAVING."]),
      ];
    },
  },
  {
    name: "divide proposal ID is deterministic label alias and position independent while operand order matters",
    assert: () => {
      const proposal = proposeAdaptiveReport(primaryRequest());
      const derived = proposal.derivedMeasures[0];
      const same = proposeAdaptiveReport(primaryRequest()).derivedMeasures[0];
      if (!derived || !same) return ["Expected primary derived measures."];
      const relabeled = {
        ...derived,
        label: "Friendly text",
        sqlAlias: "friendly_alias",
      };
      const reversed = proposeAdaptiveReport(
        request("Show order count divided by total revenue by channel.", "orders", ordersSchema),
      ).derivedMeasures[0];
      const expectedId = `derived-measure:divide:${derived.leftMetricId.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "")}:${derived.rightMetricId.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "")}:null`;
      return [
        ...(derived.id === same.id ? [] : ["Expected deterministic proposal ID."]),
        ...(derived.id === expectedId ? [] : ["Expected policy to participate in divide ID."]),
        ...(derived.id === same.id && derived.id === relabeled.id
          ? []
          : ["Expected ID independent of label and SQL alias."]),
        ...(reversed && reversed.id !== derived.id ? [] : ["Expected operand reversal to change ID."]),
      ];
    },
  },
  {
    name: "bridge maps proposed operand metric IDs to final measure IDs and preserves null policy",
    assert: () => {
      const { proposal, bridge } = pipeline(primaryRequest());
      const plan = bridge.plan;
      const derived = plan?.derivedMeasures[0];
      if (!plan || !derived) return ["Expected final plan with derived measure."];
      const expectedId = createBusinessSqlDerivedMeasureId({
        operator: "divide",
        leftMeasureId: plan.measures[0].measureId,
        rightMeasureId: plan.measures[1].measureId,
        divisionPolicy: { zeroDenominator: "null" },
      });
      return [
        ...(derived.leftMeasureId === plan.measures[0].measureId &&
        derived.rightMeasureId === plan.measures[1].measureId
          ? []
          : ["Expected bridge to map proposed IDs to final stable measure IDs."]),
        ...(derived.divisionPolicy?.zeroDenominator === "null"
          ? []
          : ["Expected final null-on-zero policy."]),
        ...(derived.derivedMeasureId === expectedId
          ? []
          : ["Expected final derived ID to use Business SQL helper."]),
        ...(proposal.derivedMeasures[0]?.leftMetricId === proposal.metrics[0]?.id &&
        proposal.derivedMeasures[0]?.rightMetricId === proposal.metrics[1]?.id
          ? []
          : ["Expected proposal references to remain proposed metric IDs."]),
      ];
    },
  },
  {
    name: "primary prompt renders exact deterministic guarded SQL through full pipeline",
    assert: () => {
      const { bridge, renderResult, preview, capability, proposal } = pipeline(primaryRequest());
      return [
        ...(bridge.state === "render_ready_plan" ? [] : ["Expected render-ready bridge plan."]),
        ...(capability?.capable ? [] : ["Expected renderer capability for divide."]),
        ...(renderResult?.sql === expectedPrimarySql ? [] : ["Expected exact primary division SQL."]),
        ...(renderResult?.sql?.includes("CASE") && renderResult.sql.includes("THEN NULL")
          ? []
          : ["Expected CASE zero guard."]),
        ...(renderResult?.sql?.includes(" / ") &&
        !renderResult.sql.includes('("total_revenue") /') &&
        !renderResult.sql.includes("Revenue")
          ? []
          : ["Expected no unguarded alias or label division expression."]),
        ...(preview?.sql === expectedPrimarySql && preview.actions.canCopySql
          ? []
          : ["Expected copy-only preview SQL for fully supported formula."]),
        ...expectNoExecutionSurface({ proposal, preview }),
      ];
    },
  },
  {
    name: "unresolved numerator denominator count nouns and grouping block without guessed SQL",
    assert: () => {
      const missingGrouping = pipeline(
        request("Show total revenue divided by order count by territory.", "orders", ordersSchema),
      );
      return [
        ...expectBlocked("Show total mystery divided by order count by channel.", "orders", ordersSchema),
        ...expectBlocked("Show total revenue divided by widget count by channel.", "orders", ordersSchema),
        ...(missingGrouping.bridge.state !== "render_ready_plan"
          ? []
          : ["Missing grouping must not become render-ready."]),
        ...(missingGrouping.renderResult?.sql === null
          ? []
          : ["Missing grouping must not produce misleading SQL."]),
      ];
    },
  },
  {
    name: "multiple mixed and implicit formulas remain unsupported",
    assert: () => [
      ...expectBlocked(
        "Show total revenue divided by order count divided by customer count by channel.",
        "orders",
        [...ordersSchema, column("customer_id", "text")],
      ),
      ...expectBlocked(
        "Show total revenue divided by order count and total cost divided by order count by channel.",
        "orders",
        [...ordersSchema, column("cost", "numeric")],
      ),
      ...expectBlocked(
        "Show total revenue minus total cost divided by order count by channel.",
        "orders",
        [...ordersSchema, column("cost", "numeric")],
      ),
      ...expectNoDivisionDerivedMeasure("Show average order value by channel.", "orders", ordersSchema),
      ...expectNoDivisionDerivedMeasure("Show revenue per customer by channel.", "orders", ordersSchema),
      ...expectNoDivisionDerivedMeasure("Show total revenue above 500000 by channel.", "orders", ordersSchema),
    ],
  },
  {
    name: "existing explicit subtraction proposal remains unchanged and has no division policy",
    assert: () => {
      const proposal = proposeAdaptiveReport(
        request("Show total revenue minus total cost by channel.", "orders", [
          ...ordersSchema,
          column("cost", "numeric"),
        ]),
      );
      const derived = proposal.derivedMeasures[0];
      return [
        ...(derived?.operator === "subtract" ? [] : ["Expected subtraction operator unchanged."]),
        ...(derived && !derived.divisionPolicy ? [] : ["Subtract proposal must not include division policy."]),
      ];
    },
  },
  {
    name: "cross-domain explicit division prompts render exact deterministic SQL",
    assert: () => {
      const cases = [
        {
          request: request("Show total sales divided by order count by channel.", "sales", [
            column("channel", "categorical"),
            column("sales", "numeric"),
            column("order_id", "text"),
          ]),
          expected: [
            "SELECT",
            '  "sales"."channel" AS "channel",',
            '  SUM("sales"."sales") AS "total_sales",',
            '  COUNT("sales"."order_id") AS "order_count",',
            "  CASE",
            '    WHEN (COUNT("sales"."order_id")) = 0 THEN NULL',
            '    ELSE (SUM("sales"."sales")) / (COUNT("sales"."order_id"))',
            '  END AS "total_sales_divided_by_order_count"',
            'FROM "sales"',
            'GROUP BY "sales"."channel";',
          ].join("\n"),
        },
        {
          request: request("Show total defects divided by total units produced by production line.", "manufacturing", [
            column("production_line", "categorical"),
            column("defects", "numeric"),
            column("units_produced", "numeric"),
          ]),
          expected: [
            "SELECT",
            '  "manufacturing"."production_line" AS "production_line",',
            '  SUM("manufacturing"."defects") AS "total_defects",',
            '  SUM("manufacturing"."units_produced") AS "total_units_produced",',
            "  CASE",
            '    WHEN (SUM("manufacturing"."units_produced")) = 0 THEN NULL',
            '    ELSE (SUM("manufacturing"."defects")) / (SUM("manufacturing"."units_produced"))',
            '  END AS "total_defects_divided_by_total_units_produced"',
            'FROM "manufacturing"',
            'GROUP BY "manufacturing"."production_line";',
          ].join("\n"),
        },
        {
          request: request("Show total usage divided by account count by service region.", "usage", [
            column("service_region", "categorical"),
            column("usage", "numeric"),
            column("account_id", "text"),
          ]),
          expected: [
            "SELECT",
            '  "usage"."service_region" AS "service_region",',
            '  SUM("usage"."usage") AS "total_usage",',
            '  COUNT("usage"."account_id") AS "account_count",',
            "  CASE",
            '    WHEN (COUNT("usage"."account_id")) = 0 THEN NULL',
            '    ELSE (SUM("usage"."usage")) / (COUNT("usage"."account_id"))',
            '  END AS "total_usage_divided_by_account_count"',
            'FROM "usage"',
            'GROUP BY "usage"."service_region";',
          ].join("\n"),
        },
        {
          request: request("Show total spending divided by project count by program.", "projects", [
            column("program", "categorical"),
            column("spending", "numeric"),
            column("project_id", "text"),
          ]),
          expected: [
            "SELECT",
            '  "projects"."program" AS "program",',
            '  SUM("projects"."spending") AS "total_spending",',
            '  COUNT("projects"."project_id") AS "project_count",',
            "  CASE",
            '    WHEN (COUNT("projects"."project_id")) = 0 THEN NULL',
            '    ELSE (SUM("projects"."spending")) / (COUNT("projects"."project_id"))',
            '  END AS "total_spending_divided_by_project_count"',
            'FROM "projects"',
            'GROUP BY "projects"."program";',
          ].join("\n"),
        },
      ];
      return cases.flatMap(({ request: input, expected }) => {
        const { renderResult, preview } = pipeline(input);
        return [
          ...(renderResult?.sql === expected ? [] : [`Expected exact SQL for ${input.prompt}.`]),
          ...(renderResult?.sql?.includes("CASE") && renderResult.sql.includes("THEN NULL")
            ? []
            : [`Expected guarded division SQL for ${input.prompt}.`]),
          ...(preview?.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql
            ? []
            : [`Expected manual-only preview for ${input.prompt}.`]),
        ];
      });
    },
  },
];

export function runExplicitDivisionGroundingFixtures(): ExplicitDivisionGroundingFixtureReport {
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

export const explicitDivisionGroundingFixturesPass =
  runExplicitDivisionGroundingFixtures().failed.length === 0;
