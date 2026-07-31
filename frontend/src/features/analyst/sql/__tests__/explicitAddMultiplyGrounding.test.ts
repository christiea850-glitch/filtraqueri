/** PS-3g - explicit X plus Y and X multiplied by Y grounding fixtures. */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type {
  AnalysisScopeSelection,
  WorksheetMetadata,
} from "../../../workbook";
import {
  detectExplicitAdditionFormula,
  detectExplicitMultiplicationFormula,
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

export type ExplicitAddMultiplyGroundingFixtureReport = {
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

const salesSchema = [
  column("region", "categorical"),
  column("domestic_sales", "numeric"),
  column("international_sales", "numeric"),
];

const ratesSchema = [
  column("category", "categorical"),
  column("rate", "numeric"),
  column("units", "numeric"),
];

const pipeline = (input: AdaptiveReportProposalRequest) => {
  const proposal = proposeAdaptiveReport(input);
  const bridge = createBusinessSqlPlanFromAdaptiveProposal({ proposal });
  const renderResult = bridge.plan ? renderBusinessSqlQueryPlan(bridge.plan) : null;
  const preview = bridge.plan ? createBusinessSqlRenderPreview(bridge.plan) : null;
  const capability = bridge.plan ? evaluateBusinessSqlRendererCapability(bridge.plan) : null;
  return { proposal, bridge, renderResult, preview, capability };
};

const addPrompt = "Show total domestic sales plus total international sales by region.";
const multiplyPrompt = "Show average rate multiplied by total units by category.";

const expectedAddSql = [
  "SELECT",
  '  "sales"."region" AS "region",',
  '  SUM("sales"."domestic_sales") AS "total_domestic_sales",',
  '  SUM("sales"."international_sales") AS "total_international_sales",',
  '  (SUM("sales"."domestic_sales")) + (SUM("sales"."international_sales")) AS "total_domestic_sales_plus_total_international_sales"',
  'FROM "sales"',
  'GROUP BY "sales"."region";',
].join("\n");

const expectedMultiplySql = [
  "SELECT",
  '  "rates"."category" AS "category",',
  '  AVG("rates"."rate") AS "average_rate",',
  '  SUM("rates"."units") AS "total_units",',
  '  (AVG("rates"."rate")) * (SUM("rates"."units")) AS "average_rate_multiplied_by_total_units"',
  'FROM "rates"',
  'GROUP BY "rates"."category";',
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

const expectNoAddOrMultiplyDerivedMeasure = (
  prompt: string,
  tableName: string,
  schema: SchemaColumn[],
): string[] => {
  const { proposal, bridge } = pipeline(request(prompt, tableName, schema));
  return [
    ...(proposal.derivedMeasures.every((derived) => derived.operator !== "add" && derived.operator !== "multiply")
      ? []
      : ["Prompt must not create an add or multiply derived measure."]),
    ...(bridge.plan?.derivedMeasures.every((derived) => derived.operator !== "add" && derived.operator !== "multiply") ?? true
      ? []
      : ["Prompt must not bridge an add or multiply derived measure."]),
  ];
};

const fixtures: Fixture[] = [
  {
    name: "parser detects X plus Y and separates grouping",
    assert: () => {
      const parsed = detectExplicitAdditionFormula(addPrompt);
      if (parsed.status !== "detected") return ["Expected detected addition formula."];
      return [
        ...(parsed.leftPhrase === "total domestic sales" ? [] : ["Expected left addition operand."]),
        ...(parsed.rightPhrase === "total international sales" ? [] : ["Expected right addition operand."]),
        ...(parsed.groupingPhrase === "region" ? [] : ["Expected addition grouping."]),
        ...(parsed.evidence === "total domestic sales plus total international sales"
          ? []
          : ["Expected addition evidence to exclude grouping."]),
      ];
    },
  },
  {
    name: "parser detects X multiplied by Y and separates operator from grouping by",
    assert: () => {
      const parsed = detectExplicitMultiplicationFormula(multiplyPrompt);
      if (parsed.status !== "detected") return ["Expected detected multiplication formula."];
      return [
        ...(parsed.leftPhrase === "average rate" ? [] : ["Expected left multiplication operand."]),
        ...(parsed.rightPhrase === "total units" ? [] : ["Expected right multiplication operand without grouping."]),
        ...(parsed.groupingPhrase === "category" ? [] : ["Expected multiplication grouping."]),
        ...(parsed.evidence === "average rate multiplied by total units"
          ? []
          : ["Expected multiplication evidence to exclude grouping."]),
      ];
    },
  },
  {
    name: "introductory words are trimmed from add and multiply formulas",
    assert: () => {
      const add = detectExplicitAdditionFormula(
        "Please show total regular hours plus total overtime hours by department.",
      );
      const multiply = detectExplicitMultiplicationFormula(
        "Calculate average unit cost multiplied by total quantity by warehouse.",
      );
      return [
        ...(add.status === "detected" && add.leftPhrase === "total regular hours"
          ? []
          : ["Expected trimmed add numerator."]),
        ...(multiply.status === "detected" && multiply.leftPhrase === "average unit cost"
          ? []
          : ["Expected trimmed multiply left operand."]),
      ];
    },
  },
  {
    name: "primary add and multiply proposals contain two metrics one grouping and policy-free derived measure",
    assert: () => {
      const addProposal = proposeAdaptiveReport(request(addPrompt, "sales", salesSchema));
      const multiplyProposal = proposeAdaptiveReport(request(multiplyPrompt, "rates", ratesSchema));
      const addDerived = addProposal.derivedMeasures[0];
      const multiplyDerived = multiplyProposal.derivedMeasures[0];
      return [
        ...(addProposal.metrics.length === 2 &&
        addProposal.groupings.length === 1 &&
        addProposal.derivedMeasures.length === 1
          ? []
          : ["Expected add proposal shape."]),
        ...(addProposal.metrics[0]?.kind === "sum" &&
        addProposal.metrics[0]?.columnName === "domestic_sales" &&
        addProposal.metrics[1]?.kind === "sum" &&
        addProposal.metrics[1]?.columnName === "international_sales"
          ? []
          : ["Expected independently grounded add operands."]),
        ...(addDerived?.operator === "add" &&
        addDerived.leftMetricId === addProposal.metrics[0]?.id &&
        addDerived.rightMetricId === addProposal.metrics[1]?.id &&
        !addDerived.divisionPolicy
          ? []
          : ["Expected policy-free add derived measure with proposed metric references."]),
        ...(multiplyProposal.metrics.length === 2 &&
        multiplyProposal.groupings.length === 1 &&
        multiplyProposal.derivedMeasures.length === 1
          ? []
          : ["Expected multiply proposal shape."]),
        ...(multiplyProposal.metrics[0]?.kind === "average" &&
        multiplyProposal.metrics[0]?.columnName === "rate" &&
        multiplyProposal.metrics[1]?.kind === "sum" &&
        multiplyProposal.metrics[1]?.columnName === "units"
          ? []
          : ["Expected independently grounded multiply operands."]),
        ...(multiplyDerived?.operator === "multiply" &&
        multiplyDerived.leftMetricId === multiplyProposal.metrics[0]?.id &&
        multiplyDerived.rightMetricId === multiplyProposal.metrics[1]?.id &&
        !multiplyDerived.divisionPolicy
          ? []
          : ["Expected policy-free multiply derived measure with proposed metric references."]),
        ...(addProposal.rowLimit === null && multiplyProposal.rowLimit === null
          ? []
          : ["Expected no implicit row limit."]),
        ...((addProposal.sorts || []).length === 0 && (multiplyProposal.sorts || []).length === 0
          ? []
          : ["Expected no derived-target ORDER BY."]),
        ...(addProposal.aggregateResultConditions.length === 0 &&
        multiplyProposal.aggregateResultConditions.length === 0
          ? []
          : ["Expected no derived-target HAVING."]),
      ];
    },
  },
  {
    name: "stable proposal IDs preserve operand order and ignore presentation metadata",
    assert: () => {
      const addProposal = proposeAdaptiveReport(request(addPrompt, "sales", salesSchema));
      const multiplyProposal = proposeAdaptiveReport(request(multiplyPrompt, "rates", ratesSchema));
      const addDerived = addProposal.derivedMeasures[0];
      const multiplyDerived = multiplyProposal.derivedMeasures[0];
      const addReversed = proposeAdaptiveReport(
        request(
          "Show total international sales plus total domestic sales by region.",
          "sales",
          salesSchema,
        ),
      ).derivedMeasures[0];
      const multiplyReversed = proposeAdaptiveReport(
        request(
          "Show total units multiplied by average rate by category.",
          "rates",
          ratesSchema,
        ),
      ).derivedMeasures[0];
      const relabeled = addDerived
        ? { ...addDerived, label: "Friendly", sqlAlias: "friendly", evidence: "changed" }
        : null;
      return [
        ...(addDerived?.id === proposeAdaptiveReport(request(addPrompt, "sales", salesSchema)).derivedMeasures[0]?.id
          ? []
          : ["Expected deterministic add ID."]),
        ...(multiplyDerived?.id === proposeAdaptiveReport(request(multiplyPrompt, "rates", ratesSchema)).derivedMeasures[0]?.id
          ? []
          : ["Expected deterministic multiply ID."]),
        ...(relabeled?.id === addDerived?.id ? [] : ["Expected ID independent of presentation metadata."]),
        ...(addReversed && addDerived && addReversed.id !== addDerived.id
          ? []
          : ["Expected add operand reversal to change ID."]),
        ...(multiplyReversed && multiplyDerived && multiplyReversed.id !== multiplyDerived.id
          ? []
          : ["Expected multiply operand reversal to change ID."]),
        ...(addDerived?.id === "derived-measure:add:metric-total-domestic-sales:metric-total-international-sales"
          ? []
          : ["Expected add ID to depend only on operator and operand metric IDs."]),
        ...(multiplyDerived?.id === "derived-measure:multiply:metric-average-rate:metric-total-units"
          ? []
          : ["Expected multiply ID to depend only on operator and operand metric IDs."]),
      ];
    },
  },
  {
    name: "bridge maps add and multiply proposed metric IDs to final measure IDs",
    assert: () => {
      const add = pipeline(request(addPrompt, "sales", salesSchema));
      const multiply = pipeline(request(multiplyPrompt, "rates", ratesSchema));
      const addPlan = add.bridge.plan;
      const multiplyPlan = multiply.bridge.plan;
      const addDerived = addPlan?.derivedMeasures[0];
      const multiplyDerived = multiplyPlan?.derivedMeasures[0];
      if (!addPlan || !addDerived || !multiplyPlan || !multiplyDerived) {
        return ["Expected final plans with derived measures."];
      }
      const expectedAddId = createBusinessSqlDerivedMeasureId({
        operator: "add",
        leftMeasureId: addPlan.measures[0].measureId,
        rightMeasureId: addPlan.measures[1].measureId,
      });
      const expectedMultiplyId = createBusinessSqlDerivedMeasureId({
        operator: "multiply",
        leftMeasureId: multiplyPlan.measures[0].measureId,
        rightMeasureId: multiplyPlan.measures[1].measureId,
      });
      return [
        ...(addDerived.leftMeasureId === addPlan.measures[0].measureId &&
        addDerived.rightMeasureId === addPlan.measures[1].measureId &&
        addDerived.derivedMeasureId === expectedAddId &&
        !addDerived.divisionPolicy
          ? []
          : ["Expected bridge to map add operands to final stable measure IDs."]),
        ...(multiplyDerived.leftMeasureId === multiplyPlan.measures[0].measureId &&
        multiplyDerived.rightMeasureId === multiplyPlan.measures[1].measureId &&
        multiplyDerived.derivedMeasureId === expectedMultiplyId &&
        !multiplyDerived.divisionPolicy
          ? []
          : ["Expected bridge to map multiply operands to final stable measure IDs."]),
      ];
    },
  },
  {
    name: "primary add and multiply prompts render exact deterministic SQL through full pipeline",
    assert: () => {
      const add = pipeline(request(addPrompt, "sales", salesSchema));
      const multiply = pipeline(request(multiplyPrompt, "rates", ratesSchema));
      return [
        ...(add.bridge.state === "render_ready_plan" && add.capability?.capable
          ? []
          : ["Expected render-ready add pipeline."]),
        ...(multiply.bridge.state === "render_ready_plan" && multiply.capability?.capable
          ? []
          : ["Expected render-ready multiply pipeline."]),
        ...(add.renderResult?.sql === expectedAddSql ? [] : ["Expected exact primary add SQL."]),
        ...(multiply.renderResult?.sql === expectedMultiplySql ? [] : ["Expected exact primary multiply SQL."]),
        ...(add.preview?.sql === expectedAddSql &&
        add.preview.actions.canCopySql &&
        multiply.preview?.sql === expectedMultiplySql &&
        multiply.preview.actions.canCopySql
          ? []
          : ["Expected copy-capable preview SQL for add and multiply."]),
        ...expectNoExecutionSurface({ proposal: add.proposal, preview: add.preview }),
        ...expectNoExecutionSurface({ proposal: multiply.proposal, preview: multiply.preview }),
      ];
    },
  },
  {
    name: "unresolved operands count concepts and groupings block add and multiply without guessed SQL",
    assert: () => {
      const missingAddGrouping = pipeline(
        request("Show total domestic sales plus total international sales by territory.", "sales", salesSchema),
      );
      const missingMultiplyGrouping = pipeline(
        request("Show average rate multiplied by total units by market.", "rates", ratesSchema),
      );
      return [
        ...expectBlocked("Show total mystery plus total international sales by region.", "sales", salesSchema),
        ...expectBlocked("Show total domestic sales plus widget count by region.", "sales", salesSchema),
        ...(missingAddGrouping.bridge.state !== "render_ready_plan" &&
        missingAddGrouping.renderResult?.sql === null &&
        missingAddGrouping.preview?.sql === null
          ? []
          : ["Missing add grouping must block preview SQL."]),
        ...expectBlocked("Show average mystery multiplied by total units by category.", "rates", ratesSchema),
        ...expectBlocked("Show average rate multiplied by unknown count by category.", "rates", ratesSchema),
        ...(missingMultiplyGrouping.bridge.state !== "render_ready_plan" &&
        missingMultiplyGrouping.renderResult?.sql === null &&
        missingMultiplyGrouping.preview?.sql === null
          ? []
          : ["Missing multiply grouping must block preview SQL."]),
      ];
    },
  },
  {
    name: "multiple and mixed add multiply subtract divide formulas are explicitly blocked",
    assert: () => [
      ...expectBlocked("Show total domestic sales plus total international sales plus total tax by region.", "sales", [
        ...salesSchema,
        column("tax", "numeric"),
      ]),
      ...expectBlocked("Show average rate multiplied by total units multiplied by total days by category.", "rates", [
        ...ratesSchema,
        column("days", "numeric"),
      ]),
      ...expectBlocked("Show total domestic sales plus total international sales and total tax plus total fees by region.", "sales", [
        ...salesSchema,
        column("tax", "numeric"),
        column("fees", "numeric"),
      ]),
      ...expectBlocked("Show total domestic sales plus total international sales minus total tax by region.", "sales", [
        ...salesSchema,
        column("tax", "numeric"),
      ]),
      ...expectBlocked("Show total domestic sales divided by total international sales plus total tax by region.", "sales", [
        ...salesSchema,
        column("tax", "numeric"),
      ]),
      ...expectBlocked("Show average rate multiplied by total units minus total days by category.", "rates", [
        ...ratesSchema,
        column("days", "numeric"),
      ]),
    ],
  },
  {
    name: "implicit formula terms and threshold prompts do not create add or multiply derived measures",
    assert: () => [
      ...expectNoAddOrMultiplyDerivedMeasure("Show total compensation by department.", "staffing", [
        column("department", "categorical"),
        column("compensation", "numeric"),
      ]),
      ...expectNoAddOrMultiplyDerivedMeasure("Show combined revenue by region.", "sales", salesSchema),
      ...expectNoAddOrMultiplyDerivedMeasure("Show extended price by product.", "rates", ratesSchema),
      ...expectNoAddOrMultiplyDerivedMeasure("Show weighted score by group.", "scores", [
        column("group", "categorical"),
        column("score", "numeric"),
      ]),
      ...expectNoAddOrMultiplyDerivedMeasure("Show revenue above 500000 by region.", "sales", salesSchema),
      ...expectNoAddOrMultiplyDerivedMeasure("Show fewer than 10 orders by region.", "sales", salesSchema),
    ],
  },
  {
    name: "existing subtraction and guarded division remain unchanged",
    assert: () => {
      const subtract = pipeline(
        request("Show total domestic sales minus total international sales by region.", "sales", salesSchema),
      );
      const divide = pipeline(
        request("Show total domestic sales divided by total international sales by region.", "sales", salesSchema),
      );
      return [
        ...(subtract.proposal.derivedMeasures[0]?.operator === "subtract" &&
        !subtract.proposal.derivedMeasures[0]?.divisionPolicy
          ? []
          : ["Expected subtraction proposal without division policy."]),
        ...(subtract.renderResult?.sql?.includes('(SUM("sales"."domestic_sales")) - (SUM("sales"."international_sales"))')
          ? []
          : ["Expected subtraction SQL unchanged."]),
        ...(divide.proposal.derivedMeasures[0]?.operator === "divide" &&
        divide.proposal.derivedMeasures[0]?.divisionPolicy?.zeroDenominator === "null"
          ? []
          : ["Expected division proposal null-on-zero policy."]),
        ...(divide.renderResult?.sql?.includes("CASE") &&
        divide.renderResult.sql.includes("THEN NULL") &&
        divide.renderResult.sql.includes(" / ")
          ? []
          : ["Expected guarded division SQL unchanged."]),
      ];
    },
  },
  {
    name: "cross-domain add and multiply prompts render exact deterministic SQL",
    assert: () => {
      const cases = [
        {
          input: request("Show total regular hours plus total overtime hours by department.", "staffing", [
            column("department", "categorical"),
            column("regular_hours", "numeric"),
            column("overtime_hours", "numeric"),
          ]),
          expected: [
            "SELECT",
            '  "staffing"."department" AS "department",',
            '  SUM("staffing"."regular_hours") AS "total_regular_hours",',
            '  SUM("staffing"."overtime_hours") AS "total_overtime_hours",',
            '  (SUM("staffing"."regular_hours")) + (SUM("staffing"."overtime_hours")) AS "total_regular_hours_plus_total_overtime_hours"',
            'FROM "staffing"',
            'GROUP BY "staffing"."department";',
          ].join("\n"),
        },
        {
          input: request("Show total base allocation plus total supplemental allocation by program.", "programs", [
            column("program", "categorical"),
            column("base_allocation", "numeric"),
            column("supplemental_allocation", "numeric"),
          ]),
          expected: [
            "SELECT",
            '  "programs"."program" AS "program",',
            '  SUM("programs"."base_allocation") AS "total_base_allocation",',
            '  SUM("programs"."supplemental_allocation") AS "total_supplemental_allocation",',
            '  (SUM("programs"."base_allocation")) + (SUM("programs"."supplemental_allocation")) AS "total_base_allocation_plus_total_supplemental_allocation"',
            'FROM "programs"',
            'GROUP BY "programs"."program";',
          ].join("\n"),
        },
        {
          input: request("Show average unit cost multiplied by total quantity by warehouse.", "warehouse_costs", [
            column("warehouse", "categorical"),
            column("unit_cost", "numeric"),
            column("quantity", "numeric"),
          ]),
          expected: [
            "SELECT",
            '  "warehouse_costs"."warehouse" AS "warehouse",',
            '  AVG("warehouse_costs"."unit_cost") AS "average_unit_cost",',
            '  SUM("warehouse_costs"."quantity") AS "total_quantity",',
            '  (AVG("warehouse_costs"."unit_cost")) * (SUM("warehouse_costs"."quantity")) AS "average_unit_cost_multiplied_by_total_quantity"',
            'FROM "warehouse_costs"',
            'GROUP BY "warehouse_costs"."warehouse";',
          ].join("\n"),
        },
        {
          input: request("Show average score multiplied by record count by group.", "scores", [
            column("group", "categorical"),
            column("score", "numeric"),
            column("record_id", "text"),
          ]),
          expected: [
            "SELECT",
            '  "scores"."group" AS "group",',
            '  AVG("scores"."score") AS "average_score",',
            '  COUNT("scores"."record_id") AS "record_count",',
            '  (AVG("scores"."score")) * (COUNT("scores"."record_id")) AS "average_score_multiplied_by_record_count"',
            'FROM "scores"',
            'GROUP BY "scores"."group";',
          ].join("\n"),
        },
      ];
      return cases.flatMap(({ input, expected }) => {
        const { renderResult, preview } = pipeline(input);
        return [
          ...(renderResult?.sql === expected ? [] : [`Expected exact SQL for ${input.prompt}.`]),
          ...(preview?.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql
            ? []
            : [`Expected manual-only preview for ${input.prompt}.`]),
        ];
      });
    },
  },
];

export function runExplicitAddMultiplyGroundingFixtures(): ExplicitAddMultiplyGroundingFixtureReport {
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

export const explicitAddMultiplyGroundingFixturesPass =
  runExplicitAddMultiplyGroundingFixtures().failed.length === 0;
