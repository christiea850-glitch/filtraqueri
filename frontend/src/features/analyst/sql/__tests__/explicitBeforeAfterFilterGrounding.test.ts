/** PS-7c - explicit natural-language BEFORE/AFTER date grounding fixtures. */

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

type FixtureResult = { name: string; ok: boolean; failureReasons: string[] };
type Fixture = { name: string; assert: () => string[] };

export type ExplicitBeforeAfterFilterGroundingFixtureReport = {
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
  column("revenue", "numeric"),
  column("cost", "numeric"),
  column("sale_date", "date"),
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

const beforeProposal = () =>
  proposalFor("Show order_id where order_date is before 2026-01-01.", orders);

const afterProposal = () =>
  proposalFor("Show order_id where order_date is after 2026-01-01.", orders);

const expectedBeforeSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_date" < DATE \'2026-01-01\';',
].join("\n");

const expectedAfterSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."order_date" > DATE \'2026-01-01\';',
].join("\n");

const validDates = [
  "2026-01-01",
  "2026-12-31",
  "2024-02-29",
  "2000-02-29",
  "1900-03-01",
] as const;

const invalidDatePrompts = [
  ["1900-02-29 rejects", "Show order_id where order_date is before 1900-02-29."],
  ["2026-02-29 rejects", "Show order_id where order_date is before 2026-02-29."],
  ["2026-02-30 rejects", "Show order_id where order_date is before 2026-02-30."],
  ["2026-04-31 rejects", "Show order_id where order_date is before 2026-04-31."],
  ["Month 00 rejects", "Show order_id where order_date is before 2026-00-01."],
  ["Month 13 rejects", "Show order_id where order_date is before 2026-13-01."],
  ["Day 00 rejects", "Show order_id where order_date is before 2026-01-00."],
  ["Day 32 rejects", "Show order_id where order_date is before 2026-01-32."],
  ["Non-padded month rejects", "Show order_id where order_date is before 2026-2-01."],
  ["Non-padded day rejects", "Show order_id where order_date is before 2026-02-1."],
  ["Slash format rejects", "Show order_id where order_date is before 2026/02/01."],
  ["Locale format rejects", "Show order_id where order_date is before 02/01/2026."],
  ["Written month rejects", "Show order_id where order_date is before January 1, 2026."],
  ["Datetime rejects", "Show order_id where order_date is before 2026-01-01T00:00:00."],
  ["Timestamp-Z rejects", "Show order_id where order_date is before 2026-01-01Z."],
  ["Date-plus-time rejects", "Show order_id where order_date is after 2026-01-01 12:00."],
  ["Quoted date rejects", 'Show order_id where order_date is before "2026-01-01".'],
  ["Single quoted date rejects", "Show order_id where order_date is before '2026-01-01'."],
  ["Empty value rejects", "Show order_id where order_date is before ."],
  ["Whitespace value rejects", "Show order_id where order_date is before    ."],
  ["Extra suffix text rejects", "Show order_id where order_date is before 2026-01-01 UTC."],
  ["Extra prefix text rejects", "Show order_id where order_date is before date 2026-01-01."],
  ["Multiple dates reject", "Show order_id where order_date is before 2026-01-01 2026-02-01."],
] as const;

const wrongTypePrompts = [
  ["Numeric field rejects", "Show order_id where order_amount is before 2026-01-01.", orders],
  ["Text field rejects", "Show order_id where status is after 2026-01-01.", orders],
  ["Categorical field rejects", "Show order_id where status is before 2026-01-01.", orders],
  ["Boolean field rejects", "Show order_id where is_active is before 2026-01-01.", orders],
  ["Datetime field rejects", "Show event_id where created_at is after 2026-01-01.", events],
  ["Timestamp field rejects", "Show event_id where updated_at is after 2026-01-01.", events],
] as const;

const fixtures: Fixture[] = [
  { name: "is before maps to before", assert: () => canonicalFilter(beforeProposal())?.operator === "before" ? [] : ["Expected before."] },
  { name: "is after maps to after", assert: () => canonicalFilter(afterProposal())?.operator === "after" ? [] : ["Expected after."] },
  { name: "Bare before remains unsupported", assert: () => noSql("Show order_id where order_date before 2026-01-01.", orders) ? [] : ["Expected bare before unsupported."] },
  { name: "Bare after remains unsupported", assert: () => noSql("Show order_id where order_date after 2026-01-01.", orders) ? [] : ["Expected bare after unsupported."] },
  { name: "No inclusive phrase is supported", assert: () => [
    ...(noSql("Show order_id where order_date is on or before 2026-01-01.", orders) ? [] : ["Expected on-or-before unsupported."]),
    ...(noSql("Show order_id where order_date is on or after 2026-01-01.", orders) ? [] : ["Expected on-or-after unsupported."]),
  ] },
  { name: "Exactly one WHERE is required", assert: () => canonicalFilter(beforeProposal()) && !canonicalFilter(proposalFor("Show order_id before 2026-01-01.", orders)) ? [] : ["Expected one WHERE boundary."] },
  { name: "Multiple WHERE shells reject", assert: () => noSql("Show order_id where order_date is before 2026-01-01 where status equals active.", orders) ? [] : ["Expected multiple WHERE rejection."] },
  { name: "Extra AND rejects", assert: () => noSql("Show order_id where order_date is before 2026-01-01 and status is active.", orders) ? [] : ["Expected AND rejection."] },
  { name: "OR rejects", assert: () => noSql("Show order_id where order_date is after 2026-01-01 or status is pending.", orders) ? [] : ["Expected OR rejection."] },
  { name: "Multiple date predicates reject", assert: () => noSql("Show order_id where order_date is before 2026-01-01 and order_date is after 2025-01-01.", orders) ? [] : ["Expected multiple date predicate rejection."] },
  ...validDates.map((date): Fixture => ({
    name: `${date} parses and renders`,
    assert: () => {
      const proposal = proposalFor(`Show order_id where order_date is before ${date}.`, orders);
      const value = canonicalFilter(proposal)?.comparisonValue;
      return value?.kind === "date" && value.value === date && sqlFor(proposal)?.includes(`DATE '${date}'`)
        ? []
        : [`Expected ${date} canonical render.`];
    },
  })),
  ...invalidDatePrompts.map(([name, prompt]): Fixture => ({
    name,
    assert: () => noSql(prompt, orders) ? [] : [`Expected no SQL for ${name}.`],
  })),
  { name: "Date field accepts before", assert: () => sqlFor(beforeProposal()) === expectedBeforeSql ? [] : ["Expected date before SQL."] },
  { name: "Date field accepts after", assert: () => sqlFor(afterProposal()) === expectedAfterSql ? [] : ["Expected date after SQL."] },
  ...wrongTypePrompts.map(([name, prompt, scope]): Fixture => ({
    name,
    assert: () => noSql(prompt, scope) ? [] : [`Expected no SQL for ${name}.`],
  })),
  { name: "Unknown field rejects", assert: () => noSql("Show order_id where missing_date is before 2026-01-01.", orders) ? [] : ["Expected unknown field."] },
  { name: "Missing field rejects", assert: () => noSql("Show order_id where is before 2026-01-01.", orders) ? [] : ["Expected missing field."] },
  { name: "Ambiguous field rejects", assert: () => noSql("Show order_id where order_date is before 2026-01-01.", orders, [orders, worksheet("shipments", [column("order_date", "date")])]) ? [] : ["Expected ambiguous field."] },
  { name: "Resolved joined date field grounds", assert: () => {
    const contract = acceptedContract("orders", "customer_id", "customers", "customer_id");
    const proposal = proposalFor("Show order_id where signup_date is after 2026-01-01.", orders, [orders, customers], [contract]);
    return canonicalFilter(proposal)?.target?.table === "customers" && sqlFor(proposal, [contract])?.includes('WHERE "customers"."signup_date" > DATE') ? [] : ["Expected joined grounding."];
  } },
  { name: "Unresolved joined date field blocks", assert: () => noSql("Show order_id where signup_date is after 2026-01-01.", orders, [orders, customers]) ? [] : ["Expected unresolved join block."] },
  { name: "Canonical proposed date shape", assert: () => {
    const filter = canonicalFilter(beforeProposal());
    const value = filter?.comparisonValue;
    return filter?.semantics === "canonical" && filter.executable === true && filter.operator === "before" && value?.kind === "date" && value.valueKind === "date" && value.value === "2026-01-01" ? [] : ["Expected canonical date proposal."];
  } },
  { name: "Proposed before ID is stable", assert: () => canonicalFilter(beforeProposal())?.id === canonicalFilter(beforeProposal())?.id ? [] : ["Expected before ID stable."] },
  { name: "Proposed after ID is stable", assert: () => canonicalFilter(afterProposal())?.id === canonicalFilter(afterProposal())?.id ? [] : ["Expected after ID stable."] },
  { name: "Date changes proposed ID", assert: () => canonicalFilter(beforeProposal())?.id !== canonicalFilter(proposalFor("Show order_id where order_date is before 2026-01-02.", orders))?.id ? [] : ["Expected date-sensitive ID."] },
  { name: "Before and after IDs differ", assert: () => canonicalFilter(beforeProposal())?.id !== canonicalFilter(afterProposal())?.id ? [] : ["Expected operator-sensitive ID."] },
  { name: "Field change changes ID", assert: () => canonicalFilter(proposalFor("Show event_id where event_date is before 2026-01-01.", events))?.id !== canonicalFilter(beforeProposal())?.id ? [] : ["Expected field-sensitive ID."] },
  { name: "Label change does not change ID", assert: () => {
    const filter = canonicalFilter(beforeProposal());
    if (!filter) return ["Expected canonical filter."];
    return filter.id === createProposedRowFilterId({ target: filter.target, operator: filter.operator, comparisonValue: filter.comparisonValue }) ? [] : ["Expected label-neutral ID."];
  } },
  { name: "Evidence change does not change ID", assert: () => {
    const filter = canonicalFilter(beforeProposal());
    const changed = filter ? { ...filter, evidence: "changed" } : null;
    return filter && changed && filter.id === createProposedRowFilterId(changed) ? [] : ["Expected evidence-neutral ID."];
  } },
  { name: "Date identity differs from scalar string identity", assert: () => canonicalFilter(beforeProposal())?.id !== createProposedRowFilterId({ target: canonicalFilter(beforeProposal())?.target, operator: "equals", comparisonValue: { kind: "string", value: "2026-01-01" } }) ? [] : ["Expected date/string identity distinction."] },
  { name: "Bridge preserves date comparison value", assert: () => finalFilter(beforeProposal())?.comparisonValue?.kind === "date" ? [] : ["Expected bridge date."] },
  { name: "Final filterId equals createBusinessSqlFilterId", assert: () => {
    const filter = finalFilter(beforeProposal());
    return filter && filter.filterId === createBusinessSqlFilterId(filter) ? [] : ["Expected final filterId."] ;
  } },
  { name: "Malformed bridged date blocks", assert: () => {
    const proposal = beforeProposal();
    const broken = { ...proposal, filters: proposal.filters.map((filter) => filter.semantics === "canonical" ? { ...filter, comparisonValue: { kind: "date" as const, valueKind: "date" as const, value: "2026-02-29" } } : filter) };
    const result = bridgeFor(broken);
    return result.state === "blocked_plan" && result.issues.some((issue) => issue.code === "invalid_canonical_filter") ? [] : ["Expected malformed bridge block."];
  } },
  { name: "Wrong-type bridged date blocks", assert: () => {
    const proposal = beforeProposal();
    const broken = { ...proposal, filters: proposal.filters.map((filter) => filter.semantics === "canonical" ? { ...filter, target: filter.target ? { ...filter.target, fieldInferredType: "numeric" as const } : filter.target } : filter) };
    const result = bridgeFor(broken);
    return result.state === "blocked_plan" && result.issues.some((issue) => issue.code === "invalid_canonical_filter") ? [] : ["Expected wrong-type bridge block."];
  } },
  { name: "Exact BEFORE SQL", assert: () => sqlFor(beforeProposal()) === expectedBeforeSql ? [] : ["Expected exact BEFORE SQL."] },
  { name: "Exact AFTER SQL", assert: () => sqlFor(afterProposal()) === expectedAfterSql ? [] : ["Expected exact AFTER SQL."] },
  { name: "BEFORE uses less-than", assert: () => expectedBeforeSql.includes(" < DATE ") && !expectedBeforeSql.includes("<=") ? [] : ["Expected strict before."] },
  { name: "AFTER uses greater-than", assert: () => expectedAfterSql.includes(" > DATE ") && !expectedAfterSql.includes(">=") ? [] : ["Expected strict after."] },
  { name: "DATE literal and semicolon present", assert: () => expectedBeforeSql.includes("DATE '2026-01-01'") && expectedBeforeSql.endsWith(";") ? [] : ["Expected DATE literal and semicolon."] },
  { name: "Joined BEFORE renders", assert: () => {
    const contract = acceptedContract("orders", "customer_id", "customers", "customer_id");
    const proposal = proposalFor("Show order_id where signup_date is before 2026-01-01.", orders, [orders, customers], [contract]);
    return sqlFor(proposal, [contract])?.includes('JOIN "customers"') && sqlFor(proposal, [contract])?.includes('WHERE "customers"."signup_date" < DATE') ? [] : ["Expected joined BEFORE SQL."];
  } },
  { name: "Joined AFTER renders", assert: () => {
    const contract = acceptedContract("orders", "customer_id", "customers", "customer_id");
    const proposal = proposalFor("Show order_id where signup_date is after 2026-01-01.", orders, [orders, customers], [contract]);
    return sqlFor(proposal, [contract])?.includes('WHERE "customers"."signup_date" > DATE') ? [] : ["Expected joined AFTER SQL."];
  } },
  { name: "Field projection remains unsorted and no LIMIT", assert: () => {
    const sql = sqlFor(beforeProposal()) || "";
    return !sql.includes("ORDER BY") && !sql.includes("LIMIT") ? [] : ["Expected unsorted projection with no LIMIT."];
  } },
  { name: "WHERE precedes GROUP BY/HAVING/ORDER BY and LIMIT last", assert: () => {
    const proposal = proposalFor("Show top 5 total revenue by region where sale_date is after 2026-01-01.", sales);
    const sql = sqlFor(proposal) || "";
    return sql.includes("WHERE") &&
      sql.indexOf("WHERE") < sql.indexOf("GROUP BY") &&
      sql.indexOf("WHERE") < sql.indexOf("ORDER BY") &&
      (!sql.includes("LIMIT") || /LIMIT \d+;$/.test(sql))
      ? []
      : ["Expected clause ordering."];
  } },
  { name: "Grouped aggregation retains explicit default ordering", assert: () => bridgeFor(proposalFor("Show total revenue by region where sale_date is after 2026-01-01.", sales)).plan?.orderBy.length === 1 ? [] : ["Expected default order."] },
  { name: "Empty orderBy remains unsorted", assert: () => {
    const bridge = bridgeFor(proposalFor("Show total revenue by region where sale_date is after 2026-01-01.", sales));
    const plan = bridge.plan ? { ...bridge.plan, orderBy: [] } : null;
    const preview = plan ? createBusinessSqlRenderPreview(plan) : null;
    return preview?.sql && !preview.sql.includes("ORDER BY") ? [] : ["Expected empty orderBy unsorted."];
  } },
  { name: "Aggregate date wording does not become WHERE", assert: () => {
    const proposal = proposalFor("Show regions where total revenue is before 2026-01-01.", sales);
    return !canonicalFilter(proposal) && !sqlFor(proposal) ? [] : ["Expected aggregate date no WHERE."];
  } },
  { name: "Derived aggregate date wording does not become WHERE", assert: () => {
    const proposal = proposalFor("Show regions where total revenue minus total cost is before 2026-01-01.", sales);
    return !canonicalFilter(proposal) && !sqlFor(proposal) ? [] : ["Expected derived aggregate date no WHERE."];
  } },
  { name: "No WHERE/HAVING double claim", assert: () => {
    const proposal = proposalFor("Show regions where total revenue is after 2026-01-01.", sales);
    return !canonicalFilter(proposal) && proposal.aggregateResultConditions.length === 0 ? [] : ["Expected no double claim."];
  } },
  { name: "Scalar grounding remains green", assert: () => sqlFor(proposalFor("Show order_id where order_amount is above 1000.", orders))?.includes("> 1000") ? [] : ["Expected scalar grounding."] },
  { name: "IN/NOT IN grounding remains green", assert: () => [
    ...(sqlFor(proposalFor("Show order_id where status is one of active, pending.", orders))?.includes(" IN ") ? [] : ["Expected IN grounding."]),
    ...(sqlFor(proposalFor("Show order_id where status is not one of closed, pending.", orders))?.includes(" NOT IN ") ? [] : ["Expected NOT IN grounding."]),
  ] },
  { name: "BETWEEN grounding remains green", assert: () => sqlFor(proposalFor("Show order_id where order_amount is between 100 and 500.", orders))?.includes("BETWEEN 100 AND 500") ? [] : ["Expected BETWEEN grounding."] },
  { name: "Canonical before and after renderers remain green", assert: () => sqlFor(beforeProposal()) === expectedBeforeSql && sqlFor(afterProposal()) === expectedAfterSql ? [] : ["Expected canonical date renderer."] },
  { name: "Legacy date-like value remains refused", assert: () => noSql("Show active orders before 2026-01-01.", orders) ? [] : ["Expected legacy date-like refusal."] },
  { name: "Raw SQL-like predicate rejects", assert: () => noSql("Show order_id where order_date is before 2026-01-01; drop table orders.", orders) ? [] : ["Expected raw SQL rejection."] },
  { name: "Valid preview exposes Copy only", assert: () => {
    const preview = previewFor(beforeProposal());
    return preview?.sql === expectedBeforeSql && preview.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql ? [] : ["Expected copy-only preview."];
  } },
  { name: "Invalid preview exposes no actions", assert: () => {
    const preview = previewFor(proposalFor("Show order_id where order_date is before 2026-02-29.", orders));
    return !preview?.sql && !preview?.actions.canCopySql && !preview?.actions.canInsertSql && !preview?.actions.canRunSql ? [] : ["Expected invalid no actions."];
  } },
  { name: "No automatic Insert", assert: () => bridgeFor(beforeProposal()).noInsertPerformed ? [] : ["Expected no insert."] },
  { name: "No automatic Run", assert: () => bridgeFor(beforeProposal()).noRunPerformed ? [] : ["Expected no run."] },
];

export function runExplicitBeforeAfterFilterGroundingFixtures(): ExplicitBeforeAfterFilterGroundingFixtureReport {
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

export const explicitBeforeAfterFilterGroundingFixturesPass =
  runExplicitBeforeAfterFilterGroundingFixtures().failed.length === 0;
