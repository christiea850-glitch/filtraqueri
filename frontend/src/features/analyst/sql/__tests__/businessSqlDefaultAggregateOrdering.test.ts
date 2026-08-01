/** Pre-PS-6 hygiene - default aggregate ordering is plan metadata. */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type { WorksheetMetadata } from "../../../workbook";
import { proposeAdaptiveReport, type AdaptiveReportProposal } from "../adaptiveReportProposal";
import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import { detectBusinessIntent } from "../businessIntentGrounding";
import {
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlAggregateResultConditionId,
  createBusinessSqlRowLimitId,
  createBusinessSqlSortId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlQueryPlan,
  type BusinessSqlSort,
} from "../businessSqlQueryPlan";
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

export type BusinessSqlDefaultAggregateOrderingFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const DEFAULT_ORDERING_TEXT =
  "Results are ordered by the primary measure in descending order by default.";

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"],
): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "DOUBLE" : "VARCHAR",
  inferred_type,
  null_count: 0,
  unique_count: 0,
  sample_values: [],
});

const worksheet = (
  tableName: string,
  schema: readonly SchemaColumn[],
): Pick<WorksheetMetadata, "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema"> => ({
  worksheetId: tableName,
  displayName: tableName,
  sheetName: tableName,
  tableName,
  schema: [...schema],
});

const sales = worksheet("sales", [
  column("region", "categorical"),
  column("revenue", "numeric"),
  column("cost", "numeric"),
  column("status", "categorical"),
]);

const orders = worksheet("orders", [
  column("order_id", "categorical"),
  column("order_amount", "numeric"),
]);

const proposalFor = (
  prompt: string,
  scope = sales,
): AdaptiveReportProposal =>
  proposeAdaptiveReport({
    prompt,
    detectedIntent: detectBusinessIntent(prompt),
    appliedScopeSelections: [{ worksheetId: scope.worksheetId, tableName: scope.tableName, sourceType: "original" }],
    worksheets: [scope],
  });

const bridgeFor = (proposal: AdaptiveReportProposal) =>
  createBusinessSqlPlanFromAdaptiveProposal({ proposal });

const sqlFor = (proposal: AdaptiveReportProposal): string | null => {
  const result = bridgeFor(proposal);
  return result.plan ? createBusinessSqlRenderPreview(result.plan).sql : null;
};

const measureSeed = {
  kind: "sum" as const,
  entity: "sales",
  table: "sales",
  field: "revenue",
  distinct: false,
};
const measureId = createBusinessSqlMeasureId(measureSeed);
const measureSort = (direction: "asc" | "desc"): BusinessSqlSort => {
  const target = { kind: "measure" as const, measureId, resolved: true };
  return {
    sortId: createBusinessSqlSortId({ target, direction }),
    target,
    direction,
  };
};

const aggregatePlan = (orderBy: BusinessSqlSort[] = []): BusinessSqlQueryPlan => ({
  ...createEmptyBusinessSqlQueryPlan(),
  id: "business-sql-plan:default-ordering-direct",
  kind: "single_table_count_grouping",
  status: "resolved",
  support: "supported",
  entities: [{ entity: "sales", table: "sales", required: true, role: "source" }],
  measures: [{
    ...measureSeed,
    measureId,
    fieldInferredType: "numeric",
    label: "Total revenue",
    sqlAlias: createBusinessSqlMeasureAlias("Total revenue"),
  }],
  groupings: [{ entity: "sales", table: "sales", field: "region", label: "region" }],
  orderBy,
});

const expectedDefaultSql = [
  "SELECT",
  '  "sales"."region" AS "region",',
  '  SUM("sales"."revenue") AS "total_revenue"',
  'FROM "sales"',
  'GROUP BY "sales"."region"',
  'ORDER BY "total_revenue" DESC;',
].join("\n");

const fixtures: Fixture[] = [
  {
    name: "base aggregation with grouping receives one explicit proposed default sort",
    assert: () => {
      const proposal = proposalFor("Show total revenue by region.");
      return proposal.sorts?.length === 1 && proposal.sorts[0].direction === "desc"
        ? []
        : ["Expected one proposed default sort."];
    },
  },
  {
    name: "proposed default sort targets the primary metric ID",
    assert: () => {
      const proposal = proposalFor("Show total revenue by region.");
      return proposal.sorts?.[0]?.target === "metric" &&
        proposal.sorts[0].targetId === proposal.metrics[0]?.id
        ? []
        : ["Expected default sort to target primary metric ID."];
    },
  },
  {
    name: "bridge maps default sort to final measureId",
    assert: () => {
      const result = bridgeFor(proposalFor("Show total revenue by region."));
      const sort = result.plan?.orderBy[0];
      const measure = result.plan?.measures[0];
      return sort?.target.kind === "measure" && sort.target.measureId === measure?.measureId
        ? []
        : ["Expected final sort target to use measureId."];
    },
  },
  {
    name: "final plan orderBy contains exactly one descending sort",
    assert: () => {
      const plan = bridgeFor(proposalFor("Show total revenue by region.")).plan;
      return plan?.orderBy.length === 1 && plan.orderBy[0].direction === "desc"
        ? []
        : ["Expected one descending final sort."];
    },
  },
  {
    name: "plan assumptions record the default",
    assert: () => {
      const plan = bridgeFor(proposalFor("Show total revenue by region.")).plan;
      return plan?.assumptions.some((assumption) => assumption.detail === DEFAULT_ORDERING_TEXT)
        ? []
        : ["Expected default ordering assumption."];
    },
  },
  {
    name: "sort ID is deterministic",
    assert: () => {
      const first = proposalFor("Show total revenue by region.").sorts?.[0]?.id;
      const second = proposalFor("Show total revenue by region.").sorts?.[0]?.id;
      return first && first === second ? [] : ["Expected deterministic proposed sort ID."];
    },
  },
  {
    name: "sort ID ignores label and assumption text",
    assert: () => {
      const proposal = proposalFor("Show total revenue by region.");
      const sort = proposal.sorts?.[0];
      const relabeled = sort ? { ...sort, label: "Different label" } : null;
      return sort?.id === relabeled?.id ? [] : ["Expected sort ID to ignore presentation text."];
    },
  },
  {
    name: "existing aggregation SQL remains byte-identical",
    assert: () => sqlFor(proposalFor("Show total revenue by region.")) === expectedDefaultSql ? [] : ["Expected byte-identical SQL."],
  },
  {
    name: "renderer with orderBy empty emits no ORDER BY",
    assert: () => {
      const sql = renderBusinessSqlQueryPlan(aggregatePlan([])).sql;
      return sql && !sql.includes("ORDER BY") ? [] : ["Expected no renderer-invented ORDER BY."];
    },
  },
  {
    name: "explicit ascending sort remains ascending",
    assert: () => renderBusinessSqlQueryPlan(aggregatePlan([measureSort("asc")])).sql?.includes('ORDER BY "total_revenue" ASC;') ? [] : ["Expected ASC sort."],
  },
  {
    name: "explicit descending sort remains descending",
    assert: () => renderBusinessSqlQueryPlan(aggregatePlan([measureSort("desc")])).sql?.includes('ORDER BY "total_revenue" DESC;') ? [] : ["Expected DESC sort."],
  },
  {
    name: "existing explicit sort is not duplicated",
    assert: () => proposalFor("Show departments with the highest total revenue.").sorts?.length === 1 ? [] : ["Expected no duplicate explicit sort."],
  },
  {
    name: "field projection receives no default sort",
    assert: () => proposalFor("Show order_id where order_amount is above 1000.", orders).sorts?.length === 0 ? [] : ["Expected no field-projection default sort."],
  },
  {
    name: "row-filter-only projection receives no default sort",
    assert: () => proposalFor("Show order_id where order_amount is above 1000.", orders).sorts?.length === 0 ? [] : ["Expected no row-filter projection sort."],
  },
  {
    name: "derived-measure plan receives no default base sort",
    assert: () => proposalFor("Show regions where total revenue minus total cost is above 100000.").sorts?.length === 0 ? [] : ["Expected no derived default base sort."],
  },
  {
    name: "derived ranking remains unchanged",
    assert: () => {
      const proposal = proposalFor("Rank regions by total revenue minus total cost descending.");
      return proposal.sorts?.length === 1 && proposal.sorts[0].target === "derived_measure"
        ? []
        : ["Expected derived ranking sort only."];
    },
  },
  {
    name: "HAVING and rowLimit clause order remains unchanged",
    assert: () => {
      const condition = {
        measureId,
        operator: "greater_than" as const,
        comparisonValue: { kind: "number" as const, value: 500000 },
      };
      const rowLimit = { value: 5 };
      const sql = renderBusinessSqlQueryPlan({
        ...aggregatePlan([measureSort("desc")]),
        aggregateResultConditions: [{
          ...condition,
          conditionId: createBusinessSqlAggregateResultConditionId(condition),
        }],
        rowLimit: {
          ...rowLimit,
          rowLimitId: createBusinessSqlRowLimitId(rowLimit),
        },
      }).sql;
      return Boolean(sql?.match(/HAVING SUM\("sales"\."revenue"\) > 500000\nORDER BY "total_revenue" DESC\nLIMIT 5;/))
        ? []
        : ["Expected HAVING, ORDER BY, LIMIT order."];
    },
  },
  {
    name: "unresolved proposed metric target blocks rather than falling back",
    assert: () => {
      const proposal = proposalFor("Show total revenue by region.");
      const broken = {
        ...proposal,
        sorts: proposal.sorts?.map((sort) => ({ ...sort, targetId: "metric:missing" })),
      };
      const result = bridgeFor(broken);
      return result.state === "blocked_plan" && result.issues.some((issue) => issue.code === "unresolved_metric_reference")
        ? []
        : ["Expected unresolved metric sort to block."];
    },
  },
  {
    name: "no automatic Insert",
    assert: () => bridgeFor(proposalFor("Show total revenue by region.")).noInsertPerformed ? [] : ["Expected no insert."],
  },
  {
    name: "no automatic Run",
    assert: () => bridgeFor(proposalFor("Show total revenue by region.")).noRunPerformed ? [] : ["Expected no run."],
  },
];

export function runBusinessSqlDefaultAggregateOrderingFixtures(): BusinessSqlDefaultAggregateOrderingFixtureReport {
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

export const businessSqlDefaultAggregateOrderingFixturesPass =
  runBusinessSqlDefaultAggregateOrderingFixtures().failed.length === 0;
