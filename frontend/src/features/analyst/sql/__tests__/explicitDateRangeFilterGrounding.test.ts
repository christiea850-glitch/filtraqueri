/** PS-7f - explicit natural-language date-range grounding fixtures. */

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
  type BusinessSqlFilterComparisonValue,
} from "../businessSqlQueryPlan";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import { renderBusinessSqlQueryPlan } from "../businessSqlRenderer";

type FixtureResult = { name: string; ok: boolean; failureReasons: string[] };
type Fixture = { name: string; assert: () => string[] };

export type ExplicitDateRangeFilterGroundingFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const column = (name: string, inferred_type: SchemaColumn["inferred_type"]): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "DOUBLE" : inferred_type === "boolean" ? "BOOLEAN" : inferred_type === "date" ? "DATE" : "VARCHAR",
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
  column("order_date", "date"),
  column("order_amount", "numeric"),
  column("status", "categorical"),
  column("is_active", "boolean"),
]);

const customers = worksheet("customers", [
  column("customer_id", "categorical"),
  column("signup_date", "date"),
  column("status", "categorical"),
]);

const sales = worksheet("sales", [
  column("region", "categorical"),
  column("sale_date", "date"),
  column("revenue", "numeric"),
  column("cost", "numeric"),
  column("status", "categorical"),
]);

const events = worksheet("events", [
  column("event_id", "categorical"),
  column("event_date", "date"),
  column("created_at", "datetime" as unknown as SchemaColumn["inferred_type"]),
  column("updated_at", "timestamp" as unknown as SchemaColumn["inferred_type"]),
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
  contracts: readonly AcceptedRelationshipContract[] = [],
): boolean => !sqlFor(proposalFor(prompt, scopeWorksheet, worksheets, contracts), contracts);

const validPrompt = "Show order_id where order_date is between 2026-01-01 and 2026-12-31.";
const validProposal = () => proposalFor(validPrompt, orders);
const validRange = (proposal = validProposal()) => canonicalFilter(proposal)?.comparisonValue;

const expectedDateSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_date" BETWEEN DATE \'2026-01-01\' AND DATE \'2026-12-31\';',
].join("\n");

const expectedJoinedSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'JOIN "customers" ON "orders"."customer_id" = "customers"."customer_id"',
  'WHERE "customers"."signup_date" BETWEEN DATE \'2026-01-01\' AND DATE \'2026-12-31\';',
].join("\n");

const expectedGroupedSql = [
  "SELECT",
  '  "sales"."region" AS "region",',
  '  SUM("sales"."revenue") AS "total_revenue"',
  'FROM "sales"',
  'WHERE "sales"."sale_date" BETWEEN DATE \'2026-01-01\' AND DATE \'2026-12-31\'',
  'GROUP BY "sales"."region"',
  'ORDER BY "total_revenue" DESC;',
].join("\n");

const dateRangeValue = (
  lower = "2026-01-01",
  upper = "2026-12-31",
): Extract<BusinessSqlFilterComparisonValue, { kind: "range" }> => ({
  kind: "range",
  valueKind: "date",
  lower,
  upper,
  lowerInclusive: true,
  upperInclusive: true,
});

const withCanonicalFilter = (
  proposal: AdaptiveReportProposal,
  mutate: (filter: ProposedFilter) => ProposedFilter,
): AdaptiveReportProposal => ({
  ...proposal,
  filters: proposal.filters.map((filter) => filter.semantics === "canonical" ? mutate(filter) : filter),
});

const aggregateDateRangeProposal = () =>
  proposalFor("Show regions where total revenue is between 2026-01-01 and 2026-12-31.", sales);

const derivedDateRangeProposal = () =>
  proposalFor("Show regions where total revenue minus total cost is between 2026-01-01 and 2026-12-31.", sales);

const malformedPrompts: readonly [string, string][] = [
  ["Invalid lower month rejects", "Show order_id where order_date is between 2026-13-01 and 2026-12-31."],
  ["Invalid upper month rejects", "Show order_id where order_date is between 2026-01-01 and 2026-13-31."],
  ["Invalid lower day rejects", "Show order_id where order_date is between 2026-01-00 and 2026-12-31."],
  ["Invalid upper day rejects", "Show order_id where order_date is between 2026-01-01 and 2026-12-32."],
  ["Impossible lower date rejects", "Show order_id where order_date is between 2026-04-31 and 2026-12-31."],
  ["Impossible upper date rejects", "Show order_id where order_date is between 2026-01-01 and 2026-02-29."],
  ["Non-padded lower rejects", "Show order_id where order_date is between 2026-2-01 and 2026-12-31."],
  ["Non-padded upper rejects", "Show order_id where order_date is between 2026-01-01 and 2026-12-1."],
  ["Slash lower rejects", "Show order_id where order_date is between 2026/01/01 and 2026-12-31."],
  ["Slash upper rejects", "Show order_id where order_date is between 2026-01-01 and 12/31/2026."],
  ["Written lower rejects", "Show order_id where order_date is between January 1, 2026 and 2026-12-31."],
  ["Written upper rejects", "Show order_id where order_date is between 2026-01-01 and December 31, 2026."],
  ["Datetime lower rejects", "Show order_id where order_date is between 2026-01-01T00:00:00 and 2026-12-31."],
  ["Datetime upper rejects", "Show order_id where order_date is between 2026-01-01 and 2026-12-31T00:00:00."],
  ["Timestamp lower rejects", "Show order_id where order_date is between 2026-01-01Z and 2026-12-31."],
  ["Timestamp upper rejects", "Show order_id where order_date is between 2026-01-01 and 2026-12-31 12:00."],
  ["Quoted lower rejects", "Show order_id where order_date is between \"2026-01-01\" and 2026-12-31."],
  ["Quoted upper rejects", "Show order_id where order_date is between 2026-01-01 and '2026-12-31'."],
  ["Missing lower rejects", "Show order_id where order_date is between and 2026-12-31."],
  ["Missing upper rejects", "Show order_id where order_date is between 2026-01-01 and."],
  ["Three endpoints reject", "Show order_id where order_date is between 2026-01-01 and 2026-12-31 and 2027-01-01."],
  ["Repeated separator rejects", "Show order_id where order_date is between 2026-01-01 and and 2026-12-31."],
  ["Extra lower-prefix text rejects", "Show order_id where order_date is between approximately 2026-01-01 and 2026-12-31."],
  ["Extra upper-prefix text rejects", "Show order_id where order_date is between 2026-01-01 and approximately 2026-12-31."],
  ["Extra suffix text rejects", "Show order_id where order_date is between 2026-01-01 and 2026-12-31 UTC."],
  ["Raw SQL-like date range rejects", "Show order_id where order_date is between 2026-01-01 and 2026-12-31; drop table orders."],
] as const;

const fixtures: Fixture[] = [
  { name: "Date field plus is between creates date range", assert: () => {
    const value = validRange();
    return value?.kind === "range" && value.valueKind === "date" ? [] : ["Expected date range."];
  } },
  { name: "Date field plus is in the range creates date range", assert: () => canonicalFilter(proposalFor("Show order_id where order_date is in the range 2026-01-01 and 2026-12-31.", orders))?.comparisonValue?.kind === "range" ? [] : ["Expected range phrase."] },
  { name: "Date field plus ranges from follows existing separator grammar", assert: () => canonicalFilter(proposalFor("Show order_id where order_date ranges from 2026-01-01 and 2026-12-31.", orders))?.comparisonValue?.kind === "range" ? [] : ["Expected ranges-from phrase with AND separator."] },
  { name: "Bare between phrase follows current behavior", assert: () => canonicalFilter(proposalFor("Show order_id where order_date between 2026-01-01 and 2026-12-31.", orders))?.operator === "between" ? [] : ["Expected bare between."] },
  { name: "is in the range wins before is in", assert: () => canonicalFilter(proposalFor("Show order_id where order_date is in the range 2026-01-01 and 2026-12-31.", orders))?.operator === "between" ? [] : ["Expected longest phrase."] },
  { name: "Numeric is between still creates numeric range", assert: () => {
    const value = canonicalFilter(proposalFor("Show order_id where order_amount is between 100 and 500.", orders))?.comparisonValue;
    return value?.kind === "range" && value.valueKind === "number" ? [] : ["Expected numeric range."];
  } },
  { name: "Numeric is in the range remains numeric", assert: () => {
    const value = canonicalFilter(proposalFor("Show order_id where order_amount is in the range 100 and 500.", orders))?.comparisonValue;
    return value?.kind === "range" && value.valueKind === "number" ? [] : ["Expected numeric range phrase."];
  } },
  { name: "Exactly one WHERE required", assert: () => noSql("Show order_id order_date is between 2026-01-01 and 2026-12-31.", orders) ? [] : ["Expected missing WHERE rejection."] },
  { name: "Multiple WHERE shells reject", assert: () => noSql("Show order_id where order_date is between 2026-01-01 and 2026-12-31 where status equals active.", orders) ? [] : ["Expected multiple WHERE rejection."] },
  { name: "Extra AND predicate rejects", assert: () => noSql("Show order_id where order_date is between 2026-01-01 and 2026-12-31 and status equals active.", orders) ? [] : ["Expected extra AND rejection."] },
  { name: "OR predicate rejects", assert: () => noSql("Show order_id where order_date is between 2026-01-01 and 2026-12-31 or status equals active.", orders) ? [] : ["Expected OR rejection."] },
  { name: "Multiple range predicates reject", assert: () => noSql("Show order_id where order_date is between 2026-01-01 and 2026-12-31 and order_date is between 2027-01-01 and 2027-12-31.", orders) ? [] : ["Expected multiple ranges rejection."] },
  { name: "Standard date range parses", assert: () => {
    const value = validRange();
    return value?.kind === "range" && value.lower === "2026-01-01" && value.upper === "2026-12-31" ? [] : ["Expected standard endpoints."];
  } },
  { name: "Leap-day lower parses", assert: () => canonicalFilter(proposalFor("Show order_id where order_date is between 2024-02-29 and 2024-03-01.", orders))?.comparisonValue?.kind === "range" ? [] : ["Expected leap-day lower."] },
  { name: "Leap-day upper parses", assert: () => canonicalFilter(proposalFor("Show order_id where order_date is between 2024-02-28 and 2024-02-29.", orders))?.comparisonValue?.kind === "range" ? [] : ["Expected leap-day upper."] },
  { name: "Century leap-day parses", assert: () => canonicalFilter(proposalFor("Show order_id where order_date is between 2000-02-29 and 2000-12-31.", orders))?.comparisonValue?.kind === "range" ? [] : ["Expected century leap-day."] },
  { name: "Equal endpoints parse", assert: () => canonicalFilter(proposalFor("Show order_id where order_date is between 1900-03-01 and 1900-03-01.", orders))?.comparisonValue?.kind === "range" ? [] : ["Expected equal endpoints."] },
  { name: "Reversed endpoints reject", assert: () => noSql("Show order_id where order_date is between 2026-12-31 and 2026-01-01.", orders) ? [] : ["Expected reversed rejection."] },
  ...malformedPrompts.map(([name, prompt]): Fixture => ({ name, assert: () => noSql(prompt, orders) ? [] : [`Expected ${name}.`] })),
  { name: "Date field accepts range", assert: () => canonicalFilter(validProposal())?.target?.fieldInferredType === "date" ? [] : ["Expected date field."] },
  { name: "Numeric field rejects date range", assert: () => noSql("Show order_id where order_amount is between 2026-01-01 and 2026-12-31.", orders) ? [] : ["Expected numeric rejection."] },
  { name: "Text field rejects", assert: () => noSql("Show order_id where status is between 2026-01-01 and 2026-12-31.", orders) ? [] : ["Expected text rejection."] },
  { name: "Categorical field rejects", assert: () => noSql("Show order_id where status is between 2026-01-01 and 2026-12-31.", orders) ? [] : ["Expected categorical rejection."] },
  { name: "Boolean field rejects", assert: () => noSql("Show order_id where is_active is between 2026-01-01 and 2026-12-31.", orders) ? [] : ["Expected boolean rejection."] },
  { name: "Datetime field rejects", assert: () => noSql("Show event_id where created_at is between 2026-01-01 and 2026-12-31.", events) ? [] : ["Expected datetime rejection."] },
  { name: "Timestamp field rejects", assert: () => noSql("Show event_id where updated_at is between 2026-01-01 and 2026-12-31.", events) ? [] : ["Expected timestamp rejection."] },
  { name: "Unknown field rejects", assert: () => noSql("Show order_id where mystery_date is between 2026-01-01 and 2026-12-31.", orders) ? [] : ["Expected unknown field rejection."] },
  { name: "Missing field rejects", assert: () => noSql("Show order_id where is between 2026-01-01 and 2026-12-31.", orders) ? [] : ["Expected missing field rejection."] },
  { name: "Ambiguous field rejects", assert: () => noSql(validPrompt, orders, [orders, worksheet("shipments", [column("order_date", "date")])]) ? [] : ["Expected ambiguous field rejection."] },
  { name: "Resolved joined date field grounds", assert: () => {
    const contract = acceptedContract("orders", "customer_id", "customers", "customer_id");
    const proposal = proposalFor("Show order_id where signup_date is between 2026-01-01 and 2026-12-31.", orders, [orders, customers], [contract]);
    return canonicalFilter(proposal)?.target?.table === "customers" ? [] : ["Expected joined canonical target."];
  } },
  { name: "Unresolved joined date field blocks", assert: () => {
    const proposal = proposalFor("Show order_id where signup_date is between 2026-01-01 and 2026-12-31.", orders, [orders, customers]);
    return !sqlFor(proposal) ? [] : ["Expected unresolved join block."];
  } },
  { name: "Canonical proposed date-range shape", assert: () => {
    const filter = canonicalFilter(validProposal());
    const value = filter?.comparisonValue;
    return filter?.semantics === "canonical" && filter.executable === true && filter.operator === "between" && value?.kind === "range" && value.valueKind === "date" && value.lowerInclusive === true && value.upperInclusive === true ? [] : ["Expected canonical date range proposal."];
  } },
  { name: "Proposed date-range ID is stable", assert: () => canonicalFilter(validProposal())?.id === canonicalFilter(validProposal())?.id ? [] : ["Expected stable ID."] },
  { name: "Lower change changes proposed ID", assert: () => canonicalFilter(validProposal())?.id !== canonicalFilter(proposalFor("Show order_id where order_date is between 2026-01-02 and 2026-12-31.", orders))?.id ? [] : ["Expected lower-sensitive ID."] },
  { name: "Upper change changes proposed ID", assert: () => canonicalFilter(validProposal())?.id !== canonicalFilter(proposalFor("Show order_id where order_date is between 2026-01-01 and 2026-12-30.", orders))?.id ? [] : ["Expected upper-sensitive ID."] },
  { name: "Field change changes proposed ID", assert: () => canonicalFilter(validProposal())?.id !== canonicalFilter(proposalFor("Show event_id where event_date is between 2026-01-01 and 2026-12-31.", events))?.id ? [] : ["Expected field-sensitive ID."] },
  { name: "Label change does not change ID", assert: () => {
    const filter = canonicalFilter(validProposal());
    const changed = filter ? createProposedRowFilterId({ target: filter.target, operator: filter.operator, comparisonValue: filter.comparisonValue }) : null;
    return filter?.id === changed ? [] : ["Expected label-insensitive ID."];
  } },
  { name: "Evidence change does not change ID", assert: () => {
    const filter = canonicalFilter(validProposal());
    const changed = filter ? createProposedRowFilterId({ target: filter.target, operator: filter.operator, comparisonValue: filter.comparisonValue }) : null;
    return filter?.id === changed ? [] : ["Expected evidence-insensitive ID."];
  } },
  { name: "Date range differs from numeric range identity", assert: () => canonicalFilter(validProposal())?.id !== canonicalFilter(proposalFor("Show order_id where order_amount is between 100 and 500.", orders))?.id ? [] : ["Expected date and numeric identities to differ."] },
  { name: "Date range differs from single-date identity", assert: () => canonicalFilter(validProposal())?.id !== canonicalFilter(proposalFor("Show order_id where order_date is before 2026-01-01.", orders))?.id ? [] : ["Expected range and single date identities to differ."] },
  { name: "Date range differs from scalar identity", assert: () => canonicalFilter(validProposal())?.id !== canonicalFilter(proposalFor("Show order_id where order_amount is above 100.", orders))?.id ? [] : ["Expected scalar identity difference."] },
  { name: "Bridge preserves date-range shape", assert: () => {
    const value = finalFilter(validProposal())?.comparisonValue;
    return value?.kind === "range" && value.valueKind === "date" ? [] : ["Expected bridge preservation."];
  } },
  { name: "Final filterId equals createBusinessSqlFilterId", assert: () => {
    const filter = finalFilter(validProposal());
    return filter && filter.filterId === createBusinessSqlFilterId(filter) ? [] : ["Expected final filter ID."];
  } },
  { name: "Malformed bridged date range blocks", assert: () => {
    const result = bridgeFor(withCanonicalFilter(validProposal(), (filter) => ({ ...filter, comparisonValue: dateRangeValue("2026-02-29", "2026-12-31") })));
    return result.state === "blocked_plan" ? [] : ["Expected malformed bridge block."];
  } },
  { name: "Reversed bridged date range blocks", assert: () => {
    const result = bridgeFor(withCanonicalFilter(validProposal(), (filter) => ({ ...filter, comparisonValue: dateRangeValue("2026-12-31", "2026-01-01") })));
    return result.state === "blocked_plan" ? [] : ["Expected reversed bridge block."];
  } },
  { name: "Wrong-type bridged date range blocks", assert: () => {
    const result = bridgeFor(withCanonicalFilter(validProposal(), (filter) => filter.target
      ? { ...filter, target: { ...filter.target, fieldInferredType: "numeric" }, comparisonValue: dateRangeValue() }
      : filter));
    return result.state === "blocked_plan" ? [] : ["Expected wrong-type bridge block."];
  } },
  { name: "Exact date BETWEEN SQL", assert: () => sqlFor(validProposal()) === expectedDateSql ? [] : ["Expected exact date SQL."] },
  { name: "DATE keyword appears twice", assert: () => ((sqlFor(validProposal()) || "").match(/\bDATE\b/g) || []).length === 2 ? [] : ["Expected two DATE keywords."] },
  { name: "BETWEEN appears once", assert: () => ((sqlFor(validProposal()) || "").match(/\bBETWEEN\b/g) || []).length === 1 ? [] : ["Expected one BETWEEN."] },
  { name: "Endpoint AND appears once", assert: () => ((sqlFor(validProposal()) || "").match(/\bAND\b/g) || []).length === 1 ? [] : ["Expected one endpoint AND."] },
  { name: "Terminal semicolon is present", assert: () => sqlFor(validProposal())?.endsWith(";") ? [] : ["Expected semicolon."] },
  { name: "Leap-day range renders end to end", assert: () => sqlFor(proposalFor("Show order_id where order_date is between 2024-02-29 and 2024-03-01.", orders))?.includes("DATE '2024-02-29'") ? [] : ["Expected leap render."] },
  { name: "Century leap-day renders end to end", assert: () => sqlFor(proposalFor("Show order_id where order_date is between 2000-02-29 and 2000-12-31.", orders))?.includes("DATE '2000-02-29'") ? [] : ["Expected century render."] },
  { name: "Equal endpoints render end to end", assert: () => sqlFor(proposalFor("Show order_id where order_date is between 1900-03-01 and 1900-03-01.", orders))?.includes("DATE '1900-03-01' AND DATE '1900-03-01'") ? [] : ["Expected equal render."] },
  { name: "Resolved joined date range renders", assert: () => {
    const contract = acceptedContract("orders", "customer_id", "customers", "customer_id");
    const proposal = proposalFor("Show order_id where signup_date is between 2026-01-01 and 2026-12-31.", orders, [orders, customers], [contract]);
    return sqlFor(proposal, [contract]) === expectedJoinedSql ? [] : ["Expected joined date SQL."];
  } },
  { name: "Field projection remains unsorted", assert: () => !sqlFor(validProposal())?.includes("ORDER BY") ? [] : ["Expected unsorted projection."] },
  { name: "Date range does not invent LIMIT", assert: () => !sqlFor(validProposal())?.includes("LIMIT") ? [] : ["Expected no limit."] },
  { name: "WHERE precedes GROUP BY", assert: () => {
    const sql = sqlFor(proposalFor("Show total revenue by region where sale_date is between 2026-01-01 and 2026-12-31.", sales)) || "";
    return sql.includes("GROUP BY") && sql.indexOf("WHERE") < sql.indexOf("GROUP BY") ? [] : ["Expected WHERE before GROUP BY."];
  } },
  { name: "WHERE precedes HAVING", assert: () => {
    const bridge = bridgeFor(proposalFor("Show total revenue by region where sale_date is between 2026-01-01 and 2026-12-31.", sales));
    const sql = bridge.plan ? renderBusinessSqlQueryPlan({ ...bridge.plan, aggregateResultConditions: [{ conditionId: "manual-having", measureId: bridge.plan.measures[0].measureId, operator: "greater_than", comparisonValue: { kind: "number", value: 10 } }] }).sql || "" : "";
    return sql.includes("HAVING") && sql.indexOf("WHERE") < sql.indexOf("HAVING") ? [] : ["Expected WHERE before HAVING."];
  } },
  { name: "WHERE precedes ORDER BY", assert: () => {
    const sql = sqlFor(proposalFor("Show total revenue by region where sale_date is between 2026-01-01 and 2026-12-31.", sales)) || "";
    return sql.indexOf("WHERE") < sql.indexOf("ORDER BY") ? [] : ["Expected WHERE before ORDER BY."];
  } },
  { name: "LIMIT remains last", assert: () => {
    const sql = sqlFor(proposalFor("Show top 5 total revenue by region where sale_date is between 2026-01-01 and 2026-12-31.", sales)) || "";
    return !sql.includes("LIMIT") || /LIMIT \d+;$/.test(sql) ? [] : ["Expected LIMIT last."];
  } },
  { name: "Grouped aggregation retains explicit default ordering", assert: () => sqlFor(proposalFor("Show total revenue by region where sale_date is between 2026-01-01 and 2026-12-31.", sales)) === expectedGroupedSql ? [] : ["Expected grouped default ordering."] },
  { name: "Empty orderBy remains unsorted", assert: () => {
    const bridge = bridgeFor(proposalFor("Show total revenue by region where sale_date is between 2026-01-01 and 2026-12-31.", sales));
    const preview = bridge.plan ? createBusinessSqlRenderPreview({ ...bridge.plan, orderBy: [] }) : null;
    return preview?.sql && !preview.sql.includes("ORDER BY") ? [] : ["Expected empty orderBy unsorted."];
  } },
  { name: "Aggregate date-range wording does not become WHERE", assert: () => !canonicalFilter(aggregateDateRangeProposal()) && !sqlFor(aggregateDateRangeProposal()) ? [] : ["Expected aggregate date-range block."] },
  { name: "Derived aggregate date-range wording does not become WHERE", assert: () => !canonicalFilter(derivedDateRangeProposal()) && !sqlFor(derivedDateRangeProposal()) ? [] : ["Expected derived date-range block."] },
  { name: "No WHERE/HAVING double claim", assert: () => aggregateDateRangeProposal().filters.length === 1 && aggregateDateRangeProposal().aggregateResultConditions.length === 0 ? [] : ["Expected no double claim."] },
  { name: "needs_review aggregate date range remains non-executable", assert: () => {
    const filter = aggregateDateRangeProposal().filters[0];
    const preview = previewFor(aggregateDateRangeProposal());
    return filter?.semantics === "needs_review" && !filter.executable && !preview?.sql ? [] : ["Expected non-executable needs_review."];
  } },
  { name: "Scalar grounding remains green", assert: () => sqlFor(proposalFor("Show order_id where order_amount is above 100.", orders))?.includes("> 100;") ? [] : ["Expected scalar grounding."] },
  { name: "IN/NOT IN grounding remains green", assert: () => noSql("Show order_id where status is in active, pending.", orders) === false && noSql("Show order_id where status is not in closed, pending.", orders) === false ? [] : ["Expected set grounding."] },
  { name: "Numeric BETWEEN grounding remains green", assert: () => sqlFor(proposalFor("Show order_id where order_amount is between 100 and 500.", orders))?.includes("BETWEEN 100 AND 500;") ? [] : ["Expected numeric BETWEEN."] },
  { name: "BEFORE/AFTER grounding remains green", assert: () => {
    const before = sqlFor(proposalFor("Show order_id where order_date is before 2026-01-01.", orders));
    const after = sqlFor(proposalFor("Show order_id where order_date is after 2026-01-01.", orders));
    return before?.includes("< DATE '2026-01-01';") && after?.includes("> DATE '2026-01-01';") ? [] : ["Expected before/after grounding."];
  } },
  { name: "Canonical date-range renderer remains green", assert: () => sqlFor(validProposal()) === expectedDateSql ? [] : ["Expected canonical date renderer."] },
  { name: "Numeric BETWEEN renderer remains byte-identical", assert: () => sqlFor(proposalFor("Show order_id where order_amount is between 100 and 500.", orders)) === [
    "SELECT",
    '  "orders"."order_id" AS "order_id"',
    'FROM "orders"',
    'WHERE "orders"."order_amount" BETWEEN 100 AND 500;',
  ].join("\n") ? [] : ["Expected numeric renderer unchanged."] },
  { name: "Legacy date array remains refused", assert: () => {
    const result = bridgeFor(withCanonicalFilter(validProposal(), (filter) => ({ ...filter, comparisonValue: { kind: "set", valueKind: "string", values: ["2026-01-01", "2026-12-31"] } as BusinessSqlFilterComparisonValue })));
    return result.state === "blocked_plan" ? [] : ["Expected legacy array refusal."];
  } },
  { name: "Legacy date-range string remains refused", assert: () => {
    const result = bridgeFor(withCanonicalFilter(validProposal(), (filter) => ({ ...filter, comparisonValue: { kind: "string", value: "2026-01-01 to 2026-12-31" } })));
    return result.state === "blocked_plan" ? [] : ["Expected legacy string refusal."];
  } },
  { name: "Valid preview exposes Copy only", assert: () => {
    const preview = previewFor(validProposal());
    return preview?.sql === expectedDateSql && preview.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql ? [] : ["Expected copy-only preview."];
  } },
  { name: "Invalid preview exposes no actions", assert: () => {
    const preview = previewFor(proposalFor("Show order_id where order_date is between 2026-12-31 and 2026-01-01.", orders));
    return !preview?.sql && !preview?.actions.canCopySql && !preview?.actions.canInsertSql && !preview?.actions.canRunSql ? [] : ["Expected no-action preview."];
  } },
  { name: "No automatic Insert", assert: () => {
    const result = renderBusinessSqlQueryPlan(bridgeFor(validProposal()).plan!);
    return !result.inserted ? [] : ["Expected no insert."];
  } },
  { name: "No automatic Run", assert: () => {
    const result = renderBusinessSqlQueryPlan(bridgeFor(validProposal()).plan!);
    return !result.ranQuery ? [] : ["Expected no run."];
  } },
];

export function runExplicitDateRangeFilterGroundingFixtures(): ExplicitDateRangeFilterGroundingFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
    return { name: fixture.name, ok: failureReasons.length === 0, failureReasons };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const explicitDateRangeFilterGroundingFixturesPass =
  runExplicitDateRangeFilterGroundingFixtures().failed.length === 0;
