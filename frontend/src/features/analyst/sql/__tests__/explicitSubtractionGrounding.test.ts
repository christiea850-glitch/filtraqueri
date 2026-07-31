/** PS-3c - explicit X minus Y grounding fixtures. */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type {
  AnalysisScopeSelection,
  WorksheetMetadata,
} from "../../../workbook";
import {
  detectExplicitSubtractionFormula,
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

export type ExplicitSubtractionGroundingFixtureReport = {
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

const pipeline = (input: AdaptiveReportProposalRequest) => {
  const proposal = proposeAdaptiveReport(input);
  const bridge = createBusinessSqlPlanFromAdaptiveProposal({ proposal });
  const renderResult = bridge.plan ? renderBusinessSqlQueryPlan(bridge.plan) : null;
  const preview = bridge.plan ? createBusinessSqlRenderPreview(bridge.plan) : null;
  const capability = bridge.plan ? evaluateBusinessSqlRendererCapability(bridge.plan) : null;
  return { proposal, bridge, renderResult, preview, capability };
};

const primaryPrompt = "Show total revenue minus total cost by region.";
const primaryRequest = () => request(primaryPrompt, "finance", financeSchema);

const expectedPrimarySql = [
  "SELECT",
  '  "finance"."region" AS "region",',
  '  SUM("finance"."revenue") AS "total_revenue",',
  '  SUM("finance"."cost") AS "total_cost",',
  '  (SUM("finance"."revenue")) - (SUM("finance"."cost")) AS "total_revenue_minus_total_cost"',
  'FROM "finance"',
  'GROUP BY "finance"."region";',
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

const fixtures: Fixture[] = [
  {
    name: "parser detects exactly one X minus Y formula and trims prompt and grouping boundaries",
    assert: () => {
      const parsed = detectExplicitSubtractionFormula(primaryPrompt);
      if (parsed.status !== "detected") return ["Expected detected subtraction formula."];
      return [
        ...(parsed.leftPhrase === "total revenue"
          ? []
          : [`Expected left operand total revenue, got ${parsed.leftPhrase}.`]),
        ...(parsed.rightPhrase === "total cost"
          ? []
          : [`Expected right operand total cost, got ${parsed.rightPhrase}.`]),
        ...(parsed.groupingPhrase === "region"
          ? []
          : [`Expected grouping region, got ${parsed.groupingPhrase || "none"}.`]),
      ];
    },
  },
  {
    name: "proposal contains two base metrics one derived measure and one grouping",
    assert: () => {
      const proposal = proposeAdaptiveReport(primaryRequest());
      const derived = proposal.derivedMeasures[0];
      return [
        ...(proposal.metrics.length === 2 ? [] : ["Expected exactly two base metrics."]),
        ...(proposal.groupings.length === 1 ? [] : ["Expected exactly one grouping."]),
        ...(proposal.derivedMeasures.length === 1 ? [] : ["Expected exactly one derived measure."]),
        ...(derived?.operator === "subtract" ? [] : ["Expected subtract derived operator."]),
        ...(derived?.leftMetricId === proposal.metrics[0]?.id &&
        derived?.rightMetricId === proposal.metrics[1]?.id
          ? []
          : ["Expected derived measure to reference proposed metric IDs in order."]),
        ...(proposal.metrics[0]?.columnName === "revenue" &&
        proposal.metrics[1]?.columnName === "cost"
          ? []
          : ["Expected operands to ground independently to revenue and cost."]),
      ];
    },
  },
  {
    name: "proposal derived ID is deterministic and independent of label alias and array position",
    assert: () => {
      const proposal = proposeAdaptiveReport(primaryRequest());
      const derived = proposal.derivedMeasures[0];
      if (!derived) return ["Expected derived measure."];
      const sameSemanticId = proposeAdaptiveReport(primaryRequest()).derivedMeasures[0]?.id;
      const changedPresentation = {
        ...derived,
        label: "Changed label",
        sqlAlias: "changed_alias",
      };
      const reversedMetrics = [...proposal.metrics].reverse();
      return [
        ...(derived.id === sameSemanticId ? [] : ["Expected deterministic derived ID."]),
        ...(derived.id ===
        `derived-measure:subtract:${derived.leftMetricId.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "")}:${derived.rightMetricId.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "")}`
          ? []
          : ["Expected derived ID to use only operator and operand metric IDs."]),
        ...(changedPresentation.id === derived.id
          ? []
          : ["Presentation changes must not change derived ID."]),
        ...(reversedMetrics[1]?.id === proposal.metrics[0]?.id &&
        reversedMetrics[0]?.id === proposal.metrics[1]?.id &&
        derived.id === proposal.derivedMeasures[0]?.id
          ? []
          : ["Metric array position must not affect existing derived ID."]),
      ];
    },
  },
  {
    name: "bridge maps proposed metric IDs to final stable measure IDs",
    assert: () => {
      const { proposal, bridge } = pipeline(primaryRequest());
      const plan = bridge.plan;
      const derived = plan?.derivedMeasures[0];
      if (!plan || !derived) return ["Expected bridged derived plan."];
      const expectedId = createBusinessSqlDerivedMeasureId({
        operator: "subtract",
        leftMeasureId: derived.leftMeasureId,
        rightMeasureId: derived.rightMeasureId,
      });
      return [
        ...(plan.measures.length === 2 ? [] : ["Expected two final base measures."]),
        ...(derived.leftMeasureId === plan.measures[0]?.measureId &&
        derived.rightMeasureId === plan.measures[1]?.measureId
          ? []
          : ["Expected final derived operands to reference final measure IDs in order."]),
        ...(derived.derivedMeasureId === expectedId
          ? []
          : ["Expected existing BusinessSql derived ID helper."]),
        ...(proposal.derivedMeasures[0]?.leftMetricId === proposal.metrics[0]?.id &&
        proposal.derivedMeasures[0]?.rightMetricId === proposal.metrics[1]?.id
          ? []
          : ["Expected proposal derived references to remain proposed metric IDs."]),
      ];
    },
  },
  {
    name: "primary prompt renders exact deterministic subtraction SQL through full pipeline",
    assert: () => {
      const { bridge, renderResult, preview, capability, proposal } = pipeline(primaryRequest());
      return [
        ...(bridge.state === "render_ready_plan"
          ? []
          : [`Expected render_ready_plan, got ${bridge.state}.`]),
        ...(capability?.capable ? [] : ["Expected renderer capability."]),
        ...(renderResult?.sql === expectedPrimarySql
          ? []
          : ["Expected exact primary subtraction SQL."]),
        ...(renderResult?.inserted === false && renderResult.ranQuery === false
          ? []
          : ["Renderer must not insert or run SQL."]),
        ...(preview?.status === "ready" && preview.sql === expectedPrimarySql
          ? []
          : ["Expected preview SQL for fully supported formula."]),
        ...expectNoExecutionSurface({ proposal, preview }),
      ];
    },
  },
  {
    name: "operand order is preserved",
    assert: () => {
      const forward = pipeline(primaryRequest()).renderResult?.sql || "";
      const reverse = pipeline(
        request("Show total cost minus total revenue by region.", "finance", financeSchema),
      ).renderResult?.sql || "";
      return [
        ...(forward.includes('(SUM("finance"."revenue")) - (SUM("finance"."cost"))')
          ? []
          : ["Expected revenue minus cost expression."]),
        ...(reverse.includes('(SUM("finance"."cost")) - (SUM("finance"."revenue"))')
          ? []
          : ["Expected cost minus revenue expression."]),
      ];
    },
  },
  {
    name: "missing or ambiguous operands do not produce a derived render-ready plan",
    assert: () => {
      const missingLeft = proposeAdaptiveReport(
        request("Show minus total cost by region.", "finance", financeSchema),
      );
      const missingRight = proposeAdaptiveReport(
        request("Show total revenue minus by region.", "finance", financeSchema),
      );
      const ambiguous = pipeline(
        request("Show total revenue minus total mystery by region.", "finance", financeSchema),
      );
      return [
        ...(missingLeft.derivedMeasures.length === 0 && missingLeft.support === "unsupported"
          ? []
          : ["Missing left operand must not produce a derived proposal."]),
        ...(missingRight.derivedMeasures.length === 0 && missingRight.support === "unsupported"
          ? []
          : ["Missing right operand must not produce a derived proposal."]),
        ...(ambiguous.proposal.derivedMeasures.length === 0 &&
        ambiguous.bridge.state !== "render_ready_plan" &&
        !ambiguous.renderResult?.sql
          ? []
          : ["Ambiguous operand must not render partial SQL."]),
      ];
    },
  },
  {
    name: "missing grouping does not produce misleading grouped SQL",
    assert: () => {
      const result = pipeline(
        request("Show total revenue minus total cost by territory.", "finance", financeSchema),
      );
      return result.proposal.groupings[0]?.columnName === null &&
        result.bridge.state !== "render_ready_plan" &&
        !result.renderResult?.sql
        ? []
        : ["Unresolved grouping must not render derived SQL."];
    },
  },
  {
    name: "multiple subtraction formulas are unsupported without partial rendering",
    assert: () => {
      const chained = pipeline(
        request("Show total revenue minus total cost minus total tax by region.", "finance", [
          ...financeSchema,
          column("tax", "numeric"),
        ]),
      );
      const separate = pipeline(
        request("Show total revenue minus total cost and total tax minus total fees by region.", "finance", [
          ...financeSchema,
          column("tax", "numeric"),
          column("fees", "numeric"),
        ]),
      );
      return [
        ...(chained.proposal.derivedMeasures.length === 0 &&
        chained.bridge.state !== "render_ready_plan"
          ? []
          : ["Chained subtraction must not render a partial formula."]),
        ...(separate.proposal.derivedMeasures.length === 0 &&
        separate.bridge.state !== "render_ready_plan"
          ? []
          : ["Separate subtraction formulas must not render a partial formula."]),
      ];
    },
  },
  {
    name: "implicit business terms and threshold phrases do not create subtract formulas",
    assert: () => {
      const implicitPrompts = [
        "Show profit by region.",
        "Show gross margin by region.",
        "Show net revenue by region.",
        "Show remaining budget by program.",
        "Show variance by department.",
      ];
      const thresholdPrompts = [
        "Show revenue less than 500000.",
        "Show regions whose total revenue is below 500000.",
        "Show accounts with fewer than 10 orders.",
        "Show departments with no more than 20 employees.",
      ];
      const failures = [...implicitPrompts, ...thresholdPrompts].flatMap((prompt) => {
        const proposal = proposeAdaptiveReport(request(prompt, "finance", financeSchema));
        return proposal.derivedMeasures.length === 0
          ? []
          : [`Unexpected derived measure for ${prompt}`];
      });
      return failures;
    },
  },
  {
    name: "cross-domain explicit subtraction prompts render exact deterministic SQL",
    assert: () => {
      const cases = [
        {
          prompt: "Show total budget minus total spending by program.",
          request: request("Show total budget minus total spending by program.", "programs", [
            column("program", "categorical"),
            column("budget", "numeric"),
            column("spending", "numeric"),
          ]),
          expected: [
            "SELECT",
            '  "programs"."program" AS "program",',
            '  SUM("programs"."budget") AS "total_budget",',
            '  SUM("programs"."spending") AS "total_spending",',
            '  (SUM("programs"."budget")) - (SUM("programs"."spending")) AS "total_budget_minus_total_spending"',
            'FROM "programs"',
            'GROUP BY "programs"."program";',
          ].join("\n"),
        },
        {
          prompt: "Show total units produced minus total defective units by production line.",
          request: request(
            "Show total units produced minus total defective units by production line.",
            "manufacturing",
            [
              column("production_line", "categorical"),
              column("units_produced", "numeric"),
              column("defective_units", "numeric"),
            ],
          ),
          expected: [
            "SELECT",
            '  "manufacturing"."production_line" AS "production_line",',
            '  SUM("manufacturing"."units_produced") AS "total_units_produced",',
            '  SUM("manufacturing"."defective_units") AS "total_defective_units",',
            '  (SUM("manufacturing"."units_produced")) - (SUM("manufacturing"."defective_units")) AS "total_units_produced_minus_total_defective_units"',
            'FROM "manufacturing"',
            'GROUP BY "manufacturing"."production_line";',
          ].join("\n"),
        },
        {
          prompt: "Show total units received minus total units shipped by warehouse.",
          request: request("Show total units received minus total units shipped by warehouse.", "inventory", [
            column("warehouse", "categorical"),
            column("units_received", "numeric"),
            column("units_shipped", "numeric"),
          ]),
          expected: [
            "SELECT",
            '  "inventory"."warehouse" AS "warehouse",',
            '  SUM("inventory"."units_received") AS "total_units_received",',
            '  SUM("inventory"."units_shipped") AS "total_units_shipped",',
            '  (SUM("inventory"."units_received")) - (SUM("inventory"."units_shipped")) AS "total_units_received_minus_total_units_shipped"',
            'FROM "inventory"',
            'GROUP BY "inventory"."warehouse";',
          ].join("\n"),
        },
      ];
      return cases.flatMap((item) => {
        const { renderResult } = pipeline(item.request);
        return renderResult?.sql === item.expected
          ? []
          : [`Expected exact SQL for ${item.prompt}`];
      });
    },
  },
  {
    name: "derived grounding does not introduce derived-target ordering or HAVING and preserves base paths",
    assert: () => {
      const { bridge, renderResult } = pipeline(primaryRequest());
      const sql = renderResult?.sql || "";
      return [
        ...(bridge.plan?.orderBy.length === 0 ? [] : ["Expected no derived-target ORDER BY."]),
        ...(bridge.plan?.aggregateResultConditions.length === 0
          ? []
          : ["Expected no derived-target HAVING condition."]),
        ...(!sql.includes("ORDER BY") && !sql.includes("HAVING") && !sql.includes("LIMIT")
          ? []
          : ["Expected no implicit ORDER BY, HAVING, or LIMIT."]),
      ];
    },
  },
];

export function runExplicitSubtractionGroundingFixtures(): ExplicitSubtractionGroundingFixtureReport {
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
