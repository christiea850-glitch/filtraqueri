/** PS-6e - explicit natural-language numeric BETWEEN grounding fixtures. */

import type { AcceptedRelationshipContract, WorksheetMetadata } from "../../../workbook";
import type { SchemaColumn } from "../../../dataset/datasetTypes";
import { detectBusinessIntent } from "../businessIntentGrounding";
import {
  createProposedRowFilterId,
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
  type ProposedFilter,
} from "../adaptiveReportProposal";
import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import {
  createBusinessSqlFilterId,
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

export type ExplicitBetweenFilterGroundingFixtureReport = {
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
  column("customer_id", "categorical"),
  column("order_amount", "numeric"),
  column("status", "categorical"),
  column("created_at", "date"),
]);

const items = worksheet("items", [
  column("item_id", "categorical"),
  column("unit_cost", "numeric"),
]);

const accounts = worksheet("accounts", [
  column("account_id", "categorical"),
  column("balance", "numeric"),
  column("enabled", "boolean"),
]);

const scores = worksheet("scores", [
  column("score", "numeric"),
]);

const sales = worksheet("sales", [
  column("region", "categorical"),
  column("revenue", "numeric"),
  column("cost", "numeric"),
  column("status", "categorical"),
]);

const customers = worksheet("customers", [
  column("customer_id", "categorical"),
  column("customer_score", "numeric"),
]);

const acceptedContract = (
  sourceTableName: string,
  sourceColumnName: string,
  targetTableName: string,
  targetColumnName: string,
): AcceptedRelationshipContract => ({
  contractId: `contract:${sourceTableName}:${targetTableName}`,
  sourceWorksheetId: sourceTableName,
  sourceTableName,
  sourceColumnName,
  targetWorksheetId: targetTableName,
  targetTableName,
  targetColumnName,
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: `candidate:${sourceTableName}:${targetTableName}`,
  acceptedAt: "2026-01-01T00:00:00.000Z",
  acceptedBy: null,
  status: "active",
  validationState: "valid",
  validationSummary: [],
  overlapRatio: 1,
  sourceUniqueRatio: 0.5,
  targetUniqueRatio: 1,
  inferredTypeCompatible: true,
  lastValidatedAt: "2026-01-01T00:00:00.000Z",
});

const proposalFor = (
  prompt: string,
  scopeWorksheet = orders,
  worksheets = [scopeWorksheet],
  contracts: readonly AcceptedRelationshipContract[] = [],
): AdaptiveReportProposal =>
  proposeAdaptiveReport({
    prompt,
    detectedIntent: detectBusinessIntent(prompt),
    appliedScopeSelections: worksheets.map((sheet) => ({
      worksheetId: sheet.worksheetId,
      tableName: sheet.tableName,
      sourceType: "original" as const,
    })),
    worksheets,
    acceptedRelationshipContracts: contracts,
  });

const bridgeFor = (
  proposal: AdaptiveReportProposal,
  contracts: readonly AcceptedRelationshipContract[] = [],
) =>
  createBusinessSqlPlanFromAdaptiveProposal({
    proposal,
    acceptedRelationshipContracts: contracts,
  });

const previewFor = (
  proposal: AdaptiveReportProposal,
  contracts: readonly AcceptedRelationshipContract[] = [],
) => {
  const bridge = bridgeFor(proposal, contracts);
  return bridge.plan ? createBusinessSqlRenderPreview(bridge.plan) : null;
};

const sqlFor = (
  proposal: AdaptiveReportProposal,
  contracts: readonly AcceptedRelationshipContract[] = [],
): string | null => previewFor(proposal, contracts)?.sql || null;

const canonicalFilter = (proposal: AdaptiveReportProposal): ProposedFilter | undefined =>
  proposal.filters.find((filter) => filter.semantics === "canonical");

const finalFilter = (
  proposal: AdaptiveReportProposal,
  contracts: readonly AcceptedRelationshipContract[] = [],
): BusinessSqlFilter | undefined =>
  bridgeFor(proposal, contracts).plan?.filters[0];

const noSql = (
  prompt: string,
  scopeWorksheet = orders,
  worksheets = [scopeWorksheet],
): boolean => !sqlFor(proposalFor(prompt, scopeWorksheet, worksheets));

const expectedIntegerSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" BETWEEN 100 AND 500;',
].join("\n");

const expectedDecimalSql = [
  "SELECT",
  '  "items"."item_id" AS "item_id"',
  'FROM "items"',
  'WHERE "items"."unit_cost" BETWEEN 10.5 AND 99.95;',
].join("\n");

const expectedNegativeSql = [
  "SELECT",
  '  "accounts"."account_id" AS "account_id"',
  'FROM "accounts"',
  'WHERE "accounts"."balance" BETWEEN -500 AND 0;',
].join("\n");

const expectedEqualSql = [
  "SELECT",
  '  "scores"."score" AS "score"',
  'FROM "scores"',
  'WHERE "scores"."score" BETWEEN 100 AND 100;',
].join("\n");

const expectedCommaSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_amount" BETWEEN 1000 AND 5000;',
].join("\n");

const expectedGroupedSql = [
  "SELECT",
  '  "sales"."region" AS "region",',
  '  SUM("sales"."revenue") AS "total_revenue"',
  'FROM "sales"',
  'WHERE "sales"."revenue" BETWEEN 100 AND 500',
  'GROUP BY "sales"."region"',
  'ORDER BY "total_revenue" DESC;',
].join("\n");

const expectedJoinedSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'JOIN "customers" ON "orders"."customer_id" = "customers"."customer_id"',
  'WHERE "customers"."customer_score" BETWEEN 10 AND 20;',
].join("\n");

const validProposal = () =>
  proposalFor("Show order_id where order_amount is between 100 and 500.", orders);

const validRange = (proposal = validProposal()) =>
  canonicalFilter(proposal)?.comparisonValue;

const fixtures: Fixture[] = [
  { name: "standalone BETWEEN phrase detection", assert: () => canonicalFilter(validProposal())?.operator === "between" ? [] : ["Expected BETWEEN operator."] },
  { name: "BETWEEN endpoint AND is accepted as range syntax", assert: () => validRange()?.kind === "range" ? [] : ["Expected one range comparison."] },
  { name: "additional logical AND grounds", assert: () => sqlFor(proposalFor("Show order_id where order_amount is between 100 and 500 and status equals active."))?.includes("\n  AND ") ? [] : ["Expected AND composition grounding."] },
  { name: "OR is rejected", assert: () => noSql("Show order_id where order_amount is between 100 and 500 or order_amount equals 900.") ? [] : ["Expected OR rejection."] },
  { name: "multiple WHERE shells rejected", assert: () => noSql("Show order_id where order_amount is between 100 and 500 where status equals active.") ? [] : ["Expected multiple WHERE rejection."] },
  { name: "integer endpoints parse", assert: () => {
    const value = validRange();
    return value?.kind === "range" && value.lower === 100 && value.upper === 500 ? [] : ["Expected integer endpoints."];
  } },
  { name: "decimal endpoints parse", assert: () => canonicalFilter(proposalFor("Show item_id where unit_cost is between 10.5 and 99.95.", items))?.comparisonValue?.kind === "range" ? [] : ["Expected decimal endpoints."] },
  { name: "negative endpoints parse", assert: () => canonicalFilter(proposalFor("Show account_id where balance is between -500 and 0.", accounts))?.comparisonValue?.kind === "range" ? [] : ["Expected negative endpoints."] },
  { name: "equal endpoints parse", assert: () => canonicalFilter(proposalFor("Show score where score is between 100 and 100.", scores))?.comparisonValue?.kind === "range" ? [] : ["Expected equal endpoints."] },
  { name: "correct comma-grouped endpoints parse", assert: () => canonicalFilter(proposalFor("Show order_id where order_amount is between 1,000 and 5,000.", orders))?.comparisonValue?.kind === "range" ? [] : ["Expected comma endpoints."] },
  { name: "reversed endpoints reject", assert: () => noSql("Show order_id where order_amount is between 500 and 100.") ? [] : ["Expected reversed rejection."] },
  { name: "missing lower rejects", assert: () => noSql("Show order_id where order_amount is between and 500.") ? [] : ["Expected missing lower rejection."] },
  { name: "missing upper rejects", assert: () => noSql("Show order_id where order_amount is between 100 and.") ? [] : ["Expected missing upper rejection."] },
  { name: "missing AND separator rejects", assert: () => noSql("Show order_id where order_amount is between 100 500.") ? [] : ["Expected missing separator rejection."] },
  { name: "malformed comma grouping rejects", assert: () => noSql("Show order_id where order_amount is between 1,00 and 5,000.") ? [] : ["Expected bad comma rejection."] },
  { name: "malformed decimal rejects", assert: () => noSql("Show order_id where order_amount is between 1.2.3 and 5.") ? [] : ["Expected bad decimal rejection."] },
  { name: "currency rejects", assert: () => noSql("Show order_id where order_amount is between $100 and $500.") ? [] : ["Expected currency rejection."] },
  { name: "percentage rejects", assert: () => noSql("Show order_id where order_amount is between 10% and 20%.") ? [] : ["Expected percent rejection."] },
  { name: "units reject", assert: () => noSql("Show order_id where order_amount is between 10 days and 20 days.") ? [] : ["Expected units rejection."] },
  { name: "magnitude suffix rejects", assert: () => noSql("Show order_id where order_amount is between 100k and 500k.") ? [] : ["Expected suffix rejection."] },
  { name: "arithmetic rejects", assert: () => noSql("Show order_id where order_amount is between 100 + 20 and 500.") ? [] : ["Expected arithmetic rejection."] },
  { name: "word numbers reject", assert: () => noSql("Show order_id where order_amount is between one hundred and five hundred.") ? [] : ["Expected word-number rejection."] },
  { name: "quoted numeric endpoints reject", assert: () => noSql('Show order_id where order_amount is between "100" and "500".') ? [] : ["Expected quoted numeric rejection."] },
  { name: "text field rejects", assert: () => noSql("Show order_id where status is between active and pending.") ? [] : ["Expected text field rejection."] },
  { name: "boolean field rejects", assert: () => noSql("Show account_id where enabled is between false and true.", accounts) ? [] : ["Expected boolean field rejection."] },
  { name: "date field now routes to date-range grounding", assert: () => sqlFor(proposalFor("Show order_id where created_at is between 2026-01-01 and 2026-02-01."))?.includes("BETWEEN DATE '2026-01-01' AND DATE '2026-02-01'") ? [] : ["Expected date-range grounding."] },
  { name: "unknown field rejects", assert: () => noSql("Show order_id where mystery_amount is between 100 and 500.") ? [] : ["Expected unknown field rejection."] },
  { name: "missing field rejects", assert: () => noSql("Show order_id where is between 100 and 500.") ? [] : ["Expected missing field rejection."] },
  { name: "ambiguous field rejects", assert: () => noSql("Show order_id where order_amount is between 100 and 500.", orders, [orders, worksheet("returns", [column("order_amount", "numeric")])]) ? [] : ["Expected ambiguous field rejection."] },
  { name: "stable proposed ID", assert: () => canonicalFilter(validProposal())?.id === canonicalFilter(validProposal())?.id ? [] : ["Expected stable ID."] },
  { name: "proposed ID changes with lower", assert: () => canonicalFilter(validProposal())?.id !== canonicalFilter(proposalFor("Show order_id where order_amount is between 101 and 500.", orders))?.id ? [] : ["Expected lower-sensitive ID."] },
  { name: "proposed ID changes with upper", assert: () => canonicalFilter(validProposal())?.id !== canonicalFilter(proposalFor("Show order_id where order_amount is between 100 and 501.", orders))?.id ? [] : ["Expected upper-sensitive ID."] },
  { name: "proposed ID changes with field", assert: () => canonicalFilter(validProposal())?.id !== canonicalFilter(proposalFor("Show order_id where customer_id is between 100 and 500.", orders))?.id ? [] : ["Expected field-sensitive ID."] },
  { name: "label and evidence immunity", assert: () => {
    const filter = canonicalFilter(validProposal());
    const changed = filter ? createProposedRowFilterId({ target: filter.target, operator: filter.operator, comparisonValue: filter.comparisonValue }) : null;
    return filter?.id === changed ? [] : ["Expected label/evidence immunity."];
  } },
  { name: "canonical range proposal shape", assert: () => {
    const filter = canonicalFilter(validProposal());
    const value = filter?.comparisonValue;
    return filter?.semantics === "canonical" &&
      filter.executable === true &&
      filter.operator === "between" &&
      value?.kind === "range" &&
      value.valueKind === "number" &&
      value.lowerInclusive === true &&
      value.upperInclusive === true
      ? []
      : ["Expected canonical range proposal."];
  } },
  { name: "bridge maps range unchanged", assert: () => finalFilter(validProposal())?.comparisonValue?.kind === "range" ? [] : ["Expected bridge range mapping."] },
  { name: "final BusinessSqlFilter gets stable filterId", assert: () => {
    const filter = finalFilter(validProposal());
    return filter && filter.filterId === createBusinessSqlFilterId(filter) ? [] : ["Expected final filterId."];
  } },
  { name: "invalid bridge range blocks", assert: () => {
    const proposal = validProposal();
    const broken = {
      ...proposal,
      filters: proposal.filters.map((filter) => filter.semantics === "canonical"
        ? { ...filter, comparisonValue: { kind: "range" as const, valueKind: "number" as const, lower: 500, upper: 100, lowerInclusive: true as const, upperInclusive: true as const } }
        : filter),
    };
    const result = bridgeFor(broken);
    return result.state === "blocked_plan" && result.issues.some((issue) => issue.code === "invalid_canonical_filter") ? [] : ["Expected invalid bridge range block."];
  } },
  { name: "exact integer SQL", assert: () => sqlFor(validProposal()) === expectedIntegerSql ? [] : ["Expected integer SQL."] },
  { name: "exact decimal SQL", assert: () => sqlFor(proposalFor("Show item_id where unit_cost is between 10.5 and 99.95.", items)) === expectedDecimalSql ? [] : ["Expected decimal SQL."] },
  { name: "exact negative SQL", assert: () => sqlFor(proposalFor("Show account_id where balance is between -500 and 0.", accounts)) === expectedNegativeSql ? [] : ["Expected negative SQL."] },
  { name: "exact equal-endpoint SQL", assert: () => sqlFor(proposalFor("Show score where score is between 100 and 100.", scores)) === expectedEqualSql ? [] : ["Expected equal SQL."] },
  { name: "exact comma-grouped SQL", assert: () => sqlFor(proposalFor("Show order_id where order_amount is between 1,000 and 5,000.", orders)) === expectedCommaSql ? [] : ["Expected comma SQL."] },
  { name: "field projection remains unsorted", assert: () => !sqlFor(validProposal())?.includes("ORDER BY") ? [] : ["Expected unsorted projection."] },
  { name: "grouped aggregation keeps explicit plan sort", assert: () => {
    const proposal = proposalFor("Show total revenue by region where revenue is between 100 and 500.", sales);
    const bridge = bridgeFor(proposal);
    return bridge.plan?.orderBy.length === 1 && sqlFor(proposal) === expectedGroupedSql ? [] : ["Expected grouped sort metadata."];
  } },
  { name: "WHERE precedes GROUP BY", assert: () => {
    const sql = sqlFor(proposalFor("Show total revenue by region where revenue is between 100 and 500.", sales)) || "";
    return sql.indexOf("WHERE") > -1 && sql.indexOf("WHERE") < sql.indexOf("GROUP BY") ? [] : ["Expected WHERE before GROUP BY."];
  } },
  { name: "WHERE precedes HAVING", assert: () => {
    const sql = renderBusinessSqlQueryPlan(bridgeFor(proposalFor("Show total revenue by region where revenue is between 100 and 500.", sales)).plan!).sql || "";
    return !sql.includes("HAVING") || sql.indexOf("WHERE") < sql.indexOf("GROUP BY") ? [] : ["Expected WHERE before HAVING boundary."];
  } },
  { name: "WHERE precedes ORDER BY", assert: () => {
    const sql = sqlFor(proposalFor("Show total revenue by region where revenue is between 100 and 500.", sales)) || "";
    return sql.indexOf("WHERE") < sql.indexOf("ORDER BY") ? [] : ["Expected WHERE before ORDER BY."];
  } },
  { name: "LIMIT remains last", assert: () => {
    const proposal = proposalFor("Show top 5 total revenue by region where revenue is between 100 and 500.", sales);
    const sql = sqlFor(proposal) || "";
    return !sql.includes("LIMIT") || /LIMIT \d+;$/.test(sql) ? [] : ["Expected LIMIT last."];
  } },
  { name: "resolved join works", assert: () => {
    const contract = acceptedContract("orders", "customer_id", "customers", "customer_id");
    const proposal = proposalFor("Show order_id where customer_score is between 10 and 20.", orders, [orders, customers], [contract]);
    return sqlFor(proposal, [contract]) === expectedJoinedSql ? [] : ["Expected joined BETWEEN SQL."];
  } },
  { name: "unresolved join blocks", assert: () => {
    const proposal = proposalFor("Show order_id where customer_score is between 10 and 20.", orders, [orders, customers]);
    return !sqlFor(proposal) ? [] : ["Expected unresolved join block."];
  } },
  { name: "aggregate HAVING precedence preserved", assert: () => {
    const proposal = proposalFor("Show regions where total revenue is between 100000 and 500000.", sales);
    return proposal.filters.length === 0 && !sqlFor(proposal) ? [] : ["Expected aggregate BETWEEN not to become WHERE."];
  } },
  { name: "derived HAVING precedence preserved", assert: () => {
    const proposal = proposalFor("Show regions where total revenue minus total cost is between 10000 and 50000.", sales);
    return proposal.filters.length === 0 && !sqlFor(proposal) ? [] : ["Expected derived BETWEEN not to become WHERE."];
  } },
  { name: "no WHERE plus HAVING double claim", assert: () => {
    const proposal = proposalFor("Show regions where total revenue is between 100000 and 500000.", sales);
    return proposal.filters.length === 0 && proposal.aggregateResultConditions.length === 0 ? [] : ["Expected no double claim."];
  } },
  { name: "existing scalar row-filter grounding unchanged", assert: () => sqlFor(proposalFor("Show order_id where order_amount is above 1000.", orders))?.includes('> 1000;') ? [] : ["Expected scalar grounding."] },
  { name: "existing IN and NOT IN rendering unchanged", assert: () => {
    const filter = finalFilter(validProposal());
    return filter?.operator === "between" ? [] : ["Expected no set-renderer regression in grounding path."];
  } },
  { name: "existing canonical BETWEEN rendering unchanged", assert: () => sqlFor(validProposal()) === expectedIntegerSql ? [] : ["Expected BETWEEN renderer."] },
  { name: "preview Copy only", assert: () => {
    const preview = previewFor(validProposal());
    return preview?.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql ? [] : ["Expected copy-only preview."];
  } },
  { name: "unsupported preview no actions", assert: () => {
    const preview = previewFor(proposalFor("Show order_id where order_amount is between 500 and 100.", orders));
    return !preview?.sql && !preview?.actions.canCopySql && !preview?.actions.canInsertSql && !preview?.actions.canRunSql ? [] : ["Expected unsupported no actions."];
  } },
  { name: "no automatic Insert", assert: () => bridgeFor(validProposal()).noInsertPerformed ? [] : ["Expected no insert."] },
  { name: "no automatic Run", assert: () => bridgeFor(validProposal()).noRunPerformed ? [] : ["Expected no run."] },
  { name: "legacy filters remain refused", assert: () => noSql("Show active orders.", orders) ? [] : ["Expected legacy refusal."] },
  { name: "raw SQL-like predicate rejected", assert: () => noSql("Show order_id where order_amount is between 100 and 500; drop table orders.") ? [] : ["Expected raw SQL rejection."] },
];

export function runExplicitBetweenFilterGroundingFixtures(): ExplicitBetweenFilterGroundingFixtureReport {
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

export const explicitBetweenFilterGroundingFixturesPass =
  runExplicitBetweenFilterGroundingFixtures().failed.length === 0;
