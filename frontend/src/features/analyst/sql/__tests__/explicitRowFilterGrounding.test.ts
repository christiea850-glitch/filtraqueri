/** PS-5c - single row-filter natural-language grounding fixtures. */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type { WorksheetMetadata } from "../../../workbook";
import { detectBusinessIntent } from "../businessIntentGrounding";
import {
  createProposedRowFilterId,
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
  type ProposedFilter,
} from "../adaptiveReportProposal";
import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import {
  createEmptyBusinessSqlQueryPlan,
  createBusinessSqlFilterId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlSortId,
  type BusinessSqlFilter,
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

export type ExplicitRowFilterGroundingFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"],
): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "DOUBLE" : inferred_type === "boolean" ? "BOOLEAN" : "VARCHAR",
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

const orders = worksheet("orders", [
  column("order_id", "categorical"),
  column("order_amount", "numeric"),
  column("closed_at", "date"),
  column("status", "categorical"),
]);

const sales = worksheet("sales", [
  column("region", "categorical"),
  column("revenue", "numeric"),
  column("cost", "numeric"),
  column("status", "categorical"),
]);

const inventory = worksheet("inventory", [
  column("item_id", "categorical"),
  column("discontinued", "boolean"),
  column("priority", "categorical"),
]);

const tickets = worksheet("tickets", [
  column("ticket_id", "categorical"),
  column("description", "text"),
  column("priority", "categorical"),
  column("status", "categorical"),
]);

const people = worksheet("people", [
  column("person_id", "categorical"),
  column("age", "numeric"),
  column("last_name", "text"),
]);

const proposalFor = (
  prompt: string,
  scopeWorksheet = orders,
  worksheets = [scopeWorksheet],
): AdaptiveReportProposal =>
  proposeAdaptiveReport({
    prompt,
    detectedIntent: detectBusinessIntent(prompt),
    appliedScopeSelections: [{
      worksheetId: scopeWorksheet.worksheetId,
      tableName: scopeWorksheet.tableName,
      sourceType: "original",
    }],
    worksheets,
  });

const bridgeFor = (proposal: AdaptiveReportProposal) =>
  createBusinessSqlPlanFromAdaptiveProposal({ proposal });

const previewSqlFor = (proposal: AdaptiveReportProposal): string | null => {
  const result = bridgeFor(proposal);
  return result.plan ? createBusinessSqlRenderPreview(result.plan).sql : null;
};

const canonicalFilter = (proposal: AdaptiveReportProposal): ProposedFilter | undefined =>
  proposal.filters.find((filter) => filter.semantics === "canonical");

const finalFilter = (proposal: AdaptiveReportProposal): BusinessSqlFilter | undefined =>
  bridgeFor(proposal).plan?.filters[0];

const noSql = (proposal: AdaptiveReportProposal): boolean => {
  const result = bridgeFor(proposal);
  const preview = result.plan ? createBusinessSqlRenderPreview(result.plan) : null;
  return !preview?.sql;
};

const expectedPrimarySql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" > 1000;',
].join("\n");

const expectedAggregateTextSql = [
  "SELECT",
  '  "sales"."region" AS "region",',
  '  SUM("sales"."revenue") AS "total_revenue"',
  'FROM "sales"',
  `WHERE "sales"."status" = 'active'`,
  'GROUP BY "sales"."region"',
  'ORDER BY "total_revenue" DESC;',
].join("\n");

const validProjection = (predicate: string, scope = orders): AdaptiveReportProposal =>
  proposalFor(`Show ${scope === tickets ? "ticket_id" : scope === inventory ? "item_id" : "order_id"} where ${predicate}.`, scope);

const fixtures: Fixture[] = [
  {
    name: "exactly one WHERE shell is detected",
    assert: () => [
      ...(canonicalFilter(proposalFor("Show order_id where order_amount is above 1000.", orders)) ? [] : ["Expected one canonical row filter."]),
      ...(noSql(proposalFor("Show order_id where status equals active where order_amount is above 1000.", orders))
        ? []
        : ["Expected multiple WHERE clauses to block SQL."]),
    ],
  },
  {
    name: "pre-WHERE base question is preserved",
    assert: () => {
      const proposal = proposalFor("Show total revenue by region where status equals active.", sales);
      return [
        ...(proposal.question === "Show total revenue by region where status equals active." ? [] : ["Expected full question preservation."]),
        ...(proposal.metrics[0]?.columnName === "revenue" && proposal.groupings[0]?.columnName === "region"
          ? []
          : ["Expected pre-WHERE metric and grouping to be preserved."]),
      ];
    },
  },
  {
    name: "numeric row predicate grounds canonically",
    assert: () => {
      const filter = canonicalFilter(proposalFor("Show order_id where order_amount is above 1000.", orders));
      return filter?.operator === "greater_than" && filter.comparisonValue?.kind === "number" && filter.comparisonValue.value === 1000
        ? []
        : ["Expected numeric canonical filter."];
    },
  },
  {
    name: "text equality grounds canonically",
    assert: () => canonicalFilter(validProjection("status equals active"))?.comparisonValue?.kind === "string" ? [] : ["Expected string equality filter."],
  },
  {
    name: "boolean equality grounds canonically",
    assert: () => canonicalFilter(validProjection("discontinued equals false", inventory))?.comparisonValue?.kind === "boolean" ? [] : ["Expected boolean equality filter."],
  },
  {
    name: "contains grounds canonically",
    assert: () => canonicalFilter(validProjection('description contains "urgent"', tickets))?.operator === "contains" ? [] : ["Expected contains filter."],
  },
  {
    name: "starts-with grounds canonically",
    assert: () => canonicalFilter(validProjection('priority starts with "P"', tickets))?.operator === "starts_with" ? [] : ["Expected starts_with filter."],
  },
  {
    name: "ends-with grounds canonically",
    assert: () => canonicalFilter(validProjection('description ends with "resolved"', tickets))?.operator === "ends_with" ? [] : ["Expected ends_with filter."],
  },
  {
    name: "IS NULL grounds canonically",
    assert: () => canonicalFilter(proposalFor("Show order_id where closed_at is null.", orders))?.operator === "is_null" ? [] : ["Expected is_null filter."],
  },
  {
    name: "IS NOT NULL grounds canonically",
    assert: () => canonicalFilter(proposalFor("Show order_id where closed_at is not null.", orders))?.operator === "is_not_null" ? [] : ["Expected is_not_null filter."],
  },
  {
    name: "longest operator phrase precedence",
    assert: () => [
      ...(canonicalFilter(validProjection("status is not equal to closed"))?.operator === "not_equals" ? [] : ["Expected is not equal to precedence."]),
      ...(canonicalFilter(validProjection("order_amount is no more than 500"))?.operator === "less_than_or_equal" ? [] : ["Expected no more than precedence."]),
      ...(canonicalFilter(validProjection("order_amount is no less than 500"))?.operator === "greater_than_or_equal" ? [] : ["Expected no less than precedence."]),
    ],
  },
  {
    name: "quoted string extraction",
    assert: () => canonicalFilter(validProjection('status equals "currently active"'))?.comparisonValue?.value === "currently active" ? [] : ["Expected quoted string value."],
  },
  {
    name: "apostrophe-containing string preservation",
    assert: () => canonicalFilter(proposalFor('Show person_id where last_name equals "O\'Brien".', people))?.comparisonValue?.value === "O'Brien" ? [] : ["Expected apostrophe string value."],
  },
  {
    name: "safe unquoted one-token text value",
    assert: () => canonicalFilter(validProjection("status equals active"))?.comparisonValue?.value === "active" ? [] : ["Expected unquoted one-token string."],
  },
  {
    name: "multiword unquoted value rejection",
    assert: () => noSql(validProjection("status equals currently active")) ? [] : ["Expected multiword unquoted value to block."],
  },
  {
    name: "strict numeric grammar",
    assert: () => [
      ...(canonicalFilter(validProjection("order_amount is above 500,000.25"))?.comparisonValue?.value === 500000.25 ? [] : ["Expected comma decimal number."]),
      ...(noSql(validProjection("order_amount is above 1,23")) ? [] : ["Expected malformed comma rejection."]),
      ...(noSql(validProjection("order_amount is above 5%")) ? [] : ["Expected percent rejection."]),
      ...(noSql(validProjection("order_amount is above 5 million")) ? [] : ["Expected magnitude suffix rejection."]),
    ],
  },
  {
    name: "field-type compatibility",
    assert: () => [
      ...(noSql(validProjection("status is above 5")) ? [] : ["Expected text field numeric comparison rejection."]),
      ...(noSql(validProjection("order_amount contains \"5\"")) ? [] : ["Expected numeric field text operator rejection."]),
      ...(noSql(validProjection("discontinued equals active", inventory)) ? [] : ["Expected boolean string rejection."]),
    ],
  },
  {
    name: "missing field blocks",
    assert: () => noSql(proposalFor("Show order_id where equals active.", orders)) ? [] : ["Expected missing field to block."],
  },
  {
    name: "ambiguous field blocks",
    assert: () => {
      const shipments = worksheet("shipments", [column("status", "categorical"), column("shipment_id", "categorical")]);
      const proposal = proposeAdaptiveReport({
        prompt: "Show order_id where status equals active.",
        detectedIntent: detectBusinessIntent("Show order_id where status equals active."),
        appliedScopeSelections: [
          { worksheetId: orders.worksheetId, tableName: orders.tableName, sourceType: "original" },
          { worksheetId: shipments.worksheetId, tableName: shipments.tableName, sourceType: "original" },
        ],
        worksheets: [orders, shipments],
      });
      return noSql(proposal) ? [] : ["Expected ambiguous field to block."];
    },
  },
  {
    name: "missing value blocks",
    assert: () => noSql(proposalFor("Show order_id where status equals.", orders)) ? [] : ["Expected missing value to block."],
  },
  {
    name: "unexpected nullary value blocks",
    assert: () => noSql(proposalFor("Show order_id where closed_at is null today.", orders)) ? [] : ["Expected unexpected nullary value to block."],
  },
  {
    name: "unsupported operator blocks",
    assert: () => noSql(proposalFor("Show order_id where status matches active.", orders)) ? [] : ["Expected unsupported operator to block."],
  },
  {
    name: "multiple WHERE clauses block",
    assert: () => noSql(proposalFor("Show order_id where status equals active where order_amount is above 1000.", orders)) ? [] : ["Expected multiple WHERE block."],
  },
  {
    name: "AND composition grounds",
    assert: () => previewSqlFor(proposalFor("Show order_id where status equals active and order_amount is above 1000.", orders))?.includes("\n  AND ") ? [] : ["Expected AND grounding."],
  },
  {
    name: "OR composition blocks",
    assert: () => noSql(proposalFor("Show order_id where status equals active or status equals closed.", orders)) ? [] : ["Expected OR block."],
  },
  {
    name: "raw predicate SQL text blocks",
    assert: () => noSql(proposalFor("Show order_id where status equals active; drop table orders.", orders)) ? [] : ["Expected raw SQL block."],
  },
  {
    name: "aggregate threshold remains base HAVING",
    assert: () => {
      const proposal = proposalFor("Show regions where total revenue is above 500000.", sales);
      const sql = previewSqlFor(proposal);
      return proposal.aggregateResultConditions.length === 1 && proposal.filters.length === 0 && Boolean(sql?.includes("HAVING SUM"))
        ? []
        : ["Expected base aggregate HAVING."];
    },
  },
  {
    name: "derived threshold remains derived HAVING",
    assert: () => {
      const proposal = proposalFor("Show regions where total revenue minus total cost is above 100000.", sales);
      const sql = previewSqlFor(proposal);
      return proposal.derivedMeasures.length === 1 && proposal.aggregateResultConditions.length === 1 && Boolean(sql?.includes("HAVING (SUM"))
        ? []
        : ["Expected derived HAVING."];
    },
  },
  {
    name: "raw field threshold becomes WHERE",
    assert: () => canonicalFilter(proposalFor("Show sales rows where revenue is above 500000.", sales))?.target?.field === "revenue" ? [] : ["Expected raw field threshold filter."],
  },
  {
    name: "proposed filter ID is deterministic",
    assert: () => {
      const first = canonicalFilter(validProjection("status equals active"));
      const second = canonicalFilter(validProjection("status equals active"));
      return first?.id && first.id === second?.id ? [] : ["Expected deterministic proposed filter ID."];
    },
  },
  {
    name: "proposed ID ignores label and evidence",
    assert: () => {
      const filter = canonicalFilter(validProjection("status equals active"));
      const changed = filter ? createProposedRowFilterId({ target: filter.target, operator: filter.operator, comparisonValue: filter.comparisonValue }) : null;
      return filter?.id === changed ? [] : ["Expected proposed ID to ignore label/evidence."];
    },
  },
  {
    name: "bridge generates final canonical BusinessSqlFilter",
    assert: () => {
      const filter = finalFilter(validProjection("status equals active"));
      return filter?.target?.kind === "field" && filter.operator === "equals" && filter.comparisonValue?.kind === "string"
        ? []
        : ["Expected final canonical BusinessSqlFilter."];
    },
  },
  {
    name: "final filterId uses createBusinessSqlFilterId",
    assert: () => {
      const filter = finalFilter(validProjection("status equals active"));
      return filter && filter.filterId === createBusinessSqlFilterId(filter) ? [] : ["Expected final createBusinessSqlFilterId identity."];
    },
  },
  {
    name: "unresolved canonical proposal reference blocks bridge conversion",
    assert: () => {
      const proposal = validProjection("status equals active");
      const broken = {
        ...proposal,
        filters: proposal.filters.map((filter) => filter.semantics === "canonical"
          ? { ...filter, target: { ...filter.target!, resolved: false } }
          : filter),
      };
      const result = bridgeFor(broken);
      return result.state === "blocked_plan" && result.issues.some((issue) => issue.code === "unresolved_filter_reference")
        ? []
        : ["Expected unresolved canonical filter to block bridge."];
    },
  },
  {
    name: "exact numeric primary SQL",
    assert: () => previewSqlFor(proposalFor("Show order_id where order_amount is above 1000.", orders)) === expectedPrimarySql ? [] : ["Expected exact numeric WHERE SQL."],
  },
  {
    name: "exact aggregate-plus-text-filter SQL",
    assert: () => previewSqlFor(proposalFor("Show total revenue by region where status equals active.", sales)) === expectedAggregateTextSql ? [] : ["Expected exact aggregate plus WHERE SQL."],
  },
  {
    name: "exact boolean SQL",
    assert: () => previewSqlFor(proposalFor("Show item_id where discontinued equals false.", inventory))?.includes('WHERE "inventory"."discontinued" = FALSE') ? [] : ["Expected boolean WHERE SQL."],
  },
  {
    name: "exact contains SQL",
    assert: () => previewSqlFor(proposalFor('Show ticket_id where description contains "urgent".', tickets))?.includes(`WHERE contains("tickets"."description", 'urgent')`) ? [] : ["Expected contains WHERE SQL."],
  },
  {
    name: "exact null SQL",
    assert: () => previewSqlFor(proposalFor("Show order_id where closed_at is null.", orders))?.includes('WHERE "orders"."closed_at" IS NULL') ? [] : ["Expected null WHERE SQL."],
  },
  {
    name: "cross-domain supported operator SQL",
    assert: () => [
      ...(previewSqlFor(validProjection("status does not equal closed"))?.includes(`<> 'closed'`) ? [] : ["Expected not_equals SQL."]),
      ...(previewSqlFor(proposalFor("Show person_id where age is at least 65.", people))?.includes('>= 65') ? [] : ["Expected at least SQL."]),
      ...(previewSqlFor(validProjection("order_amount is below 500"))?.includes('< 500') ? [] : ["Expected below SQL."]),
      ...(previewSqlFor(validProjection('priority starts with "P"', inventory))?.includes(`starts_with("inventory"."priority", 'P')`) ? [] : ["Expected starts_with SQL."]),
      ...(previewSqlFor(validProjection('description ends with "resolved"', tickets))?.includes(`ends_with("tickets"."description", 'resolved')`) ? [] : ["Expected ends_with SQL."]),
      ...(previewSqlFor(validProjection("discontinued equals true", inventory))?.includes('= TRUE') ? [] : ["Expected boolean true SQL."]),
      ...(previewSqlFor(proposalFor("Show order_id where closed_at is not null.", orders))?.includes('IS NOT NULL') ? [] : ["Expected is_not_null SQL."]),
    ],
  },
  {
    name: "no filter-free fallback",
    assert: () => noSql(proposalFor("Show order_id where status equals currently active.", orders)) ? [] : ["Expected no filter-free fallback."],
  },
  {
    name: "preview Copy only",
    assert: () => {
      const result = bridgeFor(proposalFor("Show order_id where order_amount is above 1000.", orders));
      const preview = result.plan ? createBusinessSqlRenderPreview(result.plan) : null;
      return preview?.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql
        ? []
        : ["Expected copy-only preview actions."];
    },
  },
  {
    name: "no automatic Insert",
    assert: () => bridgeFor(proposalFor("Show order_id where order_amount is above 1000.", orders)).noInsertPerformed ? [] : ["Expected no insert."],
  },
  {
    name: "no automatic Run",
    assert: () => bridgeFor(proposalFor("Show order_id where order_amount is above 1000.", orders)).noRunPerformed ? [] : ["Expected no run."],
  },
  {
    name: "legacy filtered proposal remains refused",
    assert: () => {
      const proposal = proposalFor("Show leased units for current tenants.", worksheet("leases", [
        column("unit_id", "categorical"),
        column("lease_status", "categorical"),
      ]));
      return proposal.filters.some((filter) => filter.semantics === "needs_review") && noSql(proposal)
        ? []
        : ["Expected legacy semantic filter refusal."];
    },
  },
  {
    name: "unfiltered SQL remains byte-identical",
    assert: () => {
      const measureSeed = {
        kind: "sum" as const,
        entity: "sales",
        table: "sales",
        field: "revenue",
        distinct: false,
      };
      const measureId = createBusinessSqlMeasureId(measureSeed);
      const plan = {
        ...createEmptyBusinessSqlQueryPlan(),
        id: "business-sql-plan:ps-5c-unfiltered-byte-identity",
        kind: "single_table_count_grouping" as const,
        status: "resolved" as const,
        support: "supported" as const,
        entities: [{ entity: "sales", table: "sales", required: true, role: "source" as const }],
        measures: [{
          ...measureSeed,
          measureId,
          fieldInferredType: "numeric" as const,
          label: "Total revenue",
          sqlAlias: createBusinessSqlMeasureAlias("Total revenue"),
        }],
        groupings: [{ entity: "sales", table: "sales", field: "region", label: "region" }],
        orderBy: [
          {
            sortId: createBusinessSqlSortId({
              target: { kind: "measure", measureId, resolved: true },
              direction: "desc",
            }),
            target: { kind: "measure" as const, measureId, resolved: true },
            direction: "desc" as const,
          },
        ],
      };
      const expected = [
        "SELECT",
        '  "sales"."region" AS "region",',
        '  SUM("sales"."revenue") AS "total_revenue"',
        'FROM "sales"',
        'GROUP BY "sales"."region"',
        'ORDER BY "total_revenue" DESC;',
      ].join("\n");
      return renderBusinessSqlQueryPlan(plan).sql === expected ? [] : ["Expected unfiltered SQL byte identity."];
    },
  },
];

export function runExplicitRowFilterGroundingFixtures(): ExplicitRowFilterGroundingFixtureReport {
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

export const explicitRowFilterGroundingFixturesPass =
  runExplicitRowFilterGroundingFixtures().failed.length === 0;
